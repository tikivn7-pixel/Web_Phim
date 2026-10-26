const test=require('node:test'),assert=require('node:assert/strict');
const {deriveRelations}=require('./build-relations');
const {applyRelations,indexRelations}=require('./relation-policy');
const movies=[{slug:'a',title:'Battle One',group:'Battle'},{slug:'b',title:'Battle Two',group:'Battle'},{slug:'c',title:'Unrelated title',group:'Other'}];
const evidence=(id,season,type='tv')=>({status:'found',apiSlug:'',source:'https://phimapi.com/phim/test',tmdb:{id,season,type}});
function cache(records){return {movies:Object.fromEntries(Object.entries(records).map(([slug,value])=>[slug,{...value,apiSlug:slug}]))};}
test('same names do not link; exact series ID links different titles',()=>{
  const registry=deriveRelations(movies,cache({a:evidence(10,1),b:evidence(20,2),c:evidence(10,2)}));
  assert.deepEqual(registry.groups[0].members.map(m=>m.slug),['a','c']);
  const result=applyRelations(movies,registry);assert.equal(result[0].group,result[2].group);assert.equal(result[1].group,undefined);
});
test('same-season duplicates and movie versus TV identity never make a series',()=>{
  assert.equal(deriveRelations(movies,cache({a:evidence(10,1),b:evidence(10,1),c:evidence(10,2,'movie')})).groups.length,0);
});
test('manual membership is explicit; legacy groups never propagate',()=>{
  const registry={groups:[{id:'verified',sources:['https://example.com/evidence'],members:[{slug:'a'},{slug:'c'}]}]};
  const result=applyRelations(movies,registry);assert.equal(result[1].group,undefined);assert.equal(result[0].group,'verified');
  assert.equal(applyRelations(movies,{groups:[]}).filter(m=>m.group).length,0);
  assert.throws(()=>indexRelations({groups:[...registry.groups,...registry.groups]}));
  assert.throws(()=>indexRelations({groups:[{...registry.groups[0],sources:[]}]}));
});
test('published Battle Spirits is isolated and every published group has evidence',()=>{
  const registry=require('../Backend/movie-relations.json'),published=require('./data/movies.json');
  const index=indexRelations(registry,new Set(published.map(m=>m.slug)));
  assert.equal(published.find(m=>m.slug==='battle-spirits-re-tuyet-gioi-thien-khong').group,undefined);
  assert.equal(published.length,3700);
  for(const movie of published.filter(m=>m.group)){assert.equal(index.get(movie.slug).group.id,movie.group);assert.equal(movie.relationVerified,true);}
  const bySlug=new Map(published.map(m=>[m.slug,m]));
  assert.equal(bySlug.get('sat-thu-nhan-tao').group,bySlug.get('sat-thu-nhan-tao-2-mau-vat-con-lai').group);
  assert.notEqual(bySlug.get('sat-thu-nhan-tao').group,bySlug.get('phai-long-nang-phu-thuy').group);
  assert.notEqual(bySlug.get('nguoi-nhen-2002').group,bySlug.get('nguoi-nhen-tro-ve-nha').group);
  const taken=registry.groups.find(group=>group.id==='taken-films');
  assert.deepEqual(taken.members.map(member=>member.slug),['cuong-doat','cuong-doat-2','cuong-doat-3']);
  for(const member of taken.members){const film=bySlug.get(member.slug);assert.equal(film.group,'taken-films');assert.equal(film.type,'single');assert.equal(film.episodes,1);assert.equal(film.relationVerified,true);assert.equal(film.poster,'Img/posters/'+member.slug+'.jpg');}
});
