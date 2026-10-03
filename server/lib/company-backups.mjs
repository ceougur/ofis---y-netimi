// Çoklu şirket yedekleri (v2.0.20, CLAUDE.md 2.0.20 madde 9 — kullanıcı: "her şirketin yedeği kendi isminde klasör
// açılıp buna girmeli").
//
// - Klasör: <yedek kökü>/<kod> - <ad>/ (ör. "backups/001 - Şirket 1"); ad: destekofis-<kod>-<zaman>[-etiket].sqlite.
//   Şirketin kimliği ({ id, code, name }) yedeğin İÇİNE yazılır (backup_meta tablosu); dosya kendini tanıtır.
// - Göç: 2.0.19'a kadarki yerler (001: yedek kökü, diğerleri sirket-<klasör>/) yeni klasöre TAŞINIR (silinmez; taşınamayan
//   yerinde kalır ve listede görünür). Eski servis yöneticisinin geri dönüşte kökte arayacağı taze güncelleme yedekleri
//   ("guncelleme-oncesi", "basarisiz-guncelleme"; 7 günden yeni) kökte bırakılır, sonraki turlarda taşınır.
// - Liste/indirme/geri yükleme bütün şirketleri kapsar (yalnız kullanıcının görebildiği şirketler); otomatik yedek de
//   bütün şirketleri (bu açılışta hiç açılmamış olsa da; veri tabanı kısa süreliğine salt okunur açılıp kapatılır).
// - Geri yükleme: yedekteki kimlik hedef şirketle aynı değilse REDDEDİLİR (409). Kimliksiz (eski) yedek yalnız bulunduğu
//   klasörün şirketine yüklenir. Önce hedefin "geri-yukleme-oncesi-<kod>" yedeği alınır.
//     · 002 ve sonrası: şirket örneği kapatılır, dosya değiştirilir, ilk istekte yeniden açılır (göçler koşar).
//     · 001 (ilk şirket): aynı veri tabanında ortak katman (kullanıcılar, roller, oturumlar, lisans, şirket yetkileri)
//       durduğundan çalışırken değiştirilemez; geri yükleme hazırlanır (data/geri-yukleme.json) ve sunucu yeniden
//       açılırken uygulanır. Ortak katman geri yüklenen dosyaya o anki hâliyle aktarılır: kullanıcılar, parolalar ve
//       lisans geri gitmez.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { BACKUP_META_TABLE, BACKUP_NAME, compareBackups, companyFolderName, createBackup, listBackups, parseBackupName, readBackupIdentity } from "./backup.mjs";
import { REGISTRY_COPY, ROOT_COMPANY_ID, readRegistryFile } from "./companies.mjs";
import { resolveDbPath } from "./db-path.mjs";
import { createStore, openDatabase } from "./db.mjs";
import { HttpError } from "./http.mjs";
import { LATEST_VERSION, runMigrations } from "./migrations.mjs";

export const RESTORE_MARKER = "geri-yukleme.json";
const RESTORE_STAGE_DIR = "geri-yukleme";
const UPDATE_LABEL = /^(?:guncelleme-oncesi|basarisiz-guncelleme)(?:-|$)/;
const HOLD_UPDATE_MS = 7 * 86_400_000;
// Ortak katman: geri yüklemede dosyadaki değil, o anki hâli kalır.
const COMMON_TABLES = ["users", "roles", "sessions"];
const COMMON_SETTINGS = "(key LIKE 'license.%' OR key LIKE 'meta.%' OR key LIKE 'auth.%' OR key LIKE 'company.%' OR key = 'backup.cloud' OR key = 'office.name')";

const identityOf = company => ({ id: company.id, code: company.code, name: company.name });
const labelOf = company => `${company.code} · ${company.name}`;
// Windows (NTFS) klasör adlarını yerel ayarsız büyük harfle karşılaştırır: "MAVI" = "Mavi", ama "İ" ≠ "i".
const sameDir = (a, b) => path.resolve(a).toUpperCase() === path.resolve(b).toUpperCase();
const dirKey = dir => path.resolve(dir).toUpperCase();
// "2026-10-03T09-15-00-000Z" (yedek adındaki zaman) ↔ ISO zaman.
const stampToIso = stamp => (stamp ? stamp.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "$1T$2:$3:$4.$5Z") : "");
const quoteSql = value => `'${String(value).replace(/'/g, "''")}'`;
const quoteName = value => `"${String(value).replace(/"/g, '""')}"`;

/** Kayıt defteri dosyasından şirketler (sunucu açık değilken: servis yöneticisi, "npm run backup"). */
export function companiesOnDisk({ dataDir, backupRoot }) {
  // v2.0.21: asıl liste okunamazsa ikinci kopya (sirketler.yedek.json); yalnız 001'e düşmez (yedek aracı ve servis
  // yöneticisi öbür şirketleri atlamasın).
  const companies = (readRegistryFile(path.join(dataDir, "sirketler.json")) || readRegistryFile(path.join(dataDir, REGISTRY_COPY)))?.companies || [];
  if (!companies.some(item => item.id === ROOT_COMPANY_ID)) companies.unshift({ id: ROOT_COMPANY_ID, code: "001", name: "Şirket 1", dir: "" });
  return companies.map(item => {
    const root = item.id === ROOT_COMPANY_ID || !item.dir;
    return {
      company: identityOf(item),
      root,
      dataDir: root ? dataDir : path.join(dataDir, item.dir),
      backupDir: path.join(backupRoot, item.backupFolder ? path.basename(String(item.backupFolder)) : companyFolderName(item)),
      legacyBackupDirs: [root ? backupRoot : path.join(backupRoot, `sirket-${path.basename(item.dir)}`)],
    };
  });
}

function readInstanceId(file) {
  let db;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    return db.prepare("SELECT value FROM settings WHERE key = 'meta.instanceId'").get()?.value || "";
  } catch {
    return "";
  } finally {
    try {
      db?.close();
    } catch {
      // zaten kapalı
    }
  }
}

/** Yedek dosyasını denetler: SQLite mi, DestekOfis veri tabanı mı, bu sürümden yeni mi? */
export function inspectBackup(file) {
  let db;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const check = db.prepare("PRAGMA quick_check").get();
    if (Object.values(check || {})[0] !== "ok") throw new HttpError(400, "Yedek dosyası bozuk görünüyor (bütünlük denetimi geçmedi); başka bir yedek seçin.");
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name));
    if (!tables.has("users") || !tables.has("settings")) throw new HttpError(400, "Bu dosya bir DestekOfis yedeği değil.");
    const version = db.prepare("PRAGMA user_version").get().user_version;
    if (version > LATEST_VERSION) throw new HttpError(409, "Bu yedek programın daha yeni bir sürümünde alınmış; önce programı güncelleyin, sonra geri yükleyin.");
    return { schemaVersion: version };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, `Yedek dosyası okunamadı: ${error.message}`);
  } finally {
    try {
      db?.close();
    } catch {
      // zaten kapalı
    }
  }
}

function columnsOf(db, schema, table) {
  return db.prepare(`PRAGMA ${schema}.table_info(${quoteName(table)})`).all().map(column => column.name);
}
const hasTable = (db, schema, table) => Boolean(db.prepare(`SELECT 1 AS found FROM ${schema}.sqlite_master WHERE type = 'table' AND name = ?`).get(table));

// Ortak katmanı (kullanıcılar, roller, oturumlar, lisans/şirket/kurtarma ayarları) `fromFile`'dan geri yüklenen dosyaya
// aktarır. İki taraf da aynı şemadadır (geri yüklenen dosya önce son sürüme göç ettirilir); yine de yalnız ortak kolonlar.
function transplantCommon(db, fromFile) {
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec(`ATTACH DATABASE ${quoteSql(fromFile)} AS live`);
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const table of COMMON_TABLES) {
        if (!hasTable(db, "main", table) || !hasTable(db, "live", table)) continue;
        const liveColumns = new Set(columnsOf(db, "live", table));
        const columns = columnsOf(db, "main", table).filter(name => liveColumns.has(name)).map(quoteName).join(", ");
        db.exec(`DELETE FROM main.${quoteName(table)}`);
        if (columns) db.exec(`INSERT INTO main.${quoteName(table)} (${columns}) SELECT ${columns} FROM live.${quoteName(table)}`);
      }
      if (hasTable(db, "main", "settings") && hasTable(db, "live", "settings")) {
        const liveColumns = new Set(columnsOf(db, "live", "settings"));
        const columns = columnsOf(db, "main", "settings").filter(name => liveColumns.has(name)).map(quoteName).join(", ");
        db.exec(`DELETE FROM main.settings WHERE ${COMMON_SETTINGS}`);
        db.exec(`INSERT INTO main.settings (${columns}) SELECT ${columns} FROM live.settings WHERE ${COMMON_SETTINGS}`);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.exec("DETACH DATABASE live");
    db.exec("PRAGMA foreign_keys = ON");
  }
}

/**
 * Geri yüklenecek dosyayı hedefin yanında hazırlar (<db>.geri-yukleme): kopya → bütünlük → son sürüme göç → yedek
 * kimliği tablosu kaldırılır → (001'de) ortak katman aktarılır → istemcilerin yenilenmesi için durum sayacı artırılır.
 * Hazırlık sırasında canlı dosyaya dokunulmaz; hata olursa hazırlık dosyası silinir.
 */
export function prepareRestoreFile({ source, dbPath, transplantFrom = null, clientStateFloor = 0, keepSettings = {}, log = null }) {
  const temp = `${dbPath}.geri-yukleme`;
  const clean = () => {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(`${temp}${suffix}`, { force: true });
  };
  clean();
  // Veri klasörü tamamen kaybolmuşsa (v2.0.21 arıza testi) geri yükleme onu yeniden kurar.
  mkdirSync(path.dirname(dbPath), { recursive: true });
  copyFileSync(source, temp);
  let db;
  try {
    db = openDatabase(temp);
    const check = db.prepare("PRAGMA quick_check").get();
    if (Object.values(check || {})[0] !== "ok") throw new Error("yedek dosyası bütünlük denetiminden geçmedi");
    runMigrations(createStore(db), { backupDir: null, log });
    db.exec(`DROP TABLE IF EXISTS ${BACKUP_META_TABLE}`);
    if (transplantFrom) transplantCommon(db, transplantFrom);
    // Şirketin o anki unvanı (office.name) korunur: yedek alındıktan sonra ad değiştiyse PDF/rapor başlığı eski ada dönmesin.
    for (const [key, value] of Object.entries(keepSettings || {})) {
      if (value === undefined || value === null || value === "") continue;
      db.prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, NULL) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(key, String(value), new Date().toISOString());
    }
    const current = Number(db.prepare("SELECT value FROM settings WHERE key = 'meta.clientStateVersion'").get()?.value || 0) || 0;
    const next = Math.max(current, Number(clientStateFloor) || 0) + 1;
    db.prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('meta.clientStateVersion', ?, ?, NULL) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(String(next), new Date().toISOString());
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db.close();
    db = null;
    for (const suffix of ["-wal", "-shm"]) rmSync(`${temp}${suffix}`, { force: true });
    return temp;
  } catch (error) {
    try {
      db?.close();
    } catch {
      // zaten kapalı
    }
    clean();
    throw error;
  }
}

/**
 * Hazırlanan dosyayı canlı dosyanın yerine koyar (veri tabanı bu anda hiçbir bağlantıda açık olmamalı).
 * Önce canlı dosyanın WAL günlüğü ana dosyaya işlenir (checkpoint); günlük ancak boşaldıktan sonra silinir. Böylece
 * yeniden adlandırma başarısız olsa (Windows'ta dosya başka programda açık) canlı veriden tek işlem bile kaybolmaz.
 */
export function swapInRestoredFile(temp, dbPath) {
  const wal = `${dbPath}-wal`;
  let pending = 0;
  try {
    pending = statSync(wal).size;
  } catch {
    pending = 0;
  }
  if (pending > 0 && existsSync(dbPath)) {
    const live = openDatabase(dbPath);
    try {
      const result = live.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
      if (result && Number(result.busy) !== 0) throw new Error("veri dosyası başka bir bağlantıda açık (günlük işlenemedi)");
    } finally {
      live.close();
    }
  }
  for (const suffix of ["-wal", "-shm"]) rmSync(`${dbPath}${suffix}`, { force: true });
  renameSync(temp, dbPath);
}

/**
 * Sunucu açılırken (veri tabanı açılmadan önce) bekleyen 001 geri yüklemesini uygular. Tek deneme: işaret dosyası önce
 * silinir; herhangi bir adım başarısız olursa canlı dosyaya dokunulmaz, sunucu mevcut veriyle açılır.
 */
export function applyStagedRestore({ dataDir, backupRoot, dbPath, keep = 30, log }) {
  const marker = path.join(dataDir, RESTORE_MARKER);
  if (!existsSync(marker)) return null;
  let job = null;
  try {
    job = JSON.parse(readFileSync(marker, "utf8"));
  } catch {
    job = null;
  }
  try {
    unlinkSync(marker);
  } catch {
    // silinemese de aşağıdaki denetimler tekrarı zararsız kılar
  }
  const name = path.basename(String(job?.source || ""));
  const stageDir = path.join(dataDir, RESTORE_STAGE_DIR);
  // Sunucu başka klasörlerle açıldıysa (taşınmış kurulum) hazırlanan kopya kendi veri klasöründe aranır.
  if (job?.source && !existsSync(job.source) && existsSync(path.join(stageDir, name))) job.source = path.join(stageDir, name);
  try {
    if (!job?.source || !BACKUP_NAME.test(name) || !existsSync(job.source)) throw new Error(`Geri yüklenecek yedek bulunamadı (${name || "—"}).`);
    const identity = readBackupIdentity(job.source);
    if (identity && identity.id !== ROOT_COMPANY_ID) throw new Error(`Yedek “${identity.code} · ${identity.name}” şirketine ait; ilk şirkete yüklenmedi.`);
    inspectBackup(job.source);
    // Güncellemenin deneme açılışında (canlı veri henüz yeni sürüme göç etmemişken) uygulanmaz: ortak katman eski
    // biçimde aktarılır ve deneme başarısız olursa geri dönüş geri yüklemeyi sessizce bozardı.
    if (existsSync(dbPath)) {
      const probe = new DatabaseSync(dbPath, { readOnly: true });
      let liveVersion = 0;
      try {
        liveVersion = probe.prepare("PRAGMA user_version").get().user_version;
      } finally {
        probe.close();
      }
      if (liveVersion !== LATEST_VERSION) throw new Error("Program o sırada güncelleniyordu; geri yükleme uygulanmadı. Güncelleme bittikten sonra Yönetim → Yedekler'den yeniden geri yükleyin.");
    }
    const target = companiesOnDisk({ dataDir, backupRoot }).find(item => item.company.id === ROOT_COMPANY_ID);
    let safety = null;
    if (existsSync(dbPath)) {
      const current = openDatabase(dbPath);
      try {
        safety = createBackup(current, target.backupDir, { label: `geri-yukleme-oncesi-${target.company.code}`, keep: Math.max(keep, 10), company: target.company });
        current.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      } finally {
        current.close();
      }
    }
    const temp = prepareRestoreFile({ source: job.source, dbPath, transplantFrom: safety?.path || null, log });
    swapInRestoredFile(temp, dbPath);
    log?.info?.(`Yedekten geri yüklendi: ${name} (önceki veri: ${safety?.name || "—"})`);
    return { ok: true, name, safety: safety?.name || "", by: job.by || "", byName: job.byName || "", at: new Date().toISOString() };
  } catch (error) {
    log?.error?.(`Yedekten geri yükleme yapılamadı (${name || "—"}); sunucu mevcut veriyle açılıyor`, error);
    return { ok: false, name, error: error.message, by: job?.by || "", byName: job?.byName || "" };
  } finally {
    // Yalnız programın hazırladığı kopya silinir (asıl yedek klasöründeki dosyaya dokunulmaz).
    if (job?.source && sameDir(path.dirname(String(job.source)), stageDir)) rmSync(stageDir, { recursive: true, force: true });
  }
}

/**
 * Şirket yedekleri servisi (yalnız ortak katmanda kurulur).
 *   registry  — şirket kayıt defteri (companies.mjs)
 *   withDb    — (şirket, fn) → fn(veri tabanı): açık örneğin bağlantısı ya da kısa süreli salt okunur bağlantı
 *   busy      — Map(şirket kimliği → mesaj): geri yüklenen/silinen şirket (o sırada açılmaz, otomatik yedek atlanır)
 *   closeCompany — şirket örneğini kapatır (geri yüklemede dosya değişmeden önce)
 */
export function createCompanyBackups({ registry, dataDir, keep = 30, log = null, withDb, busy = new Map(), closeCompany = async () => false }) {
  const isBusy = id => busy.has(id);
  const backupRoot = () => registry.dirsOf(registry.get(ROOT_COMPANY_ID) || { id: ROOT_COMPANY_ID, code: "001", name: "", dir: "" }).backupRoot;
  const folderOf = company => registry.dirsOf(company).backupDir;
  const dirsFor = company => {
    const dirs = registry.dirsOf(company);
    return [dirs.backupDir, ...dirs.legacyBackupDirs];
  };
  const accessible = user => registry.list().filter(company => registry.canAccess(user, company.id));

  // Kökteki (001'in eski yeri) kodlu dosya başka bir şirketinse 001'in listesine girmez. Eski yerdeki (sirket-<klasör>)
  // dosya şirketin kuruluşundan önceyse silinmiş, aynı klasörü kullanmış eski bir şirketindir: bu şirkete sayılmaz.
  const predates = (company, name) => {
    if (company.id === ROOT_COMPANY_ID || !company.createdAt) return false;
    const iso = stampToIso(parseBackupName(name)?.stamp || "");
    return Boolean(iso) && iso < company.createdAt;
  };
  const belongs = (company, dir, name) => {
    if (!sameDir(dir, folderOf(company)) && predates(company, name)) return false;
    if (!sameDir(dir, backupRoot())) return true;
    const code = parseBackupName(name)?.code;
    return !code || code === company.code;
  };

  function listFor(company) {
    const folder = folderOf(company);
    const seen = new Set();
    const out = [];
    for (const dir of dirsFor(company)) {
      const key = dirKey(dir);
      if (seen.has(key)) continue;
      seen.add(key);
      for (const item of listBackups(dir)) {
        if (!belongs(company, dir, item.name)) continue;
        out.push({ ...item, dir, legacy: !sameDir(dir, folder), companyId: company.id, companyCode: company.code, companyName: company.name, company: labelOf(company) });
      }
    }
    return out.sort(compareBackups);
  }
  const list = user => accessible(user).flatMap(listFor).sort(compareBackups);
  const latestFor = company => listFor(company)[0] || null;

  function backup(company, { label = "", keep: keepCount, stamp = "" } = {}) {
    return withDb(company, db => createBackup(db, folderOf(company), { label, keep: keepCount ?? keep, company: identityOf(company), stamp })) || null;
  }
  // Aynı turda alınan yedekler aynı zamanı taşır (Drive'da ve klasörlerde birlikte görünür).
  function backupMany(companies, { label = "" } = {}) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return companies.map(company => {
      try {
        const result = backup(company, { label, stamp });
        return result ? { ...result, companyId: company.id } : { companyId: company.id, company: identityOf(company), error: "Şirketin veri dosyası bulunamadı." };
      } catch (error) {
        log?.error?.(`Yedek alınamadı (${labelOf(company)})`, error);
        return { companyId: company.id, company: identityOf(company), error: error.message };
      }
    });
  }

  function find(company, name) {
    if (!BACKUP_NAME.test(String(name))) throw new HttpError(400, "Geçersiz yedek adı.");
    const folder = folderOf(company);
    for (const dir of dirsFor(company)) {
      const file = path.join(dir, name);
      if (path.dirname(file) !== path.resolve(dir) || !belongs(company, dir, name)) continue;
      try {
        if (statSync(file).isFile()) return { file, dir, legacy: !sameDir(dir, folder) };
      } catch {
        // bu klasörde yok
      }
    }
    return null;
  }

  // İndirme/geri yükleme için dosyayı bulur. Şirket verilmezse kullanıcının görebildiği bütün şirketlerde aranır.
  function locate(user, name, companyId = "") {
    if (!BACKUP_NAME.test(String(name))) throw new HttpError(400, "Geçersiz yedek adı.");
    if (companyId) {
      const company = registry.get(String(companyId));
      if (!company || !registry.canAccess(user, company.id)) throw new HttpError(404, "Şirket bulunamadı ya da bu şirketi görme yetkiniz yok.");
      const hit = find(company, name);
      if (!hit) throw new HttpError(404, "Yedek bulunamadı.");
      return { company, ...hit };
    }
    const hits = accessible(user)
      .map(company => {
        const hit = find(company, name);
        return hit ? { company, ...hit } : null;
      })
      .filter(Boolean);
    if (!hits.length) throw new HttpError(404, "Yedek bulunamadı.");
    if (hits.length === 1) return hits[0];
    const code = parseBackupName(name)?.code;
    const exact = hits.filter(hit => code && hit.company.code === code);
    if (exact.length === 1) return exact[0];
    throw new HttpError(409, "Bu adla birden çok şirkette yedek var; Yönetim → Yedekler'den şirketiyle birlikte seçin.");
  }

  /** Yanlış şirkete geri yüklemeyi reddeder (409). Kimliksiz eski yedek yalnız bulunduğu klasörün şirketine. */
  function assertRestorable({ file, source, target }) {
    const identity = readBackupIdentity(file);
    if (identity) {
      if (identity.id !== target.id) {
        throw new HttpError(409, `Bu yedek “${identity.code} · ${identity.name}” şirketine ait; “${labelOf(target)}” şirketine geri yüklenemez. Yedeği kendi şirketine geri yükleyin.`, { code: "company-mismatch", backupCompany: { id: identity.id, code: identity.code, name: identity.name } });
      }
    } else if (source.id !== target.id) {
      throw new HttpError(409, `Bu yedek eski biçimde (içinde şirket bilgisi yok); yalnız bulunduğu klasörün şirketine (${labelOf(source)}) geri yüklenebilir.`, { code: "company-unknown" });
    } else {
      // Kimliksiz (2.0.19 öncesi) yedek: veri tabanı soy kimliği (meta.instanceId) hedefinkiyle aynı olmalı; aynı kodla
      // sonradan açılmış başka bir şirkete eski şirketin verisi yüklenmesin.
      const backupInstance = readInstanceId(file);
      let liveInstance = "";
      try {
        liveInstance = withDb(target, db => db.prepare("SELECT value FROM settings WHERE key = 'meta.instanceId'").get()?.value || "") || "";
      } catch {
        liveInstance = "";
      }
      if (backupInstance && liveInstance && backupInstance !== liveInstance) {
        throw new HttpError(409, `Bu eski biçimli yedek “${labelOf(target)}” şirketinin veri tabanından alınmamış (aynı kodu kullanmış silinmiş bir şirketten kalmış olabilir); geri yüklenmedi.`, { code: "company-unknown" });
      }
    }
    return identity;
  }

  // ---------- Eski yerlerden yeni klasörlere taşıma (her açılışta; iş kalmayınca hiçbir şey yapmaz) ----------
  function moveInto(source, target, report) {
    const destination = path.join(target, path.basename(source));
    if (existsSync(destination)) {
      report.left += 1;
      return false;
    }
    try {
      mkdirSync(target, { recursive: true });
      renameSync(source, destination);
      report.moved += 1;
      return true;
    } catch (error) {
      report.left += 1;
      report.errors.push(`${path.basename(source)}: ${error.code || error.message}`);
      return false;
    }
  }
  function migrate({ now = Date.now() } = {}) {
    const report = { moved: 0, left: 0, held: 0, errors: [] };
    const root = backupRoot();
    const companies = registry.list();
    const byCode = new Map(companies.map(company => [company.code, company]));
    for (const company of companies) {
      const target = folderOf(company);
      for (const dir of registry.dirsOf(company).legacyBackupDirs) {
        if (sameDir(dir, target) || !existsSync(dir)) continue;
        const isRootDir = sameDir(dir, root);
        let names = [];
        try {
          names = readdirSync(dir);
        } catch {
          continue;
        }
        let leftHere = 0;
        for (const name of names) {
          const source = path.join(dir, name);
          if (!BACKUP_NAME.test(name)) {
            // Yedek olmayan dosyaya (ve köktekilere hiç) dokunulmaz.
            if (!isRootDir) leftHere += 1;
            continue;
          }
          let stats;
          try {
            stats = statSync(source);
          } catch {
            continue;
          }
          if (!stats.isFile()) {
            if (!isRootDir) leftHere += 1;
            continue;
          }
          const parsed = parseBackupName(name);
          if (!isRootDir && predates(company, name)) {
            leftHere += 1; // silinmiş eski şirketten kalma: yerinde kalır, bu şirkete taşınmaz
            continue;
          }
          let owner = company;
          if (isRootDir && parsed?.code && parsed.code !== company.code) {
            owner = byCode.get(parsed.code);
            if (!owner) continue; // tanınmayan kodlu dosya kökte kalır
          }
          if (isRootDir && UPDATE_LABEL.test(parsed?.label || "") && now - stats.mtimeMs < HOLD_UPDATE_MS) {
            report.held += 1; // eski servis yöneticisi geri dönüşte bu dosyayı kökte arar
            continue;
          }
          if (!moveInto(source, folderOf(owner), report)) leftHere += 1;
        }
        if (!isRootDir && !leftHere) {
          try {
            rmdirSync(dir);
          } catch {
            // boş değil ya da açık; kalır
          }
        }
      }
      // Yarım kalmış klasör taşımaları tamamlandıysa kayıttan düşülür.
      if (Array.isArray(company.oldBackupDirs) && company.oldBackupDirs.length) {
        const remaining = company.oldBackupDirs.filter(folder => {
          const dir = path.join(root, path.basename(String(folder)));
          return existsSync(dir) && !sameDir(dir, target) && listBackups(dir).length > 0;
        });
        if (remaining.length !== company.oldBackupDirs.length) registry.settleOldBackupDirs(company.id, remaining);
      }
    }
    if (report.moved) log?.info?.(`Yedekler şirket klasörlerine taşındı: ${report.moved} dosya${report.left ? ` (${report.left} dosya eski yerinde kaldı)` : ""}.`);
    if (report.errors.length) log?.warn?.(`Taşınamayan yedekler: ${report.errors.slice(0, 5).join("; ")}`);
    return report;
  }

  // Veri dosyasının son değişme zamanı (ana dosya ya da WAL günlüğü; hangisi yeniyse).
  function changedAt(company) {
    const file = resolveDbPath(registry.dirsOf(company).dataDir);
    let latest = 0;
    for (const item of [file, `${file}-wal`]) {
      try {
        latest = Math.max(latest, statSync(item).mtimeMs);
      } catch {
        // dosya yok
      }
    }
    return latest || Infinity;
  }
  // Otomatik yedek hedefleri: her şirket (geri yüklenen/silinen şirket o turda atlanır). Eski yerdeki taze güncelleme
  // yedekleri için taşıma günde bir yeniden denenir.
  let migratedAt = Date.now();
  function scheduleTargets() {
    if (Date.now() - migratedAt > 86_400_000) {
      migratedAt = Date.now();
      try {
        migrate();
      } catch (error) {
        log?.warn?.(`Yedek klasörü taşıması yapılamadı: ${error.message}`);
      }
    }
    return registry
      .list()
      .filter(company => !isBusy(company.id))
      .map(company => ({ backupDir: folderOf(company), label: labelOf(company), run: () => backup(company), changedAt: () => changedAt(company) }));
  }

  // Yönetim → Şirketler: veri dosyası, boyutu, cari/kayıt sayısı, son yedek ve yedek klasörü.
  function storage(company) {
    const dirs = registry.dirsOf(company);
    const dataFile = resolveDbPath(dirs.dataDir);
    let dataSize = 0;
    for (const file of [dataFile, `${dataFile}-wal`]) {
      try {
        dataSize += statSync(file).size;
      } catch {
        // dosya yok
      }
    }
    let counts = { accounts: null, records: null };
    if (!isBusy(company.id)) {
      try {
        counts =
          withDb(company, db => {
            const count = sql => {
              try {
                return db.prepare(sql).get().n;
              } catch {
                return null;
              }
            };
            return { accounts: count("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL"), records: count("SELECT COUNT(*) AS n FROM dataset_rows") };
          }) || counts;
      } catch {
        // sayılamadı; boş gösterilir
      }
    }
    const backups = listFor(company);
    const last = backups[0] || null;
    return {
      id: company.id,
      code: company.code,
      name: company.name,
      label: labelOf(company),
      root: Boolean(company.root),
      dataFile,
      dataExists: existsSync(dataFile),
      dataSize,
      accounts: counts.accounts,
      records: counts.records,
      backupFolder: dirs.backupDir,
      backupCount: backups.length,
      lastBackup: last ? { name: last.name, size: last.size, createdAt: last.createdAt } : null,
    };
  }

  function rawSafetyCopy(company, dbPath) {
    const dir = folderOf(company);
    mkdirSync(dir, { recursive: true });
    const name = `destekofis-${company.code}-${new Date().toISOString().replace(/[:.]/g, "-")}-geri-yukleme-oncesi-${company.code}-ham.sqlite`;
    const target = path.join(dir, name);
    copyFileSync(dbPath, target);
    if (existsSync(`${dbPath}-wal`)) copyFileSync(`${dbPath}-wal`, `${target}-wal`);
    return { name, path: target, size: statSync(target).size };
  }
  // 001 geri yüklemesi sunucu yeniden açılırken uygulanır. Seçilen yedek hemen veri klasörüne kopyalanır (aradaki
  // otomatik yedeklerin eski dosyaları budaması seçilen yedeği silemesin).
  const markerPath = () => path.join(dataDir, RESTORE_MARKER);
  function stageRootRestore(user, file) {
    const dir = path.join(dataDir, RESTORE_STAGE_DIR);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const copy = path.join(dir, path.basename(file));
    copyFileSync(file, copy);
    const job = { source: copy, name: path.basename(file), from: file, companyId: ROOT_COMPANY_ID, by: user?.id || "", byName: user?.display_name || user?.username || "", at: new Date().toISOString() };
    const tmp = `${markerPath()}.tmp`;
    writeFileSync(tmp, JSON.stringify(job, null, 2));
    renameSync(tmp, markerPath());
    return job;
  }
  function pendingRestore() {
    try {
      const job = JSON.parse(readFileSync(markerPath(), "utf8"));
      return job?.source ? { name: job.name || path.basename(job.source), byName: job.byName || "", at: job.at || "" } : null;
    } catch {
      return null;
    }
  }
  function cancelRestore() {
    const had = existsSync(markerPath());
    rmSync(markerPath(), { force: true });
    rmSync(path.join(dataDir, RESTORE_STAGE_DIR), { recursive: true, force: true });
    return had;
  }

  /**
   * Yedeği şirkete geri yükler (yetki, onay ve kimlik denetimi çağıranda: assertRestorable). 001 için hazırlar
   * ({ staged: true }; sunucu yeniden açılırken uygulanır); diğer şirketlerde hemen uygular ({ restored: true }).
   */
  async function restoreCompany({ file, target, user }) {
    if (isBusy(target.id)) throw new HttpError(409, busy.get(target.id) || "Bu şirkette başka bir işlem sürüyor; birkaç saniye sonra yeniden deneyin.");
    inspectBackup(file);
    if (target.id === ROOT_COMPANY_ID) {
      const job = stageRootRestore(user, file);
      log?.info?.(`Geri yükleme hazırlandı (${labelOf(target)}): ${job.name}; sunucu yeniden açılınca uygulanacak.`);
      return { staged: true, name: job.name };
    }
    busy.set(target.id, `“${labelOf(target)}” yedekten geri yükleniyor; birkaç saniye sonra yeniden deneyin.`);
    try {
      await closeCompany(target.id);
      const dbPath = resolveDbPath(registry.dirsOf(target).dataDir);
      let floor = 0;
      let officeName = "";
      try {
        [floor, officeName] = withDb(target, db => [Number(db.prepare("SELECT value FROM settings WHERE key = 'meta.clientStateVersion'").get()?.value) || 0, db.prepare("SELECT value FROM settings WHERE key = 'office.name'").get()?.value || ""]) || [0, ""];
      } catch {
        floor = 0;
      }
      let temp;
      try {
        temp = prepareRestoreFile({ source: file, dbPath, clientStateFloor: floor, keepSettings: { "office.name": officeName }, log });
      } catch (error) {
        throw new HttpError(500, `Yedek hazırlanamadı; şirketin verisi değişmedi (${error.message}).`);
      }
      // Önce şu anki veri yedeklenir (seçilen yedek zaten kopyalandı; budama onu silse de iş sürer).
      let safety = null;
      try {
        safety = existsSync(dbPath) ? backup(target, { label: `geri-yukleme-oncesi-${target.code}`, keep: Math.max(keep, 10) }) : null;
      } catch (error) {
        // Canlı dosya bozuksa (VACUUM okuyamaz) geri yükleme tam da gerektiği anda engellenmesin: dosya olduğu gibi
        // (ham) kopyalanır; WAL günlüğü de yanına.
        try {
          safety = rawSafetyCopy(target, dbPath);
          log?.warn?.(`Geri yükleme öncesi yedek VACUUM ile alınamadı (${error.message}); ham kopya alındı: ${safety.name}`);
        } catch (copyError) {
          rmSync(temp, { force: true });
          throw new HttpError(500, `Geri yükleme öncesi yedek alınamadı; şirketin verisi değişmedi (${error.message}; ham kopya: ${copyError.message}).`);
        }
      }
      try {
        swapInRestoredFile(temp, dbPath);
      } catch (error) {
        rmSync(temp, { force: true });
        throw new HttpError(500, `Veri dosyası değiştirilemedi; şirketin verisi değişmedi (${error.code || error.message}). Dosya başka bir programda açıksa kapatıp yeniden deneyin.`);
      }
      log?.info?.(`Yedekten geri yüklendi (${labelOf(target)}): ${path.basename(file)} (önceki veri: ${safety?.name || "—"})`);
      return { restored: true, name: path.basename(file), safety: safety?.name || "" };
    } finally {
      busy.delete(target.id);
    }
  }

  return { root: backupRoot, folderOf, listFor, list, latestFor, backup, backupMany, find, locate, assertRestorable, restoreCompany, migrate, scheduleTargets, storage, stageRootRestore, pendingRestore, cancelRestore, accessible };
}
