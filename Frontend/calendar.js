(function () {
  'use strict';
  const P = window.ReleasePlanner, $ = id => document.getElementById(id);
  let movies = [], state = P.normalize(), selected = '', page = 1, blocked = false;
  const status = text => { $('planner-status').textContent = text; };
  function read() {
    try { const raw = localStorage.getItem(P.KEY); state = raw ? P.normalize(JSON.parse(raw), true) : P.normalize(); blocked = false; }
    catch (_) { blocked = true; status('Lịch đã lưu có lỗi. Chưa ghi đè dữ liệu; hãy khôi phục từ bản sao lưu tại Thư viện.'); }
    $('planner-save').disabled = !selected || blocked;
  }
  function write(slug, row) {
    read(); if (blocked) return false;
    const next = P.normalize(state); next.entries[slug] = row;
    try { localStorage.setItem(P.KEY, JSON.stringify(P.normalize(next, true))); state = next; window.dispatchEvent(new Event('release-planner-changed')); return true; }
    catch (_) { status('Chưa lưu được lịch. Bộ nhớ có thể bị chặn hoặc đã đầy.'); return false; }
  }
  const node = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  function select(slug) {
    const movie = movies.find(movie => movie.slug === slug); if (!movie) return;
    selected = slug; read(); const entry = state.entries[slug];
    $('planner-selection').textContent = movie.title;
    $('planner-form-heading').textContent = entry && !entry.deleted ? 'Đổi lịch hẹn.' : 'Thêm vào lịch.';
    if (entry && !entry.deleted) { $('planner-day').value = entry.day; $('planner-time').value = entry.time; }
    $('planner-cancel').hidden = false; renderSearch();
  }
  function clearSelection() { selected = ''; $('planner-selection').textContent = 'Chọn một phim ở trên để đặt lịch.'; $('planner-form-heading').textContent = 'Thêm vào lịch.'; $('planner-save').disabled = true; $('planner-cancel').hidden = true; renderSearch(); }
  function followed() {
    const set = new Set();
    for (const key of ['my_wishlist', 'continue_watching_list']) try { for (const movie of JSON.parse(localStorage.getItem(key) || '[]')) if (movie?.slug) set.add(movie.slug); } catch (_) {}
    try { for (const [slug, entry] of Object.entries(JSON.parse(localStorage.getItem('movie_journal_v1') || '{}').entries || {})) if (['planned', 'watching'].includes(entry.status)) set.add(slug); } catch (_) {}
    return set;
  }
  function renderSearch() {
    const query = SiteTools.normalize($('planner-search').value), onlyFollowed = $('planner-followed').checked, saved = followed();
    const matched = movies.filter(movie => (!onlyFollowed || saved.has(movie.slug)) && (!query || SiteTools.normalize(movie.title + ' ' + movie.slug).includes(query)));
    const pages = Math.max(1, Math.ceil(matched.length / 24)); page = Math.min(page, pages);
    const fragment = document.createDocumentFragment();
    for (const movie of matched.slice((page - 1) * 24, page * 24)) {
      const button = node('button', '', movie.title); button.type = 'button'; button.dataset.slug = movie.slug; button.setAttribute('aria-pressed', String(movie.slug === selected));
      button.append(node('span', '', [movie.year, movie.country].filter(Boolean).join(' · '))); button.addEventListener('click', () => select(movie.slug)); fragment.append(button);
    }
    if (!matched.length) fragment.append(node('p', '', onlyFollowed ? 'Chưa có phim phù hợp trong danh sách đã lưu / đang xem.' : 'Không tìm thấy phim. Thử tên khác.'));
    $('planner-results').replaceChildren(fragment);
    const pagination = $('planner-pagination'); pagination.replaceChildren();
    const prev = node('button', '', '← Trước'), next = node('button', '', 'Sau →'); prev.type = next.type = 'button'; prev.disabled = page <= 1; next.disabled = page >= pages;
    prev.onclick = () => { page--; renderSearch(); }; next.onclick = () => { page++; renderSearch(); };
    pagination.append(prev, node('span', '', page + ' / ' + pages + ' · ' + matched.length + ' phim'), next);
  }
  function renderBoard() {
    const days = P.week(state, movies), fragment = document.createDocumentFragment(); let count = 0;
    days.forEach((day, index) => {
      const box = node('section', 'planner-day'), heading = node('div', 'planner-day-heading'), name = node('h3', '', day.name);
      if (!index) name.append(node('span', 'planner-today', 'HÔM NAY'));
      heading.append(name, node('strong', '', day.date.slice(8) + '/' + day.date.slice(5, 7))); box.append(heading);
      if (!day.entries.length) box.append(node('p', 'planner-no-entry', 'Một khoảng trống cho điều bất ngờ.'));
      for (const entry of day.entries) {
        count++; const card = node('article', 'planner-entry'), image = node('img'); image.alt = ''; image.loading = 'lazy'; SiteTools.setPoster(image, entry.movie);
        const content = node('div'), title = node('h4'), link = node('a', '', entry.movie.title); link.href = 'detail.html?' + new URLSearchParams({ slug: entry.slug }); title.append(link);
        const time = node('time', '', entry.time + ' · Hằng tuần'); time.dateTime = day.date + 'T' + entry.time + ':00+07:00';
        const actions = node('div', 'planner-entry-actions'), edit = node('button', '', 'Đổi lịch'), remove = node('button', '', 'Bỏ lịch'); edit.type = remove.type = 'button';
        edit.onclick = () => { select(entry.slug); $('planner-form').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('planner-day').focus({ preventScroll: true }); };
        remove.onclick = () => { if (!confirm('Bỏ lịch nhắc cho “' + entry.movie.title + '”?')) return; if (write(entry.slug, { deleted: true, updatedAt: Date.now() })) { if (selected === entry.slug) clearSelection(); renderBoard(); status('Đã bỏ lịch nhắc.'); } };
        actions.append(edit, remove); content.append(time, title, actions); card.append(image, content); box.append(card);
      }
      fragment.append(box);
    });
    $('planner-days').replaceChildren(fragment); $('planner-total').textContent = count; $('planner-export').disabled = !count || blocked;
    const catalog = new Set(movies.map(movie => movie.slug)), missing = Object.entries(state.entries).filter(([slug, row]) => !row.deleted && !catalog.has(slug)).length;
    $('planner-missing').hidden = !missing; $('planner-missing').textContent = missing + ' lịch đang gắn với phim không còn trong kho hiện tại. Dữ liệu vẫn được giữ trong bản sao lưu.';
  }
  $('planner-form').addEventListener('submit', event => {
    event.preventDefault(); if (!selected) return;
    const row = { day: Number($('planner-day').value), time: $('planner-time').value, timezone: P.ZONE, updatedAt: Date.now(), deleted: false };
    if (write(selected, row)) { renderBoard(); status('Đã lưu lịch nhắc hằng tuần theo giờ Việt Nam.'); clearSelection(); }
  });
  $('planner-search').addEventListener('input', () => { page = 1; renderSearch(); }); $('planner-followed').addEventListener('change', () => { page = 1; renderSearch(); }); $('planner-cancel').addEventListener('click', clearSelection);
  $('planner-export').addEventListener('click', () => {
    read(); if (blocked) return;
    const url = URL.createObjectURL(new Blob([P.ical(state, movies)], { type: 'text/calendar;charset=utf-8' })), anchor = node('a'); anchor.href = url; anchor.download = 'lauphim-lich-nhac.ics'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); status('Đã xuất lịch .ics. Mở tệp bằng ứng dụng lịch để thêm nhắc hằng tuần.');
  });
  window.addEventListener('storage', event => { if ([P.KEY, 'my_wishlist', 'continue_watching_list', 'movie_journal_v1', null].includes(event.key)) { read(); renderBoard(); renderSearch(); } });
  window.addEventListener('profile-changed', () => { selected = ''; read(); renderBoard(); clearSelection(); });
  read();
  EpisodeUpdates.loadCatalog().then(data => { movies = data; renderSearch(); renderBoard(); if (!blocked) status('Chọn phim và khung giờ để tạo lịch nhắc.'); }).catch(() => { status('Chưa mở được kho phim. Hãy tải lại trang khi có mạng; lịch đã lưu vẫn được giữ.'); });
})();
