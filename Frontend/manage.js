(async function(){
  const $=id=>document.getElementById(id),form=$("movie-form"),status=$("manage-status");
  const DRAFT="catalog_editor_draft_v1",fields=["title","slug","apiSlug","year","episodes","country","type","genres","poster","banner","group","partName","cast","director","desc"];
  let original=[],movies=[],selected=null,page=1,report,issueLimit=100;
  const tell=(message,error=false)=>{status.textContent=message;status.classList.toggle("error",error);};
  const download=(name,value)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const persist=()=>{try{localStorage.setItem(DRAFT,JSON.stringify(movies));return true;}catch(e){return false;}};
  const folded=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toLowerCase();
  function drawList(){
    const query=folded($("manage-search").value),list=movies.filter(m=>folded(m.title+" "+m.slug).includes(query));
    const pages=Math.max(1,Math.ceil(list.length/40));page=Math.min(page,pages);$("manage-list").replaceChildren();
    list.slice((page-1)*40,page*40).forEach(movie=>{const button=document.createElement("button");button.className="movie-row"+(movie.slug===selected?" active":"");button.textContent=movie.title+" · "+(movie.year||"chưa có năm");button.onclick=()=>edit(movie);$("manage-list").append(button);});
    $("manage-count").textContent=`(${movies.length} phim)`;$("list-page").textContent=`${page}/${pages}`;$("list-prev").disabled=page<=1;$("list-next").disabled=page>=pages;
  }
  function preview(){const value=name=>form.elements.namedItem(name).value;$("preview-title").textContent=value("title")||"Phim mới";$("preview-meta").textContent=[value("year"),value("country"),value("genres")].filter(Boolean).join(" · ");$("preview-desc").textContent=value("desc");const img=$("poster-preview");img.onerror=()=>{img.onerror=null;img.src="Img/poster-placeholder.svg";};img.referrerPolicy="no-referrer";img.src=value("poster")||"Img/poster-placeholder.svg";}
  function edit(movie){selected=movie?.slug||null;form.reset();fields.forEach(name=>{form.elements.namedItem(name).value=movie?.[name]??(name==="episodes"?1:name==="type"?"series":"");});$("editor-heading").textContent=movie?"Sửa phim: "+movie.title:"Thêm phim";preview();drawList();}
  function drawAudit(){
    report=CatalogAudit.audit(movies);$("audit-summary").textContent=`${report.total} phim · ${report.errors} lỗi · ${report.warnings} mục cần kiểm tra`;
    const select=$("audit-code"),chosen=select.value;select.replaceChildren(new Option("Tất cả",""));[...new Set(report.issues.map(i=>i.code))].sort().forEach(code=>select.add(new Option(code,code)));select.value=chosen;
    const issues=report.issues.filter(i=>!select.value||i.code===select.value);$("audit-list").replaceChildren();
    issues.slice(0,issueLimit).forEach(issue=>{const row=document.createElement("div");row.className="audit-row "+issue.severity;const text=document.createElement("p");text.textContent=`${issue.code}: ${issue.message}`;row.append(text);issue.slugs.forEach(slug=>{const movie=movies.find(m=>m.slug===slug);if(!movie)return;const button=document.createElement("button");button.textContent=movie.title;button.onclick=()=>{edit(movie);form.scrollIntoView({behavior:"smooth"});};row.append(button);});$("audit-list").append(row);});$("audit-more").hidden=issues.length<=issueLimit;
  }
  try{
    const response=await fetch("data/movies.json",{cache:"no-cache"});if(!response.ok)throw Error("Chưa tải được dữ liệu. Mở trang từ URL website hoặc Live Server.");original=await response.json();if(!Array.isArray(original))throw Error("Kho phim không hợp lệ.");
    try{const draft=JSON.parse(localStorage.getItem(DRAFT)||"null");movies=Array.isArray(draft)&&!CatalogAudit.audit(draft).errors?draft:original.slice();}catch(e){movies=original.slice();}
    const country=form.elements.namedItem("country");country.add(new Option("Chọn quốc gia",""));[...new Set([...MovieCountries.COUNTRIES,...movies.map(m=>m.country).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"vi")).forEach(name=>country.add(new Option(name,name)));
    drawAudit();edit(movies[0]);tell(`Đã tải ${movies.length} phim. Thay đổi được lưu vào bản nháp, chưa đăng lên website.`);
  }catch(error){tell(error.message,true);return;}
  form.addEventListener("input",preview);
  form.onsubmit=event=>{
    event.preventDefault();const prior=movies.find(m=>m.slug===selected),movie={...(prior||{})};fields.forEach(name=>{const value=form.elements.namedItem(name).value.trim();if(value!=="")movie[name]=value;else delete movie[name];});
    movie.episodes=Number(movie.episodes);if(movie.year)movie.year=Number(movie.year);movie.genres=MovieGenres.genres(movie.genres).join(", ");movie.banner=movie.banner||movie.poster;movie.updatedAt=new Date().toISOString();if(!prior)movie.addedAt=movie.updatedAt;
    const next=selected?movies.map(m=>m.slug===selected?movie:m):[movie,...movies];const checked=CatalogAudit.audit(next);
    if(checked.errors){tell(checked.issues.filter(i=>i.severity==="error").map(i=>i.message+" "+i.slugs.join(", ")).join("\n"),true);return;}
    movies=next;const saved=persist();drawAudit();edit(movie);tell(saved?"Đã lưu bản nháp. Bấm Xuất JSON để cập nhật khi sửa xong.":"Đã sửa trong phiên này nhưng bộ nhớ đầy/bị chặn. Hãy xuất JSON trước khi rời trang.",!saved);
  };
  $("add-movie").onclick=()=>{edit(null);form.scrollIntoView({behavior:"smooth"});form.elements.namedItem("title").focus();};
  $("manage-search").oninput=()=>{page=1;drawList();};$("list-prev").onclick=()=>{page--;drawList();};$("list-next").onclick=()=>{page++;drawList();};
  $("export-catalog").onclick=()=>{const audit=CatalogAudit.audit(movies);if(audit.errors){tell("Cần sửa lỗi trước khi xuất JSON.",true);return;}download("catalog-import.json",movies);tell("Đã xuất JSON gồm "+movies.length+" phim. Làm theo phần Cách cập nhật website để áp dụng.");};
  $("import-catalog").onchange=async event=>{try{const file=event.target.files[0];if(!file)return;const data=JSON.parse(await file.text()),next=Array.isArray(data)?data:data.movies;if(!Array.isArray(next))throw Error("File phải chứa danh sách phim.");const audit=CatalogAudit.audit(next);if(audit.errors)throw Error(audit.issues.filter(i=>i.severity==="error").map(i=>i.message).join("\n"));movies=next;const saved=persist();drawAudit();edit(movies[0]);tell(saved?"Đã nhập vào bản nháp, chưa thay đổi website.":"Đã nhập trong phiên này; hãy xuất JSON trước khi rời trang vì bộ nhớ bị chặn.",!saved);}catch(error){tell(error.message,true);}event.target.value="";};
  $("reset-draft").onclick=()=>{try{localStorage.removeItem(DRAFT);}catch(e){}movies=original.slice();drawAudit();edit(movies[0]);tell("Đã trở về dữ liệu hiện tại trên website.");};
  $("export-audit").onclick=()=>download("catalog-audit.json",report);$("audit-code").onchange=()=>{issueLimit=100;drawAudit();};$("audit-more").onclick=()=>{issueLimit+=100;drawAudit();};
  $("export-playback").onclick=()=>{try{download("playback-reports.json",JSON.parse(localStorage.getItem("playback_reports")||"[]"));}catch(e){tell("Chưa đọc được báo lỗi phát trên thiết bị này.",true);}};
})();
