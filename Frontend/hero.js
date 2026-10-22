// Today's selection uses explicit catalog slugs; no title-prefix grouping.
let currentHeroIndex = 0;
let heroInterval = null;
let heroPaused = false;
let heroHovered = false;

const HERO_SELECTION = [
  'thanh-guom-diet-quy-vo-han-thanh',
  'vincenzo',
  'nguoi-nhen-du-hanh-vu-tru-nhen',
  'co-gai-the-ky-20',
  'dai-chien-nguoi-khong-lo-phan-1',
  'quat-mo-trung-ma',
  'ten-cau-la-gi',
  'cua-hang-sat-thu-phan-1',
];

function getDailyFeaturedList(movies, count = 4, timestamp = Date.now()) {
  if (!movies || !movies.length) return [];
  const bySlug = new Map(movies.map(movie => [movie.slug, movie]));
  const curated = HERO_SELECTION.map(slug => bySlug.get(slug)).filter(Boolean);
  const pool = curated.length >= Math.min(count, movies.length) ? curated : movies;
  const start = Math.floor(timestamp / 86400000) % pool.length;
  return Array.from({ length: Math.min(Math.max(0, count), pool.length) }, (_, index) => pool[(start + index) % pool.length]);
}

function updateHeroBanner(index, featuredList) {
  const list = featuredList || window.currentHeroFeatured;
  if (!list || !list.length) return;
  index = ((index % list.length) + list.length) % list.length;
  const movie = list[index];
  const hero = document.getElementById('hero-banner');
  if (!hero) return;
  hero.style.backgroundImage = 'url(' + JSON.stringify(SiteTools.imageUrl(movie.poster)) + ')';
  hero.dataset.slug = movie.slug;
  document.getElementById('hero-title').textContent = movie.title;
  const description = movie.desc && movie.desc.length > movie.title.length + 35
    ? movie.desc
    : 'Một lựa chọn cho hôm nay. Bước vào thế giới ' + String(movie.genres || 'điện ảnh').split(',').slice(0, 3).map(value => value.trim().toLowerCase()).join(', ') + ' cùng ' + movie.title + '.';
  document.getElementById('hero-desc').textContent = description;

  const meta = document.getElementById('hero-meta');
  if (meta) {
    meta.replaceChildren();
    const type = movie.type === 'animation' ? 'Anime / Hoạt hình' : Number(movie.episodes) > 1 ? 'Phim bộ' : 'Phim lẻ';
    [movie.year, movie.country, type, Number(movie.episodes) > 1 ? movie.episodes + ' tập' : ''].filter(Boolean).forEach(value => {
      const item = document.createElement('span'); item.textContent = value; meta.append(item);
    });
  }
  const genres = document.getElementById('hero-genres');
  if (genres) {
    genres.replaceChildren();
    String(movie.genres || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 3).forEach(genre => {
      const link = document.createElement('a'); link.textContent = genre;
      link.href = 'index.html?' + new URLSearchParams({ view: 'catalog', genre }); genres.append(link);
    });
  }
  const art = document.getElementById('hero-featured-posters');
  if (art) {
    art.replaceChildren();
    const positions = list.length > 2 ? [-1, 0, 1] : [0];
    positions.forEach(position => {
      const itemIndex = (index + position + list.length) % list.length, item = list[itemIndex];
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'hero-poster-choice ' + (position === 0 ? 'is-selected' : position < 0 ? 'is-before' : 'is-after');
      button.setAttribute('aria-label', position === 0 ? 'Thông tin phim: ' + item.title : 'Chọn phim: ' + item.title);
      const image = document.createElement('img'); image.alt = item.title; image.width = 280; image.height = 420;
      image.decoding = 'async'; image.referrerPolicy = 'no-referrer'; image.fetchPriority = position === 0 ? 'high' : 'low';
      SiteTools.setPoster(image, item);
      button.append(image);
      button.onclick = () => {
        if (position === 0) { document.getElementById('hero-info-btn').click(); return; }
        currentHeroIndex = itemIndex; updateHeroBanner(itemIndex, list); resetHeroTimer();
      };
      art.append(button);
    });
  }
  const play = document.getElementById('hero-play-btn');
  if (play) play.onclick = () => playEpisodeDirect(movie.title, 1, getTotalEpisodes(movie), movie.slug);
  const info = document.getElementById('hero-info-btn');
  if (info) info.onclick = () => showDetail(movie.title, movie.poster, movie.desc, getTotalEpisodes(movie), movie.slug);
  const counter = document.getElementById('hero-index');
  if (counter) counter.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0');
  document.querySelectorAll('.hero-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
    dot.setAttribute('aria-pressed', String(i === index));
  });
}

function initHeroSlider(preloadedMovies) {
  const hero = document.getElementById('hero-banner');
  const pool = preloadedMovies && preloadedMovies.length ? preloadedMovies : globalMoviesList;
  if (!hero || !pool || !pool.length) return;
  let dots = hero.querySelector('.hero-dots');
  if (!dots) { dots = document.createElement('div'); dots.className = 'hero-dots'; dots.setAttribute('aria-label', 'Chọn phim nổi bật'); hero.append(dots); }
  dots.replaceChildren();
  const featured = getDailyFeaturedList(pool, 4);
  window.currentHeroFeatured = featured;
  featured.forEach((movie, index) => {
    const dot = document.createElement('button'); dot.type = 'button';
    dot.className = 'hero-dot'; dot.setAttribute('aria-label', 'Chọn phim: ' + movie.title);
    dot.onclick = () => { currentHeroIndex = index; updateHeroBanner(index, featured); resetHeroTimer(); };
    dots.append(dot);
  });
  currentHeroIndex = 0;
  if (!hero.querySelector('.hero-pause')) {
    const pause = document.createElement('button'); pause.type = 'button'; pause.className = 'hero-pause';
    heroPaused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const update = () => {
      pause.textContent = heroPaused ? '▶ Phát trình chiếu' : 'Ⅱ Tạm dừng';
      pause.setAttribute('aria-pressed', String(heroPaused));
      pause.setAttribute('aria-label', heroPaused ? 'Phát trình chiếu phim' : 'Tạm dừng trình chiếu phim');
    };
    pause.onclick = () => { heroPaused = !heroPaused; update(); startHeroTimer(); }; update(); hero.append(pause);
    hero.addEventListener('mouseenter', () => { heroHovered = true; clearInterval(heroInterval); });
    hero.addEventListener('mouseleave', () => { heroHovered = false; startHeroTimer(); });
    hero.addEventListener('focusin', () => clearInterval(heroInterval));
    hero.addEventListener('focusout', event => { if (!hero.contains(event.relatedTarget)) startHeroTimer(); });
    hero.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); currentHeroIndex = (currentHeroIndex + (event.key === 'ArrowLeft' ? -1 : 1) + featured.length) % featured.length;
      updateHeroBanner(currentHeroIndex, featured); resetHeroTimer();
      hero.querySelectorAll('.hero-dot')[currentHeroIndex]?.focus();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearInterval(heroInterval); else startHeroTimer(); });
  }
  updateHeroBanner(0, featured);
  startHeroTimer();
}

function startHeroTimer() {
  if (heroInterval) clearInterval(heroInterval);
  if (heroPaused || heroHovered || document.hidden || document.getElementById('hero-banner')?.contains(document.activeElement)) return;
  heroInterval = setInterval(() => {
    const featured = window.currentHeroFeatured || [];
    if (!featured.length) return;
    currentHeroIndex = (currentHeroIndex + 1) % featured.length;
    updateHeroBanner(currentHeroIndex, featured);
  }, 8000);
}
function resetHeroTimer() { clearInterval(heroInterval); startHeroTimer(); }
if (typeof module !== 'undefined' && module.exports) module.exports = { getDailyFeaturedList, HERO_SELECTION };
