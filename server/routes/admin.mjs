// Yönetici işlemleri: kullanıcılar, yedekler, değişiklik geçmişi ve sistem bilgisi.
import { createReadStream, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BACKUP_NAME, createBackup, listBackups } from "../lib/backup.mjs";
import { HttpError, SECURITY_HEADERS, limited, ok, parseJson, readJson, text } from "../lib/http.mjs";
import { hashPassword, passwordProblem } from "../lib/passwords.mjs";
import { ROLES } from "../lib/permissions.mjs";

// Personel bilgisayarlarının bağlanabileceği yerel ağ adresleri (sanal/yerel bağdaştırıcılar hariç).
function lanAddresses(port) {
  const result = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (/vethernet|virtualbox|vmware|docker|loopback|hyper-v|wsl/i.test(name)) continue;
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" && entry.family !== 4) continue;
      if (entry.internal || entry.address.startsWith("169.254.")) continue;
      result.push(`http://${entry.address}:${port}`);
    }
  }
  return [...new Set(result)];
}

export function registerAdminRoutes(router, context) {
  const { store, auth, audit, config, startedAt } = context;
  const notifyInfoChange = () => context.notifyInfoChange?.();
  const now = () => new Date().toISOString();
  const activeAdmins = () => store.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1").count;

  router.get("/api/admin/users", async ({ req, res }) => {
    auth.requirePermission(req, "users.manage");
    ok(
      res,
      store.all(
        `SELECT id, username, display_name AS name, role, active, must_change_password AS mustChangePassword,
                last_login_at AS lastLoginAt, created_at AS createdAt FROM users ORDER BY display_name COLLATE NOCASE`,
      ).map(user => ({ ...user, active: Boolean(user.active), mustChangePassword: Boolean(user.mustChangePassword) })),
    );
  });

  router.post("/api/admin/users", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const body = await readJson(req);
    const username = limited(body.username, 60, "Kullanıcı adı");
    const name = limited(body.name, 120, "Görünen ad");
    const role = text(body.role, "personel") || "personel";
    const password = String(body.password || "");
    if (!username || !name) throw new HttpError(400, "Kullanıcı adı ve görünen ad gerekli.");
    if (!/^[\p{L}\p{N}._-]{3,60}$/u.test(username)) throw new HttpError(400, "Kullanıcı adı 3-60 karakter olmalı; harf, rakam, nokta, tire ve alt çizgi kullanılabilir.");
    if (!ROLES.includes(role)) throw new HttpError(400, "Geçersiz rol.");
    const problem = passwordProblem(password, { username });
    if (problem) throw new HttpError(400, problem);
    if (store.get("SELECT id FROM users WHERE username = ? COLLATE NOCASE", username)) throw new HttpError(409, "Bu kullanıcı adı zaten kayıtlı.");
    const mustChange = body.mustChangePassword === false ? 0 : 1;
    const timestamp = now();
    const userId = auth.newId("user");
    store.run(
      "INSERT INTO users (id, username, display_name, role, password_hash, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      userId, username, name, role, hashPassword(password), mustChange, timestamp, timestamp,
    );
    audit(admin, "user.created", userId, { username, role });
    ok(res, { id: userId, username, name, role, mustChangePassword: Boolean(mustChange) });
  });

  router.patch("/api/admin/users/:id", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const body = await readJson(req);
    const target = store.get("SELECT id, username, role, active FROM users WHERE id = ?", params.id);
    if (!target) throw new HttpError(404, "Kullanıcı bulunamadı.");
    const role = body.role === undefined ? target.role : text(body.role);
    const active = body.active === undefined ? target.active : body.active === false ? 0 : 1;
    const name = body.name === undefined ? null : limited(body.name, 120, "Görünen ad");
    if (!ROLES.includes(role)) throw new HttpError(400, "Geçersiz rol.");
    if (target.id === admin.id && (!active || role !== "admin")) throw new HttpError(400, "Kendi hesabınızı pasifleştiremez veya yöneticilikten çıkaramazsınız.");
    const losesAdmin = target.role === "admin" && target.active && (role !== "admin" || !active);
    if (losesAdmin && activeAdmins() <= 1) throw new HttpError(400, "Sistemde en az bir aktif yönetici kalmalı.");
    store.tx(() => {
      store.run("UPDATE users SET role = ?, active = ?, display_name = COALESCE(?, display_name), updated_at = ? WHERE id = ?", role, active, name || null, now(), target.id);
      if (!active) store.run("DELETE FROM sessions WHERE user_id = ?", target.id);
    });
    audit(admin, "user.updated", target.id, { role, active: Boolean(active), name: name || undefined });
    ok(res, true);
  });

  router.post("/api/admin/users/:id/reset-password", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const body = await readJson(req);
    const target = store.get("SELECT id, username FROM users WHERE id = ?", params.id);
    if (!target) throw new HttpError(404, "Kullanıcı bulunamadı.");
    const problem = passwordProblem(body.password, { username: target.username });
    if (problem) throw new HttpError(400, problem);
    const mustChange = body.mustChangePassword === false ? 0 : 1;
    store.tx(() => {
      store.run("UPDATE users SET password_hash = ?, must_change_password = ?, password_changed_at = ?, updated_at = ? WHERE id = ?", hashPassword(body.password), mustChange, now(), now(), target.id);
      if (target.id !== admin.id) store.run("DELETE FROM sessions WHERE user_id = ?", target.id);
    });
    audit(admin, "user.password_reset", target.id, { mustChangePassword: Boolean(mustChange) });
    ok(res, true);
  });

  router.post("/api/admin/users/:id/logout-all", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const removed = store.run("DELETE FROM sessions WHERE user_id = ?", params.id).changes;
    audit(admin, "user.sessions_revoked", params.id, { removed });
    ok(res, { removed });
  });

  router.get("/api/admin/backups", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    ok(res, listBackups(config.backupDir).map(({ mtimeMs, ...item }) => item));
  });

  router.post("/api/admin/backups", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const result = createBackup(store.db, config.backupDir, { label: "manuel", keep: config.backupKeep });
    audit(admin, "system.backup_created", result.name, { size: result.size });
    ok(res, { name: result.name, size: result.size });
  });

  router.get("/api/admin/backups/:name", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "system.manage");
    if (!BACKUP_NAME.test(params.name)) throw new HttpError(400, "Geçersiz yedek adı.");
    const file = path.join(config.backupDir, params.name);
    let stats;
    try {
      stats = statSync(file);
    } catch {
      throw new HttpError(404, "Yedek bulunamadı.");
    }
    audit(admin, "system.backup_downloaded", params.name);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "content-type": "application/vnd.sqlite3",
      "content-length": stats.size,
      "content-disposition": `attachment; filename="${params.name}"`,
      "cache-control": "no-store",
    });
    createReadStream(file).pipe(res);
  });

  router.get("/api/admin/audit", async ({ req, res, url }) => {
    auth.requirePermission(req, "audit.view");
    const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") || 200)));
    const type = text(url.searchParams.get("type"));
    const rows = store.all(
      `SELECT id, type, entity_id AS entityId, actor_id AS actorId, actor_name AS actorName, payload_json AS payloadJson, created_at AS createdAt
       FROM audit_events WHERE (? = '' OR type LIKE ? || '%') ORDER BY created_at DESC LIMIT ?`,
      type, type, limit,
    );
    ok(res, rows.map(({ payloadJson, ...row }) => ({ ...row, payload: parseJson(payloadJson) })));
  });

  router.get("/api/admin/office", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    ok(res, { name: store.setting("office.name", "") });
  });

  router.put("/api/admin/office", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const body = await readJson(req);
    const name = limited(body.name, 120, "Ofis adı");
    store.setSetting("office.name", name, admin.id);
    audit(admin, "settings.office.updated", "office", { name });
    notifyInfoChange();
    ok(res, { name });
  });

  router.get("/api/admin/system", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    // WAL kipinde veri bir süre "-wal" dosyasında durur; gerçek boyut ikisinin toplamıdır.
    let dbSize = 0;
    for (const file of [config.dbPath, `${config.dbPath}-wal`]) {
      try {
        dbSize += statSync(file).size;
      } catch {
        // Dosya yoksa (ör. WAL boşaltılmış) atlanır.
      }
    }
    const latest = listBackups(config.backupDir)[0] || null;
    ok(res, {
      product: config.productName,
      version: config.version,
      node: process.version,
      startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      schemaVersion: store.get("PRAGMA user_version").user_version,
      dbSize,
      dataDir: config.dataDir,
      backupDir: config.backupDir,
      lastBackup: latest ? { name: latest.name, size: latest.size, createdAt: latest.createdAt } : null,
      users: store.get("SELECT COUNT(*) AS count FROM users WHERE active = 1").count,
      officeName: store.setting("office.name", ""),
      supervised: Boolean(process.send),
      hostname: os.hostname(),
      port: config.publicPort,
      addresses: lanAddresses(config.publicPort),
    });
  });
}
