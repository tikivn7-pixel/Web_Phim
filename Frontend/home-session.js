(function () {
  "use strict";
  let revision = 0;
  async function refresh() {
    const mount = document.getElementById("session-resume");
    if (!mount) return;
    const token = ++revision;
    const empty = document.getElementById("session-empty");
    const showNotice = text => {
      let status = document.getElementById("session-data-status");
      if (!status && text) {
        status = document.createElement("p"); status.id = "session-data-status";
        status.className = "session-data-status"; status.setAttribute("role", "status"); mount.before(status);
      }
      if (status) { status.textContent = text; status.hidden = !text; }
    };
    const showEmpty = uncertain => {
      empty.querySelector("p").textContent = uncertain ? "Chưa đọc được tiến độ đang lưu." : "Phim đang xem sẽ chờ bạn ở đây.";
      const link = empty.querySelector("a"); link.href = uncertain ? "library.html" : "discover.html";
      link.textContent = uncertain ? "Kiểm tra thư viện ↗" : "Chọn câu chuyện đầu tiên ↗";
    };
    try {
      let catalog = [];
      try { catalog = await loadStaticCatalog(); } catch (_) {}
      if (token !== revision) return;
      // Read after the catalog wait so changes in another tab remain current.
      const loaded = PersonalData.read(localStorage);
      const state = HomeSession.model(loaded.data, catalog);
      const uncertainWatching = loaded.warnings.some(key => ["continue_watching_list", "movie_journal_v1"].includes(key));
      const uncertain = { favorites: loaded.warnings.includes("my_wishlist"), watching: uncertainWatching, lists: loaded.warnings.includes("movie_lists_v1") };
      for (const key of ["favorites", "watching", "lists"]) document.getElementById("session-" + key).textContent = uncertain[key] ? "—" : state[key];
      showNotice(loaded.warnings.length ? "Một phần dữ liệu cá nhân chưa đọc được. Mở Thư viện để kiểm tra." : "");
      showEmpty(uncertainWatching);
      if (uncertainWatching) state.resume = null;
      mount.replaceChildren(); mount.hidden = !state.resume; empty.hidden = !!state.resume;
      if (!state.resume) return;
      const item = state.resume, link = document.createElement("a"); link.href = HomeSession.watchURL(item); link.className = "session-resume-link";
      const image = document.createElement("img"); image.alt = ""; image.loading = "lazy"; SiteTools.setPoster(image, item, item.movie);
      const copy = document.createElement("div"), caption = document.createElement("span"), title = document.createElement("strong"), time = document.createElement("small");
      caption.textContent = "TIẾP TỤC PHIÊN XEM"; title.textContent = item.title;
      const seconds = Math.floor(item.currentTime || 0), name = item.episodeName || String(item.episode || 1);
      time.textContent = (/^\d+$/.test(name) ? "Tập " + name : name) + " · " + Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
      copy.append(caption, title, time); link.append(image, copy);
      const button = document.createElement("a"); button.href = link.href; button.className = "session-watch"; button.textContent = "Tiếp tục xem →"; mount.append(link, button);
    } catch (_) {
      if (token !== revision) return;
      for (const key of ["favorites", "watching", "lists"]) document.getElementById("session-" + key).textContent = "—";
      showNotice("Chưa truy cập được dữ liệu cá nhân trên trình duyệt này.");
      showEmpty(true); empty.hidden = false; mount.replaceChildren(); mount.hidden = true;
    }
  }
  document.addEventListener("DOMContentLoaded", refresh);
  window.addEventListener("pageshow", event => { if (event.persisted) refresh(); });
  window.addEventListener("storage", event => { if (!event.key || PersonalData.KEYS.includes(event.key)) refresh(); });
  for (const event of ["wishlist-changed", "movie-journal-change", "movie-lists-change", "continue-watching-change"]) window.addEventListener(event, refresh);
})();
