// ==========================================
// 1. CÁC HÀM XỬ LÝ AUTH, WATCHLIST & FAVORITE
// ==========================================

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

function getWishlist() {
  const wishlist = localStorage.getItem("my_wishlist");
  return wishlist ? JSON.parse(wishlist) : [];
}

function toggleWishlist(movie) {
  let wishlist = getWishlist();
  const index = wishlist.findIndex((item) => item.title === movie.title);

  if (index !== -1) {
    wishlist.splice(index, 1);
  } else {
    wishlist.push(movie);
  }

  localStorage.setItem("my_wishlist", JSON.stringify(wishlist));
  updateWishlistUI();

  const wishlistPage = document.getElementById("page-wishlist");
  if (wishlistPage && wishlistPage.classList.contains("active")) {
    renderWishlistPage();
  }

  toggleFavoriteBackend(movie.title);
}

async function toggleFavoriteBackend(movieId) {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
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
  return `<button type="button" class="card-heart" title="Thêm vào danh sách của tôi" aria-label="Thêm hoặc xóa khỏi danh sách yêu thích" onclick="event.stopPropagation(); toggleWishlist({title: '${t}', poster: '${movie.poster}', desc: '${d}', episodes: ${getTotalEpisodes(movie)}, slug: '${movie.slug || ""}'})"><i class="fa-regular fa-heart"></i></button>`;
}

// Đồng bộ trạng thái tim (trên poster + trong hover-card) của TẤT CẢ thẻ phim
// với danh sách yêu thích hiện tại.
function updateWishlistUI() {
  const favTitles = new Set(getWishlist().map((item) => item.title));

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

    const isFav = favTitles.has(title);

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
      posterHeart.classList.toggle("active", isFav);
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
  if (e.key && e.key !== "my_wishlist") return;
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
    const card = document.createElement("div");
    card.className = "movie-card";
    card.dataset.title = movie.title;
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

    card.innerHTML = `
      <img src="${movie.poster}" alt="${safeTitle}" onerror="this.src='https://placehold.co/350x500'" />
      ${cardHeartHtml(movie)}
      <h4>${safeTitle}</h4>
      <div class="movie-hover-card">
        <img src="${movie.poster}" alt="${safeTitle}" class="hover-banner" onerror="this.src='https://placehold.co/350x500'" />
        <div class="hover-content">
          <h3 class="hover-title">${safeTitle}</h3>
          <div class="hover-actions">
            <button class="btn-hover play" onclick="event.stopPropagation(); playEpisodeDirect('${handlerTitle}', 1, ${getTotalEpisodes(movie)}, '${movie.slug || ""}')">
              <i class="fa-solid fa-play"></i> Xem ngay
            </button>
            <button
              class="btn-hover icon"
              title="Xóa khỏi danh sách"
              onclick="event.stopPropagation(); toggleWishlist({title: '${handlerTitle}', poster: '${movie.poster}', desc: '${handlerDesc}', episodes: ${getTotalEpisodes(movie)}, slug: '${movie.slug || ""}'})"
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
