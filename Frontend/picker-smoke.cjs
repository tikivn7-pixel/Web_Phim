// Guided discovery checks in installed Chrome. External artwork is blocked; no video/provider calls.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lauphim-picker-'));let browser,socket,fail=false;const requests=[],exceptions=[];
  const server=http.createServer((request,response)=>{
    const url=new URL(request.url,'http://localhost');requests.push(url.pathname);
    if(fail&&url.pathname.endsWith('catalog-index.json')){response.writeHead(503);response.end();return;}
    const file=path.resolve(__dirname,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(__dirname+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end();return;}
    response.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(response);
  });
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
    browser=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+path.join(folder,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    const debug=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Chrome timeout')),15000);browser.on('error',reject);browser.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
    const targets=await(await fetch('http://'+new URL(debug).host+'/json/list')).json();socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
    let serial=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}}if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);});
    const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
    const waitFor=async expression=>{const end=Date.now()+15000;while(Date.now()<end){if(await evaluate(expression))return;await pause(100);}throw Error('Picker timeout: '+expression);};
    const shot=async name=>{const result=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(result.data,'base64'));};
    await call('Browser.setDownloadBehavior',{behavior:'deny'});await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['https://*']});await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await call('Page.navigate',{url:origin+'/picker.html'});await waitFor("document.getElementById('picker-app')?.hidden===false");
    const catalog=require('./catalog-format').decode(require('./data/catalog-index.json'));assert.equal(await evaluate("document.getElementById('picker-count').textContent"),catalog.length.toLocaleString('vi-VN'));await shot('picker-desktop');
    await evaluate("document.querySelector('[data-type=anime]').click();document.getElementById('picker-next').click();document.querySelector('[data-genre=\"Phiêu Lưu\"]').click();document.getElementById('picker-next').click();document.getElementById('picker-country').value='Nhật Bản';document.getElementById('picker-country').dispatchEvent(new Event('change'));document.getElementById('picker-from').value='2020';document.getElementById('picker-from').dispatchEvent(new Event('change'));document.getElementById('picker-next').click()");
    const first=await evaluate("Array.from(document.querySelectorAll('.picker-result')).map(card=>card.dataset.slug)");assert.equal(first.length,3);
    for(const slug of first){const movie=catalog.find(movie=>movie.slug===slug);assert.equal(movie.country,'Nhật Bản');assert.ok(Number(movie.year)>=2020);}
    await evaluate("document.getElementById('picker-draw').click()");const second=await evaluate("Array.from(document.querySelectorAll('.picker-result')).map(card=>card.dataset.slug)");assert.ok(second.every(slug=>!first.includes(slug)));
    await evaluate('history.back()');await waitFor("document.getElementById('picker-country').value==='Nhật Bản'&&!document.querySelector('[data-panel=\"2\"]').hidden");await evaluate('history.forward()');await waitFor("!document.querySelector('[data-panel=\"3\"]').hidden");assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.picker-result')).map(card=>card.dataset.slug)"),second);
    assert.ok(await evaluate("Array.from(document.querySelectorAll('.picker-result a')).every(a=>new URL(a.href).searchParams.has('slug'))"));await shot('picker-desktop-results');
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');await pause(200);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));await shot('picker-mobile-results');
    const keep=second.slice(0,2);await evaluate(`localStorage.setItem(MovieJournal.KEY,JSON.stringify({version:1,entries:Object.fromEntries(${JSON.stringify(catalog.map(movie=>movie.slug))}.filter(slug=>!${JSON.stringify(keep)}.includes(slug)).map(slug=>[slug,{status:'completed',rating:0,updatedAt:Date.now()}]))}));window.dispatchEvent(new Event('movie-journal-change'));`);
    assert.equal(await evaluate("document.getElementById('picker-count').textContent"),'2');assert.equal(await evaluate("document.querySelectorAll('.picker-result').length"),2);assert.ok(await evaluate("document.getElementById('picker-draw').disabled&&!document.getElementById('picker-restart-pool').hidden"));
    await evaluate("document.getElementById('picker-restart-pool').click()");assert.equal(await evaluate("document.querySelectorAll('.picker-result').length"),2);
    await evaluate("document.getElementById('picker-hide-completed').click()");assert.ok(Number(await evaluate("document.getElementById('picker-count').textContent"))>2);
    await call('Page.navigate',{url:origin+'/picker.html?country=Unknown&stage=3'});await waitFor("document.getElementById('picker-empty')?.hidden===false&&document.getElementById('picker-app')?.hidden===false");await evaluate("document.getElementById('picker-clear').click()");assert.ok(await evaluate("document.querySelectorAll('.picker-result').length>0"));
    fail=true;await call('Page.navigate',{url:origin+'/picker.html?retry=1'});await waitFor("document.getElementById('picker-error')?.hidden===false");fail=false;await evaluate("document.getElementById('picker-retry').click()");await waitFor("document.getElementById('picker-app')?.hidden===false");
    assert.ok(!requests.some(url=>url.includes('/data/movies.json')||url.includes('/data/details/')||url.includes('/data/movie-relations.json')));assert.deepEqual(exceptions,[]);console.log('Picker browser checks passed:',JSON.stringify({artifacts:folder,mobileWidth:390,matched:second.length}));
  }finally{if(socket)socket.close();if(browser)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
