const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('index-app.js', 'utf8');
const ctx = vm.createContext({
  ratingMin: () => 1, ratingMax: () => 10, scaleStep: () => 0.1,
  clampScore: x => Math.max(1, Math.min(10, x)), formatScore: x => String(Number(x.toFixed(2))),
  Event: class { constructor(type) { this.type = type; } }
});
vm.runInContext(source.slice(source.indexOf('    function normalizeConditionalModifiers('), source.indexOf('    function detailedRatingSettings(')), ctx);
vm.runInContext(source.slice(source.indexOf('    function bindDetailedRatingSuggestion('), source.indexOf('    function readDetailedRating(')), ctx);
const rules = [
  { criterionId: 'visual', from: 10, to: 10, min: 0, max: 0 },
  { criterionId: 'visual', from: 7, to: 9, min: -1, max: 1 }
];
const evaluate = (score, visual, maximum = 10) => ctx.conditionalRatingModifier(rules, score, { visual }, maximum);
for (const song of [0, 5, 10]) assert.equal(evaluate(song, 10).value, 0);
for (const visual of [7, 8, 9]) {
  assert.equal(evaluate(0, visual).value, -1);
  assert.equal(evaluate(5, visual).value, 0);
  assert.equal(evaluate(10, visual).value, 1);
}
assert.ok(Math.abs(evaluate(7.5, 8.2).value - 0.5) < 1e-10);
assert.equal(evaluate(20, 8, 100).value, -0.6);
for (const visual of [null, undefined, 6.9, 9.1]) assert.equal(evaluate(10, visual).matched, false);
assert.equal(ctx.conditionalRatingModifier([{ ...rules[1], criterionId: 'custom' }], 10, { custom: 8 }, 10).value, 1);
assert.equal(ctx.conditionalRatingModifier([{ ...rules[1], min: -2, max: -2 }, rules[1]], 10, { visual: 8 }, 10).value, -2);
assert.equal(ctx.normalizeConditionalModifiers([{ ...rules[1], from: '' }, { ...rules[1], to: 6 }, { ...rules[1], min: 2, max: 1 }]).length, 0);
assert.equal(ctx.normalizeRatingFields([{ id: 'custom', label: 'Test', mode: 'modifier', conditionalModifiers: rules }])[0].conditionalModifiers.length, 2);
assert.equal(ctx.ratingModifierForScore('1-3: -1; 9-10: +1', 10).value, 1);
assert.equal(ctx.ratingModifierForScore('<=3: -2; *: 0', 2).value, -2);

const input = (id, value, dataset) => ({ value, dataset: { ratingCriterionId: id, ...dataset }, listeners: {},
  hasAttribute: key => key === 'data-rating-modifier-rules' && 'ratingModifierRules' in dataset,
  addEventListener(type, fn) { this.listeners[type] = fn; }, dispatchEvent(event) { this.listeners[event.type]?.(); }
});
const song = input('song', '10', { ratingModifierRules: '', ratingConditionalModifiers: JSON.stringify(rules) });
const visual = input('visual', '8', { ratingWeight: '100' });
const text = {}, apply = { addEventListener(type, fn) { this.click = fn; } }, total = { dispatchEvent() {} };
const box = { querySelector: selector => selector.includes('value') ? text : apply };
const root = {
  querySelector: selector => selector.includes('suggestion') ? box : total,
  querySelectorAll: selector => selector === '[data-rating-weight]' ? [visual] : selector === '[data-rating-modifier-rules]' ? [song] : [song, visual]
};
ctx.bindDetailedRatingSuggestion(root, 'test');
apply.click(); assert.equal(total.value, '9');
visual.value = '10'; visual.listeners.input(); apply.click(); assert.equal(total.value, '10');
visual.value = '7'; song.value = '0'; song.listeners.input(); apply.click(); assert.equal(total.value, '6');
song.value = ''; song.listeners.input(); apply.click(); assert.equal(total.value, '7');
visual.value = ''; visual.listeners.input(); assert.equal(apply.disabled, true);
visual.value = '6'; song.value = '10'; song.dataset.ratingModifierRules = '9-10: +1'; song.listeners.input(); apply.click(); assert.equal(total.value, '7');
console.log('PASS: conditional ranges, interpolation, custom criteria, missing inputs, first matching rule, legacy fallback, live suggestion and apply.');
