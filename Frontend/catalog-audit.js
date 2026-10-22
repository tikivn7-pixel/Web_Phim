(function (root) {
  const key = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi,"d").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  function audit(movies) {
    const issues = [], slugs = new Map(), titles = new Map(), groups = new Map(), providers = new Map();
    const add = (severity,code,items,message) => issues.push({severity,code,slugs:items.map(m=>m.slug || ""),message});
    for (const movie of movies) {
      if (!movie || typeof movie !== "object") { add("error","invalid-record",[],"Mục phim không hợp lệ."); continue; }
      if (!movie.slug || (!/^[a-z0-9][a-z0-9_-]*$/.test(movie.slug) && !(movie.apiSlug && /^phim\/[a-z0-9_-]+$/.test(movie.slug)))) add("error","invalid-slug",[movie],"Slug không hợp lệ.");
      if (typeof movie.title!=="string"||!movie.title.trim()) add("error","missing-title",[movie],"Thiếu tên phim.");
      if (!Number.isInteger(Number(movie.episodes)) || Number(movie.episodes)<1) add("error","invalid-episodes",[movie],"Số tập không hợp lệ.");
      if (Number(movie.episodes)>2000) add("warning","episodes-review",[movie],"Số tập lớn bất thường; đối chiếu nguồn phát.");
      if (!Number(movie.year)) add("warning","missing-year",[movie],"Chưa có năm phát hành.");
      if (movie.type === "single" && Number(movie.episodes)>1) add("warning","type-review",[movie],"Phim lẻ nhưng có nhiều tập; có thể là bản chia phần.");
      if (movie.group && !movie.partName) add("warning","missing-part",[movie],"Có nhóm nhưng thiếu tên phần.");
      if (movie.partName && !movie.group) add("warning","missing-group",[movie],"Có tên phần nhưng chưa có nhóm.");
      if (Array.isArray(movie.sourceCountries) && movie.sourceCountries.length>1) add("warning","country-review",[movie],"Nguồn ghi nhiều quốc gia; rà lại quốc gia chính, không tự đổi nhãn.");
      for (const field of ["poster","banner"]) if (!movie[field]) add("warning","missing-image",[movie],"Thiếu ảnh "+field+".");
      const put = (map,id) => { if(id) map.set(id,[...(map.get(id)||[]),movie]); };
      put(slugs,movie.slug); put(titles,key(movie.title)); put(groups,movie.group); put(providers,movie.apiSlug||movie.slug);
    }
    for(const items of slugs.values()) if(items.length>1) add("error","duplicate-slug",items,"Trùng slug; cần sửa trước khi xuất.");
    for(const items of providers.values()) if(items.length>1) add("warning","duplicate-provider",items,"Nhiều mục dùng chung nguồn phát; kiểm tra trước khi gộp.");
    for(const items of titles.values()) if(items.length>1) add("warning","duplicate-title",items,"Trùng tên; có thể là bản làm lại hoặc phần khác, cần đối chiếu.");
    for(const [group,items] of groups) {
      const parts=new Map();
      for(const item of items) {const part=key(item.partName);if(part)parts.set(part,[...(parts.get(part)||[]),item]);}
      for(const repeated of parts.values()) if(repeated.length>1) add("warning","duplicate-part",repeated,"Trùng tên phần trong nhóm "+group+".");
      // A numerical season gap is a review hint, not permission to invent/delete episodes.
      const seasons=items.map(m=>String(m.partName||"").match(/(?:season|phần|phan|mùa|mua)\s*(\d+)/i)).filter(Boolean).map(m=>Number(m[1]));
      if(seasons.length>1 && Math.max(...seasons)-Math.min(...seasons)+1>new Set(seasons).size) add("warning","season-gap",items,"Nhóm "+group+" có khoảng trống số mùa; kiểm tra nhóm hoặc phần còn thiếu.");
    }
    return {total:movies.length,errors:issues.filter(i=>i.severity==="error").length,warnings:issues.filter(i=>i.severity==="warning").length,issues};
  }
  const api={audit};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.CatalogAudit=api;
})(globalThis);
