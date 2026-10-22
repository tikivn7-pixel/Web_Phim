function updateCatalogUrl(state, mode="push") {
  const target=CatalogState.url(state);
  const current="index.html"+window.location.search;
  if(mode!=="none"&&current!==target) window.history[mode==="replace"?"replaceState":"pushState"]({catalog:true},"",target);
  try{sessionStorage.setItem("catalog-return",target);}catch(e){}
}
function getCatalogReturnLink(){
  const explicit=new URLSearchParams(window.location.search).get("return");
  if(CatalogState.safeReturn(explicit))return explicit;
  try{return CatalogState.safeReturn(sessionStorage.getItem("catalog-return"));}catch(e){return null;}
}
function rememberCatalogReturn(params){
  if(document.getElementById("page-search")?.classList.contains("active")){
    const link="index.html"+window.location.search;
    try{sessionStorage.setItem("catalog-return",link);sessionStorage.setItem("catalog-scroll:"+link,String(window.scrollY));}catch(e){}
    params.set("return",link);
  }else{const link=getCatalogReturnLink();if(link)params.set("return",link);}
}
async function restoreCatalogFromLocation(){
  if(!document.getElementById("page-home"))return;
  const state=CatalogState.read(window.location.search);
  if(state.catalog){
    const input=document.getElementById("search-input");if(input)input.value=state.q||"";
    await showCatalog({...state,_history:"none"});
    try{const y=Number(sessionStorage.getItem("catalog-scroll:"+"index.html"+window.location.search));if(y>0)requestAnimationFrame(()=>window.scrollTo(0,y));}catch(e){}
  }else switchPage(state.view==="wishlist"?"wishlist":"home",{updateUrl:false});
}
window.addEventListener("popstate",restoreCatalogFromLocation);
document.addEventListener("DOMContentLoaded",()=>{
  const link=document.getElementById("catalog-back-link"),target=getCatalogReturnLink();
  if(link&&target){link.href=target;link.hidden=false;}
});
