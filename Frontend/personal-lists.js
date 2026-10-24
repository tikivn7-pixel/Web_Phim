(function (root) {
  'use strict';
  const KEY = 'movie_lists_v1', VERSION = 1, MAX_LISTS = 50, MAX_MOVIES = 500;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const safe = value => typeof value === 'string' && !['__proto__', 'constructor', 'prototype'].includes(value);
  const validId = value => safe(value) && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  const validSlug = value => safe(value) && value.length > 0 && value.length <= 500 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
  const text = (value, max, required = false) => typeof value === 'string' && value === value.trim() && value.length <= max && (!required || value.length > 0) && !/[\u0000-\u001f\u007f]/.test(value);
  const empty = () => ({ version: VERSION, lists: {} });
  function normalize(input, strict = false) {
    if (!object(input) || input.version !== VERSION || !object(input.lists)) {
      if (strict) throw Error('Danh sách riêng không đúng định dạng phiên bản 1.');
      return empty();
    }
    const entries = Object.entries(input.lists), out = empty();
    if (strict && entries.length > MAX_LISTS) throw Error('Chỉ lưu tối đa 50 danh sách, gồm cả bản ghi đã xóa.');
    for (const [id, list] of entries.slice(0, MAX_LISTS)) {
      const valid = validId(id) && object(list) && text(list.name, 80, true) && text(list.description, 500) && typeof list.deleted === 'boolean' && typeof list.updatedAt === 'number' && Number.isFinite(list.updatedAt) && list.updatedAt >= 0 && list.updatedAt <= 1e15 && Array.isArray(list.slugs) && list.slugs.length <= MAX_MOVIES && list.slugs.every(validSlug) && new Set(list.slugs).size === list.slugs.length && (!list.deleted || list.slugs.length === 0);
      if (!valid) { if (strict) throw Error('Có danh sách, tên phim hoặc thứ tự không hợp lệ.'); continue; }
      out.lists[id] = { name: list.name, description: list.description, slugs: list.slugs.slice(), updatedAt: list.updatedAt, deleted: list.deleted };
    }
    return out;
  }
  function storageOf(storage) { return storage || root.localStorage; }
  function read(storage, strict = false) {
    try { const raw = storageOf(storage).getItem(KEY); return raw === null ? empty() : normalize(JSON.parse(raw), strict); }
    catch (error) { if (strict) throw Error('Không đọc được danh sách đã lưu. Hãy kiểm tra bản sao lưu trong Thư viện trước khi thay đổi.'); return empty(); }
  }
  function write(input, storage) {
    const value = normalize(input, true), target = storageOf(storage);
    read(target, true);
    try { target.setItem(KEY, JSON.stringify(value)); }
    catch (_) { throw Error('Không lưu được danh sách. Bộ nhớ có thể đã đầy hoặc bị trình duyệt chặn.'); }
    return value;
  }
  function notify(id) { if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') root.dispatchEvent(new root.CustomEvent('movie-lists-change', { detail: { id } })); }
  function mutate(id, edit, storage) {
    const data = read(storage, true);
    if (!validId(id) || !Object.hasOwn(data.lists, id) || data.lists[id].deleted) throw Error('Danh sách này không còn tồn tại.');
    const list = data.lists[id]; edit(list); list.updatedAt = Math.max(Date.now(), list.updatedAt + 1);
    const saved = write(data, storage).lists[id]; notify(id); return saved;
  }
  function create(input, storage) {
    const data = read(storage, true);
    if (Object.keys(data.lists).length >= MAX_LISTS) throw Error('Đã đạt giới hạn 50 danh sách, gồm bản ghi đã xóa. Hãy xuất bản sao lưu trong Thư viện.');
    const id = root.crypto?.randomUUID?.() || ('list_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12));
    const list = { name: String(input?.name || '').trim(), description: String(input?.description || '').trim(), slugs: [], updatedAt: Date.now(), deleted: false };
    data.lists[id] = list; const saved = write(data, storage).lists[id]; notify(id); return { id, list: saved };
  }
  function update(id, patch, storage) { return mutate(id, list => { if (!object(patch)) throw Error('Thông tin không hợp lệ.'); if (Object.hasOwn(patch, 'name')) list.name = String(patch.name).trim(); if (Object.hasOwn(patch, 'description')) list.description = String(patch.description).trim(); }, storage); }
  function remove(id, storage) { return mutate(id, list => { list.deleted = true; list.slugs = []; }, storage); }
  function add(id, slug, storage) { if (!validSlug(slug)) throw Error('Mã phim không hợp lệ.'); return mutate(id, list => { if (!list.slugs.includes(slug)) { if (list.slugs.length >= MAX_MOVIES) throw Error('Một danh sách chứa tối đa 500 phim.'); list.slugs.push(slug); } }, storage); }
  function removeMovie(id, slug, storage) { return mutate(id, list => { list.slugs = list.slugs.filter(value => value !== slug); }, storage); }
  function move(id, slug, direction, storage) { return mutate(id, list => { if (direction !== -1 && direction !== 1) throw Error('Hướng di chuyển không hợp lệ.'); const index = list.slugs.indexOf(slug), target = index + direction; if (index >= 0 && target >= 0 && target < list.slugs.length) [list.slugs[index], list.slugs[target]] = [list.slugs[target], list.slugs[index]]; }, storage); }
  function active(data) { return Object.entries(normalize(data).lists).filter(([, list]) => !list.deleted).map(([id, list]) => ({ id, ...list })).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)); }
  function merge(a, b) {
    const out = normalize(a), incoming = normalize(b);
    for (const [id, list] of Object.entries(incoming.lists)) if (!Object.hasOwn(out.lists, id) || list.updatedAt > out.lists[id].updatedAt) out.lists[id] = list;
    out.lists = Object.fromEntries(Object.entries(out.lists).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, MAX_LISTS));
    return out;
  }
  const api = { KEY, VERSION, MAX_LISTS, MAX_MOVIES, normalize, read, write, active, create, update, remove, add, removeMovie, move, merge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PersonalLists = api;
})(globalThis);
