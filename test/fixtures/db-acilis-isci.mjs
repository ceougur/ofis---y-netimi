// Test yardımcısı (2.5.0, test/db-acilis-kilit-250.test.mjs) — AYRI SÜREÇ. Program açılmaz (yalnız veri tabanı; lisans servisine istek yok). Kipler:
//   yaz-kill <db> <satır>   → WAL'a denetim noktası olmadan yazar, işlem açıkken "HAZIR" yazar ve döner (ana süreç SIGKILL ile öldürür: kurtarılacak WAL kalır)
//   ac <db> <başlamaAnıMs>  → o ana kadar bekler (iki süreç aynı anda), openDatabase + bir yazma; sonucu JSON olarak stdout'a yazar
import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../../server/lib/db.mjs";

const [mode, file, arg] = process.argv.slice(2);
if (mode === "yaz-kill") {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0;");
  const insert = db.prepare("INSERT INTO t(v) VALUES (?)");
  db.exec("BEGIN");
  for (let i = 0; i < Number(arg); i++) insert.run(`satır ${i} ${"x".repeat(100)}`);
  db.exec("COMMIT");
  db.exec("BEGIN");
  insert.run("yarım işlem");
  process.stdout.write("HAZIR\n");
  for (;;) {
    // işlem açık; ana süreç öldürür
  }
} else if (mode === "ac") {
  while (Date.now() < Number(arg)) {
    // iki süreç aynı anda başlasın (meşgul bekleme; kısa)
  }
  const started = Date.now();
  try {
    const db = openDatabase(file);
    db.exec("INSERT INTO t(v) VALUES ('acilis')");
    db.close();
    process.stdout.write(JSON.stringify({ ok: true, ms: Date.now() - started }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, ms: Date.now() - started, errcode: error.errcode, message: error.message }));
  }
} else throw new Error(`kip: yaz-kill | ac (${mode})`);
