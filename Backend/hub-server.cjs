#!/usr/bin/env node
'use strict';
// Optional companion service. The static site remains usable without this service.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { HubStore } = require('./hub-store.cjs');
const { HubRooms, fault, digest, token } = require('./hub-rooms.cjs');
const PersonalData = require('../Frontend/personal-data.js');
const { sync: episodeSync } = require('../Frontend/sync-episodes.cjs');
const scrypt = promisify(crypto.scrypt);
const PREFIX = '/api/hub';
const TEXT_CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const SLUG = /^[a-z0-9][a-z0-9/-]{0,249}$/;
const slugOK = value => typeof value === 'string' && SLUG.test(value) && !value.includes('//') && !value.split('/').some(bit => ['__proto__', 'constructor', 'prototype', '.', '..'].includes(bit));
const id = () => crypto.randomUUID();
const userView = user => ({ id: user.id, username: user.username, role: user.role });
const profileView = profile => ({ id: profile.id, name: profile.name, color: profile.color });
const snapshot = profile => ({ revision: profile.revision, data: profile.data, updatedAt: profile.updatedAt });
let activeHashes = 0;
async function passwordKey(password, salt) {
  if (activeHashes >= 8) throw fault(429, 'AUTH_BUSY', 'Đang có nhiều lượt đăng nhập. Hãy thử lại sau.');
  activeHashes++;
  try { return await scrypt(password, salt, 64); } finally { activeHashes--; }
}
function text(value, limit, field, optional = false) { if (typeof value !== 'string' || value.trim().length > limit || TEXT_CONTROL.test(value) || (!optional && !value.trim())) throw fault(400, 'INVALID_INPUT', field + ' không hợp lệ.'); return value.trim(); }
function count(value, fallback, max) { return /^\d+$/.test(String(value || '')) ? Math.min(max, Math.max(1, Number(value))) : fallback; }
function integer(value, min, max, field) { if (!Number.isInteger(value) || value < min || value > max) throw fault(400, 'INVALID_INPUT', field + ' không hợp lệ.'); return value; }
function safeImage(value) {
  if (typeof value !== 'string' || value.length > 2000 || /[\u0000-\u001f\u007f\\]/.test(value)) throw fault(400, 'INVALID_IMAGE', 'Đường dẫn ảnh không hợp lệ.');
  if (!value) return '';
  if (/^(?:\.\/)?Img\//.test(value)) { let decoded; try { decoded = decodeURIComponent(value); } catch (_) { throw fault(400, 'INVALID_IMAGE', 'Đường dẫn ảnh không hợp lệ.'); } if (!decoded.split('/').includes('..') && !/[?#\\\u0000-\u001f]/.test(decoded)) return value; }
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password && ![...url.searchParams.keys()].some(key => /token|secret|signature|api.?key/i.test(key))) return url.href; } catch (_) {}
  throw fault(400, 'INVALID_IMAGE', 'Ảnh phải dùng HTTPS hoặc đường dẫn Img/ trong web.');
}
function sanitizeMovie(input, slug) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fault(400, 'INVALID_MOVIE', 'Thông tin phim phải là đối tượng JSON.');
  if (input.slug !== undefined && input.slug !== slug) throw fault(400, 'INVALID_MOVIE', 'Mã phim không trùng đường dẫn.');
  const movie = { slug, title: text(input.title, 300, 'Tên phim'), year: integer(input.year, 1888, 2100, 'Năm'), episodes: integer(input.episodes, 1, 10000, 'Số tập') };
  if (!['series', 'single', 'animation', 'tvshows'].includes(input.type)) throw fault(400, 'INVALID_MOVIE', 'Loại phim không hợp lệ.'); movie.type = input.type;
  for (const [key, limit] of [['genres', 1000], ['country', 300], ['desc', 20000], ['cast', 3000], ['director', 500], ['partName', 300], ['group', 200]]) if (input[key] !== undefined) movie[key] = text(input[key], limit, key, true);
  for (const key of ['poster', 'banner', 'remotePoster']) if (input[key] !== undefined) movie[key] = safeImage(input[key]);
  if (input.sourceCountries !== undefined) { if (!Array.isArray(input.sourceCountries) || input.sourceCountries.length > 20) throw fault(400, 'INVALID_MOVIE', 'Danh sách quốc gia không hợp lệ.'); movie.sourceCountries = [...new Set(input.sourceCountries.map(value => text(value, 100, 'Quốc gia')))]; }
  if (input.source !== undefined) { if (!['auto', 'kkphim', 'nguonc', 'hardcode'].includes(input.source)) throw fault(400, 'INVALID_MOVIE', 'Nguồn phim không hợp lệ.'); movie.source = input.source; }
  if (input.apiSlug !== undefined) { if (!/^[a-z0-9][a-z0-9-]{0,249}$/.test(input.apiSlug)) throw fault(400, 'INVALID_MOVIE', 'Mã nguồn phim không hợp lệ.'); movie.apiSlug = input.apiSlug; }
  if (input.relationOrder !== undefined) movie.relationOrder = integer(input.relationOrder, 0, 10000, 'Thứ tự phần phim');
  if (input.relationVerified !== undefined) { if (typeof input.relationVerified !== 'boolean') throw fault(400, 'INVALID_MOVIE', 'Quan hệ phim không hợp lệ.'); movie.relationVerified = input.relationVerified; }
  if (input.episodeSource !== undefined) movie.episodeSource = text(input.episodeSource, 100, 'Nguồn tập', true);
  return movie;
}
async function readJSON(request, max = 65536) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) throw fault(415, 'JSON_REQUIRED', 'Yêu cầu phải dùng application/json.');
  const declared = Number(request.headers['content-length'] || 0); if (declared > max) throw fault(413, 'BODY_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.');
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > max) throw fault(413, 'BODY_TOO_LARGE', 'Dữ liệu gửi lên quá lớn.'); chunks.push(chunk); }
  let value; try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { throw fault(400, 'INVALID_JSON', 'JSON không hợp lệ.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fault(400, 'INVALID_JSON', 'Yêu cầu phải là đối tượng JSON.'); return value;
}
function createScheduler(options, dataDir) {
  const now = options.now || Date.now, enabled = options.episodesEnabled === true, interval = Math.max(3600000, Number(options.episodeIntervalMs) || 21600000);
  const status = { enabled, running: false, lastStartedAt: null, lastFinishedAt: null, lastOutcome: null }, deps = options.episodeDeps || {};
  let timer, active, stopped = false; const signalState = { stopped: false };
  async function run() {
    if (stopped || status.running) return { skipped: true }; status.running = true; status.lastStartedAt = now();
    active = Promise.resolve().then(async () => {
      let catalogPath = options.catalogPath;
      if (options.catalogProvider) {
        catalogPath = path.join(dataDir, 'episodes/catalog-input.json'); await fs.mkdir(path.dirname(catalogPath), { recursive: true });
        const temporary = catalogPath + '.' + process.pid + '.tmp';
        try { await fs.writeFile(temporary, JSON.stringify(await options.catalogProvider()), { encoding: 'utf8', mode: 0o600 }); await fs.rename(temporary, catalogPath); }
        finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
      }
      return (options.syncEpisodes || episodeSync)({ slugs: [], force: false, dryRun: false, limit: options.episodeLimit || Infinity }, { ...deps, catalogPath, outputPath: path.join(dataDir, 'episodes/episode-snapshots.json'), summaryPath: path.join(dataDir, 'episodes/episode-summary.json'), signals: false, signalState, log: options.log || (() => {}) });
    }).then(result => {
      const report = result.report || {}; status.lastOutcome = { ok: result.exitCode === 0, checked: report.checked || 0, succeeded: report.succeeded || 0, failed: report.failed || 0, changed: report.changed || 0 }; return status.lastOutcome;
    }).catch(() => { status.lastOutcome = { ok: false, error: 'Episode sync failed; previous observations were retained.' }; return status.lastOutcome; }).finally(() => { status.running = false; status.lastFinishedAt = now(); }); return active;
  }
  return { status, run, start() { if (enabled && !timer) { timer = setInterval(run, interval); timer.unref(); void run(); } }, async close() { stopped = true; signalState.stopped = true; clearInterval(timer); if (active) await active; } };
}
async function createHub(input = {}) {
  const frontendDir = path.resolve(input.frontendDir || path.join(__dirname, '../Frontend'));
  const dataDir = path.resolve(input.dataDir || process.env.HUB_DATA_DIR || path.join(__dirname, '.hub-data'));
  const relative = path.relative(frontendDir, dataDir);
  if (relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw Error('HUB_DATA_DIR must be outside the public Frontend directory.');
  const now = input.now || Date.now, catalogPath = input.catalogPath || path.join(frontendDir, 'data/movies.json');
  const baseCatalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  if (!Array.isArray(baseCatalog)) throw Error('Catalog must be an array.');
  const baseMovies = new Map(baseCatalog.map(movie => [movie.slug, movie]));
  const origins = new Set(input.allowedOrigins || (process.env.HUB_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
  const publicOrigin = input.publicOrigin || process.env.HUB_PUBLIC_ORIGIN || '';
  if (publicOrigin) origins.add(publicOrigin);
  for (const origin of origins) { let url; try { url = new URL(origin); } catch (_) { throw Error('HUB_ALLOWED_ORIGINS requires exact http(s) origins.'); } if (!['https:', 'http:'].includes(url.protocol) || url.origin !== origin) throw Error('HUB_ALLOWED_ORIGINS requires exact http(s) origins, without paths or a trailing slash.'); }
  const store = await new HubStore(dataDir).open();
  // Validate personal data on startup as well. A corrupt store must never be replaced with defaults.
  try { for (const profile of store.state.profiles) PersonalData.normalize(profile.data, true); }
  catch (error) { await store.close(); throw Error('Corrupt Hub profile data: ' + error.message); }
  const rooms = new HubRooms({ now, ttl: input.roomTTL }), limits = new Map();
  const scheduler = createScheduler({ ...input, now, catalogPath, catalogProvider: () => {
    const merged = new Map(baseMovies); for (const row of store.state.overrides) merged.set(row.slug, row.movie); return [...merged.values()];
  }, episodesEnabled: input.episodesEnabled ?? process.env.HUB_EPISODES_ENABLED === 'true', episodeIntervalMs: input.episodeIntervalMs || Number(process.env.HUB_EPISODE_INTERVAL_MS) }, dataDir);
  function rate(request, bucket, max, duration) {
    const key = bucket + ':' + request.socket.remoteAddress, time = now();
    if (limits.size > 20000) for (const [entry, row] of limits) if (row.until <= time) limits.delete(entry);
    const row = limits.get(key); if (!row || row.until <= time) { limits.set(key, { count: 1, until: time + duration }); return; }
    if (++row.count > max) throw fault(429, 'RATE_LIMIT', 'Quá nhiều yêu cầu. Hãy thử lại sau.');
  }
  function authenticate(request, optional = false) {
    const match = /^Bearer ([A-Za-z0-9_-]{32,100})$/.exec(request.headers.authorization || '');
    if (!match) { if (optional && !request.headers.authorization) return null; throw fault(401, 'AUTH_REQUIRED', 'Bạn cần đăng nhập.'); }
    const hash = digest(match[1]), session = store.state.sessions.find(row => row.hash === hash && row.expiresAt > now());
    const user = session && store.state.users.find(row => row.id === session.userId);
    if (!user) throw fault(401, 'SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn.'); return user;
  }
  function admin(request) { const user = authenticate(request); if (user.role !== 'admin') throw fault(403, 'ADMIN_REQUIRED', 'Chỉ quản trị viên được thực hiện thao tác này.'); return user; }
  function ownedProfile(profileId, userId) { const profile = store.state.profiles.find(row => row.id === profileId && row.userId === userId); if (!profile) throw fault(404, 'PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ.'); return profile; }
  function profileInput(value) { const name = text(value.name, 40, 'Tên hồ sơ'); if (!/^#[a-f0-9]{6}$/i.test(value.color || '')) throw fault(400, 'INVALID_PROFILE', 'Màu hồ sơ phải ở dạng #RRGGBB.'); return { name, color: value.color.toLowerCase() }; }
  function movieState(slug, state = store.state) { const override = state.overrides.find(row => row.slug === slug); return override ? { slug, revision: override.revision, movie: override.movie, updatedAt: override.updatedAt } : baseMovies.has(slug) ? { slug, revision: 0, movie: baseMovies.get(slug), updatedAt: 0 } : null; }
  function knownSlug(value) { if (!slugOK(value)) throw fault(400, 'INVALID_SLUG', 'Mã phim không hợp lệ.'); if (!movieState(value)) throw fault(404, 'MOVIE_NOT_FOUND', 'Phim chưa có trong danh mục.'); return value; }
  function reviewView(row, user) { const author = store.state.users.find(value => value.id === row.userId); return { id: row.id, slug: row.slug, username: author?.username || 'Thành viên', rating: row.rating, body: row.body, spoiler: row.spoiler, createdAt: row.createdAt, updatedAt: row.updatedAt, hidden: row.hidden, mine: user?.id === row.userId }; }
  function override(state, slug, movie, revision, actor) {
    const previous = movieState(slug, state), actual = previous?.revision || 0;
    if (revision !== actual) throw fault(409, 'CATALOG_CONFLICT', 'Phim đã được sửa ở nơi khác.', previous || { slug, revision: 0, movie: null });
    if (previous && actual === 0 && !state.revisions.some(row => row.slug === slug)) state.revisions.push({ id: id(), slug, revision: 0, movie: structuredClone(previous.movie), createdAt: now(), actor: 'Bản gốc' });
    const next = { id: id(), slug, revision: actual + 1, movie, updatedAt: now() };
    state.overrides = state.overrides.filter(row => row.slug !== slug); state.overrides.push(next);
    state.revisions.push({ id: id(), slug, revision: next.revision, movie: structuredClone(movie), createdAt: now(), actor: actor.username });
    // Retain the latest 50 versions of each movie, with an overall bound.
    const matching = state.revisions.filter(row => row.slug === slug).slice(-50), retained = new Set(matching.map(row => row.id));
    state.revisions = state.revisions.filter(row => row.slug !== slug || retained.has(row.id)).slice(-20000);
    return { slug, revision: next.revision, movie, updatedAt: next.updatedAt };
  }
  async function route(request, response, url) {
    const method = request.method, pathname = url.pathname.slice(PREFIX.length), parts = pathname.split('/').filter(Boolean).map(value => decodeURIComponent(value));
    rate(request, 'all', 2000, 60000);
    if (method === 'GET' && pathname === '/health') return { status: 'ok', version: 1, storage: 'persistent-json', episodes: { ...scheduler.status } };
    if (method === 'POST' && ['/auth/register', '/auth/login'].includes(pathname)) {
      rate(request, pathname, pathname.endsWith('register') ? 10 : 40, 900000);
      const value = await readJSON(request, 16384);
      let user;
      if (pathname.endsWith('register')) {
        const username = text(value.username, 32, 'Tên tài khoản'), email = text(value.email, 254, 'Email').toLowerCase(), password = value.password;
        if (!/^[\p{L}\p{N}_.-]{3,32}$/u.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 10 || password.length > 128) throw fault(400, 'INVALID_ACCOUNT', 'Tên tài khoản từ 3–32 ký tự, email hợp lệ và mật khẩu từ 10–128 ký tự.');
        const salt = crypto.randomBytes(16).toString('hex'), passwordHash = (await passwordKey(password, salt)).toString('hex');
        user = await store.transaction(state => {
          if (state.users.some(row => row.username.toLowerCase() === username.toLowerCase() || row.email === email)) throw fault(409, 'ACCOUNT_EXISTS', 'Tên tài khoản hoặc email đã được sử dụng.');
          if (state.users.length >= 10000) throw fault(503, 'ACCOUNT_CAPACITY', 'Dịch vụ đã đạt giới hạn tài khoản.');
          const result = { id: id(), username, email, salt, passwordHash, role: 'user', createdAt: now() }; state.users.push(result);
          state.profiles.push({ id: id(), userId: result.id, name: username, color: '#e50914', revision: 0, data: PersonalData.normalize({}), updatedAt: now() }); return result;
        });
      } else {
        const identifier = text(value.identifier, 254, 'Tài khoản').toLowerCase();
        if (typeof value.password !== 'string' || value.password.length > 128) throw fault(400, 'INVALID_ACCOUNT', 'Thông tin đăng nhập không hợp lệ.');
        user = store.state.users.find(row => row.email === identifier || row.username.toLowerCase() === identifier);
        const derived = await passwordKey(value.password, user?.salt || '00000000000000000000000000000000'), expected = Buffer.from(user?.passwordHash || '0'.repeat(128), 'hex');
        if (!user || expected.length !== derived.length || !crypto.timingSafeEqual(derived, expected)) throw fault(401, 'INVALID_CREDENTIALS', 'Tài khoản hoặc mật khẩu không đúng.');
      }
      const secret = token(), session = { hash: digest(secret), userId: user.id, createdAt: now(), expiresAt: now() + 30 * 86400000 };
      await store.transaction(state => { state.sessions = state.sessions.filter(row => row.expiresAt > now()); const old = state.sessions.filter(row => row.userId === user.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 19); const ids = new Set(old.map(row => row.hash)); state.sessions = state.sessions.filter(row => row.userId !== user.id || ids.has(row.hash)); state.sessions.push(session); });
      return { token: secret, user: userView(user), profiles: store.state.profiles.filter(row => row.userId === user.id).map(profileView) };
    }
    if (pathname === '/me' && method === 'GET') { const user = authenticate(request); return { user: userView(user), profiles: store.state.profiles.filter(row => row.userId === user.id).map(profileView) }; }
    if (pathname === '/auth/logout' && method === 'POST') { authenticate(request); const hash = digest(request.headers.authorization.slice(7)); await store.transaction(state => { state.sessions = state.sessions.filter(row => row.hash !== hash); }); return { loggedOut: true }; }
    if (parts[0] === 'profiles') {
      const user = authenticate(request);
      if (parts.length === 1 && method === 'GET') return { profiles: store.state.profiles.filter(row => row.userId === user.id).map(profileView) };
      if (parts.length === 1 && method === 'POST') { const details = profileInput(await readJSON(request, 4096)); const profile = await store.transaction(state => { if (state.profiles.filter(row => row.userId === user.id).length >= 6) throw fault(409, 'PROFILE_LIMIT', 'Mỗi tài khoản có tối đa 6 hồ sơ.'); const result = { id: id(), userId: user.id, ...details, revision: 0, data: PersonalData.normalize({}), updatedAt: now() }; state.profiles.push(result); return result; }); return { profile: profileView(profile) }; }
      if (parts.length >= 2) {
        const profile = ownedProfile(parts[1], user.id);
        if (parts.length === 2 && method === 'PUT') { const details = profileInput(await readJSON(request, 4096)); return { profile: await store.transaction(state => { const row = state.profiles.find(row => row.id === profile.id); Object.assign(row, details); return profileView(row); }) }; }
        if (parts.length === 2 && method === 'DELETE') { await store.transaction(state => { if (state.profiles.filter(row => row.userId === user.id).length <= 1) throw fault(409, 'LAST_PROFILE', 'Cần giữ lại ít nhất một hồ sơ.'); state.profiles = state.profiles.filter(row => row.id !== profile.id); }); return { deleted: true }; }
        if (parts.length === 3 && parts[2] === 'data' && method === 'GET') return snapshot(profile);
        if (parts.length === 3 && parts[2] === 'data' && method === 'PUT') {
          const value = await readJSON(request, 3 * 1024 * 1024); integer(value.revision, 0, 1e12, 'Phiên bản hồ sơ');
          let data; try { data = PersonalData.normalize(value.data, true); } catch (_) { throw fault(400, 'INVALID_PERSONAL_DATA', 'Dữ liệu hồ sơ không hợp lệ; chưa có thay đổi được lưu.'); }
          return store.transaction(state => { const row = state.profiles.find(row => row.id === profile.id); if (row.revision !== value.revision) throw fault(409, 'PROFILE_CONFLICT', 'Hồ sơ đã được cập nhật trên thiết bị khác.', snapshot(row)); row.data = data; row.revision++; row.updatedAt = now(); return snapshot(row); });
        }
      }
    }
    if (pathname === '/community' && method === 'GET') {
      const slug = knownSlug(url.searchParams.get('slug')), user = authenticate(request, true), all = store.state.reviews.filter(row => row.slug === slug && !row.hidden).sort((a, b) => b.updatedAt - a.updatedAt), page = count(url.searchParams.get('page'), 1, 10000), limit = count(url.searchParams.get('limit'), 20, 30), own = user && store.state.reviews.find(row => row.slug === slug && row.userId === user.id);
      return { reviews: all.slice((page - 1) * limit, page * limit).map(row => reviewView(row, user)), average: all.length ? Math.round(all.reduce((sum, row) => sum + row.rating, 0) / all.length * 10) / 10 : null, count: all.length, page, ownReview: own ? reviewView(own, user) : null };
    }
    if (pathname === '/community' && method === 'POST') {
      const user = authenticate(request); rate(request, 'reviews', 30, 60000); const value = await readJSON(request, 16384), slug = knownSlug(value.slug), rating = integer(value.rating, 1, 5, 'Điểm đánh giá'), body = text(value.body, 2000, 'Nội dung', true);
      if (typeof value.spoiler !== 'boolean') throw fault(400, 'INVALID_REVIEW', 'Thiếu trạng thái spoiler.');
      const review = await store.transaction(state => { let row = state.reviews.find(entry => entry.slug === slug && entry.userId === user.id); if (row) { if (row.hidden) throw fault(403, 'REVIEW_HIDDEN', 'Đánh giá đang bị ẩn; hãy liên hệ quản trị viên.'); Object.assign(row, { rating, body, spoiler: value.spoiler, updatedAt: now() }); } else { if (state.reviews.length >= 100000) throw fault(503, 'REVIEW_CAPACITY', 'Dịch vụ đã đạt giới hạn đánh giá.'); row = { id: id(), slug, userId: user.id, rating, body, spoiler: value.spoiler, hidden: false, createdAt: now(), updatedAt: now() }; state.reviews.push(row); } return row; }); return { review: reviewView(review, user) };
    }
    if (parts[0] === 'community' && parts.length >= 2) {
      const user = authenticate(request), review = store.state.reviews.find(row => row.id === parts[1]); if (!review) throw fault(404, 'REVIEW_NOT_FOUND', 'Không tìm thấy đánh giá.');
      if (parts.length === 2 && method === 'DELETE') { if (review.userId !== user.id && user.role !== 'admin') throw fault(403, 'REVIEW_OWNER_REQUIRED', 'Bạn không thể xóa đánh giá của người khác.'); await store.transaction(state => { state.reviews = state.reviews.filter(row => row.id !== review.id); state.reports = state.reports.filter(row => row.reviewId !== review.id); }); return { deleted: true }; }
      if (parts.length === 3 && parts[2] === 'report' && method === 'POST') { rate(request, 'reports', 15, 60000); const reason = text((await readJSON(request, 8192)).reason, 500, 'Lý do'); await store.transaction(state => { if (state.reports.some(row => row.reviewId === review.id && row.userId === user.id && !row.resolved)) return; state.reports.push({ id: id(), reviewId: review.id, userId: user.id, reason, createdAt: now(), resolved: false }); }); return { reported: true }; }
    }
    if (pathname === '/catalog/overrides' && method === 'GET') return { overrides: store.state.overrides.map(row => ({ slug: row.slug, revision: row.revision, movie: row.movie, updatedAt: row.updatedAt })), updatedAt: Math.max(0, ...store.state.overrides.map(row => row.updatedAt)) };
    if (parts[0] === 'admin') {
      const user = admin(request);
      if (pathname === '/admin/reports' && method === 'GET') { const page = count(url.searchParams.get('page'), 1, 10000); return { reports: store.state.reports.filter(row => !row.resolved).slice().reverse().slice((page - 1) * 50, page * 50).map(row => ({ id: row.id, reason: row.reason, createdAt: row.createdAt, review: reviewView(store.state.reviews.find(review => review.id === row.reviewId), user) })), page }; }
      if (parts[1] === 'reviews' && parts.length === 3 && method === 'PATCH') { const value = await readJSON(request, 4096); if (typeof value.hidden !== 'boolean') throw fault(400, 'INVALID_MODERATION', 'Trạng thái ẩn không hợp lệ.'); const row = await store.transaction(state => { const review = state.reviews.find(row => row.id === parts[2]); if (!review) throw fault(404, 'REVIEW_NOT_FOUND', 'Không tìm thấy đánh giá.'); review.hidden = value.hidden; review.moderatedAt = now(); state.reports.filter(row => row.reviewId === review.id).forEach(row => { row.resolved = true; }); return review; }); return { review: reviewView(row, user) }; }
      if (pathname === '/admin/catalog' && method === 'GET') {
        const slug = url.searchParams.get('slug'); if (slug) { if (!slugOK(slug)) throw fault(400, 'INVALID_SLUG', 'Mã phim không hợp lệ.'); const result = movieState(slug); if (!result) throw fault(404, 'MOVIE_NOT_FOUND', 'Phim chưa có trong danh mục.'); return result; }
        const query = (url.searchParams.get('q') || '').slice(0, 300).toLowerCase(), page = count(url.searchParams.get('page'), 1, 10000), limit = count(url.searchParams.get('limit'), 30, 50), keys = [...new Set([...baseMovies.keys(), ...store.state.overrides.map(row => row.slug)])], rows = keys.map(slug => movieState(slug)).filter(row => !query || (row.slug + ' ' + row.movie.title).toLowerCase().includes(query)); return { movies: rows.slice((page - 1) * limit, page * limit), page, total: rows.length };
      }
      if (parts[1] === 'catalog' && parts.length === 3 && method === 'PUT') { const slug = parts[2]; if (!slugOK(slug)) throw fault(400, 'INVALID_SLUG', 'Mã phim không hợp lệ.'); const value = await readJSON(request, 65536), movie = sanitizeMovie(value.movie, slug); integer(value.revision, 0, 1e12, 'Phiên bản phim'); return store.transaction(state => { if (!movieState(slug, state) && state.overrides.length >= 5000) throw fault(409, 'OVERRIDE_LIMIT', 'Đã đạt giới hạn 5000 phim được quản lý.'); return override(state, slug, movie, value.revision, user); }); }
      if (pathname === '/admin/revisions' && method === 'GET') { const slug = url.searchParams.get('slug'); if (slug && !slugOK(slug)) throw fault(400, 'INVALID_SLUG', 'Mã phim không hợp lệ.'); return { revisions: store.state.revisions.filter(row => !slug || row.slug === slug).slice().reverse().slice(0, 50) }; }
      if (parts[1] === 'revisions' && parts.length === 4 && parts[3] === 'restore' && method === 'POST') { const value = await readJSON(request, 4096); integer(value.revision, 0, 1e12, 'Phiên bản phim'); return store.transaction(state => { const old = state.revisions.find(row => row.id === parts[2]); if (!old) throw fault(404, 'REVISION_NOT_FOUND', 'Phiên bản đã hết thời gian lưu trữ.'); return override(state, old.slug, structuredClone(old.movie), value.revision, user); }); }
      if (pathname === '/admin/episodes/run' && method === 'POST') { if (scheduler.status.running) return { ...scheduler.status }; void scheduler.run(); return { ...scheduler.status }; }
    }
    if (pathname === '/episodes/summary' && method === 'GET') { try { const raw = JSON.parse(await fs.readFile(path.join(dataDir, 'episodes/episode-summary.json'), 'utf8')); return raw; } catch (error) { if (error.code === 'ENOENT') throw fault(404, 'NO_EPISODE_SNAPSHOT', 'Dịch vụ chưa hoàn thành lần cập nhật tập nào.'); throw error; } }
    if (parts[0] === 'rooms') {
      rate(request, 'rooms', 900, 60000);
      if (parts.length === 1 && method === 'POST') { rate(request, 'room-create', 10, 60000); const value = await readJSON(request, 4096); knownSlug(value.slug); return rooms.create(value); }
      if (parts.length === 3 && parts[2] === 'join' && method === 'POST') { rate(request, 'room-join', 30, 60000); return rooms.join(parts[1], await readJSON(request, 4096)); }
      const secret = request.headers['x-room-token'];
      if (parts.length === 2 && method === 'GET') return rooms.read(parts[1], secret);
      if (parts.length === 3 && method === 'POST') { if (parts[2] === 'control') return rooms.control(parts[1], secret, await readJSON(request, 4096)); if (parts[2] === 'chat') return rooms.chat(parts[1], secret, await readJSON(request, 8192)); if (parts[2] === 'leave') return rooms.leave(parts[1], secret); }
    }
    throw fault(404, 'NOT_FOUND', 'Không tìm thấy API.');
  }
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'same-origin'); response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    try {
      const origin = request.headers.origin, same = `${request.socket.encrypted ? 'https:' : 'http:'}//${request.headers.host}`;
      if (origin && origin !== same && !origins.has(origin)) throw fault(403, 'ORIGIN_DENIED', 'Nguồn truy cập chưa được cấu hình.');
      if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
      const url = new URL(request.url, 'http://hub.local');
      if (url.pathname.startsWith(PREFIX + '/') || url.pathname === PREFIX) {
        response.setHeader('Cache-Control', 'no-store');
        if (request.method === 'OPTIONS') { response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Room-Token'); response.setHeader('Access-Control-Max-Age', '600'); response.writeHead(204); response.end(); return; }
        const value = await route(request, response, url); response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); return;
      }
      if (input.serveStatic === false || !['GET', 'HEAD'].includes(request.method)) throw fault(404, 'NOT_FOUND', 'Không tìm thấy trang.');
      let pathname; try { pathname = decodeURIComponent(url.pathname); } catch (_) { throw fault(400, 'INVALID_PATH', 'Đường dẫn không hợp lệ.'); }
      if (pathname.endsWith('/')) pathname += 'index.html';
      const resolved = path.resolve(frontendDir, '.' + pathname), rel = path.relative(frontendDir, resolved), extension = path.extname(resolved).toLowerCase();
      if (rel.startsWith('..') || path.isAbsolute(rel) || rel.split(path.sep).some(bit => bit.startsWith('.')) || !types[extension] || pathname.includes('\\')) throw fault(404, 'NOT_FOUND', 'Không tìm thấy trang.');
      let file; try { file = await fs.readFile(resolved); } catch (error) { if (['ENOENT', 'EISDIR'].includes(error.code)) throw fault(404, 'NOT_FOUND', 'Không tìm thấy trang.'); throw error; }
      response.writeHead(200, { 'Content-Type': types[extension], 'Cache-Control': extension === '.html' || extension === '.js' ? 'no-cache' : 'public, max-age=300' }); response.end(request.method === 'HEAD' ? undefined : file);
    } catch (error) {
      if (response.headersSent) { response.end(); return; }
      let status = error.status || 500; if (error instanceof URIError) status = 400;
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: status >= 500 ? 'Dịch vụ gặp lỗi; dữ liệu cũ được giữ lại.' : error.message, code: error.code || (status === 400 ? 'INVALID_REQUEST' : 'SERVER_ERROR'), ...(error.extra || {}) }));
      if (status >= 500 && input.log) input.log('Hub request failed: ' + error.message);
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.maxHeadersCount = 50;
  return { server, store, rooms, scheduler, async start(port = 0, host = '127.0.0.1') { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.off('error', reject); resolve(); }); }); scheduler.start(); return server.address(); }, async close() { await new Promise(resolve => { if (!server.listening) return resolve(); server.close(resolve); server.closeIdleConnections(); }); await scheduler.close(); await store.close(); } };
}
async function main() {
  if (process.argv[2] === '--promote') {
    const email = String(process.argv[3] || '').trim().toLowerCase(); if (!email || process.argv.length !== 4) throw Error('Usage: node Backend/hub-server.cjs --promote existing-account@example.com (stop Hub first).');
    const store = await new HubStore(process.env.HUB_DATA_DIR || path.join(__dirname, '.hub-data')).open();
    try { await store.transaction(state => { const user = state.users.find(row => row.email === email); if (!user) throw Error('Register this account before promoting it.'); user.role = 'admin'; }); console.log('Existing account promoted. Restart Hub and sign in.'); } finally { await store.close(); } return;
  }
  if (process.argv.length > 2) throw Error('Unknown argument. Run without arguments or use --promote EMAIL.');
  const hub = await createHub({ log: message => console.log(message) });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { if (stopping) return; stopping = true; console.log('Closing Hub; waiting for pending durable writes and episode sync.'); await hub.close(); process.exitCode = 0; });
  try { const address = await hub.start(Number(process.env.PORT || process.env.HUB_PORT || 8787), process.env.HUB_HOST || '127.0.0.1'); console.log('LauPhim Hub listening on port ' + address.port + '. No admin account is created automatically.'); }
  catch (error) { await hub.close(); throw error; }
}
if (require.main === module) main().catch(error => { console.error('Hub could not start: ' + error.message); process.exitCode = 1; });
module.exports = { createHub, createScheduler, sanitizeMovie, slugOK };
