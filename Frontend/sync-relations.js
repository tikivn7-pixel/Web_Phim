// Fetch identities from the public catalog provider; never infer relationships from titles.
// node Frontend/sync-relations.js [--refresh] [--max=100]
const fs=require("fs"),path=require("path");
const {readMovies}=require("./catalog-tools");
const cacheFile=path.join(__dirname,"../Backend/relations-cache.json");
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const movies=readMovies(),refresh=process.argv.includes("--refresh"),limitArg=process.argv.find(a=>a.startsWith("--max="));
  const max=limitArg?Math.max(1,Number(limitArg.split("=")[1])||100):movies.length;
  const cache=fs.existsSync(cacheFile)?JSON.parse(fs.readFileSync(cacheFile,"utf8")):{version:1,movies:{}};
  const pending=movies.filter(m=>refresh||!cache.movies[m.slug]||cache.movies[m.slug].apiSlug!==(m.apiSlug||m.slug)).slice(0,max);
  let next=0,done=0,failed=0;
  const save=()=>{fs.writeFileSync(cacheFile+".tmp",JSON.stringify(cache));fs.renameSync(cacheFile+".tmp",cacheFile);};
  const fetchOne=async movie=>{
    const apiSlug=movie.apiSlug||movie.slug,url="https://phimapi.com/phim/"+encodeURIComponent(apiSlug);
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
        if(response.status===429||response.status>=500){await delay(1000*(attempt+1));continue;}
        if(!response.ok)throw Error("HTTP "+response.status);
        const data=await response.json(),m=data.status&&data.movie?data.movie:null;
        const id=String(m?.tmdb?.id||"");
        cache.movies[movie.slug]={apiSlug,checkedAt:new Date().toISOString(),source:url,status:m?"found":"missing",name:m?.name||"",originalName:m?.origin_name||"",type:m?.type||"",tmdb:m&&/^[1-9]\d*$/.test(id)?{type:m.tmdb.type,id:Number(id),season:m.tmdb.season!==null&&m.tmdb.season!==undefined&&Number.isInteger(Number(m.tmdb.season))&&Number(m.tmdb.season)>=0?Number(m.tmdb.season):null}:null,imdb:m?.imdb?.id||null};
        return;
      }catch(error){if(attempt===2){failed++;return;}await delay(500*(attempt+1));}
    }
    failed++;
  };
  await Promise.all(Array.from({length:4},async()=>{while(next<pending.length){const movie=pending[next++];await fetchOne(movie);done++;if(done%50===0){save();console.log(`Đã kiểm tra ${done}/${pending.length}; lỗi mạng ${failed}.`);}await delay(150);}}));
  save();console.log(`Hoàn tất ${done} lượt; ${failed} lượt lỗi mạng. Cache ${Object.keys(cache.movies).length}/${movies.length} phim. Chạy lại để tiếp tục các lượt chưa lấy được.`);
}
if(require.main===module)main().then(()=>{if(process.argv.includes("--build"))require("./build-catalog").buildCatalog();}).catch(error=>{console.error(error.message);process.exitCode=1;});
