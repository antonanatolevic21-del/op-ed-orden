const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('rating-workbench.js', 'utf8');
const data = { coverageCatalogRequested: false, coverageCatalogReady: true };
const ctx = {
  snapshot: () => data, bridge: () => ({ userScore: id => id === 'rated' ? 8 : null }),
  queueMap: new Map(), coverageLoading: false, coverageError: '', esc: String,
  SEASONS: ['winter', 'spring', 'summer', 'fall'],
  SEASON_LABELS: { winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень' }
};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('  function coverageMarkup('), source.indexOf('  function rateLaterMarkup(')), ctx);
const entries = ['rated', 'unrated'].map(id => ({ id, year: 2026, season: 'fall', type: 'OP' }));
let markup = ctx.coverageMarkup(entries, 'Alice', true);
assert.match(markup, /data-coverage-load/);
assert.doesNotMatch(markup, /data-coverage-key/);
assert.equal(ctx.queueMap.size, 0, 'even an existing full catalogue must not open the map automatically');
data.coverageCatalogRequested = true;
data.coverageCatalogReady = false;
ctx.coverageLoading = true;
markup = ctx.coverageMarkup(entries.slice(0, 1), 'Alice', true);
assert.match(markup, /Загрузка карты/);
assert.doesNotMatch(markup, /data-coverage-key/, 'partial counts are hidden during loading');
data.coverageCatalogReady = true;
ctx.coverageLoading = false;
markup = ctx.coverageMarkup(entries, 'Alice', true);
assert.match(markup, /<span>1\/2<\/span>/);
assert.deepEqual(Array.from(ctx.queueMap.get('2026|fall|OP')), ['unrated']);
assert.equal(ctx.coverageMarkup(entries, 'Bob', false), '', 'foreign profiles have no coverage map');
data.coverageCatalogReady = false;
ctx.coverageError = 'Ошибка загрузки';
assert.match(ctx.coverageMarkup(entries, 'Alice', true), /role="alert"/);
console.log('PASS: explicit coverage button, loading state, full denominator, unrated queue and retry message');
