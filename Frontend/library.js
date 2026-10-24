(function () {
  "use strict";
  const P = PersonalData, J = MovieJournal, $ = id => document.getElementById(id);
  const PAGE_SIZE = 60;
  const TABS = ["favorites", "planned", "watching", "completed", "journal", "episodes"];
  let widgetCleanups = [];
  let selecting = false, selected = new Set(), visibleSlugs = [];
  let data = P.normalize({}), tab = "favorites", catalog = new Map(), incoming = null, storageWarnings = [], visibleLimit = PAGE_SIZE, importRevision = 0;
  function storage() { return window.localStorage; }
  function message(value) { $("library-status").textContent = value; $("library-status").hidden = !value; }
  function load() {
    try {
      const loaded = P.read(storage()); data = loaded.data; storageWarnings = loaded.warnings;
      if (loaded.warnings.length) message("Một phần dữ liệu lưu trên trình duyệt không đọc được. Bạn vẫn có thể dùng thư viện; hãy tải bản sao trước khi thay đổi dữ liệu.");
    } catch (_) { storageWarnings = ["storage"]; message("Trình duyệt đang chặn bộ nhớ. Cho phép lưu dữ liệu website để dùng thư viện và khôi phục bản sao."); }
  }
  function persist(next, replaceDamaged = false) {
    if (storageWarnings.length && !replaceDamaged) { message("Một phần dữ liệu cũ không đọc được. Chưa ghi thay đổi để giữ nguyên dữ liệu gốc. Bạn có thể khôi phục bằng bản sao hợp lệ với chế độ Thay thế."); return false; }
    try { data = P.write(storage(), next); message(""); render(); return true; }
    catch (error) { message(error.message); return false; }
  }
  const fold = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  const time = value => `${Math.floor((Number(value) || 0) / 60)}:${String(Math.floor((Number(value) || 0) % 60)).padStart(2, "0")}`;
  const episodeLabel = item => item.episodeName ? (/^\d+$/.test(item.episodeName) ? "Tập " + item.episodeName : item.episodeName) : "Tập " + item.episode;
  const journalEntries = () => data.movie_journal_v1?.entries || {};
  const statusOf = item => journalEntries()[item.slug]?.status || "";
  const trackedMovies = () => data.episode_tracker_v1?.movies || {};
  const watchedCount = slug => Object.values(trackedMovies()[slug]?.episodes || {}).filter(entry => entry.watched).length;
  function episodeMovies() {
    const saved = new Map([...data.my_wishlist, ...data.continue_watching_list].map(item => [item.slug, item]));
    return Object.entries(trackedMovies()).filter(([slug]) => watchedCount(slug)).map(([slug, value]) => ({ ...(saved.get(slug) || {}), ...(catalog.get(slug) || {}), slug, title: catalog.get(slug)?.title || saved.get(slug)?.title || slug, updatedAt: Math.max(0, ...Object.values(value.episodes).map(entry => entry.updatedAt)) }));
  }
  function clearEpisodeMarks(next, slugs) {
    for (const slug of slugs) for (const entry of Object.values(next.episode_tracker_v1?.movies[slug]?.episodes || {})) if (entry.watched) {
      entry.watched = false; entry.updatedAt = Math.max(Date.now(), entry.updatedAt + 1);
    }
  }
  function journalMovies(status) {
    const saved = new Map([...data.my_wishlist, ...data.continue_watching_list].filter(item => item.slug).map(item => [item.slug, item]));
    return Object.entries(journalEntries()).filter(([, value]) => status ? value.status === status : value.status || value.rating).map(([slug, value]) => ({ ...(saved.get(slug) || {}), ...(catalog.get(slug) || {}), slug, title: catalog.get(slug)?.title || saved.get(slug)?.title || slug, updatedAt: value.updatedAt }));
  }
  function lists(name = tab) {
    if (name === "favorites") return data.my_wishlist;
    if (name === "completed") return journalMovies("completed");
    if (name === "journal") return journalMovies();
    if (name === "episodes") return episodeMovies();
    const merge = items => [...new Map(items.map(item => [P.key(item), item])).values()];
    if (name === "planned") return merge([...data.my_wishlist.filter(item => !statusOf(item) || statusOf(item) === "planned"), ...journalMovies("planned")]);
    const progress = data.continue_watching_list.filter(item => !P.finished(item) && !["completed", "paused", "planned"].includes(statusOf(item)));
    const progressSlugs = new Set(progress.map(item => item.slug));
    return [...progress, ...journalMovies("watching").filter(item => !progressSlugs.has(item.slug))];
  }
  function anchor(label, href, className = "") { const node = document.createElement("a"); node.textContent = label; node.href = href; node.className = className; return node; }
  function detailsHref(item) { return "detail.html?" + new URLSearchParams({ slug: item.slug || "", title: item.title || "" }); }
  function watchHref(item) {
    const params = new URLSearchParams({ title: item.title || "", slug: item.slug || "", ep: item.episode || 1, episodes: item.totalEpisodes || 1, server: item.server || 0 });
    if (["kkphim", "nguonc", "auto"].includes(item.source)) params.set("data_source", item.source);
    if (item.currentTime > 5) params.set("resume", Math.floor(item.currentTime));
    if (item.episodeName) params.set("target_episode", item.episodeName);
    return "watch.html?" + params;
  }
  function card(item) {
    const meta = catalog.get(item.slug) || {}, watching = tab === "watching" && !!item.episode;
    const article = document.createElement("article"); article.className = "library-card"; article.dataset.slug = item.slug || "";
    if (selecting && item.slug) {
      const label = document.createElement('label'); label.className = 'library-select';
      const box = document.createElement('input'); box.type = 'checkbox'; box.className = 'library-select-box'; box.checked = selected.has(item.slug); box.setAttribute('aria-label', 'Chọn phim: ' + item.title);
      box.addEventListener('change', () => { box.checked ? selected.add(item.slug) : selected.delete(item.slug); article.classList.toggle('is-selected', box.checked); updateBulk(); });
      const text = document.createElement('span'); text.textContent = 'Chọn phim'; label.append(box, text); article.append(label); article.classList.toggle('is-selected', box.checked);
    }
    const poster = anchor("", watching ? watchHref(item) : detailsHref(item), "poster-link"); poster.setAttribute("aria-label", (watching ? "Xem tiếp " : "Thông tin ") + item.title);
    const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
    SiteTools.setPoster(img,item,meta);poster.append(img);
    if (watching) { const badge = document.createElement("span"); badge.className = "resume-badge"; badge.textContent = `${episodeLabel(item)} · ${time(item.currentTime)}`; poster.append(badge); }
    const title = document.createElement("h3"); title.append(anchor(item.title, detailsHref(item)));
    const note = document.createElement("p"); note.className = "card-meta";
    const status = statusOf(item), date = Number(tab === "favorites" ? item.addedAt : journalEntries()[item.slug]?.updatedAt || item.updatedAt || item.addedAt);
    const context = status ? J.statusLabel(status) : watching ? "Tiến độ đã lưu" : tab === "favorites" ? "Yêu thích" : tab === "planned" ? "Muốn xem" : "Chưa chọn trạng thái";
    note.textContent = [meta.year || item.year, context, date ? new Date(date).toLocaleDateString("vi-VN") : ""].filter(Boolean).join(" · ");
    article.append(poster, title, note);
    const marked = watchedCount(item.slug);
    if (marked) { const summary = document.createElement('p'); summary.className = 'library-episode-count'; summary.textContent = `✓ Đã đánh dấu ${marked} tập`; summary.append(anchor('Theo dõi tập →', detailsHref(item) + '#fd-episodes-heading')); article.append(summary); }
    if (watching) { const track = document.createElement("div"), fill = document.createElement("span"); track.className = "progress-track"; track.setAttribute("aria-label", `Đã xem ${Math.round(item.progress)}%`); fill.style.width = item.progress + "%"; track.append(fill); article.append(track); }
    const actions = document.createElement("div"); actions.className = "card-actions"; actions.append(anchor(watching ? "▶ Xem tiếp" : "Xem thông tin →", watching ? watchHref(item) : detailsHref(item)));
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = tab === "episodes" ? "Bỏ đánh dấu tập" : tab === "favorites" ? "Bỏ lưu" : tab === "journal" ? "Bỏ nhật ký" : watching ? "Xóa tiến độ" : "Bỏ trạng thái"; remove.setAttribute("aria-label", `${remove.textContent}: ${item.title}`);
    remove.addEventListener("click", () => {
      if (tab === "episodes") {
        if (!confirm(`Bỏ các dấu tập đã xem của “${item.title}”? Vị trí phát, nhật ký và danh sách riêng vẫn được giữ.`)) return;
        load(); const next = P.normalize(data); clearEpisodeMarks(next, [item.slug]); persist(next); return;
      }
      if (watching && !confirm(`Xóa tiến độ xem “${item.title}”, gồm vị trí các tập đã lưu?`)) return;
      if (tab === "journal" && !confirm(`Bỏ trạng thái và điểm đánh giá riêng của “${item.title}”? Tiến độ xem vẫn được giữ.`)) return;
      // Re-read before each mutation so a different tab's latest changes survive.
      load(); const next = P.normalize(data), id = P.key(item);
      if (tab === "favorites") next.my_wishlist = next.my_wishlist.filter(value => P.key(value) !== id);
      else if (watching) { next.continue_watching_list = next.continue_watching_list.filter(value => P.key(value) !== id); delete next.episode_positions[id]; }
      if (tab !== "favorites" && item.slug) {
        next.movie_journal_v1 = J.normalize(next.movie_journal_v1);
        const old = next.movie_journal_v1.entries[item.slug] || { rating: 0, updatedAt: 0 };
        next.movie_journal_v1.entries[item.slug] = { status: "", rating: tab === "journal" ? 0 : old.rating, updatedAt: Math.max(Date.now(), old.updatedAt + 1) };
        if (tab === "planned") next.my_wishlist = next.my_wishlist.filter(value => P.key(value) !== id);
      }
      persist(next);
    });
    actions.append(remove); article.append(actions);
    if (item.slug) { const controls = document.createElement("div"); controls.className = "library-journal"; article.append(controls); widgetCleanups.push(JournalControls.mount(item, controls, { compact: true })); }
    return article;
  }
  function filteredRows() {
    const query = fold($("library-search").value.trim()), status = $("library-status-filter").value;
    return lists().filter(item => fold(item.title).includes(query) && (!status || (status === "unmarked" ? !statusOf(item) : statusOf(item) === status)));
  }
  function resetSelection() { selected.clear(); }
  function readSortPreference() {
    try { return LibraryBulk.preferences(JSON.parse(storage().getItem(LibraryBulk.PREFS_KEY))).sorts[tab] || 'recent'; }
    catch (_) { return 'recent'; }
  }
  function saveSortPreference() {
    try { const view = LibraryBulk.preferences(JSON.parse(storage().getItem(LibraryBulk.PREFS_KEY))); view.sorts[tab] = $('library-sort').value; storage().setItem(LibraryBulk.PREFS_KEY, JSON.stringify(view)); }
    catch (_) { /* Optional view preference must never prevent a library operation. */ }
  }
  function updateBulk() {
    $('library-bulk').hidden = !selecting;
    $('selection-toggle').setAttribute('aria-pressed', String(selecting));
    $('selection-toggle').textContent = selecting ? 'Xong lựa chọn' : 'Chọn nhiều phim';
    $('selection-count').textContent = selected.size + ' phim được chọn';
    $('select-visible').textContent = 'Chọn ' + visibleSlugs.length + ' phim đang hiển thị';
    $('select-visible').disabled = !visibleSlugs.length;
    for (const id of ['selection-clear','bulk-status-apply','bulk-list-apply','bulk-favorites-remove','bulk-progress-clear']) $(id).disabled = !selected.size || (id === 'bulk-list-apply' && !$('bulk-list').value);
    $('bulk-favorites-remove').hidden = tab !== 'favorites';
    const choice = $('bulk-list').value;
    $('bulk-list').replaceChildren(new Option('Chọn danh sách riêng…',''), ...PersonalLists.active(data.movie_lists_v1).map(list => new Option(list.name,list.id)));
    if ([...$('bulk-list').options].some(option => option.value === choice)) $('bulk-list').value = choice;
    $('bulk-list-apply').disabled = !selected.size || !$('bulk-list').value;
  }
  function applyBulk(action) {
    // Read again immediately before planning; never write a partial/corrupt backup.
    load();
    if (storageWarnings.length) { message('Dữ liệu đang có lỗi đọc. Chưa ghi thay đổi; hãy kiểm tra hoặc khôi phục bản sao lưu trước.'); return; }
    const allowed = filteredRows().map(item => item.slug);
    const valid = LibraryBulk.selection([...selected], allowed);
    if (!valid.length) { resetSelection(); render(); message('Lựa chọn đã thay đổi ở lần cập nhật khác. Hãy chọn lại phim.'); return; }
    if (action.type === 'favorites' && !confirm(`Bỏ ${valid.length} phim đã chọn khỏi yêu thích? Vị trí xem, đánh giá và danh sách riêng vẫn được giữ.`)) return;
    if (action.type === 'progress' && !confirm(`Xóa vị trí phát đã lưu của ${valid.length} phim đã chọn? Dấu tập đã xem, trạng thái và đánh giá vẫn được giữ.`)) return;
    try {
      const result = LibraryBulk.plan(data, valid, allowed, action);
      if (persist(result.next)) { resetSelection(); render(); message(action.type === 'list' ? `Đã thêm ${result.changed} phim vào danh sách riêng; bỏ qua phim đã có.` : `Đã áp dụng cho ${result.changed} phim. Các dữ liệu cá nhân khác được giữ nguyên.`); }
    } catch (error) { message(error.message); }
  }
  function render() {
    $("favorites-count").textContent = data.my_wishlist.length;
    $("watching-count").textContent = lists("watching").length;
    $("planned-count").textContent = lists("planned").length;
    $("completed-count").textContent = lists("completed").length;
    $("journal-count").textContent = lists("journal").length;
    $("episodes-count").textContent = lists("episodes").length;
    for (const name of TABS) $(name + "-tab").setAttribute("aria-pressed", String(tab === name));
    const all = lists(), query = fold($("library-search").value.trim());
    const status = $("library-status-filter").value;
    const rows = filteredRows();
    const currentSlugs = new Set(rows.map(item => item.slug)); selected = new Set([...selected].filter(slug => currentSlugs.has(slug)));
    const sort = $("library-sort").value;
    rows.sort(sort === "title" ? (a, b) => a.title.localeCompare(b.title, "vi") : sort === "rating" ? (a, b) => (journalEntries()[b.slug]?.rating || 0) - (journalEntries()[a.slug]?.rating || 0) : sort === "year" ? (a, b) => Number(catalog.get(b.slug)?.year || 0) - Number(catalog.get(a.slug)?.year || 0) : (a, b) => (journalEntries()[b.slug]?.updatedAt || b.updatedAt || b.addedAt || 0) - (journalEntries()[a.slug]?.updatedAt || a.updatedAt || a.addedAt || 0));
    const visible = rows.slice(0, visibleLimit);
    visibleSlugs = [...new Set(visible.map(item => item.slug).filter(Boolean))];
    widgetCleanups.forEach(cleanup => cleanup()); widgetCleanups = [];
    $("library-grid").replaceChildren(...visible.map(card));
    $("library-more").hidden = visible.length >= rows.length;
    $("library-load-more").textContent = `Xem thêm ${Math.min(PAGE_SIZE, rows.length - visible.length)} phim`;
    $("result-count").textContent = `${rows.length}${query || status ? " / " + all.length : ""} phim` + (visible.length < rows.length ? ` · Đang hiện ${visible.length}` : "");
    $("clear-list").disabled = all.length === 0;
    $("library-empty").hidden = rows.length !== 0;
    $("empty-title").textContent = query || status ? "Chưa tìm thấy phim phù hợp" : tab === "completed" ? "Những bộ phim bạn đã xem" : tab === "watching" ? "Chưa có tập nào đang xem dở" : "Lưu bộ phim bạn muốn xem";
    $("empty-description").textContent = query || status ? "Thử từ khóa khác hoặc đổi bộ lọc trạng thái." : tab === "favorites" ? "Bấm biểu tượng trái tim trên phim để thêm vào thư viện." : tab === "completed" ? "Chọn trạng thái “Đã xem” trên trang phim. Bạn có thể lưu điểm đánh giá riêng từ 1 đến 5 sao." : tab === "planned" ? "Chọn “Muốn xem” trên trang phim hoặc thêm vào yêu thích. Các phim đã chuyển sang trạng thái khác sẽ rời danh sách này." : "Tiến độ và phim được đánh dấu “Đang xem” xuất hiện tại đây. Đổi trạng thái không xóa vị trí tập đã lưu.";
    const entries = Object.values(journalEntries());
    $("journal-completed-total").textContent = entries.filter(value => value.status === "completed").length;
    $("journal-rated-total").textContent = entries.filter(value => value.rating > 0).length;
    $("journal-paused-total").textContent = entries.filter(value => value.status === "paused").length;
    $("episode-watched-total").textContent = Object.keys(trackedMovies()).reduce((count, slug) => count + watchedCount(slug), 0);
    if (tab === 'episodes' && !query && !status) { $("empty-title").textContent = 'Từng tập phim, từng bước theo dõi'; $("empty-description").textContent = 'Đánh dấu tập đã xem tại trang phim hoặc trình phát. Dấu tập đã xem được giữ riêng với vị trí phát và trạng thái cả bộ.'; }
    updatePreview();
    updateBulk();
  }
  const countText = value => { const c = P.counts(value), journal = Object.values(value.movie_journal_v1?.entries || {}), marks = Object.values(value.episode_tracker_v1?.movies || {}).reduce((total,movie) => total + Object.values(movie.episodes).filter(entry => entry.watched).length, 0), lists = PersonalLists.active(value.movie_lists_v1).length, notes = Object.values(value.movie_notes_v1?.movies || {}), written = notes.filter(movie=>movie.note.text.trim()).length, scenes = notes.reduce((total,movie)=>total+Object.values(movie.bookmarks).filter(bookmark=>!bookmark.deleted).length,0); return `${c.favorites} phim yêu thích · ${c.watching} mục xem dở · ${c.positions} vị trí tập · ${c.reports} báo lỗi · ${Object.keys(value.player_intro_ranges_v1 || {}).length} mốc mở đầu · ${journal.filter(item => item.status).length} trạng thái phim · ${journal.filter(item => item.rating).length} đánh giá riêng · ${marks} tập đã đánh dấu · ${lists} danh sách riêng · ${written} ghi chú · ${scenes} mốc cảnh`; };
  function updatePreview() {
    $("import-preview").hidden = !incoming;
    if (!incoming) return;
    $("import-counts").textContent = "Trong bản sao: " + countText(incoming);
    $("import-result").textContent = "Sau khôi phục: " + countText($("import-mode").value === "replace" ? incoming : P.merge(data, incoming));
  }
  for (const name of TABS) $(name + "-tab").addEventListener("click", () => { resetSelection(); tab = name; visibleLimit = PAGE_SIZE; $("library-status-filter").value = ""; $('library-sort').value = readSortPreference(); history.replaceState(null, "", "library.html" + (tab !== "favorites" ? "?tab=" + tab : "")); render(); });
  $("library-search").addEventListener("input", () => { resetSelection(); visibleLimit = PAGE_SIZE; render(); });
  $("library-sort").addEventListener("change", () => { saveSortPreference(); resetSelection(); visibleLimit = PAGE_SIZE; render(); });
  $("library-status-filter").addEventListener("change", () => { resetSelection(); visibleLimit = PAGE_SIZE; render(); });
  $('selection-toggle').addEventListener('click', () => { selecting = !selecting; resetSelection(); render(); });
  $('selection-clear').addEventListener('click', () => { resetSelection(); render(); });
  $('select-visible').addEventListener('click', () => { visibleSlugs.forEach(slug => selected.add(slug)); render(); });
  $('bulk-list').addEventListener('change', updateBulk);
  $('bulk-status-apply').addEventListener('click', () => applyBulk({type:'status',status:$('bulk-status').value}));
  $('bulk-list-apply').addEventListener('click', () => applyBulk({type:'list',id:$('bulk-list').value}));
  $('bulk-favorites-remove').addEventListener('click', () => applyBulk({type:'favorites'}));
  $('bulk-progress-clear').addEventListener('click', () => applyBulk({type:'progress'}));
  $("library-load-more").addEventListener("click", () => {
    visibleLimit += PAGE_SIZE;
    // Keep keyboard focus on the first newly revealed poster when the grid grows.
    const previousCount = $("library-grid").children.length;
    render(); $("library-grid").children[previousCount]?.querySelector("a")?.focus();
  });
  $("clear-list").addEventListener("click", () => {
    if (tab === 'episodes') {
      if (!confirm('Bỏ toàn bộ dấu tập đã xem? Vị trí phát, nhật ký và danh sách riêng vẫn được giữ. Nên tải bản sao trước khi xóa.')) return;
      load(); const next = P.normalize(data); clearEpisodeMarks(next, Object.keys(trackedMovies())); persist(next); return;
    }
    if (!confirm(tab === "favorites" ? "Xóa toàn bộ phim yêu thích trên thiết bị này? Nên tải bản sao lưu trước khi xóa." : tab === "watching" ? "Xóa toàn bộ danh sách đang xem và vị trí từng tập trên thiết bị này? Nên tải bản sao lưu trước khi xóa." : tab === "journal" ? "Bỏ toàn bộ trạng thái và điểm đánh giá riêng? Yêu thích và vị trí đã xem vẫn được giữ. Nên tải bản sao lưu trước khi xóa." : "Bỏ toàn bộ phim trong danh sách này? Điểm đánh giá riêng và vị trí đã xem vẫn được giữ. Nên tải bản sao lưu trước khi xóa.")) return;
    load(); const next = P.normalize(data), removed = lists();
    if (tab === "favorites") next.my_wishlist = [];
    if (tab === "planned") { const ids = new Set(removed.map(P.key)); next.my_wishlist = next.my_wishlist.filter(item => !ids.has(P.key(item))); }
    if (tab === "watching") { next.continue_watching_list = []; next.episode_positions = {}; }
    if (tab !== "favorites") {
      next.movie_journal_v1 = J.normalize(next.movie_journal_v1);
      for (const item of removed) if (item.slug) {
        const old = next.movie_journal_v1.entries[item.slug] || { rating: 0, updatedAt: 0 };
        next.movie_journal_v1.entries[item.slug] = { status: "", rating: tab === "journal" ? 0 : old.rating, updatedAt: Math.max(Date.now(), old.updatedAt + 1) };
      }
    }
    persist(next);
  });
  $("export-personal").addEventListener("click", () => {
    load();
    const url = URL.createObjectURL(new Blob([JSON.stringify(P.backup(data), null, 2)], { type: "application/json" }));
    const link = anchor("", url); link.download = `lauphim-ca-nhan-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    message(storageWarnings.length ? "Đã xuất phần dữ liệu đọc được. Một số dữ liệu cũ bị lỗi hoặc bị chặn nên bản sao này chưa đầy đủ; dữ liệu gốc vẫn được giữ nguyên." : "Đã tạo bản sao lưu. Giữ tệp JSON để khôi phục hoặc chuyển sang trình duyệt khác.");
  });
  $("import-personal").addEventListener("change", async event => {
    const revision = ++importRevision;
    incoming = null; updatePreview(); const file = event.target.files[0];
    if (!file) { updatePreview(); return; }
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("Chọn tệp JSON tối đa 8 MB.");
      const raw = await file.text();
      if (revision !== importRevision) return;
      incoming = P.parseBackup(raw); load(); message("Đã đọc tệp. Kiểm tra số lượng và cách khôi phục trước khi xác nhận.");
    } catch (error) { if (revision !== importRevision) return; message(error.message); }
    updatePreview();
  });
  $("import-mode").addEventListener("change", () => { load(); updatePreview(); });
  $("cancel-import").addEventListener("click", () => { ++importRevision; incoming = null; $("import-personal").value = ""; updatePreview(); message("Đã hủy, dữ liệu cá nhân chưa thay đổi."); });
  $("apply-import").addEventListener("click", () => {
    if (!incoming) return;
    load(); const replace = $("import-mode").value === "replace";
    if (!confirm(replace ? "Thay thế toàn bộ dữ liệu cá nhân, gồm yêu thích, nhật ký, ghi chú, mốc cảnh, danh sách và tiến độ bằng bản sao này? Tải bản sao hiện tại trước nếu cần giữ lại." : "Gộp bản sao vào thư viện? Cùng một phim, tập hoặc ghi chú sẽ giữ bản có thời gian cập nhật mới hơn.")) return;
    if (persist(replace ? incoming : P.merge(data, incoming), replace)) { incoming = null; storageWarnings = []; $("import-personal").value = ""; updatePreview(); message("Đã khôi phục dữ liệu cá nhân trên trình duyệt này."); }
  });
  window.addEventListener("storage", event => { if (!event.key || P.KEYS.includes(event.key)) { load(); render(); } });
  window.addEventListener("episode-tracker-change", () => { load(); render(); });
  window.addEventListener('movie-lists-change', () => { load(); updateBulk(); });
  window.addEventListener("movie-journal-change", event => {
    // Defer until all mounted widgets have seen the event, then preserve keyboard focus.
    const active = document.activeElement, card = active?.closest?.(".library-card"), slug = card?.dataset.slug;
    const star = active?.classList.contains("journal-star") ? [...active.parentElement.children].indexOf(active) : -1;
    queueMicrotask(() => {
      load(); render();
      if (slug && slug === event.detail?.slug) {
        const current = [...$("library-grid").children].find(node => node.dataset.slug === slug);
        (star >= 0 ? current?.querySelectorAll(".journal-star")[star] : current?.querySelector(".journal-controls select"))?.focus();
        if (!current) $(tab + "-tab").focus();
      }
      if (!storageWarnings.length) message("Đã cập nhật nhật ký phim. Trạng thái và đánh giá chỉ lưu trên trình duyệt này.");
    });
  });
  window.addEventListener("pageshow", event => { if (event.persisted) { load(); render(); } });
  const initialTab = new URLSearchParams(location.search).get("tab");
  tab = TABS.includes(initialTab) ? initialTab : "favorites";
  $('library-sort').value = readSortPreference();
  $('library-sort').title = 'Tự nhớ cách sắp xếp cho từng mục trên trình duyệt này';
  load(); render();
  fetch("data/catalog-index.json", { cache: "no-cache" }).then(response => { if (!response.ok) throw new Error("catalog"); return response.json(); }).then(async json => { let rows = Array.isArray(json) ? json : CatalogFormat.decode(json); if (typeof PublishedEpisodes !== 'undefined') rows = PublishedEpisodes.overlay(rows, await PublishedEpisodes.load()); catalog = new Map(rows.map(movie => [movie.slug, movie])); render(); }).catch(() => { /* Saved titles/posters remain usable even when the catalog is unavailable. */ });
})();
