// Personal movie statuses and ratings. No public score is inferred from these choices.
(function (root) {
  "use strict";
  const KEY = "movie_journal_v1", VERSION = 1, MAX_ENTRIES = 10000;
  const STATUSES = ["planned", "watching", "completed", "paused"];
  const labels = { planned: "Muốn xem", watching: "Đang xem", completed: "Đã xem", paused: "Tạm dừng" };
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const validSlug = slug => typeof slug === "string" && slug === slug.trim() && slug.length > 0 && slug.length <= 500 && !/[\u0000-\u001f\u007f]/.test(slug) && !["__proto__", "prototype", "constructor"].includes(slug);
  const empty = () => ({ version: VERSION, entries: {} });
  function normalize(input, strict = false) {
    if (input === undefined || input === null) {
      if (strict) throw new Error("Nhật ký phim không đúng định dạng phiên bản 1.");
      return empty();
    }
    if (!object(input) || input.version !== VERSION || !object(input.entries)) {
      if (strict) throw new Error("Nhật ký phim không đúng định dạng phiên bản 1.");
      return empty();
    }
    const out = empty(), entries = Object.entries(input.entries);
    if (strict && entries.length > MAX_ENTRIES) throw new Error("Nhật ký phim vượt quá 10.000 mục.");
    for (const [slug, entry] of entries.slice(0, MAX_ENTRIES)) {
      const valid = validSlug(slug) && object(entry) && (entry.status === "" || STATUSES.includes(entry.status)) && Number.isInteger(entry.rating) && entry.rating >= 0 && entry.rating <= 5 && typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt) && entry.updatedAt >= 0 && entry.updatedAt <= 1e15;
      if (!valid) { if (strict) throw new Error("Có trạng thái hoặc đánh giá phim không hợp lệ."); else continue; }
      out.entries[slug] = { status: entry.status, rating: entry.rating, updatedAt: entry.updatedAt };
    }
    return out;
  }
  const defaultStorage = storage => storage || root.localStorage;
  function read(storage) {
    try { const raw = defaultStorage(storage).getItem(KEY); return raw === null ? empty() : normalize(JSON.parse(raw)); }
    catch (_) { return empty(); }
  }
  function write(input, storage) {
    const value = normalize(input, true);
    try { defaultStorage(storage).setItem(KEY, JSON.stringify(value)); }
    catch (error) { const failure = new Error("Không lưu được nhật ký phim. Bộ nhớ có thể đã đầy hoặc bị trình duyệt chặn."); failure.cause = error; throw failure; }
    return value;
  }
  function get(slug, storage) { const entries = validSlug(slug) ? read(storage).entries : {}; return Object.hasOwn(entries, slug) ? entries[slug] : null; }
  function set(slug, patch, storage) {
    if (!validSlug(slug) || !object(patch)) throw new Error("Phim hoặc lựa chọn không hợp lệ.");
    let target, data;
    try {
      target = defaultStorage(storage);
      const raw = target.getItem(KEY);
      data = raw === null ? empty() : normalize(JSON.parse(raw), true);
    } catch (error) {
      const failure = new Error("Chưa thể thay đổi nhật ký phim vì dữ liệu cũ không đọc được. Hãy kiểm tra bản sao lưu trong Thư viện."); failure.cause = error; throw failure;
    }
    if (!Object.hasOwn(data.entries, slug) && Object.keys(data.entries).length >= MAX_ENTRIES) throw new Error("Nhật ký đã có 10.000 phim. Hãy xuất bản sao trước khi xóa mục cũ.");
    const current = Object.hasOwn(data.entries, slug) ? data.entries[slug] : { status: "", rating: 0, updatedAt: 0 };
    data.entries[slug] = { status: Object.hasOwn(patch, "status") ? patch.status : current.status, rating: Object.hasOwn(patch, "rating") ? patch.rating : current.rating, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    const entry = write(data, target).entries[slug];
    if (typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") root.dispatchEvent(new root.CustomEvent("movie-journal-change", { detail: { slug, entry } }));
    return entry;
  }
  function merge(a, b) {
    const out = normalize(a), incoming = normalize(b);
    for (const [slug, entry] of Object.entries(incoming.entries)) if (!Object.hasOwn(out.entries, slug) || entry.updatedAt > out.entries[slug].updatedAt) out.entries[slug] = entry;
    out.entries = Object.fromEntries(Object.entries(out.entries).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, MAX_ENTRIES));
    return out;
  }
  const api = { KEY, VERSION, STATUSES, normalize, read, write, get, set, merge, statusLabel: status => labels[status] || "Chưa chọn" };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MovieJournal = api;
})(globalThis);
