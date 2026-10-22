// ==========================================
// 0. CẤU HÌNH & DỮ LIỆU TẬP PHIM / DANH SÁCH PHIM
// ==========================================

// Chỉ điền URL backend khi cần các tính năng tài khoản/TMDB qua server.
const API_BASE_URL = "";

// API key TMDB (v3) để lấy điểm/đạo diễn/diễn viên trực tiếp, KHÔNG cần chạy server.
// Lấy tại https://www.themoviedb.org/settings/api . Để rỗng "" -> quay lại dùng backend.
const TMDB_API_KEY = "";

// ==========================================
// 0D. LẤY LINK TẬP TRỰC TIẾP TỪ API KKPHIM (phimapi.com) THEO SLUG
// ==========================================
// KKPhim (phimapi.com) có API công khai: GET https://phimapi.com/phim/{slug}
// trả về đầy đủ thông tin phim + toàn bộ tập kèm link m3u8 thật.
// Điều kiện: slug phim trong web của bạn phải TRÙNG với slug của KKPhim
// (copy đúng slug từ URL kkphim.com/phim/{slug} khi thêm phim).
// Nhờ vậy không cần lưu/copy tay từng link m3u8 vào DB hay Episodes.js nữa.
const KKPHIM_API_BASE = "https://phimapi.com/phim";

// Gọi API KKPhim theo slug, trả về mảng link m3u8 theo đúng thứ tự tập
// (lấy server đầu tiên trả về, thường là "Vietsub #1").
async function fetchEpisodesFromKKPhim(slug) {
  if (!slug) return [];
  try {
    const res = await fetch(`${KKPHIM_API_BASE}/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error(`API KKPhim lỗi ${res.status}`);
    const data = await res.json();
    const servers = data.episodes || [];
    if (!servers.length) return [];
    return (servers[0].server_data || []).map((ep) => ep.link_m3u8 || "");
  } catch (err) {
    console.error("Lỗi lấy danh sách tập từ KKPhim API:", err);
    return [];
  }
}

// Lấy đúng 1 link tập theo số thứ tự (episodeNum bắt đầu từ 1)
async function fetchEpisodeUrlFromKKPhim(slug, episodeNum) {
  const urls = await fetchEpisodesFromKKPhim(slug);
  return urls[episodeNum - 1] || "";
}

// Số tập được lấy từ dữ liệu phim do backend trả về.
function getTotalEpisodes(movie) {
  return movie && movie.episodes ? movie.episodes : 20;
}

// Danh sách nằm trong data/movies.json, không cần chạy backend.
