(function(root){
  function decode(data){
    if(Array.isArray(data))return data;
    if(Array.isArray(data.movies))return data.movies;
    if(data.schemaVersion!==3||!Array.isArray(data.rows)||!Array.isArray(data.columns))throw Error("Định dạng danh sách phim chưa được hỗ trợ. Hãy tải lại trang.");
    return data.rows.map(values=>{
      const movie={};data.columns.forEach((field,index)=>{let value=values[index];if(value===undefined||value===null)return;
        if(data.dictionaries[field])value=data.dictionaries[field][value];
        if(["poster","banner","remotePoster"].includes(field)&&typeof value==="string"&&value.startsWith("@"))value=data.imageBase+value.slice(1);
        movie[field]=value;
      });return movie;
    });
  }
  const api={decode};if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.CatalogFormat=api;
})(globalThis);
