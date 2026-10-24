(function () {
  'use strict';
  const service = EpisodeUpdates.service;
  let movies = [], filter = 'new', timer, loading = false;
  const $ = id => document.getElementById(id);
  function node(tag, cls, text) { const item = document.createElement(tag); if (cls) item.className = cls; if (text) item.textContent = text; return item; }
  function date(at) { return at ? new Date(at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa kiểm tra'; }
  function paint() {
    const rows = service.read().entries, tracked = service.tracked(movies);
    $('updates-tracked').textContent = tracked.length;
    $('updates-new-count').textContent = tracked.filter(movie => rows[movie.slug]?.newNames.length).length;
    $('updates-checked').textContent = tracked.filter(movie => rows[movie.slug]?.checkedAt).length;
    $('updates-refresh').disabled = service.busy() || loading;
    $('updates-status').textContent = service.busy() ? 'Đang kiểm tra nguồn, 2 phim mỗi lượt…' : 'Kiểm tra tự động · KKPhim · tối đa mỗi giờ';
    $('updates-warning').textContent = service.warning(); $('updates-warning').hidden = !service.warning();
    const shown = tracked.filter(movie => filter === 'all' || (filter === 'new' ? rows[movie.slug]?.newNames.length : rows[movie.slug]?.error));
    shown.sort((a, b) => (rows[b.slug]?.newNames.length || 0) - (rows[a.slug]?.newNames.length || 0) || String(a.title).localeCompare(String(b.title), 'vi'));
    const fragment = document.createDocumentFragment();
    for (const movie of shown) {
      const entry = rows[movie.slug], card = node('article', 'update-card'); card.dataset.slug = movie.slug;
      const cover = node('a', 'update-cover'); cover.href = SiteTools.detailUrl(movie); cover.setAttribute('aria-label', movie.title);
      const image = node('img'); image.alt = ''; image.loading = 'lazy'; SiteTools.setPoster(image, movie); cover.append(image);
      const info = node('div', 'update-info'), title = node('a', 'update-title', movie.title); title.href = cover.href; info.append(title);
      info.append(node('p', 'update-meta', [movie.year, movie.country].filter(Boolean).join(' · ')));
      if (entry?.newNames.length) { const badge = node('span', 'update-badge', '+' + entry.newNames.length + ' tập mới'); info.append(badge); const newNames = entry.names.filter(item => entry.newNames.includes(item.id)).map(item => item.name); info.append(node('p', 'update-episodes', 'Tập: ' + newNames.slice(0, 8).join(', ') + (newNames.length > 8 ? '…' : ''))); }
      else info.append(node('p', 'update-baseline', entry?.checkedAt ? 'Chưa ghi nhận thêm tập mới' : 'Đang chờ lần kiểm tra đầu'));
      if (entry?.checkedAt) info.append(node('p', 'update-current', (entry.current || entry.available + ' tập có trên nguồn') + (entry.status === 'completed' ? ' · Nguồn đã hoàn tất' : '') + ' · ' + date(entry.checkedAt)));
      if (entry?.error) info.append(node('p', 'update-error', entry.error + (entry.checkedAt ? ' Giữ kết quả lần trước.' : ' Sẽ tự thử lại.')));
      const actions = node('div', 'update-actions'), details = node('a', '', 'Thông tin phim ↗'); details.href = cover.href; actions.append(details);
      if (entry?.newNames.length) { const watch = node('a', 'update-watch', 'Mở tập mới'); watch.href = EpisodeUpdates.watchURL(movie, entry); actions.prepend(watch); const ack = node('button', 'update-ack', 'Đã biết'); ack.type = 'button'; ack.addEventListener('click', () => service.ack(movie.slug)); actions.append(ack); }
      card.append(cover, info, actions); fragment.append(card);
    }
    $('updates-list').replaceChildren(fragment); $('updates-empty').hidden = !!shown.length || loading;
    $('updates-empty-title').textContent = !tracked.length ? 'Thêm một câu chuyện để theo dõi' : filter === 'new' ? 'Bạn đang bắt kịp rồi' : filter === 'error' ? 'Các lần kiểm tra đều ổn' : 'Chưa có phim phù hợp';
    $('updates-empty-copy').textContent = !tracked.length ? 'Lưu phim vào yêu thích hoặc chọn “Muốn xem / Đang xem” trong nhật ký. Tập mới sẽ được theo dõi từ đây.' : filter === 'new' ? 'Lần kiểm tra đầu tạo mốc theo dõi. Khi nguồn có tập chưa từng ghi nhận, phim sẽ xuất hiện ở đây.' : filter === 'error' ? 'Không có phim cần thử lại. Kết quả sẽ tự làm mới khi đến hạn.' : '';
  }
  async function refresh(force = false) {
    if (document.hidden) return;
    try {
      if (!movies.length) { loading = true; movies = await EpisodeUpdates.loadCatalog(); loading = false; }
      paint(); await service.check(movies, { force }); paint();
    } catch (error) { loading = false; $('updates-status').textContent = error.message || 'Chưa tải được dữ liệu. Hãy thử lại.'; $('updates-refresh').disabled = false; }
  }
  $('updates-filters').addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if (!button) return; filter = button.dataset.filter; for (const item of $('updates-filters').querySelectorAll('button')) item.setAttribute('aria-pressed', String(item === button)); paint(); });
  $('updates-refresh').addEventListener('click', () => refresh(true));
  service.subscribe(paint);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('storage', event => { if ([EpisodeUpdates.KEY, 'my_wishlist', 'movie_journal_v1', 'continue_watching_list'].includes(event.key)) { paint(); refresh(); } });
  timer = setInterval(() => refresh(), 60000);
  window.addEventListener('pagehide', () => clearInterval(timer));
  window.addEventListener('pageshow', event => { if (event.persisted) { clearInterval(timer); timer = setInterval(() => refresh(), 60000); refresh(); } });
  refresh();
})();
