const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_WEBP_BASE64 = 5 * 1024 * 1024;

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGIN || "").trim();
  const allowOrigin = allowed && allowed !== "*" ? (origin === allowed ? origin : allowed) : (origin || "*");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, X-Upload-Secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(request, env, payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(request, env), "Content-Type": "application/json; charset=utf-8" }
  });
}

function authorized(request, env) {
  const expected = String(env.UPLOAD_SECRET || "");
  const actual = String(request.headers.get("X-Upload-Secret") || "");
  return Boolean(expected && actual && expected === actual);
}

function safeRemoteUrl(value) {
  let url;
  try { url = new URL(String(value || "")); } catch (_) { return null; }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" || host.endsWith(".local") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")
  ) return null;
  return url;
}

async function proxyImage(request, env) {
  let body;
  try { body = await request.json(); } catch (_) { return json(request, env, { error: "Некорректный JSON" }, 400); }
  const url = safeRemoteUrl(body.url);
  if (!url) return json(request, env, { error: "Недопустимый URL изображения" }, 400);

  let upstream;
  try {
    upstream = await fetch(url.toString(), {
      headers: { "User-Agent": "OP-ED-Orden-Image-Backup/1.0", "Accept": "image/*" }
    });
  } catch (_) {
    return json(request, env, { error: "Не удалось скачать исходное изображение" }, 502);
  }
  if (!upstream.ok) return json(request, env, { error: "Источник вернул HTTP " + upstream.status }, 502);

  const type = String(upstream.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/") || type === "image/svg+xml") {
    return json(request, env, { error: "URL не ведёт на растровое изображение" }, 415);
  }
  const announced = Number(upstream.headers.get("Content-Length") || 0);
  if (announced > MAX_SOURCE_BYTES) return json(request, env, { error: "Исходная картинка больше 12 МБ" }, 413);
  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_SOURCE_BYTES) return json(request, env, { error: "Исходная картинка больше 12 МБ" }, 413);

  return new Response(bytes, {
    headers: {
      ...corsHeaders(request, env),
      "Content-Type": type,
      "Cache-Control": "no-store",
      "Content-Length": String(bytes.byteLength)
    }
  });
}

async function githubRequest(env, path, init = {}) {
  const owner = String(env.GITHUB_OWNER || "").trim();
  const repo = String(env.GITHUB_REPO || "").trim();
  const token = String(env.GITHUB_TOKEN || "").trim();
  if (!owner || !repo || !token) throw new Error("В Worker не заполнены переменные GitHub");
  return fetch("https://api.github.com/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + path, {
    ...init,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "OP-ED-Orden-Image-Uploader",
      ...(init.headers || {})
    }
  });
}

async function uploadImage(request, env) {
  let body;
  try { body = await request.json(); } catch (_) { return json(request, env, { error: "Некорректный JSON" }, 400); }
  const path = String(body.path || "");
  const content = String(body.contentBase64 || "").replace(/^data:image\/webp;base64,/, "");
  if (!/^images\/[a-z0-9][a-z0-9-]{0,99}\.webp$/.test(path)) {
    return json(request, env, { error: "Недопустимое имя файла" }, 400);
  }
  if (!content || content.length > MAX_WEBP_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(content)) {
    return json(request, env, { error: "Некорректный или слишком большой WebP" }, 413);
  }

  const apiPath = "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  let existingSha = "";
  const existing = await githubRequest(env, apiPath + "?ref=main");
  if (existing.ok) {
    const data = await existing.json();
    existingSha = String(data.sha || "");
  } else if (existing.status !== 404) {
    return json(request, env, { error: "GitHub не разрешил проверить файл: HTTP " + existing.status }, 502);
  }

  const payload = {
    message: existingSha ? "update fallback image " + path : "add fallback image " + path,
    content,
    branch: "main"
  };
  if (existingSha) payload.sha = existingSha;

  const saved = await githubRequest(env, apiPath, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await saved.json().catch(() => ({}));
  if (!saved.ok) {
    return json(request, env, { error: result.message || ("GitHub upload failed: HTTP " + saved.status) }, 502);
  }
  return json(request, env, {
    ok: true,
    path,
    commit: result.commit && result.commit.sha ? result.commit.sha : ""
  });
}


async function deleteImage(request, env) {
  let body;
  try { body = await request.json(); } catch (_) { return json(request, env, { error: "Некорректный JSON" }, 400); }
  const path = String(body.path || "");
  if (!/^images\/[a-z0-9][a-z0-9-]{0,99}\.webp$/.test(path)) {
    return json(request, env, { error: "Удалять можно только WebP-файлы из images/" }, 400);
  }

  const apiPath = "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  const existing = await githubRequest(env, apiPath + "?ref=main");
  if (existing.status === 404) return json(request, env, { ok: true, path, alreadyMissing: true });
  const current = await existing.json().catch(() => ({}));
  if (!existing.ok || !current.sha) {
    return json(request, env, { error: current.message || ("GitHub не разрешил проверить файл: HTTP " + existing.status) }, 502);
  }

  const removed = await githubRequest(env, apiPath, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "delete replaced fallback image " + path,
      sha: current.sha,
      branch: "main"
    })
  });
  const result = await removed.json().catch(() => ({}));
  if (!removed.ok) {
    return json(request, env, { error: result.message || ("GitHub delete failed: HTTP " + removed.status) }, 502);
  }
  return json(request, env, {
    ok: true,
    path,
    commit: result.commit && result.commit.sha ? result.commit.sha : ""
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return json(request, env, { ok: true, service: "OP-ED image uploader" });
    }
    if (!authorized(request, env)) return json(request, env, { error: "Неверный пароль загрузчика" }, 401);
    try {
      if (request.method === "POST" && url.pathname === "/proxy-image") return await proxyImage(request, env);
      if (request.method === "POST" && url.pathname === "/upload") return await uploadImage(request, env);
      if (request.method === "POST" && url.pathname === "/delete") return await deleteImage(request, env);
      return json(request, env, { error: "Маршрут не найден" }, 404);
    } catch (error) {
      console.error(error);
      return json(request, env, { error: error && error.message ? error.message : "Внутренняя ошибка" }, 500);
    }
  }
};
