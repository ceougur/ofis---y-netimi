// Oturum yönetimi, giriş deneme sınırı ve yetki denetimi.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { HttpError, clientIp, parseCookies } from "./http.mjs";
import { DEFAULT_ADMIN_PASSWORD } from "./config.mjs";
import { DUMMY_HASH, hashPassword, passwordProblem, verifyPassword } from "./passwords.mjs";
import { can, permissionsFor } from "./permissions.mjs";

export const SESSION_COOKIE = "hof_session";
const hashToken = token => createHash("sha256").update(token).digest("hex");
const LOCAL_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);
export const isLocalAddress = ip => LOCAL_ADDRESSES.has(String(ip || "").trim());
const now = () => new Date().toISOString();

// Kullanıcı adı + IP başına 15 dakikada 5 hatalı deneme; IP başına 20 deneme.
export function createRateLimiter({ windowMs = 15 * 60_000, maxPerUser = 5, maxPerIp = 20, lockMs = 15 * 60_000 } = {}) {
  const entries = new Map();
  const bucket = key => {
    const current = Date.now();
    let entry = entries.get(key);
    if (!entry || (current - entry.first > windowMs && entry.lockedUntil < current)) {
      entry = { fails: 0, first: current, lockedUntil: 0 };
      entries.set(key, entry);
    }
    return entry;
  };
  const cleanup = setInterval(() => {
    const current = Date.now();
    for (const [key, entry] of entries) if (current - entry.first > windowMs && entry.lockedUntil < current) entries.delete(key);
  }, windowMs);
  cleanup.unref();
  return {
    check(ip, username) {
      const current = Date.now();
      for (const entry of [bucket(`ip:${ip}`), bucket(`user:${ip}|${username}`)]) {
        if (entry.lockedUntil > current) return Math.ceil((entry.lockedUntil - current) / 1000);
      }
      return 0;
    },
    fail(ip, username) {
      const userEntry = bucket(`user:${ip}|${username}`);
      const ipEntry = bucket(`ip:${ip}`);
      userEntry.fails += 1;
      ipEntry.fails += 1;
      if (userEntry.fails >= maxPerUser) userEntry.lockedUntil = Date.now() + lockMs;
      if (ipEntry.fails >= maxPerIp) ipEntry.lockedUntil = Date.now() + lockMs;
    },
    success(ip, username) {
      entries.delete(`user:${ip}|${username}`);
    },
    stop: () => clearInterval(cleanup),
  };
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.display_name,
    role: user.role,
    mustChangePassword: Boolean(user.must_change_password),
    permissions: permissionsFor(user.role),
  };
}

export function createAuth({ store, config, audit }) {
  const limiter = createRateLimiter();
  const cookie = (token, maxAge) => `${SESSION_COOKIE}=${token ? encodeURIComponent(token) : ""}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`;

  const sessionToken = req => parseCookies(req.headers.cookie || "")[SESSION_COOKIE] || "";

  function currentUser(req) {
    const token = sessionToken(req);
    if (!token) return null;
    const row = store.get(
      `SELECT u.id, u.username, u.display_name, u.role, u.active, u.must_change_password, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
      hashToken(token),
    );
    if (!row || !row.active || new Date(row.expires_at) <= new Date()) return null;
    return row;
  }

  function startSession(res, userId) {
    const token = randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + config.sessionDays * 86_400_000).toISOString();
    store.run("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", hashToken(token), userId, expires, now());
    res.setHeader("set-cookie", cookie(token, config.sessionDays * 86_400));
    return token;
  }

  function login(req, res, usernameInput, passwordInput) {
    const username = String(usernameInput || "").trim();
    const password = String(passwordInput || "");
    const ip = clientIp(req, config.trustProxy);
    const key = username.toLocaleLowerCase("tr-TR");
    const wait = limiter.check(ip, key);
    if (wait) throw new HttpError(429, `Çok fazla hatalı deneme yapıldı. ${Math.ceil(wait / 60)} dakika sonra tekrar deneyin.`, { retryAfter: wait });
    if (!username || !password) throw new HttpError(400, "Kullanıcı adı ve parola gerekli.");
    const user = store.get("SELECT id, username, display_name, role, active, must_change_password, password_hash FROM users WHERE username = ? COLLATE NOCASE", username);
    const valid = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !valid || !user.active) {
      limiter.fail(ip, key);
      audit({ id: "anonymous", display_name: username || "bilinmiyor" }, "auth.login_failed", user?.id || "unknown", { ip });
      throw new HttpError(401, !user || !valid ? "Kullanıcı adı veya parola hatalı." : "Bu hesap pasif durumda. Yöneticinize başvurun.");
    }
    // Varsayılan parola hâlâ geçerliyken ilk giriş yalnızca sunucu bilgisayarının kendisinden yapılabilir;
    // böylece kurulumla ilk giriş arasında ağdaki biri yönetici hesabını ele geçiremez.
    if (user.must_change_password && password === DEFAULT_ADMIN_PASSWORD && !isLocalAddress(ip)) {
      audit(user, "auth.login_blocked_remote_default", user.id, { ip });
      throw new HttpError(403, "İlk kurulum henüz tamamlanmadı. Güvenlik için ilk girişi sunucu bilgisayarından (bu programın kurulu olduğu bilgisayar) yapın ve yeni parola belirleyin.", { code: "FIRST_LOGIN_LOCAL_ONLY" });
    }
    limiter.success(ip, key);
    startSession(res, user.id);
    store.run("UPDATE users SET last_login_at = ? WHERE id = ?", now(), user.id);
    audit(user, "auth.login", user.id, { ip });
    return publicUser(user);
  }

  function logout(req, res) {
    const token = sessionToken(req);
    if (token) store.run("DELETE FROM sessions WHERE token_hash = ?", hashToken(token));
    res.setHeader("set-cookie", cookie("", 0));
  }

  function changePassword(req, user, currentPassword, newPassword) {
    const stored = store.get("SELECT password_hash FROM users WHERE id = ?", user.id);
    if (!verifyPassword(String(currentPassword || ""), stored.password_hash)) throw new HttpError(400, "Mevcut parola hatalı.");
    if (String(currentPassword) === String(newPassword)) throw new HttpError(400, "Yeni parola mevcut paroladan farklı olmalı.");
    const problem = passwordProblem(newPassword, { username: user.username });
    if (problem) throw new HttpError(400, problem);
    const timestamp = now();
    store.tx(() => {
      store.run("UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = ?, updated_at = ? WHERE id = ?", hashPassword(newPassword), timestamp, timestamp, user.id);
      // Diğer cihazlardaki oturumlar kapatılır; mevcut oturum açık kalır.
      store.run("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?", user.id, hashToken(sessionToken(req)));
    });
    audit(user, "profile.password_changed", user.id);
  }

  function requireUser(req, { allowPasswordChange = false } = {}) {
    const user = currentUser(req);
    if (!user) throw new HttpError(401, "Oturum gerekli.", { code: "UNAUTHORIZED" });
    if (user.must_change_password && !allowPasswordChange) throw new HttpError(403, "Devam etmeden önce parolanızı değiştirmeniz gerekiyor.", { code: "PASSWORD_CHANGE_REQUIRED" });
    return user;
  }

  function requirePermission(req, permission) {
    const user = requireUser(req);
    if (!can(user.role, permission)) throw new HttpError(403, "Bu işlem için yetkiniz yok.", { code: "FORBIDDEN", permission });
    return user;
  }

  function purgeExpiredSessions() {
    return store.run("DELETE FROM sessions WHERE expires_at <= ?", now()).changes;
  }

  return { currentUser, login, logout, changePassword, requireUser, requirePermission, purgeExpiredSessions, startSession, limiter, newId: prefix => `${prefix}-${randomUUID()}` };
}
