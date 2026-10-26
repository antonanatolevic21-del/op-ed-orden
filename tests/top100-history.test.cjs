const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'firebase-app.js'), 'utf8');
const start = source.indexOf('    async function saveManualRanks(');
const end = source.indexOf('    function watchUserProfiles(', start);
let documents = {}, clock = 100, fail = false, retries = 0;
const context = vm.createContext({
  db: {}, normalizeNickname: value => value.toLowerCase(), requirePersonalUid: () => 'owner',
  doc: (_, collection, id) => `${collection}/${id}`,
  serverTimestamp: () => ({ timestamp: ++clock }),
});
context.runTransaction = async (_, callback) => {
  const run = async () => {
    const pending = [];
    await callback({
      get: async key => ({ exists: () => Boolean(documents[key]), data: () => documents[key] }),
      set: (key, value) => pending.push([key, value])
    });
    return pending;
  };
  if (retries) { retries--; await run(); }
  const pending = await run();
  if (fail) throw new Error('write failed');
  for (const [key, value] of pending) {
    for (const field of ['updatedAt', 'topUpdatedAt']) {
      if (value[field]?.timestamp) { const time = value[field].timestamp; value[field] = { toMillis: () => time }; }
    }
    documents[key] = { ...documents[key], ...value };
  }
};
vm.runInContext(source.slice(start, end) + '\nthis.save = saveManualRanks;', context);
const top = () => documents['manualRanks/tester'];
const order = OP => ({ OP, ED: ['ed'] });
const save = ranks => context.save('Tester', ranks);
const plain = value => JSON.parse(JSON.stringify(value));
(async () => {
  await save(order(['a','b'])); assert.equal(top().history.length, 0);
  const firstTime = top().topUpdatedAt.toMillis();
  await save(order(['a','b'])); assert.equal(top().history.length, 0); assert.equal(top().topUpdatedAt.toMillis(), firstTime);
  await save({ ...order(['stale']), metadataOnly: true, candidatesOP: ['candidate'], manualCreated: false });
  assert.deepEqual(plain(top().OP), ['a','b']); assert.equal(top().manualCreated, true);
  assert.equal(top().topUpdatedAt.toMillis(), firstTime); assert.equal(top().history.length, 0);
  await save(order(['b','a'])); assert.deepEqual(plain(top().history[0]), {OP:['a','b'],ED:['ed'],savedAtLocal:firstTime});
  await save(order(['a','b'])); await save(order(['b','a']));
  assert.deepEqual(plain(top().history.map(row => row.OP)), [['a','b'],['b','a'],['a','b']]);
  await assert.rejects(save({...order(['bad']), expectedOrder: order(['stale'])}), /другой вкладке/);
  assert.deepEqual(plain(top().OP), ['b','a']);
  const before = top(); fail = true; await assert.rejects(save(order(['failed'])), /write failed/); fail = false;
  assert.equal(top(), before); assert.deepEqual(plain(documents['userProfiles/tester'].OP), ['b','a']);
  retries = 1; await save(order(['retry'])); assert.equal(top().history.length, 4);
  await save({OP:[],ED:[],manualCreated:false}); assert.equal(top().history[0].OP[0], 'retry');
  await save(order(['restored'])); assert.deepEqual(plain(top().history[0].OP), []);
  for(let i=0;i<35;i++) await save(order([String(i)]));
  assert.equal(top().history.length,30); assert.equal(top().history[0].OP[0],'33');
  documents = {};
  await save({ ...order(['stale']), metadataOnly: true, candidatesOP:['c'] });
  assert.deepEqual(plain(top().OP),[]); assert.equal(top().manualCreated,false); assert.equal(top().history,undefined);
  console.log('Passed: real versions, stable dates, stale metadata, repeated saves, return to earlier order, conflict, rollback, retry, empty top and 30-version limit.');
})().catch(error => { console.error(error); process.exitCode = 1; });
