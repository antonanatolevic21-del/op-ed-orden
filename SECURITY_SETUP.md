# Настройка безопасности OP/ED

## 1. Firestore Rules

Скопируйте `firestore.rules` целиком в:

`Firebase Console → Firestore Database → Rules`

Нажмите **Publish**.

Правила закрепляют административные операции за четырьмя Firebase UID, а
пользовательские оценки и тир-листы — за UID владельца профиля.

## 2. Firebase App Check

1. Откройте `Firebase Console → App Check`.
2. Зарегистрируйте Web App с reCAPTCHA v3.
3. Скопируйте site key в `appCheckSiteKey` файла `firebase-config.js`.
4. Сначала включите App Check в режиме мониторинга.
5. После проверки запросов включите enforcement для Firestore.

Не включайте enforcement до публикации непустого `appCheckSiteKey`: иначе
сайт потеряет доступ к Firestore.

## 3. Cloudflare Worker загрузки изображений

В настройках Worker задайте:

- `ALLOWED_ORIGIN=https://antonanatolevic21-del.github.io`
- `UPLOAD_SECRET` — длинная случайная строка;
- `GITHUB_TOKEN` — токен только с доступом Contents к нужному репозиторию;
- `GITHUB_OWNER=antonanatolevic21-del`;
- `GITHUB_REPO=op-ed-orden`.

После изменения `cloudflare-worker-image-upload.js` опубликуйте Worker заново.
Секрет загрузчика теперь хранится только в `sessionStorage` и исчезает после
закрытия вкладки.

## 4. Старые профили

Существующий ник без `authUid` можно привязать при регистрации с email и
личным паролем. После привязки изменять его данные сможет только этот UID или
администратор.

Вход по общему паролю на основном сайте отключён. Вход выполняется по email.
Гостевые пароли Events оставлены только как способ выбрать гостевой слот; они
не выдают административные права.
