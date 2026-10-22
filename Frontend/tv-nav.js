// ==========================================
// 9. ĐIỀU HƯỚNG BẰNG REMOTE TV (PHÍM MŨI TÊN + OK) - KHÔNG CẦN CHUỘT
// ==========================================
// Module này tự chạy độc lập, không cần sửa các hàm render phía trên.
// Cơ chế: mỗi lần bấm phím mũi tên, quét lại toàn bộ phần tử "bấm được"
// đang hiển thị trên trang (card phim, nút, link, ô tìm kiếm...), tìm
// phần tử gần nhất theo đúng hướng vừa bấm (dựa vào toạ độ thực tế trên
// màn hình), rồi focus vào đó. Bấm Enter/OK để "click" phần tử đang focus.
(function initTVRemoteNav() {
  // Danh sách các phần tử được coi là "bấm được" trên toàn site
  const FOCUSABLE_SELECTOR = [
    ".movie-card",
    ".btn-hover",
    ".hero-buttons .btn",
    ".slider-btn",
    ".hero-dot",
    ".ep-btn",
    ".nav-links li",
    ".dropdown-toggle",
    ".genre-grid span",
    "#search-input",
    ".search-btn",
    ".wp-nav-btn",
    ".fd-tab-btn",
    ".fd-watch-btn",
    ".fd-follow-badge",
    ".btn-modal",
    "a[href]",
    "button",
  ].join(", ");

  // Thêm CSS viền nổi bật khi đang focus, để dễ thấy trên màn hình TV
  const style = document.createElement("style");
  style.textContent = `
    .tv-nav-focus {
      outline: 3px solid #e50914 !important;
      outline-offset: 2px !important;
      transform: scale(1.04);
      transition: transform 0.12s ease;
      z-index: 20;
      position: relative;
    }
  `;
  document.head.appendChild(style);

  let lastFocused = null;

  function markFocus(el) {
    if (lastFocused) lastFocused.classList.remove("tv-nav-focus");
    if (el) el.classList.add("tv-nav-focus");
    lastFocused = el;

    // Dropdown Thể Loại / Quốc Gia: focus vào mục hoặc phần tử con của nó thì
    // mở menu đó, đồng thời đóng các menu khác (hover chuột không có trên remote)
    const owner = el ? el.closest(".dropdown") : null;
    document.querySelectorAll(".nav-links .dropdown.active").forEach((d) => {
      if (d !== owner) d.classList.remove("active");
    });
    if (owner) owner.classList.add("active");
  }

  // Chỉ lấy phần tử đang thực sự hiển thị (không nằm trong trang/tab ẩn)
  function getFocusableElements() {
    return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => {
        if(el.matches(':disabled,[hidden]')||getComputedStyle(el).visibility==='hidden')return false;
        if(el.matches('.movie-card')&&el.querySelector('.movie-card-link'))return false;
        if (el.offsetParent === null) return false;
        // Mục nằm trong menu dropdown đang đóng (ẩn bằng opacity/visibility)
        // thì không cho remote nhảy vào
        const menu = el.closest(".dropdown-menu");
        if (menu) {
          const owner = menu.closest(".dropdown");
          if (owner && !owner.classList.contains("active")) return false;
        }
        return true;
      },
    );
  }

  function ensureFocusable(el) {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  }

  // Tìm phần tử gần nhất theo đúng hướng bấm, dựa theo toạ độ thật trên
  // màn hình (spatial navigation) - ưu tiên phần tử thẳng hàng nhất trước,
  // sau đó mới đến khoảng cách gần nhất.
  function findNextElement(current, direction) {
    const all = getFocusableElements();
    if (!current) return all[0] || null;

    const rect = current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let best = null;
    let bestScore = Infinity;

    all.forEach((el) => {
      if (el === current) return;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const dx = ex - cx;
      const dy = ey - cy;

      let primary, cross, valid;
      if (direction === "right") {
        valid = dx > 5;
        primary = dx;
        cross = Math.abs(dy);
      } else if (direction === "left") {
        valid = dx < -5;
        primary = -dx;
        cross = Math.abs(dy);
      } else if (direction === "down") {
        valid = dy > 5;
        primary = dy;
        cross = Math.abs(dx);
      } else {
        valid = dy < -5;
        primary = -dy;
        cross = Math.abs(dx);
      }
      if (!valid) return;

      const score = cross * 3 + primary;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    });

    return best;
  }

  document.addEventListener("keydown", (e) => {
    if(e.defaultPrevented||e.isComposing||e.altKey||e.ctrlKey||e.metaKey)return;
    const focused=document.activeElement;
    if(focused?.matches('input,textarea,select,[contenteditable="true"],video')||focused?.closest('.plyr,[role="dialog"],dialog'))return;
    const directions = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };

    // Trang xem phim: mũi tên dành cho trình phát (tua 10s / âm lượng),
    // không dùng để di chuyển focus giữa các phần tử nữa
    if (directions[e.key] && document.getElementById("video-player")?.offsetParent!==null && document.getElementById("video-player")) return;

    if (directions[e.key]) {
      getFocusableElements().forEach(ensureFocusable);
      const current = focused&&focused!==document.body&&getFocusableElements().includes(focused)
        ? focused : lastFocused&&document.body.contains(lastFocused)?lastFocused:null;
      const next = findNextElement(current, directions[e.key]);
      if (next) {
        next.focus();
        markFocus(next);
        next.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
      }
      e.preventDefault();
    } else if (e.key === "Enter") {
      // Đang gõ trong ô nhập (ô tìm kiếm...) -> để ô đó tự xử lý Enter,
      // không click vào phần tử khác (lỗi cũ: click nhầm lastFocused làm mất kết quả tìm kiếm)
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
      ) {
        return;
      }
      if(active?.matches('button,a[href],summary,[role="button"]'))return;
      const current = active&&active!==document.body?active:lastFocused;
      if (current) {
        current.click();
        e.preventDefault();
      }
    }
  });

  // Focus sẵn phần tử đầu tiên khi trang tải xong, để bấm mũi tên là
  // di chuyển được ngay (không cần chạm/click chuột trước)
  window.addEventListener("load", () => {
    const all = getFocusableElements();
    all.forEach(ensureFocusable);
  });
})();
