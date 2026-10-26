// Public collection browsing checks using installed Chrome, no npm browser package.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lauphim-discover-'));
  let browser, socket, failIndex = false, failCast = false;
  const requests = [], exceptions = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost'); requests.push(url.pathname);
    if (failIndex && url.pathname.endsWith('/data/catalog-index.json')) { response.writeHead(503); response.end(); return; }
    if (failCast && url.pathname.endsWith('/data/catalog-cast.json')) { response.writeHead(503); response.end(); return; }
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

await call('Page.navigate',{url:origin+'/discover.html'});await waitFor("document.querySelectorAll('#discover-grid .discover-card').length===24");
assert.ok(!requests.some(p=>p.includes('/details/')||p.endsWith('/movies.json')||p.endsWith('/catalog-search.json')));await pause(300);await screenshot('desktop');
for(const country of ['Trung Quốc','Mỹ']){await evaluate("document.getElementById('discover-country').value="+JSON.stringify(country)+";document.getElementById('discover-country').dispatchEvent(new Event('change'))");assert.ok(await evaluate("[...document.querySelectorAll('.discover-card')].every(c=>c.dataset.country==="+JSON.stringify(country)+")"));}
assert.equal(await evaluate("[...document.querySelectorAll('.discover-card')].some(c=>/Classroom Of The Elite|Ninja Kamui|Petals Of Reincarnation/.test(c.textContent))"),false);
await evaluate('history.back()');await waitFor("document.getElementById('discover-country').value==='Trung Quốc'");await evaluate('history.forward()');await waitFor("document.getElementById('discover-country').value==='Mỹ'");
await evaluate("document.querySelector('.discover-clear').click();document.querySelector('[data-view=list]').click()");assert.ok(await evaluate("document.getElementById('discover-grid').classList.contains('is-list')"));assert.equal(await evaluate("localStorage.getItem('discover_view_v1')"),'list');
await evaluate("document.querySelector('[data-view=grid]').click();document.querySelector('.discover-quick').focus();document.querySelector('.discover-quick').click()");await waitFor("document.getElementById('discover-preview-status').textContent.startsWith('Thông tin từ')");assert.equal(requests.filter(p=>p.includes('/details/')).length,1);
assert.ok(await evaluate("document.getElementById('discover-preview-detail').search.includes('return=discover')"));await evaluate("document.getElementById('discover-preview-favorite').click()");assert.equal(await evaluate("JSON.parse(localStorage.getItem('my_wishlist')).length"),1);
await evaluate("localStorage.setItem('my_wishlist','invalid');document.getElementById('discover-preview-favorite').click()");assert.equal(await evaluate("localStorage.getItem('my_wishlist')"),'invalid');assert.ok(await evaluate("document.getElementById('discover-preview-status').textContent.includes('dữ liệu lỗi')"));
await evaluate("localStorage.removeItem('my_wishlist');document.getElementById('discover-preview-close').click()");assert.ok(await evaluate("document.activeElement.classList.contains('discover-quick')"));
await evaluate("document.getElementById('discover-search').value='does-not-exist-98765';document.getElementById('discover-filters').requestSubmit()");assert.equal(await evaluate("document.getElementById('discover-empty').hidden"),false);await evaluate("document.getElementById('discover-reset').click()");
await evaluate("[...document.querySelectorAll('#discover-pagination button')].find(b=>b.textContent==='2').click()");assert.ok(await evaluate("location.search.includes('page=2')"));
for(const width of [390,320]){await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await pause(300);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'overflow '+width);await screenshot('mobile-'+width);await evaluate("document.querySelector('.discover-quick').click()");await waitFor("document.getElementById('discover-preview').open");assert.ok(await evaluate("document.getElementById('discover-preview').scrollWidth<=document.getElementById('discover-preview').clientWidth+1"));await screenshot('preview-'+width);await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await waitFor("!document.getElementById('discover-preview').open");}
await call('Page.navigate',{url:origin+'/detail.html?slug=bac-si-x'});
await waitFor("document.querySelector('#detail-cast a')?.textContent==='Kim Ji-won' && document.querySelectorAll('#detail-genres a').length>0");
const genre=await evaluate("document.querySelector('#detail-genres a').textContent");
assert.equal(await evaluate("new URL(document.querySelector('.fd-cast-person').href).searchParams.get('actor')"),'Kim Ji-won');
await evaluate("document.querySelector('#detail-genres a').click()");
await waitFor("location.pathname.endsWith('discover.html') && document.querySelectorAll('#discover-grid .discover-card').length>0");
assert.equal(await evaluate("new URLSearchParams(location.search).get('genre')"),genre);
const archive=JSON.parse(fs.readFileSync(path.join(__dirname,'data/movies.json'),'utf8'));
const genreSlugs=new Set(archive.filter(m=>require('./genre-utils').genres(m.genres).includes(genre)).map(m=>m.slug));
assert.ok((await evaluate("[...document.querySelectorAll('#discover-grid .discover-card')].map(c=>c.dataset.slug)")).every(slug=>genreSlugs.has(slug)));
await call('Page.navigate',{url:origin+'/detail.html?slug=bac-si-x'});await waitFor("document.querySelector('#detail-cast a')?.textContent==='Kim Ji-won'");
await evaluate("document.querySelector('#detail-cast a').click()");await waitFor("location.pathname.endsWith('discover.html') && document.querySelectorAll('#discover-grid .discover-card').length===6");
assert.equal(await evaluate("new URLSearchParams(location.search).get('actor')"),'Kim Ji-won');
assert.equal(await evaluate("document.getElementById('discover-heading').textContent"),'Phim có Kim Ji-won');
const expectedActor=require('./movie-people').index(archive).actors['kim ji won'];
assert.deepEqual((await evaluate("[...document.querySelectorAll('#discover-grid .discover-card')].map(c=>c.dataset.slug)")).sort(),[...expectedActor].sort());
await evaluate("document.getElementById('discover-country').value='Hàn Quốc';document.getElementById('discover-country').dispatchEvent(new Event('change'))");
await waitFor("new URLSearchParams(location.search).get('country')==='Hàn Quốc'");
assert.equal(await evaluate("new URLSearchParams(location.search).get('actor')"),'Kim Ji-won');
await evaluate('history.back()');await waitFor("!new URLSearchParams(location.search).has('country') && document.querySelectorAll('#discover-grid .discover-card').length===6");
await screenshot('actor-mobile');
failCast=true;await evaluate('window.__oldActorDocument=true');await call('Page.reload');
await waitFor("!window.__oldActorDocument && document.readyState==='complete' && !document.getElementById('discover-error').hidden");
assert.equal(await evaluate("document.querySelectorAll('#discover-grid .discover-card').length"),0,'cast index errors must not display unfiltered films');
failCast=false;await evaluate("document.getElementById('discover-retry').click()");await waitFor("document.querySelectorAll('#discover-grid .discover-card').length===6");
await evaluate("document.getElementById('discover-reset').click()");await waitFor("document.querySelectorAll('#discover-grid .discover-card').length===24 && !location.search");
for(const [query,canonical,alias]of [['Batman: The Dark Knight Returns, Part 2','nguoi-doi-ky-si-bong-dem-tro-lai-phan-2','ky-si-bong-dem-tro-lai-phan-2'],['Batman: The Killing Joke','batman-tro-dua-chet-choc','nguoi-doi-sat-thu-joke'],['Lego DC Batman: Family Matters','lego-dc-nguoi-doi-va-van-de-dai-gia-dinh','nguoi-doi-lego-van-de-gia-dinh']]){
  await evaluate("document.getElementById('discover-search').value="+JSON.stringify(query)+";document.getElementById('discover-filters').requestSubmit()");
  await waitFor("document.querySelectorAll('#discover-grid .discover-card').length===1");
  assert.equal(await evaluate("document.querySelector('#discover-grid .discover-card').dataset.slug"),canonical);
  await screenshot(canonical+'-single-card');
  await call('Page.navigate',{url:origin+'/detail.html?'+new URLSearchParams({slug:alias})});
  await waitFor("window.fdCurrentMovie?.slug==="+JSON.stringify(alias)+" || (typeof fdCurrentMovie!=='undefined' && fdCurrentMovie?.slug==="+JSON.stringify(alias)+")");
  assert.equal(await evaluate("fdCurrentMovie.duplicateOf"),canonical);
  assert.ok(await evaluate("document.getElementById('detail-title').textContent.length>0"));
  await call('Page.navigate',{url:origin+'/discover.html'});await waitFor("document.querySelectorAll('#discover-grid .discover-card').length===24");
}
failIndex=true;await call('Page.reload');await waitFor("document.readyState==='complete' && !document.getElementById('discover-error').hidden");failIndex=false;await evaluate("document.getElementById('discover-retry').click()");await waitFor("document.querySelectorAll('#discover-grid .discover-card').length===24");assert.deepEqual(exceptions,[]);console.log('Discovery browser checks passed, including exact actor/genre links, deduplicated cards and old alternative URLs. Screenshots: '+folder);
}finally{if(socket)socket.close();if(browser)browser.kill();await new Promise(resolve=>server.close(resolve));}}
main().catch(error=>{console.error(error);process.exitCode=1;});
