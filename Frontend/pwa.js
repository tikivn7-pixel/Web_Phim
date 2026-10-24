(function () {
  'use strict';
  if (window.LauPhimPWA) return;
  const source = document.currentScript?.src || location.href, base = new URL('./', source);
  let registration = null, prompt = null, supported = window.isSecureContext && 'serviceWorker' in navigator, message = supported ? 'Đang chuẩn bị giao diện ngoại tuyến…' : 'Ứng dụng cần HTTPS hoặc localhost và trình duyệt hỗ trợ service worker.';
  const listeners = new Set(), emit = () => listeners.forEach(fn => { try { fn(); } catch (_) {} });
  const state = () => ({ supported, installable: !!prompt, waiting: !!registration?.waiting, ready: !!registration?.active, message });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; emit(); });
  window.addEventListener('appinstalled', () => { prompt = null; message = 'LauPhim đã được thêm vào màn hình chính.'; emit(); });
  window.LauPhimPWA = {
    state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async install() {
      if (!prompt) { message = 'Dùng “Thêm vào màn hình chính” trong menu trình duyệt nếu không có nút cài.'; emit(); return; }
      const request = prompt; prompt = null; await request.prompt(); const choice = await request.userChoice; message = choice.outcome === 'accepted' ? 'Đã gửi yêu cầu cài ứng dụng.' : 'Bạn có thể cài ứng dụng vào lúc khác.'; emit();
    },
    async activateUpdate() { if (registration?.waiting) { registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' }); message = 'Đã kích hoạt bản mới. Tải lại trang khi bạn đã lưu các thay đổi đang chỉnh sửa.'; emit(); } },
    async clear() {
      if (!supported || !('caches' in window)) return;
      try { const prefix = 'lauphim-shell-' + encodeURIComponent(base.pathname) + '-'; for (const key of await caches.keys()) if (key.startsWith(prefix)) await caches.delete(key); message = 'Đã xóa giao diện ngoại tuyến. Dữ liệu cá nhân vẫn được giữ; các trang ghé tiếp theo sẽ được lưu lại.'; } catch (_) { message = 'Chưa xóa được bộ nhớ giao diện.'; } emit();
    }
  };
  if (!supported) return;
  // Registration never reloads the page or calls skipWaiting automatically.
  navigator.serviceWorker.register(new URL('sw.js', base).href, { scope: base.pathname, updateViaCache: 'none' }).then(result => {
    registration = result;
    const refresh = () => { message = registration.waiting ? 'Có bản giao diện mới. Bạn có thể kích hoạt sau khi lưu các thay đổi.' : registration.active ? 'Giao diện ngoại tuyến đã sẵn sàng. Video và ảnh chưa lưu vẫn cần Internet.' : 'Đang lưu giao diện và kho phim gọn nhẹ…'; emit(); };
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', refresh); refresh(); });
    navigator.serviceWorker.addEventListener('controllerchange', refresh); refresh();
  }).catch(() => { message = 'Chưa chuẩn bị được ngoại tuyến. Web vẫn hoạt động bình thường khi có mạng.'; emit(); });
})();
