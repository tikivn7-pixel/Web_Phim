(function(root){
  function qualityRows(levels){return [{value:-1,label:"Tự động"},...(levels||[]).map((level,index)=>({value:index,label:(level.height?level.height+"p":"Luồng "+(index+1))+(level.bitrate?" · "+Math.round(level.bitrate/1000)+" kbps":"")}))];}
  function saveReport(storage,context,reason){
    let reports=[];try{const data=JSON.parse(storage.getItem("playback_reports")||"[]");if(Array.isArray(data))reports=data;}catch(e){}
    const report={createdAt:new Date().toISOString(),reason:String(reason).slice(0,300)};
    for(const key of ["slug","title","episode","episodeName","source","server","error"])if(context[key]!==undefined)report[key]=String(context[key]).slice(0,500);
    reports.unshift(report);storage.setItem("playback_reports",JSON.stringify(reports.slice(0,100)));return report;
  }
  function attach({video,hls,panel,getContext,embedded=false}){
    const box=document.createElement("div");box.className="stream-options";
    const makeSelect=title=>{const label=document.createElement("label");label.textContent=title+": ";const select=document.createElement("select");select.setAttribute("aria-label",title);label.append(select);box.append(label);return select;};
    const quality=makeSelect("Chất lượng"),subtitle=makeSelect("Phụ đề");
    const note=document.createElement("p");box.append(note);
    const tracks=()=>hls?(hls.subtitleTracks||[]):Array.from(video?.textTracks||[]).filter(track=>["subtitles","captions"].includes(track.kind));
    const refresh=()=>{
      const chosen=quality.value||"-1";quality.replaceChildren();qualityRows(hls?.levels).forEach(row=>quality.add(new Option(row.label,row.value)));quality.value=[...quality.options].some(option=>option.value===chosen)?chosen:"-1";quality.disabled=!hls||hls.levels.length<2;
      const active=hls?(hls.subtitleDisplay===false?-1:(hls.subtitleTrack??-1)):tracks().findIndex(track=>track.mode==="showing");
      const selected=subtitle.options.length?subtitle.value:String(active);subtitle.replaceChildren(new Option("Tắt","-1"));tracks().forEach((track,index)=>subtitle.add(new Option(track.name||track.label||track.lang||track.language||"Phụ đề "+(index+1),index)));subtitle.value=[...subtitle.options].some(option=>option.value===selected)?selected:"-1";subtitle.disabled=tracks().length===0;
      note.textContent=embedded?"Chất lượng và phụ đề được điều khiển trong trình phát nhúng nếu nguồn hỗ trợ.":(!hls||hls.levels.length<2?"Nguồn chưa cung cấp nhiều mức chất lượng. ":"")+(tracks().length===0?"Không có phụ đề rời để chọn.":"");
    };
    quality.onchange=()=>{if(hls)hls.currentLevel=Number(quality.value);};
    subtitle.onchange=()=>{const index=Number(subtitle.value);if(hls){hls.subtitleTrack=index;hls.subtitleDisplay=index>=0;}else tracks().forEach((track,i)=>{track.mode=i===index?"showing":"disabled";});};
    if(hls&&root.Hls)for(const event of [root.Hls.Events.MANIFEST_PARSED,root.Hls.Events.LEVELS_UPDATED,root.Hls.Events.SUBTITLE_TRACKS_UPDATED])if(event)hls.on(event,refresh);
    video?.textTracks?.addEventListener?.("addtrack",refresh);video?.addEventListener("loadedmetadata",refresh);
    const reports=document.createElement("details"),summary=document.createElement("summary");summary.textContent="Báo nguồn lỗi";reports.append(summary);
    const reason=document.createElement("select");reason.setAttribute("aria-label","Lý do báo lỗi");["Không phát được","Giật hoặc đứng hình","Sai tập / sai phim","Lỗi âm thanh hoặc phụ đề"].forEach(value=>reason.add(new Option(value,value)));
    const save=document.createElement("button");save.textContent="Lưu báo lỗi trên thiết bị";
    const message=document.createElement("p");message.setAttribute("role","status");message.textContent="Báo lỗi được lưu trên thiết bị này; tải JSON để gửi cho người quản lý khi cần.";
    save.onclick=()=>{try{saveReport(localStorage,getContext(),reason.value);message.textContent="Đã lưu báo lỗi trên thiết bị. Bạn có thể tải JSON bên cạnh.";}catch(e){message.textContent="Không lưu được vì bộ nhớ trình duyệt bị chặn/đầy.";}};
    const exportButton=document.createElement("button");exportButton.textContent="Tải báo lỗi JSON";exportButton.onclick=()=>{try{const raw=localStorage.getItem("playback_reports")||"[]",url=URL.createObjectURL(new Blob([raw],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download="playback-reports.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){message.textContent="Chưa xuất được báo lỗi.";}};
    reports.append(reason,save,exportButton,message);box.append(reports);panel.append(box);refresh();
    return {quality,subtitle,refresh};
  }
  const api={qualityRows,saveReport,attach};if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.PlaybackOptions=api;
})(globalThis);
