'use strict';
const crypto = require('node:crypto');
const SOURCES = ['auto', 'kkphim', 'nguonc', 'hardcode'];
const token = () => crypto.randomBytes(24).toString('base64url');
const digest = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
function fault(status, code, message, extra) { return Object.assign(Error(message), { status, code, extra }); }
function playback(value) {
  if (!Number.isInteger(value.episode) || value.episode < 1 || value.episode > 100000 || !Number.isInteger(value.server) || value.server < 0 || value.server > 10000 || !SOURCES.includes(value.source) || typeof value.episodeName !== 'string' || value.episodeName.length > 100 || /[\u0000-\u001f]/.test(value.episodeName)) throw fault(400, 'ROOM_INVALID_PLAYBACK', 'Tập hoặc nguồn phát không hợp lệ.');
  return { episode: value.episode, server: value.server, source: value.source, episodeName: value.episodeName.trim() };
}
function name(value) { const result = typeof value === 'string' ? value.trim() : 'Khách'; if (!result || result.length > 50 || /[\u0000-\u001f]/.test(result)) throw fault(400, 'ROOM_INVALID_NAME', 'Tên tham gia phải từ 1 đến 50 ký tự.'); return result; }
class HubRooms {
  constructor(options = {}) { this.rooms = new Map(); this.now = options.now || Date.now; this.ttl = options.ttl || 7200000; }
  sweep() { const now = this.now(); for (const [id, room] of this.rooms) if (now >= room.expiresAt) this.rooms.delete(id); }
  snapshot(room, member) { return { room: { id: room.id, slug: room.slug, ...room.playback, playing: room.playing, time: room.time, updatedAt: room.updatedAt, revision: room.revision }, members: [...room.members.values()].map(row => ({ id: row.id, name: row.name, isHost: row.isHost })), messages: room.messages.map(row => ({ ...row })), memberId: member.id, isHost: member.isHost }; }
  add(room, displayName, isHost) { const memberToken = token(), member = { id: token(), hash: digest(memberToken), name: name(displayName), isHost, lastSeen: this.now() }; room.members.set(member.id, member); return { ...this.snapshot(room, member), memberToken }; }
  create(value) {
    this.sweep(); if (this.rooms.size >= 1000) throw fault(503, 'ROOM_CAPACITY', 'Dịch vụ phòng xem đang đầy. Hãy thử lại sau.');
    const room = { id: token(), slug: value.slug, playback: playback(value), playing: false, time: 0, updatedAt: this.now(), revision: 0, expiresAt: this.now() + this.ttl, members: new Map(), messages: [] };
    // Validate before retaining a room or allocating its membership.
    const response = this.add(room, value.name || 'Chủ phòng', true); this.rooms.set(room.id, room); return response;
  }
  get(id) { this.sweep(); const room = this.rooms.get(id); if (!room) throw fault(404, 'ROOM_NOT_FOUND', 'Phòng đã hết hạn hoặc không tồn tại.'); for (const [key, member] of room.members) if (!member.isHost && this.now() - member.lastSeen > 120000) room.members.delete(key); return room; }
  join(id, value) { const room = this.get(id); if (room.members.size >= 8) throw fault(409, 'ROOM_FULL', 'Phòng đã đủ 8 người.'); return this.add(room, value.name || 'Khách', false); }
  member(id, memberToken) { const room = this.get(id), hash = digest(memberToken); const member = [...room.members.values()].find(row => row.hash === hash); if (!member || !memberToken) throw fault(403, 'ROOM_MEMBER_REQUIRED', 'Bạn cần tham gia lại phòng xem này.'); member.lastSeen = this.now(); return { room, member }; }
  read(id, secret) { const { room, member } = this.member(id, secret); return this.snapshot(room, member); }
  control(id, secret, value) {
    const { room, member } = this.member(id, secret);
    if (!member.isHost) throw fault(403, 'ROOM_HOST_REQUIRED', 'Chỉ chủ phòng có thể điều khiển phát.');
    if (value.revision !== room.revision) throw fault(409, 'ROOM_CONFLICT', 'Trạng thái phòng đã thay đổi.', this.snapshot(room, member));
    if (typeof value.playing !== 'boolean' || !Number.isFinite(value.time) || value.time < 0 || value.time > 1e8) throw fault(400, 'ROOM_INVALID_PLAYBACK', 'Thời điểm phát không hợp lệ.');
    room.playback = playback(value); room.playing = value.playing; room.time = value.time; room.updatedAt = this.now(); room.revision++; return this.snapshot(room, member);
  }
  chat(id, secret, value) {
    const { room, member } = this.member(id, secret), body = typeof value.body === 'string' ? value.body.trim() : '';
    if (!body || body.length > 1000 || /[\u0000-\u0008\u000b-\u001f]/.test(body)) throw fault(400, 'ROOM_INVALID_MESSAGE', 'Tin nhắn phải từ 1 đến 1000 ký tự.');
    if (member.lastChat && this.now() - member.lastChat < 700) throw fault(429, 'ROOM_CHAT_RATE', 'Bạn đang gửi tin quá nhanh.');
    member.lastChat = this.now(); room.messages.push({ id: token(), name: member.name, body, at: this.now() }); room.messages = room.messages.slice(-100); return this.snapshot(room, member);
  }
  leave(id, secret) { const { room, member } = this.member(id, secret); if (member.isHost) this.rooms.delete(id); else room.members.delete(member.id); return { left: true, closed: member.isHost }; }
}
module.exports = { HubRooms, fault, digest, token };
