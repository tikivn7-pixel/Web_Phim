#!/usr/bin/env node
/**
 * sort-parts.js - sap xep lai cac phan (season) trong CUNG 1 nhom theo thu tu 1, 2, 3, 4...
 *
 *   node sort-parts.js data.js            -> DRY-RUN: chi in nhom nao se doi thu tu
 *   node sort-parts.js data.js --write    -> ghi that (tu tao backup data.js.sortparts.bak)
 *
 * - Chi hoan doi cac phim co CUNG `group` voi nhau. Cac phim khac giu nguyen vi tri,
 *   nen thu tu trang chu / danh sach moi nhat khong bi anh huong.
 *   (Chay auto-group.js truoc de phim co `group`.)
 * - Thu tu: so mua (Season N / Phan N / Part N / "2nd Season" / so cuoi title / II, III, IV)
 *           -> nam (year) -> title (so tu nhien).  Khong co so mua = mua 1.
 */
const fs = require("fs");

const args = process.argv.slice(2);
const FILE = args.find((a) => !a.startsWith("--")) || require("path").join(__dirname, "../Backend/catalog-source.js");
const WRITE = args.includes("--write");
require("./catalog-auto-export").autoExport(FILE);

const strip = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const ROMAN = {
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

function seasonNum(title) {
  const t = strip(title);
  let m = t.match(/(?:season|phan|mua|part|cour)\s*(\d+)/);
  if (m) return +m[1];
  m = t.match(/(\d+)(?:st|nd|rd|th)\s+season/);
  if (m) return +m[1];
  m = t.match(/\bs(\d+)\b/);
  if (m) return +m[1];
  const clean = t.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").trim();
  m = clean.match(/(?:^|\s)(\d+)\s*$/);
  if (m && clean.split(/\s+/).length > 1) return +m[1];
  m = clean.match(/\s(ii|iii|iv|v|vi|vii|viii|ix|x)\s*$/);
  if (m) return ROMAN[m[1]];
  return 1;
}

const natural = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

// ---------- doc file ----------
const raw = fs.readFileSync(FILE, "utf8");
const EOL = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(/\r?\n/);
const indentOf = (l) => l.match(/^\s*/)[0];

const items = [];
for (let i = 0; i < lines.length; i++) {
  const tm = lines[i].match(
    /^(\s*)title\s*:\s*(["'`])((?:\\.|(?!\2)[^\\])*)\2/,
  );
  if (!tm) continue;
  const ind = tm[1].length;
  let start = -1;
  for (let j = i - 1; j >= 0 && j >= i - 8; j--) {
    const t = lines[j].trim();
    if (t === "{" && indentOf(lines[j]).length < ind) {
      start = j;
      break;
    }
    if (/^\},?$/.test(t)) break;
  }
  if (start < 0) continue;
  let end = -1;
  for (let k = i + 1; k < lines.length; k++) {
    if (/^\},?$/.test(lines[k].trim()) && indentOf(lines[k]).length < ind) {
      end = k;
      break;
    }
    if (/^\s*title\s*:/.test(lines[k]) && indentOf(lines[k]).length === ind)
      break;
  }
  if (end < 0) continue;
  const it = { start, end, fields: {} };
  try {
    it.title = tm[2] === '"' ? JSON.parse('"' + tm[3] + '"') : tm[3];
  } catch {
    it.title = tm[3];
  }
  for (let k = start + 1; k < end; k++) {
    const fm = lines[k].match(
      /^(\s*)(\w+)\s*:\s*(?:(["'`])((?:\\.|(?!\3)[^\\])*)\3|(-?\d+(?:\.\d+)?))?/,
    );
    if (fm && fm[1].length === ind)
      it.fields[fm[2]] =
        fm[4] !== undefined ? fm[4] : fm[5] !== undefined ? +fm[5] : true;
  }
  items.push(it);
}
if (!items.length) {
  console.log("Khong doc duoc phim nao.");
  process.exit(1);
}
// bo qua object chong lan (an toan)
items.sort((a, b) => a.start - b.start);
for (let i = 1; i < items.length; i++) {
  if (items[i].start <= items[i - 1].end) {
    console.log(
      `Object chong lan quanh dong ${items[i].start + 1}, dung de an toan.`,
    );
    process.exit(1);
  }
}

// ---------- gom theo group ----------
const byGroup = new Map();
for (const it of items) {
  const g = typeof it.fields.group === "string" ? it.fields.group : null;
  if (!g) continue;
  if (!byGroup.has(g)) byGroup.set(g, []);
  byGroup.get(g).push(it);
}

const assign = new Map(); // slot item -> item se dat vao
let changed = 0;
const report = [];
for (const [g, list] of byGroup) {
  if (list.length < 2) continue;
  const sorted = [...list].sort((a, b) => {
    const sa = seasonNum(a.title),
      sb = seasonNum(b.title);
    if (sa !== sb) return sa - sb;
    const ya = typeof a.fields.year === "number" ? a.fields.year : 0;
    const yb = typeof b.fields.year === "number" ? b.fields.year : 0;
    if (ya !== yb) return ya - yb;
    return natural(a.title, b.title);
  });
  const same = sorted.every((it, i) => it === list[i]);
  list.forEach((slot, i) => assign.set(slot, sorted[i]));
  if (!same) {
    changed++;
    report.push(
      `[${g}]\n   truoc: ${list.map((x) => x.title).join("  |  ")}\n   sau:   ${sorted.map((x) => x.title).join("  |  ")}`,
    );
  }
}

console.log(`File: ${FILE}`);
console.log(
  `Tong so phim: ${items.length} | So nhom: ${byGroup.size} | Nhom se doi thu tu: ${changed}\n`,
);
report.forEach((r) => console.log(r + "\n"));

if (!WRITE) {
  console.log(
    "(DRY-RUN) Chua sua gi ca. Ok thi chay: node sort-parts.js " +
      FILE +
      " --write",
  );
  process.exit(0);
}
if (!changed) {
  console.log("Khong co gi de sap xep.");
  process.exit(0);
}

// ---------- ghi: giu nguyen khoang giua cac object, chi doi noi dung khoi ----------
const out = [];
let pos = 0;
for (const slot of items) {
  out.push(...lines.slice(pos, slot.start));
  const src = assign.get(slot) || slot;
  const block = lines.slice(src.start, src.end + 1);
  const slotComma = /,\s*$/.test(lines[slot.end]);
  const last = block.length - 1;
  block[last] = block[last].replace(/,\s*$/, "") + (slotComma ? "," : "");
  out.push(...block);
  pos = slot.end + 1;
}
out.push(...lines.slice(pos));

const bak = FILE + ".sortparts.bak";
fs.copyFileSync(FILE, bak);
fs.writeFileSync(FILE, out.join(EOL), "utf8");
console.log(`Da ghi ${FILE} (backup: ${bak})`);
