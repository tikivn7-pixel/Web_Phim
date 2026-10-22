// ==========================================
// 5. CHỨC NĂNG TÌM KIẾM PHIM (SEARCH) & TÍCH HỢP TMDB API
// ==========================================

// Key TMDB dùng gọi THẲNG từ trình duyệt (không cần chạy server).
// Điền API key (v3) vào TMDB_API_KEY trong data.js. Để rỗng -> dùng backend như cũ.
// Lưu ý: key đặt ở frontend thì ai mở web cũng xem được; TMDB key miễn phí nên thường chấp nhận được.
const TMDB_DIRECT_BASE = "https://api.themoviedb.org/3";

// Gọi thẳng TMDB, trả về cùng cấu trúc backend trả: { vote_average, director, cast, genres }
async function fetchMovieDataFromTMDBDirect(movieTitle) {
  if (typeof TMDB_API_KEY === "undefined" || !TMDB_API_KEY) return null;
  const q = (path, extra = {}) => {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: "vi-VN",
      ...extra,
    });
    return `${TMDB_DIRECT_BASE}${path}?${params.toString()}`;
  };

  const searchRes = await fetch(q("/search/multi", { query: movieTitle }));
  if (!searchRes.ok) throw new Error(`TMDB search lỗi ${searchRes.status}`);
  const searchData = await searchRes.json();
  const item = (searchData.results || []).find(
    (r) => r.media_type === "movie" || r.media_type === "tv",
  );
  if (!item) return null;

  const isTV = item.media_type === "tv";
  const detailRes = await fetch(
    q(`/${isTV ? "tv" : "movie"}/${item.id}`, {
      append_to_response: "credits",
    }),
  );
  if (!detailRes.ok) throw new Error(`TMDB detail lỗi ${detailRes.status}`);
  const d = await detailRes.json();

  const crew = (d.credits && d.credits.crew) || [];
  const director = isTV
    ? (d.created_by || []).map((p) => p.name).join(", ") ||
      (crew.find((c) => c.job === "Director") || {}).name ||
      ""
    : (crew.find((c) => c.job === "Director") || {}).name || "";
  const cast = ((d.credits && d.credits.cast) || [])
    .slice(0, 6)
    .map((c) => c.name)
    .join(", ");
  const genres = (d.genres || []).map((g) => g.name).join(", ");

  return { vote_average: d.vote_average, director, cast, genres };
}

// Gọi backend (cách cũ) - chỉ dùng khi không gọi thẳng TMDB được
async function fetchMovieDataFromBackendOnly(movieTitle) {
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
    return await detailRes.json();
  }
  return null;
}

// Giữ nguyên tên hàm cũ để tmdb.js / detail.html không phải sửa.
// Thứ tự: TMDB trực tiếp (không cần server) -> lỗi/không có key thì dùng backend.
async function fetchMovieDataFromBackend(movieTitle) {
  try {
    const direct = await fetchMovieDataFromTMDBDirect(movieTitle);
    if (direct) return direct;
  } catch (error) {
    console.warn("Gọi TMDB trực tiếp lỗi, thử qua backend:", error);
  }
  try {
    return await fetchMovieDataFromBackendOnly(movieTitle);
  } catch (error) {
    console.error("Lỗi đồng bộ dữ liệu TMDB:", error);
    return null;
  }
}

function handleSearch(event) {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    event.stopPropagation(); // không cho module remote TV bắt thêm phím Enter này
    // Đang highlight 1 gợi ý (↑ ↓) -> mở luôn phim đó
    if (typeof pickLiveSearchActive === "function" && pickLiveSearchActive()) {
      return;
    }
    executeSearch();
  }
}

// ==========================================
// Ô LỌC NĂM ở trang kết quả (tìm kiếm / thể loại / quốc gia)
// - Tự chèn phía trên lưới phim, KHÔNG cần sửa index.html
// - Chỉ liệt kê các năm thật sự có trong kết quả, kèm số phim: "2024 (35)"
// - Chọn năm -> lọc lại + vẽ lại lưới (có phân trang); phim chưa có year chỉ hiện ở "Tất cả năm"
// - Kết quả không phim nào có year (data.js chưa bù năm) -> ô lọc tự ẩn
// ==========================================
function ensureYearFilterStyle() {
  if (document.getElementById("year-filter-style")) return;
  const st = document.createElement("style");
  st.id = "year-filter-style";
  st.textContent = `
    .year-filter { display:flex; align-items:center; gap:10px; margin:0 0 18px; color:#bbb; font-size:15px; }
    .year-filter select {
      background:#222d36; color:#fff; border:1px solid #33424e; border-radius:4px;
      padding:8px 14px; font-size:15px; font-family:inherit; cursor:pointer;
    }
    .year-filter select:focus { outline:none; border-color:#e50914; }
    .year-filter select option { background:#222d36; color:#fff; }
  `;
  document.head.appendChild(st);
}

async function renderFilteredResults(container, options, emptyHtml) {
  const token = {};
  container._catalogRequest = token;
  if (container._pager) { container._pager.remove(); container._pager = null; }
  let bar = document.getElementById("search-year-filter");
  if (!bar) {
    ensureYearFilterStyle();
    bar = document.createElement("div");
    bar.id = "search-year-filter";
    bar.className = "year-filter";
    container.insertAdjacentElement("beforebegin", bar);
  }
  bar.innerHTML = "";
  const selected = { ...options, sort: options.sort || "updated" };
  let initial=true;
  const load = async (page = 1, scroll = false) => {
    const request = {};
    token.request = request;
    container.innerHTML = '<p style="color:#888;grid-column:1/-1">Đang tải...</p>';
    try {
      const [result, facets] = await Promise.all([
        fetchCatalogPage({ ...selected, page, limit: MOVIE_PAGE_SIZE }),
        getCatalogFilters(),
      ]);
      if (container._catalogRequest !== token || token.request !== request) return;
      if(typeof updateCatalogUrl==="function")updateCatalogUrl({...selected,page:result.currentPage},initial?(options._history||"push"):"push");
      initial=false;
      const heading = document.getElementById("search-keyword");
      if (heading) {
        const labels = [selected.q ? `"${selected.q}"` : "", selected.country ? "Quốc gia: " + selected.country : "", selected.genre ? "Thể loại: " + selected.genre : "", selected.year || ""];
        heading.textContent = labels.filter(Boolean).join(" · ") || "Khám phá phim";
      }
      addToGlobalMoviesList(result.movies);
      renderMovieGrid(container, result.movies, emptyHtml, { paginate: false });
      bar.innerHTML = "";
      bar.style.display = "";
      const addSelect = (key, title, choices, allLabel) => {
        const label = document.createElement("label");
        label.textContent = title + ": ";
        const select = document.createElement("select");
        select.dataset.filter = key;
        if (allLabel) select.add(new Option(allLabel, ""));
        choices.forEach(([value, text]) => select.add(new Option(text, value)));
        if (selected[key] && !choices.some(([value]) => String(value) === String(selected[key]))) select.add(new Option(selected[key], selected[key]));
        select.value = selected[key] || "";
        select.onchange = () => { selected[key] = select.value; load(1); };
        label.appendChild(select);
        bar.appendChild(label);
      };
      addSelect("country", "Quốc gia", facets.countries.map(c => [c,c]), "Tất cả");
      addSelect("genre", "Thể loại", facets.genres.map(g => [g,g]), "Tất cả");
      addSelect("year", "Năm", result.years.map(y => [y.year, y.year + " (" + y.count + ")"]), "Tất cả");
      addSelect("type", "Loại phim", [["series","Phim bộ"],["single","Phim lẻ"],["animation","Anime / Hoạt hình"],["tvshows","TV Show"]], "Tất cả");
      addSelect("sort", "Sắp xếp", [["updated","Mới cập nhật"],["year","Năm mới nhất"],["title","Tên A–Z"]]);
      const reset = document.createElement("button");
      reset.textContent = "Xóa bộ lọc";
      reset.onclick = () => { ["country","genre","year","type"].forEach(key => delete selected[key]); selected.sort = "updated"; load(1); };
      const count = document.createElement("span");
      count.className = "catalog-result-count";
      count.setAttribute("aria-live", "polite");
      count.textContent = result.totalItems + " phim";
      bar.append(reset, count);
      if (result.totalPages > 1) {
        ensurePaginationStyle();
        const pager = document.createElement("div");
        pager.className = "movie-pagination";
        container.insertAdjacentElement("afterend", pager);
        container._pager = pager;
        drawPager(pager, result.currentPage, result.totalPages, load);
      }
      if (scroll) container.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      if (container._catalogRequest !== token || token.request !== request) return;
      if (container._pager) { container._pager.remove(); container._pager = null; }
      container.innerHTML = "";
      const message = document.createElement("p");
      message.style.cssText = "color:#ddd;grid-column:1/-1";
      message.textContent = err.message;
      const retry = document.createElement("button");
      retry.textContent = "Thử lại";
      retry.onclick = () => load(page);
      container.append(message, retry);
    }
  };
  await load(Number(options.page)||1);
}

function showCatalog(options = {}) {
  if (!document.getElementById("page-search")) {
    window.location.href = "index.html?" + new URLSearchParams(options);
    return;
  }
  if (typeof closeMobileMenu === "function") closeMobileMenu();
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  document.getElementById("page-search").classList.add("active");
  document.getElementById("search-keyword").textContent = "Khám phá phim";
  return renderFilteredResults(document.getElementById("search-container"), options,
    '<p style="grid-column:1/-1;color:#aaa">Không có phim phù hợp. Thử đổi bộ lọc nhé.</p>');
}

async function executeSearch() {
  if (typeof closeLiveSearch === "function") closeLiveSearch();
  const inputEl = document.getElementById("search-input");
  const query = inputEl ? inputEl.value.trim() : "";

  if (!query) return;

  // Đang ở detail.html / watch.html (không có trang kết quả) -> sang index.html
  if (!document.getElementById("page-search")) {
    window.location.href = `index.html?q=${encodeURIComponent(query)}`;
    return;
  }

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



  renderFilteredResults(
    searchContainer,
    { q: query },
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
  if (!document.getElementById("page-search")) {
    window.location.href = `index.html?genre=${encodeURIComponent(genreName)}`;
    return;
  }

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



  renderFilteredResults(
    container,
    { genre: genreName },
    `<div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
      <i class="fa-solid fa-film" style="font-size: 3rem; margin-bottom: 15px;"></i>
      <p>Hiện chưa có phim nào thuộc thể loại "${escapeHtml(genreName)}".</p>
    </div>`,
  );
}

// ==========================================
// 6B. CHỨC NĂNG LỌC PHIM THEO QUỐC GIA (COUNTRY FILTER)
// ==========================================
async function filterByCountry(countryName) {
  if (!document.getElementById("page-search")) {
    window.location.href = `index.html?country=${encodeURIComponent(countryName)}`;
    return;
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  const searchPage = document.getElementById("page-search");
  if (searchPage) {
    searchPage.classList.add("active");
  }

  const keywordEl = document.getElementById("search-keyword");
  if (keywordEl) {
    keywordEl.innerText = `Quốc gia: ${countryName}`;
  }

  const container = document.getElementById("search-container");
  if (!container) return;
  container.innerHTML = `<p style="color:#888; grid-column:1/-1;">Đang tải...</p>`;



  renderFilteredResults(
    container,
    { country: countryName },
    `<div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
      <i class="fa-solid fa-earth-asia" style="font-size: 3rem; margin-bottom: 15px;"></i>
      <p>Hiện chưa có phim nào của quốc gia "${escapeHtml(countryName)}".</p>
    </div>`,
  );
}

// ==========================================
// 5B. TÌM KIẾM NHANH REALTIME (LIVE SEARCH DROPDOWN)
// ==========================================
// Gõ vào ô tìm kiếm trên Navbar -> hiện ngay khung gợi ý (poster nhỏ, tên, năm)
// ngay bên dưới, chưa cần chuyển trang.
//  - Gõ từ 2 ký tự, chờ 250ms sau lần gõ cuối mới gọi API (debounce)
//  - ↑ ↓ chọn gợi ý, Enter mở phim đó, Esc đóng, bấm ra ngoài cũng đóng
//  - Dòng cuối "Xem tất cả kết quả" = tìm đầy đủ như bấm kính lúp
// Không cần sửa HTML: khung gợi ý tự được tạo bên trong .search-box.
const LIVE_SEARCH_MIN_CHARS = 2;
const LIVE_SEARCH_DELAY_MS = 250;
const LIVE_SEARCH_LIMIT = 6;

let liveSearchBox = null; // khung dropdown
let liveSearchItems = []; // danh sách phim đang hiển thị
let liveSearchActive = -1; // vị trí đang highlight (-1 = chưa chọn)
let liveSearchTimer = null;
let liveSearchReqId = 0; // chống kết quả cũ về trễ ghi đè kết quả mới

function closeLiveSearch() {
  clearTimeout(liveSearchTimer);
  liveSearchReqId++; // huỷ các request đang chờ
  liveSearchItems = [];
  liveSearchActive = -1;
  if (liveSearchBox) {
    liveSearchBox.classList.remove("open");
    liveSearchBox.innerHTML = "";
  }
}

// Mở trang chi tiết của gợi ý đang highlight. Trả về true nếu có chọn.
function pickLiveSearchActive() {
  const movie = liveSearchItems[liveSearchActive];
  if (!movie) return false;
  openLiveSearchMovie(movie);
  return true;
}

function openLiveSearchMovie(movie) {
  closeLiveSearch();
  showDetail(
    movie.title,
    movie.poster,
    movie.desc,
    getTotalEpisodes(movie),
    movie.slug,
  );
}

function setLiveSearchActive(index) {
  if (!liveSearchBox) return;
  liveSearchActive = index;
  liveSearchBox.querySelectorAll(".ss-item").forEach((el, i) => {
    el.classList.toggle("active", i === index);
    if (i === index) el.scrollIntoView({ block: "nearest" });
  });
}

function renderLiveSearch(movies, query) {
  if (!liveSearchBox) return;
  liveSearchItems = movies;
  liveSearchActive = -1;

  if (movies.length === 0) {
    liveSearchBox.innerHTML = `<div class="ss-empty">Không tìm thấy phim phù hợp với "${escapeHtml(query)}"</div>`;
    liveSearchBox.classList.add("open");
    return;
  }

  liveSearchBox.innerHTML = "";

  movies.forEach((movie, index) => {
    const item = document.createElement("div");
    item.className = "ss-item";

    // Dòng phụ: năm · quốc gia (hoặc thể loại đầu tiên nếu chưa có quốc gia)
    const extra =
      getMovieCountry(movie) || (movie.genres || "").split(",")[0].trim();
    const meta = [movie.year, extra].filter(Boolean).join(" · ");

    item.innerHTML = `
      <img src="${movie.poster}" alt="" onerror="this.src='https://placehold.co/80x110'" />
      <div class="ss-info">
        <div class="ss-title">${escapeHtml(movie.title)}</div>
        <div class="ss-meta">${escapeHtml(meta)}</div>
      </div>
    `;
    item.addEventListener("click", () => openLiveSearchMovie(movie));
    item.addEventListener("mouseenter", () => setLiveSearchActive(index));
    liveSearchBox.appendChild(item);
  });

  const more = document.createElement("div");
  more.className = "ss-more";
  more.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Xem tất cả kết quả cho "${escapeHtml(query)}"`;
  more.addEventListener("click", () => executeSearch());
  liveSearchBox.appendChild(more);

  liveSearchBox.classList.add("open");
}

async function runLiveSearch(query) {
  const reqId = ++liveSearchReqId;
  try {
    const movies = await searchMoviesAPI(query, LIVE_SEARCH_LIMIT);
    if (reqId !== liveSearchReqId) return; // đã có lần gõ mới hơn
    addToGlobalMoviesList(movies);
    renderLiveSearch(movies.slice(0, LIVE_SEARCH_LIMIT), query);
  } catch (err) {
    console.warn("Live search lỗi:", err);
    if (reqId === liveSearchReqId) closeLiveSearch();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("search-input");
  if (!input) return;
  const box = input.closest(".search-box");
  if (!box) return;

  liveSearchBox = document.createElement("div");
  liveSearchBox.className = "search-suggest";
  // mousedown preventDefault: bấm vào gợi ý không làm ô nhập mất focus
  liveSearchBox.addEventListener("mousedown", (e) => e.preventDefault());
  box.appendChild(liveSearchBox);

  input.setAttribute("autocomplete", "off");

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(liveSearchTimer);
    if (q.length < LIVE_SEARCH_MIN_CHARS) {
      closeLiveSearch();
      return;
    }
    liveSearchTimer = setTimeout(() => runLiveSearch(q), LIVE_SEARCH_DELAY_MS);
  });

  input.addEventListener("keydown", (e) => {
    const open = liveSearchBox.classList.contains("open");
    if (e.key === "Escape") {
      closeLiveSearch();
    } else if (open && liveSearchItems.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation(); // không cho remote TV (tv-nav.js) bắt phím mũi tên
        const n = liveSearchItems.length;
        const next =
          e.key === "ArrowDown"
            ? (liveSearchActive + 1) % n
            : (liveSearchActive - 1 + n) % n;
        setLiveSearchActive(next);
      }
    }
  });

  // Gõ lại / quay lại ô tìm kiếm thì hiện lại gợi ý nếu còn nội dung
  input.addEventListener("focus", () => {
    const q = input.value.trim();
    if (q.length >= LIVE_SEARCH_MIN_CHARS && liveSearchItems.length === 0) {
      runLiveSearch(q);
    } else if (liveSearchItems.length > 0) {
      liveSearchBox.classList.add("open");
    }
  });

  // Bấm ra ngoài thì đóng (giữ lại nội dung ô nhập)
  document.addEventListener("click", (e) => {
    if (!box.contains(e.target)) {
      liveSearchBox.classList.remove("open");
    }
  });
});
