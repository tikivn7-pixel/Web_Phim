const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildRelease,assetURL}=require('./build-release.cjs');
test('release stamping is stable, changes with assets, and versions every local dependency',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lauphim-release-test-'));
  t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(root).startsWith('lauphim-release-test-'));fs.rmSync(root,{recursive:true,force:true});});
  fs.writeFileSync(path.join(root,'index.html'),'<html><head><link href="style.css?v=old"><link href="https://example.com/a.css"></head><body><img src="logo.png"><script src="app.js"></script><a href="watch.html?slug=a">Play</a></body></html>');
  fs.writeFileSync(path.join(root,'style.css'),'body{color:red}');fs.writeFileSync(path.join(root,'app.js'),'void 0;');
  const first=buildRelease(root,'1.0.2'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,new RegExp('content="'+first.version+'"'));assert.ok(html.includes('style.css?v=old&__release='+first.version.slice(0,16)));assert.ok(html.includes('logo.png?__release='+first.version.slice(0,16)));assert.ok(html.includes('https://example.com/a.css'));assert.ok(html.includes('watch.html?slug=a'));
  assert.deepEqual(buildRelease(root,'1.0.2'),first);assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),html);
  fs.writeFileSync(path.join(root,'style.css'),'body{color:blue}');const second=buildRelease(root,'1.0.2');assert.notEqual(second.version,first.version);assert.deepEqual(buildRelease(root,'1.0.2'),second);
  assert.notEqual(buildRelease(root,'1.0.3').version,second.version);
});
test('asset versioning preserves queries/fragments and never rewrites external or navigation links',()=>{
  assert.equal(assetURL('index.html?slug=x','abc'),'index.html?slug=x');assert.equal(assetURL('data:image/png;base64,abc','abc'),'data:image/png;base64,abc');assert.equal(assetURL('//cdn.example.com/app.js','abc'),'//cdn.example.com/app.js');
  assert.equal(assetURL('./app.js?v=old&__release=old#section','new'),'./app.js?v=old&__release=new#section');assert.equal(assetURL('app.js?__release=old'),'app.js');
});
test('Git line-ending conversion does not create a fake release and damaged stamps are repaired',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lauphim-release-test-'));
  t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(root).startsWith('lauphim-release-test-'));fs.rmSync(root,{recursive:true,force:true});});
  const page=path.join(root,'index.html'),css=path.join(root,'app.css');
  fs.writeFileSync(page,'<html>\n<head>\n<link href="app.css">\n</head>\n<body></body></html>\n');fs.writeFileSync(css,'body {\n color:red;\n}\n');
  const first=buildRelease(root,'1.0.2');
  for(const file of [page,css])fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/\r?\n/g,'\r\n'));
  assert.equal(buildRelease(root,'1.0.2').version,first.version);
  fs.writeFileSync(page,fs.readFileSync(page,'utf8').replace(/<meta name="lauphim-release"[^>]*>\r?\n?/,'').replaceAll('__release='+first.version.slice(0,16),'__release=stale'));
  const repaired=buildRelease(root,'1.0.2');assert.equal(repaired.version,first.version);assert.equal(repaired.publishedAt,first.publishedAt);
  const html=fs.readFileSync(page,'utf8');assert.ok(html.includes('content="'+first.version+'"'));assert.ok(html.includes('__release='+first.version.slice(0,16)));assert.ok(!html.includes('__release=stale'));
});
