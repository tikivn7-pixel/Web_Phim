(function () {
  'use strict';
  const $ = id => document.getElementById(id); let movies = [];
  function folded(text) { return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase(); }
  function paint() {
    const query = folded($('rooms-search').value.trim()), matches = movies.filter(movie => !query || folded(movie.title).includes(query) || folded(movie.origin_name).includes(query));
    $('rooms-grid').replaceChildren(...matches.slice(0, 12).map(movie => {
      const link = document.createElement('a'); link.className = 'rooms-movie'; link.href = 'watch.html?' + new URLSearchParams({ slug: movie.slug, title: movie.title, room_create: '1' });
      const image = document.createElement('img'); image.alt = ''; image.loading = 'lazy'; SiteTools.setPoster(image, {}, movie);
      const title = document.createElement('strong'); title.textContent = movie.title;
      const action = document.createElement('span'); action.textContent = 'Mở phim & tạo phòng ↗'; link.append(image, title, action); return link;
    }));
    $('rooms-catalog-status').textContent = matches.length ? 'Hiển thị ' + Math.min(12, matches.length) + ' / ' + matches.length + ' phim. Tạo phòng trong mục Tiện ích bên cạnh video.' : 'Chưa tìm thấy phim phù hợp.';
  }
  $('rooms-search').addEventListener('input', paint);
  $('rooms-invite-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const url = new URL($('rooms-invite-input').value.trim(), location.href);
      const expected = new URL('watch.html', location.href);
      if (url.origin !== location.origin || url.pathname !== expected.pathname || !WatchRoom.validID(url.searchParams.get('room')) || !url.searchParams.get('slug') || url.username || url.password) throw Error('Lời mời phải dẫn đến trang xem phim trên website LauPhim này.');
      const safe = new URL(expected); for (const key of ['slug', 'room', 'ep', 'target_episode', 'data_source', 'server']) if (url.searchParams.has(key)) safe.searchParams.set(key, url.searchParams.get(key).slice(0, 200));
      location.href = safe.href;
    } catch (error) { $('rooms-invite-status').textContent = error.message || 'Liên kết lời mời chưa hợp lệ.'; }
  });
  (async () => { try { const available = rootReady(); $('rooms-service-status').textContent = await available ? 'Dịch vụ đang kết nối. Chọn phim để bắt đầu.' : 'Máy chủ chưa kết nối. Bạn vẫn chọn được phim; hãy cấu hình dịch vụ để tạo và tham gia phòng.'; } catch (_) { $('rooms-service-status').textContent = 'Chưa kết nối được dịch vụ xem chung.'; } })();
  function rootReady() { return window.HubClient ? HubClient.ready() : Promise.resolve(false); }
  (async () => { try { const response = await fetch('data/catalog-index.json'); if (!response.ok) throw Error('Không tải được kho phim.'); movies = CatalogFormat.decode(await response.json()); paint(); } catch (error) { $('rooms-catalog-status').textContent = error.message + ' Hãy tải lại trang để thử lại.'; } })();
})();
