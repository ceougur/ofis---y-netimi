// Lisans uçları: durum, ücretsiz deneme, lisans anahtarı, internetsiz etkinleştirme kodu ve elle doğrulama.
// Durumu her oturum açmış kullanıcı görür (uyarı şeridi için); işlemler yalnızca yöneticiye (license.manage) açıktır.
// Bu uçlar salt okunur modda da çalışır (bkz. license.mjs → allowedWhenReadOnly).
import { ok, readJson } from "../lib/http.mjs";

export function registerLicenseRoutes(router, { auth, license, events }) {
  const respond = (res, user) => ok(res, license.summary(user));
  // Açık ekranlar (şerit, yetkiler) hemen yenilensin.
  const changed = () => events?.publish("license.changed", license.summary(null));

  router.get("/api/license", async ({ req, res }) => {
    const user = auth.requireUser(req, { allowPasswordChange: true });
    respond(res, user);
  });

  router.post("/api/license/trial", async ({ req, res }) => {
    const user = auth.requirePermission(req, "license.manage");
    const body = await readJson(req, { limit: 8_000 });
    await license.startTrial(body, user);
    changed();
    respond(res, user);
  });

  router.post("/api/license/activate", async ({ req, res }) => {
    const user = auth.requirePermission(req, "license.manage");
    const body = await readJson(req, { limit: 8_000 });
    await license.activateKey(body.key, user);
    changed();
    respond(res, user);
  });

  router.post("/api/license/code", async ({ req, res }) => {
    const user = auth.requirePermission(req, "license.manage");
    const body = await readJson(req, { limit: 64_000 });
    license.applyCode(body.code, user);
    changed();
    respond(res, user);
  });

  // Denemenin 3. gününde sorulan firma ve iletişim bilgisi (lisans servisine gider).
  router.post("/api/license/contact", async ({ req, res }) => {
    const user = auth.requirePermission(req, "license.manage");
    const body = await readJson(req, { limit: 8_000 });
    await license.submitContact(body, user);
    changed();
    respond(res, user);
  });

  router.post("/api/license/check", async ({ req, res }) => {
    const user = auth.requirePermission(req, "license.manage");
    await license.check({ manual: true, user });
    changed();
    respond(res, user);
  });
}
