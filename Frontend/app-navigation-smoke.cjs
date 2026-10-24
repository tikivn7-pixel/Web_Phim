// Installed Chrome only. Tests navigation without provider traffic or downloads.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lauphim-navigation-'));
  let browser, socket;
  const exceptions = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
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
    const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
    const waitFor = async expression => { const until = Date.now() + 15000; while (Date.now() < until) { if (await evaluate(expression)) return; await pause(100); } throw Error('Navigation UI timeout: ' + expression); };
    const screenshot = async name => { const result = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(folder, name + '.png'), Buffer.from(result.data, 'base64')); };
    const key = async (value, code, keyCode, modifiers = 0) => {
      await call('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code, windowsVirtualKeyCode: keyCode, modifiers });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code, windowsVirtualKeyCode: keyCode, modifiers });
    };
    const typeSearch = value => evaluate('document.getElementById("app-quick-search").value=' + JSON.stringify(value) + ';document.getElementById("app-quick-search").dispatchEvent(new Event("input"))');
    const navigate = async route => { await call('Page.navigate', { url: origin + route }); await waitFor('document.readyState === "complete" && document.getElementById("app-bottom-nav")'); };
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
    await call('Browser.setDownloadBehavior', { behavior: 'deny' });
    await call('Network.setBlockedURLs', { urls: ['https://*'] });
    await call('Page.addScriptToEvaluateOnNewDocument', { source: `
      const realFetch = window.fetch.bind(window);
      window.fetch = (url, init) => String(url).startsWith('https://phimapi.com/phim/') ? Promise.resolve(new Response(JSON.stringify({status:true,movie:{slug:'yeu-tinh-goblin',name:'Goblin',episode_total:'2'},episodes:[{server_name:'Vietsub',server_data:[{name:'1',slug:'1',link_m3u8:'/broken.mp4'},{name:'2',slug:'2',link_m3u8:'/broken.mp4'}]}]}))) : realFetch(url, init);
    ` });
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await navigate('/index.html');
    assert.equal(await evaluate('getComputedStyle(document.getElementById("app-bottom-nav")).display'), 'none');
    assert.equal(await evaluate('document.querySelector("#app-bottom-nav [aria-current]").dataset.page'), 'home');
    await evaluate('document.querySelector(".app-quick-desktop").focus();document.querySelector(".app-quick-desktop").click()');
    assert.equal(await evaluate('document.getElementById("app-quick-dialog").open'), true, await evaluate('JSON.stringify({focus:document.activeElement.outerHTML,modals:[...document.querySelectorAll("dialog[open], [aria-modal=true]:not([hidden])")].map(n=>n.outerHTML.slice(0,250)),immersive:document.body.className,api:typeof AppNavigation.open})'));
    assert.ok(await evaluate('document.getElementById("app-quick-dialog").getBoundingClientRect().left > 200'), 'dialog is centered despite the legacy global margin reset');
    assert.equal(await evaluate('document.activeElement.id'), 'app-quick-search');
    await typeSearch('GHI CHU');
    assert.equal(await evaluate('document.querySelector("#app-quick-results a").getAttribute("href")'), 'notes.html');
    await key('ArrowDown', 'ArrowDown', 40);
    assert.equal(await evaluate('document.activeElement.dataset.page'), 'notes');
    await key('End', 'End', 35);
    assert.equal(await evaluate('document.activeElement.dataset.page'), 'film-search');
    await key('Home', 'Home', 36);
    assert.equal(await evaluate('document.activeElement.dataset.page'), 'notes');
    await key('Escape', 'Escape', 27);
    await waitFor('!document.getElementById("app-quick-dialog").open');
    assert.ok(await evaluate('document.activeElement.classList.contains("app-quick-desktop")'), 'closing restores launcher focus');

    await evaluate('document.getElementById("search-input").focus()');
    await key('k', 'KeyK', 75, 2);
    assert.ok(await evaluate('document.getElementById("app-quick-dialog").open'), 'Ctrl K works while typing into the site search');
    await key('k', 'KeyK', 75, 2);
    await waitFor('!document.getElementById("app-quick-dialog").open');
    assert.equal(await evaluate('document.activeElement.id'), 'search-input');
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"k",ctrlKey:true,isComposing:true,bubbles:true}))');
    assert.equal(await evaluate('document.getElementById("app-quick-dialog").open'), false, 'IME composition does not launch navigation');
    await evaluate('const other=document.createElement("dialog");other.id="other-modal";other.textContent="Another task";document.body.append(other);other.showModal()');
    await key('k', 'KeyK', 75, 2);
    assert.equal(await evaluate('document.getElementById("app-quick-dialog").open'), false, 'another modal keeps keyboard priority');
    await evaluate('document.getElementById("other-modal").close();document.getElementById("other-modal").remove();AppNavigation.open()');
    const hostile = '<img src=x onerror=alert(1)> & "Nhật" #1';
    await typeSearch(hostile);
    assert.equal(await evaluate('document.querySelectorAll("#app-quick-results img, #app-quick-results script").length'), 0);
    assert.equal(await evaluate('new URL(document.querySelector("#app-quick-results a").href).searchParams.get("q")'), hostile);
    await screenshot('quick-search-desktop');
    await key('Enter', 'Enter', 13);
    await waitFor('location.pathname.endsWith("/discover.html") && document.getElementById("app-bottom-nav")');
    assert.equal(await evaluate('new URLSearchParams(location.search).get("q")'), hostile);
    await navigate('/index.html?view=catalog&genre=Anime');
    assert.equal(await evaluate('document.querySelector("#app-bottom-nav [aria-current]").dataset.page'), 'discover');
    await evaluate('history.pushState({},"","index.html")');
    await waitFor('document.querySelector("#app-bottom-nav [aria-current]")?.dataset.page === "home"');
    await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 950, deviceScaleFactor: 1, mobile: true });
    await evaluate('document.getElementById("mobile-menu-btn").click()');
    await waitFor('document.body.classList.contains("menu-open") && getComputedStyle(document.getElementById("app-bottom-nav")).display === "none"');
    assert.equal(await evaluate('AppNavigation.open()'), false, 'hamburger menu retains its focus trap');
    await key('Escape', 'Escape', 27);
    await waitFor('!document.body.classList.contains("menu-open") && getComputedStyle(document.getElementById("app-bottom-nav")).display === "grid"');

    for (const [route, active, name] of [['/index.html', 'home', 'home'], ['/discover.html', 'discover', 'discover'], ['/library.html', 'library', 'library'], ['/notes.html', '', 'notes'], ['/watch.html?slug=yeu-tinh-goblin&ep=1', '', 'watch']]) {
      await navigate(route);
      for (const width of [1440, 320]) {
        await call('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width === 320 });
        await pause(180);
        assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, name + ' overflow at ' + width);
        assert.equal(await evaluate('getComputedStyle(document.getElementById("app-bottom-nav")).display'), width === 320 ? 'grid' : 'none');
        assert.equal(await evaluate('document.querySelector("#app-bottom-nav [aria-current]")?.dataset.page || ""'), active);
        if (width === 320) {
          assert.equal(await evaluate('document.querySelectorAll("#app-bottom-nav > *").length'), 5);
          assert.ok(await evaluate('parseFloat(getComputedStyle(document.body).paddingBottom) >= 72'));
          await evaluate('document.querySelector("#app-bottom-nav button").click()');
          assert.equal(await evaluate('document.getElementById("app-quick-dialog").open'), true);
          assert.equal(await evaluate('document.getElementById("app-quick-dialog").scrollWidth <= document.getElementById("app-quick-dialog").clientWidth + 1'), true);
          assert.ok(await evaluate('document.getElementById("app-quick-dialog").getBoundingClientRect().left >= 10'));
          await screenshot(name + '-palette-mobile');
          await key('Escape', 'Escape', 27);
        }
        await screenshot(name + '-' + width);
      }
    }
    await evaluate('document.body.classList.add("theater-mode")');
    await waitFor('getComputedStyle(document.getElementById("app-bottom-nav")).display === "none"');
    assert.equal(await evaluate('AppNavigation.open()'), false);
    await evaluate('document.body.classList.remove("theater-mode")');
    await waitFor('getComputedStyle(document.getElementById("app-bottom-nav")).display === "grid"');
    await evaluate('document.documentElement.requestFullscreen()');
    await waitFor('document.fullscreenElement && getComputedStyle(document.getElementById("app-bottom-nav")).display === "none"');
    assert.equal(await evaluate('AppNavigation.open()'), false);
    await evaluate('document.exitFullscreen()');
    await waitFor('getComputedStyle(document.getElementById("app-bottom-nav")).display === "grid"');
    assert.deepEqual(exceptions, []);
    console.log('App navigation browser checks passed (5 pages, desktop + 320px, keyboard, IME, modal priority, safe film queries, theater/fullscreen). Screenshots: ' + folder);
  } finally {
    if (socket) socket.close(); if (browser) browser.kill();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
