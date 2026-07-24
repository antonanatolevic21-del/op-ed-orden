import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import { productState, waitForDb } from './state.js';
import { showToast } from './toast.js';

let patched = false;

function cleanSnapshot(row) {
  if (!row) return null;
  const copy = { ...row };
  delete copy.id;
  copy.updatedAt = serverTimestamp();
  return copy;
}

async function restoreDocument(collectionName, id, row) {
  if (!id || !row) return;
  const app = getApps().length ? getApp() : null;
  if (!app) throw new Error('Firebase app is not ready');
  const db = getFirestore(app);
  await setDoc(doc(db, collectionName, String(id)), cleanSnapshot(row), { merge: true });
}

function ratingSnapshot(openingId, nickname) {
  const normalize = productState.db?.normalizeNickname || (value => String(value || '').trim().toLowerCase());
  const key = normalize(nickname);
  return productState.ratings.find(row => String(row.openingId) === String(openingId) && (String(row.nicknameKey || '') === key || normalize(row.nickname) === key)) || null;
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
  const db = await waitForDb().catch(() => null);
  if (!db || patched) return;
  patched = true;

  if (typeof db.deleteOpening === 'function') {
    const original = db.deleteOpening.bind(db);
    db.deleteOpening = async openingId => {
      const snapshot = productState.openings.find(row => String(row.id) === String(openingId));
      const result = await original(openingId);
      if (snapshot) showUndo(`Трек «${snapshot.title || 'Без названия'}» удалён.`, () => restoreDocument('openings', snapshot.id, snapshot));
      return result;
    };
  }

  if (typeof db.deleteRating === 'function') {
    const original = db.deleteRating.bind(db);
    db.deleteRating = async (openingId, nickname, fields) => {
      const snapshot = ratingSnapshot(openingId, nickname);
      const result = await original(openingId, nickname, fields);
      if (snapshot) showUndo('Оценка удалена.', () => restoreDocument('ratings', snapshot.id || `${db.normalizeNickname(nickname)}__${openingId}`, snapshot));
      return result;
    };
  }

  if (typeof db.deleteEntityCard === 'function' && typeof db.saveEntityCard === 'function') {
    const original = db.deleteEntityCard.bind(db);
    db.deleteEntityCard = async cardId => {
      const snapshot = productState.entityCards.find(row => String(row.id) === String(cardId));
      const result = await original(cardId);
      if (snapshot) showUndo(`Альбом «${snapshot.value || ''}» удалён.`, () => db.saveEntityCard(snapshot));
      return result;
    };
  }
}
