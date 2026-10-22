// Pure helpers shared by playback navigation and tests.
(function (root) {
  function episodeKey(value) {
    const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim().replace(/^(tap|episode|ep)[\s-]*/i, "");
    return /^\d+$/.test(text) ? String(Number(text)) : text;
  }
  function findEpisodeIndex(current, target) {
    const keys = [current?.name, current?.slug].map(episodeKey).filter(Boolean);
    if (!keys.length) return -1;
    return target.findIndex(item => [item.name,item.slug].map(episodeKey).filter(Boolean).some(key => keys.includes(key)));
  }
  // Return provider-array indices: URL ep= remains compatible even if a server lists 2,1.
  function logicalNeighbors(items, index) {
    const entries = (Array.isArray(items) ? items : []).map((item, position) => ({ position, key: episodeKey(item?.name || item?.slug) }));
    const empty = { previous: null, next: null, isFirst: false, isLast: false };
    if (!Number.isInteger(index) || index < 0 || index >= entries.length) return empty;
    const unique = new Set(entries.map(item => item.key));
    if (unique.size === entries.length && entries.every(item => /^\d+$/.test(item.key) && Number.isSafeInteger(Number(item.key)))) entries.sort((a, b) => Number(a.key) - Number(b.key));
    const position = entries.findIndex(item => item.position === index);
    return { previous: entries[position - 1]?.position ?? null, next: entries[position + 1]?.position ?? null, isFirst: position === 0, isLast: position === entries.length - 1 };
  }
  function positionMatches(saved, { episodeName, server = 0, source = "auto" }) {
    if (!saved || typeof saved !== "object") return false;
    if (saved.episodeName) return episodeKey(saved.episodeName) === episodeKey(episodeName);
    return Number(saved.server || 0) === Number(server) && String(saved.source || "auto") === String(source);
  }
  function isSeriesFinal(items, index, declaredTotal) {
    if (!logicalNeighbors(items, index).isLast || !Number.isSafeInteger(declaredTotal) || declaredTotal < 1) return false;
    const current = episodeKey(items[index]?.name || items[index]?.slug);
    return /^\d+$/.test(current) ? Number(current) >= declaredTotal : items.length >= declaredTotal;
  }
  function safeEmbedUrl(value) {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value)) return "";
    try { const url = new URL(value); return url.username || url.password ? "" : url.href; }
    catch (_) { return ""; }
  }
  function resumeParams(current, { source, server = 0, episode, time = 0, episodeName }) {
    const params = new URLSearchParams(current);
    params.set("server", server);
    if (episode) params.set("ep", episode);
    if (source) params.set("data_source", source);
    params.delete("resume");
    params.delete("target_episode");
    if (Number.isFinite(time) && time > 5) params.set("resume", String(Math.floor(time)));
    if (episodeName) params.set("target_episode", episodeName);
    return params;
  }
  const api = { episodeKey, findEpisodeIndex, logicalNeighbors, positionMatches, isSeriesFinal, safeEmbedUrl, resumeParams };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PlaybackTools = api;
})(globalThis);
