const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const firebase=fs.readFileSync('firebase-app.js','utf8');
const requests=[];
const ctx={URL,AbortController,setTimeout,clearTimeout,appCheckInstance:null,
  init:async()=>{},auth:{currentUser:{getIdToken:async()=> 'test-token'}},firebaseConfig:{projectId:'test-project'},
  normalizeNickname:n=>n.toLowerCase(),fetch:async(url,options)=>{
    requests.push({url:new URL(url),options});
    return {ok:true,json:async()=>requests.length===1
      ? {documents:[{fields:{nickname:{stringValue:'Alice'}}},{fields:{displayName:{stringValue:'Bob'}}}],nextPageToken:'next'}
      : {documents:[{fields:{nickname:{stringValue:'ALICE'}}},{fields:{name:{stringValue:'Carol'}}}]}};
  }};
vm.createContext(ctx);
vm.runInContext(firebase.slice(firebase.indexOf('    let profileNicknameDirectoryPromise'),firebase.indexOf('    // Only subscribe')),ctx);
(async()=>{
  const first=ctx.listProfileNicknames();assert.equal(first,ctx.listProfileNicknames(),'concurrent directory loads share one request');
  const names=await first;assert.equal(names.length,3);
  for(const request of requests){
    assert.deepEqual(request.url.searchParams.getAll('mask.fieldPaths'),['nickname','displayName','name']);
    assert.ok(request.url.pathname.endsWith('/userProfiles'));
    assert.equal(request.options.headers.Authorization,'Bearer test-token');
  }
  assert.equal(requests[1].url.searchParams.get('pageToken'),'next');
  await ctx.listProfileNicknames();assert.equal(requests.length,2,'directory is loaded only once per visit');
  let failed=true;
  const retryCtx={...ctx,fetch:async()=>{if(failed) return {ok:false,status:503};return {ok:true,json:async()=>({documents:[]})};}};
  vm.createContext(retryCtx);vm.runInContext(firebase.slice(firebase.indexOf('    let profileNicknameDirectoryPromise'),firebase.indexOf('    // Only subscribe')),retryCtx);
  await assert.rejects(retryCtx.listProfileNicknames());failed=false;await retryCtx.listProfileNicknames();
  const handlers={};
  const picker={window:{OC_PROFILE_NICKNAMES:['Alice','Bob','Carol'],OC_APP_DATA:{userProfiles:[{nickname:'Alice',avatar:'🙂'}]},addEventListener:(type,fn)=>handlers[type]=fn},
    document:{documentElement:{},addEventListener(){}},requestAnimationFrame(){},MutationObserver:class{observe(){}},localStorage:{getItem:()=>null}};
  vm.createContext(picker);
  const source=fs.readFileSync('registered-users-only.js','utf8').replace('})();',"window.testNames = () => [...knownByKey.values()].map(profileName); })();");
  vm.runInContext(source,picker);
  assert.equal(picker.window.testNames().length,3);
  handlers['oped:user-profiles-updated']({detail:{rows:[{nickname:'Bob',avatar:'🐱'}]}});
  assert.equal(picker.window.testNames().length,3,'selected-profile snapshot cannot erase the nickname directory');
  handlers['oped:profile-nicknames-updated']({detail:{names:['Alice','Bob','Carol','Dave']}});
  assert.equal(picker.window.testNames().length,4);
  console.log('PASS: server field masks, pagination, shared requests, retry and full nickname list retained across scoped profile updates');
})().catch(error=>{console.error(error);process.exitCode=1;});
