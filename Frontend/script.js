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
// 2. TẢI DỮ LIỆU TỪ THƯ MỤC JSON (DATA)
// ==========================================

const jsonFiles = [
  "2521.json",
  "can-this-love-be-translated.json",
  "mouse.json",
  "moving.json",
  "My-Liberation-Notes.json",
  "queen-of-tears.json",
  "Resident-Playbook.json",
  "We-Are-Trying-Here.json",
  "Teach-You-a-Lesson.json",
  "Twinkling Watermelon.json",
  "The WONDERfools.json",
  "Our Beloved Summer.json",
];

let globalMoviesList = [];

async function loadMoviesFromJSON() {
  const loadedMovies = [];

  for (const filename of jsonFiles) {
    try {
      const response = await fetch(`data/${filename}`);
      if (response.ok) {
        const movieData = await response.json();
        loadedMovies.push(movieData);
      } else {
        console.warn(`Không tìm thấy file: data/${filename}`);
      }
    } catch (err) {
      console.error(`Lỗi đọc file data/${filename}:`, err);
    }
  }

  globalMoviesList = loadedMovies;
  return globalMoviesList;
}

// ==========================================
// 3. HERO BANNER AUTO SLIDER (STYLE NETFLIX)
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
      playEpisode(movie.title, 1, movie.episodes || 20, movie.slug);
  }
  if (infoBtn) {
    infoBtn.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        movie.episodes || 20,
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
// 4. QUẢN LÝ VÀ RENDER "TIẾP TỤC XEM" (CONTINUE WATCHING)
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

  // Nếu xem gần xong (> 95%) thì xóa khỏi danh sách tiếp tục xem
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
    // Tìm lại thông tin phim từ danh sách tổng nếu thiếu poster
    const movieMeta =
      globalMoviesList.find((m) => m.title === item.title) || {};
    const posterSrc =
      item.poster || movieMeta.poster || "https://picsum.photos/350/500";

    const card = document.createElement("div");
    card.className = "movie-card";
    card.style.position = "relative";
    card.onclick = () =>
      playEpisode(item.title, item.episode, item.totalEpisodes, item.slug);

    card.innerHTML = `
      <img src="${posterSrc}" alt="${item.title}" onerror="this.src='https://picsum.photos/350/500'" />
      <h4>${item.title} - Tập ${item.episode}</h4>
      
      <!-- Thanh tiến trình xem dở -->
      <div style="width: 100%; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; margin-top: 5px; overflow: hidden;">
        <div style="width: ${item.progress}%; background: #e50914; height: 100%;"></div>
      </div>

      <div class="movie-hover-card">
        <img src="${posterSrc}" alt="${item.title}" class="hover-banner" onerror="this.src='https://picsum.photos/350/500'" />
        <div class="hover-content">
          <h3 class="hover-title">${item.title}</h3>
          <p style="color: #e50914; font-weight: bold; margin-bottom: 5px;">Đang xem: Tập ${item.episode}</p>
          <div class="hover-actions">
            <button class="btn-hover play">
              <i class="fa-solid fa-play"></i> Xem tiếp (${Math.floor(item.progress)}%)
            </button>
          </div>
          <p class="hover-genres">${item.desc || movieMeta.desc || ""}</p>
        </div>
      </div>
    `;
    slider.appendChild(card);
  });
}

// ==========================================
// 5. DỮ LIỆU EPISODES & NETFLIX PLAYER LOGIC
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
        movie.episodes || 20,
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

// Hiển thị thông tin trang Chi tiết
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

// Bật / Tắt Drawer danh sách tập phim
function toggleEpDrawer() {
  const drawer = document.getElementById("netflix-ep-drawer");
  if (drawer) {
    drawer.classList.toggle("open");
  }
}

// Hàm Báo Lỗi / Báo Cáo Sự Cố
function reportIssue() {
  const reason = prompt(
    "Báo cáo sự cố video:\n1. Video không chạy\n2. Mất tiếng / Lỗi vietsub\n3. Sai tập phim\n\nNhập chi tiết sự cố:",
    "Video bị giật / Không xem được",
  );
  if (reason) {
    alert("Cảm ơn bạn! Báo cáo sự cố đã được gửi tới Quản trị viên.");
  }
}

// Render danh sách tập vào Side Drawer trên Player
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

// Hàm phát phim
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

  // Render lưới chọn tập bên dưới video
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

  // Render danh sách tập vào Drawer góc phải Plyr
  renderDrawerEpisodes(movieTitle, episodeNum, totalEpisodes, slug);

  let videoSrc = "";

  if (movieTitle === "Moving") {
    videoSrc =
      typeof movingEpisodes !== "undefined"
        ? movingEpisodes[episodeNum - 1]
        : "";
  } else if (movieTitle === "Can this love be translated") {
    videoSrc =
      typeof ctlbtranslatedEpisodes !== "undefined"
        ? ctlbtranslatedEpisodes[episodeNum - 1]
        : "";
  } else if (movieTitle === "Queen of tears") {
    videoSrc =
      typeof QueenOfTearsEpisodes !== "undefined"
        ? QueenOfTearsEpisodes[episodeNum - 1]
        : "";
  } else if (movieTitle === "Mouse") {
    videoSrc =
      typeof mouseEpisodes !== "undefined" ? mouseEpisodes[episodeNum - 1] : "";
  } else if (movieTitle === "Twenty Five Twenty One") {
    videoSrc =
      typeof hailamEpisodes !== "undefined"
        ? hailamEpisodes[episodeNum - 1]
        : "";
  } else if (movieTitle === "My Liberation Notes") {
    videoSrc =
      typeof tudoEpisodes !== "undefined" ? tudoEpisodes[episodeNum - 1] : "";
  } else if (movieTitle === "We Are All Trying Here") {
    videoSrc =
      typeof weareEpisodes !== "undefined" ? weareEpisodes[episodeNum - 1] : "";
  } else if (movieTitle === "Resident Playbook") {
    videoSrc =
      typeof playbookEpisodes !== "undefined"
        ? playbookEpisodes[episodeNum - 1]
        : "";
  } else if (movieTitle === "Teach You a Lesson") {
    videoSrc =
      typeof teachyoualessonEpisodes !== "undefined"
        ? teachyoualessonEpisodes[episodeNum - 1]
        : "";
  } else if (movieTitle === "Twinkling Watermelon") {
    videoSrc =
      typeof twinklingwatermelonEpisodes !== "undefined"
        ? twinklingwatermelonEpisodes[episodeNum - 1]
        : "";
  } else if (movieTitle === "The WONDERfools") {
    videoSrc =
      typeof wonderfoolsEpisodes !== "undefined"
        ? wonderfoolsEpisodes[episodeNum - 1]
        : "";
  } else if (movieTitle === "Our Beloved Summer") {
    videoSrc =
      typeof obSummerEpisodes !== "undefined"
        ? obSummerEpisodes[episodeNum - 1]
        : "";
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

// Load stream HLS kết hợp Plyr.js Chuyên Nghiệp
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

    // Gắn sự kiện theo dõi tiến trình & cập nhật "Tiếp tục xem"
    let lastSavedTime = 0;
    plyrInstance.on("timeupdate", () => {
      const currentTime = video.currentTime;
      if (movieKey && currentTime > 5) {
        localStorage.setItem(`watch_time_${movieKey}`, currentTime);

        // Cập nhật vào danh sách Continue Watching mỗi 3 giây
        if (currentTime - lastSavedTime >= 3) {
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
          lastSavedTime = currentTime;
        }
      }

      if (currentTime - lastSavedTime >= 10) {
        saveWatchProgress(movieKey, currentTime, video.duration);
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
  }
}

// Chuyển sang Tập tiếp theo
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
// 6. CHỨC NĂNG TÌM KIẾM PHIM (SEARCH)
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

  const filteredMovies = globalMoviesList.filter(
    (m) =>
      m.title.toLowerCase().includes(query) ||
      (m.desc && m.desc.toLowerCase().includes(query)),
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
        movie.episodes || 20,
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
// 7. ĐIỀU HƯỚNG SPA & KHỞI TẠO TỔNG THỂ
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

// Phím tắt bàn phím kiểu Netflix
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

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Tải toàn bộ file JSON theo đúng tên file trên máy
  await loadMoviesFromJSON();

  // 2. Render danh sách phim ra Trang chủ
  renderHomePageMovies();

  // 3. Render khối "Tiếp tục xem" nếu có
  renderContinueWatching();

  // 4. Khởi tạo Auto Slider cho Hero Banner
  initHeroSlider();
});
