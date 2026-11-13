// Yalnız AÇILIŞ süresi + açılıştaki mutabakat taramasının bölümleri (taze veri kopyası). Kullanım: node acilis.mjs <kod kökü> <veri kopyası>
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const l0 = load();
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const t0 = performance.now();
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: "Kapi-Olcum-2026!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
await app.listen(0, "127.0.0.1");
const ms = Math.round(performance.now() - t0);
const st = app.integrity.stats();
console.log(`açılış ${ms} ms · yük ${l0} · bölümler ${JSON.stringify(Object.entries(st.run?.sections || {}).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => [k, Math.round(v)]))}`);
await app.close();
