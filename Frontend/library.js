(function () {
  "use strict";
  const P = PersonalData, $ = id => document.getElementById(id);
  const PAGE_SIZE = 60;
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
  const activeKey = () => tab === "favorites" ? "my_wishlist" : "continue_watching_list";
  function lists() { return tab === "favorites" ? data.my_wishlist : data.continue_watching_list.filter(item => !P.finished(item)); }
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
    const meta = catalog.get(item.slug) || {}, watching = tab === "watching";
    const article = document.createElement("article"); article.className = "library-card"; article.dataset.slug = item.slug || "";
    const poster = anchor("", watching ? watchHref(item) : detailsHref(item), "poster-link"); poster.setAttribute("aria-label", (watching ? "Xem tiếp " : "Thông tin ") + item.title);
    const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer";
    SiteTools.setPoster(img,item,meta);poster.append(img);
    if (watching) { const badge = document.createElement("span"); badge.className = "resume-badge"; badge.textContent = `${episodeLabel(item)} · ${time(item.currentTime)}`; poster.append(badge); }
    const title = document.createElement("h3"); title.append(anchor(item.title, detailsHref(item)));
    const note = document.createElement("p"); note.className = "card-meta";
    const date = Number(watching ? item.updatedAt : item.addedAt);
    note.textContent = [meta.year, date ? new Date(date).toLocaleDateString("vi-VN") : ""].filter(Boolean).join(" · ") || (watching ? "Tiến độ lưu trên thiết bị" : "Đã lưu vào yêu thích");
    article.append(poster, title, note);
    if (watching) { const track = document.createElement("div"), fill = document.createElement("span"); track.className = "progress-track"; track.setAttribute("aria-label", `Đã xem ${Math.round(item.progress)}%`); fill.style.width = item.progress + "%"; track.append(fill); article.append(track); }
    const actions = document.createElement("div"); actions.className = "card-actions"; actions.append(anchor(watching ? "▶ Xem tiếp" : "Xem thông tin →", watching ? watchHref(item) : detailsHref(item)));
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = watching ? "Xóa tiến độ" : "Bỏ lưu"; remove.setAttribute("aria-label", `${remove.textContent}: ${item.title}`);
    remove.addEventListener("click", () => {
      if (watching && !confirm(`Xóa tiến độ xem “${item.title}”, gồm vị trí các tập đã lưu?`)) return;
      // Re-read before each mutation so a different tab's latest changes survive.
      load(); const next = P.normalize(data), id = P.key(item);
      next[activeKey()] = next[activeKey()].filter(value => P.key(value) !== id);
      if (watching) delete next.episode_positions[id];
      persist(next);
    });
    actions.append(remove); article.append(actions); return article;
  }
  function render() {
    $("favorites-count").textContent = data.my_wishlist.length;
    $("watching-count").textContent = data.continue_watching_list.filter(item => !P.finished(item)).length;
    $("favorites-tab").setAttribute("aria-pressed", String(tab === "favorites"));
    $("watching-tab").setAttribute("aria-pressed", String(tab === "watching"));
    const all = lists(), query = fold($("library-search").value.trim());
    const rows = all.filter(item => fold(item.title).includes(query));
    const sort = $("library-sort").value;
    rows.sort(sort === "title" ? (a, b) => a.title.localeCompare(b.title, "vi") : sort === "year" ? (a, b) => Number(catalog.get(b.slug)?.year || 0) - Number(catalog.get(a.slug)?.year || 0) : (a, b) => (b.updatedAt || b.addedAt || 0) - (a.updatedAt || a.addedAt || 0));
    const visible = rows.slice(0, visibleLimit);
    $("library-grid").replaceChildren(...visible.map(card));
    $("library-more").hidden = visible.length >= rows.length;
    $("library-load-more").textContent = `Xem thêm ${Math.min(PAGE_SIZE, rows.length - visible.length)} phim`;
    $("result-count").textContent = (query ? `${rows.length} / ${all.length} phim phù hợp` : `${all.length} phim ${tab === "favorites" ? "đã lưu" : "đang xem dở"}`) + (visible.length < rows.length ? ` · Đang hiện ${visible.length}` : "");
    $("clear-list").disabled = all.length === 0;
    $("library-empty").hidden = rows.length !== 0;
    $("empty-title").textContent = query ? "Chưa tìm thấy phim phù hợp" : tab === "favorites" ? "Lưu bộ phim bạn muốn xem" : "Chưa có tập nào đang xem dở";
    $("empty-description").textContent = query ? "Thử từ khóa khác hoặc xóa nội dung ô tìm kiếm." : tab === "favorites" ? "Bấm biểu tượng trái tim trên phim để thêm vào thư viện." : "Tiến độ xuất hiện ở đây khi nguồn phát hỗ trợ lưu vị trí. Xem xong tập cuối, phim tự rời danh sách.";
    updatePreview();
  }
  const countText = value => { const c = P.counts(value); return `${c.favorites} phim yêu thích · ${c.watching} mục xem dở · ${c.positions} vị trí tập · ${c.reports} báo lỗi · ${Object.keys(value.player_intro_ranges_v1 || {}).length} mốc mở đầu`; };
  function updatePreview() {
    $("import-preview").hidden = !incoming;
    if (!incoming) return;
    $("import-counts").textContent = "Trong bản sao: " + countText(incoming);
    $("import-result").textContent = "Sau khôi phục: " + countText($("import-mode").value === "replace" ? incoming : P.merge(data, incoming));
  }
  for (const name of ["favorites", "watching"]) $(name + "-tab").addEventListener("click", () => { tab = name; visibleLimit = PAGE_SIZE; history.replaceState(null, "", "library.html" + (tab === "watching" ? "?tab=watching" : "")); render(); });
  $("library-search").addEventListener("input", () => { visibleLimit = PAGE_SIZE; render(); });
  $("library-sort").addEventListener("change", () => { visibleLimit = PAGE_SIZE; render(); });
  $("library-load-more").addEventListener("click", () => {
    visibleLimit += PAGE_SIZE;
    // Keep keyboard focus on the first newly revealed poster when the grid grows.
    const previousCount = $("library-grid").children.length;
    render(); $("library-grid").children[previousCount]?.querySelector("a")?.focus();
  });
  $("clear-list").addEventListener("click", () => {
    if (!confirm(tab === "favorites" ? "Xóa toàn bộ phim yêu thích trên thiết bị này? Nên tải bản sao lưu trước khi xóa." : "Xóa toàn bộ danh sách đang xem và vị trí từng tập trên thiết bị này? Nên tải bản sao lưu trước khi xóa.")) return;
    load(); const next = P.normalize(data); next[activeKey()] = [];
    if (tab === "watching") next.episode_positions = {};
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
    if (!confirm(replace ? "Thay thế toàn bộ yêu thích, tiến độ và báo lỗi hiện có bằng bản sao này? Tải bản sao hiện tại trước nếu cần giữ lại." : "Gộp bản sao vào thư viện? Cùng một phim hoặc tập sẽ giữ bản có thời gian cập nhật mới hơn.")) return;
    if (persist(replace ? incoming : P.merge(data, incoming), replace)) { incoming = null; storageWarnings = []; $("import-personal").value = ""; updatePreview(); message("Đã khôi phục dữ liệu cá nhân trên trình duyệt này."); }
  });
  window.addEventListener("storage", event => { if (!event.key || P.KEYS.includes(event.key)) { load(); render(); } });
  window.addEventListener("pageshow", event => { if (event.persisted) { load(); render(); } });
  tab = new URLSearchParams(location.search).get("tab") === "watching" ? "watching" : "favorites";
  load(); render();
  fetch("data/catalog-index.json", { cache: "no-cache" }).then(response => { if (!response.ok) throw new Error("catalog"); return response.json(); }).then(json => { const rows = Array.isArray(json) ? json : CatalogFormat.decode(json); catalog = new Map(rows.map(movie => [movie.slug, movie])); render(); }).catch(() => { /* Saved titles/posters remain usable even when the catalog is unavailable. */ });
})();
