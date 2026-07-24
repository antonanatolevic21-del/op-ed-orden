export const productState = {
  db: null,
  openings: [],
  ratings: [],
  profiles: [],
  entityCards: [],
  ready: false
};

const listeners = new Set();
const loaded = new Set();
const pending = new Map();
let started = false;
let firebaseModulesPromise = null;

const DATASETS = {
  openings: { collectionName: 'openings', stateKey: 'openings' },
  ratings: { collectionName: 'ratings', stateKey: 'ratings' },
  profiles: { collectionName: 'userProfiles', stateKey: 'profiles' },
  entityCards: { collectionName: 'entityCards', stateKey: 'entityCards' }
};

function emit(reason = 'update') {
  const detail = { state: productState, reason };
  listeners.forEach(listener => {
    try { listener(detail); } catch (error) { console.error('Product state listener failed', error); }
  });
  window.dispatchEvent(new CustomEvent('oped-product-state', { detail }));
}

export function subscribeProductState(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener({ state: productState, reason: 'subscribe' });
  return () => listeners.delete(listener);
}

export function waitForDb() {
  if (window.OPED_DB) return Promise.resolve(window.OPED_DB);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('OPED_DB did not become ready')), 12000);
    window.addEventListener('oped-db-ready', () => {
      window.clearTimeout(timeout);
      resolve(window.OPED_DB);
    }, { once: true });
  });
}

async function firestoreTools() {
  if (!firebaseModulesPromise) {
    firebaseModulesPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
    ]).then(([appMod, fsMod]) => ({ appMod, fsMod }));
  }
  const { appMod, fsMod } = await firebaseModulesPromise;
  if (!appMod.getApps().length) throw new Error('Firebase app is not ready');
  return {
    db: fsMod.getFirestore(appMod.getApp()),
    collection: fsMod.collection,
    getDocs: fsMod.getDocs
  };
}

async function loadDataset(name, force = false) {
  const spec = DATASETS[name];
  if (!spec) return [];
  if (!force && loaded.has(name)) return productState[spec.stateKey];
  if (!force && pending.has(name)) return pending.get(name);

  const promise = (async () => {
    await waitForDb();
    const { db, collection, getDocs } = await firestoreTools();
    const snapshot = await getDocs(collection(db, spec.collectionName));
    const rows = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    productState[spec.stateKey] = rows;
    loaded.add(name);
    if (name === 'openings') productState.ready = true;
    emit(name);
    return rows;
  })().finally(() => pending.delete(name));

  pending.set(name, promise);
  return promise;
}

export async function ensureProductData(parts = ['openings'], options = {}) {
  const names = Array.from(new Set(Array.isArray(parts) ? parts : [parts])).filter(name => DATASETS[name]);
  await Promise.all(names.map(name => loadDataset(name, Boolean(options.force))));
  return productState;
}

export async function startProductState() {
  if (started) return productState;
  started = true;
  try {
    productState.db = await waitForDb();
    emit('ready');
  } catch (error) {
    console.error('Product feature state could not start', error);
    emit('error');
  }
  return productState;
}

export function openingById(id) {
  const key = String(id || '');
  return productState.openings.find(row => String(row.id) === key) || null;
}

export function currentProfileName() {
  return String(document.querySelector('#oc-myname')?.value || localStorage.getItem('my-display-name') || '').trim();
}
