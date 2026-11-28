const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('index-app.js', 'utf8');
const method = source.slice(source.indexOf('      async addTenRatedCandidates('), source.indexOf('      async addTopCandidates(type)'));
let row = { candidatesOP: ['existing'], candidatesED: ['ending'], OP: ['ranked'], pinsOP: [{ id: 'ranked', rank: 1 }] };
let saves = 0, fail = false, localRestores = 0, sync = () => {};
const ctx = {
  myName: 'Alice', currentPersonalUid: () => 'uid', activeTab: 'profile', profileUserSelect: { value: 'Alice' }, profileUser: 'Alice',
  manualSameUser: (a,b) => a.toLowerCase() === b.toLowerCase(),
  syncRouteDataSubscriptions: async () => sync(),
  remoteDataState: { ratings: { ready: true }, openings: { ready: true }, manualRanks: { ready: true } },
  getManualRanksForUser: () => row, rememberManualRanksForUser: (owner,next) => { row = next; },
  saveManualRanks: async () => { saves++; if (fail) throw Error('offline'); },
  publishAppData() {}, scoreFor: (entry, name) => entry.scores?.[name] ?? null,
  window: { OC_APP_BRIDGE: {}, storage: { set: async () => { localRestores++; } } },
  MANUAL_RANKS_KEY: 'manual', manualRanks: {},
  entries: [
    { id: 'existing', type: 'OP', scores: { Alice: 10 } },
    { id: 'new', type: 'OP', scores: { Alice: 10 } },
    { id: 'new', type: 'OP', scores: { Alice: 10 } },
    { id: 'ending10', type: 'ED', scores: { Alice: 10 } },
    { id: 'half', type: 'OP', scores: { Alice: 9.5 } },
    { id: 'other', type: 'OP', scores: { Bob: 10 } }
  ]
};
vm.createContext(ctx);
vm.runInContext(`api = ({${method}})`, ctx);
(async () => {
  assert.equal((await ctx.api.addTenRatedCandidates()).added, 1);
  assert.deepEqual(Array.from(row.candidatesOP), ['existing', 'new']);
  assert.deepEqual(row.candidatesED, ['ending']);
  assert.deepEqual(row.OP, ['ranked']);
  assert.deepEqual(row.pinsOP, [{ id: 'ranked', rank: 1 }]);
  assert.equal(saves, 1, 'batch uses one write');
  assert.equal((await ctx.api.addTenRatedCandidates()).added, 0);
  assert.equal(saves, 1, 'repeat click does not save or remove candidates');
  row = { ...row, candidatesOP: ['existing'] }; fail = true;
  await assert.rejects(ctx.api.addTenRatedCandidates(), /offline/);
  assert.deepEqual(row.candidatesOP, ['existing']);
  assert.equal(localRestores, 1, 'failed write restores local state');
  fail = false;
  row = { ...row, candidatesOP: Array.from({ length: 150 }, (_,i) => `old${i}`) };
  const before = saves;
  assert.equal((await ctx.api.addTenRatedCandidates()).added, 2);
  assert.equal(saves, before + 1); assert.equal(row.candidatesOP.length, 152);
  const opBefore = Array.from(row.candidatesOP);
  ctx.entries.push(...Array.from({ length: 200 }, (_,i) => ({ id: `ed${i}`, type: 'ED', scores: { Alice: 10 } })));
  assert.equal((await ctx.api.addTenRatedCandidates('ED')).added, 201);
  assert.equal(row.candidatesED.length, 202);
  assert.deepEqual(Array.from(row.candidatesOP), opBefore);
  assert.equal((await ctx.api.addTenRatedCandidates('ED')).added, 0);
  assert.equal(new Set(row.candidatesED).size, row.candidatesED.length);
  ctx.remoteDataState.ratings.ready = false;
  await assert.rejects(ctx.api.addTenRatedCandidates(), /загрузить все оценки/);
  ctx.remoteDataState.ratings.ready = true;
  ctx.profileUserSelect.value = 'Bob';
  await assert.rejects(ctx.api.addTenRatedCandidates(), /свой профиль/);
  ctx.profileUserSelect.value = 'Alice';
  sync = () => { ctx.myName = 'Bob'; };
  await assert.rejects(ctx.api.addTenRatedCandidates(), /Аккаунт изменился/);
  ctx.myName = '';
  await assert.rejects(ctx.api.addTenRatedCandidates(), /личный аккаунт/);
  console.log('PASS: own OP tens only, deduplication, one save, repeat clicks, unlimited OP/ED, rollback, loading and account guards');
})().catch(error => { console.error(error); process.exitCode = 1; });
