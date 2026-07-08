import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
 
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
 
import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
 
const firebaseConfig = {
apiKey: "AIzaSyB-twjseziMOfViTBjXErqlXkSIorlAUXE",
  
  authDomain: "op-ed-orden-eed04.firebaseapp.com",

  projectId: "op-ed-orden-eed04",

  storageBucket: "op-ed-orden-eed04.firebasestorage.app",

  messagingSenderId: "821108008660",

  appId: "1:821108008660:web:bab171d225e5c8cde2fd41"
};
 
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
 
function normalizeNickname(nickname) {
  return String(nickname || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9_-]+/gi, "_")
    .slice(0, 60);
}
 
function cleanArray(value) {
  if (Array.isArray(value)) {
    return value.map(x => String(x).trim()).filter(Boolean);
  }
 
  return String(value || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}
 
async function init() {
  await signInAnonymously(auth);
}
 
function watchOpenings(callback) {
  const q = query(collection(db, "openings"), orderBy("year", "desc"));
 
  return onSnapshot(q, snapshot => {
    const rows = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
 
    callback(rows);
  });
}
 
function watchRatings(callback) {
  return onSnapshot(collection(db, "ratings"), snapshot => {
    const rows = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
 
    callback(rows);
  });
}
 
async function addOpening(opening) {
  return addDoc(collection(db, "openings"), {
    title: String(opening.title || "").trim(),
    anime: String(opening.anime || "").trim(),
    type: opening.type === "ED" ? "ED" : "OP",
    year: Number(opening.year),
    season: String(opening.season || "").trim(),
 
    studios: cleanArray(opening.studios),
    directors: cleanArray(opening.directors),
    performers: cleanArray(opening.performers),
 
    image: String(opening.image || "").trim(),
    link: String(opening.link || "").trim(),
 
    createdBy: String(opening.createdBy || "").trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
 
async function saveRating(openingId, nickname, score) {
  const safeName = normalizeNickname(nickname);
  const safeOpeningId = String(openingId || "").trim();
 
  if (!safeName) {
    throw new Error("Никнейм обязателен");
  }
 
  if (!safeOpeningId) {
    throw new Error("Не найден id опенинга");
  }
 
  const ratingId = `${safeName}__${safeOpeningId}`;
 
  return setDoc(doc(db, "ratings", ratingId), {
    openingId: safeOpeningId,
    nickname: safeName,
    score: Number(score),
    updatedAt: serverTimestamp()
  }, { merge: true });
}
 
window.OPED_DB = {
  init,
  watchOpenings,
  watchRatings,
  addOpening,
  saveRating,
  normalizeNickname
};
 
window.dispatchEvent(new Event("oped-db-ready"));
