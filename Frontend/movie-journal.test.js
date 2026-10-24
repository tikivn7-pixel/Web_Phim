const { test } = require("node:test"), assert = require("node:assert/strict"), J = require("./movie-journal");
function memory(value) {
  const values = new Map(value === undefined ? [] : [[J.KEY, value]]);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
test("personal status and rating update independently without inventing watch progress or a public score", () => {
  const store = memory();
  assert.deepEqual(J.read(store), { version: 1, entries: {} });
  const first = J.set("one", { rating: 4 }, store);
  assert.equal(first.status, ""); assert.equal(first.rating, 4);
  const second = J.set("one", { status: "completed" }, store);
  assert.equal(second.rating, 4); assert.equal(second.status, "completed"); assert.ok(second.updatedAt > first.updatedAt);
  const third = J.set("one", { rating: 0 }, store);
  assert.equal(third.status, "completed"); assert.equal(third.rating, 0);
  assert.equal(store.values.size, 1); assert.equal(J.statusLabel("paused"), "Tạm dừng");
  assert.equal(J.get("missing", store), null);
});
test("a new choice rereads storage so another movie changed in a different tab survives", () => {
  const store = memory(); J.set("one", { status: "planned" }, store);
  const external = J.read(store); external.entries.two = { status: "paused", rating: 5, updatedAt: 2 }; J.write(external, store);
  J.set("one", { status: "watching" }, store);
  assert.equal(J.get("two", store).rating, 5); assert.equal(J.get("one", store).status, "watching");
});
test("malformed or blocked reads remain usable, but edits refuse replacing unreadable original data", () => {
  for (const raw of ["broken", "null", '{"version":99,"entries":{}}', '{"version":1,"entries":{"one":{"status":"invalid"}}}']) {
    const store = memory(raw); assert.deepEqual(J.read(store).entries, {});
    assert.throws(() => J.set("one", { status: "planned" }, store), /dữ liệu cũ/);
    assert.equal(store.values.get(J.KEY), raw);
  }
  const blocked = { getItem() { throw new Error("SecurityError"); } };
  assert.deepEqual(J.read(blocked).entries, {}); assert.throws(() => J.set("one", { rating: 3 }, blocked), /dữ liệu cũ/);
});
test("invalid imported statuses, ratings, timestamps and prototype keys are rejected before saving", () => {
  const good = { status: "planned", rating: 5, updatedAt: 1 };
  for (const entry of [{ ...good, status: "done" }, { ...good, rating: 5.5 }, { ...good, rating: "4" }, { ...good, rating: -1 }, { ...good, updatedAt: Infinity }]) {
    assert.throws(() => J.normalize({ version: 1, entries: { one: entry } }, true), /không hợp lệ/);
  }
  const poisoned = JSON.parse('{"version":1,"entries":{"__proto__":{"status":"completed","rating":5,"updatedAt":1}}}');
  assert.throws(() => J.normalize(poisoned, true), /không hợp lệ/); assert.equal({}.rating, undefined);
  const store = memory(); J.set("one", { rating: 3 }, store); const before = store.values.get(J.KEY);
  assert.throws(() => J.set("one", { rating: 9 }, store)); assert.equal(store.values.get(J.KEY), before);
  assert.throws(() => J.set("constructor", { rating: 3 }, store));
});
test("quota failure writes no success state and leaves the previous journal intact", () => {
  const store = memory(); J.set("one", { status: "planned" }, store); const before = store.values.get(J.KEY);
  store.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.throws(() => J.set("one", { status: "completed" }, store), /Không lưu được/);
  assert.equal(store.values.get(J.KEY), before);
});
test("merge takes the newest whole movie choice including explicit cleared status and rating", () => {
  const local = { version: 1, entries: { one: { status: "", rating: 0, updatedAt: 30 }, two: { status: "completed", rating: 4, updatedAt: 10 } } };
  const backup = { version: 1, entries: { one: { status: "completed", rating: 5, updatedAt: 20 }, two: { status: "watching", rating: 2, updatedAt: 40 } } };
  const before = JSON.stringify(local), merged = J.merge(local, backup);
  assert.deepEqual(merged.entries.one, local.entries.one); assert.deepEqual(merged.entries.two, backup.entries.two); assert.equal(JSON.stringify(local), before);
});
