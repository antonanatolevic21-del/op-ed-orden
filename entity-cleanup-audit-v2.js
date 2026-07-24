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
const RUN_ID = 'entity_cleanup_20260724_v2';
const MANIFEST_ID = `${RUN_ID}__manifest`;
const BACKUP_CHUNK_LIMIT = 450000;

function isAdminUser(user = auth.currentUser) {
	return Boolean(user && !user.isAnonymous && adminUids.includes(String(user.uid || '')));
}

function cleanArray(value) {
	if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
	return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeType(type) {
	return ENTITY_TYPE_ALIASES[String(type || '').trim().toLowerCase()] || '';
}

function normalizeValue(value) {
	return String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function entityCardId(type, value) {
	const safeType = normalizeType(type);
	const safeValue = String(value || '').trim().toLowerCase()
		.replace(/[^a-zа-яё0-9]+/gi, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 120);
	return safeType && safeValue ? `${safeType}__${safeValue}` : '';
}

function snapshotRows(snapshot) {
	return snapshot.docs.map(item => ({ id:item.id, data:item.data() }));
}

function serializeValue(value) {
	if (value && typeof value.toDate === 'function') {
		try { return { __type:'timestamp', value:value.toDate().toISOString() }; } catch (_) {}
	}
	if (Array.isArray(value)) return value.map(serializeValue);
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
	}
	return value;
}

function encodedRow(row) {
	return JSON.stringify(serializeValue(row));
}

function splitRows(rows) {
	const chunks = [];
	let current = [];
	let size = 2;
	for (const row of rows) {
		const encoded = encodedRow(row);
		const bytes = new TextEncoder().encode(encoded).length + 2;
		if (current.length && size + bytes > BACKUP_CHUNK_LIMIT) {
			chunks.push(current);
			current = [];
			size = 2;
		}
		current.push(encoded);
		size += bytes;
	}
	if (current.length || !chunks.length) chunks.push(current);
	return chunks;
}

async function runPool(items, worker, concurrency = 8) {
	const rows = Array.isArray(items) ? items : [];
	let next = 0;
	const results = new Array(rows.length);
	const runners = Array.from({ length:Math.min(concurrency, rows.length || 1) }, async () => {
		while (next < rows.length) {
			const index = next++;
			results[index] = await worker(rows[index], index);
		}
	});
	await Promise.all(runners);
	return results;
}

async function backupCollection(name, rows) {
	const chunks = splitRows(rows);
	const ids = chunks.map((_, index) => `${RUN_ID}__${name}__${String(index + 1).padStart(3, '0')}`);
	await runPool(chunks, (chunk, index) => {
		const payload = `[${chunk.join(',')}]`;
		return setDoc(doc(db, 'meta', ids[index]), {
			kind:'entity-cleanup-backup-chunk-v2',
			runId:RUN_ID,
			sourceCollection:name,
			chunkIndex:index,
			chunkCount:chunks.length,
			rowCount:chunk.length,
			payload,
			createdAt:serverTimestamp()
		});
	}, 4);
	return ids;
}

async function createBackup(openings, cards) {
	const manifestRef = doc(db, 'meta', MANIFEST_ID);
	await setDoc(manifestRef, {
		kind:'entity-cleanup-manifest-v2',
		runId:RUN_ID,
		status:'creating-backup',
		createdBy:String(auth.currentUser?.uid || ''),
		openingCount:openings.length,
		entityCardCount:cards.length,
		startedAt:serverTimestamp()
	}, { merge:true });
	const [openingChunks, cardChunks] = await Promise.all([
		backupCollection('openings', openings),
		backupCollection('entityCards', cards)
	]);
	await setDoc(manifestRef, {
		status:'backup-complete',
		openingChunks,
		cardChunks,
		backupCompletedAt:serverTimestamp()
	}, { merge:true });
	return { openingChunks, cardChunks };
}

function calculateAudit(openings, cards) {
	const live = Object.fromEntries(ENTITY_FIELDS.map(type => [type, new Map()]));
	for (const row of openings) {
		for (const type of ENTITY_FIELDS) {
			for (const raw of cleanArray(row.data?.[type])) {
				const value = String(raw || '').trim();
				const id = entityCardId(type, value);
				if (!id) continue;
				const current = live[type].get(id) || { value, references:0, openingIds:[] };
				current.references += 1;
				if (current.openingIds.length < 20) current.openingIds.push(String(row.id));
				live[type].set(id, current);
			}
		}
	}

	const summary = Object.fromEntries(ENTITY_FIELDS.map(type => [type, {
		liveValues:live[type].size,
		references:[...live[type].values()].reduce((sum, item) => sum + item.references, 0),
		albums:0,
		kept:0,
		removed:0
	}]));
	const stale = [];
	const unrecognized = [];

	for (const row of cards) {
		const idPrefix = String(row.id || '').split('__')[0];
		const type = normalizeType(row.data?.type || idPrefix);
		if (!type) {
			unrecognized.push(row);
			continue;
		}
		summary[type].albums += 1;
		const expectedId = entityCardId(type, row.data?.value);
		if (live[type].has(String(row.id)) || (expectedId && live[type].has(expectedId))) summary[type].kept += 1;
		else {
			summary[type].removed += 1;
			stale.push({ ...row, type });
		}
	}
	return { summary, stale, unrecognized, live };
}

async function deleteCards(rows) {
	return runPool(rows, async row => {
		await deleteDoc(doc(db, 'entityCards', String(row.id)));
		return String(row.id);
	}, 10);
}

function summaryHtml(summary = {}) {
	return ENTITY_FIELDS.map(type => {
		const row = summary[type] || {};
		return `<div style="margin-top:7px"><strong>${ENTITY_LABELS[type]}</strong>: значений в треках ${row.liveValues || 0}, упоминаний ${row.references || 0}, альбомов ${row.albums || 0}, оставлено ${row.kept || 0}, удалено ${row.removed || 0}</div>`;
	}).join('');
}

function showPanel(result) {
	let panel = document.getElementById('oc-entity-cleanup-report');
	if (!panel) {
		panel = document.createElement('aside');
		panel.id = 'oc-entity-cleanup-report';
		document.body.append(panel);
	}
	Object.assign(panel.style, {
		position:'fixed', right:'18px', bottom:'18px', zIndex:'10050', width:'min(520px,calc(100vw - 36px))',
		maxHeight:'calc(100vh - 36px)', overflow:'auto', padding:'16px', border:'1px solid rgba(255,255,255,.16)',
		borderRadius:'14px', background:'rgba(18,14,25,.98)', color:'#f5f3fa', boxShadow:'0 18px 60px rgba(0,0,0,.45)',
		fontFamily:'Inter,Arial,sans-serif', fontSize:'13px', lineHeight:'1.45'
	});
	panel.innerHTML = `
		<div style="display:flex;justify-content:space-between;gap:12px">
			<strong style="font-size:15px">Исправленная проверка Firebase завершена</strong>
			<button type="button" data-close style="border:0;background:transparent;color:#aaa4b5;font-size:18px;cursor:pointer">×</button>
		</div>
		${summaryHtml(result.summary)}
		<div style="margin-top:10px;color:#aaa4b5">Нераспознанных альбомов: ${result.unrecognizedCount || 0}. Бэкап: <code style="color:#fff">${RUN_ID}</code></div>
		<div style="margin-top:14px;border-top:1px solid rgba(255,255,255,.12);padding-top:12px">
			<div style="font-weight:700">Найти значение в треках</div>
			<div style="display:flex;gap:8px;margin-top:8px"><input data-usage-value value="Кё Ятатэ" style="flex:1;min-width:0;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:8px;background:#17121f;color:#fff"><button data-find-usage type="button" style="border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:8px 10px;background:#2a2236;color:#fff;cursor:pointer">Найти</button></div>
			<div data-usage-result style="margin-top:8px;color:#c8c2d1"></div>
		</div>`;
	panel.querySelector('[data-close]')?.addEventListener('click', () => panel.remove());
	panel.querySelector('[data-find-usage]')?.addEventListener('click', async () => {
		const input = panel.querySelector('[data-usage-value]');
		const target = normalizeValue(input?.value);
		const output = panel.querySelector('[data-usage-result]');
		if (!target) return;
		output.textContent = 'Поиск…';
		const snapshot = await getDocs(collection(db, 'openings'));
		const matches = [];
		for (const item of snapshot.docs) {
			const data = item.data();
			const fields = ENTITY_FIELDS.filter(type => cleanArray(data?.[type]).some(value => normalizeValue(value) === target));
			if (fields.length) matches.push({ id:item.id, title:String(data.title || data.anime || 'Без названия'), fields });
		}
		output.innerHTML = matches.length
			? matches.map(match => `<div style="margin-top:5px"><code>${match.id}</code> — ${match.title} · ${match.fields.map(field => ENTITY_LABELS[field]).join(', ')}</div>`).join('')
			: 'Ни в одном треке такое значение не найдено.';
	});
}

async function runAudit() {
	if (!isAdminUser()) return null;
	const manifestRef = doc(db, 'meta', MANIFEST_ID);
	const previous = await getDoc(manifestRef);
	if (previous.exists() && previous.data()?.status === 'complete') {
		showPanel(previous.data());
		return previous.data();
	}
	const [openingSnapshot, cardSnapshot] = await Promise.all([
		getDocs(collection(db, 'openings')),
		getDocs(collection(db, 'entityCards'))
	]);
	const openings = snapshotRows(openingSnapshot);
	const cards = snapshotRows(cardSnapshot);
	const audit = calculateAudit(openings, cards);
	await createBackup(openings, cards);
	await setDoc(manifestRef, {
		status:'deleting-orphans',
		summary:audit.summary,
		staleIds:audit.stale.map(row => row.id),
		unrecognizedIds:audit.unrecognized.map(row => row.id),
		deleteStartedAt:serverTimestamp()
	}, { merge:true });
	const deletedIds = await deleteCards(audit.stale);
	const result = {
		kind:'entity-cleanup-manifest-v2',
		runId:RUN_ID,
		status:'complete',
		summary:audit.summary,
		deletedIds,
		deletedCount:deletedIds.length,
		unrecognizedCount:audit.unrecognized.length
	};
	await setDoc(manifestRef, { ...result, completedAt:serverTimestamp() }, { merge:true });
	showPanel(result);
	return result;
}

async function removeOrphanCandidates(candidates) {
	if (!isAdminUser() || !candidates.length) return;
	const candidateIds = new Set(candidates.map(item => entityCardId(item.type, item.value)).filter(Boolean));
	if (!candidateIds.size) return;
	const snapshot = await getDocs(collection(db, 'openings'));
	for (const item of snapshot.docs) {
		for (const type of ENTITY_FIELDS) {
			for (const value of cleanArray(item.data()?.[type])) candidateIds.delete(entityCardId(type, value));
		}
	}
	await runPool([...candidateIds], id => deleteDoc(doc(db, 'entityCards', id)), 8);
}

function runBackground(task, label) {
	setTimeout(() => { void Promise.resolve().then(task).catch(error => console.warn(label, error)); }, 0);
}

function wrapDatabaseApi() {
	const api = window.OPED_DB;
	if (!api || api.__entityAuditV2Wrapped) return Boolean(api);
	const updateOpening = api.updateOpening?.bind(api);
	const deleteOpening = api.deleteOpening?.bind(api);
	if (updateOpening) {
		api.updateOpening = async (openingId, opening) => {
			let previous = {};
			try {
				const snap = await getDoc(doc(db, 'openings', String(openingId || '')));
				if (snap.exists()) previous = snap.data();
			} catch (_) {}
			const result = await updateOpening(openingId, opening);
			const removed = [];
			for (const type of ENTITY_FIELDS) {
				const nextIds = new Set(cleanArray(opening?.[type]).map(value => entityCardId(type, value)));
				for (const value of cleanArray(previous?.[type])) {
					if (!nextIds.has(entityCardId(type, value))) removed.push({ type, value });
				}
			}
			if (removed.length) runBackground(() => removeOrphanCandidates(removed), 'Entity cleanup after update failed');
			return result;
		};
	}
	if (deleteOpening) {
		api.deleteOpening = async openingId => {
			let removed = [];
			try {
				const snap = await getDoc(doc(db, 'openings', String(openingId || '')));
				if (snap.exists()) {
					for (const type of ENTITY_FIELDS) cleanArray(snap.data()?.[type]).forEach(value => removed.push({ type, value }));
				}
			} catch (_) {}
			const result = await deleteOpening(openingId);
			if (removed.length) runBackground(() => removeOrphanCandidates(removed), 'Entity cleanup after delete failed');
			return result;
		};
	}
	api.runEntityCleanupAuditV2 = runAudit;
	api.__entityAuditV2Wrapped = true;
	return true;
}

if (!wrapDatabaseApi()) window.addEventListener('oped-db-ready', wrapDatabaseApi, { once:true });
onAuthStateChanged(auth, user => {
	if (!isAdminUser(user)) return;
	runBackground(runAudit, 'Entity cleanup audit v2 failed');
});
