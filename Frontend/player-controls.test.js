const { test } = require("node:test");
const assert = require("node:assert/strict");
const Controls = require("./player-controls");
const Playback = require("./playback-tools");

const memory = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
class Element extends EventTarget {
  constructor(tag = "div") {
    super(); this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {};
    this.value = ""; this.textContent = ""; this.hidden = false;
    const classes = new Set(); this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
  }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
}
function fixture({ clock = 100000, storage = memory(), session = memory(), introKey = "" } = {}) {
  const doc = new Element("document"); doc.createElement = tag => new Element(tag); doc.querySelector = () => null;
  const win = new Element("window"); const intervals = new Set();
  win.setInterval = callback => { intervals.add(callback); return callback; }; win.clearInterval = callback => intervals.delete(callback);
  win.setTimeout = () => 1; win.clearTimeout = () => {};
  const video = new Element("video"); video.duration = 600; video.currentTime = 0; video.paused = true;
  video.play = async () => { video.paused = false; video.dispatchEvent(new Event("play")); };
  video.pause = () => { video.paused = true; };
  const host = new Element(); host.append(video); const panel = new Element();
  let slept = 0;
  const control = Controls.attach({ video, panel, introKey, storage, session, doc, win, now: () => clock, onSleep: () => slept++ });
  const descendants = element => element.children.flatMap(child => [child, ...descendants(child)]);
  return { control, video, host, panel, doc, win, storage, session, intervals, setClock: value => { clock = value; }, slept: () => slept, all: element => descendants(element) };
}
test("preferences reject invalid speed and clamp volume; blocked/corrupt storage remains usable", () => {
  assert.deepEqual(Controls.preferences({ rate: 25, volume: -1, muted: "true" }), { rate: 1, volume: 0, muted: false });
  assert.deepEqual(Controls.preferences({ rate: 1.5, volume: 3, muted: true }), { rate: 1.5, volume: 1, muted: true });
  assert.deepEqual(Controls.preferences(null), { rate: 1, volume: 1, muted: false });
  const blocked = { getItem() { throw Error("blocked"); }, setItem() { throw Error("quota"); } };
  assert.equal(Controls.read(blocked, "anything", 0), 0); assert.equal(Controls.write(blocked, "anything", 1), false);
  const win = {}; Object.defineProperty(win, "localStorage", { get() { throw Error("private"); } });
  assert.equal(Controls.getStorage(win, "localStorage"), null);
  const ui = fixture({ storage: blocked, session: blocked }); ui.control.speed.value = "1.5";
  assert.doesNotThrow(() => ui.control.speed.dispatchEvent(new Event("change")));
  assert.equal(ui.video.playbackRate, 1.5); ui.control.destroy();
});
test("keyboard shortcuts respect editing, native controls, composition, and modal dialogs", () => {
  const plain = { key: "k", target: { closest: () => null } };
  assert.equal(Controls.shouldIgnoreShortcut(plain, { querySelector: () => null }), false);
  for (const extra of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { defaultPrevented: true }, { target: { isContentEditable: true } }, { target: { closest: () => ({ tagName: "BUTTON" }) } }]) {
    assert.equal(Controls.shouldIgnoreShortcut({ ...plain, ...extra }, { querySelector: () => null }), true);
  }
  assert.equal(Controls.shouldIgnoreShortcut(plain, { querySelector: () => ({ open: true }) }), true);
});
test("seek targets stay finite before metadata and within the actual duration", () => {
  assert.equal(Controls.seekTarget(5, -10, 100), 0); assert.equal(Controls.seekTarget(95, 10, 100), 100);
  assert.equal(Controls.seekTarget(0, 10, NaN), 0); assert.equal(Controls.seekTarget(0, 10, Infinity), 0);
  assert.equal(Controls.seekTarget(Infinity, 10, NaN), 0);
  assert.equal(Controls.validRange({ start: 0, end: 90 }, 60), false);
  assert.equal(Controls.validRange({ start: 0, end: 90 }, 100), true);
  assert.equal(Controls.validRange({ start: null, end: 90 }), false);
  assert.equal(Controls.validRange({ start: 20, end: 20 }), false);
  assert.equal(Controls.sleepRemaining(160001, 100000), 61); assert.equal(Controls.sleepRemaining(1, 2), 0);
  assert.equal(Controls.sleepRemaining(0, 2), null);
});
test("speed and native volume/rate changes persist across episodes", () => {
  const storage = memory(), first = fixture({ storage });
  first.control.speed.value = "1.75"; first.control.speed.dispatchEvent(new Event("change"));
  first.video.volume = 0.4; first.video.muted = true; first.video.dispatchEvent(new Event("volumechange")); first.control.destroy();
  const second = fixture({ storage });
  assert.equal(second.video.playbackRate, 1.75); assert.equal(second.video.volume, 0.4); assert.equal(second.video.muted, true); second.control.destroy();
});
test("playback keys control the video once and cleanup removes the keyboard listener", async () => {
  const ui = fixture();
  const key = (value, extra = {}) => {
    const event = new Event("keydown", { cancelable: true });
    for (const [name, entry] of Object.entries({ key: value, ...extra })) Object.defineProperty(event, name, { value: entry });
    ui.doc.dispatchEvent(event); return event;
  };
  ui.video.currentTime = 40;
  assert.equal(key("ArrowRight").defaultPrevented, true); assert.equal(ui.video.currentTime, 50);
  key("ArrowLeft"); assert.equal(ui.video.currentTime, 40);
  key("m"); assert.equal(ui.video.muted, true);
  key("ArrowDown"); assert.equal(ui.video.muted, false); assert.equal(ui.video.volume, 0.9);
  key("k"); await Promise.resolve(); assert.equal(ui.video.paused, false);
  key("k", { repeat: true }); assert.equal(ui.video.paused, false);
  key(" "); assert.equal(ui.video.paused, true);
  ui.control.destroy(); key("ArrowRight"); assert.equal(ui.video.currentTime, 40);
});
test("sleep uses one absolute deadline across navigation, pauses exactly once, and blocks auto-next", () => {
  const session = memory(), first = fixture({ session });
  first.control.sleep.value = "15"; first.control.sleep.dispatchEvent(new Event("change"));
  assert.equal(Controls.read(session, Controls.SLEEP_KEY, 0), 1000000);
  first.control.destroy();
  const second = fixture({ session, clock: 999999 }); second.video.paused = false;
  assert.equal(second.control.shouldAutoNext(), true);
  second.setClock(1000000); second.control.tick();
  assert.equal(second.video.paused, true); assert.equal(second.slept(), 1); assert.equal(second.control.shouldAutoNext(), false);
  second.control.tick(); assert.equal(second.slept(), 1);
  second.control.sleep.value = "0"; second.control.sleep.dispatchEvent(new Event("change"));
  assert.equal(second.control.shouldAutoNext(), true);
  second.control.destroy(); assert.equal(second.intervals.size, 0);
});
test("intro is never guessed and only the exact episode/source gets the user's marked range", () => {
  const storage = memory(), first = fixture({ storage, introKey: "film:ep1:sourceA" });
  const skip = first.all(first.host).find(element => element.className === "player-skip-intro");
  assert.equal(skip.hidden, true); first.video.currentTime = 15; first.video.dispatchEvent(new Event("timeupdate")); assert.equal(skip.hidden, true);
  const buttons = first.all(first.panel).filter(element => element.tagName === "BUTTON");
  buttons.find(button => button.textContent === "Đánh dấu bắt đầu").dispatchEvent(new Event("click"));
  first.video.currentTime = 75; buttons.find(button => button.textContent === "Đánh dấu kết thúc").dispatchEvent(new Event("click"));
  first.video.currentTime = 20; first.video.dispatchEvent(new Event("timeupdate")); assert.equal(skip.hidden, false);
  skip.dispatchEvent(new Event("click")); assert.equal(first.video.currentTime, 75);
  first.control.destroy();
  const other = fixture({ storage, introKey: "film:ep1:sourceB" });
  assert.equal(other.all(other.host).find(element => element.className === "player-skip-intro").hidden, true); other.control.destroy();
  const restored = fixture({ storage, introKey: "film:ep1:sourceA" }); restored.video.currentTime = 20; restored.video.dispatchEvent(new Event("timeupdate"));
  assert.equal(restored.all(restored.host).find(element => element.className === "player-skip-intro").hidden, false);
  restored.control.destroy();
});
test("page cache restore rechecks elapsed sleep without starting duplicate timers", () => {
  const ui = fixture(); ui.control.sleep.value = "15"; ui.control.sleep.dispatchEvent(new Event("change"));
  ui.win.dispatchEvent(new Event("pagehide")); assert.equal(ui.intervals.size, 0);
  ui.setClock(1000001); const event = new Event("pageshow"); Object.defineProperty(event, "persisted", { value: true });
  ui.win.dispatchEvent(event); assert.equal(ui.slept(), 1); assert.equal(ui.intervals.size, 1);
  ui.win.dispatchEvent(event); assert.equal(ui.intervals.size, 1); ui.control.destroy(); assert.equal(ui.intervals.size, 0);
});
test("logical episode navigation preserves raw indices while correcting reordered numeric servers", () => {
  const episodes = [{ name: "Tập 02" }, { name: "Tập 1" }, { name: "3" }];
  assert.deepEqual(Playback.logicalNeighbors(episodes, 0), { previous: 1, next: 2, isFirst: false, isLast: false });
  assert.deepEqual(Playback.logicalNeighbors(episodes, 1), { previous: null, next: 0, isFirst: true, isLast: false });
  assert.deepEqual(Playback.logicalNeighbors(episodes, 2), { previous: 0, next: null, isFirst: false, isLast: true });
  assert.deepEqual(Playback.logicalNeighbors([{ name: "Full" }], 0), { previous: null, next: null, isFirst: true, isLast: true });
  assert.equal(Playback.logicalNeighbors([{ name: "Special" }, { name: "2" }, { name: "1" }], 1).next, 2);
  assert.equal(Playback.logicalNeighbors([{ name: "1" }, { name: "01" }], 0).next, 1);
  assert.equal(Playback.logicalNeighbors([], 0).isLast, false);
});
test("position restore matches real episode identity and uses source/server for legacy positions", () => {
  const context = { episodeName: "Tập 2", source: "kkphim", server: 1 };
  assert.equal(Playback.positionMatches({ episodeName: "02", server: 0, source: "nguonc" }, context), true);
  assert.equal(Playback.positionMatches({ episodeName: "1", server: 1, source: "kkphim" }, context), false);
  assert.equal(Playback.positionMatches({ server: 1, source: "kkphim" }, context), true);
  assert.equal(Playback.positionMatches({ server: 0, source: "kkphim" }, context), false);
  assert.equal(Playback.positionMatches({ server: 1, source: "nguonc" }, context), false);
  assert.equal(Playback.positionMatches(null, context), false);
});
test("the last published episode does not finish a series whose declared total is larger", () => {
  const partial = Array.from({ length: 8 }, (_, i) => ({ name: String(i + 1) }));
  assert.equal(Playback.logicalNeighbors(partial, 7).isLast, true);
  assert.equal(Playback.isSeriesFinal(partial, 7, 12), false);
  assert.equal(Playback.isSeriesFinal(partial, 7, 8), true);
  assert.equal(Playback.isSeriesFinal(partial, 6, 8), false);
  assert.equal(Playback.isSeriesFinal(partial, 7, 0), false);
  assert.equal(Playback.isSeriesFinal([{ name: "Tập 2" }, { name: "1" }], 0, 2), true);
  assert.equal(Playback.isSeriesFinal([{ name: "Tập 2" }, { name: "1" }], 1, 2), false);
  assert.equal(Playback.isSeriesFinal([{ name: "Full" }], 0, 1), true);
});
test("provider embeds accept HTTP(S) without credentials, and reject executable or malformed URLs", () => {
  assert.equal(Playback.safeEmbedUrl("https://player.example/embed?id=1"), "https://player.example/embed?id=1");
  assert.equal(Playback.safeEmbedUrl("http://player.example/embed"), "http://player.example/embed");
  for (const value of ["javascript:alert(1)", "data:text/html,test", "//example.org/embed", "/embed", "https://user:pass@example.org/embed", "https://example.org/\nembed", "https://example.org/\\embed", "https://"]) assert.equal(Playback.safeEmbedUrl(value), "", value);
});
