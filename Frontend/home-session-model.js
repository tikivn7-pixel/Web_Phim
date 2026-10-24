(function(root){
  const P=typeof module!=='undefined'&&module.exports?require('./personal-data'):root.PersonalData;
  function model(input,movies=[]){
    const data=P.normalize(input),journal=data.movie_journal_v1?.entries||{},catalog=new Map(movies.map(movie=>[movie.slug,movie]));
    const active=data.continue_watching_list.filter(movie=>!P.finished(movie)&&!['completed','paused','planned'].includes(journal[movie.slug]?.status));
    const saved=active[0],resume=saved?{...saved,title:catalog.get(saved.slug)?.title||saved.title,movie:catalog.get(saved.slug)||saved}:null;
    return{favorites:data.my_wishlist.length,watching:active.length,lists:Object.values(data.movie_lists_v1?.lists||{}).filter(list=>!list.deleted).length,resume};
  }
  function watchURL(item){const params=new URLSearchParams({slug:item.slug||'',title:item.title||'',ep:item.episode||1,episodes:item.totalEpisodes||1,server:item.server||0,return:'index.html'});if(['kkphim','nguonc','auto','hardcode'].includes(item.source))params.set('data_source',item.source);if(item.episodeName)params.set('target_episode',item.episodeName);if(Number(item.currentTime)>0)params.set('resume',Math.floor(Number(item.currentTime)));return 'watch.html?'+params;}
  const api={model,watchURL};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HomeSession=api;
})(globalThis);
