// Public collection browsing checks using installed Chrome, no npm browser package.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lauphim-notes-'));
  let browser, socket, failRegistry = false;
  const requests = [], exceptions = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost'); requests.push(url.pathname);
    if (failRegistry && url.pathname.endsWith('/data/movie-relations.json')) { response.writeHead(503); response.end(); return; }
    const file = path.resolve(__dirname, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(__dirname + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + path.join(folder, 'profile'), 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    const debugUrl = await new Promise((resolve, reject) => {
      let output = ''; const timer = setTimeout(() => reject(Error('Chrome startup timeout')), 15000);
      browser.on('error', reject);
      browser.stderr.on('data', chunk => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    });
    const targets = await (await fetch('http://' + new URL(debugUrl).host + '/json/list')).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let serial = 0; const pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) { const task = pending.get(message.id); if (task) { pending.delete(message.id); message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result); } }
      if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
    const waitFor = async expression => { const until = Date.now() + 15000; while (Date.now() < until) { if (await evaluate(expression)) return; await pause(100); } throw Error('Collection UI timeout: ' + expression); };
    const screenshot = async name => { const result = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(folder, name + '.png'), Buffer.from(result.data, 'base64')); };
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
    await call('Browser.setDownloadBehavior',{behavior:'deny'});
    await call('Network.setBlockedURLs', { urls: ['https://*'] });
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });

    await call('Page.addScriptToEvaluateOnNewDocument',{source:`
      window.confirm=()=>true;
      const realFetch=window.fetch.bind(window);
      Object.defineProperty(HTMLMediaElement.prototype,'duration',{get(){return window.__noDuration?NaN:1200;},configurable:true});
      Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{get(){return this._time||0},set(v){this._time=v},configurable:true});
      window.fetch=(url,init)=>String(url).startsWith('https://phimapi.com/phim/')?Promise.resolve(new Response(JSON.stringify({status:true,movie:{slug:'yeu-tinh-goblin',name:'Goblin',episode_total:'2'},episodes:[{server_name:'Vietsub',server_data:[{name:'1',slug:'1',link_m3u8:'/broken.mp4'},{name:'2',slug:'2',link_m3u8:'/broken.mp4'}]}]}))):realFetch(url,init);
    `});
    await call('Page.navigate',{url:origin+'/notes.html'});
    await waitFor("document.getElementById('notes-status')?.textContent.includes('0 phim')");
    await evaluate("MovieNotes.setNote('yeu-tinh-goblin',{text:'N\u1ed9i dung b\u00ed m\u1eadt',spoiler:true});MovieNotes.addBookmark('yeu-tinh-goblin',{label:'L\u1ea7n g\u1eb7p \u0111\u1ea7u',time:42,episodeName:'1',episode:1,source:'kkphim',server:0});");
    await waitFor("document.querySelectorAll('.notes-card').length===1");
    assert.equal(await evaluate("document.body.textContent.includes('N\u1ed9i dung b\u00ed m\u1eadt')"),false);
    assert.equal(await evaluate("document.getElementById('bookmarks-count').textContent"),'1');
    await evaluate("document.querySelector('.notes-reveal').click()");
    assert.ok(await evaluate("document.querySelector('.notes-copy').textContent.includes('N\u1ed9i dung b\u00ed m\u1eadt')"));
    await evaluate("document.querySelector('.notes-edit').click();const input=document.querySelector('.movie-note-text');input.value='C\u1ea3m nh\u1eadn ri\u00eang';input.dispatchEvent(new Event('input'));document.querySelector('.movie-note-save').click();document.querySelector('.notes-edit').click();");
    assert.equal(await evaluate("MovieNotes.get('yeu-tinh-goblin').note.text"),'C\u1ea3m nh\u1eadn ri\u00eang');
    await screenshot('notes-desktop');
    await call('Emulation.setDeviceMetricsOverride',{width:320,height:844,deviceScaleFactor:1,mobile:true});
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'notes mobile overflow');
    await screenshot('notes-mobile');
    await evaluate("document.getElementById('notes-search').value='khongtimthay';document.getElementById('notes-search').dispatchEvent(new Event('input'))");
    assert.equal(await evaluate("document.getElementById('notes-no-results').hidden"),false);
    await evaluate("document.getElementById('notes-reset').click();document.querySelector('.notes-bookmarks a').click()");
    await waitFor("document.querySelector('.scene-capture')");
    assert.equal(await evaluate("new URLSearchParams(location.search).get('target_episode')"),'1');
    await evaluate("const video=document.getElementById('video-player');video.dispatchEvent(new Event('loadedmetadata'));video.currentTime=86;video.dispatchEvent(new Event('timeupdate'));document.querySelector('.scene-bookmarks input').value='C\u1ea3nh th\u1ee9 hai';document.querySelector('.scene-capture').click()");
    assert.equal(await evaluate("Object.values(MovieNotes.get('yeu-tinh-goblin').bookmarks).filter(b=>!b.deleted).length"),2);
    await evaluate("document.getElementById('video-player').currentTime=300;[...document.querySelectorAll('.scene-list a')].find(a=>a.textContent.includes('C\u1ea3nh th\u1ee9 hai')).click()");
    assert.equal(await evaluate("document.getElementById('video-player').currentTime"),86);
    await evaluate("document.querySelector('.scene-list button').click()");
    assert.equal(await evaluate("Object.values(MovieNotes.get('yeu-tinh-goblin').bookmarks).filter(b=>!b.deleted).length"),1);
    await evaluate("window.__noDuration=true;document.getElementById('video-player').dispatchEvent(new Event('durationchange'))");
    assert.equal(await evaluate("document.querySelector('.scene-capture').disabled"),true,'capture waits for actual media duration');
    await evaluate("window.__noDuration=false;document.getElementById('video-player').dispatchEvent(new Event('durationchange'))");
    await evaluate("window.scrollTo({top:document.querySelector('.scene-bookmarks').getBoundingClientRect().top+scrollY-140,behavior:'instant'})");
    await screenshot('watch-scene-mobile');
    await call('Page.navigate',{url:origin+'/detail.html?slug=yeu-tinh-goblin'});
    await waitFor("document.querySelector('#fd-note-control textarea')");
    assert.equal(await evaluate("document.querySelector('#fd-note-control textarea').value"),'C\u1ea3m nh\u1eadn ri\u00eang');
    await evaluate("const input=document.querySelector('#fd-note-control textarea');input.value='Unsaved draft';input.dispatchEvent(new Event('input'));MovieNotes.setNote('yeu-tinh-goblin',{text:'Other tab changed',spoiler:false})");
    assert.equal(await evaluate("document.querySelector('#fd-note-control textarea').value"),'Unsaved draft','concurrent updates preserve draft');
    await evaluate("document.querySelector('#fd-note-control .movie-note-save').click()");
    assert.equal(await evaluate("MovieNotes.get('yeu-tinh-goblin').note.text"),'Unsaved draft');
    await call('Page.navigate',{url:origin+'/notes.html'});
    await waitFor("document.querySelector('.notes-card')");
    assert.equal(await evaluate("document.getElementById('bookmarks-count').textContent"),'1');
    await call('Page.navigate',{url:origin+'/library.html'});
    await waitFor("document.getElementById('export-personal') && typeof PersonalData!=='undefined' && typeof MovieNotes!=='undefined'");
    await evaluate("window.__originalCreateURL=URL.createObjectURL;URL.createObjectURL=blob=>{window.__notesExport=blob;return window.__originalCreateURL(blob)};document.getElementById('export-personal').click()");
    assert.equal(await evaluate("window.__notesExport.text().then(text=>JSON.parse(text).data.movie_notes_v1.movies['yeu-tinh-goblin'].note.text)"),'Unsaved draft');
    assert.equal(await evaluate("window.__notesExport.text().then(text=>Object.values(JSON.parse(text).data.movie_notes_v1.movies['yeu-tinh-goblin'].bookmarks).filter(b=>!b.deleted).length)"),1);
    assert.deepEqual(exceptions,[]);
    console.log('Notes and scene browser checks passed:',JSON.stringify({artifacts:folder,mobileWidth:320}));
  } finally {
    if(socket)socket.close();if(browser)browser.kill();await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
