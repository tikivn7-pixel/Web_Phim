// Local playback preferences and controls. No remote metadata or guessed intro times.
(function (root) {
  "use strict";
  const PREFS_KEY = "player_preferences_v1";
  const SLEEP_KEY = "player_sleep_deadline_v1";
  const INTRO_KEY = "player_intro_ranges_v1";
  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  function getStorage(win, key) { try { return win[key]; } catch (_) { return null; } }

  function read(storage, key, fallback) {
    try { const value = JSON.parse(storage?.getItem(key) || "null"); return value == null ? fallback : value; }
    catch (_) { return fallback; }
  }
  function write(storage, key, value) {
    try { storage?.setItem(key, JSON.stringify(value)); return !!storage; }
    catch (_) { return false; }
  }
  function preferences(value) {
    const data = value && typeof value === "object" ? value : {};
    return {
      rate: RATES.includes(Number(data.rate)) ? Number(data.rate) : 1,
      volume: Number.isFinite(data.volume) ? Math.min(1, Math.max(0, data.volume)) : 1,
      muted: data.muted === true,
    };
  }
  function shouldIgnoreShortcut(event, doc) {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return true;
    const target = event.target;
    if (target?.isContentEditable || target?.closest?.("input, textarea, select, button, a, summary, [role=slider], [role=button], [contenteditable=true]")) return true;
    return !!doc?.querySelector?.("dialog[open], [aria-modal=true]:not([hidden])");
  }
  function seekTarget(current, delta, duration) {
    const time = Number.isFinite(Number(current)) ? Number(current) : 0;
    const limit = Number.isFinite(duration) && duration > 0 ? duration : Math.max(0, time);
    return Math.min(limit, Math.max(0, time + (Number.isFinite(delta) ? delta : 0)));
  }
  function validRange(value, duration = Infinity) {
    return !!value && Number.isFinite(value.start) && Number.isFinite(value.end)
      && value.start >= 0 && value.end > value.start && value.end <= duration;
  }
  function timeLabel(seconds) {
    const n = Math.max(0, Math.floor(Number(seconds) || 0));
    return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
  }
  function sleepRemaining(deadline, now = Date.now()) {
    return Number.isFinite(deadline) && deadline > 0 ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  }

  function attach({ video, player = null, panel, introKey = "", onSleep = () => {},
    storage, session, doc = root.document, win = root, now = () => Date.now() }) {
    if (!video || !panel) return null;
    // Accessing localStorage itself may throw in private/restricted contexts.
    if (storage === undefined) storage = getStorage(win, "localStorage");
    if (session === undefined) session = getStorage(win, "sessionStorage");
    const removers = [];
    const listen = (target, event, callback) => {
      target?.addEventListener?.(event, callback);
      removers.push(() => target?.removeEventListener?.(event, callback));
    };
    const prefs = preferences(read(storage, PREFS_KEY, {}));
    try { video.playbackRate = prefs.rate; video.volume = prefs.volume; video.muted = prefs.muted; } catch (_) {}
    const box = doc.createElement("section"); box.className = "player-utilities"; box.setAttribute("aria-label", "Tùy chỉnh phát phim");
    const row = doc.createElement("div"); row.className = "player-utilities-row"; box.append(row);
    const status = doc.createElement("p"); status.className = "player-utility-status"; status.setAttribute("role", "status");
    const show = text => { status.textContent = text; };
    const select = (labelText, options) => {
      const label = doc.createElement("label"); label.textContent = labelText + " ";
      const control = doc.createElement("select"); control.setAttribute("aria-label", labelText);
      options.forEach(([value, text]) => { const option = doc.createElement("option"); option.value = String(value); option.textContent = text; control.append(option); });
      label.append(control); row.append(label); return control;
    };
    const speed = select("Tốc độ phát", RATES.map(rate => [rate, rate + "×"])); speed.value = String(prefs.rate);
    const persistPreferences = () => write(storage, PREFS_KEY, preferences({ rate: video.playbackRate, volume: video.volume, muted: video.muted }));
    listen(speed, "change", () => {
      try { video.playbackRate = Number(speed.value); } catch (_) {}
      persistPreferences(); show("Tốc độ " + speed.value + "×");
    });
    listen(video, "ratechange", () => { speed.value = String(video.playbackRate); persistPreferences(); });
    listen(video, "volumechange", persistPreferences);

    const sleep = select("Hẹn giờ dừng", [[0, "Tắt"], [15, "15 phút"], [30, "30 phút"], [45, "45 phút"], [60, "60 phút"], [90, "90 phút"]]);
    const sleepLabel = doc.createElement("span"); sleepLabel.className = "player-sleep-status"; row.append(sleepLabel);
    let deadline = Number(read(session, SLEEP_KEY, 0)) || 0;
    let sleepExpired = false;
    const tick = () => {
      if (!deadline) { sleepLabel.textContent = ""; return; }
      const remaining = sleepRemaining(deadline, now());
      if (remaining > 0) { sleepLabel.textContent = "Còn " + timeLabel(remaining); return; }
      deadline = 0; sleepExpired = true; sleep.value = "0"; write(session, SLEEP_KEY, 0);
      try { video.pause(); } catch (_) {}
      onSleep(); sleepLabel.textContent = "Đã dừng theo hẹn giờ"; show("Đã hết giờ. Nhấn Phát để tiếp tục xem.");
    };
    listen(sleep, "change", () => {
      sleepExpired = false; deadline = Number(sleep.value) > 0 ? now() + Number(sleep.value) * 60000 : 0;
      write(session, SLEEP_KEY, deadline); tick();
      show(deadline ? "Hẹn giờ vẫn được giữ khi chuyển tập trong tab này." : "Đã tắt hẹn giờ dừng.");
    });
    if (deadline > 0) {
      const matching = [15, 30, 45, 60, 90].find(minutes => minutes * 60 >= sleepRemaining(deadline, now()));
      sleep.value = String(matching || 90);
    }
    let timer = win.setInterval(tick, 1000);
    listen(doc, "visibilitychange", tick);
    listen(video, "play", () => { sleepExpired = false; tick(); });
    tick();

    const help = doc.createElement("details"); help.className = "player-shortcuts";
    const summary = doc.createElement("summary"); summary.textContent = "Phím tắt";
    const helpText = doc.createElement("p"); helpText.textContent = "Space / K: phát, dừng · ← / →: tua 10 giây · ↑ / ↓: âm lượng · M: tắt tiếng · F: toàn màn hình · T: tắt đèn. Phím tắt tạm ngừng khi chọn nút hoặc nhập liệu.";
    help.append(summary, helpText); box.append(help);

    const host = player?.elements?.container || video.parentElement;
    const toast = doc.createElement("div"); toast.className = "player-key-toast"; toast.setAttribute("aria-hidden", "true"); host?.append(toast);
    let toastTimer;
    const notify = text => { toast.textContent = text; toast.classList.add("visible"); win.clearTimeout(toastTimer); toastTimer = win.setTimeout(() => toast.classList.remove("visible"), 900); };
    listen(doc, "keydown", event => {
      if (shouldIgnoreShortcut(event, doc)) return;
      const key = event.key?.toLowerCase();
      if ([" ", "k", "m", "f"].includes(key) && event.repeat) return;
      let handled = true;
      switch (key) {
        case " ": case "k":
          if (video.paused) Promise.resolve(video.play()).catch(() => show("Trình duyệt chưa cho phép phát. Hãy bấm nút Phát trên video."));
          else video.pause(); break;
        case "arrowleft": case "arrowright": {
          const delta = key === "arrowleft" ? -10 : 10;
          try { video.currentTime = seekTarget(video.currentTime, delta, video.duration); } catch (_) {}
          notify((delta > 0 ? "+" : "−") + "10 giây"); break;
        }
        case "arrowup": case "arrowdown":
          try { video.volume = Math.min(1, Math.max(0, Math.round((video.volume + (key === "arrowup" ? 0.1 : -0.1)) * 10) / 10)); video.muted = false; } catch (_) {}
          notify("Âm lượng " + Math.round(video.volume * 100) + "%"); break;
        case "m": video.muted = !video.muted; notify(video.muted ? "Tắt tiếng" : "Bật tiếng"); break;
        case "f": {
          try {
            const result = player?.fullscreen ? player.fullscreen.toggle() : doc.fullscreenElement ? doc.exitFullscreen?.() : host?.requestFullscreen?.();
            Promise.resolve(result).catch(() => show("Thiết bị chưa cho phép toàn màn hình."));
          } catch (_) { show("Thiết bị chưa cho phép toàn màn hình."); }
          break;
        }
        default: handled = false;
      }
      if (handled) event.preventDefault();
    });

    let skipButton;
    if (introKey) {
      const saved = read(storage, INTRO_KEY, {});
      const ranges = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
      let range = validRange(ranges[introKey]) ? ranges[introKey] : null;
      let draftStart = null;
      const intro = doc.createElement("details"); intro.className = "player-intro-editor";
      const title = doc.createElement("summary"); title.textContent = "Đặt đoạn mở đầu của tập này";
      const note = doc.createElement("p"); note.textContent = "Tua đến hai mốc rồi đánh dấu. Chỉ áp dụng cho tập và nguồn đang xem; không tự đoán thời gian intro.";
      const marked = doc.createElement("p"); marked.className = "player-intro-range";
      const actions = doc.createElement("div"); actions.className = "player-intro-actions";
      const button = (text, callback) => { const btn = doc.createElement("button"); btn.type = "button"; btn.textContent = text; listen(btn, "click", callback); actions.append(btn); return btn; };
      const refreshIntro = () => {
        const usable = range && validRange(range, video.duration);
        marked.textContent = draftStart !== null ? "Mốc bắt đầu: " + timeLabel(draftStart) + ". Chọn mốc kết thúc tiếp theo."
          : range ? "Đã lưu: " + timeLabel(range.start) + " → " + timeLabel(range.end) : "Chưa có đoạn mở đầu được đánh dấu.";
        skipButton.hidden = !(usable && video.currentTime >= range.start && video.currentTime < range.end - 1);
      };
      const saveRange = () => {
        if (range) ranges[introKey] = { ...range, updatedAt: now() }; else delete ranges[introKey];
        const entries = Object.entries(ranges).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0)).slice(0, 300);
        if (!write(storage, INTRO_KEY, Object.fromEntries(entries))) show("Đã áp dụng trong trang này. Trình duyệt chưa cho phép lưu để dùng lần sau.");
      };
      button("Đánh dấu bắt đầu", () => { draftStart = Math.floor(video.currentTime || 0); refreshIntro(); });
      button("Đánh dấu kết thúc", () => {
        const candidate = { start: draftStart, end: Math.ceil(video.currentTime || 0) };
        if (draftStart === null || !validRange(candidate, video.duration)) { show("Đánh dấu bắt đầu, rồi tua đến mốc kết thúc lớn hơn mốc bắt đầu."); return; }
        range = candidate; draftStart = null; saveRange(); refreshIntro(); show("Đã lưu đoạn mở đầu cho tập và nguồn này.");
      });
      button("Xóa đoạn đã lưu", () => { range = null; draftStart = null; saveRange(); refreshIntro(); });
      skipButton = doc.createElement("button"); skipButton.className = "player-skip-intro"; skipButton.type = "button"; skipButton.textContent = "Bỏ qua mở đầu"; skipButton.hidden = true;
      listen(skipButton, "click", () => { if (validRange(range, video.duration)) video.currentTime = range.end; refreshIntro(); }); host?.append(skipButton);
      listen(video, "timeupdate", refreshIntro); listen(video, "loadedmetadata", refreshIntro); refreshIntro();
      intro.append(title, note, actions, marked); box.append(intro);
    }
    box.append(status); panel.append(box);
    let destroyed = false;
    function destroy() {
      if (destroyed) return; destroyed = true;
      win.clearInterval(timer); win.clearTimeout(toastTimer); removers.forEach(remove => remove());
      toast.remove(); skipButton?.remove(); box.remove();
    }
    // Pagehide can enter the browser's back/forward cache; resume the absolute deadline on return.
    listen(win, "pagehide", () => { win.clearInterval(timer); win.clearTimeout(toastTimer); });
    listen(win, "pageshow", event => { if (event.persisted) { win.clearInterval(timer); tick(); timer = win.setInterval(tick, 1000); } });
    return { speed, sleep, tick, destroy, shouldAutoNext: () => { tick(); return !sleepExpired && (!deadline || deadline > now()); } };
  }
  const api = { PREFS_KEY, SLEEP_KEY, INTRO_KEY, RATES, getStorage, read, write, preferences, shouldIgnoreShortcut, seekTarget, validRange, timeLabel, sleepRemaining, attach };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PlayerControls = api;
})(globalThis);
