const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), os = require("os"), path = require("path");
const editor = require("./relation-editor"), { prepareRelations, importRelations } = require("./import-relations"), { deriveRelations } = require("./build-relations");
const movies = [{ slug: "one", title: "Phần một" }, { slug: "two", title: "Tên khác" }, { slug: "three", title: "Phần ba" }];
const registry = () => ({ version: 1, groups: [{ id: "series", label: "Cùng loạt", sources: ["https://example.com/series"], members: movies.map((movie, order) => ({ slug: movie.slug, label: movie.title, order })) }], standalone: [] });
const metadata = { movies: Object.fromEntries(movies.map((movie, index) => [movie.slug, { status: "found", apiSlug: movie.slug, tmdb: { type: "tv", id: 42, season: index + 1 }, source: "https://example.com/series" }])) };
test("detach and delete explicitly suppress automatic regrouping after a metadata rebuild", () => {
  const detached = editor.removeMember(registry(), "series", "three");
  assert.equal(detached.groups[0].members.length, 2);
  assert.equal(detached.standalone[0].slug, "three");
  const rebuilt = deriveRelations(movies, metadata, prepareRelations(detached, movies));
  assert.equal(editor.membership(rebuilt, "three"), null);
  assert.equal(editor.membership(rebuilt, "one").id, "series");
  const removed = editor.deleteGroup(registry(), "series");
  assert.equal(deriveRelations(movies, metadata, prepareRelations(removed, movies)).groups.length, 0);
  assert.equal(removed.standalone.length, 3);
});
test("member ordering and display labels survive export and explicit sources replace title matching", () => {
  const initial = registry(), reordered = editor.moveMember(initial, "series", "three", -1);
  assert.deepEqual(initial.groups[0].members.map(member => member.slug), ["one", "two", "three"]);
  assert.deepEqual(reordered.groups[0].members.map(member => member.slug), ["one", "three", "two"]);
  reordered.groups[0].members[1].label = "OVA — chuyện bên lề";
  const imported = prepareRelations(JSON.parse(JSON.stringify(reordered)), movies);
  assert.equal(imported.groups[0].members[1].label, "OVA — chuyện bên lề");
  assert.deepEqual(imported.groups[0].members.map(member => member.order), [0, 1, 2]);
});
test("editing rejects conflicting membership, invalid sources, unknown slugs and unsupported versions", () => {
  const valid = registry();
  assert.throws(() => editor.addMember(valid, "series", movies[0]), /đã thuộc nhóm/);
  assert.throws(() => prepareRelations({ ...valid, groups: [...valid.groups, { ...valid.groups[0], id: "another" }] }, movies), /một nhóm/);
  for (const url of ["javascript:alert(1)", "http://example.com", "https://", "https://user:pass@example.com"])
    assert.throws(() => prepareRelations({ ...valid, groups: [{ ...valid.groups[0], sources: [url] }] }, movies), /HTTPS/);
  assert.throws(() => prepareRelations(valid, movies.slice(0, 2)), /không tồn tại/);
  assert.throws(() => prepareRelations({ ...valid, version: 2 }, movies), /Phiên bản/);
  assert.throws(() => prepareRelations({ ...valid, standalone: [{ slug: "one" }] }, movies), /vừa/);
  assert.throws(() => prepareRelations({ ...valid, groups: [], standalone: [{ slug: "one" }, { slug: "one" }] }, movies), /trùng/);
  assert.equal(editor.makeID("Đại chiến Titan: mùa 2"), "dai-chien-titan-mua-2");
});
test("drafts allow an incomplete group but publishing requires two movies and a source", () => {
  const draft = editor.removeMember(editor.removeMember(registry(), "series", "three"), "series", "two");
  assert.equal(editor.normalize(draft, movies.map(movie => movie.slug), { allowIncomplete: true }).groups[0].members.length, 1);
  assert.throws(() => prepareRelations(draft, movies), /2 phim/);
  const returned = editor.addMember(draft, "series", movies[1]);
  assert.equal(prepareRelations(returned, movies).groups[0].members.length, 2);
  assert.equal(returned.standalone.some(item => item.slug === "two"), false);
});
test("CLI validates before writing, backs up prior relations and rolls back when a build fails", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "movie-relations-test-"));
  try {
    const target = path.join(folder, "movie-relations.manual.json"), input = path.join(folder, "input.json");
    const prior = JSON.stringify({ version: 1, groups: [], standalone: [] }); fs.writeFileSync(target, prior);
    fs.writeFileSync(input, JSON.stringify({ groups: [{ id: "invalid", members: [] }] }));
    assert.throws(() => importRelations(input, { backend: folder, movies, build: () => {} }));
    assert.equal(fs.readFileSync(target, "utf8"), prior);
    fs.writeFileSync(input, JSON.stringify(registry()));
    assert.throws(() => importRelations(input, { backend: folder, movies, build: () => { throw Error("test failure"); } }), /khôi phục/);
    assert.equal(fs.readFileSync(target, "utf8"), prior);
    const result = importRelations(input, { backend: folder, movies, build: () => {} });
    assert.equal(result.groups.length, 1); assert.equal(fs.readFileSync(target + ".before-import.bak", "utf8"), prior);
    assert.equal(JSON.parse(fs.readFileSync(target, "utf8")).groups[0].members.length, 3);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
test("published manifest round-trips without losing any verified member", () => {
  const published = require("./data/movies.json"), manifest = require("../Backend/movie-relations.json");
  const imported = prepareRelations(manifest, published);
  assert.equal(imported.groups.length, manifest.groups.length);
  assert.equal(imported.groups.reduce((total, group) => total + group.members.length, 0), manifest.groups.reduce((total, group) => total + group.members.length, 0));
});
test("manual exact membership is not expanded or duplicated when metadata adds seasons", () => {
  const added = [{ slug: "four", title: "Mùa bốn" }, { slug: "five", title: "Mùa năm" }];
  const manual = registry(); manual.groups[0].id = "tmdb-tv-42";
  const cache = { movies: { ...metadata.movies, ...Object.fromEntries(added.map((movie, index) => [movie.slug, { status: "found", apiSlug: movie.slug, tmdb: { type: "tv", id: 42, season: index + 4 }, source: "https://example.com/series" }])) } };
  const result = deriveRelations([...movies, ...added], cache, manual);
  assert.equal(result.groups.length, 1); assert.equal(result.groups[0].members.length, 3);
  assert.equal(editor.membership(result, "four"), null);
});
