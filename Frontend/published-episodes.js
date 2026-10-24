// Published observations contain episode names and positions only, never stream URLs.
(function (root) {
  'use strict';
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const slugOK = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,249}$/.test(value) && !['constructor', 'prototype'].includes(value);
  const identityOK = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 500 && !/[\u0000-\u001f\u007f]/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
  const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) : '';
  const integer = value => Number.isInteger(value) && value >= 0 && value <= 10000;
  const empty = () => ({ version: 1, generatedAt: '', movies: {} });
  function normalize(input) {
    const result = empty();
    if (!object(input) || input.version !== 1 || !object(input.movies)) return result;
    const summary = input.kind === 'summary';
    if (summary) result.kind = 'summary';
    if (typeof input.generatedAt === 'string' && Number.isFinite(Date.parse(input.generatedAt))) result.generatedAt = new Date(input.generatedAt).toISOString();
    for (const [slug, row] of Object.entries(input.movies).slice(0, 50000)) {
      if (!identityOK(slug) || !object(row) || !slugOK(row.sourceSlug) || !Number.isFinite(row.checkedAt) || row.checkedAt <= 0 || row.checkedAt > 1e15) continue;
      if (summary) {
        if (!integer(row.available) || row.available < 1) continue;
        result.movies[slug] = { sourceSlug: row.sourceSlug, checkedAt: row.checkedAt, available: row.available, current: clean(row.current), status: clean(row.status) };
        if (integer(row.total) && row.total > 0) result.movies[slug].total = row.total;
        continue;
      }
      const names = [], seen = new Set();
      for (const item of Array.isArray(row.names) ? row.names.slice(0, 10000) : []) {
        if (!object(item)) continue;
        const id = clean(item.id), name = clean(item.name);
        if (!id || !name || seen.has(id) || !integer(item.episode) || item.episode < 1 || !Number.isInteger(item.server) || item.server < 0 || item.server > 99) continue;
        seen.add(id); names.push({ id, name, episode: item.episode, server: item.server });
      }
      if (!names.length || !integer(row.available) || row.available < 1 || row.available > names.length) continue;
      result.movies[slug] = { sourceSlug: row.sourceSlug, checkedAt: row.checkedAt, names, available: row.available, current: clean(row.current), status: clean(row.status) };
      if (integer(row.total) && row.total > 0) result.movies[slug].total = row.total;
    }
    return result;
  }
  function summarize(input) {
    const normalized = normalize(input), movies = {};
    for (const [slug, row] of Object.entries(normalized.movies)) {
      const { names, ...counts } = row; movies[slug] = counts;
    }
    return { version: 1, kind: 'summary', generatedAt: normalized.generatedAt, movies };
  }
  function apply(movie, snapshot) {
    if (!object(movie)) return movie;
    if (root.HubCatalog) movie = root.HubCatalog.apply(movie);
    const row = snapshot?.movies?.[movie.slug];
    if (!row || row.sourceSlug !== (movie.apiSlug || movie.slug)) return movie;
    return { ...movie, episodes: Math.max(Number(movie.episodes) || 0, row.available, row.total || 0), availableEpisodes: row.available, episodeCurrent: row.current, episodeStatus: row.status, episodesCheckedAt: row.checkedAt, episodeSnapshot: row };
  }
  function overlay(movies, snapshot) { const safe = normalize(snapshot), list = root.HubCatalog ? root.HubCatalog.overlay(movies) : movies; return (Array.isArray(list) ? list : []).map(movie => apply(movie, safe)); }
  let pending;
  function load({ force = false } = {}) {
    if (!pending || force) pending = (async () => {
      const controller = new AbortController(); let timer;
      try {
        return normalize(await Promise.race([
          Promise.resolve().then(() => root.fetch('./data/episode-summary.json', { credentials: 'same-origin', cache: 'no-cache', signal: controller.signal })).then(response => response.ok ? response.json() : empty()).then(data => data?.kind === 'summary' ? data : empty()),
          new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve(empty()); }, 4000); })
        ]));
      } catch (_) { return empty(); }
      finally { clearTimeout(timer); }
    })();
    if (root.HubClient?.configured()) return Promise.all([pending, root.HubCatalog?.load({force}), root.HubClient.request('/episodes/summary',{timeout:5000}).catch(()=>empty())]).then(([local,,remote])=>{const combined=normalize(local),cloud=normalize(remote);for(const [slug,row]of Object.entries(cloud.movies))if(!combined.movies[slug]||row.checkedAt>combined.movies[slug].checkedAt)combined.movies[slug]=row;return combined;});
    return pending;
  }
  const api = { empty, normalize, summarize, apply, overlay, load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PublishedEpisodes = api;
})(globalThis);
