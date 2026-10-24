(function (root) {
  'use strict';
  const KEY = 'watch_view_v1';
  const panels = ['episodes', 'sources', 'tools'];
  function start() {
    const doc = root.document, layout = doc.getElementById('watch-layout');
    if (!layout || layout.dataset.watchExperience) return;
    layout.dataset.watchExperience = 'ready';
    const rail = doc.getElementById('watch-side-panel');
    const toggle = doc.getElementById('watch-rail-toggle');
    const tabs = Array.from(doc.querySelectorAll('[data-watch-panel]'));
    let view = { panel: 'episodes', collapsed: false }, previousError = false;
    function read() {
      try {
        const raw = JSON.parse(root.localStorage.getItem(KEY) || '{}');
        return { panel: panels.includes(raw?.panel) ? raw.panel : 'episodes', collapsed: raw?.collapsed === true };
      } catch (_) { return { panel: 'episodes', collapsed: false }; }
    }
    function save() { try { root.localStorage.setItem(KEY, JSON.stringify(view)); } catch (_) {} }
    function text(id, value) { const el = doc.getElementById(id); if (el && el.textContent !== value) el.textContent = value; }
    function setPanel(name, focus = false, persist = true) {
      if (!panels.includes(name)) return;
      const activePanel = doc.activeElement?.closest('.watch-panel');
      const moveFocus = focus || Boolean(activePanel && activePanel.id !== 'watch-panel-' + name);
      view.panel = name;
      for (const button of tabs) {
        const selected = button.dataset.watchPanel === name;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        doc.getElementById(button.getAttribute('aria-controls')).hidden = !selected;
        if (selected && moveFocus) button.focus();
      }
      if (persist) save();
    }
    function setCollapsed(collapsed, persist = true) {
      view.collapsed = Boolean(collapsed);
      if (view.collapsed && rail.contains(doc.activeElement)) toggle.focus();
      rail.hidden = view.collapsed;
      layout.classList.toggle('watch-rail-collapsed', view.collapsed);
      toggle.setAttribute('aria-expanded', String(!view.collapsed));
      const label = toggle.lastElementChild;
      label.textContent = view.collapsed ? 'Hiện bảng tập' : 'Ẩn bảng tập';
      if (persist) save();
    }
    view = read();
    setPanel(view.panel, false, false); setCollapsed(view.collapsed, false);
    tabs.forEach((button, index) => {
      button.addEventListener('click', () => setPanel(button.dataset.watchPanel));
      button.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); setPanel(tabs[next].dataset.watchPanel, true); }
      });
    });
    toggle.addEventListener('click', () => setCollapsed(!view.collapsed));
    function sync() {
      text('watch-screen-episode', doc.getElementById('current-ep-title')?.textContent.trim() || 'Đang mở phim');
      text('watch-screen-source', doc.querySelector('#server-tabs-container .active')?.textContent.trim() || '');
      const count = doc.getElementById('wp-episode-count')?.textContent || '';
      const total = count.match(/(\d+)\s+tập ở nguồn/) || count.match(/\/\s*(\d+)\s+tập/);
      text('watch-panel-count', total ? total[1] + ' tập' : '…');
      const hasError = Boolean(doc.querySelector('.playback-recovery.has-error'));
      doc.querySelector('.watch-source-warning').hidden = !hasError;
      if (hasError && !previousError) { setCollapsed(false); setPanel('sources'); }
      previousError = hasError;
    }
    const observer = new MutationObserver(sync);
    observer.observe(layout, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    const navbar = doc.querySelector('.navbar');
    if (navbar && typeof root.ResizeObserver === 'function') {
      const resize = new ResizeObserver(() => {
        layout.style.setProperty('--watch-nav-height', Math.ceil(navbar.getBoundingClientRect().height) + 'px');
      });
      resize.observe(navbar);
    }
    sync();
    root.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      view = read(); setPanel(view.panel, false, false); setCollapsed(view.collapsed, false); sync();
    });
    // DOM nodes stay mounted while changing panels, so playback and existing listeners keep their state.
    root.WatchExperience = { open(name) { setCollapsed(false); setPanel(name); }, collapse: setCollapsed };
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(globalThis);
