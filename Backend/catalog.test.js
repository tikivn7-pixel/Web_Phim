const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { registerCatalog, filters, normalize } = require("./catalog");
const { readSource } = require("./migrate-catalog");
test("source retains every unique movie and custom fields", () => {
  const movies = readSource();
  assert.equal(movies.length, 3744);
  assert.equal(new Set(movies.map(m => m.slug)).size, movies.length);
  assert.ok(movies.some(m => m.group && m.partName));
  assert.ok(movies.every(m => m.title && m.poster && m.slug));
  assert.ok(fs.statSync(path.join(__dirname, "../Frontend/data.js")).size < 6000);
});
test("search is accent-insensitive and parameters cannot alter SQL", () => {
  assert.equal(normalize("Đạo Diễn Go-Youn"), "dao dien go youn");
  const result = filters({ q: "a%_!", country: "Hàn Quốc", genre: "Anime", group: "' OR 1=1", year: "2024" });
  assert.equal(result.where, "WHERE country = ? AND movie_group = ? AND genres LIKE ? AND search_text LIKE ? ESCAPE '!' AND release_year = ?");
  assert.deepEqual(result.values, ["Hàn Quốc", "' OR 1=1", "%Anime%", "%a!% !!%", 2024]);
  assert.ok(!filters({ year: 2024 }, false).where);
});
function routes(query) {
  const handlers = {};
  registerCatalog({ get: (route, fn) => { handlers[route] = fn; } }, { promise: () => ({ query }) });
  return handlers;
}
function response() {
  return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
}
test("listing returns only requested page, stable order and full-result year counts", async () => {
  const calls = [];
  const handlers = routes(async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes("COUNT(*) AS total")) return [[{ total: 70 }]];
    if (sql.includes("SELECT payload")) return [[{ payload: JSON.stringify({ slug: "movie-25", group: "series", partName: "Phần 2" }) }]];
    return [[{ year: 2024, count: 45 }, { year: 2023, count: 25 }]];
  });
  const res = response();
  await handlers["/api/catalog"]({ query: { page: "2", limit: "24", country: "Hàn Quốc", year: "2024" } }, res);
  assert.equal(res.body.currentPage, 2);
  assert.equal(res.body.totalPages, 3);
  assert.equal(res.body.totalItems, 70);
  assert.equal(res.body.movies[0].partName, "Phần 2");
  assert.equal(res.body.years.length, 2);
  assert.match(calls[1].sql, /ORDER BY position LIMIT \? OFFSET \?/);
  assert.deepEqual(calls[1].params, ["Hàn Quốc", 2024, 24, 24]);
  assert.deepEqual(calls[2].params, ["Hàn Quốc"]);
});
test("limits are bounded, detail preserves fields and missing slugs return 404", async () => {
  let pagination;
  const handlers = routes(async (sql, params) => {
    if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
    if (sql.includes("OFFSET")) { pagination = params; return [[]]; }
    if (sql.includes("WHERE slug")) return [params[0] === "exists" ? [{ payload: { slug: "exists", year: 2025, episodes: 16, group: "Series" } }] : []];
    return [[]];
  });
  await handlers["/api/catalog"]({ query: { page: "-1", limit: "5000" } }, response());
  assert.deepEqual(pagination, [50, 0]);
  const res = response();
  await handlers["/api/catalog/:slug"]({ params: { slug: "exists" } }, res);
  assert.equal(res.body.group, "Series");
  await handlers["/api/catalog/:slug"]({ params: { slug: "missing" } }, res);
  assert.equal(res.statusCode, 404);
});
test("static browser catalog preserves all movies and needs no backend", async () => {
  const requests = [];
  const ctx = { window: { location: { search: "" } }, URLSearchParams, console, fetch: async url => {
    requests.push(url);
    assert.ok(!url.includes("data/movies.json"));
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(__dirname, "../Frontend",url.replace(/^\.\//,"").split("?")[0]), "utf8")) };
  } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../Frontend/catalog-format.js"), "utf8") + fs.readFileSync(path.join(__dirname, "../Frontend/country-utils.js"), "utf8") + fs.readFileSync(path.join(__dirname, "../Frontend/genre-utils.js"), "utf8") + fs.readFileSync(path.join(__dirname, "../Frontend/data.js"), "utf8") + fs.readFileSync(path.join(__dirname, "../Frontend/api.js"), "utf8"), ctx);
  assert.equal(ctx.window.globalMoviesList.length, 0);
  const all = await ctx.fetchCatalogPage();
  assert.equal(all.totalItems,3686);
  assert.equal(all.movies.length,24);
  const second = await ctx.fetchCatalogPage({page:2});
  assert.ok(!all.movies.some(a => second.movies.some(b => a.slug === b.slug)));
  const korean = await ctx.fetchCatalogPage({q:"han quoc",country:"Hàn Quốc"});
  assert.ok(korean.totalItems > 24);
  const year = korean.years[0].year;
  const byYear = await ctx.fetchCatalogPage({country:"Hàn Quốc",year});
  assert.ok(byYear.movies.every(m => Number(m.year) === year));
  const source = JSON.parse(fs.readFileSync(path.join(__dirname,"../Frontend/data/movies.json"),"utf8"));
  const original = source.find(m => m.group && m.partName);
  const parts = await ctx.fetchMovieParts(original.group);
  assert.equal(parts.length,source.filter(m => m.group === original.group).length);
  const movie = await ctx.fetchMovieBySlug(original.slug,{source:"hardcode"});
  assert.equal(movie.partName,original.partName);
  assert.equal(movie.episodes,original.episodes);
  assert.equal(await ctx.findCatalogMovieBySlug("missing-slug"),null);
  assert.equal(requests.filter(url=>url.includes("catalog-index.json")).length,1);
  assert.equal(requests.filter(url=>url.includes("catalog-search.json")).length,1);
  assert.equal(requests.filter(url=>url.includes("data/details/")).length,1);
  for(const [alias,canonical] of require('./duplicate-decisions.json').groups.flatMap(group=>group.aliases.map(slug=>[slug,group.canonical]))){
    const oldFilm=await ctx.findCatalogMovieBySlug(alias);
    assert.equal(oldFilm.slug,alias);assert.equal(oldFilm.duplicateOf,canonical);assert.ok(oldFilm.title);
  }
});
test("bundled posters exist and image failures end at a local placeholder", () => {
  const movies = JSON.parse(fs.readFileSync(path.join(__dirname, "../Frontend/data/movies.json"), "utf8"));
  for (const slug of ["song-sot-2020", "lang-quan-100-ngay", "tinh-dau-19", "1987-ngay-dinh-menh"]) {
    const movie = movies.find(m => m.slug === slug);
    assert.ok(movie.remotePoster.startsWith("https://"));
    assert.ok(fs.statSync(path.join(__dirname,"../Frontend",movie.poster)).size > 1000);
  }
  const ctx = { setTimeout: fn => fn(), document: { addEventListener() {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../Frontend/utils.js"),"utf8"),ctx);
  const img = {src:'broken.jpg',dataset:{fallback:'alternate.jpg'},onerror:()=>{},getAttribute() {return this.src;}};
  ctx.handleMovieImageError(img);
  assert.equal(img.src,'broken.jpg');
  ctx.handleMovieImageError(img);
  assert.equal(img.src,'alternate.jpg');
  ctx.handleMovieImageError(img);
  assert.equal(img.src,'Img/poster-placeholder.svg');
  assert.equal(img.onerror,null);
});
test("database outages return an actionable 503 instead of empty results", async () => {
  const handlers = routes(async () => { throw { code: "ECONNREFUSED" }; });
  const res = response();
  await handlers["/api/catalog"]({ query: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /migrate:catalog/);
});
test("results pager and year selector request new server pages", async () => {
  class Element {
    constructor() { this.children = []; this.style = {}; this.value = ""; this.dataset = {}; }
    set innerHTML(value) { this.children = []; this.html = value; }
    appendChild(child) { this.children.push(child); return child; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = [...children]; }
    add(child) { this.appendChild(child); }
    insertAdjacentElement(position, child) { if (child.id) elements[child.id] = child; }
    remove() {}
    scrollIntoView() {}
    setAttribute() {}
  }
  const elements = {};
  const calls = [], pagers = [];
  const container = new Element();
  const ctx = {
    console, URLSearchParams, Option: function(text, value) { this.text = text; this.value = value; },
    document: { getElementById: id => elements[id], createElement: () => new Element(), head: new Element(), addEventListener() {} },
    MOVIE_PAGE_SIZE: 24,
    getCatalogFilters: async () => ({ countries:["Hàn Quốc"], genres:["Hài Hước"] }),
    fetchCatalogPage: async opts => { calls.push(opts); return { movies: [{slug:'movie'}], currentPage: opts.page, totalPages: 3, years: [{year:2024,count:60}] }; },
    addToGlobalMoviesList() {}, renderMovieGrid() { if (container._pager) { container._pager.remove(); container._pager = null; } },
    ensurePaginationStyle() {}, drawPager(pager, current, total, goTo) { pagers.push(goTo); }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../Frontend/search.js'), 'utf8'),ctx);
  await ctx.renderFilteredResults(container, {country:'Hàn Quốc'}, 'empty');
  assert.equal(calls[0].limit,24);
  await pagers[0](2,true);
  assert.equal(calls[1].page,2);
  const bar = elements['search-year-filter'];
  const select = bar.children[2].children[0];
  select.value = '2024';
  select.onchange();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[2].year,'2024');
  assert.equal(calls[2].page,1);
  assert.equal(calls[2].country,'Hàn Quốc');
  const chips=elements['catalog-active-filters'];
  assert.equal(chips.children.length,2);
  chips.children.find(chip=>chip.textContent.includes('Hàn Quốc')).onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls[3].country,undefined);
  assert.equal(calls[3].year,'2024');
});
