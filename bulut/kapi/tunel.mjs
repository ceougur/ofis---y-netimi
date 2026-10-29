// 2.4.7 M4 — KAPICI (Cloudflare Worker) tarafının TÜNEL bölümü (docs/mobil/M4-TASARIM.md §2). M3'ün kapıcısı bu modülü içe aktarır ve
// POST /v1/tunel isteğini handleTunnelRequest'e verir (bağlama tarifi tasarım §9). Yalnız Web standartları (fetch, Request/Response, WebCrypto): Worker'da
// ve Node 22'de aynı kod çalışır; Cloudflare API çağrıları soyut fetch ile (testte sahte).
//
// Akış: program { v, license, machine, publicKey, ts, nonce, sig } gönderir →
//   1. imzalı lisans zarfı güvenilen lisans anahtarıyla (Ed25519) doğrulanır; ürün/tür, durum active, başlangıç ≤ şimdi < bitiş, düzenlenme en çok 8 gün önce;
//   2. istekteki machine = lisansın machine'i (başka ofis adına başvuru reddedilir);
//   3. sig programın Ed25519 anahtarıyla provisionMessage üzerine; ts ±5 dk;
//   4. ofis kaydı (KV "tunel:<machine>") yoksa İLK KULLANIMDA GÜVEN: açık anahtar ofise bağlanır; varsa anahtar aynı olmalı (değilse 409 tunnel-key);
//   5. Cloudflare: ofisin tüneli (ad "destekofis-<etiket>") yoksa oluşturulur (config_src "local"), varsa YENİDEN KULLANILIR; DNS CNAME
//      "ofis-<etiket>.<alan>" → "<tünel>.cfargotunnel.com" (proxied) yoksa eklenir, farklıysa düzeltilir; tünel çalıştırma belirteci alınır;
//   6. yanıt { ok, tunnelId, hostname, publicUrl, token } — Cloudflare HESAP belirteci (CF_API_TOKEN) hiçbir zaman yanıta girmez.
// Etiket = SHA-256("DestekOfis-ofis-v1|<machine>") ilk 16 onaltılık: bilgisayar kimliği DNS'te görünmez; ad tek düzeyli (ofis-….destekofis.net) çünkü
// Cloudflare'in ücretsiz sertifikası yalnız *.destekofis.net'i kapsar (iki düzeyli *.o.destekofis.net ücretli sertifika ister).

export const TUNNEL_GATE_PATH = "/v1/tunel";
export const CLOCK_SKEW_MS = 5 * 60_000;
export const LICENSE_MAX_AGE_MS = 8 * 24 * 3_600_000;
const CF_API = "https://api.cloudflare.com/client/v4";
const enc = new TextEncoder();

const toHex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
const b64ToBytes = text => Uint8Array.from(atob(String(text)), c => c.charCodeAt(0));
const bytesToB64 = bytes => btoa(String.fromCharCode(...bytes));
const sha256Hex = async text => toHex(await crypto.subtle.digest("SHA-256", enc.encode(String(text))));

export class GateError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Programın da birebir kurduğu imza metni (server/lib/tunnel/gate-client.mjs). */
export const provisionMessage = ({ machine, publicKey, ts, nonce, licenseHash }) => `DestekOfis-tunel-v1\n${machine}\n${publicKey}\n${ts}\n${nonce}\n${licenseHash}`;

export async function officeLabel(machine) {
  return (await sha256Hex(`DestekOfis-ofis-v1|${machine}`)).slice(0, 16);
}

async function importEd25519(spkiB64) {
  return crypto.subtle.importKey("spki", b64ToBytes(spkiB64), { name: "Ed25519" }, false, ["verify"]);
}

/** İmzalı lisans zarfını doğrular (server/lib/license-token.mjs verifyToken'ın WebCrypto karşılığı; iddiaların denetimi kapıcıya göre). */
export async function verifyLicenseEnvelope(envelope, trustedKeys, { now = Date.now(), maxAgeMs = LICENSE_MAX_AGE_MS } = {}) {
  const bad = message => new GateError(403, "tunnel-license", message);
  if (!envelope || envelope.schema !== 1 || typeof envelope.payload !== "string" || !Array.isArray(envelope.signatures)) throw bad("lisans biçimi");
  let payload;
  try {
    payload = b64ToBytes(envelope.payload);
  } catch {
    throw bad("lisans biçimi");
  }
  if (!payload.length || payload.length > 16 * 1024) throw bad("lisans boyu");
  let verified = false;
  for (const item of envelope.signatures.slice(0, 8)) {
    const spki = item && Object.hasOwn(trustedKeys, item.keyId) ? trustedKeys[item.keyId] : null;
    if (!spki || typeof item.sig !== "string") continue;
    try {
      const signature = b64ToBytes(item.sig);
      if (signature.length !== 64) continue;
      if (await crypto.subtle.verify({ name: "Ed25519" }, await importEd25519(spki), signature, payload)) {
        verified = true;
        break;
      }
    } catch {
      // bozuk imza / anahtar: sıradaki
    }
  }
  if (!verified) throw bad("lisans imzası");
  let claims;
  try {
    claims = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    throw bad("lisans okunamadı");
  }
  if (claims?.product !== "DestekOfis" || claims.type !== "license-token" || !["trial", "license"].includes(claims.kind)) throw bad("lisans türü");
  if ((claims.status ?? "active") !== "active") throw bad("lisans engelli");
  if (!/^[a-f0-9]{32}$/.test(String(claims.machine || ""))) throw bad("bilgisayar kimliği");
  const issued = Date.parse(claims.issuedAt);
  const starts = Date.parse(claims.startsAt ?? claims.issuedAt);
  const expires = claims.expiresAt == null ? null : Date.parse(claims.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(starts)) throw bad("lisans zamanı");
  if (issued > now + CLOCK_SKEW_MS || now - issued > maxAgeMs) throw bad("lisans bilgisi eski");
  if (starts > now + CLOCK_SKEW_MS) throw bad("lisans başlamadı");
  if (expires !== null && !(expires > now)) throw bad("lisans süresi doldu");
  return claims;
}

/**
 * Cloudflare API (soyut fetch). İzinler: Account → Cloudflare Tunnel: Edit; Zone (alan) → DNS: Edit.
 */
export function createCloudflareTunnels({ accountId, zoneId, apiToken, fetchImpl = (...args) => fetch(...args) }) {
  async function call(method, path, body) {
    let response;
    try {
      response = await fetchImpl(`${CF_API}${path}`, { method, headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new GateError(502, "tunnel-cloudflare", "Cloudflare'e ulaşılamadı.");
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok || !data?.success) {
      const error = new GateError(502, "tunnel-cloudflare", `Cloudflare isteği başarısız (${method} ${path.split("?")[0]} → ${response.status}).`);
      error.cfErrors = data?.errors || [];
      throw error;
    }
    return data.result;
  }
  return {
    async findTunnel(name) {
      const list = await call("GET", `/accounts/${accountId}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`);
      return (Array.isArray(list) ? list : []).find(item => item?.name === name && !item.deleted_at) || null;
    },
    async createTunnel(name) {
      const secret = bytesToB64(crypto.getRandomValues(new Uint8Array(32)));
      return call("POST", `/accounts/${accountId}/cfd_tunnel`, { name, tunnel_secret: secret, config_src: "local" });
    },
    async tunnelToken(id) {
      return call("GET", `/accounts/${accountId}/cfd_tunnel/${id}/token`);
    },
    async ensureCname(hostname, target) {
      const list = await call("GET", `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`);
      const found = (Array.isArray(list) ? list : []).find(item => item?.name === hostname);
      const record = { type: "CNAME", name: hostname, content: target, proxied: true, ttl: 1, comment: "DestekOfis ofis tüneli (kapıcı)" };
      if (!found) return call("POST", `/zones/${zoneId}/dns_records`, record);
      if (found.content === target && found.proxied === true) return found;
      return call("PATCH", `/zones/${zoneId}/dns_records/${found.id}`, { content: target, proxied: true });
    },
  };
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/**
 * @param {object} o
 * @param {object} o.cloudflare createCloudflareTunnels(...) ya da testte sahte
 * @param {object} o.kv Workers KV benzeri { get(key) → string|null, put(key, value) }
 * @param {object} o.trustedKeys lisans açık anahtarları { keyId: SPKI DER base64 } (server/lib/license-keys.mjs ile aynı)
 * @param {string} o.domain ör. "destekofis.net"
 * @param {Function} [o.licenseStatus] isteğe bağlı ek denetim (claims) → Promise<boolean> (M3: lisans servisinden engel sorgusu)
 */
export function createTunnelGate({ cloudflare, kv, trustedKeys, domain = "destekofis.net", now = () => Date.now(), maxAgeMs = LICENSE_MAX_AGE_MS, licenseStatus = null }) {
  async function provision(body) {
    if (!body || body.v !== 1 || typeof body.sig !== "string" || typeof body.publicKey !== "string" || typeof body.nonce !== "string" || typeof body.ts !== "string") {
      throw new GateError(400, "tunnel-request", "İstek biçimi tanınmadı.");
    }
    const claims = await verifyLicenseEnvelope(body.license, trustedKeys, { now: now(), maxAgeMs });
    if (String(body.machine || "") !== claims.machine) throw new GateError(403, "tunnel-machine", "Lisans bu bilgisayara ait değil.");
    if (licenseStatus && !(await licenseStatus(claims))) throw new GateError(403, "tunnel-license", "Lisans kapıcıda geçerli görünmüyor.");
    const ts = Date.parse(body.ts);
    if (!Number.isFinite(ts) || Math.abs(now() - ts) > CLOCK_SKEW_MS) throw new GateError(401, "tunnel-signature", "İstek zamanı tutmuyor (saat?).");
    let key;
    try {
      key = await importEd25519(body.publicKey);
    } catch {
      throw new GateError(400, "tunnel-request", "Program anahtarı tanınmadı.");
    }
    const message = provisionMessage({ machine: claims.machine, publicKey: body.publicKey, ts: body.ts, nonce: body.nonce, licenseHash: await sha256Hex(body.license.payload) });
    let valid = false;
    try {
      valid = await crypto.subtle.verify({ name: "Ed25519" }, key, b64ToBytes(body.sig), enc.encode(message));
    } catch {
      valid = false;
    }
    if (!valid) throw new GateError(401, "tunnel-signature", "Program imzası doğrulanamadı.");

    const kvKey = `tunel:${claims.machine}`;
    let record = null;
    try {
      record = JSON.parse((await kv.get(kvKey)) || "null");
    } catch {
      record = null;
    }
    if (record?.publicKey && record.publicKey !== body.publicKey) throw new GateError(409, "tunnel-key", "Bu ofisin tüneli başka bir program anahtarına bağlı.");

    const label = await officeLabel(claims.machine);
    const name = `destekofis-${label}`;
    const hostname = `ofis-${label}.${domain}`;
    let tunnel = await cloudflare.findTunnel(name);
    if (!tunnel) {
      try {
        tunnel = await cloudflare.createTunnel(name);
      } catch (error) {
        // Eşzamanlı iki başvuru: ikincisi "ad var" alır → yeniden ara.
        tunnel = await cloudflare.findTunnel(name);
        if (!tunnel) throw error;
      }
    }
    if (record && record.tunnelId && record.tunnelId !== tunnel.id) record = { ...record, previousTunnelId: record.tunnelId };
    await cloudflare.ensureCname(hostname, `${tunnel.id}.cfargotunnel.com`);
    const token = await cloudflare.tunnelToken(tunnel.id);
    if (typeof token !== "string" || !token) throw new GateError(502, "tunnel-cloudflare", "Tünel belirteci alınamadı.");
    const at = new Date(now()).toISOString();
    await kv.put(kvKey, JSON.stringify({ ...(record || {}), machine: claims.machine, licenseId: claims.licenseId, publicKey: body.publicKey, tunnelId: tunnel.id, hostname, createdAt: record?.createdAt || at, lastSeenAt: at }));
    return { ok: true, tunnelId: tunnel.id, hostname, publicUrl: `https://${hostname}`, token };
  }

  /** Worker fetch işleyicisinden çağrılır (yalnız POST /v1/tunel). */
  async function handleTunnelRequest(request) {
    if (request.method !== "POST") return json(405, { ok: false, code: "tunnel-request", error: "Yalnız POST." });
    let body;
    try {
      const text = await request.text();
      if (text.length > 32 * 1024) throw new Error("büyük");
      body = JSON.parse(text);
    } catch {
      return json(400, { ok: false, code: "tunnel-request", error: "İstek okunamadı." });
    }
    try {
      return json(200, await provision(body));
    } catch (error) {
      if (error instanceof GateError) return json(error.status, { ok: false, code: error.code, error: error.message });
      return json(500, { ok: false, code: "tunnel-cloudflare", error: "Kapıcı isteği tamamlayamadı." });
    }
  }

  /** Operatör işi (ör. aynı bilgisayara temiz kurulum, anahtar kayboldu): ofisin anahtar bağını kaldırır; tünel ve ad kalır. */
  async function resetBinding(machine) {
    const kvKey = `tunel:${String(machine || "").toLowerCase()}`;
    const record = JSON.parse((await kv.get(kvKey)) || "null");
    if (!record) return false;
    await kv.put(kvKey, JSON.stringify({ ...record, publicKey: null, resetAt: new Date(now()).toISOString() }));
    return true;
  }

  return { provision, handleTunnelRequest, resetBinding };
}
