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
  const handlerTitle = escapeForInlineHandler(movie.title);
  const handlerDesc = escapeForInlineHandler(movie.desc || "");

  card.innerHTML = `
    <img src="${movie.poster}" alt="${safeTitle}" onerror="this.src='https://placehold.co/350x500'" />
    ${cardHeartHtml(movie)}
    <h4>${safeTitle}</h4>
    <div class="movie-views"><i class="fa-regular fa-eye"></i> ${formatViews(movie.views, { compact: true })} lượt xem</div>
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
  const movies = await fetchMovies({ country: "Hàn Quốc", limit: 20 });
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
