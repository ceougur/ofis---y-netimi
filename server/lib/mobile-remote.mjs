// Mobil uzaktan erişim — program tarafı (2.4.7 M2; tasarım docs/mobil/M2-TASARIM.md; kullanıcı kararları CLAUDE.md "KARAR (kullanıcı, 26.10.2026, mobil)"
// ve docs/2.4.7-IS-LISTESI.md "KARARLAR — M2" P1–P13; bağımsız kâhin test/bagimsiz/mobil-erisim/).
//
// Bu modülün işi uzaktan gelen isteğin GÜVENLİK SINIRI: karekodlu cihaz eşleme, program başına eşli cihaz sınırı (lisansta mobileDevices, yoksa 3; iki
// şirket birlikte), cihaza bağlı kısa ömürlü uzak oturum, uzak giriş deneme sınırı ve yol beyaz listesi. Veriyi göstermek M1'in işidir (lib/mobile.mjs:
// /api/mobil/… → programın mevcut ucu; yetki, şirket erişimi, lisans o uçta). Uzak istek AYRI YEREL DİNLEYİCİYE gelir (app.listenRemote; M4'te tünel
// yalnız oraya bağlanır) ve burada işaretlenir (http.mjs REMOTE_REQUEST): başlık ya da adres kararı değiştirmez.
//
// Kayıtlar ortak katmanda (göç v38: mobile_access, mobile_codes, mobile_devices, mobile_sessions); kod, cihaz sırrı ve oturum belirteci yalnız SHA-256
// karmasıyla saklanır. Süreler config.remoteNow saatiyle (üretimde gerçek saat).
import { createHash, createPublicKey, randomBytes, randomUUID, timingSafeEqual, verify as verifySignature } from "node:crypto";
import { HttpError, REMOTE_REQUEST, REMOTE_SESSION, assertSameOrigin, isRemoteRequest, parseCookies, readJson, send } from "./http.mjs";
import { DUMMY_HASH, verifyPassword } from "./passwords.mjs";
import { qrSvg } from "./qr.mjs";

// P1 karekod 5 dk · P7 uzak oturum boşta 15 dk · P8 en çok 12 saat · P11 uzaktan 5 ardışık yanlış parola · P13 kilit 15 dk (kullanıcı kararları 29.10.2026).
export const MOBILE_RULES = Object.freeze({ codeMinutes: 5, idleMinutes: 15, maxHours: 12, attempts: 5, lockMinutes: 15, challengeSeconds: 120 });
export const DEFAULT_DEVICE_LIMIT = 3;
export const DEVICE_COOKIE = "hof_device";
export const REMOTE_SESSION_COOKIE = "hof_mobil";
export const PAIR_PATH = "/api/mobil/eslesme";
export const CHALLENGE_PATH = "/api/mobil/session/challenge";
export const REMOTE_LOGIN_PATH = "/api/mobil/session/login";
export const REMOTE_LOGOUT_PATH = "/api/mobil/session/logout";
export const DEVICE_KINDS = Object.freeze({ telefon: "Telefon", tablet: "Tablet", tarayici: "Uzak Tarayıcı" });
// Girişte cihazın imzaladığı metin (meydan okuma tek kullanımlık; cihaz kimliğine bağlı).
export const proofMessage = (deviceId, nonce) => `DestekOfis-mobil-giris\n${deviceId}\n${nonce}`;

const MINUTE = 60_000;
const sha256 = value => createHash("sha256").update(String(value)).digest("hex");
const token = (bytes = 32) => randomBytes(bytes).toString("base64url");
const DEVICE_ID = /^dev-[0-9a-f-]{36}$/;
const SECRET = /^[A-Za-z0-9_-]{43}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const sameHash = (a, b) => {
  const left = Buffer.from(String(a), "hex");
  const right = Buffer.from(String(b), "hex");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
};
const error = (status, code, message) => new HttpError(status, message, { code });

// Ret sınıfları (kâhinin dili; sürücü HTTP yanıtını code alanından okur) ve kullanıcıya görünen ileti.
export const REMOTE_ERRORS = Object.freeze({
  "remote-device": "Bu cihaz eşli değil ya da eşlemesi kaldırıldı. Yöneticinizden Yönetim → Mobil Cihazlar'da yeni karekod isteyin.",
  "remote-proof": "Cihaz doğrulanamadı. Sayfayı yenileyip yeniden deneyin; sürerse cihazı yeniden eşleyin.",
  "remote-license": "Lisans geçerli değil; uzaktan erişim kapalı. Ofisinizdeki programın yöneticisi Lisans bölümüne bakmalı.",
  "remote-path": "Bu adres uzaktan erişime açık değil.",
  "remote-session": "Oturum gerekli ya da süresi doldu. Yeniden giriş yapın.",
  "remote-code": "Karekod geçersiz ya da süresi dolmuş. Yöneticinizden yeni karekod isteyin.",
  "remote-permission": "Bu kullanıcının uzaktan bağlanma izni yok.",
  "remote-limit": "Eşli cihaz sınırı dolu. Yeni cihaz için Yönetim → Mobil Cihazlar'dan önce birini silin.",
  "remote-device-user": "Bu cihaz başka bir kullanıcıya eşli. Her kullanıcı kendi cihazını eşler.",
  "remote-locked": "Çok fazla hatalı deneme yapıldı. 15 dakika sonra yeniden deneyin ya da yöneticinizden parolanızı sıfırlamasını isteyin.",
  "remote-password": "Kullanıcı adı veya parola hatalı.",
  "remote-password-change": "Parolanızı önce ofisteki bilgisayardan değiştirin; sonra uzaktan girebilirsiniz.",
  "remote-key": "Cihaz anahtarı tanınmadı. Tarayıcınızı güncelleyip karekodu yeniden okutun.",
  "remote-kapi": "Uzak bağlantı kapıcı üzerinden gelmedi; istek reddedildi.",
});
const fail = (status, code) => error(status, code, REMOTE_ERRORS[code]);

/**
 * Uzak isteğin yolu: ham istek satırında (URL çözülmeden ÖNCE — WHATWG URL "%2e%2e"yi çözüp yolu yükseltir) yalnız /mobil/ ve /api/mobil/ önekleri;
 * "." / ".." bölümü (kodlanmışı dahil), ters bölü, çift bölü, denetim karakteri ve ikinci kat kodlama reddedilir. Dönüş: null (izinli) ya da neden.
 */
export function remotePathProblem(rawUrl) {
  const raw = String(rawUrl ?? "");
  if (!raw.startsWith("/")) return "not-absolute";
  const pathPart = raw.split("?")[0].split("#")[0];
  let decoded;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    return "bad-encoding";
  }
  if (decoded.includes("%")) {
    try {
      if (decodeURIComponent(decoded) !== decoded) return "double-encoding";
    } catch {
      return "double-encoding";
    }
  }
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.includes("//")) return "separator";
  if (decoded.split("/").slice(1).some(segment => segment === "." || segment === "..")) return "dot-segment";
  if (!(decoded.startsWith("/mobil/") || decoded.startsWith("/api/mobil/"))) return "prefix";
  return null;
}
const decodedPath = raw => {
  try {
    return decodeURIComponent(String(raw).split("?")[0]);
  } catch {
    return "";
  }
};

// Cihazın açık anahtarı (WebCrypto ECDSA P-256, JWK). Gizli bileşen (d) taşıyan anahtar reddedilir.
export function publicKeyOf(value) {
  const jwk = value && typeof value === "object" ? value : null;
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || "d" in jwk || !B64URL.test(String(jwk.x || "")) || !B64URL.test(String(jwk.y || ""))) throw fail(400, "remote-key");
  const clean = { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };
  try {
    createPublicKey({ key: clean, format: "jwk" });
  } catch {
    throw fail(400, "remote-key");
  }
  return clean;
}

const cleanName = (value, kind) => {
  const text = String(value ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return text || DEVICE_KINDS[kind] || "Cihaz";
};

/**
 * @param {object} o
 * @param {object} o.store ortak katmanın (001) veri tabanı
 * @param {object} o.license lib/license.mjs hizmeti (status().writable, mobileDeviceLimit())
 * @param {Function} o.clock uzaktan erişim saati (config.remoteNow; now.ms()/now.iso())
 * @param {Function} [o.audit] işlem geçmişi
 */
export function createMobileRemote({ store, license, clock, audit = () => {}, log = console, publicUrl = "" }) {
  const nowMs = () => clock.ms();
  const nowIso = () => new Date(nowMs()).toISOString();
  let remoteUrl = String(publicUrl || "").replace(/\/+$/, "");
  let gatekeeper = null; // 2.4.7 M3: lib/mobile-sync.mjs (kapıcı işareti, eşlemede şifreleme anahtarı ve ofis anahtarı)
  const challenges = new Map(); // cihaz kimliği → { nonce, expires }
  const attempts = new Map(); // kullanıcı kimliği → { fails, lockedUntil } (P12: kullanıcı başına; yerel giriş sayacından AYRI)

  const limit = () => {
    try {
      const value = license?.mobileDeviceLimit?.();
      return Number.isInteger(value) && value >= 0 ? value : DEFAULT_DEVICE_LIMIT;
    } catch {
      return DEFAULT_DEVICE_LIMIT;
    }
  };
  // Lisans "yazılabilir" durumdayken (deneme, lisanslı, geçiş) uzak erişim açık; salt okunur her durumda kapalı (eşlemeler silinmez).
  const licenseOk = () => {
    try {
      return Boolean(license ? license.status().writable : true);
    } catch {
      return false;
    }
  };
  const activeUser = id => store.get("SELECT id, username, display_name, role, active, deleted_at, must_change_password, password_hash FROM users WHERE id = ? AND deleted_at IS NULL", id);
  const remoteAllowed = userId => Boolean(store.get("SELECT 1 AS found FROM mobile_access WHERE user_id = ? AND remote = 1", userId));
  const usedCount = () => store.get("SELECT COUNT(*) AS n FROM mobile_devices d JOIN users u ON u.id = d.user_id WHERE d.revoked_at IS NULL AND u.deleted_at IS NULL").n;

  // ---------- Yönetim (yalnız yönetici; routes/mobile-admin.mjs) ----------
  function setRemoteAccess(admin, userId, remote) {
    const user = activeUser(userId);
    if (!user) throw new HttpError(404, "Kullanıcı bulunamadı.");
    const at = nowIso();
    let revoked = 0;
    store.tx(() => {
      store.run(
        "INSERT INTO mobile_access (user_id, remote, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET remote = excluded.remote, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
        user.id, remote ? 1 : 0, at, admin?.id || "",
      );
      // Eylül planı (K9): izin kaldırılınca yeniden eşleme gerekir → kullanıcının bütün cihazları, uzak oturumları ve bekleyen karekodları düşer.
      if (!remote) revoked = revokeUserDevices(user.id, "permission", admin);
    });
    audit(admin, remote ? "mobile.access.granted" : "mobile.access.revoked", user.id, { username: user.username, devices: revoked || undefined });
    return { userId: user.id, remote: Boolean(remote), revokedDevices: revoked };
  }
  function revokeUserDevices(userId, reason, admin = null) {
    const at = nowIso();
    const ids = store.all("SELECT id FROM mobile_devices WHERE user_id = ? AND revoked_at IS NULL", userId).map(row => row.id);
    store.run("UPDATE mobile_devices SET revoked_at = ?, revoked_by = ?, revoke_reason = ? WHERE user_id = ? AND revoked_at IS NULL", at, admin?.id || "", reason, userId);
    store.run("DELETE FROM mobile_sessions WHERE user_id = ?", userId);
    store.run("UPDATE mobile_codes SET state = 'revoked' WHERE user_id = ? AND state = 'active'", userId);
    for (const id of ids) challenges.delete(id);
    return ids.length;
  }

  // P4: sınır doluyken karekod üretilmez. P2: kişinin önceki etkin karekodu geçersiz olur. P1: 5 dk.
  function createCode(admin, userId) {
    if (!licenseOk()) throw fail(403, "remote-license");
    const user = activeUser(userId);
    if (!user) throw new HttpError(404, "Kullanıcı bulunamadı.");
    if (!user.active) throw new HttpError(400, "Pasif hesaba karekod oluşturulamaz.", { code: "remote-inactive" });
    if (!remoteAllowed(user.id)) throw fail(403, "remote-permission");
    const code = token(16);
    const createdMs = nowMs();
    const expires = new Date(createdMs + MOBILE_RULES.codeMinutes * MINUTE).toISOString();
    store.tx(() => {
      if (usedCount() >= limit()) throw fail(409, "remote-limit");
      store.run("UPDATE mobile_codes SET state = 'revoked' WHERE user_id = ? AND state = 'active'", user.id);
      store.run("INSERT INTO mobile_codes (code_hash, user_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)", sha256(code), user.id, admin?.id || "", new Date(createdMs).toISOString(), expires);
    });
    audit(admin, "mobile.code.created", user.id, { username: user.username, expiresAt: expires });
    const url = remoteUrl ? `${remoteUrl}/mobil/#eslesme=${code}` : "";
    return { code, url, expiresAt: expires, minutes: MOBILE_RULES.codeMinutes, user: { id: user.id, name: user.display_name }, qr: url ? qrSvg(url, { scale: 5 }) : "" };
  }

  function revokeDevice(admin, deviceId) {
    const device = store.get("SELECT d.id, d.name, d.user_id, u.display_name AS user_name FROM mobile_devices d LEFT JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.revoked_at IS NULL", String(deviceId || ""));
    if (!device) throw new HttpError(404, "Cihaz bulunamadı ya da zaten silinmiş.", { code: "remote-device-missing" });
    store.tx(() => {
      store.run("UPDATE mobile_devices SET revoked_at = ?, revoked_by = ?, revoke_reason = 'deleted' WHERE id = ?", nowIso(), admin?.id || "", device.id);
      // Cihaz silinince açık uzak oturumları HEMEN düşer (aynı işlem).
      store.run("DELETE FROM mobile_sessions WHERE device_id = ?", device.id);
    });
    challenges.delete(device.id);
    audit(admin, "mobile.device.revoked", device.id, { name: device.name, user: device.user_name || "" });
    return { id: device.id, used: usedCount(), limit: limit() };
  }

  function adminView() {
    const users = store
      .all(
        `SELECT u.id, u.username, u.display_name AS name, u.role, u.active, COALESCE(a.remote, 0) AS remote
         FROM users u LEFT JOIN mobile_access a ON a.user_id = u.id WHERE u.deleted_at IS NULL ORDER BY u.display_name COLLATE NOCASE`,
      )
      .map(row => ({ id: row.id, username: row.username, name: row.name, role: row.role, active: Boolean(row.active), remote: Boolean(row.remote) }));
    const devices = store
      .all(
        `SELECT d.id, d.name, d.kind, d.user_id AS userId, u.display_name AS userName, u.username, d.created_at AS createdAt, d.last_seen_at AS lastSeenAt
         FROM mobile_devices d JOIN users u ON u.id = d.user_id WHERE d.revoked_at IS NULL AND u.deleted_at IS NULL ORDER BY d.created_at, d.id`,
      )
      .map(row => ({ ...row, kindLabel: DEVICE_KINDS[row.kind] || row.kind }));
    const max = limit();
    return { limit: max, used: devices.length, full: devices.length >= max, licenseOk: licenseOk(), remoteUrl, codeMinutes: MOBILE_RULES.codeMinutes, users, devices };
  }

  // Kullanıcı silinince cihazları silinir (yer açılır); pasifleşince, parola sıfırlanınca ya da "Oturumları Kapat"ta uzak oturumları kapanır.
  const onUserDeleted = (userId, admin = null) => store.tx(() => revokeUserDevices(userId, "user-deleted", admin));
  const closeUserSessions = userId => store.run("DELETE FROM mobile_sessions WHERE user_id = ?", userId).changes;

  // Süresi geçmiş uzak oturum ve karekod satırları (saatte bir; app.mjs oturum temizliğiyle).
  const purge = () => {
    const at = nowIso();
    const sessions = store.run("DELETE FROM mobile_sessions WHERE expires_at <= ? OR last_seen_at <= ?", at, new Date(nowMs() - MOBILE_RULES.idleMinutes * MINUTE).toISOString()).changes;
    const codes = store.run("DELETE FROM mobile_codes WHERE state <> 'used' AND expires_at <= ?", new Date(nowMs() - 86_400_000).toISOString()).changes;
    return { sessions, codes };
  };

  // M3 kapıcı için (docs/mobil/M2-TASARIM.md §2): kapıcı sınırı ve cihazı programdan bağımsız denetler (K13).
  const gatekeeperSnapshot = () => ({
    limit: limit(),
    devices: store.all("SELECT d.id, d.user_id AS userId, d.public_key AS publicKey, d.created_at AS createdAt FROM mobile_devices d JOIN users u ON u.id = d.user_id WHERE d.revoked_at IS NULL AND u.deleted_at IS NULL ORDER BY d.created_at, d.id").map(row => ({ ...row, publicKey: JSON.parse(row.publicKey) })),
  });

  // ---------- Cihaz ve uzak oturum ----------
  // Cihaz kimliği: HttpOnly çerez "<cihaz kimliği>.<256 bit sır>" (veri tabanında sırrın karması). M3'te kapıcının imzalı işareti buraya eklenir.
  function deviceFromRequest(req) {
    const raw = parseCookies(req.headers.cookie || "")[DEVICE_COOKIE] || "";
    if (!raw) return { present: false, device: null };
    const [id, secret] = raw.split(".");
    if (!DEVICE_ID.test(id || "") || !SECRET.test(secret || "")) return { present: true, device: null };
    const row = store.get(
      "SELECT d.id, d.user_id, d.name, d.secret_hash, d.public_key FROM mobile_devices d JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.revoked_at IS NULL AND u.deleted_at IS NULL",
      id,
    );
    if (!row || !sameHash(row.secret_hash, sha256(secret))) return { present: true, device: null };
    return { present: true, device: row };
  }

  function sessionFor(req, device) {
    const raw = parseCookies(req.headers.cookie || "")[REMOTE_SESSION_COOKIE] || "";
    if (!raw) return null;
    const hash = sha256(raw);
    const row = store.get("SELECT token_hash, device_id, user_id, created_at, last_seen_at, expires_at FROM mobile_sessions WHERE token_hash = ?", hash);
    // Oturum cihaza bağlıdır: başka cihazın çereziyle geçmez.
    if (!row || row.device_id !== device.id || row.user_id !== device.user_id) return null;
    const t = nowMs();
    // V3: süre dolduğu an geçersiz — boşta (son istek + 15 dk) ve en uzun ömür (giriş + 12 saat).
    if (t - Date.parse(row.last_seen_at) >= MOBILE_RULES.idleMinutes * MINUTE || t >= Date.parse(row.expires_at)) {
      store.run("DELETE FROM mobile_sessions WHERE token_hash = ?", hash);
      return null;
    }
    const user = activeUser(row.user_id);
    if (!user || !user.active || !remoteAllowed(user.id)) return null;
    const at = new Date(t).toISOString();
    store.run("UPDATE mobile_sessions SET last_seen_at = ? WHERE token_hash = ?", at, hash);
    store.run("UPDATE mobile_devices SET last_seen_at = ? WHERE id = ?", at, device.id);
    return row;
  }

  const cookieFlags = req => {
    const host = String(req.headers.host || "");
    const loopback = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host);
    return `Path=/; HttpOnly; SameSite=Strict${loopback ? "" : "; Secure"}`;
  };
  const setCookie = (req, name, value, maxAgeSeconds) => `${name}=${value ? encodeURIComponent(value) : ""}; Max-Age=${maxAgeSeconds}; ${cookieFlags(req)}`;

  // ---------- Eşleme (telefon; cihaz çerezi gerekmez) ----------
  async function pair(req, res, previous) {
    const body = await readJson(req, { limit: 16_384 });
    const code = String(body.kod ?? body.code ?? "");
    const kind = Object.hasOwn(DEVICE_KINDS, body.tur ?? body.kind) ? body.tur ?? body.kind : "telefon";
    const name = cleanName(body.ad ?? body.name, kind);
    const key = publicKeyOf(body.anahtar ?? body.publicKey);
    const encKey = gatekeeper?.encKeyOf?.(body) ?? null; // 2.4.7 M3
    const t = nowMs();
    const deviceId = `dev-${randomUUID()}`;
    const secret = token(32);
    let user = null;
    // Tek işlem (SQLite; eşzamanlı iki eşleme son yer için yarışırsa yalnız biri kazanır): kod → kullanıcının uzak izni → sınır (P3 reddet; kod harcanmaz) →
    // kayıt + kod kullanıldı. Aynı tarayıcı yeniden eşlenirse önceki eşlemesi kaldırılır (yer tutmaz).
    store.tx(() => {
      const row = code ? store.get("SELECT code_hash, user_id, state, expires_at FROM mobile_codes WHERE code_hash = ?", sha256(code)) : null;
      if (!row || row.state !== "active" || t >= Date.parse(row.expires_at)) throw fail(400, "remote-code");
      user = activeUser(row.user_id);
      if (!user || !user.active || !remoteAllowed(user.id)) throw fail(403, "remote-permission");
      const replaced = previous && previous.user_id === user.id ? previous.id : null;
      const used = usedCount() - (replaced ? 1 : 0);
      if (used >= limit()) throw fail(409, "remote-limit");
      if (replaced) {
        store.run("UPDATE mobile_devices SET revoked_at = ?, revoke_reason = 'replaced' WHERE id = ?", new Date(t).toISOString(), replaced);
        store.run("DELETE FROM mobile_sessions WHERE device_id = ?", replaced);
      }
      const at = new Date(t).toISOString();
      store.run(
        "INSERT INTO mobile_devices (id, user_id, name, kind, secret_hash, public_key, created_at, created_by, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        deviceId, user.id, name, kind, sha256(secret), JSON.stringify(key), at, "", at,
      );
      store.run("UPDATE mobile_codes SET state = 'used', used_at = ?, device_id = ? WHERE code_hash = ?", at, deviceId, row.code_hash);
    });
    audit({ id: user.id, display_name: user.display_name }, "mobile.device.paired", deviceId, { name, kind, user: user.display_name });
    const extra = gatekeeper?.paired?.(deviceId, encKey) || {}; // 2.4.7 M3: { ofis } (şifreleme anahtarı kaydı mobile-sync'te)
    // Cihaz çerezi kalıcı (eşleme bir kez yapılır; yönetici silene ya da izin kalkana dek).
    send(res, 200, { ok: true, data: { device: { id: deviceId, name, kind }, user: { name: user.display_name, username: user.username }, ...extra } }, {
      "set-cookie": [setCookie(req, DEVICE_COOKIE, `${deviceId}.${secret}`, 400 * 86_400), setCookie(req, REMOTE_SESSION_COOKIE, "", 0)],
    });
  }

  // ---------- Giriş (cihaza bağlı) ----------
  function challenge(res, device) {
    const nonce = token(32);
    challenges.set(device.id, { nonce, expires: nowMs() + MOBILE_RULES.challengeSeconds * 1000 });
    send(res, 200, { ok: true, data: { nonce, device: device.id } });
  }
  function proofValid(device, body) {
    const wanted = challenges.get(device.id);
    challenges.delete(device.id); // tek kullanımlık (başarısız denemede de)
    const nonce = String(body.nonce ?? "");
    const signature = String(body.signature ?? body.imza ?? "");
    if (!wanted || wanted.nonce !== nonce || nowMs() >= wanted.expires || !B64URL.test(signature)) return false;
    try {
      const key = createPublicKey({ key: JSON.parse(device.public_key), format: "jwk" });
      return verifySignature("sha256", Buffer.from(proofMessage(device.id, nonce)), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"));
    } catch {
      return false;
    }
  }
  const lockOf = userId => {
    const entry = attempts.get(userId);
    if (!entry) return null;
    if (entry.lockedUntil && nowMs() >= entry.lockedUntil) {
      attempts.delete(userId);
      return null;
    }
    return entry;
  };
  async function login(req, res, device) {
    const body = await readJson(req, { limit: 16_384 });
    if (!proofValid(device, body)) throw fail(401, "remote-proof");
    const username = String(body.username ?? "").trim();
    const user = username ? store.get("SELECT id, username, display_name, active, deleted_at, must_change_password, password_hash FROM users WHERE username = ? COLLATE NOCASE AND deleted_at IS NULL", username) : null;
    // P6: cihazdan yalnız eşlendiği kullanıcı girer (bilinmeyen kullanıcı adı da aynı yanıtı alır).
    if (!user || user.id !== device.user_id) throw fail(403, "remote-device-user");
    // P11–P13 (P12: kullanıcı başına; uzaktaki denemeler yerel kullanıcıların sayacını kilitlemez).
    const entry = lockOf(user.id);
    if (entry?.lockedUntil) {
      const wait = Math.ceil((entry.lockedUntil - nowMs()) / 1000);
      throw new HttpError(429, REMOTE_ERRORS["remote-locked"], { code: "remote-locked", retryAfter: wait });
    }
    const valid = verifyPassword(String(body.password ?? ""), user.password_hash || DUMMY_HASH);
    if (!valid) {
      const next = entry || { fails: 0, lockedUntil: 0 };
      next.fails += 1;
      if (next.fails >= MOBILE_RULES.attempts) {
        next.fails = 0;
        next.lockedUntil = nowMs() + MOBILE_RULES.lockMinutes * MINUTE;
      }
      attempts.set(user.id, next);
      audit({ id: "anonymous", display_name: username }, "mobile.login_failed", user.id, { device: device.name, locked: Boolean(next.lockedUntil) || undefined });
      throw fail(401, "remote-password");
    }
    // Parolası doğru ama izni olmayan giriş sayılmaz (sayaç değişmez).
    if (!user.active || !remoteAllowed(user.id)) throw fail(403, "remote-permission");
    attempts.delete(user.id);
    if (user.must_change_password) throw fail(403, "remote-password-change");
    const raw = token(32);
    const t = nowMs();
    const at = new Date(t).toISOString();
    store.tx(() => {
      // Cihaz başına tek uzak oturum: aynı cihazda yeni giriş eskisini kapatır.
      store.run("DELETE FROM mobile_sessions WHERE device_id = ?", device.id);
      store.run("INSERT INTO mobile_sessions (token_hash, device_id, user_id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)", sha256(raw), device.id, user.id, at, at, new Date(t + MOBILE_RULES.maxHours * 3_600_000).toISOString());
      store.run("UPDATE mobile_devices SET last_seen_at = ? WHERE id = ?", at, device.id);
    });
    audit({ id: user.id, display_name: user.display_name }, "mobile.login", user.id, { device: device.name });
    send(res, 200, { ok: true, data: { user: { name: user.display_name, username: user.username }, device: { id: device.id, name: device.name } } }, {
      "set-cookie": setCookie(req, REMOTE_SESSION_COOKIE, raw, MOBILE_RULES.maxHours * 3600),
    });
  }
  function logout(req, res) {
    const raw = parseCookies(req.headers.cookie || "")[REMOTE_SESSION_COOKIE] || "";
    if (raw) store.run("DELETE FROM mobile_sessions WHERE token_hash = ?", sha256(raw));
    send(res, 200, { ok: true, data: true }, { "set-cookie": setCookie(req, REMOTE_SESSION_COOKIE, "", 0) });
  }

  // ---------- Uzak isteğin kapısı ----------
  const FORWARD_HEADERS = ["x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port", "x-real-ip", "forwarded", "x-client-ip", "true-client-ip"];
  const reject = (req, res, err, { clearDevice = false } = {}) => {
    const headers = {};
    if (clearDevice) headers["set-cookie"] = [setCookie(req, DEVICE_COOKIE, "", 0), setCookie(req, REMOTE_SESSION_COOKIE, "", 0)];
    if (err.extra?.retryAfter) headers["retry-after"] = String(err.extra.retryAfter);
    // Sayfa açılışında (tarayıcı adres çubuğu) düz metin yerine kısa açıklama sayfası.
    if (String(req.headers.accept || "").includes("text/html") && (req.method === "GET" || req.method === "HEAD")) {
      if (res.headersSent) return res.end();
      res.writeHead(err.status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'", ...headers });
      return res.end(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DestekOfis Mobil</title><body style="font-family:system-ui,sans-serif;padding:24px;max-width:520px;margin:auto"><h1 style="font-size:20px">DestekOfis Mobil</h1><p>${err.message}</p></body></html>`);
    }
    return send(res, err.status, { ok: false, error: err.message, code: err.extra?.code }, headers);
  };

  /**
   * Uzaktan erişim dinleyicisinin isteği. Sıra (kâhin V16 ile aynı): cihaz → lisans → yol → (sayfa dosyası) → uzak oturum → mobil uç (lib/mobile.mjs →
   * programın ucu: şirket, yetki). dispatch: uygulamanın olağan dağıtıcısı (app.mjs). Eşleme ucu cihaz çerezi istemez; /mobil/ sayfa dosyaları çerez HİÇ
   * yokken verilir (karekoddan açılan eşleme sayfası; dosyalar veri içermez), çerez geçersizse reddedilir (BAŞ MİMAR KARARI 9).
   */
  async function handle(req, res, dispatch) {
    req[REMOTE_REQUEST] = true;
    for (const name of FORWARD_HEADERS) delete req.headers[name];
    if (gatekeeper?.rejects?.(req)) return reject(req, res, fail(401, "remote-kapi")); // 2.4.7 M3: kapıcı işareti (lib/mobile-sync.mjs)
    // Yerel oturum çerezi uzak dinleyicide yok sayılır (uzak oturum ayrı tabloda; auth.currentUser uzak istekte yalnız REMOTE_SESSION'a bakar).
    if (req.headers.cookie) req.headers.cookie = String(req.headers.cookie).split(";").filter(part => part.split("=")[0].trim() !== "hof_session").join(";");
    const raw = String(req.url || "/");
    const path = raw.split("?")[0];
    const method = req.method === "HEAD" ? "GET" : req.method;
    const isPair = method === "POST" && path === PAIR_PATH;
    const isStatic = method === "GET" && !remotePathProblem(raw) && decodedPath(raw).startsWith("/mobil/");
    try {
      const { present, device } = deviceFromRequest(req);
      if (!isPair) {
        if (present && !device) return reject(req, res, fail(401, "remote-device"), { clearDevice: true });
        if (!device && !isStatic) return reject(req, res, fail(401, "remote-device"));
      }
      if (!licenseOk()) return reject(req, res, fail(403, "remote-license"));
      if (remotePathProblem(raw)) return reject(req, res, fail(404, "remote-path"));
      // Başka siteden gelen değiştiren istek (eşleme, giriş, çıkış dahil) reddedilir; çerezler ayrıca SameSite=Strict.
      if (method !== "GET") assertSameOrigin(req);
      if (isStatic) return await dispatch(req, res);
      if (isPair) return await pair(req, res, device);
      if (method === "GET" && path === CHALLENGE_PATH) return challenge(res, device);
      if (method === "POST" && path === REMOTE_LOGIN_PATH) return await login(req, res, device);
      if (method === "POST" && path === REMOTE_LOGOUT_PATH) return logout(req, res);
      const session = sessionFor(req, device);
      if (!session) return reject(req, res, fail(401, "remote-session"));
      req[REMOTE_SESSION] = { userId: session.user_id, deviceId: device.id };
      return await dispatch(req, res);
    } catch (err) {
      if (err instanceof HttpError) return reject(req, res, err);
      log.error?.("Uzak istek işlenemedi", err);
      if (!res.headersSent) send(res, 500, { ok: false, error: "Sunucu işlemi tamamlayamadı." });
    }
  }

  return {
    handle,
    limit,
    licenseOk,
    usedCount,
    adminView,
    createCode,
    revokeDevice,
    setRemoteAccess,
    onUserDeleted,
    closeUserSessions,
    gatekeeperSnapshot,
    deviceFromRequest,
    purge,
    isRemoteRequest,
    setGatekeeper: hook => {
      gatekeeper = hook || null;
    },
    setPublicUrl: url => {
      remoteUrl = String(url || "").replace(/\/+$/, "");
    },
    publicUrl: () => remoteUrl,
  };
}
