const test=require('node:test'),assert=require('node:assert/strict'),T=require('./episode-tracker'),P=require('./personal-data'),L=require('./personal-lists');
function memory(raw){const values=new Map(raw===undefined?[]:[[T.KEY,raw]]);return{values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
test('logical episode names share marks across numeric server labels but preserve actual named specials',()=>{
 const storage=memory();T.batch('film',['Tập 01','Episode 1','OVA','1.5'],true,storage);
 assert.equal(Object.keys(T.read(storage).movies.film.episodes).length,3);assert.ok(T.isWatched('film','1',storage));assert.ok(!T.isWatched('other','1',storage));
 assert.deepEqual(T.summary('film',['1','Tập 1','2','OVA','1.5'],storage),{watched:3,total:4,nextName:'2'});
});
test('newer explicit unwatch survives stale backups and never clears playback position or private lists',()=>{
 const storage=memory();T.set('film','1',true,storage);const old=T.read(storage);T.set('film','1',false,storage);const merged=T.merge(T.read(storage),old);assert.equal(merged.movies.film.episodes['1'].watched,false);
 const lists={version:1,lists:{weekend:{name:'Cuối tuần',description:'',slugs:['film'],updatedAt:10,deleted:false}}};
 const data=P.merge({episode_tracker_v1:merged,movie_lists_v1:lists,episode_positions:{film:{1:{currentTime:83,updatedAt:10}}}},{episode_tracker_v1:old});
 const restored=P.parseBackup(JSON.stringify(P.backup(data)));assert.equal(restored.episode_positions.film[1].currentTime,83);assert.equal(L.active(restored.movie_lists_v1)[0].slugs[0],'film');assert.equal(restored.episode_tracker_v1.movies.film.episodes['1'].watched,false);
});
test('damaged and quota blocked storage is never replaced by a partial mutation',()=>{
 for(const raw of ['broken','null','{"version":2,"movies":{}}']){const storage=memory(raw);assert.deepEqual(T.read(storage).movies,{});assert.throws(()=>T.set('film','1',true,storage));assert.equal(storage.values.get(T.KEY),raw);}
 const storage=memory();T.set('film','1',true,storage);const original=storage.values.get(T.KEY);storage.setItem=()=>{throw Error('quota')};assert.throws(()=>T.batch('film',['2','3'],true,storage));assert.equal(storage.values.get(T.KEY),original);
});
test('canonical named episodes and strict import reject unsafe keys and preserve ordinary inherited property names',()=>{
 const storage=memory();T.set('film','toString',true,storage);assert.ok(T.isWatched('film','tostring',storage));
 for(const name of ['__proto__','constructor','prototype','\n1'])assert.throws(()=>T.set('film',name,true,storage));
 assert.throws(()=>T.normalize(JSON.parse('{"version":1,"movies":{"__proto__":{"episodes":{}}}}'),true));
 const a={version:1,movies:{film:{episodes:{'1':{watched:true,updatedAt:10}}}}},b={version:1,movies:{film:{episodes:{'1':{watched:false,updatedAt:10}}}}};assert.equal(T.merge(a,b).movies.film.episodes['1'].watched,false);
});
