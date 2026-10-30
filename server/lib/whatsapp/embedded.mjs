// 2.4.8 W7 — "WhatsApp'ı Bağla" program tarafı (plan docs/erp/WHATSAPP-API-PLANI-2.4.8.md §2.8, §4, §6 W7; kapıcı tarafı bulut/kapi/wa-bagla.mjs).
// Program her bağlama için GEÇİCİ bir ECDH P-256 anahtar çifti üretir (gizli kısmı dışa aktarılamaz, yalnız bu süreçte bellekte, en çok 10 dk); açık kısmı
// ofisin imzalı kanalıyla kapıcıya verilir. Kapıcı Meta'nın kodunu belirteçle değiştirir (Meta App Secret YALNIZ kapıcıda) ve belirteci bu anahtara
// şifreleyerek tutar; program imzalı istekle alır, burada açar, lib/whatsapp/connection.mjs mühürler. Belirteç istemciye, günlüğe, işlem geçmişine çıkmaz.
// Oturum açan şirketle alan şirket aynı olmalı (başka şirketin bağlantısına yazılmaz). Program yeniden başlarsa oturum düşer (yeniden bağlanılır).
import { HttpError } from "../http.mjs";
import { waBaglam, waCoz } from "../kapi-protokol.mjs";

export const EMBEDDED_SESSION_MS = 10 * 60_000;
export const EMBEDDED_UNAVAILABLE = "Bu bağlantı DestekOfis'in Meta onayından sonra çalışır; şimdilik Elle Bağla.";
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

  async function start({ companyId }) {
    const kapi = sync();
    purge();
    const pair = await globalThis.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    const jwk = await globalThis.crypto.subtle.exportKey("jwk", pair.publicKey);
    const result = await kapi.waOturumAc({ kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y });
    if (!result.ok) kapiFailure(result);
    const id = String(result.data?.oturum || "");
    const url = String(result.data?.adres || "");
    if (!SESSION.test(id) || !/^https:\/\/[^\s/]+\/wa\/bagla#o=[A-Za-z0-9_-]{43}$/.test(url)) fail(502, "Kapıcının yanıtı okunamadı; yeniden deneyin.", "whatsapp-embedded-kapi");
    sessions.set(id, { gizli: pair.privateKey, companyId, ofis: result.ofis, ms: now() });
    return { session: id, url, seconds: Math.round(EMBEDDED_SESSION_MS / 1000) };
  }

  /** Dönüş: { state: "waiting" } | { state: "error", message } | { state: "ready", token, wabaId, phoneNumberId, event } (token yalnız çağıranın belleğinde). */
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
    return { state: "ready", token, wabaId: String(data.wabaId || ""), phoneNumberId: String(data.phoneNumberId || ""), event: String(data.olay || "") };
  }

  return { start, poll, size: () => sessions.size };
}
