// Optional browser checks; source metadata is mocked and no film is downloaded.
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http"), assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const root = __dirname, chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lauphim-comics-"));
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

  await call('Page.addScriptToEvaluateOnNewDocument',{source: `const oldFetch=window.fetch.bind(window);window.fetch=(url,options)=>String(url).startsWith('https://comics-api.hieubq.io.vn/')?Promise.resolve(new Response(JSON.stringify({message:'down'}),{status:500})):oldFetch(url,options);`});
  const origin='http://127.0.0.1:'+server.address().port;
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:origin+'/comics.html'});
  await waitFor("document.querySelectorAll('.comic-card').length===1");
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
  await screenshot('comics-desktop');
  await call('Page.navigate',{url:origin+'/comics.html?source=demo&id=chuyen-xe-cuoi'});
  await waitFor("document.querySelectorAll('.chapter-list a').length===3");
  await evaluate("document.querySelector('.detail-actions button').click()");
  assert.equal(await evaluate("ComicsModel.read(localStorage)['demo:chuyen-xe-cuoi'].saved"),true);
  await call('Page.navigate',{url:origin+'/comics.html?source=demo&id=chuyen-xe-cuoi&chapter=2'});
  await waitFor("document.querySelectorAll('.comic-page img').length===2 && [...document.querySelectorAll('.comic-page img')].every(i=>i.naturalWidth>0)");
  assert.equal(await evaluate("document.getElementById('chapter-select').value"),'2');
  await evaluate("document.getElementById('reader-theme').value='paper';document.getElementById('reader-theme').dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("document.body.classList.contains('paper')"),true);
  await evaluate("document.getElementById('reader-width').value='wide';document.getElementById('reader-width').dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("document.getElementById('reader-pages').classList.contains('wide')"),true);
  await evaluate("document.querySelectorAll('.comic-page')[1].scrollIntoView()");await pause(500);
  await waitFor("ComicsModel.read(localStorage)['demo:chuyen-xe-cuoi'].page===1");
  await call('Page.reload');
  await waitFor("document.getElementById('chapter-select')?.value==='2' && document.querySelectorAll('.comic-page img').length===2");
  await waitFor("ComicsModel.read(localStorage)['demo:chuyen-xe-cuoi'].page===1 && document.querySelectorAll('.comic-page')[1].getBoundingClientRect().top<30");
  await evaluate("document.getElementById('chapter-next').click()");
  await waitFor("document.getElementById('chapter-select')?.value==='3'");
  assert.equal(await evaluate("document.getElementById('chapter-next').disabled"),true);
  await call('Emulation.setDeviceMetricsOverride',{width:320,height:844,deviceScaleFactor:1,mobile:true});
  await screenshot('reader-mobile');
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"),true);
  await call('Page.navigate',{url:origin+'/comics.html?source=comics'});
  await waitFor("document.getElementById('list-status')?.textContent.includes('HTTP 500')");
  assert.equal(await evaluate("document.querySelectorAll('.comic-card').length"),0);
  await screenshot('source-unavailable');
  await evaluate("document.getElementById('source').value='demo';document.getElementById('source').dispatchEvent(new Event('change'))");
  await waitFor("document.querySelectorAll('.comic-card').length===1");
  await evaluate("document.getElementById('only-saved').click()");
  await waitFor("document.querySelectorAll('.comic-card').length===1");
  assert.deepEqual(exceptions,[]);
  console.log('PASS: comic catalog, chapters, scoped bookmarks, resume, reader themes/width, chapter navigation, mobile bounds and provider failure. Screenshots: '+folder);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{socket?.close();if(browser){browser.kill();await new Promise(resolve=>browser.once('exit',resolve));}if(server)await new Promise(resolve=>server.close(resolve));});
