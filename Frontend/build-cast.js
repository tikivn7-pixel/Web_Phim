// Tạo / cập nhật cast-data.js (diễn viên + đạo diễn của mọi phim trong data.js)
//   node build-cast.js          -> chỉ lấy những phim còn thiếu (chạy lại nhiều lần được)
//   node build-cast.js --all    -> lấy lại toàn bộ từ đầu
// Cần Node 18+ (có sẵn fetch). Chạy lại khi thêm phim mới vào data.js.
const fs = require("fs");
const vm = require("vm");
const CAST_FILE = require("path").join(__dirname, "cast-data.js");

const FORCE_ALL = process.argv.includes("--all");
const CONCURRENCY = 3;
const RETRIES = 3;

// 1. Đọc danh sách phim từ data.js
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(require("path").join(__dirname, "../Backend/catalog-source.js"), "utf8") +
    "\n;this.__list = typeof fallbackMoviesList !== 'undefined' ? fallbackMoviesList : null;",
  ctx,
);
const movies = ctx.__list;
if (!Array.isArray(movies)) {
  console.error("Không đọc được fallbackMoviesList từ data.js");
  process.exit(1);
}
const slugs = [...new Set(movies.map((m) => m.slug).filter(Boolean))];

// 2. Giữ lại kết quả cũ trong cast-data.js (để lần sau chỉ bù phần thiếu)
let result = {};
if (!FORCE_ALL && fs.existsSync(CAST_FILE)) {
  try {
    const old = { window: {} };
    vm.createContext(old);
    vm.runInContext(fs.readFileSync(CAST_FILE, "utf8"), old);
    result = old.window.movieCastIndex || {};
  } catch (e) {
    console.warn("Không đọc được cast-data.js cũ, làm lại từ đầu");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const names = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((a) => (typeof a === "string" ? a : a && a.name))
    .filter((n) => n && n.toLowerCase() !== "đang cập nhật");

async function fetchJson(url) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return { notFound: true };
      if (!res.ok) throw new Error("HTTP " + res.status);
      return { data: await res.json() };
    } catch (e) {
      if (attempt === RETRIES) return { error: e.message };
      await sleep(600 * attempt);
    }
  }
}

// Trả về { cast, director } nếu hỏi được (kể cả rỗng), null nếu lỗi mạng
async function getCast(slug) {
  const kk = await fetchJson(
    `https://phimapi.com/phim/${encodeURIComponent(slug)}`,
  );
  if (kk.data && kk.data.movie) {
    const m = kk.data.movie;
    const cast = names(m.actor).join(", ");
    const director = names(m.director).join(", ");
    if (cast || director) return { cast, director };
  }
  // kkphim không có / thiếu -> thử nguonc
  const ng = await fetchJson(
    `https://phim.nguonc.com/api/film/${encodeURIComponent(slug)}`,
  );
  if (ng.data && ng.data.movie) {
    const m = ng.data.movie;
    return { cast: m.casts || "", director: m.director || "" };
  }
  if (kk.error && ng.error) return null; // lỗi mạng cả hai -> để lần sau thử lại
  return { cast: "", director: "" }; // phim không có thông tin diễn viên
}

async function main() {
  const todo = slugs.filter((s) => !(s in result));
  console.log(`Tổng ${slugs.length} phim, cần lấy ${todo.length} phim`);
  const failed = [];
  let done = 0;
  const queue = [...todo];

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const slug = queue.shift();
      const info = await getCast(slug);
      if (info) result[slug] = info;
      else failed.push(slug);
      done++;
      if (done % 20 === 0) console.log(`${done}/${todo.length}`);
      await sleep(150);
    }
  });
  await Promise.all(workers);

  fs.writeFileSync(
    CAST_FILE,
    "// File tự sinh bởi build-cast.js\nwindow.movieCastIndex = " +
      JSON.stringify(result, null, 1) +
      ";\n",
  );

  const withCast = Object.values(result).filter((v) => v.cast).length;
  console.log(
    `Xong. ${withCast}/${slugs.length} phim có diễn viên -> cast-data.js`,
  );
  if (failed.length) {
    console.log(
      `\n${failed.length} phim bị lỗi mạng, chạy lại "node build-cast.js" để bù:`,
    );
    failed.forEach((s) => console.log("  - " + s));
  }
  const noCast = slugs.filter((s) => result[s] && !result[s].cast);
  if (noCast.length) {
    console.log(
      `\n${noCast.length} phim nguồn không có tên diễn viên (có thể tự thêm cast vào data.js).`,
    );
  }
}
main().then(() => require("./build-catalog").buildCatalog()).catch(err => { console.error(err.message); process.exitCode = 1; });
//node build-cast.js --all
