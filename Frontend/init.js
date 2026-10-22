// ==========================================
// 7. KHỞI TẠO TỔNG THỂ
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  const homeMovies = await renderHomePageMovies();
  initHeroSlider(homeMovies.length?await loadStaticCatalog():homeMovies);
  if(!homeMovies.length){
    document.getElementById("hero-title").textContent="Chưa tải được danh sách phim";
    document.getElementById("hero-desc").textContent="Kiểm tra kết nối, rồi bấm Thử lại ở danh sách phim bên dưới.";
    document.getElementById("hero-play-btn").disabled=true;document.getElementById("hero-info-btn").disabled=true;
  }

  renderAnimeMovies();
  renderKoreanMovies();
  renderActionMovies();
  renderRomanceMovies();
  renderContinueWatching();

  await restoreCatalogFromLocation();
});

// ==========================================
// 8. BỔ SUNG XỬ LÝ TOÀN MÀN HÌNH (MOBILE FULLSCREEN FIX)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const videoElement = document.querySelector(".video-player-wrapper video");
  const wrapperElement = document.querySelector(".video-player-wrapper");

  if (videoElement) {
    window.triggerFullscreen = function () {
      if (videoElement.webkitEnterFullscreen) {
        videoElement.webkitEnterFullscreen();
      } else if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (wrapperElement && wrapperElement.requestFullscreen) {
        wrapperElement.requestFullscreen();
      } else if (videoElement.requestFullscreen) {
        videoElement.requestFullscreen();
      }
    };
  }
});

// ==========================================
// 9. XỬ LÝ SỰ KIỆN CLICK NÚT MŨI TÊN TRƯỢT SLIDER
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const sliderSections = document.querySelectorAll(".slider-section");

  sliderSections.forEach((section) => {
    const slider = section.querySelector(".movie-slider");
    const prevBtn = section.querySelector(".prev-btn");
    const nextBtn = section.querySelector(".next-btn");

    if (slider && nextBtn && prevBtn) {
      nextBtn.addEventListener("click", () => {
        slider.scrollBy({ left: window.innerWidth * 0.75, behavior: "smooth" });
      });

      prevBtn.addEventListener("click", () => {
        slider.scrollBy({
          left: -window.innerWidth * 0.75,
          behavior: "smooth",
        });
      });
    }
  });
});
