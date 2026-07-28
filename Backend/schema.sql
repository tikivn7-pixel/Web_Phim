-- ==========================================
-- SCHEMA: movies + episodes
-- Chạy file này trong MySQL (database movie_db) TRƯỚC khi chạy migrate-movies.js
-- ==========================================

CREATE TABLE IF NOT EXISTS movies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  poster VARCHAR(500),
  banner VARCHAR(500),
  description TEXT,
  genres VARCHAR(500),          -- lưu dạng "Tình Cảm, Hàn Quốc" (đơn giản, dễ migrate từ data cũ)
  total_episodes INT DEFAULT 1,
  movie_group VARCHAR(255) DEFAULT NULL,   -- dùng cho phim nhiều PHẦN như "The Witch Part 1/2"
  part_name VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_title (title),
  KEY idx_group (movie_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS episodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  movie_id INT NOT NULL,
  episode_number INT NOT NULL,
  video_url VARCHAR(1000) NOT NULL,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_movie_ep (movie_id, episode_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ghi chú: genres đang lưu dạng chuỗi để migrate nhanh từ code cũ.
-- Khi số lượng phim lên tới hàng nghìn và cần lọc thể loại nhanh hơn,
-- nên tách ra bảng "genres" + bảng nối "movie_genres" (many-to-many) sau này.
