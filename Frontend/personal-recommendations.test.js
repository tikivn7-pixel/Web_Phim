const test=require('node:test'),assert=require('node:assert/strict');
const {recommend}=require('./personal-recommendations');
const movie=(slug,extra={})=>({slug,title:slug,country:'Nhật Bản',type:'animation',genres:'Hành Động, Phiêu Lưu',year:2024,...extra});
test('personal recommendations explain a real positive seed and exclude already saved or completed movies',()=>{
  const movies=[movie('liked'),movie('new'),movie('done'),movie('watching'),movie('paused'),movie('unrelated',{genres:'Âm Nhạc'})];
  const result=recommend(movies,{favorites:[{slug:'liked'}],watching:[{slug:'watching'}],journal:{entries:{done:{status:'completed',rating:0},paused:{status:'paused',rating:0}}}});
  assert.deepEqual(result.map(item=>item.movie.slug),['new']);assert.equal(result[0].seedSlug,'liked');assert.match(result[0].reason,/liked/);
});
test('own high ratings inform recommendations while low ratings override stale favorites',()=>{
  const movies=[movie('liked'),movie('new'),movie('rated')];
  assert.deepEqual(recommend(movies,{favorites:[{slug:'liked'}],journal:{liked:{rating:1}}}),[]);
  const result=recommend(movies,{journal:{liked:{status:'completed',rating:5},rated:{rating:2}}});
  assert.deepEqual(result.map(item=>item.movie.slug),['new']);assert.match(result[0].reason,/đánh giá cao liked/);
});
test('series recommendations use verified exact group IDs and never title similarity',()=>{
  const movies=[movie('seed',{group:'verified',relationVerified:true,genres:'Bí Ẩn'}),movie('sequel',{group:'verified',relationVerified:true,genres:'Chính Kịch'}),movie('misleading',{title:'seed 2',group:'wrong',genres:'Âm Nhạc'})];
  assert.deepEqual(recommend(movies,{favorites:[{slug:'seed'}]}).map(item=>item.movie.slug),['sequel']);
  assert.match(recommend(movies,{favorites:[{slug:'seed'}]})[0].reason,/Cùng loạt/);
});
test('unknown seeds, empty history and a tiny catalog produce an honest empty recommendation set',()=>{
  assert.deepEqual(recommend([movie('one')]),[]);assert.deepEqual(recommend([movie('one')],{favorites:[{slug:'missing'}]}),[]);
  assert.deepEqual(recommend([movie('one')],{favorites:[{slug:'one'}]}),[]);
});
