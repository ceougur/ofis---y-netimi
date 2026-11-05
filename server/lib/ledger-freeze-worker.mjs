// Donmuş defter iş parçacığı (2.5.0 Ç3; docs/erp/C3-DONDURMA-TASARIM.md §4; integrity-scan-worker deseni): şirket dosyasını SALT OKUNUR ayrı bir bağlantıyla açar, TEK okuma
// işleminde (WAL anlık görüntüsü) bekleyen koşunun kuralıyla bütün yevmiyeyi türetir, (from, through] satırlarını ve kilit izini hesaplar, bağlantıyı kapatır; satırları
// parça parça gönderir (ana iş parçacığı her parçayı yazınca "next" der). Hiçbir yazım yapmaz. run null → yalnız kilit izi (kilit geri çekilince).
import { parentPort, workerData } from "node:worker_threads";
import { createClock } from "./clock.mjs";
import { createStore, openDatabase } from "./db.mjs";
import { LEDGER_RULE_VERSION } from "./general-ledger.mjs";
import { LOCK_SQL_VERSION, lockDigestOf } from "./integrity.mjs";
import { RULE_249, buildRule249 } from "./ledger-rule-249/index.mjs";
import { snapshotRowsOf } from "./ledger-snapshots.mjs";
import { createPeriod } from "./period.mjs";
import { createRouter } from "./router.mjs";
import { registerLedgerRoutes } from "../routes/ledger.mjs";

const { dbPath, time, batchLines, run, lock } = workerData || {};
const started = performance.now();
let rows = [];
let totals = null;
let digest = "";
let db = null;
try {
  db = openDatabase(dbPath, { readOnly: true });
  const store = createStore(db);
  db.exec("BEGIN");
  try {
    if (run) {
      // Koşu anlık görüntüde hâlâ en son bekleyen koşu mu (kilit bu arada değiştiyse ana iş parçacığı zaten durdurur).
      const row = store.get("SELECT no, state, from_date AS fromDate, through, rule_version AS rule FROM ledger_snapshot_runs WHERE no = (SELECT MAX(no) FROM ledger_snapshot_runs)");
      if (!row || row.no !== run.no || row.state !== "pending" || row.through !== run.through || row.fromDate !== run.from || row.rule !== run.rule) throw new Error("koşu artık bekleyen son koşu değil");
      let entries;
      if (run.rule === RULE_249) entries = buildRule249(store);
      else if (run.rule === LEDGER_RULE_VERSION) {
        const now = createClock({ time, fixed: true });
        const ledger = registerLedgerRoutes(createRouter(), { store, now, auth: null, audit: () => {}, events: null, period: createPeriod({ store, now }), integrity: () => null, money: null, config: {} });
        entries = ledger.build();
      } else throw new Error(`${run.rule} kuralı programda yok`);
      ({ rows, totals } = snapshotRowsOf(entries, { from: run.from, through: run.through }));
      digest = lockDigestOf(store, run.through, { version: LOCK_SQL_VERSION });
    } else digest = lock ? lockDigestOf(store, lock, { version: LOCK_SQL_VERSION }) : "";
  } finally {
    db.exec("COMMIT");
  }
  db.close();
  db = null;
  const size = Math.max(1, Number(batchLines) || 2000);
  let at = 0;
  const send = () => {
    if (at >= rows.length) {
      parentPort.postMessage({ type: "done", ...(totals || {}), digest, ms: Math.round(performance.now() - started) });
      parentPort.close();
      return;
    }
    const part = rows.slice(at, at + size);
    at += size;
    parentPort.postMessage({ type: "batch", rows: part });
  };
  parentPort.on("message", message => {
    if (message?.type === "next") send();
  });
  send();
} catch (error) {
  parentPort.postMessage({ type: "error", error: error?.message || String(error) });
  try {
    db?.close();
  } catch {
    // zaten kapalı
  }
}
