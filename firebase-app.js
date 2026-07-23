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
      const registeredUser = { uid: credential.user.uid };
      await signOut(auth);
      await signInAnonymously(auth);
      return registeredUser;
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
      if (cachedProfile) return { user, profile: cachedProfile };
      if (user.displayName) {
        return { user, profile: { nickname: user.displayName, nicknameKey: normalizeNickname(user.displayName), authUid: user.uid } };
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

    function watchOpenings(callback) {
      return onSnapshot(collection(db, "openings"), snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), error => {
        console.error("watchOpenings error", error);
        callback([]);
      });
    }

    function watchRatings(callback) {
      return onSnapshot(collection(db, "ratings"), snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), error => {
        console.error("watchRatings error", error);
        callback([]);
      });
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
        OP: cleanRanks.OP,
        ED: cleanRanks.ED,
        manualOP: cleanRanks.OP,
        manualED: cleanRanks.ED,
        updatedAt: serverTimestamp()
      };
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

    async function saveUserProfile(nickname, avatar) {
      const displayName = String(nickname || "").trim();
      const safeName = normalizeNickname(displayName);
      if (!safeName) throw new Error("Никнейм обязателен");
      return setDoc(doc(db, "userProfiles", safeName), {
        nickname: displayName,
        nicknameKey: safeName,
        authUid: requirePersonalUid(),
        avatar: String(avatar || "🙂").trim() || "🙂",
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    async function addOpening(opening) {
      return addDoc(collection(db, "openings"), cleanOpening(opening, true));
    }

    async function updateOpening(openingId, opening) {
      const safeOpeningId = String(openingId || "").trim();
      if (!safeOpeningId) throw new Error("Не найден id трека");
      return updateDoc(doc(db, "openings", safeOpeningId), cleanOpening(opening, false));
    }

    async function deleteOpening(openingId) {
      const safeOpeningId = String(openingId || "").trim();
      if (!safeOpeningId) throw new Error("Не найден id трека");
      return deleteDoc(doc(db, "openings", safeOpeningId));
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
      watchManualRanks,
      watchUserProfiles,
      saveManualRanks,
      saveUserProfile,
      addOpening,
      updateOpening,
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
