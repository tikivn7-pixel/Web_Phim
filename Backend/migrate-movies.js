// ==========================================
// MIGRATE DỮ LIỆU PHIM (script.js + Episodes.js) -> MySQL
// ==========================================
// Cách chạy:
//   1. Chạy schema.sql trước (tạo bảng movies + episodes) trong database movie_db
//   2. Copy 3 file này (movies-data.js, episodes-data.js, migrate-movies.js) vào
//      cùng thư mục Backend/ (nơi có node_modules với mysql2 đã cài sẵn)
//   3. Chạy:  node migrate-movies.js
//
// Script có thể chạy lại nhiều lần an toàn (dùng ON DUPLICATE KEY UPDATE theo slug).

const mysql = require("mysql2/promise");
require("dotenv").config();
const globalMoviesList = require("./movies-data.js");
const { allEpisodesData, movieKeyMap } = require("./episodes-data.js");

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "movie_db",
  });

  console.log(`Bắt đầu migrate ${globalMoviesList.length} phim...`);

  let movieCount = 0;
  let episodeCount = 0;

  for (const movie of globalMoviesList) {
    const cleanTitle = (movie.title || "").trim().toLowerCase();
    const key = movieKeyMap[cleanTitle];
    const episodeUrls = key && allEpisodesData[key] ? allEpisodesData[key] : [];
    const totalEpisodes = episodeUrls.length || movie.episodes || 1;

    // 1. Insert / update phim theo slug (chạy lại script không bị trùng lặp)
    const [result] = await connection.execute(
      `INSERT INTO movies (slug, title, poster, banner, description, genres, total_episodes, movie_group, part_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         poster = VALUES(poster),
         banner = VALUES(banner),
         description = VALUES(description),
         genres = VALUES(genres),
         total_episodes = VALUES(total_episodes),
         movie_group = VALUES(movie_group),
         part_name = VALUES(part_name)`,
      [
        movie.slug,
        movie.title,
        movie.poster || null,
        movie.banner || movie.poster || null,
        movie.desc || null,
        movie.genres || null,
        totalEpisodes,
        movie.group || null,
        movie.partName || null,
      ],
    );

    // Lấy đúng movie_id (INSERT ... ON DUPLICATE KEY không trả insertId khi update)
    const [[movieRow]] = await connection.execute(
      "SELECT id FROM movies WHERE slug = ?",
      [movie.slug],
    );
    const movieId = movieRow.id;
    movieCount++;

    // 2. Insert danh sách tập phim (nếu có link m3u8 thật trong Episodes.js)
    for (let i = 0; i < episodeUrls.length; i++) {
      await connection.execute(
        `INSERT INTO episodes (movie_id, episode_number, video_url)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE video_url = VALUES(video_url)`,
        [movieId, i + 1, episodeUrls[i]],
      );
      episodeCount++;
    }

    console.log(
      `✔ ${movie.title} — ${episodeUrls.length} tập${
        episodeUrls.length === 0 ? " (chưa có link m3u8, chỉ có metadata)" : ""
      }`,
    );
  }

  console.log(
    `\n✅ Hoàn tất: ${movieCount} phim, ${episodeCount} tập đã được migrate vào MySQL.`,
  );
  await connection.end();
}

main().catch((err) => {
  console.error("❌ Lỗi migrate:", err);
  process.exit(1);
});
