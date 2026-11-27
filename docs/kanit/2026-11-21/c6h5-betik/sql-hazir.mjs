// Kilitli temiz 100 bin kopyasını dondurur (runPending) ve kapatır — SQL karşılaştırması için hazır veri (ölçüm değil). node sql-hazir.mjs <kod kökü> <veri kopyası>
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
await app.listen(0, "127.0.0.1");
await app.ledger.snapshots.runPending();
console.log(`kapsam ${app.ledger.snapshots.state().coverage}`);
await app.close?.();
process.exit(0);
