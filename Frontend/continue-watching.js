// ==========================================
// 3. QUẢN LÝ VÀ RENDER "TIẾP TỤC XEM"
// ==========================================

const CONTINUE_WATCHING_KEY = "continue_watching_list";
const EP_POSITIONS_STORAGE_KEY = "episode_positions";

// Xem >= 95% thời lượng thì coi là đã xem xong (khớp với watch.html)
const FINISHED_PERCENT = 95;

// Phim đã xem xong TẬP CUỐI (kiểu Netflix) -> không còn thuộc "Tiếp tục xem".
// Bản ghi cũ thiếu totalEpisodes thì coi như chưa xong để không xóa nhầm.
function isFinishedSeries(item) {
  if (!item) return false;
  const total = Number(item.totalEpisodes);
  const episode = Number(item.episode);
  if (!total || !episode) return false;
  return episode >= total && Number(item.progress) >= FINISHED_PERCENT;
}

function getContinueWatchingList() {
  let list = [];
  try {
    const raw = localStorage.getItem(CONTINUE_WATCHING_KEY);
    list = raw ? JSON.parse(raw) : [];
  } catch (e) {
    list = [];
  }
  if (!Array.isArray(list)) return [];

  // Mỗi phim chỉ giữ 1 bản ghi mới nhất (dọn dữ liệu cũ bị lưu theo từng tập)
  const seen = new Set();
  const cleaned = list
    .slice()
    .sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0))
    .filter((item) => {
      if (!item || (!item.slug && !item.title)) return false;
      const key = item.slug || item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // Dọn luôn các phim đã xem xong tập cuối (dữ liệu lưu từ trước khi có tính năng này)
    .filter((item) => !isFinishedSeries(item));

  if (cleaned.length !== list.length) {
    try { localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(cleaned)); } catch (e) {}
  }
  return cleaned;
}

// Xóa 1 phim khỏi danh sách "Tiếp tục xem" (theo slug hoặc tên phim) và vẽ lại giao diện.
// Xóa luôn vị trí xem dở của các tập để lần sau xem lại từ đầu.
function removeFromContinueWatching(slugOrTitle) {
  if (!slugOrTitle) return;
  const key = String(slugOrTitle);

  try {
    const raw = localStorage.getItem(CONTINUE_WATCHING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) {
      const remaining = list.filter(
        (item) => String(item.slug || item.title || "") !== key,
      );
      localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(remaining));
    }

    const rawPos = localStorage.getItem(EP_POSITIONS_STORAGE_KEY);
    const positions = rawPos ? JSON.parse(rawPos) : {};
    if (positions && typeof positions === "object" && positions[key]) {
      delete positions[key];
      localStorage.setItem(EP_POSITIONS_STORAGE_KEY, JSON.stringify(positions));
    }
  } catch (e) {
    console.error("Không xóa được khỏi Tiếp tục xem:", e);
  }

  renderContinueWatching();
}

function renderContinueWatching() {
  const section = document.getElementById("continue-watching-section");
  const slider = document.getElementById("continue-watching-slider");
  if (!section || !slider) return;

  const list = getContinueWatchingList();

  if (list.length === 0) {
    slider.innerHTML = "";
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  slider.innerHTML = "";

  list.forEach((item) => {
    const movieMeta =
      globalMoviesList.find((m) => item.slug ? m.slug === item.slug : m.title === item.title) || {};
    const posterSrc =
      item.poster || movieMeta.poster || "https://placehold.co/350x500";
    const safeTitle = escapeHtml(item.title);
    const safeDesc = escapeHtml(item.desc || movieMeta.desc || "");

    const card = document.createElement("div");
    card.className = "movie-card";
    card.style.position = "relative";
    card.onclick = () => {
      const params = new URLSearchParams({ title:item.title || "", slug:item.slug || "", ep:item.episode || 1,
        episodes:item.totalEpisodes || 1, server:item.server || 0 });
      if (["kkphim","nguonc","auto"].includes(item.source)) params.set("data_source",item.source);
      if (Number(item.currentTime) > 5) params.set("resume",Math.floor(Number(item.currentTime)));
      if (item.episodeName) params.set("target_episode",item.episodeName);
      window.location.href = "watch.html?" + params;
    };

    card.innerHTML = `
      <img src="${escapeHtml(posterSrc)}" alt="${safeTitle}" loading="lazy" referrerpolicy="no-referrer" onerror="handleMovieImageError(this)" />
      <h4>${safeTitle} - Tập ${item.episode}</h4>
     
      <div style="width: 100%; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; margin-top: 5px; overflow: hidden;">
        <div style="width: ${Math.min(100, Math.max(0, Number(item.progress) || 0))}%; background: #e50914; height: 100%;"></div>
      </div>

      <div class="movie-hover-card">
        <img src="${posterSrc}" alt="${safeTitle}" class="hover-banner" onerror="this.src='https://placehold.co/350x500'" />
        <div class="hover-content">
          <h3 class="hover-title">${safeTitle}</h3>
          <p style="color: #e50914; font-weight: bold; margin-bottom: 5px;">Đang xem: Tập ${item.episode}</p>
          <div class="hover-actions">
            <button class="btn-hover play">
              <i class="fa-solid fa-play"></i> Xem tiếp (${Math.floor(item.progress)}%)
            </button>
          </div>
          <p class="hover-genres">${safeDesc}</p>
        </div>
      </div>
    `;
    const remove = document.createElement("button");
    remove.className = "continue-remove";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Xóa " + item.title + " khỏi Tiếp tục xem");
    remove.onclick = event => { event.stopPropagation(); removeFromContinueWatching(item.slug || item.title); };
    card.appendChild(remove);
    const hint = document.createElement("p");
    hint.className = "continue-time";
    const seconds = Number(item.currentTime) || 0;
    hint.textContent = seconds > 0 ? `Xem tiếp từ ${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2,"0")}` : "Mở lại tập đang xem";
    card.appendChild(hint);
    slider.appendChild(card);
  });
}

// Quay lại trang chủ bằng nút Back (trình duyệt giữ lại trang cũ, không chạy lại
// DOMContentLoaded) -> vẽ lại để phim vừa xem xong biến mất ngay.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) renderContinueWatching();
});
window.addEventListener("storage", event => { if (event.key === CONTINUE_WATCHING_KEY) renderContinueWatching(); });
