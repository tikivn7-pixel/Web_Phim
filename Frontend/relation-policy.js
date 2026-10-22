const fs=require("fs"),path=require("path");
const {normalize}=require("./relation-editor");
function indexRelations(registry,knownSlugs){
  normalize(registry,knownSlugs);
  const members=new Map(),ids=new Set();
  for(const group of registry.groups||[]){
    if(!/^[a-z0-9][a-z0-9-]*$/.test(group.id||"")||ids.has(group.id))throw Error("ID quan hệ không hợp lệ/trùng: "+group.id);
    ids.add(group.id);
    if(!Array.isArray(group.members)||group.members.length<2||!Array.isArray(group.sources)||!group.sources.length)throw Error("Quan hệ phải có ít nhất hai phim và nguồn đối chiếu: "+group.id);
    for(const source of group.sources){const url=typeof source==="string"?source:source.url;if(!/^https:\/\//.test(url||""))throw Error("Thiếu URL nguồn HTTPS: "+group.id);}
    group.members.forEach((member,index)=>{
      if(typeof member.slug!=="string"||!member.slug.trim())throw Error("Thiếu slug thành viên: "+group.id);
      if(member.order!==undefined&&(!Number.isInteger(member.order)||member.order<0))throw Error("Thứ tự phải là số nguyên không âm: "+member.slug);
      if(knownSlugs&&!knownSlugs.has(member.slug))throw Error("Quan hệ tham chiếu slug không tồn tại: "+member.slug);
      if(members.has(member.slug))throw Error("Một phim đang thuộc hai quan hệ, cần chọn rõ quan hệ chính: "+member.slug);
      members.set(member.slug,{group,member,order:member.order??index});
    });
  }
  return members;
}
function readRegistry(){const file=path.join(__dirname,"../Backend/movie-relations.json");return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):{version:1,groups:[]};}
function applyRelations(movies,registry=readRegistry()){
  const known=new Set(movies.map(m=>m.slug));
  const active={...registry,standalone:(registry.standalone||[]).filter(member=>known.has(member.slug)),groups:(registry.groups||[]).map(group=>({...group,members:group.members.filter(member=>known.has(member.slug))})).filter(group=>group.members.length>=2)};
  const index=indexRelations(active,known);
  return movies.map(movie=>{
    const result={...movie};delete result.group;delete result.partName;delete result.relationOrder;delete result.relationVerified;
    const relation=index.get(movie.slug);
    if(relation){result.group=relation.group.id;result.partName=relation.member.label||movie.title;result.relationOrder=relation.order;result.relationVerified=true;}
    return result;
  });
}
module.exports={indexRelations,readRegistry,applyRelations};
