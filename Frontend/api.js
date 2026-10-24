// Kho phim tĩnh: hoạt động trên hosting mà không cần backend/MySQL.
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
const COUNTRIES = MovieCountries.COUNTRIES;

// Lấy quốc gia của 1 phim. Dữ liệu hardcode chưa có trường country (quốc
// gia nằm lẫn trong genres) nên tự dò thêm trong genres.
function getMovieCountry(movie) {
  return MovieCountries.primaryCountry(movie);
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
    { signal: AbortSignal.timeout(12000), cache: 'no-store' },
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
    { signal: AbortSignal.timeout(12000) },
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
// DANH SÁCH / LỌC / TÌM KIẾM: JSON tĩnh
// ==========================================
let staticCatalogPromise = null;
let catalogDetailFiles = [], catalogIsFull = false;
let catalogSearchPromise = null;
const catalogShardCache = new Map();
async function loadStaticCatalog() {
  if (!staticCatalogPromise) {
    staticCatalogPromise = fetch("./data/catalog-index.json?v=1", { cache: "no-cache" })
      .then(async res => {
        if (!res.ok) throw new Error("Không tải được danh sách phim. Hãy thử tải lại trang.");
        const data = await res.json();
        const movies = Array.isArray(data) ? data : CatalogFormat.decode(data);
        if (!Array.isArray(movies)) throw new Error("Danh sách phim không hợp lệ.");
        catalogIsFull = Array.isArray(data);
        catalogDetailFiles = data.details || [];
        return typeof PublishedEpisodes !== 'undefined' ? PublishedEpisodes.overlay(movies, await PublishedEpisodes.load()) : movies;
      })
      .catch(err => { staticCatalogPromise = null; throw err; });
  }
  return staticCatalogPromise;
}
async function loadCatalogSearch() {
  if (catalogIsFull) return null;
  if (!catalogSearchPromise) catalogSearchPromise=fetch("./data/catalog-search.json?v=1",{cache:"no-cache"}).then(async response=>{
    if(!response.ok)throw new Error("Chưa tải được chỉ mục tìm kiếm diễn viên. Hãy thử lại.");
    return response.json();
  }).catch(error=>{catalogSearchPromise=null;throw error;});
  return catalogSearchPromise;
}
function normalizeSearchText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d").toLowerCase().replace(/[-_.,:;|]+/g, " ").replace(/\s+/g, " ");
}
function getCatalogType(movie) {
  if (movie.type) return movie.type;
  if (/anime|hoạt hình/i.test(movie.genres || "")) return "animation";
  return Number(movie.episodes) === 1 ? "single" : "series";
}
function compareCatalogMovies(a, b, sort) {
  const byTitle = () => String(a.title || "").localeCompare(String(b.title || ""), "vi", { numeric: true });
  if (sort === "title") return byTitle();
  const byYear = (Number(b.year) || 0) - (Number(a.year) || 0);
  if (sort === "year") return byYear || byTitle();
  const stamp = movie => Date.parse(movie.updatedAt || movie.addedAt || "") || 0;
  return stamp(b) - stamp(a) || byYear || byTitle();
}
async function getCatalogFilters() {
  const movies = await loadStaticCatalog();
  const genres = new Set(), countries = new Set();
  movies.forEach(movie => {
    const country = getMovieCountry(movie);
    if (country) countries.add(country);
    MovieGenres.genres(movie.genres).forEach(genre => genres.add(genre));
  });
  return { genres: [...genres].sort((a,b) => a.localeCompare(b,"vi")), countries: [...countries].sort((a,b) => a.localeCompare(b,"vi")) };
}
async function fetchCatalogPage(options = {}) {
  const source = await loadStaticCatalog();
  const query = normalizeSearchText(options.q).trim();
  let castIndex=null,searchWarning="";
  if(query)try{castIndex=await loadCatalogSearch();}catch(error){searchWarning="Chưa tải được mục diễn viên/đạo diễn; vẫn tìm theo tên và thông tin phim.";}
  const ranks=new Map();
  const filtered = source.filter(movie => {
    if (options.genre && !MovieGenres.genres(movie.genres).some(genre => genre.toLowerCase() === options.genre.trim().toLowerCase())) return false;
    if (options.country && getMovieCountry(movie).toLowerCase() !== options.country.toLowerCase()) return false;
    if (options.group && movie.group !== options.group) return false;
    if (options.type && getCatalogType(movie) !== options.type) return false;
    if(query){
      const rank=typeof SiteTools!=="undefined"?SiteTools.score(movie,query,castIndex?.[movie.slug]):(normalizeSearchText([movie.title,movie.slug,movie.genres,getMovieCountry(movie),movie.cast,movie.director,castIndex?.[movie.slug]].join(" ")).includes(query)?1:-1);
      if(rank<0)return false;ranks.set(movie.slug,rank);
    }
    return true;
  });
  const counts = new Map();
  filtered.forEach(movie => { const year = Number(movie.year); if (year > 0) counts.set(year, (counts.get(year) || 0) + 1); });
  const matches = options.year ? filtered.filter(movie => Number(movie.year) === Number(options.year)) : filtered;
  if(query&&(!options.sort||options.sort==="relevance"))matches.sort((a,b)=>(ranks.get(b.slug)||0)-(ranks.get(a.slug)||0)||compareCatalogMovies(a,b,"year"));
  else if (options.sort) matches.sort((a,b) => compareCatalogMovies(a,b,options.sort));
  else if(options.group)matches.sort((a,b)=>(a.relationOrder??9999)-(b.relationOrder??9999));
  const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 24));
  const page = Math.min(Math.max(1, Math.ceil(matches.length / limit)), Math.max(1, parseInt(options.page, 10) || 1));
  return {
    movies: matches.slice((page - 1) * limit, page * limit),
    currentPage: page, totalItems: matches.length, totalPages: Math.ceil(matches.length / limit),
    searchWarning,
    years: [...counts].sort((a, b) => b[0] - a[0]).map(([year, count]) => ({ year, count })),
  };
}
async function fetchMovies(options = {}) {
  const result = await fetchCatalogPage(options);
  return result.movies;
}
async function fetchMovieParts(group) {
  const movies = [];
  let page = 1, result;
  do {
    result = await fetchCatalogPage({ group, page, limit: 50 });
    movies.push(...result.movies);
    page++;
  } while (page <= result.totalPages);
  return movies;
}
async function searchMoviesAPI(query, limit = 40) {
  return fetchMovies({ q: query, limit });
}
async function findCatalogMovieBySlug(slug) {
  const source = await loadStaticCatalog();
  const original = source.find(movie => movie.slug === slug);
  if (!original) return null;
  let full = original;
  if (!catalogIsFull) {
    const file=catalogDetailFiles[original.detailShard];
    if(!file)throw new Error("Thiếu đường dẫn thông tin phim. Hãy xuất lại catalog.");
    if(!catalogShardCache.has(file)) catalogShardCache.set(file,fetch("./"+file).then(async response=>{
      if(!response.ok)throw new Error("Chưa tải được thông tin chi tiết phim. Hãy thử lại.");
      return response.json();
    }).catch(error=>{catalogShardCache.delete(file);throw error;}));
    const shard=await catalogShardCache.get(file);
    full=shard[slug];
    if(!full)throw new Error("Thiếu dữ liệu phim trong catalog chi tiết.");
  }
  const movie = { ...full };
  movie.episodeUrls = (window.allEpisodesData && window.allEpisodesData[slug]) || [];
  const current = typeof PublishedEpisodes !== 'undefined' ? PublishedEpisodes.apply(movie, await PublishedEpisodes.load()) : movie;
  addToGlobalMoviesList([current]);
  return current;
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
const movieDetailCheckedAt = new Map();

async function fetchMovieBySlug(slug, { source = "auto" } = {}) {
  if (!slug) return null;
  const dataSource = resolveDataSource(source);
  const cacheKey = `${dataSource}:${slug}`;
  if (movieDetailCache.has(cacheKey) && Date.now() - (movieDetailCheckedAt.get(cacheKey) || 0) < 60000) return movieDetailCache.get(cacheKey);

  const base = await findCatalogMovieBySlug(slug); // giữ group và partName từ kho phim
  let apiMovie = null;
  try {
    apiMovie = await fetchEpisodesFromApis(base?.apiSlug || slug, dataSource);
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

  if(result&&apiMovie){
    const available=Math.max(0,...apiMovie.episodeServers.map(server=>server.items.filter(item=>item.m3u8||item.embed).length));
    result.declaredTotalEpisodes=Math.max(parseInt(base?.episodes,10)||0,parseInt(apiMovie.episodes,10)||0);
    result.episodes=Math.max(available,parseInt(apiMovie.episodes,10)||0,parseInt(base?.episodes,10)||0);
    result.availableEpisodes=available;
    result.status=apiMovie.status||result.status;
  }
  // Chỉ cache khi có kết quả, để lần sau còn thử lại nếu mạng lỗi
  if (result && apiMovie) { movieDetailCache.set(cacheKey, result); movieDetailCheckedAt.set(cacheKey, Date.now()); }
  return result;
}

// Bộ nhớ tạm cho các phim đã tải trong trang hiện tại.
// detail.html / watch.html đọc qua window.globalMoviesList như trước.
let globalMoviesList = [];
window.globalMoviesList = globalMoviesList;

// Gộp thêm phim vào danh sách chung, tự loại trùng theo slug
function addToGlobalMoviesList(movies) {
  (movies || []).forEach((m) => {
    const existing=globalMoviesList.find(existing=>existing.slug===m.slug);
    if(existing) Object.assign(existing,m);
    else {
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
