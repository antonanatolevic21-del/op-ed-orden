import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { firebaseConfig, adminUids } from './firebase-config.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const ENTITY_FIELDS = ['studios', 'performers', 'directors', 'franchises'];
const ENTITY_TYPE_ALIASES = {
	studio:'studios', studios:'studios',
	performer:'performers', performers:'performers',
	director:'directors', directors:'directors',
	franchise:'franchises', franchises:'franchises'
};
const ENTITY_LABELS = {
	studios:'Студии',
	performers:'Исполнители',
	directors:'Режиссёры',
	franchises:'Франшизы'
};
const CLEANUP_RUN_ID = 'entity_cleanup_20260724_v1';
const CLEANUP_MANIFEST_ID = `${CLEANUP_RUN_ID}__manifest`;
const BACKUP_CHUNK_LIMIT = 450000;

function cleanArray(value) {
	if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
	return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeEntityType(type) {
	return ENTITY_TYPE_ALIASES[String(type || '').trim().toLowerCase()] || '';
}

function entityCardId(type, value) {
	const safeType = normalizeEntityType(type) || String(type || '').trim().toLowerCase().replace(/[^a-z]+/g, '');
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

async function runPool(items, worker, concurrency = 8) {
	const rows = Array.isArray(items) ? items : [];
	if (!rows.length) return [];
	const results = new Array(rows.length);
	let nextIndex = 0;
	const runners = Array.from({ length:Math.min(concurrency, rows.length) }, async () => {
		while (true) {
			const index = nextIndex;
			nextIndex += 1;
			if (index >= rows.length) return;
			results[index] = await worker(rows[index], index);
		}
	});
	await Promise.all(runners);
	return results;
}

function estimateBytes(value) {
	const json = JSON.stringify(value, (_, item) => {
		if (item && typeof item.toDate === 'function') {
			try { return { __timestamp:item.toDate().toISOString() }; } catch (_) {}
		}
		if (item && typeof item.latitude === 'number' && typeof item.longitude === 'number') {
			return { __geopoint:[item.latitude, item.longitude] };
		}
		if (item && typeof item.path === 'string' && item.firestore) return { __reference:item.path };
		return item;
	});
	return new TextEncoder().encode(json || '').length;
}

function splitBackupRows(rows) {
	const chunks = [];
	let current = [];
	let currentSize = 0;
	(rows || []).forEach(row => {
		const rowSize = estimateBytes(row) + 32;
		if (current.length && currentSize + rowSize > BACKUP_CHUNK_LIMIT) {
			chunks.push(current);
			current = [];
			currentSize = 0;
		}
		current.push(row);
		currentSize += rowSize;
	});
	if (current.length || !chunks.length) chunks.push(current);
	return chunks;
}

function snapshotRows(snapshot) {
	return snapshot.docs.map(documentSnapshot => ({
		id:documentSnapshot.id,
		data:documentSnapshot.data()
	}));
}

async function writeBackupCollection(runId, sourceCollection, rows) {
	const chunks = splitBackupRows(rows);
	const chunkIds = chunks.map((_, index) => `${runId}__${sourceCollection}__${String(index + 1).padStart(3, '0')}`);
	await runPool(chunks, (chunk, index) => setDoc(doc(db, 'meta', chunkIds[index]), {
		kind:'entity-cleanup-backup-chunk',
		runId,
		sourceCollection,
		chunkIndex:index,
		chunkCount:chunks.length,
		rowCount:chunk.length,
		rows:chunk,
		createdAt:serverTimestamp()
	}), 4);
	return chunkIds;
}

async function createCleanupBackup(openingRows, entityCardRows) {
	if (!isAdminUser()) throw new Error('Резервную копию может создать только администратор.');
	const manifestRef = doc(db, 'meta', CLEANUP_MANIFEST_ID);
	await setDoc(manifestRef, {
		kind:'entity-cleanup-backup-manifest',
		runId:CLEANUP_RUN_ID,
		status:'creating-backup',
		createdBy:String(auth.currentUser?.uid || ''),
		openingCount:openingRows.length,
		entityCardCount:entityCardRows.length,
		startedAt:serverTimestamp()
	}, { merge:true });

	const [openingChunkIds, entityCardChunkIds] = await Promise.all([
		writeBackupCollection(CLEANUP_RUN_ID, 'openings', openingRows),
		writeBackupCollection(CLEANUP_RUN_ID, 'entityCards', entityCardRows)
	]);

	await setDoc(manifestRef, {
		status:'backup-complete',
		openingChunkIds,
		entityCardChunkIds,
		backupCompletedAt:serverTimestamp()
	}, { merge:true });
	return { openingChunkIds, entityCardChunkIds };
}

async function deleteEntityCards(ids) {
	if (!isAdminUser()) return [];
	const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
	const results = await runPool(uniqueIds, async id => {
		await deleteDoc(doc(db, 'entityCards', id));
		return id;
	}, 10);
	return results.filter(Boolean);
}

function calculateCleanup(openingRows, entityCardRows) {
	const liveIds = new Set();
	openingRows.forEach(row => {
		openingEntityReferences(row.data).forEach((_, id) => liveIds.add(id));
	});

	const summary = Object.fromEntries(ENTITY_FIELDS.map(type => [type, { total:0, kept:0, removed:0 }]));
	const staleRows = [];
	entityCardRows.forEach(row => {
		const type = normalizeEntityType(row.data?.type);
		if (!type || !summary[type]) return;
		summary[type].total += 1;
		const expectedId = entityCardId(type, row.data?.value);
		if (expectedId && liveIds.has(expectedId)) summary[type].kept += 1;
		else {
			summary[type].removed += 1;
			staleRows.push(row);
		}
	});
	return { summary, staleRows, liveIds };
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

function cleanupReportText(summary = {}) {
	return ENTITY_FIELDS.map(type => {
		const row = summary[type] || { total:0, kept:0, removed:0 };
		return `${ENTITY_LABELS[type]}: оставлено ${row.kept}, удалено ${row.removed}`;
	}).join(' · ');
}

function showCleanupPanel(manifest = {}) {
	let panel = document.getElementById('oc-entity-cleanup-report');
	if (!panel) {
		panel = document.createElement('aside');
		panel.id = 'oc-entity-cleanup-report';
		Object.assign(panel.style, {
			position:'fixed', right:'18px', bottom:'18px', zIndex:'10050', width:'min(430px,calc(100vw - 36px))',
			padding:'16px', border:'1px solid rgba(255,255,255,.16)', borderRadius:'14px',
			background:'rgba(18,14,25,.97)', color:'#f5f3fa', boxShadow:'0 18px 60px rgba(0,0,0,.45)',
			fontFamily:'Inter,Arial,sans-serif', fontSize:'13px', lineHeight:'1.45'
		});
		document.body.append(panel);
	}
	const summary = manifest.summary || {};
	const title = manifest.status === 'complete' ? 'Проверка Firebase завершена' : manifest.status === 'restored' ? 'Бэкап восстановлен' : 'Проверка Firebase';
	panel.innerHTML = `
		<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
			<div><strong style="font-size:15px">${title}</strong><div style="margin-top:6px;color:#aaa4b5">${cleanupReportText(summary)}</div></div>
			<button type="button" data-cleanup-close style="border:0;background:transparent;color:#aaa4b5;font-size:18px;cursor:pointer">×</button>
		</div>
		<div style="margin-top:10px;color:#aaa4b5">Бэкап: <code style="color:#fff">${CLEANUP_RUN_ID}</code></div>
		<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
			<button type="button" data-cleanup-restore style="border:1px solid rgba(255,255,255,.18);border-radius:9px;padding:8px 11px;background:#2a2236;color:#fff;cursor:pointer">Откатить очистку</button>
		</div>`;
	panel.querySelector('[data-cleanup-close]')?.addEventListener('click', () => panel.remove());
	panel.querySelector('[data-cleanup-restore]')?.addEventListener('click', async event => {
		if (!confirm('Вернуть все карточки entityCards из резервной копии? Треки и оценки не изменятся.')) return;
		event.currentTarget.disabled = true;
		event.currentTarget.textContent = 'Восстановление…';
		try {
			await restoreCleanupBackup();
		} catch (error) {
			console.error('Entity cleanup restore failed', error);
			alert(`Не удалось восстановить бэкап: ${error?.message || error}`);
			event.currentTarget.disabled = false;
			event.currentTarget.textContent = 'Откатить очистку';
		}
	});
}

async function runBackedUpOrphanCleanup() {
	if (!isAdminUser()) return null;
	const manifestRef = doc(db, 'meta', CLEANUP_MANIFEST_ID);
	const existingSnapshot = await getDoc(manifestRef);
	if (existingSnapshot.exists() && ['complete', 'restored'].includes(existingSnapshot.data()?.status)) {
		showCleanupPanel(existingSnapshot.data());
		return existingSnapshot.data();
	}

	const [openingsSnapshot, entityCardsSnapshot] = await Promise.all([
		getDocs(collection(db, 'openings')),
		getDocs(collection(db, 'entityCards'))
	]);
	const openingRows = snapshotRows(openingsSnapshot);
	const entityCardRows = snapshotRows(entityCardsSnapshot);
	const { summary, staleRows } = calculateCleanup(openingRows, entityCardRows);

	await createCleanupBackup(openingRows, entityCardRows);
	await setDoc(manifestRef, {
		status:'deleting-orphans',
		summary,
		staleEntityCardIds:staleRows.map(row => row.id),
		staleEntityCardValues:staleRows.map(row => ({ id:row.id, type:normalizeEntityType(row.data?.type), value:String(row.data?.value || '') })),
		deleteStartedAt:serverTimestamp()
	}, { merge:true });

	const deletedIds = await deleteEntityCards(staleRows.map(row => row.id));
	const result = {
		kind:'entity-cleanup-backup-manifest',
		runId:CLEANUP_RUN_ID,
		status:'complete',
		summary,
		deletedEntityCardIds:deletedIds,
		deletedCount:deletedIds.length
	};
	await setDoc(manifestRef, { ...result, completedAt:serverTimestamp() }, { merge:true });
	showCleanupPanel(result);
	return result;
}

async function readBackupRows(chunkIds = []) {
	const snapshots = await runPool(chunkIds, id => getDoc(doc(db, 'meta', id)), 8);
	return snapshots.flatMap(snapshot => snapshot.exists() && Array.isArray(snapshot.data()?.rows) ? snapshot.data().rows : []);
}

async function restoreCleanupBackup() {
	if (!isAdminUser()) throw new Error('Восстановление доступно только администратору.');
	const manifestRef = doc(db, 'meta', CLEANUP_MANIFEST_ID);
	const manifestSnapshot = await getDoc(manifestRef);
	if (!manifestSnapshot.exists()) throw new Error('Манифест резервной копии не найден.');
	const manifest = manifestSnapshot.data();
	const entityCardRows = await readBackupRows(manifest.entityCardChunkIds || []);
	await runPool(entityCardRows, row => setDoc(doc(db, 'entityCards', String(row.id)), row.data || {}), 10);
	const restored = { ...manifest, status:'restored', restoredCount:entityCardRows.length, restoredAt:serverTimestamp() };
	await setDoc(manifestRef, restored, { merge:true });
	showCleanupPanel({ ...manifest, status:'restored' });
	return entityCardRows.length;
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

	api.runBackedUpOrphanCleanup = runBackedUpOrphanCleanup;
	api.restoreEntityCleanupBackup = restoreCleanupBackup;
	api.__orphanEntityCleanupWrapped = true;
	return true;
}

if (!wrapDatabaseApi()) {
	window.addEventListener('oped-db-ready', wrapDatabaseApi, { once:true });
}

onAuthStateChanged(auth, user => {
	if (!isAdminUser(user)) return;
	runCleanupInBackground(
		runBackedUpOrphanCleanup,
		'Backed-up entity cleanup failed'
	);
});