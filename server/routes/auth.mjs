// Giriş, çıkış, oturum bilgisi ve parola değişikliği.
import { isLocalAddress, publicUser } from "../lib/auth.mjs";
import { HttpError, clientIp, ok, readJson } from "../lib/http.mjs";

export function registerAuthRoutes(router, { auth, config, store, events, profile, license, recovery, audit }) {
  const product = { name: config.productName, version: config.version };
  const office = () => ({ name: store.setting("office.name", "") });
  // Lisans salt okunurken yazma yetkileri ekranlara gönderilmez; lisans özeti uyarı şeridi için eklenir.
  const withLicense = (user, row) => (license ? { ...user, permissions: license.permissionsFor(user.permissions), license: license.summary(row) } : user);

  // Giriş ekranı için oturum gerektirmeyen bilgi. Ofis adı zaten ağ keşfinde yayınlandığından gizli değildir;
  // alt başlık ("Hukuk ofisi yönetimi", "Klinik yönetimi"…) seçili sektörden ya da yöneticinin yazdığından gelir.
  router.get("/api/public/info", async ({ res }) => ok(res, { product, office: office(), tagline: profile?.tagline() || "Ofis yönetimi" }));

  router.post("/api/auth/login", async ({ req, res }) => {
    const body = await readJson(req);
    const user = auth.login(req, res, body.username, body.password);
    ok(res, { ...withLicense(user, user), product, office: office(), profile: profile?.profile() });
  });

  router.post("/api/auth/logout", async ({ req, res }) => {
    const hash = auth.sessionHash(req);
    auth.logout(req, res);
    // Bu oturumun canlı bağlantıları da hemen kapansın (sonraki ping'i beklemeden).
    if (hash) events?.closeWhere(client => client.tokenHash === hash);
    ok(res, true);
  });

  router.get("/api/auth/me", async ({ req, res }) => {
    const user = auth.requireUser(req, { allowPasswordChange: true });
    ok(res, { ...withLicense(publicUser(user), user), product, office: office(), profile: profile?.profile() });
  });

  // ---------- Yönetici parolası kurtarma (v2.0.10) ----------
  const isLocal = req => isLocalAddress(clientIp(req, config.trustProxy));
  router.get("/api/auth/recovery", async ({ req, res }) => ok(res, { local: isLocal(req), hasKey: Boolean(recovery?.status().exists) }));
  let lastLocalCode = 0;
  router.post("/api/auth/recovery/local-code", async ({ req, res }) => {
    if (!recovery) throw new HttpError(404, "Kurtarma kullanılamıyor.");
    if (!isLocal(req)) throw new HttpError(403, "Sunucu kodu yalnız programın kurulu olduğu bilgisayarda oluşturulur. O bilgisayarda tarayıcıyı açıp giriş ekranından deneyin.", { code: "NOT_LOCAL" });
    if (Date.now() - lastLocalCode < 20_000) throw new HttpError(429, "Kod az önce oluşturuldu; dosyadaki kodu kullanın ya da biraz sonra yeniden deneyin.");
    lastLocalCode = Date.now();
    const result = recovery.createLocalCode();
    audit?.({ id: "anonymous", display_name: "Sunucu bilgisayarı" }, "auth.recovery_code_created", "local", { ip: clientIp(req, config.trustProxy) });
    ok(res, result);
  });
  router.post("/api/auth/recover", async ({ req, res }) => {
    const body = await readJson(req);
    const result = auth.recover(req, res, { username: body.username, code: body.code, newPassword: body.newPassword }, recovery);
    ok(res, { ...withLicense(result.user, result.user), newKey: result.newKey, method: result.method, product, office: office(), profile: profile?.profile() });
  });

  router.post("/api/auth/change-password", async ({ req, res }) => {
    const user = auth.requireUser(req, { allowPasswordChange: true });
    const body = await readJson(req);
    auth.changePassword(req, user, body.currentPassword, body.newPassword);
    ok(res, true);
  });
}
