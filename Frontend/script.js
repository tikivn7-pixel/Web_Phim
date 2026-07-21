// ==========================================
// 1. CÁC HÀM XỬ LÝ AUTH & WATCHLIST
// ==========================================

async function login(email, password) {
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
    alert(data.message);
  }
}

async function toggleFavorite(movieId) {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Vui lòng đăng nhập trước!");
    return;
  }

  const response = await fetch("http://localhost:5000/api/watchlist/toggle", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ movieId }),
  });

  const data = await response.json();
  alert(data.message);
}

function saveWatchProgress(movieId, currentTime, duration) {
  const token = localStorage.getItem("token");
  if (!token) return;

  fetch("http://localhost:5000/api/history", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      movieId: movieId,
      progressSeconds: Math.floor(currentTime),
      durationSeconds: Math.floor(duration),
    }),
  });
}

// ==========================================
// 2. DỮ LIỆU & QUẢN LÝ PHÁT VIDEO
// ==========================================

const movingEpisodes = [
  "https://s6.kkphimplayer6.com/20250721/ZsGU1yen/index.m3u8", // Tập 1
  "https://s6.kkphimplayer6.com/20250721/nanxjdoM/index.m3u8", // Tập 2
  "https://s6.kkphimplayer6.com/20250721/NZChSyHi/index.m3u8", // Tập 3
  "https://s6.kkphimplayer6.com/20250721/OwLqz4td/index.m3u8", // Tập 4
  "https://s6.kkphimplayer6.com/20250721/3trueqtW/index.m3u8", // Tập 5
  "https://s6.kkphimplayer6.com/20250721/Rt0DznhK/index.m3u8", // Tập 6
  "https://s6.kkphimplayer6.com/20250721/pMSvodOY/index.m3u8", // Tập 7
  "https://s6.kkphimplayer6.com/20250721/ul107cYj/index.m3u8", // Tập 8
  "https://s6.kkphimplayer6.com/20250721/xmfAAxhm/index.m3u8", // Tập 9
  "https://s6.kkphimplayer6.com/20250721/43m4RrFQ/index.m3u8", // Tập 10
  "https://s6.kkphimplayer6.com/20250721/8ntg8cr2/index.m3u8", // Tập 11
  "https://s6.kkphimplayer6.com/20250721/4FyDbkVh/index.m3u8", // Tập 12
  "https://s6.kkphimplayer6.com/20250721/2gvbd2Oe/index.m3u8", // Tập 13
  "https://s6.kkphimplayer6.com/20250721/ChCCG6wj/index.m3u8", // Tập 14
  "https://s6.kkphimplayer6.com/20250721/b3dra7GF/index.m3u8", // Tập 15
  "https://s6.kkphimplayer6.com/20250721/gKDlipbP/index.m3u8", // Tập 16
  "https://s6.kkphimplayer6.com/20250721/8w28JAuC/index.m3u8", // Tập 17
  "https://s6.kkphimplayer6.com/20250721/Jm7mUJFS/index.m3u8", // Tập 18
  "https://s6.kkphimplayer6.com/20250721/u5PkzgGn/index.m3u8", // Tập 19
  "https://s6.kkphimplayer6.com/20250721/lIaOCKDm/index.m3u8", // Tập 20
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

let hlsPlayer = null;
let currentMovieKey = ""; // Lưu tên phim + tập đang xem

// Hàm chuyển đổi giây thành định dạng MM:SS hoặc HH:MM:SS
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

  // Tạo ID định danh duy nhất cho tập phim (Ví dụ: "Moving_Ep1")
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

  // Tải video và kiểm tra đoạn xem dở
  loadHlsVideo(videoSrc, currentMovieKey);
}

// Hàm bổ trợ load link m3u8 vào video player + Xử lý xem tiếp
function loadHlsVideo(videoSrc, movieKey) {
  const video = document.getElementById("video-player");
  if (!video) return;

  // Lấy thời gian xem dở đã lưu trong LocalStorage (nếu có)
  const savedTime = localStorage.getItem(`watch_time_${movieKey}`);

  const startPlay = () => {
    if (savedTime && parseFloat(savedTime) > 5) {
      const formattedTime = formatTime(parseFloat(savedTime));
      // Hiển thị hộp thoại hỏi người dùng
      const confirmResume = confirm(
        `Bạn đã dừng lại ở phút [${formattedTime}]. Bạn có muốn xem tiếp không?`,
      );
      if (confirmResume) {
        video.currentTime = parseFloat(savedTime); // Tua đến đoạn xem dở
      }
    }
    video.play();
  };

  if (Hls.isSupported()) {
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
// 3. ĐIỀU HƯỚNG SPA & KHỞI TẠO VIDEO PLAYER
// ==========================================

function switchPage(pageId) {
  // NẾU RỜI KHỎI TRANG WATCH -> LƯU VỊ TRÍ PHIM VÀ TẮT VIDEO
  if (pageId !== "watch") {
    const video = document.getElementById("video-player");
    if (video) {
      // Lưu số giây hiện tại vào máy
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
}

document.addEventListener("DOMContentLoaded", () => {
  // Bấm LogoPhimForLinh -> Về trang chủ & Lưu thời gian phát dở
  const logo =
    document.querySelector(".logo") ||
    document.querySelector("header h1") ||
    document.querySelector("header a");
  if (logo) {
    logo.addEventListener("click", (e) => {
      e.preventDefault();
      switchPage("home");
    });
  }

  const video = document.getElementById("video-player");
  const currentMovieId = "12345";

  if (video) {
    let lastSavedTime = 0;

    video.addEventListener("timeupdate", () => {
      const currentTime = video.currentTime;
      // Tự động lưu tiến trình vào LocalStorage liên tục mỗi khi phát
      if (currentMovieKey && currentTime > 5) {
        localStorage.setItem(`watch_time_${currentMovieKey}`, currentTime);
      }

      if (currentTime - lastSavedTime >= 10) {
        saveWatchProgress(currentMovieId, currentTime, video.duration);
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
      saveWatchProgress(currentMovieId, video.currentTime, video.duration);
    });
  }
});
