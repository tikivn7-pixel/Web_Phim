(function () {
  'use strict';
  const $ = id => document.getElementById(id), P = PersonalLists, M = ListsModel;
  let selected = new URLSearchParams(location.search).get('list') || '', catalog = [], lookup = new Map(), data = null, saving = false, catalogReady = false, resultPage = 1, memberLimit = 60, editedId = '', deleteId = '';
  const requestedMovie = new URLSearchParams(location.search).get('movie');
  function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
  function say(text) { $('list-status').textContent = text; }
  function urlFor(id) { const url = new URL(location.href); if (id) url.searchParams.set('list', id); else url.searchParams.delete('list'); return url; }
  function syncURL(replace = false) { const url = urlFor(selected); if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState']({}, '', url); }
  function focusKey(key) { if (!key) return; const target = [...document.querySelectorAll('[data-focus]')].find(el => el.dataset.focus === key && !el.disabled); if (target) target.focus({ preventScroll: true }); }
  function action(fn, message, key) {
    try { saving = true; fn(); saving = false; syncURL(); paint(); say(message || 'Đã lưu thay đổi.'); focusKey(key); return true; }
    catch (error) { saving = false; say(error.message); return false; }
  }
  function image(movie) { const img = node('img'); img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; SiteTools.setPoster(img, {}, movie); return img; }
  function mosaic(list) {
    const el = node('div', 'list-mosaic'); el.setAttribute('aria-hidden', 'true');
    for (let n = 0; n < 4; n++) { const movie = lookup.get(list.slugs[n]); el.append(movie ? image(movie) : node('span', 'mosaic-placeholder', n === 0 && !list.slugs.length ? '▧' : '')); }
    return el;
  }
  function detailLink(movie, className, text) { const link = node('a', className, text); link.href = 'detail.html?' + new URLSearchParams({ slug: movie.slug }); return link; }
  function makeButton(text, title, key, callback) { const b = node('button', '', text); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); if (key) b.dataset.focus = key; b.onclick = callback; return b; }
  function current() { return data?.lists[selected]; }
  function choose(id, push = true) {
    selected = id; memberLimit = 60; $('member-search').value = ''; $('member-sort').value = 'manual'; $('edit-list').hidden = true; $('delete-confirm').hidden = true; if (push) syncURL(); paint();
  }
  function paint() {
    try { data = P.read(undefined, true); }
    catch (error) { say(error.message); $('lists-overview').replaceChildren(); $('list-editor').hidden = true; $('lists-empty').hidden = true; $('lists-count').textContent = 'Chưa đọc được dữ liệu'; return; }
    const lists = P.active(data);
    if (!lists.some(list => list.id === selected)) { selected = lists[0]?.id || ''; $('edit-list').hidden = true; $('delete-confirm').hidden = true; editedId = ''; deleteId = ''; syncURL(true); }
    $('lists-count').textContent = lists.length + ' / ' + P.MAX_LISTS + ' danh sách';
    $('lists-empty').hidden = lists.length > 0;
    $('lists-overview').replaceChildren(...lists.map(list => {
      const card = node('a', 'list-overview-card'); card.href = urlFor(list.id); card.dataset.focus = 'list-' + list.id; if (list.id === selected) card.setAttribute('aria-current', 'true');
      card.setAttribute('aria-label', list.name + ', ' + list.slugs.length + ' phim');
      const info = node('div', 'list-overview-info'); info.append(node('h3', '', list.name), node('p', '', list.description || 'Một buổi chiếu do bạn lựa chọn'), node('span', '', list.slugs.length + ' phim · ' + (list.id === selected ? 'Đang mở' : 'Mở danh sách ↗')));
      card.append(mosaic(list), info); card.onclick = event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.button) return; event.preventDefault(); choose(list.id); focusKey('list-' + list.id); }; return card;
    }));
    $('list-editor').hidden = !selected;
    if (!selected) return;
    const list = current(); $('list-title').textContent = list.name; $('selected-description').textContent = list.description || 'Chưa có mô tả. Thêm vài dòng để ghi nhớ ý tưởng cho buổi chiếu này.';
    $('selected-count').textContent = list.slugs.length + ' phim · Thứ tự do bạn chọn';
    $('selected-mosaic').replaceChildren(...mosaic(list).childNodes);
    paintMembers(); paintResults();
  }
  function paintMembers() {
    const list = current(); if (!list) return;
    const query = $('member-search').value, sort = $('member-sort').value, found = M.members(list, lookup, { query, sort }), manual = sort === 'manual' && !M.normalize(query);
    $('member-count').textContent = found.length + ' / ' + list.slugs.length + ' phim' + (found.length > memberLimit ? ' · Đang hiện ' + memberLimit : '');
    $('order-hint').textContent = manual ? 'Dùng ↑ ↓ để xếp thứ tự xem. Phim mới thêm nằm ở cuối danh sách.' : 'Đổi về “Thứ tự của bạn” và xóa tìm kiếm để sắp xếp phim bằng ↑ ↓.';
    $('list-members').replaceChildren(...found.slice(0, memberLimit).map(({ movie, position }) => {
      const card = node('article', 'library-card list-member-card'); card.dataset.slug = movie.slug;
      const poster = detailLink(movie, 'poster-link'); poster.append(image(movie), node('span', 'list-order-badge', String(position + 1))); const title = node('h3'); title.append(detailLink(movie, 'list-film-title', movie.title));
      const meta = node('p', 'card-meta', movie.unavailable ? 'Chưa có trong kho hiện tại' : [movie.year, movie.country].filter(Boolean).join(' · '));
      const actions = node('div', 'list-member-actions');
      const up = makeButton('↑', 'Đưa ' + movie.title + ' lên trước', 'up-' + movie.slug, () => action(() => P.move(selected, movie.slug, -1), 'Đã đổi thứ tự phim.', 'down-' + movie.slug)); up.dataset.action = 'up'; up.disabled = !manual || position === 0;
      const down = makeButton('↓', 'Đưa ' + movie.title + ' xuống sau', 'down-' + movie.slug, () => action(() => P.move(selected, movie.slug, 1), 'Đã đổi thứ tự phim.', 'up-' + movie.slug)); down.dataset.action = 'down'; down.disabled = !manual || position === list.slugs.length - 1;
      const remove = makeButton('Bỏ', 'Bỏ ' + movie.title + ' khỏi danh sách', 'remove-' + movie.slug, () => { if (action(() => P.removeMovie(selected, movie.slug), 'Đã bỏ phim khỏi danh sách.')) { const next = $('list-members').querySelector('button:not(:disabled)'); (next || $('member-search')).focus({ preventScroll: true }); } }); remove.className = 'list-remove'; remove.dataset.action = 'remove';
      actions.append(up, down, remove); card.append(poster, title, meta, actions); return card;
    }));
    $('members-empty').hidden = found.length > 0; $('members-empty-title').textContent = list.slugs.length ? 'Không tìm thấy phim phù hợp' : 'Lịch chiếu còn trống'; $('members-empty-text').textContent = list.slugs.length ? 'Thử một tên khác hoặc xóa tìm kiếm để xem toàn bộ danh sách.' : 'Tìm phim bên dưới để thêm vào danh sách này.';
    $('members-more').hidden = found.length <= memberLimit;
  }
  function paintResults() {
    const list = current(); $('list-results').replaceChildren(); $('results-pagination').replaceChildren(); if (!list) return;
    const query = $('list-search').value;
    if (!catalogReady) { $('results-count').textContent = ''; return; }
    if (!M.normalize(query)) { $('results-count').textContent = 'Nhập tên để tìm trong ' + catalog.length.toLocaleString('vi') + ' phim.'; return; }
    const found = M.search(catalog, query, resultPage); resultPage = found.page;
    $('results-count').textContent = found.total ? found.total.toLocaleString('vi') + ' kết quả · ' + ((found.page - 1) * 20 + 1) + '–' + Math.min(found.page * 20, found.total) : 'Không tìm thấy phim. Thử tên gốc hoặc một từ ngắn hơn.';
    $('list-results').replaceChildren(...found.items.map(movie => {
      const row = node('article', 'list-search-card'); row.dataset.slug = movie.slug; const info = node('div', 'list-search-info'); info.append(detailLink(movie, '', movie.title), node('p', '', [movie.year, movie.country].filter(Boolean).join(' · ')));
      const added = list.slugs.includes(movie.slug), full = list.slugs.length >= P.MAX_MOVIES;
      const add = makeButton(added ? 'Đã thêm ✓' : 'Thêm +', added ? 'Phim đã có trong danh sách này' : 'Thêm ' + movie.title + ' vào danh sách', 'add-' + movie.slug, () => { if (action(() => { if (!P.read(undefined, true).lists[selected].slugs.includes(movie.slug)) P.add(selected, movie.slug); }, 'Đã thêm “' + movie.title + '” vào cuối danh sách.')) { const sameRow = [...$('list-results').children].find(el => el.dataset.slug === movie.slug); sameRow?.querySelector('a')?.focus({ preventScroll: true }); } });
      add.disabled = added || full; if (full && !added) add.title = 'Danh sách đã đạt tối đa ' + P.MAX_MOVIES + ' phim'; row.append(image(movie), info, add); return row;
    }));
    if (found.pages > 1) {
      const previous = makeButton('← Trước', 'Trang trước', 'result-prev', () => { resultPage--; paintResults(); $('list-search').focus({ preventScroll: true }); }); previous.disabled = found.page === 1;
      const next = makeButton('Tiếp →', 'Trang tiếp theo', 'result-next', () => { resultPage++; paintResults(); $('list-search').focus({ preventScroll: true }); }); next.disabled = found.page === found.pages;
      $('results-pagination').append(previous, node('span', '', 'Trang ' + found.page + ' / ' + found.pages), next);
    }
  }
  function showCreate() { $('create-panel').hidden = false; $('list-name').focus(); }
  $('show-create').onclick = showCreate; $('empty-create').onclick = showCreate;
  $('cancel-create').onclick = () => { $('create-panel').hidden = true; $('show-create').focus(); };
  $('create-list').onsubmit = event => { event.preventDefault(); const ok = action(() => { selected = P.create({ name: $('list-name').value, description: $('list-description').value }).id; memberLimit = 60; }, 'Đã tạo danh sách. Tìm phim bên dưới để thêm vào.'); if (ok) { $('create-panel').hidden = true; $('create-list').reset(); $('list-search').focus({ preventScroll: true }); } };
  $('rename-list').onclick = () => { const list = current(); if (!list) return; editedId = selected; $('edit-list-name').value = list.name; $('edit-list-description').value = list.description; $('edit-list').hidden = false; $('delete-confirm').hidden = true; $('edit-list-name').focus(); };
  $('edit-list').onsubmit = event => { event.preventDefault(); if (editedId !== selected) { say('Danh sách đã thay đổi. Hãy mở lại phần chỉnh sửa.'); return; } if (action(() => P.update(editedId, { name: $('edit-list-name').value, description: $('edit-list-description').value }), 'Đã cập nhật thông tin danh sách.')) { $('edit-list').hidden = true; $('rename-list').focus(); } };
  $('cancel-edit').onclick = () => { $('edit-list').hidden = true; $('rename-list').focus(); };
  $('delete-list').onclick = () => { deleteId = selected; $('delete-message').textContent = 'Bạn đang xóa “' + current().name + '” (' + current().slugs.length + ' phim).'; $('delete-confirm').hidden = false; $('edit-list').hidden = true; $('cancel-delete').focus(); };
  $('cancel-delete').onclick = () => { $('delete-confirm').hidden = true; $('delete-list').focus(); };
  $('confirm-delete').onclick = () => { if (deleteId !== selected) { say('Danh sách đã thay đổi. Hãy chọn lại danh sách cần xóa.'); return; } if (action(() => P.remove(deleteId), 'Đã xóa danh sách.')) { $('delete-confirm').hidden = true; $('show-create').focus(); } };
  $('list-search').oninput = () => { resultPage = 1; paintResults(); };
  $('member-search').oninput = () => { memberLimit = 60; paintMembers(); }; $('member-sort').onchange = () => { memberLimit = 60; paintMembers(); };
  $('members-more').onclick = () => { memberLimit += 60; paintMembers(); };
  async function loadCatalog() {
    $('catalog-status').textContent = 'Đang tải kho phim…'; $('catalog-retry').hidden = true;
    try { const response = await fetch('data/catalog-index.json'); if (!response.ok) throw Error('HTTP ' + response.status); catalog = CatalogFormat.decode(await response.json()); if(typeof PublishedEpisodes!=="undefined") catalog=PublishedEpisodes.overlay(catalog,await PublishedEpisodes.load()); lookup = M.index(catalog); catalogReady = true; $('catalog-status').textContent = ''; paint(); }
    catch (_) { $('catalog-status').textContent = 'Chưa tải được kho phim. Danh sách đã lưu vẫn được giữ; bạn có thể thử tải lại.'; $('catalog-retry').hidden = false; }
  }
  $('catalog-retry').onclick = loadCatalog;
  const refresh = () => { if (saving) return; const key = document.activeElement?.dataset.focus; paint(); focusKey(key); };
  window.addEventListener('movie-lists-change', refresh); window.addEventListener('storage', event => { if (!event.key || event.key === P.KEY) refresh(); });
  window.addEventListener('popstate', () => choose(new URLSearchParams(location.search).get('list') || '', false));
  paint();
  if (requestedMovie) { $('list-search').value = requestedMovie; if (!selected) say('Tạo một danh sách trước, sau đó thêm phim đã chọn bên dưới.'); }
  loadCatalog().then(() => { if (requestedMovie) { $('list-search').value = lookup.get(requestedMovie)?.title || requestedMovie; paintResults(); } });
})();
