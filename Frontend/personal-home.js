(function(){
  let revision=0;
  async function refresh(){
    const grid=document.getElementById('personal-movie-slider');if(!grid)return;
    const token=++revision;
    try{
      const catalog=await loadStaticCatalog();if(token!==revision)return;
      const favorites=getWishlist(),journal=MovieJournal.read(localStorage),watching=getContinueWatchingList();
      const selected=PersonalRecommendations.recommend(catalog,{favorites,watching,journal});
      const empty=document.getElementById('personal-empty');empty.hidden=Boolean(selected.length);grid.hidden=!selected.length;
      document.querySelectorAll('#personal-home .slider-btn').forEach(button=>button.hidden=!selected.length);
      grid.replaceChildren();
      for(const item of selected){const card=createMovieCard(item.movie);const reason=document.createElement('p');reason.className='personal-reason';reason.textContent=item.reason;reason.title=item.reason;card.append(reason);grid.append(card);}
      updateWishlistUI();
    }catch(error){document.getElementById('personal-empty').hidden=false;grid.hidden=true;document.querySelectorAll('#personal-home .slider-btn').forEach(button=>button.hidden=true);}
  }
  document.addEventListener('DOMContentLoaded',refresh);
  window.addEventListener('storage',event=>{if(!event.key||['my_wishlist','movie_journal_v1','continue_watching_list'].includes(event.key))refresh();});
  window.addEventListener('movie-journal-change',refresh);
  window.addEventListener('wishlist-changed',refresh);
  window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});
  window.refreshPersonalRecommendations=refresh;
})();
