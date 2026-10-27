'use strict';
const HOME='https://tikivn7-pixel.github.io/Web_Phim/Frontend/index.html';
const BASE=new URL('./',HOME);
function isSite(value){
  try{const url=new URL(value);return url.origin===BASE.origin&&!url.username&&!url.password&&url.pathname.startsWith(BASE.pathname);}catch{return false;}
}
function isExternal(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!isSite(value);}catch{return false;}
}
const preferences={nodeIntegration:false,nodeIntegrationInWorker:false,nodeIntegrationInSubFrames:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,partition:'persist:lauphim'};
module.exports={HOME,isSite,isExternal,preferences};
