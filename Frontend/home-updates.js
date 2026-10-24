(function () {
  'use strict';
  const mount = document.getElementById('home-episode-updates');
  if (!mount) return;
  const service = EpisodeUpdates.service;
  let movies = [], timer;
  function node(tag, cls, text) { const item = document.createElement(tag); if (cls) item.className = cls; if (text) item.textContent = text; return item; }
  const heading = node('div', 'home-updates-heading'), h2 = node('h2', '', 'Tập mới cho bạn'), link = node('a', '', 'Theo dõi tất cả ↗'); link.href = 'updates.html'; heading.append(h2, link);
  const status = node('p', 'home-updates-status'); status.setAttribute('role', 'status');
  const list = node('div', 'home-update-list'), empty = node('div', 'home-updates-empty');
  mount.replaceChildren(heading, status, list, empty);
  function paint() {
    const entries = service.read().entries, tracked = service.tracked(movies), fresh = tracked.filter(movie => entries[movie.slug]?.newNames.length);
    status.textContent = service.busy() ? 'Đang kiểm tra tập mới từ KKPhim…' : tracked.length ? 'Tự theo dõi ' + tracked.length + ' phim · ' + fresh.length + ' phim có tập mới' : 'Lưu một bộ phim. Tự theo dõi chương tiếp theo.';
    const fragment = document.createDocumentFragment();
    for (const movie of fresh.slice(0, 6)) {
      const entry = entries[movie.slug], card = node('a', 'home-update-card'); card.href = SiteTools.detailUrl(movie); card.dataset.slug = movie.slug;
      const image = node('img'); image.alt = ''; image.loading = 'lazy'; SiteTools.setPoster(image, movie);
      const text = node('div'), title = node('strong', '', movie.title), badge = node('span', '', '+' + entry.newNames.length + ' tập mới'); text.append(badge, title); card.append(image, text); fragment.append(card);
    }
    list.replaceChildren(fragment); list.hidden = !fresh.length; empty.hidden = !!fresh.length;
    empty.replaceChildren(node('span', '', tracked.length ? 'Chưa ghi nhận tập mới. Lần kiểm tra đầu làm mốc theo dõi; nguồn lỗi vẫn giữ kết quả lần trước.' : 'Phim trong yêu thích, lịch sử xem và nhật ký “Muốn xem / Đang xem” sẽ tự được kiểm tra khi bạn mở web.'));
    const action = node('a', '', tracked.length ? 'Xem tình trạng kiểm tra →' : 'Mở thư viện →'); action.href = tracked.length ? 'updates.html' : 'library.html'; empty.append(action);
    if (service.warning()) status.textContent += ' · ' + service.warning();
  }
  async function refresh() {
    if (document.hidden) return;
    try { if (!movies.length) movies = await EpisodeUpdates.loadCatalog(); paint(); await service.check(movies); paint(); }
    catch (_) { status.textContent = 'Chưa kiểm tra được tập mới. Mở mục Theo dõi tất cả để thử lại.'; }
  }
  service.subscribe(paint);
  for (const name of ['wishlist-changed', 'movie-journal-change']) window.addEventListener(name, refresh);
  window.addEventListener('storage', event => { if ([EpisodeUpdates.KEY, 'my_wishlist', 'continue_watching_list', 'movie_journal_v1'].includes(event.key)) refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { clearInterval(timer); timer = setInterval(refresh, 60000); refresh(); } });
  window.addEventListener('pagehide', () => clearInterval(timer));
  timer = setInterval(refresh, 60000); refresh();
})();
