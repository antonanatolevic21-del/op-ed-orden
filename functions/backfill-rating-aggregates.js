const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

const ADMIN_NAMES = new Set(['пес_кошачий', 'пёс_кошачий', 'toxexex', 'egortos', 'кофа']);
const FIELDS = [
  { source: 'score', prefix: '' },
  { source: 'songScore', prefix: 'song' },
  { source: 'visualScore', prefix: 'visual' }
];

function normalizeNickname(value) {
  return String(value || '').trim().toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
}

function score(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0.5 && number <= 10 ? number : null;
}

function keys(prefix, admin = false) {
  if (!prefix) return admin
    ? { count: 'adminRatingCount', sum: 'adminRatingSum', average: 'adminRatingAverage' }
    : { count: 'ratingCount', sum: 'ratingSum', average: 'ratingAverage' };
  return admin
    ? { count: `${prefix}AdminRatingCount`, sum: `${prefix}AdminRatingSum`, average: `${prefix}AdminRatingAverage` }
    : { count: `${prefix}RatingCount`, sum: `${prefix}RatingSum`, average: `${prefix}RatingAverage` };
}

async function main() {
  const db = getFirestore();
  const [openingSnapshot, ratingSnapshot] = await Promise.all([
    db.collection('openings').get(),
    db.collection('ratings').get()
  ]);
  const aggregates = new Map();

  for (const ratingDocument of ratingSnapshot.docs) {
  const rating = ratingDocument.data() || {};
  const openingId = String(rating.openingId || '').trim();
  if (!openingId) continue;
  const aggregate = aggregates.get(openingId) || {};
  const admin = ADMIN_NAMES.has(normalizeNickname(rating.nicknameKey || rating.nickname));
  for (const field of FIELDS) {
    const value = score(rating[field.source]);
    if (value === null) continue;
    for (const adminScope of admin ? [false, true] : [false]) {
      const metric = keys(field.prefix, adminScope);
      aggregate[metric.count] = Number(aggregate[metric.count] || 0) + 1;
      aggregate[metric.sum] = Number(aggregate[metric.sum] || 0) + value;
    }
  }
  aggregates.set(openingId, aggregate);
  }

  let batch = db.batch();
  let batchSize = 0;
  let updated = 0;
  for (const openingDocument of openingSnapshot.docs) {
  const patch = {
    ratingAggregateVersion: 1,
    ratingAggregateUpdatedAt: FieldValue.serverTimestamp()
  };
  const aggregate = aggregates.get(openingDocument.id) || {};
  for (const prefix of ['', 'song', 'visual']) {
    for (const admin of [false, true]) {
      const metric = keys(prefix, admin);
      const count = Number(aggregate[metric.count] || 0);
      const sum = Number(aggregate[metric.sum] || 0);
      patch[metric.count] = count;
      patch[metric.sum] = sum;
      patch[metric.average] = count ? sum / count : null;
    }
  }
  batch.set(openingDocument.ref, patch, { merge: true });
  batchSize += 1;
  updated += 1;
  if (batchSize >= 400) {
    await batch.commit();
    batch = db.batch();
    batchSize = 0;
    console.log(`Updated ${updated}/${openingSnapshot.size}`);
  }
  }
  if (batchSize) await batch.commit();
  console.log(`Backfilled ${updated} openings from ${ratingSnapshot.size} ratings.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
