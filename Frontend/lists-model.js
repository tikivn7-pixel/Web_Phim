(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
  const index = movies => new Map(movies.map(movie => [movie.slug, movie]));
  function members(list, movies, options = {}) {
    const lookup = movies instanceof Map ? movies : index(movies), query = normalize(options.query);
    let result = (list?.slugs || []).map((slug, position) => ({ movie: lookup.get(slug) || { slug, title: slug, unavailable: true }, position }));
    if (query) result = result.filter(({ movie }) => normalize([movie.title, movie.originTitle, movie.slug].join(' ')).includes(query));
    if (options.sort === 'title') result.sort((a, b) => a.movie.title.localeCompare(b.movie.title, 'vi') || a.position - b.position);
    if (options.sort === 'year') result.sort((a, b) => Number(b.movie.year || 0) - Number(a.movie.year || 0) || a.position - b.position);
    return result;
  }
  function search(movies, query, page = 1, size = 20) {
    const term = normalize(query), all = term ? movies.filter(movie => normalize([movie.title, movie.originTitle, movie.slug].join(' ')).includes(term)) : [];
    const pages = Math.max(1, Math.ceil(all.length / size)), current = Math.min(pages, Math.max(1, Math.floor(Number(page) || 1)));
    return { total: all.length, page: current, pages, items: all.slice((current - 1) * size, current * size) };
  }
  const api = { normalize, index, members, search };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ListsModel = api;
})(globalThis);
