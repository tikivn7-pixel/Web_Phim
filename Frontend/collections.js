(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const model = window.CollectionsModel;
  const tools = window.SiteTools;
  let groups = [], byId = new Map(), busy = false, searchTimer;
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function readState() {
    const params = new URLSearchParams(location.search);
    return { q: (params.get('q') || '').slice(0, 180), country: params.get('country') || '', type: ['anime', 'series', 'film'].includes(params.get('type')) ? params.get('type') : '',
      sort: ['title', 'year'].includes(params.get('sort')) ? params.get('sort') : 'count', page: Math.max(1, Math.floor(Number(params.get('page'))) || 1), group: params.get('group') || '' };
  }
  function stateUrl(state) {
    const params = new URLSearchParams();
    for (const key of ['q', 'country', 'type', 'sort', 'page', 'group']) {
      const value = state[key];
      if (value && !(key === 'sort' && value === 'count') && !(key === 'page' && Number(value) === 1)) params.set(key, value);
    }
    return 'collections.html' + (params.size ? '?' + params : '');
  }
  function navigate(state, options = {}) {
    clearTimeout(searchTimer);
    const url = stateUrl(state);
    if (location.pathname.split('/').pop() + location.search !== url) history[options.replace ? 'replaceState' : 'pushState']({}, '', url);
    render();
    if (options.scroll === 'detail') { window.scrollTo({ top: 0, behavior: 'instant' }); $('collection-detail-title')?.focus({ preventScroll: true }); }
    if (options.scroll === 'browser') { $('collection-browser').scrollIntoView({ block: 'start' }); }
  }
  function localLink(text, className, state, scroll) {
    const link = node('a', className, text);
    link.href = stateUrl(state);
    link.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); navigate(state, { scroll });
    });
    return link;
  }
  function poster(movie, decorative = false) {
    const image = node('img');
    image.alt = decorative ? '' : movie.title || 'Áp phích phim';
    image.loading = 'lazy'; image.decoding = 'async'; image.width = 240; image.height = 360;
    tools.setPoster(image, movie, movie);
    return image;
  }
  function yearText(group) { return !group.yearMin ? 'Chưa rõ năm' : group.yearMin === group.yearMax ? String(group.yearMin) : `${group.yearMin}–${group.yearMax}`; }
  function meta(items) {
    const element = node('div', 'collection-card-meta');
    for (const item of items.filter(Boolean)) element.append(node('span', '', item));
    return element;
  }
  function card(group, state) {
    const link = localLink('', 'collection-card', { ...state, group: group.id }, 'detail');
    link.setAttribute('aria-label', `${group.title}, ${group.members.length} phim và mùa. Mở bộ sưu tập`);
    const stack = node('div', 'collection-stack' + (group.members.length === 2 ? ' two-posters' : ''));
    for (const member of group.members.slice(0, 3)) stack.append(poster(member.movie, true));
    stack.append(node('span', 'collection-count-badge', `${group.members.length} phần`), node('span', 'collection-open', 'Mở bộ sưu tập ↗'));
    link.append(stack, node('h3', '', group.title), meta([group.countries.slice(0, 2).join(' / '), yearText(group)]));
    return link;
  }
  function renderPagination(result, state) {
    const nav = $('collection-pagination'); nav.replaceChildren(); nav.hidden = result.pages <= 1;
    if (result.pages <= 1) return;
    if (result.page > 1) nav.append(localLink('← Trước', '', { ...state, page: result.page - 1 }, 'browser'));
    let previous = 0;
    const pages = [...new Set([1, result.pages, result.page - 1, result.page, result.page + 1])].filter(value => value > 0 && value <= result.pages).sort((a, b) => a - b);
    for (const page of pages) {
      if (previous && page > previous + 1) { const gap = node('span', 'collection-page-gap', '…'); gap.setAttribute('aria-hidden', 'true'); nav.append(gap); }
      const link = localLink(String(page), '', { ...state, page }, 'browser');
      link.setAttribute('aria-label', `Trang ${page}`);
      if (page === result.page) link.setAttribute('aria-current', 'page');
      nav.append(link); previous = page;
    }
    if (result.page < result.pages) nav.append(localLink('Sau →', '', { ...state, page: result.page + 1 }, 'browser'));
  }
  function renderList(state) {
    const result = model.select(groups, state);
    if (result.page !== state.page) { state.page = result.page; history.replaceState({}, '', stateUrl(state)); }
    $('collection-search').value = state.q;
    $('collection-country').value = state.country;
    $('collection-sort').value = state.sort;
    document.querySelectorAll('.collections-chips [data-type]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.type === state.type)));
    $('collection-reset').hidden = !state.q && !state.country && !state.type && state.sort === 'count';
    $('collection-count').textContent = result.total ? `${result.total} bộ sưu tập · Trang ${result.page}/${result.pages}` : '0 bộ sưu tập';
    $('collections-grid').replaceChildren(...result.items.map(group => card(group, { ...state, page: result.page })));
    $('collections-empty').hidden = result.total > 0;
    renderPagination(result, { ...state, page: result.page });
  }
  function renderDetail(state) {
    const group = byId.get(state.group), container = $('collection-detail');
    container.replaceChildren();
    const back = localLink('← Tất cả bộ sưu tập', 'collection-detail-back', { ...state, group: '' }, 'browser');
    container.append(back);
    if (!group) {
      const empty = node('div', 'collections-state collection-detail-not-found');
      const title = node('h1', '', 'Bộ sưu tập này chưa có trong kho phim'); title.id = 'collection-detail-title'; title.tabIndex = -1;
      empty.append(node('span', 'empty-symbol', '▤'), title, node('p', '', 'Liên kết có thể đã thay đổi. Hãy chọn một bộ sưu tập khác.'), localLink('Khám phá bộ sưu tập', 'collection-primary', { ...state, group: '' }, 'browser'));
      container.append(empty); document.title = 'Không tìm thấy bộ sưu tập · LauPhim'; return;
    }
    document.title = `${group.title} · Bộ sưu tập LauPhim`;
    const hero = node('div', 'collection-detail-hero'), copy = node('div'), art = node('div', 'collection-detail-art');
    const title = node('h1', '', group.title); title.id = 'collection-detail-title'; title.tabIndex = -1;
    copy.append(node('p', 'collections-eyebrow', 'BỘ SƯU TẬP PHIM'), title,
      node('p', 'collection-detail-description', `${group.members.length} phim và mùa trong cùng một bộ sưu tập${group.countries.length ? ' · ' + group.countries.join(' / ') : ''}${group.yearMin ? ' · ' + yearText(group) : ''}. Chọn phần bạn muốn khám phá bên dưới.`));
    const start = node('a', 'collection-primary', 'Khám phá phần đầu tiên →'); start.href = tools.detailUrl(group.members[0].movie); copy.append(start);
    const tags = node('div', 'collection-detail-tags');
    for (const genre of group.genres.slice(0, 5)) tags.append(node('span', '', genre));
    copy.append(tags);
    for (const member of group.members.slice(0, 3)) art.append(poster(member.movie, true));
    art.setAttribute('aria-hidden', 'true'); hero.append(copy, art); container.append(hero);
    const heading = node('div', 'collection-members-title');
    heading.append(node('h2', '', `Các phần trong bộ sưu tập (${group.members.length})`), node('p', '', 'Gồm các mùa, phim lẻ hoặc ngoại truyện liên quan.'));
    container.append(heading);
    const members = node('div', 'collection-members'); members.id = 'collection-members';
    for (let index = 0; index < group.members.length; index++) {
      const member = group.members[index], movie = member.movie;
      const article = node('article', 'collection-member'); article.dataset.slug = movie.slug;
      const posterLink = node('a', 'collection-member-poster'); posterLink.href = tools.detailUrl(movie); posterLink.setAttribute('aria-label', `Thông tin ${movie.title}`);
      posterLink.append(poster(movie), node('span', 'collection-member-position', String(index + 1).padStart(2, '0')));
      const movieHeading = node('h3'), movieLink = node('a', '', movie.title); movieLink.href = tools.detailUrl(movie); movieHeading.append(movieLink);
      article.append(posterLink, movieHeading);
      if (member.label && member.label !== movie.title) article.append(node('p', 'collection-member-alternate', member.label));
      article.append(meta([movie.year, movie.country, movie.episodes ? `${movie.episodes} tập` : '']));
      const actions = node('div', 'collection-member-actions');
      const watch = node('a', '', '▶ Xem phim'), info = node('a', '', 'Thông tin');
      watch.href = 'watch.html?' + new URLSearchParams({ slug: movie.slug }); info.href = tools.detailUrl(movie);
      actions.append(watch, info); article.append(actions); members.append(article);
    }
    container.append(members);
    const sources = group.sources.map(source => typeof source === 'string' ? source : source?.url).map(source => {
      try { const url = new URL(source); return url.protocol === 'https:' ? url : null; } catch (_) { return null; }
    }).filter(Boolean);
    if (sources.length) {
      const evidence = node('details', 'collection-evidence'); evidence.append(node('summary', '', 'Nguồn tham khảo về bộ sưu tập'));
      const list = node('ul');
      for (let index = 0; index < sources.length; index++) {
        const item = node('li'), link = node('a', '', sources[index].hostname.replace(/^www\./, '') + (sources.filter(source => source.hostname === sources[index].hostname).length > 1 ? ` · ${index + 1}` : ''));
        link.href = sources[index].href; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link); list.append(item);
      }
      evidence.append(list); container.append(evidence);
    }
  }
  function render() {
    if (!groups.length) return;
    const state = readState();
    $('collections-loading').hidden = true; $('collections-error').hidden = true;
    $('collections-list').hidden = Boolean(state.group); $('collection-detail').hidden = !state.group;
    if (state.group) renderDetail(state);
    else { document.title = 'Bộ sưu tập phim · LauPhim'; renderList(state); }
  }
  function reset() { navigate({ q: '', country: '', type: '', sort: 'count', page: 1, group: '' }, { scroll: 'browser' }); }
  async function getJson(url) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try { const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw Error('Không tải được dữ liệu phim.'); return await response.json(); }
    finally { clearTimeout(timeout); }
  }
  async function load() {
    if (busy) return;
    busy = true; $('collections-loading').hidden = false; $('collections-error').hidden = true; $('collections-list').hidden = true; $('collection-detail').hidden = true;
    try {
      const [registry, data] = await Promise.all([getJson('data/movie-relations.json'), getJson('data/catalog-index.json')]);
      if (!Array.isArray(registry.groups)) throw Error('Dữ liệu bộ sưu tập chưa sẵn sàng.');
      const decoded = window.CatalogFormat.decode(data);
      const movies = typeof PublishedEpisodes!=="undefined" ? PublishedEpisodes.overlay(decoded,await PublishedEpisodes.load()) : decoded;
      groups = model.build(registry, movies); byId = new Map(groups.map(group => [group.id, group]));
      if (!groups.length) throw Error('Chưa có bộ sưu tập phim để hiển thị.');
      $('collections-total').textContent = groups.length.toLocaleString('vi');
      $('collections-movie-total').textContent = new Set(groups.flatMap(group => group.members.map(member => member.slug))).size.toLocaleString('vi');
      const countries = [...new Set(groups.flatMap(group => group.countries))].sort((a, b) => a.localeCompare(b, 'vi'));
      $('collection-country').replaceChildren(new Option('Tất cả quốc gia', ''), ...countries.map(country => new Option(country, country)));
      const localCovers=groups.map(group=>group.members.find(member=>/^Img\//.test(member.movie.poster||''))).filter(Boolean);
      const featured=localCovers.length>=8?localCovers.slice(0,8):[...localCovers,...groups.flatMap(group=>group.members)].filter((member,index,list)=>list.findIndex(item=>item.slug===member.slug)===index).slice(0,8);
      $('collections-mosaic').replaceChildren(...featured.map(member => poster(member.movie, true)));
      render();
    } catch (error) {
      $('collections-loading').hidden = true; $('collections-error').hidden = false;
      $('collections-error-message').textContent = error.name === 'AbortError' ? 'Tải dữ liệu mất quá lâu. Kiểm tra kết nối rồi thử lại.' : 'Chưa thể đọc kho phim. Kiểm tra kết nối rồi bấm Thử lại.';
    } finally { busy = false; }
  }
  $('collection-filters').addEventListener('submit', event => { event.preventDefault(); navigate({ ...readState(), q: $('collection-search').value, page: 1 }, { replace: true }); });
  $('collection-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => navigate({ ...readState(), q: $('collection-search').value, page: 1 }, { replace: true }), 200); });
  $('collection-country').addEventListener('change', () => navigate({ ...readState(), country: $('collection-country').value, q: $('collection-search').value, page: 1 }));
  $('collection-sort').addEventListener('change', () => navigate({ ...readState(), sort: $('collection-sort').value, q: $('collection-search').value, page: 1 }));
  document.querySelectorAll('.collections-chips [data-type]').forEach(button => button.addEventListener('click', () => navigate({ ...readState(), type: button.dataset.type, q: $('collection-search').value, page: 1 })));
  $('collection-reset').addEventListener('click', reset); $('collection-empty-reset').addEventListener('click', reset); $('collections-retry').addEventListener('click', load);
  window.addEventListener('popstate', () => { clearTimeout(searchTimer); render(); });
  load();
})();
