// Mutabakat taramasını ayrı iş parçacığında başlatır (v2.1.0, gözden geçirme B7; lib/integrity.mjs scanInBackground).
// Her tarama kendi iş parçacığını açar ve bitince kapatır (15 dakikada bir; kalıcı bağlantı tutmaz). İş parçacığı unref'lidir: sunucunun
// kapanmasını beklemez. Zaman aşımı (varsayılan 30 dk) aşılırsa iş parçacığı sonlandırılır, tarama "çalışmadı" sayılır.
import { Worker } from "node:worker_threads";

const ENTRY = new URL("./integrity-scan-worker.mjs", import.meta.url);

/** { dbPath, time, legacy, partyRows } → Promise<{ result, lock, digest, ms }> */
export function runScanWorker(data, { timeoutMs = 30 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(ENTRY, { workerData: data, name: "destekofis-mutabakat-tarama" });
    worker.unref();
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
      worker.terminate().catch(() => {});
    };
    const timer = setTimeout(() => finish(new Error(`tarama ${Math.round(timeoutMs / 60_000)} dakikada bitmedi`)), timeoutMs);
    timer.unref?.();
    worker.once("message", message => (message?.ok ? finish(null, message) : finish(new Error(message?.error || "tarama başarısız"))));
    worker.once("error", error => finish(error instanceof Error ? error : new Error(String(error))));
    worker.once("exit", code => finish(new Error(`tarama iş parçacığı kapandı (kod ${code})`)));
  });
}
