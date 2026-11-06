// Teşhis (Ç3 tamamlama): dondurma iş parçacığının yaptığı türetmeyi (ledger.build() ya da buildRule249) ana iş parçacığında, salt okunur bağlantıyla koşar; her store.all()'dan
// önce ve sonra yığın kullanımı stderr'e (writeSync: çökmeden önce görünür). Kullanım: node diag-turetme.mjs <ağaç> <dosya.sqlite> <2.5.0|2.4.9> [--satirlar]
import { writeSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, file, rule = "2.5.0"] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { createStore, openDatabase } = await imp("server/lib/db.mjs");
const { createClock } = await imp("server/lib/clock.mjs");
const { createPeriod } = await imp("server/lib/period.mjs");
const { createRouter } = await imp("server/lib/router.mjs");
const { registerLedgerRoutes } = await imp("server/routes/ledger.mjs");
const { buildRule249 } = await imp("server/lib/ledger-rule-249/index.mjs");
const { snapshotRowsOf } = await imp("server/lib/ledger-snapshots.mjs");
const mb = () => Math.round(process.memoryUsage().heapUsed / 1048576);
const rss = () => Math.round(process.memoryUsage().rss / 1048576);
const t0 = performance.now();
const log = text => writeSync(2, `[${Math.round(performance.now() - t0)} ms] ${text} · yığın ${mb()} MB · RSS ${rss()} MB\n`);
const db = openDatabase(file, { readOnly: true });
const store = createStore(db);
const original = store.all;
store.all = (sql, ...args) => {
  const head = String(sql).replace(/\s+/g, " ").slice(0, 90);
  const where = (new Error().stack.split("\n")[2] || "").trim();
  log(`> all ${head} (${where})`);
  const out = original(sql, ...args);
  log(`< ${out.length} satır`);
  return out;
};
db.exec("BEGIN");
let entries;
if (rule === "2.4.9") entries = buildRule249(store);
else {
  const now = createClock({ time: "2026-10-08T12:00:00+03:00", fixed: true });
  const ledger = registerLedgerRoutes(createRouter(), { store, now, auth: null, audit: () => {}, events: null, period: createPeriod({ store, now }), integrity: () => null, money: null, config: {} });
  entries = ledger.build();
}
log(`türetme bitti: ${entries.length} madde`);
if (process.argv.includes("--satirlar")) {
  const { rows } = snapshotRowsOf(entries, { from: "", through: "2025-12-31" });
  log(`donmuş satırlar: ${rows.length}`);
}
db.exec("COMMIT");
db.close();
