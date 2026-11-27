// Teşhis: türetmenin sıkı satırlı (lean) ve store.all'lı hâli — aynı çıktı mı (sha256), süre, yığın, tepe RSS. node --expose-gc diag-esdeger.mjs <ağaç> <dosya> <2.5.0|2.4.9> <lean|all>
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, file, rule, mode] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { createStore, openDatabase } = await imp("server/lib/db.mjs");
const { createClock } = await imp("server/lib/clock.mjs");
const { createPeriod } = await imp("server/lib/period.mjs");
const { createRouter } = await imp("server/lib/router.mjs");
const { registerLedgerRoutes } = await imp("server/routes/ledger.mjs");
const { buildRule249 } = await imp("server/lib/ledger-rule-249/index.mjs");
const { leanStore } = await imp("server/lib/lean-rows.mjs");
import { readFileSync } from "node:fs";
const hwm = () => Number((readFileSync("/proc/self/status", "utf8").match(/VmHWM:\s+(\d+)/) || [])[1] || 0) / 1024;

const db = openDatabase(file, { readOnly: true });
const base = createStore(db);
// mode all: depo "db"siz görünür → lib/lean-rows.mjs store.all'a düşer (eski okuma).
const store = mode === "all" ? Object.create(base, { db: { value: undefined } }) : base;
db.exec("BEGIN");
const t0 = performance.now();
let entries;
if (rule === "2.4.9") entries = buildRule249(mode === "all" ? store : leanStore(store));
else {
  const now = createClock({ time: "2026-10-08T12:00:00+03:00", fixed: true });
  entries = registerLedgerRoutes(createRouter(), { store, now, auth: null, audit: () => {}, events: null, period: createPeriod({ store: base, now }), integrity: () => null, money: null, config: {} }).build();
}
const ms = Math.round(performance.now() - t0);
db.exec("COMMIT");
const peakRss = Math.round(hwm());
globalThis.gc?.();
const heap = Math.round(process.memoryUsage().heapUsed / 1048576);
const hash = createHash("sha256");
for (const entry of entries) hash.update(JSON.stringify(entry)).update("\n");

console.log(JSON.stringify({ rule, mode, entries: entries.length, ms, heapAfterMb: heap, peakRssMb: peakRss, sha256: hash.digest("hex") }));
db.close();
