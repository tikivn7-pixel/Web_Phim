const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('./lists-model');
const movies = [{ slug: 'b', title: 'Đêm mùa đông', year: 2020 }, { slug: 'a', title: 'Ánh sáng', year: 2025 }];
test('list search ignores accents and searches origin title with actual pagination', () => {
  assert.equal(M.search(movies, 'dem mua').items[0].slug, 'b');
  const result = M.search(Array.from({ length: 41 }, (_, n) => ({ slug: 'movie-' + n, title: 'Phim ' + n })), 'phim', 99);
  assert.equal(result.total, 41); assert.equal(result.pages, 3); assert.equal(result.page, 3); assert.equal(result.items.length, 1);
  assert.equal(M.search(movies, '').total, 0); assert.equal(M.search(movies, 'không có').items.length, 0);
});
test('list manual order and unknown movie membership survive filters and display sorting', () => {
  const list = { slugs: ['b', 'missing', 'a'] };
  assert.deepEqual(M.members(list, movies).map(x => x.movie.slug), list.slugs);
  assert.equal(M.members(list, movies)[1].movie.unavailable, true);
  assert.equal(M.members(list, movies, { sort: 'year' })[0].movie.slug, 'a');
  assert.equal(M.members(list, movies, { query: 'anh sang' })[0].position, 2);
  assert.deepEqual(list.slugs, ['b', 'missing', 'a']);
});
