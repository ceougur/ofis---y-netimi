// Yönetim → Mobil Cihazlar (2.4.7 M2; lib/mobile-remote.mjs, docs/mobil/M2-TASARIM.md). Yalnız yönetici (users.manage — yönetime özgü yetki). Ortak katmanda
// çalışır (app.mjs HUB_ONLY: admin/mobile): cihazlar program başına (iki şirket birlikte) sayılır.
import { HttpError, ok, readJson } from "../lib/http.mjs";

export function registerMobileAdminRoutes(router, context) {
  const { auth } = context;
  const mobile = () => {
    if (!context.mobileRemote) throw new HttpError(404, "Mobil cihaz eşleme kullanılamıyor.");
    return context.mobileRemote;
  };

  // Kart: sınır, kullanılan, kullanıcılar (Uzaktan Bağlanabilir) ve eşli cihazlar (ad, kullanıcı, eşleme tarihi, son erişim).
  router.get("/api/admin/mobile/devices", async ({ req, res }) => {
    auth.requirePermission(req, "users.manage");
    ok(res, mobile().adminView());
  });
  // "Uzaktan Bağlanabilir" izni; kaldırılınca kullanıcının bütün cihazları, uzak oturumları ve bekleyen karekodları düşer.
  router.put("/api/admin/mobile/access/:userId", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const body = await readJson(req);
    if (typeof body.remote !== "boolean") throw new HttpError(400, "Uzaktan bağlanma izni (remote) evet ya da hayır olmalı.");
    ok(res, mobile().setRemoteAccess(admin, params.userId, body.remote));
  });
  // Karekod (P1 5 dk; P2 kişinin önceki kodu geçersiz; P4 sınır doluyken üretilmez).
  router.post("/api/admin/mobile/codes", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const body = await readJson(req);
    ok(res, mobile().createCode(admin, String(body.userId || "")));
  });
  // Cihazı sil: yer açılır, cihazın açık uzak oturumları hemen düşer.
  router.delete("/api/admin/mobile/devices/:id", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    ok(res, mobile().revokeDevice(admin, params.id));
  });
}
