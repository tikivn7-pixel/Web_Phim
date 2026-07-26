// ==========================================
// 0. CẤU HÌNH & DỮ LIỆU TẬP PHIM / DANH SÁCH PHIM
// ==========================================

// FIX: centralize the API base URL instead of hardcoding
// "http://localhost:5000" in 3 separate places. Change this one
// line for staging/production instead of hunting through the file.
const API_BASE_URL = "http://localhost:5000";

// FIX: dữ liệu tập phim (window.allEpisodesData) và bảng ánh xạ tên phim
// (window.movieKeyMap) giờ được nạp từ file episodes.js riêng (load TRƯỚC
// file này trong index.html: <script src="episodes.js"></script> rồi mới
// <script src="script.js"></script>). Không hardcode link test ở đây nữa.
//
// Nếu quên nạp episodes.js, cảnh báo rõ ràng thay vì lỗi im lặng khiến
// video không phát mà không rõ lý do.
if (!window.allEpisodesData || !window.movieKeyMap) {
  console.error(
    "Không tìm thấy window.allEpisodesData / window.movieKeyMap. " +
      'Hãy chắc chắn đã nạp <script src="episodes.js"></script> TRƯỚC script.js trong index.html.',
  );
}
window.allEpisodesData = window.allEpisodesData || {};
const movieKeyMap = window.movieKeyMap || {};

// FIX: hàm tính TỔNG SỐ TẬP THẬT dựa trên độ dài mảng link trong
// episodes.js, thay vì dùng con số `episodes` gõ tay trong
// globalMoviesList (dễ bị lệch — ví dụ trước đây "Teach You a Lesson"
// ghi 12 tập nhưng episodes.js chỉ có 10 link, khiến nút "Tập 11/12"
// không phát được gì). Nếu phim chưa có trong episodes.js, fallback về
// giá trị `episodes` khai trong globalMoviesList (hoặc 20 nếu không có).
function getTotalEpisodes(movie) {
  if (!movie) return 20;
  const cleanTitle = movie.title ? movie.title.trim().toLowerCase() : "";
  const key = movieKeyMap[cleanTitle];
  if (key && window.allEpisodesData && window.allEpisodesData[key]) {
    return window.allEpisodesData[key].length;
  }
  return movie.episodes || 20;
}

// FIX: đổi poster/banner sang ảnh local trong thư mục Img/ (cùng cấp với
// script.js) thay vì link Wikimedia (chậm, phụ thuộc mạng, có thể đổi/xóa).
// Đồng thời bổ sung 5 phim vốn đã có sẵn trong movieKeyMap và
// allEpisodesData nhưng trước đó bị thiếu trong globalMoviesList nên
// không bao giờ hiện ra ở trang chủ/tìm kiếm.
//
// LƯU Ý: tên file "Chuyện Đời Bác Sĩ Nội Trú.jpg", "Our Beloved Summer.jpg",
// "Teach You a Lesson.jpg", "twinkling watermelon.jpg", "We Are All Trying
// Here.jpg" có dấu cách/dấu tiếng Việt. Nếu bạn thấy ảnh không lên, khả
// năng cao là do lệch chính tả/hoa-thường giữa tên file thật trên đĩa và
// chuỗi dưới đây (Windows không phân biệt hoa/thường nhưng khi deploy lên
// server Linux thì có phân biệt) — hãy đối chiếu lại chính xác tên file.
const IMG_BASE = "Img/";

let globalMoviesList = [
  {
    title: "Twenty Five Twenty One",
    slug: "twenty-five-twenty-one",
    episodes: 16,
    poster: IMG_BASE + "2521.jpg",
    banner: IMG_BASE + "2521.jpg",
    desc: "Câu chuyện tuổi trẻ đầy nhiệt huyết và hoài bão vào năm 1998.",
  },
  {
    title: "Queen of Tears",
    slug: "queen-of-tears",
    episodes: 16,
    poster: IMG_BASE + "QueenOfTears.jpg",
    banner: IMG_BASE + "QueenOfTears.jpg",
    desc: "Cuộc sống hôn nhân sóng gió nhưng đầy cảm xúc của cặp vợ chồng tài phiệt.",
  },
  {
    title: "Mouse",
    slug: "mouse",
    episodes: 20,
    poster: IMG_BASE + "Mouse.jpg",
    banner: IMG_BASE + "Mouse.jpg",
    desc: "Thước phim trinh thám giật gân xoay quanh kẻ sát nhân biến thái.",
  },
  {
    title: "Moving",
    slug: "moving",
    episodes: 20,
    poster: IMG_BASE + "Moving.jpg",
    banner: IMG_BASE + "Moving.jpg",
    desc: "Những siêu anh hùng ẩn giấu thân phận để bảo vệ gia đình.",
  },
  {
    title: "Can This Love Be Translated?",
    slug: "can-this-love-be-translated",
    episodes: 12,
    poster: IMG_BASE + "Can_This_Love_Be_Translated.png",
    banner: IMG_BASE + "Can_This_Love_Be_Translated.png",
    desc: "Câu chuyện về những phiên dịch viên và ranh giới mong manh giữa công việc và tình cảm.",
  },
  {
    title: "My Liberation Notes",
    slug: "my-liberation-notes",
    episodes: 16,
    poster: IMG_BASE + "Nhat_ky_tu_do_cua_toi.jpg",
    banner: IMG_BASE + "Nhat_ky_tu_do_cua_toi.jpg",
    desc: "Ba anh chị em ở ngoại ô Seoul đi tìm sự giải thoát cho chính cuộc đời mình.",
  },
  {
    title: "Resident Playbook",
    slug: "resident-playbook",
    episodes: 12,
    poster: IMG_BASE + "Chuyện Đời Bác Sĩ Nội Trú.jpg",
    banner: IMG_BASE + "Chuyện Đời Bác Sĩ Nội Trú.jpg",
    desc: "Nhật ký hài hước và chân thực của các bác sĩ nội trú tại bệnh viện.",
  },
  {
    title: "Teach You a Lesson",
    slug: "teach-you-a-lesson",
    episodes: 10,
    poster: IMG_BASE + "Teach You a Lesson.jpg",
    banner: IMG_BASE + "Teach You a Lesson.jpg",
    desc: "Hành trình đấu tranh giành lại công bằng đầy kịch tính.",
  },
  {
    title: "The Wonderfools",
    slug: "the-wonderfools",
    episodes: 8,
    poster: IMG_BASE + "wonderfools.jpg",
    banner: IMG_BASE + "wonderfools.jpg",
    desc: "Nhóm bạn với những giấc mơ dang dở cùng nhau vượt qua thử thách cuộc sống.",
  },
  {
    title: "We Are Trying Here",
    slug: "we-are-trying-here",
    episodes: 12,
    poster: IMG_BASE + "We Are All Trying Here.jpg",
    banner: IMG_BASE + "We Are All Trying Here.jpg",
    desc: "Câu chuyện ấm áp về những con người đang cố gắng hết mình mỗi ngày.",
  },
  {
    title: "Our Beloved Summer",
    slug: "our-beloved-summer",
    episodes: 16,
    poster: IMG_BASE + "Our Beloved Summer.jpg",
    banner: IMG_BASE + "Our Beloved Summer.jpg",
    desc: "Tình yêu nhẹ nhàng, sâu lắng qua những thước phim tài liệu thanh xuân.",
  },
  {
    title: "Twinkling Watermelon",
    slug: "twinkling-watermelon",
    episodes: 16,
    poster: IMG_BASE + "twinkling watermelon.jpg",
    banner: IMG_BASE + "twinkling watermelon.jpg",
    desc: "Hành trình xuyên không về quá khứ qua một cửa hàng nhạc cụ kỳ lạ.",
  },
];

// FIX: small helper to escape HTML special characters. Movie titles/desc
// are hardcoded today, but toggleWishlist()/showDetail() build raw
// innerHTML strings from them, and search/wishlist data round-trips
// through localStorage. If any of that text ever contains `<`, `>` or
// `"` (e.g. once you wire in the real API), it would previously break
// the markup or inject HTML. Escaping it here makes that safe.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// FIX: helper specifically for safely embedding a string inside a
// single-quoted JS string literal that itself sits inside an HTML
// onclick="..." attribute. Previously only `'` was escaped, so a
// title containing `"` would break out of the onclick attribute.
function escapeForInlineHandler(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, " ");
}

// ==========================================
// 1. CÁC HÀM XỬ LÝ AUTH, WATCHLIST & FAVORITE
// ==========================================

async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (response.ok) {
      localStorage.setItem("token", data.token);
      alert("Đăng nhập thành công!");
    } else {
      alert(data.message || "Đăng nhập thất bại!");
    }
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
  }
}

function getWishlist() {
  const wishlist = localStorage.getItem("my_wishlist");
  return wishlist ? JSON.parse(wishlist) : [];
}

function toggleWishlist(movie) {
  let wishlist = getWishlist();
  const index = wishlist.findIndex((item) => item.title === movie.title);

  if (index !== -1) {
    wishlist.splice(index, 1);
    alert(`Đã xóa "${movie.title}" khỏi Danh sách của tôi!`);
  } else {
    wishlist.push(movie);
    alert(`Đã thêm "${movie.title}" vào Danh sách của tôi!`);
  }

  localStorage.setItem("my_wishlist", JSON.stringify(wishlist));
  updateWishlistUI();

  const wishlistPage = document.getElementById("page-wishlist");
  if (wishlistPage && wishlistPage.classList.contains("active")) {
    renderWishlistPage();
  }

  toggleFavoriteBackend(movie.title);
}

async function toggleFavoriteBackend(movieId) {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    await fetch(`${API_BASE_URL}/api/watchlist/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ movieId }),
    });
  } catch (err) {
    console.error("Lỗi đồng bộ wishlist backend:", err);
  }
}

function updateWishlistUI() {
  const wishlist = getWishlist();
  const heartBtns = document.querySelectorAll(".movie-card .btn-hover.icon");

  heartBtns.forEach((btn) => {
    const card = btn.closest(".movie-card");
    if (!card) return;
    const titleEl =
      card.querySelector(".hover-title") ||
      card.querySelector("h3") ||
      card.querySelector("h4");
    if (!titleEl) return;

    const title = titleEl.innerText.trim();
    const isFav = wishlist.some((item) => item.title === title);

    const icon = btn.querySelector("i");
    if (icon) {
      if (isFav) {
        icon.className = "fa-solid fa-heart";
        icon.style.color = "#e50914";
      } else {
        icon.className = "fa-regular fa-heart";
        icon.style.color = "";
      }
    }
  });
}

function renderWishlistPage() {
  const container = document.getElementById("wishlist-container");
  if (!container) return;

  const wishlist = getWishlist();
  container.innerHTML = "";

  if (wishlist.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
        <i class="fa-regular fa-heart" style="font-size: 3rem; margin-bottom: 15px;"></i>
        <p>Danh sách của bạn đang trống. Hãy thêm những bộ phim yêu thích vào đây nhé!</p>
      </div>
    `;
    return;
  }

  wishlist.forEach((movie) => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        getTotalEpisodes(movie),
        movie.slug || "",
      );

    const safeTitle = escapeHtml(movie.title);
    const safeDesc = escapeHtml(movie.desc || "");
    const handlerTitle = escapeForInlineHandler(movie.title);
    const handlerDesc = escapeForInlineHandler(movie.desc || "");

    card.innerHTML = `
      <img src="${movie.poster}" alt="${safeTitle}" onerror="this.src='https://placehold.co/350x500'" />
      <h4>${safeTitle}</h4>
      <div class="movie-hover-card">
        <img src="${movie.poster}" alt="${safeTitle}" class="hover-banner" onerror="this.src='https://placehold.co/350x500'" />
        <div class="hover-content">
          <h3 class="hover-title">${safeTitle}</h3>
          <div class="hover-actions">
            <button class="btn-hover play">
              <i class="fa-solid fa-play"></i> Xem ngay
            </button>
            <button
              class="btn-hover icon"
              title="Xóa khỏi danh sách"
              onclick="event.stopPropagation(); toggleWishlist({title: '${handlerTitle}', poster: '${movie.poster}', desc: '${handlerDesc}', episodes: ${getTotalEpisodes(movie)}, slug: '${movie.slug || ""}'})"
            >
              <i class="fa-solid fa-heart" style="color: #e50914;"></i>
            </button>
          </div>
          <p class="hover-genres">${safeDesc}</p>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function saveWatchProgress(movieId, currentTime, duration) {
  const token = localStorage.getItem("token");
  if (!token || !movieId) return;

  fetch(`${API_BASE_URL}/api/history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      movieId: movieId,
      progressSeconds: Math.floor(currentTime),
      durationSeconds: Math.floor(duration || 0),
    }),
  }).catch((err) => console.error("Lỗi lưu tiến trình xem:", err));
}

// ==========================================
// 2. HERO BANNER AUTO SLIDER (STYLE NETFLIX)
// ==========================================

let currentHeroIndex = 0;
let heroInterval = null;

function updateHeroBanner(index) {
  if (!globalMoviesList || globalMoviesList.length === 0) return;

  const movie = globalMoviesList[index % globalMoviesList.length];
  const heroSection = document.getElementById("hero-banner");
  const titleEl = document.getElementById("hero-title");
  const descEl = document.getElementById("hero-desc");
  const playBtn = document.getElementById("hero-play-btn");
  const infoBtn = document.getElementById("hero-info-btn");

  if (!heroSection) return;

  heroSection.style.backgroundImage = `url('${movie.banner || movie.poster}')`;
  if (titleEl) titleEl.innerText = movie.title;
  if (descEl) descEl.innerText = movie.desc;

  if (playBtn) {
    playBtn.onclick = () =>
      playEpisode(movie.title, 1, getTotalEpisodes(movie), movie.slug);
  }
  if (infoBtn) {
    infoBtn.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        getTotalEpisodes(movie),
        movie.slug,
      );
  }

  const dots = document.querySelectorAll(".hero-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
}

function initHeroSlider() {
  const heroSection = document.getElementById("hero-banner");
  if (!heroSection || globalMoviesList.length === 0) return;

  let dotsContainer = heroSection.querySelector(".hero-dots");
  if (!dotsContainer) {
    dotsContainer = document.createElement("div");
    dotsContainer.className = "hero-dots";
    heroSection.appendChild(dotsContainer);
  } else {
    dotsContainer.innerHTML = "";
  }

  const featured = globalMoviesList.slice(0, 4);

  featured.forEach((_, index) => {
    const dot = document.createElement("div");
    dot.className = `hero-dot ${index === 0 ? "active" : ""}`;
    dot.onclick = () => {
      currentHeroIndex = index;
      updateHeroBanner(currentHeroIndex);
      resetHeroTimer();
    };
    dotsContainer.appendChild(dot);
  });

  updateHeroBanner(0);
  startHeroTimer();
}

function startHeroTimer() {
  if (heroInterval) clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    const limit = Math.min(globalMoviesList.length, 4);
    if (limit === 0) return;
    currentHeroIndex = (currentHeroIndex + 1) % limit;
    updateHeroBanner(currentHeroIndex);
  }, 5000);
}

function resetHeroTimer() {
  clearInterval(heroInterval);
  startHeroTimer();
}

// ==========================================
// 3. QUẢN LÝ VÀ RENDER "TIẾP TỤC XEM"
// ==========================================

function getContinueWatchingList() {
  const list = localStorage.getItem("continue_watching_list");
  return list ? JSON.parse(list) : [];
}

function updateContinueWatching(
  movieTitle,
  episodeNum,
  currentTime,
  duration,
  poster,
  desc,
  totalEpisodes,
  slug,
) {
  if (!duration || duration <= 0 || currentTime <= 5) return;

  let list = getContinueWatchingList();
  const percentage = (currentTime / duration) * 100;

  if (percentage > 95) {
    list = list.filter((item) => item.title !== movieTitle);
  } else {
    const existingIndex = list.findIndex((item) => item.title === movieTitle);
    const itemData = {
      title: movieTitle,
      episode: episodeNum,
      currentTime: currentTime,
      duration: duration,
      progress: percentage.toFixed(1),
      poster: poster || "",
      desc: desc || "",
      totalEpisodes: totalEpisodes || 20,
      slug: slug || "",
      updatedAt: Date.now(),
    };

    if (existingIndex !== -1) {
      list[existingIndex] = itemData;
    } else {
      list.unshift(itemData);
    }
  }

  localStorage.setItem("continue_watching_list", JSON.stringify(list));
  renderContinueWatching();
}

function renderContinueWatching() {
  const section = document.getElementById("continue-watching-section");
  const slider = document.getElementById("continue-watching-slider");
  if (!section || !slider) return;

  const list = getContinueWatchingList();

  if (list.length === 0) {
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
      playEpisode(item.title, item.episode, item.totalEpisodes, item.slug);

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

// ==========================================
// 4. RENDER PHIM TRANG CHỦ & PLAYER LOGIC
// ==========================================

function renderHomePageMovies() {
  const container = document.getElementById("home-movie-slider");
  if (!container) return;

  container.innerHTML = "";

  globalMoviesList.forEach((movie) => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        getTotalEpisodes(movie),
        movie.slug,
      );

    const safeTitle = escapeHtml(movie.title);
    const safeDesc = escapeHtml(movie.desc || "");
    const handlerTitle = escapeForInlineHandler(movie.title);
    const handlerDesc = escapeForInlineHandler(movie.desc || "");

    card.innerHTML = `
      <img src="${movie.poster}" alt="${safeTitle}" onerror="this.src='https://placehold.co/350x500'" />
      <h4>${safeTitle}</h4>
      <div class="movie-hover-card">
        <img src="${movie.poster}" alt="${safeTitle}" class="hover-banner" onerror="this.src='https://placehold.co/350x500'" />
        <div class="hover-content">
          <h3 class="hover-title">${safeTitle}</h3>
          <div class="hover-actions">
            <button class="btn-hover play">
              <i class="fa-solid fa-play"></i> Xem ngay
            </button>
            <button
              class="btn-hover icon"
              title="Yêu thích"
              onclick="event.stopPropagation(); toggleWishlist({title: '${handlerTitle}', poster: '${movie.poster}', desc: '${handlerDesc}', episodes: ${getTotalEpisodes(movie)}, slug: '${movie.slug || ""}'})"
            >
              <i class="fa-regular fa-heart"></i>
            </button>
          </div>
          <p class="hover-genres">${safeDesc}</p>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  updateWishlistUI();
}

let hlsPlayer = null;
let plyrInstance = null;
let currentMovieKey = "";
let currentPlayingMeta = {
  title: "",
  episode: 1,
  total: 20,
  slug: "",
  poster: "",
  desc: "",
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function showDetail(
  title,
  posterSrc,
  description,
  totalEpisodes = 20,
  slug = "",
) {
  switchPage("detail");

  const titleEl = document.getElementById("detail-title");
  const posterEl = document.getElementById("detail-poster-img");
  const descEl = document.getElementById("detail-desc");
  const countEl = document.getElementById("detail-episodes-count");

  if (titleEl) titleEl.innerText = title;
  if (posterEl) posterEl.src = posterSrc;
  if (descEl) descEl.innerText = description;
  if (countEl) countEl.innerText = `${totalEpisodes} Tập`;

  const episodeGrid = document.getElementById("detail-episode-grid");
  if (episodeGrid) {
    episodeGrid.innerHTML = "";
    for (let i = 1; i <= totalEpisodes; i++) {
      const btn = document.createElement("button");
      btn.className = `ep-btn ${i === 1 ? "active" : ""}`;
      btn.innerText = `Tập ${i}`;
      btn.onclick = () => playEpisode(title, i, totalEpisodes, slug);
      episodeGrid.appendChild(btn);
    }
  }
}

function toggleEpDrawer() {
  const drawer = document.getElementById("netflix-ep-drawer");
  if (drawer) {
    drawer.classList.toggle("open");
  }
}

function reportIssue() {
  const reason = prompt(
    "Báo cáo sự cố video:\n1. Video không chạy\n2. Mất tiếng / Lỗi vietsub\n3. Sai tập phim\n\nNhập chi tiết sự cố:",
    "Video bị giật / Không xem được",
  );
  if (reason) {
    alert("Cảm ơn bạn! Báo cáo sự cố đã được gửi tới Quản trị viên.");
  }
}

function renderDrawerEpisodes(movieTitle, episodeNum, totalEpisodes, slug) {
  const drawerGrid = document.getElementById("drawer-episode-grid");
  if (!drawerGrid) return;

  drawerGrid.innerHTML = "";
  for (let i = 1; i <= totalEpisodes; i++) {
    const btn = document.createElement("button");
    btn.className = `ep-btn ${i === episodeNum ? "active" : ""}`;
    btn.innerText = `Tập ${i}`;
    btn.onclick = () => {
      toggleEpDrawer();
      playEpisode(movieTitle, i, totalEpisodes, slug);
    };
    drawerGrid.appendChild(btn);
  }
}

async function playEpisode(
  movieTitle,
  episodeNum,
  totalEpisodes = 20,
  slug = "",
) {
  switchPage("watch");

  const movieObj = globalMoviesList.find((m) => m.title === movieTitle) || {};

  currentMovieKey = `${movieTitle}_Ep${episodeNum}`;
  currentPlayingMeta = {
    title: movieTitle,
    episode: episodeNum,
    total: totalEpisodes,
    slug: slug,
    poster: movieObj.poster || "",
    desc: movieObj.desc || "",
  };

  const titleEl = document.getElementById("watch-movie-title");
  const epEl = document.getElementById("current-ep-title");

  if (titleEl) titleEl.innerText = movieTitle;
  if (epEl) epEl.innerText = `Tập ${episodeNum}`;

  const watchEpisodeGrid = document.getElementById("watch-episode-grid");
  if (watchEpisodeGrid) {
    watchEpisodeGrid.innerHTML = "";
    for (let i = 1; i <= totalEpisodes; i++) {
      const btn = document.createElement("button");
      btn.className = `ep-btn ${i === episodeNum ? "active" : ""}`;
      btn.innerText = `Tập ${i}`;
      btn.onclick = () => playEpisode(movieTitle, i, totalEpisodes, slug);
      watchEpisodeGrid.appendChild(btn);
    }
  }

  renderDrawerEpisodes(movieTitle, episodeNum, totalEpisodes, slug);

  let videoSrc = "";
  const cleanTitle = movieTitle ? movieTitle.trim().toLowerCase() : "";
  const key = movieKeyMap[cleanTitle];

  if (key && window.allEpisodesData && window.allEpisodesData[key]) {
    videoSrc = window.allEpisodesData[key][episodeNum - 1] || "";
  }

  if (!videoSrc && slug && slug !== "") {
    try {
      const response = await fetch(`https://phimapi.com/phim/${slug}`);
      const data = await response.json();
      if (data && data.episodes && data.episodes[0]) {
        const epList = data.episodes[0].server_data;
        if (epList[episodeNum - 1]) {
          videoSrc = epList[episodeNum - 1].link_m3u8;
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải API phim:", err);
    }
  }

  if (!videoSrc) {
    videoSrc = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
  }

  loadHlsVideo(videoSrc, currentMovieKey);
}

function loadHlsVideo(videoSrc, movieKey) {
  const video = document.getElementById("video-player");
  if (!video) return;

  const savedTime = localStorage.getItem(`watch_time_${movieKey}`);

  const startPlay = () => {
    if (savedTime && parseFloat(savedTime) > 5) {
      const formattedTime = formatTime(parseFloat(savedTime));
      const confirmResume = confirm(
        `Bạn đã dừng lại ở phút [${formattedTime}]. Bạn có muốn xem tiếp không?`,
      );
      if (confirmResume) {
        video.currentTime = parseFloat(savedTime);
      }
    }
    video.play().catch((err) => console.log("Tự động phát bị chặn:", err));
  };

  const setupPlyr = (qualities) => {
    if (plyrInstance) plyrInstance.destroy();

    const options = {
      controls: [
        "play-large",
        "play",
        "rewind",
        "fast-forward",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "captions",
        "settings",
        "pip",
        "airplay",
        "fullscreen",
      ],
      settings: ["quality", "speed"],
      rewindTime: 10,
      forwardTime: 10,
      quality: {
        default: 0,
        options: qualities,
        forced: true,
        onChange: (newQuality) => {
          if (!hlsPlayer) return;
          if (newQuality === 0) {
            hlsPlayer.currentLevel = -1;
          } else {
            hlsPlayer.levels.forEach((level, index) => {
              if (level.height === newQuality) {
                hlsPlayer.currentLevel = index;
              }
            });
          }
        },
      },
      i18n: {
        qualityLabel: { 0: "Tự động" },
      },
    };

    plyrInstance = new Plyr(video, options);

    setTimeout(() => {
      const controls = document.querySelector(".plyr__controls");
      if (controls && !document.getElementById("netflix-custom-tools")) {
        const customTools = document.createElement("div");
        customTools.id = "netflix-custom-tools";
        customTools.className = "netflix-custom-tools";
        customTools.innerHTML = `
          <button type="button" class="plyr__control" title="Tập tiếp theo" onclick="playNextEpisode()">
            <i class="fa-solid fa-forward-step"></i>
          </button>
          <button type="button" class="plyr__control" title="Danh sách tập" onclick="toggleEpDrawer()">
            <i class="fa-solid fa-list"></i>
          </button>
          <button type="button" class="plyr__control" title="Báo cáo sự cố" onclick="reportIssue()">
            <i class="fa-solid fa-flag"></i>
          </button>
        `;
        const settingsBtn = controls.querySelector('[data-plyr="settings"]');
        if (settingsBtn) {
          controls.insertBefore(customTools, settingsBtn);
        } else {
          controls.appendChild(customTools);
        }
      }
    }, 300);

    // FIX: previously a single `lastSavedTime` variable was reused for
    // two different jobs — throttling the local "continue watching"
    // update (every ~3s) AND throttling the backend history sync
    // (every ~10s). Because the first job reset the variable every 3s,
    // the diff for the second job never reached 10, so saveWatchProgress()
    // (the backend call) almost never actually ran. Using two separate
    // trackers fixes this so both features work independently.
    let lastLocalSaveTime = 0;
    let lastBackendSaveTime = 0;

    plyrInstance.on("timeupdate", () => {
      const currentTime = video.currentTime;
      if (!movieKey || currentTime <= 5) return;

      localStorage.setItem(`watch_time_${movieKey}`, currentTime);

      if (currentTime - lastLocalSaveTime >= 3) {
        updateContinueWatching(
          currentPlayingMeta.title,
          currentPlayingMeta.episode,
          currentTime,
          video.duration,
          currentPlayingMeta.poster,
          currentPlayingMeta.desc,
          currentPlayingMeta.total,
          currentPlayingMeta.slug,
        );
        lastLocalSaveTime = currentTime;
      }

      if (currentTime - lastBackendSaveTime >= 10) {
        saveWatchProgress(movieKey, currentTime, video.duration);
        lastBackendSaveTime = currentTime;
      }
    });

    plyrInstance.on("pause", () => {
      if (movieKey && video.currentTime > 5) {
        localStorage.setItem(`watch_time_${movieKey}`, video.currentTime);
        updateContinueWatching(
          currentPlayingMeta.title,
          currentPlayingMeta.episode,
          video.currentTime,
          video.duration,
          currentPlayingMeta.poster,
          currentPlayingMeta.desc,
          currentPlayingMeta.total,
          currentPlayingMeta.slug,
        );
      }
      saveWatchProgress(movieKey, video.currentTime, video.duration);
    });

    plyrInstance.on("ended", () => {
      playNextEpisode();
    });
  };

  if (typeof Hls !== "undefined" && Hls.isSupported()) {
    if (hlsPlayer) hlsPlayer.destroy();
    hlsPlayer = new Hls();
    hlsPlayer.loadSource(videoSrc);
    hlsPlayer.attachMedia(video);

    hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
      const availableQualities = hlsPlayer.levels.map((l) => l.height);
      availableQualities.unshift(0);

      setupPlyr(availableQualities);
      startPlay();
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = videoSrc;
    setupPlyr([0]);
    startPlay();
  } else {
    // FIX: previously if neither hls.js nor native HLS was supported,
    // nothing happened and the user saw a blank/frozen player with no
    // feedback at all. Now they at least get a clear message.
    console.error("Trình duyệt này không hỗ trợ phát video HLS.");
    alert(
      "Trình duyệt của bạn không hỗ trợ phát video này. Vui lòng thử trình duyệt khác.",
    );
  }
}

function playNextEpisode() {
  if (currentPlayingMeta.episode < currentPlayingMeta.total) {
    const nextEp = currentPlayingMeta.episode + 1;
    playEpisode(
      currentPlayingMeta.title,
      nextEp,
      currentPlayingMeta.total,
      currentPlayingMeta.slug,
    );
  } else {
    alert("Bạn đã xem hết tập cuối cùng của bộ phim này!");
  }
}

// ==========================================
// 5. CHỨC NĂNG TÌM KIẾM PHIM (SEARCH)
// ==========================================

function handleSearch(event) {
  if (event.key === "Enter" || event.type === "click") {
    executeSearch();
  }
}

function executeSearch() {
  const inputEl = document.getElementById("search-input");
  const query = inputEl ? inputEl.value.trim().toLowerCase() : "";

  if (!query) return;

  const keywordEl = document.getElementById("search-keyword");
  if (keywordEl) {
    // FIX: was raw string interpolation into innerText-adjacent usage
    // via innerText originally (safe), kept as-is since innerText does
    // not parse HTML — no change needed here, included for clarity.
    keywordEl.innerText = `"${query}"`;
  }

  switchPage("search");

  const searchContainer = document.getElementById("search-container");
  if (!searchContainer) return;
  searchContainer.innerHTML = "";

  const filteredMovies = globalMoviesList.filter(
    (m) =>
      m.title.toLowerCase().includes(query) ||
      (m.desc && m.desc.toLowerCase().includes(query)),
  );

  if (filteredMovies.length === 0) {
    searchContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 3rem; margin-bottom: 15px;"></i>
        <p>Không tìm thấy phim nào phù hợp với từ khóa "${escapeHtml(query)}".</p>
      </div>
    `;
    return;
  }

  filteredMovies.forEach((movie) => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        getTotalEpisodes(movie),
        movie.slug,
      );

    const safeTitle = escapeHtml(movie.title);
    const safeDesc = escapeHtml(movie.desc || "");
    const handlerTitle = escapeForInlineHandler(movie.title);
    const handlerDesc = escapeForInlineHandler(movie.desc || "");

    card.innerHTML = `
      <img src="${movie.poster}" alt="${safeTitle}" onerror="this.src='https://placehold.co/350x500'" />
      <h4>${safeTitle}</h4>
      <div class="movie-hover-card">
        <img src="${movie.poster}" alt="${safeTitle}" class="hover-banner" onerror="this.src='https://placehold.co/350x500'" />
        <div class="hover-content">
          <h3 class="hover-title">${safeTitle}</h3>
          <div class="hover-actions">
            <button class="btn-hover play">
              <i class="fa-solid fa-play"></i> Xem ngay
            </button>
            <button
              class="btn-hover icon"
              title="Yêu thích"
              onclick="event.stopPropagation(); toggleWishlist({title: '${handlerTitle}', poster: '${movie.poster}', desc: '${handlerDesc}', episodes: ${getTotalEpisodes(movie)}, slug: '${movie.slug || ""}'})"
            >
              <i class="fa-regular fa-heart"></i>
            </button>
          </div>
          <p class="hover-genres">${safeDesc}</p>
        </div>
      </div>
    `;
    searchContainer.appendChild(card);
  });

  updateWishlistUI();
}

// ==========================================
// 6. ĐIỀU HƯỚNG SPA & KHỞI TẠO TỔNG THỂ
// ==========================================

function switchPage(pageId) {
  if (pageId !== "watch") {
    const video = document.getElementById("video-player");
    if (video) {
      if (currentMovieKey && video.currentTime > 5) {
        localStorage.setItem(
          `watch_time_${currentMovieKey}`,
          video.currentTime,
        );
        updateContinueWatching(
          currentPlayingMeta.title,
          currentPlayingMeta.episode,
          video.currentTime,
          video.duration,
          currentPlayingMeta.poster,
          currentPlayingMeta.desc,
          currentPlayingMeta.total,
          currentPlayingMeta.slug,
        );
      }
      video.pause();
    }
  }

  const pages = document.querySelectorAll(".page");
  pages.forEach((page) => page.classList.remove("active"));

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add("active");
    window.scrollTo(0, 0);
  }

  if (pageId === "home") {
    renderContinueWatching();
  } else if (pageId === "wishlist") {
    renderWishlistPage();
  }
}

document.addEventListener("keydown", (e) => {
  const watchPage = document.getElementById("page-watch");
  if (!watchPage || !watchPage.classList.contains("active")) return;
  if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

  const video = document.getElementById("video-player");
  if (!video) return;

  switch (e.key.toLowerCase()) {
    case " ":
    case "k":
      e.preventDefault();
      if (plyrInstance) plyrInstance.togglePlay();
      break;
    case "f":
      e.preventDefault();
      if (plyrInstance) plyrInstance.fullscreen.toggle();
      break;
    case "m":
      e.preventDefault();
      if (plyrInstance) plyrInstance.muted = !plyrInstance.muted;
      break;
    case "arrowleft":
    case "j":
      e.preventDefault();
      if (plyrInstance) plyrInstance.rewind(10);
      break;
    case "arrowright":
    case "l":
      e.preventDefault();
      if (plyrInstance) plyrInstance.forward(10);
      break;
    case "n":
      e.preventDefault();
      playNextEpisode();
      break;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  renderHomePageMovies();
  renderContinueWatching();
  initHeroSlider();
});
