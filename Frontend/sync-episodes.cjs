#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const Updates = require('./episode-updates.js');
const Published = require('./published-episodes.js');
const slugOK = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,249}$/.test(value) && !['constructor', 'prototype'].includes(value);
const identityOK = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 500 && !/[\u0000-\u001f\u007f]/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const HELP = `Update episode observations for movies already in the catalog.
Usage: npm run episodes:sync -- [--slug movie-slug] [--limit N] [--force] [--dry-run]
  --slug SLUG   Check one existing catalog slug (repeat to select several).
  --limit N     Check at most N eligible movies, in catalog order.
  --force       Recheck even if the last successful check was under 6 hours ago.
  --dry-run     Fetch and report results without writing any file.
  --help        Print this help.
Default: all existing KKPhim movies, concurrency 2, 12-second timeout, one retry.
Writes Frontend/data/episode-snapshots.json and lightweight episode-summary.json.
No video is downloaded. Pages fetch only the summary, without episode names.
Ctrl+C stops new requests and saves successful observations before exit.`;
function parseArgs(args) {
  const result = { slugs: [], force: false, dryRun: false, help: false, limit: Infinity };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg === '--force') result.force = true;
    else if (arg === '--dry-run') result.dryRun = true;
    else if (arg === '--slug') { const slug = args[++i]; if (!identityOK(slug) || /^https?:/i.test(slug)) throw Error('--slug requires a valid catalog slug, not a URL.'); result.slugs.push(slug); }
    else if (arg === '--limit') { const value = args[++i]; if (!/^\d+$/.test(value || '') || Number(value) < 1 || Number(value) > 50000) throw Error('--limit must be an integer from 1 to 50000.'); result.limit = Number(value); }
    else throw Error('Unknown option: ' + arg + '. Use --help.');
  }
  result.slugs = [...new Set(result.slugs)]; return result;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function syncUnlocked(options = {}, deps = {}) {
  const catalogPath = deps.catalogPath || path.join(__dirname, 'data/movies.json');
  const outputPath = deps.outputPath || path.join(__dirname, 'data/episode-snapshots.json');
  const summaryPath = deps.summaryPath || path.join(path.dirname(outputPath), 'episode-summary.json');
  const request = deps.fetch || globalThis.fetch, now = deps.now || Date.now, log = deps.log || console.log;
  const wait = deps.sleep || sleep, timeoutMs = deps.timeoutMs || 12000;
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  if (!Array.isArray(catalog)) throw Error('Catalog must contain an array.');
  let state;
  try { const raw = JSON.parse(await fs.readFile(outputPath, 'utf8')); if (raw.version !== 1 || raw.kind === 'summary' || !raw.movies || typeof raw.movies !== 'object' || Array.isArray(raw.movies)) throw Error('Invalid episode snapshot format; repair or back up the existing file first.'); state = Published.normalize(raw); }
  catch (error) { if (error.code !== 'ENOENT') throw error; state = Published.empty(); }
  const selected = options.slugs || [], wanted = new Set(selected);
  for (const slug of wanted) if (!catalog.some(movie => movie.slug === slug)) throw Error('Catalog slug not found: ' + slug);
  const eligible = catalog.filter(movie => movie && identityOK(movie.slug) && slugOK(movie.apiSlug || movie.slug) && (!movie.source || ['kkphim', 'auto'].includes(movie.source)) && (!wanted.size || wanted.has(movie.slug)));
  if (wanted.size && eligible.length !== wanted.size) throw Error('One or more selected movies do not use a supported KKPhim source.');
  const queue = eligible.filter(movie => options.force || !state.movies[movie.slug] || state.movies[movie.slug].sourceSlug !== (movie.apiSlug || movie.slug) || now() - state.movies[movie.slug].checkedAt >= 6 * 60 * 60 * 1000).slice(0, options.limit || Infinity);
  const report = { selected: queue.length, checked: 0, succeeded: 0, failed: 0, changed: 0, stopped: !!deps.signalState?.stopped, failures: [] };
  const stopped = () => { if (deps.signalState?.stopped) report.stopped = true; return report.stopped; };
  let cursor = 0, writes = Promise.resolve(), dirty = false;
  async function persist() {
    if (options.dryRun || !dirty) return;
    dirty = false; state.generatedAt = new Date(now()).toISOString();
    const safe = Published.normalize(state);
    const files = [[outputPath, JSON.stringify(safe)], [summaryPath, JSON.stringify(Published.summarize(safe))]];
    writes = writes.then(async () => {
      for (const [target, serialized] of files) {
        const temporary = target + '.' + process.pid + '.tmp'; await fs.mkdir(path.dirname(target), { recursive: true });
        try { await fs.writeFile(temporary, serialized + '\n', 'utf8'); await fs.rename(temporary, target); }
        finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
      }
    });
    await writes;
  }
  const onInterrupt = () => { report.stopped = true; log('Stopping after active requests; saving successful checks...'); };
  if (deps.signals !== false) process.on('SIGINT', onInterrupt);
  async function fetchOne(sourceSlug) {
    const controller = new AbortController(); let timer;
    try {
      const payload = await Promise.race([
        Promise.resolve().then(() => request('https://phimapi.com/phim/' + encodeURIComponent(sourceSlug), { signal: controller.signal, credentials: 'omit', redirect: 'error' })).then(async response => { if (!response.ok) throw Error('HTTP ' + response.status); return response.json(); }),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('Source request timed out.')); }, timeoutMs); })
      ]);
      const result = Updates.snapshot(payload, sourceSlug);
      const totalText = String(payload.movie.episode_total || '').trim();
      if (/^\d+$/.test(totalText) && Number(totalText) > 0 && Number(totalText) <= 10000) result.total = Number(totalText);
      return result;
    } finally { clearTimeout(timer); }
  }
  log('Episode sync: ' + queue.length + ' movies' + (options.dryRun ? ' (dry run)' : '') + '.');
  try {
    await Promise.all([0, 1].map(async () => {
      while (cursor < queue.length && !stopped()) {
        const movie = queue[cursor++], sourceSlug = movie.apiSlug || movie.slug, before = state.movies[movie.slug]; let result, failure;
        for (let attempt = 0; attempt < 2; attempt++) {
          try { result = await fetchOne(sourceSlug); break; }
          catch (error) { failure = error; if (!attempt && !stopped()) await wait(800); else break; }
        }
        report.checked++;
        if (result) {
          const next = { ...result, available: result.names.length, checkedAt: now() };
          const previousIds = new Set(before?.sourceSlug === sourceSlug ? before.names.map(row => row.id) : []);
          if (before?.sourceSlug === sourceSlug && result.names.some(row => !previousIds.has(row.id))) report.changed++;
          state.movies[movie.slug] = next; dirty = true; report.succeeded++;
          log('OK ' + movie.slug + ': ' + next.available + ' available' + (next.current ? ' (' + next.current + ')' : ''));
        } else { report.failed++; report.failures.push({ slug: movie.slug, error: String(failure?.message || 'Source failed').slice(0, 200) }); log('KEEP ' + movie.slug + ': ' + report.failures.at(-1).error); }
        if (report.checked % 25 === 0) await persist();
        if (!stopped()) await wait(200);
      }
    }));
  } finally { if (deps.signals !== false) process.removeListener('SIGINT', onInterrupt); await persist(); await writes; }
  log('Done: ' + report.succeeded + ' successful, ' + report.failed + ' failed, ' + report.changed + ' with additions. Existing successes were retained on failure.');
  return { report, snapshot: Published.normalize(state), exitCode: report.stopped ? 130 : report.checked > 0 && report.succeeded === 0 ? 1 : 0 };
}
async function sync(options = {}, deps = {}) {
  // Atomic replacement protects readers; this exclusive lock also protects against
  // a second long-running terminal sweep replacing another process's successes.
  if (options.dryRun) return syncUnlocked(options, deps);
  const outputPath = deps.outputPath || path.join(__dirname, 'data/episode-snapshots.json');
  const lockPath = outputPath + '.lock', signalState = deps.signalState || { stopped: false };
  const onInterrupt = () => { signalState.stopped = true; };
  let handle;
  if (deps.signals !== false) process.on('SIGINT', onInterrupt);
  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    try { handle = await fs.open(lockPath, 'wx'); }
    catch (error) {
      if (error.code === 'EEXIST') throw Error('Another episode sync owns ' + lockPath + '. Wait for it to finish. If its process was forcibly terminated, verify it is no longer running before removing that lock file.');
      throw error;
    }
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + '\n');
    return await syncUnlocked(options, { ...deps, signalState });
  } finally {
    if (deps.signals !== false) process.removeListener('SIGINT', onInterrupt);
    if (handle) { await handle.close().catch(() => {}); await fs.rm(lockPath, { force: true }); }
  }
}
if (require.main === module) {
  Promise.resolve().then(async () => { const options = parseArgs(process.argv.slice(2)); if (options.help) { console.log(HELP); return; } const result = await sync(options); process.exitCode = result.exitCode; }).catch(error => { console.error('Episode sync failed: ' + error.message); process.exitCode = 1; });
}
module.exports = { parseArgs, sync, HELP };
