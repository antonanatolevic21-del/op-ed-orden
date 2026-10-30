(() => {
  if (window.OC_TOP100_BACKUP_IMAGES) return;
  let connection;
  function open() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('Браузер не разрешает хранение резервных PNG.')); return; }
      const request = indexedDB.open('oc-top100-backup-images-v1', 1);
      let finished = false;
      const fail = error => { finished = true; clearTimeout(timeout); reject(error); };
      const timeout = setTimeout(() => fail(new Error('Хранилище резервных PNG не отвечает.')), 10000);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('snapshots')) request.result.createObjectStore('snapshots', { keyPath: 'id' });
      };
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error('Закрой другие старые вкладки «Абобы» и повтори создание копии.'));
      request.onsuccess = () => {
        clearTimeout(timeout);
        const db = request.result;
        if (finished) { db.close(); return; }
        finished = true;
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
    }).catch(error => { connection = null; throw error; });
    return connection;
  }
  async function transaction(mode, run) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Не удалось сохранить резервные PNG.'));
      try { run(tx.objectStore('snapshots'), value => { result = value; }); }
      catch (error) { tx.abort(); reject(error); }
    });
  }
  window.OC_TOP100_BACKUP_IMAGES = {
    async get(id, key) {
      if (!id) return null;
      return transaction('readonly', (store, done) => {
        const request = store.get(id);
        request.onsuccess = () => done(request.result?.key === key ? request.result : null);
      });
    },
    async put(record) {
      if (!record?.id || !record.key || !Array.isArray(record.files) || record.files.some(file =>
        !(file.blob instanceof Blob) || file.blob.type !== 'image/png' || !file.blob.size
      )) throw new Error('Не удалось подготовить резервные PNG.');
      return transaction('readwrite', store => store.put(record));
    },
    async prune(key, keepIds) {
      const keep = new Set(keepIds);
      return transaction('readwrite', store => {
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          // Another tab may have written its PNGs but not their index yet. Leave fresh records alone.
          if (cursor.value.key === key && !keep.has(cursor.value.id) && cursor.value.savedAt < Date.now() - 5 * 60 * 1000) cursor.delete();
          cursor.continue();
        };
      });
    },
    async remove(id, key) {
      return transaction('readwrite', store => {
        const request = store.get(id);
        request.onsuccess = () => { if (request.result?.key === key) store.delete(id); };
      });
    }
  };
})();
