(() => {
  if (window.__OC_UNDO_ACTIONS_READY__) return;

  let lastOpenedTrackId = '';
  let firestorePromise = null;

  function nickname() {
    return String(localStorage.getItem('op-ed-primary-account-name') || '').trim();
  }

  async function firestore() {
    if (!firestorePromise) {
      firestorePromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
      ]).then(([appApi, dbApi]) => {
        const app = appApi.getApps().length ? appApi.getApp() : null;
        if (!app) throw new Error('Firebase ещё не инициализирован.');
        return { ...dbApi, db: dbApi.getFirestore(app) };
      });
    }
    return firestorePromise;
  }

  function toast(message, options = {}) {
    if (window.OC_TOAST?.show) return window.OC_TOAST.show(message, options);
    return null;
  }

  function currentTrackId(button) {
    return String(button?.dataset?.id || new URL(location.href).searchParams.get('track') || lastOpenedTrackId || '').trim();
  }

  function ratingFields(button) {
    if (button.matches('[data-card-action="delete-rating"],[data-action="all-delete-rating"]')) return ['score', 'songScore', 'visualScore'];
    const slider = button.closest('.oc-unified-card,.oc-card,.oc-entry-card,article,div')?.querySelector?.('.oc-slider');
    const personal = /отметк|1\s*[–-]\s*5/i.test(button.textContent || '') || (slider && Number(slider.max) <= 5);
    return personal ? ['personalScore'] : ['score', 'songScore', 'visualScore'];
  }

  async function deleteRatingWithUndo(button) {
    const id = currentTrackId(button);
    const name = nickname();
    if (!id || !name || !window.OPED_DB?.deleteRating) return false;
    if (!window.confirm('Удалить твою оценку? Её можно будет вернуть в течение нескольких секунд.')) return true;

    const api = await firestore();
    const safeName = window.OPED_DB.normalizeNickname(name);
    const ref = api.doc(api.db, 'ratings', `${safeName}__${id}`);
    const snapshot = await api.getDoc(ref);
    const saved = snapshot.exists() ? snapshot.data() : null;
    const fields = ratingFields(button);

    await window.OPED_DB.deleteRating(id, name, fields);
    document.querySelector('#oc-opening-modal [data-modal-close]')?.click();

    toast('Оценка удалена.', {
      type: 'success',
      actionLabel: saved ? 'Отменить' : '',
      duration: 8000,
      onAction: saved ? async () => {
        await api.setDoc(ref, saved, { merge: false });
        toast('Оценка восстановлена ✓', { type: 'success', force: true });
      } : null
    });
    return true;
  }

  async function deleteTrackWithUndo(button) {
    const id = currentTrackId(button);
    if (!id || !window.OPED_DB?.deleteOpening) return false;
    const api = await firestore();
    const ref = api.doc(api.db, 'openings', id);
    const snapshot = await api.getDoc(ref);
    if (!snapshot.exists()) return false;
    const saved = snapshot.data();

    await window.OPED_DB.deleteOpening(id);
    window.OC_CATALOG_CACHE?.invalidate?.();
    toast('Трек удалён.', {
      type: 'success',
      actionLabel: 'Отменить',
      duration: 8000,
      onAction: async () => {
        await api.setDoc(ref, saved, { merge: false });
        window.OC_CATALOG_CACHE?.invalidate?.();
        toast('Трек восстановлен ✓', { type: 'success', force: true });
      }
    });
    return true;
  }

  document.addEventListener('click', event => {
    const open = event.target.closest('[data-action="open-card"]');
    if (open?.dataset?.id) lastOpenedTrackId = String(open.dataset.id);
  }, true);

  document.addEventListener('click', event => {
    const ratingDelete = event.target.closest('[data-action="delete-rating"],[data-action="all-delete-rating"],[data-card-action="delete-rating"]');
    if (ratingDelete) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void deleteRatingWithUndo(ratingDelete).catch(error => {
        console.error('Undoable rating delete failed', error);
        toast('Не удалось удалить оценку.', { type: 'error', force: true });
      });
      return;
    }

    const trackDelete = event.target.closest('[data-action="delete"]');
    if (!trackDelete || trackDelete.getAttribute('data-confirm') !== '1') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void deleteTrackWithUndo(trackDelete).catch(error => {
      console.error('Undoable track delete failed', error);
      toast('Не удалось удалить трек.', { type: 'error', force: true });
    });
  }, true);

  window.__OC_UNDO_ACTIONS_READY__ = true;
})();
