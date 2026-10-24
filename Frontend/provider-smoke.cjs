// Optional browser checks; source metadata is mocked and no film is downloaded.
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http"), assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const root = __dirname, chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lauphim-provider-"));
let browser, socket, server;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  server = http.createServer((req, res) => {
    let file;
    try { file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname)); } catch (_) { res.writeHead(400); res.end(); return; }
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml" })[path.extname(file)] || "application/octet-stream");
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", "--user-data-dir=" + path.join(folder, "profile"), "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  const debugUrl = await new Promise((resolve, reject) => {
    let output = ""; const timer = setTimeout(() => reject(Error("Chrome startup timeout")), 15000);
    browser.on("error", error => { clearTimeout(timer); reject(error); });
    browser.stderr.on("data", chunk => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
  });
  const targets = await (await fetch("http://" + new URL(debugUrl).host + "/json/list")).json();
  socket = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  let serial = 0; const pending = new Map(), exceptions = [];
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) { const request = pending.get(message.id); if (request) { pending.delete(message.id); message.error ? request.reject(Error(message.error.message)) : request.resolve(message.result); } }
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === "Page.javascriptDialogOpening") call("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
  });
  const evaluate = async expression => { const response = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text); return response.result.value; };
  const waitFor = async expression => { const until = Date.now() + 15000; while (Date.now() < until) { if (await evaluate(expression)) return; await pause(100); } throw Error("UI timeout: " + expression); };
  const screenshot = async name => { const result = await call("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(folder, name + ".png"), Buffer.from(result.data, "base64")); };
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable");
  await call("Browser.setDownloadBehavior",{behavior:"deny"});
  await call("Network.setBlockedURLs", { urls: ["https://*"] });
  await call("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__confirmAnswer=true;window.__confirmCount=0;window.__providerRequests=[];
    window.confirm=()=>{window.__confirmCount++;return window.__confirmAnswer;};
    const realFetch=window.fetch.bind(window);
    window.fetch=(url,options)=>{
      if(String(url).startsWith('https://phimapi.com/phim/')){
        window.__providerRequests.push(String(url));const slug=String(url).split('/').pop();
        return Promise.resolve(new Response(JSON.stringify({status:true,movie:{slug,name:'Phim nhập thử <img src=x onerror=alert(1)>',type:'series',episode_total:'12',year:2025,country:[{name:'Nhật Bản'},{name:'Mỹ'}],category:[{name:'Hành Động'},{name:'Nhật Bản'}],poster_url:'/uploads/movies/demo.jpg',content:'<p>Mô tả phim thử</p>'}})));
      }
      return realFetch(url,options);
    };
  ` });
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: "http://127.0.0.1:" + server.address().port + "/manage.html" });
  await waitFor("document.querySelectorAll('#manage-list .movie-row').length===40 && typeof document.getElementById('provider-form').onsubmit==='function'");
  const baseCount = await evaluate("Number(document.getElementById('manage-count').textContent.match(/\\d+/)[0])");
  const originalTitle = await evaluate("document.getElementById('movie-form').elements.namedItem('title').value");
  await evaluate("document.getElementById('provider-input').value='https://kkphim.com/phim/provider-demo';document.getElementById('provider-form').requestSubmit()");
  await waitFor("!document.getElementById('provider-result').hidden");
  assert.equal(await evaluate("document.querySelector('#provider-title img')===null"), true, "provider text must not create markup");
  assert.equal(await evaluate("localStorage.getItem('catalog_editor_draft_v1')"), null, "preview must not write a draft");
  assert.equal(await evaluate("document.getElementById('movie-form').elements.namedItem('title').value"), originalTitle, "preview must not change the editor");
  await evaluate("document.getElementById('provider-load-editor').click()");
  assert.equal(await evaluate("document.getElementById('movie-form').elements.namedItem('country').value"), "", "ambiguous country must require editorial choice");
  assert.equal(await evaluate("document.getElementById('movie-form').elements.namedItem('genres').value"), "Hành Động");
  assert.equal(await evaluate("document.getElementById('movie-form').elements.namedItem('group').value"), "");
  await evaluate("document.getElementById('movie-form').requestSubmit()");
  assert.equal(await evaluate("localStorage.getItem('catalog_editor_draft_v1')"), null, "required country must block saving");
  await evaluate("document.getElementById('movie-form').elements.namedItem('country').value='Nhật Bản';document.getElementById('movie-form').requestSubmit()");
  await waitFor("JSON.parse(localStorage.getItem('catalog_editor_draft_v1')||'[]').some(movie=>movie.slug==='provider-demo')");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('catalog_editor_draft_v1')).length"), baseCount + 1);
  assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('catalog_editor_draft_v1')).find(movie=>movie.slug==='provider-demo').sourceCountries"), ["Nhật Bản", "Mỹ"]);
  await evaluate("document.getElementById('provider-form').requestSubmit()");
  await waitFor("!document.getElementById('provider-open-existing').hidden");
  assert.equal(await evaluate("document.getElementById('provider-load-editor').hidden"), true);
  await evaluate("document.getElementById('provider-open-existing').click()");
  assert.equal(await evaluate("document.getElementById('movie-form').elements.namedItem('slug').readOnly"), true);
  // Changing source previews cannot silently discard another unsaved edit.
  await evaluate("(()=>{const field=document.getElementById('movie-form').elements.namedItem('title');field.value='Chưa lưu';field.dispatchEvent(new Event('input',{bubbles:true}));window.__confirmAnswer=false;document.getElementById('provider-input').value='provider-demo-2';document.getElementById('provider-form').requestSubmit();})()");
  await waitFor("document.getElementById('provider-title').textContent && !document.getElementById('provider-load-editor').hidden");
  await evaluate("document.getElementById('provider-load-editor').click()");
  assert.equal(await evaluate("document.getElementById('movie-form').elements.namedItem('title').value"), "Chưa lưu");
  assert.equal(await evaluate("window.__confirmCount"), 1);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('catalog_editor_draft_v1')).length"), baseCount + 1);
  await evaluate("window.__confirmAnswer=true;document.getElementById('provider-load-editor').click()");
  assert.equal(await evaluate("document.getElementById('movie-form').elements.namedItem('slug').value"), "provider-demo-2");
  const countBeforeBadInput = await evaluate("window.__providerRequests.length");
  await evaluate("document.getElementById('provider-input').value='https://evil.com/phim/provider-demo';document.getElementById('provider-form').requestSubmit()");
  await waitFor("document.getElementById('provider-status').classList.contains('error')");
  assert.equal(await evaluate("window.__providerRequests.length"), countBeforeBadInput, "hostile input must make no provider request");
  await evaluate("document.getElementById('provider-input').value='provider-demo';document.getElementById('provider-form').requestSubmit()");
  await waitFor("!document.getElementById('provider-result').hidden && !document.getElementById('provider-open-existing').hidden");
  await evaluate("document.querySelector('.provider-import').scrollIntoView({block:'start'})"); await pause(250);
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), true, "desktop manager must fit");
  await screenshot("provider-desktop");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('.provider-import').scrollIntoView({block:'start'})"); await pause(250);
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), true, "mobile manager must fit");
  await screenshot("provider-mobile");
  assert.deepEqual(exceptions, []);
  console.log("Provider UI passed: preview, explicit country, draft/save, duplicate, dirty guard, safe input, desktop/mobile. Screenshots: " + folder);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  if (socket) socket.close(); if (browser) browser.kill(); if (server) server.closeAllConnections?.(); if (server) server.close();
});
