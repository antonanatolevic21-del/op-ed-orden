const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

function watchers({ admin = false, rows = [{id:'a'}, {id:'b'}], deferred } = {}) {
  const reads = [], writes = [], stops = [];
  const window = {
    location: {href:'https://example.org/index.html'}, OC_CATALOG_ADMIN_WORKSPACE:admin,
    OC_CATALOG_STORE: {read: () => deferred || Promise.resolve(rows ? {rows} : null), write: rows => writes.push(rows)}
  };
  const ctx = vm.createContext({window, URL, console, Promise, Map, Set, queueMicrotask,
    db:{}, documentId:()=>'id', where:(...args)=>args, query:(...args)=>args,
    collection:(_, name)=>name,
    onSnapshot:(query, callback) => {
      reads.push(query);
      const ids = Array.isArray(query) ? query[1][2] : ['a','b'];
      callback({docs:ids.map(id=>({id,data:()=>({title:id})})),metadata:{fromCache:false}});
      return () => stops.push(query);
    }
  });
  const s=source('firebase-app.js');
  vm.runInContext(s.slice(s.indexOf('    function catalogCacheRows('), s.indexOf('    function watchRatings(')),ctx);
  return {ctx,reads,writes,stops};
}

(async () => {
  // Normal visits, including authenticated owners, consume zero full-catalog reads.
  let env=watchers(), results=[];
  env.ctx.watchOpenings(rows=>results.push(plain(rows))); await tick();
  assert.equal(env.reads.length,0); assert.deepEqual(results,[[{id:'a'},{id:'b'}]]);
  env=watchers({rows:null}); results=[];
  env.ctx.watchOpenings((rows,meta)=>results.push(meta)); await tick();
  assert.equal(env.reads.length,0); assert.equal(results[0].error,true);
  env=watchers({admin:true});
  const stop=env.ctx.watchOpenings(()=>{}); await tick();
  assert.deepEqual(env.reads,['openings']); stop(); assert.equal(env.stops.length,1);

  // Visiting a 100-song top uses the file; only new songs missing from it use Firebase.
  env=watchers(); results=[];
  env.ctx.watchOpeningsByIds(['a','b','a'],rows=>results.push(plain(rows))); await tick();
  assert.equal(env.reads.length,0); assert.deepEqual(results[0].map(row=>row.id),['a','b']);
  env=watchers(); results=[];
  const stopMissing=env.ctx.watchOpeningsByIds(['a','new'],rows=>results.push(plain(rows))); await tick();
  assert.equal(env.reads.length,1); assert.deepEqual(plain(env.reads[0][1][2]),['new']);
  assert.deepEqual(results[0].map(row=>row.id),['a','new']); stopMissing(); assert.equal(env.stops.length,1);
  let resolve;
  env=watchers({deferred:new Promise(r=>{resolve=r;})});
  const cancel=env.ctx.watchOpeningsByIds(['new'],()=>assert.fail('Cancelled route callback'));
  cancel(); resolve({rows:[{id:'a'}]}); await tick(); assert.equal(env.reads.length,0);

  // A page revalidates the static file once, even when several routes request it.
  let fetches=0, available=true;
  const storeCtx=vm.createContext({window:{}, console, Date,
    fetch: async (url,options)=>{if(url.includes('rating-aggregates.snapshot.json')) return {ok:false}; fetches++; assert.equal(options.cache,'no-cache'); if(!available) throw Error('offline'); return {ok:true,json:async()=>({rows:[{id:'fresh'}],generatedAt:10})};}
  });
  vm.runInContext(source('catalog-store.js'),storeCtx);
  const store=storeCtx.window.OC_CATALOG_STORE;
  const [a,b]=await Promise.all([store.read(),store.read()]);
  assert.equal(fetches,1); assert.equal(a.rows[0].id,'fresh'); assert.equal(b.rows[0].id,'fresh');
  await store.read(); assert.equal(fetches,1);
  await store.read({refresh:true}); assert.equal(fetches,2);
  available=false; const offline=await store.read({refresh:true}); assert.equal(offline.rows[0].id,'fresh'); assert.equal(offline.stale,true);

  // Missing rating aggregates no longer expand a normal route to every user's ratings.
  const app=source('index-app.js');
  const scopeCtx=vm.createContext({activeTab:'catalog',myName:'Tester',authenticatedUid:'uid',
    openedProfileUsers:()=>['Tester'],catalogHasRatingAggregates:()=>false});
  vm.runInContext(app.slice(app.indexOf('    function preferredRatingsScope('),app.indexOf('    function ensureRatingsWatcher(')),scopeCtx);
  for(const route of ['catalog','season','tier','entity-performers','top100','profile']) assert.equal(scopeCtx.preferredRatingsScope(route),'user');
  scopeCtx.myName=''; scopeCtx.authenticatedUid=''; assert.equal(scopeCtx.preferredRatingsScope('catalog'),'none');
  assert.equal(scopeCtx.preferredRatingsScope('stats'),'all');

  // Global profile lists are used only by routes that actually display them.
  const profileCtx=vm.createContext({activeTab:'catalog',myName:'Tester',openedProfileUsers:()=>['Viewed'],
    remoteDataState:{manualRanks:{}},profileWatcherKeys:{},profileWatcherGenerations:{manualRanks:0},
    stopManualRanksWatcher(){},stopUserProfilesWatcher(){},createRemoteDataPromise:()=>Promise.resolve(),
    markRemoteDataReady(){},refreshScopedProfileCatalog(){}});
  vm.runInContext(app.slice(app.indexOf('    function ensureProfileWatcher('),app.indexOf('    function ensureManualRanksWatcher(')),profileCtx);
  const profileReads=[];
  const db={watchManualRanks:()=>{profileReads.push('all');},watchManualRanksForUsers:names=>{profileReads.push(plain(names));}};
  profileCtx.ensureProfileWatcher('manualRanks',db,()=>{}); assert.deepEqual(profileReads[0],['Tester']);
  profileCtx.activeTab='profile'; profileCtx.ensureProfileWatcher('manualRanks',db,()=>{}); assert.deepEqual(profileReads[1],['Viewed']);
  profileCtx.activeTab='top100'; profileCtx.ensureProfileWatcher('manualRanks',db,()=>{}); assert.equal(profileReads[2],'all');
  // The shared catalog source overlays recent edits once per page.
  const updates = [];
  const publicWindow = {
    setTimeout, clearTimeout,
    OPED_DB: {listCatalogUpdates: async since => {
      updates.push(since);
      return [{id:'a', image:'', fallbackImage:'images/new.webp'}, {id:'new', image:'new.jpg'}];
    }}
  };
  const updateCtx = vm.createContext({window:publicWindow, console:{warn(){}}, Date,
    fetch: async url => url.includes('rating-aggregates.snapshot.json') ? {ok:false} : {
      ok:true, json:async()=>({catalogReadStartedAt:20, generatedAt:30,
        rows:[{id:'a', image:'old.jpg', ratingAverage:8}, {id:'b'}]})
    }
  });
  vm.runInContext(source('catalog-store.js'),updateCtx);
  const publicStore = publicWindow.OC_CATALOG_STORE;
  const [first, second] = await Promise.all([publicStore.read(), publicStore.read()]);
  assert.deepEqual(updates,[20]);
  assert.deepEqual(plain(first.rows),[
    {id:'a', image:'', fallbackImage:'images/new.webp', ratingAverage:8},
    {id:'b'}, {id:'new', image:'new.jpg'}
  ]);
  assert.equal(first.rows, second.rows);
  publicWindow.OC_CATALOG_ADMIN_WORKSPACE = true;
  assert.equal((await publicStore.read({refresh:true})).rows[0].image,'old.jpg');
  assert.deepEqual(updates,[20]);
  publicWindow.OC_CATALOG_ADMIN_WORKSPACE = false;
  publicWindow.OPED_DB.listCatalogUpdates = async () => { throw Error('Quota exhausted'); };
  assert.equal((await publicStore.read({refresh:true})).rows[0].image,'old.jpg');
  console.log('Passed: scoped catalog updates, missing-ID reads, admin live edits, cancellation, revalidation, offline cache, scoped ratings and profiles.');
})().catch(error=>{console.error(error);process.exitCode=1;});
