import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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

    image: String(opening.image || "").trim(),
    link: String(opening.link || "").trim(),
    notes: String(opening.notes || "").trim(),

    updatedAt: serverTimestamp()
  };

  if (includeCreatedFields) {
    payload.createdBy = String(opening.createdBy || "").trim();
    payload.createdAt = serverTimestamp();
  }

  return payload;
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
  }, error => {
    console.error("watchOpenings error", error);
  });
}

function watchRatings(callback) {
  return onSnapshot(collection(db, "ratings"), snapshot => {
    const rows = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    callback(rows);
  }, error => {
    console.error("watchRatings error", error);
  });
}

async function addOpening(opening) {
  return addDoc(collection(db, "openings"), cleanOpening(opening, true));
}

async function updateOpening(openingId, opening) {
  const safeOpeningId = String(openingId || "").trim();

  if (!safeOpeningId) {
    throw new Error("Не найден id опенинга");
  }

  return updateDoc(doc(db, "openings", safeOpeningId), cleanOpening(opening, false));
}

async function deleteOpening(openingId) {
  const safeOpeningId = String(openingId || "").trim();

  if (!safeOpeningId) {
    throw new Error("Не найден id опенинга");
  }

  return deleteDoc(doc(db, "openings", safeOpeningId));
}

async function saveRating(openingId, nickname, score) {
  const displayName = String(nickname || "").trim();
  const safeName = normalizeNickname(displayName);
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
    nickname: displayName,
    nicknameKey: safeName,
    score: Number(score),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

window.OPED_DB = {
  init,
  watchOpenings,
  watchRatings,
  addOpening,
  updateOpening,
  deleteOpening,
  saveRating,
  normalizeNickname
};

window.dispatchEvent(new Event("oped-db-ready"));
