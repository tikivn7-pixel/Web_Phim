(function (root) {
  'use strict';
  const Lists = typeof module !== 'undefined' && module.exports ? require('./personal-lists') : root.PersonalLists;
  const statuses = ['', 'planned', 'watching', 'completed', 'paused'];
  const PREFS_KEY = 'library_view_v1';
  function preferences(input) {
    const out = {version:1,sorts:{}};
    if (input?.version !== 1 || !input.sorts || typeof input.sorts !== 'object') return out;
    for (const tab of ['favorites','planned','watching','completed','journal','episodes']) if (['recent','title','rating','year'].includes(input.sorts[tab])) out.sorts[tab] = input.sorts[tab];
    return out;
  }
  function selection(selected, allowed) {
    const valid = new Set(allowed.filter(value => typeof value === 'string' && value && !['__proto__','constructor','prototype'].includes(value)));
    return [...new Set(selected)].filter(slug => valid.has(slug));
  }
  // Produce one complete plan before any storage writes. Keep unrelated backup modules intact.
  function plan(data, selected, allowed, action, now = Date.now()) {
    const slugs = selection(selected, allowed);
    if (!slugs.length) throw Error('Không còn phim hợp lệ trong lựa chọn. Hãy chọn lại phim đang hiển thị.');
    const next = JSON.parse(JSON.stringify(data)), ids = new Set(slugs);
    let changed = slugs.length;
    if (action.type === 'status') {
      if (!statuses.includes(action.status)) throw Error('Trạng thái không hợp lệ.');
      next.movie_journal_v1 ||= {version:1, entries:{}};
      for (const slug of slugs) {
        const old = next.movie_journal_v1.entries[slug] || {rating:0,updatedAt:0};
        next.movie_journal_v1.entries[slug] = {...old,status:action.status,updatedAt:Math.max(now, old.updatedAt + 1)};
      }
    } else if (action.type === 'list') {
      const lists = Lists.normalize(next.movie_lists_v1, true), list = lists.lists[action.id];
      if (!list || list.deleted) throw Error('Danh sách đã bị xóa hoặc không còn tồn tại. Hãy chọn lại.');
      const additions = slugs.filter(slug => !list.slugs.includes(slug));
      if (list.slugs.length + additions.length > Lists.MAX_MOVIES) throw Error('Danh sách vượt giới hạn 500 phim. Chưa thêm phim nào; hãy giảm lựa chọn.');
      list.slugs.push(...additions); changed = additions.length;
      if (changed) list.updatedAt = Math.max(now, list.updatedAt + 1);
      next.movie_lists_v1 = lists;
    } else if (action.type === 'favorites') {
      const old = next.my_wishlist || []; next.my_wishlist = old.filter(item => !ids.has(item.slug)); changed = old.length - next.my_wishlist.length;
    } else if (action.type === 'progress') {
      next.continue_watching_list = (next.continue_watching_list || []).filter(item => !ids.has(item.slug));
      for (const slug of slugs) delete next.episode_positions[slug];
    } else throw Error('Tác vụ không hợp lệ.');
    return {next, slugs, changed};
  }
  const api = {PREFS_KEY, preferences, selection, plan};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LibraryBulk = api;
})(globalThis);
