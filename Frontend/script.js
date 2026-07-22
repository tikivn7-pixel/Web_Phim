// ==========================================
// 1. CÁC HÀM XỬ LÝ AUTH, WATCHLIST & FAVORITE
// ==========================================

async function login(email, password) {
  try {
    const response = await fetch("http://localhost:5000/api/auth/login", {
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
    alert("Không thể kết nối đến máy chủ!");
  }
}

// Lấy danh sách Wishlist từ LocalStorage
function getWishlist() {
  const wishlist = localStorage.getItem("my_wishlist");
  return wishlist ? JSON.parse(wishlist) : [];
}

// Kiểm tra phim đã có trong Wishlist chưa
function isMovieInWishlist(title) {
  const wishlist = getWishlist();
  return wishlist.some((item) => item.title === title);
}

// Bật / Tắt trạng thái yêu thích phim
function toggleWishlist(movie) {
  let wishlist = getWishlist();
  const index = wishlist.findIndex((item) => item.title === movie.title);

  if (index !== -1) {
    // Nếu đã có thì xóa khỏi danh sách
    wishlist.splice(index, 1);
    alert(`Đã xóa "${movie.title}" khỏi Danh sách của tôi!`);
  } else {
    // Nếu chưa có thì thêm vào
    wishlist.push(movie);
    alert(`Đã thêm "${movie.title}" vào Danh sách của tôi!`);
  }

  localStorage.setItem("my_wishlist", JSON.stringify(wishlist));
  updateWishlistUI();

  // Chỉ render lại nếu đang ở trang wishlist
  const wishlistContainer = document.getElementById("wishlist-container");
  if (wishlistContainer) {
    renderWishlistPage();
  }

  // Gọi API backend (nếu có đăng nhập)
  toggleFavoriteBackend(movie.title);
}

// API toggle backend (tùy chọn)
async function toggleFavoriteBackend(movieId) {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    await fetch("http://localhost:5000/api/watchlist/toggle", {
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

// Cập nhật biểu tượng tim trên giao diện
function updateWishlistUI() {
  const wishlist = getWishlist();
  const heartBtns = document.querySelectorAll(".movie-card .btn-hover.icon");

  heartBtns.forEach((btn) => {
    const card = btn.closest(".movie-card");
    if (!card) return;
    const titleEl =
      card.querySelector(".hover-title") || card.querySelector("h4");
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

// Render danh sách phim yêu thích ra trang Wishlist
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
        movie.episodes || 20,
        movie.slug || "",
      );

    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}" />
      <h4>${movie.title}</h4>
      <div class="movie-hover-card">
        <img src="${movie.poster}" alt="${movie.title}" class="hover-banner" />
        <div class="hover-content">
          <h3 class="hover-title">${movie.title}</h3>
          <div class="hover-actions">
            <button class="btn-hover play">
              <i class="fa-solid fa-play"></i> Xem ngay
            </button>
            <button 
              class="btn-hover icon" 
              title="Xóa khỏi danh sách"
              onclick="event.stopPropagation(); toggleWishlist({title: '${movie.title.replace(/'/g, "\\'")}', poster: '${movie.poster}', desc: '${(movie.desc || "").replace(/'/g, "\\'")}', episodes: ${movie.episodes || 20}, slug: '${movie.slug || ""}'})"
            >
              <i class="fa-solid fa-heart" style="color: #e50914;"></i>
            </button>
          </div>
          <p class="hover-genres">${movie.desc || ""}</p>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function saveWatchProgress(movieId, currentTime, duration) {
  const token = localStorage.getItem("token");
  if (!token || !movieId) return;

  fetch("http://localhost:5000/api/history", {
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

const featuredMovies = [
  {
    title: "Cyberpunk: Edgerunners",
    banner: "https://picsum.photos/1600/900?random=99",
    desc: "Một câu chuyện nghẹt thở về đứa con đường phố tại Night City đầy cạm bẫy.",
    poster: "https://picsum.photos/350/500?random=10",
    episodes: 10,
    slug: "",
  },
  {
    title: "Moving",
    banner: "Img/Moving.jpg",
    desc: "Nội dung bộ phim xoay quanh câu chuyện về Kim Bong Seok, Jang Hee Soo và Lee Gang Hoon học cùng trường trung học với những siêu năng lực bí ẩn.",
    poster: "Img/Moving.jpg",
    episodes: 20,
    slug: "doi-thieu-nien-sieu-dang",
  },
  {
    title: "Queen of tears",
    banner: "Img/QueenOfTears.jpg",
    desc: "Nữ hoàng cửa hàng bách hóa và hoàng tử siêu thị xoay xở với khủng hoảng hôn nhân, rồi tình yêu bắt đầu nảy nở trở lại theo cách kỳ diệu.",
    poster: "Img/QueenOfTears.jpg",
    episodes: 16,
    slug: "",
  },
  {
    title: "Mouse",
    banner: "Img/Mouse.jpg",
    desc: "Phim xoay quanh cuộc truy đuổi giữa cảnh sát Jung Ba Reum và tên sát nhân biến thái đang gây rúng động cả nước.",
    poster: "Img/Mouse.jpg",
    episodes: 20,
    slug: "",
  },
];

let currentHeroIndex = 0;
let heroInterval = null;

function updateHeroBanner(index) {
  const movie = featuredMovies[index];
  const heroSection = document.querySelector(".hero-banner");
  const heroContent = document.querySelector(".hero-content");

  if (!heroSection || !heroContent) return;

  heroSection.style.backgroundImage = `url('${movie.banner}')`;

  heroContent.innerHTML = `
    <span class="badge">Phim Nổi Bật</span>
    <h1>${movie.title}</h1>
    <p>${movie.desc}</p>
    <div class="hero-buttons">
      <button class="btn btn-primary" onclick="showDetail('${movie.title}', '${movie.poster}', '${movie.desc.replace(/'/g, "\\'")}', ${movie.episodes}, '${movie.slug}')">
        <i class="fa-solid fa-play"></i> Xem ngay
      </button>
      <button class="btn btn-secondary" onclick="showDetail('${movie.title}', '${movie.poster}', '${movie.desc.replace(/'/g, "\\'")}', ${movie.episodes}, '${movie.slug}')">
        <i class="fa-solid fa-circle-info"></i> Thông tin
      </button>
    </div>
  `;

  const dots = document.querySelectorAll(".hero-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });
}

function initHeroSlider() {
  const heroSection = document.querySelector(".hero-banner");
  if (!heroSection) return;

  let dotsContainer = heroSection.querySelector(".hero-dots");
  if (!dotsContainer) {
    dotsContainer = document.createElement("div");
    dotsContainer.className = "hero-dots";
    heroSection.appendChild(dotsContainer);
  } else {
    dotsContainer.innerHTML = "";
  }

  featuredMovies.forEach((_, index) => {
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
    currentHeroIndex = (currentHeroIndex + 1) % featuredMovies.length;
    updateHeroBanner(currentHeroIndex);
  }, 5000);
}

function resetHeroTimer() {
  clearInterval(heroInterval);
  startHeroTimer();
}

// ==========================================
// 3. DỮ LIỆU & QUẢN LÝ PHÁT VIDEO
// ==========================================

const movingEpisodes = [
  "https://s6.kkphimplayer6.com/20250721/ZsGU1yen/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/nanxjdoM/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/NZChSyHi/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/OwLqz4td/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/3trueqtW/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/Rt0DznhK/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/pMSvodOY/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/ul107cYj/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/xmfAAxhm/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/43m4RrFQ/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/8ntg8cr2/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/4FyDbkVh/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/2gvbd2Oe/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/ChCCG6wj/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/b3dra7GF/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/gKDlipbP/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/8w28JAuC/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/Jm7mUJFS/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/u5PkzgGn/index.m3u8",
  "https://s6.kkphimplayer6.com/20250721/lIaOCKDm/index.m3u8",
];

const ctlbtranslatedEpisodes = [
  "https://s6.kkphimplayer6.com/20260116/ymhRoCnM/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/pvX1ljQw/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/yNz0hJ7H/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/muZgTMNV/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/u14xq25m/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/tCI84KRO/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/cFHPaKqj/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/kAmFF3Fl/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/XAGBPAMi/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/hsqedN1m/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/wZVHoJ48/index.m3u8",
  "https://s6.kkphimplayer6.com/20260116/bwifHhuJ/index.m3u8",
];

const QueenOfTearsEpisodes = [
  "https://s2.phim1280.tv/20240310/Qah2fQHw/index.m3u8",
  "https://s2.phim1280.tv/20240312/ZPQnihpF/index.m3u8",
  "https://s3.phim1280.tv/20240319/bNiRcNFt/index.m3u8",
  "https://s3.phim1280.tv/20240319/U1BFxG6z/index.m3u8",
  "https://s3.phim1280.tv/20240326/g2P520Ty/index.m3u8",
  "https://s3.phim1280.tv/20240326/mAVhoCwN/index.m3u8",
  "https://s3.phim1280.tv/20240402/euu7JogT/index.m3u8",
  "https://s3.phim1280.tv/20240402/BwDmbFnW/index.m3u8",
  "https://s3.phim1280.tv/20240407/cGzlUNId/index.m3u8",
  "https://s3.phim1280.tv/20240408/jdNwd792/index.m3u8",
  "https://s3.phim1280.tv/20240414/gcohFIJ4/index.m3u8",
  "https://s3.phim1280.tv/20240416/UHcrZRv1/index.m3u8",
  "https://s3.phim1280.tv/20240421/9wGXWVsx/index.m3u8",
  "https://s3.phim1280.tv/20240423/CoeBfqof/index.m3u8",
  "https://s3.phim1280.tv/20240428/D83pYG42/index.m3u8",
  "https://s3.phim1280.tv/20240502/SpSMZRJz/index.m3u8",
];

const mouseEpisodes = [
  "https://s4.phim1280.tv/20241006/QM4FZCB9/index.m3u8",
  "https://s4.phim1280.tv/20241006/FebiLXsS/index.m3u8",
  "https://s4.phim1280.tv/20241006/RqrSEO5O/index.m3u8",
  "https://s4.phim1280.tv/20241006/dymHYsYX/index.m3u8",
  "https://s4.phim1280.tv/20241006/MvhVVgoc/index.m3u8",
  "https://s4.phim1280.tv/20241006/m1GW7HYh/index.m3u8",
  "https://s4.phim1280.tv/20241006/67mzUfSy/index.m3u8",
  "https://s4.phim1280.tv/20241006/TdgWao58/index.m3u8",
  "https://s4.phim1280.tv/20241006/qbujLn2j/index.m3u8",
  "https://s4.phim1280.tv/20241006/DaddJWvi/index.m3u8",
  "https://s4.phim1280.tv/20241006/itZuzPTK/index.m3u8",
  "https://s4.phim1280.tv/20241006/maIKoc1q/index.m3u8",
  "https://s4.phim1280.tv/20241006/xTMgljSY/index.m3u8",
  "https://s4.phim1280.tv/20241006/BxftUkoi/index.m3u8",
  "https://s4.phim1280.tv/20241006/BvXD851D/index.m3u8",
  "https://s4.phim1280.tv/20241006/3Itg0Tve/index.m3u8",
  "https://s4.phim1280.tv/20241006/Hn1EANZN/index.m3u8",
  "https://s4.phim1280.tv/20241006/sQejzukr/index.m3u8",
  "https://s4.phim1280.tv/20241006/jpI5FwVR/index.m3u8",
  "https://s4.phim1280.tv/20241006/mqcAXAKE/index.m3u8",
];

const hailamEpisodes = [
  "https://s3.phim1280.tv/20240329/19y7gT0X/index.m3u8",
  "https://s3.phim1280.tv/20240329/5fQQCT40/index.m3u8",
  "https://s3.phim1280.tv/20240329/rTpaKdpW/index.m3u8",
  "https://s3.phim1280.tv/20240329/DA6K3oEW/index.m3u8",
  "https://s3.phim1280.tv/20240329/bXI8vjCU/index.m3u8",
  "https://s3.phim1280.tv/20240329/tp1y52T1/index.m3u8",
  "https://s3.phim1280.tv/20240329/3tHpVVtt/index.m3u8",
  "https://s3.phim1280.tv/20240329/3b6Bb2lM/index.m3u8",
  "https://s3.phim1280.tv/20240329/Sg4KR5ww/index.m3u8",
  "https://s3.phim1280.tv/20240329/6dyubBRC/index.m3u8",
  "https://s3.phim1280.tv/20240329/IKILVIVy/index.m3u8",
  "https://s3.phim1280.tv/20240329/BrQA5pQG/index.m3u8",
  "https://s3.phim1280.tv/20240329/F34RNh6M/index.m3u8",
  "https://s3.phim1280.tv/20240329/0zTxAnrj/index.m3u8",
  "https://s3.phim1280.tv/20240329/SohCFH2c/index.m3u8",
  "https://s3.phim1280.tv/20240329/iKY3SYMv/index.m3u8",
];

let hlsPlayer = null;
let currentMovieKey = "";

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// 1. Hàm hiển thị thông tin trang Chi tiết
function showDetail(
  title,
  posterSrc,
  description,
  totalEpisodes = 20,
  slug = "",
) {
  switchPage("detail");

  const titleEl = document.querySelector(".detail-info h1");
  const posterEl = document.querySelector(".detail-poster img");
  const descEl = document.querySelector(".description");

  if (titleEl) titleEl.innerText = title;
  if (posterEl) posterEl.src = posterSrc;
  if (descEl) descEl.innerText = description;

  const metaSpans = document.querySelectorAll(".detail-info .meta span");
  if (metaSpans.length >= 3) {
    metaSpans[2].innerText = `${totalEpisodes} Tập`;
  }

  const episodeGrid = document.querySelector("#page-detail .episode-grid");
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

// 2. Hàm phát phim và load nguồn stream m3u8 động
async function playEpisode(
  movieTitle,
  episodeNum,
  totalEpisodes = 20,
  slug = "",
) {
  switchPage("watch");

  currentMovieKey = `${movieTitle}_Ep${episodeNum}`;

  const watchH2 = document.querySelector("#page-watch h2");
  if (watchH2) {
    watchH2.innerText = `${movieTitle} - Tập ${episodeNum}`;
  }

  const watchEpisodeGrid = document.querySelector("#page-watch .episode-grid");
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

  let videoSrc = "";

  if (movieTitle === "Moving") {
    videoSrc = movingEpisodes[episodeNum - 1];
  } else if (movieTitle === "Can this love be translated") {
    videoSrc = ctlbtranslatedEpisodes[episodeNum - 1];
  } else if (movieTitle === "Queen of tears") {
    videoSrc = QueenOfTearsEpisodes[episodeNum - 1];
  } else if (movieTitle === "Mouse") {
    videoSrc = mouseEpisodes[episodeNum - 1];
  } else if (movieTitle === "Twenty Five Twenty One") {
    videoSrc = hailamEpisodes[episodeNum - 1];
  } else if (slug && slug !== "") {
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

// Load link m3u8 vào video player + Xử lý xem tiếp
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

  if (typeof Hls !== "undefined" && Hls.isSupported()) {
    if (hlsPlayer) hlsPlayer.destroy();
    hlsPlayer = new Hls();
    hlsPlayer.loadSource(videoSrc);
    hlsPlayer.attachMedia(video);
    hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
      startPlay();
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = videoSrc;
    startPlay();
  }
}

// ==========================================
// 4. CHỨC NĂNG TÌM KIẾM PHIM (SEARCH)
// ==========================================

function handleSearchKey(event) {
  if (event.key === "Enter") {
    executeSearch();
  }
}

function executeSearch() {
  const inputEl = document.getElementById("search-input");
  const query = inputEl ? inputEl.value.trim().toLowerCase() : "";

  if (!query) return;

  // Cập nhật từ khóa hiển thị
  const keywordEl = document.getElementById("search-keyword");
  if (keywordEl) {
    keywordEl.innerText = `"${query}"`;
  }

  // Chuyển sang trang kết quả tìm kiếm
  switchPage("search");

  // Lấy tất cả card phim ở trang chủ làm dữ liệu nguồn
  const allCards = document.querySelectorAll("#page-home .movie-card");
  const searchContainer = document.getElementById("search-container");

  if (!searchContainer) return;
  searchContainer.innerHTML = "";

  let matchCount = 0;

  allCards.forEach((card) => {
    const titleEl =
      card.querySelector("h4") || card.querySelector(".hover-title");
    const title = titleEl ? titleEl.innerText.toLowerCase() : "";

    if (title.includes(query)) {
      const cloneCard = card.cloneNode(true);
      searchContainer.appendChild(cloneCard);
      matchCount++;
    }
  });

  // Cập nhật lại UI nút tim yêu thích cho các thẻ vừa clone
  updateWishlistUI();

  if (matchCount === 0) {
    searchContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 3rem; margin-bottom: 15px;"></i>
        <p>Không tìm thấy phim nào phù hợp với từ khóa "${query}".</p>
      </div>
    `;
  }
}

// ==========================================
// 5. ĐIỀU HƯỚNG SPA & KHỞI TẠO TỔNG THỂ
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

  // Render lại danh sách yêu thích nếu chuyển sang trang wishlist
  if (pageId === "wishlist") {
    renderWishlistPage();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Khởi tạo Auto Slider cho Hero Banner
  initHeroSlider();

  // Khởi tạo icon trái tim trên các card phim
  updateWishlistUI();

  // Bấm Logo -> Về trang chủ
  const logo = document.querySelector(".logo");
  if (logo) {
    logo.addEventListener("click", (e) => {
      e.preventDefault();
      switchPage("home");
    });
  }

  // Lắng nghe sự kiện Tìm kiếm
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("keypress", handleSearchKey);
  }

  const searchBtn = document.getElementById("search-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", executeSearch);
  }

  // Xử lý Video Player
  const video = document.getElementById("video-player");

  if (video) {
    let lastSavedTime = 0;

    video.addEventListener("timeupdate", () => {
      const currentTime = video.currentTime;
      if (currentMovieKey && currentTime > 5) {
        localStorage.setItem(`watch_time_${currentMovieKey}`, currentTime);
      }

      // Lưu tiến trình về backend mỗi 10 giây
      if (currentTime - lastSavedTime >= 10) {
        saveWatchProgress(currentMovieKey, currentTime, video.duration);
        lastSavedTime = currentTime;
      }
    });

    video.addEventListener("pause", () => {
      if (currentMovieKey && video.currentTime > 5) {
        localStorage.setItem(
          `watch_time_${currentMovieKey}`,
          video.currentTime,
        );
      }
      saveWatchProgress(currentMovieKey, video.currentTime, video.duration);
    });
  }
});
