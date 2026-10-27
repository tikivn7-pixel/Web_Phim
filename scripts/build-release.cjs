'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.join(__dirname,'../Frontend');
function assetURL(value,version){
  if(/^(?:[a-z]+:|\/\/|#)/i.test(value))return value;
  const hashAt=value.indexOf('#'),hash=hashAt>=0?value.slice(hashAt):'',base=hashAt>=0?value.slice(0,hashAt):value;
  const [file,query='']=base.split('?');
  if(!/\.(?:js|css|png|svg|webp|jpe?g|ico|webmanifest)$/i.test(file))return value;
  const params=new URLSearchParams(query);params.delete('__release');if(version)params.set('__release',version);
  return file+(params.size?'?'+params:'')+hash;
}
function canonicalHTML(value){
  return value.replace(/<meta\s+name="lauphim-release"[^>]*>\s*/g,'').replace(/(<(?:script|link|img)\b[^>]*?\b(?:src|href)=")([^"]+)(")/g,(_,a,url,b)=>a+assetURL(url)+b);
}
function buildRelease(root=ROOT,desktopVersion=JSON.parse(fs.readFileSync(path.join(__dirname,'../Desktop/package.json'),'utf8')).version){
  const files=[];
  function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){if(item.name.startsWith('.'))continue;const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(/\.(?:html|css|js|json|svg|png|jpe?g|webp|ico|webmanifest)$/i.test(file)&&!/(?:\.test\.js|release\.json)$/i.test(file))files.push(file);}}
  walk(root);const digest=crypto.createHash('sha256');digest.update('desktop:'+desktopVersion+'\n');
  for(const file of files){digest.update(path.relative(root,file).replaceAll('\\','/')+'\0');digest.update(file.endsWith('.html')?canonicalHTML(fs.readFileSync(file,'utf8')):fs.readFileSync(file));}
  const version=digest.digest('hex'),target=path.join(root,'release.json');
  let previous;try{previous=JSON.parse(fs.readFileSync(target,'utf8'));}catch{}
  if(previous?.version===version)return previous;
  const release={schemaVersion:1,version,publishedAt:new Date().toISOString(),desktopVersion};
  for(const file of files.filter(file=>file.endsWith('.html'))){let html=canonicalHTML(fs.readFileSync(file,'utf8'));
    html=html.replace(/(<(?:script|link|img)\b[^>]*?\b(?:src|href)=")([^"]+)(")/g,(_,a,url,b)=>a+assetURL(url,version.slice(0,16))+b);
    html=html.replace('</head>','<meta name="lauphim-release" content="'+version+'" data-published-at="'+release.publishedAt+'">\n</head>');
    fs.writeFileSync(file,html);
  }
  fs.writeFileSync(target,JSON.stringify(release,null,2)+'\n');return release;
}
if(require.main===module)console.log('Web/app release: '+buildRelease().version.slice(0,16));
module.exports={buildRelease,canonicalHTML,assetURL};
