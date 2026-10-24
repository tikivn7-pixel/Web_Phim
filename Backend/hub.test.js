'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHub, createScheduler, sanitizeMovie } = require('./hub-server.cjs');
const { HubStore } = require('./hub-store.cjs');
const { HubRooms } = require('./hub-rooms.cjs');
const PersonalData = require('../Frontend/personal-data.js');
const film = { slug: 'test-film', title: 'Phim thử', year: 2026, episodes: 12, type: 'series', country: 'Nhật Bản', genres: 'Bí Ẩn', poster: 'Img/poster.jpg' };
async function fixture(t, extra = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lauphim-hub-test-')), catalogPath = path.join(directory, 'catalog.json');
  await fs.writeFile(catalogPath, JSON.stringify(extra.catalogItems || [film])); let hub = await createHub({ dataDir: path.join(directory, 'private'), catalogPath, serveStatic: false, allowedOrigins: ['https://example.github.io'], ...extra });
  let address = await hub.start(); let base = 'http://127.0.0.1:' + address.port + '/api/hub';
  const request = async (route, options = {}) => {
    const headers = { ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}), ...(options.memberToken ? { 'X-Room-Token': options.memberToken } : {}), ...(options.headers || {}) };
    const result = await fetch(base + route, { method: options.method || (options.body === undefined ? 'GET' : 'POST'), headers, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) }); let data = null; try { data = await result.json(); } catch (_) {} return { status: result.status, data, headers: result.headers };
  };
  t.after(async () => { await hub.close(); await fs.rm(directory, { recursive: true, force: true }); });
  const register = (username = 'tester') => request('/auth/register', { body: { username, email: username + '@example.com', password: 'correct horse battery staple' } });
  return { directory, request, register, get hub() { return hub; }, async restart() { await hub.close(); hub = await createHub({ dataDir: path.join(directory, 'private'), catalogPath, serveStatic: false, ...extra }); address = await hub.start(); base = 'http://127.0.0.1:' + address.port + '/api/hub'; }, async admin(email = 'tester@example.com') { await hub.store.transaction(state => { state.users.find(user => user.email === email).role = 'admin'; }); } };
}
test('Hub accounts use hashed passwords/tokens, revocable sessions and durable storage', async t => {
  const f = await fixture(t), registered = await f.register(); assert.equal(registered.status, 200); const { token, user, profiles } = registered.data;
  assert.equal(user.role, 'user'); assert.equal(profiles.length, 1); assert(!JSON.stringify(registered.data).includes('passwordHash'));
  const stored = JSON.parse(await fs.readFile(path.join(f.directory, 'private/hub.json'), 'utf8'));
  assert(!JSON.stringify(stored).includes(token)); assert(!JSON.stringify(stored).includes('correct horse battery staple')); assert.equal(stored.users[0].passwordHash.length, 128);
  await f.restart(); assert.equal((await f.request('/me', { token })).status, 200);
  assert.equal((await f.request('/auth/login', { body: { identifier: 'TESTER@example.com', password: 'wrong' } })).status, 401);
  const login = await f.request('/auth/login', { body: { identifier: 'tester', password: 'correct horse battery staple' } }); assert.equal(login.status, 200);
  assert.equal((await f.request('/auth/logout', { token, method: 'POST' })).status, 200); assert.equal((await f.request('/me', { token })).status, 401);
  assert.equal((await f.request('/me', { token: login.data.token })).status, 200);
});
test('Hub registration validates identities, blocks duplicates and never accepts an admin role', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/auth/register', { body: { username: 'x', email: 'bad', password: 'short', role: 'admin' } })).status, 400);
  const one = await f.register(); assert.equal(one.data.user.role, 'user'); assert.equal((await f.register()).status, 409);
  assert.equal((await f.request('/admin/catalog', { token: one.data.token })).status, 403);
  assert.equal((await f.request('/profiles')).status, 401);
});
test('Profile ownership, six-profile cap and last-profile protection hold', async t => {
  const f = await fixture(t), alice = (await f.register('alice')).data, bob = (await f.register('bobby')).data, profile = alice.profiles[0];
  assert.equal((await f.request('/profiles/' + profile.id + '/data', { token: bob.token })).status, 404);
  assert.equal((await f.request('/profiles/' + profile.id, { token: alice.token, method: 'DELETE' })).status, 409);
  assert.equal((await f.request('/profiles/' + profile.id, { token: alice.token, method: 'PUT', body: { name: 'Tên mới', color: '#123456' } })).data.profile.name, 'Tên mới');
  for (let n = 0; n < 5; n++) assert.equal((await f.request('/profiles', { token: alice.token, body: { name: 'Hồ sơ ' + n, color: '#abcdef' } })).status, 200);
  assert.equal((await f.request('/profiles', { token: alice.token, body: { name: 'Quá giới hạn', color: '#abcdef' } })).status, 409);
  assert.equal((await f.request('/profiles/' + profile.id, { token: alice.token, method: 'DELETE' })).status, 200);
  assert.equal((await f.request('/profiles/' + profile.id + '/data', { token: alice.token })).status, 404);
});
test('Profile sync rejects stale revisions, invalid data and preserves successful writes across restart', async t => {
  const f = await fixture(t), account = (await f.register()).data, route = '/profiles/' + account.profiles[0].id + '/data';
  const data = PersonalData.normalize({ my_wishlist: [{ slug: film.slug, title: film.title }] });
  assert.equal((await f.request(route, { token: account.token })).data.revision, 0);
  const written = await f.request(route, { token: account.token, method: 'PUT', body: { revision: 0, data } }); assert.equal(written.data.revision, 1);
  const conflict = await f.request(route, { token: account.token, method: 'PUT', body: { revision: 0, data: {} } }); assert.equal(conflict.status, 409); assert.equal(conflict.data.data.my_wishlist[0].slug, film.slug);
  assert.equal((await f.request(route, { token: account.token, method: 'PUT', body: { revision: 1, data: { my_wishlist: 'bad' } } })).status, 400);
  await f.restart(); assert.deepEqual((await f.request(route, { token: account.token })).data, written.data);
});
test('Two simultaneous personal writes cannot both accept the same revision', async t => {
  const f = await fixture(t), account = (await f.register()).data, route = '/profiles/' + account.profiles[0].id + '/data';
  const results = await Promise.all([1, 2].map(n => f.request(route, { token: account.token, method: 'PUT', body: { revision: 0, data: { my_wishlist: [{ slug: 'film-' + n, title: 'Film ' + n }] } } })));
  assert.deepEqual(results.map(row => row.status).sort(), [200, 409]); const latest = await f.request(route, { token: account.token }); assert.equal(latest.data.revision, 1);
});
test('Community enforces one review per account, privacy, ownership, spoiler and moderation', async t => {
  const f = await fixture(t), alice = (await f.register('alice')).data, bob = (await f.register('bobby')).data;
  const written = await f.request('/community', { token: alice.token, body: { slug: film.slug, rating: 4, body: 'Nội dung có spoiler', spoiler: true } }); assert.equal(written.status, 200); const reviewId = written.data.review.id;
  const changed = await f.request('/community', { token: alice.token, body: { slug: film.slug, rating: 5, body: 'Sửa đánh giá', spoiler: false } }); assert.equal(changed.data.review.id, reviewId);
  const publicList = await f.request('/community?slug=' + film.slug); assert.equal(publicList.data.count, 1); assert.equal(publicList.data.average, 5); assert(!JSON.stringify(publicList.data).includes('@example.com'));
  assert.equal((await f.request('/community/' + reviewId, { token: bob.token, method: 'DELETE' })).status, 403);
  assert.equal((await f.request('/community/' + reviewId + '/report', { token: bob.token, body: { reason: 'Spam' } })).status, 200);
  await f.admin('bobby@example.com'); assert.equal((await f.request('/admin/reports', { token: bob.token })).data.reports.length, 1);
  assert.equal((await f.request('/admin/reviews/' + reviewId, { token: bob.token, method: 'PATCH', body: { hidden: true } })).status, 200);
  assert.equal((await f.request('/community?slug=' + film.slug)).data.count, 0);
  assert.equal((await f.request('/community?slug=' + film.slug, { token: alice.token })).data.ownReview.hidden, true);
  assert.equal((await f.request('/community', { token: alice.token, body: { slug: film.slug, rating: 3, body: 'Bypass', spoiler: false } })).status, 403);
  assert.equal((await f.request('/community/' + reviewId, { token: alice.token, method: 'DELETE' })).status, 200);
});
test('Admin catalog retains revisions, rejects stale changes and restores without editing source archives', async t => {
  const f = await fixture(t), account = (await f.register()).data; await f.admin();
  const route = '/admin/catalog/' + film.slug; const first = await f.request(route, { token: account.token, method: 'PUT', body: { revision: 0, movie: { ...film, title: 'Tên đã sửa' } } }); assert.equal(first.data.revision, 1);
  const revisions = await f.request('/admin/revisions?slug=' + film.slug, { token: account.token }); const versionId = revisions.data.revisions[0].id;
  assert.equal((await f.request(route, { token: account.token, method: 'PUT', body: { revision: 0, movie: film } })).status, 409);
  assert.equal((await f.request(route, { token: account.token, method: 'PUT', body: { revision: 1, movie: film } })).data.revision, 2);
  const restored = await f.request('/admin/revisions/' + versionId + '/restore', { token: account.token, body: { revision: 2 } }); assert.equal(restored.data.revision, 3); assert.equal(restored.data.movie.title, 'Tên đã sửa');
  const publicOverrides = await f.request('/catalog/overrides'); assert.equal(publicOverrides.data.overrides[0].movie.title, 'Tên đã sửa'); assert(!JSON.stringify(publicOverrides.data).includes('@'));
  const original = JSON.parse(await fs.readFile(path.join(f.directory, 'catalog.json'), 'utf8')); assert.equal(original[0].title, film.title);
  await f.restart(); assert.equal((await f.request('/admin/catalog?slug=' + film.slug, { token: account.token })).data.revision, 3);
});
test('Admin can add new source-linked movies, but metadata cannot inject stream URLs or unsafe images', async t => {
  const f = await fixture(t), account = (await f.register()).data; await f.admin();
  assert.equal((await f.request('/admin/catalog/new-film', { token: account.token, method: 'PUT', body: { revision: 0, movie: { ...film, slug: 'new-film', apiSlug: 'new-film', streamUrl: 'https://private.example/secret' } } })).status, 200);
  assert.equal((await f.request('/catalog/overrides')).data.overrides[0].movie.streamUrl, undefined);
  assert.equal((await f.request('/admin/catalog/new-film', { token: account.token, method: 'PUT', body: { revision: 1, movie: { ...film, slug: 'new-film', poster: 'javascript:alert(1)' } } })).status, 400);
  assert.throws(() => sanitizeMovie({ ...film, poster: 'Img/%2e%2e/secrets' }, film.slug));
  assert.equal((await f.request('/admin/catalog/new-film', { token: account.token, method: 'PUT', body: { revision: 1, movie: { ...film, slug: 'different-slug' } } })).status, 400);
});
test('Rooms use membership secrets, host-only revision controls, bounded chat and host shutdown', async t => {
  const f = await fixture(t), playback = { slug: film.slug, episodeName: '1', episode: 1, source: 'kkphim', server: 0 };
  const created = await f.request('/rooms', { body: { ...playback, name: 'Chủ' } }); assert.equal(created.status, 200); assert.equal(created.data.isHost, true);
  const roomId = created.data.room.id, hostToken = created.data.memberToken;
  assert.equal((await f.request('/rooms/' + roomId)).status, 403);
  const joined = await f.request('/rooms/' + roomId + '/join', { body: { name: 'Khách' } }); const guestToken = joined.data.memberToken; assert.equal(joined.data.members.length, 2);
  const control = { ...playback, revision: 0, playing: true, time: 17 };
  assert.equal((await f.request('/rooms/' + roomId + '/control', { memberToken: guestToken, body: control })).status, 403);
  assert.equal((await f.request('/rooms/' + roomId + '/control', { memberToken: hostToken, body: control })).data.room.revision, 1);
  const stale = await f.request('/rooms/' + roomId + '/control', { memberToken: hostToken, body: control }); assert.equal(stale.status, 409); assert.equal(stale.data.room.time, 17);
  assert.equal((await f.request('/rooms/' + roomId + '/chat', { memberToken: guestToken, body: { body: 'Xin chào' } })).data.messages[0].name, 'Khách');
  assert.equal((await f.request('/rooms/' + roomId + '/chat', { memberToken: guestToken, body: { body: 'Quá nhanh' } })).status, 429);
  assert.equal((await f.request('/rooms/' + roomId + '/leave', { memberToken: hostToken, method: 'POST' })).data.closed, true);
  assert.equal((await f.request('/rooms/' + roomId, { memberToken: guestToken })).status, 404);
});
test('Room capacity, expiry and stale guest cleanup do not leak membership tokens', () => {
  let time = 1000000; const rooms = new HubRooms({ now: () => time }), created = rooms.create({ slug: film.slug, episodeName: '1', episode: 1, source: 'auto', server: 0 });
  for (let n = 0; n < 7; n++) rooms.join(created.room.id, { name: 'Guest ' + n });
  assert.throws(() => rooms.join(created.room.id, {}), error => error.status === 409);
  assert(!JSON.stringify(rooms.read(created.room.id, created.memberToken)).includes(created.memberToken));
  time += 120001; assert.equal(rooms.read(created.room.id, created.memberToken).members.length, 1);
  time += 7200000; assert.throws(() => rooms.read(created.room.id, created.memberToken), error => error.status === 404);
});
test('Sessions expire after 30 days without silently creating a replacement', async t => {
  let clock = Date.now(); const f = await fixture(t, { now: () => clock }), account = (await f.register()).data;
  clock += 31 * 86400000; assert.equal((await f.request('/me', { token: account.token })).status, 401);
});
test('Hub enforces exact CORS origins, JSON content types, size limits and auth rate limits', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/health', { headers: { Origin: 'https://evil.example' } })).status, 403);
  const allowed = await f.request('/health', { headers: { Origin: 'https://example.github.io' } }); assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://example.github.io');
  assert.equal((await f.request('/auth/login', { body: {}, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.request('/auth/login', { body: { oversized: 'x'.repeat(17000) } })).status, 413);
  for (let n = 0; n < 45; n++) { const row = await f.request('/auth/login', { body: { identifier: 'missing', password: 'x' } }); if (n === 44) assert.equal(row.status, 429); }
});
test('Exclusive process locks prevent concurrent writers and corruption is fatal without resetting files', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lauphim-lock-test-')); t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const first = await new HubStore(directory).open(); await assert.rejects(new HubStore(directory).open(), /locked/); await first.close();
  await fs.writeFile(path.join(directory, 'hub.json'), '{broken'); await assert.rejects(new HubStore(directory).open()); assert.equal(await fs.readFile(path.join(directory, 'hub.json'), 'utf8'), '{broken');
  await assert.rejects(fs.stat(path.join(directory, 'hub.lock')), error => error.code === 'ENOENT');
});
test('Scheduler runs without overlap, preserves public status and writes observed episodes using injected source', async t => {
  let release; let calls = 0;
  const scheduler = createScheduler({ episodesEnabled: false, syncEpisodes: () => { calls++; return new Promise(resolve => { release = resolve; }); } }, os.tmpdir());
  const running = scheduler.run(); await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 1); assert.deepEqual(await scheduler.run(), { skipped: true }); release({ exitCode: 0, report: { checked: 2, succeeded: 2, changed: 1 } }); await running;
  assert.equal(scheduler.status.lastOutcome.changed, 1); assert.equal(scheduler.status.running, false); await scheduler.close();
  const f = await fixture(t, { episodeDeps: { fetch: async () => ({ ok: true, json: async () => ({ status: true, movie: { slug: film.slug, name: film.title, episode_current: 'Tập 2', episode_total: '12' }, episodes: [{ server_name: 'Server', server_data: [{ name: '1', slug: '1', link_m3u8: 'https://example.com/1.m3u8' }, { name: '2', slug: '2', link_m3u8: 'https://example.com/2.m3u8' }] }] }) }), sleep: async () => {}, timeoutMs: 500 } });
  assert.equal((await f.request('/episodes/summary')).status, 404); await f.hub.scheduler.run(); const summary = await f.request('/episodes/summary'); assert.equal(summary.status, 200); assert.equal(summary.data.movies[film.slug].available, 2); assert(!JSON.stringify(summary.data).includes('m3u8'));
});
test('Runtime private files cannot live in the static Frontend root', async () => {
  await assert.rejects(createHub({ dataDir: path.resolve(__dirname, '../Frontend/data/private-hub') }), /outside/);
});
test('Runtime episode sync uses admin additions and exact source alias overrides', async t => {
  const requested = [], f = await fixture(t, { episodeDeps: { fetch: async url => { const sourceSlug = url.split('/').pop(); requested.push(sourceSlug); return { ok: true, json: async () => ({ status: true, movie: { slug: sourceSlug, episode_current: 'Tập 1', episode_total: '12' }, episodes: [{ server_data: [{ name: '1', slug: '1', link_m3u8: 'https://example.com/1.m3u8' }] }] }) }; }, sleep: async () => {} } });
  const account = (await f.register()).data; await f.admin();
  await f.request('/admin/catalog/' + film.slug, { token: account.token, method: 'PUT', body: { revision: 0, movie: { ...film, apiSlug: 'correct-source' } } });
  await f.request('/admin/catalog/new-film', { token: account.token, method: 'PUT', body: { revision: 0, movie: { ...film, slug: 'new-film', apiSlug: 'new-source' } } });
  await f.hub.scheduler.run(); assert.deepEqual(requested.sort(), ['correct-source', 'new-source']);
  const summary = (await f.request('/episodes/summary')).data; assert.equal(summary.movies[film.slug].sourceSlug, 'correct-source'); assert.equal(summary.movies['new-film'].sourceSlug, 'new-source');
  const original = JSON.parse(await fs.readFile(path.join(f.directory, 'catalog.json'), 'utf8')); assert.equal(original.length, 1); assert.equal(original[0].apiSlug, undefined);
});
test('Graceful Hub shutdown stops new episode requests, saves successes and releases both locks', async t => {
  let unblock, firstTwo; const gate = new Promise(resolve => { unblock = resolve; }), started = new Promise(resolve => { firstTwo = resolve; }); let calls = 0;
  const f = await fixture(t, { catalogItems: [film, { ...film, slug: 'second-film' }, { ...film, slug: 'third-film' }], episodeDeps: { fetch: async url => { if (++calls === 2) firstTwo(); await gate; return { ok: true, json: async () => ({ status: true, movie: { slug: url.split('/').pop(), episode_current: 'Tập 1', episode_total: '12' }, episodes: [{ server_data: [{ name: '1', link_m3u8: 'https://example.com/1.m3u8' }] }] }) }; }, sleep: async () => {} } });
  const run = f.hub.scheduler.run(); await started; const closing = f.hub.close(); await new Promise(resolve => setImmediate(resolve)); unblock(); await closing; await run;
  assert.equal(calls, 2); const summary = JSON.parse(await fs.readFile(path.join(f.directory, 'private/episodes/episode-summary.json'), 'utf8')); assert.equal(Object.keys(summary.movies).length, 2);
  for (const name of ['hub.lock', 'episodes/episode-snapshots.json.lock']) await assert.rejects(fs.stat(path.join(f.directory, 'private', name)), error => error.code === 'ENOENT');
});
