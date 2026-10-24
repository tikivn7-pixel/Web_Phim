const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),vm=require("vm");
const {audit}=require("./catalog-audit"),{artifacts}=require("./catalog-artifacts"),{decode}=require("./catalog-format"),State=require("./catalog-state"),Options=require("./playback-options"),{prepare,sourceText,mergeImported}=require("./import-catalog");
const base=(slug,extra={})=>({slug,title:slug,episodes:12,year:2024,country:"Nhật Bản",genres:"Hành Động",type:"series",poster:"https://phimimg.com/poster.jpg",banner:"https://phimimg.com/banner.jpg",...extra});
test("audit identifies duplicates, missing group labels, season gaps and inconsistent type without mutating films",()=>{
 const movies=[base("one",{title:"Same",group:"Group",partName:"Season 1"}),base("two",{title:"Same",group:"Group",partName:"Season 3"}),base("three",{group:"Group"}),base("four",{type:"single",episodes:3}),base("alias",{apiSlug:"one"})];
 const before=JSON.stringify(movies),report=audit(movies);for(const code of ["duplicate-title","season-gap","missing-part","type-review","duplicate-provider"])assert.ok(report.issues.some(i=>i.code===code),code);assert.equal(report.errors,0);assert.equal(JSON.stringify(movies),before);
 assert.ok(audit([base("same"),base("same")]).errors>0);
});
test("compact index preserves card fields, omits cast and full description, and resolves full detail shards",()=>{
 const movies=[base("one",{cast:"Long Cast",director:"Director",desc:"A".repeat(1000),remotePoster:"https://phimimg.com/remote.jpg",apiSlug:"actual-provider-slug"}),base("two")],result=artifacts(movies),rows=decode(result.index);
 assert.equal(rows.length,2);assert.equal(rows[0].country,movies[0].country);assert.equal(rows[0].poster,movies[0].poster);assert.equal(rows[0].cast,undefined);assert.equal(rows[0].desc.length,140);
 const shard=JSON.parse(result.files[rows[0].detailShard].text);assert.equal(shard.one.desc.length,1000);assert.equal(shard.one.cast,"Long Cast");assert.match(result.search.one,/long cast/);
 assert.equal(rows[0].apiSlug,'actual-provider-slug');assert.equal(rows[1].apiSlug,undefined);
});
test("generated index is substantially smaller and every archived movie is present in its detail shard",()=>{
 const full=JSON.parse(fs.readFileSync(path.join(__dirname,"data/movies.json"),"utf8"));const index=JSON.parse(fs.readFileSync(path.join(__dirname,"data/catalog-index.json"),"utf8")),rows=decode(index),shards=new Map();
 assert.equal(rows.length,full.length);assert.ok(fs.statSync(path.join(__dirname,"data/catalog-index.json")).size < fs.statSync(path.join(__dirname,"data/movies.json")).size*.5);
 for(const [i,movie] of full.entries()){const file=index.details[rows[i].detailShard];if(!shards.has(file))shards.set(file,JSON.parse(fs.readFileSync(path.join(__dirname,file),"utf8")));assert.deepEqual(shards.get(file)[movie.slug],movie);}
});
test("URL state roundtrips combined filters and page without confusing wishlist routes",()=>{
 const state={q:"Gong Yoo",country:"Hàn Quốc",genre:"Hài Hước",year:"2024",type:"series",sort:"title",page:3},url=State.url(state),read=State.read(url.split("?")[1]);for(const key of Object.keys(state))assert.equal(read[key],state[key]);assert.equal(read.catalog,true);assert.equal(State.read("?page=wishlist").catalog,false);assert.equal(State.read("?page=wishlist").view,"wishlist");assert.equal(State.safeReturn("https://example.com"),null);assert.equal(State.safeReturn("javascript:alert(1)"),null);assert.equal(State.safeReturn(url),url);
 assert.equal(State.safeReturn('discover.html?country=Nh%E1%BA%ADt+B%E1%BA%A3n&page=2'),'discover.html?country=Nh%E1%BA%ADt+B%E1%BA%A3n&page=2');assert.equal(State.safeReturn('//example.com/discover.html'),null);
});
test("editor import preserves unknown fields and produces source compatible with maintenance tools",()=>{
 const movies=[base("one",{desc:"Quotes \" & </script>",subtitles:[{label:"Vietnamese",src:"https://example.com/captions.vtt"}]})];const result=prepare(movies),text=sourceText(result),ctx={};vm.runInNewContext(text+";this.movies=fallbackMoviesList",ctx);assert.equal(ctx.movies[0].subtitles[0].src,movies[0].subtitles[0].src);assert.match(text,/\n\s+title:/);assert.throws(()=>prepare([base("one"),base("one")]));assert.throws(()=>prepare([base("bad",{episodes:0})]));
});
test("playback quality entries reflect real levels, and reports omit URLs and stay bounded",()=>{
 const rows=Options.qualityRows([{height:360,bitrate:700000},{height:1080,bitrate:3500000}]);assert.equal(rows[0].value,-1);assert.match(rows[1].label,/360p/);assert.match(rows[2].label,/1080p/);assert.ok(!rows.some(row=>row.label.includes("720p")));
 const records=new Map(),storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v)};for(let i=0;i<105;i++)Options.saveReport(storage,{slug:"film",episode:2,videoSrc:"https://secret.example/token"},"Không phát được");const reports=JSON.parse(records.get("playback_reports"));assert.equal(reports.length,100);assert.equal(reports[0].videoSrc,undefined);assert.equal(reports[0].episode,"2");
});
test("importing one edit does not mark every unchanged normalized movie as updated",()=>{
 const raw=[base("one",{genres:"Hành Động, Nhật Bản"}),base("two",{genres:"Hành Động, Nhật Bản"})],published=raw.map(movie=>({...movie,genres:"Hành Động",sourceCountries:["Nhật Bản"]}));
 const imported=published.map(movie=>({...movie}));imported[0].title="Edited";
 const merged=mergeImported(imported,published,raw);
 assert.equal(merged[0].title,"Edited");assert.deepEqual(merged[1],raw[1]);
});
