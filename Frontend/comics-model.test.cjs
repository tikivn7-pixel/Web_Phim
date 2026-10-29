const test=require('node:test'),assert=require('node:assert/strict'),M=require('./comics-model');
test('comic source data is plain text and images accept HTTPS only',()=>{
  assert.equal(M.comic({id:1,title:'<b>Truyện</b>',thumbnail:'javascript:alert(1)',chapters:[{id:2,name:'<img src=x>Chương'}]}).title,'Truyện');
  assert.equal(M.image('javascript:alert(1)'),'');assert.equal(M.image('http://example.com/a.png'),'');assert.equal(M.image('https://user:pass@example.com/a.png'),'');assert.equal(M.comic({title:'No ID'}),null);
});
test('provider errors are explicit and chapter images are sorted and validated',async()=>{
  await assert.rejects(M.list('',1,async()=>({ok:false,status:500})),/HTTP 500/);
  await assert.rejects(M.list('',1,async()=>({ok:true,json:async()=>({unexpected:[]})})),/cấu trúc/);
  const pages=await M.chapter('a',{id:1},async()=>({ok:true,json:async()=>({images:[{page:2,src:'https://example.com/2.png'},{page:1,src:'https://example.com/1.png'},{page:3,src:'javascript:alert(1)'}]})}));
  assert.deepEqual(pages,['https://example.com/1.png','https://example.com/2.png']);
});
test('reader progress and bookmarks survive independently for each source',()=>{
  let value=null;const storage={getItem:()=>value,setItem:(key,v)=>{value=v;}};
  M.save(storage,'demo:a',{chapterId:'2',page:1,saved:true});M.save(storage,'comics:a',{chapterId:'8',page:0});
  assert.equal(M.read(storage)['demo:a'].saved,true);assert.equal(M.read(storage)['comics:a'].chapterId,'8');
  assert.deepEqual(M.read({getItem:()=>'{bad'}),{});
});
