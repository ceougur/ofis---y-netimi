// AH G6: veri klasörünü verilen sürümün GERÇEK koduyla bir kez açıp kapatır (göç + açılış onarımları o sürümün kodu). node surumle-ac.mjs <kod kökü> <veri klasörü (data/ backups/)>
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, dir] = process.argv.slice(2).map(item => path.resolve(item));
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const at = performance.now();
const app = createApp({ dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false });
console.log(JSON.stringify({ root, acilisMs: Math.round(performance.now() - at), userVersion: app.store.get("PRAGMA user_version").user_version, onarim: { fixed: app.context.ownCardRepair?.fixed?.length, locked: app.context.ownCardRepair?.locked?.length } }));
await app.close();
