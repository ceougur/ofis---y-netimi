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
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
let failed = 0;
for (const target of companiesOnDisk({ dataDir, backupRoot: backupDir })) {
  const file = resolveDbPath(target.dataDir);
  if (!existsSync(file)) continue;
  try {
    const db = openDatabase(file, { readOnly: true });
    try {
      const result = createBackup(db, target.backupDir, { label: "manuel", keep, company: target.company, stamp });
      console.log(result.path);
    } finally {
      db.close();
    }
  } catch (error) {
    failed += 1;
    console.error(`${target.company.code} · ${target.company.name}: yedek alınamadı (${error.message})`);
    if (target.root) process.exitCode = 1;
  }
}
if (failed && !process.exitCode) process.exitCode = 2;
