// Mali tablolar okuma ucu (2.5.0 Ç6-HESAP tur 1; docs/erp/C6-HESAP-TASARIM.md §8). JSON — ekranlar, PDF / Excel ve Rapor Merkezi kaydı Ç6-EKRAN'ın işi.
//   GET /api/workspace/financial-statements/income-statement?from=YYYY-MM-DD&to=YYYY-MM-DD   (ikisi de yoksa Bu Yıl; aynı mali yıl — çapraz yıl 400 gelir-tablosu-tek-yil)
//   GET /api/workspace/financial-statements/stock-valuation?date=YYYY-MM-DD                   (yoksa bugün)
// Yetki Ana Defter raporlarıyla AYNI: overview.view (Yönetici + Muhasebe; Personel / Avukat 403). Hesap rapor iş parçacığında (salt okunur bağlantı, tek okuma işlemi); veri tabanı yolu yoksa ya
// da açık bir işlemin içindeyse aynı ortak işlev iş parçacığısız. Veri değişmedikçe sonuç saklanır (bağlantının değişiklik sayaçları + bugün + kilit + parametreler; en çok 8).
import { Worker } from "node:worker_threads";
import { HttpError, ok, text } from "../lib/http.mjs";
import { systemClock } from "../lib/clock.mjs";
import { presetRange } from "../lib/finance-report.mjs";
import { incomeStatementOf, stockValuationOf } from "../lib/financial-statements.mjs";

const BASE = "/api/workspace/financial-statements";
const ENTRY = new URL("../lib/financial-statements-worker.mjs", import.meta.url);
const CACHE_SIZE = 8;

/** Rapor iş parçacığı: { dbPath, time, job } → veri (hata: HttpError aynı durum koduyla; beklenmeyen hata 500). */
export function runFinancialWorker(data, { timeoutMs = 10 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(ENTRY, { workerData: data, name: "destekofis-mali-tablolar" });
    worker.unref();
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
      worker.terminate().catch(() => {});
    };
    const timer = setTimeout(() => finish(new Error("mali tablo hesabı zamanında bitmedi")), timeoutMs);
    timer.unref?.();
    worker.once("message", message => {
      if (message?.ok) return finish(null, message.data);
      if (message && message.status && message.status < 500) return finish(new HttpError(message.status, message.message, { code: message.code }));
      return finish(Object.assign(new Error(message?.message || "mali tablo hesabı başarısız"), { stack: message?.stack || "" }));
    });
    worker.once("error", error => finish(error instanceof Error ? error : new Error(String(error))));
    worker.once("exit", code => finish(new Error(`mali tablo iş parçacığı kapandı (kod ${code})`)));
  });
}

export function registerFinancialStatementRoutes(router, { store, auth, ledger, period = null, config = {}, now = systemClock }) {
  const clock = typeof now === "function" ? now : systemClock;
  const today = () => period?.today?.() || clock.today?.() || clock().toISOString().slice(0, 10);
  const cache = new Map();
  const keyOf = job => {
    let counters = null;
    try {
      counters = store.changeCounters ? store.changeCounters() : null;
    } catch {
      counters = null;
    }
    return counters ? JSON.stringify([counters.version, counters.total, today(), period?.lockedUntil?.() || "", job]) : "";
  };
  const asHttp = error => (error instanceof HttpError ? error : error?.status && error.status < 500 ? new HttpError(error.status, error.message, { code: error.code }) : error);
  const inline = job => (job.kind === "valuation" ? stockValuationOf({ store, date: job.date }) : incomeStatementOf({ store, ledger: ledger(), from: job.from, to: job.to }));
  async function compute(job) {
    const key = keyOf(job);
    if (key && cache.has(key)) return cache.get(key);
    const dbPath = config?.dbPath || "";
    let data;
    try {
      data = dbPath && dbPath !== ":memory:" && !store.inTransaction ? await runFinancialWorker({ dbPath, time: clock().toISOString(), job }) : inline(job);
    } catch (error) {
      throw asHttp(error);
    }
    // Anahtar hesaptan ÖNCE alındı: hesap sürerken yazılan kayıt sonraki istekte yeni anahtar verir (bayat sonuç saklanmaz — anahtar yine eski sayaçlarla eşleşirse sonuç o ana aittir).
    if (key && key === keyOf(job)) {
      cache.set(key, data);
      while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
    }
    return data;
  }
  router.get(`${BASE}/income-statement`, async ({ req, res, url }) => {
    auth.requirePermission(req, "overview.view");
    let from = text(url.searchParams.get("from"));
    let to = text(url.searchParams.get("to"));
    if (!from && !to) ({ from, to } = presetRange("thisYear", today()));
    ok(res, await compute({ kind: "income", from, to }));
  });
  router.get(`${BASE}/stock-valuation`, async ({ req, res, url }) => {
    auth.requirePermission(req, "overview.view");
    const date = text(url.searchParams.get("date")) || today();
    ok(res, await compute({ kind: "valuation", date }));
  });
  return { compute, inline };
}
