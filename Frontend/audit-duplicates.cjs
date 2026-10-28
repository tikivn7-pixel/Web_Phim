// Review candidates across the entire catalog. Never changes source records automatically.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const People=require('./movie-people'),{readMovies,classifyMovie}=require('./catalog-tools');
const ROOT=path.join(__dirname,'../Backend'),CACHE=path.join(ROOT,'duplicate-evidence.json');
function candidates(movies,metadata={movies:{}}){
  const pairs=new Map();
  function bucket(reason,keyFor){const buckets=new Map();for(const movie of movies){const key=keyFor(movie);if(!key)continue;const rows=buckets.get(key)||[];rows.push(movie);buckets.set(key,rows);}for(const rows of buckets.values())if(rows.length>1)for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const slugs=[rows[i].slug,rows[j].slug].sort(),key=JSON.stringify(slugs),pair=pairs.get(key)||{slugs,reasons:[]};if(!pair.reasons.includes(reason))pair.reasons.push(reason);pairs.set(key,pair);}}
  bucket('same-title',movie=>People.normalize(movie.title));
  bucket('verified-identity',movie=>movie.duplicateOf||movie.slug);
  bucket('same-first-season-title',movie=>People.normalize(movie.title).replace(/\bseason\s+1\b/g,'').replace(/\s+/g,' ').trim());
  bucket('same-credits',movie=>{const cast=People.names(movie.cast).slice(0,3).map(People.normalize).sort(),directors=People.names(movie.director).map(People.normalize).sort();return movie.year&&cast.length===3&&directors.length?[movie.year,cast.join('|'),directors.join('|')].join('::'):'';});
  bucket('same-provider',movie=>movie.apiSlug||movie.slug);
  bucket('same-poster',movie=>movie.remotePoster||movie.poster);
  bucket('same-cached-id',movie=>{const entry=metadata.movies?.[movie.slug],id=entry?.tmdb;if(entry?.apiSlug!==(movie.apiSlug||movie.slug)||!id?.id)return '';return[id.type,id.id,id.type==='tv'?id.season:''].join('|');});
  return[...pairs.values()];
}
function evidence(payload,expectedSlug){
  const m=payload?.movie;if(payload?.status!==true||m?.slug!==expectedSlug)throw Error('Source identity mismatch');
  const names=new Set(),hashes=new Set();for(const server of payload.episodes||[])for(const episode of server.server_data||[]){if(!episode.link_m3u8&&!episode.link_embed)continue;names.add(String(episode.name||''));for(const url of [episode.link_m3u8,episode.link_embed])if(url)hashes.add(crypto.createHash('sha256').update(url).digest('hex'));}
  return{apiSlug:expectedSlug,checkedAt:new Date().toISOString(),status:'found',title:String(m.name||''),originalTitle:String(m.origin_name||''),year:Number(m.year)||0,type:m.type,episodeTotal:String(m.episode_total||''),episodeNames:[...names].sort(),streamHashes:[...hashes].sort(),duration:String(m.time||''),cast:People.names(m.actor),directors:People.names(m.director),countries:People.names(m.country),tmdb:m.tmdb&&{id:m.tmdb.id,type:m.tmdb.type,season:m.tmdb.season},description:String(m.content||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,600)};
}
const overlap=(a,b)=>{const keys=new Set((a||[]).map(People.normalize));return(b||[]).filter(value=>keys.has(People.normalize(value)));};
function classify(left,right,a,b){
  if(left.duplicateOf===right.slug||right.duplicateOf===left.slug||(left.duplicateOf&&left.duplicateOf===right.duplicateOf))return{decision:'already-linked',reason:'Explicit duplicate mapping already exists.'};
  if(!a||!b||a.status!=='found'||b.status!=='found')return{decision:'needs-review',reason:'Fresh source evidence unavailable.'};
  if(a.apiSlug===b.apiSlug)return{decision:'strong-match',reason:'Exact same provider slug.'};
  const titleA=People.normalize(a.originalTitle||a.title),titleB=People.normalize(b.originalTitle||b.title);
  const names=!!titleA&&titleA===titleB,year=a.year===b.year,type=a.type===b.type,cast=overlap(a.cast,b.cast),directors=overlap(a.directors,b.directors),streams=overlap(a.streamHashes,b.streamHashes);
  // Reused TV IDs/seasons are common upstream: an ID by itself is not proof.
  if(streams.length&&names&&type)return{decision:'strong-match',reason:'Same source title/type and identical playable URL fingerprints.'};
  if(!names)return{decision:'keep-separate',reason:'Different source original titles (may be separate seasons, parts or editions).'};
  if(!type)return{decision:'keep-separate',reason:'Different source formats (film/series/special).'};
  if(!year)return{decision:'needs-review',reason:'Source release years differ.'};
  const idA=a.tmdb,idB=b.tmdb,sameID=idA?.id&&idB?.id&&String(idA.id)===String(idB.id)&&idA.type===idB.type&&(idA.type!=='tv'||idA.season===idB.season);
  if(sameID||cast.length>=2||directors.length)return{decision:'strong-match',reason:[sameID?'Matching source ID/type/season':'',cast.length>=2?'At least two matching cast names':'',directors.length?'Matching director':''].filter(Boolean).join('; ')};
  return{decision:'needs-review',reason:'Same source title/year/type; insufficient independent identity fields.'};
}
function review(movies,cache,metadata,decisions={}){const bySlug=new Map(movies.map(movie=>[movie.slug,movie]));return candidates(movies,metadata).map(pair=>{const[left,right]=pair.slugs.map(slug=>bySlug.get(slug)),a=cache.records?.[left.apiSlug||left.slug],b=cache.records?.[right.apiSlug||right.slug],separate=(decisions.separate||[]).find(item=>JSON.stringify([...item.slugs].sort())===JSON.stringify(pair.slugs));return{...pair,...(separate?{decision:'keep-separate',reason:separate.reason}:classify(left,right,a,b)),movies:[left,right].map(movie=>({slug:movie.slug,title:movie.title,year:movie.year,episodes:movie.episodes,type:movie.type||classifyMovie(movie),duplicateOf:movie.duplicateOf})),sources:pair.slugs.map(slug=>'https://phimapi.com/phim/'+encodeURIComponent(bySlug.get(slug).apiSlug||slug))};});}
function writeJSON(file,data){fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(file+'.tmp',file);}
async function main(){
  const movies=readMovies(),metadata=JSON.parse(fs.readFileSync(path.join(ROOT,'relations-cache.json'),'utf8')),pairs=candidates(movies,metadata);let cache={version:1,records:{}};
  if(fs.existsSync(CACHE)){cache=JSON.parse(fs.readFileSync(CACHE,'utf8'));if(cache.version!==1||!cache.records||typeof cache.records!=='object')throw Error('Invalid duplicate evidence cache; preserved without replacement.');}
  if(process.argv.includes('--refresh')){
    const wanted=new Set(pairs.flatMap(pair=>pair.slugs)),queue=[...new Set(movies.filter(movie=>wanted.has(movie.slug)).map(movie=>movie.apiSlug||movie.slug))].filter(slug=>/^[a-z0-9][a-z0-9-]*$/.test(slug)&&(!cache.records[slug]||cache.records[slug].status==='error'||Date.now()-Date.parse(cache.records[slug].checkedAt)>7*86400000||process.argv.includes('--force')));let cursor=0,checked=0;console.log('Reviewing '+movies.length+' records; fetching '+queue.length+' exact source identities with two workers.');
    try{await Promise.all(Array.from({length:2},async()=>{while(cursor<queue.length){const slug=queue[cursor++];try{const response=await fetch('https://phimapi.com/phim/'+encodeURIComponent(slug),{signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw Error('HTTP '+response.status);cache.records[slug]=evidence(await response.json(),slug);}catch(error){cache.records[slug]={apiSlug:slug,checkedAt:new Date().toISOString(),status:'error',error:error.message};}checked++;if(checked%20===0){writeJSON(CACHE,cache);console.log('Checked '+checked+'/'+queue.length);}await new Promise(resolve=>setTimeout(resolve,1000));}}));}finally{writeJSON(CACHE,cache);}
  }
  const decisions=JSON.parse(fs.readFileSync(path.join(ROOT,'duplicate-decisions.json'),'utf8'));
  const rows=review(movies,cache,metadata,decisions),summary={records:movies.length,visibleCards:movies.filter(movie=>!movie.duplicateOf).length,confirmedAliases:movies.filter(movie=>movie.duplicateOf).length,candidatePairs:rows.length,sourceChecks:Object.keys(cache.records).length,decisions:Object.fromEntries(['already-linked','strong-match','keep-separate','needs-review'].map(key=>[key,rows.filter(row=>row.decision===key).length]))};
  writeJSON(path.join(ROOT,'duplicate-review.json'),{version:1,generatedAt:new Date().toISOString(),summary,pairs:rows});
  fs.writeFileSync(path.join(ROOT,'DUPLICATES.md'),'# Catalog duplicate review\n\n'+JSON.stringify(summary,null,2)+'\n\nAll source records are scanned. Matching names, artwork or cached TV IDs only nominate candidates; they never change the catalog automatically. Source API responses contain no stored stream URLs: playable URLs are fingerprinted.\n\n'+rows.map(row=>'## '+row.decision+' — '+row.movies.map(movie=>movie.title).join(' / ')+'\n\n'+row.reason+'\n\n'+row.movies.map(movie=>'- `'+movie.slug+'` — '+movie.year+'; '+movie.episodes+' episodes'+(movie.duplicateOf?'; duplicateOf `'+movie.duplicateOf+'`':'')).join('\n')+'\n\n'+row.sources.join('\n')).join('\n\n')+'\n');console.log(JSON.stringify(summary));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={candidates,evidence,classify,review};
