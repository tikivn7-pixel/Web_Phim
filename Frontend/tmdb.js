// ==========================================
// 10. TÍCH HỢP HIỂN THỊ CHI TIẾT TMDB CHO TRANG DETAIL
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

async function loadMovieDetailsFromTMDB(movieTitle) {
  try {
    const detailData = await fetchMovieDataFromBackend(movieTitle);

    if (detailData) {
      // 1. Cập nhật điểm đánh giá
      const ratingEl = document.getElementById("detail-rating");
      if (ratingEl && detailData.vote_average) {
        ratingEl.innerText = detailData.vote_average.toFixed(1);
      }
      updateRatingVisuals(detailData.vote_average);

      // 2. Cập nhật Đạo diễn
      const directorEl = document.getElementById("detail-director");
      if (directorEl && detailData.director) {
        directorEl.innerText = detailData.director;
      }

      // 3. Cập nhật Diễn viên
      const castEl = document.getElementById("detail-cast");
      if (castEl && detailData.cast) {
        castEl.innerText = detailData.cast;
      }

      // 4. Cập nhật Thể loại
      const genresEl = document.getElementById("detail-genres");
      if (genresEl && detailData.genres) {
        genresEl.innerText = detailData.genres;
      }
    }
  } catch (error) {
    console.error("Không thể tải thông tin chi tiết TMDB:", error);
  }
}
