// Büyük raporları ayrı iş parçacığında hazırlar (11.10.2026 hız düzeltmesi; lib/report-worker.mjs). Her rapor kendi iş parçacığını açar ve
// bitince kapatır (kalıcı bağlantı tutmaz; şirket geri yüklemesi/silmesi dosyayı serbest bulur). Aynı anda en çok `max` iş parçacığı; fazlası
// sırada bekler (ana iş parçacığı beklemez, öbür isteklere yanıt verir). Zaman aşımında iş parçacığı sonlandırılır, istek 503 alır. Raporun
// hatası (400 süzgeç, 404 hesap…) aynı durum koduyla ve metinle döner.
//
// Bağımsız inceleme düzeltmeleri (11.10.2026, docs/kanit/2026-10-11/hiz-inceleme; H1–H3):
//  - H1: şirket kapatılırken (geri yükleme, silme, Ayır → closeCompany → app.close → close({ reason: "company" })) çalışan ve sırada bekleyen
//    rapor 503 "report-interrupted" ile ve ne olduğunu söyleyen cümleyle döner (önceden çalışan rapor düz Error → 500 "Sunucu işlemi
//    tamamlayamadı." + günlükte ERROR, sıradaki 503 "Sunucu kapanıyor" alıyordu — sunucu kapanmıyordu). Sunucunun gerçek kapanışında metin aynı.
//  - H2: bir iş parçacığı yuvasını ve "workers" kümesindeki yerini ancak GERÇEKTEN kapanınca ("exit") bırakır. SQLite sorgusunun ortasında
//    terminate() etkisizdir (sorgu bitene kadar sürer); önceden zaman aşımında yuva hemen boşalıyor, yeni iş parçacığı açılıyor ("en çok 2"
//    aşılıyordu, ölçülen 7) ve close() bitmemiş iş parçacığını beklemeden çözülüyordu (veri dosyası açık kalır; Windows'ta ardından yapılan
//    geri yükleme/silme EBUSY alabilir). İsteğe zaman aşımı yanıtı (503) yine hemen verilir.
//  - H3: iş parçacığındaki beklenmeyen hata (HttpError olmayan: SQLite, TypeError…) yerinde hazırlanan rapordaki gibi düz hata olarak döner:
//    sunucu günlüğe yığınıyla yazar (app.mjs "API hatası"), kullanıcı "Sunucu işlemi tamamlayamadı." görür (önceden ham İngilizce ileti
//    kullanıcıya gidiyor, günlüğe hiçbir şey yazılmıyordu).
import { Worker } from "node:worker_threads";
import { HttpError } from "./http.mjs";

const ENTRY = new URL("./report-worker.mjs", import.meta.url);

/** Kapanış nedenleri: sunucunun kendisi kapanıyor ya da yalnız bu şirketin örneği kapatılıyor (geri yükleme, silme, Ayır). */
const CLOSE_REASONS = {
  shutdown: () => new HttpError(503, "Sunucu kapanıyor; raporu yeniden açın.", { code: "report-closed" }),
  company: () => new HttpError(503, "Şirket verisi şu anda değiştiriliyor (geri yükleme, silme ya da sıfırlama); raporu birkaç saniye sonra yeniden açın.", { code: "report-interrupted", retryAfter: 5 }),
};

/** İş parçacığındaki beklenmeyen hatayı ana iş parçacığında düz hata olarak kurar (ileti + iş parçacığının yığını; günlüğe yazılır). */
function workerFailure(message) {
  const error = new Error(`Rapor iş parçacığında hata: ${message?.message || "bilinmeyen hata"}`);
  error.name = message?.name || "Error";
  if (message?.stack) error.stack = `${error.name}: ${error.message}\n--- iş parçacığı yığını ---\n${message.stack}`;
  return error;
}

/**
 * entry: iş parçacığının dosyası (yalnız testler değiştirir; config.reportWorkerEntry). Varsayılan lib/report-worker.mjs.
 */
export function createReportRunner({ max = 2, timeoutMs = 5 * 60_000, entry = ENTRY } = {}) {
  let active = 0;
  let started = 0;
  let closed = false;
  let closing = CLOSE_REASONS.shutdown;
  const queue = [];
  // İş parçacığı → kapanış sözü ("exit" gelince çözülür).
  const workers = new Map();
  const next = () => {
    while (!closed && active < max && queue.length) {
      active += 1;
      started += 1;
      start(queue.shift());
    }
  };
  function start({ data, resolve, reject }) {
    let settled = false;
    let exited;
    const gone = new Promise(done => (exited = done));
    let worker;
    try {
      worker = new Worker(entry, { workerData: data, name: "destekofis-rapor" });
    } catch (error) {
      active -= 1;
      reject(error);
      next();
      return;
    }
    worker.unref();
    workers.set(worker, gone);
    // İsteğin yanıtı: bir kez. İş parçacığı ayrıca sonlandırılır; yuvayı "exit" bırakır.
    const settle = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
      worker.terminate().catch(() => {});
    };
    const timer = setTimeout(() => settle(new HttpError(503, "Rapor zamanında hazırlanamadı; biraz sonra yeniden deneyin.", { code: "report-timeout" })), timeoutMs);
    timer.unref?.();
    worker.once("message", message => {
      if (message?.ok) return settle(null, message.data);
      // Rapor kodunun bilinçli hatası (400 süzgeç, 403, 404 hesap…) aynı durum koduyla ve metinle; beklenmeyen hata düz hata (H3).
      if (message?.http) return settle(new HttpError(message.status || 500, message.message || "Rapor hazırlanamadı.", message.extra || {}));
      return settle(workerFailure(message));
    });
    worker.once("error", error => settle(error instanceof Error ? error : new Error(String(error))));
    worker.once("exit", code => {
      workers.delete(worker);
      active -= 1;
      // Yanıt vermeden kapandıysa: kapanış (terminate) ise kapanışın nedeni; değilse beklenmeyen çıkış (günlüğe yazılır).
      settle(closed ? closing() : new Error(`rapor iş parçacığı yanıt vermeden kapandı (kod ${code})`));
      exited();
      next();
    });
  }
  return {
    /** { dbPath, time, id, query, user, limit } → Promise<rapor> (Rapor Merkezi run çıktısı). */
    run(data) {
      if (closed) return Promise.reject(closing());
      return new Promise((resolve, reject) => {
        queue.push({ data, resolve, reject });
        next();
      });
    },
    /**
     * Bekleyenleri 503 ile düşürür, çalışan iş parçacıklarını sonlandırır; HEPSİ GERÇEKTEN kapanınca çözülür (veri dosyası serbest; zaman
     * aşımına uğramış ama sorgusu sürenler dahil). reason: "shutdown" (sunucu kapanıyor) ya da "company" (şirket örneği kapatılıyor).
     */
    close({ reason = "shutdown" } = {}) {
      closing = CLOSE_REASONS[reason] || CLOSE_REASONS.shutdown;
      closed = true;
      for (const job of queue.splice(0)) job.reject(closing());
      for (const worker of workers.keys()) worker.terminate().catch(() => {});
      return Promise.all([...workers.values()]).then(() => {});
    },
    get stats() {
      return { active, queued: queue.length, started, live: workers.size };
    },
  };
}
