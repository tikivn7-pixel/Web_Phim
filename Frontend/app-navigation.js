// Shared navigation only: no catalog fetches, storage writes, or playback shortcuts.
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AppNavigation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  const ACTIONS = Object.freeze([
    { id: "comics", label: "Đọc truyện", description: "Kho truyện, chương và tiến độ đọc", href: "comics.html", keywords: "manga comic truyen doc chuong" },
    { id: "home", label: "Trang chủ", description: "Tiếp tục xem và gợi ý theo gu", href: "index.html", keywords: "home trang dau" },
    { id: "discover", label: "Khám phá phim", description: "Tìm kiếm, thể loại, quốc gia và năm", href: "discover.html", keywords: "tim kiem kho phim the loai quoc gia loc" },
    { id: "collections", label: "Loạt phim", description: "Các phần đã được liên kết chính xác", href: "collections.html", keywords: "series collection nhom phan phim" },
    { id: "picker", label: "Tối nay xem gì?", description: "Chọn một phim theo tâm trạng của bạn", href: "picker.html", keywords: "chon phim ngau nhien random goi y" },
    { id: "updates", label: "Tập mới", description: "Kiểm tra cập nhật của phim bạn theo dõi", href: "updates.html", keywords: "cap nhat theo doi episode" },
    { id: "library", label: "Thư viện cá nhân", description: "Yêu thích, tiến độ, nhật ký và sao lưu", href: "library.html", keywords: "yeu thich muon xem dang xem da xem sao luu khoi phuc" },
    { id: "lists", label: "Danh sách riêng", description: "Sắp xếp các phim muốn xem cùng nhau", href: "lists.html", keywords: "playlist cuoi tuan" },
    { id: "notes", label: "Sổ tay phim", description: "Ghi chú, cảm nhận và các cảnh đã lưu", href: "notes.html", keywords: "ghi chu canh danh dau bookmark spoiler" },
    { id: "stats", label: "Thống kê gu phim", description: "Nhìn lại phim và tập đã theo dõi", href: "stats.html", keywords: "thong ke bao cao gu bieu do nhat ky" },
    { id: "manage", label: "Quản lý kho phim", description: "Thêm phim, nhập nguồn và sửa dữ liệu", href: "manage.html", keywords: "them phim nhap import quan ly catalog" },
  ].map(Object.freeze));

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
  }
  function cleanQuery(value) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, 180); }
  function searchHref(query) {
    const value = cleanQuery(query);
    return "discover.html" + (value ? "?" + new URLSearchParams({ q: value }) : "");
  }
  function searchActions(query) {
    const text = cleanQuery(query), terms = normalize(text).split(" ").filter(Boolean);
    const found = ACTIONS.filter(action => terms.every(term => normalize(action.label + " " + action.description + " " + action.keywords).includes(term)));
    if (!text) return found.map(action => ({ ...action }));
    return [...found.map(action => ({ ...action })), { id: "film-search", label: "Tìm phim “" + text + "”", description: "Tìm trong toàn bộ kho phim", href: searchHref(text) }];
  }
  function activePage(pathname, search = "") {
    const file = String(pathname || "").split("/").pop() || "index.html";
    if (file === "index.html") {
      const params = new URLSearchParams(search);
      if (params.get("view") === "wishlist" || params.get("page") === "wishlist") return "library";
      if (params.get("view") === "catalog" || ["q", "country", "genre", "year", "type", "sort", "p"].some(key => params.has(key))) return "discover";
      return "home";
    }
    return ACTIONS.find(action => action.href === file)?.id || "";
  }
  const api = { ACTIONS, normalize, cleanQuery, searchHref, searchActions, activePage };
  if (!root.document) return api;

  function mount() {
    const doc = root.document;
    if (!doc.body || doc.getElementById("app-quick-dialog")) return;
    let previousFocus = null;
    const element = (name, className, text) => {
      const item = doc.createElement(name);
      if (className) item.className = className;
      if (text !== undefined) item.textContent = text;
      return item;
    };
    const button = (className, label) => {
      const item = element("button", className, label); item.type = "button";
      item.setAttribute("aria-haspopup", "dialog"); item.setAttribute("aria-controls", "app-quick-dialog");
      item.addEventListener("click", () => api.open(item)); return item;
    };
    const launcher = button("app-quick-launch app-quick-desktop", "Mở nhanh ");
    launcher.append(element("kbd", "", "Ctrl K")); launcher.title = "Mở nhanh (Ctrl + K hoặc ⌘ + K)";
    const nav = element("nav", "app-bottom-nav"); nav.id = "app-bottom-nav"; nav.setAttribute("aria-label", "Điều hướng nhanh");
    const icons = { home: "⌂", discover: "⌕", updates: "◷", library: "▤" };
    for (const id of ["home", "discover", "updates", "library"]) {
      const action = ACTIONS.find(item => item.id === id);
      const link = element("a", "app-bottom-link"); link.href = action.href; link.dataset.page = id;
      const icon = element("span", "app-bottom-icon", icons[id]); icon.setAttribute("aria-hidden", "true");
      link.append(icon, element("span", "app-bottom-label", id === "discover" ? "Khám phá" : id === "library" ? "Thư viện" : action.label)); nav.append(link);
    }
    const mobileLauncher = button("app-quick-launch app-bottom-link", "");
    const moreIcon = element("span", "app-bottom-icon", "•••"); moreIcon.setAttribute("aria-hidden", "true");
    mobileLauncher.append(moreIcon, element("span", "app-bottom-label", "Mở nhanh")); nav.append(mobileLauncher);

    const dialog = element("dialog", "app-quick-dialog"); dialog.id = "app-quick-dialog";
    dialog.setAttribute("aria-labelledby", "app-quick-heading");
    const header = element("div", "app-quick-heading-row");
    const heading = element("h2", "", "Bạn muốn đến đâu?"); heading.id = "app-quick-heading";
    const close = element("button", "app-quick-close", "×"); close.type = "button"; close.setAttribute("aria-label", "Đóng mở nhanh"); close.addEventListener("click", () => api.close()); header.append(heading, close);
    const label = element("label", "app-quick-label", "Tìm phim hoặc mở một tính năng"); label.htmlFor = "app-quick-search";
    const input = element("input", "app-quick-search"); input.id = "app-quick-search"; input.type = "search"; input.maxLength = 180; input.autocomplete = "off"; input.spellcheck = false;
    input.placeholder = "Tên phim, ghi chú, tập mới…"; input.setAttribute("enterkeyhint", "go"); input.setAttribute("aria-controls", "app-quick-results");
    const results = element("nav", "app-quick-results"); results.id = "app-quick-results"; results.setAttribute("aria-label", "Kết quả mở nhanh");
    const status = element("p", "app-quick-status"); status.id = "app-quick-status"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    const hint = element("p", "app-quick-hint", "↑ ↓ di chuyển · Enter mở · Esc đóng");
    dialog.append(header, label, input, results, status, hint);
    doc.body.append(nav, launcher, dialog);
    doc.body.style.setProperty("--app-navigation-original-bottom", root.getComputedStyle(doc.body).paddingBottom);
    doc.body.classList.add("has-app-navigation"); doc.documentElement.classList.add("has-app-navigation");

    const refreshActive = () => {
      const active = activePage(root.location.pathname, root.location.search);
      nav.querySelectorAll("a").forEach(link => {
        if (link.dataset.page === active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      results.querySelectorAll("a[data-page]").forEach(link => {
        if (link.dataset.page === active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    };
    const render = () => {
      results.replaceChildren();
      const actions = searchActions(input.value);
      for (const action of actions) {
        const link = element("a", "app-quick-result"); link.href = action.href; link.dataset.page = action.id;
        const copy = element("span", "app-quick-result-copy"); copy.append(element("strong", "", action.label), element("span", "", action.description));
        const arrow = element("span", "app-quick-result-arrow", "↗"); arrow.setAttribute("aria-hidden", "true"); link.append(copy, arrow); results.append(link);
      }
      status.textContent = cleanQuery(input.value) ? (actions.length - 1) + " lối tắt phù hợp · 1 lựa chọn tìm phim" : "10 lối tắt cho kho phim của bạn";
      refreshActive();
    };
    const blocked = () => !!doc.fullscreenElement || doc.body.classList.contains("theater-mode") || doc.body.classList.contains("menu-open") || !!doc.querySelector(".plyr--fullscreen-active");
    api.open = from => {
      if (dialog.open) { input.focus(); return true; }
      const otherModal = [...doc.querySelectorAll("dialog[open], [aria-modal='true']:not([hidden])")]
        .some(item => item !== dialog && item.getClientRects().length && root.getComputedStyle(item).visibility !== "hidden");
      if (blocked() || otherModal) return false;
      previousFocus = from?.isConnected ? from : doc.activeElement;
      input.value = ""; render(); dialog.showModal(); input.focus();
      return true;
    };
    function restoreFocus() {
      // A queued close event from an older opening must not steal focus from
      // a palette that has already been opened again.
      if(dialog.open)return;
      const target=previousFocus;previousFocus=null;
      if(target?.isConnected&&!blocked())target.focus({preventScroll:true});
    }
    api.close = () => { if (dialog.open) { dialog.close(); restoreFocus(); } };
    input.addEventListener("input", render);
    dialog.addEventListener('close',restoreFocus);
    dialog.addEventListener('cancel',event=>{event.preventDefault();api.close();});
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) api.close();
    });
    dialog.addEventListener("keydown", event => {
      // Keep an open palette from reaching older player keyboard handlers.
      event.stopPropagation();
      if (event.isComposing || event.altKey) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); api.close(); return; }
      if (event.ctrlKey || event.metaKey) return;
      const links = [...results.querySelectorAll("a")], current = links.indexOf(doc.activeElement);
      let target = null;
      if (event.key === "ArrowDown") target = links[(current + 1) % links.length];
      else if (event.key === "ArrowUp") target = links[(current < 0 ? links.length - 1 : current - 1 + links.length) % links.length];
      else if (event.key === "Home" && current >= 0) target = links[0];
      else if (event.key === "End" && current >= 0) target = links[links.length - 1];
      else if (event.key === "Enter" && event.target === input) { event.preventDefault(); links[0]?.click(); return; }
      if (target) { event.preventDefault(); target.focus(); }
    });
    doc.addEventListener("keydown", event => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.repeat || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      if (api.open()) event.preventDefault();
    });
    const fullscreenChanged = () => {
      const hidden = blocked(); doc.body.classList.toggle("app-navigation-immersive", hidden);
      if (hidden) api.close();
    };
    doc.addEventListener("fullscreenchange", fullscreenChanged);
    new MutationObserver(fullscreenChanged).observe(doc.body, { attributes: true, attributeFilter: ["class"] });
    root.addEventListener("popstate", refreshActive); root.addEventListener("pageshow", refreshActive);
    root.navigation?.addEventListener("navigatesuccess", refreshActive);
    // Existing catalog controls update history without leaving index.html.
    doc.addEventListener("click", () => root.setTimeout(refreshActive, 0));
    render(); fullscreenChanged();
  }
  api.open = () => false; api.close = () => {};
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
  return api;
});
