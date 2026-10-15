import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

// Restore authentication without waiting for Firestore or App Check to load.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const PROFILE_CACHE_KEY = 'op-ed-auth-profile-v1';

export async function restoreSavedSession() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { user: null, profile: null };
  for (const key of ['sessionStorage', 'localStorage']) {
    try {
      const cached = JSON.parse(window[key].getItem(PROFILE_CACHE_KEY) || 'null');
      const profile = cached?.profile;
      if (cached?.uid !== user.uid || String(profile?.authUid || '') !== user.uid) continue;
      if (String(profile.nickname || profile.nicknameKey || profile.id || '').trim()) return { user, profile };
    } catch (_) {}
  }
  const nickname = String(user.displayName || '').trim();
  return {
    user,
    profile: nickname ? { nickname, authUid: user.uid } : null
  };
}
