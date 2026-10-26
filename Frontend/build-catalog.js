// node Frontend/build-catalog.js — validate and export without a running server.
const fs = require("fs");
const path = require("path");
const { readMovies, validateMovies, enrichMovies } = require("./catalog-tools");
const { artifacts } = require("./catalog-artifacts");
const { audit } = require("./catalog-audit");
function buildCatalog() {
  require("./build-relations").buildRelations();
  const source = readMovies();
  const report = validateMovies(source);
  if (report.errors.length) throw new Error(report.errors.join("\n"));
  const manifestFile = path.join(__dirname, "../Backend/catalog-manifest.json");
  const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : null;
  const result = enrichMovies(source, previous);
  const output = JSON.stringify(result.movies);
  if (JSON.parse(output).length !== source.length) throw new Error("Xuất thiếu phim; đã dừng.");
  const file = path.join(__dirname, "data/movies.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", output);
  fs.renameSync(file + ".tmp", file);
  const generated=artifacts(result.movies);
  const write=(name,value)=>{const target=path.join(__dirname,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target+".tmp",value);fs.renameSync(target+".tmp",target);};
  generated.files.forEach(item=>write(item.file,item.text));
  write("data/catalog-search.json",JSON.stringify(generated.search));
  write("data/catalog-cast.json",JSON.stringify(generated.cast));
  write("data/catalog-index.json",JSON.stringify(generated.index));
  const audited=audit(result.movies);
  const sizes={archive:Buffer.byteLength(output),index:Buffer.byteLength(JSON.stringify(generated.index)),search:Buffer.byteLength(JSON.stringify(generated.search)),largestDetailShard:Math.max(...generated.files.map(f=>Buffer.byteLength(f.text)))};
  write("data/catalog-audit.json",JSON.stringify({...audited,sizes}));
  fs.writeFileSync(path.join(__dirname,"../Backend/catalog-audit-report.md"),`# Rà soát kho phim\n\n${audited.total} phim; ${audited.errors} lỗi; ${audited.warnings} mục cần rà soát. Không tự xóa/gộp phim. Các cảnh báo là gợi ý, không xác nhận metadata sai.\n\n`+audited.issues.map(i=>`- **${i.severity} / ${i.code}**: ${i.message} — ${i.slugs.join(", ")}`).join("\n")+"\n");
  fs.writeFileSync(manifestFile, JSON.stringify(result.manifest));
  console.log(`Đã xuất ${source.length} phim. Danh sách nhẹ: ${sizes.index} bytes; bản đầy đủ: ${sizes.archive} bytes; chi tiết lớn nhất: ${sizes.largestDetailShard} bytes. Báo cáo: Backend/catalog-audit-report.md`);
  return result.movies;
}
if (require.main === module) { try { buildCatalog(); } catch (err) { console.error(err.message); process.exitCode = 1; } }
module.exports = { buildCatalog };
