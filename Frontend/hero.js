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
