export const productState = {
  db: null,
  openings: [],
  ratings: [],
  profiles: [],
  entityCards: [],
  ready: false
};

const listeners = new Set();
let started = false;

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

export async function startProductState() {
  if (started) return productState;
  started = true;
  try {
    const db = await waitForDb();
    productState.db = db;
    if (typeof db.watchOpenings === 'function') db.watchOpenings(rows => {
      productState.openings = Array.isArray(rows) ? rows : [];
      productState.ready = true;
      emit('openings');
    });
    if (typeof db.watchRatings === 'function') db.watchRatings(rows => {
      productState.ratings = Array.isArray(rows) ? rows : [];
      emit('ratings');
    });
    if (typeof db.watchUserProfiles === 'function') db.watchUserProfiles(rows => {
      productState.profiles = Array.isArray(rows) ? rows : [];
      emit('profiles');
    });
    if (typeof db.watchEntityCards === 'function') db.watchEntityCards(rows => {
      productState.entityCards = Array.isArray(rows) ? rows : [];
      emit('entityCards');
    });
    emit('ready');
  } catch (error) {
    console.error('Product state could not start', error);
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
