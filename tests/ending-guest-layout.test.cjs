const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('events-app.js', 'utf8');
const bootstrap = fs.readFileSync('events-bootstrap.js', 'utf8');
function extract(source, name) {
  const start = source.indexOf('    function ' + name + '(');
  if (start < 0) throw Error('Missing ' + name);
  const tail = source.slice(start + 1);
  const next = tail.search(/\n    (?:async )?function /);
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
}
const profile = { nickname: 'Alice', nicknameKey: 'alice' };
const period = (key, extra = {}) => ({ key: 'ending_2026_' + key, period: key, eventKind: 'ending-year', year: 2026, allowedNicknames: ['Alice'], selectedOpeningIds: ['ed1','ed2'], ...extra });
let periods = { h1: period('h1'), h2: period('h2') };
const ctx = {
  guestSlot: 1, myName: 'Alice', activeMode: 'endingrating', CURRENT_EVENT_YEAR: 2026,
  isGuest: () => true, isAdminGuestPreview: () => false, registeredSeasonProfile: () => null,
  currentActorUid: () => 'alice-uid', normalizeNickname: x => String(x || '').trim().toLowerCase(),
  endingPeriodState: p => periods[p], endingManualPeriod: s => s.period === 'h1',
  endingPeriodKey: p => 'ending_2026_' + p,
  updateAccessUi() {}, appEl: { innerHTML: '' }, escapeHtml: x => String(x || ''),
  SEASON_LABEL: { fall: 'Осень' }, ENDING_PERIOD_META: { h2: { label: 'II полугодие' } },
  renderOpeningRow: (s,id) => '<article data-rate-id="' + id + '">трек</article>',
  findGuestSeasonStates: () => [{ key: '2026_fall', season: 'fall', year: 2026, selectedOpeningIds: ['op'], allowedNicknames: ['Alice'] }],
  bindGuestEvents() {}
};
const names = ['getGuestNicknameForSeason', 'isAllowedForSeason', 'findGuestEndingStates', 'renderGuestSeasonContent', 'renderGuestStage'];
const api = new Function('ctx', 'with(ctx){' + names.map(n => extract(source,n)).join('\n') + '; return {' + names.join(',') + '};}')(ctx);
Object.assign(ctx, api);
assert.equal(api.findGuestEndingStates().length, 1);
api.renderGuestStage();
assert.ok(ctx.appEl.innerHTML.includes('II полугодие'));
assert.ok(ctx.appEl.innerHTML.includes('2 ED · комментарий обязателен'));
assert.ok(ctx.appEl.innerHTML.includes('data-guest-rate-all="ending_2026_h2"'));
assert.ok(!ctx.appEl.innerHTML.includes('ev-ending-slot'));
periods.h2.closed = true;
assert.equal(api.findGuestEndingStates().length, 0);
api.renderGuestStage(); assert.ok(ctx.appEl.innerHTML.includes('Нет доступных полугодий'));
periods.h2 = period('h2', { allowedNicknames: ['Bob', 'Alice'] });
assert.equal(api.findGuestEndingStates().length, 0, 'slot mismatch');
ctx.registeredSeasonProfile = () => profile; ctx.guestSlot = 0;
assert.equal(api.findGuestEndingStates().length, 1, 'registered profile matches any roster slot');
periods.h2.participantBindings = [{ nicknameKey: 'alice', authUid: 'other-uid' }];
assert.equal(api.findGuestEndingStates().length, 0, 'bound UID mismatch');
ctx.activeMode = 'rating'; api.renderGuestStage();
assert.ok(ctx.appEl.innerHTML.includes('Осень 2026'));
assert.ok(ctx.appEl.innerHTML.includes('1 OP · комментарий обязателен'));
const start = bootstrap.indexOf('function participantMatch(');
const end = bootstrap.indexOf('async function matchingSeasons', start);
const boot = { CURRENT_EVENT_YEAR: 2026, requestedMode: () => 'endingrating', normalizeNickname: ctx.normalizeNickname, bindingRows: row => row.participantBindings || [] };
const match = new Function('ctx', 'with(ctx){' + bootstrap.slice(start,end) + ';return participantMatch;}')(boot);
assert.ok(match({ id: 'ending_2026_h2', ...period('h2') }, { ...profile, authUid: 'alice-uid' }));
assert.equal(match({ id: 'ending_2026_h1', ...period('h1') }, profile), null);
assert.ok(match({ id: '2026_fall', year: 2026, allowedNicknames: ['Alice'] }, profile));
const access = new Function('ctx', 'with(ctx){' + extract(source,'canAccessMode') + '; return canAccessMode;}')({ registeredSeasonProfile: () => profile });
assert.equal(access('rating'), true);
assert.equal(access('endingrating'), true);
assert.equal(access('guess'), false);
const calls = [];
const allButton = { dataset: { guestRateAll: 'ending_2026_h2' }, addEventListener: (type, cb) => { allButton.click = cb; } };
const oneButton = { dataset: { rateId: 'ed2' }, closest: () => ({ dataset: { guestKey: 'ending_2026_h2' } }), addEventListener: (type, cb) => { oneButton.click = cb; } };
const bindings = { document: { querySelectorAll: selector => selector === '[data-guest-rate-all]' ? [allButton] : [oneButton] }, openEvaluator: (state, ids, index) => calls.push([state.key,index]) };
const bind = new Function('ctx', 'with(ctx){' + extract(source,'bindGuestEvents') + '; return bindGuestEvents;}')(bindings);
bind([period('h2')]); allButton.click(); oneButton.click();
assert.equal(JSON.stringify(calls), JSON.stringify([['ending_2026_h2',0],['ending_2026_h2',1]]));
console.log('PASS: matching guest OP/ED layout, closed/manual/uninvited periods excluded, slot/account/UID access preserved, ED account bootstrap');
