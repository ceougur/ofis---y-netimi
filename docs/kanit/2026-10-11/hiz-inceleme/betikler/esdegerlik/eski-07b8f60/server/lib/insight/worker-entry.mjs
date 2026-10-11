// Analiz iş parçacığı (v2.0.2): analyzeDataset ana iş parçacığının dışında çalışır; sunucu bu sırada istekleri
// yanıtlamayı sürdürür. Mesaj: { id, payload } → { id, result } ya da { id, error }.
import { parentPort } from "node:worker_threads";
import { analyzeDataset } from "./analyze.mjs";

parentPort.on("message", message => {
  const { id, payload } = message || {};
  try {
    const result = analyzeDataset({ ...payload, now: payload?.now ? new Date(payload.now) : new Date() });
    parentPort.postMessage({ id, result });
  } catch (error) {
    parentPort.postMessage({ id, error: { message: error?.message || String(error), stack: error?.stack || "" } });
  }
});
