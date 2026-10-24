// Weekly reminders entered by the viewer. This is not a provider release calendar.
(function (root) {
  'use strict';
  const KEY = 'release_planner_v1', ZONE = 'Asia/Ho_Chi_Minh', LIMIT = 1000;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const identity = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 500 && !/[\u0000-\u001f\u007f]/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
  const stamp = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e15;
  function normalize(input, strict = false) {
    const out = { version: 1, entries: {} };
    if (input === undefined) return out;
    if (!object(input) || input.version !== 1 || !object(input.entries)) { if (strict) throw Error('Lịch nhắc phim không hợp lệ.'); return out; }
    if (strict && Object.keys(input.entries).length > LIMIT) throw Error('Lịch chỉ hỗ trợ tối đa 1.000 phim.');
    for (const [slug, row] of Object.entries(input.entries).slice(0, LIMIT)) {
      const valid = identity(slug) && object(row) && stamp(row.updatedAt) && typeof row.deleted === 'boolean' && (row.deleted || (Number.isInteger(row.day) && row.day >= 0 && row.day <= 6 && typeof row.time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.time) && row.timezone === ZONE));
      if (!valid) { if (strict) throw Error('Có lịch nhắc phim sai định dạng.'); continue; }
      out.entries[slug] = row.deleted ? { deleted: true, updatedAt: row.updatedAt } : { day: row.day, time: row.time, timezone: ZONE, updatedAt: row.updatedAt, deleted: false };
    }
    return out;
  }
  function merge(a, b) {
    const out = normalize(a);
    for (const [slug, row] of Object.entries(normalize(b).entries)) {
      const old = out.entries[slug];
      if (!old || row.updatedAt > old.updatedAt || row.updatedAt === old.updatedAt && row.deleted) out.entries[slug] = row;
    }
    return normalize(out);
  }
  const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  function week(input, movies, now = Date.now()) {
    const catalog = new Map((movies || []).map(movie => [movie.slug, movie]));
    const local = new Date(now + 7 * 3600000), midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(midnight + offset * 86400000), day = date.getUTCDay();
      const entries = Object.entries(normalize(input).entries).filter(([slug, row]) => !row.deleted && row.day === day && catalog.has(slug)).map(([slug, row]) => ({ slug, ...row, movie: catalog.get(slug), at: date.getTime() + Number(row.time.slice(0, 2)) * 3600000 + Number(row.time.slice(3)) * 60000 - 7 * 3600000 })).sort((a, b) => a.time.localeCompare(b.time) || a.movie.title.localeCompare(b.movie.title, 'vi'));
      return { day, name: dayNames[day], date: date.toISOString().slice(0, 10), entries };
    });
  }
  function fold(line) {
    let result = '', piece = '', length = 0;
    for (const character of line) {
      const bytes = new TextEncoder().encode(character).length;
      if (length + bytes > 73) { result += piece + '\r\n '; piece = ''; length = 1; }
      piece += character; length += bytes;
    }
    return result + piece;
  }
  const escape = text => String(text).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const utc = time => new Date(time).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  function ical(input, movies, now = Date.now()) {
    const events = week(input, movies, now).flatMap(day => day.entries);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LauPhim//Lich nhac ca nhan//VI', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:LauPhim — Lịch nhắc cá nhân'];
    for (const entry of events) {
      let at = entry.at; if (at < now) at += 7 * 86400000;
      lines.push('BEGIN:VEVENT', 'UID:' + encodeURIComponent(entry.slug) + '@lauphim.local', 'DTSTAMP:' + utc(entry.updatedAt), 'DTSTART:' + utc(at), 'DURATION:PT30M', 'RRULE:FREQ=WEEKLY', 'SUMMARY:' + escape(entry.movie.title), 'DESCRIPTION:' + escape('Lịch nhắc do bạn tự đặt trên LauPhim. Giờ Việt Nam (UTC+7). Lịch phát thực tế có thể thay đổi.'), 'END:VEVENT');
    }
    lines.push('END:VCALENDAR'); return lines.map(fold).join('\r\n') + '\r\n';
  }
  const api = { KEY, ZONE, LIMIT, normalize, merge, week, ical, dayNames, identity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ReleasePlanner = api;
})(globalThis);
