// Import the complete curated collection, preserving every original field.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const mysql = require("mysql2/promise");
const { normalize } = require("./catalog");
const { primaryCountry } = require("../Frontend/country-utils");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
function readSource() {
  const ctx = { window: {}, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "catalog-source.js"), "utf8") + ";this.movies=fallbackMoviesList;", ctx);
  const cast = path.join(__dirname, "../Frontend/cast-data.js");
  if (fs.existsSync(cast)) vm.runInNewContext(fs.readFileSync(cast, "utf8"), ctx);
  if (!ctx.movies.length || new Set(ctx.movies.map(m => m.slug)).size !== ctx.movies.length) throw new Error("Kho phim rỗng hoặc trùng slug; dừng nhập.");
  return ctx.movies.map(m => ({ ...m, ...(ctx.window.movieCastIndex?.[m.slug] || {}), ...m }));
}
async function migrate() {
  const movies = readSource();
  if (process.argv.includes("--dry")) { console.log(`Validated ${movies.length} unique movies; no database changes.`); return; }
  const db = await mysql.createConnection({ host: process.env.DB_HOST || "localhost", port: process.env.DB_PORT || 3306, user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "movie_db", charset: "utf8mb4" });
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS movie_catalog (
      slug VARCHAR(255) PRIMARY KEY, position INT NOT NULL, country VARCHAR(100),
      genres VARCHAR(500), movie_group VARCHAR(255), release_year INT,
      search_text MEDIUMTEXT, payload JSON NOT NULL,
      KEY idx_position(position), KEY idx_country(country), KEY idx_group(movie_group), KEY idx_year(release_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await db.beginTransaction();
    for (const [position, movie] of movies.entries()) {
      const country = primaryCountry(movie);
      await db.query(`INSERT INTO movie_catalog (slug, position, country, genres, movie_group, release_year, search_text, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE position=VALUES(position), country=VALUES(country), genres=VALUES(genres), movie_group=VALUES(movie_group), release_year=VALUES(release_year), search_text=VALUES(search_text), payload=VALUES(payload)`,
      [movie.slug, position, country, movie.genres || "", movie.group || null, Number(movie.year) || null, normalize([movie.title, movie.genres, movie.cast, movie.director].filter(Boolean).join(" | ")), JSON.stringify(movie)]);
    }
    const [saved] = await db.query("SELECT slug, payload FROM movie_catalog WHERE slug IN (?)", [movies.map(m => m.slug)]);
    const bySlug = new Map(saved.map(r => [r.slug, typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload]));
    for (const movie of movies) {
      const actual = bySlug.get(movie.slug);
      if (!actual || Object.keys(movie).some(k => JSON.stringify(movie[k]) !== JSON.stringify(actual[k]))) throw new Error(`Verification failed: ${movie.slug}`);
    }
    await db.commit();
    console.log(`Imported and verified all ${movies.length} movies. Original source retained in Backend/catalog-source.js.`);
  } catch (err) { await db.rollback(); throw err; } finally { await db.end(); }
}
if (require.main === module) migrate().catch(err => { console.error("Catalog migration failed:", err.code || err.message); process.exitCode = 1; });
module.exports = { readSource };
