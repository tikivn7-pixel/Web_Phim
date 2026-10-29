// Keep legacy storage APIs while isolating every viewing profile, including older open tabs.
(function(root){
  'use strict';
  const KEY='lauphim_profiles_v1',ACTIVE='lauphim_active_profile_v1',PREFIX='lauphim_profile:',MAX=6;
  const SCOPED=['my_wishlist','continue_watching_list','episode_positions','playback_reports','player_preferences_v1','player_intro_ranges_v1','autonext_enabled','audio_boost','movie_journal_v1','episode_tracker_v1','movie_lists_v1','movie_notes_v1','release_planner_v1','notification_center_v1','notification_preferences_v1','notification_preferences_v1_delivered','subtitle_preferences_v1','episode_updates_v1','episode_updates_v1_lease','library_view_v1','watch_view_v1','cloud_sync_v1','comics_reader_v1'];
  const valid=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
  const colors=['#f43f50','#a78bfa','#38bdf8','#34d399','#fbbf24','#fb923c'];
  function normalize(input){
    if(!input||input.version!==1||!Array.isArray(input.profiles)||!input.profiles.length||input.profiles.length>MAX)throw Error('Dữ liệu hồ sơ không hợp lệ. Chưa thay đổi dữ liệu đang có.');
    const seen=new Set(),profiles=input.profiles.map(item=>{if(!item||!valid(item.id)||seen.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>40)throw Error('Hồ sơ không hợp lệ.');seen.add(item.id);const p={id:item.id,name:item.name.trim(),color:colors.includes(item.color)?item.color:colors[0]};if(valid(item.cloudId)&&valid(item.ownerId)){p.cloudId=item.cloudId;p.ownerId=item.ownerId;}return p;});
    return{version:1,profiles,lastActive:profiles.some(p=>p.id===input.lastActive)?input.lastActive:profiles[0].id};
  }
  function createAdapter(storage,id,onChange=()=>{}){
    const scoped=new Set(SCOPED),prefix=PREFIX+id+':',mapped=key=>scoped.has(String(key))?prefix+String(key):String(key);
    return{getItem:key=>storage.getItem(mapped(key)),setItem(key,value){storage.setItem(mapped(key),String(value));if(scoped.has(String(key)))onChange(String(key));},removeItem(key){storage.removeItem(mapped(key));if(scoped.has(String(key)))onChange(String(key));},key(index){const keys=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key.startsWith(prefix))keys.push(key.slice(prefix.length));else if(!key.startsWith(PREFIX)&&!scoped.has(key))keys.push(key);}return keys[index]??null;},get length(){let n=0;while(this.key(n)!==null)n++;return n;},clear(){for(const key of SCOPED)this.removeItem(key);}};
  }
  const api={KEY,ACTIVE,PREFIX,SCOPED,MAX,colors,valid,normalize,createAdapter};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  root.ProfileStore=api;
  let original,registry,current,session;
  try{
    original=root.localStorage;session=root.sessionStorage;const raw=original.getItem(KEY);
    if(raw)registry=normalize(JSON.parse(raw));else{
      for(let i=0;i<original.length;i++)if(original.key(i)?.startsWith(PREFIX))throw Error('Thiếu danh mục hồ sơ nhưng vẫn còn dữ liệu riêng. Dữ liệu được giữ nguyên; kiểm tra bản sao lưu trước khi tạo lại.');
      registry={version:1,profiles:[{id:'local',name:'Hồ sơ của tôi',color:colors[0]}],lastActive:'local'};
      const written=[];try{for(const key of SCOPED){const value=original.getItem(key);if(value!==null){original.setItem(PREFIX+'local:'+key,value);written.push(PREFIX+'local:'+key);}}original.setItem(KEY,JSON.stringify(registry));}catch(error){for(const key of written)try{original.removeItem(key);}catch(_){}throw error;}
    }
    const tab=session.getItem(ACTIVE);current=registry.profiles.find(p=>p.id===tab)||registry.profiles.find(p=>p.id===registry.lastActive);session.setItem(ACTIVE,current.id);
    const adapter=createAdapter(original,current.id,key=>root.dispatchEvent(new CustomEvent('profile-data-change',{detail:{key,profileId:current.id}})));
    Object.defineProperty(root,'localStorage',{configurable:true,get:()=>adapter});
    root.addEventListener('storage',event=>{
      if(event.key?.startsWith(PREFIX)){event.stopImmediatePropagation();const prefix=PREFIX+current.id+':';if(event.key.startsWith(prefix))root.dispatchEvent(new StorageEvent('storage',{key:event.key.slice(prefix.length),oldValue:event.oldValue,newValue:event.newValue,url:event.url}));}
    },true);
    const read=()=>normalize(JSON.parse(original.getItem(KEY)));
    api.available=()=>true;api.current=()=>({...current});api.list=()=>read().profiles;
    api.create=(name,color=colors[0],link={})=>{const state=read();if(state.profiles.length>=MAX)throw Error('Mỗi thiết bị có tối đa '+MAX+' hồ sơ.');const item={id:'p_'+crypto.randomUUID().replaceAll('-',''),name,color,...link};state.profiles.push(item);const safe=normalize(state);original.setItem(KEY,JSON.stringify(safe));root.dispatchEvent(new Event('profiles-change'));return safe.profiles.at(-1);};
    api.edit=(id,values)=>{const state=read(),index=state.profiles.findIndex(p=>p.id===id);if(index<0)throw Error('Không tìm thấy hồ sơ.');state.profiles[index]={...state.profiles[index],...values,id};const safe=normalize(state);original.setItem(KEY,JSON.stringify(safe));if(id===current.id)current=safe.profiles[index];root.dispatchEvent(new Event('profiles-change'));return safe.profiles[index];};
    api.activate=id=>{const state=read();if(!state.profiles.some(p=>p.id===id))throw Error('Không tìm thấy hồ sơ.');state.lastActive=id;original.setItem(KEY,JSON.stringify(state));session.setItem(ACTIVE,id);root.location.reload();};
    api.remove=id=>{const state=read();if(state.profiles.length<=1||id===current.id)throw Error('Chuyển sang hồ sơ khác trước khi xóa; giữ ít nhất một hồ sơ.');state.profiles=state.profiles.filter(p=>p.id!==id);if(state.lastActive===id)state.lastActive=current.id;original.setItem(KEY,JSON.stringify(state));for(const key of SCOPED)original.removeItem(PREFIX+id+':'+key);root.dispatchEvent(new Event('profiles-change'));};
  }catch(error){api.available=()=>false;api.current=()=>null;api.list=()=>[];api.error=error.message;}
})(globalThis);
