// Real local Hub + two Chrome tabs. Provider/media are mocked; downloads denied.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {createHub}=require('../Backend/hub-server.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lauphim-subtitles-rooms-'));let hub,browser;const sockets=[],exceptions=[];
 try{
  hub=await createHub({dataDir:path.join(folder,'private'),episodesEnabled:false});const address=await hub.start(),origin='http://127.0.0.1:'+address.port;
  browser=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+path.join(folder,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);browser.on('error',reject);browser.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const debugOrigin='http://'+new URL(endpoint).host;
  async function tab(targetID){
   const targets=await(await fetch(debugOrigin+'/json/list')).json(),target=targetID?targets.find(item=>item.id===targetID):targets.find(item=>item.type==='page');
   const socket=new WebSocket(target.webSocketDebuggerUrl);sockets.push(socket);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));let serial=0;const pending=new Map();
   socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}}if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);});
   const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
   const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
   const wait=async expression=>{const until=Date.now()+20000;while(Date.now()<until){if(await evaluate(expression))return;await pause(80);}throw Error('Timeout: '+expression);};
   const screenshot=async name=>{const result=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(result.data,'base64'));};
   await call('Page.enable');await call('Runtime.enable');await call('Network.enable');await call('Browser.setDownloadBehavior',{behavior:'deny'});await call('Network.setBlockedURLs',{urls:['https://*']});
   await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    const realFetch=window.fetch.bind(window);
    Object.defineProperty(HTMLMediaElement.prototype,'duration',{get(){return 1200;},configurable:true});
    Object.defineProperty(HTMLMediaElement.prototype,'readyState',{get(){return 2;},configurable:true});
    Object.defineProperty(HTMLMediaElement.prototype,'paused',{get(){return this._paused!==false;},configurable:true});
    Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{get(){return this._time||0;},set(v){this._time=Number(v);},configurable:true});
    HTMLMediaElement.prototype.play=function(){this._paused=false;this.dispatchEvent(new Event('play'));return Promise.resolve();};
    HTMLMediaElement.prototype.pause=function(){this._paused=true;this.dispatchEvent(new Event('pause'));};
    window.fetch=(url,init)=>String(url).startsWith('https://phimapi.com/phim/')?Promise.resolve(new Response(JSON.stringify({status:true,movie:{slug:'yeu-tinh-goblin',name:'Goblin',episode_total:'3'},episodes:[{server_name:'Vietsub',server_data:[3,1,2].map(n=>({name:String(n),slug:String(n),...(new URLSearchParams(location.search).has('smoke_embed')?{link_embed:'https://embed.example.test/player'}:{link_m3u8:'/broken.mp4'})}))}]}))):realFetch(url,init);
   `});
   await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});return{call,evaluate,wait,screenshot};
  }
  const host=await tab();
  await host.call('Page.navigate',{url:origin+'/watch.html?slug=yeu-tinh-goblin&title=Goblin&ep=2&room_create=1'});
  await host.wait("document.querySelector('.custom-subtitles')&&document.querySelector('.room-join')&&!document.querySelector('.room-join').disabled");
  await host.evaluate("WatchExperience.open('tools');window.__nativeTrack=document.getElementById('video-player').addTextTrack('subtitles','Provider');window.__beforeTracks=document.getElementById('video-player').textTracks.length;const video=document.getElementById('video-player');video.currentTime=2;video.pause();window.__subtitleUI=CustomSubtitles.attach(video,document.getElementById('watch-subtitles-slot'));window.__subtitleUI.load('1\\n00:00:01,000 --> 00:00:03,000\\nXin chào <img src=x onerror=evil()>');");
  assert.equal(await host.evaluate("document.querySelector('.custom-subtitle-overlay').textContent"),'Xin chào <img src=x onerror=evil()>');assert.equal(await host.evaluate("document.querySelector('.custom-subtitle-overlay img')===null"),true);
  assert.equal(await host.evaluate("document.getElementById('video-player').currentTime"),2);assert.equal(await host.evaluate("document.getElementById('video-player').paused"),true);
  await host.evaluate("const offset=document.querySelector('[data-subtitle-setting=offset]');offset.value='2';offset.dispatchEvent(new Event('change'))");
  assert.equal(await host.evaluate("document.querySelector('.custom-subtitle-overlay').hidden"),true);assert.equal(await host.evaluate("JSON.parse(localStorage.getItem('subtitle_preferences_v1')).offset"),2);
  await host.evaluate("document.querySelector('.custom-subtitles').open=true;document.getElementById('video-player').currentTime=150;document.querySelector('.room-join-form input').value='Chủ phòng';document.querySelector('.room-join-form').requestSubmit()");
  await host.wait("!document.querySelector('.room-live').hidden&&document.querySelector('.room-role').textContent==='Bạn là chủ phòng'");
  const invite=await host.evaluate("document.querySelector('.room-invite').value"),roomID=new URL(invite).searchParams.get('room');assert.ok(roomID);assert.ok(!invite.includes('token'));assert.ok(!invite.includes('resume'));
  assert.equal(hub.rooms.rooms.get(roomID).members.size,1);await host.evaluate("document.querySelector('.custom-subtitles').open=false;document.querySelector('.watch-room').scrollIntoView({block:'nearest'})");await host.screenshot('watch-room-host-desktop');
  const created=await host.call('Target.createTarget',{url:'about:blank'}),guest=await tab(created.targetId);
  await guest.call('Page.navigate',{url:invite});await guest.wait("document.querySelector('.room-join')&&!document.querySelector('.room-join').disabled");
  assert.equal(hub.rooms.rooms.get(roomID).members.size,1,'Opening invite must not autojoin');
  await guest.evaluate("document.querySelector('.room-join-form input').value='Bạn xem';document.querySelector('.room-join-form').requestSubmit()");await guest.wait("!document.querySelector('.room-live').hidden&&document.querySelector('.room-role').textContent==='Đang theo chủ phòng'");
  assert.equal(hub.rooms.rooms.get(roomID).members.size,2);
  await host.evaluate("document.getElementById('video-player').currentTime=225;document.getElementById('video-player').dispatchEvent(new Event('seeked'));document.getElementById('video-player').play()");
  await guest.wait("document.getElementById('video-player').currentTime>=225&&!document.getElementById('video-player').paused");
  await guest.evaluate("document.getElementById('video-player').pause()");await guest.wait("!document.getElementById('video-player').paused");
  const roomBeforeGuestNavigate=hub.rooms.rooms.get(roomID).revision;
  assert.equal(await guest.evaluate("WatchRoom.beforeNavigate(new URLSearchParams({slug:'yeu-tinh-goblin',ep:'3',target_episode:'2'}))"),false);assert.equal(hub.rooms.rooms.get(roomID).revision,roomBeforeGuestNavigate);
  await guest.evaluate("document.querySelector('.room-chat input').value='<img src=x onerror=evil()> Xin chào';document.querySelector('.room-chat').requestSubmit()");
  await host.call('Page.bringToFront');
  await host.wait("document.querySelector('.room-messages').textContent.includes('Xin chào')");assert.equal(await host.evaluate("document.querySelector('.room-messages img')===null"),true);
  await host.evaluate("document.getElementById('wp-next-btn').click()");await host.wait("new URLSearchParams(location.search).get('target_episode')==='2'&&document.querySelector('.room-role')?.textContent==='Bạn là chủ phòng'");
  await guest.call('Page.bringToFront');
  await guest.wait("new URLSearchParams(location.search).get('target_episode')==='2'&&document.querySelector('.room-role')?.textContent==='Đang theo chủ phòng'");
  assert.equal(await guest.evaluate("new URLSearchParams(location.search).get('ep')"),'3','Provider array index retained');assert.equal(await guest.evaluate("new URLSearchParams(location.search).get('room')"),roomID);assert.equal(await guest.evaluate("location.href.includes('token')"),false);
  await guest.call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});await guest.evaluate("WatchExperience.open('tools');document.querySelector('.watch-room').open=true;document.querySelector('.watch-room').scrollIntoView({block:'start'});window.scrollBy(0,-150)");assert.ok(await guest.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));await guest.screenshot('watch-room-guest-mobile');
  await guest.evaluate("document.querySelector('.room-leave').click()");await guest.wait("document.querySelector('.room-live').hidden&&!new URLSearchParams(location.search).has('room')");assert.equal(hub.rooms.rooms.get(roomID).members.size,1);
  await host.evaluate("document.querySelector('.room-leave').click()");await host.wait("document.querySelector('.room-live').hidden");assert.equal(hub.rooms.rooms.has(roomID),false);
  await host.call('Page.navigate',{url:origin+'/watch.html?slug=yeu-tinh-goblin&ep=2&smoke_embed=1&room_create=1'});await host.wait("document.querySelector('#video-wrapper-box iframe')&&document.querySelector('.custom-subtitles input[type=file]')?.disabled");assert.ok(await host.evaluate("document.querySelector('.subtitle-status').textContent.includes('Nguồn nhúng')"));
  await host.call('Page.navigate',{url:origin+'/rooms.html'});await host.wait("document.querySelectorAll('.rooms-movie').length===12");await host.evaluate("document.getElementById('rooms-search').value='Goblin';document.getElementById('rooms-search').dispatchEvent(new Event('input'))");assert.ok(await host.evaluate("[...document.querySelectorAll('.rooms-movie')].every(e=>e.textContent.toLowerCase().includes('goblin'))"));
  await host.evaluate("document.getElementById('rooms-invite-input').value='https://evil.example/watch.html?slug=x&room=room_bad123';document.getElementById('rooms-invite-form').requestSubmit()");assert.ok(await host.evaluate("document.getElementById('rooms-invite-status').textContent.includes('website LauPhim')"));await host.screenshot('rooms-lobby-desktop');
  assert.deepEqual(exceptions,[]);console.log('PASS: SRT/VTT plaintext/offset/provider-track preservation; real Hub two-tab explicit join, host playback/seek/episode sync, guest restrictions, safe chat/invites, leave, iframe honesty and mobile bounds.');console.log('Screenshots: '+folder);
 }finally{sockets.forEach(socket=>socket.close());browser?.kill();if(hub)await hub.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
