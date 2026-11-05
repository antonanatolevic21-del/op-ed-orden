const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../catalog-store.js'),'utf8');
async function load(average) {
 let calls=0;
 const ctx=vm.createContext({window:{},console,Date,fetch:async(url)=>{
  calls++;
  return {ok:true,json:async()=>url.includes('rating-aggregates')?average:{generatedAt:1,rows:[{id:'rated'},{id:'none',ratingCount:99}]}};
 }});
 vm.runInContext(source,ctx);
 const rows=(await ctx.window.OC_CATALOG_STORE.read()).rows;
 assert.equal(calls,2);
 return rows;
}
(async()=>{
 let rows=await load({version:1,generatedAt:100,rows:[['rated',3,27,1,8,2,17,1,9,0,0,0,0]]});
 assert.equal(rows[0].ratingAverage,9);assert.equal(rows[0].ratingCount,3);assert.equal(rows[0].adminRatingAverage,8);
 assert.equal(rows[0].songRatingAverage,8.5);assert.equal(rows[0].visualRatingAverage,null);
 assert.equal(rows[1].ratingCount,0);assert.equal(rows[1].ratingAverage,null);
 assert.equal(rows[0].ratingAggregateVersion,1);
 rows=await load({version:1,generatedAt:100,rows:[['rated',3,'invalid']]});
 assert.equal(rows[0].ratingAggregateVersion,undefined);assert.equal(rows[1].ratingCount,99);
 rows=await load({version:1,generatedAt:100,rows:[]}); assert.equal(rows[0].ratingCount,0);
 console.log('Passed: shared averages and vote counts, criteria/admin averages, unrated tracks and invalid/missing aggregate fallback without Firebase reads.');
})().catch(e=>{console.error(e);process.exitCode=1});
