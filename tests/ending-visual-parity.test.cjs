const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('events-app.js', 'utf8');
function extract(name) {
  const start = source.indexOf('    function ' + name + '(');
  assert.ok(start >= 0, name);
  const next = source.slice(start + 1).search(/\n    (?:async )?function /);
  return source.slice(start, start + 1 + next);
}
const track = { id:'ed1', title:'Тестовый эндинг', type:'ED', year:2026, season:'fall', performers:['Исполнитель'], image:'', link:'https://example.com/video' };
const state = { key:'ending_2026_h2', year:2026, period:'h2', eventKind:'ending-year', allowedNicknames:['Egortos','Кофа','Alice'], selectedOpeningIds:['ed1','ed2'], semifinalOpeningIds:['ed1'] };
const ratings = [{openingId:'ed1',nicknameKey:'alice',score:10},{openingId:'ed2',nicknameKey:'alice',score:9}];
const ctx = {
  console, activeStage:'first', CURRENT_EVENT_YEAR:2026,
  FIXED_PARTICIPANTS:['Egortos','Кофа','Toxexex'], ENDING_FIXED_PARTICIPANTS:['Egortos','Кофа'],
  SEASON_LABEL:{fall:'Осень'}, ENDING_PERIOD_META:{h1:{label:'I полугодие'},h2:{label:'II полугодие'}},
  openingsById:new Map([['ed1',track],['ed2',{...track,id:'ed2',title:'Второй эндинг'}]]),
  getSeasonRatings:()=>ratings, currentActorUid:()=> 'u1', normalizeNickname:s=>String(s||'').trim().toLowerCase(),
  escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  isAdmin:()=>true, isGuest:()=>false, isAllowedForSeason:()=>false, getMyEventRating:()=>null,
  avgForOpeningInSeason:()=>null, getOpeningTitle:o=>o.title, endingActor:()=>null,
  endingManualPeriod:s=>s.period==='h1', endingScoreFor:()=>({score:127}),
  endingRankedRows:()=>[{id:'ed1',opening:track,total:127,votes:15}], endingTotalFor:()=>127,
  endingPeriodState:p=>({...state,period:p}), ratingProgress:()=>({done:2,total:6}),
  basketAllIds:s=>Object.values(s.buckets).flat()
};
vm.createContext(ctx);
const names=['cleanParticipantSlots','getParticipantRatingProgress','renderParticipants','renderEndingParticipants','renderEventTrackIdentity','renderOpeningRow','renderEndingManualScores','renderEndingParticipantScores','endingTrackLabel','renderEndingRankTable','renderEndingFirst','renderEndingSemi','renderEndingFinal','renderBasketCard','renderBasketColumn','endingPeriodSwitchMarkup'];
vm.runInContext(names.map(extract).join('\n'),ctx);
const participants = ctx.renderEndingParticipants(state);
assert.equal((participants.match(/class="ev-participant-slot"/g)||[]).length,15);
assert.equal((participants.match(/class="ev-participant-input fixed"/g)||[]).length,2);
assert.ok(!participants.includes('Toxexex'));
assert.ok(participants.includes('data-ending-slot="2" value="Alice"'));
assert.ok(participants.includes('data-participant-review="2"'));
assert.equal(ctx.getParticipantRatingProgress(state)[2].complete,true);
assert.equal(ctx.renderEndingParticipants({...state,period:'h1'}),'');
assert.equal((ctx.renderParticipants({...state,eventKind:undefined}).match(/class="ev-participant-input fixed"/g)||[]).length,3);
const row = ctx.renderOpeningRow(state,'ed1',0);
const manual = ctx.renderEndingManualScores({...state,period:'h1'});
for(const cls of ['oc-season-op','oc-season-thumb','oc-name','oc-meta']) {
  assert.ok(row.includes(cls)); assert.ok(manual.includes(cls));
}
assert.ok(manual.includes('data-ending-save-manual="ed1"'));
assert.ok(manual.includes('value="127"'));
const basket = {eventKind:'ending-year',buckets:{unassigned:['ed1'],guaranteed:[],variable:[]}};
const basketMarkup = ctx.renderBasketColumn(basket,'unassigned','Нераспределённая');
assert.ok(basketMarkup.includes('data-ending-basket-move="guaranteed"'));
assert.ok(!basketMarkup.includes(' data-basket-move='));
assert.ok(ctx.renderBasketColumn({...basket,eventKind:undefined},'unassigned','Корзина').includes('data-basket-move="guaranteed"'));
const semi = ctx.renderEndingSemi(state), final = ctx.renderEndingFinal(state);
assert.ok(semi.includes('ev-winner-row chosen'));
assert.ok(semi.includes('data-ending-semifinal-id="ed1" checked'));
assert.ok(final.includes('ev-winner-row auto'));
assert.ok(final.includes('127 б.'));
const sidebar=ctx.endingPeriodSwitchMarkup(state);
assert.ok(sidebar.includes('2 ED · 2/6'));
assert.ok(sidebar.includes('data-ending-period="h2"'));
if(process.env.VISUAL_FIXTURE) {
  const css=['events.css','events-shell.css','events-admin-participants.css'].map(p=>fs.readFileSync(p,'utf8')).join('\n');
  fs.writeFileSync(process.env.VISUAL_FIXTURE,`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ED · проверка оформления</title><style>${css}</style><main class="ev-root"><section class="ev-panel-head"><div><div class="ev-section-label">Первый этап</div><h2>2026 · отбор эндингов по полугодиям</h2></div></section><section class="ev-content">${ctx.renderEndingFirst(state)}</section><section class="ev-content"><h2>Ручной ввод итогов</h2>${manual}</section><section class="ev-content">${semi}</section><section class="ev-content">${final}</section><section class="ev-content">${basketMarkup}</section></main>`);
}
const participantTools = fs.readFileSync('events-admin-participants.js', 'utf8');
const infoStart = participantTools.indexOf('function activeSeasonInfo(');
const infoEnd = participantTools.indexOf('function progressText(', infoStart);
let endingButton = { dataset: { endingPeriod: 'h2' } };
const toolCtx = { CURRENT_EVENT_YEAR: 2026, SEASON_LABEL: { fall: 'Осень' }, document: { querySelector: selector => selector.includes('data-ending-period') ? endingButton : { dataset: { season: 'fall' } } } };
vm.createContext(toolCtx); vm.runInContext(participantTools.slice(infoStart,infoEnd),toolCtx);
assert.equal(toolCtx.activeSeasonInfo().key,'ending_2026_h2');
assert.equal(toolCtx.activeSeasonInfo().type,'ED');
endingButton = null;
assert.equal(toolCtx.activeSeasonInfo().key,'2026_fall');
console.log('PASS: shared OP/ED participant cards, two fixed ED slots, progress, track identity, manual scores, basket handlers, finalist selection, sidebar and final totals');
