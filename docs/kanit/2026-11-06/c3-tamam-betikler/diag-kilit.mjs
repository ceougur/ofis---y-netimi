// Teşhis: 1.000.000 satırda kilit işleminin (period.setLock + lockChanged, tek işlem) ana iş parçacığındaki süresi — adım adım. node diag-kilit.mjs <ağaç> <veri klasörü> <iş klasörü>
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, veri, base] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { createStore, openDatabase } = await imp("server/lib/db.mjs");
const { createClock } = await imp("server/lib/clock.mjs");
const { createPeriod } = await imp("server/lib/period.mjs");
const { createRouter } = await imp("server/lib/router.mjs");
const { registerLedgerRoutes } = await imp("server/routes/ledger.mjs");
const work = mkdtempSync(path.join(base, "kilit-"));
const file = path.join(work, "destekofis.sqlite");
try {
  copyFileSync(path.join(veri, "data", "destekofis.sqlite"), file);
  const db = openDatabase(file);
  const store = createStore(db);
  const now = createClock({ time: "2026-10-08T12:00:00+03:00", fixed: true });
  const period = createPeriod({ store, now });
  const ledger = registerLedgerRoutes(createRouter(), { store, now, auth: null, audit: () => {}, events: null, period, integrity: () => null, money: null, config: { dbPath: file } });
  const S = ledger.snapshots;
  const t = (label, fn) => {
    const s = performance.now();
    const value = fn();
    console.log(`${label}: ${Math.round(performance.now() - s)} ms`);
    return value;
  };
  t("ilk okuma (şema)", () => store.get("SELECT COUNT(*) AS n FROM ledger_snapshot_runs"));
  t("coverage", () => S.coverage());
  t("state", () => S.state());
  t("boş işlem", () => store.tx(() => store.get("SELECT 1 AS x")));
  t("setLock işlemi", () => store.tx(() => period.setLock("2025-06-30")));
  t("setLock işlemi (2.)", () => store.tx(() => period.setLock("2025-07-31")));
  t("lockChanged işlemi", () => store.tx(() => S.lockChanged({ next: "2025-07-31", user: null, reason: "lock" })));
  t("lockChanged işlemi (2., başka gün)", () => store.tx(() => { period.setLock("2025-08-31"); return S.lockChanged({ next: "2025-08-31", user: null, reason: "lock" }); }));
  t("stillPending", () => S.state());
  db.close();
} finally {
  rmSync(work, { recursive: true, force: true });
}
