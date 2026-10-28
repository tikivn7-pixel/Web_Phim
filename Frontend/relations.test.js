const test=require('node:test'),assert=require('node:assert/strict');
const {deriveRelations}=require('./build-relations');
const {applyRelations,indexRelations}=require('./relation-policy');
const movies=[{slug:'a',title:'Battle One',group:'Battle'},{slug:'b',title:'Battle Two',group:'Battle'},{slug:'c',title:'Unrelated title',group:'Other'}];
test('Harry Potter includes eight ordered features and one 2022 reunion without duplicate cards',()=>{
  const archive=require('./data/movies.json'),bySlug=new Map(archive.map(movie=>[movie.slug,movie]));
  const ordered=['harry-potter-va-hon-da-phu-thuy','harry-potter-va-can-phong-bi-mat','harry-potter-va-tu-nhan-azkaban','harry-potter-va-chiec-coc-lua','harry-potter-va-menh-lenh-phuong-hoang','harry-potter-va-hoang-tu-lai','harry-potter-va-bao-boi-tu-than-phan-1','harry-potter-va-bao-boi-tu-than-phan-2','ky-niem-20-nam-harry-potter-tro-lai-hogwarts'];
  const years=[2001,2002,2004,2005,2007,2009,2010,2011,2022],alias='ky-niem-20-nam-harry-potter-tuu-truong-hogwarts';
  for(const [i,slug]of ordered.entries()){const movie=bySlug.get(slug);assert.equal(movie.apiSlug,slug);assert.equal(movie.episodes,1);assert.equal(movie.year,years[i]);assert.equal(movie.type,'single');assert.equal(movie.country,'Anh');assert.equal(movie.group,'harry-potter-films');assert.equal(movie.relationVerified,true);assert.equal(movie.poster,'Img/posters/'+slug+'.jpg');assert.ok(require('node:fs').statSync(require('node:path').join(__dirname,movie.poster)).size>1000);}
  const group=require('../Backend/movie-relations.json').groups.find(group=>group.id==='harry-potter-films');assert.deepEqual(group.members.map(member=>member.slug),ordered);assert.match(group.members[8].label,/Reunion Special/);
  assert.equal(bySlug.get(alias).duplicateOf,ordered[8]);assert.equal(bySlug.get(alias).year,2022);assert.equal(bySlug.get(alias).sourceYear,2021);
  const cards=require('./catalog-format').decode(require('./data/catalog-index.json'));assert.equal(cards.filter(movie=>ordered.includes(movie.slug)||movie.slug===alias).length,9);assert.ok(!cards.some(movie=>movie.slug===alias));assert.ok(require('./site-tools').score(cards.find(movie=>movie.slug===ordered[8]),bySlug.get(alias).title)>=0);
});
test('Teen Titans adds all eight sources as seven films with separate continuities and one verified Mayhem alias',()=>{
  const archive=require('./data/movies.json'),bySlug=new Map(archive.map(movie=>[movie.slug,movie])),index=require('./data/catalog-index.json'),cards=require('./catalog-format').decode(index);
  const canonical='teen-titans-go-cac-nu-sieu-anh-hung-dc-mayhem-trong-da-vu-tru',alias='biet-doi-thieu-nien-titan-xuat-kich-va-cac-nu-sieu-anh-hung-dc-hon-loan-trong-da-vu-tru';
  const slugs=['teen-titans-rac-roi-o-tokyo','teen-titans-go-to-the-movies',canonical,'teen-titans-thoa-thuan-judas','lien-minh-cong-ly-vs-teen-titans',alias,'biet-doi-thieu-nien-titan-xuat-kich-dem-toi-bat-dau-bung-sang-phan-2','biet-doi-thieu-nien-titan-xuat-kich-dem-toi-bat-dau-bung-sang-phan-1'];
  for(const slug of slugs){const movie=bySlug.get(slug);assert.equal(movie.apiSlug,slug);assert.equal(movie.episodes,1);assert.equal(movie.type,'animation');assert.equal(movie.country,'Mỹ');assert.equal(movie.poster,'Img/posters/'+slug+'.jpg');assert.ok(require('node:fs').statSync(require('node:path').join(__dirname,movie.poster)).size>1000);}
  assert.equal(cards.filter(movie=>slugs.includes(movie.slug)).length,7);assert.ok(!cards.some(movie=>movie.slug===alias));assert.equal(index.aliases[alias].duplicateOf,canonical);assert.equal(bySlug.get(alias).duplicateOf,canonical);
  assert.ok(require('./site-tools').score(cards.find(movie=>movie.slug===canonical),bySlug.get(alias).title)>=0);
  assert.equal(bySlug.get(slugs[0]).group,undefined);assert.equal(bySlug.get(slugs[1]).group,'teen-titans-go-films');assert.equal(bySlug.get(canonical).group,'teen-titans-go-films');assert.equal(bySlug.get(slugs[3]).group,'teen-titans-dcamu');assert.equal(bySlug.get(slugs[4]).group,'teen-titans-dcamu');
  const groups=require('../Backend/movie-relations.json').groups;
  assert.equal(groups.find(group=>group.id==='teen-titans-go-films').members.length,4);assert.deepEqual(groups.find(group=>group.id==='teen-titans-dcamu').members.map(member=>member.slug),['lien-minh-cong-ly-vs-teen-titans','teen-titans-thoa-thuan-judas']);
});
test('Gumball entries retain provider episode counts and distinguish the 2025 continuation',()=>{
  const bySlug=new Map(require('./data/movies.json').map(movie=>[movie.slug,movie]));
  const entries=[['the-gioi-ki-dieu-cua-gumball-phan-1',18,2011,'Mỹ'],['the-gioi-ki-dieu-cua-gumball-phan-2',20,2012,'Mỹ'],['the-gioi-ky-ao-cua-gumball',20,2025,'Anh']];
  for(const [slug,episodes,year,country]of entries){const movie=bySlug.get(slug);assert.equal(movie.apiSlug,slug);assert.equal(movie.episodes,episodes);assert.equal(movie.year,year);assert.equal(movie.country,country);assert.equal(movie.type,'animation');assert.equal(movie.group,'gumball');assert.equal(movie.relationVerified,true);assert.equal(movie.poster,'Img/posters/'+slug+'.jpg');assert.ok(require('node:fs').statSync(require('node:path').join(__dirname,movie.poster)).size>1000);}
  const group=require('../Backend/movie-relations.json').groups.find(group=>group.id==='gumball');assert.deepEqual(group.members.map(member=>member.slug),entries.map(([slug])=>slug));assert.match(group.members[2].label,/Wonderfully Weird.*2025/);assert.equal(group.members[2].season,1);
});
test('Dragon franchise retains all six films, identifies specials and keeps live action distinct from animation',()=>{
  const published=require('./data/movies.json'),bySlug=new Map(published.map(movie=>[movie.slug,movie]));
  const slugs=['bi-kip-luyen-rong','bi-kip-luyen-rong-mon-qua-cua-sun-rang','bi-kip-luyen-rong-2','bi-kip-luyen-rong-vung-dat-bi-an','bi-kip-luyen-rong-tro-ve-nha','bi-kip-luyen-rong-2025'];
  const group=require('../Backend/movie-relations.json').groups.find(group=>group.id==='how-to-train-your-dragon');
  assert.deepEqual(group.members.map(member=>member.slug),slugs);
  for(const slug of slugs){const movie=bySlug.get(slug);assert.equal(movie.apiSlug,slug);assert.equal(movie.episodes,1);assert.equal(movie.type,slug.endsWith('2025')?'single':'animation');assert.equal(movie.country,'Mỹ');assert.equal(movie.relationVerified,true);assert.ok(!movie.duplicateOf);assert.equal(movie.poster,'Img/posters/'+slug+'.jpg');assert.ok(require('node:fs').statSync(require('node:path').join(__dirname,movie.poster)).size>1000);}
  assert.equal(bySlug.get(slugs[0]).year,2010);assert.equal(bySlug.get(slugs[5]).year,2025);
  assert.match(group.members[1].label,/Special/);assert.match(group.members[4].label,/Special/);assert.match(group.members[5].label,/Live Action/);
});
test('all eight requested Kung Fu Panda entries have exact source identities, posters and separate film/TV groups',()=>{
  const published=require('./data/movies.json'),bySlug=new Map(published.map(movie=>[movie.slug,movie]));
  const entries=[['kung-fu-gau-truc',1],['kung-fu-gau-truc-2',1],['kung-fu-gau-truc-3',1],['kung-fu-gau-truc-4',1],['gau-truc-kung-fu-ky-nghi-le',1],['kung-fu-panda-hiep-si-rong',11],['kung-fu-panda-hiep-si-rong-phan-2',12],['kung-fu-panda-hiep-si-rong-phan-3',19]];
  for(const [slug,count]of entries){const movie=bySlug.get(slug);assert.ok(movie,slug);assert.equal(movie.apiSlug,slug);assert.equal(movie.episodes,count);assert.equal(movie.type,'animation');assert.equal(movie.country,'Mỹ');assert.equal(movie.relationVerified,true);assert.equal(movie.poster,'Img/posters/'+slug+'.jpg');assert.ok(require('node:fs').statSync(require('node:path').join(__dirname,movie.poster)).size>1000);}
  const registry=require('../Backend/movie-relations.json');
  assert.deepEqual(registry.groups.find(group=>group.id==='kung-fu-panda-films').members.map(member=>member.slug),[entries[0][0],entries[4][0],entries[1][0],entries[2][0],entries[3][0]]);
  assert.deepEqual(registry.groups.find(group=>group.id==='kung-fu-panda-dragon-knight').members.map(member=>member.slug),entries.slice(5).map(([slug])=>slug));
});
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
  assert.equal(published.length,3744);
  for(const movie of published.filter(m=>m.group)){assert.equal(index.get(movie.slug).group.id,movie.group);assert.equal(movie.relationVerified,true);}
  const bySlug=new Map(published.map(m=>[m.slug,m]));
  assert.equal(bySlug.get('sat-thu-nhan-tao').group,bySlug.get('sat-thu-nhan-tao-2-mau-vat-con-lai').group);
  assert.notEqual(bySlug.get('sat-thu-nhan-tao').group,bySlug.get('phai-long-nang-phu-thuy').group);
  assert.notEqual(bySlug.get('nguoi-nhen-2002').group,bySlug.get('nguoi-nhen-tro-ve-nha').group);
  const taken=registry.groups.find(group=>group.id==='taken-films');
  assert.deepEqual(taken.members.map(member=>member.slug),['cuong-doat','cuong-doat-2','cuong-doat-3']);
  for(const member of taken.members){const film=bySlug.get(member.slug);assert.equal(film.group,'taken-films');assert.equal(film.type,'single');assert.equal(film.episodes,1);assert.equal(film.relationVerified,true);assert.equal(film.poster,'Img/posters/'+member.slug+'.jpg');}
});
