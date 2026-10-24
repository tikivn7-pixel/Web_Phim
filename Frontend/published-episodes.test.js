'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Published = require('./published-episodes.js');
const row = () => ({ sourceSlug: 'source-one', checkedAt: 1234, names: [{ id: '1', name: '1', episode: 1, server: 0 }], available: 1, current: '1/12', status: 'ongoing', total: 12 });
test('published observations strip stream URLs, invalid rows and duplicate names', () => {
  const valid = row(); valid.link_m3u8 = 'https://secret'; valid.names.push({ ...valid.names[0], link_embed: 'https://secret' });
  const normalized = Published.normalize({ version: 1, generatedAt: '2026-10-24', movies: { one: valid, empty: { ...row(), names: [] }, mismatch: { ...row(), available: 2 } } });
  assert.equal(Object.keys(normalized.movies).length, 1);
  assert.equal(normalized.movies.one.names.length, 1);
  assert.ok(!JSON.stringify(normalized).includes('secret'));
  assert.deepEqual(Published.normalize({ version: 2, movies: { one: row() } }), Published.empty());
});
test('published overlay preserves declared totals and catalog metadata, rejects stale source aliases', () => {
  const movie = { slug: 'one', apiSlug: 'source-one', episodes: 24, country: 'Japan', group: 'verified', genres: 'Animation' };
  const input = { version: 1, movies: { one: row() } }, result = Published.overlay([movie], input)[0];
  assert.equal(result.episodes, 24); assert.equal(result.availableEpisodes, 1); assert.equal(result.episodeStatus, 'ongoing');
  assert.equal(result.episodesCheckedAt, 1234); assert.equal(result.country, movie.country); assert.equal(result.group, movie.group);
  assert.equal(movie.availableEpisodes, undefined);
  assert.equal(Published.overlay([{ ...movie, apiSlug: 'different' }], input)[0].availableEpisodes, undefined);
  assert.equal(Published.overlay([{ ...movie, episodes: 2 }], input)[0].episodes, 12);
});
test('optional published data failure leaves catalog usable and force reload refreshes observations', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  assert.deepEqual(await Published.load({ force: true }), Published.empty());
  globalThis.fetch = async (url, options) => { assert.equal(url, './data/episode-summary.json'); assert.equal(options.cache, 'no-cache'); return { ok: true, json: async () => Published.summarize({ version: 1, movies: { one: row() } }) }; };
  assert.equal((await Published.load({ force: true })).movies.one.available, 1);
});
test('summary is small, accepts real counts without names and overlays exact identities', () => {
  const summary = Published.summarize({ version: 1, movies: { 'phim/one': row() } });
  assert.equal(summary.kind, 'summary'); assert.ok(!JSON.stringify(summary).includes('names'));
  const movie = Published.overlay([{ slug: 'phim/one', apiSlug: 'source-one', episodes: 24 }], summary)[0];
  assert.equal(movie.availableEpisodes, 1); assert.equal(movie.episodes, 24);
  const malformed = { version: 1, kind: 'summary', movies: { one: { ...row(), available: Infinity }, two: { ...row(), sourceSlug: 'https://evil.test' }, three: { ...row(), link_embed: 'https://secret.test', names: [{ link_m3u8: 'https://secret.test' }] } } };
  const safe = Published.normalize(malformed); assert.deepEqual(Object.keys(safe.movies), ['three']); assert.ok(!JSON.stringify(safe).includes('secret'));
});
