// Elle yedek alma: npm run backup
// Sunucu çalışırken de güvenlidir; veritabanı salt okunur açılır ve VACUUM INTO ile tutarlı kopya alınır.
// v1.0.0'daki hata düzeltildi: proje kökü bir üst klasör olarak hesaplanıyordu.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBackup } from "../server/lib/backup.mjs";
import { openDatabase } from "../server/lib/db.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.resolve(process.env.HUKUK_DATA_DIR || path.join(root, "data"));
const backupDir = path.resolve(process.env.HUKUK_BACKUP_DIR || path.join(root, "backups"));
const keep = Math.max(3, Number(process.env.HUKUK_BACKUP_KEEP || 30));
const dbPath = resolveDbPath(dataDir);

if (!existsSync(dbPath)) {
  console.error(`Veritabanı bulunamadı: ${dbPath}`);
  process.exit(1);
}
const db = openDatabase(dbPath, { readOnly: true });
try {
  const result = createBackup(db, backupDir, { label: "manuel", keep });
  console.log(result.path);
} finally {
  db.close();
}
