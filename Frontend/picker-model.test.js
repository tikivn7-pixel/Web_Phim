const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('./picker-model');
const movies=[
  {slug:'anime-jp',title:'Nhật',country:'Nhật Bản',type:'animation',genres:'Hoạt Hình, Phiêu Lưu',year:2024},
  {slug:'series-kr',title:'Hàn',country:'Hàn Quốc',type:'series',genres:'Tình Cảm, Chính Kịch',year:2023},
  {slug:'film-us',title:'Mỹ',country:'Mỹ',type:'single',genres:'Hành Động, Phiêu Lưu',year:2004},
  {slug:'animation-us',title:'Hoạt hình Mỹ',country:'Mỹ',type:'single',genres:'Hoạt Hình, Gia Đình',year:2020},
  {slug:'unknown-year',title:'Chưa rõ năm',country:'Nhật Bản',type:'series',genres:'Bí Ẩn'},
  {slug:'show-cn',title:'Chương trình',country:'Trung Quốc',type:'tvshows',genres:'TVShow',year:2026}
];
test('picker combines exact metadata and never infers country or genre from a title',()=>{
  assert.deepEqual(model.select(movies,{country:'Nhật Bản',type:'anime',genre:'Phiêu Lưu'}).map(movie=>movie.slug),['anime-jp']);
  assert.equal(model.select(movies,{country:'Trung Quốc',type:'anime'}).length,0);
  assert.equal(model.select(movies,{country:'Nhật Bản',genre:'Nhật'}).length,0);
  assert.equal(model.select(movies,{country:'Mỹ',type:'anime'}).length,1);
  assert.equal(model.select(movies,{type:'series'}).length,3);
  assert.equal(model.select(movies,{type:'film'}).length,2);
});
test('year limits exclude unknown years and inverted ranges return an honest empty pool',()=>{
  assert.deepEqual(model.select(movies,{from:'2023',to:'2024'}).map(movie=>movie.slug),['anime-jp','series-kr']);
  assert.deepEqual(model.select(movies,{from:'2024',to:'2023'}),[]);
  assert.equal(model.select(movies,{to:'2020'}).length,2);
  assert.equal(model.select([...movies,{slug:'blank-year',year:''},{slug:'zero-year',year:0}],{to:'2020'}).length,2);
  assert.equal(model.select(movies,{from:'invalid',to:'9999'}).length,movies.length);
});
test('completed exclusion uses local journal status and can be explicitly disabled',()=>{
  const journal={'anime-jp':{status:'completed'},'series-kr':{status:'watching'},'film-us':{status:'planned'}};
  assert.equal(model.select(movies,{},journal).length,movies.length-1);
  assert.equal(model.select(movies,{hideCompleted:false},journal).length,movies.length);
  assert.ok(model.select(movies,{},journal).some(movie=>movie.slug==='series-kr'));
});
test('draw samples without replacement across every turn and stops at exhaustion',()=>{
  let seen=[],all=[];
  for(let i=0;i<4;i++){const result=model.draw(movies,seen,2,()=>0.43);seen=result.seen;all.push(...result.movies.map(movie=>movie.slug));}
  assert.equal(all.length,movies.length);assert.equal(new Set(all).size,movies.length);
  assert.equal(model.draw(movies,seen,3).movies.length,0);
  assert.equal(model.draw(movies,[],3,()=>0).movies.length,3);
  assert.deepEqual(model.draw([],[],3),{movies:[],seen:[],remaining:0});
});
test('deduplicate catalog slugs before selection and sanitize random boundaries',()=>{
  const unique=model.select([...movies,movies[0],{title:'no slug'}]);assert.equal(unique.length,movies.length);
  assert.equal(model.draw(movies,[],1,()=>1).movies[0].slug,movies.at(-1).slug);
  assert.equal(model.draw(movies,[],1,()=>NaN).movies[0].slug,movies[0].slug);
});
test('share links round trip public filters only and step changes preserve the draw pool',()=>{
  const state={type:'anime',genre:'Hoạt Hình',country:'Nhật Bản',from:'2020',to:'2026',stage:3,hideCompleted:false,slugs:['secret-slug'],journal:{private:true}};
  const url=model.url(state);assert.deepEqual(model.readUrl(url.slice(url.indexOf('?'))),model.clean(state));
  assert.ok(!url.includes('secret'));assert.ok(!url.includes('private'));
  assert.equal(model.signature({...state,stage:0}),model.signature({...state,stage:3}));
  assert.equal(model.readUrl('?stage=100&type=oops').stage,3);assert.equal(model.readUrl('?stage=-3').stage,0);
});
test('published catalog facets stay separate and result slugs point to catalog members',()=>{
  const catalog=require('./catalog-format').decode(require('./data/catalog-index.json'));
  const facets=model.facets(catalog);assert.ok(facets.countries.includes('Nhật Bản'));assert.ok(facets.genres.includes('Hành Động'));
  assert.ok(!facets.genres.includes('Nhật Bản'));
  const selected=model.select(catalog,{country:'Trung Quốc',type:'anime'});
  for(const movie of selected){assert.equal(movie.country,'Trung Quốc');assert.ok(model.typeMatches(movie,'anime'));}
  const result=model.draw(model.select(catalog,{country:'Nhật Bản',type:'anime'}),[],3,()=>0.5);
  assert.equal(result.movies.length,3);assert.ok(result.movies.every(movie=>catalog.includes(movie)));
});
