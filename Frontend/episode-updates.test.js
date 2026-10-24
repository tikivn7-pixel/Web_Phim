const test = require('node:test');
const assert = require('node:assert/strict');
const Updates = require('./episode-updates.js');
function storage() { const rows = new Map(); return { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, String(value)), removeItem: key => rows.delete(key) }; }
function payload(names, slug = 'show') { return { status: true, movie: { slug, episode_current: 'Tập ' + names.at(-1), status: 'ongoing' }, episodes: [{ server_name: 'Vietsub', server_data: names.map(name => ({ name: String(name), link_m3u8: 'https://stream.example/' + name })) }] }; }
function setup(names = ['1', '2']) {
  let at = 1700000000000, body = payload(names), calls = 0;
  const store = storage(); store.setItem('my_wishlist', JSON.stringify([{ slug: 'show' }]));
  const service = Updates.create({ storage: store, now: () => at, fetch: async () => { calls++; if (body instanceof Error) throw body; return { ok: true, json: async () => body }; } });
  return { store, service, movies: [{ slug: 'show', title: 'Show' }], advance: (ms = Updates.TTL) => { at += ms; }, body: value => { body = value; }, calls: () => calls };
}
test('first successful check is baseline, TTL prevents a repeated request, new episodes are acknowledged explicitly', async () => {
  const env = setup(); await env.service.check(env.movies);
  assert.equal(env.calls(), 1); assert.deepEqual(env.service.read().entries.show.newNames, []);
  env.body(payload(['1', '2', '3'])); await env.service.check(env.movies); assert.equal(env.calls(), 1);
  env.advance(); await env.service.check(env.movies);
  assert.deepEqual(env.service.read().entries.show.newNames, ['3']);
  assert.equal(env.service.read().entries.show.available, 3);
  env.service.ack('show'); assert.deepEqual(env.service.read().entries.show.newNames, []);
  assert.equal(env.service.read().entries.show.names.length, 3);
});
test('servers and equivalent numeric names are deduplicated, trailers and unplayable episodes ignored', () => {
  const data = payload(['1', '2']); data.episodes.push({ server_data: [{ name: 'Tập 01', link_embed: 'https://stream.example/1' }, { name: 'Ep 2', link_m3u8: 'https://stream.example/2' }, { name: '3', link_embed: '' }, { name: 'Trailer', link_embed: 'https://stream.example/t' }, { name: '4', link_embed: 'javascript:alert(1)' }] });
  assert.deepEqual(Updates.snapshot(data, 'show').names.map(item => item.id), ['1', '2']);
  assert.throws(() => Updates.snapshot(data, 'other'), /đúng phim/);
});
test('temporary removal and re-addition never report an old episode as new; errors retain successful snapshot', async () => {
  const env = setup(); await env.service.check(env.movies); const first = env.service.read().entries.show.checkedAt;
  env.body(payload(['1'])); env.advance(); await env.service.check(env.movies);
  assert.equal(env.service.read().entries.show.available, 1); assert.equal(env.service.read().entries.show.names.length, 2);
  env.body(payload(['1', '2'])); env.advance(); await env.service.check(env.movies); assert.deepEqual(env.service.read().entries.show.newNames, []);
  env.body(Error('Offline')); env.advance(); await env.service.check(env.movies);
  const failure = env.service.read().entries.show; assert.equal(failure.error, 'Offline'); assert.ok(failure.checkedAt > first); assert.equal(failure.names.length, 2);
  await env.service.check(env.movies); assert.equal(env.calls(), 4);
  env.advance(Updates.RETRY); env.body(payload(['1', '2', '3'])); await env.service.check(env.movies); assert.deepEqual(env.service.read().entries.show.newNames, ['3']);
});
test('failures before baseline do not label the first successful episodes as new', async () => {
  const env = setup(); env.body(Error('fail')); await env.service.check(env.movies); env.body(payload(['1', '2', '3'])); env.advance(); await env.service.check(env.movies);
  assert.deepEqual(env.service.read().entries.show.newNames, []);
});
test('tracked movies use exact catalog identities, explicit journal exclusions, aliases and a bounded recent selection', () => {
  const store = storage(), movies = Array.from({ length: 110 }, (_, i) => ({ slug: 'show-' + i }));
  store.setItem('my_wishlist', JSON.stringify(movies.map((m, i) => ({ slug: m.slug, updatedAt: i }))));
  store.setItem('movie_journal_v1', JSON.stringify({ entries: { 'show-109': { status: 'completed', updatedAt: 500 }, 'show-108': { status: 'paused', updatedAt: 600 } } }));
  store.setItem('continue_watching_list', JSON.stringify([{ slug: 'missing' }, { slug: 'phim/alias' }])); movies.push({ slug: 'phim/alias', apiSlug: 'alias' });
  const service = Updates.create({ storage: store }), tracked = service.tracked(movies);
  assert.equal(tracked.length, 100); assert.ok(!tracked.some(m => ['show-109', 'show-108', 'missing'].includes(m.slug))); assert.equal(tracked[0].slug, 'show-107');
  store.setItem('my_wishlist', '[]'); store.setItem('movie_journal_v1', '{}'); assert.deepEqual(service.tracked(movies), [{ slug: 'phim/alias', apiSlug: 'alias' }]);
});
test('requests coalesce, use two workers at most, restricted endpoint and safe fetch options', async () => {
  const store = storage(), movies = Array.from({ length: 6 }, (_, i) => ({ slug: 'show-' + i })); store.setItem('my_wishlist', JSON.stringify(movies));
  let inFlight = 0, maximum = 0, calls = 0;
  const service = Updates.create({ storage: store, fetch: async (url, init) => { assert.ok(url.startsWith('https://phimapi.com/phim/show-')); assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); calls++; maximum = Math.max(maximum, ++inFlight); await new Promise(resolve => setTimeout(resolve, 3)); inFlight--; return { ok: true, json: async () => payload(['1'], url.split('/').at(-1)) }; } });
  const a = service.check(movies), b = service.check(movies); assert.equal(a, b); await a; assert.equal(maximum, 2); assert.equal(calls, 6);
});
test('a request including JSON parsing times out; failed cache retains no stream URLs', async () => {
  const store = storage(); store.setItem('my_wishlist', '[{"slug":"show"}]');
  const service = Updates.create({ storage: store, timeoutMs: 5, fetch: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  await service.check([{ slug: 'show' }]); assert.match(service.read().entries.show.error, /quá lâu/);
  assert.equal(service.busy(), false); assert.ok(!store.getItem(Updates.KEY).includes('link_m3u8'));
});
test('manual refresh is rate limited; stale cross-tab lease blocks a duplicate sweep only until expiry', async () => {
  const env = setup(); await env.service.check(env.movies); await env.service.check(env.movies, { force: true }); assert.equal(env.calls(), 1);
  env.advance(30000); await env.service.check(env.movies, { force: true }); assert.equal(env.calls(), 2);
  env.advance(); env.store.setItem(Updates.KEY + '_lease', JSON.stringify({ token: 'other', until: 1e15 })); await env.service.check(env.movies); assert.equal(env.calls(), 2);
  env.store.removeItem(Updates.KEY + '_lease'); await env.service.check(env.movies); assert.equal(env.calls(), 3);
});
test('corrupt disposable cache cannot clear personal data and oversized entries are bounded', () => {
  const env = setup(); env.store.setItem(Updates.KEY, '{oops'); assert.deepEqual(env.service.read(), { version: 1, entries: {} }); assert.match(env.service.warning(), /bị lỗi/); assert.ok(env.store.getItem('my_wishlist'));
  const entries = {}; for (let i = 0; i < 200; i++) entries['show-' + i] = { attemptAt: i, names: [], newNames: [] };
  const normalized = Updates.normalize({ version: 1, entries }); assert.equal(Object.keys(normalized.entries).length, 100); assert.ok(normalized.entries['show-199']);
});
test('watch links carry logical episode, actual raw index/server and source; unsafe provider aliases are never requested', async () => {
  const url = new URL(Updates.watchURL({ slug: 'show', title: 'A & B' }, { newNames: ['3'], names: [{ id: '3', name: 'Tập 3', episode: 7, server: 1 }] }), 'https://local.example/');
  assert.equal(url.searchParams.get('target_episode'), 'Tập 3'); assert.equal(url.searchParams.get('ep'), '7'); assert.equal(url.searchParams.get('server'), '1'); assert.equal(url.searchParams.get('data_source'), 'kkphim');
  const env = setup(); await env.service.check([{ slug: 'show', apiSlug: '../not-allowed' }]); assert.equal(env.calls(), 0);
});
test('quota failure keeps successful results in memory and never changes personal storage', async () => {
  const backing = storage(); backing.setItem('my_wishlist', '[{"slug":"show"}]');
  const blocked = { ...backing, setItem(key, value) { if (key === Updates.KEY) throw Error('quota'); backing.setItem(key, value); } };
  const service = Updates.create({ storage: blocked, fetch: async () => ({ ok: true, json: async () => payload(['1', '2']) }) });
  await service.check([{ slug: 'show' }]); assert.equal(service.read().entries.show.available, 2); assert.ok(service.read().entries.show.checkedAt); assert.match(service.warning(), /phiên này/); assert.equal(backing.getItem('my_wishlist'), '[{"slug":"show"}]');
});
test('acknowledging while a request is running never resurrects acknowledged episodes', async () => {
  const env = setup(); await env.service.check(env.movies); env.advance(); env.body(payload(['1', '2', '3'])); await env.service.check(env.movies); assert.deepEqual(env.service.read().entries.show.newNames, ['3']);
  let resolve;
  env.advance();
  const slow = Updates.create({ storage: env.store, now: () => 1800000000000, fetch: () => new Promise(done => { resolve = done; }) });
  const pending = slow.check(env.movies); slow.ack('show'); resolve({ ok: true, json: async () => payload(['1', '2', '3', '4']) }); await pending;
  assert.deepEqual(slow.read().entries.show.newNames, ['4']);
});
test('a changed provider alias starts a new baseline even after an intervening error', async () => {
  const env = setup(); await env.service.check(env.movies); env.advance(); env.body(Error('offline')); await env.service.check([{ slug: 'show', apiSlug: 'other' }]);
  assert.equal(env.service.read().entries.show.sourceSlug, 'show');
  env.advance(); env.body(payload(['7', '8'], 'other')); await env.service.check([{ slug: 'show', apiSlug: 'other' }]);
  assert.equal(env.service.read().entries.show.sourceSlug, 'other'); assert.deepEqual(env.service.read().entries.show.newNames, []); assert.deepEqual(env.service.read().entries.show.names.map(item => item.id), ['7', '8']);
});
