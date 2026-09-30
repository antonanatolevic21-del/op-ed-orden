const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const events = readFileSync('events-app.js', 'utf8');
const subscriptions = [];
const sandbox = {
  window:{addEventListener(){}}, console:{error(){}}, db:{}, documentId:()=> '__name__',
  collection:(_, name)=>({name}), where:(field,op,value)=>({field,op,value}),
  query:(target,...constraints)=>({...target,constraints}),
  onSnapshot(target,success,error){const sub={target,success,error,stopped:false};subscriptions.push(sub);return ()=>{sub.stopped=true;};},
  INITIAL_EVENT_ROOM_INVITE:null, LOCAL_EVENTS_MODE:false, CURRENT_EVENT_YEAR:2026,
  SEMIFINAL_META_KEY:'2026_semifinal_meta', SEASONS:['winter','spring','summer','fall'],
  seasonKey:s=>`2026_${s}`, endingPeriodKey:s=>`ending_2026_${s}`,
  activeMode:'rating',activeStage:'first',seasonDocs:new Map(),
  isGuest:()=>!sandbox.admin,isAdmin:()=>!!sandbox.admin,
  getGuestNicknameForSeason:row=>!row.closed && row.allowedNicknames?.includes('Alice')?'Alice':'',
  applyOpeningRows:rows=>{sandbox.loaded=rows;},scheduleFirebaseRender(){},scheduleRender(){},
  eventRoomSubscriptions:{}, maybeShowCompletionNotice(){},
};
vm.createContext(sandbox);
vm.runInContext(events.slice(events.indexOf('    let eventDataReady = false;'),events.indexOf('    function startEventModeData(')),sandbox);
// Heavy games are mocked at their boundary; the original route planner remains under test.
vm.runInContext("function startEventModeData(key,current) { return onSnapshot({name:key},current(()=>{}),current.fail(()=>{})); } eventDataReady = true; syncEventData();",sandbox);
const emit=(sub,rows)=>sub.success({docs:rows.map(row=>({id:row.id,data:()=>row}))});
const active=name=>subscriptions.filter(s=>!s.stopped&&s.target.name===name);
assert.deepEqual(active('openings'),[], 'no whole catalog while seasons are loading');
assert.deepEqual(subscriptions.map(s=>s.target.name),['eventSeasons']);
const ids=Array.from({length:35},(_,i)=>'song'+i);
emit(active('eventSeasons')[0],[{id:'2026_summer',allowedNicknames:['Alice'],selectedOpeningIds:ids},{id:'2026_fall',allowedNicknames:['Bob'],selectedOpeningIds:['foreign']}]);
assert.equal(active('openings').length,2,'ID requests split into batches of at most 30');
for(const sub of active('openings')) assert.ok(sub.target.constraints[0].value.length<=30);
assert.equal(active('ratings').length,0);assert.equal(active('profiles').length,0);
assert.deepEqual(Array.from(active('eventRatings')[0].target.constraints[0].value),['2026_summer']);
emit(active('openings')[0],ids.slice(0,30).map(id=>({id})));
assert.equal(vm.runInContext("eventDataSubscriptions.get('catalog').ready",sandbox),false,'partial batches cannot enable rating');
emit(active('openings')[1],ids.slice(30).map(id=>({id})));
assert.equal(sandbox.loaded.length,35);
assert.equal(vm.runInContext("eventDataSubscriptions.get('catalog').ready",sandbox),true);
const old=active('openings')[0];
emit(active('eventSeasons')[0],[{id:'2026_summer',allowedNicknames:['Alice'],selectedOpeningIds:['new-song']}]);
assert.ok(old.stopped);emit(old,[{id:'late-old-song'}]);assert.equal(sandbox.loaded.length,35,'late callback ignored');
emit(active('openings')[0],[{id:'new-song'}]);assert.equal(sandbox.loaded[0].id,'new-song');
sandbox.activeMode='guess';vm.runInContext('syncEventData()',sandbox);
assert.equal(active('eventSeasons').length,0);assert.equal(active('eventAltLinks').length,0);
assert.equal(active('openings').length,1);assert.equal(active('openings')[0].target.constraints,undefined);
assert.equal(active('guess').length,1);assert.equal(active('bestworst').length,0);
sandbox.activeMode='rating';vm.runInContext('syncEventData()',sandbox);
assert.equal(active('guess').length,0);assert.equal(active('ratings').length,0);
sandbox.admin=true;sandbox.activeStage='basket';vm.runInContext('syncEventData()',sandbox);
assert.equal(active('openings')[0].target.constraints[0].field,'year');
assert.deepEqual(Array.from(active('openings')[0].target.constraints[0].value),[2026,'2026']);
active('openings')[0].error(new Error('expected test failure'));
assert.equal(vm.runInContext("eventDataSubscriptions.get('catalog').error",sandbox),true);
console.log('PASS: seasonal ID-only subscriptions, batching, readiness, errors, stale callbacks, mode cleanup, admin year pool');

(async () => {
  const picker = readFileSync('manual-top-insert-fast.js','utf8');
  let fullReads=0;
  const context = { cache:new Map(), normalize:s=>s,clean:s=>String(s||'').trim(), compareNatural:(a,b)=>a.localeCompare(b),
    window:{OC_CATALOG_CACHE:{load:async()=>{fullReads++;return [{id:'remote',title:'Remote',type:'OP'}];}},OC_APP_BRIDGE:{snapshot:()=>({entries:[{id:'local',title:'Local',type:'OP'}]}),top100Meta:()=>({candidates:[]}),userScore:()=>null}} };
  vm.createContext(context);
  vm.runInContext(picker.slice(picker.indexOf('  async function candidates('),picker.indexOf('  function currentRank(')),context);
  const initial=await context.candidates('Alice','OP');
  assert.equal(fullReads,0,'empty search only uses loaded entries');assert.equal(initial[0].id,'local');
  const searched=await context.candidates('Alice','OP',true);
  assert.equal(fullReads,1);assert.equal(searched.length,2);
  await context.candidates('Alice','OP',true);assert.equal(fullReads,1,'full search loads once');
  const top = readFileSync('top100-editor-v2.js','utf8');
  const requested=[];
  const editor={state:{catalog:new Map()},window:{OC_APP_BRIDGE:{snapshot:()=>({entries:[{id:'present'}]})},OC_CATALOG_CACHE:{byIds:async ids=>{requested.push(...ids);return ids.map(id=>({id}));},load:()=>{throw Error('full load forbidden');}}}};
  vm.createContext(editor);
  vm.runInContext(top.slice(top.indexOf('  function mergeLiveCatalog'),top.indexOf('  async function loadUserScores')),editor);
  await editor.loadCatalog(['present','needed']);assert.deepEqual(requested,['needed']);
  await editor.loadCatalog([]);assert.deepEqual(requested,['needed']);
  console.log('PASS: empty search has no catalog fetch, search cache reused, saved top fetches only missing IDs');
})().catch(error=>{console.error(error);process.exitCode=1;});

{
  const source=readFileSync('index-app.js','utf8');
  const watchers=[];
  const ctx={activeTab:'profile',profilePanel:{dataset:{profileView:'top100'}},profileUserSelect:{value:'Alice'},profileUser:'Alice',myName:'Alice',
    getManualRanksForUser:()=>({OP:['one'],ED:['two'],candidatesOP:['three']}),
    remoteDataState:{openings:{started:false,ready:false}},firebaseUnsubOpenings:null,
    createRemoteDataPromise:()=>Promise.resolve(),resetRemoteDataSubscription:()=>{},rebuildEntriesFromFirebase(){},populateFilterOptions(){},markRemoteDataReady(){},setStatus(){},
    firebaseDbInstance:{watchOpenings:fn=>{watchers.push({kind:'all',fn});return ()=>{};},watchOpeningsByIds:(ids,fn)=>{watchers.push({kind:'ids',ids,fn});return ()=>{};}}
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf("    let openingsScopeKey = '';"),source.indexOf('    function catalogHasRatingAggregates()')),ctx);
  ctx.ensureOpeningsWatcher(ctx.firebaseDbInstance,ctx.topProfileOpeningIds());
  assert.equal(watchers[0].kind,'ids');assert.deepEqual(Array.from(watchers[0].ids),['one','three','two']);
  ctx.ensureOpeningsWatcher(ctx.firebaseDbInstance,ctx.topProfileOpeningIds());assert.equal(watchers.length,1);
  ctx.ensureOpeningsWatcher();assert.equal(watchers[1].kind,'all');
  ctx.ensureOpeningsWatcher(ctx.firebaseDbInstance,ctx.topProfileOpeningIds());
  watchers[2].fn([{id:'current'}]);watchers[0].fn([{id:'obsolete'}]);
  assert.equal(ctx.firebaseOpenings[0].id,'current','A-B-A navigation must discard old A response');
  console.log('PASS: top-only IDs, subscription reuse, restore full catalog on navigation, late response isolation');
}
