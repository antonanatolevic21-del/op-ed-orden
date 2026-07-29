# op-ed-orden

## Производительность

Клиент загружает каталог первым, а тяжёлые коллекции Firestore и интерфейсные
модули — только для открытого раздела. Каталог сохраняется в IndexedDB и может
быть предварительно собран в `catalog.snapshot.json`.

Снимок каталога обновляется автоматически GitHub Actions. Ручной запуск:

```bash
node scripts/build-catalog-snapshot.mjs
```

## Агрегаты оценок

Средние оценки и количество голосов хранятся на документах `openings`. После
первого развёртывания функции нужно один раз заполнить агрегаты существующими
оценками:

```bash
cd functions
npm install
firebase deploy --only functions
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json npm run backfill
```

Файл ключа сервисного аккаунта нельзя добавлять в репозиторий. После backfill
следует вручную запустить workflow `Refresh catalog snapshot`, чтобы статический
снимок сразу получил агрегаты.
