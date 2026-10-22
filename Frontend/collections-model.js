(function (root) {
  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  }
  function build(registry, movies) {
    const bySlug = new Map(movies.map(movie => [movie.slug, movie]));
    return (registry.groups || []).map(group => {
      const seen = new Set();
      const members = (group.members || []).map((member, index) => ({ ...member, movie: bySlug.get(member.slug), position: index }))
        .filter(member => member.movie && !seen.has(member.slug) && seen.add(member.slug))
        .sort((a, b) => (Number.isFinite(a.order) ? a.order : a.position) - (Number.isFinite(b.order) ? b.order : b.position) || a.position - b.position);
      const years = members.map(member => Number(member.movie.year)).filter(year => Number.isInteger(year) && year > 1800 && year < 2200);
      const countries = [...new Set(members.map(member => member.movie.country).filter(Boolean))];
      const genres = [...new Set(members.flatMap(member => String(member.movie.genres || '').split(',').map(value => value.trim()).filter(Boolean)))];
      const types = [...new Set(members.map(member => member.movie.type).filter(Boolean))];
      const anime = genres.some(genre => ['anime', 'hoat hinh'].includes(normalize(genre))) || types.some(type => ['hoathinh', 'animation'].includes(type));
      const title = group.label || members[0]?.movie.title || 'Bộ sưu tập phim';
      return { id: group.id, title, kind: group.kind || 'series', sources: group.sources || [], members, countries, genres, types, anime,
        yearMin: years.length ? Math.min(...years) : null, yearMax: years.length ? Math.max(...years) : null,
        search: normalize([title, ...members.flatMap(member => [member.label, member.slug, member.movie.title])].join(' ')) };
    }).filter(group => group.members.length >= 2);
  }
  function select(groups, options = {}) {
    const terms = normalize(options.q).split(' ').filter(Boolean);
    const list = groups.filter(group => terms.every(term => group.search.includes(term)) && (!options.country || group.countries.includes(options.country)) &&
      (!options.type || (options.type === 'anime' ? group.anime : options.type === 'film' ? group.types.includes('single') : group.types.some(type => ['series', 'tvshows'].includes(type)))));
    list.sort((a, b) => options.sort === 'title' ? a.title.localeCompare(b.title, 'vi') : options.sort === 'year' ? (b.yearMax || 0) - (a.yearMax || 0) || b.members.length - a.members.length : b.members.length - a.members.length || a.title.localeCompare(b.title, 'vi'));
    const pageSize = Math.max(1, Number(options.pageSize) || 24);
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    const page = Math.min(pages, Math.max(1, Math.floor(Number(options.page)) || 1));
    return { items: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pages, pageSize };
  }
  const api = { normalize, build, select };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CollectionsModel = api;
})(globalThis);
