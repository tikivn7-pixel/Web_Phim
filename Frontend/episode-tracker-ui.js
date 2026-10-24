(function (root) {
  "use strict";
  let sequence = 0;
  function mount(movie, element, options = {}) {
    const T = root.EpisodeTracker;
    if (!T || !element || !movie?.slug) { const noop = () => {}; noop.refresh = noop; return noop; }
    const doc = element.ownerDocument, prefix = "episode-track-" + (++sequence);
    let filter = "all", marking = false, active = true;
    element.replaceChildren(); element.classList.add("episode-tracker");
    const heading = doc.createElement("h3"); heading.textContent = "Theo dõi từng tập";
    const caption = doc.createElement("p"); caption.className = "episode-track-summary"; caption.setAttribute("aria-live", "polite");
    const bar = doc.createElement("progress"); bar.className = "episode-track-progress"; bar.max = 1; bar.value = 0; bar.setAttribute("aria-label", "Số tập bạn đã đánh dấu xem xong");
    const toolbar = doc.createElement("div"); toolbar.className = "episode-track-toolbar";
    const label = doc.createElement("label"); label.htmlFor = prefix + "-filter"; label.textContent = "Hiện tập";
    const select = doc.createElement("select"); select.id = label.htmlFor; select.className = "episode-track-filter";
    for (const [value, text] of [["all", "Tất cả"], ["unwatched", "Chưa xem"], ["watched", "Đã xem"]]) { const option = doc.createElement("option"); option.value = value; option.textContent = text; select.append(option); }
    label.append(select);
    const mode = doc.createElement("label"); mode.className = "episode-track-mode";
    const checkbox = doc.createElement("input"); checkbox.type = "checkbox"; checkbox.className = "episode-track-marking";
    mode.append(checkbox, doc.createTextNode("Chế độ đánh dấu"));
    const next = doc.createElement("button"); next.type = "button"; next.className = "episode-track-next";
    toolbar.append(label, mode, next);
    const actions = doc.createElement("div"); actions.className = "episode-track-actions";
    const mark = doc.createElement("button"); mark.type = "button"; mark.className = "episode-track-mark-all";
    const unmark = doc.createElement("button"); unmark.type = "button"; unmark.className = "episode-track-unmark-all";
    actions.append(mark, unmark);
    const note = doc.createElement("p"); note.className = "episode-track-note"; note.textContent = "Dấu đã xem dùng chung cho các nguồn có cùng tên tập. Vị trí phát và trạng thái cả phim được lưu riêng.";
    const status = doc.createElement("p"); status.className = "episode-track-feedback"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    element.append(heading, caption, bar, toolbar, actions, note, status);
    function entries() {
      let rows; try { rows = options.getEntries?.(); } catch (_) { return []; }
      if (!Array.isArray(rows)) return [];
      const seen = new Set();
      return rows.slice(0, 10000).filter(entry => { const id = T.canonical(entry?.name); if (!id || seen.has(id)) return false; seen.add(id); return true; });
    }
    function snapshot() {
      const data = T.read(), saved = Object.hasOwn(data.movies, movie.slug) ? data.movies[movie.slug].episodes : {};
      const isWatched = entry => !!saved[T.canonical(entry.name)]?.watched;
      const rows = entries(), filtered = rows.filter(entry => filter === "all" || isWatched(entry) === (filter === "watched"));
      return { rows, filtered, isWatched };
    }
    function refresh(state = {}) {
      if (!active) return;
      if (["all", "watched", "unwatched"].includes(state.filter)) filter = state.filter;
      const { rows, filtered, isWatched } = snapshot(), count = rows.filter(isWatched).length;
      caption.textContent = count.toLocaleString("vi-VN") + "/" + rows.length.toLocaleString("vi-VN") + " tập đã xem";
      bar.max = Math.max(1, rows.length); bar.value = count;
      bar.setAttribute("aria-valuetext", caption.textContent);
      const first = rows.find(entry => !isWatched(entry));
      next.hidden = typeof options.onPlay !== "function";
      next.disabled = !first;
      next.textContent = first ? "Xem tập chưa xem: " + (/^\d+$/.test(first.name) ? "Tập " + first.name : first.name) : "Đã xem hết danh sách này";
      next.onclick = () => { if (first) options.onPlay?.(first); };
      const newCount = filtered.filter(entry => !isWatched(entry)).length, oldCount = filtered.length - newCount;
      mark.disabled = !newCount; unmark.disabled = !oldCount;
      mark.textContent = "Đánh dấu " + newCount.toLocaleString("vi-VN") + " tập đã xem";
      unmark.textContent = "Bỏ dấu đã xem: " + oldCount.toLocaleString("vi-VN") + " tập";
      element.classList.toggle("episode-track-marking-active", marking);
      select.value = filter; checkbox.checked = marking;
      options.onChange?.({ filter, marking });
    }
    function changeAll(watched) {
      const { filtered, isWatched } = snapshot(), targets = filtered.filter(entry => isWatched(entry) !== watched);
      if (!targets.length) return;
      const message = (watched ? "Đánh dấu đã xem " : "Bỏ dấu đã xem cho ") + targets.length.toLocaleString("vi-VN") + " tập trong bộ lọc hiện tại? Vị trí phát đã lưu sẽ được giữ lại.";
      if (!root.confirm(message)) return;
      try {
        T.batch(movie.slug, targets.map(entry => entry.name), watched);
        status.textContent = (watched ? "Đã đánh dấu " : "Đã bỏ dấu ") + targets.length.toLocaleString("vi-VN") + " tập.";
      } catch (error) { status.textContent = error.message; }
    }
    select.addEventListener("change", () => { filter = select.value; refresh(); });
    checkbox.addEventListener("change", () => { marking = checkbox.checked; refresh(); });
    mark.addEventListener("click", () => changeAll(true)); unmark.addEventListener("click", () => changeAll(false));
    const onTracker = event => { if (!event.detail?.slug || event.detail.slug === movie.slug) refresh(); };
    const onStorage = event => { if (!event.key || event.key === T.KEY) refresh(); };
    root.addEventListener("episode-tracker-change", onTracker); root.addEventListener("storage", onStorage);
    refresh();
    const cleanup = () => { active = false; root.removeEventListener("episode-tracker-change", onTracker); root.removeEventListener("storage", onStorage); };
    cleanup.refresh = refresh;
    cleanup.setFilter = filter => refresh({filter});
    return cleanup;
  }
  root.EpisodeTrackerUI = { mount };
})(globalThis);
