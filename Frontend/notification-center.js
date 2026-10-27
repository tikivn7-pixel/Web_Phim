// Acknowledgements are personal data. Notification permission remains a device setting.
(function (root) {
  'use strict';
  const KEY = 'notification_center_v1', PREFS = 'notification_preferences_v1', LIMIT = 20000;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const stamp = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1e15;
  function validKey(key) { try { const value = JSON.parse(key); return Array.isArray(value) && value.length === 2 && value.every(item => typeof item === 'string' && item.length > 0 && item.length <= 500 && !/[\u0000-\u001f\u007f]/.test(item)); } catch (_) { return false; } }
  function normalize(input, strict = false) {
    const out = { version: 1, read: {} };
    if (input === undefined) return out;
    if (!object(input) || input.version !== 1 || !object(input.read)) { if (strict) throw Error('Trạng thái thông báo không hợp lệ.'); return out; }
    if (strict && Object.keys(input.read).length > LIMIT) throw Error('Quá nhiều thông báo đã đọc.');
    for (const [key, at] of Object.entries(input.read).sort((a, b) => b[1] - a[1]).slice(0, LIMIT)) {
      if (!validKey(key) || !stamp(at)) { if (strict) throw Error('Có thông báo đã đọc sai định dạng.'); continue; }
      out.read[key] = at;
    }
    return out;
  }
  function merge(a, b) {
    const out = normalize(a); for (const [id, at] of Object.entries(normalize(b).read)) out.read[id] = Math.max(out.read[id] || 0, at);
    return normalize(out);
  }
  function items(cache, state, movies) {
    const Updates = typeof module !== 'undefined' && module.exports ? require('./episode-updates') : root.EpisodeUpdates;
    const data = Updates ? Updates.normalize(cache) : { entries: {} }, read = normalize(state).read, catalog = movies ? new Map(movies.map(movie => [movie.slug, movie])) : null;
    const rows = [];
    for (const [slug, entry] of Object.entries(data.entries)) {
      if (!entry.checkedAt || catalog && !catalog.has(slug)) continue;
      for (const episode of entry.names) {
        if (!entry.newNames.includes(episode.id)) continue;
        const id = JSON.stringify([slug, episode.id]);
        rows.push({ id, slug, title: catalog?.get(slug)?.title || slug, poster: catalog?.get(slug)?.poster || '', name: episode.name, episode: episode.episode, server: episode.server, createdAt: entry.checkedAt, read: !!read[id] });
      }
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt || a.title.localeCompare(b.title, 'vi') || a.name.localeCompare(b.name, 'vi', { numeric: true }));
  }
  function read(storage = root.localStorage) {
    const raw = storage.getItem(KEY); return raw ? normalize(JSON.parse(raw), true) : normalize();
  }
  function readCache(storage = root.localStorage) { try { return JSON.parse(storage.getItem('episode_updates_v1') || '{}'); } catch (_) { return {}; } }
  function unreadCount() { try { return items(readCache(), read()).filter(row => !row.read).length; } catch (_) { return 0; } }
  function acknowledge(ids, storage = root.localStorage, now = Date.now()) {
    const state = read(storage);
    for (const id of ids) if (validKey(id)) state.read[id] = now;
    storage.setItem(KEY, JSON.stringify(normalize(state, true)));
    root.dispatchEvent?.(new Event('notification-center-changed')); return state;
  }
  function watchURL(item) { return 'watch.html?' + new URLSearchParams({ slug: item.slug, ep: item.episode, target_episode: item.name, server: item.server, data_source: 'kkphim', return: 'notifications.html' }); }
  async function enable() {
    if (!root.isSecureContext || !('Notification' in root)) throw Error('Trình duyệt này chưa hỗ trợ thông báo. Hãy dùng HTTPS hoặc localhost.');
    const permission = await root.Notification.requestPermission();
    if (permission !== 'granted') throw Error(permission === 'denied' ? 'Thông báo đang bị chặn. Bạn có thể đổi quyền trong cài đặt trình duyệt.' : 'Bạn chưa cấp quyền thông báo.');
    root.localStorage.setItem(PREFS, JSON.stringify({ enabled: true }));
    root.dispatchEvent?.(new Event('notification-preferences-changed')); return permission;
  }
  function disable() { root.localStorage.setItem(PREFS, JSON.stringify({ enabled: false })); root.dispatchEvent?.(new Event('notification-preferences-changed')); }
  async function deliverOnce() {
    if (!root.document || !root.Notification || root.Notification.permission !== 'granted') return;
    let prefs; try { prefs = JSON.parse(root.localStorage.getItem(PREFS) || '{}'); } catch (_) { return; }
    if (!prefs.enabled) return;
    // Delivery markers are disposable and local to this device, never a substitute for read state.
    let delivered; try { delivered = JSON.parse(root.localStorage.getItem(PREFS + '_delivered') || '{}'); } catch (_) { delivered = {}; }
    if (!object(delivered)) delivered = {};
    let rows; try { rows = items(readCache(), read()).filter(row => !row.read && !delivered[row.id]); } catch (_) { return; }
    const registration = await root.navigator.serviceWorker?.getRegistration().catch(() => null);
    for (const row of rows.slice(0, 3)) {
      const options = { body: row.title + ' · Tập ' + row.name, tag: 'lauphim-' + row.slug, icon: 'Img/app-icon-192.png', data: { path: watchURL(row) } };
      try {
        if (registration?.active) await registration.showNotification('Tập mới trên LauPhim', options);
        else { const note = new root.Notification('Tập mới trên LauPhim', options); note.onclick = () => { root.location.assign(watchURL(row)); note.close(); }; }
        delivered[row.id] = Date.now();
      } catch (_) { /* Permission may have changed after the check. */ }
    }
    // At most three system alerts per sweep; the complete queue remains in the center.
    try { root.localStorage.setItem(PREFS + '_delivered', JSON.stringify(Object.fromEntries(Object.entries(delivered).sort((a, b) => b[1] - a[1]).slice(0, 3000)))); } catch (_) {}
  }
  let delivering = false;
  async function deliver() {
    if (delivering) return; delivering = true;
    try {
      if (root.navigator?.locks) {
        const profile = root.ProfileStore?.current?.()?.id || 'local';
        await root.navigator.locks.request('lauphim-notifications-' + profile, { ifAvailable: true }, lock => lock ? deliverOnce() : undefined);
      } else await deliverOnce();
    } finally { delivering = false; }
  }
  const api = { KEY, PREFS, normalize, merge, items, read, readCache, unreadCount, acknowledge, watchURL, enable, disable, deliver };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else {
    root.NotificationCenter = api;
    const update = () => { for (const badge of root.document.querySelectorAll('[data-notification-count]')) { const count = unreadCount(); badge.textContent = count > 99 ? '99+' : String(count); badge.hidden = count === 0; } deliver(); };
    const sweep = async () => {
      // A granted permission alone is not opt-in. Background provider checks run
      // only after the viewer enables reminders on this profile/device.
      try {
        const prefs = JSON.parse(root.localStorage.getItem(PREFS) || '{}');
        if (!prefs.enabled || root.Notification?.permission !== 'granted' || root.document.visibilityState === 'hidden' || !root.EpisodeUpdates) return;
        const movies = await root.EpisodeUpdates.loadCatalog(); await root.EpisodeUpdates.service.check(movies); update();
      } catch (_) { /* Existing observations remain available after network failures. */ }
    };
    root.document.addEventListener('DOMContentLoaded', () => { update(); sweep(); });
    root.addEventListener('storage', event => { if ([KEY, 'episode_updates_v1', PREFS, null].includes(event.key)) update(); });
    root.addEventListener('notification-center-changed', update);
    root.addEventListener('episode-updates-changed', update);
    root.addEventListener('notification-preferences-changed', sweep);
    root.document.addEventListener('visibilitychange', () => { if (root.document.visibilityState === 'visible') sweep(); });
    root.setInterval(sweep, 60 * 60 * 1000);
    root.EpisodeUpdates?.service?.subscribe(update);
  }
})(globalThis);
