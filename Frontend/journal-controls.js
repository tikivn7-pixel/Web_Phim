(function (root) {
  "use strict";
  let sequence = 0;
  function mount(movie, element, options = {}) {
    const J = root.MovieJournal;
    if (!J || !element || !movie?.slug) return () => {};
    element.replaceChildren(); element.classList.add("journal-controls");
    element.classList.toggle("journal-compact", !!options.compact);
    const doc = element.ownerDocument, id = "journal-status-" + (++sequence);
    const label = doc.createElement("label"); label.htmlFor = id; label.textContent = options.compact ? "Trạng thái" : "Theo dõi bộ phim";
    const select = doc.createElement("select"); select.id = id; select.setAttribute("aria-label", "Trạng thái xem: " + movie.title);
    for (const status of ["", ...J.STATUSES]) { const option = doc.createElement("option"); option.value = status; option.textContent = J.statusLabel(status); select.append(option); }
    label.append(select);
    const ratings = doc.createElement("div"); ratings.className = "journal-rating"; ratings.setAttribute("role", "group"); ratings.setAttribute("aria-label", "Đánh giá riêng của bạn cho " + movie.title);
    const caption = doc.createElement("span"); caption.className = "journal-caption"; caption.textContent = "Bạn đánh giá";
    const stars = [], buttons = doc.createElement("div"); buttons.className = "journal-stars";
    const hint = doc.createElement("p"); hint.className = "journal-feedback"; hint.setAttribute("role", "status"); hint.setAttribute("aria-live", "polite");
    const clear = doc.createElement("button"); clear.type = "button"; clear.className = "journal-clear"; clear.textContent = "Xóa điểm";
    function update() {
      const entry = J.get(movie.slug) || { status: "", rating: 0 };
      select.value = entry.status;
      stars.forEach((button, index) => { button.classList.toggle("is-filled", index < entry.rating); button.setAttribute("aria-pressed", String(index + 1 === entry.rating)); });
      clear.disabled = !entry.rating; ratings.dataset.rating = String(entry.rating);
    }
    function save(patch) {
      try {
        const entry = J.set(movie.slug, patch); update();
        hint.textContent = Object.hasOwn(patch, "rating") ? (entry.rating ? `Đã lưu ${entry.rating}/5 sao — chỉ bạn thấy.` : "Đã xóa điểm đánh giá.") : (entry.status ? "Đã chuyển sang “" + J.statusLabel(entry.status) + "”." : "Đã bỏ trạng thái xem.");
        options.onChange?.(entry);
      } catch (error) { hint.textContent = error.message; update(); }
    }
    for (let rating = 1; rating <= 5; rating++) {
      const button = doc.createElement("button"); button.type = "button"; button.className = "journal-star"; button.textContent = "★";
      button.setAttribute("aria-label", `${rating} trên 5 sao`); button.title = `${rating}/5 sao`;
      button.addEventListener("click", () => save({ rating })); stars.push(button); buttons.append(button);
    }
    clear.addEventListener("click", () => save({ rating: 0 })); select.addEventListener("change", () => save({ status: select.value }));
    ratings.append(caption, buttons, clear); element.append(label, ratings, hint);
    const onStorage = event => { if (!event.key || event.key === J.KEY) update(); };
    const onChange = event => { if (event.detail?.slug === movie.slug) update(); };
    root.addEventListener("storage", onStorage); root.addEventListener("movie-journal-change", onChange); update();
    return () => { root.removeEventListener("storage", onStorage); root.removeEventListener("movie-journal-change", onChange); };
  }
  root.JournalControls = { mount };
})(globalThis);
