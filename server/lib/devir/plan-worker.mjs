// 2.5.1 D3 — devir ön izlemesinin İŞ PARÇACIĞI (docs/devir/D3-D4-TASARIM.md §3.9). Salt okunur ayrı bağlantı, TEK okuma işlemi (BEGIN … COMMIT: WAL anlık görüntüsü — hesap
// boyunca yazılan kayıt görünmez); hizmetler iş parçacığında lib/financial-statements-worker.mjs'in Bilanço kurulumunun aynısıyla kurulur (router + dönem + tek kaynak + taksit + cari +
// Ana Defter; yalnız okuma). Akış: okuyucu → plan → ön denetim → rapor satırları; ilerleme iletileri { type: "progress", asama }. HİÇBİR ŞEY YAZMAZ. Ana iş parçacığı yalnız işi başlatır,
// ilerlemeyi iletir, sonucu tutar (routes/devir.mjs). runPreview iş parçacığısız yolun da (bellekteki veri tabanı / açık işlem) AYNI işlevidir.
import { isMainThread, parentPort, workerData } from "node:worker_threads";
import { createClock } from "../clock.mjs";
import { createStore, openDatabase } from "../db.mjs";
import { createPeriod } from "../period.mjs";
import { createRouter } from "../router.mjs";
import { createMoneyLines } from "../bank/money-lines.mjs";
import { registerAccountRoutes } from "../../routes/accounts.mjs";
import { registerLedgerRoutes } from "../../routes/ledger.mjs";
import { registerPlanRoutes } from "../../routes/plans.mjs";
import { readDevirFacts } from "./plan-reader.mjs";
import { buildDevirPlan, checkCutoff } from "./plan.mjs";
import { devirPreflight } from "./preflight.mjs";
import { devirReport } from "./report.mjs";

/** İş parçacığında (ya da iş parçacığısız yolda) Ana Defter servisinin salt okuma kurulumu. */
export function readOnlyServices({ store, time }) {
  const now = createClock({ time, fixed: true });
  const router = createRouter();
  const context = { store, now, audit: () => {}, events: null, trash: null, auth: null, bank: null, config: {} };
  const services = {};
  services.period = createPeriod({ store, now });
  services.money = createMoneyLines(store);
  services.plans = registerPlanRoutes(router, { ...context, period: services.period, accounts: () => services.accounts, cheques: () => null, invoices: () => null });
  services.accounts = registerAccountRoutes(router, { ...context, period: services.period, plans: () => services.plans, cheques: () => null });
  const ledger = registerLedgerRoutes(router, { ...context, period: services.period, accounts: () => services.accounts, integrity: () => null, money: services.money });
  return { ledger, accounts: services.accounts, period: services.period };
}

/**
 * Ön izlemenin bütün hesabı (okuma işleminin İÇİNDE çağrılır). job: { K, today, option, company: { id, code, name, label }, isRoot }; services: readOnlyServices() ya da şirket örneğinin
 * kendi hizmetleri (iş parçacığısız yol). progress: (aşama) → void. Dönüş: { plan, onDenetim, rapor, zamanlama } (yalnız JSON — iletiyle taşınır).
 */
export function runPreview({ store, ledger, accountList = null, job, progress = () => {} }) {
  checkCutoff(job.K, job.today);
  const started = performance.now();
  progress("okuma");
  const facts = readDevirFacts({ store, ledger, K: job.K, today: job.today, company: job.company || null, accountList, archives: job.arsivler || [] });
  progress("plan");
  let start = performance.now();
  const plan = buildDevirPlan(facts, { option: job.option || "borc-alacak" });
  const planMs = Math.round((performance.now() - start) * 10) / 10;
  progress("on-denetim");
  const onDenetim = devirPreflight(facts.preflight, plan, { isRoot: Boolean(job.isRoot), today: job.today, names: new Map((facts.parties || []).map(row => [row.id, row.name])) });
  progress("rapor");
  start = performance.now();
  const rapor = devirReport(plan, onDenetim, { companyLabel: job.company?.label || "", preparedBy: job.hazirlayan || "", preparedAt: job.hazirlanma || "" });
  const raporMs = Math.round((performance.now() - start) * 10) / 10;
  const zamanlama = { ...facts.timings, plan: planMs, rapor: raporMs, toplam: Math.round((performance.now() - started) * 10) / 10 };
  return { plan, onDenetim, rapor, zamanlama };
}

if (!isMainThread && workerData?.devirPreview) {
  const { dbPath, time, job } = workerData;
  let db = null;
  let reply;
  try {
    db = openDatabase(dbPath, { readOnly: true });
    const store = createStore(db);
    const { ledger } = readOnlyServices({ store, time });
    db.exec("BEGIN");
    try {
      // Sonuç iş parçacığında JSON'a çevrilir (ana iş parçacığı büyük nesneyi ne kopyalar ne yeniden çevirir — olay döngüsü ≤ 50 ms; ders 47). Rapor satırları PDF / Excel için ayrıca.
      const data = runPreview({ store, ledger, job, progress: asama => parentPort.postMessage({ type: "progress", asama }) });
      reply = { type: "result", ok: true, json: JSON.stringify(data), raporJson: JSON.stringify(data.rapor) };
    } finally {
      db.exec("COMMIT");
    }
  } catch (error) {
    reply = { type: "result", ok: false, status: Number(error?.status) || 500, code: error?.code || "", message: error?.message || String(error), stack: error?.status ? "" : String(error?.stack || "") };
  } finally {
    try {
      db?.close();
    } catch {
      // zaten kapalı
    }
  }
  parentPort.postMessage(reply);
}
