const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('top100-editor-v2.js', 'utf8');
const storage = new Map(), listeners = {}, intervals = [], timers = [];
const imageRecords = new Map();
let failImages = false, failRender = false;
let now = 1000, failWrite = false, viewed = 'Tester', own = 'Tester';
const modalHandlers = {};
const modalBody = { innerHTML: '', addEventListener: (type, cb) => { modalHandlers[type] = cb; } };
const modal = { isConnected: true, querySelector: () => modalBody, remove() { this.isConnected = false; } };
const edit = { classList: { add() {} } };
const label = { textContent: '' };
const marker = { dataset: {}, querySelector: () => label };
const button = {};
const window = { addEventListener() {}, confirm: () => true, OPED_DB: { normalizeNickname: value => value.toLowerCase() }, OC_CATALOG_CACHE: { byIds: async ids => ids.map(id => ({ id })) } };
window.OC_TOP100_BACKUP_IMAGES = {
  get: async (id,key) => imageRecords.get(id)?.key === key ? imageRecords.get(id) : null,
  put: async record => { if (failImages) throw Error('Image quota'); imageRecords.set(record.id, structuredClone(record)); },
  prune: async (key,ids) => { for(const [id,record] of imageRecords) if(record.key===key && !ids.includes(id)) imageRecords.delete(id); },
  remove: async (id,key) => { if(imageRecords.get(id)?.key === key) imageRecords.delete(id); }
};
window.OC_TOP100_PNG = { renderPages: async tops => {
  if(failRender) throw Error('PNG encoding failed');
  return ['OP','ED'].flatMap(type=>tops[type].length ? Array.from({length:4},(_,part)=>({type,from:part*25+1,to:part*25+25,blob:new Blob(['PNG'],{type:'image/png'})})) : []);
} };
const document = {
  readyState: 'loading', visibilityState: 'visible', querySelectorAll: () => [],
  addEventListener: (type, cb) => { listeners[type] = cb; },
  querySelector: selector => selector === '#oc-profile-user' ? { value: viewed } : selector === '#oc-myname' ? { value: own }
    : selector === '[data-top100-backup-status]' ? marker : selector === '[data-top100-local-history]' ? button : selector === '#oc-manual-edit-btn' ? edit : null
};
class Clock extends Date { static now() { return now; } }
const context = vm.createContext({ window, document, modal, Date: Clock, console: { error() {}, warn() {} },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (failWrite) throw Error('QuotaExceededError'); storage.set(key, value); } },
  setTimeout: cb => { const timer={}; timers.push(timer); return setTimeout(()=>{timers.splice(timers.indexOf(timer),1); cb();},0); }, clearTimeout() {}, setInterval: (cb, delay) => intervals.push({ cb, delay })
});
vm.runInContext(source.replace(/\}\)\(\);\s*$/, `modalRoot=()=>modal; renderAll=()=>{}; window.test = { state, backupCurrentTop, readLocalBackups, startLocalBackups, updateBackupStatus, openLocalHistory }; })();`), context);
const a = window.test, s = a.state, key = 'oc-top100-local-backups-v1:tester';
s.loaded = true; s.key = 'tester'; s.user = 'Tester';
s.baseline = { OP: ['a', 'b'], ED: ['ed'] }; s.draft = { OP: ['b', 'a'], ED: ['ed'] };
const copies = () => JSON.parse(storage.get(key)).copies;
const plain = value => JSON.parse(JSON.stringify(value));
async function finish(pending) { if(pending) await pending; else await new Promise(resolve=>setTimeout(resolve,20)); }
(async () => {
  const first = a.backupCurrentTop();
  assert.equal(marker.dataset.phase, 'copying'); assert.equal(label.textContent, 'создаётся копия');
  assert.equal(storage.has(key), false); await finish(first);
  assert.deepEqual({ ...copies()[0], imageKey:undefined, imageCount:undefined }, { OP:['a','b'], ED:['ed'], savedAt:1000, source:'saved', imageKey:undefined, imageCount:undefined });
  assert.equal(copies()[0].imageCount,8); assert.equal(imageRecords.get(copies()[0].imageKey).files.length,8);
  const firstRecord = structuredClone(imageRecords.get(copies()[0].imageKey)); assert(firstRecord.files[0].blob instanceof Blob);
  assert.equal(marker.dataset.phase, ''); assert.match(label.textContent, /Копия в браузере/);
  now += 300000; await a.backupCurrentTop(); assert.equal(copies().length, 1); assert.equal(copies()[0].savedAt, 1000);
  s.editing = true; now += 300000; await finish(a.backupCurrentTop());
  assert.deepEqual(copies()[0].OP, ['b','a']); assert.equal(copies()[0].source, 'draft');
  s.draft.OP = ['a','b']; now++; await finish(a.backupCurrentTop()); assert.equal(copies().length, 3);
  s.draft = { OP:[], ED:[] }; now++; await finish(a.backupCurrentTop()); assert.deepEqual(copies()[0].OP, []);
  for (let i=0; i<32; i++) { now++; s.draft.OP = [String(i)]; await finish(a.backupCurrentTop()); }
  assert.equal(copies().length, 30); assert.equal(copies()[0].OP[0], '31'); assert.equal(copies().at(-1).OP[0], '2');
  const previous = storage.get(key); s.draft.OP = ['quota']; failWrite = true;
  await finish(a.backupCurrentTop()); assert.equal(marker.dataset.phase, 'error'); assert.equal(storage.get(key), previous);
  failWrite = false; await finish(a.backupCurrentTop()); assert.equal(copies()[0].OP[0], 'quota'); assert.equal(marker.dataset.phase, '');
  const withImages=storage.get(key); const recordsBefore=imageRecords.size;
  s.draft.OP=['failed-images']; failImages=true; await finish(a.backupCurrentTop()); assert.equal(storage.get(key),withImages); assert.equal(imageRecords.size,recordsBefore); failImages=false;
  failRender=true; await finish(a.backupCurrentTop()); assert.equal(storage.get(key),withImages); failRender=false;
  storage.set(key, '{broken'); s.draft.OP = ['broken']; await a.backupCurrentTop(); assert.equal(storage.get(key), '{broken'); assert.equal(marker.dataset.phase, 'error'); storage.set(key, previous);
  viewed = 'Other'; await a.backupCurrentTop(); a.updateBackupStatus(); assert.equal(button.hidden, true); assert.equal(marker.hidden, true); assert.equal(storage.get(key), previous);
  viewed = 'Tester'; s.draft.OP = ['switch']; const switched = a.backupCurrentTop(); viewed = own = 'Other'; s.key = 'other'; await finish(switched); assert.equal(storage.get(key), previous); assert.equal(storage.has('oc-top100-local-backups-v1:other'), false);
  s.user = 'Other'; s.baseline = s.draft = { OP:['other'], ED:[] }; now++; await finish(a.backupCurrentTop());
  assert.equal(JSON.parse(storage.get('oc-top100-local-backups-v1:other')).copies[0].OP[0], 'other'); assert.equal(storage.get(key), previous);
  s.loading = true; s.draft = { OP:['loading'], ED:[] }; await a.backupCurrentTop(); assert.equal(timers.length, 0); s.loading = false;
  a.startLocalBackups(); assert.equal(intervals.length, 1); assert.equal(intervals[0].delay, 300000);
  now += 300000; intervals[0].cb(); await finish(); assert.equal(JSON.parse(storage.get('oc-top100-local-backups-v1:other')).copies[0].OP[0], 'loading');
  s.draft.OP = ['visibility']; now += 300000; listeners.visibilitychange(); await finish(); assert.equal(JSON.parse(storage.get('oc-top100-local-backups-v1:other')).copies[0].OP[0], 'visibility');
  assert.equal(plain(a.readLocalBackups('tester')).length, 30);
  a.openLocalHistory(); assert.match(modalBody.innerHTML, /Копии в браузере/);
  s.draft.OP = ['displaced'];
  await modalHandlers.click({ target: { closest: selector => selector === '[data-local-history-index]' ? ({ dataset: { localHistoryIndex:'0' } }) : null } });
  assert.deepEqual(plain(s.draft), { OP:['visibility'], ED:[] });
  assert.deepEqual(plain(s.baseline), { OP:['other'], ED:[] });
  assert.equal(s.editing, true); assert.equal(modal.isConnected, false);
  assert.deepEqual(JSON.parse(storage.get('oc-top100-editor-v2-draft:other')).draft, { OP:['visibility'], ED:[] });
  modal.isConnected = true; a.openLocalHistory();
  let releaseCatalog;
  window.OC_CATALOG_CACHE.byIds = () => new Promise(resolve => { releaseCatalog = resolve; });
  s.catalog.clear(); s.draft.OP = ['unchanged'];
  const restore = modalHandlers.click({ target: { closest: selector => selector === '[data-local-history-index]' ? ({ dataset: { localHistoryIndex:'0' } }) : null } });
  viewed = own = 'Tester'; s.key = 'tester'; releaseCatalog([]); await restore;
  assert.deepEqual(plain(s.draft.OP), ['unchanged']);
  // Upgrade an unchanged order-only version and regenerate images removed independently.
  s.baseline=s.draft={OP:['legacy'],ED:[]}; s.editing=false; s.loaded=true; s.loading=false;
  storage.set(key,JSON.stringify({version:1,key:'tester',copies:[{OP:['legacy'],ED:[],savedAt:1,source:'saved'}]}));
  window.OC_CATALOG_CACHE.byIds=async ids=>ids.map(id=>({id}));
  await finish(a.backupCurrentTop()); assert.equal(copies().length,1); assert.equal(copies()[0].imageCount,4);
  imageRecords.delete(copies()[0].imageKey); await finish(a.backupCurrentTop()); assert(imageRecords.has(copies()[0].imageKey));
  console.log('Passed: PNG records, image write/render failure safety, migration and missing-image regeneration; first copy, copying indicator, five-minute timer, deduplication, draft and empty tops, 30-copy retention, quota/corrupt-storage safety, account isolation, switching during copy/restore, loading guard, background resume and local-only draft restoration.');
})().catch(error => { console.error(error); process.exitCode = 1; });

