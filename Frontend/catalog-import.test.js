const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),os=require("os"),path=require("path"),vm=require("vm");
const {importCatalog,sourceText}=require("./import-catalog");
const {deriveRelations}=require("./build-relations");
const movie=(slug,extra={})=>({slug,title:slug,episodes:12,poster:"https://example.com/poster.jpg",country:"Nhật Bản",genres:"Hành Động",...extra});
function fixture(run){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),"catalog-import-test-"));
  try{
    const target=path.join(folder,"catalog-source.js"),archive=path.join(folder,"movies.json"),input=path.join(folder,"import.json");
    const raw=[movie("one",{genres:"Hành Động, Nhật Bản"}),movie("two")],published=[{...raw[0],genres:"Hành Động",sourceCountries:["Nhật Bản"]},raw[1]];
    const prior="// Keep original formatting and comments on failure\r\n"+sourceText(raw);
    fs.writeFileSync(target,prior);fs.writeFileSync(archive,JSON.stringify(published));
    run({target,archive,input,raw,published,prior});
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
}
test("catalog import validates before replacing source or overwriting an existing backup",()=>fixture(({target,archive,input,raw,prior})=>{
  fs.writeFileSync(target+".before-import.bak","older successful backup");
  fs.writeFileSync(input,JSON.stringify([movie("duplicate"),movie("duplicate")]));
  let built=false;
  assert.throws(()=>importCatalog(input,{target,archive,readSource:()=>raw,build:()=>{built=true;}}));
  assert.equal(built,false);assert.equal(fs.readFileSync(target,"utf8"),prior);
  assert.equal(fs.readFileSync(target+".before-import.bak","utf8"),"older successful backup");
}));
test("failed relation validation rolls source back byte-for-byte and keeps a usable backup",()=>fixture(({target,archive,input,raw,published,prior})=>{
  fs.writeFileSync(input,JSON.stringify([published[0]]));
  const manual={groups:[{id:"verified",sources:["https://example.com/series"],members:[{slug:"one"},{slug:"two"}]}]};
  assert.throws(()=>importCatalog(input,{target,archive,readSource:()=>raw,build:()=>{
    const context={};vm.runInNewContext(fs.readFileSync(target,"utf8")+";this.movies=fallbackMoviesList",context);
    deriveRelations(context.movies,{movies:{}},manual);
  }}),/đã khôi phục.*không tồn tại/);
  assert.equal(fs.readFileSync(target,"utf8"),prior);
  assert.equal(fs.readFileSync(target+".before-import.bak","utf8"),prior);
  assert.equal(fs.existsSync(target+".tmp"),false);
}));
test("successful catalog import preserves untouched raw records and invokes build on the new source",()=>fixture(({target,archive,input,raw,published,prior})=>{
  const imported=published.map(item=>({...item}));imported[1].title="Updated title";
  fs.writeFileSync(input,JSON.stringify(imported));let built=0;
  const result=importCatalog(input,{target,archive,readSource:()=>raw,build:()=>{
    built++;assert.match(fs.readFileSync(target,"utf8"),/Updated title/);
  }});
  assert.equal(built,1);assert.deepEqual(result[0],raw[0]);assert.equal(result[1].title,"Updated title");
  assert.equal(fs.readFileSync(target+".before-import.bak","utf8"),prior);assert.equal(fs.existsSync(target+".tmp"),false);
}));
