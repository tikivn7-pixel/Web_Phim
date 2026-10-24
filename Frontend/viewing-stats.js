(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Personal = node ? require('./personal-data') : root.PersonalData;
  const Countries = node ? require('./country-utils') : root.MovieCountries;
  const Genres = node ? require('./genre-utils') : root.MovieGenres;
  const DAY = 86400000;
  const LABELS = { planned: 'Muốn xem', watching: 'Đang xem', completed: 'Đã xem', paused: 'Tạm dừng' };
  const period = value => ['7', '30'].includes(String(value)) ? String(value) : 'all';
  const validTime = (value, now) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= now;
  function resumeUrl(movie) {
    if (!movie || !movie.slug) return '';
    const params = new URLSearchParams({ slug: movie.slug, ep: String(movie.episode), data_source: movie.source, server: String(movie.server) });
    if (movie.episodeName) params.set('target_episode', movie.episodeName);
    if (movie.currentTime > 0) params.set('resume', String(Math.floor(movie.currentTime)));
    return 'watch.html?' + params;
  }
  function build(input = {}, catalog = [], options = {}) {
    const data = Personal.normalize(input), now = Number.isFinite(options.now) ? options.now : Date.now(), selected = period(options.period);
    const cutoff = selected === 'all' ? 0 : now - Number(selected) * DAY;
    const inPeriod = stamp => selected === 'all' || (validTime(stamp, now) && stamp >= cutoff);
    const bySlug = new Map((Array.isArray(catalog) ? catalog : []).filter(m => m && m.slug).map(m => [m.slug, m]));
    const personal = new Set(), allPersonal = new Set(), untimed = new Set(), activities = new Map();
    const statuses = Object.fromEntries(Object.keys(LABELS).map(key => [key, 0])), ratings = [0, 0, 0, 0, 0];
    let completed = 0, episodes = 0, bookmarks = 0, notes = 0, rated = 0;
    function add(slug, stamp) {
      if (!slug) return;
      allPersonal.add(slug);
      if (!validTime(stamp, now)) untimed.add(slug);
      if (inPeriod(stamp)) personal.add(slug);
    }
    function activity(id, slug, stamp, label, extra = {}) {
      if (!validTime(stamp, now) || stamp < cutoff) return;
      const row = { id, slug, updatedAt: stamp, label, ...extra };
      if (!activities.has(id) || activities.get(id).updatedAt < stamp) activities.set(id, row);
    }
    for (const movie of data.my_wishlist) {
      add(movie.slug, movie.addedAt);
      activity('favorite:' + movie.slug, movie.slug, movie.addedAt, 'Lưu yêu thích');
    }
    for (const movie of data.continue_watching_list) {
      add(movie.slug, movie.updatedAt);
      activity('resume:' + movie.slug, movie.slug, movie.updatedAt, 'Lưu vị trí xem', { episodeName: movie.episodeName });
    }
    for (const [slug, positions] of Object.entries(data.episode_positions)) {
      for (const position of Object.values(positions)) if (position.currentTime > 0) add(slug, position.updatedAt);
    }
    for (const [slug, entry] of Object.entries(data.movie_journal_v1?.entries || {})) {
      if (!entry.status && !entry.rating) continue;
      add(slug, entry.updatedAt);
      if (inPeriod(entry.updatedAt)) {
        if (entry.status) statuses[entry.status]++;
        if (entry.status === 'completed') completed++;
        if (entry.rating) { ratings[entry.rating - 1]++; rated++; }
      }
      activity('journal:' + slug, slug, entry.updatedAt, entry.status ? LABELS[entry.status] + (entry.rating ? ' · ' + entry.rating + '/5 sao của bạn' : '') : entry.rating + '/5 sao của bạn');
    }
    for (const [slug, movie] of Object.entries(data.episode_tracker_v1?.movies || {})) {
      for (const [name, entry] of Object.entries(movie.episodes)) if (entry.watched) {
        add(slug, entry.updatedAt);
        if (inPeriod(entry.updatedAt)) episodes++;
        activity('episode:' + slug + ':' + name, slug, entry.updatedAt, 'Đánh dấu tập đã xem', { episodeName: name });
      }
    }
    for (const [slug, movie] of Object.entries(data.movie_notes_v1?.movies || {})) {
      if (movie.note.text.trim()) {
        add(slug, movie.note.updatedAt);
        if (inPeriod(movie.note.updatedAt)) notes++;
        activity('note:' + slug, slug, movie.note.updatedAt, 'Cập nhật ghi chú riêng');
      }
      for (const [id, mark] of Object.entries(movie.bookmarks)) if (!mark.deleted) {
        add(slug, mark.updatedAt);
        if (inPeriod(mark.updatedAt)) bookmarks++;
        activity('bookmark:' + slug + ':' + id, slug, mark.updatedAt, 'Lưu mốc cảnh', { episodeName: mark.episodeName });
      }
    }
    const lists = [];
    for (const [id, list] of Object.entries(data.movie_lists_v1?.lists || {})) if (!list.deleted) {
      for (const slug of list.slugs) add(slug, list.updatedAt);
      if (inPeriod(list.updatedAt)) lists.push({ id, name: list.name, count: list.slugs.length, updatedAt: list.updatedAt });
      activity('list:' + id, '', list.updatedAt, 'Cập nhật danh sách riêng', { listId: id, listName: list.name });
    }
    const genres = new Map(), countries = new Map();
    let matched = 0;
    for (const slug of personal) {
      const movie = bySlug.get(slug); if (!movie) continue;
      matched++;
      for (const genre of Genres.genres(movie.genres)) genres.set(genre, (genres.get(genre) || 0) + 1);
      const country = Countries.primaryCountry(movie);
      if (country) countries.set(country, (countries.get(country) || 0) + 1);
    }
    const facets = map => [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi')).slice(0, 8);
    const timeline = [...activities.values()].sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)).slice(0, 30);
    // Match the shelf/library completion rule. A recorded false last-episode
    // flag takes priority over stale declared totals for an ongoing series.
    const resumes = data.continue_watching_list.filter(movie => movie.slug && !['completed', 'paused', 'planned'].includes(data.movie_journal_v1?.entries?.[movie.slug]?.status) && !Personal.finished(movie) && validTime(movie.updatedAt, now) && inPeriod(movie.updatedAt)).sort((a, b) => b.updatedAt - a.updatedAt);
    return { period: selected, counts: { personal: personal.size, completed, episodes, bookmarks, notes, rated }, statuses, ratings, genres: facets(genres), countries: facets(countries), matched, unmatched: personal.size - matched, allPersonal: allPersonal.size, untimed: untimed.size, slugs: [...personal], lists: lists.sort((a, b) => b.updatedAt - a.updatedAt), timeline, resume: resumes[0] ? { ...resumes[0], url: resumeUrl(resumes[0]) } : null };
  }
  const api = { DAY, LABELS, period, validTime, resumeUrl, build };
  if (node) module.exports = api; else root.ViewingStats = api;
})(globalThis);
