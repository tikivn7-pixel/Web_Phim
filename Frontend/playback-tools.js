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
  root.PlaybackTools = { episodeKey, findEpisodeIndex, resumeParams };
})(globalThis);
