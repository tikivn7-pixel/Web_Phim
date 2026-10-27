const test=require('node:test'),assert=require('node:assert/strict');
const {HOME,isSite,isExternal,preferences}=require('./policy.cjs');
test('only the exact published site path can navigate inside the application',()=>{
  assert.ok(isSite(HOME));assert.ok(isSite(new URL('watch.html?slug=cuong-doat',HOME).href));
  for(const url of ['http://tikivn7-pixel.github.io/Web_Phim/Frontend/index.html','https://tikivn7-pixel.github.io.evil.example/Web_Phim/Frontend/','https://tikivn7-pixel.github.io/other/','https://tikivn7-pixel.github.io/Web_Phim/Frontend/../evil/','https://user@tikivn7-pixel.github.io/Web_Phim/Frontend/','file:///etc/passwd','javascript:alert(1)'])assert.equal(isSite(url),false,url);
});
test('external links never launch executable protocols or credential URLs',()=>{
  assert.ok(isExternal('https://example.com/movie'));assert.equal(isExternal(HOME),false);
  for(const url of ['file:///test.exe','cmd:test','ms-settings:test','http://example.com','https://user:pass@example.com','javascript:alert(1)'])assert.equal(isExternal(url),false);
});
test('remote content has Chromium sandbox and no Node or webview privileges',()=>{
  assert.equal(preferences.nodeIntegration,false);assert.equal(preferences.nodeIntegrationInSubFrames,false);assert.equal(preferences.contextIsolation,true);assert.equal(preferences.sandbox,true);assert.equal(preferences.webSecurity,true);assert.equal(preferences.allowRunningInsecureContent,false);assert.equal(preferences.webviewTag,false);assert.match(preferences.partition,/^persist:/);
});
