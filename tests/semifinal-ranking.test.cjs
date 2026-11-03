const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('events-app.js', 'utf8');
const names = ['sumForOpeningInSeason', 'compareSemifinalCandidates', 'getSeasonWinnerPlan', 'getDirectSemifinalIdsForState', 'getSemifinalWildcardPlan'];
const code = names.map(name => {
  const start = source.indexOf(`    function ${name}(`);
  const end = source.indexOf('\n    function ', start + 1);
  return source.slice(start, end);
}).join('\n');
function setup(scores, winnerCount = 1, complete = true) {
  const state = { key: 'winter', season: 'winter', selectedOpeningIds: Object.keys(scores), semifinalOpeningIds: ['a'], semifinalTieWinnerIds: ['a'] };
  const ratings = Object.entries(scores).flatMap(([openingId, values]) => values.map(score => ({ openingId, score })));
  const context = {
    openingsById: new Map(Object.keys(scores).map(id => [id, { title: id === 'a' ? 'Альфа' : id === 'b' ? 'Яркий' : id }])),
    getSeasonRatings: () => ratings,
    compareNatural: (a, b) => String(a).localeCompare(String(b), 'ru', { numeric: true }),
    fullRatingProgress: () => ({ complete }),
    getWinnerCountForSeason: () => winnerCount,
    getSemifinalMeta: () => ({ wildcardExcludedIds: ['b'], wildcardOpeningIds: ['a'] }),
    getAllWildcardStates: () => [state],
    isSeasonConfirmedForWildcard: () => true,
    isSeasonFullyRated: () => complete,
    getPotentialWildcardDisplayLimit: () => 2,
    getWildcardSlotCountForSeason: () => 0,
    BASE_WILDCARD_SLOT_COUNT: 2
  };
  vm.createContext(context); vm.runInContext(code, context);
  return { context, state, plan: () => context.getSeasonWinnerPlan(state) };
}
test('sum is primary, then 10s, then 9s, then alphabet; saved tie choices do not override', () => {
  for (const [scores, expected] of [
    [{ a: [9,9], b: [10,7] }, 'a'],
    [{ a: [9,9], b: [10,8] }, 'b'],
    [{ a: [10,8,8], b: [10,9,7] }, 'b'],
    [{ a: [10,9,7], b: [7,10,9] }, 'a']
  ]) {
    const { context, state, plan } = setup(scores);
    assert.equal(plan().finalIds.join(','), expected);
    assert.equal(plan().ready, true);
    assert.equal(plan().needManual, 0);
    assert.equal(context.getDirectSemifinalIdsForState(state).join(','), expected);
  }
});
test('each lower rating is considered before alphabet', () => {
  for (let score = 8; score >= 3; score--) {
    const { plan } = setup({ a: [score-1, score-1], b: [score, score-2] });
    assert.equal(plan().finalIds.join(','), 'b');
  }
});
test('wildcard boundary uses the histogram and ignores old exclusions', () => {
  const { context } = setup({ z: [10,10], c: [10,9], a: [9,9], b: [10,8] });
  const plan = context.getSemifinalWildcardPlan();
  assert.equal(plan.finalIds.join(','), 'c,b');
  assert.equal(plan.ready, true);
  assert.equal(plan.overflow, 0);
  assert.equal(plan.visibleRows.length, 2);
});
test('incomplete and empty seasons do not produce automatic winners', () => {
  const { context, state, plan } = setup({ a: [9], b: [10] }, 1, false);
  assert.equal(plan().ready, false);
  assert.equal(context.getDirectSemifinalIdsForState(state).join(','), 'a');
  assert.equal(context.getSemifinalWildcardPlan().finalIds.length, 0);
  assert.equal(setup({}).plan().ready, false);
});
