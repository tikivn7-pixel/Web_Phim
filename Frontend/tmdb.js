// ==========================================
// 10. HIỂN THỊ CHI TIẾT PHIM (điểm, đạo diễn, diễn viên, thể loại, trạng thái)
// Dữ liệu lấy từ object phim do fetchMovieBySlug() (api.js) trả về,
// nên không cần backend hay API key.
// ==========================================

function updateRatingVisuals(voteAverage) {
  if (!voteAverage) return;

  const percent = Math.round(voteAverage * 10);
  const scoreEl = document.getElementById("fd-score-value");
  if (scoreEl) scoreEl.innerText = `${percent}%`;

  const starsEl = document.getElementById("fd-stars");
  if (starsEl) {
    const starCount = Math.round(voteAverage / 2);
    let html = "";
    for (let i = 1; i <= 5; i++) {
      html += `<i class="${i <= starCount ? "fa-solid" : "fa-regular"} fa-star"></i>`;
    }
    starsEl.innerHTML = html;
  }
}

async function loadMovieDetailsFromTMDB(movie) {
  if (!movie) return;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value) el.innerText = value;
  };

  try {
    // 1. Điểm đánh giá
    const vote = Number(movie.vote_average) || 0;
    if (vote > 0) {
      setText("detail-rating", vote.toFixed(1));
      updateRatingVisuals(vote);
    }

    // 2. Đạo diễn, 3. Diễn viên, 4. Thể loại, 5. Trạng thái
    setText("detail-director", movie.director);
    setText("detail-cast", movie.cast);
    setText("detail-genres", movie.genres);
    setText("fd-status", movie.episodeCurrent || movie.status);
  } catch (error) {
    console.error("Không thể hiển thị thông tin chi tiết phim:", error);
  }
}
