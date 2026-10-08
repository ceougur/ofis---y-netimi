// Göç ortasında kesinti (2.1.0 Aşama 2; arıza testi): v20 göçünü bir veri dosyasında başlatır ve göçün içinde, N'inci şema
// komutundan sonra süreci SIGKILL ile öldürür (elektrik kesintisi / görev yöneticisinden sonlandırma gibi). Ana test (banka-210-goc)
// ölen sürecin bıraktığı dosyayı ve göç öncesi yedeği denetler.
//   node test/guvenilirlik/goc-kesinti.mjs <veri dosyası> <yedek klasörü> <şirket kimliği JSON> <N>
import { DatabaseSync } from "node:sqlite";
import { createStore } from "../../server/lib/db.mjs";
import { MIGRATIONS, runMigrations } from "../../server/lib/migrations.mjs";

const [file, backupDir, companyJson, killAtText] = process.argv.slice(2);
const killAt = Number(killAtText) || 1;
const db = new DatabaseSync(file);
db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 10000;");
const store = createStore(db);
const v20 = MIGRATIONS.find(item => item.version === 20);
if (!v20) {
  console.error("v20 göçü yok");
  process.exit(3);
}
const original = v20.up;
v20.up = (target, context) => {
  let count = 0;
  const exec = target.exec;
  target.exec = sql => {
    const result = exec(sql);
    count += 1;
    if (count === killAt) process.kill(process.pid, "SIGKILL");
    return result;
  };
  try {
    return original(target, context);
  } finally {
    target.exec = exec;
  }
};
runMigrations(store, { backupDir, company: JSON.parse(companyJson) });
console.log("göç bitti (kesinti olmadı)");
