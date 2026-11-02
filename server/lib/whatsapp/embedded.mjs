// 2.4.8 W7 — "WhatsApp'ı Bağla" program tarafı (plan docs/erp/WHATSAPP-API-PLANI-2.4.8.md §2.8, §4, §6 W7; kapıcı tarafı bulut/kapi/wa-bagla.mjs).
// Program her bağlama için GEÇİCİ bir ECDH P-256 anahtar çifti üretir (gizli kısmı dışa aktarılamaz, yalnız bu süreçte bellekte, en çok 10 dk); açık kısmı
// ofisin imzalı kanalıyla kapıcıya verilir. Kapıcı Meta'nın kodunu belirteçle değiştirir (Meta App Secret YALNIZ kapıcıda) ve belirteci bu anahtara
// şifreleyerek tutar; program imzalı istekle alır, burada açar, lib/whatsapp/connection.mjs mühürler. Belirteç istemciye, günlüğe, işlem geçmişine çıkmaz.
// Oturum açan şirketle alan şirket aynı olmalı (başka şirketin bağlantısına yazılmaz). Program yeniden başlarsa oturum düşer (yeniden bağlanılır).
// TAŞINAMAZ BAĞLANTI (bağımsız gözden geçirme, ORTA): her oturumda tek kullanımlık rastgele SIR üretilir; kapıcıya yalnız özeti (SHA-256) gider, sırrın kendisi
// yalnız bu isteğin yanıtıyla programın ekranına (client/assets/hof-whatsapp-ayar.js) verilir ve burada SAKLANMAZ. Ekran sırrı adrese yazmaz; bağlama
// penceresine postMessage ile verir (kapıcı sayfası yalnız pencereyi açandan ve yerel / özel ağ kökeninden kabul eder — bulut/kapi/wa-bagla.mjs).
// Bu yüzden oturum yalnız programın yerel adresinden açılır (isLocalOrigin; uzak dinleyici ve tünel adresi değil).
import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "../http.mjs";
import { waBaglam, waCoz } from "../kapi-protokol.mjs";

export const EMBEDDED_SESSION_MS = 10 * 60_000;
export const EMBEDDED_UNAVAILABLE = "Bu bağlantı DestekOfis'in Meta onayından sonra çalışır; şimdilik Elle Bağla.";
export const EMBEDDED_LOCAL_ONLY = "WhatsApp'ı Bağla işlemi ofisteki bilgisayardan yapılır: programı ofis ağındaki bir bilgisayarda açıp yeniden deneyin.";
/**
 * Yerel / özel ağ kökeni (kapıcı sayfasının yerelKoken kuralıyla AYNI; bulut/kapi/wa-bagla.mjs SAYFA_BETIGI açıklamasında kesin liste ve gerekçe):
 * http/https VE ad localhost | [::1] | *.local | IPv4 127/8, 10/8, 172.16/12, 192.168/16. Köken TAM köken olmalı (yol / kullanıcı bilgisi yok).
 */
export function isLocalOrigin(origin) {
  let url;
  try {
    url = new URL(String(origin));
  } catch {
    return false;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== String(origin)) return false;
  const host = url.hostname;
  if (host === "localhost" || host === "[::1]" || /^([a-z0-9-]+\.)+local$/.test(host)) return true;
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ip) return false;
  const a = Number(ip[1]);
  const b = Number(ip[2]);
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
/** İsteğin geldiği adresin kökeni (Host; vekil arkasında güvenilen X-Forwarded-Host). Okunamazsa "". */
export function requestOrigin(req, trustProxy = false) {
  const host = String((trustProxy && req?.headers?.["x-forwarded-host"]) || req?.headers?.host || "");
  try {
    return new URL(`http://${host}`).origin;
  } catch {
    return "";
  }
}
const SESSION = /^[A-Za-z0-9_-]{43}$/;
const fail = (status, message, code) => {
  throw new HttpError(status, message, { code });
};

export function createEmbeddedSignup({ mobileSync = () => null, now = () => Date.now() } = {}) {
  const sessions = new Map(); // oturum → { gizli, companyId, ofis, ms }
  const purge = () => {
    for (const [id, item] of sessions) if (now() - item.ms >= EMBEDDED_SESSION_MS) sessions.delete(id);
  };
  const sync = () => {
    const value = mobileSync();
    if (!value?.enabled?.()) fail(409, "WhatsApp'ı Bağla bu kurulumda kullanılamıyor (uzaktan bağlantı hizmeti tanımlı değil). Şimdilik Elle Bağla ile bağlanın.", "whatsapp-embedded-kapi");
    return value;
  };
  // Kapıcının ret kodu → kullanıcı iletisi (kapıcı kendi Türkçe iletisini verir; Meta onayı yoksa "Bu bağlantı … şimdilik Elle Bağla.").
  const kapiFailure = result => {
    if (result.code === "kapi-wa-ayar") fail(409, EMBEDDED_UNAVAILABLE, "whatsapp-embedded-unavailable");
    if (result.code === "kapi-wa-sure" || result.code === "kapi-wa-oturum") fail(410, result.error || "Bağlama oturumunun süresi doldu; WhatsApp'ı Bağla'yı yeniden açın.", "whatsapp-embedded-expired");
    if (result.code === "kapi-lisans" || result.code === "kapi-lisans-dogrulanamadi") fail(403, result.error || "Lisans geçerli değil; WhatsApp bağlanamaz.", "whatsapp-embedded-license");
    fail(502, result.error || "Kapıcıya ulaşılamadı; internet bağlantısını denetleyip yeniden deneyin.", "whatsapp-embedded-kapi");
  };

  /** origin: isteğin geldiği adresin kökeni (requestOrigin); remote: uzak dinleyiciden mi (lib/http.mjs isRemoteRequest). firma: Ofis Bilgileri'ndeki ad. */
  async function start({ companyId, origin = "", remote = false, firma = "" }) {
    if (remote || !isLocalOrigin(origin)) fail(409, EMBEDDED_LOCAL_ONLY, "whatsapp-embedded-local");
    const kapi = sync();
    purge();
    const pair = await globalThis.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    const jwk = await globalThis.crypto.subtle.exportKey("jwk", pair.publicKey);
    // Tek kullanımlık sır: 32 rastgele bayt (base64url, 43 karakter). Kapıcıya YALNIZ özeti; kendisi yalnız bu yanıtla ekrana, burada tutulmaz.
    const sir = randomBytes(32).toString("base64url");
    const sirOzeti = createHash("sha256").update(sir, "utf8").digest("hex");
    const result = await kapi.waOturumAc({ kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y }, { sirOzeti, firma: String(firma || "").slice(0, 120) });
    if (!result.ok) kapiFailure(result);
    const id = String(result.data?.oturum || "");
    const url = String(result.data?.adres || "");
    if (!SESSION.test(id) || !/^https:\/\/[^\s/]+\/wa\/bagla#o=[A-Za-z0-9_-]{43}$/.test(url)) fail(502, "Kapıcının yanıtı okunamadı; yeniden deneyin.", "whatsapp-embedded-kapi");
    sessions.set(id, { gizli: pair.privateKey, companyId, ofis: result.ofis, ms: now() });
    return { session: id, url, seconds: Math.round(EMBEDDED_SESSION_MS / 1000), secret: sir };
  }

  /** Dönüş: { state: "waiting" } | { state: "error", message } | { state: "ready", token, wabaId, phoneNumberId, event, appId } (token yalnız çağıranın belleğinde;
   *  appId: belirtecin ait olduğu Meta uygulaması — kapıcı vermezse "", ekstre şablonu o zaman açılamaz ve neden bu kipe uygun yazılır). */
  async function poll({ session, companyId }) {
    purge();
    const item = SESSION.test(String(session || "")) ? sessions.get(session) : null;
    if (!item || item.companyId !== companyId) fail(404, "Bağlama oturumu bulunamadı ya da süresi doldu; WhatsApp'ı Bağla'yı yeniden açın.", "whatsapp-embedded-session");
    const kapi = sync();
    const result = await kapi.waOturumAl(session);
    if (!result.ok) {
      if (result.code === "kapi-wa-sure" || result.code === "kapi-wa-oturum") sessions.delete(session);
      kapiFailure(result);
    }
    const data = result.data || {};
    if (data.durum === "bekliyor") return { state: "waiting" };
    sessions.delete(session);
    if (data.durum === "hata") return { state: "error", message: [data.ileti, data.metaIleti ? `Meta'nın yanıtı: ${data.metaIleti}` : ""].filter(Boolean).join(" ") || EMBEDDED_UNAVAILABLE };
    if (data.durum !== "hazir") fail(502, "Kapıcının yanıtı okunamadı; yeniden deneyin.", "whatsapp-embedded-kapi");
    let token;
    try {
      token = await waCoz(item.gizli, data.sifreli, waBaglam(item.ofis, session));
    } catch {
      fail(502, "Meta'dan gelen erişim belirteci açılamadı; WhatsApp'ı Bağla'yı yeniden deneyin.", "whatsapp-embedded-token");
    }
    const appId = /^[0-9]{5,30}$/.test(String(data.appId || "")) ? String(data.appId) : "";
    return { state: "ready", token, wabaId: String(data.wabaId || ""), phoneNumberId: String(data.phoneNumberId || ""), event: String(data.olay || ""), appId };
  }

  return { start, poll, size: () => sessions.size };
}
