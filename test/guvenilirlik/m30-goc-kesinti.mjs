// 2.4.4 madde 30 — göç sırasında kesinti / arıza (ders 20: ön koşul zorla oluşturulur). 2.4.4'ün GERÇEK göç koşucusu (runMigrations, göç öncesi
// yedek dahil) bir şirketin veri dosyasında çalışır; seçilen noktada süreç kendini SIGKILL ile öldürür (elektrik kesintisi / görev yöneticisi) ya da
// disk dolu hatası verilir. Ana adım (tools/m30-goc.mjs kesinti) ölen sürecin bıraktığı dosyayı denetler ve programı yeniden açar.
//   node test/guvenilirlik/m30-goc-kesinti.mjs <veri dosyası> <şirketin yedek klasörü> <şirket JSON> <nokta>
//   nokta: yedek-yazildi (VACUUM INTO bitti, ad değişmeden) · v31-icinde · v31-v32-arasi · v32-icinde · disk-dolu (VACUUM INTO yarım yazıp hata)
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createStore } from "../../server/lib/db.mjs";
import { MIGRATIONS, runMigrations } from "../../server/lib/migrations.mjs";

const [file, backupDir, companyJson, point] = process.argv.slice(2);
const db = new DatabaseSync(file);
db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 10000;");
const store = createStore(db);
const die = () => process.kill(process.pid, "SIGKILL");
const exec = db.exec.bind(db);
db.exec = sql => {
  const vacuum = /^\s*VACUUM INTO '(.+)'\s*$/s.exec(String(sql));
  if (vacuum && point === "disk-dolu") {
    writeFileSync(vacuum[1].replace(/''/g, "'"), Buffer.alloc(4096, 1)); // yarım yazılmış dosya
    throw Object.assign(new Error("database or disk is full"), { code: "ERR_SQLITE_ERROR", errcode: 13 });
  }
  const result = exec(sql);
  if (vacuum && point === "yedek-yazildi") die();
  return result;
};
const wrap = (version, before, after) => {
  const migration = MIGRATIONS.find(item => item.version === version);
  const original = migration.up;
  migration.up = (target, context) => {
    if (before) die();
    const result = original(target, context);
    if (after) die();
    return result;
  };
};
if (point === "v31-icinde") wrap(31, false, true);
if (point === "v31-v32-arasi") wrap(32, true, false);
if (point === "v32-icinde") wrap(32, false, true);
try {
  const result = runMigrations(store, { backupDir, company: JSON.parse(companyJson) });
  console.log(JSON.stringify({ point, finished: true, result: { from: result.from, to: result.to, applied: result.applied, backup: result.backup?.name || null } }));
  process.exitCode = 0;
} catch (error) {
  console.log(JSON.stringify({ point, finished: false, error: String(error.message || error) }));
  process.exitCode = 3;
} finally {
  try {
    db.close();
  } catch {
    // kapanmış
  }
}
