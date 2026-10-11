// Elle yedek alma: npm run backup (Başlat menüsü → DestekOfis → Yedek al da bunu çalıştırır).
// Sunucu çalışırken de güvenlidir; veritabanı salt okunur açılır ve VACUUM INTO ile tutarlı kopya alınır.
// v1.0.0'daki hata düzeltildi: proje kökü bir üst klasör olarak hesaplanıyordu.
// v2.0.20: BÜTÜN şirketler yedeklenir; her şirket kendi klasörüne (<yedek klasörü>/<kod> - <ad>/), adında şirket kodu ve
// içinde şirket kimliğiyle. Çıktı: her satırda bir yedek dosyasının tam yolu (ilk satır 001).
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBackup } from "../server/lib/backup.mjs";
import { companiesOnDisk } from "../server/lib/company-backups.mjs";
import { openDatabase } from "../server/lib/db.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.resolve(process.env.HUKUK_DATA_DIR || path.join(root, "data"));
const backupDir = path.resolve(process.env.HUKUK_BACKUP_DIR || path.join(root, "backups"));
const keep = Math.max(3, Number(process.env.HUKUK_BACKUP_KEEP || 30));

const rootDb = resolveDbPath(dataDir);
if (!existsSync(rootDb)) {
  console.error(`Veritabanı bulunamadı: ${rootDb}`);
  process.exit(1);
}
// SQLite genişletilmiş hata kodu → ad (yalnız teşhis için; ör. 3338 = SQLITE_IOERR_ACCESS). node:sqlite hatası `errcode` taşır.
const BASE_NAMES = { 5: "BUSY", 6: "LOCKED", 8: "READONLY", 10: "IOERR", 11: "CORRUPT", 13: "FULL", 14: "CANTOPEN", 26: "NOTADB" };
const IOERR_NAMES = ["", "READ", "SHORT_READ", "WRITE", "FSYNC", "DIR_FSYNC", "TRUNCATE", "FSTAT", "UNLOCK", "RDLOCK", "DELETE", "BLOCKED", "NOMEM", "ACCESS", "CHECKRESERVEDLOCK", "LOCK", "CLOSE", "DIR_CLOSE", "SHMOPEN", "SHMSIZE", "SHMLOCK", "SHMMAP", "SEEK", "DELETE_NOENT", "MMAP", "GETTEMPPATH", "CONVPATH", "VNODE", "AUTH", "BEGIN_ATOMIC", "COMMIT_ATOMIC", "ROLLBACK_ATOMIC", "DATA", "CORRUPTFS", "IN_PAGE"];
function sqliteCode(error) {
  const code = Number(error?.errcode);
  if (!Number.isInteger(code) || code <= 0) return error?.code ? `; ${error.code}` : "";
  const base = code & 0xff;
  const sub = code >> 8;
  const name = BASE_NAMES[base] ? `SQLITE_${BASE_NAMES[base]}${base === 10 && IOERR_NAMES[sub] ? `_${IOERR_NAMES[sub]}` : sub ? ` (alt kod ${sub})` : ""}` : `SQLite ${base}`;
  return `; SQLite ${code} ${name}`;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
let failed = 0;
for (const target of companiesOnDisk({ dataDir, backupRoot: backupDir })) {
  const file = resolveDbPath(target.dataDir);
  if (!existsSync(file)) continue;
  // v2.1.0 (CI 532, Windows: "yedek alınamadı (disk I/O error)", kök neden bilinmiyordu): hata iletisi hangi adımda düştüğünü
  // (veri tabanını açma / kopyalama / kapatma) ve SQLite'ın genişletilmiş hata kodunu da yazar; "disk I/O error" tek başına
  // onlarca farklı nedeni (erişim, kilit, paylaşımlı bellek, okuma…) kapsar. Kapatma hatası kopyalama hatasını ezmez.
  let step = "açma";
  let failure = null;
  let db = null;
  try {
    db = openDatabase(file, { readOnly: true });
    step = "kopyalama";
    const result = createBackup(db, target.backupDir, { label: "manuel", keep, company: target.company, stamp });
    console.log(result.path);
  } catch (error) {
    failure = { step, error };
  }
  if (db) {
    try {
      db.close();
    } catch (error) {
      failure ||= { step: "kapatma", error };
    }
  }
  if (failure) {
    failed += 1;
    console.error(`${target.company.code} · ${target.company.name}: yedek alınamadı (${failure.error.message}; adım: ${failure.step}${sqliteCode(failure.error)})`);
    if (target.root) process.exitCode = 1;
  }
}
if (failed && !process.exitCode) process.exitCode = 2;
