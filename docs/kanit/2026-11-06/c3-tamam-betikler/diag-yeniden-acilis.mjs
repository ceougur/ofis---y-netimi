// Teşhis (Ç3 tamamlama): çökmüş dondurmanın bıraktığı dosyayı (kilit + bekleyen koşu) programın açılış adımlarıyla (repairOnOpen → runPending; app.mjs:538/546) yeniden açar.
// Ana iş parçacığının yığını her saniye stderr'e yazılır (çökmeden önce görünür); iş parçacığı olayları da. Kullanım: node diag-yeniden-acilis.mjs <ağaç> <dosya.sqlite>
import { writeSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, file] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { createStore, openDatabase } = await imp("server/lib/db.mjs");
const { createClock } = await imp("server/lib/clock.mjs");
const { createPeriod } = await imp("server/lib/period.mjs");
const { createRouter } = await imp("server/lib/router.mjs");
const { registerLedgerRoutes } = await imp("server/routes/ledger.mjs");
const t0 = performance.now();
const log = text => writeSync(2, `[${Math.round(performance.now() - t0)} ms] ${text} · ana iş parçacığı yığını ${Math.round(process.memoryUsage().heapUsed / 1048576)} MB · RSS ${Math.round(process.memoryUsage().rss / 1048576)} MB\n`);
const db = openDatabase(file);
const store = createStore(db);
const now = createClock({ time: "2026-10-08T12:00:00+03:00", fixed: true });
const period = createPeriod({ store, now });
const ledger = registerLedgerRoutes(createRouter(), { store, now, auth: null, audit: () => {}, events: { publish: (type, data) => log(`olay ${type} ${JSON.stringify(data)}`) }, period, integrity: () => null, money: null, config: { dbPath: file }, log: { info: m => log(`bilgi: ${m}`), warn: m => log(`uyarı: ${m}`) } });
const S = ledger.snapshots;
log(`kilit ${period.lockedUntil()} · durum ${JSON.stringify(S.state())}`);
log(`açılış onarımı: ${JSON.stringify(S.repairOnOpen())}`);
const timer = setInterval(() => log("izleme"), 1000);
const status = await S.runPending();
clearInterval(timer);
log(`runPending bitti: ${JSON.stringify(status)} · durum ${JSON.stringify(S.state())}`);
await S.close();
db.close();
