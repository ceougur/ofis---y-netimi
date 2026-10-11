// Rapor iş parçacığının SINAMA girişi (yalnız testler; config.reportWorkerEntry / createReportRunner({ entry })). Gerçek iş parçacığını
// (server/lib/report-worker.mjs) bir ön koşulla çalıştırır — kapanış, zaman aşımı ve hata yolları gerçek sunucuda ZORLA üretilsin (ders 20):
//   bekle:<ms>   → <ms> bekler (sonlandırılabilir), sonra gerçek raporu hazırlar: rapor sürerken şirket kapatma/sunucu kapanışı.
//   bozuk        → veri dosyası yolunu olmayan bir dosyaya çevirir, sonra gerçek iş parçacığı: SQLite'ın beklenmeyen hatası (HttpError değil).
//   sql:<n>      → sonlandırılamayan uzun bir SQLite sorgusu (WITH RECURSIVE, n satır; terminate sorgu bitene kadar etkisiz — inceleme E2),
//                  workerData.file verilirse o dosyada (açık tanıtıcı denetimi); sonra { ok: true } döner.
// Kip: workerData.sinama (doğrudan runner testleri) ya da DESTEKOFIS_TEST_RAPOR ortam değişkeni (sunucu üzerinden; iş parçacığı açılırken
// ana sürecin ortamını kopyalar). workerData.sayac (SharedArrayBuffer) verilirse [0] başlayan iş parçacığı sayısını tutar.
import { workerData, parentPort } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";

const mode = String(workerData?.sinama || process.env.DESTEKOFIS_TEST_RAPOR || "");
if (workerData?.sayac) Atomics.add(new Int32Array(workerData.sayac), 0, 1);
const [kind, arg] = mode.split(":");
if (kind === "sql") {
  const db = new DatabaseSync(workerData?.file || ":memory:");
  const row = db.prepare(`WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < ${Math.trunc(Number(arg) || 1e7)}) SELECT count(*) AS n FROM c`).get();
  db.close();
  parentPort.postMessage({ ok: true, data: { n: row.n } });
} else {
  if (kind === "bekle") await new Promise(resolve => setTimeout(resolve, Number(arg) || 1000));
  if (kind === "bozuk") workerData.dbPath = `${workerData.dbPath}.yok/olmayan.sqlite`;
  await import("../../server/lib/report-worker.mjs");
}
