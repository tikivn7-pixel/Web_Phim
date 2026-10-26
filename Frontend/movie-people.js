(function(root){
  'use strict';
  function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
  function names(value){const seen=new Set(),result=[];for(const item of (Array.isArray(value)?value:[value]))for(const name of String(item&&typeof item==='object'?item.name||'':item||'').split(/[,;\n]/)){const label=name.trim(),key=normalize(label);if(!key||['dang cap nhat','n a','unknown','updating'].includes(key)||seen.has(key))continue;seen.add(key);result.push(label);}return result;}
  function index(movies){const actors=Object.create(null);for(const movie of movies)if(movie.slug)for(const name of names(movie.cast)){const key=normalize(name);if(!Object.hasOwn(actors,key))actors[key]=[];if(!actors[key].includes(movie.slug))actors[key].push(movie.slug);}return{version:1,actors};}
  const api={normalize,names,index};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MoviePeople=api;
})(globalThis);
