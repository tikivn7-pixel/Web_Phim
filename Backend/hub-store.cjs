'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const EMPTY = () => ({ version: 1, users: [], sessions: [], profiles: [], reviews: [], reports: [], overrides: [], revisions: [] });
const MAX_BYTES = 128 * 1024 * 1024;
function validate(value) {
  if (!value || value.version !== 1) throw Error('Unsupported or corrupt Hub store. Restore a verified backup; no data was reset.');
  for (const key of Object.keys(EMPTY()).filter(key => key !== 'version')) if (!Array.isArray(value[key])) throw Error('Corrupt Hub store: ' + key);
  const users = new Set();
  for (const user of value.users) {
    if (!user || typeof user.id !== 'string' || users.has(user.id) || !user.username || !user.email || !/^[a-f0-9]{32}$/.test(user.salt) || !/^[a-f0-9]{128}$/.test(user.passwordHash) || !['user', 'admin'].includes(user.role)) throw Error('Corrupt Hub account record.');
    users.add(user.id);
  }
  const profiles = new Set();
  for (const row of value.profiles) {
    if (!row || typeof row.id !== 'string' || profiles.has(row.id) || !users.has(row.userId) || typeof row.name !== 'string' || !row.data || !Number.isInteger(row.revision) || row.revision < 0) throw Error('Corrupt Hub profile record.');
    profiles.add(row.id);
  }
  for (const session of value.sessions) if (!session || !users.has(session.userId) || !/^[a-f0-9]{64}$/.test(session.hash) || !Number.isFinite(session.expiresAt)) throw Error('Corrupt Hub session record.');
  for (const key of ['reviews', 'reports', 'overrides', 'revisions']) for (const row of value[key]) if (!row || typeof row.id !== 'string') throw Error('Corrupt Hub ' + key + ' record.');
  return value;
}
class HubStore {
  constructor(directory) { this.directory = path.resolve(directory); this.file = path.join(this.directory, 'hub.json'); this.pending = Promise.resolve(); this.closed = false; }
  async open() {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    try { this.lock = await fs.open(path.join(this.directory, 'hub.lock'), 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw Error('Hub data is locked by another process. Verify that process has stopped before manually removing hub.lock.'); throw error; }
    try {
      await this.lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      try { const info = await fs.stat(this.file); if (info.size > MAX_BYTES) throw Error('Hub store exceeds safe startup size.'); this.state = validate(JSON.parse(await fs.readFile(this.file, 'utf8'))); }
      catch (error) { if (error.code !== 'ENOENT') throw error; this.state = EMPTY(); await this.persist(this.state); }
      return this;
    } catch (error) { await this.close(); throw error; }
  }
  async persist(value) {
    const serialized = JSON.stringify(value) + '\n';
    if (Buffer.byteLength(serialized) > MAX_BYTES) throw Object.assign(Error('Hub data capacity reached; previous data was retained.'), { status: 507, code: 'STORE_CAPACITY' });
    const temporary = this.file + '.' + process.pid + '.tmp'; let file;
    try {
      file = await fs.open(temporary, 'w', 0o600); await file.writeFile(serialized); await file.sync(); await file.close(); file = null;
      await fs.rename(temporary, this.file);
    } finally { if (file) await file.close().catch(() => {}); await fs.rm(temporary, { force: true }).catch(() => {}); }
  }
  transaction(change) {
    const result = this.pending.then(async () => {
      if (this.closed) throw Error('Hub store is closed.');
      const next = structuredClone(this.state), answer = change(next);
      if (answer && typeof answer.then === 'function') throw Error('Store transactions must be synchronous.');
      validate(next); await this.persist(next); this.state = next; return answer;
    });
    this.pending = result.catch(() => {}); return result;
  }
  async close() { await this.pending; this.closed = true; if (this.lock) { await this.lock.close(); this.lock = null; await fs.rm(path.join(this.directory, 'hub.lock'), { force: true }); } }
}
module.exports = { HubStore, validate, EMPTY };
