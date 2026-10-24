(function (root) {
  'use strict';
  const KEY = 'watch_room_membership_v1', SOURCES = ['auto', 'kkphim', 'nguonc', 'hardcode'];
  const validID = value => typeof value === 'string' && !['__proto__', 'constructor', 'prototype'].includes(value) && /^[A-Za-z0-9_-]{8,64}$/.test(value);
  const clean = (value, length) => typeof value === 'string' ? value.trim().slice(0, length) : '';
  const integer = (value, min = 0, max = 100000000) => Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : min;
  function state(value) {
    if (!value || !validID(value.id) || !clean(value.slug, 200) || !Number.isFinite(Number(value.updatedAt)) || !Number.isFinite(Number(value.time))) throw Error('Dữ liệu phòng không hợp lệ.');
    return { id: value.id, slug: clean(value.slug, 200), episodeName: clean(value.episodeName, 160), episode: integer(value.episode, 1, 100000), source: SOURCES.includes(value.source) ? value.source : 'auto', server: integer(value.server, 0, 1000), playing: value.playing === true, time: Math.max(0, Math.min(100000000, Number(value.time))), updatedAt: Math.max(0, Number(value.updatedAt)), revision: integer(value.revision) };
  }
  function expectedTime(room, now = Date.now()) { return Math.max(0, Math.min(100000000, room.time + (room.playing ? Math.max(0, now - room.updatedAt) / 1000 : 0))); }
  function watchURL(room, invite = false) {
    room = state(room); const params = new URLSearchParams({ slug: room.slug, ep: room.episode, data_source: room.source, server: room.server, room: room.id });
    if (room.episodeName) params.set('target_episode', room.episodeName);
    if (!invite) params.set('resume', String(Math.floor(expectedTime(room))));
    return 'watch.html?' + params;
  }
  function sameEpisode(room, context) { return room.slug === context.slug && room.episodeName === String(context.episodeName || '') && room.source === String(context.source || 'auto') && room.server === Number(context.server || 0); }
  function membership(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, entry]) => validID(id) && entry && /^[A-Za-z0-9_-]{16,256}$/.test(entry.token) && typeof entry.memberId === 'string').slice(-8).map(([id, entry]) => [id, { token: entry.token, memberId: entry.memberId.slice(0, 100) }]));
  }
  let current = null;
  function attach({ video, container, embedded = false, getContext }) {
    if (!container || !video || typeof document === 'undefined') return { destroy() {} };
    current?.destroy();
    const section = document.createElement('details'); section.className = 'watch-room';
    section.innerHTML = '<summary>Xem cùng bạn bè <span>Phòng riêng</span></summary><div class="watch-room-body"><p class="room-intro">Chủ phòng điều khiển phát, dừng, tua và chọn tập. Tối đa 8 người, phòng tồn tại 2 giờ. Tốc độ đồng bộ 1×.</p><p class="room-status" role="status" aria-live="polite">Đang kiểm tra máy chủ...</p><div class="room-setup" hidden><a href="account.html">Thiết lập kết nối máy chủ ↗</a></div><form class="room-join-form"><label>Tên trong phòng<input name="name" maxlength="30" autocomplete="nickname" placeholder="Tên của bạn" value="Khách"></label><button type="submit" class="room-join" disabled>Tạo phòng</button></form><div class="room-live" hidden><div class="room-live-heading"><strong class="room-role"></strong><span class="room-member-count"></span></div><p class="room-members"></p><label class="room-invite-label">Lời mời an toàn<input class="room-invite" readonly aria-label="Liên kết mời vào phòng"></label><div class="room-actions"><button type="button" class="room-copy">Sao chép lời mời</button><button type="button" class="room-leave">Rời phòng</button></div><button type="button" class="room-resume" hidden>Bấm để phát cùng phòng</button><p class="room-media-warning" hidden></p><ol class="room-messages" aria-label="Tin nhắn trong phòng"></ol><form class="room-chat"><label class="room-chat-label">Tin nhắn<input name="body" maxlength="500" autocomplete="off" placeholder="Nhắn cho mọi người..."></label><button type="submit">Gửi</button></form></div></div>';
    container.append(section);
    const q = selector => section.querySelector(selector), status = q('.room-status'), form = q('.room-join-form'), join = q('.room-join'), live = q('.room-live'), messageList = q('.room-messages'), mediaWarning = q('.room-media-warning');
    const params = new URLSearchParams(location.search), invited = params.get('room');
    let roomID = validID(invited) ? invited : '', token = '', memberID = '', host = false, room = null, lastSnapshot = null, lastRevision = -1, timer = 0, eventTimer = 0, destroyed = false, suspended = false, pollBusy = false, applying = false, navigation = false, backoff = 2000, generation = 0, controlPromise = Promise.resolve(), lastHeartbeat = 0, messagesSignature = '', enabled = false;
    if (roomID) { section.open = true; join.textContent = 'Tham gia phòng được mời'; }
    if (roomID || params.get('room_create') === '1') { section.open = true; requestAnimationFrame(() => { if (!destroyed) root.WatchExperience?.open('tools'); }); }
    const writeMember = remove => { try { const values = membership(JSON.parse(sessionStorage.getItem(KEY) || '{}')); if (remove) delete values[roomID]; else values[roomID] = { token, memberId: memberID }; sessionStorage.setItem(KEY, JSON.stringify(membership(values))); } catch (_) { status.textContent = 'Trình duyệt không cho lưu phiên phòng. Khi tải lại, bạn cần tham gia lại.'; } };
    const request = (path, options = {}) => { if (!root.HubClient) return Promise.reject(Error('Chưa có kết nối máy chủ.')); return root.HubClient.request('/rooms' + (roomID ? '/' + encodeURIComponent(roomID) : '') + path, { ...options, headers: { ...(options.headers || {}), ...(token ? { 'X-Room-Token': token } : {}) } }); };
    const hideLive = () => { clearTimeout(timer); clearTimeout(eventTimer); live.hidden = true; form.hidden = false; join.disabled = !enabled; };
    function fail(error) {
      if (destroyed) return;
      if (error.status === 404 || error.status === 403) { generation++; if (roomID) writeMember(true); token = ''; room = null; lastSnapshot = null; host = false;
        if (error.status === 404) { roomID = ''; params.delete('room'); history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '')); }
        hideLive(); join.textContent = roomID ? 'Tham gia lại phòng' : 'Tạo phòng mới'; }
      status.textContent = error.message || 'Mất kết nối phòng. Đang thử lại...';
    }
    function render(snapshot) {
      if (!snapshot?.room) throw Error('Máy chủ chưa trả lại trạng thái phòng.');
      const next = state(snapshot.room); if (next.id !== roomID) throw Error('Trạng thái trả về không thuộc phòng hiện tại.');
      if (room && next.revision < room.revision) return;
      room = next; lastSnapshot = snapshot; host = snapshot.isHost === true; memberID = clean(snapshot.memberId, 100) || memberID;
      live.hidden = false; form.hidden = true; q('.room-role').textContent = host ? 'Bạn là chủ phòng' : 'Đang theo chủ phòng';
      const members = Array.isArray(snapshot.members) ? snapshot.members.slice(0, 8) : [];
      q('.room-member-count').textContent = members.length + '/8 người'; q('.room-members').textContent = members.map(person => clean(person.name, 30) + (person.isHost ? ' · chủ phòng' : '')).join(' / ');
      q('.room-invite').value = new URL(watchURL(room, true), location.href).href;
      const messages = Array.isArray(snapshot.messages) ? snapshot.messages.slice(-100) : [], signature = JSON.stringify(messages);
      if (signature !== messagesSignature) { const nearEnd = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 60; messagesSignature = signature; messageList.replaceChildren(); messages.forEach(message => { const li = document.createElement('li'), name = document.createElement('strong'), body = document.createElement('span'); name.textContent = clean(message.name, 30); body.textContent = clean(message.body, 500); li.append(name, body); messageList.append(li); }); if (nearEnd) messageList.scrollTop = messageList.scrollHeight; }
      mediaWarning.hidden = !embedded; mediaWarning.textContent = 'Nguồn nhúng chỉ hỗ trợ trò chuyện. Đổi sang nguồn video trực tiếp để đồng bộ phát và thời gian.';
      status.textContent = embedded ? 'Đã vào phòng · nguồn nhúng chưa thể đồng bộ video.' : host ? 'Đã kết nối. Thao tác phát, dừng, tua và chọn tập của bạn sẽ được chia sẻ.' : 'Đã kết nối. Tập phim và thời điểm được đồng bộ từ chủ phòng.';
      if (host || embedded || navigation) { lastRevision = Math.max(lastRevision, room.revision); return; }
      const context = getContext();
      if (!sameEpisode(room, context)) { navigation = true; location.href = watchURL(room); return; }
      if (room.revision < lastRevision) return; lastRevision = room.revision;
      applying = true;
      try {
        if (video.playbackRate !== 1) video.playbackRate = 1;
        const expected = expectedTime(room), bounded = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(expected, Math.max(0, video.duration - 0.1)) : expected;
        if (video.readyState >= 1 && Math.abs(Number(video.currentTime || 0) - bounded) > 1.75) video.currentTime = bounded;
        if (room.playing && video.paused) { Promise.resolve(video.play()).then(() => { if (!destroyed) q('.room-resume').hidden = true; }).catch(() => { if (!destroyed) q('.room-resume').hidden = false; }); }
        else if (!room.playing && !video.paused) video.pause();
      } catch (_) { q('.room-resume').hidden = !room.playing; }
      finally { queueMicrotask(() => { applying = false; }); }
    }
    function schedule() { clearTimeout(timer); if (!destroyed && !suspended && token && !document.hidden && !navigation) timer = setTimeout(poll, backoff); }
    async function poll() {
      if (destroyed || suspended || pollBusy || !token || document.hidden || navigation) return;
      pollBusy = true; const version = generation;
      try { const snapshot = await request(''); if (destroyed || version !== generation) return; render(snapshot); backoff = 2000; }
      catch (error) { if (!destroyed && version === generation) { fail(error); backoff = Math.min(15000, backoff * 2); } }
      finally { pollBusy = false; schedule(); }
    }
    function control(override = {}) {
      controlPromise = controlPromise.catch(() => {}).then(async () => {
        if (destroyed || !token || !host || embedded) return false;
        const context = getContext(), body = { revision: room.revision, playing: !video.paused && !video.ended, time: Math.max(0, Number(video.currentTime) || 0), episodeName: context.episodeName, episode: context.episode, source: context.source, server: context.server, ...override };
        const version = generation;
        try { const snapshot = await request('/control', { method: 'POST', body }); if (destroyed || version !== generation) return false; render(snapshot); return true; }
        catch (error) { if (!destroyed && version === generation) { if (error.status === 409) { try { render(await request('')); } catch (_) {} } fail(error); } return false; }
      }); return controlPromise;
    }
    async function beforeNavigate(next) {
      if (!token || !room) return true;
      if (!host) { status.textContent = 'Chủ phòng chọn tập và nguồn phát. Bấm Rời phòng để xem riêng.'; section.open = true; root.WatchExperience?.open('tools'); return false; }
      const target = new URLSearchParams(next), same = String(target.get('target_episode') || '') === String(getContext().episodeName || '');
      navigation = true; clearTimeout(timer); clearTimeout(eventTimer);
      const success = await control({ playing: false, time: same ? Math.max(0, Number(target.get('resume')) || 0) : 0, episode: integer(target.get('ep'), 1, 100000), episodeName: target.get('target_episode') || target.get('ep') || '1', source: target.get('data_source') || getContext().source || 'auto', server: integer(target.get('server')) });
      if (success) next.set('room', roomID); else { navigation = false; schedule(); } return success;
    }
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (join.disabled) return; join.disabled = true; status.textContent = roomID ? 'Đang tham gia phòng...' : 'Đang tạo phòng...';
      try {
        const name = clean(form.elements.name.value, 30) || 'Khách', context = getContext();
        const snapshot = roomID ? await request('/join', { method: 'POST', body: { name } }) : await root.HubClient.request('/rooms', { method: 'POST', body: { ...context, name } });
        if (destroyed) return; const next = state(snapshot.room), nextToken = String(snapshot.memberToken || ''), nextMemberID = clean(snapshot.memberId, 100);
        if (!membership({ [next.id]: { token: nextToken, memberId: nextMemberID } })[next.id]) throw Error('Máy chủ chưa trả lại phiên phòng hợp lệ.');
        roomID = next.id; token = nextToken; memberID = nextMemberID;
        writeMember(false); params.set('room', roomID); history.replaceState(null, '', location.pathname + '?' + params); render(snapshot); if (host && !embedded) await control(); schedule();
      } catch (error) { fail(error); } finally { if (!destroyed) join.disabled = !enabled; }
    });
    q('.room-chat').addEventListener('submit', async event => {
      event.preventDefault(); const input = event.target.elements.body, body = clean(input.value, 500), submit = event.target.querySelector('button'); if (!body || !token || submit.disabled) return;
      submit.disabled = true; const version = generation; try { const snapshot = await request('/chat', { method: 'POST', body: { body } }); if (!destroyed && version === generation && token) { render(snapshot); if (input.value.trim() === body) input.value = ''; } } catch (error) { if (version === generation) fail(error); } finally { submit.disabled = false; }
    });
    q('.room-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(q('.room-invite').value); status.textContent = 'Đã sao chép lời mời. Liên kết không chứa mã thành viên.'; } catch (_) { q('.room-invite').focus(); q('.room-invite').select(); status.textContent = 'Chọn và sao chép liên kết trong ô lời mời.'; } });
    q('.room-resume').addEventListener('click', async () => { if (!room || embedded) return; try { await video.play(); q('.room-resume').hidden = true; } catch (_) { status.textContent = 'Video chưa phát được. Kiểm tra nguồn phát rồi thử lại.'; } });
    q('.room-leave').addEventListener('click', async () => {
      if (!token) return; const button = q('.room-leave'); button.disabled = true;
      try { await request('/leave', { method: 'POST', body: {} }); } catch (error) { if (error.status !== 404 && error.status !== 403) { status.textContent = 'Chưa báo rời phòng tới máy chủ. Phiên trên thiết bị này đã được ngắt.'; } }
      generation++; writeMember(true); token = ''; room = null; host = false; roomID = ''; params.delete('room'); history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '')); hideLive(); join.textContent = 'Tạo phòng'; status.textContent = 'Đã rời phòng. Bạn có thể xem riêng hoặc tạo phòng mới.'; button.disabled = false;
    });
    const onMedia = event => { if (!token || embedded || applying || !room || navigation) return; if (video.playbackRate !== 1) { applying = true; video.playbackRate = 1; queueMicrotask(() => { applying = false; }); }
      if (!host) { render(lastSnapshot); if (event.type !== 'loadedmetadata') status.textContent = 'Chủ phòng điều khiển video. Bấm Rời phòng để xem riêng.'; return; }
      clearTimeout(eventTimer); if (event.type === 'timeupdate' && Date.now() - lastHeartbeat < 10000) return; eventTimer = setTimeout(() => { lastHeartbeat = Date.now(); control(); }, 180);
    };
    const events = ['play', 'pause', 'seeked', 'ratechange', 'timeupdate', 'loadedmetadata']; events.forEach(name => video.addEventListener(name, onMedia));
    const visibility = () => { clearTimeout(timer); if (!document.hidden) poll(); };
    const onHide = () => { suspended = true; generation++; clearTimeout(timer); clearTimeout(eventTimer); };
    const onShow = event => { if (event.persisted) { suspended = false; poll(); } };
    document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', onHide); window.addEventListener('pageshow', onShow);
    const api = { beforeNavigate, destroy() { if (destroyed) return; destroyed = true; generation++; clearTimeout(timer); clearTimeout(eventTimer); events.forEach(name => video.removeEventListener(name, onMedia)); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', onHide); window.removeEventListener('pageshow', onShow); section.remove(); if (current === api) current = null; } };
    current = api;
    (async () => { try { enabled = !!root.HubClient && await root.HubClient.ready(); if (destroyed) return; join.disabled = !enabled; q('.room-setup').hidden = enabled; if (!enabled) { status.textContent = 'Máy chủ xem chung chưa kết nối. Trang phim vẫn xem bình thường; cần bật máy chủ để tạo hoặc tham gia phòng.'; return; }
      status.textContent = roomID ? 'Bạn nhận được lời mời. Nhập tên rồi bấm Tham gia để kết nối.' : 'Tạo phòng rồi gửi lời mời cho bạn bè. Không cần tài khoản.';
      let saved; try { saved = membership(JSON.parse(sessionStorage.getItem(KEY) || '{}'))[roomID]; } catch (_) {}
      if (saved) { token = saved.token; memberID = saved.memberId; await poll(); if (host && !embedded && !destroyed && token) await control(); }
    } catch (error) { if (!destroyed) { q('.room-setup').hidden = false; fail(error); } } })();
    return api;
  }
  const api = { KEY, validID, state, expectedTime, watchURL, sameEpisode, membership, attach, beforeNavigate: params => current ? current.beforeNavigate(params) : Promise.resolve(true) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WatchRoom = api;
})(globalThis);
