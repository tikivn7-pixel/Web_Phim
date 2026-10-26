(function(root){
  function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
  function imageUrl(value,fallback='Img/poster-placeholder.svg'){
    const url=String(value||'').trim();
    if(!url||/[\u0000-\u001f\u007f\\]/.test(url)||url.startsWith('//'))return fallback;
    if(/^https?:\/\//i.test(url)){try{const parsed=new URL(url);return parsed.username||parsed.password?fallback:parsed.href;}catch(e){return fallback;}}
    return /^[^:?#]+(?:[?#].*)?$/.test(url)&&!url.startsWith('#')?url:fallback;
  }
  function detailUrl(movie){return 'detail.html?'+new URLSearchParams({slug:movie.slug||'',...(!movie.slug?{title:movie.title||''}: {})});}
  function posterCandidates(saved={},current={}){
    const candidates=[current.poster,current.remotePoster,saved.poster,current.banner,saved.remotePoster,saved.banner];
    return [...new Set(candidates.map(value=>imageUrl(value,'')).filter(value=>value&&!/poster-placeholder\.svg|placehold\.co|via\.placeholder\.com|dummyimage\.com/i.test(value)))];
  }
  function setPoster(image,saved,current){
    const candidates=posterCandidates(saved,current);let index=0;
    const next=()=>{
      if(index<candidates.length){image.src=candidates[index++];return;}
      image.onerror=null;image.src='Img/poster-placeholder.svg';
    };
    image.onerror=next;next();
  }
  function score(movie,query,extra=''){
    const q=normalize(query);if(!q)return 0;
    const title=normalize(movie.title),slug=normalize(movie.slug),all=normalize([movie.title,movie.slug,movie.alternateTitles,movie.alternateSlugs,movie.genres,movie.country,movie.cast,movie.director,extra].join(' '));
    const terms=q.split(' ');if(!terms.every(term=>all.includes(term)))return -1;
    return (title===q?1000:0)+(title.startsWith(q)?300:0)+(title.includes(q)?150:0)+(slug===q?250:0)+terms.filter(term=>title.split(' ').includes(term)).length*20+(all.includes(q)?5:0);
  }
  function recommend(movies,current,limit=6){
    const genres=new Set(String(current.genres||'').split(',').map(normalize).filter(Boolean));
    return movies.filter(m=>(m.duplicateOf||m.slug)!==(current.duplicateOf||current.slug)&&!(current.group&&m.group===current.group)).map(movie=>{
      const shared=String(movie.genres||'').split(',').map(normalize).filter(g=>genres.has(g)).length;
      return {movie,score:shared*10+(movie.country&&movie.country===current.country?3:0)+(movie.type&&movie.type===current.type?2:0),shared};
    }).filter(item=>item.shared>0).sort((a,b)=>b.score-a.score||(Number(b.movie.year)||0)-(Number(a.movie.year)||0)||String(a.movie.title).localeCompare(String(b.movie.title),'vi')).slice(0,limit).map(item=>item.movie);
  }
  const api={normalize,imageUrl,detailUrl,posterCandidates,setPoster,score,recommend};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SiteTools=api;
})(globalThis);
