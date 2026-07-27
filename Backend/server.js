const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

// Đọc file .env ở thư mục Backend
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Lấy JWT_SECRET từ .env hoặc dùng giá trị mặc định
const JWT_SECRET = process.env.JWT_SECRET || "bi_mat_khong_the_tiet_lo_123";

// Kết nối CSDL
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // Thay bằng user DB của bạn
  password: "", // Thay bằng Mật khẩu DB của bạn
  database: "movie_db",
});

// Không để lỗi kết nối MySQL làm sập cả server (các route TMDB không cần DB)
db.connect((err) => {
  if (err) {
    console.warn(
      "⚠️  Không kết nối được MySQL (các API đăng nhập/watchlist sẽ lỗi, nhưng API TMDB vẫn chạy bình thường):",
      err.code,
    );
  } else {
    console.log("✅ Đã kết nối MySQL thành công.");
  }
});
db.on("error", (err) => {
  console.warn("⚠️  Lỗi kết nối MySQL:", err.code);
});

// Middleware xác thực JWT Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Thiếu Token xác thực!" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Token không hợp lệ!" });
    req.user = user;
    next();
  });
};

// ================= API AUTHENTICATION =================

// 1. Đăng ký
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      (err, result) => {
        if (err)
          return res
            .status(400)
            .json({ message: "Email hoặc Username đã tồn tại!" });
        res.status(201).json({ message: "Đăng ký thành công!" });
      },
    );
  } catch (error) {
    res.status(500).json({ message: "Lỗi server!" });
  }
});

// 2. Đăng nhập
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err || results.length === 0)
        return res
          .status(400)
          .json({ message: "Sai tài khoản hoặc mật khẩu!" });

      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return res
          .status(400)
          .json({ message: "Sai tài khoản hoặc mật khẩu!" });

      // Tạo JWT Token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
      res.json({
        message: "Đăng nhập thành công!",
        token,
        username: user.username,
      });
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

// ==========================================

app.listen(5000, () => {
  console.log("Server Backend đang chạy tại http://localhost:5000");
});
