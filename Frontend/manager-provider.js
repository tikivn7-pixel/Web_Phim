(function () {
  "use strict";
  const $ = id => document.getElementById(id), core = window.CatalogProvider;
  let getMovies = () => [], openDraft = () => false, openExisting = () => false, current = null, busy = false;
  function tell(message, error = false) {
    $("provider-status").textContent = message;
    $("provider-status").classList.toggle("error", error);
  }
  function duplicate() { return current && core.findExisting(getMovies(), current.movie.slug); }
  function draw() {
    const existing = duplicate();
    $("provider-load-editor").hidden = Boolean(existing);
    $("provider-open-existing").hidden = !existing;
    $("provider-duplicate").textContent = existing ? `Phim đã có trong kho: ${existing.title}. Mở phim hiện có để chỉnh sửa; thông tin nguồn không tự ghi đè.` : "Chưa thêm vào bản nháp. Kiểm tra trước khi chuyển sang biểu mẫu.";
  }
  function preview(result) {
    current = result;
    const movie = result.movie, img = $("provider-poster");
    img.onerror = () => { img.onerror = null; img.src = "Img/poster-placeholder.svg"; };
    img.src = movie.poster || "Img/poster-placeholder.svg";
    $("provider-title").textContent = movie.title;
    $("provider-meta").textContent = [movie.year, movie.episodes ? movie.episodes + " tập" : "Chưa rõ số tập", movie.genres].filter(Boolean).join(" · ");
    $("provider-countries").textContent = "Quốc gia nguồn: " + (movie.sourceCountries.join(", ") || "Chưa có");
    $("provider-description").textContent = movie.desc.slice(0, 500) || "Chưa có mô tả.";
    $("provider-source").href = result.sourceUrl;
    $("provider-warnings").replaceChildren();
    result.warnings.forEach(message => { const item = document.createElement("li"); item.textContent = message; $("provider-warnings").append(item); });
    draw(); $("provider-result").hidden = false;
  }
  function init(options) {
    getMovies = options.getMovies; openDraft = options.openDraft; openExisting = options.openExisting;
    $("provider-form").onsubmit = async event => {
      event.preventDefault(); if (busy) return;
      busy = true; current = null; $("provider-result").hidden = true; $("provider-fetch").disabled = true; $("provider-form").setAttribute("aria-busy", "true");
      tell("Đang lấy thông tin phim từ KKPhim...");
      try { preview(await core.fetchMovie($("provider-input").value)); tell("Đã lấy thông tin. Kiểm tra tên, quốc gia, số tập và ảnh trước khi thêm."); }
      catch (error) { tell(error.message, true); }
      finally { busy = false; $("provider-fetch").disabled = false; $("provider-form").setAttribute("aria-busy", "false"); }
    };
    $("provider-load-editor").onclick = () => {
      if (!current) return;
      if (duplicate()) { draw(); tell("Phim vừa có trong bản nháp. Mở phim hiện có để tránh tạo trùng.", true); return; }
      if (openDraft(current.movie)) tell("Đã điền vào biểu mẫu. Bạn có thể chỉnh sửa, chọn quốc gia chính và bấm Lưu bản nháp.");
    };
    $("provider-open-existing").onclick = () => { const movie = duplicate(); if (movie) openExisting(movie); else { draw(); tell("Phim không còn trong bản nháp. Có thể thêm lại từ bản xem trước."); } };
  }
  window.ManagerProvider = { init };
})();
