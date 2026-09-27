// HTTP yardımcıları: güvenlik başlıkları, JSON yanıtları, gövde okuma ve çerezler.

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const SECURITY_HEADERS = Object.freeze({
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
});

// Arayüz yalnızca kendi dosyalarını yükler; satır içi betik yoktur.
export const HTML_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function send(res, status, payload, headers = {}) {
  if (res.headersSent) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(body);
}

// Dosya adı Content-Disposition için: ASCII yedek ad + RFC 5987 UTF-8 ad (Türkçe harfler korunur).
export function contentDisposition(name, { inline = false } = {}) {
  const safe = String(name || "dosya").replace(/[\u0000-\u001f"\\/:*?<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180) || "dosya";
  const ascii = safe.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/\s+/g, " ").trim() || "dosya";
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/['()]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

// İkili yanıt (Excel dışa aktarımı, belgeler). body: Buffer.
export function sendBuffer(res, body, { type = "application/octet-stream", name = "dosya", inline = false, headers = {} } = {}) {
  if (res.headersSent) return;
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "content-type": type,
    "content-length": body.length,
    "content-disposition": contentDisposition(name, { inline }),
    "cache-control": "private, no-store",
    ...headers,
  });
  res.end(body);
}

export const ok = (res, data, headers) => send(res, 200, { ok: true, data }, headers);
export const fail = (res, status, message, extra = {}) => send(res, status, { ok: false, error: message, ...extra });

export function readJson(req, { limit = 1_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers["content-type"] || "");
    const declared = Number(req.headers["content-length"] || 0);
    if (declared > limit) {
      req.resume();
      reject(new HttpError(413, "İstek gövdesi çok büyük."));
      return;
    }
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };
    req.on("data", chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        finish(new HttpError(413, "İstek gövdesi çok büyük."));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      if (!size) return finish(null, {});
      // Form/çapraz site gönderimlerine karşı yalnızca JSON kabul edilir.
      if (!type.includes("application/json")) return finish(new HttpError(415, "İstek JSON biçiminde olmalı."));
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        finish(null, parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        finish(new HttpError(400, "Geçersiz JSON."));
      }
    });
    req.on("error", error => finish(error));
  });
}

// Ham gövde (belge yükleme, v2.0.1). Çapraz site form gönderimine karşı özel başlık istenir (tarayıcı, başka siteden
// özel başlıklı isteği ön denetimsiz gönderemez).
export function readBuffer(req, { limit = 25 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (req.headers["x-hof-upload"] !== "1") {
      req.resume();
      reject(new HttpError(400, "Dosya yükleme isteği tanınmadı."));
      return;
    }
    const declared = Number(req.headers["content-length"] || 0);
    if (declared > limit) {
      req.resume();
      reject(new HttpError(413, `Dosya çok büyük (en fazla ${Math.round(limit / 1024 / 1024)} MB).`));
      return;
    }
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };
    req.on("data", chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        finish(new HttpError(413, `Dosya çok büyük (en fazla ${Math.round(limit / 1024 / 1024)} MB).`));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => finish(null, Buffer.concat(chunks)));
    req.on("error", error => finish(error));
  });
}

export function parseCookies(header = "") {
  const result = {};
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    try {
      result[key] = decodeURIComponent(raw);
    } catch {
      result[key] = raw;
    }
  }
  return result;
}

export function clientIp(req, trustProxy = false) {
  if (trustProxy) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket?.remoteAddress || "unknown";
}

// Değiştiren isteklerde başka bir siteden gelen (CSRF) çağrıları reddeder.
export function assertSameOrigin(req, trustProxy = false) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Geçersiz istek kaynağı.");
  }
  const expected = (trustProxy && req.headers["x-forwarded-host"]) || req.headers.host;
  if (host !== expected) throw new HttpError(403, "Bu istek başka bir siteden geldiği için reddedildi.");
}

export const text = (value, fallback = "") => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : fallback);

export function limited(value, max, label) {
  const result = text(value);
  if (result.length > max) throw new HttpError(400, `${label} en fazla ${max} karakter olabilir.`);
  return result;
}

export const parseJson = (value, fallback = {}) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
