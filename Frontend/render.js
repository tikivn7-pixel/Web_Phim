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
  card.dataset.slug = movie.slug || "";
  card.onclick = () =>
    showDetail(
      movie.title,
      movie.poster,
      movie.desc,
      getTotalEpisodes(movie),
      movie.slug,
    );

  // User/provider text is assigned through DOM properties, never inline handlers.
  const link=document.createElement("a");link.className="movie-card-link";
  link.href=SiteTools.detailUrl(movie);link.setAttribute("aria-label","Thông tin phim: "+movie.title);
  link.onclick=event=>{event.stopPropagation();if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();card.onclick();}};
  const img=document.createElement("img");img.alt=movie.title||"Poster phim";
  img.loading="lazy";img.decoding="async";img.width=180;img.height=270;img.referrerPolicy="no-referrer";
  SiteTools.setPoster(img,{},movie);
  const poster=document.createElement('span');poster.className='movie-poster';
  const type=document.createElement('span');type.className='poster-type';
  const kind=getCatalogType(movie);type.textContent=({animation:/anime/i.test(movie.genres||'')?'Anime':'Hoạt hình',single:'Phim lẻ',series:'Phim bộ',tvshows:'TV Show'})[kind]||'Phim';
  const episodes=document.createElement('span');episodes.className='poster-episodes';episodes.textContent=kind==='single'?'Phim lẻ':Number.isInteger(movie.availableEpisodes)?movie.availableEpisodes+' / '+getTotalEpisodes(movie)+' tập':getTotalEpisodes(movie)+' tập';
  const play=document.createElement('span');play.className='poster-play';play.textContent='▶';play.setAttribute('aria-hidden','true');poster.append(img,type,episodes,play);
  const heading=document.createElement("h4");heading.textContent=movie.title;link.append(poster,heading);
  const heart=document.createElement("button");heart.type="button";heart.className="card-heart";heart.dataset.wishKey=movieKey(movie);
  heart.setAttribute("aria-label","Yêu thích: "+movie.title);heart.innerHTML='<span class="heart-symbol" aria-hidden="true">♡</span>';
  heart.onclick=event=>{event.stopPropagation();toggleWishlist(movie);};
  const meta=document.createElement("p");meta.className="movie-card-meta";
  meta.textContent=[movie.year,getMovieCountry(movie)].filter(Boolean).join(" · ");
  const views=document.createElement("div");views.className="movie-views";views.textContent=formatViews(movie.views,{compact:true})+" lượt xem";
  views.hidden=!(Number(movie.views)>0);
  const hover=document.createElement("div");hover.className="movie-hover-card";hover.setAttribute("aria-hidden","true");
  const content=document.createElement("div");content.className="hover-content";
  const title=document.createElement("h3");title.className="hover-title";title.textContent=movie.title;
  const description=document.createElement("p");description.className="hover-genres";description.textContent=movie.desc||movie.genres||"";
  content.append(title,description);hover.append(content);card.append(link,heart,meta,views,hover);
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
    if(extraClass==="active"){b.setAttribute("aria-current","page");b.disabled=true;}
    else b.setAttribute("aria-label","Đến trang "+page);
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

  const relatedParts = globalMoviesList.filter((m) => m.group === currentGroup)
    .sort((a,b)=>(a.relationOrder??9999)-(b.relationOrder??9999));

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

function renderRelatedSuggestions(currentSlug, currentGenres, recommendations) {
  const container = document.getElementById("fd-suggestions");
  if (!container) return;

  const genreList = (currentGenres || "")
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);

  const related = recommendations || globalMoviesList
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
    const item = document.createElement("a");
    item.className = "fd-suggest-item";
    item.href=SiteTools.detailUrl(movie);item.style.cssText="color:inherit;text-decoration:none";
    item.onclick = event => {
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        getTotalEpisodes(movie),
        movie.slug,
      );
    };
    item.innerHTML = `
      <img alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
      <div class="fd-suggest-info">
        <h4>${escapeHtml(movie.title)}</h4>
        <span>${escapeHtml((movie.genres || "").split(",")[0] || "")}</span>
      </div>
    `;
    const image=item.querySelector("img");image.src=SiteTools.imageUrl(movie.poster);image.dataset.fallback=SiteTools.imageUrl(movie.remotePoster||movie.banner);image.onerror=()=>handleMovieImageError(image);
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
