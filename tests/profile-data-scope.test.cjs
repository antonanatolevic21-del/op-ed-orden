const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('index-app.js', 'utf8');
const firebase = fs.readFileSync('firebase-app.js', 'utf8');
const subscriptions = [];
const ctx = {
  console, queueMicrotask, db: {},
  normalizeNickname: name => String(name).trim().toLowerCase(),
  doc: (_, collection, id) => ({ collection, id }),
  collection: (_, collection) => ({ collection }),
  where: (field, op, value) => ({ field, op, value }),
  query: (target, constraint) => ({ ...target, constraint }),
  onSnapshot(target, receive, fail) {
    const subscription = { target, receive, fail, stopped: false };
    subscriptions.push(subscription);
    return () => { subscription.stopped = true; };
  }
};
vm.createContext(ctx);
vm.runInContext(firebase.slice(firebase.indexOf('    function watchRatingsForUser('), firebase.indexOf('    function watchManualRanks(callback)')), ctx);
let result;
const stop = ctx.watchRatingsForUsers([{ nickname: 'Alice', uid: 'uid-a' }, { nickname: 'Bob' }], rows => { result = rows; });
assert.equal(subscriptions.length, 5);
assert.ok(subscriptions.every(sub => sub.target.constraint), 'no unfiltered ratings collection');
subscriptions.forEach((sub, i) => sub.receive({ docs: [{ id: 'same', data: () => ({ nickname: i < 3 ? 'Alice' : 'Bob' }) }] }));
assert.equal(result.length, 1, 'overlapping uid/name queries are deduplicated');
stop(); result = null;
subscriptions[0].receive({ docs: [] });
assert.equal(result, null, 'callbacks from cancelled ratings cannot overwrite current data');
const before = subscriptions.length;
let profileRows;
const stopProfiles = ctx.watchUserProfilesForUsers(['Alice', 'Bob', 'ALICE'], rows => { profileRows = rows; });
const docs = subscriptions.slice(before);
assert.deepEqual(docs.map(sub => sub.target), [{ collection: 'userProfiles', id: 'alice' }, { collection: 'userProfiles', id: 'bob' }]);
docs[0].receive({ id: 'alice', exists: () => true, data: () => ({ nickname: 'Alice' }) });
assert.equal(profileRows, undefined, 'wait for all selected profiles');
docs[1].receive({ id: 'bob', exists: () => false });
assert.equal(profileRows.length, 1, 'missing profile does not hang loading');
stopProfiles(); profileRows = null;
docs[0].receive({ id: 'alice', exists: () => true, data: () => ({ nickname: 'late' }) });
assert.equal(profileRows, null);

(async () => {
  const state = { ratings: { started: true, ready: false } };
  const lifecycle = { remoteDataState: state };
  vm.createContext(lifecycle);
  vm.runInContext(source.slice(source.indexOf('    function createRemoteDataPromise('), source.indexOf('    function runWhenBrowserIsIdle(')), lifecycle);
  const pending = lifecycle.createRemoteDataPromise('ratings');
  lifecycle.resetRemoteDataSubscription('ratings');
  await pending;
  assert.equal(state.ratings.ready, false);
  state.ratings.ready = true;
  lifecycle.resetRemoteDataSubscription('ratings');
  assert.equal(state.ratings.ready, false, 'previous snapshot readiness cannot leak to a new route');

  const calls = [];
  const app = {
    activeTab: 'profile', profilePanel: { dataset: { profileView: 'overview' } },
    profileUserSelect: { value: 'Alice' }, profileUser: 'Alice', myName: 'Alice', authenticatedUid: 'uid-a',
    currentPersonalUid: () => 'uid-a', manualUserSafeKey: n => n.toLowerCase(), manualSameUser: (a,b) => a === b,
    getManualRanksForUser: () => ({ OP: ['top-song'] }), dailyProfileFor: () => ({ rerateIds: ['rerate-song'] }),
    firebaseDbInstance: {}, firebaseOpenings: [], firebaseRatings: [], firebaseRatingsScope: 'none',
    firebaseUnsubRatings: null, firebaseUnsubOpenings: null,
    remoteDataState: { ratings: { ready: false }, openings: { ready: false }, manualRanks: { ready: false }, userProfiles: { ready: false } },
    createRemoteDataPromise() { return Promise.resolve(); }, resetRemoteDataSubscription(kind) { this.remoteDataState[kind].ready = false; this.remoteDataState[kind].started = false; },
    rebuildEntriesFromFirebase() {}, rebuildManualRanksFromRatingDocs() {}, markRemoteDataReady(kind) { this.remoteDataState[kind].ready = true; },
    populateFilterOptions() {}, setStatus() {}
  };
  // Functions reference globals rather than a receiver.
  app.resetRemoteDataSubscription = kind => { app.remoteDataState[kind].ready = false; app.remoteDataState[kind].started = false; };
  app.markRemoteDataReady = kind => { app.remoteDataState[kind].ready = true; };
  vm.createContext(app);
  vm.runInContext(source.slice(source.indexOf("    let openingsScopeKey = ''"), source.indexOf('    const profileWatcherKeys')), app);
  const mockDb = { watchRatings() { throw Error('whole ratings forbidden'); }, watchRatingsForUsers(users, receive) { calls.push({ users, receive, stopped: false }); const call = calls.at(-1); return () => { call.stopped = true; }; } };
  assert.equal(app.preferredRatingsScope(), 'user', 'profile never needs aggregate fallback to all ratings');
  app.ensureRatingsWatcher(mockDb);
  assert.equal(calls[0].users[0].nickname, 'Alice');
  app.profileUserSelect.value = 'Bob'; app.ensureRatingsWatcher(mockDb);
  assert.ok(calls[0].stopped);
  calls[0].receive([{ openingId: 'stale' }]); assert.equal(app.firebaseRatings.length, 0);
  calls[1].receive([{ openingId: 'bob-song' }]);
  assert.deepEqual(Array.from(app.scopedProfileOpeningIds()), ['bob-song', 'rerate-song', 'top-song']);
  app.profilePanel.dataset.profileView = 'comparison';
  vm.runInContext("comparisonProfileUsers = ['Alice', 'Bob']", app);
  app.ensureRatingsWatcher(mockDb);
  assert.deepEqual(Array.from(calls.at(-1).users, user => user.nickname), ['Alice', 'Bob']);
  console.log('PASS: selected profiles only, scoped song IDs, comparison pair, missing documents, cancelled callbacks and settled route waiters');
})().catch(error => { console.error(error); process.exitCode = 1; });
