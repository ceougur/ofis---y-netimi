// Giriş, çıkış, oturum bilgisi ve parola değişikliği.
import { publicUser } from "../lib/auth.mjs";
import { ok, readJson } from "../lib/http.mjs";

export function registerAuthRoutes(router, { auth, config, store, events }) {
  const product = { name: config.productName, version: config.version };
  const office = () => ({ name: store.setting("office.name", "") });

  // Giriş ekranı için oturum gerektirmeyen bilgi. Ofis adı zaten ağ keşfinde yayınlandığından gizli değildir.
  router.get("/api/public/info", async ({ res }) => ok(res, { product, office: office() }));

  router.post("/api/auth/login", async ({ req, res }) => {
    const body = await readJson(req);
    const user = auth.login(req, res, body.username, body.password);
    ok(res, { ...user, product, office: office() });
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
    ok(res, { ...publicUser(user), product, office: office() });
  });

  router.post("/api/auth/change-password", async ({ req, res }) => {
    const user = auth.requireUser(req, { allowPasswordChange: true });
    const body = await readJson(req);
    auth.changePassword(req, user, body.currentPassword, body.newPassword);
    ok(res, true);
  });
}
