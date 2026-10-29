/* Static application shell only. No accounts, API responses or media streams enter CacheStorage. */
'use strict';
const BASE = new URL('./', self.location.href), PREFIX = 'lauphim-shell-' + encodeURIComponent(BASE.pathname) + '-', CACHE = PREFIX + '20261029-movies-only';
const MAX = 220, MAX_BYTES = 1400000;
const OPTIONAL = ['app-updates.js', 'app-updates.css', 'Img/lauphim-logo.png', 'brand.css', 'Img/app-icon-32.png', 'Img/app-icon-180.png', 'Img/app-icon-512.png', 'discover.html', 'calendar.html', 'notifications.html', 'library.html', 'cinema.css', 'discover.css', 'discover.js', 'discover-model.js', 'movie-people.js', 'calendar.js', 'notifications.js', 'notifications.css', 'catalog-format.js', 'published-episodes.js', 'country-utils.js', 'genre-utils.js', 'site-tools.js', 'movie-journal.js', 'episode-tracker.js', 'personal-lists.js', 'movie-notes.js', 'personal-data.js', 'library.js', 'library.css', 'library-bulk.js', 'journal-controls.js', 'episode-updates.js', 'release-planner.js', 'notification-center.js', 'app-navigation.js', 'app-navigation.css', 'pwa.js', 'profile-store.js', 'hub-client.js', 'hub-catalog.js', 'cloud-sync-model.js', 'cloud-sync.js', 'hub-common.js', 'hub.css', 'data/catalog-index.json', 'data/episode-summary.json', 'Img/poster-placeholder.svg', 'manifest.webmanifest'];
function eligible(request) {
  if (request.method !== 'GET' || request.headers.has('Authorization') || request.headers.has('Range') || ['video', 'audio'].includes(request.destination)) return false;
  const url = new URL(request.url);
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return false;
  if ([...url.searchParams.keys()].some(key => /token|secret|signature|authorization|api.?key|credential|password/i.test(key))) return false;
  const relative = decodeURIComponent(url.pathname.slice(BASE.pathname.length));
  if (/(?:^|\/)api(?:\/|$)/i.test(relative) || relative.includes('..') || /[\\\u0000-\u001f]/.test(relative)) return false;
  return !relative || /^[^/]+\.(?:html|js|css|webmanifest)$/.test(relative) || ['data/catalog-index.json', 'data/catalog-cast.json', 'data/episode-summary.json', 'data/movie-relations.json'].includes(relative) || /^Img\/[^?]+\.(?:svg|webp|png|jpe?g)$/i.test(relative);
}
function keyFor(request) { const url = new URL(request.url); url.search = ''; url.hash = ''; return url.href; }
async function store(request, response) {
  if (!response.ok || response.type === 'opaque' || response.headers.get('Cache-Control')?.includes('no-store')) return;
  if (Number(response.headers.get('Content-Length')) > MAX_BYTES) return;
  const contentType = response.headers.get('Content-Type') || '';
  if (/audio|video|mpegurl|octet-stream/i.test(contentType)) return;
  const payload = await response.clone().arrayBuffer(); if (payload.byteLength > MAX_BYTES) return;
  const cache = await caches.open(CACHE); await cache.put(keyFor(request), response);
  const keys = await cache.keys();
  // Preserve the fallback and compact index when trimming recent posters/pages.
  // A cached page must keep its profile adapter and normalization modules too;
  // otherwise an offline reload could fall back to unscoped legacy storage.
  const pinned = new Set(['offline.html', 'calendar.css', 'Img/app-icon-192.png', ...OPTIONAL].map(path => new URL(path, BASE).href));
  let excess = keys.length - MAX;
  for (const key of keys) if (excess > 0 && !pinned.has(key.url)) { await cache.delete(key); excess--; }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(['offline.html', 'calendar.css', 'Img/app-icon-192.png'].map(path => new URL(path, BASE).href));
    await Promise.allSettled(OPTIONAL.map(async path => { const request = new Request(new URL(path, BASE).href, { credentials: 'same-origin', cache: 'reload' }); const response = await fetch(request); await store(request, response); }));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => { for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key); await self.clients.claim(); })());
});
self.addEventListener('fetch', event => {
  let allowed = false; try { allowed = eligible(event.request); } catch (_) {}
  if (!allowed) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) event.waitUntil(store(event.request, response.clone()).catch(() => {}));
      return response;
    } catch (_) {
      const cache = await caches.open(CACHE), stored = await cache.match(keyFor(event.request));
      if (stored) return stored;
      if (event.request.mode === 'navigate') return await cache.match(new URL('offline.html', BASE).href) || Response.error();
      return Response.error();
    }
  })());
});
self.addEventListener('message', event => { if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    let target;
    try {
      target = new URL(event.notification.data?.path || 'notifications.html', BASE);
      if (target.origin !== BASE.origin || !target.pathname.startsWith(BASE.pathname) || !['watch.html', 'notifications.html'].includes(target.pathname.slice(BASE.pathname.length))) return;
      if ([...target.searchParams.keys()].some(key => !['slug', 'ep', 'target_episode', 'server', 'data_source', 'return'].includes(key))) return;
    } catch (_) { return; }
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse only the exact target; never replace another tab's unsaved draft/player.
    const existing = clients.find(client => client.url === target.href);
    if (existing) await existing.focus(); else await self.clients.openWindow(target.href);
  })());
});
