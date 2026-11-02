// Sahte Meta — DURUM WEB KANCASI yardımcısı (DestekOfis 2.4.8, K0 bağımsız kâhin; program kodu görülmeden).
//
// KAYNAK (Meta belgesi, 30.10.2026): webhooks/reference/messages/status (gövde biçimi, alanlar, örnekler), webhooks/overview (200 dışı
// yanıtta 7 güne kadar azalan sıklıkla yeniden deneme, yinelenen bildirim olabilir, gövde ≤ 3 MB), webhooks/override (öncelik:
// numara → Messaging hesabı → uygulama varsayılanı), pricing (01.10.2026: utility `type` "regular").
//
// D0 (yerel belgede YOK, genel Graph bilgisi — D0'da doğrulanır, program buna yaslanmadan önce):
//   - İmza başlığı `X-Hub-Signature-256: sha256=<HMAC-SHA256(uygulama gizli anahtarı, ham gövde) onaltılık>`.
//   - Doğrulama isteği `GET ?hub.mode=subscribe&hub.verify_token=<…>&hub.challenge=<…>` → yanıt gövdesi challenge.
//   - Yeniden deneme ARALIKLARI (belge yalnız "decreasing frequency … up to 7 days" der) → YENIDEN_DENEME_ARALIKLARI_MS.
//   - `pricing` nesnesinin hangi durumda geldiği: belge "sent ile delivered/read'den BİRİNDE" der; varsayılan delivered (secenek ile değişir).

import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import { HATALAR } from "./hatalar.mjs";

export const YEDI_GUN_MS = 7 * 24 * 3600 * 1000;
// D0: 1 dk, 5 dk, 15 dk, 1 sa, 3 sa, 6 sa, 12 sa, sonra 24 saatte bir (7 gün dolana dek).
export const YENIDEN_DENEME_ARALIKLARI_MS = Object.freeze([60e3, 300e3, 900e3, 3600e3, 3 * 3600e3, 6 * 3600e3, 12 * 3600e3]);
export const SON_ARALIK_MS = 24 * 3600e3;

export function sonrakiDenemeAraligi(denemeSayisi) {
  return YENIDEN_DENEME_ARALIKLARI_MS[denemeSayisi - 1] ?? SON_ARALIK_MS;
}

export function fiyatNesnesi(kategori = "utility") {
  // Belge: billable (ileride kalkacak), pricing_model PMP, type regular (01.10.2026'dan beri CSW içindeki utility de regular), category.
  return { billable: true, pricing_model: "PMP", type: "regular", category: kategori };
}

export function hataNesnesi(kod, details) {
  const bilgi = HATALAR[kod] || { details: "SAHTE-META: belgede olmayan kod" };
  const ayrinti = details ?? bilgi.details;
  // Belgedeki örnek: code, title, message (= title), error_data.details, href
  return { code: kod, title: ayrinti, message: ayrinti, error_data: { details: ayrinti }, href: "/documentation/business-messaging/whatsapp/support/error-codes" };
}

/**
 * Durum kancası gövdesi (belgedeki "Syntax"). v24.0+ biçimi: `conversation` nesnesi YOK.
 * durumlar: [{ id (wamid), status: sent|delivered|read|failed|played, timestamp (sn, dizgi), recipient_id, biz_opaque_callback_data?, pricing?, errors? }]
 */
export function durumGovdesi({ wabaId, gorunenNumara, numaraKimligi, durumlar }) {
  return {
    object: "whatsapp_business_account",
    entry: [{
      id: String(wabaId),
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: String(gorunenNumara), phone_number_id: String(numaraKimligi) },
          statuses: durumlar.map(d => {
            const s = { id: d.id, status: d.status, timestamp: String(d.timestamp), recipient_id: String(d.recipient_id) };
            if (d.biz_opaque_callback_data !== undefined && d.biz_opaque_callback_data !== null) s.biz_opaque_callback_data = d.biz_opaque_callback_data;
            if (d.pricing) s.pricing = d.pricing;
            if (d.errors) s.errors = d.errors;
            return s;
          }),
        },
        field: "messages",
      }],
    }],
  };
}

export function imzala(hamGovde, sir) {
  return "sha256=" + crypto.createHmac("sha256", sir).update(hamGovde).digest("hex"); // D0
}

export function imzaDogru(hamGovde, baslik, sir) {
  if (typeof baslik !== "string" || !baslik.startsWith("sha256=")) return false;
  const beklenen = Buffer.from(imzala(hamGovde, sir));
  const gelen = Buffer.from(baslik);
  return beklenen.length === gelen.length && crypto.timingSafeEqual(beklenen, gelen);
}

function istek(url, { method = "POST", govde, basliklar = {}, zamanAsimiMs = 10000 } = {}) {
  return new Promise(resolve => {
    let u;
    try { u = new URL(url); } catch (e) { resolve({ http: 0, govde: "", hata: `adres geçersiz: ${e.message}` }); return; }
    const modul = u.protocol === "https:" ? https : http;
    const req = modul.request(u, { method, headers: basliklar, timeout: zamanAsimiMs }, res => {
      const parcalar = [];
      res.on("data", p => parcalar.push(p));
      res.on("end", () => resolve({ http: res.statusCode, govde: Buffer.concat(parcalar).toString("utf8"), hata: null }));
      res.on("error", e => resolve({ http: res.statusCode || 0, govde: "", hata: e.message }));
    });
    req.on("timeout", () => req.destroy(new Error("zaman aşımı")));
    req.on("error", e => resolve({ http: 0, govde: "", hata: e.message }));
    if (govde !== undefined) req.write(govde);
    req.end();
  });
}

/** Kancayı bir kez gönderir. Gövde nesne ise JSON'a çevrilir; `sir` verilirse imza başlığı eklenir (D0). */
export async function kancaGonder(url, govde, { sir, ekBasliklar = {}, zamanAsimiMs } = {}) {
  const ham = typeof govde === "string" ? govde : JSON.stringify(govde);
  const basliklar = { "content-type": "application/json", "content-length": Buffer.byteLength(ham), "user-agent": "facebookexternalua", ...ekBasliklar };
  if (sir) basliklar["x-hub-signature-256"] = imzala(ham, sir);
  const sonuc = await istek(url, { method: "POST", govde: ham, basliklar, zamanAsimiMs });
  return { ...sonuc, basarili: sonuc.http === 200, ham };
}

/** Doğrulama isteği (D0): GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=… → gövde challenge'a eşitse geçti. */
export async function kancaDogrulat(url, dogrulamaBelirteci, { challenge } = {}) {
  const meydan = challenge ?? String(crypto.randomInt(1e9, 2e9));
  const u = new URL(url);
  u.searchParams.set("hub.mode", "subscribe");
  u.searchParams.set("hub.verify_token", dogrulamaBelirteci);
  u.searchParams.set("hub.challenge", meydan);
  const sonuc = await istek(u.toString(), { method: "GET" });
  return { ...sonuc, challenge: meydan, gecti: sonuc.http === 200 && sonuc.govde.trim() === meydan };
}

/**
 * Meta'nın yeniden deneme kuyruğu (belge: 200 dışı yanıtta 7 güne kadar). Saat dışarıdan verilir (sahte saat).
 * ekle() ilk denemeyi YAPMAZ; sunucu ilk denemeyi kendisi yapar, başarısızsa ekle() çağırır.
 */
export class KancaKuyrugu {
  constructor() { this.bekleyen = []; this.dusen = []; }
  ekle({ url, ham, sir, ilkDenemeT, denemeSayisi = 1, simdi, etiket }) {
    this.bekleyen.push({ url, ham, sir, ilkDenemeT, denemeSayisi, sonrakiT: simdi + sonrakiDenemeAraligi(denemeSayisi), etiket });
  }
  /** Zamanı gelen (ya da hepsi=true ise bütün) bekleyenleri dener. 7 günü geçen düşer (Meta artık göndermez). */
  async isle(simdi, { hepsi = false, gonder = kancaGonder } = {}) {
    const sonuc = [];
    const kalan = [];
    for (const k of this.bekleyen) {
      if (simdi - k.ilkDenemeT > YEDI_GUN_MS) { this.dusen.push({ ...k, neden: "7 gün doldu" }); sonuc.push({ etiket: k.etiket, durum: "dustu" }); continue; }
      if (!hepsi && k.sonrakiT > simdi) { kalan.push(k); continue; }
      const r = await gonder(k.url, k.ham, { sir: k.sir });
      const deneme = k.denemeSayisi + 1;
      sonuc.push({ etiket: k.etiket, durum: r.basarili ? "teslim" : "basarisiz", http: r.http, deneme });
      if (!r.basarili) kalan.push({ ...k, denemeSayisi: deneme, sonrakiT: simdi + sonrakiDenemeAraligi(deneme) });
    }
    this.bekleyen = kalan;
    return sonuc;
  }
}
