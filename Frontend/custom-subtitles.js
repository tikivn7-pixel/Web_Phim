(function (root) {
  'use strict';
  const KEY = 'subtitle_preferences_v1', MAX_BYTES = 2 * 1024 * 1024, MAX_CUES = 10000;
  const COLORS = ['#ffffff', '#ffe66d', '#99e6ff'], BACKGROUNDS = ['#000000cc', '#00000066', 'transparent'];
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  function preferences(value) {
    value = value && typeof value === 'object' ? value : {};
    return { offset: Math.max(-120, Math.min(120, finite(value.offset, 0))), fontSize: Math.max(16, Math.min(48, finite(value.fontSize, 24))), color: COLORS.includes(value.color) ? value.color : COLORS[0], background: BACKGROUNDS.includes(value.background) ? value.background : BACKGROUNDS[0] };
  }
  function timestamp(value) {
    const match = String(value).match(/^(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})$/);
    if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) return NaN;
    const result = Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
    return result <= 100000000 ? result : NaN;
  }
  function parse(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) throw Error('Phụ đề phải nhỏ hơn hoặc bằng 2 MB.');
    text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    const blocks = text.split(/\n[ \t]*\n/), cues = [];
    for (const block of blocks) {
      const lines = block.split('\n');
      if (/^WEBVTT(?:\s|$)/.test(lines[0]) || /^(?:NOTE|STYLE|REGION)(?:\s|$)/.test(lines[0])) continue;
      const position = lines[0]?.includes('-->') ? 0 : 1;
      const match = lines[position]?.match(/^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/);
      if (!match) throw Error('Không đọc được mốc thời gian SRT/VTT.');
      const start = timestamp(match[1]), end = timestamp(match[2]);
      const content = lines.slice(position + 1).join('\n').trim();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !content || content.length > 10000) throw Error('Phụ đề có thời gian hoặc nội dung không hợp lệ.');
      cues.push(Object.freeze({ start, end, text: content }));
      if (cues.length > MAX_CUES) throw Error('Phụ đề vượt quá 10.000 dòng thời gian.');
    }
    if (!cues.length) throw Error('Tệp chưa có dòng phụ đề hợp lệ.');
    return Object.freeze(cues.sort((a, b) => a.start - b.start || a.end - b.end));
  }
  function active(cues, time, offset = 0) {
    const at = finite(time, 0) - finite(offset, 0);
    return cues.filter(cue => cue.start <= at && cue.end > at).slice(0, 20).map(cue => cue.text).join('\n').slice(0, 6000);
  }
  function attach(video, mount, options = {}) {
    if (!mount || !video || typeof document === 'undefined') return { destroy() {} };
    if (mount.__customSubtitles) mount.__customSubtitles.destroy();
    const section = document.createElement('details'); section.className = 'custom-subtitles';
    section.innerHTML = '<summary>Phụ đề cá nhân <span>SRT / VTT</span></summary><div class="custom-subtitles-body"><p>Tệp chỉ nằm trong bộ nhớ của tab này. Phụ đề của nguồn phát vẫn giữ nguyên.</p><label class="subtitle-file">Chọn tệp phụ đề<input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" aria-label="Tệp phụ đề SRT hoặc VTT"></label><div class="subtitle-settings"><label>Độ trễ (giây)<input type="number" min="-120" max="120" step="0.5" data-subtitle-setting="offset"></label><label>Cỡ chữ<input type="number" min="16" max="48" step="1" data-subtitle-setting="fontSize"></label><label>Màu chữ<select data-subtitle-setting="color"><option value="#ffffff">Trắng</option><option value="#ffe66d">Vàng</option><option value="#99e6ff">Xanh nhạt</option></select></label><label>Nền chữ<select data-subtitle-setting="background"><option value="#000000cc">Đậm</option><option value="#00000066">Nhạt</option><option value="transparent">Trong suốt</option></select></label></div><p class="subtitle-offset-hint">Số dương: phụ đề xuất hiện muộn hơn. Phạm vi ±120 giây.</p><button type="button" class="subtitle-clear">Gỡ phụ đề</button><p class="subtitle-status" role="status"></p></div>';
    mount.append(section);
    const status = section.querySelector('.subtitle-status'), file = section.querySelector('input[type=file]'), settings = section.querySelectorAll('[data-subtitle-setting]');
    let prefs; try { prefs = preferences(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { prefs = preferences({}); }
    let cues = [], overlay = null, destroyed = false, revision = 0, raf = 0, last = '', prefix = [];
    if (!options.embedded) {
      overlay = document.createElement('div'); overlay.className = 'custom-subtitle-overlay'; overlay.setAttribute('aria-hidden', 'true');
      const parent = video.parentElement; if (parent) { parent.classList.add('custom-subtitle-host'); parent.append(overlay); }
    }
    const applyStyle = () => { if (overlay) { overlay.style.setProperty('--subtitle-size', prefs.fontSize + 'px'); overlay.style.setProperty('--subtitle-color', prefs.color); overlay.style.setProperty('--subtitle-background', prefs.background); } settings.forEach(input => { input.value = prefs[input.dataset.subtitleSetting]; }); };
    function render() {
      if (destroyed || !overlay) return;
      const at = finite(video.currentTime, 0) - prefs.offset;
      let lo = 0, hi = cues.length;
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (cues[mid].start <= at) lo = mid + 1; else hi = mid; }
      const visible = [];
      for (let index = lo - 1; index >= 0 && prefix[index] > at; index--) if (cues[index].end > at) visible.unshift(cues[index].text);
      const text = visible.slice(0, 20).join('\n').slice(0, 6000);
      if (text !== last) { last = text; overlay.textContent = text; overlay.hidden = !text; }
    }
    function tick() { cancelAnimationFrame(raf); render(); if (!destroyed && !video.paused && !video.ended) raf = requestAnimationFrame(tick); }
    function load(text, name = 'Phụ đề cá nhân') {
      if (options.embedded) throw Error('Nguồn nhúng không hỗ trợ phụ đề cá nhân. Hãy chọn nguồn video trực tiếp.');
      const parsed = parse(text); cues = parsed; let end = 0; prefix = cues.map(cue => end = Math.max(end, cue.end));
      status.textContent = name.slice(0, 150) + ' · ' + cues.length + ' dòng thời gian'; render(); return cues.length;
    }
    file.addEventListener('change', async () => {
      const selected = file.files?.[0], current = ++revision; if (!selected) return;
      try { if (!/\.(srt|vtt)$/i.test(selected.name) || selected.size > MAX_BYTES) throw Error('Chọn tệp .srt hoặc .vtt tối đa 2 MB.'); const content = await selected.text(); if (!destroyed && current === revision) load(content, selected.name); }
      catch (error) { if (!destroyed && current === revision) status.textContent = error.message; }
    });
    settings.forEach(input => input.addEventListener('change', () => { prefs = preferences({ ...prefs, [input.dataset.subtitleSetting]: input.value }); applyStyle(); render(); try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) { status.textContent = 'Tùy chỉnh đang dùng trong tab này; trình duyệt chưa cho phép lưu.'; } }));
    section.querySelector('.subtitle-clear').addEventListener('click', () => { revision++; cues = []; prefix = []; file.value = ''; render(); status.textContent = 'Đã gỡ phụ đề cá nhân.'; });
    const events = ['timeupdate', 'seeked', 'loadedmetadata', 'play', 'pause', 'ended']; events.forEach(name => video.addEventListener(name, tick));
    const destroy = () => { if (destroyed) return; destroyed = true; revision++; cancelAnimationFrame(raf); events.forEach(name => video.removeEventListener(name, tick)); window.removeEventListener('pagehide', onHide); window.removeEventListener('pageshow', onShow); overlay?.remove(); section.remove(); if (mount.__customSubtitles === api) delete mount.__customSubtitles; };
    const onHide = event => { if (!event.persisted) destroy(); else cancelAnimationFrame(raf); };
    const onShow = () => { if (!destroyed) tick(); }; window.addEventListener('pageshow', onShow);
    const baseDestroy = destroy;
    const api = { load, render, destroy() { window.removeEventListener('pageshow', onShow); baseDestroy(); } };
    window.addEventListener('pagehide', onHide);
    if (options.embedded) { file.disabled = true; settings.forEach(input => input.disabled = true); status.textContent = 'Nguồn nhúng không hỗ trợ phụ đề cá nhân. Chọn nguồn video trực tiếp để sử dụng.'; } else status.textContent = 'Chưa chọn tệp. Hỗ trợ tối đa 2 MB và 10.000 dòng thời gian.';
    applyStyle(); if (overlay) overlay.hidden = true; mount.__customSubtitles = api; return api;
  }
  const api = { KEY, MAX_BYTES, MAX_CUES, preferences, timestamp, parse, active, attach };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CustomSubtitles = api;
})(globalThis);
