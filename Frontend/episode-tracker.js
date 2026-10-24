// Explicit watched episodes, shared across providers by their logical episode name.
(function (root) {
  "use strict";
  const KEY = "episode_tracker_v1", VERSION = 1;
  const MAX_MOVIES = 10000, MAX_EPISODES = 50000, MAX_PER_MOVIE = 10000;
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const forbidden = value => ["__proto__", "prototype", "constructor"].includes(value);
  const validSlug = value => typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= 500 && !/[\u0000-\u001f\u007f]/.test(value) && !forbidden(value);
  const empty = () => ({ version: VERSION, movies: {} });
  function canonical(name) {
    if (typeof name !== "string" || name.length > 200 || /[\u0000-\u001f\u007f]/.test(name)) return "";
    const clean = name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("vi");
    if (!clean || forbidden(clean)) return "";
    const numeric = clean.match(/^(?:(?:tập|tap|episode|ep)\s*[:.\-]?\s*)?(\d+(?:\.\d+)?)$/u);
    if (!numeric) return clean;
    const value = Number(numeric[1]);
    return Number.isFinite(value) && value <= 1000000 ? String(value) : "";
  }
  function normalize(input, strict = false) {
    if (!object(input) || input.version !== VERSION || !object(input.movies)) {
      if (strict) throw new Error("Danh sách tập đã xem không đúng định dạng phiên bản 1.");
      return empty();
    }
    const out = empty(), movies = Object.entries(input.movies);
    if (strict && movies.length > MAX_MOVIES) throw new Error("Danh sách tập đã xem vượt quá 10.000 phim.");
    let total = 0;
    for (const [slug, movie] of movies.slice(0, MAX_MOVIES)) {
      if (!validSlug(slug) || !object(movie) || !object(movie.episodes)) {
        if (strict) throw new Error("Mã phim hoặc danh sách tập đã xem không hợp lệ.");
        continue;
      }
      const entries = Object.entries(movie.episodes), episodes = {};
      if (strict && entries.length > MAX_PER_MOVIE) throw new Error("Một phim vượt quá 10.000 tập được theo dõi.");
      for (const [name, entry] of entries.slice(0, MAX_PER_MOVIE)) {
        const id = canonical(name);
        if (!id || !object(entry) || typeof entry.watched !== "boolean" || typeof entry.updatedAt !== "number" || !Number.isFinite(entry.updatedAt) || entry.updatedAt < 0 || entry.updatedAt > 1e15) {
          if (strict) throw new Error("Có tập hoặc thời điểm đánh dấu không hợp lệ.");
          continue;
        }
        if (!Object.hasOwn(episodes, id)) {
          if (++total > MAX_EPISODES) {
            if (strict) throw new Error("Danh sách tập đã xem vượt quá 50.000 mục.");
            break;
          }
        }
        const current = Object.hasOwn(episodes, id) ? episodes[id] : null;
        if (!current || entry.updatedAt > current.updatedAt || (entry.updatedAt === current.updatedAt && !entry.watched)) episodes[id] = { watched: entry.watched, updatedAt: entry.updatedAt };
      }
      if (Object.keys(episodes).length) out.movies[slug] = { episodes };
    }
    return out;
  }
  const storageOf = storage => storage || root.localStorage;
  function read(storage) {
    try { const raw = storageOf(storage).getItem(KEY); return raw === null ? empty() : normalize(JSON.parse(raw)); }
    catch (_) { return empty(); }
  }
  function editable(storage) {
    try {
      const target = storageOf(storage), raw = target.getItem(KEY);
      return { target, data: raw === null ? empty() : normalize(JSON.parse(raw), true) };
    } catch (error) {
      const failure = new Error("Chưa thể thay đổi tập đã xem vì dữ liệu cũ không đọc được. Hãy kiểm tra bản sao lưu trong Thư viện.");
      failure.cause = error; throw failure;
    }
  }
  function notify(slug) {
    if (typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") root.dispatchEvent(new root.CustomEvent("episode-tracker-change", { detail: { slug } }));
  }
  function write(input, storage, slug = "") {
    const value = normalize(input, true), { target } = editable(storage);
    try { target.setItem(KEY, JSON.stringify(value)); }
    catch (error) {
      const failure = new Error("Không lưu được tập đã xem. Bộ nhớ có thể đã đầy hoặc bị trình duyệt chặn.");
      failure.cause = error; throw failure;
    }
    notify(slug); return value;
  }
  function batch(slug, names, watched, storage) {
    if (!validSlug(slug) || !Array.isArray(names) || names.length > MAX_PER_MOVIE || typeof watched !== "boolean") throw new Error("Phim hoặc lựa chọn tập đã xem không hợp lệ.");
    const ids = names.map(canonical);
    if (ids.some(id => !id)) throw new Error("Tên tập không hợp lệ. Chưa lưu thay đổi.");
    const unique = [...new Set(ids)], { target, data } = editable(storage);
    if (!unique.length) return data.movies[slug] || { episodes: {} };
    const episodes = Object.hasOwn(data.movies, slug) ? data.movies[slug].episodes : {};
    for (const id of unique) episodes[id] = { watched, updatedAt: Math.max(Date.now(), (Object.hasOwn(episodes, id) ? episodes[id].updatedAt : 0) + 1) };
    data.movies[slug] = { episodes };
    return write(data, target, slug).movies[slug];
  }
  function set(slug, name, watched, storage) { const result = batch(slug, [name], watched, storage); return result.episodes[canonical(name)]; }
  function isWatched(slug, name, storage) {
    if (!validSlug(slug)) return false;
    const id = canonical(name), data = read(storage);
    return !!(id && Object.hasOwn(data.movies, slug) && Object.hasOwn(data.movies[slug].episodes, id) && data.movies[slug].episodes[id].watched);
  }
  function summary(slug, names, storage) {
    const data = read(storage), episodes = validSlug(slug) && Object.hasOwn(data.movies, slug) ? data.movies[slug].episodes : {};
    let watched = 0, nextName = null;
    const seen = new Set();
    for (const name of Array.isArray(names) ? names : []) {
      const id = canonical(name); if (!id || seen.has(id)) continue; seen.add(id);
      if (Object.hasOwn(episodes, id) && episodes[id].watched) watched++;
      else if (nextName === null) nextName = name;
    }
    return { watched, total: seen.size, nextName };
  }
  function merge(a, b) {
    const out = normalize(a), incoming = normalize(b);
    for (const [slug, movie] of Object.entries(incoming.movies)) {
      const episodes = Object.hasOwn(out.movies, slug) ? out.movies[slug].episodes : {};
      for (const [name, entry] of Object.entries(movie.episodes)) {
        const current = Object.hasOwn(episodes, name) ? episodes[name] : null;
        if (!current || entry.updatedAt > current.updatedAt || (entry.updatedAt === current.updatedAt && !entry.watched)) episodes[name] = entry;
      }
      out.movies[slug] = { episodes };
    }
    return normalize(out, true);
  }
  const api = { KEY, VERSION, canonical, normalize, read, write, set, batch, isWatched, summary, merge };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.EpisodeTracker = api;
})(globalThis);
