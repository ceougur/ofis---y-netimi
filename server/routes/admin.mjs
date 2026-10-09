// Yönetici işlemleri: kullanıcılar, yedekler, değişiklik geçmişi ve sistem bilgisi.
import { createReadStream, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BACKUP_NAME } from "../lib/backup.mjs";
import { auditBackups } from "../lib/backup-audit.mjs";
import { HttpError, SECURITY_HEADERS, limited, ok, parseJson, readJson, text } from "../lib/http.mjs";
import { nameConflict } from "../lib/names.mjs";
import { hashPassword, passwordProblem, verifyPassword } from "../lib/passwords.mjs";
import { ADMIN_ONLY, GRANTABLE, NOT_YET_PERMISSIONS, PERMISSION_GROUPS, ROLE_LABELS, grantsOf, isGrantable, parseGrants } from "../lib/permissions.mjs";
import { migrateBankGrants, withGrantsDone } from "../lib/bank/grants.mjs";
import { compareVersions } from "../lib/semver.mjs";

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
  const { store, auth, access, audit, config, startedAt, supervisorLink, events } = context;
  const notifyInfoChange = () => context.notifyInfoChange?.();
  // Oturumları silinen kullanıcının açık canlı bağlantıları da hemen kapanır.
  const dropLive = userId => events?.closeWhere(client => client.userId === userId);
  const now = () => new Date().toISOString();
  // Gözden geçirme D5 (K4): rol ve kişi kaydı katalogdaki yetkileri yazar; Aşama 3'e kadar katalogda olmayan banka yetkileri (ve "verildi"
  // işareti) bu yazımda düşer. Aynı istekte bugünkü yetkilerden yeniden türetilir (yalnız işaretsiz satırlar; ekranda görünmez).
  const bankGrants = () => store.tx(() => migrateBankGrants(store));
  // v2.1.0 Aşama 3: banka yetkileri katalogda; yöneticinin kişi ekranında verdiği/kaldırdığı yetkiler bilinçli karardır. Kayıt "verildi"
  // işaretini taşır (ekranda görünmez, yetki vermez): ortak katmanın açılışındaki göç kuralı bu kişiye banka yetkisi eklemez.
  const grantsJson = grants => JSON.stringify({ add: withGrantsDone(grants.add), remove: grants.remove });
  const activeAdmins = () => store.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1 AND deleted_at IS NULL").count;

  // ---------- Kullanıcılar (v2.0.10: özel rol, kişiye özel yetki, ad/kullanıcı adı düzeltme, silme) ----------
  const USERNAME_RULE = /^[\p{L}\p{N}._-]{3,60}$/u;
  const usernameOf = value => {
    const username = limited(value, 60, "Kullanıcı adı");
    if (!username) throw new HttpError(400, "Kullanıcı adı gerekli.");
    if (!USERNAME_RULE.test(username)) throw new HttpError(400, "Kullanıcı adı 3-60 karakter olmalı; harf, rakam, nokta, tire ve alt çizgi kullanılabilir.");
    return username;
  };
  const usernameTaken = (username, exceptId = "") => Boolean(store.get("SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ?", username, exceptId));
  // Kişiye özel yetki: dizi (v2.0.7: eklenenler) ya da { add, remove }. Yalnız havuzdaki ve yönetime özgü olmayanlar.
  function grantsInput(value) {
    const raw = Array.isArray(value) ? { add: value, remove: [] } : value;
    if (!raw || typeof raw !== "object") throw new HttpError(400, "Yetki listesi tanınmadı.");
    const lists = [raw.add ?? [], raw.remove ?? []];
    if (lists.some(list => !Array.isArray(list))) throw new HttpError(400, "Yetki listesi tanınmadı.");
    if (lists.flat().some(permission => !isGrantable(permission))) throw new HttpError(400, "Verilebilecek yetki tanınmadı. Kullanıcı, sistem ve lisans yönetimi ile ANLIK DURUM kartı yalnız yönetici rolündedir.");
    return parseGrants({ add: raw.add ?? [], remove: raw.remove ?? [] });
  }
  const openTasksOf = id => store.get("SELECT COUNT(*) AS n FROM tasks WHERE assignee_id = ? AND status = 'open'", id).n;
  const userView = row => {
    const roleKey = access.roleKeyOf(row);
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      role: row.role,
      roleKey,
      roleLabel: access.labelOf(row),
      active: Boolean(row.active),
      mustChangePassword: Boolean(row.mustChangePassword),
      grants: grantsOf(row),
      permissions: access.permissionsOf(row),
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      openTasks: row.openTasks || 0,
      grantable: GRANTABLE,
    };
  };
  const USER_SELECT = `SELECT u.id, u.username, u.display_name AS name, u.role, u.role_key, u.active, u.must_change_password AS mustChangePassword,
      u.grants_json, u.last_login_at AS lastLoginAt, u.created_at AS createdAt,
      (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'open') AS openTasks FROM users u`;
  // Yetkisi değişen kişinin açık ekranı yetkilerini yeniden alsın.
  const permissionsChanged = ids => ids.length && events?.publish("workspace.changed", { kind: "permissions", userIds: ids }, { users: ids });

  router.get("/api/admin/users", async ({ req, res }) => {
    auth.requirePermission(req, "users.manage");
    ok(res, store.all(`${USER_SELECT} WHERE u.deleted_at IS NULL ORDER BY u.display_name COLLATE NOCASE`).map(userView));
  });

  // Silinen kullanıcılar: geçmişte adlarıyla görünürler; geri alınabilirler.
  router.get("/api/admin/users/deleted", async ({ req, res }) => {
    auth.requirePermission(req, "users.manage");
    ok(
      res,
      store.all(
        `SELECT u.id, COALESCE(u.deleted_name, u.display_name) AS name, COALESCE(u.deleted_username, u.username) AS username, u.role, u.role_key,
                u.deleted_at AS deletedAt, COALESCE(d.display_name, '') AS deletedByName
         FROM users u LEFT JOIN users d ON d.id = u.deleted_by WHERE u.deleted_at IS NOT NULL ORDER BY u.deleted_at DESC`,
      ).map(row => ({ id: row.id, name: row.name, username: row.username, roleKey: access.roleKeyOf(row), roleLabel: access.labelOf(row), deletedAt: row.deletedAt, deletedByName: row.deletedByName })),
    );
  });

  router.post("/api/admin/users", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const body = await readJson(req);
    const username = usernameOf(body.username);
    const name = limited(body.name, 120, "Görünen ad");
    if (!name) throw new HttpError(400, "Kullanıcı adı ve görünen ad gerekli.");
    const { role, roleKey } = access.pickRole(text(body.role, "personel") || "personel");
    const grants = body.grants === undefined || role === "admin" ? { add: [], remove: [] } : grantsInput(body.grants);
    const password = String(body.password || "");
    const problem = passwordProblem(password, { username });
    if (problem) throw new HttpError(400, problem);
    if (usernameTaken(username)) throw new HttpError(409, "Bu kullanıcı adı zaten kayıtlı.");
    const conflict = nameConflict(store, { name, username });
    if (conflict) throw new HttpError(409, conflict);
    const mustChange = body.mustChangePassword === false ? 0 : 1;
    const timestamp = now();
    const userId = auth.newId("user");
    store.run(
      "INSERT INTO users (id, username, display_name, role, role_key, grants_json, password_hash, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      userId, username, name, role, roleKey, grantsJson(grants), hashPassword(password), mustChange, timestamp, timestamp,
    );
    bankGrants();
    audit(admin, "user.created", userId, { username, role: roleKey || role, grants });
    ok(res, { id: userId, username, name, role, roleKey: roleKey || role, mustChangePassword: Boolean(mustChange) });
  });

  router.patch("/api/admin/users/:id", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const body = await readJson(req);
    const target = store.get("SELECT id, username, display_name, role, role_key, active, grants_json, deleted_at FROM users WHERE id = ?", params.id);
    if (!target || target.deleted_at) throw new HttpError(404, "Kullanıcı bulunamadı.");
    const picked = body.role === undefined ? { role: target.role, roleKey: target.role_key && access.customRole(target.role_key) ? target.role_key : null } : access.pickRole(body.role);
    const { role, roleKey } = picked;
    const active = body.active === undefined ? target.active : body.active === false ? 0 : 1;
    const name = body.name === undefined ? null : limited(body.name, 120, "Görünen ad");
    if (body.name !== undefined && !name) throw new HttpError(400, "Görünen ad boş olamaz.");
    // Kullanıcı adı (giriş adı) düzeltme (v2.0.10): yanlış yazılan ad düzeltilir; oturumlar açık kalır.
    const username = body.username === undefined ? null : usernameOf(body.username);
    if (username && username !== target.username) {
      if (usernameTaken(username, target.id)) throw new HttpError(409, "Bu kullanıcı adı zaten kayıtlı.");
      const conflict = nameConflict(store, { username, exceptId: target.id });
      if (conflict) throw new HttpError(409, conflict);
    }
    const grants = body.grants === undefined ? null : grantsInput(body.grants);
    if (name) {
      const conflict = nameConflict(store, { name, exceptId: target.id });
      if (conflict) throw new HttpError(409, conflict);
    }
    if (target.id === admin.id && (!active || role !== "admin")) throw new HttpError(400, "Kendi hesabınızı pasifleştiremez veya yöneticilikten çıkaramazsınız.");
    const losesAdmin = target.role === "admin" && target.active && (role !== "admin" || !active);
    if (losesAdmin && activeAdmins() <= 1) throw new HttpError(400, "Sistemde en az bir aktif yönetici kalmalı.");
    store.tx(() => {
      store.run(
        "UPDATE users SET role = ?, role_key = ?, active = ?, display_name = COALESCE(?, display_name), username = COALESCE(?, username), grants_json = COALESCE(?, grants_json), updated_at = ? WHERE id = ?",
        role, roleKey, active, name || null, username || null, grants ? grantsJson(grants) : null, now(), target.id,
      );
      if (!active) store.run("DELETE FROM sessions WHERE user_id = ?", target.id);
      bankGrants();
    });
    if (!active) dropLive(target.id);
    if (username && username !== target.username) auth.clearLoginLocks(target.username);
    const renamed = (name && name !== target.display_name) || (username && username !== target.username);
    audit(admin, renamed && body.role === undefined && body.grants === undefined && body.active === undefined ? "user.renamed" : "user.updated", target.id, {
      role: roleKey || role,
      active: Boolean(active),
      name: name && name !== target.display_name ? name : undefined,
      previousName: name && name !== target.display_name ? target.display_name : undefined,
      username: username && username !== target.username ? username : undefined,
      previousUsername: username && username !== target.username ? target.username : undefined,
      grants: grants || undefined,
    });
    if (grants || body.role !== undefined) permissionsChanged([target.id]);
    // Görev ve sohbet listelerinde ad hemen yenilensin.
    if (renamed) events?.publish("workspace.changed", { kind: "users", actorId: admin.id, actorName: admin.display_name });
    ok(res, true);
  });

  // Kullanıcı silme (v2.0.10): geçmiş korunur (işlemler, notlar, tahsilatlar kişinin adıyla kalır). Hesap giriş
  // yapamaz, listelerden çıkar; kullanıcı adı ve görünen ad yeni hesaba verilebilir. Kendini ve son yöneticiyi silemez.
  // Açık görevleri varsa reassignTo ister: bir kullanıcının kimliği ya da "keep" (görevler silinen kişide kalır).
  router.delete("/api/admin/users/:id", async ({ req, res, params, url }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const target = store.get("SELECT id, username, display_name, role, active, deleted_at FROM users WHERE id = ?", params.id);
    if (!target || target.deleted_at) throw new HttpError(404, "Kullanıcı bulunamadı.");
    if (target.id === admin.id) throw new HttpError(400, "Kendi hesabınızı silemezsiniz. Başka bir yönetici silebilir.");
    if (target.role === "admin" && target.active && activeAdmins() <= 1) throw new HttpError(400, "Sistemde en az bir aktif yönetici kalmalı.");
    const openTasks = openTasksOf(target.id);
    const reassign = text(url.searchParams.get("reassignTo"));
    let heir = null;
    if (openTasks && !reassign) throw new HttpError(409, `${target.display_name} kişisinin ${openTasks} açık görevi var. Görevleri kime devredeceğinizi seçin.`, { code: "OPEN_TASKS", openTasks });
    if (reassign && reassign !== "keep") {
      heir = store.get("SELECT id, display_name FROM users WHERE id = ? AND active = 1 AND deleted_at IS NULL", reassign);
      if (!heir || heir.id === target.id) throw new HttpError(400, "Görevlerin devredileceği kişi bulunamadı ya da hesabı kapalı.");
    }
    const stamp = now();
    const suffix = target.id.slice(-6);
    store.tx(() => {
      if (heir && openTasks) store.run("UPDATE tasks SET assignee_id = ?, assignee = ? WHERE assignee_id = ? AND status = 'open'", heir.id, heir.display_name, target.id);
      store.run(
        `UPDATE users SET active = 0, deleted_at = ?, deleted_by = ?, deleted_username = username, deleted_name = display_name,
            username = ?, display_name = ?, updated_at = ? WHERE id = ?`,
        stamp, admin.id, `${target.username}#silindi-${suffix}`, `${target.display_name} (silindi)`, stamp, target.id,
      );
      store.run("DELETE FROM sessions WHERE user_id = ?", target.id);
    });
    dropLive(target.id);
    auth.clearLoginLocks(target.username);
    audit(admin, "user.deleted", target.id, { username: target.username, name: target.display_name, openTasks, reassignedTo: heir?.display_name || undefined });
    events?.publish("workspace.changed", { kind: "users", actorId: admin.id, actorName: admin.display_name });
    ok(res, { ok: true, reassigned: heir ? openTasks : 0 });
  });

  // Silinen kullanıcıyı geri al: eski kullanıcı adı ve adı boştaysa onlarla; doluysa yenisi istenir.
  router.post("/api/admin/users/:id/restore", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const body = await readJson(req);
    const target = store.get("SELECT id, deleted_at, deleted_username, deleted_name, role_key FROM users WHERE id = ?", params.id);
    if (!target || !target.deleted_at) throw new HttpError(404, "Silinen kullanıcı bulunamadı.");
    const username = usernameOf(body.username || target.deleted_username);
    const name = limited(body.name || target.deleted_name, 120, "Görünen ad");
    if (usernameTaken(username, target.id)) throw new HttpError(409, `“${username}” kullanıcı adı artık başka bir hesapta. Geri alınan hesaba yeni bir kullanıcı adı yazın.`, { code: "USERNAME_TAKEN", username });
    const conflict = nameConflict(store, { name, username, exceptId: target.id });
    if (conflict) throw new HttpError(409, `${conflict} (Geri alınan hesaba farklı bir ad yazın.)`, { code: "NAME_TAKEN", name });
    store.run(
      "UPDATE users SET active = 1, deleted_at = NULL, deleted_by = NULL, deleted_username = NULL, deleted_name = NULL, username = ?, display_name = ?, role_key = ?, updated_at = ? WHERE id = ?",
      username, name, target.role_key && access.customRole(target.role_key) ? target.role_key : null, now(), target.id,
    );
    audit(admin, "user.restored", target.id, { username, name });
    events?.publish("workspace.changed", { kind: "users", actorId: admin.id, actorName: admin.display_name });
    ok(res, { ok: true, username, name });
  });

  // ---------- Yönetici parolası kurtarma anahtarı (v2.0.10) ----------
  router.get("/api/admin/recovery", async ({ req, res }) => {
    auth.requirePermission(req, "users.manage");
    ok(res, context.recovery?.status() || { exists: false });
  });
  // Yeni anahtar: eskisi geçersiz olur. Düz metin yalnız bu yanıtta döner; yönetici yazdırıp saklar.
  router.post("/api/admin/recovery", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "users.manage");
    if (!context.recovery) throw new HttpError(404, "Kurtarma kullanılamıyor.");
    const key = context.recovery.createKey(admin);
    audit(admin, "auth.recovery_key_created", admin.id, {});
    ok(res, { key, ...context.recovery.status() });
  });

  // ---------- Roller ve yetki havuzu (v2.0.10) ----------
  const catalog = () =>
    PERMISSION_GROUPS.map(group => ({ id: group.id, label: group.label, items: group.items.filter(([key]) => !NOT_YET_PERMISSIONS.has(key)).map(([key, label, help]) => ({ key, label, help, locked: ADMIN_ONLY.includes(key) })) }));
  router.get("/api/admin/roles", async ({ req, res }) => {
    auth.requirePermission(req, "users.manage");
    const labels = context.profile?.profile?.()?.roleLabels;
    ok(res, { ...access.list(labels ? { ...ROLE_LABELS, ...labels } : ROLE_LABELS), groups: catalog(), adminOnly: ADMIN_ONLY });
  });
  router.post("/api/admin/roles", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const role = access.createRole(await readJson(req), admin);
    bankGrants();
    audit(admin, "role.created", role.id, { name: role.name, permissions: role.permissions });
    ok(res, role);
  });
  router.patch("/api/admin/roles/:id", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const role = access.updateRole(params.id, await readJson(req));
    bankGrants();
    audit(admin, "role.updated", role.id, { name: role.name, permissions: role.permissions });
    permissionsChanged(access.usersOfRole(role.id));
    ok(res, role);
  });
  router.delete("/api/admin/roles/:id", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const role = access.deleteRole(params.id);
    audit(admin, "role.deleted", role.id, { name: role.name });
    ok(res, true);
  });

  router.post("/api/admin/users/:id/reset-password", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const body = await readJson(req);
    const target = store.get("SELECT id, username FROM users WHERE id = ? AND deleted_at IS NULL", params.id);
    if (!target) throw new HttpError(404, "Kullanıcı bulunamadı.");
    const problem = passwordProblem(body.password, { username: target.username });
    if (problem) throw new HttpError(400, problem);
    const mustChange = body.mustChangePassword === false ? 0 : 1;
    store.tx(() => {
      store.run("UPDATE users SET password_hash = ?, must_change_password = ?, password_changed_at = ?, updated_at = ? WHERE id = ?", hashPassword(body.password), mustChange, now(), now(), target.id);
      if (target.id !== admin.id) store.run("DELETE FROM sessions WHERE user_id = ?", target.id);
    });
    if (target.id !== admin.id) dropLive(target.id);
    // Hatalı denemelerle kilitlenmiş kullanıcı, yeni parolasıyla beklemeden girebilsin.
    auth.clearLoginLocks(target.username);
    audit(admin, "user.password_reset", target.id, { mustChangePassword: Boolean(mustChange) });
    ok(res, true);
  });

  router.post("/api/admin/users/:id/logout-all", async ({ req, res, params }) => {
    const admin = auth.requirePermission(req, "users.manage");
    const removed = store.run("DELETE FROM sessions WHERE user_id = ?", params.id).changes;
    dropLive(params.id);
    audit(admin, "user.sessions_revoked", params.id, { removed });
    ok(res, { removed });
  });

  // ---------- Yedekler (v2.0.20: bütün şirketler, her biri kendi klasöründe; ortak katmanda çalışır) ----------
  // Yönetici bütün şirketleri görür; liste ve indirme yine de kullanıcının görebildiği şirketlerle sınırlıdır.
  const backups = context.backups;
  const companies = context.companies;
  const mirror = result => (context.mirrorNow ? context.mirrorNow(result) : context.cloudBackup ? context.cloudBackup.mirror(result) : Promise.resolve(null));
  const companyView = (admin, company) => ({ id: company.id, code: company.code, name: company.name, label: company.label || `${company.code} · ${company.name}`, root: Boolean(company.root), current: company.id === companies.selectedFor(admin), folder: backups.folderOf(company) });
  const backupView = ({ mtimeMs, dir, ...item }) => ({ ...item, folder: dir });
  const companyFor = (admin, id) => {
    const company = companies.get(text(id));
    if (!company || !companies.canAccess(admin, company.id)) throw new HttpError(404, "Şirket bulunamadı ya da bu şirketi görme yetkiniz yok.");
    return company;
  };

  router.get("/api/admin/backups", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    ok(res, backups.list(admin).map(backupView));
  });

  // Son 001 geri yüklemesinin sonucu (sunucu açılışında uygulanır): 3 gün boyunca Yedekler ekranında görünür.
  const lastRestore = () => {
    try {
      const value = JSON.parse(store.setting("backup.lastRestore", "") || "null");
      return value && Date.now() - Date.parse(value.at) < 3 * 86_400_000 ? value : null;
    } catch {
      return null;
    }
  };
  // Klasörler: Yedekler ekranındaki "Her şirketin yedeği kendi klasöründe" açıklaması ve Yedek Al seçenekleri.
  router.get("/api/admin/backups/folders", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    ok(res, { root: backups.root(), current: companies.selectedFor(admin), companies: backups.accessible(admin).map(company => companyView(admin, company)), pending: backups.pendingRestore(), lastRestore: lastRestore(), supervised: Boolean(supervisorLink?.supervised) });
  });

  // Yedekleri Denetle (v2.0.21): her şirketin yedekleri kendi klasöründe ve kendi kimliğiyle mi? Yalnız okur, rapor verir.
  // (/api/admin/backups/:name'den önce kayıtlı; "audit" yedek adı sayılmaz.)
  router.get("/api/admin/backups/audit", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    ok(res, auditBackups({ registry: companies, backupRoot: backups.root(), visible: backups.accessible(admin).map(company => company.id), full: admin.role === "admin" }));
  });

  // Yedek Al: scope "all" (Tüm Şirketler, varsayılan) ya da "one" (companyId; verilmezse seçili şirket).
  router.post("/api/admin/backups", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const body = await readJson(req);
    const scope = text(body.scope) === "one" ? "one" : "all";
    const chosen = scope === "all" ? backups.accessible(admin) : [companyFor(admin, text(body.companyId) || companies.selectedFor(admin))];
    const results = backups.backupMany(chosen, { label: "manuel" });
    const done = results.filter(item => item.name);
    const failed = results.filter(item => !item.name).map(item => ({ companyId: item.companyId, company: item.company ? `${item.company.code} · ${item.company.name}` : "", error: item.error, code: item.code || "" }));
    // Veri dosyası paylaşan şirket (v2.0.21) bir hata değil, yöneticinin yapacağı iş: 409 ve nedeni.
    if (!done.length) throw new HttpError(failed.length && failed.every(item => item.code === "company-shared") ? 409 : 500, `Yedek alınamadı: ${failed.map(item => `${item.company}: ${item.error}`).join("; ") || "bilinmeyen hata"}`, { code: failed[0]?.code || "" });
    for (const item of done) audit(admin, "system.backup_created", item.name, { size: item.size, company: item.company?.code || "", scope });
    const clouds = [];
    for (const item of done) clouds.push(await mirror(item).catch(error => ({ ok: false, error: error.message })));
    const selected = companies.selectedFor(admin);
    const primaryIndex = Math.max(0, done.findIndex(item => item.companyId === selected));
    const primary = done[primaryIndex];
    ok(res, {
      scope,
      name: primary.name,
      size: primary.size,
      company: primary.company,
      cloud: clouds[primaryIndex] || null,
      backups: done.map((item, index) => ({ companyId: item.companyId, company: `${item.company.code} · ${item.company.name}`, code: item.company.code, name: item.name, size: item.size, folder: path.dirname(item.path), cloud: clouds[index] || null })),
      failed,
    });
  });

  // Geri yükle (v2.0.20): yedek yalnız kendi şirketine (içindeki kimlik; eski yedekte bulunduğu klasör). Onay: hedef
  // şirketin kodu ya da adı + yöneticinin parolası. 001 sunucu yeniden açılırken, diğerleri hemen geri yüklenir.
  router.post("/api/admin/backups/restore", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const body = await readJson(req);
    const located = backups.locate(admin, text(body.name), text(body.company));
    const target = text(body.target) ? companyFor(admin, body.target) : located.company;
    backups.assertRestorable({ file: located.file, source: located.company, target });
    const typed = text(body.confirm);
    if (typed !== target.code && typed.toLocaleLowerCase("tr-TR") !== target.name.toLocaleLowerCase("tr-TR")) throw new HttpError(400, `Onay için şirket kodunu (${target.code}) ya da adını yazın.`, { code: "confirm" });
    const row = store.get("SELECT password_hash AS hash FROM users WHERE id = ?", admin.id);
    if (!row || !verifyPassword(String(body.password || ""), row.hash)) throw new HttpError(403, "Parola doğrulanamadı; işlem yapılmadı.", { code: "password" });
    const result = await backups.restoreCompany({ file: located.file, target, user: admin });
    const label = `${target.code} · ${target.name}`;
    if (result.staged) {
      audit(admin, "system.backup_restore_staged", located.file ? path.basename(located.file) : "", { company: target.code });
      const restarting = Boolean(context.requestRestart?.("Yedekten geri yükleme"));
      return ok(res, { staged: true, restarting, restartRequired: !restarting, company: label, name: result.name });
    }
    audit(admin, "system.backup_restored", result.name, { company: target.code, safety: result.safety });
    events?.publish("workspace.changed", { kind: "companies", actorId: admin.id, actorName: admin.display_name });
    ok(res, { restored: true, company: label, name: result.name, safety: result.safety });
  });

  // Bekleyen 001 geri yüklemesinden vazgeç (sunucu yeniden açılmadan önce).
  router.delete("/api/admin/backups/restore", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const cancelled = backups.cancelRestore();
    if (cancelled) audit(admin, "system.backup_restore_cancelled", "", {});
    ok(res, { cancelled });
  });

  // Drive'a yedek (v2.0.2): bağlantı/klasör bağlama, durum ve deneme. ":name" yolundan önce kayıtlı olmalı.
  router.get("/api/admin/backups/cloud", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    ok(res, context.cloudBackup ? context.cloudBackup.status() : { enabled: false });
  });

  router.post("/api/admin/backups/cloud", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    if (!context.cloudBackup) throw new HttpError(503, "Drive yedeği bu kurulumda kapalı.");
    const body = await readJson(req);
    const target = String(body.target ?? "").trim();
    if (target.length > 500) throw new HttpError(400, "Bağlantı ya da yol çok uzun.");
    let status;
    try {
      status = context.cloudBackup.configure(admin, target);
    } catch (error) {
      throw new HttpError(error.status || 400, error.message);
    }
    audit(admin, status.enabled ? "system.cloud_backup_set" : "system.cloud_backup_cleared", status.mode || "", { value: status.value || "" });
    ok(res, status);
  });

  router.post("/api/admin/backups/cloud/test", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    if (!context.cloudBackup?.status().enabled) throw new HttpError(400, "Önce bir Drive bağlantısı ya da klasör yolu bağlayın.");
    // Deneme: seçili şirketin yedeği alınır ve Drive'a kopyalanır.
    const company = companyFor(admin, companies.selectedFor(admin));
    const result = backups.backup(company, { label: "drive-deneme" });
    if (!result) throw new HttpError(500, "Şirketin veri dosyası bulunamadı; yedek alınamadı.");
    audit(admin, "system.backup_created", result.name, { size: result.size, test: true, company: company.code });
    const cloud = await mirror(result);
    ok(res, { ok: Boolean(cloud?.ok), name: result.name, error: cloud?.error || null, status: context.cloudBackup.status() });
  });

  // İndir: ?company=<şirket kimliği> (Yedekler listesi gönderir); verilmezse görebildiği şirketlerde aranır.
  router.get("/api/admin/backups/:name", async ({ req, res, params, url }) => {
    const admin = auth.requirePermission(req, "system.manage");
    if (!BACKUP_NAME.test(params.name)) throw new HttpError(400, "Geçersiz yedek adı.");
    const { file, company } = backups.locate(admin, params.name, text(url.searchParams.get("company")));
    let stats;
    try {
      stats = statSync(file);
    } catch {
      throw new HttpError(404, "Yedek bulunamadı.");
    }
    audit(admin, "system.backup_downloaded", params.name, { company: company.code });
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

  // ---------- Güncellemeler (servis yöneticisi üzerinden) ----------
  const NOT_SUPERVISED = "Otomatik güncelleme yalnızca kurulum dosyasıyla kurulan (Windows servisi olarak çalışan) sunucularda kullanılabilir.";
  const updateLink = () => {
    if (!supervisorLink?.supervised) throw new HttpError(409, NOT_SUPERVISED);
    return supervisorLink;
  };

  // Servis yöneticisi yeni sürüme yeniden başlamadan geçtiyse (2.0.6 ve öncesi) çalışan sürümü eski sanıp aynı
  // sürümü "yeni" diye önerebilir. Uygulama kendi sürümünden yeni olmayan öneriyi göstermez ve kurdurmaz.
  const isNewer = version => Boolean(version) && Boolean(config.version) && compareVersions(version, config.version) > 0;
  function sanitizeUpdate(status) {
    if (!status || typeof status !== "object") return status;
    const next = { ...status, currentVersion: config.version || status.currentVersion };
    if (next.available && !isNewer(next.available.version)) next.available = null;
    if (next.lastCheck?.status === "available" && !isNewer(next.lastCheck.version)) next.lastCheck = { ...next.lastCheck, status: "up-to-date", version: config.version, reason: null };
    return next;
  }

  router.get("/api/admin/update", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    if (!supervisorLink?.supervised) return ok(res, { enabled: false, reason: NOT_SUPERVISED, currentVersion: config.version });
    ok(res, sanitizeUpdate(await supervisorLink.request("update:status", {}, { timeoutMs: 10_000 })));
  });

  router.post("/api/admin/update/check", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const status = sanitizeUpdate(await updateLink().request("update:check", {}, { timeoutMs: 90_000 }));
    audit(admin, "system.update_checked", "update", { available: status.available?.version || null, result: status.lastCheck?.status || null });
    ok(res, status);
  });

  router.post("/api/admin/update/apply", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    // Önce taze denetim: yalnızca çalışan sürümden yeni bir sürüm varsa kurulum başlatılır.
    const fresh = sanitizeUpdate(await updateLink().request("update:check", {}, { timeoutMs: 90_000 }));
    if (!fresh.available) throw new HttpError(409, fresh.incompatible?.reason || (fresh.lastCheck?.status === "error" && fresh.lastCheck.reason) || `Kurulacak yeni bir sürüm yok; sistem güncel (${config.version}).`);
    const result = await updateLink().request("update:apply", {}, { timeoutMs: 90_000 });
    audit(admin, "system.update_requested", "update", { version: result.version || null });
    ok(res, result);
  });

  router.put("/api/admin/update/settings", async ({ req, res }) => {
    const admin = auth.requirePermission(req, "system.manage");
    const body = await readJson(req);
    const payload = {};
    if (body.autoUpdate !== undefined) payload.enabled = Boolean(body.autoUpdate);
    if (body.channel !== undefined) payload.channel = text(body.channel);
    const status = sanitizeUpdate(await updateLink().request("update:config", payload, { timeoutMs: 10_000 }));
    audit(admin, "system.update_settings", "update", payload);
    ok(res, status);
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
    // Bu şirketin (seçili şirket) son yedeği ve yedek klasörü (v2.0.20: <yedek kökü>/<kod> - <ad>).
    const self = context.company?.();
    const latest = self && context.backups ? context.backups.latestFor(self) : null;
    ok(res, {
      product: config.productName,
      version: config.version,
      node: process.version,
      startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      schemaVersion: store.get("PRAGMA user_version").user_version,
      dbSize,
      dataDir: config.dataDir,
      backupDir: context.backupDir ? context.backupDir() : config.backupDir,
      backupRoot: config.backupDir,
      lastBackup: latest ? { name: latest.name, size: latest.size, createdAt: latest.createdAt } : null,
      // 30 günden eski sohbet mesajlarının arşivi (v2.0.2).
      chatArchive: context.chatArchive ? context.chatArchive.info() : null,
      users: store.get("SELECT COUNT(*) AS count FROM users WHERE active = 1 AND deleted_at IS NULL").count,
      officeName: store.setting("office.name", ""),
      supervised: Boolean(supervisorLink?.supervised),
      hostname: os.hostname(),
      port: config.publicPort,
      addresses: lanAddresses(config.publicPort),
    });
  });
}
