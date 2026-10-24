(function(root){
  'use strict';
  const KEY='movie_notes_v1', VERSION=1, MAX_MOVIES=1000, MAX_BOOKMARKS=2000, MAX_PER_MOVIE=100;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const safeKey=v=>typeof v==='string'&&v.length>0&&v.length<=500&&v===v.trim()&&!/[\u0000-\u001f\u007f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
  const stamp=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e15;
  const empty=()=>({version:VERSION,movies:{}});
  const emptyMovie=()=>({note:{text:'',spoiler:false,updatedAt:0},bookmarks:{}});
  function normalize(input,strict=false){
    const fail=()=>{throw Error('Ghi chú không đúng định dạng phiên bản 1 hoặc vượt giới hạn lưu trữ.');};
    if(!object(input)||input.version!==VERSION||!object(input.movies)){if(strict)fail();return empty();}
    const entries=Object.entries(input.movies),out=empty();let total=0;
    if(strict&&entries.length>MAX_MOVIES)fail();
    for(const [slug,movie] of entries.slice(0,MAX_MOVIES)){
      if(!safeKey(slug)||!object(movie)||!object(movie.note)||!object(movie.bookmarks)){if(strict)fail();continue;}
      const n=movie.note;
      if(typeof n.text!=='string'||n.text.length>10000||typeof n.spoiler!=='boolean'||!stamp(n.updatedAt)){if(strict)fail();continue;}
      const m=emptyMovie();m.note={text:n.text,spoiler:n.spoiler,updatedAt:n.updatedAt};
      const bookmarks=Object.entries(movie.bookmarks);if(strict&&bookmarks.length>MAX_PER_MOVIE)fail();
      for(const [id,b] of bookmarks.slice(0,MAX_PER_MOVIE)){
        const valid=safeKey(id)&&id.length<=100&&object(b)&&typeof b.label==='string'&&b.label.length<=160&&typeof b.time==='number'&&Number.isFinite(b.time)&&b.time>=0&&b.time<=604800&&typeof b.episodeName==='string'&&b.episodeName.trim().length>0&&b.episodeName.length<=300&&Number.isSafeInteger(b.episode)&&b.episode>=1&&b.episode<=100000&&['auto','kkphim','nguonc','hardcode'].includes(b.source)&&Number.isSafeInteger(b.server)&&b.server>=0&&b.server<=1000&&stamp(b.updatedAt)&&typeof b.deleted==='boolean';
        if(!valid){if(strict)fail();continue;}if(total>=MAX_BOOKMARKS){if(strict)fail();continue;}
        m.bookmarks[id]={label:b.label,time:b.time,episodeName:b.episodeName,episode:b.episode,source:b.source,server:b.server,updatedAt:b.updatedAt,deleted:b.deleted};total++;
      }out.movies[slug]=m;
    }return out;
  }
  const storage=s=>s||root.localStorage;
  function read(s){try{const raw=storage(s).getItem(KEY);return raw===null?empty():normalize(JSON.parse(raw));}catch(_){return empty();}}
  function write(input,s){const data=normalize(input,true);try{storage(s).setItem(KEY,JSON.stringify(data));}catch(_){throw Error('Không lưu được ghi chú. Bộ nhớ có thể đầy hoặc bị trình duyệt chặn.');}return data;}
  function get(slug,s){const data=read(s);return safeKey(slug)&&Object.hasOwn(data.movies,slug)?data.movies[slug]:null;}
  function mutate(slug,s,fn){
    if(!safeKey(slug))throw Error('Phim không hợp lệ.');let data,target;
    try{target=storage(s);const raw=target.getItem(KEY);data=raw===null?empty():normalize(JSON.parse(raw),true);}catch(_){throw Error('Dữ liệu ghi chú cũ không đọc được. Hãy kiểm tra bản sao lưu trong Thư viện trước khi sửa.');}
    if(!Object.hasOwn(data.movies,slug)){if(Object.keys(data.movies).length>=MAX_MOVIES)throw Error('Đã đạt giới hạn 1.000 phim có ghi chú.');data.movies[slug]=emptyMovie();}
    fn(data.movies[slug]);write(data,target);
    if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('movie-notes-change',{detail:{slug}}));
    return data.movies[slug];
  }
  function setNote(slug,patch,s){return mutate(slug,s,m=>{m.note={text:patch.text,spoiler:patch.spoiler,updatedAt:Math.max(Date.now(),m.note.updatedAt+1)};});}
  function addBookmark(slug,bookmark,s){let id;const movie=mutate(slug,s,m=>{if(Object.keys(m.bookmarks).length>=MAX_PER_MOVIE)throw Error('Mỗi phim lưu tối đa 100 dấu cảnh, kể cả dấu đã xóa để bảo vệ khi nhập bản sao lưu.');id='b-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));m.bookmarks[id]={...bookmark,updatedAt:Date.now(),deleted:false};});return {id,...movie.bookmarks[id]};}
  function removeBookmark(slug,id,s){return mutate(slug,s,m=>{if(!safeKey(id)||!Object.hasOwn(m.bookmarks,id))throw Error('Không tìm thấy dấu cảnh.');const b=m.bookmarks[id];b.deleted=true;b.updatedAt=Math.max(Date.now(),b.updatedAt+1);});}
  function merge(a,b){const out=normalize(a),incoming=normalize(b);for(const [slug,m]of Object.entries(incoming.movies)){if(!Object.hasOwn(out.movies,slug)){out.movies[slug]=m;continue;}const current=out.movies[slug];if(m.note.updatedAt>current.note.updatedAt)current.note=m.note;for(const [id,mark]of Object.entries(m.bookmarks))if(!Object.hasOwn(current.bookmarks,id)||mark.updatedAt>current.bookmarks[id].updatedAt)current.bookmarks[id]=mark;}return normalize(out,true);}
  function watchUrl(slug,bookmark){if(!safeKey(slug))throw Error('Phim không hợp lệ.');normalize({version:1,movies:{[slug]:{note:emptyMovie().note,bookmarks:{check:{...bookmark,label:bookmark.label||'',updatedAt:bookmark.updatedAt||0,deleted:false}}}}},true);const params=new URLSearchParams({slug,ep:String(bookmark.episode),data_source:bookmark.source,server:String(bookmark.server),target_episode:bookmark.episodeName,resume:String(Math.floor(bookmark.time))});return 'watch.html?'+params;}
  const api={KEY,VERSION,MAX_MOVIES,MAX_BOOKMARKS,MAX_PER_MOVIE,empty,normalize,read,write,get,setNote,addBookmark,removeBookmark,merge,watchUrl};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MovieNotes=api;
})(globalThis);
