'use strict';
const fs=require('node:fs'),path=require('node:path');
const {readMovies}=require('./catalog-tools');
const file=path.join(__dirname,'../Backend/provider-map.json');
async function sync(){
 const movies=readMovies(), report={checkedAt:new Date().toISOString(),movies:{}};let cursor=0,done=0;
 async function worker(){while(cursor<movies.length){const m=movies[cursor++];const slug=m.providerSlugs?.nguonc||m.apiSlug||m.slug;let record={status:'error',slug};
 for(let attempt=0;attempt<2;attempt++){try{const r=await fetch('https://phim.nguonc.com/api/film/'+encodeURIComponent(slug),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(j.status!=='success'||!j.movie){record={status:'not-found',slug};break;}const count=Math.max(0,...(j.movie.episodes||[]).map(s=>(s.items||[]).filter(x=>x.embed||x.m3u8).length));record={status:count?'available':'no-streams',slug,episodes:count};break;}catch(e){record={status:'error',slug,error:e.message};}}
 report.movies[m.slug]=record;done++;if(done%200===0){fs.writeFileSync(file,JSON.stringify(report));console.log(done+'/'+movies.length);}}
 }
 await Promise.all(Array.from({length:6},worker));fs.writeFileSync(file,JSON.stringify(report));const counts={};for(const r of Object.values(report.movies))counts[r.status]=(counts[r.status]||0)+1;console.log(JSON.stringify(counts));
}
if(require.main===module)sync().catch(e=>{console.error(e);process.exitCode=1});module.exports={sync};
