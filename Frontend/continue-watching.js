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
  const raw = localStorage.getItem(CONTINUE_WATCHING_KEY);
  let list = [];
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch (e) {
    list = [];
  }
  if (!Array.isArray(list)) return [];

  // Mỗi phim chỉ giữ 1 bản ghi mới nhất (dọn dữ liệu cũ bị lưu theo từng tập)
  const seen = new Set();
  const cleaned = list
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .filter((item) => {
      const key = item.slug || item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // Dọn luôn các phim đã xem xong tập cuối (dữ liệu lưu từ trước khi có tính năng này)
    .filter((item) => !isFinishedSeries(item));

  if (cleaned.length !== list.length) {
    localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(cleaned));
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
      globalMoviesList.find((m) => m.title === item.title) || {};
    const posterSrc =
      item.poster || movieMeta.poster || "https://placehold.co/350x500";
    const safeTitle = escapeHtml(item.title);
    const safeDesc = escapeHtml(item.desc || movieMeta.desc || "");

    const card = document.createElement("div");
    card.className = "movie-card";
    card.style.position = "relative";
    card.onclick = () =>
      playEpisodeDirect(
        item.title,
        item.episode,
        item.totalEpisodes,
        item.slug,
      );

    card.innerHTML = `
      <img src="${posterSrc}" alt="${safeTitle}" onerror="this.src='https://placehold.co/350x500'" />
      <h4>${safeTitle} - Tập ${item.episode}</h4>
     
      <div style="width: 100%; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; margin-top: 5px; overflow: hidden;">
        <div style="width: ${item.progress}%; background: #e50914; height: 100%;"></div>
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
    slider.appendChild(card);
  });
}

// Quay lại trang chủ bằng nút Back (trình duyệt giữ lại trang cũ, không chạy lại
// DOMContentLoaded) -> vẽ lại để phim vừa xem xong biến mất ngay.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) renderContinueWatching();
});
