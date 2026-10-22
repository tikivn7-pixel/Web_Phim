const fs=require("fs"),path=require("path");
const {readMovies}=require("./catalog-tools");
const {indexRelations}=require("./relation-policy");
function deriveRelations(movies,cache,manual={groups:[],standalone:[]}){
  const known=new Set(movies.map(m=>m.slug));
  for(const member of manual.standalone||[]){
    if(!known.has(member.slug))throw Error("Standalone tham chiếu slug không tồn tại: "+member.slug);
    if((manual.groups||[]).some(group=>group.members.some(item=>item.slug===member.slug)))throw Error("Slug vừa standalone vừa trong nhóm: "+member.slug);
  }
  const manualIndex=indexRelations(manual,known),excluded=new Set([...(manual.standalone||[]).map(m=>m.slug),...manualIndex.keys()]);
  const buckets=new Map();
  movies.forEach((movie,position)=>{
    if(excluded.has(movie.slug))return;
    const evidence=cache.movies?.[movie.slug],tmdb=evidence?.tmdb;
    if(evidence?.status!=="found"||evidence.apiSlug!==(movie.apiSlug||movie.slug)||tmdb?.type!=="tv"||!Number.isInteger(tmdb.id)||tmdb.id<=0)return;
    const id="tmdb-tv-"+tmdb.id;const items=buckets.get(id)||[];items.push({movie,evidence,position});buckets.set(id,items);
  });
  const groups=[...(manual.groups||[])],reservedIDs=new Set(groups.map(group=>group.id));
  for(const [id,items] of buckets){
    // A group imported from the editor owns its exact membership. New metadata
    // must not create a second group with the same ID or silently add films.
    if(reservedIDs.has(id))continue;
    const seasons=new Set(items.map(item=>item.evidence.tmdb.season).filter(season=>Number.isInteger(season)));
    // Same film uploaded twice / same-season duplicate is not another season.
    if(items.length<2||seasons.size<2)continue;
    items.sort((a,b)=>(a.evidence.tmdb.season??9999)-(b.evidence.tmdb.season??9999)||a.position-b.position);
    groups.push({id,label:items[0].evidence.originalName||items[0].movie.title,kind:"series",basis:"provider-exact-tmdb-tv-id",sources:["https://www.themoviedb.org/tv/"+items[0].evidence.tmdb.id,...items.map(item=>item.evidence.source)],members:items.map((item,index)=>({slug:item.movie.slug,label:item.movie.title,order:index,season:item.evidence.tmdb.season,checkedAt:item.evidence.checkedAt}))});
  }
  const registry={version:1,policy:"explicit-slugs-only",groups,standalone:manual.standalone||[]};indexRelations(registry,known);return registry;
}
function buildRelations(){
  const root=path.join(__dirname,"../Backend"),movies=readMovies();
  const cacheFile=path.join(root,"relations-cache.json"),manualFile=path.join(root,"movie-relations.manual.json");
  const cache=fs.existsSync(cacheFile)?JSON.parse(fs.readFileSync(cacheFile,"utf8")):{movies:{}};
  const manual=fs.existsSync(manualFile)?JSON.parse(fs.readFileSync(manualFile,"utf8")):{groups:[],standalone:[]};
  const registry=deriveRelations(movies,cache,manual),linked=indexRelations(registry),unverified=movies.filter(m=>m.group&&!linked.has(m.slug));
  fs.writeFileSync(path.join(root,"movie-relations.json"),JSON.stringify(registry,null,2));
  const publicFile=path.join(__dirname,"data/movie-relations.json");
  fs.mkdirSync(path.dirname(publicFile),{recursive:true});
  fs.writeFileSync(publicFile+".tmp",JSON.stringify(registry));
  fs.renameSync(publicFile+".tmp",publicFile);
  fs.writeFileSync(path.join(root,"relations-review.md"),"# Các liên kết cũ chưa đủ bằng chứng\n\nKhông tự ghép từ tên. Các phim dưới đây vẫn có trong kho nhưng không hiện chung mục Phần phim.\n\n"+unverified.map(m=>`- ${m.slug}: ${m.title} — nhóm cũ: ${m.group}`).join("\n")+"\n");
  console.log(`${registry.groups.length} quan hệ, ${linked.size} mục phim được liên kết bằng slug; ${unverified.length} liên kết cũ chưa dùng vì thiếu bằng chứng.`);
  return registry;
}
if(require.main===module)try{require("./build-catalog").buildCatalog();}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={deriveRelations,buildRelations};
