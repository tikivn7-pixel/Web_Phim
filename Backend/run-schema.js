// ==========================================
// CHẠY schema.sql LÊN DATABASE (LOCAL hoặc CLOUD)
// ==========================================
// Cách chạy:  node run-schema.js
// Đọc kết nối từ .env (giống migrate-movies.js / server.js)

const fs = require("fs");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "movie_db",
    multipleStatements: true, // Cho phép chạy nhiều câu lệnh SQL cùng lúc
  });

  console.log("Đang chạy schema.sql...");
  const sql = fs.readFileSync("./schema.sql", "utf8");
  await connection.query(sql);
  console.log("✅ Đã tạo xong bảng movies + episodes.");

  await connection.end();
}

main().catch((err) => {
  console.error("❌ Lỗi khi chạy schema.sql:", err);
  process.exit(1);
});
