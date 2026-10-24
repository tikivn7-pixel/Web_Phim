(function (root) {
  'use strict';
  const TYPES = ['', 'film', 'series', 'anime'];
  function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim(); }
  function genres(movie) { return String(movie.genres || '').split(',').map(value => value.trim()).filter(Boolean); }
  function typeMatches(movie, type) {
    if (type === 'anime') return ['animation', 'hoathinh'].includes(movie.type) || genres(movie).some(genre => ['anime', 'hoat hinh'].includes(normalize(genre)));
    if (type === 'film') return movie.type === 'single';
    if (type === 'series') return ['series', 'tvshows'].includes(movie.type);
    return true;
  }
  function clean(raw = {}) {
    const year = value => /^\d{4}$/.test(String(value || '')) && Number(value) >= 1800 && Number(value) <= 2199 ? String(value) : '';
    return { type: TYPES.includes(raw.type) ? raw.type : '', genre: String(raw.genre || '').slice(0, 100), country: String(raw.country || '').slice(0, 100),
      from: year(raw.from), to: year(raw.to), hideCompleted: raw.hideCompleted !== false && raw.hideCompleted !== '0', stage: Math.max(0, Math.min(3, Math.floor(Number(raw.stage)) || 0)) };
  }
  function select(movies, raw = {}, journal = {}) {
    const state = clean(raw), seen = new Set();
    return movies.filter(movie => {
      if (!movie.slug || seen.has(movie.slug)) return false;
      seen.add(movie.slug);
      if (!typeMatches(movie, state.type)) return false;
      if (state.country && movie.country !== state.country) return false;
      if (state.genre && !genres(movie).includes(state.genre)) return false;
      const year=Number(movie.year),knownYear=Number.isInteger(year)&&year>=1800&&year<=2199;
      if (state.from && (!knownYear || year < Number(state.from))) return false;
      if (state.to && (!knownYear || year > Number(state.to))) return false;
      return !state.hideCompleted || journal[movie.slug]?.status !== 'completed';
    });
  }
  function facets(movies) {
    return { countries: [...new Set(movies.map(movie => movie.country).filter(Boolean))].sort((a,b) => a.localeCompare(b,'vi')),
      genres: [...new Set(movies.flatMap(genres))].sort((a,b) => a.localeCompare(b,'vi')),
      years: [...new Set(movies.map(movie => Number(movie.year)).filter(year => Number.isInteger(year) && year >= 1800 && year <= 2199))].sort((a,b) => b-a) };
  }
  function draw(pool, seen = [], count = 3, random = Math.random) {
    const used = new Set(seen), remaining = pool.filter(movie => !used.has(movie.slug)), picked = [];
    const limit = Math.max(1, Math.min(3, Math.floor(Number(count)) || 1));
    while (remaining.length && picked.length < limit) {
      const value = Number(random());
      const index = Math.max(0, Math.min(remaining.length - 1, Math.floor((Number.isFinite(value) ? value : 0) * remaining.length)));
      picked.push(remaining.splice(index,1)[0]);
    }
    return { movies: picked, seen: [...new Set([...used, ...picked.map(movie => movie.slug)])], remaining: remaining.length };
  }
  function readUrl(search) {
    const params = new URLSearchParams(search);
    return clean(Object.fromEntries(['type','genre','country','from','to','stage'].map(key => [key,params.get(key) || '']).concat([['hideCompleted',params.get('seen') !== '1']])));
  }
  function url(raw, base = 'picker.html') {
    const state = clean(raw), params = new URLSearchParams();
    for (const key of ['type','genre','country','from','to']) if(state[key]) params.set(key,state[key]);
    if (!state.hideCompleted) params.set('seen','1');
    if(state.stage) params.set('stage',state.stage);
    return base + (params.size ? '?' + params : '');
  }
  function signature(state) { const {stage, ...filters} = clean(state); return JSON.stringify(filters); }
  const api = { normalize, genres, typeMatches, clean, select, facets, draw, readUrl, url, signature };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PickerModel = api;
})(globalThis);
