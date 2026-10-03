// Çoklu şirket (v2.0.17, müşteri: "001 kodlu şirket, 002 kodlu şirket diye datada ayırır").
//
// Her şirket AYRI bir veri tabanı dosyasıdır (yaygın muhasebe programlarındaki "firma" gibi; veri karışması imkânsız,
// yedek/geri yükleme şirket bazında). Ortak katman: lisans, kullanıcılar, roller, şirket listesi — ilk (kök) veri
// tabanında. Mevcut kurulumun verisi göçte ilk şirket (001) olur; hiçbir kayıt taşınmaz, dosya yerinde kalır.
//   - Kayıt defteri: <dataDir>/sirketler.json  { companies: [{ id, code, name, dir, createdAt, createdBy }] }
//   - 001: dir "" (kök veri klasörü); diğerleri: <dataDir>/sirketler/<kod>/ (veri). Kod sonradan değişse de veri klasörü ve
//     iç kimlik aynı kalır (veri aynı şirkette).
//   - Yedek (v2.0.20, kullanıcı kararı): her şirketin yedekleri kendi adını taşıyan klasörde, <backupDir>/<kod> - <ad>/
//     (ör. "001 - Şirket 1"); ad ya da kod değişince klasör yeniden adlandırılır. 2.0.19'a kadarki yerler (001: <backupDir>
//     kökü, diğerleri <backupDir>/sirket-<klasör>/) "eski yer" olarak tanınır; açılışta yedekler yeni klasöre taşınır.
//   - Kullanıcı seçimi ve yetkisi ortak ayarlarda: company.user.<kullanıcı> (seçili şirket), company.access.<kullanıcı>
//     (görebildiği şirket kimlikleri; yönetici hepsini görür; kayıt yoksa yalnız 001).
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { companyFolderName, moveBackupFolder } from "./backup.mjs";
import { HttpError } from "./http.mjs";

export const ROOT_COMPANY_ID = "sirket-001";
const CODE = /^\d{3}$/;
const REGISTRY = "sirketler.json";

const now = () => new Date().toISOString();
const text = value => String(value ?? "").replace(/\s+/g, " ").trim();

export function createCompanyRegistry({ dataDir, backupDir, hubStore, log = { info() {}, warn() {} } }) {
  const file = path.join(dataDir, REGISTRY);
  let registry = { companies: [] };
  registry = load();

  function load() {
    if (existsSync(file)) {
      try {
        const parsed = JSON.parse(readFileSync(file, "utf8"));
        if (Array.isArray(parsed?.companies) && parsed.companies.length) return parsed;
      } catch (error) {
        log.warn?.(`Şirket listesi okunamadı (${error.message}); yeniden oluşturuluyor.`);
      }
    }
    // Göç: mevcut veri ilk şirkettir (001). Unvan ofis adından gelir; yoksa "Şirket 1". (v2.0.20: kayıt defteri veritabanı
    // göçlerinden önce kurulur ki göç öncesi yedek de şirketin klasörüne gitsin; yeni kurulumda ayar tablosu henüz yoktur.)
    let office = "";
    try {
      office = text(hubStore.setting("office.name", ""));
    } catch {
      office = "";
    }
    const name = office || "Şirket 1";
    const fresh = { companies: [{ id: ROOT_COMPANY_ID, code: "001", name, dir: "", createdAt: now(), createdBy: "" }] };
    save(fresh);
    return fresh;
  }
  function save(value = registry) {
    mkdirSync(dataDir, { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(value, null, 2));
    renameSync(tmp, file);
    registry = value;
  }

  const list = () => registry.companies.map(item => ({ ...item, root: item.id === ROOT_COMPANY_ID, label: `${item.code} · ${item.name}` }));
  const get = id => list().find(item => item.id === id) || null;
  const require = id => {
    const found = get(id);
    if (!found) throw new HttpError(404, "Şirket bulunamadı; silinmiş olabilir.");
    return found;
  };
  const byCode = code => list().find(item => item.code === code) || null;
  function nextCode() {
    const used = new Set(list().map(item => Number(item.code)));
    let n = 1;
    while (used.has(n)) n += 1;
    return String(n).padStart(3, "0");
  }
  // Şirketin klasörleri: veri 001'de kök klasörde (dosya yerinde kalır), diğerlerinde sirketler/<kod>; yedek her şirkette
  // <backupDir>/<kod> - <ad>. legacyBackupDirs: 2.0.19'a kadarki yer + taşıması yarım kalmış eski adlı klasörler.
  const isRoot = company => company.id === ROOT_COMPANY_ID || !company.dir;
  const legacyBackupDirsOf = company => {
    const dirs = [isRoot(company) ? backupDir : path.join(backupDir, `sirket-${path.basename(company.dir)}`)];
    for (const folder of Array.isArray(company.oldBackupDirs) ? company.oldBackupDirs : []) {
      const safe = path.basename(String(folder || ""));
      if (safe && safe !== "." && safe !== "..") dirs.push(path.join(backupDir, safe));
    }
    return dirs;
  };
  const dirsOf = company => ({
    dataDir: isRoot(company) ? dataDir : path.join(dataDir, company.dir),
    backupDir: path.join(backupDir, companyFolderName(company)),
    backupRoot: backupDir,
    legacyBackupDirs: legacyBackupDirsOf(company),
  });

  const codeInput = (value, exceptId = "") => {
    const code = text(value);
    if (!CODE.test(code)) throw new HttpError(400, "Şirket kodu üç haneli olmalı (ör. 001, 002).");
    const taken = byCode(code);
    if (taken && taken.id !== exceptId) throw new HttpError(409, `${code} kodu "${taken.name}" şirketinde kullanılıyor.`);
    return code;
  };
  const nameInput = value => {
    const name = text(value).slice(0, 120);
    if (!name) throw new HttpError(400, "Şirketin adını (unvanını) yazın.");
    return name;
  };

  function create(user, { code, name }) {
    const safeCode = codeInput(code || nextCode());
    const safeName = nameInput(name);
    const dir = path.join("sirketler", safeCode);
    const company = { id: `sirket-${randomUUID()}`, code: safeCode, name: safeName, dir, createdAt: now(), createdBy: user?.id || "" };
    mkdirSync(path.join(dataDir, dir), { recursive: true });
    save({ companies: [...registry.companies, company] });
    log.info?.(`Yeni şirket açıldı: ${safeCode} · ${safeName}`);
    return get(company.id);
  }
  function update(user, id, { name, code }) {
    const company = require(id);
    const next = { ...company };
    if (name !== undefined) next.name = nameInput(name);
    if (code !== undefined) next.code = codeInput(code, id);
    const entry = { id: next.id, code: next.code, name: next.name, dir: next.dir, createdAt: next.createdAt, createdBy: next.createdBy, updatedAt: now(), updatedBy: user?.id || "" };
    if (Array.isArray(company.oldBackupDirs) && company.oldBackupDirs.length) entry.oldBackupDirs = company.oldBackupDirs;
    save({ companies: registry.companies.map(item => (item.id === id ? entry : item)) });
    // Ad ya da kod değişti (v2.0.20): yedek klasörü yeni adına taşınır, içindekiler korunur. Taşınamayan dosya kalırsa
    // (ör. klasör Windows Gezgini'nde açık) eski klasör kayda yazılır: yedekler listede görünmeye devam eder, taşıma
    // sonraki açılışta yeniden denenir.
    const from = path.join(backupDir, companyFolderName(company));
    const to = path.join(backupDir, companyFolderName(entry));
    if (from !== to) {
      let result;
      try {
        result = moveBackupFolder(from, to);
      } catch (error) {
        result = { left: 1 };
        log.warn?.(`Yedek klasörü yeniden adlandırılamadı (${from} → ${to}): ${error.message}`);
      }
      if (result.left) {
        settleOldBackupDirs(id, [...(entry.oldBackupDirs || []), path.basename(from)]);
        log.warn?.(`Yedek klasöründen ${result.left} dosya eski yerinde kaldı (${from}); listede görünür, sonraki açılışta yeniden taşınır.`);
      } else log.info?.(`Yedek klasörü yeniden adlandırıldı: ${path.basename(from)} → ${path.basename(to)}`);
    }
    return get(id);
  }
  // Eski adlı yedek klasörleri (taşıması yarım kalanlar) kayda yazılır; taşıma tamamlanınca kayıttan düşülür.
  function settleOldBackupDirs(id, remaining) {
    const clean = [...new Set((remaining || []).map(folder => path.basename(String(folder || ""))).filter(folder => folder && folder !== "." && folder !== ".."))];
    save({
      companies: registry.companies.map(item => {
        if (item.id !== id) return item;
        const { oldBackupDirs, ...rest } = item;
        return clean.length ? { ...rest, oldBackupDirs: clean } : rest;
      }),
    });
  }
  // Silme: klasör silinmez, "silinen-sirketler/<kod>-<zaman>" altına taşınır (geri getirilebilir; önce yedek alınmıştır).
  // Yedek klasörüne (<backupDir>/<kod> - <ad>) dokunulmaz: şirketin bütün yedekleri orada kalır (v2.0.20).
  function remove(user, id) {
    const company = require(id);
    if (company.id === ROOT_COMPANY_ID) throw new HttpError(409, "001 kodlu ilk şirket silinemez; verisini sıfırlayabilirsiniz.");
    const from = path.join(dataDir, company.dir);
    const archive = path.join(dataDir, "silinen-sirketler");
    mkdirSync(archive, { recursive: true });
    const stamp = now().replace(/[:.]/g, "-");
    const to = path.join(archive, `${company.code}-${stamp}`);
    if (existsSync(from)) renameSync(from, to);
    save({ companies: registry.companies.filter(item => item.id !== id) });
    // O şirketi seçmiş kullanıcılar ilk şirkete döner.
    for (const row of hubStore.all("SELECT key FROM settings WHERE key LIKE 'company.user.%' AND value = ?", id)) hubStore.setSetting(row.key, ROOT_COMPANY_ID);
    log.info?.(`Şirket silindi: ${company.code} · ${company.name} (klasör: ${to})`);
    return { ...company, archivedTo: to };
  }

  // ---------- Kullanıcı seçimi ve yetkisi ----------
  const userKey = userId => `company.user.${userId}`;
  const accessKey = userId => `company.access.${userId}`;
  function accessOf(user) {
    if (!user) return [];
    if (user.role === "admin") return list().map(item => item.id);
    const raw = hubStore.setting(accessKey(user.id), "");
    let ids = [];
    try {
      ids = raw ? JSON.parse(raw) : [];
    } catch {
      ids = [];
    }
    const known = new Set(list().map(item => item.id));
    const allowed = ids.filter(id => known.has(id));
    return allowed.length ? allowed : [ROOT_COMPANY_ID];
  }
  const canAccess = (user, id) => accessOf(user).includes(id);
  function selectedFor(user) {
    if (!user) return ROOT_COMPANY_ID;
    const chosen = hubStore.setting(userKey(user.id), "");
    return chosen && get(chosen) && canAccess(user, chosen) ? chosen : accessOf(user)[0] || ROOT_COMPANY_ID;
  }
  function select(user, id) {
    require(id);
    if (!canAccess(user, id)) throw new HttpError(403, "Bu şirketi görme yetkiniz yok; yönetici yetki verebilir.");
    hubStore.setSetting(userKey(user.id), id, user.id);
    return get(id);
  }
  function setAccess(admin, userId, ids) {
    const known = new Set(list().map(item => item.id));
    const clean = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(id => known.has(id)))];
    hubStore.setSetting(accessKey(userId), JSON.stringify(clean), admin?.id || "");
    const chosen = hubStore.setting(userKey(userId), "");
    if (chosen && clean.length && !clean.includes(chosen)) hubStore.setSetting(userKey(userId), clean[0], admin?.id || "");
    return clean;
  }
  const listFor = user => {
    const current = selectedFor(user);
    return list()
      .filter(item => canAccess(user, item.id))
      .map(item => ({ id: item.id, code: item.code, name: item.name, label: item.label, root: item.root, current: item.id === current }));
  };

  return { file, list, get, require, byCode, nextCode, dirsOf, create, update, settleOldBackupDirs, remove, accessOf, canAccess, selectedFor, select, setAccess, listFor, ROOT_COMPANY_ID };
}

// Kullanıcı tablosunun şirket veri tabanına aynası (işlem geçmişi, Silinenler, "Kaydeden" gibi adlar için). Kimlik
// doğrulama ve yetki her zaman ortak katmandadır; bu kopya yalnız ad/rol gösterimi içindir.
export function mirrorUsers(hubStore, companyStore) {
  const columns = companyStore.all("PRAGMA table_info(users)").map(column => column.name);
  const hubColumns = new Set(hubStore.all("PRAGMA table_info(users)").map(column => column.name));
  const shared = columns.filter(name => hubColumns.has(name));
  const rows = hubStore.all(`SELECT ${shared.join(", ")} FROM users`);
  companyStore.tx(() => {
    companyStore.run("DELETE FROM users");
    for (const row of rows) companyStore.run(`INSERT INTO users (${shared.join(", ")}) VALUES (${shared.map(() => "?").join(", ")})`, ...shared.map(name => row[name]));
  });
  return rows.length;
}
export const usersFingerprint = store => {
  const row = store.get("SELECT COUNT(*) AS n, COALESCE(MAX(updated_at), '') AS at, COUNT(deleted_at) AS d FROM users");
  return `${row.n}/${row.at}/${row.d}`;
};
