// Public collection browsing checks using installed Chrome, no npm browser package.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lauphim-collections-'));
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
    await call('Page.navigate', { url: origin + '/collections.html' });
    await waitFor("document.querySelectorAll('#collections-grid .collection-card').length === 24");
    const actualGroups = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/movie-relations.json'), 'utf8')).groups.length;
    assert.equal(await evaluate("document.getElementById('collections-total').textContent"), actualGroups.toLocaleString('vi'));
    await pause(300); await screenshot('desktop');
    await evaluate("document.getElementById('collection-search').value = 'witch'; document.getElementById('collection-search').dispatchEvent(new Event('input'))");
    await waitFor("location.search.includes('q=witch') && document.querySelector('#collections-grid .collection-card[href*=the-witch-films]')");
    await evaluate("document.querySelector('#collections-grid .collection-card[href*=the-witch-films]').click()");
    await waitFor("document.querySelectorAll('#collection-members .collection-member').length === 2");
    assert.equal(await evaluate("document.getElementById('collection-detail-title').textContent"), 'The Witch');
    const slugs = await evaluate("[...document.querySelectorAll('#collection-members .collection-member')].map(item => item.dataset.slug)");
    assert.deepEqual(slugs, ['sat-thu-nhan-tao', 'sat-thu-nhan-tao-2-mau-vat-con-lai']);
    assert.ok(await evaluate("[...document.querySelectorAll('#collection-members .collection-member-actions a')].every(link => !link.href.includes('undefined'))"));
    await evaluate("document.querySelector('.collection-detail-back').click()");
    assert.equal(await evaluate("document.getElementById('collection-search').value"), 'witch');
    await evaluate("document.getElementById('collection-reset').click();document.getElementById('collection-country').value='Nhật Bản';document.getElementById('collection-country').dispatchEvent(new Event('change'))");
    assert.ok(await evaluate("[...document.querySelectorAll('#collections-grid .collection-card-meta')].every(item => item.textContent.includes('Nhật Bản'))"));
    await evaluate("document.getElementById('collection-reset').click();document.querySelector('.collections-chips [data-type=anime]').click()");
    assert.equal(await evaluate("document.querySelector('.collections-chips [data-type=anime]').getAttribute('aria-pressed')"), 'true');
    await evaluate("document.getElementById('collection-reset').click();[...document.querySelectorAll('#collection-pagination a')].find(link => link.getAttribute('aria-label') === 'Trang 2').click()");
    assert.ok(await evaluate("location.search.includes('page=2')"));
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.getElementById('collection-search').value='zzzz-no-match';document.getElementById('collection-search').dispatchEvent(new Event('input'))");
    await waitFor("!document.getElementById('collections-empty').hidden");
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'mobile list overflow');
    await evaluate("document.getElementById('collection-empty-reset').click();window.scrollTo(0,0)"); await screenshot('mobile');
    await call('Page.navigate', { url: origin + '/collections.html?group=the-witch-films' });
    await waitFor("document.querySelectorAll('#collection-members .collection-member').length === 2");
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'mobile collection detail overflow');
    await screenshot('mobile-detail');
    await call('Page.navigate', { url: origin + '/collections.html?group=unknown-movie-series' });
    await waitFor("document.querySelector('.collection-detail-not-found')");
    assert.ok(await evaluate("document.getElementById('collection-detail-title').textContent.includes('chưa có')"));
    failRegistry = true;
    await call('Page.navigate', { url: origin + '/collections.html?retry-test=1' });
    await waitFor("!document.getElementById('collections-error').hidden");
    failRegistry = false; await evaluate("document.getElementById('collections-retry').click()");
    await waitFor("!document.getElementById('collections-list').hidden");
    assert.ok(!requests.some(url => url.includes('/data/movies.json') || url.includes('/data/details/')), 'collection listing must stay on lightweight files');
    assert.deepEqual(exceptions, []);
    console.log('Collection browser checks passed:', JSON.stringify({ groups: actualGroups, artifacts: folder, mobileWidth: 390 }));
  } finally {
    if (socket) socket.close(); if (browser) browser.kill(); await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
