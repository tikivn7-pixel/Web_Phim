const {test}=require("node:test"), assert=require("node:assert/strict"), P=require("./personal-data");
function memory(initial={}) {
  const values=new Map(Object.entries(initial));
  return {values,getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
const film=(slug,extra={})=>({slug,title:slug,poster:"https://example.org/poster.jpg",...extra});

test('private notes and scene tombstones survive backup and stale imports without resetting playback',()=>{
  const N=require('./movie-notes'),store=memory();N.setNote('film',{text:'Một ghi chú riêng',spoiler:true},store);const mark=N.addBookmark('film',{label:'Mở đầu',time:0,episodeName:'Tập 2',episode:7,source:'kkphim',server:1},store);const old=N.read(store);N.setNote('film',{text:'',spoiler:false},store);N.removeBookmark('film',mark.id,store);
  const data={movie_notes_v1:N.read(store),episode_positions:{film:{7:{currentTime:92,updatedAt:20,episodeName:'Tập 2'}}},my_wishlist:[film('film')]},combined=P.merge(data,{movie_notes_v1:old}),restored=P.parseBackup(JSON.stringify(P.backup(combined)));
  assert.equal(restored.movie_notes_v1.movies.film.note.text,'');assert.equal(restored.movie_notes_v1.movies.film.bookmarks[mark.id].deleted,true);assert.equal(restored.episode_positions.film[7].currentTime,92);assert.equal(restored.my_wishlist.length,1);
  P.write(store,restored);assert.deepEqual(JSON.parse(store.getItem(N.KEY)),restored.movie_notes_v1);assert.throws(()=>P.normalize({movie_notes_v1:{version:99,movies:{}}},true));
});
test("every published local poster survives normalization and backup, including spaces, punctuation and Vietnamese",()=>{
  const movies=require('./data/movies.json'),local=movies.filter(movie=>/^(?:\.\/)?Img\//.test(movie.poster));
  assert.ok(local.length>=250);
  for(const movie of local){
    assert.equal(P.imageUrl(movie.poster),movie.poster,movie.slug);
    const restored=P.parseBackup(JSON.stringify(P.backup({continue_watching_list:[{...movie,episode:1}]})));
    assert.equal(restored.continue_watching_list[0].poster,movie.poster,movie.slug);
  }
  for(const value of ['Img/../secret.jpg','Img/%2e%2e/secret.jpg','Img/a%5cb.jpg','Img/a%0Ab.jpg','Img/a.jpg?token=secret','Img/a.jpg#x'])assert.equal(P.imageUrl(value),'');
});
test("personal backup roundtrips existing playback fields and excludes account credentials and arbitrary keys",()=>{
  const storage=memory({token:"PRIVATE",user:JSON.stringify({email:"private@example.org"}),my_wishlist:JSON.stringify([film("film",{addedAt:12,token:"SECRET"})]),continue_watching_list:JSON.stringify([film("film",{episode:3,totalEpisodes:12,currentTime:89,duration:900,progress:10,updatedAt:20,source:"nguonc",episodeName:"Tập 3",server:1})]),episode_positions:JSON.stringify({film:{"3":{currentTime:89,duration:900,server:1,source:"nguonc",updatedAt:20}}}),playback_reports:JSON.stringify([{reason:"Không phát được",createdAt:"2026-01-01T00:00:00.000Z",slug:"film",videoSrc:"PRIVATE",error:"https://secret/token"}])});
  const exported=P.backup(P.read(storage).data), text=JSON.stringify(exported), restored=P.parseBackup(text);
  assert.doesNotMatch(text,/PRIVATE|SECRET|email|videoSrc|secret\/token/);
  assert.equal(restored.continue_watching_list[0].episodeName,"Tập 3");assert.equal(restored.continue_watching_list[0].source,"nguonc");assert.equal(restored.episode_positions.film[3].currentTime,89);
  assert.deepEqual(P.counts(restored),{favorites:1,watching:1,positions:1,reports:1});
});
test("merging a stale backup preserves the newest episode and seek position even if the newer time is earlier",()=>{
  const current={my_wishlist:[film("new",{addedAt:30})],continue_watching_list:[film("same",{episode:2,currentTime:10,updatedAt:30})],episode_positions:{same:{"2":{currentTime:10,updatedAt:30},"3":{currentTime:22,updatedAt:40}}}};
  const incoming={my_wishlist:[film("old",{addedAt:10}),film("new",{title:"stale title",addedAt:5})],continue_watching_list:[film("same",{episode:1,currentTime:700,updatedAt:20}),film("other",{episode:4,updatedAt:50})],episode_positions:{same:{"2":{currentTime:700,updatedAt:20},"1":{currentTime:90,updatedAt:10}}}};
  const before=JSON.stringify(current), result=P.merge(current,incoming);
  assert.equal(result.continue_watching_list.find(item=>item.slug==="same").episode,2);assert.equal(result.episode_positions.same[2].currentTime,10);assert.equal(result.episode_positions.same[3].currentTime,22);assert.equal(result.episode_positions.same[1].currentTime,90);assert.equal(result.my_wishlist.find(item=>item.slug==="new").title,"new");assert.equal(JSON.stringify(current),before);
});
test("unknown backup versions, wrong list shape, invalid records and prototype keys are rejected before writing",()=>{
  const wrap=data=>JSON.stringify({format:P.FORMAT,version:1,data});
  assert.throws(()=>P.parseBackup("{"),/JSON/);assert.throws(()=>P.parseBackup(JSON.stringify({format:P.FORMAT,version:2,data:{}})),/phiên bản/);
  assert.throws(()=>P.parseBackup(wrap({my_wishlist:{}})),/my_wishlist/);assert.throws(()=>P.parseBackup(wrap({continue_watching_list:[null]})),/không hợp lệ/);
  const poisoned=JSON.parse('{"episode_positions":{"__proto__":{"1":{"currentTime":10}}}}');assert.throws(()=>P.parseBackup(wrap(poisoned)),/không hợp lệ/);assert.equal({}.currentTime,undefined);
  const result=P.parseBackup(wrap({my_wishlist:[film("safe",{poster:'javascript:alert(1)',token:"DROP"})],token:"DROP"}));assert.equal(result.my_wishlist[0].poster,"");assert.equal(result.token,undefined);
});
test("quota rejection rolls back every personal key exactly and leaves auth and catalog drafts untouched",()=>{
  const storage=memory({my_wishlist:'[{"title":"Original"}]',token:"LOGIN",catalog_editor_draft_v1:"WORK"});
  const before=[...storage.values];let writes=0;const set=storage.setItem;
  storage.setItem=(key,value)=>{if(++writes===2)throw new Error("quota");set(key,value);};
  assert.throws(()=>P.write(storage,{my_wishlist:[film("new")],continue_watching_list:[film("watch")]}),/Dữ liệu cũ/);
  assert.deepEqual([...storage.values],before);
});
test("malformed or blocked storage reads never rewrite the original value or crash readers",()=>{
  const storage=memory({my_wishlist:"{broken",continue_watching_list:'[null,{"title":"Valid","updatedAt":2}]',playback_reports:'{}'}),before=[...storage.values],read=P.read(storage);
  assert.deepEqual(read.warnings,["my_wishlist","continue_watching_list","playback_reports"]);assert.equal(read.data.continue_watching_list.length,1);assert.deepEqual([...storage.values],before);
  const blocked=P.read({getItem(){throw new Error("SecurityError");}});assert.equal(blocked.warnings.length,P.KEYS.length);assert.equal(blocked.data.my_wishlist.length,0);
});
test("completed final episodes are filtered without mistaking an earlier finished episode for the whole series",()=>{
  assert.equal(P.finished({episode:12,totalEpisodes:12,progress:95}),true);assert.equal(P.finished({episode:1,totalEpisodes:12,progress:100}),false);assert.equal(P.finished({episode:1,progress:100}),false);
  assert.equal(P.finished({episode:2,totalEpisodes:2,episodeIsLast:false,progress:100}),false);assert.equal(P.finished({episode:1,totalEpisodes:2,episodeIsLast:true,progress:95}),true);
  const rows=P.normalize({continue_watching_list:[film("same",{updatedAt:1}),film("same",{episode:4,updatedAt:9}),film("different",{updatedAt:2})]}).continue_watching_list;
  assert.equal(rows.length,2);assert.equal(rows[0].episode,4);
});
test("backup preserves logical episode identity when a provider reverses its raw episode ordering",()=>{
  const data={continue_watching_list:[film("reversed",{episode:2,episodeName:"1",episodeIsLast:false,totalEpisodes:2,progress:99})],episode_positions:{reversed:{"2":{currentTime:89,episodeName:"1",source:"nguonc"}}}};
  const restored=P.parseBackup(JSON.stringify(P.backup(data)));
  assert.equal(restored.continue_watching_list[0].episodeIsLast,false);assert.equal(restored.episode_positions.reversed[2].episodeName,"1");assert.equal(P.counts(restored).watching,1);
});
test("player preferences stay local on merge while per-episode intro markers merge by timestamp and portable backup excludes a sleep deadline",()=>{
  const id=JSON.stringify(["film","2","kkphim","Vietsub"]), older={player_preferences_v1:{rate:2,volume:.4,muted:false},autonext_enabled:0,audio_boost:1.5,player_intro_ranges_v1:{[id]:{start:4,end:90,updatedAt:10}},player_sleep_deadline:1234};
  const current={player_preferences_v1:{rate:1.25,volume:.7,muted:true},autonext_enabled:1,player_intro_ranges_v1:{[id]:{start:5,end:80,updatedAt:30}}};
  const merged=P.merge(current,older);assert.equal(merged.player_preferences_v1.rate,1.25);assert.equal(merged.autonext_enabled,1);assert.equal(merged.audio_boost,1.5);assert.equal(merged.player_intro_ranges_v1[id].end,80);
  const portable=P.parseBackup(JSON.stringify(P.backup(older)));assert.equal(portable.player_preferences_v1.rate,2);assert.equal(portable.player_sleep_deadline,undefined);
  assert.throws(()=>P.normalize({player_intro_ranges_v1:{[id]:{start:90,end:1}}},true));assert.throws(()=>P.normalize({player_preferences_v1:{rate:12,volume:1,muted:false}},true));assert.throws(()=>P.normalize({autonext_enabled:null},true));
  const storage=memory();P.write(storage,portable);assert.equal(storage.getItem("autonext_enabled"),"0");assert.equal(JSON.parse(storage.getItem("player_preferences_v1")).rate,2);
});
test("poster URLs cannot export embedded credentials or sensitive tokens and reject executable schemes and control characters",()=>{
  for(const value of ["https://user:secret@example.org/a.jpg","https://example.org/a.jpg?access_token=PRIVATE","javascript:alert(1)","data:text/html,hello","https://example.org/a\n.jpg","https://example.org\\@evil.test/a.jpg"])assert.equal(P.imageUrl(value),"",value);
  assert.equal(P.imageUrl("Img/poster-placeholder.svg"),"Img/poster-placeholder.svg");assert.equal(P.imageUrl("https://example.org/a.jpg?w=300"),"https://example.org/a.jpg?w=300");
});
test("journal backup keeps private ratings and merges newest statuses including clears without resetting saved episodes",()=>{
  const journal=entries=>({version:1,entries});
  const local={movie_journal_v1:journal({one:{status:"",rating:0,updatedAt:30},two:{status:"planned",rating:0,updatedAt:10}}),continue_watching_list:[film("one",{episode:2,currentTime:80,updatedAt:5})],episode_positions:{one:{2:{currentTime:80,updatedAt:5}}}};
  const incoming={movie_journal_v1:journal({one:{status:"completed",rating:5,updatedAt:20},two:{status:"completed",rating:4,updatedAt:40,token:"PRIVATE"}})};
  const merged=P.merge(local,incoming), restored=P.parseBackup(JSON.stringify(P.backup(merged)));
  assert.deepEqual(restored.movie_journal_v1.entries.one,{status:"",rating:0,updatedAt:30});
  assert.deepEqual(restored.movie_journal_v1.entries.two,{status:"completed",rating:4,updatedAt:40});
  assert.equal(restored.continue_watching_list[0].currentTime,80);assert.equal(restored.episode_positions.one[2].currentTime,80);
  assert.doesNotMatch(JSON.stringify(restored),/PRIVATE|token/);
  const old=P.parseBackup(JSON.stringify(P.backup({my_wishlist:[film("old")]})));
  assert.equal(old.movie_journal_v1,undefined);assert.equal(P.merge(local,old).movie_journal_v1.entries.two.status,"planned");
  const storage=memory();P.write(storage,restored);assert.equal(JSON.parse(storage.getItem("movie_journal_v1")).entries.two.rating,4);
  assert.throws(()=>P.normalize({movie_journal_v1:{version:1,entries:{one:{status:"garbage",rating:0,updatedAt:1}}}},true),/không hợp lệ/);
});
