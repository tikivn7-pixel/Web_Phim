// Watch-page helpers keep provider indices intact while presenting logical episode order.
(function (root) {
  function canonical(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim().replace(/^(tap|episode|ep)[\s-]*/i, "");
  }
  function orderedEntries(entries) {
    const list = (Array.isArray(entries) ? entries : []).filter(entry => entry && typeof entry.name === "string").map(entry => ({ ...entry }));
    const keys = list.map(entry => canonical(entry.name));
    if (new Set(keys.map(Number)).size === keys.length && keys.every(key => /^\d+$/.test(key) && Number.isSafeInteger(Number(key)))) {
      list.sort((a, b) => Number(canonical(a.name)) - Number(canonical(b.name)));
    }
    return list;
  }
  function filterEntries(entries, { query = "", filter = "all", isWatched = () => false } = {}) {
    const keyword = canonical(query);
    return orderedEntries(entries).filter(entry => {
      if (keyword && !canonical(entry.name).includes(keyword)) return false;
      const watched = Boolean(isWatched(entry.name));
      return filter === "watched" ? watched : filter === "unwatched" ? !watched : true;
    });
  }

  // Attach only to a native, known episode. Opening an iframe or restoring a URL never marks it watched.
  function attach({ video, slug, name, available = false, embedded = false, tracker = root.EpisodeTracker, storage,
    onChange = () => {}, onError = () => {} } = {}) {
    if (!video || !available || embedded || !slug || !name || !tracker) return { destroy() {} };
    const listeners = [];
    let verifiedMetadata = false;
    let hasPlayed = false;
    let attemptedThisPass = false;
    let blocked = false;
    const listen = (event, callback) => { video.addEventListener(event, callback); listeners.push([event, callback]); };
    const durationValid = () => Number.isFinite(Number(video.duration)) && Number(video.duration) > 0;
    const progress = () => durationValid() && Number.isFinite(Number(video.currentTime)) ? Number(video.currentTime) / Number(video.duration) : 0;
    function complete() {
      if (blocked || attemptedThisPass) return;
      attemptedThisPass = true;
      try {
        if (!tracker.isWatched(slug, name, storage)) {
          tracker.set(slug, name, true, storage);
          onChange();
        }
      } catch (error) {
        blocked = true;
        onError(error);
      }
    }
    listen("loadedmetadata", () => { verifiedMetadata = durationValid(); });
    listen("emptied", () => { verifiedMetadata = false; hasPlayed = false; });
    listen("play", () => { hasPlayed = true; });
    listen("timeupdate", () => {
      if (!verifiedMetadata || !durationValid()) return;
      const ratio = progress();
      if (ratio < 0.95) attemptedThisPass = false;
      if (hasPlayed && !video.paused && ratio >= 0.95 && ratio <= 1.01) complete();
    });
    listen("ended", () => {
      if (verifiedMetadata && durationValid() && hasPlayed && progress() >= 0.95 && progress() <= 1.01) complete();
    });
    return { destroy() { for (const [event, callback] of listeners) video.removeEventListener(event, callback); } };
  }
  const api = { orderedEntries, filterEntries, attach };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WatchProgress = api;
})(globalThis);
