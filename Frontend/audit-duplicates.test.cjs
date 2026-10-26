const test=require('node:test'),assert=require('node:assert/strict');
const {candidates,evidence,classify}=require('./audit-duplicates.cjs');
const {artifacts}=require('./catalog-artifacts');
const {decode}=require('./catalog-format');
const {score}=require('./site-tools');
const {deriveRelations}=require('./build-relations');

test('Unicode titles and separate seasons never become automatic duplicates',()=>{
  assert.equal(candidates([{slug:'a',title:'日本'},{slug:'b',title:'中国'}]).length,0);
  const base={status:'found',apiSlug:'a',originalTitle:'Show Season 1',year:2020,type:'series',tmdb:{id:10,type:'tv',season:1}};
  assert.equal(classify({slug:'a'},{slug:'b'},base,{...base,apiSlug:'b',originalTitle:'Show Season 2'}).decision,'keep-separate');
  assert.equal(classify({slug:'a'},{slug:'b'},base,{...base,apiSlug:'b',year:2024}).decision,'needs-review');
});
test('source checks reject wrong identities and store fingerprints without stream URLs',()=>{
  const payload={status:true,movie:{slug:'a',name:'A'},episodes:[{server_data:[{name:'1',link_m3u8:'https://example.com/secret.m3u8'}]}]};
  assert.throws(()=>evidence(payload,'b'));
  const result=evidence(payload,'a');assert.equal(result.streamHashes[0].length,64);assert.deepEqual(result.episodeNames,['1']);assert.ok(!JSON.stringify(result).includes('secret'));
});
test('all reviewed aliases retain detail records, search terms and a visible canonical card',()=>{
  const movies=require('./catalog-tools').readMovies(),result=artifacts(movies),cards=decode(result.index),bySlug=new Map(cards.map(movie=>[movie.slug,movie]));
  const decisions=require('../Backend/duplicate-decisions.json');
  assert.equal(movies.length,3700);assert.equal(cards.length,3644);assert.equal(Object.keys(result.index.aliases).length,56);
  for(const group of decisions.groups)for(const slug of group.aliases){
    assert.ok(bySlug.has(group.canonical));assert.ok(!bySlug.has(slug));
    assert.equal(result.index.aliases[slug].duplicateOf,group.canonical);
    const alias=movies.find(movie=>movie.slug===slug),canonical=bySlug.get(group.canonical);
    assert.ok(score(canonical,alias.title)>=0);assert.ok(score(canonical,alias.slug)>=0);
    assert.ok(JSON.parse(result.files[result.index.aliases[slug].detailShard].text)[slug]);
  }
});
test('duplicate season cards are removed from explicit and derived relations',()=>{
  const movies=[{slug:'one'},{slug:'old-one',duplicateOf:'one'},{slug:'two'}];
  const manual={groups:[{id:'series',sources:['https://example.com/series'],members:movies.map(movie=>({slug:movie.slug}))}]};
  assert.deepEqual(deriveRelations(movies,{},manual).groups[0].members.map(member=>member.slug),['one','two']);
  const published=require('./data/movies.json'),aliases=new Set(published.filter(movie=>movie.duplicateOf).map(movie=>movie.slug));
  for(const group of require('../Backend/movie-relations.json').groups)for(const member of group.members)assert.ok(!aliases.has(member.slug));
});
