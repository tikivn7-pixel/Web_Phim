// ==========================================
// AUTH: ĐĂNG KÝ / ĐĂNG NHẬP / ĐĂNG XUẤT + CẬP NHẬT NAVBAR
// ==========================================
(function initAuth() {
  const TOKEN_KEY = "token";
  const USER_KEY = "username";

  const apiBase = () =>
    typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "";

  // ---------- Tiện ích token ----------
  const getToken = () => {try{return localStorage.getItem(TOKEN_KEY);}catch(e){return null;}};
  const getUsername = () => {try{return localStorage.getItem(USER_KEY);}catch(e){return null;}};

  function saveSession(token, username) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, username);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function postJSON(path, body) {
    if(!apiBase())throw Error("Tài khoản chưa được bật. Bạn vẫn có thể lưu yêu thích và sao lưu trong Thư viện.");
    const res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (e) {}
    if (!res.ok) throw new Error(data.message || "Có lỗi xảy ra, thử lại sau!");
    return data;
  }

  // ---------- CSS ----------
  const style = document.createElement("style");
  style.textContent = `
    .auth-area { display:flex; align-items:center; gap:10px; margin-left:15px; white-space:nowrap; }
    .auth-btn { background:#e50914; color:#fff; border:none; border-radius:4px; padding:8px 14px;
      font-size:14px; font-weight:600; cursor:pointer; transition:background .2s; }
    .auth-btn:hover { background:#f6121d; }
    .auth-btn.ghost { background:transparent; border:1px solid #777; }
    .auth-btn.ghost:hover { background:rgba(255,255,255,.1); }
    .auth-user { color:#fff; font-size:14px; display:flex; align-items:center; gap:6px; max-width:140px;
      overflow:hidden; text-overflow:ellipsis; }

    .auth-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75); display:none;
      align-items:center; justify-content:center; z-index:10000; padding:15px; }
    .auth-overlay.open { display:flex; }
    .auth-box { background:#181818; color:#fff; width:100%; max-width:380px; border-radius:10px;
      padding:28px 26px; position:relative; box-shadow:0 10px 40px rgba(0,0,0,.6); }
    .auth-close { position:absolute; top:10px; right:14px; background:none; border:none; color:#aaa;
      font-size:20px; cursor:pointer; }
    .auth-close:hover { color:#fff; }
    .auth-tabs { display:flex; margin-bottom:20px; border-bottom:1px solid #333; }
    .auth-tab { flex:1; background:none; border:none; color:#999; padding:10px 0; font-size:16px;
      font-weight:600; cursor:pointer; border-bottom:3px solid transparent; }
    .auth-tab.active { color:#fff; border-bottom-color:#e50914; }
    .auth-form { display:none; flex-direction:column; gap:12px; }
    .auth-form.active { display:flex; }
    .auth-form input { background:#2b2b2b; border:1px solid #3a3a3a; color:#fff; border-radius:5px;
      padding:11px 12px; font-size:15px; outline:none; }
    .auth-form input:focus { border-color:#e50914; }
    .auth-submit { background:#e50914; color:#fff; border:none; border-radius:5px; padding:12px;
      font-size:16px; font-weight:700; cursor:pointer; margin-top:4px; }
    .auth-submit:disabled { opacity:.6; cursor:not-allowed; }
    .auth-msg { min-height:18px; font-size:13px; color:#ff6b6b; text-align:center; margin-top:10px; }
    .auth-msg.ok { color:#46d369; }
    @media (max-width: 768px) { .auth-user { display:none; } .auth-area { margin-left:8px; } }
  `;
  document.head.appendChild(style);

  // ---------- Modal ----------
  const overlay = document.createElement("div");
  overlay.className = "auth-overlay";
  overlay.innerHTML = `
    <div class="auth-box" role="dialog" aria-modal="true">
      <button type="button" class="auth-close" aria-label="Đóng">&times;</button>
      <div class="auth-tabs">
        <button type="button" class="auth-tab active" data-tab="login">Đăng nhập</button>
        <button type="button" class="auth-tab" data-tab="register">Đăng ký</button>
      </div>

      <form class="auth-form active" id="auth-login-form" autocomplete="on">
        <input type="text" name="identifier" placeholder="Email hoặc tên đăng nhập" required autocomplete="username" />
        <input type="password" name="password" placeholder="Mật khẩu" required autocomplete="current-password" />
        <button type="submit" class="auth-submit">Đăng nhập</button>
      </form>

      <form class="auth-form" id="auth-register-form" autocomplete="on">
        <input type="text" name="username" placeholder="Tên đăng nhập (3-30 ký tự)" required autocomplete="username" />
        <input type="email" name="email" placeholder="Email" required autocomplete="email" />
        <input type="password" name="password" placeholder="Mật khẩu (tối thiểu 6 ký tự)" required autocomplete="new-password" />
        <input type="password" name="confirm" placeholder="Nhập lại mật khẩu" required autocomplete="new-password" />
        <button type="submit" class="auth-submit">Tạo tài khoản</button>
      </form>

      <div class="auth-msg" id="auth-msg"></div>
    </div>
  `;

  function setMsg(text, ok = false) {
    const el = overlay.querySelector("#auth-msg");
    el.textContent = text || "";
    el.classList.toggle("ok", ok);
  }

  function switchTab(tab) {
    overlay
      .querySelectorAll(".auth-tab")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    overlay
      .querySelector("#auth-login-form")
      .classList.toggle("active", tab === "login");
    overlay
      .querySelector("#auth-register-form")
      .classList.toggle("active", tab === "register");
    setMsg("");
  }

  function openAuthModal(tab = "login") {
    switchTab(tab);
    overlay.classList.add("open");
    const first = overlay.querySelector(".auth-form.active input");
    if (first) setTimeout(() => first.focus(), 50);
  }

  function closeAuthModal() {
    overlay.classList.remove("open");
  }

  // ---------- Navbar ----------
  const authArea = document.createElement("div");
  authArea.className = "auth-area";

  function renderAuthArea() {
    authArea.innerHTML = "";
    if(!apiBase()){
      const backup=document.createElement("a");backup.className="auth-btn";backup.href="library.html#backup";backup.textContent="Sao lưu dữ liệu";backup.style.textDecoration="none";authArea.append(backup);return;
    }
    if (getToken()) {
      const user = document.createElement("span");
      user.className = "auth-user";
      user.innerHTML = '<i class="fa-solid fa-user"></i>';
      const name = document.createElement("span");
      name.textContent = getUsername() || "Tài khoản"; // textContent: chống XSS
      user.appendChild(name);

      const out = document.createElement("button");
      out.type = "button";
      out.className = "auth-btn ghost";
      out.textContent = "Đăng xuất";
      out.onclick = logout;

      authArea.append(user, out);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "auth-btn";
      btn.textContent = "Đăng nhập / Đăng ký";
      btn.onclick = () => openAuthModal("login");
      authArea.appendChild(btn);
    }
  }

  function logout() {
    clearSession();
    renderAuthArea();
    window.dispatchEvent(new Event("auth:changed"));
  }

  // Xác minh token còn hiệu lực với server (GET /api/auth/me)
  async function verifySession() {
    if(!apiBase())return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${apiBase()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        clearSession(); // token hết hạn / sai / user đã bị xóa
      } else if (res.ok) {
        const data = await res.json();
        if (data.user && data.user.username) {
          localStorage.setItem(USER_KEY, data.user.username);
        }
      }
    } catch (e) {
      // Mất mạng / backend chưa chạy: giữ nguyên trạng thái, không đăng xuất oan
      console.warn("Không kiểm tra được phiên đăng nhập:", e);
    }
    renderAuthArea();
  }

  // ---------- Xử lý submit ----------
  async function handleLogin(identifier, password, submitBtn) {
    submitBtn.disabled = true;
    try {
      const data = await postJSON("/api/auth/login", { identifier, password });
      saveSession(data.token, data.username);
      closeAuthModal();
      renderAuthArea();
      window.dispatchEvent(new Event("auth:changed"));
    } catch (err) {
      setMsg(err.message);
    } finally {
      submitBtn.disabled = false;
    }
  }

  function bindForms() {
    overlay
      .querySelector("#auth-login-form")
      .addEventListener("submit", (e) => {
        e.preventDefault();
        const f = e.target;
        setMsg("");
        handleLogin(
          f.identifier.value.trim(),
          f.password.value,
          f.querySelector(".auth-submit"),
        );
      });

    overlay
      .querySelector("#auth-register-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target;
        const btn = f.querySelector(".auth-submit");
        const username = f.username.value.trim();
        const email = f.email.value.trim();
        const password = f.password.value;

        if (password !== f.confirm.value) {
          setMsg("Mật khẩu nhập lại không khớp!");
          return;
        }

        btn.disabled = true;
        setMsg("");
        try {
          await postJSON("/api/auth/register", { username, email, password });
          setMsg("Đăng ký thành công! Đang đăng nhập...", true);
          await handleLogin(username, password, btn); // tự đăng nhập luôn
          f.reset();
        } catch (err) {
          setMsg(err.message);
        } finally {
          btn.disabled = false;
        }
      });

    overlay.querySelectorAll(".auth-tab").forEach((b) => {
      b.addEventListener("click", () => switchTab(b.dataset.tab));
    });
    overlay
      .querySelector(".auth-close")
      .addEventListener("click", closeAuthModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeAuthModal();
    });
    // Không cho tv-nav.js (điều hướng remote) bắt phím mũi tên/Enter khi đang gõ trong modal
    overlay.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") closeAuthModal();
    });
  }

  // ---------- Khởi động ----------
  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(overlay);
    bindForms();

    const navbar = document.querySelector(".navbar");
    if (navbar) navbar.appendChild(authArea);
    renderAuthArea();
    verifySession();
  });

  // Cho các file khác dùng
  window.openAuthModal = openAuthModal;
  window.logout = logout;
  window.isLoggedIn = () => !!getToken();
  window.getAuthToken = getToken;
})();
