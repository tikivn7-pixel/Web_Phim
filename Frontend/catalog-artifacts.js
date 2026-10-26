const crypto = require("crypto");
const People = require("./movie-people");
const normalize = value => String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toLowerCase().replace(/[-_.,:;|]+/g," ").replace(/\s+/g," ");
function artifacts(movies) {
  const buckets=Array.from({length:32},()=>({}));
  const bucketFor=slug=>crypto.createHash("sha256").update(slug).digest()[0]%32;
  movies.forEach(movie=>{buckets[bucketFor(movie.slug)][movie.slug]=movie;});
  const files=buckets.map((bucket,i)=>{const text=JSON.stringify(bucket);return {file:`data/details/${i.toString(16).padStart(2,"0")}-${crypto.createHash("sha256").update(text).digest("hex").slice(0,12)}.json`,text};});
  const fields=["slug","title","year","episodes","country","genres","type","poster","banner","remotePoster","group","partName","relationOrder","relationVerified","addedAt","updatedAt","views","apiSlug","duplicateOf"];
  const index=movies.map(movie=>{
    const row={};fields.forEach(field=>{if(movie[field]!==undefined&&movie[field]!==null&&movie[field]!=="")row[field]=movie[field];});
    row.detailShard=bucketFor(movie.slug);
    if(movie.desc&&movie.desc!==movie.title)row.desc=String(movie.desc).slice(0,140);
    return row;
  });
  const bySlug=new Map(index.map(movie=>[movie.slug,movie]));
  for(const alias of index.filter(movie=>movie.duplicateOf)){
    const target=bySlug.get(alias.duplicateOf);if(!target)continue;
    target.alternateTitles=[...new Set([...(target.alternateTitles||[]),alias.title].filter(title=>title!==target.title))];
    target.alternateSlugs=[...(target.alternateSlugs||[]),alias.slug];
  }
  const search={};movies.forEach(movie=>{const value=normalize([movie.cast,movie.director].filter(Boolean).join(" | "));if(value.trim())search[movie.slug]=value;});
  const columns=["slug","title","poster","year","episodes","genres","country","type","detailShard","banner","group","partName","updatedAt","addedAt","views","desc","remotePoster","relationOrder","relationVerified","apiSlug"];
  columns.push('alternateTitles','alternateSlugs');
  const dictionaries={genres:[],country:[],type:[]},maps={genres:new Map(),country:new Map(),type:new Map()};
  const imageBase="https://phimimg.com/";
  const aliases=Object.fromEntries(index.filter(movie=>movie.duplicateOf).map(movie=>[movie.slug,movie]));
  const rows=index.filter(movie=>!movie.duplicateOf).map(movie=>{
    const row=columns.map(field=>{
      let value=movie[field]??null;
      if(dictionaries[field]&&value!==null){if(!maps[field].has(value)){maps[field].set(value,dictionaries[field].length);dictionaries[field].push(value);}value=maps[field].get(value);}
      if(["poster","banner","remotePoster"].includes(field)&&typeof value==="string"&&value.startsWith(imageBase))value="@"+value.slice(imageBase.length);
      return value;
    });
    while(row.length&&row[row.length-1]===null)row.pop();return row;
  });
  return {index:{schemaVersion:3,columns,rows,dictionaries,imageBase,details:files.map(f=>f.file),aliases},search,cast:People.index(movies),files};
}
module.exports={artifacts};
