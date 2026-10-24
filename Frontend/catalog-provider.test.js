const { test } = require("node:test"), assert = require("node:assert/strict");
const Provider = require("./catalog-provider");
const fixture = (fields = {}) => ({ status: true, movie: { slug: "example-film", name: "Phim mẫu", type: "hoathinh", year: 2024, episode_total: "12", country: [{ name: "Nhật Bản" }], category: [{ name: "Hành Động" }, { name: "Nhật Bản" }, { name: "chính kịch" }], poster_url: "/uploads/movies/poster.jpg", thumb_url: "https://phimimg.com/banner.jpg", content: "<p>Giới thiệu &amp; nội dung.</p>", actor: ["Diễn viên", "Đang cập nhật"], director: [{ name: "Đạo diễn" }], ...fields } });
test("provider accepts explicit slugs and only supported HTTPS film URLs", () => {
  for (const input of ["example-film", " https://phimapi.com/phim/example-film ", "https://kkphim.com/phim/example-film/", "https://www.kkphim.com/phim/example-film?utm_source=share#info"]) assert.equal(Provider.parseInput(input), "example-film");
  for (const input of ["", "http://kkphim.com/phim/example-film", "https://evil.com/phim/example-film", "https://phimapi.com.evil.com/phim/example-film", "https://phimapi.com@evil.com/phim/example-film", "https://u:p@phimapi.com/phim/example-film", "https://phimapi.com:8000/phim/example-film", "https://phimapi.com/phim/example%2Ffilm", "https://phimapi.com/phim/example-film/tap-1", "https://phimapi.com/", "//phimapi.com/phim/example-film", "https:\\phimapi.com\\phim\\example-film", "javascript:alert(1)", "../example-film"]) assert.throws(() => Provider.parseInput(input), input);
});
test("provider normalization uses known genres and countries without inheriting title groups or video URLs", () => {
  const source = fixture({ group: "false-group", partName: "Phần 1", episodes: [{ link_embed: "https://example.com/video" }] }), before = JSON.stringify(source);
  const result = Provider.normalize(source, "example-film"), movie = result.movie;
  assert.equal(movie.type, "animation"); assert.equal(movie.episodes, 12); assert.equal(movie.country, "Nhật Bản");
  assert.equal(movie.genres, "Hành Động, Chính Kịch"); assert.equal(movie.poster, "https://phimimg.com/uploads/movies/poster.jpg");
  assert.equal(movie.desc, "Giới thiệu & nội dung."); assert.equal(movie.cast, "Diễn viên"); assert.equal(movie.director, "Đạo diễn");
  for (const key of ["group", "partName", "episodeServers", "link_embed"]) assert.equal(movie[key], undefined);
  assert.deepEqual(result.warnings, []); assert.equal(JSON.stringify(source), before);
  assert.throws(() => Provider.normalize(source, "other-film"), /sai slug/);
  assert.throws(() => Provider.normalize({ status: false, movie: source.movie }, "example-film"), /chưa có/);
});
test("multiple or unknown countries stay unselected and unknown episode counts are never invented", () => {
  for (const country of [[{ name: "Nhật Bản" }, { name: "Mỹ" }], [{ name: "Nhật Bản" }, { name: "Quốc gia chưa biết" }], []]) {
    const result = Provider.normalize(fixture({ country, episode_total: "Đang cập nhật", type: "unknown", poster_url: "javascript:bad", thumb_url: "" }), "example-film");
    assert.equal(result.movie.country, ""); assert.equal(result.movie.episodes, ""); assert.equal(result.movie.type, ""); assert.equal(result.movie.poster, ""); assert.equal(result.warnings.length, 4);
  }
  assert.equal(Provider.normalize(fixture({ country: [{ name: "Âu Mỹ" }] }), "example-film").movie.country, "Mỹ");
});
test("image URLs reject executable, credential and protocol relative forms while preserving encoded spaces", () => {
  for (const value of ["javascript:alert(1)", "data:image/svg+xml,x", "https://u:p@phimimg.com/x.jpg", "//evil.com/x.jpg", "../x.jpg", "file:///x.jpg"]) assert.equal(Provider.imageUrl(value), "", value);
  assert.equal(Provider.imageUrl("/uploads/Ảnh phim (1).jpg"), "https://phimimg.com/uploads/%E1%BA%A2nh%20phim%20(1).jpg");
});
test("duplicate source aliases open their existing catalog item", () => {
  const movie = { slug: "old-film-id", apiSlug: "example-film", title: "Đã có" };
  assert.equal(Provider.findExisting([movie], "example-film"), movie); assert.equal(Provider.findExisting([movie], "old-film-id"), movie); assert.equal(Provider.findExisting([movie], "new-film"), null);
});
test("network import builds a fixed provider endpoint and omits credentials and redirects", async () => {
  const calls = [];
  const result = await Provider.fetchMovie("https://kkphim.com/phim/example-film?tracking=ignored", { fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => fixture() }; } });
  assert.equal(result.movie.slug, "example-film"); assert.equal(calls.length, 1); assert.equal(calls[0].url, "https://phimapi.com/phim/example-film"); assert.equal(calls[0].options.credentials, "omit"); assert.equal(calls[0].options.redirect, "error");
  await assert.rejects(Provider.fetchMovie("https://evil.com/phim/example-film", { fetch: async () => { throw Error("should never fetch"); } }), /Chỉ hỗ trợ/);
});
test("network import reports timeouts, connection errors, invalid JSON and provider failures", async () => {
  await assert.rejects(Provider.fetchMovie("example-film", { timeoutMs: 1, fetch: async (_, options) => new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(Error("aborted")))) }), /quá lâu/);
  await assert.rejects(Provider.fetchMovie("example-film", { fetch: async () => { throw new TypeError("Failed to fetch"); } }), /Không kết nối/);
  await assert.rejects(Provider.fetchMovie("example-film", { fetch: async () => ({ ok: false, status: 503 }) }), /503/);
  await assert.rejects(Provider.fetchMovie("example-film", { fetch: async () => ({ ok: true, json: async () => { throw SyntaxError("not JSON"); } }) }), /không phải JSON/);
});
