// ==========================================
// 0. CẤU HÌNH & DỮ LIỆU TẬP PHIM / DANH SÁCH PHIM
// ==========================================

const API_BASE_URL = "http://localhost:5000";

if (!window.allEpisodesData || !window.movieKeyMap) {
  console.error(
    "Không tìm thấy window.allEpisodesData / window.movieKeyMap. " +
      'Hãy chắc chắn đã nạp <script src="episodes.js"></script> TRƯỚC script.js trong index.html.',
  );
}
window.allEpisodesData = window.allEpisodesData || {};
const movieKeyMap = window.movieKeyMap || {};

function getTotalEpisodes(movie) {
  if (!movie) return 20;
  const cleanTitle = movie.title ? movie.title.trim().toLowerCase() : "";
  const key = movieKeyMap[cleanTitle];
  if (key && window.allEpisodesData && window.allEpisodesData[key]) {
    return window.allEpisodesData[key].length;
  }
  return movie.episodes || 20;
}

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
  {
    title: "weathering with you",
    slug: "weathering-with-you",
    episodes: 1,
    poster: IMG_BASE + "Weathering with You.jpg",
    banner: IMG_BASE + "Weathering with You.jpg",
    desc: "Xoay quanh cuộc sống của cậu thiếu niên Morishima Hodaka...",
  },
  {
    title: "The Witch: Part 1. The Subversion",
    slug: "The-Witch:-Part-1.-The-Subversion",
    episodes: 1,
    poster: IMG_BASE + "TheWitch1.jpg",
    banner: IMG_BASE + "TheWitch1.jpg",
    desc: "Sát Thủ Nhân Tạo là bộ phim hành động li kì kể về Koo Ja-yoon – một cô bé được nuôi dưỡng trong một tổ chức đáng sợ - nơi diễn ra các cuộc thí nghiệm y học được thực hiện trên chính cơ thể con người nhằm biến họ thành những cỗ máy giết người. Sau khi chạy trốn khỏi tổ chức, Ja-yoon bị mất trí nhớ và được một cặp vợ chồng già nhận nuôi. &nbsp;10 năm sau, khi đã trở thành một nữ sinh trung học, Ja-yoon đăng ký tham gia một cuộc thi âm nhạc với mong muốn giúp gia đình vượt qua khó khăn tài chính. Nhưng cô không ngờ rằng, ngay từ khi hình ảnh của mình xuất hiện trên truyền hình, cuộc sống của cô bị đảo lộn hoàn toàn bởi sự truy đuổi của những kẻ lạ mặt.",
    group: "sat-thu-nhan-tao",
    partName: "Phần 1",
  },
  {
    title: "The Witch: Part 2. The Other One",
    slug: "The-Witch:-Part-2.-The-Other-One",
    episodes: 1,
    poster: IMG_BASE + "TheWitch2.jpg",
    banner: IMG_BASE + "TheWitch2.jpg",
    desc: "Lợi dụng sự cố kinh hoàng tại cơ sở thí nghiệm, cô nàng 17 tuổi mang bí danh ARK-ADP1, một nữ sát thủ nhân tạo có siêu năng lực, đã thoát được ra ngoài. Cô bị những người tạo ra mình lẫn các thế lực bí ẩn khác truy bắt gắt gao.",
    group: "sat-thu-nhan-tao",
    partName: "Phần 2",
  },
];

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
// 2. HERO BANNER AUTO SLIDER
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
  // Đóng gói dữ liệu phim vào query parameters để gửi sang detail.html
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
  // Tìm thông tin phim trong danh sách để lấy đúng slug hoặc poster nếu có
  const movieObj =
    globalMoviesList.find(
      (m) => m.title.toLowerCase() === movieTitle.toLowerCase(),
    ) || {};
  const movieSlug = slug || movieObj.slug || "";

  // Đóng gói tham số để chuyển sang watch.html
  const params = new URLSearchParams({
    title: movieTitle,
    ep: episodeNum,
    slug: movieSlug,
    episodes: totalEpisodes || movieObj.episodes || 20,
  });

  window.location.href = `watch.html?${params.toString()}`;
}

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
    container.appendChild(card);
  });

  updateWishlistUI();
}

function renderAnimeMovies() {
  const container = document.getElementById("anime-movie-slider");
  if (!container) return;

  container.innerHTML = "";

  const animeList = globalMoviesList.filter(
    (movie) => movie.slug === "weathering-with-you",
  );

  animeList.forEach((movie) => {
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
    container.appendChild(card);
  });

  updateWishlistUI();
}

function renderKoreanMovies() {
  const container = document.getElementById("korean-movie-slider");
  if (!container) return;

  container.innerHTML = "";

  const koreanList = globalMoviesList.filter(
    (movie) => movie.slug !== "weathering-with-you",
  );

  koreanList.forEach((movie) => {
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
    container.appendChild(card);
  });

  updateWishlistUI();
}

function renderMovieParts(currentSlug, currentGroup) {
  const partsSection = document.getElementById("parts-section");
  const partsGrid = document.getElementById("detail-parts-grid");

  if (!partsSection || !partsGrid) return;

  // Lọc tất cả các phần phim có chung group
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
      // Khi bấm vào sẽ load lại trang chi tiết của phần tương ứng
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

// ==========================================
// 5. CHỨC NĂNG TÌM KIẾM PHIM (SEARCH)
// ==========================================
function handleSearch(event) {
  // Kiểm tra nếu phím được bấm là Enter (mã phím 13 hoặc event.key là "Enter")
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault(); // Ngăn chặn hành vi mặc định
    executeSearch(); // Kích hoạt thực thi tìm kiếm ngay lập tức
  }
}

function executeSearch() {
  const inputEl = document.getElementById("search-input");
  const query = inputEl ? inputEl.value.trim().toLowerCase() : "";

  if (!query) return;

  const keywordEl = document.getElementById("search-keyword");
  if (keywordEl) {
    keywordEl.innerText = `"${query}"`;
  }

  // Tự động chuyển hiển thị sang trang tìm kiếm (page-search)
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  const searchPage = document.getElementById("page-search");
  if (searchPage) {
    searchPage.classList.add("active");
  }

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
    searchContainer.appendChild(card);
  });

  updateWishlistUI();
}

// ==========================================
// 6. KHỞI TẠO TỔNG THỂ
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  renderHomePageMovies();
  renderAnimeMovies();
  renderKoreanMovies();
  renderContinueWatching();
  initHeroSlider();
});
