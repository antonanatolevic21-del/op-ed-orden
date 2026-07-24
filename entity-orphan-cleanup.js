import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { firebaseConfig, adminUids } from './firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const ENTITY_FIELDS = ['studios', 'performers', 'directors', 'franchises'];

function cleanArray(value) {
	if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
	return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function entityCardId(type, value) {
	const safeType = String(type || '').trim().toLowerCase().replace(/[^a-z]+/g, '');
	const safeValue = String(value || '').trim().toLowerCase()
		.replace(/[^a-zа-яё0-9]+/gi, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 120);
	return safeType && safeValue ? `${safeType}__${safeValue}` : '';
}

function openingEntityReferences(opening) {
	const references = new Map();
	ENTITY_FIELDS.forEach(type => {
		cleanArray(opening?.[type]).forEach(value => {
			const id = entityCardId(type, value);
			if (id && !references.has(id)) references.set(id, { id, type, value });
		});
	});
	return references;
}

function isAdminUser(user = auth.currentUser) {
	return Boolean(user && !user.isAnonymous && adminUids.includes(String(user.uid || '')));
}

function runCleanupInBackground(task, errorMessage) {
	setTimeout(() => {
		void Promise.resolve()
			.then(task)
			.catch(error => console.warn(errorMessage, error));
	}, 0);
}

async function deleteEntityCards(ids) {
	if (!isAdminUser()) return [];
	const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
	const results = await Promise.allSettled(uniqueIds.map(id => deleteDoc(doc(db, 'entityCards', id))));
	const deleted = [];
	results.forEach((result, index) => {
		if (result.status === 'fulfilled') deleted.push(uniqueIds[index]);
		else console.warn('Could not delete orphan entity card', uniqueIds[index], result.reason);
	});
	return deleted;
}

async function removeOrphanEntityCards(candidates = []) {
	if (!isAdminUser()) return [];
	const candidateIds = new Set();
	candidates.forEach(candidate => {
		const id = candidate?.id || entityCardId(candidate?.type, candidate?.value);
		if (id) candidateIds.add(String(id));
	});
	if (!candidateIds.size) return [];

	const openingsSnapshot = await getDocs(collection(db, 'openings'));
	openingsSnapshot.docs.forEach(openingDoc => {
		openingEntityReferences(openingDoc.data()).forEach((_, id) => candidateIds.delete(id));
	});
	return deleteEntityCards([...candidateIds]);
}

async function pruneOrphanEntityCards() {
	if (!isAdminUser()) return [];
	const [openingsSnapshot, cardsSnapshot] = await Promise.all([
		getDocs(collection(db, 'openings')),
		getDocs(collection(db, 'entityCards'))
	]);
	const liveIds = new Set();
	openingsSnapshot.docs.forEach(openingDoc => {
		openingEntityReferences(openingDoc.data()).forEach((_, id) => liveIds.add(id));
	});
	const staleIds = cardsSnapshot.docs.map(cardDoc => cardDoc.id).filter(id => !liveIds.has(id));
	return deleteEntityCards(staleIds);
}

function wrapDatabaseApi() {
	const api = window.OPED_DB;
	if (!api || api.__orphanEntityCleanupWrapped) return Boolean(api);

	const originalUpdateOpening = api.updateOpening?.bind(api);
	const originalDeleteOpening = api.deleteOpening?.bind(api);

	if (originalUpdateOpening) {
		api.updateOpening = async (openingId, opening) => {
			const safeId = String(openingId || '').trim();
			let previous = {};
			if (safeId) {
				try {
					const snapshot = await getDoc(doc(db, 'openings', safeId));
					if (snapshot.exists()) previous = snapshot.data();
				} catch (error) {
					console.warn('Could not read opening before orphan cleanup', error);
				}
			}

			const result = await originalUpdateOpening(openingId, opening);
			const previousReferences = openingEntityReferences(previous);
			const nextReferences = openingEntityReferences(opening || {});
			const removed = [...previousReferences.values()].filter(reference => !nextReferences.has(reference.id));
			if (removed.length) {
				runCleanupInBackground(
					() => removeOrphanEntityCards(removed),
					'Orphan entity cleanup after update failed'
				);
			}
			return result;
		};
	}

	if (originalDeleteOpening) {
		api.deleteOpening = async openingId => {
			const safeId = String(openingId || '').trim();
			let references = [];
			if (safeId) {
				try {
					const snapshot = await getDoc(doc(db, 'openings', safeId));
					if (snapshot.exists()) references = [...openingEntityReferences(snapshot.data()).values()];
				} catch (error) {
					console.warn('Could not read opening before orphan cleanup', error);
				}
			}

			const result = await originalDeleteOpening(openingId);
			if (references.length) {
				runCleanupInBackground(
					() => removeOrphanEntityCards(references),
					'Orphan entity cleanup after delete failed'
				);
			}
			return result;
		};
	}

	api.pruneOrphanEntityCards = pruneOrphanEntityCards;
	api.__orphanEntityCleanupWrapped = true;
	return true;
}

if (!wrapDatabaseApi()) {
	window.addEventListener('oped-db-ready', wrapDatabaseApi, { once: true });
}

onAuthStateChanged(auth, user => {
	if (!isAdminUser(user)) return;
	runCleanupInBackground(
		pruneOrphanEntityCards,
		'Initial orphan entity cleanup failed'
	);
});