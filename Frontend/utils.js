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
  const wasOpen=document.body.classList.contains("menu-open");
  document.getElementById("mobile-sidebar")?.classList.remove("mobile-open");
  document.getElementById("sidebar-overlay")?.classList.remove("active");
  document.getElementById("mobile-menu-btn")?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
  if(wasOpen)document.getElementById("mobile-menu-btn")?.focus();
}
// Menu mobile (nút ☰ + lớp phủ). Chạy chung cho index/detail/watch.
document.addEventListener("DOMContentLoaded", async () => {
  // Reflect countries actually present in the catalog on home/detail/watch.
  // Keep the HTML fallback usable if the catalog cannot be loaded.
  try {
    const { countries } = await getCatalogFilters();
    if (!countries.length) return;
    document.querySelectorAll('.country-menu .genre-grid').forEach(grid => {
      const entries = countries.map(country => {
        const entry = document.createElement('span');
        entry.textContent = country;
        entry.setAttribute('role', 'button');
        entry.tabIndex = 0;
        entry.addEventListener('click', () => filterByCountry(country));
        entry.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); entry.click();
          }
        });
        return entry;
      });
      grid.replaceChildren(...entries);
    });
  } catch (_) { /* Static country links remain available offline. */ }
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".logo[onclick],.nav-links li[onclick],.genre-grid span[onclick]").forEach(element=>{
    element.setAttribute("role","button");element.tabIndex=0;
    element.addEventListener("keydown",event=>{if(event.target===element&&(event.key==="Enter"||event.key===" ")){event.preventDefault();element.click();}});
  });
  document.querySelectorAll(".search-btn").forEach(button=>button.setAttribute("aria-label","Tìm kiếm"));
  const nav=document.getElementById("mobile-sidebar");
  if(nav){
    const favorite=nav.querySelector('li[onclick*="wishlist"]');
    if(favorite){favorite.removeAttribute('onclick');favorite.removeAttribute('role');favorite.removeAttribute('tabindex');const link=document.createElement('a');link.href='library.html';link.textContent='Thư viện';favorite.replaceChildren(link);}
    for(const [href,text,className] of [["discover.html","Khám phá","nav-discover"],["collections.html","Loạt phim","nav-collections"],["picker.html","Chọn phim","nav-picker"]]){
      if(nav.querySelector('a[href="'+href+'"]'))continue;
      const item=document.createElement("li"),link=document.createElement("a");item.className=className;link.href=href;link.textContent=text;item.append(link);
      if(className==='nav-discover')nav.insertBefore(item,nav.children[1]||null);else nav.insertBefore(item,favorite||null);
    }
  }
  document.querySelectorAll('.search-btn').forEach(button=>{button.textContent='⌕';});
  if(!document.querySelector('footer')){
    const footer=document.createElement('footer');footer.className='site-footer';const text=document.createElement('p');text.textContent='LauPhim · Một bộ phim hay, một khoảng thời gian cho bạn.';
    const links=document.createElement('div');links.className='footer-links';for(const [href,label] of [['discover.html','Khám phá'],['updates.html','Tập mới'],['lists.html','Danh sách riêng'],['notes.html','Ghi chú & mốc cảnh'],['library.html#backup','Sao lưu thư viện'],['manage.html','Quản lý phim']]){const link=document.createElement('a');link.href=href;link.textContent=label;links.append(link);}footer.append(text,links);document.body.append(footer);
  }
  document.querySelectorAll('.home-footer a[href="#page-home"]').forEach(link=>{link.onclick=event=>{event.preventDefault();window.scrollTo({top:0,behavior:'smooth'});};});
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.isComposing&&!event.target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')){const input=document.getElementById('search-input');if(input){event.preventDefault();input.focus();}}});
  const skip=document.createElement("a");skip.href="#main-content";skip.className="skip-link";skip.textContent="Bỏ qua menu";
  const main=document.querySelector("#page-home,.fd-page,.fd-container,main,.page");if(main){main.id=main.id||"main-content";skip.href="#"+main.id;main.tabIndex=-1;document.body.prepend(skip);
    skip.onclick=event=>{event.preventDefault();const active=document.querySelector('.page.active')||main;active.tabIndex=-1;active.focus();active.scrollIntoView({block:'start'});};
  }
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
    document.addEventListener("keydown",event=>{
      if(event.key!=="Tab"||!document.body.classList.contains("menu-open"))return;
      const items=[menuBtn,...sidebar.querySelectorAll('a[href],button,[tabindex="0"]')].filter(item=>item.getClientRects().length&&getComputedStyle(item).visibility!=="hidden");
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
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
