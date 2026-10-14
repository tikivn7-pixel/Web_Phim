// ==========================================
// 5. CHỨC NĂNG TÌM KIẾM PHIM (SEARCH) & TÍCH HỢP TMDB API
// ==========================================

async function fetchMovieDataFromBackend(movieTitle) {
  try {
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
      const detailData = await detailRes.json();

      return detailData;
    }
    return null;
  } catch (error) {
    console.error("Lỗi đồng bộ dữ liệu TMDB từ Backend:", error);
    return null;
  }
}

function handleSearch(event) {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    event.stopPropagation(); // không cho module remote TV bắt thêm phím Enter này
    executeSearch();
  }
}

async function executeSearch() {
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

  const movies = await searchMoviesAPI(query, 40);
  addToGlobalMoviesList(movies);

  renderMovieGrid(
    searchContainer,
    movies,
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

  const movies = await fetchMovies({ genre: genreName, limit: 50 });
  addToGlobalMoviesList(movies);

  renderMovieGrid(
    container,
    movies,
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

  const movies = await fetchMovies({ country: countryName, limit: 50 });
  addToGlobalMoviesList(movies);

  renderMovieGrid(
    container,
    movies,
    `<div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
      <i class="fa-solid fa-earth-asia" style="font-size: 3rem; margin-bottom: 15px;"></i>
      <p>Hiện chưa có phim nào của quốc gia "${escapeHtml(countryName)}".</p>
    </div>`,
  );
}
