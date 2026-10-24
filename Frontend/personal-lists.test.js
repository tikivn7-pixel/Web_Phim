const test = require('node:test'), assert = require('node:assert/strict'), L = require('./personal-lists');
const storage = () => { const data = new Map(); return { getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, value) }; };
const fixture = (updatedAt = 1, deleted = false) => ({ version: 1, lists: { weekend: { name: 'Cuối tuần', description: 'Xem cùng bạn', slugs: deleted ? [] : ['phim-1', 'phim-2'], updatedAt, deleted } } });
test('personal lists keep exact member order through CRUD and reload', () => {
  const s = storage(), { id } = L.create({ name: '  Cuối tuần  ' }, s);
  L.add(id, 'one', s); L.add(id, 'two', s); L.add(id, 'one', s);
  assert.deepEqual(L.read(s).lists[id].slugs, ['one', 'two']);
  L.move(id, 'two', -1, s); assert.deepEqual(L.read(s).lists[id].slugs, ['two', 'one']);
  L.move(id, 'two', -1, s); assert.deepEqual(L.read(s).lists[id].slugs, ['two', 'one']);
  L.update(id, { name: 'Gia đình', description: 'Tối thứ bảy' }, s); L.removeMovie(id, 'two', s);
  assert.deepEqual(L.active(L.read(s)).map(list => [list.name, list.slugs]), [['Gia đình', ['one']]]);
  L.remove(id, s); assert.equal(L.active(L.read(s)).length, 0); assert.equal(L.read(s).lists[id].deleted, true);
  assert.throws(() => L.add(id, 'one', s), /không còn/);
});
test('personal lists reject malformed and prototype keys without erasing existing data', () => {
  const bad = fixture(); bad.lists.weekend.slugs.push('phim-1'); assert.throws(() => L.normalize(bad, true)); assert.deepEqual(L.normalize(bad).lists, {});
  assert.throws(() => L.normalize(JSON.parse('{"version":1,"lists":{"__proto__":{"name":"x","description":"","slugs":[],"updatedAt":1,"deleted":false}}}'), true));
  for (const patch of [{ name: '' }, { name: 'x'.repeat(81) }, { description: 'x'.repeat(501) }]) { const s = storage(); s.setItem(L.KEY, JSON.stringify(fixture())); assert.throws(() => L.update('weekend', patch, s)); assert.deepEqual(L.read(s), fixture()); }
  const s = storage(); s.setItem(L.KEY, '{broken'); assert.throws(() => L.create({ name: 'x' }, s), /Không đọc/); assert.equal(s.getItem(L.KEY), '{broken');
});
test('personal list merge keeps newest list, member order and deletion tombstone', () => {
  const old = fixture(10), deleted = fixture(20, true);
  assert.deepEqual(L.merge(old, deleted), deleted); assert.deepEqual(L.merge(deleted, old), deleted);
  const renamed = fixture(30); renamed.lists.weekend.name = 'Mới'; renamed.lists.weekend.slugs.reverse();
  assert.deepEqual(L.merge(deleted, renamed), renamed); assert.deepEqual(L.merge(renamed, fixture(30)), renamed);
});
test('personal lists enforce capacity and report blocked storage', () => {
  const s = storage(), full = fixture(); full.lists.weekend.slugs = Array.from({ length: 500 }, (_, index) => 'p-' + index); s.setItem(L.KEY, JSON.stringify(full));
  assert.throws(() => L.add('weekend', 'extra', s), /500/); assert.equal(L.read(s).lists.weekend.slugs.length, 500);
  const records = { version: 1, lists: {} }; for (let i = 0; i < 50; i++) records.lists['list-' + i] = { ...fixture().lists.weekend, slugs: [] }; s.setItem(L.KEY, JSON.stringify(records));
  assert.throws(() => L.create({ name: 'extra' }, s), /50/);
  assert.throws(() => L.create({ name: 'x' }, { getItem: () => null, setItem: () => { throw Error('quota'); } }), /Không lưu/);
});
