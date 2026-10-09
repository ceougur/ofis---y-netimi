// Mutabakat taraması iş parçacığı (v2.1.0, gözden geçirme B7): tam tarama (lib/integrity.mjs run) ana iş parçacığının dışında, SALT OKUNUR
// ayrı bir bağlantıyla ve TEK okuma işleminde (WAL anlık görüntüsü: tarama boyunca yazılan kayıtlar görünmez, bölümler aynı anı okur) koşar.
// Defter servisleri (taksit, cari, stok, Ana Defter, tek kaynak, dönem) ana sunucudaki kurulumun aynısıyla kurulur; yönlendirici yalnız
// kayıt içindir (istek almaz). Hiçbir yazım yapmaz (bağlantı salt okunur): günlük ve zil ana iş parçacığında (settleScan).
import { parentPort, workerData } from "node:worker_threads";
import { createClock } from "./clock.mjs";
import { createStore, openDatabase } from "./db.mjs";
import { createIntegrity, lockDigestOf } from "./integrity.mjs";
import { createMoneyLines } from "./bank/money-lines.mjs";
import { createPeriod } from "./period.mjs";
import { createRouter } from "./router.mjs";
import { registerAccountRoutes } from "../routes/accounts.mjs";
import { registerLedgerRoutes } from "../routes/ledger.mjs";
import { registerPlanRoutes } from "../routes/plans.mjs";
import { registerStockRoutes } from "../routes/stock.mjs";

const { dbPath, time, legacy, partyRows } = workerData || {};
const started = performance.now();
let db = null;
try {
  db = openDatabase(dbPath, { readOnly: true });
  const store = createStore(db);
  const now = createClock({ time, fixed: true });
  const router = createRouter();
  const services = {};
  const context = { store, now, audit: () => {}, events: null, trash: null, auth: null, bank: null, config: {} };
  services.period = createPeriod({ store, now });
  services.money = createMoneyLines(store);
  services.plans = registerPlanRoutes(router, { ...context, period: services.period, accounts: () => services.accounts, cheques: () => null, invoices: () => null });
  services.accounts = registerAccountRoutes(router, { ...context, period: services.period, plans: () => services.plans, cheques: () => null });
  services.stock = registerStockRoutes(router, { ...context, period: services.period, accounts: () => services.accounts, plans: () => services.plans });
  services.ledger = registerLedgerRoutes(router, { ...context, period: services.period, accounts: () => services.accounts, integrity: () => null, money: services.money });
  const integrity = createIntegrity({ store, ledger: () => services.ledger, accounts: () => services.accounts, stock: () => services.stock, plans: () => services.plans, period: () => services.period, money: () => services.money, partyRows, now });
  integrity.importLegacy(legacy || {});
  db.exec("BEGIN");
  let result;
  let lock = "";
  let digest = "";
  try {
    result = integrity.run();
    lock = services.period.lockedUntil() || "";
    digest = lock ? lockDigestOf(store, lock) : "";
  } finally {
    db.exec("COMMIT");
  }
  parentPort.postMessage({ ok: true, result, lock, digest, ms: Math.round(performance.now() - started) });
} catch (error) {
  parentPort.postMessage({ ok: false, error: error?.message || String(error) });
} finally {
  try {
    db?.close();
  } catch {
    // zaten kapalı
  }
}
