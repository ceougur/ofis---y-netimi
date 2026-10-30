// WhatsApp şablonları — 2.4.8 W5 (docs/erp/WHATSAPP-API-PLANI-2.4.8.md §6 W5; lib/whatsapp/templates.mjs). Yönetim → WhatsApp; yalnız yönetici
// (system.manage). Şirket başına (her şirketin kendi bağlantısı ve şablon kaydı).
//   GET  /api/workspace/whatsapp/templates          son denetimin görünümü (Meta'ya istek YOK) + şablon metinleri
//   POST /api/workspace/whatsapp/templates/ensure   Şablonları Denetle ve Oluştur (yoksa açar; durum, kategori, kalite) — yazılabilir lisans
// Yazma ucu salt okunur lisansta app.mjs'teki genel kapıda 403 LICENSE_READ_ONLY alır; burada da denetlenir.
import { HttpError, ok } from "../lib/http.mjs";
import { createWhatsappTemplates } from "../lib/whatsapp/templates.mjs";

export function registerWhatsappTemplateRoutes(router, { store, auth, audit, config = {}, license = null, now, connection }) {
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
  return templates;
}
