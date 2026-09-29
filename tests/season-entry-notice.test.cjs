const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('season-entry-notice.js','utf8').replace(/^import .*;\n/gm,'').replace(/void start\(\)\.catch[^\n]+/,'');
const ctx={URL,console}; vm.createContext(ctx);vm.runInContext(source,ctx);
const base={id:'2026_fall',year:2026,season:'fall',allowedNicknames:['Tester'],participantBindings:[{nicknameKey:'tester',authUid:'u1'}],selectedOpeningIds:['a','b','b']};
const profile={nickname:'Tester'};
const rating=(id,score=8,extra={})=>({seasonKey:base.id,nicknameKey:'tester',openingId:id,score,...extra});
const pending=(seasons,ratings)=>ctx.pendingAssignments(seasons,ratings,profile,'u1');
assert.equal(pending([base],[])[0].total,2);
assert.equal(pending([base],[rating('a'),rating('a')])[0].done,1);
assert.equal(pending([base],[rating('a'),rating('b')]).length,0);
for(const score of [null,undefined,'',false,'no',Infinity]){
 const r=rating('a');r.score=score;assert.equal(pending([base],[r])[0].done,0);
}
assert.equal(pending([base],[rating('a',8,{stage:'final'}),rating('b',8,{nicknameKey:'other'})])[0].done,0);
assert.equal(pending([base],[rating('c')])[0].done,0);
for(const patch of [{closed:true},{eventKind:'ending-year'},{year:2025},{selectedOpeningIds:[]},{allowedNicknames:['other']},{participantBindings:[{nicknameKey:'tester',authUid:'other'}]}])assert.equal(pending([{...base,...patch}],[]).length,0);
assert.equal(pending([{...base,participantBindings:[]}],[]).length,1);
assert.equal(pending([base,{...base,id:'2026_spring',season:'spring'}],[rating('a'),rating('b')]).length,1);
const old={checked:['u1']},url='https://example.com/site/index.html';
for(const [previous,type,referrer,result] of [[null,'navigate','',true],[old,'navigate','',true],[old,'navigate','https://other.com/',true],[old,'navigate','https://example.com/another/index.html',true],[old,'navigate','https://example.com/site/events.html',false],[old,'reload','',false],[old,'back_forward','',false]])assert.equal(ctx.beginsVisit(previous,type,referrer,url),result);
console.log('PASS progress: all/partial/duplicate/invalid/foreign/stage/removed/closed/empty/multiple assignments');
console.log('PASS visits: new/direct/external entry; internal navigation, reload and back do not repeat');
// Exercise actual checkAccount with mocked Firestore responses and a rendering spy.
let renders=[],saved=[];
ctx.sessionStorage={setItem(k,v){saved.push(JSON.parse(v))}};
ctx.collection=(db,name)=>name;ctx.where=()=>null;ctx.limit=()=>null;ctx.query=(name)=>name;
ctx.getDocs=async name=>({docs:name==='userProfiles'?[{id:'tester',data:()=>profile}]:name==='eventSeasons'?[{id:base.id,data:()=>base}]:[]});
ctx.renderSpy=rows=>renders.push(rows);
vm.runInContext('showNotice = renderSpy;',ctx);
(async()=>{
 const auth={currentUser:{uid:'u1'}};
 await ctx.checkAccount(auth,{},auth.currentUser);assert.equal(renders.length,1);assert.equal(renders[0].length,1);
 await ctx.checkAccount(auth,{},auth.currentUser);assert.equal(renders.length,1);
 assert.equal(saved.at(-1).checked[0],'u1');
 vm.runInContext('visit={checked:[]};',ctx);
 await ctx.checkAccount(auth,{},auth.currentUser);assert.equal(renders.length,2,'new visit repeats incomplete assignment');
 vm.runInContext('visit={checked:[]};',ctx);
 const getDocs=ctx.getDocs;ctx.getDocs=async name=>name==='eventRatings'?{docs:[rating('a'),rating('b')].map(row=>({data:()=>row}))}:getDocs(name);
 await ctx.checkAccount(auth,{},auth.currentUser);assert.equal(renders.at(-1).length,0,'completed assignments do not show a dialog');
 console.log('PASS account flow: once per visit; returns next visit; disappears when complete');
})().catch(e=>{console.error(e);process.exitCode=1});
