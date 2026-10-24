// Chrome integration checks; all downloads denied and external traffic blocked.
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), { spawn } = require('child_process'), assert = require('assert/strict');
const root = __dirname, folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lauphim-calendar-pwa-')), mount = '/repo/Frontend/';
let browser, socket, server, serverOffline = false;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  server = http.createServer((req, res) => {
    if (serverOffline) { req.socket.destroy(); return; }
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(mount)) { res.writeHead(404).end(); return; }
    if (url.pathname.endsWith('/api/probe.json')) { res.setHeader('Content-Type', 'application/json'); res.end('{"private":true}'); return; }
    if (url.pathname.endsWith('/guard.js')) { res.setHeader('Content-Type', 'text/javascript'); res.end('/* protected */'); return; }
    if (url.pathname.endsWith('/stream.m3u8')) { res.setHeader('Content-Type', 'application/vnd.apple.mpegurl'); res.end('#EXTM3U'); return; }
    const file = path.resolve(root, decodeURIComponent(url.pathname.slice(mount.length)));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const type = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' }[path.extname(file)] || 'application/octet-stream';
    res.setHeader('Content-Type', type); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port, base = origin + mount;
  browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + path.join(folder, 'profile'), 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const debugUrl = await new Promise((resolve, reject) => { let output = ''; const timer = setTimeout(() => reject(Error('Chrome startup timeout')), 15000); browser.on('error', reject); browser.stderr.on('data', data => { output += data; const hit = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (hit) { clearTimeout(timer); resolve(hit[1]); } }); });
  const targets = await (await fetch('http://' + new URL(debugUrl).host + '/json/list')).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl); await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let serial = 0; const pending = new Map(), exceptions = [];
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id) { const item = pending.get(message.id); if (item) { pending.delete(message.id); message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result); } } if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text); if (message.method === 'Page.javascriptDialogOpening') call('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
  const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  const waitFor = async expression => { const until = Date.now() + 25000; while (Date.now() < until) { if (await evaluate(expression)) return; await pause(100); } throw Error('UI timeout: ' + expression); };
  const navigate = async file => { await evaluate('window.__oldCalendarDocument=true'); await call('Page.navigate', { url: base + file }); await waitFor('!window.__oldCalendarDocument && document.readyState === "complete"'); };
  const screenshot = async name => { const result = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(folder, name + '.png'), Buffer.from(result.data, 'base64')); };
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable'); await call('Browser.setDownloadBehavior', { behavior: 'deny' }); await call('Network.setBlockedURLs', { urls: ['https://*'] });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `window.confirm=()=>true; window.__notificationRequests=0; window.Notification=class { static permission='default'; static async requestPermission(){window.__notificationRequests++;this.permission='granted';return 'granted';} close(){} };` });
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base + 'calendar.html' });
  await waitFor("document.querySelectorAll('#planner-results button').length===24");
  assert.equal(await evaluate('window.__notificationRequests'), 0, 'permission must never be requested on load');
  await evaluate("document.getElementById('planner-search').value='Goblin';document.getElementById('planner-search').dispatchEvent(new Event('input'))");
  await waitFor("document.querySelector('#planner-results button[data-slug=\"yeu-tinh-goblin\"]')!==null");
  await evaluate("document.querySelector('#planner-results button[data-slug=\"yeu-tinh-goblin\"]').click();document.getElementById('planner-day').value='6';document.getElementById('planner-time').value='20:30';document.getElementById('planner-form').requestSubmit()");
  await waitFor("document.getElementById('planner-total').textContent==='1'");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem(ReleasePlanner.KEY)).entries['yeu-tinh-goblin'].time"), '20:30');
  await evaluate("document.querySelector('.planner-entry-actions button').click();document.getElementById('planner-time').value='21:15';document.getElementById('planner-form').requestSubmit()");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem(ReleasePlanner.KEY)).entries['yeu-tinh-goblin'].time"), '21:15');
  await evaluate("document.getElementById('planner-export').click()");
  assert.match(await evaluate("document.getElementById('planner-status').textContent"), /Đã xuất lịch/);
  await evaluate("document.querySelectorAll('.planner-entry-actions button')[1].click()");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem(ReleasePlanner.KEY)).entries['yeu-tinh-goblin'].deleted"), true);
  await evaluate(`(async()=>{const catalog=await EpisodeUpdates.loadCatalog();window.__plannerMovie=catalog.find(movie=>movie.slug==='yeu-tinh-goblin');const entries={};catalog.slice(0,5).forEach((movie,i)=>entries[movie.slug]={day:(new Date(Date.now()+7*3600000).getUTCDay()+i)%7,time:['19:00','20:30','21:15'][i%3],timezone:ReleasePlanner.ZONE,updatedAt:Date.now(),deleted:false});localStorage.setItem(ReleasePlanner.KEY,JSON.stringify({version:1,entries}));window.dispatchEvent(new StorageEvent('storage',{key:ReleasePlanner.KEY}));localStorage.setItem('my_wishlist',JSON.stringify([window.__plannerMovie]));})()`);
  await waitFor("document.getElementById('planner-total').textContent==='5'"); await evaluate('window.scrollTo(0,0)'); await pause(300); await screenshot('calendar-desktop');
  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'calendar overflows at 320px'); await screenshot('calendar-mobile');
  await evaluate("document.getElementById('planner-followed').checked=true;document.getElementById('planner-followed').dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("document.querySelectorAll('#planner-results button').length"), 1);
  await evaluate(`localStorage.setItem('episode_updates_v1',JSON.stringify({version:1,entries:{'yeu-tinh-goblin':{checkedAt:Date.now(),attemptAt:Date.now(),sourceSlug:'yeu-tinh-goblin',names:[{name:'1',episode:1,server:0},{name:'2',episode:4,server:1}],newNames:[]}}}))`);
  await navigate('notifications.html'); await waitFor("document.getElementById('notification-status').textContent.includes('Thông báo sẽ xuất hiện')");
  assert.equal(await evaluate("document.querySelectorAll('.notification-item').length"), 0);
  await evaluate("const cache=JSON.parse(localStorage.getItem('episode_updates_v1'));cache.entries['yeu-tinh-goblin'].newNames=['2'];localStorage.setItem('episode_updates_v1',JSON.stringify(cache));window.dispatchEvent(new StorageEvent('storage',{key:'episode_updates_v1'}))");
  await waitFor("document.getElementById('notification-unread').textContent==='1'");
  assert.ok(await evaluate("document.querySelector('.notification-item-actions a').getAttribute('href').includes('ep=4&target_episode=2&server=1')"));
  assert.equal(await evaluate('window.__notificationRequests'), 0); await evaluate("document.getElementById('notification-enable').click()");
  await waitFor('window.__notificationRequests===1'); assert.equal(await evaluate("JSON.parse(localStorage.getItem(NotificationCenter.PREFS)).enabled"), true);
  await evaluate("document.getElementById('notification-read-all').click()"); await waitFor("document.getElementById('notification-unread').textContent==='0'");
  await evaluate("document.querySelector('[data-notification-filter=all]').click()"); assert.equal(await evaluate("document.querySelectorAll('.notification-item.is-read').length"), 1);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'notifications overflow at 320px'); await screenshot('notifications-mobile');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false }); await screenshot('notifications-desktop');
  await waitFor("window.LauPhimPWA?.state().ready && navigator.serviceWorker.controller");
  const scope = await evaluate('(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.scope})()'); assert.equal(scope, base, 'scope must respect GitHub Pages subpath');
  await evaluate("Promise.all([fetch('api/probe.json'),fetch('guard.js',{headers:{Authorization:'Bearer smoke'}}),fetch('stream.m3u8'),fetch('data/movies.json')])"); await pause(300);
  const cached = await evaluate('(async()=>{const names=(await caches.keys()).filter(name=>name.startsWith("lauphim-shell-"));return (await Promise.all(names.map(async name=>(await (await caches.open(name)).keys()).map(r=>r.url)))).flat()})()');
  assert.ok(cached.some(url => url.endsWith('data/catalog-index.json'))); assert.ok(cached.length <= 220);
  assert.ok(!cached.some(url => /movies\.json|episode-snapshots|\/api\/|guard\.js|\.m3u8/.test(url)), 'private APIs and streams must never be cached');
  await navigate('calendar.html'); await waitFor("document.getElementById('planner-total').textContent==='5'");
  serverOffline = true; // CDP alone does not consistently emulate network loss inside service workers.
  await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await navigate('calendar.html?offline=1'); await waitFor("document.getElementById('planner-total').textContent==='5'"); assert.equal(await evaluate("document.querySelectorAll('#planner-results button').length"), 24, 'cached compact catalog must remain searchable');
  await navigate('never-visited.html'); await waitFor("document.querySelector('h1')?.textContent==='Câu chuyện vẫn ở đây.'");
  serverOffline = false;
  await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await navigate('notifications.html'); await waitFor('window.LauPhimPWA?.state().ready');
  const personal = await evaluate("localStorage.getItem('my_wishlist')");
  await evaluate('LauPhimPWA.clear()'); assert.equal(await evaluate("localStorage.getItem('my_wishlist')"), personal, 'clearing shell cache must keep personal data');
  assert.deepEqual(exceptions, []); console.log('Calendar, notifications and PWA smoke passed. Screenshots: ' + folder);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { try { socket?.close(); } catch (_) {} browser?.kill(); server?.closeAllConnections(); server?.close(); });
