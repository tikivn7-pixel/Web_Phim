// A bounded, disposable cache of observed episode names. Never stores stream URLs.
(function (root) {
  'use strict';
  const KEY = 'episode_updates_v1', TTL = 60 * 60 * 1000, RETRY = 10 * 60 * 1000, MAX = 100;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const slugOK = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,249}$/.test(value) && !['constructor', 'prototype'].includes(value);
  const identityOK = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 500 && !/[\u0000-\u001f\u007f]/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
  const stamp = value => Number.isFinite(value) && value >= 0 && value <= 1e15 ? value : 0;
  const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) : '';
  function canonical(name) {
    const tracker = typeof module !== 'undefined' && module.exports ? require('./episode-tracker.js') : root.EpisodeTracker;
    return tracker ? tracker.canonical(name) : '';
  }
  const empty = () => ({ version: 1, entries: {} });
  function normalize(input) {
    const result = empty();
    if (!object(input) || input.version !== 1 || !object(input.entries)) return result;
    for (const [slug, row] of Object.entries(input.entries).filter(([slug, row]) => identityOK(slug) && object(row)).sort((a, b) => stamp(b[1].attemptAt) - stamp(a[1].attemptAt)).slice(0, MAX)) {
      const names = [], seen = new Set();
      for (const entry of Array.isArray(row.names) ? row.names.slice(0, 10000) : []) {
        if (!object(entry)) continue;
        const name = clean(entry.name), id = canonical(name);
        if (!id || seen.has(id) || !Number.isInteger(entry.episode) || entry.episode < 1 || entry.episode > 10000 || !Number.isInteger(entry.server) || entry.server < 0 || entry.server > 99) continue;
        seen.add(id); names.push({ id, name, episode: entry.episode, server: entry.server });
      }
      result.entries[slug] = { checkedAt: stamp(row.checkedAt), attemptAt: stamp(row.attemptAt), names, available: Number.isInteger(row.available) && row.available >= 0 && row.available <= 10000 ? row.available : names.length, newNames: [...new Set((Array.isArray(row.newNames) ? row.newNames : []).filter(id => typeof id === 'string' && seen.has(id)))], current: clean(row.current), status: clean(row.status), sourceSlug: slugOK(row.sourceSlug) ? row.sourceSlug : slug, error: clean(row.error) };
    }
    return result;
  }
  function snapshot(payload, expectedSlug) {
    if (!object(payload) || payload.status !== true || !object(payload.movie) || payload.movie.slug !== expectedSlug || !Array.isArray(payload.episodes)) throw Error('Nguồn chưa trả về đúng phim.');
    const names = [], seen = new Set();
    payload.episodes.slice(0, 100).forEach((server, serverIndex) => {
      (Array.isArray(server?.server_data) ? server.server_data.slice(0, 10000) : []).forEach((episode, index) => {
        if (!object(episode) || names.length >= 10000) return;
        const name = clean(episode.name), id = canonical(name);
        if (!id || /(?:trailer|teaser|preview)/i.test(id) || seen.has(id) || ![episode.link_m3u8, episode.link_embed].some(url => typeof url === 'string' && /^https?:\/\//i.test(url.trim()))) return;
        seen.add(id); names.push({ id, name, episode: index + 1, server: serverIndex });
      });
    });
    names.sort((a, b) => a.id.localeCompare(b.id, 'vi', { numeric: true }));
    if (!names.length) throw Error('Nguồn chưa có tập phát được.');
    return { names, current: clean(payload.movie.episode_current), status: clean(payload.movie.status), sourceSlug: expectedSlug };
  }
  function create(options = {}) {
    let warning = '', active = null, state = empty(), lastRaw, memoryDirty = false;
    const listeners = new Set(), now = options.now || Date.now;
    const storage = options.storage || (() => { try { return root.localStorage; } catch (_) { return null; } })();
    const request = options.fetch || ((...args) => root.fetch(...args));
    const timeout = options.timeoutMs || 12000;
    function read() {
      if (memoryDirty) return normalize(state);
      try {
        const raw = storage?.getItem(KEY);
        if (raw === lastRaw) return normalize(state);
        lastRaw = raw;
        if (raw) { const parsed = JSON.parse(raw); state = normalize(parsed); if (parsed?.version !== 1 || !object(parsed.entries)) warning = 'Bộ nhớ kiểm tra tập đã được đặt lại; dữ liệu cá nhân vẫn được giữ.'; }
        else state = empty();
      }
      catch (_) { warning = 'Bộ nhớ kiểm tra tập bị lỗi; sẽ kiểm tra lại từ đầu.'; }
      return normalize(state);
    }
    read();
    const emit = () => listeners.forEach(fn => { try { fn(); } catch (_) {} });
    function persist() {
      state = normalize(state);
      try { if (!storage) throw Error('storage'); const raw = JSON.stringify(state); storage.setItem(KEY, raw); lastRaw = raw; memoryDirty = false; }
      catch (_) { warning = 'Không lưu được lần kiểm tra. Kết quả vẫn có trong phiên này.'; memoryDirty = true; }
      emit();
    }
    function json(key, fallback) { try { const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
    function tracked(movies) {
      const selected = new Map(), journal = json('movie_journal_v1', {}).entries || {};
      function add(slug, at) { if (identityOK(slug)) selected.set(slug, Math.max(selected.get(slug) || 0, stamp(at))); }
      for (const key of ['my_wishlist', 'continue_watching_list']) { const list = json(key, []); if (Array.isArray(list)) for (const movie of list) if (object(movie)) add(movie.slug, movie.updatedAt || movie.addedAt); }
      if (object(journal)) for (const [slug, entry] of Object.entries(journal)) if (object(entry) && ['planned', 'watching'].includes(entry.status)) add(slug, entry.updatedAt);
      const catalog = new Map((Array.isArray(movies) ? movies : []).filter(object).map(movie => [movie.slug, movie]));
      return [...selected].filter(([slug]) => catalog.has(slug) && !['completed', 'paused'].includes(journal[slug]?.status)).sort((a, b) => b[1] - a[1]).slice(0, MAX).map(([slug]) => catalog.get(slug)).filter(movie => slugOK(movie.apiSlug || movie.slug) && (!movie.source || ['kkphim', 'auto'].includes(movie.source)));
    }
    function due(row, force) { const at = now(); return !row || (force ? at - row.attemptAt >= 30000 : row.error ? at - row.attemptAt >= RETRY : at - row.checkedAt >= TTL); }
    async function one(movie) {
      const slug = movie.slug, sourceSlug = movie.apiSlug || slug, before = state.entries[slug], started = now();
      state.entries[slug] = { ...(before || { sourceSlug }), attemptAt: started }; persist();
      const controller = new AbortController(); let timer;
      try {
        const payload = await Promise.race([
          Promise.resolve(request('https://phimapi.com/phim/' + encodeURIComponent(sourceSlug), { signal: controller.signal, credentials: 'omit', redirect: 'error' })).then(response => { if (!response.ok) throw Error('Nguồn tạm lỗi (' + response.status + ').'); return response.json(); }),
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('Nguồn phản hồi quá lâu.')); }, timeout); })
        ]);
        const next = snapshot(payload, sourceSlug), priorIds = new Set(before?.names?.map(item => item.id) || []);
        const sameSource = before?.sourceSlug === sourceSlug;
        const additions = before?.checkedAt && sameSource ? next.names.filter(item => !priorIds.has(item.id)).map(item => item.id) : [];
        const currentIds = new Set(next.names.map(item => item.id));
        // Keep acknowledged knowledge even when a provider temporarily removes older episodes.
        const knownNames = sameSource ? [...(before?.names || [])] : [];
        const byId = new Map(knownNames.map(item => [item.id, item]));
        for (const item of next.names) byId.set(item.id, item);
        read();
        const pending = state.entries[slug]?.newNames || [];
        state.entries[slug] = { ...next, names: [...byId.values()].slice(-10000), available: currentIds.size, checkedAt: now(), attemptAt: started, newNames: [...new Set([...(sameSource ? pending : []), ...additions])], error: '' };
      } catch (error) {
        read();
        const pending = state.entries[slug]?.newNames || [];
        state.entries[slug] = { ...(before || { names: [], checkedAt: 0, current: '', status: '', sourceSlug }), newNames: pending, attemptAt: started, error: clean(error?.message) || 'Chưa kết nối được nguồn.' };
      } finally { clearTimeout(timer); persist(); }
    }
    function check(movies, { force = false } = {}) {
      if (active) return active;
      read();
      const queue = tracked(movies).filter(movie => due(state.entries[movie.slug], force));
      if (!queue.length) return Promise.resolve(read());
      // A short origin-wide lease avoids duplicate background sweeps in several tabs.
      let token = '';
      try {
        const lease = json(KEY + '_lease', {});
        if (stamp(lease.until) > now()) return Promise.resolve(read());
        token = String(now()) + Math.random(); storage?.setItem(KEY + '_lease', JSON.stringify({ token, until: now() + Math.ceil(queue.length / 2) * timeout + 15000 }));
      } catch (_) {}
      let cursor = 0;
      active = Promise.all([0, 1].map(async () => { while (cursor < queue.length) { const movie = queue[cursor++]; await one(movie); } })).then(() => read()).finally(() => {
        active = null;
        try { if (json(KEY + '_lease', {}).token === token) storage?.removeItem(KEY + '_lease'); } catch (_) {}
        emit();
      });
      emit(); return active;
    }
    function ack(slug) { read(); if (Object.hasOwn(state.entries, slug)) { state.entries[slug].newNames = []; persist(); } }
    return { read, tracked, check, ack, busy: () => !!active, warning: () => warning, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  }
  let catalogPromise;
  function loadCatalog() {
    if (typeof root.loadStaticCatalog === 'function') return root.loadStaticCatalog();
    if (!catalogPromise) catalogPromise = root.fetch('data/catalog-index.json', { credentials: 'same-origin' }).then(response => { if (!response.ok) throw Error('Chưa tải được kho phim.'); return response.json(); }).then(async data => {const decoded=root.CatalogFormat.decode(data);return root.PublishedEpisodes?root.PublishedEpisodes.overlay(decoded,await root.PublishedEpisodes.load()):decoded;}).catch(error => { catalogPromise = null; throw error; });
    return catalogPromise;
  }
  function watchURL(movie, entry) {
    const newest = entry.names.filter(item => entry.newNames.includes(item.id)).at(-1);
    if (!newest) return 'detail.html?' + new URLSearchParams({ slug: movie.slug });
    return 'watch.html?' + new URLSearchParams({ slug: movie.slug, title: movie.title || movie.slug, ep: newest.episode, target_episode: newest.name, server: newest.server, data_source: 'kkphim' });
  }
  const api = { KEY, TTL, RETRY, MAX, normalize, snapshot, create, loadCatalog, watchURL };
  let service;
  Object.defineProperty(api, 'service', { get: () => service || (service = create()) });
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.EpisodeUpdates = api;
})(globalThis);
