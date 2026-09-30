const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('index-app.js','utf8');
let row = {}, writes = 0;
const ctx = { entries: [{id:'rated',type:'OP'},{id:'chosen',type:'OP'}],
  CONFIRMED_LEGACY_MANUAL_TOP_KEYS: new Set(), manualUserSafeKey: n=>n.toLowerCase(),
  getManualRanksForUser: ()=>row, rememberManualRanksForUser(){writes++;},
  scoreFor: ()=>10, compareNatural:()=>0, manualExcludedSet:()=>new Set() };
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('    function ratedIdsForManual('),source.indexOf('    function manualPositionFor(')),ctx);
assert.deepEqual(Array.from(ctx.ensureManualOrderForEditing('Alice','OP')),[]);
assert.equal(writes,0,'opening an empty editor creates no draft or top');
row={OP:['rated']};
assert.deepEqual(Array.from(ctx.savedManualOrderFor('Alice','OP')),[],'unconfirmed automatic legacy rows are hidden');
row={manualCreated:true,OP:['chosen']};
assert.deepEqual(Array.from(ctx.ensureManualOrderForEditing('Alice','OP')),['chosen'],'confirmed top is preserved without adding rated songs');
assert.equal(writes,0);
assert.ok(!source.includes('appendManualOrderIfMissing('),'rating paths cannot append to a top');

(async()=>{
  let payload;
  const store={};
  const saveCtx={myName:'Alice',manualRanks:{},CONFIRMED_LEGACY_MANUAL_TOP_KEYS:new Set(),manualUserSafeKey:n=>n.toLowerCase(),
    getManualRanksForUser:()=>store.row,rememberManualRanksForUser:(_,r)=>{store.row=r;},sanitizeTopPins:()=>[],
    window:{storage:{set:async()=>{}},OPED_DB:{saveManualRanks:async(_,r)=>{payload=r;}}},
    requirePersonalUid:()=> 'uid',getExtendedDb:async()=>{throw Error('mirror unavailable in test');},console:{error(){}},setStatus(){} };
  vm.createContext(saveCtx);
  vm.runInContext(source.slice(source.indexOf('    async function saveManualRanks('),source.indexOf('    async function syncMyAvatarIntoMap(')),saveCtx);
  store.row={OP:['rated'],candidatesOP:['chosen']};
  await saveCtx.saveManualRanks();
  assert.equal(payload.manualCreated,false,'candidate-only save must not create top');
  assert.deepEqual(Array.from(payload.OP),[],'old automatic local order cannot leak into a metadata save');
  assert.deepEqual(Array.from(payload.candidatesOP),['chosen']);
  store.row={manualCreated:true,OP:['chosen']};
  await saveCtx.saveManualRanks(true);
  assert.equal(payload.manualCreated,true);
  assert.deepEqual(Array.from(payload.OP),['chosen']);
  console.log('PASS: ratings never add to tops; opening editor stays empty; explicit order survives; candidates do not create a top');
})().catch(error=>{console.error(error);process.exitCode=1;});
