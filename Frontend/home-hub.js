(function(){
  function personal(){
    try{const lists=PersonalLists.active(PersonalLists.read()),summary=document.getElementById('hub-lists-summary');if(!summary)return;if(lists.length){const unique=new Set(lists.flatMap(list=>list.slugs));summary.textContent=`${lists.length} danh sách · ${unique.size} phim đã chọn. Mở lại những cảm hứng bạn dành riêng cho từng dịp.`;}else summary.textContent='Cuối tuần, một buổi tối hay xem cùng bạn. Xếp sẵn những bộ phim cho riêng mình.';}
    catch(_){}
  }
  function notes(){try{const target=document.getElementById('hub-notes-summary');if(!target||typeof MovieNotes==='undefined')return;const movies=Object.values(MovieNotes.read().movies),written=movies.filter(movie=>movie.note.text.trim()).length,marks=movies.reduce((sum,movie)=>sum+Object.values(movie.bookmarks).filter(mark=>!mark.deleted).length,0);target.textContent=written||marks?`${written} ghi chú · ${marks} mốc cảnh đã lưu. Mở lại những điều bạn muốn nhớ.`:'Ghi chú riêng, ẩn spoiler và lưu mốc để trở lại đúng cảnh bạn thích.';}catch(_){}}
  document.addEventListener('DOMContentLoaded',async()=>{
    personal();notes();
    try{const catalog=await loadStaticCatalog(),art=document.getElementById('hub-posters');if(!art)return;
      for(const slug of ['ten-cau-la-gi','your-name','quy-cau','thanh-guom-diet-quy-vo-han-thanh']){const movie=catalog.find(m=>m.slug===slug);if(!movie)continue;const img=document.createElement('img');img.alt='';img.loading='lazy';SiteTools.setPoster(img,{},movie);art.append(img);if(art.children.length===3)break;}
      if(art.children.length<3){for(const movie of catalog.filter(m=>String(m.poster).startsWith('Img/')).slice(0,3-art.children.length)){const img=document.createElement('img');img.alt='';img.loading='lazy';SiteTools.setPoster(img,{},movie);art.append(img);}}
    }catch(_){}
  });
  window.addEventListener('movie-lists-change',personal);window.addEventListener('storage',e=>{if(!e.key||e.key==='movie_lists_v1')personal();});
  window.addEventListener('movie-notes-change',notes);window.addEventListener('storage',e=>{if(!e.key||e.key==='movie_notes_v1')notes();});
})();
