(function(root){
  const fields=["q","country","genre","year","type","sort"];
  function read(search){
    const params=new URLSearchParams(search), state={};
    fields.forEach(key=>{const value=params.get(key);if(value)state[key]=value.slice(0,300);});
    state.page=Math.max(1,parseInt(params.get("p"),10)||1);
    state.catalog=params.get("view")==="catalog"||fields.some(key=>params.has(key))||params.has("p");
    state.view=params.get("view")||params.get("page")||"home";
    return state;
  }
  function url(state){
    const params=new URLSearchParams({view:"catalog"});
    fields.forEach(key=>{if(state[key])params.set(key,state[key]);});
    if(Number(state.page)>1)params.set("p",Math.floor(Number(state.page)));
    return "index.html?"+params;
  }
  function safeReturn(value){return typeof value==="string"&&/^(?:index|discover)\.html(?:\?[^#]*)?(?:#.*)?$/.test(value)?value:null;}
  const api={read,url,safeReturn};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.CatalogState=api;
})(globalThis);
