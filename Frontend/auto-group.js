#!/usr/bin/env node
/**
 * auto-group.js - tu dong them `desc` + `group` cho cac phim co title tuong dong.
 *
 * Cach dung (chay tu thu muc web_phim):
 *   node auto-group.js                      -> DRY-RUN: chi in ra danh sach nhom, KHONG sua file
 *   node auto-group.js --write              -> ghi that vao Frontend/data.js (tu tao file backup)
 *   node auto-group.js duong/dan/data.js    -> chi dinh file khac
 *
 * Tuy chon:
 *   --desc-all   them desc cho TAT CA phim thieu desc (mac dinh chi them cho phim thuoc 1 nhom)
 *   --strict     chi gom nhom khi trung tu 2 tu dau tro len (an toan hon, nhung se bo sot
 *                kieu "Fate/Zero" vs "Fate/strange Fake")
 *
 * Quy tac:
 *  - Bo qua phan mua: (Season 1), Season 2, Phan 2, Part 2, S2, 2nd Season, so cuoi...
 *  - Gom cac title co chung tu/cum tu dau (khong phan biet hoa thuong, dau tieng Viet)
 *  - group = cum tu chung o dau title (vd "Fate/Zero" + "Fate/strange Fake" -> "Fate")
 *  - Neu da co group san (vd "Fate"), phim moi co title bat dau bang nhom do se vao nhom do
 *  - desc = title (giong trong hinh)
 *  - partName = ten phan trong nhom (title bo ten nhom): "Fate/Zero (Season 1)" -> "Zero (Season 1)";
 *    title trung han ten nhom -> "Season 1"
 *  - Chi them khi chua co desc/group -> chay lai nhieu lan van an toan
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const FILE =
  args.find((a) => !a.startsWith("--")) || path.join(__dirname, "../Backend/catalog-source.js");
const WRITE = args.includes("--write");
require("./catalog-auto-export").autoExport(FILE);
const DESC_ALL = args.includes("--desc-all");
const STRICT = args.includes("--strict");

// Tu qua chung chung -> khong dung lam ten nhom khi chi trung 1 tu
const STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "no",
  "wa",
  "ga",
  "my",
  "his",
  "her",
  "love",
  "one",
  "new",
  "super",
  "great",
  "little",
  "last",
  "first",
  "dark",
  "black",
  "white",
  "red",
  "blue",
  "high",
  "school",
  "boy",
  "girl",
  "man",
  "woman",
  "life",
  "world",
  "story",
  "night",
  "day",
  "dragon",
  "king",
  "war",
  "hero",
  "lord",
]);
// Them tu vao day neu muon chan han 1 nhom nao do
const BLOCK = new Set([]);

const SEASON_WORDS = new Set([
  "season",
  "phan",
  "mua",
  "part",
  "cour",
  "tap",
  "chapter",
]);

const strip = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

function words(title) {
  const t = title.replace(/\([^)]*\)|\[[^\]]*\]/g, " ");
  const w = t.match(/[\p{L}\p{N}]+/gu) || [];
  const out = [];
  for (let i = 0; i < w.length; i++) {
    const n = strip(w[i]);
    const next = i + 1 < w.length ? strip(w[i + 1]) : "";
    if (SEASON_WORDS.has(n) && /^(\d+|[ivx]+)$/.test(next)) {
      i++;
      continue;
    }
    if (/^\d+(st|nd|rd|th)$/.test(n) && next === "season") {
      i++;
      continue;
    }
    if (/^s\d+$/.test(n)) continue;
    out.push({ raw: w[i], n });
  }
  while (
    out.length > 1 &&
    /^(ii|iii|iv|vi|vii|viii|ix|[2-9])$/.test(out[out.length - 1].n)
  )
    out.pop();
  return out;
}

// ---------- doc file ----------
const raw = fs.readFileSync(FILE, "utf8");
const EOL = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(/\r?\n/);

// ---------- tach tung object: tim theo dong `title:` ----------
// Khong dem ngoac toan file nua (code khac trong data.js lam lech). Voi moi dong title:
//   start = dong "{" gan nhat phia tren co thut le nho hon dong title
//   end   = dong "}" / "}," gan nhat phia duoi co thut le nho hon dong title
const indentOf = (l) => l.match(/^\s*/)[0];
const items = [];
let titleLines = 0;
for (let i = 0; i < lines.length; i++) {
  const tm = lines[i].match(
    /^(\s*)title\s*:\s*(["'`])((?:\\.|(?!\2)[^\\])*)\2/,
  );
  if (!tm) continue;
  titleLines++;
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
      break; // object loi
  }
  if (end < 0) continue;
  const it = { start, end, indent: tm[1], fields: {} };
  try {
    it.title = tm[2] === '"' ? JSON.parse('"' + tm[3] + '"') : tm[3];
  } catch {
    it.title = tm[3];
  }
  for (let k = start + 1; k < end; k++) {
    const fm = lines[k].match(
      /^(\s*)(\w+)\s*:\s*(?:(["'`])((?:\\.|(?!\3)[^\\])*)\3)?/,
    );
    if (fm && fm[1].length === ind)
      it.fields[fm[2]] = fm[4] !== undefined ? fm[4] : true;
  }
  items.push(it);
}

const movies = items.filter((it) => it.title);
if (!movies.length) {
  console.log(`Khong doc duoc phim nao. So dong co "title:" = ${titleLines}`);
  const sample = lines
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /title/.test(l))
    .slice(0, 3);
  sample.forEach(([n, l]) => console.log(`  dong ${n}: ${JSON.stringify(l)}`));
  console.log("Gui doan tren cho Claude de sua parser.");
  process.exit(1);
}
movies.forEach((it) => {
  it.w = words(it.title);
  it.hasDesc = "desc" in it.fields;
  it.hasGroup = "group" in it.fields;
  it.hasPart = "partName" in it.fields;
  it.group =
    it.hasGroup && typeof it.fields.group === "string" ? it.fields.group : null;
  it.newGroup = null;
});

// ---------- 1) dung nhom da co san lam "hat giong" ----------
const seeds = [...new Set(movies.filter((m) => m.group).map((m) => m.group))]
  .map((g) => ({ name: g, n: words(g).map((x) => x.n) }))
  .filter((s) => s.n.length)
  .sort((a, b) => b.n.length - a.n.length);

for (const m of movies) {
  if (m.hasGroup) continue;
  const mn = m.w.map((x) => x.n);
  const seed = seeds.find((s) => s.n.every((tok, i) => mn[i] === tok));
  if (seed) m.newGroup = seed.name;
}

// ---------- 2) gom cac phim con lai theo tu dau tien ----------
const buckets = new Map();
for (const m of movies) {
  if (m.hasGroup || m.newGroup || !m.w.length) continue;
  const k = m.w[0].n;
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push(m);
}

for (const [, list] of buckets) {
  if (list.length < 2) continue;
  let L = Math.min(...list.map((m) => m.w.length));
  for (let i = 0; i < L; i++) {
    if (!list.every((m) => m.w[i].n === list[0].w[i].n)) {
      L = i;
      break;
    }
  }
  if (L < 1) continue;
  const prefix = list[0].w.slice(0, L);
  const joined = prefix.map((x) => x.n).join(" ");
  if (BLOCK.has(joined)) continue;
  if (L === 1) {
    if (STRICT) continue;
    if (prefix[0].n.length < 4 || STOP.has(prefix[0].n)) continue;
  }
  const name = prefix.map((x) => x.raw).join(" ");
  list.forEach((m) => (m.newGroup = name));
}

// ten phan = phan con lai cua title sau khi bo ten nhom
//   "Fate/Zero (Season 1)" + nhom "Fate" -> "Zero (Season 1)"
//   "Attack on Titan Season 2" + nhom "Attack on Titan" -> "Season 2"
//   title trung hoan toan voi nhom -> "Season 1"
function partName(title, group) {
  const k = words(group).length;
  const toks = [...title.matchAll(/[\p{L}\p{N}]+/gu)];
  let rest =
    k > 0 && toks.length >= k
      ? title.slice(toks[k - 1].index + toks[k - 1][0].length)
      : "";
  rest = rest
    .replace(/^[\s\/:\-–—|·,.]+/, "")
    .replace(/[\s\/:\-–—|·,.]+$/, "")
    .trim();
  return rest || "Season 1";
}

// ---------- 3) chuan bi cac thay doi ----------
const plan = [];
for (const m of movies) {
  const grp = m.group || m.newGroup;
  const needDesc = !m.hasDesc && (grp || DESC_ALL);
  const needGroup = !m.hasGroup && m.newGroup;
  const needPart = !m.hasPart && grp;
  if (!needDesc && !needGroup && !needPart) continue;
  plan.push({
    m,
    needDesc,
    needGroup,
    needPart,
    grp,
    part: needPart ? partName(m.title, grp) : null,
  });
}

// ---------- bao cao ----------
const report = new Map();
for (const p of plan) {
  if (!p.grp) continue;
  if (!report.has(p.grp)) report.set(p.grp, []);
  report.get(p.grp).push(`${p.m.title}  ->  partName: ${p.part || "(da co)"}`);
}
console.log(`File: ${FILE}`);
console.log(`Tong so phim doc duoc: ${movies.length}`);
console.log(`Phim se duoc them desc/group: ${plan.length}`);
console.log(`So nhom: ${report.size}\n`);
for (const [g, titles] of [...report].sort((a, b) =>
  a[0].localeCompare(b[0]),
)) {
  console.log(`[${g}]`);
  titles.forEach((t) => console.log(`   - ${t}`));
}

if (!WRITE) {
  console.log(
    "\n(DRY-RUN) Chua sua gi ca. Xem lai danh sach tren, ok thi chay: node auto-group.js --write",
  );
  process.exit(0);
}
if (!plan.length) {
  console.log("\nKhong co gi de them.");
  process.exit(0);
}

// ---------- ap dung (duyet nguoc de khong lech so dong) ----------
plan.sort((a, b) => b.m.end - a.m.end);
for (const { m, needDesc, needGroup, needPart, grp, part } of plan) {
  let last = m.end - 1;
  while (last > m.start && lines[last].trim() === "") last--;
  if (!/,\s*$/.test(lines[last]))
    lines[last] = lines[last].replace(/\s*$/, ",");
  const add = [];
  if (needDesc) add.push(`${m.indent}desc: ${JSON.stringify(m.title)},`);
  if (needGroup) add.push(`${m.indent}group: ${JSON.stringify(grp)},`);
  if (needPart) add.push(`${m.indent}partName: ${JSON.stringify(part)},`);
  lines.splice(last + 1, 0, ...add);
}

const bak = FILE + ".autogroup.bak";
fs.copyFileSync(FILE, bak);
fs.writeFileSync(FILE, lines.join(EOL), "utf8");
console.log(`\nDa ghi ${FILE} (backup: ${bak})`);
