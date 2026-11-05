// Test yardımcısı (2.5.0, test/db-acilis-kilit-250.test.mjs): ayrı İŞ PARÇACIĞINDA SQLite dosyasını ÖZEL KİLİTLE tutar (WAL + locking_mode EXCLUSIVE + bir yazma;
// okuyucu da giremez — journal_mode PRAGMA'sı BUSY alır), workerData.ms kadar tutar, bağlantıyı kapatıp kilidi bırakır. Ana iş parçacığı bu sürede senkron
// openDatabase'te beklerken kilidin kendiliğinden kalkması için (aynı iş parçacığında tutulan kilit bekleyen açılış bitmeden kalkamaz).
import { DatabaseSync } from "node:sqlite";
import { parentPort, workerData } from "node:worker_threads";

const db = new DatabaseSync(workerData.file);
db.exec("PRAGMA journal_mode = WAL; PRAGMA locking_mode = EXCLUSIVE; BEGIN; UPDATE t SET v = v; COMMIT;");
parentPort.postMessage("kilitli");
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, workerData.ms);
db.close();
parentPort.postMessage("birakti");
