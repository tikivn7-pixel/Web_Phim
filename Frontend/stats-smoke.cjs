// Real Chrome checks for the read-only personal dashboard. No provider requests.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lauphim-stats-')),requests=[],exceptions=[];
  let browser,socket,failCatalog=false;
  const server=http.createServer((request,response)=>{
    const url=new URL(request.url,'http://localhost');requests.push(url.pathname);
    if(failCatalog&&url.pathname.endsWith('/data/catalog-index.json')){response.writeHead(503);response.end();return;}
    const file=path.resolve(__dirname,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(__dirname+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end();return;}
    response.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(response);
  });
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    browser=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+path.join(folder,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    const debugUrl=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);browser.on('error',reject);browser.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
    const targets=await(await fetch('http://'+new URL(debugUrl).host+'/json/list')).json();
    socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
    let serial=0;const pending=new Map();
    socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}}if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);});
    const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
    const waitFor=async expression=>{const until=Date.now()+15000;while(Date.now()<until){if(await evaluate(expression))return;await pause(100);}throw Error('Stats UI timeout: '+expression);};
    const screenshot=async name=>{const result=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(result.data,'base64'));};
    await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
    await call('Network.setBlockedURLs',{urls:['https://*']});
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await call('Page.addScriptToEvaluateOnNewDocument',{source:"if(new URLSearchParams(location.search).has('blocked'))Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked by browser fixture')}});"});
    await call('Page.navigate',{url:origin+'/stats.html'});
    await waitFor("document.getElementById('stats-empty')&&!document.getElementById('stats-empty').hidden&&document.getElementById('stats-catalog-note').textContent.includes('khớp kho hiện tại')");
    assert.equal(await evaluate("document.getElementById('stats-personal-count').textContent"),'0');
    const seeded=await evaluate(`(async()=>{
      const movies=CatalogFormat.decode(await(await fetch('./data/catalog-index.json')).json());
      const a=movies.find(m=>m.slug==='yeu-tinh-goblin'),b=movies.find(m=>m.slug!==a.slug),c=movies.find(m=>m.slug!==a.slug&&m.slug!==b.slug),now=Date.now(),day=86400000;
      const data={my_wishlist:[{...a,addedAt:now-1000}],continue_watching_list:[{...b,episode:8,episodeName:'Tập 01',source:'kkphim',server:2,currentTime:123,duration:1200,progress:10,updatedAt:now-2000}],movie_journal_v1:{version:1,entries:{[a.slug]:{status:'completed',rating:5,updatedAt:now-3000},[b.slug]:{status:'watching',rating:4,updatedAt:now-4000},[c.slug]:{status:'planned',rating:0,updatedAt:now-20*day}}},episode_tracker_v1:{version:1,movies:{[a.slug]:{episodes:{'01':{watched:true,updatedAt:now-5000},'Tập 1':{watched:true,updatedAt:now-5000},'2':{watched:true,updatedAt:now-6000},'3':{watched:false,updatedAt:now-7000}}}}},movie_notes_v1:{version:1,movies:{[a.slug]:{note:{text:'THIS_IS_A_SECRET_SPOILER',spoiler:true,updatedAt:now-8000},bookmarks:{one:{label:'SECRET_BOOKMARK_LABEL',time:42,episodeName:'1',episode:8,source:'kkphim',server:2,updatedAt:now-9000,deleted:false}}}}},movie_lists_v1:{version:1,lists:{weekend:{name:'Cuối tuần',description:'',slugs:[a.slug,c.slug,'no-longer-in-catalog'],deleted:false,updatedAt:now-20*day}}}};
      PersonalData.write(localStorage,data);window.dispatchEvent(new Event('storage'));
      return {a:a.slug,b:b.slug,c:c.slug,genres:ViewingStats.build(data,movies,{now}).genres};
    })()`);
    await waitFor("document.getElementById('stats-personal-count').textContent==='4'");
    assert.equal(await evaluate("document.getElementById('stats-completed-count').textContent"),'1');
    assert.equal(await evaluate("document.getElementById('stats-episodes-count').textContent"),'2');
    assert.equal(await evaluate("document.getElementById('stats-bookmarks-count').textContent"),'1');
    assert.equal(await evaluate("document.body.textContent.includes('THIS_IS_A_SECRET_SPOILER')||document.body.textContent.includes('SECRET_BOOKMARK_LABEL')"),false);
    assert.ok(await evaluate("document.getElementById('stats-catalog-note').textContent.includes('1 phim chưa khớp')"));
    const target=await evaluate("Object.fromEntries(new URL(document.getElementById('stats-resume-link').href).searchParams)");
    assert.equal(target.slug,seeded.b);assert.equal(target.ep,'8');assert.equal(target.target_episode,'Tập 01');assert.equal(target.server,'2');assert.equal(target.data_source,'kkphim');assert.equal(target.resume,'123');
    assert.equal(await evaluate("document.querySelector('#stats-genres a').textContent"),seeded.genres[0].label);
    assert.equal(await evaluate("new URL(document.querySelector('#stats-genres a').href).searchParams.get('genre')"),seeded.genres[0].label);
    const before=await evaluate("JSON.stringify(Object.fromEntries(PersonalData.KEYS.map(k=>[k,localStorage.getItem(k)])))");
    await screenshot('stats-desktop');
    await evaluate("document.getElementById('stats-timeline').scrollIntoView({block:'center',behavior:'instant'})");await screenshot('stats-timeline-desktop');
    await evaluate("document.getElementById('stats-period').value='7';document.getElementById('stats-period').dispatchEvent(new Event('change'))");
    assert.equal(await evaluate("document.getElementById('stats-personal-count').textContent"),'2');assert.equal(await evaluate("new URLSearchParams(location.search).get('period')"),'7');
    await call('Page.reload');await waitFor("document.getElementById('stats-period')?.value==='7'&&document.getElementById('stats-personal-count').textContent==='2'");
    await evaluate("document.getElementById('stats-period').value='all';document.getElementById('stats-period').dispatchEvent(new Event('change'))");
    assert.equal(await evaluate("document.getElementById('stats-personal-count').textContent"),'4');
    assert.equal(await evaluate("JSON.stringify(Object.fromEntries(PersonalData.KEYS.map(k=>[k,localStorage.getItem(k)])))"),before,'dashboard and period controls never write personal data');
    await call('Emulation.setDeviceMetricsOverride',{width:320,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate("scrollTo({top:0,behavior:'instant'})");
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'dashboard mobile overflow');await screenshot('stats-mobile');
    await evaluate("document.getElementById('stats-timeline').scrollIntoView({block:'center',behavior:'instant'})");await screenshot('stats-timeline-mobile');
    failCatalog=true;await call('Page.reload');
    await waitFor("document.getElementById('stats-catalog-error')?.hidden===false&&document.getElementById('stats-personal-count')?.textContent==='4'");
    failCatalog=false;await evaluate("document.getElementById('stats-retry').click()");await waitFor("document.getElementById('stats-catalog-error').hidden&&document.querySelector('#stats-genres a')");
    await evaluate("localStorage.setItem('movie_journal_v1','{broken');window.dispatchEvent(new Event('storage'))");
    assert.equal(await evaluate("document.getElementById('stats-storage-warning').hidden"),false);
    await call('Page.reload');await waitFor("document.getElementById('stats-storage-warning')&&!document.getElementById('stats-storage-warning').hidden");
    assert.equal(await evaluate("localStorage.getItem('movie_journal_v1')"),'{broken');
    await call('Page.navigate',{url:origin+'/stats.html?blocked=1'});
    await waitFor("document.getElementById('stats-storage-warning')&&!document.getElementById('stats-storage-warning').hidden");
    assert.equal(await evaluate("document.getElementById('stats-empty').hidden"),true,'blocked storage never implies genuinely empty account');
    assert.ok(!requests.some(url=>url.endsWith('/data/movies.json')||url.includes('/data/details/')),'overview never requests full archive or detail shards');
    assert.deepEqual(exceptions,[]);
    console.log('Personal overview browser checks passed:',JSON.stringify({artifacts:folder,mobileWidth:320,uniqueFilms:4}));
  }finally{if(socket)socket.close();if(browser)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
