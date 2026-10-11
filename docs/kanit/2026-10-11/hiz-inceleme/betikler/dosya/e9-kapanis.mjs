// E9: 001'de (100.000 satır) iki rapor iş parçacığı çalışırken app.close() / runner.close() ne kadar bekler? (terminate SQL'in ortasında etkili mi?)
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = "/home/user/ofis---y-netimi";
const DATA = path.resolve(process.argv[2]);
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server/app.mjs")).href);
const app = createApp({ dataDir: DATA, backupDir: path.join(path.dirname(DATA), "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Olcek-210-Yonetici!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, moneyStrict: false, gateVerify: false, integrityScan: false, analysisWorker: false, reportWorker: true });
const user = app.context.store.get("SELECT u.id, u.username, u.display_name, u.role, u.role_key, u.active, u.deleted_at, u.must_change_password, u.grants_json FROM users u WHERE u.username = 'admin'");
app.context.access.attach(user);
const delay = Number(process.argv[3] || 300);
const t = Date.now();
const p = [0, 1].map(() => app.context.reportCenter.run(user, "banka-hareket", new URLSearchParams({ preset: "all" }), { limit: 1 }).then(() => `200/${Date.now() - t}ms`, e => `${e.status || "Error"}:${e.message}/${Date.now() - t}ms`));
await new Promise(r => setTimeout(r, delay));
const c0 = Date.now();
await app.context.reportRunner.close();
console.log(`gecikme ${delay} ms: runner.close() ${Date.now() - c0} ms sürdü; raporlar: ${JSON.stringify(await Promise.all(p))}`);
await app.close();
