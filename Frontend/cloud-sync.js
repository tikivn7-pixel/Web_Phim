(function(root){
  'use strict';let running=null,timer=null,applying=false,lastAttempt=0;let state={status:'local',message:'Dữ liệu đang lưu trên thiết bị này.'};
  const META='cloud_sync_v1',emit=()=>root.dispatchEvent(new CustomEvent('cloud-sync-status',{detail:state}));
  function eligible(){const profile=root.ProfileStore?.current(),user=root.HubClient?.session()?.user;return profile?.cloudId&&profile.ownerId===user?.id?profile:null;}
  function status(){return{...state,profile:eligible()};}
  function read(){const snapshot=PersonalData.read(localStorage);if(snapshot.warnings.length)throw Error('Dữ liệu cá nhân chưa đọc được. Kiểm tra sao lưu trước khi đồng bộ.');return snapshot.data;}
  function meta(){const raw=localStorage.getItem(META);if(!raw)return{revision:0,base:{}};const value=JSON.parse(raw);if(!value||!Number.isInteger(value.revision)||!value.base)throw Error('Mốc đồng bộ bị lỗi. Dữ liệu trên thiết bị chưa thay đổi.');return value;}
  function schedule(delay=1800){clearTimeout(timer);if(!eligible())return;timer=setTimeout(()=>sync().catch(()=>{}),Math.max(delay,10000-(Date.now()-lastAttempt)));}
  async function perform(){const profile=eligible();if(!profile)return status();lastAttempt=Date.now();state={status:'syncing',message:'Đang đồng bộ hồ sơ…'};emit();
    try{
      for(let attempt=0;attempt<3;attempt++){
        const local=read(),previous=meta(),remote=await HubClient.request('/profiles/'+encodeURIComponent(profile.cloudId)+'/data',{auth:true});
        if(!CloudSyncModel.same(local,read()))continue;
        const combined=CloudSyncModel.reconcile(previous.base,local,remote.data);let published=remote;
        if(!CloudSyncModel.same(combined,PersonalData.normalize(remote.data))){try{published=await HubClient.request('/profiles/'+encodeURIComponent(profile.cloudId)+'/data',{method:'PUT',auth:true,body:{revision:remote.revision,data:combined}});}catch(error){if(error.status===409)continue;throw error;}}
        const latest=read(),applied=CloudSyncModel.reconcile(local,latest,published.data);
        applying=true;try{PersonalData.write(localStorage,applied);localStorage.setItem(META,JSON.stringify({revision:published.revision,base:PersonalData.normalize(published.data),lastAt:Date.now()}));}finally{applying=false;}
        state={status:'synced',message:'Đã đồng bộ',lastAt:Date.now()};emit();root.dispatchEvent(new StorageEvent('storage',{key:null}));
        if(!CloudSyncModel.same(applied,PersonalData.normalize(published.data)))schedule(10000);return status();
      }throw Error('Hồ sơ đang thay đổi trên thiết bị khác. Sẽ thử đồng bộ lại.');
    }catch(error){state={status:'error',message:error.message};emit();throw error;}
  }
  function sync(){if(!running)running=perform().finally(()=>{running=null;});return running;}
  root.CloudSync={sync,status};
  root.addEventListener('profile-data-change',event=>{if(!applying&&PersonalData.KEYS.includes(event.detail?.key))schedule();});
  root.addEventListener('storage',event=>{if(!applying&&event.key&&PersonalData.KEYS.includes(event.key))schedule();});
  for(const event of ['online','focus','hub-auth-change'])root.addEventListener(event,()=>schedule(100));
  setInterval(()=>{if(!document.hidden)schedule(100);},60000);schedule(200);
})(globalThis);
