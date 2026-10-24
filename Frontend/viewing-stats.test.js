const test = require('node:test'), assert = require('node:assert/strict'), Stats = require('./viewing-stats');
const now = Date.UTC(2026, 9, 24, 12), day = Stats.DAY;
const catalog = [{slug:'a',title:'A',genres:'Hành Động, Anime, Nhật Bản',country:'Nhật Bản'}, {slug:'b',title:'B',genres:'Hành Động, Hành Động',country:'Mỹ'}];
const journal = entries => ({version:1,entries});
const tracker = movies => ({version:1,movies});
const note = (text='',updatedAt=now) => ({text,spoiler:true,updatedAt});
const mark = (extra={}) => ({label:'Secret label',time:42,episodeName:'Tập 01',episode:8,source:'kkphim',server:2,updatedAt:now,deleted:false,...extra});
test('personal overview counts unique current records and explicit completion only', () => {
  const data={my_wishlist:[{slug:'a',addedAt:now},{slug:'a',addedAt:now-1}],continue_watching_list:[{slug:'b',episode:9,totalEpisodes:9,episodeIsLast:true,progress:100,currentTime:10,updatedAt:now}],movie_journal_v1:journal({a:{status:'completed',rating:4,updatedAt:now},b:{status:'planned',rating:0,updatedAt:now},gone:{status:'',rating:0,updatedAt:now}}),episode_tracker_v1:tracker({a:{episodes:{'01':{watched:true,updatedAt:now},'Tập 1':{watched:true,updatedAt:now},'2':{watched:false,updatedAt:now}}}}),movie_notes_v1:{version:1,movies:{a:{note:note('Secret spoiler'),bookmarks:{one:mark(),gone:mark({deleted:true})}}}},movie_lists_v1:{version:1,lists:{trip:{name:'Weekend',description:'',slugs:['a','unknown'],updatedAt:now,deleted:false},gone:{name:'Gone',description:'',slugs:[],updatedAt:now,deleted:true}}}};
  const result=Stats.build(data,catalog,{now});
  assert.deepEqual(result.counts,{personal:3,completed:1,episodes:1,bookmarks:1,notes:1,rated:1});
  assert.deepEqual(result.genres,[{label:'Hành Động',count:2},{label:'Anime',count:1}]);
  assert.equal(result.matched,2);assert.equal(result.unmatched,1);assert.equal(result.statuses.planned,1);assert.equal(result.ratings[3],1);
  assert.equal(result.resume,null);assert.equal(JSON.stringify(result.timeline).includes('Secret'),false);
  assert.equal(result.timeline.filter(a=>a.id.startsWith('episode:')).length,1);
});
test('7 and 30 day scopes use personal timestamps with inclusive exact boundaries',()=>{
  const data={my_wishlist:[{slug:'a',addedAt:now-7*day},{slug:'b',addedAt:now-7*day-1},{slug:'untimed'}],movie_journal_v1:journal({future:{status:'completed',rating:5,updatedAt:now+1}})};
  assert.deepEqual(Stats.build(data,catalog,{now,period:'7'}).slugs,['a']);
  assert.equal(Stats.build(data,catalog,{now,period:'30'}).counts.personal,2);
  const all=Stats.build(data,catalog,{now});assert.equal(all.counts.personal,4);assert.equal(all.untimed,2);assert.equal(all.timeline.length,2);
  assert.equal(Stats.period('garbage'),'all');assert.equal(Stats.period(7),'7');
});
test('timeline excludes zero, malformed and future timestamps and never uses release date',()=>{
  const result=Stats.build({my_wishlist:[{slug:'a',addedAt:0},{slug:'b',addedAt:now+day},{slug:'c',addedAt:'bad'}]},[{slug:'a',updatedAt:new Date(now).toISOString()}],{now});
  assert.deepEqual(result.timeline,[]);assert.equal(result.counts.personal,3);
});
test('resume keeps raw episode index and explicit provider identity',()=>{
  const result=Stats.build({continue_watching_list:[{slug:'a',episode:8,episodeName:'Tập 01',server:2,source:'kkphim',currentTime:123.8,progress:10,updatedAt:now},{slug:'b',episode:1,progress:0,updatedAt:now-day}]},catalog,{now});
  const params=new URLSearchParams(result.resume.url.split('?')[1]);
  assert.equal(params.get('ep'),'8');assert.equal(params.get('target_episode'),'Tập 01');assert.equal(params.get('server'),'2');assert.equal(params.get('data_source'),'kkphim');assert.equal(params.get('resume'),'123');
});
test('an explicit ongoing flag overrides stale totals and never implies manual completion',()=>{
  const result=Stats.build({continue_watching_list:[{slug:'a',episode:2,totalEpisodes:2,episodeIsLast:false,progress:99,currentTime:100,updatedAt:now}]},catalog,{now});
  assert.equal(result.counts.completed,0);assert.equal(result.resume.slug,'a');
});
test('resume respects manually planned, paused and completed statuses',()=>{
  for(const status of ['planned','paused','completed']){
    const result=Stats.build({continue_watching_list:[{slug:'a',episode:1,progress:20,currentTime:100,updatedAt:now}],movie_journal_v1:journal({a:{status,rating:0,updatedAt:now}})},catalog,{now});
    assert.equal(result.resume,null);
  }
});
test('empty and missing catalog produce honest snapshot without mutation',()=>{
  const data={my_wishlist:[{slug:'old',addedAt:now}]},before=JSON.stringify(data),result=Stats.build(data,[],{now});
  assert.equal(result.counts.personal,1);assert.equal(result.unmatched,1);assert.deepEqual(result.genres,[]);assert.equal(JSON.stringify(data),before);
  assert.deepEqual(Stats.build({},catalog,{now}).counts,{personal:0,completed:0,episodes:0,bookmarks:0,notes:0,rated:0});
});
test('period includes only updated lists, nondeleted bookmarks and nonempty notes',()=>{
  const data={movie_notes_v1:{version:1,movies:{a:{note:note('  '),bookmarks:{gone:mark({deleted:true})}},b:{note:note('Old',now-31*day),bookmarks:{old:mark({updatedAt:now-31*day})}}}},movie_lists_v1:{version:1,lists:{l:{name:'List',description:'',slugs:['a'],updatedAt:now,deleted:false}}}};
  const result=Stats.build(data,catalog,{now,period:'30'});assert.deepEqual(result.slugs,['a']);assert.equal(result.counts.notes,0);assert.equal(result.counts.bookmarks,0);assert.equal(result.lists.length,1);
});
