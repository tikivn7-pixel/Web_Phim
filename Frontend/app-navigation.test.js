const test = require('node:test'), assert = require('node:assert/strict'), Nav = require('./app-navigation');

test('quick navigation recognizes accents, word combinations and safe dedicated actions', () => {
  assert.equal(Nav.searchActions('  ghi   CHU ').find(action => action.id === 'notes').href, 'notes.html');
  assert.ok(Nav.searchActions('quốc gia').some(action => action.id === 'discover'));
  assert.ok(Nav.searchActions('thu vien').some(action => action.id === 'library'));
  assert.ok(!Nav.searchActions('thu vien').some(action => action.id === 'notes'));
  assert.equal(Nav.searchActions('').length, 11);
  const expected = new Set(['comics.html', 'index.html', 'discover.html', 'collections.html', 'picker.html', 'updates.html', 'library.html', 'lists.html', 'notes.html', 'stats.html', 'manage.html']);
  assert.deepEqual(new Set(Nav.ACTIONS.map(action => action.href)), expected);
});

test('unknown film searches remain data and only change the local discover query', () => {
  const input = '<img src=x onerror=alert(1)> & "Nhật" #1';
  const actions = Nav.searchActions(input);
  assert.equal(actions.length, 1); assert.equal(actions[0].id, 'film-search');
  const url = new URL(actions[0].href, 'https://example.test/Frontend/');
  assert.equal(url.pathname, '/Frontend/discover.html'); assert.equal(url.searchParams.get('q'), input); assert.equal(url.hash, '');
  assert.equal(Nav.cleanQuery('a'.repeat(500)).length, 180);
  assert.equal(Nav.searchHref('   '), 'discover.html');
  assert.equal(new URL(Nav.searchHref('javascript:alert(1)'), 'https://example.test').protocol, 'https:');
});

test('active navigation separates old index filters from home and preserves exact routes', () => {
  assert.equal(Nav.activePage('/Frontend/'), 'home');
  assert.equal(Nav.activePage('/Frontend/index.html'), 'home');
  assert.equal(Nav.activePage('/Frontend/index.html', '?view=catalog&q=one'), 'discover');
  assert.equal(Nav.activePage('/Frontend/index.html', '?country=Japan'), 'discover');
  assert.equal(Nav.activePage('/Frontend/index.html', '?view=wishlist'), 'library');
  assert.equal(Nav.activePage('/Frontend/library.html', '?tab=planned'), 'library');
  assert.equal(Nav.activePage('/Frontend/watch.html', '?slug=index.html'), '');
  assert.equal(Nav.activePage('/Frontend/not-discover.html'), '');
  assert.equal(Nav.activePage('/Frontend/stats.html'), 'stats');
});
