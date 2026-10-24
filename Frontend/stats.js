(() => {
  'use strict';
  const $ = id => document.getElementById(id), M = ViewingStats;
  let catalog = [], catalogReady = false, catalogLoading = false, catalogError = false;
  const number = value => value.toLocaleString('vi-VN');
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const detail = slug => 'detail.html?' + new URLSearchParams({ slug });
  function read() {
    try { return PersonalData.read(localStorage); }
    catch (_) { return { data: {}, warnings: ['storage'] }; }
  }
  function bar(label, count, max, href = '') {
    const row = el('div', 'stats-bar'), top = el('div', 'stats-bar-top'), title = el(href ? 'a' : 'span', '', label), value = el('strong', '', number(count) + ' phim'), meter = el('meter');
    if (href) title.href = href;
    meter.min = 0; meter.max = Math.max(1, max); meter.value = count; meter.setAttribute('aria-label', label + ': ' + number(count) + ' phim');
    top.append(title, value); row.append(top, meter); return row;
  }
  function facets(target, rows, key) {
    const host = $(target); host.replaceChildren();
    if (!catalogReady) { host.append(el('p', 'stats-inset-empty', catalogError ? 'Thử tải lại kho phim để xem phần này.' : 'Đang tải thông tin kho phim…')); return; }
    if (!rows.length) { host.append(el('p', 'stats-inset-empty', 'Chưa có phim khớp kho dữ liệu trong khoảng đã chọn.')); return; }
    host.append(...rows.map(row => bar(row.label, row.count, rows[0].count, 'discover.html?' + new URLSearchParams({ [key]: row.label }))));
  }
  function render() {
    const snapshot = read(), selected = M.period(new URLSearchParams(location.search).get('period'));
    $('stats-period').value = selected;
    const result = M.build(snapshot.data, catalog, { period: selected });
    for (const key of ['personal', 'completed', 'episodes', 'bookmarks']) $('stats-' + key + '-count').textContent = number(result.counts[key]);
    $('stats-storage-warning').hidden = !snapshot.warnings.length;
    $('stats-storage-warning').textContent = snapshot.warnings.length ? 'Một phần dữ liệu cá nhân không đọc được hoặc bị trình duyệt chặn. Số liệu chỉ tính các mục hợp lệ đã đọc được. Trang này không ghi đè hay sửa dữ liệu; hãy kiểm tra bản sao lưu trong Thư viện.' : '';
    $('stats-empty').hidden = result.allPersonal > 0 || snapshot.warnings.length > 0;
    $('stats-scope-description').textContent = selected === 'all' ? 'Các bản ghi đang có, không phải tổng số lần xem.' : 'Các bản ghi cá nhân có cập nhật trong ' + selected + ' ngày gần đây.';
    $('stats-period-note').textContent = selected === 'all' ? 'Không quy đổi vị trí xem dở thành giờ xem. Mỗi con số phản ánh dữ liệu còn lưu trên thiết bị này.' : 'Lọc theo lần cập nhật gần nhất, không phải toàn bộ lịch sử. Bản ghi thiếu thời điểm hợp lệ chỉ có trong “Tất cả thời gian”.' + (result.untimed ? ' Có ' + number(result.untimed) + ' phim có ít nhất một bản ghi thiếu thời điểm hợp lệ.' : '');
    $('stats-status-bars').replaceChildren(...Object.entries(M.LABELS).map(([key, label]) => bar(label, result.statuses[key], Math.max(...Object.values(result.statuses)))));
    $('stats-rating-bars').replaceChildren(...[5, 4, 3, 2, 1].map(stars => bar('★'.repeat(stars), result.ratings[stars - 1], Math.max(...result.ratings))));
    $('stats-rating-summary').textContent = result.counts.rated ? number(result.counts.rated) + ' phim có điểm riêng của bạn, từ 1 đến 5 sao. Không phải điểm công khai.' : 'Chưa có điểm riêng trong khoảng này. Bạn có thể chấm 1–5 sao ở trang phim hoặc Thư viện.';
    facets('stats-genres', result.genres, 'genre'); facets('stats-countries', result.countries, 'country');
    $('stats-catalog-note').textContent = catalogReady ? 'Từ ' + number(result.matched) + ' phim khớp kho hiện tại. Mỗi phim dùng quốc gia chính đã lưu.' + (result.unmatched ? ' Có ' + number(result.unmatched) + ' phim chưa khớp kho nên không tính vào thể loại/quốc gia.' : '') : 'Số liệu cá nhân vẫn được đọc khi chưa tải được kho phim.';
    const bySlug = new Map(catalog.map(movie => [movie.slug, movie]));
    $('stats-resume').hidden = !result.resume;
    if (result.resume) {
      const movie = bySlug.get(result.resume.slug) || result.resume;
      $('stats-resume-title').textContent = movie.title || result.resume.slug;
      const seconds = Math.floor(result.resume.currentTime || 0), time = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
      $('stats-resume-description').textContent = (result.resume.episodeName ? 'Tập ' + result.resume.episodeName.replace(/^tập\s*/i, '') : 'Tập đang xem') + ' · Vị trí đã lưu ' + time;
      $('stats-resume-link').href = result.resume.url; SiteTools.setPoster($('stats-resume-poster'), result.resume, movie);
    }
    $('stats-timeline').replaceChildren(...result.timeline.map(row => {
      const li = el('li'), dot = el('span', 'stats-activity-dot', '•'), copy = el('div', 'stats-activity-copy'), action = el('strong', '', row.label), link = el('a', '', row.listName || bySlug.get(row.slug)?.title || row.slug), time = el('time');
      dot.setAttribute('aria-hidden', 'true');
      link.href = row.listId ? 'lists.html?' + new URLSearchParams({ list: row.listId }) : detail(row.slug);
      if (row.episodeName) action.textContent += ' · Tập ' + row.episodeName.replace(/^tập\s*/i, '');
      time.dateTime = new Date(row.updatedAt).toISOString();
      time.textContent = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(row.updatedAt);
      copy.append(action, link); li.append(dot, copy, time); return li;
    }));
    $('stats-timeline-empty').hidden = result.timeline.length > 0;
    $('stats-activity-total').textContent = result.timeline.length ? 'Gần nhất ' + number(result.timeline.length) + ' mục' : '';
    $('stats-lists').replaceChildren(...result.lists.slice(0, 5).map(list => { const a = el('a', 'stats-list-link'); a.href = 'lists.html?' + new URLSearchParams({ list: list.id }); a.append(el('span', '', list.name), el('small', '', number(list.count) + ' phim →')); return a; }));
    if (!result.lists.length) $('stats-lists').append(el('p', 'stats-help', 'Chưa có danh sách riêng được cập nhật trong khoảng này.'));
    $('stats-notes-summary').textContent = number(result.counts.notes) + ' phim có ghi chú · ' + number(result.counts.bookmarks) + ' mốc cảnh trong khoảng đã chọn. Cảm nhận riêng chỉ mở trong sổ tay của bạn.';
  }
  async function loadCatalog() {
    if (catalogLoading) return;
    catalogLoading = true; catalogError = false; $('stats-catalog-error').hidden = true; $('stats-retry').disabled = true;
    try {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
      let response;
      try { response = await fetch('./data/catalog-index.json', { cache: 'no-cache', signal: controller.signal }); }
      finally { clearTimeout(timeout); }
      if (!response.ok) throw Error('catalog');
      catalog = CatalogFormat.decode(await response.json());
      catalog = PublishedEpisodes.overlay(catalog, await PublishedEpisodes.load());
      catalogReady = true;
    } catch (_) { catalogError = true; $('stats-catalog-error').hidden = false; }
    finally { catalogLoading = false; $('stats-retry').disabled = false; render(); }
  }
  $('stats-period').addEventListener('change', () => {
    const params = new URLSearchParams(location.search), selected = M.period($('stats-period').value);
    if (selected === 'all') params.delete('period'); else params.set('period', selected);
    history.pushState({}, '', location.pathname + (params.size ? '?' + params : '')); render();
  });
  $('stats-retry').addEventListener('click', loadCatalog);
  for (const name of ['storage', 'movie-journal-change', 'episode-tracker-change', 'movie-notes-change', 'movie-lists-change', 'wishlist-changed', 'popstate']) window.addEventListener(name, render);
  window.addEventListener('pageshow', event => { if (event.persisted) render(); });
  render(); loadCatalog();
})();
