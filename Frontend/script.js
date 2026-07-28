// ==========================================
// 0. CẤU HÌNH & DỮ LIỆU TẬP PHIM / DANH SÁCH PHIM
// ==========================================

const API_BASE_URL = "http://localhost:5000";

// Ghi chú: Episodes.js / window.allEpisodesData vẫn được nạp trong index.html
// để tương thích ngược với watch.html/detail.html (đang dùng bản cũ), nhưng
// TRANG CHỦ (index.html) giờ không còn phụ thuộc vào nó nữa — toàn bộ số tập
// đã được lưu đúng trong cột total_episodes ở MySQL rồi.
function getTotalEpisodes(movie) {
  return movie && movie.episodes ? movie.episodes : 20;
}

const IMG_BASE = "Img/";

// ==========================================
// 0C. GỌI API PHIM TỪ BACKEND (thay cho data hardcode)
// ==========================================

// Chuẩn hóa 1 dòng dữ liệu trả về từ MySQL API thành đúng cấu trúc
// mà toàn bộ code render/wishlist/continue-watching bên dưới đang dùng
function normalizeMovie(row) {
  return {
    title: row.title,
    slug: row.slug,
    poster: row.poster,
    banner: row.banner || row.poster,
    desc: row.description,
    genres: row.genres,
    episodes: row.total_episodes,
    group: row.movie_group,
    partName: row.part_name,
  };
}

// Lấy danh sách phim có phân trang, có thể lọc theo thể loại
async function fetchMovies({
  page = 1,
  limit = 20,
  genre = null,
  group = null,
} = {}) {
  try {
    const params = new URLSearchParams({ page, limit });
    if (genre) params.set("genre", genre);
    if (group) params.set("group", group);
    const res = await fetch(`${API_BASE_URL}/api/movies?${params.toString()}`);
    if (!res.ok) throw new Error(`API /api/movies lỗi ${res.status}`);
    const data = await res.json();
    return (data.movies || []).map(normalizeMovie);
  } catch (err) {
    console.error("Lỗi tải danh sách phim từ API:", err);
    return [];
  }
}

// Lấy chi tiết 1 phim theo slug (kèm episodes = mảng link m3u8 thật từ MySQL)
async function fetchMovieBySlug(slug) {
  if (!slug) return null;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/movies/${encodeURIComponent(slug)}`,
    );
    if (!res.ok) return null;
    const row = await res.json();
    const movie = normalizeMovie(row);
    movie.episodeUrls = row.episodes || []; // link m3u8 thật, tách riêng khỏi "episodes" (số tập)
    return movie;
  } catch (err) {
    console.error("Lỗi tải chi tiết phim từ API:", err);
    return null;
  }
}

// Tìm kiếm phim theo tên/thể loại qua API
async function searchMoviesAPI(query, limit = 40) {
  try {
    const params = new URLSearchParams({ q: query, limit });
    const res = await fetch(
      `${API_BASE_URL}/api/movies/search?${params.toString()}`,
    );
    if (!res.ok) throw new Error(`API /api/movies/search lỗi ${res.status}`);
    const data = await res.json();
    return (data.movies || []).map(normalizeMovie);
  } catch (err) {
    console.error("Lỗi tìm kiếm phim từ API:", err);
    return [];
  }
}

// Danh sách phim dùng chung toàn trang (được populate dần qua các lần fetch
// API bên dưới, thay vì hardcode sẵn 1 mảng lớn như trước). detail.html /
// watch.html đọc qua window.globalMoviesList giống như trước.
let globalMoviesList = [];
window.globalMoviesList = globalMoviesList;

// Gộp thêm phim mới fetch được vào danh sách chung, tự loại trùng theo slug
function addToGlobalMoviesList(movies) {
  (movies || []).forEach((m) => {
    if (!globalMoviesList.some((existing) => existing.slug === m.slug)) {
      globalMoviesList.push(m);
    }
  });
}

// ==========================================
// 0B. ĐIỀU HƯỚNG TRANG (ROUTER) - switchPage()
// ==========================================
// Hàm này được gọi từ các onclick trong index.html (Trang chủ, Danh sách
// của tôi, Chi tiết, Xem phim...). Trước đây bị thiếu nên bấm không có
// phản ứng gì.
function switchPage(pageName) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) {
    targetPage.classList.add("active");
  } else {
    console.warn(`switchPage: không tìm thấy #page-${pageName}`);
  }

  if (pageName === "wishlist" && typeof renderWishlistPage === "function") {
    renderWishlistPage();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  } else {
    wishlist.push(movie);
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
            <button class="btn-hover play" onclick="event.stopPropagation(); playEpisodeDirect('${handlerTitle}', 1, ${getTotalEpisodes(movie)}, '${movie.slug || ""}')">
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

// ==========================================
// 2. HERO BANNER - 4 PHIM NỔI BẬT AUTO-SLIDE, ĐỔI BỘ 4 PHIM MỖI NGÀY
// ==========================================

let currentHeroIndex = 0;
let heroInterval = null;

// Chọn ra 4 phim "nổi bật" cho hôm nay: dựa theo số ngày kể từ epoch để
// dịch chuyển vị trí bắt đầu trong toàn bộ danh sách phim (có vòng lặp),
// nên mỗi ngày sẽ ra 1 bộ 4 phim khác nhau, sang ngày mới lại đổi bộ khác.
function getDailyFeaturedList(movies, count = 4) {
  if (!movies || movies.length === 0) return [];
  const total = movies.length;
  const daysSinceEpoch = Math.floor(Date.now() / 86400000); // 1 đơn vị = 1 ngày
  const startIndex = daysSinceEpoch % total;

  const result = [];
  const limit = Math.min(count, total);
  for (let i = 0; i < limit; i++) {
    result.push(movies[(startIndex + i) % total]);
  }
  return result;
}

function updateHeroBanner(index, featuredList) {
  const list = featuredList || window.currentHeroFeatured;
  if (!list || list.length === 0) return;

  const movie = list[index % list.length];
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
      playEpisodeDirect(movie.title, 1, getTotalEpisodes(movie), movie.slug);
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

function initHeroSlider(preloadedMovies) {
  const heroSection = document.getElementById("hero-banner");
  const pool =
    preloadedMovies && preloadedMovies.length
      ? preloadedMovies
      : globalMoviesList;
  if (!heroSection || !pool || pool.length === 0) return;

  let dotsContainer = heroSection.querySelector(".hero-dots");
  if (!dotsContainer) {
    dotsContainer = document.createElement("div");
    dotsContainer.className = "hero-dots";
    heroSection.appendChild(dotsContainer);
  } else {
    dotsContainer.innerHTML = "";
  }

  // Bộ 4 phim nổi bật của riêng hôm nay (lưu lại để dùng xuyên suốt trang)
  const featured = getDailyFeaturedList(pool, 4);
  window.currentHeroFeatured = featured;

  featured.forEach((_, index) => {
    const dot = document.createElement("div");
    dot.className = `hero-dot ${index === 0 ? "active" : ""}`;
    dot.onclick = () => {
      currentHeroIndex = index;
      updateHeroBanner(currentHeroIndex, featured);
      resetHeroTimer();
    };
    dotsContainer.appendChild(dot);
  });

  currentHeroIndex = 0;
  updateHeroBanner(0, featured);
  startHeroTimer();
}

function startHeroTimer() {
  if (heroInterval) clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    const featured = window.currentHeroFeatured || [];
    const limit = featured.length;
    if (limit === 0) return;
    currentHeroIndex = (currentHeroIndex + 1) % limit;
    updateHeroBanner(currentHeroIndex, featured);
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

// ==========================================
// 4. RENDER PHIM TRANG CHỦ & ĐIỀU HƯỚNG TRANG
// ==========================================

function showDetail(
  title,
  posterSrc,
  description,
  totalEpisodes = 20,
  slug = "",
) {
  const params = new URLSearchParams({
    title: title || "",
    slug: slug || "",
    poster: posterSrc || "",
    desc: description || "",
    episodes: totalEpisodes || 20,
  });

  window.location.href = `detail.html?${params.toString()}`;
}

function playEpisodeDirect(
  movieTitle,
  episodeNum = 1,
  totalEpisodes = 20,
  slug = "",
) {
  const movieObj =
    globalMoviesList.find(
      (m) => m.title.toLowerCase() === movieTitle.toLowerCase(),
    ) || {};
  const movieSlug = slug || movieObj.slug || "";

  const params = new URLSearchParams({
    title: movieTitle,
    ep: episodeNum,
    slug: movieSlug,
    episodes: totalEpisodes || movieObj.episodes || 20,
  });

  window.location.href = `watch.html?${params.toString()}`;
}

// Dựng 1 thẻ phim (card) dùng chung cho tất cả các slider/search/genre-filter
function createMovieCard(movie) {
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
          <button class="btn-hover play" onclick="event.stopPropagation(); playEpisodeDirect('${handlerTitle}', 1, ${getTotalEpisodes(movie)}, '${movie.slug || ""}')">
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
  return card;
}

// Render 1 danh sách phim vào 1 container, có thể truyền HTML hiển thị khi rỗng
function renderMovieGrid(container, movies, emptyHtml = "") {
  if (!container) return;
  container.innerHTML = "";

  if (!movies || movies.length === 0) {
    if (emptyHtml) container.innerHTML = emptyHtml;
    return;
  }

  movies.forEach((movie) => container.appendChild(createMovieCard(movie)));
  updateWishlistUI();
}

// "Phim Mới Cập Nhật" - trả về movies đã fetch để dùng chung cho Hero Banner
async function renderHomePageMovies() {
  const container = document.getElementById("home-movie-slider");
  const movies = await fetchMovies({ limit: 20 });
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, movies);
  return movies;
}

async function renderAnimeMovies() {
  const container = document.getElementById("anime-movie-slider");
  if (!container) return;
  const movies = await fetchMovies({ genre: "Anime", limit: 20 });
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, movies);
}

async function renderKoreanMovies() {
  const container = document.getElementById("korean-movie-slider");
  if (!container) return;
  const movies = await fetchMovies({ genre: "Hàn Quốc", limit: 20 });
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, movies);
}

async function renderActionMovies() {
  const container = document.getElementById("action-movie-slider");
  if (!container) return;
  const movies = await fetchMovies({ genre: "Hành Động", limit: 20 });
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, movies);
}

async function renderRomanceMovies() {
  const container = document.getElementById("romance-movie-slider");
  if (!container) return;
  const movies = await fetchMovies({ genre: "Tình Cảm", limit: 20 });
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, movies);
}

function renderMovieParts(currentSlug, currentGroup) {
  const partsSection = document.getElementById("parts-section");
  const partsGrid = document.getElementById("detail-parts-grid");

  if (!partsSection || !partsGrid) return;

  if (!currentGroup) {
    partsSection.style.display = "none";
    return;
  }

  const relatedParts = globalMoviesList.filter((m) => m.group === currentGroup);

  if (relatedParts.length <= 1) {
    partsSection.style.display = "none";
    return;
  }

  partsSection.style.display = "block";
  partsGrid.innerHTML = "";

  relatedParts.forEach((part) => {
    const btn = document.createElement("button");
    btn.className = `episode-btn ${part.slug === currentSlug ? "active" : ""}`;
    btn.innerText = part.partName || part.title;
    btn.onclick = () => {
      showDetail(
        part.title,
        part.poster,
        part.desc,
        getTotalEpisodes(part),
        part.slug,
      );
    };
    partsGrid.appendChild(btn);
  });
}

function renderRelatedSuggestions(currentSlug, currentGenres) {
  const container = document.getElementById("fd-suggestions");
  if (!container) return;

  const genreList = (currentGenres || "")
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);

  const related = globalMoviesList
    .filter((m) => {
      if (m.slug === currentSlug) return false;
      if (!m.genres) return false;
      const mGenres = m.genres.toLowerCase();
      return genreList.some((g) => g && mGenres.includes(g));
    })
    .slice(0, 6);

  if (related.length === 0) {
    container.innerHTML = `<p style="color:#777; font-size:13px;">Chưa có gợi ý phù hợp.</p>`;
    return;
  }

  container.innerHTML = "";
  related.forEach((movie) => {
    const item = document.createElement("div");
    item.className = "fd-suggest-item";
    item.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        getTotalEpisodes(movie),
        movie.slug,
      );
    item.innerHTML = `
      <img src="${movie.poster}" alt="${escapeHtml(movie.title)}" onerror="this.src='https://placehold.co/80x110'" />
      <div class="fd-suggest-info">
        <h4>${escapeHtml(movie.title)}</h4>
        <span>${escapeHtml((movie.genres || "").split(",")[0] || "")}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

// ==========================================
// 5. CHỨC NĂNG TÌM KIẾM PHIM (SEARCH) & TÍCH HỢP TMDB API
// ==========================================

async function fetchMovieDataFromBackend(movieTitle) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tmdb/search?query=${encodeURIComponent(movieTitle)}`,
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const item = data.results[0];
      const isTV = data.isTV ? "true" : "false";

      const detailRes = await fetch(
        `${API_BASE_URL}/api/tmdb/detail/${item.id}?isTV=${isTV}`,
      );
      const detailData = await detailRes.json();

      return detailData;
    }
    return null;
  } catch (error) {
    console.error("Lỗi đồng bộ dữ liệu TMDB từ Backend:", error);
    return null;
  }
}

function handleSearch(event) {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    executeSearch();
  }
}

async function executeSearch() {
  const inputEl = document.getElementById("search-input");
  const query = inputEl ? inputEl.value.trim() : "";

  if (!query) return;

  const keywordEl = document.getElementById("search-keyword");
  if (keywordEl) {
    keywordEl.innerText = `"${query}"`;
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  const searchPage = document.getElementById("page-search");
  if (searchPage) {
    searchPage.classList.add("active");
  }

  const searchContainer = document.getElementById("search-container");
  if (!searchContainer) return;
  searchContainer.innerHTML = `<p style="color:#888; grid-column:1/-1;">Đang tìm kiếm...</p>`;

  const movies = await searchMoviesAPI(query, 40);
  addToGlobalMoviesList(movies);

  renderMovieGrid(
    searchContainer,
    movies,
    `<div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
      <i class="fa-solid fa-magnifying-glass" style="font-size: 3rem; margin-bottom: 15px;"></i>
      <p>Không tìm thấy phim nào phù hợp với từ khóa "${escapeHtml(query)}".</p>
    </div>`,
  );
}

// ==========================================
// 6. CHỨC NĂNG LỌC PHIM THEO THỂ LOẠI (GENRE FILTER)
// ==========================================
async function filterByGenre(genreName) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  const searchPage = document.getElementById("page-search");
  if (searchPage) {
    searchPage.classList.add("active");
  }

  const keywordEl = document.getElementById("search-keyword");
  if (keywordEl) {
    keywordEl.innerText = `Thể loại: ${genreName}`;
  }

  const container = document.getElementById("search-container");
  if (!container) return;
  container.innerHTML = `<p style="color:#888; grid-column:1/-1;">Đang tải...</p>`;

  const movies = await fetchMovies({ genre: genreName, limit: 50 });
  addToGlobalMoviesList(movies);

  renderMovieGrid(
    container,
    movies,
    `<div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
      <i class="fa-solid fa-film" style="font-size: 3rem; margin-bottom: 15px;"></i>
      <p>Hiện chưa có phim nào thuộc thể loại "${escapeHtml(genreName)}".</p>
    </div>`,
  );
}

// ==========================================
// 7. KHỞI TẠO TỔNG THỂ
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  const homeMovies = await renderHomePageMovies();
  initHeroSlider(homeMovies);

  renderAnimeMovies();
  renderKoreanMovies();
  renderActionMovies();
  renderRomanceMovies();
  renderContinueWatching();
});

// ==========================================
// 8. BỔ SUNG XỬ LÝ TOÀN MÀN HÌNH (MOBILE FULLSCREEN FIX)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const videoElement = document.querySelector(".video-player-wrapper video");
  const wrapperElement = document.querySelector(".video-player-wrapper");

  if (videoElement) {
    window.triggerFullscreen = function () {
      if (videoElement.webkitEnterFullscreen) {
        videoElement.webkitEnterFullscreen();
      } else if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (wrapperElement && wrapperElement.requestFullscreen) {
        wrapperElement.requestFullscreen();
      } else if (videoElement.requestFullscreen) {
        videoElement.requestFullscreen();
      }
    };
  }
});

// ==========================================
// 9. XỬ LÝ SỰ KIỆN CLICK NÚT MŨI TÊN TRƯỢT SLIDER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const sliderSections = document.querySelectorAll(".slider-section");

  sliderSections.forEach((section) => {
    const slider = section.querySelector(".movie-slider");
    const prevBtn = section.querySelector(".prev-btn");
    const nextBtn = section.querySelector(".next-btn");

    if (slider && nextBtn && prevBtn) {
      nextBtn.addEventListener("click", () => {
        slider.scrollBy({ left: window.innerWidth * 0.75, behavior: "smooth" });
      });

      prevBtn.addEventListener("click", () => {
        slider.scrollBy({
          left: -window.innerWidth * 0.75,
          behavior: "smooth",
        });
      });
    }
  });
});
// ==========================================
// 10. TÍCH HỢP HIỂN THỊ CHI TIẾT TMDB CHO TRANG DETAIL
// ==========================================

function updateRatingVisuals(voteAverage) {
  if (!voteAverage) return;

  const percent = Math.round(voteAverage * 10);
  const scoreEl = document.getElementById("fd-score-value");
  if (scoreEl) scoreEl.innerText = `${percent}%`;

  const starsEl = document.getElementById("fd-stars");
  if (starsEl) {
    const starCount = Math.round(voteAverage / 2);
    let html = "";
    for (let i = 1; i <= 5; i++) {
      html += `<i class="${i <= starCount ? "fa-solid" : "fa-regular"} fa-star"></i>`;
    }
    starsEl.innerHTML = html;
  }
}

async function loadMovieDetailsFromTMDB(movieTitle) {
  try {
    const detailData = await fetchMovieDataFromBackend(movieTitle);

    if (detailData) {
      // 1. Cập nhật điểm đánh giá
      const ratingEl = document.getElementById("detail-rating");
      if (ratingEl && detailData.vote_average) {
        ratingEl.innerText = detailData.vote_average.toFixed(1);
      }
      updateRatingVisuals(detailData.vote_average);

      // 2. Cập nhật Đạo diễn
      const directorEl = document.getElementById("detail-director");
      if (directorEl && detailData.director) {
        directorEl.innerText = detailData.director;
      }

      // 3. Cập nhật Diễn viên
      const castEl = document.getElementById("detail-cast");
      if (castEl && detailData.cast) {
        castEl.innerText = detailData.cast;
      }

      // 4. Cập nhật Thể loại
      const genresEl = document.getElementById("detail-genres");
      if (genresEl && detailData.genres) {
        genresEl.innerText = detailData.genres;
      }
    }
  } catch (error) {
    console.error("Không thể tải thông tin chi tiết TMDB:", error);
  }
}
