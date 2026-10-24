// Installed Chrome checks; external video/image traffic is blocked and providers mocked.
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { spawn } = require('child_process'), assert = require('assert/strict');
const root = __dirname, folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lauphim-updates-'));
let browser, socket, server;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + path.join(folder, 'profile'), 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const debugUrl = await new Promise((resolve, reject) => { let output = ''; const timer = setTimeout(() => reject(Error('Chrome startup timeout')), 15000); browser.on('error', reject); browser.stderr.on('data', chunk => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } }); });
  const targets = await (await fetch('http://' + new URL(debugUrl).host + '/json/list')).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let serial = 0; const pending = new Map(), exceptions = [];
  socket.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); } } if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  const waitFor = async expression => { const until = Date.now() + 15000; while (Date.now() < until) { if (await evaluate(expression)) return; await pause(100); } throw Error('UI timeout: ' + expression); };
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Browser.setDownloadBehavior', { behavior: 'deny' });
  await call('Network.setBlockedURLs', { urls: ['https://*', 'http://fonts.*'] });
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    if(!localStorage.getItem('__updates_seeded')){localStorage.clear();localStorage.setItem('__updates_seeded','1');localStorage.setItem('my_wishlist',JSON.stringify([{slug:'yeu-tinh-goblin'}]));}
    const realFetch=window.fetch.bind(window),realNow=Date.now;window.__offset=0;Date.now=()=>realNow()+window.__offset;window.__mode='baseline';window.__providerCalls=0;
    window.fetch=(url,init)=>{if(String(url).startsWith('https://phimapi.com/phim/')){window.__providerCalls++;if(window.__mode==='error')return Promise.reject(Error('Nguồn thử nghiệm đang lỗi'));const count=window.__mode==='new'?3:2;const rows=Array.from({length:count},(_,i)=>({name:String(i+1),link_m3u8:'https://stream.example/'+(i+1)}));return Promise.resolve(new Response(JSON.stringify({status:true,movie:{slug:'yeu-tinh-goblin',episode_current:'Tập '+count,status:'ongoing'},episodes:[{server_data:rows},{server_data:rows}]})));}return realFetch(url,init);};
  ` });
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: origin + '/updates.html' });
  await waitFor("document.getElementById('updates-checked').textContent==='1' && !EpisodeUpdates.service.busy()");
  assert.equal(await evaluate("document.getElementById('updates-new-count').textContent"), '0');
  assert.equal(await evaluate('window.__providerCalls'), 1);
  await evaluate("document.querySelector('[data-filter=all]').click()");
  assert.equal(await evaluate("document.querySelectorAll('.update-card').length"), 1);
  await evaluate("window.__offset+=3600000;window.__mode='new';document.getElementById('updates-refresh').click()");
  await waitFor("document.getElementById('updates-new-count').textContent==='1' && !EpisodeUpdates.service.busy()");
  assert.equal(await evaluate("document.querySelector('.update-badge').textContent"), '+1 tập mới');
  assert.equal(await evaluate("new URL(document.querySelector('.update-watch').href).searchParams.get('target_episode')"), '3');
  assert.equal(await evaluate("new URL(document.querySelector('.update-watch').href).searchParams.get('ep')"), '3');
  await evaluate("window.__offset+=3600000;window.__mode='error';document.getElementById('updates-refresh').click()");
  await waitFor("document.querySelector('.update-error') && !EpisodeUpdates.service.busy()");
  assert.equal(await evaluate("document.getElementById('updates-new-count').textContent"), '1');
  assert.ok(await evaluate("document.querySelector('.update-error').textContent.includes('Giữ kết quả')"));
  const screenshot = async name => { const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(folder, name + '.png'), Buffer.from(result.data, 'base64')); };
  await screenshot('updates-desktop');
  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'updates overflows mobile'); await screenshot('updates-mobile');
  await call('Page.navigate', { url: origin + '/index.html' });
  await waitFor("document.querySelectorAll('.home-update-card').length===1");
  assert.ok(await evaluate("document.querySelector('.home-update-card').textContent.includes('+1 tập mới')"));
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'home overflows mobile');
  await call('Page.navigate', { url: origin + '/updates.html' });
  await waitFor("document.querySelector('.update-ack')"); await evaluate("document.querySelector('.update-ack').click()");
  assert.equal(await evaluate("document.getElementById('updates-new-count').textContent"), '0');
  assert.equal(await evaluate("JSON.parse(localStorage.getItem(EpisodeUpdates.KEY)).entries['yeu-tinh-goblin'].newNames.length"), 0);
  await evaluate("localStorage.setItem('movie_journal_v1',JSON.stringify({version:1,entries:{'yeu-tinh-goblin':{status:'completed',rating:5,updatedAt:Date.now()}}}));window.dispatchEvent(new StorageEvent('storage',{key:'movie_journal_v1'}))");
  await waitFor("document.getElementById('updates-tracked').textContent==='0'");
  assert.equal(exceptions.length, 0, exceptions.join('\n'));
  console.log('Episode updates Chrome checks passed: baseline, automatic source observations, dedup, new episode links, errors retained, home shelf, acknowledgment, exclusions, desktop/mobile. Screenshots: ' + folder);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (socket) socket.close(); if (browser) browser.kill(); if (server) server.close(); });
