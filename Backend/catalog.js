const { COUNTRIES } = require("../Frontend/country-utils");
function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[-_.,:;|]+/g, " ").replace(/\s+/g, " ");
}
function filters(query, includeYear = true) {
  const clauses = [], values = [];
  for (const [key, column] of [["country", "country"], ["group", "movie_group"]]) {
    if (query[key]) { clauses.push(`${column} = ?`); values.push(query[key]); }
  }
  if (query.genre) { clauses.push("genres LIKE ?"); values.push(`%${query.genre}%`); }
  if (query.q) {
    clauses.push("search_text LIKE ? ESCAPE '!'");
    values.push(`%${normalize(query.q).trim().replace(/[!%_]/g, "!$&")}%`);
  }
  if (includeYear && query.year) { clauses.push("release_year = ?"); values.push(Number(query.year)); }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", values };
}
function registerCatalog(app, db) {
  const pool = db.promise();
  const fail = (res, err) => {
    console.error("Catalog:", err.code || err.message);
    res.status(503).json({ message: "Không tải được kho phim. Hãy chạy npm run migrate:catalog trong Backend và kiểm tra MySQL." });
  };
  app.get("/api/catalog", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 24));
      const { where, values } = filters(req.query);
      const facet = filters(req.query, false);
      const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM movie_catalog ${where}`, values);
      const [rows] = await pool.query(`SELECT payload FROM movie_catalog ${where} ORDER BY position LIMIT ? OFFSET ?`, [...values, limit, (page - 1) * limit]);
      const [years] = await pool.query(`SELECT release_year AS year, COUNT(*) AS count FROM movie_catalog ${facet.where} ${facet.where ? "AND" : "WHERE"} release_year > 0 GROUP BY release_year ORDER BY release_year DESC`, facet.values);
      res.json({ movies: rows.map(r => typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload), currentPage: page, totalPages: Math.ceil(count.total / limit), totalItems: count.total, years });
    } catch (err) { fail(res, err); }
  });
  app.get("/api/catalog/:slug", async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT payload FROM movie_catalog WHERE slug = ?", [req.params.slug]);
      if (!rows.length) return res.status(404).json({ message: "Không tìm thấy phim" });
      res.json(typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload);
    } catch (err) { fail(res, err); }
  });
}
module.exports = { registerCatalog, normalize, COUNTRIES, filters };
