// Test yardımcısı (2.4.8 İş P1): ayrı İŞ PARÇACIĞINDA SQLite dosyasını yazmaya kilitler (BEGIN EXCLUSIVE), workerData.ms kadar tutar, bırakır. Ana iş parçacığı bu sürede
// senkron yazımda beklerken kilidin kendiliğinden kalkması için (aynı iş parçacığında tutulan kilit bekleyen yazım bitmeden kalkamaz).
import { DatabaseSync } from "node:sqlite";
import { parentPort, workerData } from "node:worker_threads";

const db = new DatabaseSync(workerData.file);
db.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
parentPort.postMessage("kilitli");
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, workerData.ms);
db.exec("ROLLBACK");
db.close();
parentPort.postMessage("birakti");
