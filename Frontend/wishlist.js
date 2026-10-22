// ==========================================
// 1. CÁC HÀM XỬ LÝ AUTH, WATCHLIST & FAVORITE
// ==========================================

const WISHLIST_KEY = "my_wishlist";

// Khóa nhận diện phim: ưu tiên slug, nếu không có thì dùng title
function movieKey(m) {
  return (m && (m.slug || m.title)) || "";
}
function wishlistKey(movie) { return movieKey(movie); }

async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (response.ok) {
      localStorage.setItem("token", data.token);
      alert("Đăng nhập thành công!");
    } else {
      alert(data.message || "Đăng nhập thất bại!");
    }
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
  }
}

// Đọc wishlist an toàn: dữ liệu hỏng thì trả về mảng rỗng, không làm crash trang
function getWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (typeof PersonalData !== "undefined") return PersonalData.normalize({my_wishlist:list}).my_wishlist;
    return Array.isArray(list) ? list.filter(item => item && typeof item === "object" && (typeof item.slug === "string" || typeof item.title === "string")) : [];
  } catch (e) {
    console.warn("Chưa đọc được danh sách yêu thích:", e);
    return [];
  }
}

// Lưu wishlist, bắt lỗi khi đầy bộ nhớ (QuotaExceededError)
function saveWishlist(list) {
  try {
    const cleaned = typeof PersonalData !== "undefined" ? PersonalData.normalize({my_wishlist:list}).my_wishlist : list;
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(cleaned));
    return true;
  } catch (e) {
    console.error("Không lưu được wishlist (đầy bộ nhớ?):", e);
    alert("Không lưu được danh sách vì bộ nhớ trình duyệt bị chặn hoặc đã đầy.");
    return false;
  }
}

// Không giới hạn số lượng phim trong wishlist
function toggleWishlist(movie) {
  if (!movie || !movieKey(movie)) return;
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("invalid wishlist");
      if (typeof PersonalData !== "undefined") PersonalData.normalize({my_wishlist:parsed}, true);
    }
  } catch (_) {
    alert("Chưa đọc được danh sách yêu thích cũ. Dữ liệu được giữ nguyên; mở Thư viện để kiểm tra hoặc khôi phục bản sao.");
    return;
  }
  const wishlist = getWishlist();
  const key = movieKey(movie);
  const index = wishlist.findIndex((item) => movieKey(item) === key);

  if (index !== -1) {
    wishlist.splice(index, 1);
  } else {
    // Chỉ lưu các trường cần thiết, cắt desc để tiết kiệm dung lượng
    wishlist.push({
      title: movie.title,
      poster: movie.poster,
      desc: (movie.desc || "").slice(0, 300),
      episodes: movie.episodes,
      slug: movie.slug || "",
      addedAt: Date.now(),
    });
  }

  if (!saveWishlist(wishlist)) return;

  updateWishlistUI();

  const wishlistPage = document.getElementById("page-wishlist");
  if (wishlistPage && wishlistPage.classList.contains("active")) {
    renderWishlistPage();
  }

  toggleFavoriteBackend(movie.slug || movie.title);
}

async function toggleFavoriteBackend(movieId) {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;
    await fetch(`${API_BASE_URL}/api/watchlist/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ movieId }),
    });
  } catch (err) {
    console.error("Lỗi đồng bộ wishlist backend:", err);
  }
}

// HTML nút TIM nằm ngay trên poster (luôn thấy được cả trên điện thoại).
// Bấm = thêm / xóa phim khỏi "Danh sách của tôi" (lưu localStorage: my_wishlist).
function cardHeartHtml(movie) {
  const t = escapeForInlineHandler(movie.title);
  const d = escapeForInlineHandler(movie.desc || "");
  const p = escapeForInlineHandler(movie.poster || "");
  const s = escapeForInlineHandler(movie.slug || "");
  return `<button type="button" class="card-heart" title="Thêm vào danh sách của tôi" aria-label="Thêm hoặc xóa khỏi danh sách yêu thích" onclick="event.stopPropagation(); toggleWishlist({title: '${t}', poster: '${p}', desc: '${d}', episodes: ${getTotalEpisodes(movie)}, slug: '${s}'})"><i class="fa-regular fa-heart"></i></button>`;
}

// Đồng bộ trạng thái tim (trên poster + trong hover-card) của TẤT CẢ thẻ phim
// với danh sách yêu thích hiện tại.
function updateWishlistUI() {
  const wishlist = getWishlist();
  const favTitles = new Set(wishlist.map((item) => item.title));
  const favSlugs = new Set(wishlist.map((item) => item.slug).filter((s) => s));

  document.querySelectorAll(".movie-card").forEach((card) => {
    const hoverHeart = card.querySelector(".btn-hover.icon");
    const posterHeart = card.querySelector(".card-heart");
    if (!hoverHeart && !posterHeart) return;

    const titleEl =
      card.querySelector(".hover-title") ||
      card.querySelector("h3") ||
      card.querySelector("h4");
    const title =
      card.dataset.title || (titleEl ? titleEl.innerText.trim() : "");
    if (!title) return;

    // Ưu tiên so theo slug (nếu thẻ có data-slug), nếu không thì so theo title
    const slug = card.dataset.slug || "";
    const isFav = slug ? favSlugs.has(slug) : favTitles.has(title);

    // Tim trong hover-card (giữ nguyên cách hiển thị cũ)
    if (hoverHeart) {
      const icon = hoverHeart.querySelector("i");
      if (icon) {
        icon.className = isFav ? "fa-solid fa-heart" : "fa-regular fa-heart";
        icon.style.color = isFav ? "#e50914" : "";
      }
    }

    // Tim trên poster
    if (posterHeart) {
      const symbol=posterHeart.querySelector('.heart-symbol');if(symbol)symbol.textContent=isFav?'♥':'♡';
      posterHeart.classList.toggle("active", isFav);
      posterHeart.setAttribute("aria-pressed", String(isFav));
      posterHeart.title = isFav
        ? "Xóa khỏi danh sách của tôi"
        : "Thêm vào danh sách của tôi";
      const icon = posterHeart.querySelector("i");
      if (icon) {
        icon.className = isFav ? "fa-solid fa-heart" : "fa-regular fa-heart";
      }
    }
  });
}

// Đồng bộ giữa các tab: thêm / xóa tim ở tab này thì tab khác tự cập nhật theo
window.addEventListener("storage", (e) => {
  if (e.key && e.key !== WISHLIST_KEY) return;
  updateWishlistUI();

  const wishlistPage = document.getElementById("page-wishlist");
  if (wishlistPage && wishlistPage.classList.contains("active")) {
    renderWishlistPage();
  }
  // detail.html: nút "Theo dõi"
  if (typeof fdUpdateFollowUI === "function") fdUpdateFollowUI();
});

function renderWishlistPage() {
  const container = document.getElementById("wishlist-container");
  if (!container) return;

  const wishlist = getWishlist();
  container.innerHTML = "";

  if (wishlist.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 0; color: #888;">
        <i class="fa-regular fa-heart" style="font-size: 3rem; margin-bottom: 15px;"></i>
        <p>Danh sách của bạn đang trống. Hãy thêm những bộ phim yêu thích vào đây nhé!</p>
      </div>
    `;
    return;
  }

  wishlist.forEach((movie) => {
    if (typeof createMovieCard === "function") {
      container.appendChild(createMovieCard(movie));
      return;
    }
    const card = document.createElement("div");
    card.className = "movie-card";
    card.dataset.title = movie.title;
    if (movie.slug) card.dataset.slug = movie.slug;
    card.onclick = () =>
      showDetail(
        movie.title,
        movie.poster,
        movie.desc,
        getTotalEpisodes(movie),
        movie.slug || "",
      );

    const safeTitle = escapeHtml(movie.title);
    const safeDesc = escapeHtml(movie.desc || "");
    const handlerTitle = escapeForInlineHandler(movie.title);
    const handlerDesc = escapeForInlineHandler(movie.desc || "");
    const handlerPoster = escapeForInlineHandler(movie.poster || "");
    const handlerSlug = escapeForInlineHandler(movie.slug || "");

    card.innerHTML = `
      <img src="${escapeHtml(movie.poster || "Img/poster-placeholder.svg")}" alt="${safeTitle}" onerror="this.onerror=null;this.src='Img/poster-placeholder.svg'" />
      ${cardHeartHtml(movie)}
      <h4>${safeTitle}</h4>
      <div class="movie-hover-card">
        <img src="${escapeHtml(movie.poster || "Img/poster-placeholder.svg")}" alt="${safeTitle}" class="hover-banner" onerror="this.onerror=null;this.src='Img/poster-placeholder.svg'" />
        <div class="hover-content">
          <h3 class="hover-title">${safeTitle}</h3>
          <div class="hover-actions">
            <button class="btn-hover play" onclick="event.stopPropagation(); playEpisodeDirect('${handlerTitle}', 1, ${getTotalEpisodes(movie)}, '${handlerSlug}')">
              <i class="fa-solid fa-play"></i> Xem ngay
            </button>
            <button
              class="btn-hover icon"
              title="Xóa khỏi danh sách"
              onclick="event.stopPropagation(); toggleWishlist({title: '${handlerTitle}', poster: '${handlerPoster}', desc: '${handlerDesc}', episodes: ${getTotalEpisodes(movie)}, slug: '${handlerSlug}'})"
            >
              <i class="fa-solid fa-heart" style="color: #e50914;"></i>
            </button>
          </div>
          <p class="hover-genres">${safeDesc}</p>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  updateWishlistUI();
}
