// Güncelleme bildirgesi (manifest) biçimi, Ed25519 imzası ve uyumluluk denetimi.
//
// Yayımlanan "destekofis-guncelleme.json" dosyası bir zarftır:
//   { "schema": 1, "payload": "<base64(JSON bildirge)>", "signatures": [{ "keyId": "...", "sig": "<base64>" }] }
// İmza, payload'un ham baytları üzerinedir; böylece JSON biçimlendirmesi (boşluk, sıra) imzayı bozmaz.
// Bildirge: { schema, product, version, channel, releasedAt, notes, package: { name, size, sha256, url? },
//             requires: { minVersion?, node?, bootstrap? } }
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { compareVersions, normalizeVersion } from "./semver.mjs";

export const ENVELOPE_SCHEMA = 1;
export const MANIFEST_SCHEMA = 1;
export const PRODUCT = "DestekOfis";
export const MAX_ENVELOPE_BYTES = 64 * 1024;
export const MAX_PACKAGE_BYTES = 200 * 1024 * 1024;

export class UpdateError extends Error {
  constructor(message, code = "UPDATE_ERROR", { retryable = false } = {}) {
    super(message);
    this.name = "UpdateError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function signManifest(manifest, privateKeyPem, keyId) {
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("İmza anahtarı Ed25519 olmalı.");
  if (!keyId) throw new Error("Anahtar kimliği (keyId) gerekli.");
  const payload = Buffer.from(JSON.stringify(manifest), "utf8");
  return { schema: ENVELOPE_SCHEMA, payload: payload.toString("base64"), signatures: [{ keyId, sig: sign(null, payload, key).toString("base64") }] };
}

const keyCache = new Map();
function trustedKey(keyId, trustedKeys) {
  const encoded = Object.hasOwn(trustedKeys, keyId) ? trustedKeys[keyId] : null;
  if (typeof encoded !== "string") return null;
  if (!keyCache.has(encoded)) {
    const key = createPublicKey({ key: Buffer.from(encoded, "base64"), format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519") throw new Error(`Güvenilen anahtar Ed25519 değil: ${keyId}`);
    keyCache.set(encoded, key);
  }
  return keyCache.get(encoded);
}

function normalizeManifest(value) {
  const fail = detail => {
    throw new UpdateError(`Güncelleme bildirgesi geçersiz (${detail}).`, "MANIFEST_INVALID");
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("nesne değil");
  if (value.schema !== MANIFEST_SCHEMA) fail("şema");
  if (value.product !== PRODUCT) fail("ürün");
  const version = normalizeVersion(value.version);
  if (!version) fail("sürüm");
  let channel = "stable";
  if (value.channel === "beta") channel = "beta";
  else if (value.channel != null && value.channel !== "stable") fail("kanal");
  const pkg = value.package && typeof value.package === "object" ? value.package : {};
  if (typeof pkg.name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.zip$/.test(pkg.name)) fail("paket adı");
  if (!Number.isSafeInteger(pkg.size) || pkg.size <= 0 || pkg.size > MAX_PACKAGE_BYTES) fail("paket boyutu");
  if (typeof pkg.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(pkg.sha256)) fail("paket özeti");
  if (pkg.url != null && (typeof pkg.url !== "string" || pkg.url.length > 2048)) fail("paket adresi");
  const requires = value.requires && typeof value.requires === "object" ? value.requires : {};
  const minVersion = requires.minVersion == null ? null : normalizeVersion(requires.minVersion);
  const node = requires.node == null ? null : normalizeVersion(requires.node);
  if (requires.minVersion != null && !minVersion) fail("en düşük sürüm");
  if (requires.node != null && !node) fail("Node.js sürümü");
  if (requires.bootstrap != null && !(Number.isInteger(requires.bootstrap) && requires.bootstrap > 0)) fail("başlatıcı sürümü");
  return {
    schema: MANIFEST_SCHEMA,
    product: PRODUCT,
    version,
    channel,
    releasedAt: typeof value.releasedAt === "string" ? value.releasedAt.slice(0, 40) : null,
    notes: typeof value.notes === "string" ? value.notes.slice(0, 8000) : "",
    package: { name: pkg.name, size: pkg.size, sha256: pkg.sha256, url: pkg.url || null },
    requires: { minVersion, node, bootstrap: requires.bootstrap ?? null },
  };
}

// Zarfı doğrular; güvenilen anahtarlardan biriyle geçerli imza yoksa UpdateError fırlatır.
export function verifyEnvelope(envelope, trustedKeys) {
  if (!envelope || typeof envelope !== "object" || envelope.schema !== ENVELOPE_SCHEMA || typeof envelope.payload !== "string" || !Array.isArray(envelope.signatures)) {
    throw new UpdateError("Güncelleme bildirgesinin biçimi tanınmadı.", "ENVELOPE_INVALID");
  }
  const payload = Buffer.from(envelope.payload, "base64");
  if (!payload.length || payload.length > MAX_ENVELOPE_BYTES) throw new UpdateError("Güncelleme bildirgesi boş veya çok büyük.", "ENVELOPE_INVALID");
  let keyId = null;
  for (const item of envelope.signatures.slice(0, 8)) {
    if (!item || typeof item.keyId !== "string" || typeof item.sig !== "string") continue;
    const key = trustedKey(item.keyId, trustedKeys);
    const signature = Buffer.from(item.sig, "base64");
    if (!key || signature.length !== 64) continue;
    if (verify(null, payload, key, signature)) {
      keyId = item.keyId;
      break;
    }
  }
  if (!keyId) throw new UpdateError("Güncelleme bildirgesinin imzası doğrulanamadı; güncelleme reddedildi.", "SIGNATURE_INVALID");
  let parsed;
  try {
    parsed = JSON.parse(payload.toString("utf8"));
  } catch {
    throw new UpdateError("Güncelleme bildirgesi okunamadı.", "MANIFEST_INVALID");
  }
  return { manifest: normalizeManifest(parsed), keyId };
}

// Bu kurulum bu güncellemeyi kendiliğinden alabilir mi?
export function assessManifest(manifest, { currentVersion, channel = "stable", nodeVersion = process.versions.node, bootstrapVersion = 1 }) {
  if (compareVersions(manifest.version, currentVersion) <= 0) return { ok: false, code: "NOT_NEWER", reason: `${manifest.version} kurulu sürümden (${currentVersion}) yeni değil.` };
  if (manifest.channel === "beta" && channel !== "beta") return { ok: false, code: "CHANNEL", reason: `${manifest.version} deneme (beta) sürümü; bu kurulum kararlı kanalda.` };
  if (manifest.requires.minVersion && compareVersions(currentVersion, manifest.requires.minVersion) < 0) {
    return { ok: false, code: "MIN_VERSION", needsInstaller: true, reason: `${manifest.version} sürümüne otomatik geçiş için en az ${manifest.requires.minVersion} kurulu olmalı; kurulum dosyasıyla güncelleyin.` };
  }
  if (manifest.requires.node && compareVersions(nodeVersion, manifest.requires.node) < 0) {
    return { ok: false, code: "NODE", needsInstaller: true, reason: `${manifest.version} sürümü daha yeni bir çalışma zamanı (Node.js ${manifest.requires.node}) gerektiriyor; kurulum dosyasıyla güncelleyin.` };
  }
  if (manifest.requires.bootstrap && bootstrapVersion < manifest.requires.bootstrap) {
    return { ok: false, code: "BOOTSTRAP", needsInstaller: true, reason: `${manifest.version} sürümü için kurulum dosyasıyla güncelleme gerekiyor.` };
  }
  return { ok: true };
}
