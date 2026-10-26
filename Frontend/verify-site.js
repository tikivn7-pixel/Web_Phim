// Offline deployment check: syntax, local entry points, and every published movie shard.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=__dirname;
function verifySite(){
  const pages=fs.readdirSync(root).filter(name=>name.endsWith('.html'));
  let scripts=0,assets=0;
  for(const page of pages){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    assert.match(html,/<meta[^>]+name="viewport"/i,`${page}: missing viewport`);
    for(const match of html.matchAll(/<(script|link)\b[^>]*?(?:src|href)="([^"]+)"[^>]*>/gi)){
      const value=match[2].split(/[?#]/)[0];if(!value||/^(https?:)?\/\//i.test(value))continue;
      const file=path.resolve(root,value);assert.ok(file.startsWith(root+path.sep)&&fs.existsSync(file),`${page}: missing ${value}`);assets++;
    }
    for(const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)){
      const value=match[1].split(/[?#]/)[0];if(!/\.html$/i.test(value)||/^(https?:)?\/\//i.test(value))continue;
      const file=path.resolve(root,value);assert.ok(file.startsWith(root+path.sep)&&fs.existsSync(file),`${page}: broken page link ${value}`);
    }
    let number=0;
    for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
      if(/\bsrc=|type="application\/(?:ld\+)?json"/i.test(match[1]))continue;
      new vm.Script(match[2],{filename:`${page}:inline-${++number}`});scripts++;
    }
  }
  for(const name of fs.readdirSync(root).filter(name=>name.endsWith('.js')&&!name.endsWith('.test.js'))){new vm.Script(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});scripts++;}
  const movies=JSON.parse(fs.readFileSync(path.join(root,'data/movies.json'),'utf8'));
  const index=JSON.parse(fs.readFileSync(path.join(root,'data/catalog-index.json'),'utf8'));
  const cards=require('./catalog-format').decode(index),shards=new Map();
  const aliases=Object.values(index.aliases||{}),allCards=[...cards,...aliases],visible=new Set(cards.map(movie=>movie.slug));
  assert.equal(allCards.length,movies.length,'Index/archive movie count mismatch');
  assert.equal(new Set(allCards.map(movie=>movie.slug)).size,movies.length,'Repeated catalog identity');
  for(const card of aliases){assert.equal(index.aliases[card.slug],card,'Alias key mismatch');assert.ok(visible.has(card.duplicateOf),'Alias must reference a visible film');}
  const archived=new Map(movies.map(movie=>[movie.slug,movie]));
  for(const card of allCards){
    const file=index.details[card.detailShard];assert.ok(/^data\/details\/[a-f0-9-]+\.json$/.test(file),'Invalid detail path');
    if(!shards.has(file))shards.set(file,JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));
    assert.deepEqual(shards.get(file)[card.slug],archived.get(card.slug),'Stale detail: '+card.slug);
    assert.equal(card.group,archived.get(card.slug).group,'Stale group: '+card.slug);
  }
  const registry=JSON.parse(fs.readFileSync(path.join(root,'data/movie-relations.json'),'utf8'));
  require('./relation-editor').normalize(registry,new Set(archived.keys()));
  const result={pages:pages.length,scripts,assets,movies:movies.length,shards:shards.size};console.log('Static site verified:',JSON.stringify(result));return result;
}
if(require.main===module)try{verifySite();}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={verifySite};
