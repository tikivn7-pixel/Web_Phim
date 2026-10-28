const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const { primaryCountry, genreCountries } = require("./country-utils");
const { genres } = require("./genre-utils");
const {applyRelations}=require("./relation-policy");
const root = __dirname;
function readMovies() {
  const ctx = { window: {}, console };
  vm.runInNewContext(fs.readFileSync(path.join(root, "../Backend/catalog-source.js"), "utf8") + ";this.movies=fallbackMoviesList;", ctx, { timeout: 2000 });
  const castFile = path.join(root, "cast-data.js");
  if (fs.existsSync(castFile)) vm.runInNewContext(fs.readFileSync(castFile, "utf8"), ctx, { timeout: 2000 });
  if (!Array.isArray(ctx.movies)) throw new Error("Nguồn phim không phải mảng.");
  return ctx.movies.map(movie => ({ ...(ctx.window.movieCastIndex?.[movie.slug] || {}), ...movie }));
}
function validateMovies(movies) {
  const errors = [], warnings = [], seen = new Set(), apiSeen = new Map();
  if (!movies.length) errors.push("Kho phim đang rỗng.");
  const bySlug = new Map(movies.map(movie => [movie.slug, movie]));
  for (const movie of movies) {
    const label = movie.slug || movie.title || "Phim chưa có tên";
    if (movie.duplicateOf !== undefined) {
      const target = bySlug.get(movie.duplicateOf);
      if (!target || target === movie || target.duplicateOf || typeof movie.duplicateOf !== 'string') errors.push(`${label}: bản trùng phải trỏ tới một phim chính có thật, không tự trỏ hoặc nối vòng.`);
      if (!Array.isArray(movie.duplicateSources) || !movie.duplicateSources.length || movie.duplicateSources.some(url => typeof url !== 'string' || !/^https:\/\//.test(url))) errors.push(`${label}: cần nguồn đối chiếu HTTPS trước khi gộp thẻ phim.`);
    }
    if (movie.country && (typeof movie.country !== "string" || /[,?\uFFFD]/.test(movie.country))) errors.push(`${label}: country phải là một quốc gia chính, kiểm tra lại mã hóa tiếng Việt.`);
    const legacyAlias = /^phim\/[a-z0-9_-]+$/.test(movie.slug || "") && /^[a-z0-9][a-z0-9_-]*$/.test(movie.apiSlug || "");
    if (!movie.slug || (!/^[a-z0-9][a-z0-9_-]*$/.test(movie.slug) && !legacyAlias)) errors.push(`${label}: slug không hợp lệ.`);
    const provider=movie.apiSlug||movie.slug,identity=movie.duplicateOf||movie.slug;
    if (apiSeen.has(provider)&&apiSeen.get(provider)!==identity) warnings.push(`${label}: trùng nguồn phát với một mục khác (giữ nguyên cả hai mục).`);
    if(!apiSeen.has(provider))apiSeen.set(provider,identity);
    if (seen.has(movie.slug)) errors.push(`${label}: trùng slug.`);
    seen.add(movie.slug);
    if (typeof movie.title !== "string" || !movie.title.trim()) errors.push(`${label}: thiếu tên phim.`);
    if (!Number.isInteger(Number(movie.episodes)) || Number(movie.episodes) < 1) errors.push(`${label}: số tập phải là số nguyên lớn hơn 0.`);
    if (Number(movie.episodes) > 2000) warnings.push(`${label}: số tập lớn bất thường (${movie.episodes}).`);
    if (movie.year && (!Number.isInteger(Number(movie.year)) || Number(movie.year) < 1888 || Number(movie.year) > new Date().getFullYear() + 5)) warnings.push(`${label}: kiểm tra lại năm ${movie.year}.`);
    if (movie.group && !movie.partName) warnings.push(`${label}: có group nhưng chưa có partName.`);
    for (const field of ["poster", "banner"]) {
      const value = movie[field];
      if (!value) { warnings.push(`${label}: thiếu ${field}.`); continue; }
      if (/^https?:\/\//i.test(value)) {
        try { new URL(value); } catch { errors.push(`${label}: URL ${field} không hợp lệ.`); }
      } else {
        const target = path.resolve(root, value);
        if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) warnings.push(`${label}: không tìm thấy ${field} nội bộ (${value}).`);
      }
    }
  }
  return { total: movies.length, errors, warnings };
}
function classifyMovie(movie) {
  const types = { single: "single", series: "series", hoathinh: "animation", animation: "animation", tvshows: "tvshows" };
  if (types[movie.type]) return types[movie.type];
  if (/anime|hoạt hình/i.test(movie.genres || "")) return "animation";
  if (/tvshow|tv show/i.test(movie.genres || "")) return "tvshows";
  return Number(movie.episodes) === 1 ? "single" : "series";
}
function fingerprint(movie) {
  return crypto.createHash("sha256").update(JSON.stringify(movie, Object.keys(movie).sort())).digest("hex");
}
function enrichMovies(movies, manifest, now = new Date().toISOString()) {
  const records = { ...(manifest?.movies || {}) };
  const output = movies.map(movie => {
    const previous = records[movie.slug];
    const hash = fingerprint(movie);
    // Initial import has unknown dates; never label all old films as newly added.
    const addedAt = previous?.addedAt || (manifest && !previous ? now : null);
    const updatedAt = previous?.updatedAt || null;
    const changedAt = previous && previous.hash !== hash ? now : updatedAt;
    records[movie.slug] = { hash, addedAt, updatedAt: changedAt || addedAt };
    const result = { ...movie, type: classifyMovie(movie), country: primaryCountry(movie), sourceCountries: genreCountries(movie), genres: genres(movie.genres).join(", ") };
    if (records[movie.slug].addedAt) result.addedAt = records[movie.slug].addedAt;
    if (records[movie.slug].updatedAt) result.updatedAt = records[movie.slug].updatedAt;
    const local = `Img/posters/${movie.slug}.jpg`;
    if (fs.existsSync(path.join(root, local))) { result.remotePoster = movie.poster; result.poster = local; }
    return result;
  });
  return { movies: applyRelations(output), manifest: { version: 1, movies: records } };
}
module.exports = { readMovies, validateMovies, enrichMovies, classifyMovie };
