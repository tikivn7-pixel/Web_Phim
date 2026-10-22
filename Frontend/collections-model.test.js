const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('./collections-model');
const movies = [
  { slug: 'a-1', title: 'Hành trình một', country: 'Nhật Bản', year: 2020, type: 'animation', genres: 'Hoạt Hình, Phiêu Lưu', group: 'wrong-old-name' },
  { slug: 'a-2', title: 'Một tên khác', country: 'Nhật Bản', year: 2024, type: 'animation', genres: 'Hoạt Hình', group: 'also-wrong' },
  { slug: 'b-1', title: 'Không cùng loạt', country: 'Mỹ', year: 2018, type: 'single', group: 'wrong-old-name' },
  { slug: 'b-2', title: 'Phim thứ hai', country: 'Mỹ', year: 2023, type: 'single' }
];
const registry = { groups: [
  { id: 'a', label: 'Hành trình', members: [{ slug: 'a-2', order: 2 }, { slug: 'a-1', order: 1 }] },
  { id: 'b', label: 'Điện ảnh', members: [{ slug: 'b-1', order: 0 }, { slug: 'b-2', order: 1 }] }
] };
test('collections use only explicit members and member order, never legacy names', () => {
  const groups = model.build(registry, movies);
  assert.deepEqual(groups[0].members.map(member => member.slug), ['a-1', 'a-2']);
  assert.equal(groups[0].yearMin, 2020); assert.equal(groups[0].yearMax, 2024);
  assert.equal(groups[0].anime, true);
  assert.deepEqual(groups[0].countries, ['Nhật Bản']);
});
test('collection search combines member title/slug with accent insensitive queries and filters', () => {
  const groups = model.build(registry, movies);
  assert.equal(model.select(groups, { q: 'ten khac' }).items[0].id, 'a');
  assert.equal(model.select(groups, { q: 'a-2', country: 'Nhật Bản', type: 'anime' }).total, 1);
  assert.equal(model.select(groups, { q: 'hanh trinh', country: 'Mỹ' }).total, 0);
  assert.equal(model.select(groups, { type: 'film' }).items[0].id, 'b');
  assert.equal(model.select(groups, { q: 'dien anh' }).items[0].id, 'b');
});
test('collection pagination clamps invalid pages and sorts before slicing', () => {
  const groups = model.build(registry, movies);
  const result = model.select(groups, { sort: 'year', page: 100, pageSize: 1 });
  assert.equal(result.page, 2); assert.equal(result.pages, 2); assert.equal(result.items[0].id, 'b');
  assert.equal(model.select(groups, { page: -10, pageSize: 1 }).page, 1);
  assert.equal(model.select(groups, { q: 'zzzz', page: 5 }).page, 1);
});
test('missing catalog members never lead to invented cards or duplicate membership', () => {
  assert.equal(model.build({ groups: [{ id: 'orphan', members: [{ slug: 'a-1' }, { slug: 'missing' }] }] }, movies).length, 0);
  assert.equal(model.build({ groups: [{ id: 'dup', members: [{ slug: 'a-1' }, { slug: 'a-1' }] }] }, movies).length, 0);
});
test('published collection roster matches the explicit registry and links only existing movies', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/catalog-index.json'), 'utf8'));
  const published = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/movie-relations.json'), 'utf8'));
  const groups = model.build(published, require('./catalog-format').decode(data));
  assert.equal(groups.length, published.groups.length);
  for (const group of groups) {
    const raw = published.groups.find(item => item.id === group.id);
    assert.equal(group.members.length, raw.members.length);
    assert.ok(group.members.every(member => raw.members.some(item => item.slug === member.slug)));
  }
  assert.equal(groups.find(group => group.id === 'the-witch-films').members.length, 2);
  assert.ok(!groups.some(group => group.members.some(member => member.slug === 'battle-spirits-re-tuyet-gioi-thien-khong')));
});
