// Analiz çalıştırıcısı (v2.0.2, yerel-önce mimari).
// Ofis sunucusu kullanıcının kendi bilgisayarındadır; 200.000 satırlık bir analiz ana iş parçacığında saniyelerce
// sürer ve o sırada hiçbir istek yanıtlanmaz (ekranlar donar). Bu yüzden analiz tek bir kalıcı iş parçacığında
// (worker) koşulur: ana iş parçacığı serbest kalır, istekler akar. Kurallar:
//   - tek worker, tembel başlar, işler sırayla (aynı anda iki analiz CPU'yu ikiye bölmez);
//   - worker çöker ya da zaman aşımına uğrarsa (varsayılan 120 sn) iş ana iş parçacığında yeniden hesaplanır —
//     analiz hiçbir durumda "gelmedi" olmaz;
//   - close() worker'ı sonlandırır; worker unref'lidir, süreç kapanışını tutmaz;
//   - veri iş parçacığına yapılandırılmış kopya ile geçer (bellek iki kat olmaz: kopya iş bitince serbest kalır).
import { Worker } from "node:worker_threads";
import { analyzeDataset } from "./analyze.mjs";

const ENTRY = new URL("./worker-entry.mjs", import.meta.url);

export function createAnalysisRunner({ log = null, timeoutMs = 120_000, enabled = true } = {}) {
  let worker = null;
  let nextId = 1;
  const pending = new Map(); // id → { resolve, reject, timer }
  let closed = false;
  const stats = { runs: 0, inline: 0, restarts: 0, failures: 0 };

  function spawn() {
    const instance = new Worker(ENTRY, { name: "destekofis-analiz" });
    instance.unref();
    instance.on("message", message => {
      const job = pending.get(message?.id);
      if (!job) return;
      pending.delete(message.id);
      clearTimeout(job.timer);
      if (message.error) job.reject(Object.assign(new Error(message.error.message), { stack: message.error.stack }));
      else job.resolve(message.result);
    });
    const fail = error => {
      if (worker === instance) worker = null;
      stats.failures += 1;
      log?.warn?.("Analiz iş parçacığı düştü; işler ana iş parçacığında sürdürülüyor", error);
      for (const [id, job] of pending) {
        pending.delete(id);
        clearTimeout(job.timer);
        job.reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    instance.on("error", fail);
    instance.on("exit", code => {
      if (worker === instance) worker = null;
      if (code !== 0 && !closed) fail(new Error(`Analiz iş parçacığı kapandı (kod ${code})`));
    });
    return instance;
  }

  function inWorker(payload) {
    if (!worker) {
      worker = spawn();
      if (stats.runs) stats.restarts += 1;
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        const stuck = worker;
        worker = null;
        stuck?.terminate().catch(() => {});
        reject(new Error(`Analiz ${Math.round(timeoutMs / 1000)} sn içinde bitmedi`));
      }, timeoutMs);
      timer.unref?.();
      pending.set(id, { resolve, reject, timer });
      try {
        worker.postMessage({ id, payload });
      } catch (error) {
        pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /** analyzeDataset ile aynı sonucu döndürür; worker kullanılamazsa ana iş parçacığında hesaplar. */
  async function run(payload) {
    stats.runs += 1;
    const inline = () => {
      stats.inline += 1;
      return analyzeDataset({ ...payload, now: payload?.now instanceof Date ? payload.now : new Date(payload?.now || Date.now()) });
    };
    if (!enabled || closed) return inline();
    try {
      return await inWorker({ ...payload, now: payload?.now instanceof Date ? payload.now.toISOString() : payload?.now });
    } catch (error) {
      log?.warn?.("Analiz ana iş parçacığında yeniden hesaplanıyor", error);
      return inline();
    }
  }

  async function close() {
    closed = true;
    const instance = worker;
    worker = null;
    for (const [id, job] of pending) {
      pending.delete(id);
      clearTimeout(job.timer);
      job.reject(new Error("Sunucu kapanıyor"));
    }
    if (instance) await instance.terminate().catch(() => {});
  }

  return { run, close, stats: () => ({ ...stats, active: Boolean(worker), pending: pending.size }) };
}
