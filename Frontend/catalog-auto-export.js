// Synchronous export when a successful maintenance command changed the canonical source.
const fs = require("fs");
const path = require("path");
function autoExport(file) {
  const canonical = path.join(__dirname, "../Backend/catalog-source.js");
  if (path.resolve(file) !== path.resolve(canonical)) return;
  const before = fs.readFileSync(canonical, "utf8");
  process.on("exit", code => {
    if (code !== 0 || fs.readFileSync(canonical, "utf8") === before) return;
    try { require("./build-catalog").buildCatalog(); }
    catch (err) { console.error("Chưa xuất được JSON:", err.message); process.exitCode = 1; }
  });
}
module.exports = { autoExport };
