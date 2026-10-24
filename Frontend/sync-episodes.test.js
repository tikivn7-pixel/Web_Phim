'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { sync, parseArgs } = require('./sync-episodes.cjs');
const payload = (slug, n = 2) => ({ status: true, movie: { slug, episode_current: n + '/12', episode_total: '12', status: 'ongoing' }, episodes: [{ server_data: Array.from({ length: n }, (_, i) => ({ name: String(i + 1), link_m3u8: 'https://example.com/private/' + i })) }] });
async function fixture(t, catalog = [{ slug: 'one', apiSlug: 'source-one', episodes: 12 }]) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'episode-sync-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const catalogPath = path.join(dir, 'movies.json'), outputPath = path.join(dir, 'snapshot.json');
  await fs.writeFile(catalogPath, JSON.stringify(catalog));
  return { catalogPath, outputPath, summaryPath: path.join(dir, 'episode-summary.json'), now: () => 2000000000000, log: () => {}, sleep: async () => {}, signals: false };
}
const response = data => ({ ok: true, json: async () => data });
test('episode sync arguments reject arbitrary URLs and invalid counts', () => {
  assert.deepEqual(parseArgs(['--slug', 'one', '--slug', 'one', '--limit', '3', '--force', '--dry-run']), { slugs: ['one'], limit: 3, force: true, dryRun: true, help: false });
  for (const args of [['--slug', 'https://bad'], ['--slug'], ['--limit', '0'], ['--limit', '3.5'], ['--other']]) assert.throws(() => parseArgs(args));
});
test('episode sync uses exact aliases, writes only sanitized snapshot and keeps source catalog unchanged', async t => {
  const deps = await fixture(t), original = await fs.readFile(deps.catalogPath, 'utf8'); const calls = [];
  deps.fetch = async (url, opts) => { calls.push(url); assert.equal(opts.redirect, 'error'); return response(payload('source-one')); };
  const result = await sync({}, deps);
  assert.deepEqual(calls, ['https://phimapi.com/phim/source-one']); assert.equal(result.exitCode, 0);
  const text = await fs.readFile(deps.outputPath, 'utf8'), saved = JSON.parse(text);
  assert.equal(saved.movies.one.available, 2); assert.equal(saved.movies.one.total, 12); assert.ok(!text.includes('private'));
  const summaryText = await fs.readFile(deps.summaryPath, 'utf8'), summary = JSON.parse(summaryText);
  assert.equal(summary.kind, 'summary'); assert.equal(summary.movies.one.available, 2); assert.ok(!summaryText.includes('names')); assert.ok(!summaryText.includes('private'));
  assert.equal(await fs.readFile(deps.catalogPath, 'utf8'), original);
  const again = await sync({}, deps); assert.equal(again.report.selected, 0); assert.equal(calls.length, 1);
});
test('existing slash-prefixed local catalog identities use their exact safe source alias', async t => {
  const deps = await fixture(t, [{ slug: 'phim/sat-thu-ve-vuon', apiSlug: 'sat-thu-ve-vuon' }]);
  deps.fetch = async url => { assert.equal(url, 'https://phimapi.com/phim/sat-thu-ve-vuon'); return response(payload('sat-thu-ve-vuon')); };
  const result = await sync(parseArgs(['--slug', 'phim/sat-thu-ve-vuon']), deps);
  assert.equal(result.report.succeeded, 1); assert.equal(result.snapshot.movies['phim/sat-thu-ve-vuon'].sourceSlug, 'sat-thu-ve-vuon');
  const overlay = require('./published-episodes.js').overlay([{ slug: 'phim/sat-thu-ve-vuon', apiSlug: 'sat-thu-ve-vuon' }], result.snapshot);
  assert.equal(overlay[0].availableEpisodes, 2);
});
test('dry run writes nothing; unknown slugs fail before network; source mismatch and empty responses retain prior success', async t => {
  const deps = await fixture(t); deps.fetch = async () => response(payload('source-one'));
  await sync({ dryRun: true }, deps); await assert.rejects(fs.readFile(deps.outputPath), { code: 'ENOENT' }); await assert.rejects(fs.readFile(deps.summaryPath), { code: 'ENOENT' });
  await assert.rejects(sync({ slugs: ['missing'] }, deps), /not found/);
  await sync({}, deps); const prior = await fs.readFile(deps.outputPath, 'utf8');
  for (const invalid of [payload('wrong-slug'), payload('source-one', 0), { status: false }]) {
    let calls = 0; deps.fetch = async () => { calls++; return response(invalid); };
    const result = await sync({ force: true }, deps); assert.equal(result.exitCode, 1); assert.equal(calls, 2);
    assert.equal(await fs.readFile(deps.outputPath, 'utf8'), prior);
  }
});
test('sync is bounded to two requests, retries once and saves successful partial results', async t => {
  const deps = await fixture(t, ['one', 'two', 'three', 'four'].map(slug => ({ slug })));
  let active = 0, max = 0; const calls = {};
  deps.fetch = async url => {
    const slug = url.split('/').at(-1); calls[slug] = (calls[slug] || 0) + 1;
    active++; max = Math.max(max, active); await new Promise(resolve => setTimeout(resolve, 5)); active--;
    if (slug === 'two' || (slug === 'one' && calls[slug] === 1)) throw Error('Temporary source failure');
    return response(payload(slug));
  };
  const result = await sync({ force: true }, deps);
  assert.equal(max, 2); assert.equal(calls.one, 2); assert.equal(calls.two, 2);
  assert.equal(result.exitCode, 0); assert.equal(result.report.succeeded, 3); assert.equal(result.report.failed, 1);
  assert.equal(Object.keys(JSON.parse(await fs.readFile(deps.outputPath)).movies).length, 3);
});
test('sync timeout completes even if a broken fetch ignores abort and invalid existing JSON is preserved', async t => {
  const deps = await fixture(t); deps.timeoutMs = 5; deps.fetch = () => new Promise(() => {});
  const result = await sync({}, deps); assert.equal(result.exitCode, 1); assert.match(result.report.failures[0].error, /timed out/);
  await fs.writeFile(deps.outputPath, '{broken');
  await assert.rejects(sync({}, deps)); assert.equal(await fs.readFile(deps.outputPath, 'utf8'), '{broken');
});
test('interrupt stops scheduling and flushes completed observations without touching catalog', async t => {
  const deps = await fixture(t, Array.from({ length: 8 }, (_, i) => ({ slug: 'movie-' + i })));
  deps.signals = true; let interrupted = false;
  deps.fetch = async url => response(payload(url.split('/').at(-1)));
  deps.sleep = async () => { if (!interrupted) { interrupted = true; process.emit('SIGINT'); } };
  const result = await sync({}, deps);
  assert.equal(result.exitCode, 130); assert.equal(result.report.stopped, true); assert.ok(result.report.checked <= 2);
  const saved = JSON.parse(await fs.readFile(deps.outputPath)); assert.equal(Object.keys(saved.movies).length, result.report.succeeded);
  assert.equal(process.listenerCount('SIGINT'), 0);
  await assert.rejects(fs.readFile(deps.outputPath + '.lock'), { code: 'ENOENT' });
});
test('overlapping writers are rejected and errors release their output lock', async t => {
  const deps = await fixture(t); let started, release;
  const ready = new Promise(resolve => { started = resolve; }), paused = new Promise(resolve => { release = resolve; });
  deps.fetch = async () => { started(); await paused; return response(payload('source-one')); };
  const first = sync({}, deps); await ready;
  await assert.rejects(sync({}, deps), /Another episode sync owns/);
  release(); const result = await first; assert.equal(result.report.succeeded, 1);
  assert.equal(JSON.parse(await fs.readFile(deps.outputPath)).movies.one.available, 2);
  await assert.rejects(fs.readFile(deps.outputPath + '.lock'), { code: 'ENOENT' });
  await fs.writeFile(deps.outputPath, 'broken'); await assert.rejects(sync({}, deps));
  await assert.rejects(fs.readFile(deps.outputPath + '.lock'), { code: 'ENOENT' });
});
test('a changed source alias establishes a baseline instead of reporting additions', async t => {
  const deps = await fixture(t); deps.fetch = async () => response(payload('source-one', 1)); await sync({}, deps);
  await fs.writeFile(deps.catalogPath, JSON.stringify([{ slug: 'one', apiSlug: 'source-two' }]));
  deps.fetch = async () => response(payload('source-two', 2));
  const result = await sync({}, deps); assert.equal(result.report.succeeded, 1); assert.equal(result.report.changed, 0);
});
