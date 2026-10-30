const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('top100-image-backups.js', 'utf8');

// Small IndexedDB API fixture: commit on transaction completion, clone stored Blob bytes.
const persisted = new Map(); let failWrite = false, created = false;
const db = {
  objectStoreNames: { contains: () => created }, createObjectStore() { created = true; }, close() {},
  transaction(name, mode) {
    assert.equal(name, 'snapshots');
    const working = structuredClone(persisted), tx = {}; let pending = 0, closed = false;
    const check = () => setImmediate(() => {
      if (pending || closed) return;
      closed = true;
      if (mode === 'readwrite') { persisted.clear(); for (const [key,value] of working) persisted.set(key,value); }
      tx.oncomplete?.();
    });
    tx.abort = () => { if (!closed) { closed = true; setImmediate(() => tx.onabort?.()); } };
    const schedule = callback => {
      pending++; setImmediate(() => { if (!closed) callback(); pending--; check(); });
    };
    const request = callback => { const req = {}; schedule(() => { req.result = callback(); if (!closed) req.onsuccess?.(); }); return req; };
    const store = {
      get: id => request(() => structuredClone(working.get(id))),
      put: value => request(() => {
        if (failWrite) { tx.error = new Error('QuotaExceededError'); tx.abort(); return; }
        working.set(value.id, structuredClone(value)); return value.id;
      }),
      delete: id => request(() => working.delete(id)),
      openCursor() {
        const req = {}, ids = [...working.keys()]; let index = 0;
        const step = () => schedule(() => {
          const id = ids[index++]; req.result = id === undefined ? null : {
            value: structuredClone(working.get(id)), delete: () => store.delete(id), continue: step
          }; req.onsuccess?.();
        });
        step(); return req;
      }
    };
    tx.objectStore = () => store; check(); return tx;
  }
};
const indexedDB = { open() {
  const req = { result:db };
  setImmediate(() => { if (!created) req.onupgradeneeded?.(); req.onsuccess?.(); }); return req;
} };
function load(extra = {}) {
  const window = {};
  vm.runInNewContext(source, { window, indexedDB, Blob, setTimeout, clearTimeout, ...extra });
  return window.OC_TOP100_BACKUP_IMAGES;
}
const record = (id,key='tester',savedAt=Date.now()-600000) => ({ id,key,savedAt,files:[{type:'OP',from:1,to:25,blob:new Blob(['original PNG bytes'],{type:'image/png'})}] });
(async () => {
  let api = load(); await api.put(record('first'));
  api = load(); // Reopen after a page reload: bytes must come from the durable store.
  const saved = await api.get('first','tester');
  assert.equal(await saved.files[0].blob.text(),'original PNG bytes');
  assert.equal(await api.get('first','other'),null);
  failWrite=true; await assert.rejects(api.put(record('failed')),/QuotaExceededError/); failWrite=false;
  assert.equal(await api.get('failed','tester'),null); assert(await api.get('first','tester'));
  await api.put(record('old')); await api.put(record('other','other')); await api.put(record('fresh','tester',Date.now()));
  await api.prune('tester',['first']);
  assert.equal(await api.get('old','tester'),null); assert(await api.get('first','tester'));
  assert(await api.get('other','other')); assert(await api.get('fresh','tester'));
  await api.remove('first','other'); assert(await api.get('first','tester'));
  await api.remove('first','tester'); assert.equal(await api.get('first','tester'),null);
  await assert.rejects(api.put({ ...record('invalid'),files:[{blob:new Blob([],{type:'image/png'})}] }),/PNG/);
  api=load({indexedDB:undefined}); await assert.rejects(api.get('x','tester'),/не разрешает/);
  console.log('Passed: persisted Blob bytes after reload, transaction failure, owner isolation, pruning with concurrent-tab grace, safe cleanup and unavailable storage.');
})().catch(error=>{console.error(error);process.exitCode=1});
