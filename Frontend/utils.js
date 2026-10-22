// ==========================================
// 0B. ĐIỀU HƯỚNG TRANG (ROUTER) - switchPage()
// ==========================================
// Hàm này được gọi từ các onclick trong index.html (Trang chủ, Danh sách
// của tôi, Chi tiết, Xem phim...). Trước đây bị thiếu nên bấm không có
// phản ứng gì.
// Retry a transient image failure once, then use the alternate image and a local placeholder.
// Clear the error handler at the last step so a missing placeholder cannot loop forever.
function handleMovieImageError(img) {
  const attempt = Number(img.dataset.imageAttempt || 0);
  img.dataset.imageAttempt = String(attempt + 1);
  if (attempt === 0) {
    const original = img.getAttribute("src");
    setTimeout(() => { img.src = original; }, 400);
  } else if (attempt === 1 && img.dataset.fallback && img.dataset.fallback !== img.getAttribute("src")) {
    img.src = img.dataset.fallback;
  } else {
    img.onerror = null;
    img.src = "Img/poster-placeholder.svg";
  }
}

function switchPage(pageName, {updateUrl=true}={}) {
  closeMobileMenu();
  // Đang ở detail.html / watch.html (không có các .page) -> quay về index.html
  if (!document.getElementById("page-home")) {
    window.location.href =
      pageName === "home" ? "index.html" : `index.html?page=${pageName}`;
    return;
  }

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) {
    targetPage.classList.add("active");
    if(updateUrl&&typeof CatalogState!=="undefined"){
      const target=pageName==="home"?"index.html":"index.html?view="+encodeURIComponent(pageName);
      if("index.html"+window.location.search!==target)window.history.pushState({},"",target);
    }
  } else {
    console.warn(`switchPage: không tìm thấy #page-${pageName}`);
  }

  if (pageName === "wishlist" && typeof renderWishlistPage === "function") {
    renderWishlistPage();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeForInlineHandler(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, " ");
}

// Định dạng số lượt xem: compact -> "1.2k" (dùng trên thẻ phim),
// mặc định -> "1,234" (dùng ở trang chi tiết / trang xem)
function formatViews(n, { compact = false } = {}) {
  const v = Math.max(0, Number(n) || 0);
  if (compact) {
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(v);
  }
  return v.toLocaleString("en-US");
}

function closeMobileMenu() {
  document.getElementById("mobile-sidebar")?.classList.remove("mobile-open");
  document.getElementById("sidebar-overlay")?.classList.remove("active");
  document.getElementById("mobile-menu-btn")?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}
// Menu mobile (nút ☰ + lớp phủ). Chạy chung cho index/detail/watch.
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("mobile-menu-btn");
  const sidebar = document.getElementById("mobile-sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  if (menuBtn && sidebar && overlay) {
    menuBtn.textContent = "☰";
    menuBtn.setAttribute("role", "button");
    menuBtn.setAttribute("tabindex", "0");
    menuBtn.setAttribute("aria-label", "Mở menu");
    menuBtn.setAttribute("aria-controls", "mobile-sidebar");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.addEventListener("click", () => {
      const open = sidebar.classList.toggle("mobile-open");
      overlay.classList.toggle("active", open);
      document.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    menuBtn.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); menuBtn.click(); }
    });
    overlay.addEventListener("click", closeMobileMenu);
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeMobileMenu(); });
    sidebar.addEventListener("click", event => {
      if (event.target.closest(".genre-grid span") || event.target.closest("li[onclick]")) closeMobileMenu();
    });
    sidebar.querySelectorAll(".dropdown-toggle").forEach(toggle => {
      toggle.setAttribute("role", "button");
      toggle.setAttribute("tabindex", "0");
      toggle.setAttribute("aria-expanded", "false");
      const activate = () => {
        const parent = toggle.closest(".dropdown");
        const open = parent.classList.toggle("active");
        toggle.setAttribute("aria-expanded", String(open));
      };
      toggle.addEventListener("click", activate);
      toggle.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
    });
  }
});
