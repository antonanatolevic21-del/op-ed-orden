    import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
    import {
      getFirestore,
      initializeFirestore,
      persistentLocalCache,
      persistentMultipleTabManager,
      collection,
      doc,
      addDoc,
      getDoc,
      getDocs,
      setDoc,
      updateDoc,
      deleteDoc,
      onSnapshot,
      query,
      where,
      limit,
      orderBy,
      serverTimestamp,
      deleteField
    } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
    import { getAuth, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, deleteUser, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence, updateProfile } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
    import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-check.js";
    import { firebaseConfig, adminUids, appCheckSiteKey } from './firebase-config.js';

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    if (appCheckSiteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true
      });
    }
    let db;
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (error) {
      // Firestore мог быть инициализирован раньше другим модулем страницы.
      // В таком случае используем уже существующий экземпляр.
      console.warn("Persistent Firestore cache initialization fallback", error);
      db = getFirestore(app);
    }
    const auth = getAuth(app);
    const ACCOUNT_PROFILE_CACHE_KEY = 'op-ed-auth-profile-v1';
    let initPromise = null;

    function normalizeNickname(nickname) {
      return String(nickname || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-zа-яё0-9_-]+/gi, "_")
        .slice(0, 60);
    }

    function currentUserUid() {
      const user = auth.currentUser;
      return user && !user.isAnonymous ? String(user.uid || '') : '';
    }

    function requirePersonalUid() {
      const uid = currentUserUid();
      if (!uid) throw new Error('Для сохранения нужен личный аккаунт.');
      return uid;
    }

    async function scrubLegacyProfileEmails() {
      const uid = currentUserUid();
      if (!adminUids.includes(uid)) return;
      const snapshot = await getDocs(collection(db, 'userProfiles'));
      const writes = snapshot.docs
        .filter(profileDoc => profileDoc.data()?.loginEmail)
        .map(profileDoc => setDoc(profileDoc.ref, {
          loginEmail: deleteField(),
          updatedAt: serverTimestamp()
        }, { merge: true }));
      if (writes.length) await Promise.all(writes);
    }

    async function setAccountPersistence(remember) {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    }

    function cacheAccountProfile(user, profile, remember) {
      if (!user?.uid || !profile) return;
      const payload = JSON.stringify({ uid: user.uid, profile });
      sessionStorage.setItem(ACCOUNT_PROFILE_CACHE_KEY, payload);
      if (remember) localStorage.setItem(ACCOUNT_PROFILE_CACHE_KEY, payload);
      else localStorage.removeItem(ACCOUNT_PROFILE_CACHE_KEY);
    }

    function cachedAccountProfile(uid) {
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const cached = JSON.parse(storage.getItem(ACCOUNT_PROFILE_CACHE_KEY) || 'null');
          if (cached?.uid === uid && cached.profile) return cached.profile;
        } catch (error) { storage.removeItem(ACCOUNT_PROFILE_CACHE_KEY); }
      }
      return null;
    }

    async function registerAccount(nickname, email, password, remember = true) {
      await setAccountPersistence(remember);
      const displayName = String(nickname || '').trim();
      const safeName = normalizeNickname(displayName);
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPassword = String(password || '');
      let credential;
      let createdNow = false;
      try {
        credential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        createdNow = true;
      } catch (error) {
        if (error?.code !== 'auth/email-already-in-use') throw error;
        credential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      }
      try {
        const linkedProfiles = await getDocs(query(collection(db, 'userProfiles'), where('authUid', '==', credential.user.uid), limit(2)));
        const conflict = linkedProfiles.docs.find(profileDoc => profileDoc.id !== safeName);
        if (conflict) {
          const linkedName = String(conflict.data()?.nickname || conflict.id);
          const error = new Error(`Этот email уже привязан к аккаунту «${linkedName}».`);
          error.code = 'auth/email-linked-to-another-nickname';
          throw error;
        }
        await setDoc(doc(db, 'userProfiles', safeName), {
          nickname: displayName,
          nicknameKey: safeName,
          authUid: credential.user.uid,
          authProvider: 'email-password',
          passwordEnabled: true,
          updatedAt: serverTimestamp()
        }, { merge: true });
        await updateProfile(credential.user, { displayName }).catch(error => console.warn('Could not store nickname in Firebase Auth', error));
      } catch (error) {
        if (createdNow) await deleteUser(credential.user).catch(deleteError => console.warn('Could not roll back incomplete account', deleteError));
        throw error;
      }
      const profile = {
        id: safeName,
        nickname: displayName,
        nicknameKey: safeName,
        authUid: credential.user.uid,
        authProvider: 'email-password',
        passwordEnabled: true
      };
      cacheAccountProfile(credential.user, profile, remember);
      return { user: credential.user, profile };
    }

    async function loginAccount(email, password, remember = true) {
      await setAccountPersistence(remember);
      const credential = await signInWithEmailAndPassword(auth, String(email || '').trim().toLowerCase(), String(password || ''));
      return credential.user;
    }

    async function accountProfileByUid(uid) {
      const snapshot = await getDocs(query(collection(db, 'userProfiles'), where('authUid', '==', String(uid || '')), limit(2)));
      const profileDoc = snapshot.docs[0];
      return profileDoc ? { id: profileDoc.id, ...profileDoc.data() } : null;
    }

    async function getAccountProfile(nickname) {
      const safeName = normalizeNickname(nickname);
      if (!safeName) return null;
      const profileDoc = await getDoc(doc(db, 'userProfiles', safeName));
      return profileDoc.exists() ? { id: profileDoc.id, ...profileDoc.data() } : null;
    }

    async function loginPersonalAccount(identifier, password, remember = true) {
      await setAccountPersistence(remember);
      const cleanIdentifier = String(identifier || '').trim();
      if (!cleanIdentifier.includes('@')) throw new Error('Для безопасного входа теперь нужно указывать email.');
      const email = cleanIdentifier.toLowerCase();
      const credential = await signInWithEmailAndPassword(auth, email, String(password || ''));
      const profile = await accountProfileByUid(credential.user.uid);
      if (!profile) throw new Error('Для этого email не найден связанный ник. Открой профиль и заверши регистрацию аккаунта.');
      if (String(profile.authUid || '') !== credential.user.uid) throw new Error('Этот пароль относится к другому аккаунту.');
      if (profile.loginEmail) {
        await setDoc(doc(db, 'userProfiles', profile.id), {
          loginEmail: deleteField(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        delete profile.loginEmail;
      }
      if (credential.user.displayName !== String(profile.nickname || profile.nicknameKey || profile.id || '')) {
        await updateProfile(credential.user, { displayName: String(profile.nickname || profile.nicknameKey || profile.id || '') })
          .catch(error => console.warn('Could not store nickname in Firebase Auth', error));
      }
      cacheAccountProfile(credential.user, profile, remember);
      await scrubLegacyProfileEmails();
      return { user: credential.user, profile };
    }

    async function resumePersonalAccount() {
      if (typeof auth.authStateReady === 'function') await auth.authStateReady();
      const user = auth.currentUser;
      if (!user || user.isAnonymous) return null;
      const cachedProfile = cachedAccountProfile(user.uid);
      if (cachedProfile) {
        const cachedName = String(cachedProfile.nickname || cachedProfile.nicknameKey || cachedProfile.id || '').trim();
        const freshProfile = cachedName
          ? await getAccountProfile(cachedName).catch(error => {
              console.warn('Could not refresh cached account profile', error);
              return null;
            })
          : null;
        if (freshProfile) {
          cacheAccountProfile(user, freshProfile, Boolean(localStorage.getItem(ACCOUNT_PROFILE_CACHE_KEY)));
          return { user, profile: freshProfile };
        }
        return { user, profile: cachedProfile };
      }
      if (user.displayName) {
        const freshProfile = await getAccountProfile(user.displayName).catch(error => {
          console.warn('Could not load current account profile', error);
          return null;
        });
        return {
          user,
          profile: freshProfile || {
            nickname: user.displayName,
            nicknameKey: normalizeNickname(user.displayName),
            authUid: user.uid
          }
        };
      }
      const profile = await accountProfileByUid(user.uid);
      if (!profile) return null;
      cacheAccountProfile(user, profile, true);
      return { user, profile };
    }

    async function resetAccountPassword(email) {
      return sendPasswordResetEmail(auth, String(email || '').trim().toLowerCase());
    }

    async function logoutAccount() {
      sessionStorage.removeItem(ACCOUNT_PROFILE_CACHE_KEY);
      localStorage.removeItem(ACCOUNT_PROFILE_CACHE_KEY);
      await signOut(auth);
      await signInAnonymously(auth);
    }

    function cleanArray(value) {
      if (Array.isArray(value)) return value.map(x => String(x).trim()).filter(Boolean);
      return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
    }

    function cleanOpening(opening, includeCreatedFields = false) {
      const payload = {
        title: String(opening.title || "").trim(),
        anime: String(opening.anime || "").trim(),
        type: opening.type === "ED" ? "ED" : "OP",
        year: opening.year === null || opening.year === undefined || opening.year === "" ? null : Number(opening.year),
        season: String(opening.season || "").trim(),
        studios: cleanArray(opening.studios),
        directors: cleanArray(opening.directors),
        performers: cleanArray(opening.performers),
        franchises: cleanArray(opening.franchises),
        alternativeTitles: cleanArray(opening.alternativeTitles || opening.altTitles || opening.aliases),
        image: String(opening.image || "").trim(),
        fallbackImage: String(opening.fallbackImage || opening.imageFallback || "").trim(),
        sameSongGroupId: String(opening.sameSongGroupId || opening.songGroupId || "").trim(),
        sameSongTitle: String(opening.sameSongTitle || opening.songGroupTitle || "").trim(),
        link: String(opening.link || "").trim(),
        notes: String(opening.notes || "").trim(),
        isChinese: Boolean(opening.isChinese || opening.chinese || opening.isChina || opening.chineseOpening),
        isMovie: Boolean(opening.isMovie || opening.movie || opening.isFilm || opening.filmOpening),
        isShortened: Boolean(opening.isShortened || opening.shortened || opening.isShort || opening.short || opening.shortOpening || opening.shortenedOpening),
        updatedAt: serverTimestamp()
      };
      if (includeCreatedFields) {
        payload.createdBy = String(opening.createdBy || "").trim();
        payload.createdAt = serverTimestamp();
      }
      return payload;
    }

    async function init() {
      if (typeof auth.authStateReady === 'function') await auth.authStateReady();
      if (auth.currentUser) return auth.currentUser;
      if (!initPromise) {
        initPromise = signInAnonymously(auth)
          .then(result => result.user)
          .catch(error => {
            initPromise = null;
            throw error;
          });
      }
      return initPromise;
    }

    function catalogCacheRows(rows) {
      return rows.map(row => {
        const next = { ...row };
        ["createdAt", "updatedAt"].forEach(key => {
          const value = next[key];
          if (!value || typeof value !== "object") return;
          if (typeof value.seconds === "number") {
            next[key] = { seconds: value.seconds, nanoseconds: Number(value.nanoseconds || 0) };
          } else if (typeof value.toMillis === "function") {
            next[key] = { milliseconds: value.toMillis() };
          }
        });
        return next;
      });
    }

    function watchOpenings(callback) {
      let active = true;
      let deliveredCachedRows = false;
      let cachedRowsById = new Map();
      let unsubscribe = () => {};
      const startLiveWatcher = () => {
        if (!active) return;
        unsubscribe = onSnapshot(collection(db, "openings"), snapshot => {
          const rows = snapshot.docs.map(d => {
            const row = { id: d.id, ...d.data() };
            const cached = cachedRowsById.get(String(d.id));
            if (cached && !row.ratingAggregateVersion && cached.ratingAggregateVersion) {
              Object.keys(cached).filter(key => /rating/i.test(key)).forEach(key => {
                if (!(key in row)) row[key] = cached[key];
              });
            }
            return row;
          });
          callback(rows, { cached: false, fromCache: snapshot.metadata.fromCache });
          void window.OC_CATALOG_STORE?.write?.(catalogCacheRows(rows));
        }, error => {
          console.error("watchOpenings error", error);
          if (!deliveredCachedRows) callback([], { cached: false, error: true });
        });
      };

      Promise.resolve(window.OC_CATALOG_STORE?.read?.()).then(snapshot => {
        if (!active || !snapshot?.rows?.length) return;
        deliveredCachedRows = true;
        cachedRowsById = new Map(snapshot.rows.map(row => [String(row.id || ''), row]));
        callback(snapshot.rows, { cached: true, stale: Boolean(snapshot.stale) });
      }).catch(error => console.warn("catalog cache read failed", error)).finally(startLiveWatcher);

      return () => {
        active = false;
        unsubscribe();
      };
    }

    function watchRatings(callback) {
      return onSnapshot(collection(db, "ratings"), snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), error => {
        console.error("watchRatings error", error);
        callback([]);
      });
    }

    function watchRatingsForUser(user, callback) {
      const uid = String(user?.uid || '').trim();
      const nicknameKey = normalizeNickname(user?.nickname || '');
      const rowsBySource = { uid: [], nickname: [] };
      const ready = new Set();
      const unsubs = [];
      const emit = () => {
        const merged = new Map();
        [...rowsBySource.uid, ...rowsBySource.nickname].forEach(row => merged.set(String(row.id || ''), row));
        callback([...merged.values()]);
      };
      const subscribe = (source, constraint) => {
        unsubs.push(onSnapshot(query(collection(db, "ratings"), constraint), snapshot => {
          rowsBySource[source] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          ready.add(source);
          if (ready.size === unsubs.length) emit();
        }, error => {
          console.error(`watchRatingsForUser ${source} error`, error);
          ready.add(source);
          if (ready.size === unsubs.length) emit();
        }));
      };
      if (uid) subscribe('uid', where('ownerUid', '==', uid));
      if (nicknameKey) subscribe('nickname', where('nicknameKey', '==', nicknameKey));
      if (!unsubs.length) {
        callback([]);
        return () => {};
      }
      return () => unsubs.forEach(unsubscribe => unsubscribe());
    }

    function watchManualRanks(callback) {
      return onSnapshot(collection(db, "manualRanks"), snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), error => {
        console.error("watchManualRanks error", error);
        callback([]);
      });
    }

    async function saveManualRanks(nickname, ranks) {
      const displayName = String(nickname || "").trim();
      const safeName = normalizeNickname(displayName);
      if (!safeName) throw new Error("Никнейм обязателен");
      const cleanRanks = {
        OP: Array.isArray(ranks && ranks.OP) ? ranks.OP.map(String).slice(0, 100) : [],
        ED: Array.isArray(ranks && ranks.ED) ? ranks.ED.map(String).slice(0, 100) : []
      };
      const payload = {
        nickname: displayName,
        nicknameKey: safeName,
        ownerUid: requirePersonalUid(),
        manualCreated: true,
        OP: cleanRanks.OP,
        ED: cleanRanks.ED,
        manualOP: cleanRanks.OP,
        manualED: cleanRanks.ED,
        updatedAt: serverTimestamp()
      };
      ['candidatesOP', 'candidatesED'].forEach(field => {
        if (Array.isArray(ranks && ranks[field])) {
          payload[field] = Array.from(new Set(ranks[field].map(String).filter(Boolean)));
        }
      });
      ['pinsOP', 'pinsED'].forEach(field => {
        if (Array.isArray(ranks && ranks[field])) {
          payload[field] = ranks[field]
            .map(pin => ({ id: String(pin?.id || ''), rank: Math.round(Number(pin?.rank) || 0) }))
            .filter(pin => pin.id && pin.rank >= 1 && pin.rank <= 100);
        }
      });
      const results = await Promise.allSettled([
        setDoc(doc(db, "manualRanks", safeName), payload, { merge: true }),
        setDoc(doc(db, "userProfiles", safeName), payload, { merge: true })
      ]);
      const firstOk = results.find(r => r.status === 'fulfilled');
      if (!firstOk) throw results[0].reason;
      return true;
    }

    function watchUserProfiles(callback) {
      return onSnapshot(collection(db, "userProfiles"), snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), error => {
        console.error("watchUserProfiles error", error);
        callback([]);
      });
    }

    function watchEntityCards(callback) {
      return onSnapshot(collection(db, "entityCards"), snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), error => {
        console.error("watchEntityCards error", error);
        callback([]);
      });
    }

    function entityCardId(type, value) {
      const safeType = String(type || "").trim().toLowerCase().replace(/[^a-z]+/g, "");
      const safeValue = String(value || "").trim().toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 120);
      if (!safeType || !safeValue) throw new Error("Не удалось определить альбом");
      return safeType + "__" + safeValue;
    }

    async function saveEntityCard(card) {
      const type = String(card && card.type || "").trim();
      const value = String(card && card.value || "").trim();
      const image = String(card && card.image || "").trim();
      if (!["studios", "performers", "directors", "franchises"].includes(type)) throw new Error("Неизвестный тип альбома");
      if (!value || !image) throw new Error("Укажите объект и обложку");
      const id = entityCardId(type, value);
      await setDoc(doc(db, "entityCards", id), {
        type, value, valueKey: normalizeNickname(value), image,
        updatedBy: requirePersonalUid(), updatedAt: serverTimestamp()
      }, { merge: true });
      return id;
    }

    async function deleteEntityCard(cardId) {
      const safeId = String(cardId || "").trim();
      if (!safeId) throw new Error("Не найден альбом");
      return deleteDoc(doc(db, "entityCards", safeId));
    }

    async function saveUserProfile(nickname, avatar) {
      const displayName = String(nickname || "").trim();
      const safeName = normalizeNickname(displayName);
      if (!safeName) throw new Error("Никнейм обязателен");
      const user = auth.currentUser;
      const uid = requirePersonalUid();
      const cleanAvatar = String(avatar || "🙂").trim() || "🙂";
      await setDoc(doc(db, "userProfiles", safeName), {
        nickname: displayName,
        nicknameKey: safeName,
        authUid: uid,
        avatar: cleanAvatar,
        updatedAt: serverTimestamp()
      }, { merge: true });
      const profile = {
        ...(cachedAccountProfile(uid) || {}),
        id: safeName,
        nickname: displayName,
        nicknameKey: safeName,
        authUid: uid,
        avatar: cleanAvatar
      };
      cacheAccountProfile(user, profile, Boolean(localStorage.getItem(ACCOUNT_PROFILE_CACHE_KEY)));
      return profile;
    }

    async function acknowledgeWelcome(nickname) {
      const displayName = String(nickname || "").trim();
      const safeName = normalizeNickname(displayName);
      if (!safeName) throw new Error("Никнейм обязателен");
      return setDoc(doc(db, "userProfiles", safeName), {
        nickname: displayName,
        nicknameKey: safeName,
        authUid: requirePersonalUid(),
        welcomeAcknowledged: true,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    function cleanUserCollections(rows) {
      return (Array.isArray(rows) ? rows : []).slice(0, 40).map((row, index) => ({
        id: String(row?.id || `collection_${Date.now()}_${index}`).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 80),
        title: String(row?.title || "").trim().slice(0, 100),
        description: String(row?.description || "").trim().slice(0, 500),
        trackIds: Array.from(new Set((Array.isArray(row?.trackIds) ? row.trackIds : []).map(String).filter(Boolean))).slice(0, 200),
        createdAtLocal: String(row?.createdAtLocal || new Date().toISOString()),
        updatedAtLocal: new Date().toISOString()
      })).filter(row => row.title);
    }

    async function saveUserCollections(nickname, collections) {
      const displayName = String(nickname || "").trim();
      const safeName = normalizeNickname(displayName);
      const uid = requirePersonalUid();
      if (!safeName) throw new Error("Никнейм обязателен");
      const profileRef = doc(db, "userProfiles", safeName);
      const profile = await getDoc(profileRef);
      if (!profile.exists()) throw new Error("Профиль не найден");
      if (String(profile.data()?.authUid || "") !== uid && !adminUids.includes(uid)) throw new Error("Нельзя менять подборки другого пользователя");
      const rows = cleanUserCollections(collections);
      await setDoc(profileRef, {
        collections: rows,
        collectionsUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      return rows;
    }

    const JOURNAL_FIELDS = [
      "title", "type", "year", "season", "studios", "directors", "performers",
      "franchises", "alternativeTitles", "sameSongGroupId", "sameSongTitle",
      "image", "fallbackImage", "link", "notes", "isChinese", "isMovie", "isShortened"
    ];

    function journalValue(value) {
      if (Array.isArray(value)) {
        return value
          .slice(0, 30)
          .map(item => String(item || "").trim().slice(0, 180))
          .filter(Boolean);
      }
      if (typeof value === "string") return value.slice(0, 800);
      if (value === undefined) return null;
      return value;
    }

    function journalChanges(before, after) {
      const changes = [];
      JOURNAL_FIELDS.forEach(field => {
        const oldValue = journalValue(before?.[field]);
        const newValue = journalValue(after?.[field]);
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return;
        changes.push({ field, before: oldValue, after: newValue });
      });
      return changes;
    }

    async function appendCatalogJournal(action, openingId, before, after) {
      try {
        const uid = requirePersonalUid();
        if (!adminUids.includes(uid)) return;
        const changes = journalChanges(before, after);
        if (action === "update" && !changes.length) return;
        const journalRef = doc(db, "meta", "catalogJournal");
        const snapshot = await getDoc(journalRef);
        const current = Array.isArray(snapshot.data()?.entries) ? snapshot.data().entries : [];
        const actorName = String(auth.currentUser?.displayName || after?.updatedByName || before?.updatedByName || after?.createdBy || "админ").trim() || "админ";
        const row = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          action,
          openingId: String(openingId || ""),
          title: String(after?.title || before?.title || "Без названия"),
          type: String(after?.type || before?.type || ""),
          actorName,
          actorUid: uid,
          at: new Date().toISOString(),
          changes: changes.slice(0, 20)
        };
        await setDoc(journalRef, {
          entries: [row, ...current].slice(0, 300),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.warn("Catalog journal write failed", error);
      }
    }

    function watchCatalogJournal(callback) {
      return onSnapshot(doc(db, "meta", "catalogJournal"), snapshot => {
        callback(Array.isArray(snapshot.data()?.entries) ? snapshot.data().entries : []);
      }, error => {
        console.error("watchCatalogJournal error", error);
        callback([]);
      });
    }

    async function addOpening(opening) {
      const payload = {
        ...cleanOpening(opening, true),
        updatedByUid: requirePersonalUid(),
        updatedByName: String(auth.currentUser?.displayName || opening?.createdBy || "").trim()
      };
      const created = await addDoc(collection(db, "openings"), payload);
      await appendCatalogJournal("create", created.id, null, { ...opening, ...payload });
      return created;
    }

    async function updateOpening(openingId, opening) {
      const safeOpeningId = String(openingId || "").trim();
      if (!safeOpeningId) throw new Error("Не найден id трека");
      const openingRef = doc(db, "openings", safeOpeningId);
      const beforeSnapshot = await getDoc(openingRef);
      const before = beforeSnapshot.exists() ? beforeSnapshot.data() : {};
      const payload = {
        ...cleanOpening(opening, false),
        updatedByUid: requirePersonalUid(),
        updatedByName: String(auth.currentUser?.displayName || "").trim()
      };
      await updateDoc(openingRef, payload);
      await appendCatalogJournal("update", safeOpeningId, before, { ...before, ...opening, ...payload });
      return true;
    }

    async function updateOpeningFallbackImage(openingId, fallbackImage) {
      const safeOpeningId = String(openingId || "").trim();
      if (!safeOpeningId) throw new Error("Не найден id трека");
      const openingRef = doc(db, "openings", safeOpeningId);
      const beforeSnapshot = await getDoc(openingRef);
      const before = beforeSnapshot.exists() ? beforeSnapshot.data() : {};
      const payload = {
        fallbackImage: String(fallbackImage || "").trim(),
        updatedByUid: requirePersonalUid(),
        updatedByName: String(auth.currentUser?.displayName || "").trim(),
        updatedAt: serverTimestamp()
      };
      await updateDoc(openingRef, payload);
      await appendCatalogJournal("update", safeOpeningId, before, { ...before, ...payload });
      return true;
    }

    async function deleteOpening(openingId) {
      const safeOpeningId = String(openingId || "").trim();
      if (!safeOpeningId) throw new Error("Не найден id трека");
      const openingRef = doc(db, "openings", safeOpeningId);
      const beforeSnapshot = await getDoc(openingRef);
      const before = beforeSnapshot.exists() ? beforeSnapshot.data() : {};
      await deleteDoc(openingRef);
      await appendCatalogJournal("delete", safeOpeningId, before, null);
      return true;
    }

    async function saveRating(openingId, nickname, score) {
      const displayName = String(nickname || "").trim();
      const safeName = normalizeNickname(displayName);
      const safeOpeningId = String(openingId || "").trim();
      if (!safeName) throw new Error("Никнейм обязателен");
      if (!safeOpeningId) throw new Error("Не найден id трека");
      return setDoc(doc(db, "ratings", `${safeName}__${safeOpeningId}`), {
        openingId: safeOpeningId,
        nickname: displayName,
        nicknameKey: safeName,
        ownerUid: requirePersonalUid(),
        score: Number(score),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    async function deleteRating(openingId, nickname, fields = ["score", "songScore", "visualScore"]) {
      const displayName = String(nickname || "").trim();
      const safeName = normalizeNickname(displayName);
      const safeOpeningId = String(openingId || "").trim();
      if (!safeName) throw new Error("Никнейм обязателен");
      if (!safeOpeningId) throw new Error("Не найден id трека");
      const payload = { openingId: safeOpeningId, nickname: displayName, nicknameKey: safeName, ownerUid: requirePersonalUid(), updatedAt: serverTimestamp() };
      fields.forEach(field => { payload[field] = deleteField(); });
      return setDoc(doc(db, "ratings", `${safeName}__${safeOpeningId}`), payload, { merge: true });
    }

    window.OPED_DB = {
      init,
      watchOpenings,
      watchRatings,
      watchRatingsForUser,
      watchManualRanks,
      watchUserProfiles,
      watchEntityCards,
      saveEntityCard,
      deleteEntityCard,
      saveManualRanks,
      saveUserProfile,
      saveUserCollections,
      watchCatalogJournal,
      acknowledgeWelcome,
      addOpening,
      updateOpening,
      updateOpeningFallbackImage,
      deleteOpening,
      saveRating,
      deleteRating,
      normalizeNickname,
      registerAccount,
      loginAccount,
      getAccountProfile,
      loginPersonalAccount,
      resumePersonalAccount,
      resetAccountPassword,
      logoutAccount,
      currentUserUid
    };
    window.dispatchEvent(new Event("oped-db-ready"));