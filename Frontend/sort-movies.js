// Tự động nhóm + sắp xếp lại fallbackMoviesList trong data.js.
// Chạy tay:  node sort-movies.js            (mặc định sửa ./data.js)
//            node sort-movies.js duong/dan/data.js
// Chạy mỗi lần Ctrl+S: xem hướng dẫn "Run on Save" của VS Code.
const fs = require("fs");
const path = require("path");

const file = path.resolve(process.argv[2] || path.join(__dirname, "../Backend/catalog-source.js"));
require("./catalog-auto-export").autoExport(file);
const src = fs.readFileSync(file, "utf8");

const MARKER = "const fallbackMoviesList = [";
const markerPos = src.indexOf(MARKER);
if (markerPos === -1) {
  console.error("Không thấy 'const fallbackMoviesList = [' trong " + file);
  process.exit(1);
}

// Phần đầu file: cắt bỏ mục lục cũ (nếu có) để tự tạo lại
const tocStart = src.lastIndexOf(
  "// ------------------------------------------------------------------\n// MỤC LỤC",
  markerPos,
);
const head = src.slice(0, tocStart !== -1 ? tocStart : markerPos);

const afterMarker = src.slice(markerPos + MARKER.length);
const endPos = afterMarker.lastIndexOf("];");
if (endPos === -1) {
  console.error("Không thấy '];' kết thúc mảng.");
  process.exit(1);
}
const tail = afterMarker.slice(endPos + 2); // phần sau mảng (nếu có)
const inner = afterMarker.slice(0, endPos);

// Tách từng khối phim { ... }, bỏ comment nằm giữa các khối
const IMG_BASE = "Img/";
const items = [];
inner.split(/\n\s{0,4}\},?[ \t]*(?=\n|$)/).forEach((chunk) => {
  const open = chunk.search(/^\s*\{\s*$/m);
  if (open === -1) return;
  const body = chunk.slice(open).trim(); // bắt đầu từ "{"
  let obj;
  try {
    obj = new Function("IMG_BASE", "return (" + body + "\n})")(IMG_BASE);
  } catch (e) {
    console.error("Lỗi đọc 1 khối phim, dừng để không làm hỏng file:\n" + body);
    process.exit(1);
  }
  const lines = body
    .replace(/^\{[ \t]*\n/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*/, "    "))
    .filter((l) => l.trim() !== "");
  items.push({ i: items.length, obj, lines });
});

// ---- Phân nhóm ----
const g = (m) => (m.genres || "").toLowerCase();
function sectionOf(m) {
  if (g(m).includes("hàn qu")) return "KR";
  if (g(m).includes("nhật bản"))
    return /anime/i.test(m.genres) ? "JP_ANIME" : "JP_LIVE";
  if (g(m).includes("trung qu")) return "CN";
  if (g(m).includes("mỹ")) return "US";
  return "OTHER";
}
const SECTIONS = [
  ["KR", "PHIM HÀN QUỐC"],
  ["CN", "PHIM TRUNG QUỐC"],
  ["JP_ANIME", "NHẬT BẢN - ANIME"],
  ["JP_LIVE", "NHẬT BẢN - PHIM LẺ / LIVE-ACTION"],
  ["US", "PHIM MỸ"],
  ["OTHER", "KHÁC (chưa nhận diện được quốc gia - kiểm tra lại genres)"],
];
const buckets = Object.fromEntries(SECTIONS.map(([k]) => [k, []]));
items.forEach((it) => buckets[sectionOf(it.obj)].push(it));

// Cảnh báo tự động
const slugCount = {};
items.forEach(
  (it) => (slugCount[it.obj.slug] = (slugCount[it.obj.slug] || 0) + 1),
);
const sortKey = (it) => (it.obj.group || it.obj.title || "").toLowerCase();

const used = SECTIONS.filter(([k]) => buckets[k].length);
let out = head;
out +=
  "// ------------------------------------------------------------------\n";
out +=
  "// MỤC LỤC (tự tạo bởi sort-movies.js mỗi lần lưu - ĐỪNG sửa tay phần này)\n";
used.forEach(([k, label], n) => {
  out += `//   ${n + 1}. ${label.padEnd(40)} (${buckets[k].length} phim)\n`;
});
out += '// Trong mỗi nhóm: A-Z theo tên (phim nhiều phần dùng "group"),\n';
out += "// các phần cùng 1 phim nằm sát nhau, giữ nguyên thứ tự bạn đã viết.\n";
out +=
  "// Thêm phim mới: dán 1 khối {...} vào bất kỳ đâu trong mảng rồi Ctrl+S.\n";
out +=
  "// ------------------------------------------------------------------\n";
out += MARKER + "\n";

used.forEach(([k, label], n) => {
  const arr = buckets[k]
    .slice()
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b), "vi") || a.i - b.i);
  out += `\n  // ==================== ${n + 1}. ${label} (${arr.length}) ====================\n`;
  arr.forEach((it) => {
    if (slugCount[it.obj.slug] > 1)
      out +=
        "  // ⚠ TRÙNG SLUG với phim khác trong danh sách - cần sửa slug cho đúng\n";
    if (k === "OTHER")
      out += "  // ⚠ Chưa nhận ra quốc gia từ genres (kiểm tra chính tả)\n";
    out += "  {\n" + it.lines.join("\n") + "\n  },\n";
  });
});
out += "];" + tail;

if (out !== src) {
  fs.writeFileSync(file, out, "utf8");
  console.log(`✔ Đã sắp xếp ${items.length} phim -> ${path.basename(file)}`);
} else {
  console.log(`= Đã đúng thứ tự (${items.length} phim), không đổi gì.`);
}
