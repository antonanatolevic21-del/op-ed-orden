const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const tabs=fs.readFileSync('profile-tabs.js','utf8');
let moves=0;
const stats={children:[],insertBefore(node,before){
  const old=this.children.indexOf(node);if(old>=0)this.children.splice(old,1);
  this.children.splice(this.children.indexOf(before),0,node);node.parent=this;moves++;
},querySelector(selector){return this.children.find(n=>selector.endsWith(n.className));}};
const node=(name,card=false,leader=false)=>({className:name,leader,dataset:{},classList:{contains:c=>card&&c==='oc-stat-card',toggle(){}},parent:card?stats:null,
 get nextElementSibling(){return this.parent?.children[this.parent.children.indexOf(this)+1]||null;},remove(){stats.children.splice(stats.children.indexOf(this),1);}});
stats.children=[node('metric',true),node('leader',true,true)];
const root={dataset:{profileView:'overview'},querySelector:()=>stats};
const context={panel:()=>root,isLeaderStat:n=>n.leader,statTone:()=> 'neutral',overviewHeading:kind=>node('oc-profile-overview-heading-'+kind),statsEnhanceScheduled:true};
vm.createContext(context);
vm.runInContext(tabs.slice(tabs.indexOf('  function enhanceOverviewStats()'),tabs.indexOf('  function scheduleOverviewStats()')),context);
context.enhanceOverviewStats();assert.equal(moves,2);
for(let i=0;i<60;i++)context.enhanceOverviewStats();
assert.equal(moves,2,'stable headings must not trigger another childList mutation on each animation frame');
root.dataset.profileView='ratings';stats.children=stats.children.filter(n=>n.className==='metric'||n.className==='leader');
context.enhanceOverviewStats();assert.equal(moves,2,'hidden overview stays idle');
console.log('PASS: overview decoration settles after one pass instead of triggering itself forever');

const source=fs.readFileSync('index-app.js','utf8');
const calls=[];
const ctx={profilePanel:{dataset:{profileView:'overview'}},profileUserSelect:{value:'Alice'},profileDeleteBtn:null,registerNameInput:null,
 myName:'Alice',entries:[],filters:{},ratingScale:'int',dataVersion:1,firebaseRatingsScope:'all',remoteDataState:{ratings:{ready:true},openings:{ready:true}},
 populateProfileUsers(){},ratedListFor:()=>[],applyFilters:rows=>rows,applyFiltersIgnoringType:rows=>rows,
 computeProfileStats:()=>{calls.push('compute');return {};},renderProfileStats:()=>calls.push('overview'),
 populateArScoreOptions:()=>calls.push('score-options'),renderAllRatings:()=>calls.push('ratings'),renderProfileRerate:()=>calls.push('rerate'),renderDailyProfilePanel:()=>calls.push('daily')};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf("    let profileOverviewRenderKey = '';"),source.indexOf('    function setTopMode(')),ctx);
ctx.renderProfile();assert.deepEqual(calls,['compute','overview']);
ctx.renderProfile();assert.equal(calls.length,2,'unchanged overview is reused');
ctx.dataVersion++;ctx.renderProfile();assert.equal(calls.length,4,'new ratings invalidate overview');
for(const [view,expected] of [['ratings',['score-options','ratings']],['rerate',['rerate']],['daily',['daily']],['events',[]],['comparison',[]]]) {
 calls.length=0;ctx.profilePanel.dataset.profileView=view;ctx.renderProfile();assert.deepEqual(calls,expected,view+' renders only its visible content');
}
console.log('PASS: overview cache invalidation and independent ratings/rerate/daily/events/comparison rendering');
