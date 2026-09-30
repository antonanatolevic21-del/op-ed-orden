const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'top100-editor-v2.js'), 'utf8');
const storage = new Map(), listeners = new Map();
let loadedIds = [], fullLoads = 0;
const userNode = { value: 'Tester' };
const profileNode = { dataset: { profileView: 'top100' } };
const editNode = { classList: { contains: () => true } };
const window = {
  addEventListener() {},
  OPED_DB: { normalizeNickname: value => value.toLowerCase() },
  OC_APP_BRIDGE: { snapshot: () => ({ entries: [] }), top100Meta: () => ({ candidates: ['marked'] }) },
  OC_CATALOG_CACHE: {
    byIds: async ids => { loadedIds.push(...ids); return ids.map(id => ({ id, type: 'OP', title: id })); },
    load: async () => { fullLoads++; return [{ id: 'outside', type: 'OP', title: 'Hidden track', performers: ['Singer'] }]; }
  }
};
const document = {
  readyState: 'loading',
  querySelector: selector => selector === '#oc-profile-panel' ? profileNode : selector === '#oc-manual-edit-btn' ? editNode : ['#oc-profile-user','#oc-myname'].includes(selector) ? userNode : null,
  querySelectorAll: () => [],
  addEventListener: (type, cb) => { const list = listeners.get(type) || []; list.push(cb); listeners.set(type, list); }
};
const context = vm.createContext({ window, document, localStorage: {
  getItem: key => storage.get(key), setItem: (key,value) => storage.set(key,value), removeItem: key => storage.delete(key)
}, console, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame() {} });
vm.runInContext(source.replace(/\}\)\(\);\s*$/, `renderAll = () => {}; window.testEditor = { state, insertDraftGap, candidateRows, refreshCandidates, undo, redo, displayScore }; })();`), context);
const api = window.testEditor, state = api.state;
state.editing = true; state.loaded = true; state.key = 'tester'; state.user = 'Tester';
const order = () => Array.from(state.draft.OP);
state.draft.OP = ['a','b','c']; state.baseline.OP = ['a','b','c'];
state.catalog.set('a', { id:'a',type:'OP',title:'A' });
state.catalog.set('new', { id:'new',type:'OP',title:'New' });
api.insertDraftGap('OP','new',0); assert.deepEqual(order(),['new','a','b','c']);
api.insertDraftGap('OP','a',4); assert.deepEqual(order(),['new','b','c','a']);
api.insertDraftGap('OP','a',0); assert.deepEqual(order(),['a','new','b','c']);
const undoCount = state.undo.length; api.insertDraftGap('OP','a',1); assert.equal(state.undo.length,undoCount);
api.undo(); assert.deepEqual(order(),['new','b','c','a']); api.redo(); assert.deepEqual(order(),['a','new','b','c']);
state.draft.OP = []; api.insertDraftGap('OP','new',0); assert.deepEqual(order(),['new']);
state.draft.OP = Array.from({length:100},(_,i)=>String(i)); api.insertDraftGap('OP','new',50); assert.equal(order().length,100); assert(!order().includes('new')); assert.equal(order().at(-1),'99');
api.insertDraftGap('OP','0',100); assert.equal(order().at(-1),'0'); assert.equal(new Set(order()).size,100);
state.catalog.set('ending',{id:'ending',type:'ED'}); api.insertDraftGap('OP','ending',0); assert(!order().includes('ending'));
state.draft.OP = ['a']; state.catalog.set('marked',{id:'marked',type:'OP',title:'Marked'}); state.catalog.set('rated',{id:'rated',type:'OP',title:'Rated',performers:['Artist']}); state.scores.set('rated',9);
state.candidateFilter='available'; assert.deepEqual(Array.from(api.candidateRows('OP'),row=>row.id),['marked','rated']);
state.candidateQuery='artist'; assert.deepEqual(Array.from(api.candidateRows('OP'),row=>row.id),['rated']);
assert.equal(api.displayScore(null),'—'); assert.equal(api.displayScore(0),'0');
(async () => {
  state.scores.set('uncached',8); state.candidateQuery=''; await api.refreshCandidates(); assert.equal(fullLoads,0); assert(loadedIds.includes('uncached'));
  state.candidateFilter='all'; await api.refreshCandidates(); assert.equal(fullLoads,0);
  state.candidateQuery='hidden'; await api.refreshCandidates(); assert.equal(fullLoads,1); assert.deepEqual(Array.from(api.candidateRows('OP'),row=>row.id),['outside']);
  await api.refreshCandidates(); assert.equal(fullLoads,1);
  console.log('Passed: empty top, insert, reorder both directions, undo/redo, limit, type guard, candidate search/filter, demand loading and catalog reuse.');
})().catch(error => { console.error(error); process.exitCode=1; });
