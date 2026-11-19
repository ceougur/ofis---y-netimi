// Mali tablolar iş parçacığı (2.5.0 Ç6-HESAP; docs/erp/C6-HESAP-TASARIM.md §8; çekirdek planı §8 "≤ 3 sn (worker), olay döngüsü ≤ 50 ms"). Hesap ana iş parçacığının dışında, SALT OKUNUR
// ayrı bağlantıyla ve TEK okuma işleminde (WAL anlık görüntüsü: hesap boyunca yazılan kayıtlar görünmez) koşar. Ana Defter servisi dondurma iş parçacığındaki kurulumun aynısıyla
// (lib/ledger-freeze-worker.mjs; yalnız book / build / snapshots okunur). Hesap lib/financial-statements.mjs'in ortak işlevidir — iş parçacığısız yolla AYNI kod. Hiçbir şey yazmaz.
import { parentPort, workerData } from "node:worker_threads";
import { createClock } from "./clock.mjs";
import { createStore, openDatabase } from "./db.mjs";
import { createPeriod } from "./period.mjs";
import { createRouter } from "./router.mjs";
import { incomeStatementOf, stockValuationOf } from "./financial-statements.mjs";
import { registerLedgerRoutes } from "../routes/ledger.mjs";

const { dbPath, time, job } = workerData || {};
let db = null;
let reply;
try {
  db = openDatabase(dbPath, { readOnly: true });
  const store = createStore(db);
  const now = createClock({ time, fixed: true });
  db.exec("BEGIN");
  try {
    if (job?.kind === "valuation") reply = { ok: true, data: stockValuationOf({ store, date: job.date }) };
    else {
      const ledger = registerLedgerRoutes(createRouter(), { store, now, auth: null, audit: () => {}, events: null, period: createPeriod({ store, now }), integrity: () => null, money: null, config: {} });
      reply = { ok: true, data: incomeStatementOf({ store, ledger, from: job?.from, to: job?.to }) };
    }
  } finally {
    db.exec("COMMIT");
  }
} catch (error) {
  reply = { ok: false, status: Number(error?.status) || 500, code: error?.code || "", message: error?.message || String(error), stack: error?.status ? "" : String(error?.stack || "") };
} finally {
  try {
    db?.close();
  } catch {
    // zaten kapalı
  }
}
parentPort.postMessage(reply);
