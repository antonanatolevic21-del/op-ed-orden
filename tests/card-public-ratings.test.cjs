const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

const dbReads = [];
let callback, errorCallback, stopped = 0;
const dbContext = vm.createContext({
  db: {}, collection: (_,name) => name, where: (...args) => args, query: (...args) => args,
  onSnapshot: (query, cb, error) => { dbReads.push(query); callback=cb; errorCallback=error; return () => stopped++; }
});
const dbSource=source('firebase-app.js');
vm.runInContext(dbSource.slice(dbSource.indexOf('    function watchRatingsForOpening('),dbSource.indexOf('    function watchRatingsForUser(')),dbContext);
let received = [], errors=0;
const cancel=dbContext.watchRatingsForOpening('track-1',rows=>received.push(rows),()=>errors++);
assert.deepEqual(JSON.parse(JSON.stringify(dbReads)),[['ratings',['openingId','==','track-1']]]);
callback({docs:[{id:'vote',data:()=>({nickname:'Other',score:9})}]}); assert.equal(received[0][0].nickname,'Other');
cancel(); callback({docs:[]}); errorCallback(Error('late')); assert.equal(received.length,1); assert.equal(errors,0); assert.equal(stopped,1);

let hidden=false, id='track-1', listeners=[], cancelled=0;
const list={innerHTML:''}, strip={innerHTML:''}, input={value:'7.3'};
const entry={id, scores:{Me:8},songScores:{Me:6},visualScores:{}};
const average=scores=>{const values=Object.values(scores); return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;};
const context=vm.createContext({
  window:{OPED_DB:{watchRatingsForOpening:(id,cb,error)=>{listeners.push({id,cb,error});return ()=>cancelled++;}}},
  openingModal:{classList:{contains:()=>hidden},querySelector:selector=>selector==='[data-entry-id]'?{dataset:{entryId:id}}:selector==='.oc-votes'?list:selector==='.oc-opening-score-strip .oc-detail-grid'?strip:input},
  myName:'Me',MIN_PUBLIC_VOTES:3,isAdmin:()=>false,avg:average,adminAvg:average,avgAny:average,adminRatingCount:s=>Object.keys(s).length,
  ratingCount:s=>Object.keys(s).length,formatScore:v=>v===null?'—':String(v),
  escapeHtml:s=>String(s).replaceAll('<','&lt;'),avatarFor:()=>'',songScoreFor:(e,n)=>e.songScores[n]??null,visualScoreFor:(e,n)=>e.visualScores[n]??null,
  normalizeOptionalNumber:v=>v===null||v===undefined||v===''?null:Number(v),console:{error(){}}
});
const app=source('index-app.js');
vm.runInContext(app.slice(app.indexOf('    function cardScoreRowsMarkup('),app.indexOf('    function openCardModal(')),context);
context.startCardRatings(entry,{enabled:true,songLabel:'Песня',visualLabel:'Визуал'});
assert.equal(list.innerHTML.includes('Загружаем'),true);
listeners[0].cb([{nickname:'Me',score:8,songScore:6},{nickname:'Other',score:10,songScore:9},{nickname:'<Guest>',score:null}]);
assert(list.innerHTML.includes('Other: 10')); assert(!list.innerHTML.includes('Guest')); assert(strip.innerHTML.includes('9'));
assert.equal(input.value,'7.3'); assert.deepEqual(entry.scores,{Me:8});
context.startCardRatings({...entry,id:'track-2'},{enabled:false}); id='track-2'; assert.equal(cancelled,1);
const before=list.innerHTML; listeners[0].cb([{nickname:'Stale',score:1}]); assert.equal(list.innerHTML,before);
listeners[1].error(Error('quota')); assert(list.innerHTML.includes('Не удалось загрузить'));
context.stopCardRatings(); hidden=true; const errorText=list.innerHTML; listeners[1].cb([]); assert.equal(list.innerHTML,errorText); assert.equal(cancelled,2);
console.log('Passed: single-track query, other-user votes and averages, criteria, cancellation, stale callbacks, errors, and unchanged unsaved rating inputs.');
