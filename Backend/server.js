const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

// Đọc file .env ở thư mục Backend
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const app = express();
app.use(express.json());
app.use(cors());

const signing=require('./auth-secret.cjs').resolveJWTSecret();
const JWT_SECRET=signing.secret;
if(signing.ephemeral)console.warn('JWT_SECRET is not configured. Login sessions will expire when this backend restarts. Set a persistent random secret in Backend/.env.');

// Kết nối CSDL - đọc từ .env để chạy được cả ở local (XAMPP) lẫn trên cloud
// (Railway/Render...). Nếu không có biến môi trường nào, mặc định dùng cấu
// hình XAMPP local như cũ.
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "movie_db",
});

// Không để lỗi kết nối MySQL làm sập cả server (các route TMDB không cần DB)
db.getConnection((err, connection) => {
  if (err) {
    console.warn(
      "⚠️  Không kết nối được MySQL (các API đăng nhập/watchlist sẽ lỗi, nhưng API TMDB vẫn chạy bình thường):",
      err.code,
    );
  } else {
    connection.release();
    console.log("✅ Đã kết nối MySQL thành công.");
  }
});
db.on("error", (err) => {
  console.warn("⚠️  Lỗi kết nối MySQL:", err.code);
});
require("./catalog").registerCatalog(app, db);

// Middleware xác thực JWT Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Thiếu Token xác thực!" });

  jwt.verify(token, JWT_SECRET, {algorithms:['HS256']}, (err, user) => {
    if (err) return res.status(403).json({ message: "Token không hợp lệ!" });
    req.user = user;
    next();
  });
};

// ================= API AUTHENTICATION =================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[A-Za-z0-9_.]{3,30}$/;

// 1. Đăng ký
app.post("/api/auth/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password || "");

  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({
      message: "Tên đăng nhập 3-30 ký tự, chỉ gồm chữ, số, dấu _ hoặc .",
    });
  }
  if (!EMAIL_REGEX.test(email) || email.length > 255) {
    return res.status(400).json({ message: "Email không hợp lệ!" });
  }
  // bcrypt chỉ xét 72 byte đầu nên giới hạn độ dài tối đa
  if (password.length < 6 || password.length > 72) {
    return res
      .status(400)
      .json({ message: "Mật khẩu phải từ 6 đến 72 ký tự!" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      (err) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            const isEmail = /key '(?:users\.)?email'/.test(
              err.sqlMessage || "",
            );
            return res.status(409).json({
              message: isEmail
                ? "Email này đã được đăng ký!"
                : "Tên đăng nhập đã tồn tại!",
            });
          }
          console.error("Lỗi đăng ký:", err);
          return res.status(500).json({ message: "Lỗi CSDL!" });
        }
        res.status(201).json({ message: "Đăng ký thành công!" });
      },
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server!" });
  }
});

// 2. Đăng nhập (bằng email HOẶC tên đăng nhập)
app.post("/api/auth/login", (req, res) => {
  const identifier = String(req.body.identifier ?? req.body.email ?? "").trim();
  const password = String(req.body.password || "");

  if (!identifier || !password) {
    return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin!" });
  }

  db.query(
    "SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1",
    [identifier.toLowerCase(), identifier],
    async (err, results) => {
      if (err) {
        console.error("Lỗi đăng nhập:", err);
        return res.status(500).json({ message: "Lỗi CSDL!" });
      }
      if (results.length === 0) {
        return res
          .status(400)
          .json({ message: "Sai tài khoản hoặc mật khẩu!" });
      }

      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Sai tài khoản hoặc mật khẩu!" });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
      res.json({
        message: "Đăng nhập thành công!",
        token,
        username: user.username,
        email: user.email,
      });
    },
  );
});

// 3. Lấy thông tin người dùng đang đăng nhập (dựa vào token)
app.get("/api/auth/me", authenticateToken, (req, res) => {
  db.query(
    "SELECT id, username, email, created_at FROM users WHERE id = ?",
    [req.user.userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Lỗi CSDL!" });
      if (results.length === 0) {
        return res.status(404).json({ message: "Tài khoản không tồn tại!" });
      }
      res.json({ user: results[0] });
    },
  );
});

// ================= API WATCHLIST =================

// 3. Lấy danh sách phim yêu thích
app.get("/api/watchlist", authenticateToken, (req, res) => {
  db.query(
    "SELECT movie_id FROM watchlists WHERE user_id = ?",
    [req.user.userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Lỗi CSDL!" });
      res.json(results.map((row) => row.movie_id));
    },
  );
});

// 4. Thêm/Xóa phim khỏi Yêu thích (Toggle)
app.post("/api/watchlist/toggle", authenticateToken, (req, res) => {
  const { movieId } = req.body;
  const userId = req.user.userId;

  db.query(
    "SELECT * FROM watchlists WHERE user_id = ? AND movie_id = ?",
    [userId, movieId],
    (err, results) => {
      if (results.length > 0) {
        // Đã có -> Xóa khỏi Watchlist
        db.query("DELETE FROM watchlists WHERE user_id = ? AND movie_id = ?", [
          userId,
          movieId,
        ]);
        res.json({
          message: "Đã xóa khỏi danh sách yêu thích",
          isFavorite: false,
        });
      } else {
        // Chưa có -> Thêm vào Watchlist
        db.query("INSERT INTO watchlists (user_id, movie_id) VALUES (?, ?)", [
          userId,
          movieId,
        ]);
        res.json({
          message: "Đã thêm vào danh sách yêu thích",
          isFavorite: true,
        });
      }
    },
  );
});

// ================= API CONTINUE WATCHING =================

// 5. Cập nhật tiến trình xem phim
app.post("/api/history", authenticateToken, (req, res) => {
  const { movieId, progressSeconds, durationSeconds } = req.body;
  const userId = req.user.userId;

  const sql = `
        INSERT INTO watch_history (user_id, movie_id, progress_seconds, duration_seconds)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            progress_seconds = VALUES(progress_seconds),
            duration_seconds = VALUES(duration_seconds);
    `;

  db.query(sql, [userId, movieId, progressSeconds, durationSeconds], (err) => {
    if (err) return res.status(500).json({ message: "Lỗi lưu tiến trình!" });
    res.json({ message: "Đã lưu vị trí xem dở!" });
  });
});

// ================= API TMDB (Lấy thông tin phim tự động) =================

// 6. Tìm kiếm phim từ TMDB qua từ khóa tên phim
app.get("/api/tmdb/search", async (req, res) => {
  const query = req.query.query;
  const apiKey = process.env.TMDB_API_KEY;

  if (!query) {
    return res.status(400).json({ message: "Thiếu từ khóa tìm kiếm phim" });
  }

  try {
    // Tìm đồng thời cả 2 danh mục: Phim điện ảnh (movie) và Phim bộ (tv)
    const [movieRes, tvRes] = await Promise.all([
      fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=vi-VN`,
      ),
      fetch(
        `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=vi-VN`,
      ),
    ]);
    const movieData = await movieRes.json();
    const tvData = await tvRes.json();

    const movieResults = (movieData.results || []).map((r) => ({
      ...r,
      mediaType: "movie",
    }));
    const tvResults = (tvData.results || []).map((r) => ({
      ...r,
      mediaType: "tv",
    }));
    const allResults = [...movieResults, ...tvResults];

    if (allResults.length === 0) {
      return res.json({ results: [] });
    }

    const normalizedQuery = query.trim().toLowerCase();

    // Ưu tiên kết quả có tên khớp CHÍNH XÁC với từ khóa (tên hiển thị hoặc tên gốc)
    let best = allResults.find((r) => {
      const name = (r.title || r.name || "").toLowerCase();
      const original = (
        r.original_title ||
        r.original_name ||
        ""
      ).toLowerCase();
      return name === normalizedQuery || original === normalizedQuery;
    });

    // Nếu không có kết quả khớp tuyệt đối -> chọn kết quả phổ biến nhất (popularity cao nhất)
    if (!best) {
      best = [...allResults].sort(
        (a, b) => (b.popularity || 0) - (a.popularity || 0),
      )[0];
    }

    res.json({
      results: [best],
      isTV: best.mediaType === "tv",
    });
  } catch (err) {
    console.error("Lỗi kết nối TMDB:", err);
    res.status(500).json({ message: "Lỗi server khi kết nối TMDB" });
  }
});

// 7. Lấy chi tiết thông tin phim (Đạo diễn, Diễn viên, Thể loại, Điểm...) bằng ID
app.get("/api/tmdb/detail/:id", async (req, res) => {
  const movieId = req.params.id;
  const isTV = req.query.isTV === "true";
  const apiKey = process.env.TMDB_API_KEY;
  const mediaType = isTV ? "tv" : "movie";

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${movieId}?api_key=${apiKey}&append_to_response=credits&language=vi-VN`,
    );
    const data = await response.json();

    // Thể loại: mảng [{id,name}] -> chuỗi "Chính Kịch, Tâm Lý"
    const genres = (data.genres || []).map((g) => g.name).join(", ");

    // Diễn viên: lấy 5 người đầu trong dàn cast
    const cast = (data.credits?.cast || [])
      .slice(0, 5)
      .map((c) => c.name)
      .join(", ");

    // Đạo diễn: phim điện ảnh nằm trong credits.crew (job = "Director")
    // Phim bộ (TV) TMDB không có "director" trực tiếp -> dùng created_by
    let director = "";
    if (isTV) {
      director = (data.created_by || []).map((p) => p.name).join(", ");
    } else {
      director = (data.credits?.crew || [])
        .filter((p) => p.job === "Director")
        .map((p) => p.name)
        .join(", ");
    }

    res.json({
      id: data.id,
      title: data.title || data.name,
      vote_average: data.vote_average,
      genres: genres || "Đang cập nhật",
      cast: cast || "Đang cập nhật",
      director: director || "Đang cập nhật",
    });
  } catch (err) {
    console.error("Lỗi lấy chi tiết TMDB:", err);
    res.status(500).json({ message: "Lỗi server khi lấy chi tiết TMDB" });
  }
});

// ================= API MOVIES (PHÂN TRANG) =================

// 8. Lấy danh sách phim có phân trang, lọc theo thể loại và/hoặc nhóm phim
//    GET /api/movies?page=1&limit=20&genre=Hàn Quốc
//    GET /api/movies?group=twenty-five-twenty-one-group  (lấy các PHẦN cùng 1 series)
app.get("/api/movies", (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
  const offset = (page - 1) * limit;
  const genre = req.query.genre ? req.query.genre.trim() : null;
  const group = req.query.group ? req.query.group.trim() : null;

  const conditions = [];
  const whereParams = [];
  if (genre) {
    conditions.push("genres LIKE ?");
    whereParams.push(`%${genre}%`);
  }
  if (group) {
    conditions.push("movie_group = ?");
    whereParams.push(group);
  }
  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  db.query(
    `SELECT COUNT(*) AS total FROM movies ${whereClause}`,
    whereParams,
    (err, countResult) => {
      if (err) return res.status(500).json({ message: "Lỗi CSDL!" });
      const total = countResult[0].total;

      db.query(
        `SELECT id, slug, title, poster, banner, description, genres, total_episodes, movie_group, part_name
         FROM movies ${whereClause}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
        [...whereParams, limit, offset],
        (err2, movies) => {
          if (err2) return res.status(500).json({ message: "Lỗi CSDL!" });
          res.json({
            movies,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
          });
        },
      );
    },
  );
});

// 9. Tìm kiếm phim theo tên hoặc thể loại
//    GET /api/movies/search?q=naruto&limit=20
app.get("/api/movies/search", (req, res) => {
  const keyword = (req.query.q || "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

  if (!keyword) {
    return res.status(400).json({ message: "Thiếu từ khóa tìm kiếm!" });
  }

  db.query(
    `SELECT id, slug, title, poster, banner, description, genres, total_episodes, movie_group, part_name
     FROM movies
     WHERE title LIKE ? OR genres LIKE ?
     ORDER BY id DESC
     LIMIT ?`,
    [`%${keyword}%`, `%${keyword}%`, limit],
    (err, movies) => {
      if (err) return res.status(500).json({ message: "Lỗi CSDL!" });
      res.json({ movies });
    },
  );
});

// 10. Lấy chi tiết 1 phim theo slug (kèm danh sách link tập phim)
//     GET /api/movies/:slug
app.get("/api/movies/:slug", (req, res) => {
  const { slug } = req.params;

  db.query(
    "SELECT * FROM movies WHERE slug = ?",
    [slug],
    (err, movieResults) => {
      if (err) return res.status(500).json({ message: "Lỗi CSDL!" });
      if (movieResults.length === 0) {
        return res.status(404).json({ message: "Không tìm thấy phim!" });
      }
      const movie = movieResults[0];

      db.query(
        "SELECT episode_number, video_url FROM episodes WHERE movie_id = ? ORDER BY episode_number ASC",
        [movie.id],
        (err2, episodeResults) => {
          if (err2) return res.status(500).json({ message: "Lỗi CSDL!" });
          res.json({
            ...movie,
            episodes: episodeResults.map((e) => e.video_url),
          });
        },
      );
    },
  );
});

// ==========================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server Backend đang chạy tại http://localhost:${PORT}`);
});
