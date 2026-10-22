const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTopics, matches, collectionPreviews, pickMovie, catalogHref } = require('./home-experience');
const { getDailyFeaturedList } = require('./hero');
const decode = require('./catalog-format').decode;
const catalog = decode(require('./data/catalog-index.json'));

test('home topic counts and sample posters follow exact catalog filters', () => {
  const topics = buildTopics(catalog);
  assert.equal(topics.length, 6);
  for (const topic of topics) {
    assert.equal(topic.count, catalog.filter(movie => matches(movie, topic.filter)).length);
    assert.ok(matches(topic.movie, topic.filter));
    assert.ok(topic.movie.slug);
    const params = new URL(catalogHref(topic.filter), 'https://local.test/').searchParams;
    assert.equal(params.get('view'), 'catalog');
    for (const [key, value] of Object.entries(topic.filter)) assert.equal(params.get(key), value);
  }
  assert.equal(matches({ country: 'Mỹ', sourceCountries: ['Mỹ', 'Nhật Bản'] }, { country: 'Nhật Bản' }), false);
  assert.equal(matches({ genres: 'Hành Động, Tâm Lý' }, { genre: 'Tâm' }), false);
});

test('home collection previews use verified slug memberships, never shared title prefixes', () => {
  const movies = [
    { title: 'Battle Spirits', slug: 'a', group: 'legacy-battle' },
    { title: 'Battle of Jangsari', slug: 'b', group: 'legacy-battle' },
    { title: 'Movie II', slug: 'second', group: 'verified', relationVerified: true, relationOrder: 1 },
    { title: 'Movie I', slug: 'first', group: 'verified', relationVerified: true, relationOrder: 0 },
    { title: 'Isolated', slug: 'alone', group: 'single-entry', relationVerified: true },
  ];
  const previews = collectionPreviews(movies);
  assert.equal(previews.length, 1);
  assert.equal(previews[0].id, 'verified');
  assert.deepEqual(previews[0].movies.map(movie => movie.slug), ['first', 'second']);
  for (const group of collectionPreviews(catalog)) {
    assert.ok(group.count >= 2);
    assert.ok(group.movies.every(movie => movie.relationVerified && movie.group === group.id));
  }
});

test('random discovery avoids repeating the immediately previous film and handles tiny catalogs', () => {
  const movies = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];
  assert.equal(pickMovie(movies, 'a', () => 0).slug, 'b');
  assert.equal(pickMovie(movies, 'c', () => .99).slug, 'b');
  assert.equal(pickMovie([movies[0]], 'a', () => .5).slug, 'a');
  assert.equal(pickMovie([], '', () => .5), undefined);
});

test('daily hero selection remains stable per day, uses existing catalog entries and cycles', () => {
  const day = 86_400_000;
  const a = getDailyFeaturedList(catalog, 4, day * 200);
  assert.equal(a.length, 4);
  assert.deepEqual(a, getDailyFeaturedList(catalog, 4, day * 200 + day - 1));
  assert.notDeepEqual(a, getDailyFeaturedList(catalog, 4, day * 201));
  assert.equal(new Set(a.map(movie => movie.slug)).size, 4);
  assert.ok(a.every(movie => /^Img\//.test(movie.poster) && catalog.includes(movie)));
  assert.deepEqual(getDailyFeaturedList([], 4, 0), []);
  assert.equal(getDailyFeaturedList([{ slug: 'only' }], 4, 0).length, 1);
});