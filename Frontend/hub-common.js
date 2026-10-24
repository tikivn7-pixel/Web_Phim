(function(){
  'use strict';document.addEventListener('DOMContentLoaded',()=>{
    const chip=document.createElement('a');chip.className='hub-profile-chip';chip.href='account.html';
    function refresh(){const profile=window.ProfileStore?.current(),sync=window.CloudSync?.status();chip.textContent=profile?'◉ '+profile.name+(sync?.status==='syncing'?' · Đang đồng bộ':sync?.status==='error'?' · Chưa đồng bộ':''):'Tài khoản & hồ sơ';chip.title='Mở tài khoản và chuyển hồ sơ';}
    document.body.append(chip);refresh();for(const event of ['profiles-change','cloud-sync-status','hub-auth-change'])window.addEventListener(event,refresh);
  });
})();
