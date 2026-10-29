(function(){
  'use strict';
  const M=window.ComicsModel,$=id=>document.getElementById(id),el=(tag,value,cls)=>{const n=document.createElement(tag);if(value)n.textContent=value;if(cls)n.className=cls;return n;};
  let source='demo',page=1,query='',generation=0,active=null,chapterIndex=-1,observer=null;
  let store;try{store=localStorage;}catch{store={getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}};}
  const key=(src,id)=>src+':'+id;
  const state=()=>M.read(store);
  function progress(){return active?state()[key(source,active.id)]||{}:{};}
  function persist(values){if(!active)return;try{M.save(store,key(source,active.id),{...progress(),...values,title:active.title,updatedAt:Date.now()});}catch{$('reader-status').textContent='Trình duyệt chưa cho lưu tiến độ. Bạn vẫn có thể tiếp tục đọc.';}}
  function url(id='',chapter=''){const p=new URLSearchParams({source});if(id)p.set('id',id);if(chapter)p.set('chapter',chapter);return 'comics.html?'+p;}
  async function demo(){const r=await fetch('data/comics-demo.json');if(!r.ok)throw Error('Chưa tải được truyện mẫu.');return (await r.json()).items;}
  function poster(img,src){img.src=src||'Img/poster-placeholder.svg';img.alt='';img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='Img/poster-placeholder.svg';};}
  function show(name){for(const id of ['browse','detail','reader'])$(id).hidden=id!==name;document.body.classList.remove('paper');observer?.disconnect();}
  async function browse(){
    show('browse');const ticket=++generation;active=null;chapterIndex=-1;
    $('source').value=source;$('query').value=query;$('source-note').textContent=source==='demo'?'Truyện mẫu do LauPhim tạo để thử trình đọc; không phải dữ liệu từ API.':'Nguồn ngoài: Comics API tiếng Việt. Nội dung và khả năng tải ảnh phụ thuộc nguồn; không lưu bản sao chương trên GitHub.';
    $('list-title').textContent=source==='demo'?'Một câu chuyện ngắn, bắt đầu ở đây':'Truyện mới từ Comics API';$('comic-grid').replaceChildren();$('list-status').textContent='Đang tải truyện…';$('next-page').hidden=true;$('prev-page').disabled=page===1;$('page-number').textContent='Trang '+page;
    try{let items=source==='demo'?await demo():await M.list(query,page);if(ticket!==generation)return;
      if(source==='demo'&&query)items=items.filter(m=>m.title.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
      if($('only-saved').checked)items=items.filter(m=>state()[key(source,m.id)]?.saved);
      for(const m of items){const card=el('a',null,'comic-card');card.href=url(m.id);const img=el('img');poster(img,m.cover);card.append(img,el('h3',m.title));const p=state()[key(source,m.id)];card.append(el('p',p?.chapterId?'Đang đọc · '+(p.chapterTitle||'Mở lại chương'):source==='demo'?'Truyện mẫu · 3 chương':'Tiếng Việt · Nguồn ngoài'));$('comic-grid').append(card);}
      $('list-status').textContent=items.length?'':$('only-saved').checked?'Chưa có truyện đã lưu trong trang kết quả này.':'Không tìm thấy truyện.';$('next-page').hidden=source==='demo'||items.length===0;
    }catch(error){if(ticket===generation)$('list-status').textContent=(error instanceof TypeError?'Không kết nối được nguồn truyện. Nguồn có thể đang lỗi hoặc chưa cho phép website này truy cập.':error.message)+'\nChọn “Truyện mẫu tiếng Việt” để thử trình đọc ngay.';}
  }
  function chapters(){return active.chapters||[];}
  async function route(){
    const params=new URLSearchParams(location.search);source=params.get('source')==='comics'?'comics':'demo';const id=params.get('id'),cid=params.get('chapter');
    if(!id){await browse();return;}show('detail');const ticket=++generation;$('detail-body').textContent='Đang tải truyện…';
    try{const m=source==='demo'?(await demo()).find(m=>m.id===id):await M.detail(id);if(ticket!==generation)return;if(!m)throw Error('Không tìm thấy truyện.');active=m;
      if(cid){const index=chapters().findIndex(c=>c.id===cid);if(index<0)throw Error('Chương này không có trong truyện.');await read(index);return;}renderDetail();
    }catch(error){if(ticket!==generation)return;$('detail-body').replaceChildren(el('h1','Chưa mở được truyện'),el('p',error.message));}
  }
  function renderDetail(){
    show('detail');const box=$('detail-body');box.replaceChildren();document.title=active.title+' · LauPhim';const layout=el('div',null,'detail-layout'),cover=el('img',null,'detail-cover');poster(cover,active.cover);layout.append(cover);const info=el('div');info.append(el('p',source==='demo'?'TRUYỆN MẪU · TIẾNG VIỆT':'COMICS API · TIẾNG VIỆT','eyebrow'),el('h1',active.title),el('p',M.text(active.description)));
    const actions=el('div',null,'detail-actions'),p=progress(),resume=chapters().find(c=>c.id===p.chapterId)||chapters()[0];if(resume){const link=el('a',p.chapterId?'Đọc tiếp':'Bắt đầu đọc','primary');link.href=url(active.id,resume.id);actions.append(link);}const save=el('button',p.saved?'♥ Đã lưu truyện':'♡ Lưu truyện');save.type='button';save.onclick=()=>{persist({saved:!progress().saved});save.textContent=progress().saved?'♥ Đã lưu truyện':'♡ Lưu truyện';};actions.append(save);info.append(actions);layout.append(info);box.append(layout,el('h2','Danh sách chương'));
    const list=el('ol',null,'chapter-list');for(const c of chapters()){const li=el('li'),a=el('a',c.title+(c.id===p.chapterId?' · Đang đọc':''));a.href=url(active.id,c.id);li.append(a);list.append(li);}box.append(list);if(!chapters().length)box.append(el('p','Nguồn chưa cung cấp chương cho truyện này.'));
  }
  async function read(index){
    show('reader');chapterIndex=index;const ticket=++generation,c=chapters()[index],prior=progress(),resume=prior.chapterId===c.id?Number(prior.page)||0:0;
    document.title=c.title+' · '+active.title;$('reader-title').textContent=active.title;$('reader-back').href=url(active.id);$('reader-status').textContent='Đang tải '+c.title+'…';$('reader-pages').replaceChildren();$('chapter-select').replaceChildren();
    for(const entry of chapters()){const option=el('option',entry.title);option.value=entry.id;$('chapter-select').append(option);}$('chapter-select').value=c.id;$('chapter-prev').disabled=index===0;$('chapter-next').disabled=index===chapters().length-1;
    try{const pages=source==='demo'?c.pages:await M.chapter(active.id,c);if(ticket!==generation)return;if(!Array.isArray(pages)||!pages.length)throw Error('Chương chưa có ảnh.');persist({chapterId:c.id,chapterTitle:c.title,page:resume});
      const pending=[];pages.forEach((src,i)=>{const figure=el('figure',null,'comic-page');figure.dataset.page=i;const img=el('img');img.src=src;img.alt=c.title+' — trang '+(i+1);img.loading=i<=resume+1?'eager':'lazy';img.decoding='async';if(source==='demo'){img.width=800;img.height=1120;}let ready;const loaded=new Promise(resolve=>{ready=resolve;});if(i<=resume)pending.push(loaded);img.onload=()=>ready();img.onerror=()=>{ready();img.hidden=true;const message=el('div','Chưa tải được trang '+(i+1)+'. ','page-error'),retry=el('button','Thử tải lại ảnh');retry.type='button';retry.onclick=()=>{message.remove();img.hidden=false;img.src=src;};message.append(retry);figure.append(message);};figure.append(img,el('figcaption','Trang '+(i+1)+' / '+pages.length));$('reader-pages').append(figure);});
      await Promise.race([Promise.all(pending),new Promise(resolve=>setTimeout(resolve,8000))]);if(ticket!==generation)return;if(resume>0)document.querySelectorAll('.comic-page')[Math.min(resume,pages.length-1)]?.scrollIntoView({block:'start',behavior:'instant'});
      $('reader-status').textContent=c.title+' · '+pages.length+' trang'+(source==='demo'?' · Nội dung mẫu do LauPhim tạo':'');observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting&&ticket===generation)persist({page:Number(entry.target.dataset.page)});},{threshold:0,rootMargin:'-10% 0px -60% 0px'});document.querySelectorAll('.comic-page').forEach(n=>observer.observe(n));
    }catch(error){if(ticket===generation)$('reader-status').textContent=error.message+' Hãy quay lại danh sách chương hoặc thử tải lại trang.';}
  }
  function goChapter(index){if(index<0||index>=chapters().length)return;location.href=url(active.id,chapters()[index].id);}
  $('source').onchange=()=>{source=$('source').value;page=1;query='';history.replaceState(null,'',url());browse();};$('search-form').onsubmit=e=>{e.preventDefault();query=$('query').value.trim();page=1;browse();};$('retry').onclick=()=>browse();$('only-saved').onchange=()=>browse();$('next-page').onclick=()=>{page++;browse();};$('prev-page').onclick=()=>{page=Math.max(1,page-1);browse();};$('chapter-select').onchange=()=>goChapter(chapters().findIndex(c=>c.id===$('chapter-select').value));$('chapter-prev').onclick=()=>goChapter(chapterIndex-1);$('chapter-next').onclick=()=>goChapter(chapterIndex+1);$('reader-width').onchange=()=>$('reader-pages').classList.toggle('wide',$('reader-width').value==='wide');$('reader-theme').onchange=()=>document.body.classList.toggle('paper',$('reader-theme').value==='paper');
  window.addEventListener('popstate',route);window.addEventListener('keydown',e=>{if($('reader').hidden||e.ctrlKey||e.altKey||e.metaKey||/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)||e.target.isContentEditable||document.querySelector('dialog[open]'))return;if(e.key==='ArrowRight'){e.preventDefault();goChapter(chapterIndex+1);}if(e.key==='ArrowLeft'){e.preventDefault();goChapter(chapterIndex-1);}});route();
})();
