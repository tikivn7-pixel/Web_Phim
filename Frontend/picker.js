(function () {
  'use strict';
  const $ = id => document.getElementById(id), model = window.PickerModel, tools = window.SiteTools;
  const TITLES = ['Bạn muốn bắt đầu thế nào?', 'Hôm nay bạn thích thể loại gì?', 'Thêm một chút gu riêng.', 'Một trong những câu chuyện này?'];
  const DESCRIPTIONS = ['Một bộ phim gọn gàng, hay một thế giới để theo dõi lâu hơn?', 'Chọn điều khiến bạn muốn nhấn xem. Không cần chọn nếu bạn muốn bất ngờ.', 'Giới hạn quốc gia và năm nếu bạn đã có ý tưởng. Hoặc giữ tất cả.', 'Chọn ngẫu nhiên trong đúng bộ lọc của bạn. Đổi gợi ý để khám phá phim mới, không lặp lại trong lượt chọn này.'];
  let movies = [], journal = {}, state = model.readUrl(location.search), seen = [], picks = [], count = 3, poolKey = '', facets, loading = false;
  function node(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; }
  function completedCount() { return Object.values(journal).filter(entry => entry.status === 'completed').length; }
  function readJournal() { try { journal = window.MovieJournal?.read().entries || {}; } catch (_) { journal = {}; } }
  function pool() { return model.select(movies,state,journal); }
  function saveState(next, replace = false) {
    const nextState = model.clean(next), url = model.url(nextState);
    if (location.pathname.split('/').pop() + location.search !== url) history[replace ? 'replaceState' : 'pushState']({},'',url);
    state = nextState; render();
  }
  function setFilters(change) { $('picker-status').textContent = ''; saveState({...state,...change}); }
  function synchronizePool() {
    const key = model.signature(state) + '|' + Object.entries(journal).filter(([,entry]) => entry.status === 'completed').map(([slug]) => slug).sort().join('|');
    if(key !== poolKey) { seen = []; picks = []; poolKey = key; }
  }
  function draw() { const result = model.draw(pool(), seen, count); if(result.movies.length)picks = result.movies; seen = result.seen; render(); }
  function toStage(stage) { saveState({...state,stage}); $('picker-step-title').focus({preventScroll:true}); if(innerWidth < 800) $('picker-app').scrollIntoView({block:'start',behavior:'smooth'}); }
  function reset() { seen = []; picks = []; saveState(model.clean({})); $('picker-step-title').focus({preventScroll:true}); }
  function addOptions(select, values) { for(const value of values) { const option = node('option','',String(value)); option.value = value; select.append(option); } }
  function buildControls() {
    facets = model.facets(movies);
    addOptions($('picker-country'),facets.countries); addOptions($('picker-from'),facets.years); addOptions($('picker-to'),facets.years);
    for(const genre of ['',...facets.genres]) { const button = node('button','',genre || 'Thể loại nào cũng được'); button.type = 'button'; button.dataset.genre = genre; button.setAttribute('aria-pressed','false'); button.addEventListener('click',()=>setFilters({genre})); $('picker-genres').append(button); }
    // Keep a shared URL visible even when its facet is absent from this catalog.
    for(const [field,id,values] of [['country','picker-country',facets.countries],['from','picker-from',facets.years.map(String)],['to','picker-to',facets.years.map(String)]]) if(state[field] && !values.includes(state[field])) addOptions($(id),[state[field]]);
    if(state.genre && !facets.genres.includes(state.genre)) { const genre=state.genre,button=node('button','',genre);button.type='button';button.dataset.genre=genre;button.addEventListener('click',()=>setFilters({genre}));$('picker-genres').append(button); }
  }
  function card(movie,index) {
    const article = node('article','picker-result'); article.dataset.slug = movie.slug;
    const link = node('a','picker-result-poster'); link.href = tools.detailUrl(movie); link.setAttribute('aria-label','Thông tin '+movie.title);
    const img = node('img'); img.alt = ''; img.width = 240; img.height = 360; img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';tools.setPoster(img,movie,movie);
    link.append(img,node('span','picker-result-number',String(index+1).padStart(2,'0')));
    const copy=node('div','picker-result-copy'),title=node('h3'),titleLink=node('a','',movie.title);titleLink.href=tools.detailUrl(movie);title.append(titleLink);
    const type = model.typeMatches(movie,'anime') ? 'Anime / Hoạt hình' : movie.type === 'single' ? 'Phim lẻ' : 'Phim bộ';
    const meta=node('p','picker-result-meta',[type,movie.year,movie.country].filter(Boolean).join(' · '));
    const genres=node('span','picker-result-genre',model.genres(movie).slice(0,2).join(' / '));
    const watch=node('a','picker-watch','▶ Xem phim');watch.href='watch.html?'+new URLSearchParams({slug:movie.slug,title:movie.title,episodes:String(movie.episodes||1)});
    copy.append(title,meta);if(genres.textContent)copy.append(genres);copy.append(node('br'),watch);article.append(link,copy);return article;
  }
  function render() {
    if(!movies.length)return;
    synchronizePool(); const candidates=pool();
    if(state.stage === 3 && !picks.length && !seen.length && candidates.length){const result=model.draw(candidates,seen,count);picks=result.movies;seen=result.seen;}
    for(const button of document.querySelectorAll('.picker-stages button')){const step=Number(button.dataset.stage);button.classList.toggle('done',step<state.stage);if(step===state.stage)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');}
    for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=Number(panel.dataset.panel)!==state.stage;
    $('picker-step-number').textContent='BƯỚC '+String(state.stage+1).padStart(2,'0')+' / 04';$('picker-step-title').textContent=TITLES[state.stage];$('picker-step-description').textContent=DESCRIPTIONS[state.stage];
    $('picker-progress').textContent=`Bước ${state.stage+1} / 4`;$('picker-back').disabled=state.stage===0;$('picker-next').hidden=state.stage===3;$('picker-next').textContent=state.stage===2?'Xem gợi ý →':'Tiếp theo →';
    for(const button of document.querySelectorAll('[data-type]'))button.setAttribute('aria-pressed',String(button.dataset.type===state.type));
    for(const button of document.querySelectorAll('[data-genre]')) {
      button.setAttribute('aria-pressed',String(button.dataset.genre===state.genre));
      const matches=model.select(movies,{...state,genre:button.dataset.genre},journal).length;
      button.replaceChildren(document.createTextNode(button.dataset.genre||'Thể loại nào cũng được'),node('span','',matches.toLocaleString('vi-VN')));
    }
    for(const [field,id] of [['country','picker-country'],['from','picker-from'],['to','picker-to']]) {
      if(state[field] && !Array.from($(id).options).some(option=>option.value===state[field]))addOptions($(id),[state[field]]);
      $(id).value=state[field];
    }
    $('picker-hide-completed').checked=state.hideCompleted;
    $('picker-count').textContent=candidates.length.toLocaleString('vi-VN');$('picker-summary-filters').replaceChildren();
    const typeLabels={'':'Mọi kiểu phim',film:'Phim lẻ',series:'Phim bộ',anime:'Anime / Hoạt hình'};
    for(const filter of [typeLabels[state.type],state.genre||'Mọi thể loại',state.country||'Mọi quốc gia',state.from||state.to?`${state.from||'…'} – ${state.to||'…'}`:'Mọi thời kỳ'])$('picker-summary-filters').append(node('span','',filter));
    const completed=completedCount();$('picker-journal-note').textContent=completed?`${completed} phim được đánh dấu “Đã xem” trong nhật ký.`:'Chưa có phim được đánh dấu “Đã xem”. Bạn có thể ghi lại ở trang chi tiết phim.';
    $('picker-results').classList.toggle('single',count===1);$('picker-results').replaceChildren(...picks.map(card));
    $('picker-empty').hidden=candidates.length>0;$('picker-results').hidden=!candidates.length;$('picker-draw-actions').hidden=!candidates.length;
    $('picker-empty-description').textContent=state.from&&state.to&&Number(state.from)>Number(state.to)?'Năm bắt đầu đang lớn hơn năm kết thúc. Đổi lại khoảng năm để tìm phim.':'Chưa có phim khớp tất cả lựa chọn. Thử bỏ bớt một bộ lọc nhé.';
    const left=candidates.filter(movie=>!seen.includes(movie.slug)).length;
    $('picker-draw').disabled=left===0;$('picker-draw').textContent=left?'Đổi gợi ý ↻':'Đã xem hết gợi ý';$('picker-restart-pool').hidden=left!==0;
    $('picker-remaining').textContent=left?`Còn ${left.toLocaleString('vi-VN')} phim chưa gợi ý trong lượt này.`:'Bạn đã xem hết các lựa chọn phù hợp. Bắt đầu lại để chọn từ đầu.';
    for(const button of document.querySelectorAll('[data-count]'))button.setAttribute('aria-pressed',String(Number(button.dataset.count)===count));
    // Announce the candidate count only after direct interaction, without reading every result title.
    $('picker-count').setAttribute('aria-label',`${candidates.length} phim phù hợp`);
  }
  async function load() {
    if(loading)return;loading=true;$('picker-loading').hidden=false;$('picker-error').hidden=true;$('picker-app').hidden=true;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try {const response=await fetch('data/catalog-index.json',{signal:controller.signal});if(!response.ok)throw Error('catalog');const decoded=CatalogFormat.decode(await response.json());if(!Array.isArray(decoded)||!decoded.length)throw Error('catalog');movies=typeof PublishedEpisodes!=="undefined"?PublishedEpisodes.overlay(decoded,await PublishedEpisodes.load()):decoded;readJournal();if(!facets)buildControls();$('picker-app').hidden=false;render();}
    catch(_){$('picker-error').hidden=false;}finally{clearTimeout(timer);loading=false;$('picker-loading').hidden=true;}
  }
  for(const button of document.querySelectorAll('[data-type]'))button.addEventListener('click',()=>setFilters({type:button.dataset.type}));
  for(const button of document.querySelectorAll('[data-stage]'))button.addEventListener('click',()=>toStage(Number(button.dataset.stage)));
  for(const [id,key] of [['picker-country','country'],['picker-from','from'],['picker-to','to']])$(id).addEventListener('change',event=>setFilters({[key]:event.target.value}));
  for(const button of document.querySelectorAll('[data-count]'))button.addEventListener('click',()=>{const next=Number(button.dataset.count);if(next===count)return;count=next;if(pool().some(movie=>!seen.includes(movie.slug)))draw();else{picks=picks.slice(0,count);render();}});
  for(const button of document.querySelectorAll('[data-years]'))button.addEventListener('click',()=>{const current=new Date().getFullYear();setFilters(button.dataset.years==='recent'?{from:String(current-4),to:String(current)}:button.dataset.years==='classic'?{from:'',to:'2009'}:{from:'',to:''});});
  $('picker-hide-completed').addEventListener('change',event=>setFilters({hideCompleted:event.target.checked}));$('picker-back').addEventListener('click',()=>toStage(state.stage-1));$('picker-next').addEventListener('click',()=>toStage(state.stage+1));
  $('picker-reset').addEventListener('click',reset);$('picker-clear').addEventListener('click',()=>{seen=[];picks=[];saveState({...model.clean({}),stage:3});});$('picker-loosen').addEventListener('click',()=>toStage(2));$('picker-draw').addEventListener('click',draw);$('picker-restart-pool').addEventListener('click',()=>{seen=[];picks=[];draw();});$('picker-retry').addEventListener('click',load);
  $('picker-share').addEventListener('click',async()=>{const url=new URL(model.url(state),location.href).href;try{await navigator.clipboard.writeText(url);$('picker-status').textContent='Đã sao chép liên kết bộ lọc. Nhật ký và các phim đã gợi ý không được đưa vào liên kết.';}catch(_){$('picker-status').textContent='Liên kết bộ lọc: '+url;}});
  window.addEventListener('popstate',()=>{state=model.readUrl(location.search);render();});
  window.addEventListener('storage',event=>{if(event.key===(window.MovieJournal?.KEY||'movie_journal_v1')||event.key===null){readJournal();render();}});
  window.addEventListener('movie-journal-change',()=>{readJournal();render();});
  load();
})();
