const test=require('node:test'),assert=require('node:assert/strict');
const {mount}=require('./app-updates');
const CURRENT='a'.repeat(64),NEXT='b'.repeat(64);
function fixture(page='index.html'){
  const listeners={},changes=[],nodes=[],store=new Map();
  const node=()=>({setAttribute(){},addEventListener(type,fn){this[type]=fn;},append(...items){this.items=items;},remove(){this.removed=true;}});
  const doc={visibilityState:'visible',readyState:'loading',currentScript:{src:'https://example.com/Frontend/app-updates.js'},activeElement:null,body:{append(item){nodes.push(item);}},querySelector(selector){return selector.startsWith('meta')?{content:CURRENT,dataset:{publishedAt:'2026-10-27T01:00:00Z'}}:doc.blocked?{}:null;},createElement:node,addEventListener(type,fn){listeners[type]=fn;},removeEventListener(){}};
  doc.querySelectorAll=()=>[];
  const win={document:doc,location:{href:'https://example.com/Frontend/'+page+'?q=test#x',pathname:'/Frontend/'+page,replace(url){changes.push(url);}},sessionStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},addEventListener(){},removeEventListener(){},setInterval(){return 1;},clearInterval(){},fetch:async()=>({ok:true,json:async()=>win.release}),release:{schemaVersion:1,version:NEXT,publishedAt:'2026-10-27T02:00:00Z'}};
  return{win,doc,listeners,changes,nodes,store};
}
test('an idle app/web page refreshes to a new release without losing URL state',async()=>{
  const f=fixture(),api=mount(f.win);await api.check(true);assert.equal(f.changes.length,1);const url=new URL(f.changes[0]);assert.equal(url.searchParams.get('q'),'test');assert.equal(url.hash,'#x');assert.equal(url.searchParams.get('__release'),NEXT.slice(0,16));assert.equal(f.store.get('lauphim_release_reload'),NEXT);api.stop();
});
test('watch pages and unsaved changes show an update notice, never automatic reload',async()=>{
  for(const scenario of ['watch.html','manage.html','dirty','focused','media']){const f=fixture(scenario.endsWith('.html')?scenario:'index.html');if(scenario==='focused')f.doc.activeElement={matches:()=>true};if(scenario==='media')f.doc.blocked=true;const api=mount(f.win);if(scenario==='dirty')f.listeners.input();await api.check(true);assert.equal(f.changes.length,0,scenario);assert.equal(f.nodes.length,1,scenario);assert.equal(api.state().pending,NEXT);assert.equal(api.apply(),true);assert.equal(f.changes.length,1);api.stop();}
});
test('offline, unchanged, malformed and older releases cannot refresh or erase personal storage',async()=>{
  for(const scenario of ['offline','same','bad','older']){const f=fixture();f.store.set('personal','keep');if(scenario==='offline')f.win.fetch=async()=>{throw Error('offline');};if(scenario==='same')f.win.release.version=CURRENT;if(scenario==='bad')f.win.release.version='javascript:alert(1)';if(scenario==='older')f.win.release.publishedAt='2026-10-26T01:00:00Z';const api=mount(f.win);await api.check(true);assert.equal(f.changes.length,0);assert.equal(f.nodes.length,0);assert.equal(f.store.get('personal'),'keep');api.stop();}
});
test('partial deployment cannot create a reload loop and hidden tabs do not fetch',async()=>{
  const f=fixture();f.store.set('lauphim_release_reload',NEXT);const api=mount(f.win);await api.check(true);assert.equal(f.changes.length,0);assert.equal(f.nodes.length,1);api.stop();
  const hidden=fixture();hidden.doc.visibilityState='hidden';hidden.win.fetch=async()=>{throw Error('must not fetch');};await mount(hidden.win).check(true);assert.equal(hidden.changes.length,0);
});
test('closed login overlays do not block updates while visible modal dialogs do',async()=>{
  for(const visible of [false,true]){const f=fixture();f.doc.querySelectorAll=()=>[{getClientRects:()=>visible?[{}]:[]}];const api=mount(f.win);await api.check(true);assert.equal(f.changes.length,visible?0:1);api.stop();}
});
