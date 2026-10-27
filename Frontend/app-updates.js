(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else if(!root.LauPhimUpdates)root.LauPhimUpdates=api.mount(root);
})(globalThis,function(){
  'use strict';
  function canAutoReload(doc,dirty){
    const modal=[...doc.querySelectorAll('dialog[open], [aria-modal="true"]')].some(item=>item.getClientRects().length&&doc.defaultView?.getComputedStyle(item).visibility!=='hidden');
    return !dirty&&doc.visibilityState!=='hidden'&&!modal&&!doc.querySelector('video, iframe')&&!doc.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
  }
  function mount(win){
    const doc=win.document,meta=doc.querySelector('meta[name="lauphim-release"]');
    const current=meta?.content,publishedAt=Date.parse(meta?.dataset.publishedAt||'');
    const base=new URL('./',doc.currentScript?.src||win.location.href),KEY='lauphim_release_reload';
    const protectedPage=/\/(?:watch|manage|notes|rooms|account|admin)\.html$/.test(win.location.pathname);
    let dirty=false,pending=null,checking=false,banner=null,lastCheck=0;
    const storage=action=>{try{return action(win.sessionStorage);}catch{return null;}};
    if(storage(s=>s.getItem(KEY))===current)storage(s=>s.removeItem(KEY));
    function apply(automatic=false){
      if(!pending)return false;
      if(automatic&&(protectedPage||!canAutoReload(doc,dirty)||storage(s=>s.getItem(KEY))===pending.version))return false;
      // Do not loop on an old cached HTML document during a partial deployment.
      const saved=storage(s=>{s.setItem(KEY,pending.version);return s.getItem(KEY)===pending.version;});
      if(automatic&&!saved)return false;
      const target=new URL(win.location.href);target.searchParams.set('__release',pending.version.slice(0,16));win.location.replace(target.href);return true;
    }
    function announce(){
      if(banner||!doc.body)return;
      banner=doc.createElement('aside');banner.className='app-update-notice';banner.setAttribute('role','status');
      const text=doc.createElement('span');text.textContent='Có bản LauPhim mới. Tải lại khi bạn sẵn sàng.';
      const button=doc.createElement('button');button.type='button';button.textContent='Cập nhật ngay';button.addEventListener('click',()=>apply());
      banner.append(text,button);doc.body.append(banner);
    }
    async function check(force=false){
      if(!current||checking||doc.visibilityState==='hidden'||(!force&&Date.now()-lastCheck<30000))return;
      checking=true;lastCheck=Date.now();
      try{
        const response=await win.fetch(new URL('release.json',base).href,{cache:'no-store',credentials:'omit',signal:win.AbortSignal?.timeout?.(10000)});
        if(!response.ok)return;
        const release=await response.json();
        if(release.schemaVersion!==1||!/^[a-f0-9]{64}$/.test(release.version)||!Number.isFinite(Date.parse(release.publishedAt))||Date.parse(release.publishedAt)<publishedAt)return;
        if(release.version===current){pending=null;banner?.remove();banner=null;return;}
        pending=release;
        if(!apply(true))announce();
      }catch(_){/* Keep the current application usable while offline. */}
      finally{checking=false;}
    }
    doc.addEventListener('input',()=>{dirty=true;},true);
    doc.addEventListener('change',()=>{dirty=true;},true);
    const onVisible=()=>{if(doc.visibilityState!=='hidden')check(true);};
    doc.addEventListener('visibilitychange',onVisible);win.addEventListener('online',onVisible);win.addEventListener('focus',onVisible);
    const interval=win.setInterval(()=>check(),120000);
    const start=()=>check(true);if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
    return{check,apply,state:()=>({current,pending:pending?.version||null,checking}),stop:()=>{win.clearInterval(interval);doc.removeEventListener('visibilitychange',onVisible);win.removeEventListener('online',onVisible);win.removeEventListener('focus',onVisible);}};
  }
  return{mount,canAutoReload};
});
