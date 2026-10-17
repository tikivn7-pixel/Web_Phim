// ==========================================
// BOT THÊM PHIM VÀO data.js BẰNG TỪ KHÓA (giống ô tìm kiếm của kkphim.com)
// ==========================================
// Đặt file này CÙNG THƯ MỤC với data.js (và sort-movies.js nếu có), rồi chạy:
//
//   node add-movie.js "spider man"            # tìm -> hiện danh sách -> gõ số để chọn
//   node add-movie.js "spider man" --first    # tự lấy kết quả đầu tiên
//   node add-movie.js "spider man" --all      # thêm TẤT CẢ kết quả tìm được
//   node add-movie.js "spider man" --pick=1,3 # thêm kết quả số 1 và số 3 (không hỏi)
//   node add-movie.js "spider man" --vi       # đặt tên phim bằng tên tiếng Việt (mặc định dùng tên gốc/tiếng Anh như phim cũ)
//   node add-movie.js "spider man" --group=spdm   # gán group (phim nhiều phần), partName = tên phim
//   node add-movie.js "spider man" --desc     # dùng nội dung mô tả thật của phim (mặc định desc = tên phim)
//   node add-movie.js "spider man" --country="Hàn Quốc"   # chỉ hiện phim của quốc gia đó (gõ không dấu cũng được: --country=han)
//   node add-movie.js "spider man" --dry      # chỉ xem thử, không ghi vào data.js
//   node add-movie.js "fate" --pages=10      # lấy tối đa 10 trang kết quả (mặc định 5); thêm --debug để xem API báo tổng bao nhiêu phim
//   node add-movie.js "fate" --starts         # chỉ giữ phim có tên BẮT ĐẦU bằng từ khóa (lọc bớt phim chỉ tình cờ chứa chữ "fate")
//   node add-movie.js "fate" --year=2010-2020 # chỉ giữ phim trong khoảng năm (hoặc --year=2019)
//   node add-movie.js "bleach" --group="Bleach" --part="TV Series"   # gán group + tự đặt partName (--part chỉ có tác dụng khi có group)
//   node add-movie.js "spider man" --nosort   # không sắp xếp theo năm (mặc định: năm tăng dần)
//
// THÊM CẢ QUỐC GIA (không cần từ khóa):
//   node add-movie.js --country                # hiện MENU quốc gia -> gõ số để chọn (vd Nhật Bản) -> thêm tất cả phim nước đó
//   node add-movie.js --country=nhat           # thêm TẤT CẢ phim Nhật Bản luôn, khỏi menu (gõ không dấu cũng được)
//   node add-movie.js --country=nhat --dry --max=5   # chạy thử 5 phim đầu, chưa ghi data.js
//   node add-movie.js --country=han --max=200 --yes  # lấy 200 phim Hàn mới nhất, khỏi hỏi xác nhận
//   (thêm --from=2014 để chỉ lấy phim từ năm 2014 trở lên, --to=2020 để đến năm 2020, --year=2020-2026 để lọc khoảng năm, --pages=N để giới hạn số trang, --concurrency=N số request song song (mặc định 2), --delay=ms nghỉ giữa các request (mặc định 200))
//
// XÓA phim thêm nhầm:
//   node add-movie.js --undo                  # xóa những phim của LẦN CHẠY GẦN NHẤT (có hỏi xác nhận)
//   node add-movie.js --remove "spider man"   # tìm phim trong data.js theo tên/slug -> chọn số để xóa
//   (thêm --yes để khỏi hỏi xác nhận; xóa nào cũng có sao lưu data.js.bak)
//
// Bot lấy tên, slug, số tập, thể loại, quốc gia, mô tả, poster từ phimapi.com
// (cùng nguồn với kkphim.com), dán thêm 1 khối {...} vào fallbackMoviesList trong data.js,
// bỏ qua phim đã có (trùng slug), rồi tự chạy sort-movies.js (nếu có) để xếp lại cho gọn.
// Trước khi ghi, file cũ được sao lưu thành data.js.bak.

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execFileSync } = require("child_process");

const API = "https://phimapi.com";
const COUNTRY_MAP = { "Âu Mỹ": "Mỹ" }; // tên quốc gia của nguồn -> tên trong menu web

// ---------- Đọc tham số ----------
const argv = process.argv.slice(2);
const flags = {};
const words = [];
argv.forEach((a) => {
  if (a.startsWith("--")) {
    const [k, v] = a.slice(2).split("=");
    flags[k] = v === undefined ? true : v;
  } else words.push(a);
});
const keyword = words.join(" ").trim();
const DATA_FILE = path.resolve(flags.file || path.join(__dirname, "data.js"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Gặp 429 (gọi quá nhanh) / lỗi 5xx / rớt mạng thì tự chờ rồi thử lại (chờ lâu dần: 1s, 2s, 4s... tối đa 30s)
async function getJSON(url, tries = 6) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": "LauPhim-add-movie/1.0" },
      });
    } catch (e) {
      if (attempt < tries) {
        await sleep(Math.min(30000, 1000 * 2 ** attempt));
        continue;
      }
      throw new Error(`${e.message} - ${url}`);
    }
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < tries) {
      const ra = Number(res.headers && res.headers.get("retry-after")) * 1000;
      await sleep(
        ra > 0
          ? ra
          : Math.min(30000, 1000 * 2 ** attempt) + Math.random() * 500,
      );
      continue;
    }
    throw new Error(`HTTP ${res.status} - ${url}`);
  }
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const q = (s) => JSON.stringify(String(s == null ? "" : s)); // chuỗi JS an toàn (tự escape dấu ")

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    }),
  );
}

// "Abc (Season 2)" / "Abc Phần 2" / "Abc Part 2" -> { group: "Abc", partName: "Abc 2" }
function detectPart(title) {
  const m = String(title).match(
    /^(.*?)[\s\-:]*\(?\s*(?:Season|Phần|Part|Mùa)\s*(\d+)\s*\)?\s*$/i,
  );
  if (!m || !m[1].trim()) return null;
  return { group: m[1].trim(), partName: `${m[1].trim()} ${m[2]}` };
}

// Tạo khối phim đúng form các phim cũ trong data.js:
//   title, slug, episodes, genres, poster, banner, desc, [group, partName]
async function buildBlock(detail) {
  const m = detail.movie;
  const servers = detail.episodes || [];
  const epCount = servers.reduce(
    (mx, s) => Math.max(mx, (s.server_data || []).length),
    0,
  );
  const countries = (m.country || []).map((c) => COUNTRY_MAP[c.name] || c.name);
  // Quốc gia để CUỐI genres, giống các phim cũ ("Tình Cảm, Chính Kịch, Hàn Quốc")
  const genres = [...(m.category || []).map((c) => c.name), ...countries]
    .filter(Boolean)
    .join(", ");
  // Mặc định tên gốc (tiếng Anh) giống phim cũ; --vi để dùng tên tiếng Việt
  const title = flags.vi ? m.name : m.origin_name || m.name;

  // Poster / banner dùng thẳng link ảnh từ API (không cần tải ảnh về thư mục Img/)
  const poster = m.poster_url || m.thumb_url || "";
  const banner = m.thumb_url || m.poster_url || "";

  const part = detectPart(title);
  const group =
    typeof flags.group === "string" ? flags.group : part && part.group;
  // --part="TV Series" để tự đặt partName (mặc định: = tên phim khi có --group, hoặc "Tên 2" khi tên có Season/Phần/Part N)
  const partName =
    typeof flags.part === "string"
      ? flags.part
      : typeof flags.group === "string"
        ? title
        : part && part.partName;

  const lines = [
    `    title: ${q(title)},`,
    `    slug: ${q(m.slug)},`,
    `    episodes: ${epCount || Number(m.episode_total) || 1},`,
    `    genres: ${q(genres)},`,
    `    poster: ${q(poster)},`,
    `    banner: ${q(banner)},`,
    `    desc: ${q(flags.desc ? stripHtml(m.content) || title : title)},`,
  ];
  if (group) {
    lines.push(`    group: ${q(group)},`);
    lines.push(`    partName: ${q(partName)},`);
  }
  return { slug: m.slug, title, text: "  {\n" + lines.join("\n") + "\n  },\n" };
}

// ---------- LẤY CẢ QUỐC GIA (không cần từ khóa) ----------
// Tìm slug quốc gia ("nhat" -> "nhat-ban") rồi quét hết các trang /v1/api/quoc-gia/<slug>
async function fetchByCountry(input, maxPages, limit) {
  const want = input === true ? "" : norm(input).trim();
  let slug = null;
  let label = input === true ? "" : input;
  try {
    const raw = await getJSON(`${API}/quoc-gia`);
    const list = Array.isArray(raw)
      ? raw
      : (raw && raw.data && raw.data.items) || (raw && raw.items) || [];
    let hit;
    if (input === true) {
      // --country không kèm giá trị -> hiện menu để chọn
      if (list.length === 0)
        throw new Error("không lấy được danh sách quốc gia");
      console.log("\nChọn quốc gia:");
      list.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}`));
      const ans = await ask("\nGõ số quốc gia (Enter = thoát): ");
      if (!ans) {
        console.log("Đã hủy.");
        return null;
      }
      hit = list[Number(ans) - 1];
    } else {
      hit =
        list.find((c) => norm(c.name) === want || norm(c.slug) === want) ||
        list.find(
          (c) => norm(c.name).includes(want) || norm(c.slug).includes(want),
        );
    }
    if (!hit) {
      console.log(
        `Không tìm thấy quốc gia "${input}". Các quốc gia có trên nguồn:`,
      );
      console.log("  " + list.map((c) => `${c.name} (${c.slug})`).join(", "));
      return null;
    }
    slug = hit.slug;
    label = hit.name;
  } catch (e) {
    if (input === true) {
      console.log("Không lấy được danh sách quốc gia: " + e.message);
      return null;
    }
    slug = String(input); // không lấy được danh sách -> coi như user gõ đúng slug (vd nhat-ban)
  }
  console.log(`Quốc gia: ${label} (slug: ${slug})`);

  const out = [];
  const seenC = new Set();
  for (let page = 1; page <= maxPages; page++) {
    let data;
    try {
      data = await getJSON(
        `${API}/v1/api/quoc-gia/${encodeURIComponent(slug)}?page=${page}&limit=${limit}`,
      );
    } catch (e) {
      console.log(
        `\n⚠ Lỗi ở trang ${page}: ${e.message} (dừng, dùng những gì đã lấy được)`,
      );
      break;
    }
    const d = data.data || {};
    const pageItems = d.items || [];
    const pg = d.params && d.params.pagination;
    for (const it of pageItems) {
      if (it && it.slug && !seenC.has(it.slug)) {
        seenC.add(it.slug);
        out.push(it);
      }
    }
    process.stdout.write(
      `\rĐang lấy danh sách: trang ${page}/${pg && pg.totalPages != null ? pg.totalPages : "?"} (${out.length} phim)   `,
    );
    if (pageItems.length === 0) break;
    if (pg && pg.totalPages != null && page >= pg.totalPages) break;
  }
  console.log();
  return { items: out, label, slug };
}

// ---------- XÓA PHIM ----------
const LOG_FILE = path.join(path.dirname(DATA_FILE), ".add-movie-last.json"); // nhớ phim của lần chạy gần nhất

// Bỏ dấu + chữ thường để tìm "tri lieu" ra "Trị Liệu"
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[-_]+/g, " ")
    .toLowerCase();

// Liệt kê các khối phim { ... } trong mảng fallbackMoviesList kèm vị trí để cắt
function listBlocks(src) {
  const markerPos = src.indexOf("const fallbackMoviesList = [");
  if (markerPos === -1)
    throw new Error("Không thấy 'const fallbackMoviesList = [' trong data.js");
  const endPos = src.indexOf("\n];", markerPos);
  const out = [];
  const re = /\n  \{\n[\s\S]*?\n  \},?(?=\n)/g;
  re.lastIndex = markerPos;
  let m;
  while ((m = re.exec(src)) && m.index < endPos) {
    const text = m[0];
    const grab = (k) =>
      (
        (text.match(new RegExp(`^\\s*${k}:\\s*(["'])(.*?)\\1,?\\s*$`, "m")) ||
          [])[2] || ""
      ).replace(/\\"/g, '"');
    out.push({
      start: m.index,
      end: m.index + text.length,
      title: grab("title"),
      slug: grab("slug"),
    });
  }
  return out;
}

// Xóa các khối đã chọn (cắt từ cuối lên đầu để vị trí không bị lệch)
function cutBlocks(src, blocks) {
  [...blocks]
    .sort((a, b) => b.start - a.start)
    .forEach((b) => {
      src = src.slice(0, b.start) + src.slice(b.end);
    });
  return src;
}

async function removeMode() {
  if (!fs.existsSync(DATA_FILE))
    throw new Error("Không thấy file " + DATA_FILE);
  let src = fs.readFileSync(DATA_FILE, "utf8");
  const all = listBlocks(src);
  let targets;

  if (flags.undo) {
    if (!fs.existsSync(LOG_FILE))
      return console.log(
        'Chưa có lần chạy nào để hoàn tác (hoặc đã hoàn tác rồi). Dùng --remove "tên phim" để xóa theo tên.',
      );
    const slugs = JSON.parse(fs.readFileSync(LOG_FILE, "utf8")).slugs || [];
    targets = all.filter((b) => slugs.includes(b.slug));
    if (targets.length === 0) {
      fs.unlinkSync(LOG_FILE);
      return console.log(
        "Các phim của lần chạy trước không còn trong data.js.",
      );
    }
  } else {
    if (!keyword)
      return console.log('Gõ: node add-movie.js --remove "tên hoặc slug phim"');
    const k = norm(keyword);
    const found = all.filter(
      (b) => norm(b.title).includes(k) || norm(b.slug).includes(k),
    );
    if (found.length === 0)
      return console.log(`Không có phim nào trong data.js khớp "${keyword}".`);
    console.log(`\nTrong data.js có ${found.length} phim khớp "${keyword}":`);
    found.forEach((b, i) => console.log(`  ${i + 1}. ${b.title}  (${b.slug})`));
    const ans =
      flags.yes && found.length === 1
        ? "1"
        : await ask(
            "\nGõ số phim muốn XÓA (vd 1 hoặc 1,3 ; all = tất cả ; Enter = thoát): ",
          );
    if (!ans) return console.log("Đã hủy, không xóa gì.");
    targets = /^all$/i.test(ans)
      ? found
      : ans
          .split(/[,\s]+/)
          .map((n) => found[Number(n) - 1])
          .filter(Boolean);
    if (targets.length === 0) return console.log("Không chọn được phim nào.");
  }

  console.log("\nSẽ XÓA khỏi data.js:");
  targets.forEach((b) => console.log(`  - ${b.title} (${b.slug})`));
  if (!flags.yes) {
    const ok = await ask("Chắc chắn xóa? (gõ y để đồng ý): ");
    if (!/^y(es)?$/i.test(ok)) return console.log("Đã hủy, không xóa gì.");
  }

  fs.copyFileSync(DATA_FILE, DATA_FILE + ".bak");
  fs.writeFileSync(DATA_FILE, cutBlocks(src, targets), "utf8");
  if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
  console.log(
    `\n✔ Đã xóa ${targets.length} phim (bản trước khi xóa: ${path.basename(DATA_FILE)}.bak)`,
  );

  const sorter = path.join(path.dirname(DATA_FILE), "sort-movies.js");
  if (fs.existsSync(sorter)) {
    try {
      console.log(
        execFileSync(process.execPath, [sorter, DATA_FILE], {
          encoding: "utf8",
        }).trim(),
      );
    } catch (e) {}
  }
}

(async () => {
  if (flags.undo || flags.remove) return removeMode();
  // Chỉ có --country mà không có từ khóa -> chế độ thêm cả quốc gia
  const countryOnly = !keyword && flags.country !== undefined;
  if (!keyword && !countryOnly) {
    console.log(
      'Cách dùng: node add-movie.js "từ khóa" [--first | --all | --pick=1,2] [--country=...] [--vi] [--group=...] [--desc] [--dry]\n' +
        "      hoặc: node add-movie.js --country=nhat   (thêm tất cả phim của 1 quốc gia)",
    );
    process.exit(1);
  }
  if (!fs.existsSync(DATA_FILE)) {
    console.error(
      "Không thấy file " +
        DATA_FILE +
        " - hãy đặt add-movie.js cùng thư mục với data.js",
    );
    process.exit(1);
  }

  // 1) Tìm kiếm (giống ô tìm kiếm trên kkphim.com)
  // Lấy NHIỀU TRANG (API mỗi trang trả ít phim; trước đây chỉ lấy trang 1 nên bị thiếu). Mặc định tối đa 5 trang, đổi bằng --pages=10
  const limit = flags.limit || (flags.country ? 40 : 24);
  const maxPages = Number(flags.pages) || 5;
  let items = [];
  const seen = new Set();
  let apiTotal = 0;

  // Tìm bằng nhiều biến thể từ khóa để ra đủ như ô search (gộp, bỏ trùng slug)
  const base = norm(keyword);
  const variants = [
    ...new Set([keyword, base, base.replace(/\s+/g, "-")]),
  ].filter(Boolean);

  let pickedCountry = null; // quốc gia đã chọn (để kiểm tra lại với dữ liệu chi tiết từng phim)
  if (countryOnly) {
    const got = await fetchByCountry(
      flags.country,
      flags.pages ? Number(flags.pages) : Infinity, // không --pages = quét hết mọi trang
      Number(flags.limit) || 40,
    );
    if (!got) return;
    items = got.items;
    pickedCountry = { label: got.label, slug: got.slug };
  }

  for (const kw of countryOnly ? [] : variants) {
    for (let page = 1; page <= maxPages; page++) {
      const url = `${API}/v1/api/tim-kiem?keyword=${encodeURIComponent(kw)}&page=${page}&limit=${limit}`;
      let data;
      try {
        data = await getJSON(url);
      } catch (e) {
        break; // biến thể này lỗi thì qua biến thể khác
      }
      const pageItems = (data.data && data.data.items) || [];
      const pg = data.data && data.data.params && data.data.params.pagination;
      if (pg && pg.totalItems != null && page === 1) apiTotal += pg.totalItems;
      let added = 0;
      for (const it of pageItems) {
        if (it && it.slug && !seen.has(it.slug)) {
          seen.add(it.slug);
          items.push(it);
          added++;
        }
      }
      if (pageItems.length === 0) break;
      if (pg && pg.totalPages != null && page >= pg.totalPages) break;
    }
  }
  if (flags.debug)
    console.log(
      `[debug] ${variants.length} biến thể ${JSON.stringify(variants)} -> gộp được ${items.length} phim (API báo cộng dồn: ${apiTotal})`,
    );
  const countryOf = (it) =>
    (it.country || []).map((c) => COUNTRY_MAP[c.name] || c.name);

  // --country: chỉ giữ phim của quốc gia được chọn (so khớp không dấu, gõ một phần cũng được)
  if (typeof flags.country === "string" && !countryOnly) {
    const want = norm(flags.country);
    items = items.filter((it) =>
      countryOf(it).some((c) => norm(c).includes(want)),
    );
    if (items.length === 0) {
      console.log(
        `Không có phim "${keyword}" nào của quốc gia "${flags.country}". Thử bỏ --country để xem tất cả.`,
      );
      return;
    }
  }
  // --starts: chỉ giữ phim có tên (gốc hoặc tiếng Việt) BẮT ĐẦU bằng từ khóa -> bỏ các phim chỉ tình cờ chứa chữ đó
  if (flags.starts) {
    const k = norm(keyword);
    items = items.filter(
      (it) => norm(it.origin_name).startsWith(k) || norm(it.name).startsWith(k),
    );
  }
  // --year=2019 hoặc --year=2010-2020: chỉ giữ phim trong khoảng năm
  // --from=2014 (từ 2014 trở lên) / --to=2020 (đến 2020) / --year=2014- (từ 2014 trở lên) / --year=2014 (đúng 2014)
  if (typeof flags.year === "string" || flags.from || flags.to) {
    let lo = -Infinity,
      hi = Infinity;
    if (typeof flags.year === "string") {
      const [a, b] = flags.year.split("-");
      lo = a === "" ? -Infinity : Number(a);
      hi = b === undefined ? Number(a) : b === "" ? Infinity : Number(b);
    }
    if (flags.from && flags.from !== true) lo = Number(flags.from);
    if (flags.to && flags.to !== true) hi = Number(flags.to);
    items = items.filter(
      (it) => Number(it.year) >= lo && Number(it.year) <= hi,
    );
  }
  if (items.length === 0) {
    console.log(`Không tìm thấy phim nào với từ khóa "${keyword}".`);
    return;
  }

  // --max=N: chỉ lấy N phim đầu (nguồn trả phim mới cập nhật trước) - hữu ích để chạy thử
  if (Number(flags.max) > 0) items = items.slice(0, Number(flags.max));

  // Sắp xếp theo năm TĂNG DẦN (phim không rõ năm xuống cuối). Thêm --nosort nếu muốn giữ thứ tự gốc của nguồn.
  // Số thứ tự hiện ra bên dưới (và --pick / --first) tính theo danh sách ĐÃ sắp xếp.
  const yearOf = (it) => Number(it.year) || Infinity;
  const byYearAsc = (a, b) => yearOf(a) - yearOf(b);
  if (!flags.nosort) items = [...items].sort(byYearAsc); // sort ổn định: cùng năm giữ nguyên thứ tự cũ

  console.log(
    `\nTìm thấy ${items.length} phim ${countryOnly ? `của "${pickedCountry.label}"` : `cho "${keyword}"`}:`,
  );
  const showList =
    countryOnly && items.length > 50 ? items.slice(0, 10) : items;
  showList.forEach((it, i) => {
    const country = countryOf(it).join(", ");
    console.log(
      `  ${i + 1}. ${it.name}  (${it.origin_name || ""}) - ${it.year || "?"} - ${country} - ${it.episode_current || ""}`,
    );
  });
  if (showList.length < items.length)
    console.log(`  ... và ${items.length - showList.length} phim nữa`);

  // 2) Chọn phim
  let chosen;
  if (countryOnly && !flags.yes && !flags.dry) {
    const ok = await ask(
      `\nThêm TẤT CẢ ${items.length} phim này vào data.js (phim trùng slug sẽ bỏ qua)? (gõ y để đồng ý): `,
    );
    if (!/^y(es)?$/i.test(ok)) return console.log("Đã hủy.");
  }
  if (flags.all || countryOnly) chosen = items;
  else if (flags.first) chosen = [items[0]];
  else if (typeof flags.pick === "string")
    chosen = flags.pick
      .split(",")
      .map((n) => items[Number(n) - 1])
      .filter(Boolean);
  else {
    const ans = await ask(
      "\nGõ số phim muốn thêm (vd 1 hoặc 1,3 ; gõ all = tất cả ; Enter = thoát): ",
    );
    if (!ans) return console.log("Đã hủy.");
    chosen = /^all$/i.test(ans)
      ? items
      : ans
          .split(/[,\s]+/)
          .map((n) => items[Number(n) - 1])
          .filter(Boolean);
  }
  if (chosen.length === 0) return console.log("Không chọn được phim nào.");
  if (!flags.nosort) chosen = [...chosen].sort(byYearAsc); // phim thêm vào data.js cũng theo năm tăng dần

  // 3) Dựng khối phim, bỏ qua phim đã có trong data.js (lấy chi tiết song song cho nhanh)
  let src = fs.readFileSync(DATA_FILE, "utf8");
  const have = new Set(
    [...src.matchAll(/slug:\s*["']([^"']+)["']/g)].map((m) => m[1]),
  );
  const CONC = Math.max(1, Number(flags.concurrency) || 2); // mặc định 2 để khỏi bị 429
  const DELAY = flags.delay !== undefined ? Number(flags.delay) : 200; // nghỉ giữa các request (ms)
  const results = new Array(chosen.length);
  let cursor = 0;
  let skipped = 0;
  let failed = 0;
  let wrongCountry = 0;
  async function worker() {
    while (cursor < chosen.length) {
      const i = cursor++;
      const it = chosen[i];
      if (have.has(it.slug)) {
        skipped++;
        if (!countryOnly)
          console.log(
            `= Bỏ qua "${it.name}" (slug ${it.slug} đã có trong data.js)`,
          );
        continue;
      }
      try {
        if (DELAY > 0) await sleep(DELAY);
        const detail = await getJSON(
          `${API}/phim/${encodeURIComponent(it.slug)}`,
        );
        if (!detail.movie) throw new Error("không có dữ liệu chi tiết");
        // Kiểm tra lại: phim phải thật sự có quốc gia đã chọn (nếu nguồn có ghi quốc gia)
        if (pickedCountry) {
          const cs = detail.movie.country || [];
          const wn = norm(pickedCountry.label);
          const ws = norm(pickedCountry.slug);
          const okC =
            cs.length === 0 ||
            cs.some((c) => norm(c.name) === wn || norm(c.slug) === ws);
          if (!okC) {
            wrongCountry++;
            continue;
          }
        }
        const b = await buildBlock(detail);
        results[i] = b;
        console.log(`+ [${i + 1}/${chosen.length}] ${b.title} (${b.slug})`);
      } catch (err) {
        failed++;
        console.log(`✗ Lỗi với "${it.name}": ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  const blocks = results.filter(Boolean); // giữ đúng thứ tự năm đã sắp xếp
  if (countryOnly)
    console.log(
      `\nĐã có sẵn (bỏ qua): ${skipped} | Lỗi: ${failed} | Sai quốc gia (bỏ): ${wrongCountry} | Mới: ${blocks.length}`,
    );
  if (blocks.length === 0) return console.log("Không có phim mới nào để thêm.");
  if (flags.dry)
    return console.log(
      "\n[DRY] Chạy thử - chưa ghi gì vào data.js.\n\n" +
        blocks.map((b) => b.text).join(""),
    );

  // 4) Chèn vào cuối mảng fallbackMoviesList (trước dấu "];")
  const MARKER = "const fallbackMoviesList = [";
  const markerPos = src.indexOf(MARKER);
  if (markerPos === -1)
    throw new Error("Không thấy 'const fallbackMoviesList = [' trong data.js");
  const endPos = src.indexOf("\n];", markerPos);
  if (endPos === -1)
    throw new Error("Không thấy dấu '];' kết thúc mảng trong data.js");

  fs.copyFileSync(DATA_FILE, DATA_FILE + ".bak");
  const insertAt = endPos + 1; // ngay sau ký tự xuống dòng cuối cùng của phim trước
  src =
    src.slice(0, insertAt) +
    "\n  // ===== Thêm tự động bằng add-movie.js =====\n" +
    blocks.map((b) => b.text).join("") +
    src.slice(insertAt);
  fs.writeFileSync(DATA_FILE, src, "utf8");
  fs.writeFileSync(
    LOG_FILE,
    JSON.stringify({
      at: new Date().toISOString(),
      slugs: blocks.map((b) => b.slug),
    }),
    "utf8",
  ); // để --undo biết xóa gì
  console.log(
    `\n✔ Đã thêm ${blocks.length} phim vào ${path.basename(DATA_FILE)} (bản cũ: ${path.basename(DATA_FILE)}.bak) - thêm nhầm thì chạy: node add-movie.js --undo`,
  );

  // 5) Tự xếp lại bằng sort-movies.js nếu có
  const sorter = path.join(path.dirname(DATA_FILE), "sort-movies.js");
  if (fs.existsSync(sorter)) {
    try {
      console.log(
        execFileSync(process.execPath, [sorter, DATA_FILE], {
          encoding: "utf8",
        }).trim(),
      );
    } catch (err) {
      console.log(
        "⚠ Không chạy được sort-movies.js (phim vẫn đã được thêm):",
        (err.stdout || err.message).toString().trim(),
      );
    }
  }
})().catch((err) => {
  console.error("Lỗi:", err.message);
  process.exit(1);
});
