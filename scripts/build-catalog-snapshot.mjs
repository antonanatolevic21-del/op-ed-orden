import { writeFile } from 'node:fs/promises';

const projectId = process.env.FIREBASE_PROJECT_ID || 'op-ed-orden-eed04';
const apiKey = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyB-twjseziMOfViTBjXErqlXkSIorlAUXE';
const output = new URL('../catalog.snapshot.json', import.meta.url);

function decode(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return { milliseconds: Date.parse(value.timestampValue) };
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decode(value)]));
}

async function loadPage(collectionId, pageToken = '') {
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}`);
  url.searchParams.set('pageSize', '1000');
  url.searchParams.set('key', apiKey);
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Firestore returned ${response.status}: ${await response.text()}`);
  return response.json();
}

async function loadCollection(collectionId) {
  const rows = [];
  let pageToken = '';
  do {
    const page = await loadPage(collectionId, pageToken);
    for (const document of page.documents || []) {
      rows.push({
        id: String(document.name || '').split('/').pop(),
        ...decodeFields(document.fields || {})
      });
    }
    pageToken = String(page.nextPageToken || '');
  } while (pageToken);
  return rows;
}

function normalizeNickname(value) {
  return String(value || '').trim().toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9_-]+/gi, '_').slice(0, 60);
}

function numericScore(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0.5 && score <= 10 ? score : null;
}

function addScore(bucket, prefix, value, admin) {
  const score = numericScore(value);
  if (score === null) return;
  const countKey = prefix ? `${prefix}RatingCount` : 'ratingCount';
  const sumKey = prefix ? `${prefix}RatingSum` : 'ratingSum';
  bucket[countKey] = Number(bucket[countKey] || 0) + 1;
  bucket[sumKey] = Number(bucket[sumKey] || 0) + score;
  if (!admin) return;
  const adminCountKey = prefix ? `${prefix}AdminRatingCount` : 'adminRatingCount';
  const adminSumKey = prefix ? `${prefix}AdminRatingSum` : 'adminRatingSum';
  bucket[adminCountKey] = Number(bucket[adminCountKey] || 0) + 1;
  bucket[adminSumKey] = Number(bucket[adminSumKey] || 0) + score;
}

const rows = await loadCollection('openings');
const ratings = process.env.REBUILD_AGGREGATES_FROM_RATINGS === '1'
  ? await loadCollection('ratings')
  : [];
const adminNames = new Set(['пес_кошачий', 'пёс_кошачий', 'toxexex', 'egortos', 'кофа']);
const aggregates = new Map();
for (const rating of ratings) {
  const openingId = String(rating.openingId || '').trim();
  if (!openingId) continue;
  const bucket = aggregates.get(openingId) || {};
  const admin = adminNames.has(normalizeNickname(rating.nicknameKey || rating.nickname));
  addScore(bucket, '', rating.score, admin);
  addScore(bucket, 'song', rating.songScore, admin);
  addScore(bucket, 'visual', rating.visualScore, admin);
  aggregates.set(openingId, bucket);
}

for (const row of rows) {
  const aggregate = aggregates.get(String(row.id)) || {};
  if (ratings.length) Object.assign(row, aggregate, {
      ratingAggregateVersion: 1,
      ratingAggregateUpdatedAt: Date.now()
    });
  if (!ratings.length && Number(row.ratingAggregateVersion || 0) < 1) continue;
  for (const prefix of ['', 'song', 'visual']) {
    const countKey = prefix ? `${prefix}RatingCount` : 'ratingCount';
    const sumKey = prefix ? `${prefix}RatingSum` : 'ratingSum';
    const averageKey = prefix ? `${prefix}RatingAverage` : 'ratingAverage';
    const count = Number(row[countKey] || 0);
    const sum = Number(row[sumKey] || 0);
    row[countKey] = count;
    row[sumKey] = sum;
    row[averageKey] = count ? sum / count : null;
    const adminCountKey = prefix ? `${prefix}AdminRatingCount` : 'adminRatingCount';
    const adminSumKey = prefix ? `${prefix}AdminRatingSum` : 'adminRatingSum';
    const adminAverageKey = prefix ? `${prefix}AdminRatingAverage` : 'adminRatingAverage';
    const adminCount = Number(row[adminCountKey] || 0);
    const adminSum = Number(row[adminSumKey] || 0);
    row[adminCountKey] = adminCount;
    row[adminSumKey] = adminSum;
    row[adminAverageKey] = adminCount ? adminSum / adminCount : null;
  }
}

rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
await writeFile(output, `${JSON.stringify({ generatedAt: Date.now(), rows })}\n`);
console.log(`Saved ${rows.length} tracks${ratings.length ? ` and ${ratings.length} rating aggregates` : ''} to ${output.pathname}`);
