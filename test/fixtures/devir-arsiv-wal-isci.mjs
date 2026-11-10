// Test yardımcısı (2.5.0 D2 tur 3, test/devir-arsiv-wal-250.test.mjs) — AYRI SÜREÇ. Arşiv dosyasının yanında İŞLENMEMİŞ GÜNLÜK bırakır ve SIGKILL ile ölür
// (bağlantıyı kapatmadan; SQLite kapanışta günlüğü ana dosyaya işleyemez):
//   node devir-arsiv-wal-isci.mjs wal <dosya>      → WAL kipi, kendiliğinden işleme kapalı; bir ayar + bir Kasa satırı yazılır, KESİNLEŞİR, -wal'da kalır
//                                                    (D4'ün checkpoint'siz bıraktığı arşivin benzetimi: kayıt kesinleşmiş ama ana dosyada değil).
//   node devir-arsiv-wal-isci.mjs journal <dosya>  → geri alma günlüğü (DELETE) kipi, önbellek 1 sayfa; işlem SÜRERKEN (COMMIT yok) sayfalar ana dosyaya taşar
//                                                    → yanında SICAK -journal (yarıda kalmış yazım; salt okunur bağlantı geri alamaz).
// Yazılan satırın kimliği / işareti sabit: cash-d2t3-wal, ayar d2t3.wal = WAL-DAKI-KAYIT.
// Ölmeden önce standart çıktıya eşzamanlı "YAZILDI" yazılır (Windows'ta SIGKILL'in çıkış kodu / sinyali Linux'takiyle aynı görünmez; test bu işarete ve dosya
// durumuna bakar).
import { writeSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const [mode, file] = process.argv.slice(2);
const db = new DatabaseSync(file);
if (mode === "wal") {
  db.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0;");
  db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('d2t3.wal', 'WAL-DAKI-KAYIT', '2026-01-01T00:00:00Z')").run();
  db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-d2t3-wal', 'in', 777, '2025-06-01', 'WAL-daki Kasa satırı', 'cash', 'd2t3', '2026-01-01T00:00:00Z')").run();
} else if (mode === "journal") {
  db.exec("PRAGMA journal_mode = DELETE; PRAGMA cache_size = 1;");
  db.exec("BEGIN");
  for (let i = 0; i < 3000; i += 1) db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, '2026-01-01T00:00:00Z')").run(`d2t3.yarim.${i}`, "x".repeat(400));
} else {
  console.error(`bilinmeyen kip: ${mode}`);
  process.exit(2);
}
writeSync(1, "YAZILDI\n");
process.kill(process.pid, "SIGKILL");
