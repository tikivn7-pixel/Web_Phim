const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { validateMovies, enrichMovies, classifyMovie } = require("./catalog-tools");
const movie = (slug, extra = {}) => ({ slug, title:slug, episodes:12, year:2024, genres:"Hài Hước, Hàn Quốc", poster:"https://example.com/poster.jpg", banner:"https://example.com/banner.jpg", ...extra });
test("catalog rejects duplicates and invalid episodes without requiring a database", () => {
  const report = validateMovies([movie("one"),movie("one"),movie("bad",{episodes:0})]);
  assert.equal(report.errors.length,2);
  assert.match(report.errors.join(" "),/trùng slug/);
  assert.match(report.errors.join(" "),/số tập/);
  const missing = validateMovies([movie("missing",{poster:"Img/absent-poster.jpg"})]);
  assert.equal(missing.errors.length,0);
  assert.ok(missing.warnings.some(w => w.includes("không tìm thấy")));
});
test("initial films have no invented update dates; new or modified films get real dates", () => {
  const baseline = enrichMovies([movie("one")],null,"2026-10-22T10:00:00Z");
  assert.equal(baseline.movies[0].addedAt,undefined);
  const update = enrichMovies([movie("one",{episodes:13}),movie("two")],baseline.manifest,"2026-10-23T10:00:00Z");
  assert.equal(update.movies[0].updatedAt,"2026-10-23T10:00:00Z");
  assert.equal(update.movies[1].addedAt,"2026-10-23T10:00:00Z");
  const unchanged = enrichMovies([movie("one",{episodes:13}),movie("two")],update.manifest,"2026-10-24T10:00:00Z");
  assert.equal(unchanged.movies[0].updatedAt,update.movies[0].updatedAt);
  assert.equal(unchanged.movies[1].addedAt,update.movies[1].addedAt);
});
test('confirmed aliases sharing one provider do not raise false duplicate warnings',()=>{
  const original=movie('original',{apiSlug:'shared'}),alias=movie('alias',{apiSlug:'shared',duplicateOf:'original',duplicateSources:['https://example.com/evidence']});
  for(const rows of [[original,alias],[alias,original]])assert.equal(validateMovies(rows).warnings.filter(w=>w.includes('trùng nguồn')).length,0);
  assert.equal(validateMovies([original,movie('unreviewed',{apiSlug:'shared'})]).warnings.filter(w=>w.includes('trùng nguồn')).length,1);
});
test("classification honors explicit types and otherwise uses genre and episode count", () => {
  assert.equal(classifyMovie(movie("anime",{episodes:1,genres:"Anime"})),"animation");
  assert.equal(classifyMovie(movie("single",{episodes:1})),"single");
  assert.equal(classifyMovie(movie("series")),"series");
  assert.equal(classifyMovie(movie("show",{type:"tvshows"})),"tvshows");
});
function browserApi(movies) {
  const ctx = { console, URLSearchParams, window:{location:{search:""}}, fetch:async () => ({ok:true,json:async()=>movies}) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"country-utils.js"),"utf8") + fs.readFileSync(path.join(__dirname,"genre-utils.js"),"utf8") + fs.readFileSync(path.join(__dirname,"data.js"),"utf8") + fs.readFileSync(path.join(__dirname,"api.js"),"utf8"),ctx);
  return ctx;
}
test("country, genre, year, type and query combine across the entire catalog", async () => {
  const movies = Array.from({length:60},(_,i) => movie("movie-"+i,{year:i%2?2023:2024,type:"series"}));
  movies.push(movie("other-country",{genres:"Hài Hước, Nhật Bản"}));
  const ctx = browserApi(movies);
  const result = await ctx.fetchCatalogPage({q:"hai huoc",genre:"Hài Hước",country:"Hàn Quốc",year:2024,type:"series",page:2,limit:24,sort:"title"});
  assert.equal(result.totalItems,30);
  assert.equal(result.movies.length,6);
  assert.equal(result.years.reduce((sum,y)=>sum+y.count,0),60);
  assert.ok(result.movies.every(m=>m.year===2024));
  const none = await ctx.fetchCatalogPage({country:"Hàn Quốc",type:"single"});
  assert.equal(none.totalItems,0);
});
test("new updates sort before release year; series parts retain source ordering", async () => {
  const ctx = browserApi([movie("old",{year:2026,group:"parts"}),movie("new",{year:1999,updatedAt:"2026-10-22T10:00:00Z",group:"parts"}),movie("middle",{year:2025})]);
  const sorted = await ctx.fetchMovies({sort:"updated"});
  assert.equal(sorted[0].slug,"new");
  const byYear = await ctx.fetchMovies({sort:"year"});
  assert.equal(byYear[0].slug,"old");
  const parts = await ctx.fetchMovieParts("parts");
  assert.equal(parts[0].slug,"old");
  const facets = await ctx.getCatalogFilters();
  assert.ok(facets.genres.includes("Hài Hước"));
  assert.ok(!facets.genres.includes("Hàn Quốc"));
});
test("country matching honors primary country and source order instead of menu priority", () => {
  const { primaryCountry } = require("./country-utils");
  assert.equal(primaryCountry({genres:"Chính Kịch, Nhật Bản, Mỹ"}),"Nhật Bản");
  assert.equal(primaryCountry({genres:"Chính Kịch, Hàn Quốc, Trung Quốc"}),"Hàn Quốc");
  assert.equal(primaryCountry({country:"Nhật Bản",genres:"Hài Hước, Trung Quốc, Nhật Bản"}),"Nhật Bản");
  assert.equal(primaryCountry({country:"Mỹ",genres:"Hoạt Hình, Nhật Bản, Mỹ"}),"Mỹ");
  assert.equal(primaryCountry({genres:"Anh Hùng, Hoạt Hình"}),"");
});
test("all country labels are separated from genres, duplicate spellings are merged", async () => {
  const { genres } = require("./genre-utils");
  const { canonical } = require("./country-utils");
  assert.deepEqual(genres("Ba Lan, Bỉ, Brunei Darussalam, Canada, Chile, Comoros, Đan Mạch, Đức, Mongolia, Nhật Bản, Chính kịch, Chính Kịch, Tâm lý, Tâm Lý, học Đường, Học Đường, Chính Kịch. Tình Cảm, Khoa HọcViễn Tưởng"),["Chính Kịch","Tâm Lý","Học Đường","Tình Cảm","Khoa Học","Viễn Tưởng"]);
  const movies = JSON.parse(fs.readFileSync(path.join(__dirname,"data/movies.json"),"utf8"));
  assert.ok(movies.every(movie => String(movie.genres).split(',').every(label=>!canonical(label))));
  assert.ok(movies.some(movie => movie.sourceCountries.includes("Canada")));
  assert.ok(movies.some(movie => movie.sourceCountries.includes("Ba Lan")));
  const facets = await browserApi(movies).getCatalogFilters();
  assert.ok(facets.genres.every(label=>!canonical(label)));
  assert.equal(facets.genres.filter(label=>label.toLowerCase()==="chính kịch").length,1);
  assert.ok(facets.countries.includes("Nhật Bản"));
});
test("real catalog country filters do not put Japanese anime in China or USA", async () => {
  const movies = JSON.parse(fs.readFileSync(path.join(__dirname,"data/movies.json"),"utf8"));
  const ctx = browserApi(movies);
  async function all(country) {
    const list = []; let page = 1, response;
    do { response = await ctx.fetchCatalogPage({country,page:page++,limit:50}); list.push(...response.movies); } while(page <= response.totalPages);
    return list;
  }
  const china = await all("Trung Quốc"), usa = await all("Mỹ"), japan = await all("Nhật Bản");
  const japanese = ["chang-the-ly-giai-noi-aharensan-phan-2","metallic-rouge","no-le-cua-ma-do-tinh-binh","chang-duong-cua-pon","co-dau-phap-su-phan-1","your-forma","vi-vua-manh-nhat-lam-gi-o-kiep-thu-hai-phan-2","chao-mung-den-voi-lop-hoc-de-cao-thuc-luc-phan-3","chao-mung-den-voi-lop-hoc-de-cao-thuc-luc-phan-4","ninja-kamui","canh-hoa-luan-hoi"];
  for (const slug of japanese) {
    assert.ok(japan.some(m=>m.slug===slug),slug+" must be in Japan");
    assert.ok(!china.some(m=>m.slug===slug),slug+" must not be in China");
    assert.ok(!usa.some(m=>m.slug===slug),slug+" must not be in USA");
  }
  assert.ok(china.some(m=>m.slug==="tieu-nhan-phan-1"));
  assert.ok(china.some(m=>m.slug==="tieu-nhan-phan-2"));
  assert.ok(china.some(m=>m.slug==="nhat-nhan-chi-ha-phan-3-nguoi-tren-van-nguoi"));
  assert.ok(usa.some(m=>m.slug==="phim-super-mario-thien-ha"));
  assert.ok(usa.some(m=>m.slug==="sonic-prime-phan-3"));
  assert.equal(movies.length,3872);
});
function playback() {
  const ctx = {URLSearchParams};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"playback-tools.js"),"utf8"),ctx);
  return ctx.PlaybackTools;
}
test("server switches match the actual episode, including reordered and missing episodes", () => {
  const p = playback();
  const target = [{name:"Tập 2"},{name:"Tập 01"}];
  assert.equal(p.findEpisodeIndex({name:"1"},target),1);
  assert.equal(p.findEpisodeIndex({name:"3"},target),-1);
  assert.equal(p.findEpisodeIndex({name:"1.5"},target),-1);
  assert.equal(p.findEpisodeIndex({name:"Full"},[{name:"Full"}]),0);
});
test("changing source preserves position and removes stale target episode markers", () => {
  const p = playback();
  const params = p.resumeParams("slug=test&ep=2&resume=99&target_episode=1",{source:"nguonc",episode:2,time:123.5,episodeName:"Tập 2"});
  assert.equal(params.get("data_source"),"nguonc");
  assert.equal(params.get("resume"),"123");
  assert.equal(params.get("target_episode"),"Tập 2");
  const reset = p.resumeParams(params,{server:1,episode:3});
  assert.equal(reset.has("resume"),false);
  assert.equal(reset.has("target_episode"),false);
});
function historyContext(initial, denied=false) {
  const records = new Map(Object.entries(initial));
  const events = [];
  const ctx = {console,URLSearchParams,Event, window:{addEventListener(){},dispatchEvent(event){events.push(event.type);}},document:{getElementById(){return null;}},localStorage:{
    getItem(k) { if(denied) throw Error("blocked"); return records.get(k) || null; },setItem(k,v){records.set(k,v);}
  }};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"continue-watching.js"),"utf8"),ctx);
  return {ctx,records,events};
}
test("continue watching deduplicates entries, hides completed finales and tolerates blocked storage", () => {
  const entries = [null,{slug:"one",episode:1,progress:20,updatedAt:1},{slug:"one",episode:2,progress:50,updatedAt:2},{slug:"done",episode:3,totalEpisodes:3,progress:96}];
  const {ctx} = historyContext({continue_watching_list:JSON.stringify(entries)});
  const result = ctx.getContinueWatchingList();
  assert.equal(result.length,1);
  assert.equal(result[0].episode,2);
  assert.equal(historyContext({},true).ctx.getContinueWatchingList().length,0);
});
test("remove from continue watching clears only that film and notifies same-page session views", () => {
  const {ctx,records,events} = historyContext({continue_watching_list:JSON.stringify([{slug:"one"},{slug:"two"}]),episode_positions:JSON.stringify({one:{1:{currentTime:30}},two:{1:{currentTime:60}}})});
  ctx.removeFromContinueWatching("one");
  assert.equal(JSON.parse(records.get("continue_watching_list"))[0].slug,"two");
  assert.equal(JSON.parse(records.get("episode_positions")).one,undefined);
  assert.equal(JSON.parse(records.get("episode_positions")).two[1].currentTime,60);
  assert.deepEqual(events,['continue-watching-change']);
});
