(function (root) {
  const topics = [
    { id: 'animation', title: 'Thế giới Anime', subtitle: 'Những chuyến phiêu lưu không giới hạn', filter: { type: 'animation' }, preferred: 'dai-chien-nguoi-khong-lo-phan-1', accent: '#b6a0fc' },
    { id: 'korea', title: 'Một chút Hàn Quốc', subtitle: 'Từ rung động đến những màn đấu trí', filter: { country: 'Hàn Quốc' }, preferred: 'vincenzo', accent: '#f5a18d' },
    { id: 'action', title: 'Nhịp phim dồn dập', subtitle: 'Hành động & những cuộc đối đầu', filter: { genre: 'Hành Động' }, preferred: 'nguoi-nhen-du-hanh-vu-tru-nhen', accent: '#f47683' },
    { id: 'romance', title: 'Chạm đến cảm xúc', subtitle: 'Một câu chuyện tình cho hôm nay', filter: { genre: 'Tình Cảm' }, preferred: 'co-gai-the-ky-20', accent: '#eba4cc' },
    { id: 'mystery', title: 'Đi tìm lời giải', subtitle: 'Bí ẩn phía sau mỗi khung hình', filter: { genre: 'Bí Ẩn' }, preferred: 'mouse-ke-san-nguoi-ban-dien-anh', accent: '#7ac1d7' },
    { id: 'comedy', title: 'Bật phim, bật cười', subtitle: 'Để ngày dài nhẹ nhàng hơn', filter: { genre: 'Hài Hước' }, preferred: 'thanh-xuan-vat-va-chay-mai-uoc-mo', accent: '#e8c684' },
  ];
  function normalized(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
  }
  function matches(movie, filter) {
    if (filter.country && normalized(movie.country) !== normalized(filter.country)) return false;
    const genres = String(movie.genres || '').split(',').map(normalized);
    if (filter.genre && !genres.includes(normalized(filter.genre))) return false;
    const type = movie.type || (/anime|hoat hinh/.test(normalized(movie.genres)) ? 'animation' : Number(movie.episodes) === 1 ? 'single' : 'series');
    return !filter.type || type === filter.type;
  }
  function buildTopics(movies) {
    return topics.map(topic => {
      const items = movies.filter(movie => matches(movie, topic.filter));
      const poster = items.find(movie => movie.slug === topic.preferred) || items.find(movie => /^Img\//.test(movie.poster || '')) || items[0];
      return { ...topic, count: items.length, movie: poster };
    }).filter(topic => topic.count > 0);
  }
  function collectionPreviews(movies, limit = 3) {
    const groups = new Map();
    for (const movie of movies) {
      if (!movie.group || !movie.relationVerified) continue;
      if (!groups.has(movie.group)) groups.set(movie.group, []);
      groups.get(movie.group).push(movie);
    }
    const names = { 'demon-slayer': 'Thanh Gươm Diệt Quỷ', 'attack-on-titan': 'Đại Chiến Titan', 'spider-verse': 'Spider-Verse', 'hospital-playlist': 'Hospital Playlist' };
    return [...groups].filter(([, items]) => items.length >= 2)
      .sort((a, b) => {
        const rank = id => ['demon-slayer', 'spider-verse', 'attack-on-titan', 'hospital-playlist'].indexOf(id);
        return (rank(a[0]) < 0 ? 999 : rank(a[0])) - (rank(b[0]) < 0 ? 999 : rank(b[0])) || b[1].length - a[1].length;
      }).slice(0, limit).map(([id, items]) => {
        const ordered = [...items].sort((a, b) => (a.relationOrder ?? 999) - (b.relationOrder ?? 999));
        return { id, title: names[id] || ordered[0].title, count: ordered.length, movies: ordered };
      });
  }
  function pickMovie(movies, previousSlug, random = Math.random) {
    const available = movies.filter(movie => movie.slug && movie.slug !== previousSlug);
    const pool = available.length ? available : movies;
    return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
  }
  function catalogHref(filter) {
    return 'discover.html?' + new URLSearchParams(filter);
  }
  async function init() {
    if (!document.getElementById('home-discovery')) return;
    const status = document.getElementById('home-catalog-count');
    let movies;
    try { movies = await loadStaticCatalog(); }
    catch (_) { if (status) status.textContent = 'Khám phá câu chuyện tiếp theo của bạn'; return; }
    if (!movies.length) return;
    if (status) status.textContent = new Intl.NumberFormat('vi-VN').format(movies.length) + ' bộ phim · Vô vàn câu chuyện';
    const topicGrid = document.getElementById('home-topic-grid');
    buildTopics(movies).forEach(topic => {
      const link = document.createElement('a');
      link.className = 'home-topic-card'; link.href = catalogHref(topic.filter);
      link.style.setProperty('--topic-accent', topic.accent);
      const image = document.createElement('img');
      image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; image.width = 140; image.height = 210; image.referrerPolicy = 'no-referrer';
      SiteTools.setPoster(image, topic.movie);
      const copy = document.createElement('div'); copy.className = 'home-topic-copy';
      const count = document.createElement('span'); count.className = 'home-topic-count'; count.textContent = new Intl.NumberFormat('vi-VN').format(topic.count) + ' phim';
      const title = document.createElement('h3'); title.textContent = topic.title;
      const subtitle = document.createElement('p'); subtitle.textContent = topic.subtitle;
      const arrow = document.createElement('span'); arrow.className = 'home-topic-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
      copy.append(count, title, subtitle); link.append(copy, image, arrow); topicGrid.append(link);
    });
    const previews = document.getElementById('home-collection-preview');
    collectionPreviews(movies).forEach(collection => {
      const link = document.createElement('a'); link.className = 'home-collection-card'; link.href = 'collections.html?group=' + encodeURIComponent(collection.id);
      const art = document.createElement('div'); art.className = 'home-collection-posters'; art.setAttribute('aria-hidden', 'true');
      collection.movies.slice(0, 3).forEach(movie => {
        const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.width = 110; img.height = 165; img.referrerPolicy = 'no-referrer'; SiteTools.setPoster(img, movie); art.append(img);
      });
      const body = document.createElement('div'); body.className = 'home-collection-copy';
      const title = document.createElement('h3'); title.textContent = collection.title;
      const count = document.createElement('p'); count.textContent = collection.count + ' phim / mùa trong loạt';
      const cta = document.createElement('span'); cta.textContent = 'Khám phá loạt phim ↗';
      body.append(title, count, cta); link.append(art, body); previews.append(link);
    });
    document.getElementById('home-collections-section').hidden = !previews.children.length;
    const randomButton = document.getElementById('home-random-pick');
    const randomCard = document.getElementById('home-random-result');
    let previous = '';
    randomButton.disabled = false;
    randomButton.addEventListener('click', () => {
      const selected = pickMovie(movies, previous); if (!selected) return;
      previous = selected.slug; randomCard.replaceChildren();
      const image = document.createElement('img'); image.alt = ''; image.width = 72; image.height = 108; SiteTools.setPoster(image, selected);
      const copy = document.createElement('div'); const eyebrow = document.createElement('span'); eyebrow.textContent = 'Lựa chọn dành cho bạn';
      const title = document.createElement('h3'); title.textContent = selected.title;
      const meta = document.createElement('p'); meta.textContent = [selected.year, selected.country, Number(selected.episodes) > 1 ? selected.episodes + ' tập' : 'Phim lẻ'].filter(Boolean).join(' · ');
      const detail = document.createElement('a'); detail.href = SiteTools.detailUrl(selected); detail.textContent = 'Xem thông tin →';
      copy.append(eyebrow, title, meta, detail); randomCard.append(image, copy); randomCard.hidden = false; randomButton.textContent = 'Chọn phim khác ↻';
    });
  }
  const api = { topics, matches, buildTopics, collectionPreviews, pickMovie, catalogHref };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HomeExperience = api; document.addEventListener('DOMContentLoaded', init); }
})(globalThis);
