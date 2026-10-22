// Shared browser / Node helpers. Only these explicitly named keys enter a backup.
(function (root) {
  "use strict";
  const KEYS = ["my_wishlist", "continue_watching_list", "episode_positions", "playback_reports", "player_preferences_v1", "player_intro_ranges_v1", "autonext_enabled", "audio_boost"];
  const FORMAT = "lauphim-personal-data", VERSION = 1;
  const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const text = (value, limit = 500) => typeof value === "string" ? value.slice(0, limit).trim() : "";
  const number = (value, max = 1e12) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(0, Number(value))) : 0;
  const key = movie => text(movie && (movie.slug || movie.title));
  function imageUrl(value) {
    if (typeof value !== "string" || /[\u0000-\u001f\u007f\\]/.test(value)) return "";
    const url = text(value, 2000);
    if (/^https?:\/\//i.test(url)) {
      try {
        const parsed = new URL(url);
        if (parsed.username || parsed.password || [...parsed.searchParams.keys()].some(name => /token|secret|signature|authorization|api.?key/i.test(name))) return "";
        return parsed.href;
      } catch (_) { return ""; }
    }
    if (/^(?:\.\/)?(?:Img|data)\//i.test(url) && !/[?#]/.test(url)) {
      try {
        const decoded=decodeURIComponent(url);
        if(!/[\u0000-\u001f\u007f\\]/.test(decoded)&&!decoded.split('/').includes('..'))return url;
      }catch(_){}
    }
    return "";
  }
  function timestamp(value) {
    if (typeof value === "string" && !/^\d+$/.test(value)) return number(Date.parse(value));
    return number(value, 1e15);
  }
  function movie(value, watching = false) {
    if (!isObject(value) || !key(value)) return null;
    const result = { title: text(value.title) || text(value.slug), slug: text(value.slug), poster: imageUrl(value.poster), desc: text(value.desc, 300) };
    if (watching) {
      result.episode = Math.max(1, Math.floor(number(value.episode, 100000)));
      result.totalEpisodes = Math.floor(number(value.totalEpisodes, 100000));
      for (const field of ["currentTime", "duration", "progress", "server", "updatedAt"]) result[field] = number(value[field], field === "progress" ? 100 : field === "updatedAt" ? 1e15 : 1e8);
      result.server = Math.floor(result.server);
      result.source = ["auto", "kkphim", "nguonc", "hardcode"].includes(value.source) ? value.source : "auto";
      result.episodeName = text(value.episodeName, 100);
      if (typeof value.episodeIsLast === "boolean") result.episodeIsLast = value.episodeIsLast;
    } else {
      result.episodes = Math.max(1, Math.floor(number(value.episodes, 100000)));
      result.addedAt = timestamp(value.addedAt || value.updatedAt);
    }
    return result;
  }
  function newest(list, identity = key, date = value => timestamp(value.updatedAt || value.addedAt || value.createdAt)) {
    const map = new Map();
    for (const value of list) {
      const id = identity(value);
      if (!map.has(id) || date(value) > date(map.get(id))) map.set(id, value);
    }
    return [...map.values()].sort((a, b) => date(b) - date(a));
  }
  function normalize(data, strict = false) {
    if (!isObject(data)) throw new Error("Dữ liệu cá nhân phải là một đối tượng JSON.");
    const out = { my_wishlist: [], continue_watching_list: [], episode_positions: {}, playback_reports: [] };
    for (const field of ["my_wishlist", "continue_watching_list", "playback_reports"]) {
      const input = data[field] === undefined ? [] : data[field];
      if (!Array.isArray(input)) { if (strict) throw new Error("Sai định dạng: " + field); else continue; }
      if (input.length > 10000 && strict) throw new Error("Danh sách quá lớn: " + field);
      const rows = input.slice(0, 10000).map(value => {
        if (field !== "playback_reports") return movie(value, field === "continue_watching_list");
        if (!isObject(value) || !text(value.reason)) return null;
        const row = { createdAt: new Date(timestamp(value.createdAt)).toISOString(), reason: text(value.reason, 300) };
        for (const name of ["slug", "title", "episode", "episodeName", "source", "server"]) if (value[name] !== undefined) row[name] = String(value[name]).slice(0, 500);
        return row;
      });
      if (strict && rows.some(value => !value)) throw new Error("Có bản ghi không hợp lệ trong " + field + ". Chưa nhập dữ liệu.");
      out[field] = newest(rows.filter(Boolean), field === "playback_reports" ? value => JSON.stringify(value) : key).slice(0, field === "playback_reports" ? 100 : 10000);
    }
    if (data.episode_positions !== undefined && !isObject(data.episode_positions) && strict) throw new Error("Sai định dạng: episode_positions");
    const positions = isObject(data.episode_positions) ? data.episode_positions : {};
    let positionCount = 0;
    for (const [id, episodes] of Object.entries(positions)) {
      if (["__proto__", "prototype", "constructor"].includes(id) || !id || id.length > 500 || !isObject(episodes)) { if (strict) throw new Error("Mã phim/vị trí tập không hợp lệ."); else continue; }
      const saved = {};
      for (const [episode, value] of Object.entries(episodes)) {
        if (!/^[1-9]\d{0,5}$/.test(episode) || !isObject(value)) { if (strict) throw new Error("Vị trí tập không hợp lệ."); else continue; }
        if (++positionCount > 50000) { if (strict) throw new Error("Quá nhiều vị trí tập."); else break; }
        saved[episode] = { currentTime: number(value.currentTime, 1e8), duration: number(value.duration, 1e8), progress: number(value.progress, 100), server: Math.floor(number(value.server, 10000)), source: ["auto", "kkphim", "nguonc", "hardcode"].includes(value.source) ? value.source : "auto", updatedAt: timestamp(value.updatedAt) };
        if (typeof value.episodeName === "string") saved[episode].episodeName = text(value.episodeName,100);
      }
      if (Object.keys(saved).length) Object.defineProperty(out.episode_positions, id, { value: saved, enumerable: true, configurable: true, writable: true });
    }
    if (data.player_preferences_v1 !== undefined) {
      const value = data.player_preferences_v1;
      const valid = isObject(value) && [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(value.rate) && typeof value.volume === "number" && Number.isFinite(value.volume) && value.volume >= 0 && value.volume <= 1 && typeof value.muted === "boolean";
      if (!valid && strict) throw new Error("Thiết lập trình phát không hợp lệ.");
      if (valid) out.player_preferences_v1 = {rate:value.rate,volume:value.volume,muted:value.muted};
    }
    for (const [name, allowed] of [["autonext_enabled", [0, 1]], ["audio_boost", [1, 1.5, 2, 3]]]) {
      if (data[name] === undefined) continue;
      if ((typeof data[name] === "string" || typeof data[name] === "number") && String(data[name]).trim() !== "" && allowed.includes(Number(data[name]))) out[name] = Number(data[name]);
      else if (strict) throw new Error("Thiết lập không hợp lệ: " + name);
    }
    if (data.player_intro_ranges_v1 !== undefined) {
      if (!isObject(data.player_intro_ranges_v1)) { if (strict) throw new Error("Mốc mở đầu không hợp lệ."); }
      else {
        const entries = [];
        for (const [id, value] of Object.entries(data.player_intro_ranges_v1)) {
          let parts; try { parts = JSON.parse(id); } catch (_) {}
          const validKey = id.length <= 2500 && Array.isArray(parts) && parts.length === 4 && parts.every(part => typeof part === "string" || typeof part === "number") && parts.every(part => String(part).length <= 500);
          const valid = validKey && isObject(value) && Number.isFinite(value.start) && Number.isFinite(value.end) && value.start >= 0 && value.end > value.start && value.end <= 1e8;
          if (!valid) { if (strict) throw new Error("Có mốc mở đầu không hợp lệ."); else continue; }
          entries.push([id,{start:value.start,end:value.end,updatedAt:timestamp(value.updatedAt)}]);
        }
        entries.sort((a,b) => b[1].updatedAt - a[1].updatedAt);
        out.player_intro_ranges_v1 = Object.fromEntries(entries.slice(0,300));
      }
    }
    return out;
  }
  function read(storage) {
    const data = {}, warnings = [];
    for (const name of KEYS) {
      try {
        const raw = storage.getItem(name);
        if (raw !== null) {
          data[name] = JSON.parse(raw);
          normalize({[name]:data[name]}, true);
        }
      }
      catch (_) { warnings.push(name); }
    }
    return { data: normalize(data), warnings };
  }
  function backup(data, now = new Date()) { return { format: FORMAT, version: VERSION, exportedAt: now.toISOString(), data: normalize(data) }; }
  function parseBackup(raw) {
    if (typeof raw !== "string" || raw.length > 8 * 1024 * 1024) throw new Error("Chọn tệp JSON tối đa 8 MB.");
    let input; try { input = JSON.parse(raw); } catch (_) { throw new Error("Tệp không phải JSON hợp lệ."); }
    if (!isObject(input) || input.format !== FORMAT || input.version !== VERSION) throw new Error("Tệp không đúng định dạng sao lưu LauPhim phiên bản 1.");
    return normalize(input.data, true);
  }
  function merge(local, incoming) {
    const a = normalize(local), b = normalize(incoming);
    const out = { my_wishlist: newest([...a.my_wishlist, ...b.my_wishlist]), continue_watching_list: newest([...a.continue_watching_list, ...b.continue_watching_list]), episode_positions: {}, playback_reports: newest([...a.playback_reports, ...b.playback_reports], value => JSON.stringify(value)).slice(0, 100) };
    for (const source of [a.episode_positions, b.episode_positions]) for (const [id, episodes] of Object.entries(source)) {
      const target = Object.hasOwn(out.episode_positions, id) ? out.episode_positions[id] : (out.episode_positions[id] = {});
      for (const [episode, value] of Object.entries(episodes)) if (!target[episode] || value.updatedAt > target[episode].updatedAt) target[episode] = value;
    }
    // Preferences had no timestamps in earlier player versions: keep local choices on merge.
    for (const name of ["player_preferences_v1", "autonext_enabled", "audio_boost"]) {
      if (a[name] !== undefined) out[name] = a[name]; else if (b[name] !== undefined) out[name] = b[name];
    }
    if (a.player_intro_ranges_v1 || b.player_intro_ranges_v1) {
      out.player_intro_ranges_v1 = {...a.player_intro_ranges_v1};
      for (const [id, value] of Object.entries(b.player_intro_ranges_v1 || {})) if (!out.player_intro_ranges_v1[id] || value.updatedAt > out.player_intro_ranges_v1[id].updatedAt) out.player_intro_ranges_v1[id] = value;
    }
    return normalize(out);
  }
  function write(storage, data) {
    const prepared = normalize(data, true), before = new Map();
    // Capture all previous values before changing any key. A rejected read writes nothing.
    for (const name of KEYS) before.set(name, storage.getItem(name));
    try { for (const name of KEYS) if (prepared[name] === undefined) storage.removeItem(name); else storage.setItem(name, JSON.stringify(prepared[name])); }
    catch (error) {
      let restored = true;
      for (const [name, value] of before) try { if (value === null) storage.removeItem(name); else storage.setItem(name, value); } catch (_) { restored = false; }
      const failure = new Error(restored ? "Không lưu được vì bộ nhớ bị chặn hoặc đã đầy. Dữ liệu cũ đã được giữ lại." : "Bộ nhớ từ chối ghi và khôi phục. Hãy tải bản sao dữ liệu đang có trước khi thử lại.");
      failure.cause = error; throw failure;
    }
    return prepared;
  }
  function counts(data) { const value = normalize(data); return { favorites: value.my_wishlist.length, watching: value.continue_watching_list.filter(item => !finished(item)).length, positions: Object.values(value.episode_positions).reduce((n, episodes) => n + Object.keys(episodes).length, 0), reports: value.playback_reports.length }; }
  function finished(item) { const last = typeof item.episodeIsLast === "boolean" ? item.episodeIsLast : Number(item.totalEpisodes) > 0 && Number(item.episode) >= Number(item.totalEpisodes); return last && Number(item.progress) >= 95; }
  const api = { KEYS, FORMAT, VERSION, key, movie, imageUrl, normalize, newest, read, backup, parseBackup, merge, write, counts, finished };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PersonalData = api;
})(globalThis);
