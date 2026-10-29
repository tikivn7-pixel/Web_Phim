(function(root){
  'use strict';
  const BASE='https://comics-api.hieubq.io.vn/api/v1';
  const text=value=>String(value??'').replace(/<[^>]*>/g,'').trim();
  function image(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
  function comic(item){if(!item||item.id===undefined||!text(item.title))return null;return{id:String(item.id),title:text(item.title),cover:image(item.thumbnail),description:text(item.description||item.short_description),chapters:Array.isArray(item.chapters)?item.chapters.filter(c=>c.id!==undefined).map(c=>({id:String(c.id),title:text(c.name),alias:text(c.alias)})):[]};}
  async function request(path,fetcher=fetch){
    const response=await fetcher(BASE+path,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
    if(!response.ok)throw Error('Nguồn Comics API trả lỗi HTTP '+response.status+'. Bạn có thể thử lại hoặc đọc truyện mẫu.');
    try{return await response.json();}catch{throw Error('Nguồn chưa trả dữ liệu truyện hợp lệ.');}
  }
  async function list(query='',page=1,fetcher=fetch){
    const data=await request(query?'/comics/search?'+new URLSearchParams({q:query,page:String(page)}):'/comics/new?page='+page,fetcher);
    const items=Array.isArray(data)?data:data.comics;
    if(!Array.isArray(items))throw Error('Nguồn đã thay đổi cấu trúc danh sách truyện.');
    return items.map(comic).filter(Boolean);
  }
  async function detail(id,fetcher=fetch){const result=comic(await request('/comics/'+encodeURIComponent(id),fetcher));if(!result)throw Error('Không tìm thấy truyện.');return result;}
  async function chapter(id,entry,fetcher=fetch){
    const data=await request('/comics/'+encodeURIComponent(id)+'/chapters/'+encodeURIComponent(entry.id)+'?'+new URLSearchParams({alias:entry.alias||''}),fetcher);
    const pages=(Array.isArray(data.images)?data.images:[]).slice().sort((a,b)=>Number(a.page)-Number(b.page)).map(p=>image(p.src)).filter(Boolean);
    if(!pages.length)throw Error('Chương này chưa có ảnh đọc được từ nguồn.');return pages;
  }
  function read(storage){try{const d=JSON.parse(storage.getItem('comics_reader_v1')||'{}');return d&&typeof d==='object'&&!Array.isArray(d)?d:{};}catch{return {};}}
  function save(storage,key,value){const data=read(storage);data[key]=value;const sorted=Object.entries(data).sort((a,b)=>(b[1]?.updatedAt||0)-(a[1]?.updatedAt||0)).slice(0,150);storage.setItem('comics_reader_v1',JSON.stringify(Object.fromEntries(sorted)));}
  const api={BASE,text,image,comic,list,detail,chapter,read,save};if(typeof module==='object'&&module.exports)module.exports=api;else root.ComicsModel=api;
})(globalThis);
