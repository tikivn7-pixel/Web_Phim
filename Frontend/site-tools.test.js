const test=require('node:test'),assert=require('node:assert/strict');
const tools=require('./site-tools');
test('history posters use current catalog metadata and try each real alternate before the final placeholder',()=>{
  const current={poster:'Img/A Shop for Killers (Season 1).jpg',remotePoster:'https://example.org/poster.jpg',banner:'Img/Chuyện Đời Bác Sĩ Nội Trú.jpg'};
  assert.deepEqual(tools.posterCandidates({poster:'Img/poster-placeholder.svg'},current),[current.poster,current.remotePoster,current.banner]);
  const img={src:'',onerror:null};tools.setPoster(img,{poster:'https://example.org/old.jpg'},current);
  assert.equal(img.src,current.poster);img.onerror();assert.equal(img.src,current.remotePoster);
  img.onerror();assert.equal(img.src,'https://example.org/old.jpg');img.onerror();assert.equal(img.src,current.banner);
  img.onerror();assert.equal(img.src,'Img/poster-placeholder.svg');assert.equal(img.onerror,null);
  assert.equal(tools.posterCandidates({poster:'https://placehold.co/350x500'},{}).length,0);
});
test('images reject active schemes and accept static site paths',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,hi','//evil.example/a','java\nscript:1','https://user:pass@site.test/a','\\evil\\x'])assert.equal(tools.imageUrl(value),'Img/poster-placeholder.svg');
  assert.equal(tools.imageUrl('Img/a.jpg'),'Img/a.jpg');assert.equal(tools.imageUrl('https://site.test/a.jpg'),'https://site.test/a.jpg');
});
test('search accepts accents, reordered words and localized slugs, ranking titles first',()=>{
  assert.equal(tools.normalize('Đại chiến: Phần 2!'),'dai chien phan 2');
  const a={title:'Attack on Titan',slug:'dai-chien-titan',genres:'Hành Động',country:'Nhật Bản'};
  assert.ok(tools.score(a,'titan attack')>0);assert.ok(tools.score(a,'dai chien')>0);assert.equal(tools.score(a,'titan goblin'),-1);
  assert.ok(tools.score({title:'Goblin'},'goblin')>tools.score({title:'Other',cast:'Goblin'},'goblin'));
});
test('recommendations use exact genre labels, exclude current series and prefer shared metadata',()=>{
  const current={slug:'a',group:'series',genres:'Hành Động, Hài Hước',country:'Nhật Bản',type:'animation'};
  const movies=[current,{slug:'b',group:'series',genres:current.genres},{slug:'c',genres:'Hài',year:2026},{slug:'d',genres:'Hành Động',year:2026},{slug:'e',genres:current.genres,country:current.country,type:current.type}];
  assert.deepEqual(tools.recommend(movies,current).map(m=>m.slug),['e','d']);
});
