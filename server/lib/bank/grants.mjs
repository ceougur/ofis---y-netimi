// Banka ve POS yetkileri ve yetki göçü (v2.1.0; docs/BANKA-MODULU-PLAN.md §9.1, K4).
//
// BANK_PERMISSIONS: yerleşik rollerin banka yetkileri (§9.1 tablosu). Aşama 3'te (Banka penceresi ve Yönetim'deki "Banka ve POS"
// yetki grubu) permissions.mjs kataloğuna girer; o güne kadar hiçbir ekranda görünmez, hiçbir uç bu anahtarlarla açılmaz.
//
// Yetki göçü (v20, yalnız ortak katmanda = 001'in veri tabanı; şirketlerin kullanıcı tablosu oradan aynalanır), K4 kuralı:
//   - Bugün bankadan çıkış yapabilen (cari, fatura, stok, satış, çek/senet ya da taksit YÖNETİMİ olan) her özel rol ve kişiye
//     bank.move + bank.cancel ("dün 200 dönen para işlemi bugün de 200");
//   - cash.manage taşıyana bank.transfer, bank.statement, bank.reconcile; cash.view taşıyana bank.view, bank.reports;
//   - kişiden cash.view kaldırılmışsa (grants.remove) yalnız bank.view ve bank.reports kaldırılmış sayılır; yazma yetkilerine
//     kaldırma yansıtılmaz (rolünden gelen bank.move kalır: personel bankadan çıkışı bugün de yapabilen rolde).
//   - Yeni yetenekler (bank.accounts, bank.pos, bank.commission, bank.settings) özel role/kişiye göçle verilmez.
//   - Yalnız EKLER (mevcut hiçbir yetki kalkmaz); iki kez çalışınca aynı sonuç.
import { ADMIN_ONLY, PERMISSIONS, permissionsFor } from "../permissions.mjs";

export const BANK_PERMISSIONS = Object.freeze({
  "bank.view": ["admin", "avukat", "muhasebe"],
  "bank.reports": ["admin", "avukat", "muhasebe"],
  "bank.accounts": ["admin", "muhasebe"],
  "bank.move": ["admin", "avukat", "muhasebe"],
  "bank.cancel": ["admin", "avukat", "muhasebe"],
  "bank.transfer": ["admin", "avukat", "muhasebe"],
  "bank.pos": ["admin", "muhasebe"],
  "bank.commission": ["admin", "muhasebe"],
  "bank.statement": ["admin", "avukat", "muhasebe"],
  "bank.reconcile": ["admin", "avukat", "muhasebe"],
  "bank.settings": ["admin", "muhasebe"],
});
export const BANK_KEYS = Object.freeze(Object.keys(BANK_PERMISSIONS));
// Bankadan çıkış yapabilen modül yönetimi (K4).
export const OUTFLOW_PERMISSIONS = Object.freeze(["accounts.manage", "invoices.manage", "stock.manage", "stock.sell", "cheques.manage", "plans.manage"]);
const VIEW_KEYS = ["bank.view", "bank.reports"];
const MOVE_KEYS = ["bank.move", "bank.cancel"];
const CASH_KEYS = ["bank.transfer", "bank.statement", "bank.reconcile"];

/** Bugünkü yetkilerden (banka dışı anahtarlar) göçün verdiği banka yetkileri. */
export function bankGrantsFor(permissions) {
  const has = key => permissions.has(key);
  const out = new Set();
  if (has("cash.view")) for (const key of VIEW_KEYS) out.add(key);
  if (OUTFLOW_PERMISSIONS.some(has)) for (const key of MOVE_KEYS) out.add(key);
  if (has("cash.manage")) for (const key of CASH_KEYS) out.add(key);
  return out;
}

// Bugünkü katalogda verilebilen yetki (access.mjs'deki süzgeçle aynı: bilinmeyen ve yönetime özgü atılır).
const known = key => typeof key === "string" && Object.hasOwn(PERMISSIONS, key) && !ADMIN_ONLY.includes(key);
const parse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
// Kişiye özel ayarın HAM hâli (bilinmeyen anahtarlar korunur: göç sonrası banka anahtarları da). v2.0.7 dizi biçimi = eklenen.
function rawGrants(value) {
  const raw = parse(value || "[]", []);
  if (Array.isArray(raw)) return { add: raw.filter(item => typeof item === "string"), remove: [] };
  return {
    add: Array.isArray(raw?.add) ? raw.add.filter(item => typeof item === "string") : [],
    remove: Array.isArray(raw?.remove) ? raw.remove.filter(item => typeof item === "string") : [],
  };
}
const withAll = (list, extra) => {
  const out = [...list];
  for (const key of extra) if (!out.includes(key)) out.push(key);
  return out;
};

/**
 * Yetki göçü: roles.permissions_json ve users.grants_json'a yalnız banka yetkisi ekler. Bir işlemin içinde çağrılır (göç).
 * Dönüş: { roles, users } değişen satır sayıları.
 */
export function migrateBankGrants(store) {
  const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
  const changed = { roles: 0, users: 0 };
  const roles = new Map();
  if (has("roles")) {
    for (const row of store.all("SELECT id, permissions_json AS permissionsJson FROM roles")) {
      const list = parse(row.permissionsJson || "[]", []);
      const permissions = (Array.isArray(list) ? list : []).filter(item => typeof item === "string");
      // Rolün BUGÜNKÜ (göç öncesi, katalogdaki) yetkileri kişilerin hesabında da kullanılır.
      const today = new Set(permissions.filter(known));
      const gives = bankGrantsFor(today);
      roles.set(row.id, { today, gives });
      const next = withAll(permissions, [...gives]);
      if (next.length !== permissions.length) {
        store.run("UPDATE roles SET permissions_json = ? WHERE id = ?", JSON.stringify(next), row.id);
        changed.roles += 1;
      }
    }
  }
  if (!has("users")) return changed;
  const columns = new Set(store.all("PRAGMA table_info(users)").map(row => row.name));
  if (!columns.has("grants_json")) return changed;
  const roleKey = columns.has("role_key") ? "role_key" : "NULL";
  for (const user of store.all(`SELECT id, role, ${roleKey} AS roleKey, grants_json AS grantsJson FROM users`)) {
    if (user.role === "admin" && !(user.roleKey && roles.has(user.roleKey))) continue; // yönetici her yetkiye sahip
    const custom = user.roleKey ? roles.get(user.roleKey) : null;
    const grants = rawGrants(user.grantsJson);
    // Bugünkü etkin yetkiler: rol (özel rol kaydı ya da yerleşik matris) + kişiye eklenen − kaldırılan (katalogdakiler).
    const today = new Set(custom ? custom.today : permissionsFor(user.role).filter(known));
    for (const key of grants.add.filter(known)) today.add(key);
    for (const key of grants.remove.filter(known)) today.delete(key);
    const want = bankGrantsFor(today);
    const roleGives = custom ? custom.gives : new Set(BANK_KEYS.filter(key => BANK_PERMISSIONS[key].includes(user.role)));
    const add = withAll(grants.add, [...want].filter(key => !roleGives.has(key)));
    // K4: kişiden kaldırma yalnız görmeye yansır (rol veriyor ama kişinin bugünkü yetkisi gerektirmiyorsa).
    const remove = withAll(grants.remove, VIEW_KEYS.filter(key => roleGives.has(key) && !want.has(key) && !add.includes(key)));
    if (add.length !== grants.add.length || remove.length !== grants.remove.length) {
      store.run("UPDATE users SET grants_json = ? WHERE id = ?", JSON.stringify({ add, remove }), user.id);
      changed.users += 1;
    }
  }
  return changed;
}
