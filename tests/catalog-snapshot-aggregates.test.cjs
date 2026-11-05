const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../scripts/build-catalog-snapshot.mjs'),'utf8')
  .replace("import { writeFile } from 'node:fs/promises';",'')
  .replaceAll('import.meta.url', JSON.stringify('file:///repo/scripts/build-catalog-snapshot.mjs'));
const encode = value => {
  if (typeof value === 'string') return {stringValue:value};
  if (typeof value === 'number') return {doubleValue:value};
  throw Error('Unsupported fixture');
};
const doc = (id,fields) => ({name:'documents/'+id,fields:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,encode(v)]))});
async function build(ratings) {
  let saved, compact; const reads=[];
  const ctx = vm.createContext({URL,Date,Map,Set,console:{log(){}},process:{env:{REBUILD_AGGREGATES_FROM_RATINGS:'1'}},
    writeFile:async(file,content)=>{if(file.pathname.endsWith('/catalog.snapshot.json')) saved=JSON.parse(content); else compact=JSON.parse(content);},
    fetch:async url=>{
      const name=url.pathname.split('/').pop(); reads.push(name);
      return {ok:true,json:async()=>({documents:name==='openings'
        ? [doc('a',{title:'A',ratingCount:99,ratingSum:990}),doc('empty',{title:'Empty',ratingCount:7,ratingSum:70})]
        : ratings})};
    }
  });
  await vm.runInContext('(async()=>{'+source+'})()',ctx);
  assert.deepEqual(reads,['openings','ratings']);
  assert.equal(compact.version,1);
  assert.equal(compact.rows.length, ratings.length ? 1 : 0);
  assert(!JSON.stringify(compact).includes('Viewer'));
  return saved.rows;
}
(async()=>{
  let rows=await build([doc('r1',{openingId:'a',nickname:'Пёс кошачий',score:8,songScore:6}),doc('r2',{openingId:'a',nickname:'Viewer',score:10})]);
  assert.equal(rows[0].ratingCount,2); assert.equal(rows[0].ratingAverage,9); assert.equal(rows[0].adminRatingAverage,8);
  assert.equal(rows[0].songRatingAverage,6); assert.equal(rows[0].ratingAggregateVersion,1);
  assert.equal(rows[1].ratingCount,0); assert.equal(rows[1].ratingAverage,null); assert.equal(rows[1].ratingAggregateVersion,1);
  rows=await build([]); assert(rows.every(row=>row.ratingAggregateVersion===1 && row.ratingCount===0));
  console.log('Passed: daily shared averages, admin/criterion averages, deleted votes and empty ratings collection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
