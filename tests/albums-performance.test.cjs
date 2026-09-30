const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const source=fs.readFileSync('index-app.js','utf8');
let reads=0;
const ctx={entries:[],dataVersion:1,myName:'Alice',ratingScale:'int',
  isPersonalScale:()=>ctx.ratingScale==='five',
  hasRated:(row,name)=>{reads++;return row.scores?.[name]!=null;},
  hasPersonalRated:(row,name)=>{reads++;return row.personalScores?.[name]!=null;},
  compareNatural:(a,b)=>String(a).localeCompare(String(b)),
};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('    const ENTITY_ALBUM_META ='),source.indexOf('    function resetEntityAlbumFilters()')),ctx);
ctx.entries=[
 {id:'1',studios:['Test','TEST'],scores:{Alice:0},personalScores:{}},
 {id:'2',studios:['test'],scores:{Alice:8},personalScores:{Alice:4}},
 {id:'3',studios:['Test'],scores:{Alice:9},personalScores:{Alice:4}},
];
const card={type:'studios',value:'Test'};
assert.equal(ctx.entriesForEntity('studios','test').length,3,'aliases on one song must not double count');
assert.equal(ctx.entityCardProgress(card).complete,true);
const firstReads=reads;
ctx.entityCardProgress(card);ctx.entityCardProgress({...card,value:'TEST'});
assert.equal(reads,firstReads,'cached progress must not rescan songs');
ctx.ratingScale='five';assert.equal(ctx.entityCardProgress(card).rated,2);
ctx.myName='Bob';assert.equal(ctx.entityCardProgress(card).rated,0);
ctx.myName='Alice';ctx.ratingScale='int';
ctx.entries=ctx.entries.slice(1);ctx.dataVersion++;
assert.equal(ctx.entityCardProgress(card).related.length,2);
assert.equal(ctx.entityCardProgress(card).complete,false);
assert.equal(ctx.eligibleEntityValues('studios').length,0);
ctx.entries.push({id:'4',studios:['Test'],scores:{Alice:10}});ctx.dataVersion++;
assert.equal(ctx.eligibleEntityValues('studios')[0].count,3);
const root={isConnected:true,html:'',replaces:0,querySelector:()=>null,
 set innerHTML(value){this.html=value;this.replaces++;},insertAdjacentHTML(_,html){this.html+=html;}};
let rendered=[];
const render=(item,index)=>{rendered.push(index);return `${item}:${index};`;};
ctx.renderEntityBatch(root,'one',['a','b'],'entity-cards',render,'empty');
ctx.renderEntityBatch(root,'one',['a','b','c','d'],'entity-cards',render,'empty');
assert.equal(root.replaces,1,'load more preserves existing card nodes');
assert.deepEqual(rendered,[0,1,2,3]);
ctx.renderEntityBatch(root,'two',['x'],'entity-cards',render,'empty');
assert.equal(root.replaces,2,'changed filter replaces cards');
console.log('PASS: alias deduplication, progress invalidation by data/user/scale, incremental cards and ranks');

const snapshot=JSON.parse(fs.readFileSync('catalog.snapshot.json','utf8'));
ctx.entries=Array.isArray(snapshot)?snapshot:snapshot.rows;ctx.dataVersion++;
for(const row of ctx.entries) for(const field of ['studios','performers','directors','franchises']) {
 if(!Array.isArray(row[field])) row[field]=[];
}
const names=[...new Set(ctx.entries.flatMap(row=>row.franchises))].slice(0,400);
const t0=performance.now();
const original=names.map(value=>{const key=ctx.normalizedEntityValue(value);return ctx.entries.filter(row=>row.franchises.some(item=>ctx.normalizedEntityValue(item)===key)).length;});
const t1=performance.now();
const indexed=names.map(value=>ctx.entityCardProgress({type:'franchises',value}).related.length);
const t2=performance.now();
const repeated=names.map(value=>ctx.entityCardProgress({type:'franchises',value}).related.length);
const t3=performance.now();
assert.deepEqual(indexed,original);assert.deepEqual(repeated,original);
console.log(JSON.stringify({tracks:ctx.entries.length,albums:names.length,oldMs:Math.round(t1-t0),indexedMs:Math.round(t2-t1),cachedMs:Math.round(t3-t2)}));
