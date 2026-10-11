import { isMainThread, threadName, workerData } from "node:worker_threads";
import { appendFileSync } from "node:fs";
const LOG = process.env.ISPARCACIGI_LOG;
if (LOG && !isMainThread && threadName === "destekofis-rapor") {
  appendFileSync(LOG, JSON.stringify({ t: Date.now(), id: workerData?.id, limit: workerData?.limit, q: workerData?.query, db: workerData?.dbPath?.slice(-40) }) + "\n");
}
