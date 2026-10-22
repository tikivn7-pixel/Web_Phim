const fs = require("fs"), path = require("path");
const { normalize } = require("./relation-editor");
function prepareRelations(data, movies) { return normalize(data, new Set(movies.map(movie => movie.slug))); }
function importRelations(input, { backend = path.join(__dirname, "../Backend"), movies = require("./catalog-tools").readMovies(), build = () => require("./build-catalog").buildCatalog() } = {}) {
  const registry = prepareRelations(JSON.parse(fs.readFileSync(path.resolve(input), "utf8")), movies);
  const target = path.join(backend, "movie-relations.manual.json"), prior = fs.existsSync(target) ? fs.readFileSync(target) : null;
  if (prior) fs.writeFileSync(target + ".before-import.bak", prior);
  fs.writeFileSync(target + ".tmp", JSON.stringify(registry, null, 2) + "\n");
  fs.renameSync(target + ".tmp", target);
  try { build(); }
  catch (error) {
    if (prior) fs.writeFileSync(target, prior); else fs.unlinkSync(target);
    throw Error("Không thể xuất catalog; đã khôi phục cấu hình liên kết trước đó. " + error.message);
  }
  return registry;
}
if (require.main === module) {
  try {
    if (!process.argv[2]) throw Error('Cách dùng: npm run relations:import -- "đường-dẫn/movie-relations-import.json"');
    const registry = importRelations(process.argv[2]);
    console.log(`Đã nhập ${registry.groups.length} nhóm. Đăng lại Frontend/data để cập nhật website.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { prepareRelations, importRelations };
