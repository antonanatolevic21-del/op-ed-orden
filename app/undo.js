import { waitForDb } from './state.js';
import { showToast } from './toast.js';

let patched = false;
let firebaseToolsPromise = null;

async function firebaseTools() {
  if (!firebaseToolsPromise) {
    firebaseToolsPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
    ]).then(([appMod, fsMod]) => ({ appMod, fsMod }));
  }
  const { appMod, fsMod } = await firebaseToolsPromise;
  if (!appMod.getApps().length) throw new Error('Firebase app is not ready');
  return {
    db: fsMod.getFirestore(appMod.getApp()),
    doc: fsMod.doc,
    getDoc: fsMod.getDoc,
    setDoc: fsMod.setDoc,
    serverTimestamp: fsMod.serverTimestamp
  };
}

async function snapshotDocument(collectionName, id) {
  if (!id) return null;
  try {
    const { db, doc, getDoc } = await firebaseTools();
    const snapshot = await getDoc(doc(db, collectionName, String(id)));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    console.warn('Undo snapshot could not be read', collectionName, id, error);
    return null;
  }
}

async function restoreDocument(collectionName, id, row) {
  if (!id || !row) return;
  const { db, doc, setDoc, serverTimestamp } = await firebaseTools();
  const copy = { ...row };
  delete copy.id;
  copy.updatedAt = serverTimestamp();
  await setDoc(doc(db, collectionName, String(id)), copy, { merge: true });
}

function showUndo(message, action) {
  showToast(message, {
    type: 'warning',
    timeout: 8000,
    actionLabel: 'Отменить',
    action: async () => {
      await action();
      showToast('Восстановлено ✓', { type: 'success' });
    }
  });
}

export async function initUndo() {
  if (patched) return;
  const api = await waitForDb().catch(() => null);
  if (!api || patched) return;
  patched = true;

  if (typeof api.deleteOpening === 'function') {
    const original = api.deleteOpening.bind(api);
    api.deleteOpening = async openingId => {
      const snapshot = await snapshotDocument('openings', openingId);
      const result = await original(openingId);
      if (snapshot) {
        showUndo(`Трек «${snapshot.title || 'Без названия'}» удалён.`, async () => {
          await restoreDocument('openings', snapshot.id, snapshot);
          const managedFallback = /^\.?\/?images\/.+\.webp(?:$|\?)/i.test(String(snapshot.fallbackImage || ''));
          if (managedFallback) showToast('Трек восстановлен. Запасная локальная картинка могла быть удалена вместе с ним.', { type: 'warning', timeout: 6500 });
        });
      }
      return result;
    };
  }

  if (typeof api.deleteRating === 'function') {
    const original = api.deleteRating.bind(api);
    api.deleteRating = async (openingId, nickname, fields) => {
      const safeName = typeof api.normalizeNickname === 'function'
        ? api.normalizeNickname(nickname)
        : String(nickname || '').trim().toLowerCase();
      const ratingId = `${safeName}__${String(openingId || '').trim()}`;
      const snapshot = await snapshotDocument('ratings', ratingId);
      const result = await original(openingId, nickname, fields);
      if (snapshot) showUndo('Оценка удалена.', () => restoreDocument('ratings', ratingId, snapshot));
      return result;
    };
  }

  if (typeof api.deleteEntityCard === 'function') {
    const original = api.deleteEntityCard.bind(api);
    api.deleteEntityCard = async cardId => {
      const snapshot = await snapshotDocument('entityCards', cardId);
      const result = await original(cardId);
      if (snapshot) showUndo(`Альбом «${snapshot.value || ''}» удалён.`, () => restoreDocument('entityCards', snapshot.id, snapshot));
      return result;
    };
  }
}
