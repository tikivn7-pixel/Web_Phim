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

  if(typeof rememberCatalogReturn==="function")rememberCatalogReturn(params);
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

  if(typeof rememberCatalogReturn==="function")rememberCatalogReturn(params);
  window.location.href = `watch.html?${params.toString()}`;
}

// Dựng 1 thẻ phim (card) dùng chung cho tất cả các slider/search/genre-filter
function createMovieCard(movie) {
  const card = document.createElement("div");
  card.className = "movie-card";
  card.dataset.title = movie.title;
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
  const imageFallback = escapeHtml(movie.remotePoster || movie.banner || "");
  const handlerTitle = escapeForInlineHandler(movie.title);
  const handlerDesc = escapeForInlineHandler(movie.desc || "");

  card.innerHTML = `
    <img src="${movie.poster}" data-fallback="${imageFallback}" alt="${safeTitle}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="handleMovieImageError(this)" />
    ${cardHeartHtml(movie)}
    <h4>${safeTitle}</h4>
    <div class="movie-views"><i class="fa-regular fa-eye"></i> ${formatViews(movie.views, { compact: true })} lượt xem</div>
    <div class="movie-hover-card">
      <img src="${movie.poster}" data-fallback="${imageFallback}" alt="${safeTitle}" class="hover-banner" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="handleMovieImageError(this)" />
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

// ---------- PHÂN TRANG: "Trang 1 của 76  [1] [2] [3] [4] [5]  Trang Cuối" ----------
// Số phim mỗi trang (24 chia hết cho 8/6/4/3 cột nên hàng cuối không bị lẻ). Đổi số này nếu muốn nhiều/ít hơn.
const MOVIE_PAGE_SIZE = 24;
// Mỗi slider ở trang chủ chỉ vẽ tối đa bấy nhiêu phim (slider KHÔNG phân trang)
const HOME_SLIDER_LIMIT = 20;

// CSS cho thanh phân trang (tự chèn 1 lần, khỏi sửa style.css; muốn đổi màu thì sửa ở đây)
function ensurePaginationStyle() {
  if (document.getElementById("movie-pagination-style")) return;
  const st = document.createElement("style");
  st.id = "movie-pagination-style";
  st.textContent = `
    .movie-pagination { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:10px; margin:28px 0 12px; }
    .movie-pagination .mp-btn, .movie-pagination .mp-info {
      border:0; border-radius:3px; padding:10px 18px; background:#222d36; color:#9aa6af;
      font-size:15px; font-weight:600; font-family:inherit; line-height:1;
    }
    .movie-pagination .mp-btn { cursor:pointer; min-width:40px; transition:background .15s, color .15s; }
    .movie-pagination .mp-btn:hover { background:#33424e; color:#fff; }
    .movie-pagination .mp-btn.active { background:#b3202a; color:#fff; cursor:default; }
  `;
  document.head.appendChild(st);
}

// Vẽ lại thanh phân trang: Trang X của N | [Trang Đầu] | 5 số trang quanh trang hiện tại | [Trang Cuối]
function drawPager(pager, current, total, goTo) {
  pager.innerHTML = "";

  const info = document.createElement("span");
  info.className = "mp-info";
  info.textContent = `Trang ${current} của ${total}`;
  pager.appendChild(info);

  const add = (label, page, extraClass = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `mp-btn ${extraClass}`.trim();
    b.textContent = label;
    b.onclick = () => goTo(page, true);
    pager.appendChild(b);
  };

  if (current > 1) add("Trang Đầu", 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  for (let p = start; p <= end; p++)
    add(String(p), p, p === current ? "active" : "");
  if (current < total) add("Trang Cuối", total);
}

// Render 1 danh sách phim vào 1 container, có thể truyền HTML hiển thị khi rỗng.
// Mặc định: danh sách dài hơn MOVIE_PAGE_SIZE thì tự chia trang (thanh phân trang nằm ngay dưới container).
// Truyền { paginate: false } để vẽ hết, không chia trang (dùng cho các slider trang chủ).
function renderMovieGrid(container, movies, emptyHtml = "", options = {}) {
  if (!container) return;
  container.innerHTML = "";

  // dọn thanh phân trang của lần render trước (vd khi đổi bộ lọc / tìm kiếm lại)
  if (container._pager) {
    container._pager.remove();
    container._pager = null;
  }

  if (!movies || movies.length === 0) {
    if (emptyHtml) container.innerHTML = emptyHtml;
    return;
  }

  if (options.paginate === false) {
    movies.forEach((movie) => container.appendChild(createMovieCard(movie)));
    updateWishlistUI();
    return;
  }

  const totalPages = Math.ceil(movies.length / MOVIE_PAGE_SIZE);
  let pager = null;

  const goTo = (page, scroll) => {
    page = Math.min(Math.max(1, page), totalPages);
    container.innerHTML = "";
    const frag = document.createDocumentFragment();
    movies
      .slice((page - 1) * MOVIE_PAGE_SIZE, page * MOVIE_PAGE_SIZE)
      .forEach((movie) => frag.appendChild(createMovieCard(movie)));
    container.appendChild(frag);
    updateWishlistUI();
    if (pager) drawPager(pager, page, totalPages, goTo);
    if (scroll)
      container.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  goTo(1, false);

  if (totalPages > 1) {
    ensurePaginationStyle();
    pager = document.createElement("div");
    pager.className = "movie-pagination";
    container.insertAdjacentElement("afterend", pager);
    container._pager = pager;
    drawPager(pager, 1, totalPages, goTo);
  }
}

// "Phim Mới Cập Nhật" - trả về movies đã fetch để dùng chung cho Hero Banner
async function renderHomePageMovies() {
  const container = document.getElementById("home-movie-slider");
  const movies = await loadSliderMovies(container, { limit: 20, sort: "updated" });
  if (!movies) return [];
  addToGlobalMoviesList(movies);
  const note = document.getElementById("home-updates-note");
  if (note) note.hidden = movies.some(movie => movie.updatedAt || movie.addedAt);
  renderMovieGrid(container, (movies || []).slice(0, HOME_SLIDER_LIMIT), "", {
    paginate: false,
  });
  return movies;
}

async function renderAnimeMovies() {
  const container = document.getElementById("anime-movie-slider");
  if (!container) return;
  const movies = await loadSliderMovies(container, { type: "animation", limit: 20, sort: "updated" });
  if (!movies) return [];
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, (movies || []).slice(0, HOME_SLIDER_LIMIT), "", {
    paginate: false,
  });
}

async function renderKoreanMovies() {
  const container = document.getElementById("korean-movie-slider");
  if (!container) return;
  const movies = await loadSliderMovies(container, { country: "Hàn Quốc", limit: 20 });
  if (!movies) return [];
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, (movies || []).slice(0, HOME_SLIDER_LIMIT), "", {
    paginate: false,
  });
}

async function renderActionMovies() {
  const container = document.getElementById("action-movie-slider");
  if (!container) return;
  const movies = await loadSliderMovies(container, { genre: "Hành Động", limit: 20 });
  if (!movies) return [];
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, (movies || []).slice(0, HOME_SLIDER_LIMIT), "", {
    paginate: false,
  });
}

async function renderRomanceMovies() {
  const container = document.getElementById("romance-movie-slider");
  if (!container) return;
  const movies = await loadSliderMovies(container, { genre: "Tình Cảm", limit: 20 });
  if (!movies) return [];
  addToGlobalMoviesList(movies);
  renderMovieGrid(container, (movies || []).slice(0, HOME_SLIDER_LIMIT), "", {
    paginate: false,
  });
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
      <img src="${movie.poster}" data-fallback="${escapeHtml(movie.remotePoster || movie.banner || "")}" alt="${escapeHtml(movie.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="handleMovieImageError(this)" />
      <div class="fd-suggest-info">
        <h4>${escapeHtml(movie.title)}</h4>
        <span>${escapeHtml((movie.genres || "").split(",")[0] || "")}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

async function loadSliderMovies(container, options) {
  try { return await fetchMovies(options); }
  catch (err) {
    console.error(err);
    if (container) {
      container.textContent = err.message;
      const retry = document.createElement("button");
      retry.textContent = "Thử lại";
      retry.onclick = () => window.location.reload();
      container.appendChild(retry);
    }
    return null;
  }
}
