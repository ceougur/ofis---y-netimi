// WhatsApp şablonları — 2.4.8 W5 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W5; lib/whatsapp/templates.mjs). Yönetim → WhatsApp; yalnız yönetici
// (system.manage). Şirket başına (her şirketin kendi bağlantısı ve şablon kaydı).
//   GET  /api/workspace/whatsapp/templates          son denetimin görünümü (Meta'ya istek YOK) + şablon metinleri
//   POST /api/workspace/whatsapp/templates/ensure   Şablonları Denetle ve Oluştur (yoksa açar; durum, kategori, kalite) — yazılabilir lisans
// Yazma ucu salt okunur lisansta app.mjs'teki genel kapıda 403 LICENSE_READ_ONLY alır; burada da denetlenir.
//
// 2.4.8 W6 "Aydınlatma Metni Hazırla" (lib/whatsapp/aydinlatma-metni.mjs; firma bilgileri Fatura Ayarları → Firma Bilgisi). Salt okunur lisansta da okunur.
//   GET  /api/workspace/whatsapp/aydinlatma-metni       metin (bölümler + düz metin), eksik firma bilgileri, metin sürümü
//   GET  /api/workspace/whatsapp/aydinlatma-metni.pdf   aynı metnin PDF'i (tarayıcıda açılır; ?download=1 indirir)
import { HttpError, ok, sendBuffer } from "../lib/http.mjs";
import { systemClock } from "../lib/clock.mjs";
import { buildPrivacyNotice, privacyNoticePdf } from "../lib/whatsapp/aydinlatma-metni.mjs";
import { createWhatsappTemplates } from "../lib/whatsapp/templates.mjs";

export function registerWhatsappTemplateRoutes(router, { store, auth, audit, config = {}, license = null, now = systemClock, connection }) {
  const templates = createWhatsappTemplates({ store, config, audit, connection, now });
  const writable = () => !license || license.writable();
  router.get("/api/workspace/whatsapp/templates", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    ok(res, { ...templates.view(), writable: writable() });
  });
  router.post("/api/workspace/whatsapp/templates/ensure", async ({ req, res }) => {
    const user = auth.requirePermission(req, "system.manage");
    if (!writable()) throw new HttpError(403, "Program salt okunur çalışıyor; WhatsApp şablonu açılamaz.", { code: "LICENSE_READ_ONLY" });
    ok(res, { ...(await templates.ensure(user)), writable: writable() });
  });

  // ---------- 2.4.8 W6: Aydınlatma Metni Hazırla ----------
  router.get("/api/workspace/whatsapp/aydinlatma-metni", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    ok(res, buildPrivacyNotice(store, { now: now() }));
  });
  router.get("/api/workspace/whatsapp/aydinlatma-metni.pdf", async ({ req, res, url }) => {
    auth.requirePermission(req, "system.manage");
    const at = now();
    const notice = buildPrivacyNotice(store, { now: at });
    sendBuffer(res, privacyNoticePdf(notice, { now: at }), { type: "application/pdf", name: notice.pdfName, inline: url.searchParams.get("download") !== "1" });
  });
  return templates;
}
