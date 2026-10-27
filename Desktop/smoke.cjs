'use strict';
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const artifact=process.env.LAUPHIM_EXE||path.join(__dirname,'../dist-desktop/win-unpacked/LauPhim.exe');
  if(!fs.existsSync(artifact))throw Error('Build Windows app first: npm run desktop:build');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lauphim-desktop-check-'));
  let socket,child,appPID;const pending=new Map(),errors=[];let serial=0;
  const previousProfiles=new Set(fs.readdirSync(os.tmpdir()).filter(name=>name.startsWith('lauphim-smoke-')));
  const deadline=setTimeout(()=>{console.error('Desktop smoke exceeded 120 seconds');socket?.close();child?.kill();process.exitCode=1;},120000);
  try{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    child=spawn(artifact,['--desktop-smoke','--remote-debugging-port=0'],{windowsHide:true,stdio:['ignore','ignore','pipe'],env});
    const debug=await new Promise((resolve,reject)=>{
      let output='',done=false;
      const finish=(error,url)=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);error?reject(error):resolve(url);};
      const timer=setTimeout(()=>finish(Error('App startup timeout')),45000);
      // Portable launchers do not forward Chromium stderr; discover the new
      // isolated profile's debugger endpoint instead of relying on that pipe.
      const poll=setInterval(()=>{for(const name of fs.readdirSync(os.tmpdir()).filter(name=>/^lauphim-smoke-\d+$/.test(name)&&!previousProfiles.has(name))){try{const [port,endpoint]=fs.readFileSync(path.join(os.tmpdir(),name,'DevToolsActivePort'),'utf8').trim().split(/\r?\n/);if(/^\d+$/.test(port)&&endpoint?.startsWith('/devtools/browser/')){appPID=Number(name.slice('lauphim-smoke-'.length));finish(null,'ws://127.0.0.1:'+port+endpoint);}}catch{}}},200);
      child.on('error',error=>finish(error));child.on('exit',code=>finish(Error('App exited: '+code+' '+output.slice(-1000))));
      child.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match)finish(null,match[1]);});
    });
    console.log('Application started; connecting debugger.');
    let targets=[];for(let i=0;i<60;i++){targets=await(await fetch('http://'+new URL(debug).host+'/json/list',{signal:AbortSignal.timeout(5000)})).json();if(targets.some(target=>target.type==='page'))break;await pause(200);}
    socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',()=>reject(Error('Debugger socket failed')),{once:true});});
    console.log('Debugger connected.');
    socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);});
    const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Debugger timeout: '+method));},12000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
    const wait=async expression=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(await evaluate(expression))return;await pause(250);}throw Error('App UI timeout: '+expression);};
    await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
    await call('Browser.setDownloadBehavior',{behavior:'deny'});
    await wait("document.readyState==='complete' && !!document.querySelector('a[href*=\"detail.html\"]')");
    console.log('Live homepage ready.');
    await wait("document.querySelector('.lauphim-brand img')?.naturalWidth>0");
    assert.ok(await evaluate("document.querySelector('.lauphim-brand img').getAttribute('src').includes('lauphim-logo.png')"),'desktop must load the current unified website logo');
    assert.equal(await evaluate('typeof window.require'),'undefined');assert.equal(await evaluate('typeof window.process'),'undefined');
    await evaluate("localStorage.setItem('desktop_smoke_check','retained')");
    for(const key of ['ArrowDown','ArrowRight']){await call('Input.dispatchKeyEvent',{type:'keyDown',key});await call('Input.dispatchKeyEvent',{type:'keyUp',key});}
    assert.ok(await evaluate("!!document.querySelector('.tv-nav-focus')"));
    const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'home.png'),Buffer.from(shot.data,'base64'));
    await call('Page.navigate',{url:'https://tikivn7-pixel.github.io/Web_Phim/Frontend/watch.html?slug=cuong-doat&episode=1'});
    await wait("document.querySelector('video')?.readyState>=2");
    const playback=await evaluate("({duration:document.querySelector('video').duration,error:document.querySelector('video').error?.code||null})");assert.ok(playback.duration>5000);assert.equal(playback.error,null);
    await call('Network.setBypassServiceWorker',{bypass:true});await call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await call('Page.reload',{ignoreCache:true});
    await wait("location.protocol==='file:' && !!document.querySelector('a[href^=https]')");
    assert.equal(await evaluate("document.querySelector('a').href"),require('./policy.cjs').HOME);
    await call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await evaluate("document.querySelector('a').click()");
    await wait("location.protocol==='https:' && !!document.querySelector('a[href*=\"detail.html\"]')");
    assert.equal(await evaluate("localStorage.getItem('desktop_smoke_check')"),'retained');
    assert.deepEqual(errors,[]);
    console.log('PASS: packaged Windows app loads live catalog, sandbox isolation, arrow navigation, Taken video metadata, offline fallback and reconnect. Screenshot: '+folder);
  }finally{
    clearTimeout(deadline);
    if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++serial,method:'Browser.close'}));await pause(500);}
    socket?.close();
    for(const pid of new Set([appPID,child?.pid].filter(Boolean)))if(process.platform==='win32')spawnSync('taskkill',['/pid',String(pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});else try{process.kill(pid);}catch{}
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
