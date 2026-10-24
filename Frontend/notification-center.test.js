const test = require('node:test'), assert = require('node:assert/strict'), N = require('./notification-center');
const cache = (newNames = ['2']) => ({ version: 1, entries: { film: { checkedAt: 100, attemptAt: 100, names: [{ name: '1', episode: 1, server: 0 }, { name: '2', episode: 4, server: 1 }], newNames, sourceSlug: 'film' } } });
test('notifications never turn first observation into alerts or include unknown titles', () => {
  assert.equal(N.items(cache([]), undefined, [{ slug: 'film', title: 'Film' }]).length, 0);
  assert.equal(N.items(cache(), undefined, [{ slug: 'other', title: 'Other' }]).length, 0);
  const rows = N.items(cache(), undefined, [{ slug: 'film', title: '<img>' }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].title, '<img>'); assert.equal(rows[0].episode, 4);
  assert.match(N.watchURL(rows[0]), /target_episode=2&server=1/);
});
test('acknowledgements merge and stay read when newer episodes change the snapshot time', () => {
  const id = JSON.stringify(['film', '2']), input = { version: 1, read: { [id]: 120 } };
  assert.equal(N.items(cache(), input)[0].read, true);
  const newer = cache(); newer.entries.film.checkedAt = 1000;
  assert.equal(N.items(newer, input)[0].read, true);
  assert.equal(N.merge(input, { version: 1, read: { [id]: 100 } }).read[id], 120);
});
test('invalid notification state is rejected before any storage is changed', () => {
  let writes = 0; const storage = { getItem: () => '{bad', setItem: () => writes++ };
  assert.throws(() => N.acknowledge([JSON.stringify(['film', '2'])], storage)); assert.equal(writes, 0);
  assert.throws(() => N.normalize({ version: 1, read: { unsafe: 10 } }, true));
});
