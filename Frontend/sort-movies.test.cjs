const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const readMovies = source => JSON.parse(JSON.stringify(vm.runInNewContext(
  source + '\n;fallbackMoviesList',
)));

test('sort preserves nested movie data and is stable on a second run', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sort-movies-'));
  const file = path.join(dir, 'catalog.js');
  try {
    const sources = [
      `const fallbackMoviesList = [
        // Ignore braces in comments: }
        { title: "Z } \\\" {", slug: "z", providerSlugs: {
          kkphim: "z", nested: { values: ["}", "{"] }
        }, desc: 'https://example.com/{', genres: "Mỹ" },
        /* { */ { title: "A", slug: "a", genres: "Mỹ" },
      ];`,
      fs.readFileSync(path.join(__dirname, '../Backend/catalog-source.js'), 'utf8'),
    ];
    for (const source of sources) {
      fs.writeFileSync(file, source);
      const before = readMovies(source).map(JSON.stringify).sort();
      execFileSync(process.execPath, [path.join(__dirname, 'sort-movies.js'), file]);
      const sorted = fs.readFileSync(file, 'utf8');
      assert.deepEqual(readMovies(sorted).map(JSON.stringify).sort(), before);
      execFileSync(process.execPath, [path.join(__dirname, 'sort-movies.js'), file]);
      assert.equal(fs.readFileSync(file, 'utf8'), sorted);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
