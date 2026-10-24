(function(root){
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().trim();
  const genres=movie=>new Set(String(movie.genres||'').split(',').map(normalize).filter(Boolean));
  function recommend(movies,{favorites=[],watching=[],journal={}}={},limit=12){
    const entries=journal.entries||journal,bySlug=new Map(movies.map(movie=>[movie.slug,movie]));
    const seeds=new Map(),excluded=new Set([...favorites,...watching].map(item=>item.slug).filter(Boolean));
    for(const item of favorites){const movie=bySlug.get(item.slug),entry=entries[item.slug];if(movie&&!(entry?.rating>0&&entry.rating<3))seeds.set(movie.slug,{movie,weight:2,rated:false});}
    for(const [slug,entry] of Object.entries(entries)){
      if(entry.status||entry.rating>0)excluded.add(slug);
      const movie=bySlug.get(slug);if(movie&&entry.rating>=4)seeds.set(slug,{movie,weight:entry.rating,rated:true});
    }
    const signals=[...seeds.values()].sort((a,b)=>b.weight-a.weight||(entries[b.movie.slug]?.updatedAt||0)-(entries[a.movie.slug]?.updatedAt||0)).slice(0,200).map(seed=>({...seed,genres:genres(seed.movie),country:seed.movie.country,type:seed.movie.type,verifiedGroup:seed.movie.relationVerified&&seed.movie.group}));
    const result=[];
    if(!signals.length)return result;
    for(const movie of movies){
      if(!movie.slug||excluded.has(movie.slug))continue;
      const candidateGenres=[...genres(movie)],country=movie.country,type=movie.type,verifiedGroup=movie.relationVerified&&movie.group;let score=0,best=null;
      for(const seed of signals){
        let overlap=0;for(const genre of candidateGenres)if(seed.genres.has(genre))overlap++;
        const sameSeries=Boolean(verifiedGroup&&verifiedGroup===seed.verifiedGroup);
        if(!overlap&&!sameSeries)continue;
        const points=(overlap*3+(sameSeries?6:0)+(country&&country===seed.country?1:0)+(type&&type===seed.type?1:0))*seed.weight;
        score+=points;if(!best||points>best.points)best={seed,points,sameSeries};
      }
      if(score>0&&best){
        const reason=best.sameSeries?'Cùng loạt với '+best.seed.movie.title:(best.seed.rated?'Vì bạn đánh giá cao ':'Từ phim bạn đã lưu: ')+best.seed.movie.title;
        result.push({movie,score,reason,seedSlug:best.seed.movie.slug});
      }
    }
    return result.sort((a,b)=>b.score-a.score||(Number(b.movie.year)||0)-(Number(a.movie.year)||0)||String(a.movie.title).localeCompare(String(b.movie.title),'vi')).slice(0,Math.max(0,Math.min(24,Number(limit)||0)));
  }
  const api={recommend};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PersonalRecommendations=api;
})(globalThis);
