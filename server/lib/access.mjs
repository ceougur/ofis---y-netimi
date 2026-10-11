// Rol kayıt defteri ve etkin yetki çözümü (v2.0.10).
// Yerleşik dört rol permissions.mjs matrisindedir; yöneticinin tanımladığı roller roles tablosundadır. Özel rol
// atanmış kullanıcının users.role sütunu (eski CHECK kısıtı yüzünden) "personel" kalır, users.role_key rolün
// kimliğini taşır. Bir kullanıcının yetkisi = rolün yetkileri + kişiye eklenenler − kişiden kaldırılanlar.
import { randomUUID } from "node:crypto";
import { HttpError, limited, text } from "./http.mjs";
import { foldName } from "./names.mjs";
import { NOT_YET_PERMISSIONS, ROLES, ROLE_LABELS, isGrantable, permissionsFor, resolvePermissions } from "./permissions.mjs";
import { withGrantsDone } from "./bank/grants.mjs";

const now = () => new Date().toISOString();
const ROLE_MAX = 60;

export function createAccess({ store }) {
  let cache = null;
  const load = () => {
    if (cache) return cache;
    const hasTable = Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'roles'"));
    const rows = hasTable ? store.all("SELECT id, name, description, permissions_json AS permissionsJson, created_at AS createdAt, updated_at AS updatedAt FROM roles ORDER BY name COLLATE NOCASE") : [];
    cache = new Map(
      rows.map(row => {
        let permissions = [];
        try {
          permissions = JSON.parse(row.permissionsJson || "[]");
        } catch {
          permissions = [];
        }
        return [row.id, { id: row.id, name: row.name, description: row.description || "", permissions: (Array.isArray(permissions) ? permissions : []).filter(isGrantable), createdAt: row.createdAt, updatedAt: row.updatedAt }];
      }),
    );
    return cache;
  };
  const invalidate = () => {
    cache = null;
  };
  const customRole = key => (key ? load().get(key) || null : null);
  const roleKeyOf = user => {
    const key = user?.role_key ?? user?.roleKey ?? "";
    return key && customRole(key) ? key : user?.role || "personel";
  };
  const permissionsOf = user => resolvePermissions(user, customRole(user?.role_key ?? user?.roleKey ?? ""));
  // İstek sahibi kullanıcıya etkin yetkiler bir kez hesaplanıp eklenir (canUser bunu okur).
  const attach = user => {
    if (user && !(user.perms instanceof Set)) user.perms = new Set(permissionsOf(user));
    return user;
  };
  const can = (user, permission) => permissionsOf(user).includes(permission);
  const labelOf = user => customRole(user?.role_key ?? user?.roleKey ?? "")?.name || "";

  // Rol seçimi (kullanıcı oluşturma/düzenleme): yerleşik rol adı ya da özel rol kimliği.
  function pickRole(value) {
    const key = text(value);
    if (ROLES.includes(key)) return { role: key, roleKey: null };
    if (customRole(key)) return { role: "personel", roleKey: key };
    throw new HttpError(400, "Geçersiz rol.");
  }

  const usage = () => {
    const counts = new Map();
    for (const row of store.all("SELECT role, role_key AS roleKey FROM users WHERE deleted_at IS NULL")) {
      const key = row.roleKey && customRole(row.roleKey) ? row.roleKey : row.role;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  };
  // Yönetim ekranı: yerleşik roller (silinmez, değişmez) ve ofisin tanımladığı roller.
  function list(labels = ROLE_LABELS) {
    const counts = usage();
    const builtIn = ROLES.map(key => ({ key, label: labels[key] || ROLE_LABELS[key], builtIn: true, permissions: permissionsFor(key), users: counts.get(key) || 0 }));
    const custom = [...load().values()].map(role => ({ key: role.id, label: role.name, description: role.description, builtIn: false, permissions: role.permissions, users: counts.get(role.id) || 0, updatedAt: role.updatedAt }));
    return { builtIn, custom };
  }

  function roleInput(body, exceptId = null) {
    const name = limited(body.name, ROLE_MAX, "Rol adı");
    if (!name) throw new HttpError(400, "Rol adı gerekli.");
    const folded = foldName(name);
    const clash = ROLES.some(key => foldName(ROLE_LABELS[key]) === folded || foldName(key) === folded) || [...load().values()].some(role => role.id !== exceptId && foldName(role.name) === folded);
    if (clash) throw new HttpError(409, "Bu adda bir rol zaten var. Farklı bir ad yazın.");
    const description = limited(body.description ?? "", 200, "Açıklama");
    if (!Array.isArray(body.permissions)) throw new HttpError(400, "Yetki listesi gerekli.");
    const unknown = body.permissions.filter(permission => !isGrantable(permission));
    if (unknown.length) throw new HttpError(400, "Kullanıcı, sistem ve lisans yönetimi ile ANLIK DURUM kartı yalnız yönetici rolündedir; özel role verilemez.");
    return { name, description, permissions: [...new Set(body.permissions)] };
  }
  function createRole(body, actor) {
    const input = roleInput(body);
    const id = `role-${randomUUID()}`;
    const at = now();
    // v2.1.0 Aşama 3: kayıt "banka yetkileri verildi" işaretini taşır (yöneticinin seçtiği banka yetkileri göçle tamamlanmaz; lib/bank/grants.mjs).
    store.run("INSERT INTO roles (id, name, description, permissions_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, input.name, input.description, JSON.stringify(withGrantsDone(input.permissions)), actor.id, at, at);
    invalidate();
    return { id, ...input };
  }
  function updateRole(id, body) {
    if (ROLES.includes(id)) throw new HttpError(400, "Yerleşik roller değiştirilemez. Kendi rolünüzü oluşturun ya da kişiye özel yetki verin.");
    const current = customRole(id);
    if (!current) throw new HttpError(404, "Rol bulunamadı.");
    const input = roleInput({ name: current.name, description: current.description, permissions: current.permissions, ...body }, id);
    // GG2: ekranda görünmeyen (henüz olmayan özelliklerin) yetkileri ekran göndermez; kayıtlı değerleri kalır.
    if (Array.isArray(body?.permissions)) input.permissions = [...input.permissions.filter(key => !NOT_YET_PERMISSIONS.has(key)), ...(current.permissions || []).filter(key => NOT_YET_PERMISSIONS.has(key))];
    store.run("UPDATE roles SET name = ?, description = ?, permissions_json = ?, updated_at = ? WHERE id = ?", input.name, input.description, JSON.stringify(withGrantsDone(input.permissions)), now(), id);
    invalidate();
    return { id, ...input };
  }
  function deleteRole(id) {
    if (ROLES.includes(id)) throw new HttpError(400, "Yerleşik roller silinemez.");
    const current = customRole(id);
    if (!current) throw new HttpError(404, "Rol bulunamadı.");
    const inUse = store.get("SELECT COUNT(*) AS n FROM users WHERE role_key = ? AND deleted_at IS NULL", id).n;
    if (inUse) throw new HttpError(409, `Bu rol ${inUse} kullanıcıda kullanılıyor. Önce o kullanıcıları başka bir role geçirin.`, { code: "ROLE_IN_USE", users: inUse });
    store.run("DELETE FROM roles WHERE id = ?", id);
    // Silinmiş kullanıcılarda kalan bağ kopar (geri alınırsa rolü "Personel" olur).
    store.run("UPDATE users SET role_key = NULL WHERE role_key = ?", id);
    invalidate();
    return current;
  }
  // Rolü değişen kullanıcıların açık ekranları yetkilerini yeniden alsın.
  const usersOfRole = id => store.all("SELECT id FROM users WHERE role_key = ? AND deleted_at IS NULL AND active = 1", id).map(row => row.id);

  return { attach, can, permissionsOf, roleKeyOf, labelOf, customRole, pickRole, list, createRole, updateRole, deleteRole, usersOfRole, invalidate };
}
