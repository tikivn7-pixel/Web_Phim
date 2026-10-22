// Local information paints first; a streaming provider never gates this page.
let fdCurrentMovie = null;
let fdSavedPosition = null;
let fdEpisodeEntries = [];
let fdEpisodeLimit = 60;

function fdWatchParams(episode = 1, extra = {}) {
  const values = new URLSearchParams({ title, slug, poster, episodes, ep: episode });
  if (extra.name) values.set('target_episode', extra.name);
  if (Number.isInteger(extra.server) && extra.server >= 0) values.set('server', extra.server);
  if (['auto', 'kkphim', 'nguonc', 'hardcode'].includes(extra.source)) values.set('data_source', extra.source);
  if (Number(extra.time) > 5) values.set('resume', Math.floor(Number(extra.time)));
  rememberCatalogReturn(values);
  return values;
}
function fdWatchNow() {
  if (!fdCurrentMovie) return;
  const first = fdEpisodeEntries[0];
  const values = fdWatchParams(first?.episode || 1, first || {});
  window.location.href = 'watch.html?' + values;
}
function fdIsFollowed() {
  const list = typeof getWishlist === 'function' ? getWishlist() : [];
  return list.some(item => slug ? item.slug === slug : item.title === title);
}
function fdUpdateFollowUI() {
  const followed = fdIsFollowed();
  const button = document.getElementById('fd-follow-btn');
  button.classList.toggle('active', followed);
  button.setAttribute('aria-pressed', String(followed));
  document.getElementById('fd-follow-icon').className = followed ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
  document.getElementById('fd-follow-text').textContent = followed ? 'Đã lưu phim' : 'Lưu phim';
}
function fdToggleFollow() {
  if (!fdCurrentMovie) return;
  if (typeof toggleWishlist === 'function') toggleWishlist({ title, poster, desc, episodes, slug });
  fdUpdateFollowUI();
}
function fdSwitchTab(tab) {
  const selected = document.getElementById('fd-tab-' + tab);
  if (!selected || selected.hidden) return;
  document.querySelectorAll('.fd-tab-btn').forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('.fd-tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === 'fd-panel-' + tab));
}
function fdRenderBreadcrumb(genres) {
  const breadcrumb = document.getElementById('fd-breadcrumb');
  breadcrumb.replaceChildren();
  const home = document.createElement('a'); home.href = 'index.html'; home.textContent = 'Trang chủ'; breadcrumb.append(home);
  const items = String(genres || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 1);
  for (const text of [...items, title]) {
    const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '/';
    const item = document.createElement('span'); item.textContent = text; if (text === title) item.className = 'current';
    breadcrumb.append(sep, item);
  }
}
function fdTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(value / 3600), m = Math.floor(value % 3600 / 60), s = String(value % 60).padStart(2, '0');
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + s : m + ':' + s;
}
function fdReadResume() {
  try {
    return PersonalData.read(localStorage).data.continue_watching_list.find(item =>
      (slug ? item.slug === slug : item.title === title) && !PersonalData.finished(item)) || null;
  } catch (_) { return null; }
}
function fdRenderResume() {
  fdSavedPosition = fdReadResume();
  const box = document.getElementById('fd-resume'); box.hidden = !fdSavedPosition;
  if (!fdSavedPosition) return;
  const saved = fdSavedPosition;
  const name = saved.episodeName || String(saved.episode || 1);
  const label = /^\d+$/.test(name) ? 'Tập ' + name : name;
  const progress = Math.min(100, Math.max(0, Number(saved.progress) || 0));
  document.getElementById('fd-resume-caption').textContent = label + (saved.currentTime > 5 ? ' · Đã xem đến ' + fdTime(saved.currentTime) : ' · Mở lại tập đang xem');
  document.getElementById('fd-resume-percent').textContent = saved.duration > 0 ? Math.round(progress) + '% tập' : '';
  document.getElementById('fd-resume-progress').style.width = progress + '%';
  document.getElementById('fd-resume-button').onclick = () => {
    const values = fdWatchParams(saved.episode || 1, { name: saved.episodeName, server: saved.server || 0, source: saved.source, time: saved.currentTime });
    window.location.href = 'watch.html?' + values;
  };
}
function fdEpisodeLabel(name, index) {
  return !name || /^\d+$/.test(name) ? 'Tập ' + (name || index) : name;
}
function fdPaintEpisodeButtons() {
  const grid = document.getElementById('detail-episode-grid'); grid.replaceChildren();
  const query = SiteTools.normalize(document.getElementById('fd-episode-search').value);
  const filtered = fdEpisodeEntries.filter((entry, index) => !query || SiteTools.normalize(fdEpisodeLabel(entry.name, index + 1)).includes(query));
  filtered.slice(0, fdEpisodeLimit).forEach(entry => {
    const button = document.createElement('button'); button.className = 'ep-btn';
    button.textContent = fdEpisodeLabel(entry.name, entry.episode);
    const saved = fdSavedPosition;
    const isSaved = saved && (saved.episodeName ? saved.episodeName === entry.name : saved.episode === entry.episode);
    if (isSaved) { button.classList.add('fd-episode-saved'); button.setAttribute('aria-label', button.textContent + ' · Tập đang xem'); }
    button.onclick = () => { window.location.href = 'watch.html?' + fdWatchParams(entry.episode, entry); };
    grid.append(button);
  });
  const more = document.getElementById('fd-more-episodes'); more.hidden = filtered.length <= fdEpisodeLimit;
  more.textContent = 'Hiện thêm tập (' + Math.max(0, filtered.length - fdEpisodeLimit) + ' tập còn lại)';
  document.getElementById('fd-episode-empty').hidden = filtered.length > 0;
}
function fdRenderEpisodeGrid(episodeCount, movie = fdCurrentMovie) {
  const servers = Array.isArray(movie?.episodeServers) ? movie.episodeServers : [];
  const server = servers.findIndex(row => Array.isArray(row.items) && row.items.length);
  if (server >= 0) {
    fdEpisodeEntries = servers[server].items.slice(0, 10000).map((item, index) => ({ episode: index + 1, name: String(item.name || index + 1), server, source: movie.episodeSource || movie.source || 'auto' }));
    const number=entry=>SiteTools.normalize(entry.name).replace(/^(tap|episode|ep)\s*/, '');
    if(fdEpisodeEntries.every(entry=>/^\d+$/.test(number(entry)))&&new Set(fdEpisodeEntries.map(number)).size===fdEpisodeEntries.length)fdEpisodeEntries.sort((a,b)=>Number(number(a))-Number(number(b)));
    document.getElementById('fd-episode-note').textContent = fdEpisodeEntries.length.toLocaleString('vi-VN') + ' tập có trên nguồn ' + (servers[server].name || 'hiện tại') + '. Bạn có thể đổi nguồn và máy chủ tại trình phát.';
  } else {
    fdEpisodeEntries = Array.from({ length: Math.min(2000, Math.max(1, Number(episodeCount) || 1)) }, (_, index) => ({ episode: index + 1, name: String(index + 1) }));
    document.getElementById('fd-episode-note').textContent = 'Danh sách theo kho phim. Tình trạng tập và nguồn phát sẽ được kiểm tra khi mở phim.';
  }
  fdPaintEpisodeButtons();
}
function fdRenderMetadata(movie) {
  const metadata = document.getElementById('fd-metadata'); metadata.replaceChildren();
  const chip = (text, className, href) => {
    if (!text) return;
    const element = document.createElement(href ? 'a' : 'span'); element.textContent = text;
    if (className) element.className = className;
    if (href) element.href = href;
    metadata.append(element);
  };
  const year = Number(movie.year);
  if (Number.isInteger(year) && year >= 1888 && year <= 2200) chip(String(year), 'fd-chip-year');
  const type = { single: 'Phim lẻ', series: 'Phim bộ', hoathinh: 'Hoạt hình', animation: 'Hoạt hình', tvshows: 'Chương trình' }[movie.type];
  chip(type);
  const country = getMovieCountry(movie);
  if (country) chip(country, '', 'index.html?' + new URLSearchParams({ view: 'catalog', country }));
  const quality = String(movie.quality || '').trim(); if (quality && quality.length < 32) chip(quality);
  const vote = Number(movie.vote_average);
  document.getElementById('fd-score-block').hidden = !(vote > 0 && vote <= 10);
  document.getElementById('fd-stars-block').hidden = !(vote > 0 && vote <= 10);
  document.getElementById('fd-views-block').hidden = !(Number(movie.views) > 0);
  document.getElementById('detail-views').textContent = formatViews(movie.views) + ' lượt xem';
  document.getElementById('detail-episodes-count').textContent = episodes === 1 ? '1 tập' : episodes + ' tập';
  document.getElementById('fd-language-row').hidden = !movie.language;
  document.getElementById('fd-language').textContent = movie.language || '';
}
function fdRenderAdditional(movie) {
  const castList = document.getElementById('fd-cast-list'); castList.replaceChildren();
  const people = [...new Set(String(movie.cast || '').split(',').map(name => name.trim()).filter(name => name && !/^đang cập nhật$/i.test(name)))].slice(0, 40);
  document.getElementById('fd-tab-cast').hidden = !people.length;
  people.forEach(name => {
    const person = document.createElement('a'); person.className = 'fd-cast-person'; person.href = 'index.html?' + new URLSearchParams({ view: 'catalog', q: name });
    const initials = document.createElement('span'); initials.className = 'fd-cast-initials'; initials.setAttribute('aria-hidden', 'true'); initials.textContent = name.split(/\s+/).map(value => value[0]).slice(-2).join('').toLocaleUpperCase();
    const label = document.createElement('span'); label.textContent = name; person.append(initials, label); castList.append(person);
  });
  // Only expose a trailer supplied in metadata; never guess by a movie title.
  let trailer = ''; try { const url = new URL(movie.trailer || movie.trailer_url || ''); if (url.protocol === 'https:' && /^(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)$/i.test(url.hostname)) trailer = url.href; } catch (_) {}
  document.getElementById('fd-tab-trailer').hidden = !trailer;
  if (trailer) document.getElementById('fd-trailer-link').href = trailer;
  const gallery = document.getElementById('fd-gallery-grid');
  const images = [...new Set([movie.banner, movie.poster].map(value => SiteTools.imageUrl(value, '')).filter(value => value && !/placeholder|placehold\.co/i.test(value)))];
  const identity = JSON.stringify(images);
  if (gallery.dataset.images !== identity) {
    gallery.dataset.images = identity; gallery.replaceChildren();
    images.forEach((url, index) => {
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', 'Mở hình ảnh ' + (index + 1) + ' của ' + title);
      const image = document.createElement('img'); image.alt = title + ' · ' + (index === 0 ? 'Ảnh giới thiệu' : 'Poster'); image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
      image.onerror = () => { link.remove(); if (!gallery.children.length) { document.getElementById('fd-tab-gallery').hidden = true; if (document.getElementById('fd-panel-gallery').classList.contains('active')) fdSwitchTab('info'); } };
      image.src = url; link.append(image); gallery.append(link);
    });
  }
  document.getElementById('fd-tab-gallery').hidden = !gallery.children.length;
  if (document.querySelector('.fd-tab-btn.active')?.hidden) fdSwitchTab('info');
}
async function fdShare() {
  const feedback = document.getElementById('fd-share-status');
  const url = new URL('detail.html', window.location.href); url.searchParams.set('slug', slug);
  if (!slug) { feedback.textContent = 'Chưa có mã phim để chia sẻ.'; return; }
  try {
    if (navigator.share) { await navigator.share({ title, url: url.href }); feedback.textContent = 'Đã mở chia sẻ phim.'; }
    else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url.href); feedback.textContent = 'Đã sao chép liên kết phim.'; }
    else feedback.textContent = 'Liên kết phim: ' + url.href;
  } catch (error) {
    if (error.name !== 'AbortError') feedback.textContent = 'Bạn có thể sao chép liên kết: ' + url.href;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const notice = document.createElement('div'); notice.className = 'detail-load-status'; notice.setAttribute('role', 'status'); notice.hidden = true;
  document.querySelector('.fd-info').prepend(notice);
  const message = (text, retry = false) => {
    notice.replaceChildren(); notice.hidden = !text; if (!text) return;
    notice.append(document.createTextNode(text));
    if (retry) { const button = document.createElement('button'); button.textContent = 'Thử lại'; button.onclick = load; notice.append(button); }
  };
  const watchButtons = [...document.querySelectorAll('.fd-watch-btn,.fd-play-overlay')];
  const readMore = document.getElementById('fd-read-more');
  readMore.onclick = () => {
    const expanded = readMore.getAttribute('aria-expanded') !== 'true';
    readMore.setAttribute('aria-expanded', String(expanded)); readMore.textContent = expanded ? 'Thu gọn nội dung ↑' : 'Đọc nội dung đầy đủ ↗';
    document.getElementById('detail-desc').classList.toggle('fd-expanded', expanded);
  };
  document.getElementById('fd-share-btn').onclick = fdShare;
  document.getElementById('fd-episode-search').addEventListener('input', () => { fdEpisodeLimit = 60; fdPaintEpisodeButtons(); });
  document.getElementById('fd-more-episodes').onclick = () => { fdEpisodeLimit += 60; fdPaintEpisodeButtons(); };
  document.querySelector('.fd-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !event.target.matches('[role=tab]')) return;
    const tabs = [...document.querySelectorAll('.fd-tab-btn')].filter(button => !button.hidden);
    const index = tabs.indexOf(event.target);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault(); fdSwitchTab(tabs[next].dataset.tab); tabs[next].focus();
  });
  window.addEventListener('storage', event => { if (event.key === 'continue_watching_list' || event.key === null) { fdRenderResume(); fdPaintEpisodeButtons(); } if (event.key === 'my_wishlist' || event.key === null) fdUpdateFollowUI(); });
  function paint(movie) {
    fdCurrentMovie = movie; title = movie.title; poster = SiteTools.imageUrl(movie.poster); desc = movie.desc || '';
    episodes = Math.min(2000, Math.max(1, parseInt(movie.episodes, 10) || 1));
    document.title = title + ' — LauPhim'; document.getElementById('detail-title').textContent = title;
    const image = document.getElementById('detail-poster-img'); image.alt = 'Poster ' + title;
    if (image.dataset.moviePoster !== movie.poster) { image.dataset.moviePoster = movie.poster || ''; SiteTools.setPoster(image, {}, movie); }
    const backdrop = document.getElementById('detail-backdrop-img');
    const backdropUrl = SiteTools.imageUrl(movie.banner || movie.poster, '');
    if (backdrop.dataset.url !== backdropUrl) { backdrop.dataset.url = backdropUrl; backdrop.onerror = () => { backdrop.onerror = null; const fallback = SiteTools.imageUrl(movie.remotePoster || movie.poster, ''); if (fallback && fallback !== backdropUrl) backdrop.src = fallback; else backdrop.hidden = true; }; if (backdropUrl) { backdrop.hidden = false; backdrop.src = backdropUrl; } }
    const description = document.getElementById('detail-desc'); description.textContent = desc;
    description.hidden = !desc || SiteTools.normalize(desc) === SiteTools.normalize(title);
    requestAnimationFrame(() => { readMore.hidden = description.hidden || description.scrollHeight <= description.clientHeight + 2 && !description.classList.contains('fd-expanded'); });
    document.getElementById('detail-genres').textContent = movie.genres || 'Đang cập nhật';
    document.getElementById('detail-country').textContent = getMovieCountry(movie) || 'Đang cập nhật';
    loadMovieDetailsFromTMDB(movie);
    fdRenderMetadata(movie); fdRenderAdditional(movie); fdRenderResume(); fdRenderEpisodeGrid(episodes, movie); fdRenderBreadcrumb(movie.genres); fdUpdateFollowUI();
    watchButtons.forEach(button => { button.disabled = false; });
    document.getElementById('fd-follow-btn').disabled = false;
  }
  async function load() {
    watchButtons.forEach(button => { button.disabled = true; });
    message('Đang tải thông tin phim…');
    if (!slug) { message('Thiếu mã phim. Hãy quay về danh sách để chọn phim.'); return; }
    try {
      const local = await findCatalogMovieBySlug(slug);
      const movie = local || await fetchMovieBySlug(slug);
      if (!movie) { message('Không tìm thấy phim này. Hãy quay về danh sách để chọn phim khác.'); return; }
      paint(movie); message('');
      if (movie.group) {
        document.getElementById('fd-collection-link').href = 'collections.html?' + new URLSearchParams({ group: movie.group });
        try { const parts = await fetchMovieParts(movie.group); addToGlobalMoviesList(parts); renderMovieParts(slug, movie.group); } catch (_) { renderMovieParts(slug, null); }
      } else renderMovieParts(slug, null);
      loadStaticCatalog().then(catalog => { const suggestions = SiteTools.recommend(catalog, movie, 6); addToGlobalMoviesList(suggestions); renderRelatedSuggestions(slug, movie.genres, suggestions); }).catch(() => {});
      if (local) fetchMovieBySlug(slug).then(enriched => { if (enriched) paint(enriched); }).catch(() => {});
    } catch (_) { message('Chưa tải được thông tin phim. Kiểm tra kết nối và thử lại.', true); }
  }
  await load();
});
