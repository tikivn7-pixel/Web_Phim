const test = require('node:test'), assert = require('node:assert/strict'), P = require('./release-planner');
const row = (day = 6, time = '20:30', at = 10) => ({ day, time, timezone: P.ZONE, updatedAt: at, deleted: false });
test('planner validates exact time, zone, identity and blocks corrupt writes', () => {
  assert.deepEqual(P.normalize({ version: 1, entries: { a: row(), b: row(7), c: row(1, '24:00'), 'phim/a': row(0), constructor: row() } }).entries, { a: row(), 'phim/a': row(0) });
  assert.throws(() => P.normalize({ version: 1, entries: { a: row(0, '09:00', '1') } }, true));
  assert.throws(() => P.normalize(null, true));
});
test('planner merges edits and deletion tombstones without reviving old entries', () => {
  const a = { version: 1, entries: { a: row(), b: row(1, '10:00', 20) } }, b = { version: 1, entries: { a: { updatedAt: 20, deleted: true }, b: row(2, '12:00', 30) } };
  assert.deepEqual(P.merge(b, a), P.merge(a, b));
  assert.equal(P.merge(b, a).entries.a.deleted, true);
  assert.equal(P.merge(a, b).entries.b.day, 2);
});
test('week boundaries use Vietnam midnight and exact catalog matches', () => {
  const input = { version: 1, entries: { a: row(6), missing: row(6) } };
  const days = P.week(input, [{ slug: 'a', title: 'A' }], Date.parse('2026-10-23T18:00:00Z'));
  assert.equal(days[0].date, '2026-10-24'); assert.equal(days[0].day, 6);
  assert.equal(days[0].entries.length, 1); assert.equal(new Date(days[0].entries[0].at).toISOString(), '2026-10-24T13:30:00.000Z');
});
test('iCalendar escapes titles, uses UTC+7 correctly and never inserts HTML or external URLs', () => {
  const calendar = P.ical({ version: 1, entries: { a: row(6) } }, [{ slug: 'a', title: 'Tên, phim;\\\nBEGIN:BAD' }], Date.parse('2026-10-24T14:00:00Z'));
  assert.match(calendar, /DTSTART:20261031T133000Z/); assert.match(calendar, /RRULE:FREQ=WEEKLY/);
  assert.match(calendar, /SUMMARY:Tên\\, phim\\;\\\\\\nBEGIN:BAD/); assert.equal(calendar.split('\r\nBEGIN:BAD').length, 1);
  for (const line of calendar.trimEnd().split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});
