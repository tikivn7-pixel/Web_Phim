// ==========================================
// BOT TỰ ĐỘNG THÊM PHIM (lấy từ phimapi.com -> ghi vào MySQL)
// ==========================================
// Cách chạy tay (trong thư mục Backend):
//   node import-movies.js --dry                 # chạy thử, CHỈ in ra, không ghi DB
//   node import-movies.js                        # lấy 2 trang phim mới cập nhật, thêm phim chưa có
//   node import-movies.js --pages=5 --max=100    # quét 5 trang, tối đa thêm 100 phim
//   node import-movies.js --list=hoat-hinh       # lấy từ danh sách khác (phim-bo, phim-le, hoat-hinh, tv-shows)
//   node import-movies.js --every=60             # chạy lặp, mỗi 60 phút quét 1 lần (để treo máy)
//
// Cách gắn vào server.js (bot chạy ngầm cùng server, không cần mở thêm cửa sổ):
//   const importer = require("./import-movies");
//   importer.run({ pages: 1 }, pool);                                   // chạy 1 lần lúc khởi động
//   setInterval(() => importer.run({ pages: 1 }, pool), 60 * 60 * 1000); // rồi mỗi 1 giờ
//
// Bot KHÔNG đụng vào phim đã có (so theo slug) -> chạy lại bao nhiêu lần cũng không trùng.
// Link tập phim không cần lưu: trang watch.html đã tự gọi phimapi.com theo slug khi xem.

const API = "https://phimapi.com";

// Tên bảng. Tên cột nào KHÔNG có trong bảng của bạn sẽ tự bị bỏ qua (có in cảnh báo).
const TABLE = process.env.MOVIES_TABLE || "movies";

// Quốc gia của nguồn -> tên quốc gia dùng trong menu "Quốc Gia" của web
const COUNTRY_MAP = { "Âu Mỹ": "Mỹ" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "LauPhim-importer/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw new Error(`${url} -> ${err.message}`);
      await sleep(800 * i); // lỗi mạng thoáng qua: chờ rồi thử lại
    }
  }
}

// Nội dung phim từ nguồn là HTML (<p>...</p>) -> chuyển thành chữ thường
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

// Chuyển dữ liệu chi tiết phim của nguồn -> 1 dòng cho bảng movies
function toRow(detail) {
  const m = detail.movie || {};
  const servers = detail.episodes || [];
  // Số tập thực sự có link (lấy server nhiều tập nhất); không có thì dùng episode_total
  const epCount = servers.reduce(
    (max, s) =>
      Math.max(
        max,
        (s.server_data || []).filter((e) => e.link_m3u8 || e.link_embed).length,
      ),
    0,
  );

  const categories = (m.category || []).map((c) => c.name);
  const countries = (m.country || []).map((c) => COUNTRY_MAP[c.name] || c.name);

  return {
    title: m.name,
    slug: m.slug,
    poster: m.poster_url || m.thumb_url || "",
    banner: m.thumb_url || m.poster_url || "",
    description: stripHtml(m.content),
    // Giống dữ liệu cũ của web: quốc gia nằm lẫn trong genres, đồng thời có cột country riêng
    genres: [...categories, ...countries].filter(Boolean).join(", "),
    year: m.year || null,
    release_year: m.year || null,
    country: countries[0] || "",
    total_episodes: epCount || Number(m.episode_total) || 1,
    views: 0,
    _epCount: epCount,
    _status: m.status,
  };
}

async function run(options = {}, pool) {
  const pages = Number(options.pages) || 2;
  const max = Number(options.max) || 50;
  const list = options.list || "phim-moi-cap-nhat";
  const dry = !!options.dry;
  const log = options.log || console.log;

  // Chỉ ghi những cột thực sự có trong bảng của bạn
  const [colRows] = await pool.query(`SHOW COLUMNS FROM \`${TABLE}\``);
  const existing = new Set(colRows.map((c) => c.Field));
  if (!existing.has("slug") || !existing.has("title")) {
    throw new Error(
      `Bảng ${TABLE} phải có cột title và slug (đặt MOVIES_TABLE=... nếu tên bảng khác)`,
    );
  }

  const stats = {
    checked: 0,
    added: 0,
    skippedExisting: 0,
    skippedNoEpisodes: 0,
    failed: 0,
  };
  let warnedCols = false;

  for (let page = 1; page <= pages && stats.added < max; page++) {
    const sep = list.includes("?") ? "&" : "?";
    const data = await getJSON(
      `${API}/${list.startsWith("danh-sach") ? list : "danh-sach/" + list}${sep}page=${page}`,
    );
    const items = data.items || [];
    if (items.length === 0) break;

    for (const item of items) {
      if (stats.added >= max) break;
      stats.checked++;

      // 1) Đã có trong DB (theo slug) -> bỏ qua
      const [found] = await pool.query(
        `SELECT 1 FROM \`${TABLE}\` WHERE slug = ? LIMIT 1`,
        [item.slug],
      );
      if (found.length) {
        stats.skippedExisting++;
        continue;
      }

      try {
        // 2) Lấy chi tiết (mô tả, thể loại, quốc gia, danh sách tập)
        const detail = await getJSON(
          `${API}/phim/${encodeURIComponent(item.slug)}`,
        );
        await sleep(250); // nhẹ tay với server nguồn
        const row = toRow(detail);

        // Phim chưa có tập nào / chỉ là trailer -> chưa đáng thêm
        if (row._epCount === 0 || row._status === "trailer") {
          stats.skippedNoEpisodes++;
          continue;
        }

        const cols = Object.keys(row).filter(
          (k) => !k.startsWith("_") && existing.has(k),
        );
        if (!warnedCols) {
          // year / release_year là 2 tên gọi của cùng 1 cột: có 1 trong 2 là đủ, không cần cảnh báo
          const missing = Object.keys(row).filter(
            (k) =>
              !k.startsWith("_") &&
              !existing.has(k) &&
              !(k === "release_year" && existing.has("year")) &&
              !(k === "year" && existing.has("release_year")),
          );
          if (missing.length)
            log(
              `ℹ Bảng ${TABLE} không có cột: ${missing.join(", ")} -> bỏ qua các cột này`,
            );
          warnedCols = true;
        }

        if (dry) {
          log(
            `[DRY] sẽ thêm: ${row.title} (${row.slug}) | ${row.year} | ${row.country} | ${row.total_episodes} tập | ${row.genres}`,
          );
        } else {
          await pool.query(
            `INSERT INTO \`${TABLE}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
            cols.map((c) => row[c]),
          );
          log(`+ ${row.title} (${row.slug}) - ${row.total_episodes} tập`);
        }
        stats.added++;
      } catch (err) {
        stats.failed++;
        log(`✗ Lỗi với "${item.slug}": ${err.message}`);
      }
    }
  }

  log(
    `Xong${dry ? " (chạy thử)" : ""}: quét ${stats.checked} | thêm ${stats.added} | đã có ${stats.skippedExisting} | chưa có tập ${stats.skippedNoEpisodes} | lỗi ${stats.failed}`,
  );
  return stats;
}

module.exports = { run, toRow, stripHtml };

// ----- Chạy trực tiếp bằng dòng lệnh: node import-movies.js [--dry] [--pages=N] ... -----
if (require.main === module) {
  (async () => {
    try {
      require("dotenv").config();
    } catch (e) {} // không có dotenv thì dùng biến môi trường có sẵn

    const args = Object.fromEntries(
      process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v === undefined ? true : v];
      }),
    );

    // Dùng đúng thông tin kết nối giống server.js của bạn (sửa lại nếu tên biến khác)
    const mysql = require("mysql2/promise");
    const pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || process.env.DB_PASS || "",
      database: process.env.DB_NAME || "laupphim",
      charset: "utf8mb4",
    });

    const once = () =>
      run(
        { pages: args.pages, max: args.max, list: args.list, dry: !!args.dry },
        pool,
      ).catch((e) => console.error("Bot lỗi:", e.message));

    await once();
    if (args.every) {
      const minutes = Math.max(5, Number(args.every) || 60);
      console.log(
        `Bot đang chạy nền, mỗi ${minutes} phút quét lại (Ctrl+C để dừng)`,
      );
      setInterval(once, minutes * 60 * 1000);
    } else {
      await pool.end();
    }
  })();
}
