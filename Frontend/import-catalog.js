const fs=require("fs"),path=require("path");
const {audit}=require("./catalog-audit"),{validateMovies,readMovies}=require("./catalog-tools");
function prepare(data){const movies=Array.isArray(data)?data:data?.movies;if(!Array.isArray(movies))throw Error("File JSON phải chứa mảng phim.");const report=audit(movies);if(report.errors)throw Error(report.issues.filter(i=>i.severity==="error").map(i=>i.message+" "+i.slugs.join(", ")).join("\n"));const checked=validateMovies(movies);if(checked.errors.length)throw Error(checked.errors.join("\n"));return movies;}
function sourceText(movies){return "// Nguồn được nhập từ trang quản lý; bản trước nằm trong catalog-source.js.before-import.bak\nconst fallbackMoviesList = "+JSON.stringify(movies,null,2).replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm,(_,space,key)=>space+(key==="__proto__"?'["__proto__"]':key)+":")+";\n";}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
function mergeImported(imported,published,source){const before=new Map(published.map(m=>[m.slug,m])),raw=new Map(source.map(m=>[m.slug,m]));return imported.map(movie=>before.has(movie.slug)&&raw.has(movie.slug)&&JSON.stringify(stable(movie))===JSON.stringify(stable(before.get(movie.slug)))?raw.get(movie.slug):movie);}
function importCatalog(input,{
  target=path.join(__dirname,"../Backend/catalog-source.js"),
  archive=path.join(__dirname,"data/movies.json"),
  readSource=readMovies,
  build=()=>require("./build-catalog").buildCatalog(),
}={}){
  // Validation and merging must finish before touching either source or backup.
  const imported=prepare(JSON.parse(fs.readFileSync(path.resolve(input),"utf8")));
  const published=fs.existsSync(archive)?JSON.parse(fs.readFileSync(archive,"utf8")):[];
  const movies=mergeImported(imported,published,readSource());
  const prior=fs.readFileSync(target),temporary=target+".tmp",backup=target+".before-import.bak";
  fs.writeFileSync(backup,prior);
  let replaced=false;
  try{
    fs.writeFileSync(temporary,sourceText(movies));
    fs.renameSync(temporary,target);replaced=true;
    build();
  }catch(error){
    if(replaced){
      try{fs.writeFileSync(temporary,prior);fs.renameSync(temporary,target);}
      catch(restoreError){throw Error("Nhập thất bại và chưa tự khôi phục được nguồn. Bản cũ còn tại "+backup+". "+error.message+"; "+restoreError.message);}
      throw Error("Nhập thất bại; đã khôi phục catalog-source.js trước đó. Kiểm tra lỗi rồi chạy npm run catalog:build để đồng bộ lại dữ liệu xuất. "+error.message);
    }
    throw error;
  }finally{
    if(fs.existsSync(temporary))fs.unlinkSync(temporary);
  }
  return movies;
}
function main(){const input=process.argv[2];if(!input)throw Error('Cách dùng: npm run catalog:import -- "đường-dẫn/catalog-import.json"');const movies=importCatalog(input);console.log("Đã nhập "+movies.length+" phim; đăng lại Frontend/data lên hosting.");}
if(require.main===module)try{main();}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={prepare,sourceText,mergeImported,importCatalog};
