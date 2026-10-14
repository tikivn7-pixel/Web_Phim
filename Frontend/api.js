// ==========================================
// 0C. GỌI API PHIM TỪ BACKEND (thay cho data hardcode)
// ==========================================

// Chuẩn hóa 1 dòng dữ liệu trả về từ MySQL API thành đúng cấu trúc
// mà toàn bộ code render/wishlist/continue-watching bên dưới đang dùng
function normalizeMovie(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    poster: row.poster,
    banner: row.banner || row.poster,
    desc: row.description,
    genres: row.genres,
    country: row.country || row.quoc_gia || "", // Quốc gia (tách riêng khỏi thể loại)
    views: Number(row.views) || 0, // Lượt xem
    episodes: row.total_episodes,
    group: row.movie_group,
    partName: row.part_name,
  };
}

// Danh sách Quốc Gia hiển thị ở menu (khớp với giá trị cột country trong DB)
const COUNTRIES = [
  "Trung Quốc",
  "Hàn Quốc",
  "Mỹ",
  "Nhật Bản",
  "Việt Nam",
  "Thái Lan",
  "Anh",
  "Pháp",
  "Đài Loan",
  "Hồng Kông",
  "Ấn Độ",
];

// Lấy quốc gia của 1 phim. Dữ liệu hardcode cũ chưa có trường country (quốc
// gia nằm lẫn trong genres) nên tự dò thêm trong genres để dùng làm dự phòng.
function getMovieCountry(movie) {
  if (!movie) return "";
  if (movie.country) return movie.country;
  const genres = (movie.genres || "").toLowerCase();
  return COUNTRIES.find((c) => genres.includes(c.toLowerCase())) || "";
}

// Xác định nguồn dữ liệu sẽ dùng: "auto" (mặc định, SQL trước - lỗi thì
// rớt về hardcode), "hardcode" (ép dùng hardcode, bỏ qua API - test UI
// nhanh không cần chạy backend), "sql" (ép chỉ dùng MySQL, KHÔNG tự rớt
// về hardcode kể cả khi lỗi/rỗng - để thấy đúng lỗi thật khi test SQL).
// Nếu không truyền source trong code, tự đọc từ URL: ?data_source=hardcode
// hoặc ?data_source=sql, tiện để ép nguồn ngay trên trình duyệt khi test.
function resolveDataSource(explicitSource) {
  if (explicitSource === "hardcode" || explicitSource === "sql") {
    return explicitSource;
  }
  try {
    const urlSource = new URLSearchParams(window.location.search).get(
      "data_source",
    );
    if (urlSource === "hardcode" || urlSource === "sql") return urlSource;
  } catch (e) {
    // window.location không khả dụng (vd chạy ngoài trình duyệt) -> bỏ qua
  }
  return "auto";
}

// Lấy danh sách phim có phân trang, có thể lọc theo thể loại
async function fetchMovies({
  page = 1,
  limit = 20,
  genre = null,
  country = null,
  group = null,
  source = "auto",
} = {}) {
  const dataSource = resolveDataSource(source);

  if (dataSource === "hardcode") {
    return filterFallbackMovies({ genre, country, group });
  }

  try {
    const params = new URLSearchParams({ page, limit });
    if (genre) params.set("genre", genre);
    if (country) params.set("country", country);
    if (group) params.set("group", group);
    const res = await fetch(`${API_BASE_URL}/api/movies?${params.toString()}`);
    if (!res.ok) throw new Error(`API /api/movies lỗi ${res.status}`);
    const data = await res.json();
    const movies = (data.movies || []).map(normalizeMovie);

    if (dataSource === "sql") {
      // Ép chỉ dùng SQL: trả nguyên kết quả thật (có thể rỗng), không che
      // bằng hardcode để test thấy đúng dữ liệu/trạng thái thật từ DB.
      return movies;
    }
    return movies.length
      ? movies
      : filterFallbackMovies({ genre, country, group });
  } catch (err) {
    if (dataSource === "sql") {
      // Ép chỉ dùng SQL: không rớt về hardcode, ném lỗi ra để thấy rõ
      // lỗi thật khi test (API sập, sai cổng, mất mạng...).
      console.error("Lỗi tải danh sách phim từ API (source=sql):", err);
      throw err;
    }
    console.error("Lỗi tải danh sách phim từ API, dùng dữ liệu dự phòng:", err);
    return filterFallbackMovies({ genre, country, group });
  }
}

// Lọc mảng hardcode dự phòng theo genre/country/group, dùng khi API MySQL
// không gọi được (mất mạng, backend chưa chạy...)
function filterFallbackMovies({
  genre = null,
  country = null,
  group = null,
} = {}) {
  let list = fallbackMoviesList;
  if (genre) {
    list = list.filter((m) =>
      (m.genres || "").toLowerCase().includes(genre.toLowerCase()),
    );
  }
  if (country) {
    list = list.filter(
      (m) => getMovieCountry(m).toLowerCase() === country.toLowerCase(),
    );
  }
  if (group) {
    list = list.filter((m) => m.group === group);
  }
  return list;
}

// Lấy chi tiết 1 phim theo slug (kèm episodes = mảng link m3u8 thật từ MySQL)
function findFallbackMovieBySlug(slug) {
  const fb = fallbackMoviesList.find((m) => m.slug === slug);
  if (!fb) return null;
  const movie = { ...fb };
  movie.episodeUrls =
    (window.allEpisodesData && window.allEpisodesData[slug]) || [];
  return movie;
}

async function fetchMovieBySlug(slug, { source = "auto" } = {}) {
  if (!slug) return null;
  const dataSource = resolveDataSource(source);

  if (dataSource === "hardcode") {
    return findFallbackMovieBySlug(slug);
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/movies/${encodeURIComponent(slug)}`,
    );
    if (!res.ok) throw new Error(`API /api/movies/${slug} lỗi ${res.status}`);
    const row = await res.json();
    const movie = normalizeMovie(row);
    movie.episodeUrls = row.episodes || []; // link m3u8 thật, tách riêng khỏi "episodes" (số tập)
    return movie;
  } catch (err) {
    if (dataSource === "sql") {
      // Ép chỉ dùng SQL: không rớt về hardcode, để lộ đúng lỗi thật khi test.
      console.error(`Lỗi tải chi tiết phim từ API (source=sql):`, err);
      throw err;
    }
    console.error(
      "Lỗi tải chi tiết phim từ API, thử dùng dữ liệu dự phòng:",
      err,
    );
    // Fallback: tìm trong mảng hardcode + Episodes.js (nếu có) để trang
    // watch/detail vẫn hiển thị được thay vì trắng trang khi API/DB die
    return findFallbackMovieBySlug(slug);
  }
}

// Tìm trong mảng hardcode theo tên hoặc thể loại (dùng khi ép source=hardcode
// hoặc khi API search lỗi và không ở chế độ ép SQL)
function searchFallbackMovies(query, limit = 40) {
  const q = (query || "").toLowerCase();
  return fallbackMoviesList
    .filter(
      (m) =>
        (m.title || "").toLowerCase().includes(q) ||
        (m.genres || "").toLowerCase().includes(q),
    )
    .slice(0, limit);
}

// Tìm kiếm phim theo tên/thể loại qua API
async function searchMoviesAPI(query, limit = 40, { source = "auto" } = {}) {
  const dataSource = resolveDataSource(source);

  if (dataSource === "hardcode") {
    return searchFallbackMovies(query, limit);
  }

  try {
    const params = new URLSearchParams({ q: query, limit });
    const res = await fetch(
      `${API_BASE_URL}/api/movies/search?${params.toString()}`,
    );
    if (!res.ok) throw new Error(`API /api/movies/search lỗi ${res.status}`);
    const data = await res.json();
    return (data.movies || []).map(normalizeMovie);
  } catch (err) {
    if (dataSource === "sql") {
      console.error("Lỗi tìm kiếm phim từ API (source=sql):", err);
      throw err;
    }
    console.error("Lỗi tìm kiếm phim từ API, dùng dữ liệu dự phòng:", err);
    return searchFallbackMovies(query, limit);
  }
}

// Danh sách phim dùng chung toàn trang. Khởi tạo sẵn bằng fallbackMoviesList
// để có gì đó hiển thị ngay (không phải chờ API), sau đó được merge thêm
// phim thật từ MySQL qua các lần fetch API bên dưới (addToGlobalMoviesList).
// detail.html / watch.html đọc qua window.globalMoviesList giống như trước.
let globalMoviesList = [...fallbackMoviesList];
window.globalMoviesList = globalMoviesList;

// Gộp thêm phim mới fetch được vào danh sách chung, tự loại trùng theo slug
function addToGlobalMoviesList(movies) {
  (movies || []).forEach((m) => {
    if (!globalMoviesList.some((existing) => existing.slug === m.slug)) {
      globalMoviesList.push(m);
    }
  });
}

// Tăng lượt xem +1 cho phim (gọi khi người dùng thực sự bấm xem phim).
// - Mỗi phim chỉ tính 1 lượt / 1 phiên trình duyệt (đổi tập, F5 không cộng thêm).
// - Backend nhận id hoặc slug: POST /api/movies/:id/view -> { views }
// - Lỗi mạng/backend chưa chạy chỉ cảnh báo, không làm hỏng trang xem phim.
// Trả về số lượt xem mới (number) hoặc null nếu không cập nhật được.
async function increaseMovieView(movie) {
  if (!movie || resolveDataSource() === "hardcode") return null;
  const key = movie.id || movie.slug;
  if (!key) return null;

  const flag = `viewed_${key}`;
  try {
    if (sessionStorage.getItem(flag)) return null;
  } catch (e) {
    // sessionStorage bị chặn -> vẫn gọi API bình thường
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/movies/${encodeURIComponent(key)}/view`,
      { method: "POST" },
    );
    if (!res.ok) throw new Error(`API tăng view lỗi ${res.status}`);
    try {
      sessionStorage.setItem(flag, "1");
    } catch (e) {}
    const data = await res.json();
    return typeof data.views === "number" ? data.views : null;
  } catch (err) {
    console.warn("Không tăng được lượt xem:", err);
    return null;
  }
}
