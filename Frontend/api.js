// ==========================================
// 0C. API PHIM (CHỈ FRONTEND)
// - Danh sách / lọc / tìm kiếm: CHỈ dùng phim trong data.js (fallbackMoviesList)
//   -> giữ nguyên group, partName... của mình, không tự thêm phim lạ.
// - Link tập phim khi mở phim (detail/watch): lấy theo slug từ
//     1) kkphim (phimapi.com)  - nguồn chính
//     2) nguonc (phim.nguonc.com) - chỉ dùng khi kkphim không có slug đó
//     3) Episodes.js / window.allEpisodesData - dự phòng cuối
// - Thông tin phim (title, group, partName, poster...) luôn lấy từ data.js;
//   API chỉ điền vào chỗ còn thiếu, KHÔNG ghi đè.
// ==========================================

// Chuẩn hóa 1 dòng dữ liệu từ MySQL API (giữ lại cho code cũ nào còn dùng)
function normalizeMovie(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    poster: row.poster,
    banner: row.banner || row.poster,
    desc: row.description,
    genres: row.genres,
    year: row.year || row.release_year || "",
    country: row.country || row.quoc_gia || "",
    views: Number(row.views) || 0,
    episodes: row.total_episodes,
    group: row.movie_group,
    partName: row.part_name,
  };
}

// Danh sách Quốc Gia hiển thị ở menu
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

// Lấy quốc gia của 1 phim. Dữ liệu hardcode chưa có trường country (quốc
// gia nằm lẫn trong genres) nên tự dò thêm trong genres.
function getMovieCountry(movie) {
  if (!movie) return "";
  if (movie.country) return movie.country;
  const genres = (movie.genres || "").toLowerCase();
  return COUNTRIES.find((c) => genres.includes(c.toLowerCase())) || "";
}

// ==========================================
// NGUỒN LINK TẬP: kkphim (phimapi.com) - GET /phim/{slug}
// ==========================================
const KKPHIM_BASE_URL = "https://phimapi.com";
const KKPHIM_IMG_CDN = "https://phimimg.com";

function kkphimImg(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${KKPHIM_IMG_CDN}/${String(url).replace(/^\/+/, "")}`;
}

// Lấy danh sách tên từ mảng (object {name} hoặc chuỗi), bỏ "Đang cập nhật"
function kkNames(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((x) => (typeof x === "string" ? x : x && x.name))
    .filter((x) => x && x.toLowerCase() !== "đang cập nhật");
}

async function fetchKkphimMovieBySlug(slug) {
  const res = await fetch(
    `${KKPHIM_BASE_URL}/phim/${encodeURIComponent(slug)}`,
  );
  if (!res.ok) throw new Error(`kkphim /phim/${slug} lỗi ${res.status}`);
  const data = await res.json();
  if (!data || !data.status || !data.movie) {
    throw new Error(`kkphim không có phim ${slug}`);
  }
  const m = data.movie;
  const names = (arr) =>
    (Array.isArray(arr) ? arr : []).map((x) => x && x.name).filter(Boolean);
  const total = parseInt(m.episode_total, 10);
  const poster = kkphimImg(m.poster_url || m.thumb_url);

  const movie = {
    id: m._id || m.slug,
    title: m.name,
    slug: m.slug,
    poster,
    banner: kkphimImg(m.thumb_url || m.poster_url) || poster,
    desc: m.content
      ? String(m.content)
          .replace(/<[^>]*>/g, "")
          .trim()
      : "",
    genres: names(m.category).join(", "),
    year: m.year || "",
    country: names(m.country)[0] || "",
    episodes: Number.isNaN(total) ? m.episode_total || "" : total,
    quality: m.quality || "",
    language: m.lang || "",
    director: kkNames(m.director).join(", "),
    cast: kkNames(m.actor).slice(0, 10).join(", "),
    status: m.episode_current || "",
    vote_average: (m.tmdb && Number(m.tmdb.vote_average)) || 0,
    views: Number(m.view) || 0,
    source: "kkphim",
  };
  movie.episodeServers = (data.episodes || []).map((s) => ({
    name: s.server_name,
    items: (s.server_data || []).map((it) => ({
      name: it.name,
      slug: it.slug,
      embed: it.link_embed || "",
      m3u8: it.link_m3u8 || "",
    })),
  }));
  return movie;
}

// ==========================================
// NGUỒN LINK TẬP DỰ PHÒNG: nguonc - GET /api/film/{slug}
// ==========================================
const NGUONC_BASE_URL = "https://phim.nguonc.com";

function getNguoncCategoryNames(category, groupName) {
  if (!category) return [];
  return Object.values(category)
    .filter((c) => c && c.group && c.group.name === groupName)
    .flatMap((c) => (c.list || []).map((i) => i.name));
}

async function fetchNguoncMovieBySlug(slug) {
  const res = await fetch(
    `${NGUONC_BASE_URL}/api/film/${encodeURIComponent(slug)}`,
  );
  if (!res.ok) throw new Error(`nguonc /api/film/${slug} lỗi ${res.status}`);
  const data = await res.json();
  if (data.status !== "success" || !data.movie) {
    throw new Error(`nguonc không có phim ${slug}`);
  }
  const m = data.movie;
  const poster = m.thumb_url || m.poster_url || "";
  const movie = {
    id: m.id || m.slug,
    title: m.name,
    slug: m.slug,
    poster,
    banner: m.poster_url || poster,
    desc: m.description || "",
    genres: getNguoncCategoryNames(m.category, "Thể loại").join(", "),
    year: m.year || getNguoncCategoryNames(m.category, "Năm")[0] || "",
    country: getNguoncCategoryNames(m.category, "Quốc gia")[0] || "",
    episodes: m.total_episodes,
    quality: m.quality || "",
    language: m.language || "",
    director: m.director || "",
    cast: m.casts || "",
    status: m.current_episode || "",
    source: "nguonc",
  };
  movie.episodeServers = (m.episodes || []).map((s) => ({
    name: s.server_name,
    items: (s.items || []).map((it) => ({
      name: it.name,
      slug: it.slug,
      embed: it.embed || "",
      m3u8: it.m3u8 || "",
    })),
  }));
  return movie;
}

// ==========================================
// CHỌN NGUỒN LINK TẬP
// - "auto" (mặc định): kkphim -> nguonc -> Episodes.js
// - "kkphim" / "nguonc": ép chỉ dùng 1 nguồn (không rớt sang nguồn khác)
// - "hardcode": không gọi API, chỉ dùng Episodes.js
// Có thể ép trên URL: ?data_source=kkphim | nguonc | hardcode
// ==========================================
function resolveDataSource(explicitSource) {
  const valid = ["hardcode", "kkphim", "nguonc"];
  if (valid.includes(explicitSource)) return explicitSource;
  try {
    const urlSource = new URLSearchParams(window.location.search).get(
      "data_source",
    );
    if (valid.includes(urlSource)) return urlSource;
  } catch (e) {
    // window.location không khả dụng -> bỏ qua
  }
  return "auto";
}

// ==========================================
// DANH SÁCH / LỌC / TÌM KIẾM: chỉ từ data.js
// (giữ chữ ký hàm cũ để init.js, render.js, search.js... không phải sửa)
// ==========================================
async function fetchMovies({
  genre = null,
  country = null,
  group = null,
} = {}) {
  return filterFallbackMovies({ genre, country, group });
}

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

// Bỏ dấu + hạ chữ thường để "Gong Yoo", "gong yoo", "Công Du" đều dễ khớp
function normalizeSearchText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[-_.,:;|]+/g, " ") // "Go Youn-jung" == "go youn jung"
    .replace(/\s+/g, " ");
}

// Tìm theo tên phim, thể loại, diễn viên, đạo diễn
// (diễn viên/đạo diễn lấy từ cast-data.js do build-cast.js sinh ra)
function searchFallbackMovies(query, limit = 40) {
  const q = normalizeSearchText(query).trim();
  if (!q) return [];
  const castIndex = window.movieCastIndex || {};
  return fallbackMoviesList
    .filter((m) => {
      const extra = castIndex[m.slug] || {};
      const haystack = normalizeSearchText(
        [m.title, m.genres, m.cast || extra.cast, m.director || extra.director]
          .filter(Boolean)
          .join(" | "),
      );
      return haystack.includes(q);
    })
    .slice(0, limit);
}

async function searchMoviesAPI(query, limit = 40) {
  return searchFallbackMovies(query, limit);
}

// ==========================================
// CHI TIẾT 1 PHIM
// ==========================================

// Phim trong data.js + link tập từ Episodes.js (nếu có)
function findFallbackMovieBySlug(slug) {
  const fb = fallbackMoviesList.find((m) => m.slug === slug);
  if (!fb) return null;
  const movie = { ...fb };
  movie.episodeUrls =
    (window.allEpisodesData && window.allEpisodesData[slug]) || [];
  return movie;
}

// Lấy link tập theo slug từ API (kkphim -> nguonc), trả null nếu không nguồn nào có
async function fetchEpisodesFromApis(slug, dataSource) {
  if (dataSource === "hardcode") return null;

  if (dataSource === "auto" || dataSource === "kkphim") {
    try {
      return await fetchKkphimMovieBySlug(slug);
    } catch (err) {
      if (dataSource === "kkphim") throw err;
      console.warn("kkphim không có/lỗi, thử nguonc:", err.message || err);
    }
  }
  if (dataSource === "auto" || dataSource === "nguonc") {
    try {
      return await fetchNguoncMovieBySlug(slug);
    } catch (err) {
      if (dataSource === "nguonc") throw err;
      console.warn("nguonc không có/lỗi:", err.message || err);
    }
  }
  return null;
}

// Điền vào chỗ còn thiếu của phim local, KHÔNG ghi đè dữ liệu của mình
function fillMissingFields(base, extra) {
  const keys = [
    "desc",
    "poster",
    "banner",
    "genres",
    "year",
    "country",
    "episodes",
    "quality",
    "language",
    "director",
    "cast",
    "status",
    "vote_average",
    "views",
  ];
  keys.forEach((k) => {
    if (
      (base[k] === undefined || base[k] === null || base[k] === "") &&
      extra[k]
    ) {
      base[k] = extra[k];
    }
  });
}

// Cache theo slug để detail.html / watch.html không gọi API lặp lại
const movieDetailCache = new Map();

async function fetchMovieBySlug(slug, { source = "auto" } = {}) {
  if (!slug) return null;
  const dataSource = resolveDataSource(source);
  const cacheKey = `${dataSource}:${slug}`;
  if (movieDetailCache.has(cacheKey)) return movieDetailCache.get(cacheKey);

  const base = findFallbackMovieBySlug(slug); // phim của mình (có group, partName)
  let apiMovie = null;
  try {
    apiMovie = await fetchEpisodesFromApis(slug, dataSource);
  } catch (err) {
    // chỉ xảy ra khi ép source=kkphim/nguonc: để lộ lỗi thật
    console.error(`Lỗi tải phim "${slug}" (source=${dataSource}):`, err);
    throw err;
  }

  let result;
  if (base && apiMovie) {
    // Giữ nguyên thông tin của mình, chỉ lấy tập từ API
    result = { ...base };
    fillMissingFields(result, apiMovie);
    const first = apiMovie.episodeServers[0];
    const urls = first ? first.items.map((it) => it.m3u8 || it.embed) : [];
    if (urls.length) {
      result.episodeUrls = urls;
      result.episodeServers = apiMovie.episodeServers;
      result.episodeSource = apiMovie.source;
    }
  } else if (apiMovie) {
    // Slug không có trong data.js (vd mở trực tiếp từ URL) -> dùng dữ liệu API
    result = { ...apiMovie };
    const first = apiMovie.episodeServers[0];
    result.episodeUrls = first
      ? first.items.map((it) => it.m3u8 || it.embed)
      : [];
    result.episodeSource = apiMovie.source;
  } else {
    result = base; // API không có/lỗi -> dữ liệu local (có thể null)
  }

  // Chỉ cache khi có kết quả, để lần sau còn thử lại nếu mạng lỗi
  if (result) movieDetailCache.set(cacheKey, result);
  return result;
}

// Danh sách phim dùng chung toàn trang. Khởi tạo bằng fallbackMoviesList;
// detail.html / watch.html đọc qua window.globalMoviesList như trước.
let globalMoviesList = [...fallbackMoviesList];
window.globalMoviesList = globalMoviesList;

// Gộp thêm phim vào danh sách chung, tự loại trùng theo slug
function addToGlobalMoviesList(movies) {
  (movies || []).forEach((m) => {
    if (!globalMoviesList.some((existing) => existing.slug === m.slug)) {
      globalMoviesList.push(m);
    }
  });
}

// Tăng lượt xem +1 (cần backend). Chạy thuần frontend thì không có
// API_BASE_URL -> bỏ qua, không báo lỗi.
async function increaseMovieView(movie) {
  if (typeof API_BASE_URL === "undefined" || !API_BASE_URL) return null;
  if (!movie || resolveDataSource() === "hardcode") return null;
  const key = movie.id || movie.slug;
  if (!key) return null;

  const flag = `viewed_${key}`;
  try {
    if (sessionStorage.getItem(flag)) return null;
  } catch (e) {}

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
