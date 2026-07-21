const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = "bi_mat_khong_the_tiet_lo_123"; // Đặt secret key tùy ý

// Kết nối CSDL
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // Thay bằng user DB của bạn
  password: "", // Thay bằng Mật khẩu DB của bạn
  database: "movie_db",
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

app.listen(5000, () => {
  console.log("Server Backend đang chạy tại http://localhost:5000");
});
