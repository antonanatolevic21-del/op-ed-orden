const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

const ADMIN_NAMES = new Set(['пес_кошачий', 'пёс_кошачий', 'toxexex', 'egortos', 'кофа']);
const SCORE_FIELDS = [
  { source: 'score', prefix: '' },
  { source: 'songScore', prefix: 'song' },
  { source: 'visualScore', prefix: 'visual' }
];

function normalizeNickname(value) {
  return String(value || '').trim().toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
}

function validScore(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0.5 && score <= 10 ? score : null;
}

function metricKeys(prefix, admin = false) {
  if (!prefix) return admin
    ? { count: 'adminRatingCount', sum: 'adminRatingSum', average: 'adminRatingAverage' }
    : { count: 'ratingCount', sum: 'ratingSum', average: 'ratingAverage' };
  return admin
    ? { count: `${prefix}AdminRatingCount`, sum: `${prefix}AdminRatingSum`, average: `${prefix}AdminRatingAverage` }
    : { count: `${prefix}RatingCount`, sum: `${prefix}RatingSum`, average: `${prefix}RatingAverage` };
}

function ratingDelta(before, after, openingId) {
  const delta = new Map();
  const add = (keys, count, sum) => {
    const current = delta.get(keys.count) || { keys, count: 0, sum: 0 };
    current.count += count;
    current.sum += sum;
    delta.set(keys.count, current);
  };
  for (const row of [before, after]) {
    if (!row || String(row.openingId || '') !== String(openingId)) continue;
    const direction = row === before ? -1 : 1;
    const admin = ADMIN_NAMES.has(normalizeNickname(row.nicknameKey || row.nickname));
    for (const field of SCORE_FIELDS) {
      const score = validScore(row[field.source]);
      if (score === null) continue;
      add(metricKeys(field.prefix, false), direction, direction * score);
      if (admin) add(metricKeys(field.prefix, true), direction, direction * score);
    }
  }
  return [...delta.values()];
}

exports.updateRatingAggregates = onDocumentWritten('ratings/{ratingId}', async event => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const openingIds = new Set([before?.openingId, after?.openingId].map(value => String(value || '').trim()).filter(Boolean));
  const db = getFirestore();

  await Promise.all([...openingIds].map(openingId => db.runTransaction(async transaction => {
    const openingRef = db.doc(`openings/${openingId}`);
    const openingSnapshot = await transaction.get(openingRef);
    if (!openingSnapshot.exists) return;
    const opening = openingSnapshot.data() || {};
    const patch = {
      ratingAggregateVersion: 1,
      ratingAggregateUpdatedAt: FieldValue.serverTimestamp()
    };
    for (const change of ratingDelta(before, after, openingId)) {
      const count = Math.max(0, Number(opening[change.keys.count] || 0) + change.count);
      const sum = Math.max(0, Number(opening[change.keys.sum] || 0) + change.sum);
      patch[change.keys.count] = count;
      patch[change.keys.sum] = sum;
      patch[change.keys.average] = count ? sum / count : null;
    }
    transaction.set(openingRef, patch, { merge: true });
  })));
});
