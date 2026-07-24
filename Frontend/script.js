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

// Bật / Tắt trạng thái yêu thích phim
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

  // Chỉ render lại nếu đang ở trang wishlist
  const wishlistPage = document.getElementById("page-wishlist");
  if (wishlistPage && wishlistPage.classList.contains("active")) {
    renderWishlistPage();
  }

  // Đồng bộ Backend nếu có
  toggleFavoriteBackend(movie.title);
}

// Đồng bộ Wishlist với Backend
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

// Cập nhật biểu tượng tim trên toàn bộ trang
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
      <img src="${movie.poster}" alt="${movie.title}" onerror="this.src='https://picsum.photos/350/500'" />
      <h4>${movie.title}</h4>
      <div class="movie-hover-card">
        <img src="${movie.poster}" alt="${movie.title}" class="hover-banner" onerror="this.src='https://picsum.photos/350/500'" />
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
  const heroSection = document.getElementById("hero-banner");
  const titleEl = document.getElementById("hero-title");
  const descEl = document.getElementById("hero-desc");
  const playBtn = document.getElementById("hero-play-btn");
  const infoBtn = document.getElementById("hero-info-btn");

  if (!heroSection) return;

  heroSection.style.backgroundImage = `url('${movie.banner}')`;
  if (titleEl) titleEl.innerText = movie.title;
  if (descEl) descEl.innerText = movie.desc;

  // Gán sự kiện trực tiếp cho 2 nút ở Hero
  if (playBtn) {
    playBtn.onclick = () =>
      playEpisode(movie.title, 1, movie.episodes, movie.slug);
  }
  if (infoBtn) {
    infoBtn.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        movie.episodes,
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
// 3. DỮ LIỆU & RENDER PHIM TRANG CHỦ
// ==========================================

const homeMoviesList = [
  {
    title: "Moving",
    poster: "Img/Moving.jpg",
    desc: "Nội dung bộ phim xoay quanh câu chuyện về Kim Bong Seok, Jang Hee Soo và Lee Gang Hoon...",
    episodes: 20,
    slug: "doi-thieu-nien-sieu-dang",
  },
  {
    title: "Can this love be translated",
    poster: "Img/Can_This_Love_Be_Translated.png",
    desc: "Bộ phim tình cảm lãng mạn đầy ngọt ngào.",
    episodes: 12,
    slug: "",
  },
  {
    title: "Queen of tears",
    poster: "Img/QueenOfTears.jpg",
    desc: "Nữ hoàng cửa hàng bách hóa và hoàng tử siêu thị xoay xở với khủng hoảng hôn nhân.",
    episodes: 16,
    slug: "",
  },
  {
    title: "Mouse",
    poster: "Img/Mouse.jpg",
    desc: "Cuộc truy đuổi giữa cảnh sát Jung Ba Reum và tên sát nhân biến thái.",
    episodes: 20,
    slug: "",
  },
  {
    title: "Twenty Five Twenty One",
    poster: "Img/2521.jpg",
    desc: "Câu chuyện thanh xuân tươi đẹp rực rỡ.",
    episodes: 16,
    slug: "",
  },
  {
    title: "My Liberation Notes",
    poster: "Img/Nhat_ky_tu_do_cua_toi.jpg",
    desc: "Mệt mỏi vì tuổi trưởng thành quá đỗi bình thường và đơn điệu, ba chị em tìm kiếm sự viên mãn và tự do trong cuộc sống tẻ nhạt của họ.",
    episodes: 16,
    slug: "",
  },
  {
    title: "My Liberation Notes",
    poster: "Img/Nhat_ky_tu_do_cua_toi.jpg",
    desc: "Mệt mỏi vì tuổi trưởng thành quá đỗi bình thường và đơn điệu, ba chị em tìm kiếm sự viên mãn và tự do trong cuộc sống tẻ nhạt của họ.",
    episodes: 16,
    slug: "",
  },
];

function renderHomePageMovies() {
  const container = document.getElementById("home-movie-slider");
  if (!container) return;

  container.innerHTML = "";

  homeMoviesList.forEach((movie) => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        movie.episodes,
        movie.slug,
      );

    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}" onerror="this.src='https://picsum.photos/350/500'" />
      <h4>${movie.title}</h4>
      <div class="movie-hover-card">
        <img src="${movie.poster}" alt="${movie.title}" class="hover-banner" onerror="this.src='https://picsum.photos/350/500'" />
        <div class="hover-content">
          <h3 class="hover-title">${movie.title}</h3>
          <div class="hover-actions">
            <button class="btn-hover play">
              <i class="fa-solid fa-play"></i> Xem ngay
            </button>
            <button 
              class="btn-hover icon" 
              title="Yêu thích"
              onclick="event.stopPropagation(); toggleWishlist({title: '${movie.title.replace(/'/g, "\\'")}', poster: '${movie.poster}', desc: '${(movie.desc || "").replace(/'/g, "\\'")}', episodes: ${movie.episodes || 20}, slug: '${movie.slug || ""}'})"
            >
              <i class="fa-regular fa-heart"></i>
            </button>
          </div>
          <p class="hover-genres">${movie.desc || ""}</p>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  updateWishlistUI();
}

// Server Video Streams
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

const tudoEpisodes = [
  "https://s3.phim1280.tv/20240601/T0YRlpKj/index.m3u8",
  "https://s3.phim1280.tv/20240601/icMeowKz/index.m3u8",
  "https://s3.phim1280.tv/20240601/zYJoiJlC/index.m3u8",
  "https://s3.phim1280.tv/20240601/j14s8xtK/index.m3u8",
  "https://s3.phim1280.tv/20240601/hZiW4Ofm/index.m3u8",
  "https://s3.phim1280.tv/20240601/NlK0PcpX/index.m3u8",
  "https://s3.phim1280.tv/20240601/pIbHqhEJ/index.m3u8",
  "https://s3.phim1280.tv/20240601/2cW8UPSk/index.m3u8",
  "https://s3.phim1280.tv/20240601/WUrAwXIr/index.m3u8",
  "https://s3.phim1280.tv/20240601/2lcHfOLD/index.m3u8",
  "https://s3.phim1280.tv/20240601/ke5GnQCx/index.m3u8",
  "https://s3.phim1280.tv/20240601/P4BgeCm3/index.m3u8",
  "https://s3.phim1280.tv/20240601/toCvNlpu/index.m3u8",
  "https://s3.phim1280.tv/20240601/OabLF56j/index.m3u8",
  "https://s3.phim1280.tv/20240601/kg6vJnZv/index.m3u8",
  "https://s3.phim1280.tv/20240601/FXp8Ji2Q/index.m3u8",
];

let hlsPlayer = null;
let currentMovieKey = "";

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// 1. Hiển thị thông tin trang Chi tiết
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

// 2. Hàm phát phim
async function playEpisode(
  movieTitle,
  episodeNum,
  totalEpisodes = 20,
  slug = "",
) {
  switchPage("watch");

  currentMovieKey = `${movieTitle}_Ep${episodeNum}`;

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
  } else if (movieTitle === "My Liberation Notes") {
    videoSrc = tudoEpisodes[episodeNum - 1];
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

// Load stream HLS
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
    keywordEl.innerText = `"${query}"`;
  }

  switchPage("search");

  const searchContainer = document.getElementById("search-container");
  if (!searchContainer) return;
  searchContainer.innerHTML = "";

  // Lọc từ mảng dữ liệu gốc thay vì clone DOM cũ để không mất sự kiện
  const filteredMovies = homeMoviesList.filter(
    (m) =>
      m.title.toLowerCase().includes(query) ||
      m.desc.toLowerCase().includes(query),
  );

  if (filteredMovies.length === 0) {
    searchContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 3rem; margin-bottom: 15px;"></i>
        <p>Không tìm thấy phim nào phù hợp với từ khóa "${query}".</p>
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
        movie.episodes,
        movie.slug,
      );

    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}" onerror="this.src='https://picsum.photos/350/500'" />
      <h4>${movie.title}</h4>
      <div class="movie-hover-card">
        <img src="${movie.poster}" alt="${movie.title}" class="hover-banner" onerror="this.src='https://picsum.photos/350/500'" />
        <div class="hover-content">
          <h3 class="hover-title">${movie.title}</h3>
          <div class="hover-actions">
            <button class="btn-hover play">
              <i class="fa-solid fa-play"></i> Xem ngay
            </button>
            <button 
              class="btn-hover icon" 
              title="Yêu thích"
              onclick="event.stopPropagation(); toggleWishlist({title: '${movie.title.replace(/'/g, "\\'")}', poster: '${movie.poster}', desc: '${(movie.desc || "").replace(/'/g, "\\'")}', episodes: ${movie.episodes || 20}, slug: '${movie.slug || ""}'})"
            >
              <i class="fa-regular fa-heart"></i>
            </button>
          </div>
          <p class="hover-genres">${movie.desc || ""}</p>
        </div>
      </div>
    `;
    searchContainer.appendChild(card);
  });

  updateWishlistUI();
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

  if (pageId === "wishlist") {
    renderWishlistPage();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // 1. Render danh sách phim ra Trang chủ
  renderHomePageMovies();

  // 2. Khởi tạo Auto Slider cho Hero Banner
  initHeroSlider();

  // 3. Xử lý Video Player & Tiến trình xem
  const video = document.getElementById("video-player");
  if (video) {
    let lastSavedTime = 0;

    video.addEventListener("timeupdate", () => {
      const currentTime = video.currentTime;
      if (currentMovieKey && currentTime > 5) {
        localStorage.setItem(`watch_time_${currentMovieKey}`, currentTime);
      }

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
