// Büyük raporları ayrı iş parçacığında hazırlar (11.10.2026 hız düzeltmesi; lib/report-worker.mjs). Her rapor kendi iş parçacığını açar ve
// bitince kapatır (kalıcı bağlantı tutmaz; şirket geri yüklemesi/silmesi dosyayı serbest bulur). Aynı anda en çok `max` iş parçacığı; fazlası
// sırada bekler (ana iş parçacığı beklemez, öbür isteklere yanıt verir). Zaman aşımında iş parçacığı sonlandırılır, istek 503 alır. Raporun
// hatası (400 süzgeç, 404 hesap…) aynı durum koduyla ve metinle döner.
import { Worker } from "node:worker_threads";
import { HttpError } from "./http.mjs";

const ENTRY = new URL("./report-worker.mjs", import.meta.url);

export function createReportRunner({ max = 2, timeoutMs = 5 * 60_000 } = {}) {
  let active = 0;
  let started = 0;
  let closed = false;
  const queue = [];
  const workers = new Set();
  const next = () => {
    while (!closed && active < max && queue.length) {
      active += 1;
      started += 1;
      start(queue.shift());
    }
  };
  function start({ data, resolve, reject }) {
    let settled = false;
    const worker = new Worker(ENTRY, { workerData: data, name: "destekofis-rapor" });
    worker.unref();
    workers.add(worker);
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      workers.delete(worker);
      active -= 1;
      if (error) reject(error);
      else resolve(value);
      worker.terminate().catch(() => {});
      next();
    };
    const timer = setTimeout(() => finish(new HttpError(503, "Rapor zamanında hazırlanamadı; biraz sonra yeniden deneyin.", { code: "report-timeout" })), timeoutMs);
    timer.unref?.();
    worker.once("message", message => (message?.ok ? finish(null, message.data) : finish(new HttpError(message?.status || 500, message?.message || "Rapor hazırlanamadı.", message?.extra || {}))));
    worker.once("error", error => finish(error instanceof Error ? error : new Error(String(error))));
    worker.once("exit", code => finish(new Error(`rapor iş parçacığı kapandı (kod ${code})`)));
  }
  return {
    /** { dbPath, time, id, query, user, limit } → Promise<rapor> (Rapor Merkezi run çıktısı). */
    run(data) {
      if (closed) return Promise.reject(new HttpError(503, "Sunucu kapanıyor; raporu yeniden açın.", { code: "report-closed" }));
      return new Promise((resolve, reject) => {
        queue.push({ data, resolve, reject });
        next();
      });
    },
    /** Bekleyenleri 503 ile düşürür, çalışan iş parçacıklarını sonlandırır; hepsi kapanınca çözülür (veri dosyası serbest). */
    close() {
      closed = true;
      for (const job of queue.splice(0)) job.reject(new HttpError(503, "Sunucu kapanıyor; raporu yeniden açın.", { code: "report-closed" }));
      return Promise.all([...workers].map(worker => worker.terminate().catch(() => {}))).then(() => {});
    },
    get stats() {
      return { active, queued: queue.length, started };
    },
  };
}
