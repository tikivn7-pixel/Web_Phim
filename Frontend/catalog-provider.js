(function (root) {
  "use strict";
  const countries = typeof module !== "undefined" && module.exports ? require("./country-utils") : root.MovieCountries;
  const genres = typeof module !== "undefined" && module.exports ? require("./genre-utils") : root.MovieGenres;
  const slugPattern = /^[a-z0-9][a-z0-9_-]{0,199}$/;
  const allowedHosts = new Set(["phimapi.com", "kkphim.com", "www.kkphim.com"]);
  function parseInput(value) {
    const text = String(value || "").trim();
    if (slugPattern.test(text)) return text;
    let url;
    try { url = new URL(text); } catch (_) { throw Error("Nhập slug phim hoặc link HTTPS dạng phimapi.com/phim/ten-phim hay kkphim.com/phim/ten-phim."); }
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || url.username || url.password || url.port || /[\u0000-\u0020\\]/.test(text)) {
      throw Error("Chỉ hỗ trợ link HTTPS từ phimapi.com hoặc kkphim.com, không có tài khoản hay cổng riêng.");
    }
    const match = url.pathname.match(/^\/phim\/([a-z0-9][a-z0-9_-]{0,199})\/?$/);
    if (!match) throw Error("Link cần trỏ đến một phim: /phim/ten-phim. Không dùng link trang chủ, tìm kiếm hoặc tập phim.");
    return match[1];
  }
  const names = values => [...new Set((Array.isArray(values) ? values : []).map(value => typeof value === "string" ? value : value?.name).filter(value => typeof value === "string").map(value => value.trim()).filter(value => value && !/^đang cập nhật$/i.test(value)))];
  function imageUrl(value) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || /[\u0000-\u001f\\]/.test(text)) return "";
    try {
      if (/^https?:\/\//i.test(text)) {
        const url = new URL(text);
        return url.username || url.password ? "" : url.href;
      }
      if (text.includes(":") || text.startsWith("//") || text.split("/").includes("..")) return "";
      return new URL(text.replace(/^\/+/, ""), "https://phimimg.com/").href;
    } catch (_) { return ""; }
  }
  function description(value) {
    return String(value || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<\/?(?:p|div|br)\b[^>]*>/gi, "\n").replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim().slice(0, 30000);
  }
  function normalize(data, expectedSlug) {
    const item = data?.movie;
    if (data?.status !== true || !item || typeof item !== "object" || Array.isArray(item)) throw Error("Nguồn chưa có phim này hoặc trả về dữ liệu không hợp lệ. Kiểm tra lại slug.");
    if (!slugPattern.test(item.slug || "") || item.slug !== expectedSlug || typeof item.name !== "string" || !item.name.trim()) {
      throw Error("Nguồn trả về sai slug hoặc thiếu tên phim. Chưa nhập dữ liệu; hãy kiểm tra link phim.");
    }
    const sourceCountries = names(item.country);
    const canonicalCountries = [...new Set(sourceCountries.map(countries.canonical).filter(Boolean))];
    const unrecognized = sourceCountries.filter(name => !countries.canonical(name));
    const country = canonicalCountries.length === 1 && !unrecognized.length ? canonicalCountries[0] : "";
    const types = { single: "single", series: "series", hoathinh: "animation", animation: "animation", tvshows: "tvshows" };
    const total = String(item.episode_total ?? "").trim().match(/^(\d+)(?:\s*(?:tập|episodes?))?$/i);
    const episodes = total && Number(total[1]) > 0 && Number.isSafeInteger(Number(total[1])) ? Number(total[1]) : "";
    const year = Number(item.year);
    const poster = imageUrl(item.poster_url) || imageUrl(item.thumb_url);
    const movie = {
      title: item.name.trim().slice(0, 500), slug: item.slug, apiSlug: item.slug,
      year: Number.isInteger(year) && year >= 1888 && year <= 2100 ? year : "", episodes, country,
      type: types[item.type] || "", genres: genres.genres(names(item.category).join(", ")).join(", "),
      poster, banner: imageUrl(item.thumb_url) || poster, desc: description(item.content),
      cast: names(item.actor).join(", ").slice(0, 5000), director: names(item.director).join(", ").slice(0, 5000),
      sourceCountries, source: "kkphim",
    };
    const warnings = [];
    if (!country) warnings.push(sourceCountries.length ? "Nguồn ghi nhiều quốc gia hoặc tên chưa chuẩn hóa. Hãy chọn quốc gia chính trong biểu mẫu." : "Nguồn chưa có quốc gia. Hãy chọn quốc gia chính trong biểu mẫu.");
    if (!episodes) warnings.push("Nguồn chưa xác định số tập. Hãy nhập số tập trước khi lưu.");
    if (!movie.type) warnings.push("Nguồn chưa xác định loại phim. Hãy chọn loại phim trong biểu mẫu.");
    if (!poster) warnings.push("Nguồn chưa có poster hợp lệ. Hãy bổ sung đường dẫn ảnh trước khi lưu.");
    return { movie, warnings, sourceUrl: "https://phimapi.com/phim/" + encodeURIComponent(item.slug) };
  }
  function findExisting(movies, slug) {
    return (Array.isArray(movies) ? movies : []).find(movie => movie.slug === slug || movie.apiSlug === slug) || null;
  }
  async function fetchMovie(input, options = {}) {
    const slug = parseInput(input), fetcher = options.fetch || root.fetch;
    if (typeof fetcher !== "function") throw Error("Trình duyệt chưa hỗ trợ tải dữ liệu. Thử Chrome hoặc Edge mới hơn.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
    try {
      const response = await fetcher("https://phimapi.com/phim/" + encodeURIComponent(slug), { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" });
      if (!response.ok) throw Error("Nguồn phim báo lỗi HTTP " + response.status + ". Thử lại sau hoặc thêm thủ công.");
      let data;
      try { data = await response.json(); } catch (_) { throw Error("Nguồn trả về nội dung không phải JSON. Thử lại sau hoặc thêm thủ công."); }
      return normalize(data, slug);
    } catch (error) {
      if (controller.signal.aborted) throw Error("Nguồn phản hồi quá lâu. Kiểm tra mạng rồi thử lại; bạn vẫn có thể thêm phim thủ công.");
      if (error instanceof TypeError) throw Error("Không kết nối được nguồn phim. Kiểm tra mạng hoặc quyền truy cập của nguồn; không cần bật backend. Có thể thêm phim thủ công.");
      throw error;
    } finally { clearTimeout(timer); }
  }
  const api = { parseInput, imageUrl, normalize, findExisting, fetchMovie };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CatalogProvider = api;
})(globalThis);
