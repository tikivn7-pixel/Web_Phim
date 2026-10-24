const { test } = require("node:test");
const assert = require("node:assert/strict");
const Watch = require("./watch-progress");

function fixture(options = {}) {
  const video = new EventTarget();
  Object.assign(video, { duration: 100, currentTime: 0, paused: true });
  let watched = false; let writes = 0; let changes = 0; let errors = 0;
  const tracker = { isWatched() { return watched; }, set() { writes++; if (options.blocked) throw Error("quota"); watched = true; } };
  const control = Watch.attach({ video, slug: "known-movie", name: "Tập 01", tracker, available: true,
    onChange() { changes++; }, onError() { errors++; }, ...options });
  const fire = event => video.dispatchEvent(new Event(event));
  return { video, control, fire, clear() { watched = false; }, writes: () => writes, changes: () => changes, errors: () => errors };
}

test("watch ordering keeps raw provider indices and filters by actual episode name", () => {
  const input = [{ name: "Tập 10", episode: 1 }, { name: "02", episode: 2 }, { name: "1", episode: 3 }];
  assert.deepEqual(Watch.orderedEntries(input).map(item => item.episode), [3, 2, 1]);
  assert.deepEqual(Watch.filterEntries(input, { query: "Tập 10" }).map(item => item.episode), [1]);
  assert.equal(Watch.filterEntries(input, { query: "99" }).length, 0);
  assert.deepEqual(Watch.filterEntries(input, { filter: "watched", isWatched: name => name === "02" }).map(item => item.episode), [2]);
  assert.deepEqual(Watch.filterEntries(input, { filter: "unwatched", isWatched: name => name === "02" }).map(item => item.episode), [3, 1]);
  assert.deepEqual(Watch.orderedEntries([{ name: "2" }, { name: "Special" }, { name: "1" }]).map(item => item.name), ["2", "Special", "1"]);
  assert.deepEqual(Watch.orderedEntries([{ name: "01" }, { name: "1" }]).map(item => item.name), ["01", "1"]);
});

test("opening a page, metadata alone, paused seeks and invalid metadata cannot mark an episode", () => {
  const f = fixture(); f.video.currentTime = 97; f.fire("timeupdate");
  f.fire("loadedmetadata"); f.fire("timeupdate");
  assert.equal(f.writes(), 0);
  f.video.duration = Infinity; f.fire("loadedmetadata"); f.video.paused = false; f.fire("play"); f.fire("ended");
  assert.equal(f.writes(), 0); f.control.destroy();
});

test("95 percent of verified native playback marks once, and manual clear survives this pass", () => {
  const f = fixture(); f.fire("loadedmetadata"); f.video.paused = false; f.fire("play");
  f.video.currentTime = 94; f.fire("timeupdate"); assert.equal(f.writes(), 0);
  f.video.currentTime = 95; f.fire("timeupdate"); assert.equal(f.writes(), 1); assert.equal(f.changes(), 1);
  f.clear(); f.video.currentTime = 98; f.fire("timeupdate"); f.video.currentTime = 100; f.fire("ended");
  assert.equal(f.writes(), 1);
  f.video.currentTime = 90; f.fire("timeupdate"); f.video.currentTime = 96; f.fire("timeupdate");
  assert.equal(f.writes(), 2); f.control.destroy();
  f.clear(); f.video.currentTime = 90; f.fire("timeupdate"); f.video.currentTime = 99; f.fire("timeupdate");
  assert.equal(f.writes(), 2);
});

test("ended needs real metadata and playback; embeds and unavailable episodes never auto-mark", () => {
  const f = fixture(); f.video.currentTime = 100; f.fire("ended"); f.fire("loadedmetadata"); f.fire("ended");
  assert.equal(f.writes(), 0); f.fire("play"); f.fire("ended"); assert.equal(f.writes(), 1);
  for (const options of [{ available: false }, { embedded: true }, { slug: "" }, { name: "" }]) {
    const other = fixture(options); other.video.currentTime = 100; other.video.paused = false;
    for (const event of ["loadedmetadata", "play", "timeupdate", "ended"]) other.fire(event);
    assert.equal(other.writes(), 0);
  }
});

test("blocked tracker storage reports once and suppresses repeated failed writes", () => {
  const f = fixture({ blocked: true }); f.fire("loadedmetadata"); f.video.paused = false; f.fire("play");
  for (let pass = 0; pass < 4; pass++) {
    f.video.currentTime = 10; f.fire("timeupdate"); f.video.currentTime = 98; f.fire("timeupdate"); f.fire("ended");
  }
  assert.equal(f.writes(), 1); assert.equal(f.errors(), 1); assert.equal(f.changes(), 0);
});
