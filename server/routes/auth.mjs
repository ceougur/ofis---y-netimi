// Giriş, çıkış, oturum bilgisi ve parola değişikliği.
import { publicUser } from "../lib/auth.mjs";
import { ok, readJson } from "../lib/http.mjs";

export function registerAuthRoutes(router, { auth, config }) {
  const product = { name: config.productName, version: config.version };

  router.post("/api/auth/login", async ({ req, res }) => {
    const body = await readJson(req);
    const user = auth.login(req, res, body.username, body.password);
    ok(res, { ...user, product });
  });

  router.post("/api/auth/logout", async ({ req, res }) => {
    auth.logout(req, res);
    ok(res, true);
  });

  router.get("/api/auth/me", async ({ req, res }) => {
    const user = auth.requireUser(req, { allowPasswordChange: true });
    ok(res, { ...publicUser(user), product });
  });

  router.post("/api/auth/change-password", async ({ req, res }) => {
    const user = auth.requireUser(req, { allowPasswordChange: true });
    const body = await readJson(req);
    auth.changePassword(req, user, body.currentPassword, body.newPassword);
    ok(res, true);
  });
}
