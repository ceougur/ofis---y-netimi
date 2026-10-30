// Yönetim → Mobil Cihazlar → bağlantı durumu satırı (2.4.7 M4; lib/tunnel/manager.mjs, docs/mobil/M4-TASARIM.md). Yalnız yönetici (users.manage).
// Ortak katmanda (app.mjs HUB_ONLY admin/mobile). Belirteç, anahtar, yerel port gibi ayrıntı dönmez; yalnız durum, neden ve ofisin genel adresi.
import { ok } from "../lib/http.mjs";
import { TUNNEL_REASONS, TUNNEL_STATES } from "../lib/tunnel/manager.mjs";

export function registerMobileTunnelRoutes(router, context) {
  router.get("/api/admin/mobile/tunnel", async ({ req, res }) => {
    context.auth.requirePermission(req, "users.manage");
    const status = context.tunnel?.status?.() || { state: "off", label: TUNNEL_STATES.off, reason: TUNNEL_REASONS.disabled, since: null, connections: 0, publicUrl: "", retryInSeconds: null };
    ok(res, status);
  });
}
