(function () {
  'use strict';
  const N = window.NotificationCenter, $ = id => document.getElementById(id);
  let movies = [], filter = 'unread', limit = 30, blocked = false;
  const node = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  const status = text => { $('notification-status').textContent = text; };
  function render() {
    let state; try { state = N.read(); blocked = false; } catch (_) { state = N.normalize(); blocked = true; status('Trạng thái thông báo có lỗi. Chưa ghi đè dữ liệu; hãy khôi phục bản sao lưu trong Thư viện.'); }
    const rows = N.items(N.readCache(), state, movies), unread = rows.filter(row => !row.read), shown = filter === 'unread' ? unread : rows;
    $('notification-unread').textContent = unread.length; $('notification-read-all').disabled = blocked || !unread.length;
    $('notification-empty').hidden = shown.length > 0; $('notification-more').hidden = shown.length <= limit;
    const fragment = document.createDocumentFragment();
    for (const item of shown.slice(0, limit)) {
      const card = node('article', 'notification-item' + (item.read ? ' is-read' : '')); card.dataset.notificationId = item.id;
      const image = node('img'); image.alt = ''; image.loading = 'lazy'; SiteTools.setPoster(image, item);
      const content = node('div'), episode = node('p', 'notification-episode', 'Tập ' + item.name + ' đã có trên nguồn'), heading = node('h2'), detail = node('a', '', item.title); detail.href = 'detail.html?' + new URLSearchParams({ slug: item.slug }); heading.append(detail);
      const date = node('small', '', 'Phát hiện ' + new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(item.createdAt));
      const actions = node('div', 'notification-item-actions'), watch = node('a', '', 'Xem tập này →'); watch.href = N.watchURL(item); watch.addEventListener('click', () => { try { N.acknowledge([item.id]); } catch (_) {} }); actions.append(watch);
      if (!item.read) { const read = node('button', '', 'Đánh dấu đã đọc'); read.type = 'button'; read.disabled = blocked; read.onclick = () => { try { N.acknowledge([item.id]); render(); status('Đã đánh dấu thông báo là đã đọc.'); } catch (_) { status('Chưa lưu được trạng thái đã đọc. Bộ nhớ có thể bị chặn hoặc đã đầy.'); } }; actions.append(read); }
      content.append(episode, heading, date, actions); card.append(image, content); fragment.append(card);
    }
    $('notification-list').replaceChildren(fragment);
    if (!blocked) status(rows.length ? unread.length + ' thông báo chưa đọc · ' + rows.length + ' thông báo từ lần kiểm tra tập mới.' : 'Thông báo sẽ xuất hiện sau khi trang Tập mới phát hiện tập mới thực tế.');
  }
  function permission() {
    let enabled = false; try { enabled = JSON.parse(localStorage.getItem(N.PREFS) || '{}').enabled === true; } catch (_) {}
    const supported = window.isSecureContext && 'Notification' in window, value = supported ? Notification.permission : 'unsupported';
    $('notification-enable').hidden = enabled && value === 'granted'; $('notification-disable').hidden = !enabled; $('notification-enable').disabled = value === 'unsupported' || value === 'denied';
    $('notification-permission').textContent = value === 'unsupported' ? 'Trình duyệt hiện tại chưa hỗ trợ. Dùng HTTPS hoặc localhost để kiểm tra lại.' : value === 'denied' ? 'Thông báo đang bị chặn. Bạn có thể đổi quyền trong cài đặt trình duyệt.' : value === 'granted' && enabled ? 'Đã bật trên thiết bị này. Chỉ nhắc khi web đang mở.' : value === 'granted' ? 'Trình duyệt đã cấp quyền. Bạn có thể bật lời nhắc cho thiết bị này.' : 'Bạn quyết định có nhận thông báo hay không.';
  }
  $('notification-enable').onclick = async () => { try { await N.enable(); permission(); $('notification-permission').textContent = 'Đã bật thông báo trên thiết bị này. Các đợt kiểm tra tiếp theo sẽ gửi lời nhắc khi có tập mới.'; } catch (error) { $('notification-permission').textContent = error.message; } };
  $('notification-disable').onclick = () => { try { N.disable(); permission(); } catch (_) { $('notification-permission').textContent = 'Chưa lưu được tùy chọn trên thiết bị này.'; } };
  $('notification-read-all').onclick = () => { try { const ids = N.items(N.readCache(), N.read(), movies).filter(row => !row.read).map(row => row.id); N.acknowledge(ids); render(); status('Đã đánh dấu tất cả thông báo hiện có là đã đọc.'); } catch (_) { status('Chưa lưu được trạng thái. Dữ liệu trước đó vẫn được giữ.'); } };
  for (const button of document.querySelectorAll('[data-notification-filter]')) button.onclick = () => { filter = button.dataset.notificationFilter; limit = 30; for (const item of document.querySelectorAll('[data-notification-filter]')) item.setAttribute('aria-pressed', String(item === button)); render(); };
  $('notification-more').onclick = () => { limit += 30; render(); };
  function pwaStatus() {
    if (!window.LauPhimPWA) return;
    const state = LauPhimPWA.state(); $('pwa-status').textContent = state.message; $('pwa-install').hidden = !state.installable; $('pwa-update').hidden = !state.waiting; $('pwa-clear').disabled = !state.supported;
  }
  $('pwa-install').onclick = async () => { await window.LauPhimPWA?.install(); pwaStatus(); };
  $('pwa-update').onclick = async () => { if (!confirm('Kích hoạt bản giao diện mới? Bạn có thể tải lại trang sau khi đã lưu các thay đổi đang chỉnh sửa.')) return; await window.LauPhimPWA?.activateUpdate(); pwaStatus(); };
  $('pwa-clear').onclick = async () => { if (!confirm('Xóa các trang và ảnh giao diện đã lưu ngoại tuyến? Lịch sử, yêu thích và ghi chú của bạn được giữ nguyên.')) return; await window.LauPhimPWA?.clear(); pwaStatus(); };
  window.LauPhimPWA?.subscribe(pwaStatus); pwaStatus(); permission();
  window.addEventListener('storage', event => { if ([N.KEY, 'episode_updates_v1', null].includes(event.key)) render(); if ([N.PREFS, null].includes(event.key)) permission(); });
  window.addEventListener('notification-center-changed', render); window.addEventListener('profile-changed', () => { render(); permission(); }); EpisodeUpdates.service.subscribe(render);
  EpisodeUpdates.loadCatalog().then(data => { movies = data; render(); }).catch(() => { status('Chưa mở được kho phim. Kết nối mạng hoặc tải lại trang để thử lại.'); });
})();
