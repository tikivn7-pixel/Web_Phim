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
  function parseIntroTime(value) {
    const text = String(value ?? '').trim();
    if (!/^(?:\d+:){0,2}\d+(?:\.\d{1,3})?$/.test(text)) return NaN;
    const parts = text.split(':').map(Number);
    if (parts.length > 1 && parts.at(-1) >= 60 || parts.length === 3 && parts[1] >= 60) return NaN;
    const seconds = parts.reduce((total, part) => total * 60 + part, 0);
    return Number.isFinite(seconds) ? seconds : NaN;
  }
  function introTimeLabel(seconds) {
    const millis = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
    return timeLabel(Math.floor(millis / 1000)) + (millis % 1000 ? '.' + String(millis % 1000).padStart(3, '0') : '');
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

    let skipButton, introEditor, introStartButton;
    if (introKey) {
      const saved = read(storage, INTRO_KEY, {});
      const ranges = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
      let range = validRange(ranges[introKey]) ? ranges[introKey] : null;
      let draftStart = null;
      const intro = doc.createElement("details"); intro.className = "player-intro-editor";
      introEditor = intro;
      const title = doc.createElement("summary"); title.textContent = "Opening · Mốc chính xác của tập này";
      const note = doc.createElement("p"); note.textContent = "Đánh dấu ở đầu và cuối opening, hoặc nhập phút:giây.mili giây (ví dụ 1:32.500). Chỉ dùng cho đúng tập, nguồn và server này; không tự đoán hoặc tự áp sang tập khác.";
      const marked = doc.createElement("p"); marked.className = "player-intro-range";
      const inputs = doc.createElement('div'); inputs.className = 'player-intro-inputs';
      const timeInput = labelText => { const label = doc.createElement('label'); label.textContent = labelText; const input = doc.createElement('input'); input.type = 'text'; input.placeholder = '0:00.000'; input.maxLength = 20; input.setAttribute('aria-label', labelText); input.setAttribute('inputmode', 'text'); label.append(input); inputs.append(label); return input; };
      const startInput = timeInput('Opening bắt đầu'), endInput = timeInput('Opening kết thúc');
      const syncInputs = () => { startInput.value = range ? introTimeLabel(range.start) : ''; endInput.value = range ? introTimeLabel(range.end) : ''; };
      syncInputs();
      const actions = doc.createElement("div"); actions.className = "player-intro-actions";
      const button = (text, callback) => { const btn = doc.createElement("button"); btn.type = "button"; btn.textContent = text; listen(btn, "click", callback); actions.append(btn); return btn; };
      const refreshIntro = () => {
        const ready = Number.isFinite(video.duration) && video.duration > 0;
        const usable = ready && range && validRange(range, video.duration);
        marked.textContent = draftStart !== null ? "Mốc bắt đầu: " + introTimeLabel(draftStart) + ". Chọn mốc kết thúc tiếp theo."
          : range ? "Mốc đang dùng: " + introTimeLabel(range.start) + " → " + introTimeLabel(range.end) : "Chưa có opening được đánh dấu. Bấm lưu mốc để bật nút bỏ qua.";
        skipButton.hidden = !(usable && video.currentTime >= range.start && video.currentTime < range.end);
        actions.children[0].disabled = actions.children[1].disabled = actions.children[3].disabled = !ready;
      };
      const saveRange = () => {
        try {
          if (!storage) throw Error('storage');
          const raw = storage.getItem(INTRO_KEY), latest = raw === null ? {} : JSON.parse(raw);
          if (!latest || typeof latest !== 'object' || Array.isArray(latest)) throw Error('invalid');
          if (range) Object.defineProperty(latest, introKey, { value: { ...range, updatedAt: now() }, enumerable: true, configurable: true, writable: true }); else delete latest[introKey];
          const entries = Object.entries(latest).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0)).slice(0, 300);
          storage.setItem(INTRO_KEY, JSON.stringify(Object.fromEntries(entries))); return true;
        } catch (_) { show("Mốc chỉ áp dụng trong tab này. Chưa lưu được; dữ liệu mốc cũ được giữ nguyên nếu bộ nhớ bị lỗi hoặc bị chặn."); return false; }
      };
      introStartButton = button("Đánh dấu bắt đầu", () => { const current = Number(video.currentTime); if (!Number.isFinite(current) || current < 0 || !Number.isFinite(video.duration) || current >= video.duration) { show('Chờ video tải, rồi chọn mốc bắt đầu hợp lệ.'); return; } draftStart = current; startInput.value = introTimeLabel(current); refreshIntro(); });
      button("Đánh dấu kết thúc", () => {
        const candidate = { start: draftStart, end: Number(video.currentTime) };
        if (draftStart === null || !Number.isFinite(video.duration) || !validRange(candidate, video.duration)) { show("Đánh dấu bắt đầu, rồi tua đến mốc kết thúc lớn hơn mốc bắt đầu."); return; }
        range = candidate; draftStart = null; syncInputs(); const saved = saveRange(); refreshIntro(); if (saved) show("Đã lưu opening cho đúng tập, nguồn và server này.");
      });
      button("Xóa đoạn đã lưu", () => { range = null; draftStart = null; syncInputs(); const saved = saveRange(); refreshIntro(); if (saved) show('Đã xóa mốc opening của tập này.'); });
      button('Lưu mốc opening', () => { const candidate = { start: parseIntroTime(startInput.value), end: parseIntroTime(endInput.value) }; if (!Number.isFinite(video.duration) || !validRange(candidate, video.duration)) { show('Nhập mốc hợp lệ: kết thúc lớn hơn bắt đầu và không vượt thời lượng video. Dùng dạng 1:32.500 hoặc số giây.'); return; } range = candidate; draftStart = null; syncInputs(); const saved = saveRange(); refreshIntro(); if (saved) show('Đã lưu mốc opening chính xác cho tập này.'); });
      skipButton = doc.createElement("button"); skipButton.className = "player-skip-intro"; skipButton.type = "button"; skipButton.textContent = "Bỏ qua opening →"; skipButton.hidden = true;
      listen(skipButton, "click", () => { if (Number.isFinite(video.duration) && validRange(range, video.duration) && video.currentTime >= range.start && video.currentTime < range.end) { try { video.currentTime = range.end; notify('Đã bỏ qua opening'); } catch (_) { show('Chưa tua được video. Hãy đợi nguồn tải rồi thử lại.'); } } refreshIntro(); }); host?.append(skipButton);
      listen(video, "timeupdate", refreshIntro); listen(video, "loadedmetadata", refreshIntro); listen(video, 'durationchange', refreshIntro); listen(video, 'seeked', refreshIntro); listen(video, 'emptied', refreshIntro); refreshIntro();
      intro.append(title, note, inputs, actions, marked); box.append(intro);
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
    return { speed, sleep, tick, destroy, openIntro: () => { if (!introEditor) return false; introEditor.open = true; introEditor.scrollIntoView?.({block:'nearest'}); introStartButton?.focus?.(); return true; }, shouldAutoNext: () => { tick(); return !sleepExpired && (!deadline || deadline > now()); } };
  }
  const api = { PREFS_KEY, SLEEP_KEY, INTRO_KEY, RATES, getStorage, read, write, preferences, shouldIgnoreShortcut, seekTarget, validRange, timeLabel, parseIntroTime, introTimeLabel, sleepRemaining, attach };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PlayerControls = api;
})(globalThis);
