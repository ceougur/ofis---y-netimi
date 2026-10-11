// E4: normal biten rapor ↔ zaman aşımıyla sonlandırılan rapor: veri dosyası tanıtıcıları ve iş parçacıkları; CPU (iş parçacığı sürüyor mu?)
import path from "node:path";
import { readdirSync, readlinkSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const ROOT = "/home/user/ofis---y-netimi";
const DATA = path.resolve(process.argv[2]);
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server/app.mjs")).href);
const { createReportRunner } = await import(pathToFileURL(path.join(ROOT, "server/lib/report-runner.mjs")).href);
const app = createApp({ dataDir: DATA, backupDir: path.join(path.dirname(DATA), "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Olcek-210-Yonetici!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, moneyStrict: false, gateVerify: false, integrityScan: false, analysisWorker: false, reportWorker: true });
const dbPath = app.config.dbPath;
const fds = () => readdirSync("/proc/self/fd").map(fd => { try { return readlinkSync(`/proc/self/fd/${fd}`); } catch { return ""; } }).filter(p => p.startsWith(dbPath));
const threadCount = () => readdirSync("/proc/self/task").length;
const cpu = () => { const s = readFileSync("/proc/self/stat", "utf8").split(") ")[1].split(" "); return (Number(s[11]) + Number(s[12])); };
const user = app.context.store.get("SELECT u.id, u.username, u.display_name, u.role, u.role_key, u.active, u.deleted_at, u.must_change_password, u.grants_json FROM users u WHERE u.username = 'admin'");
app.context.access.attach(user);
const job = { dbPath, time: new Date().toISOString(), id: "banka-hareket", query: { preset: "all" }, user: { id: user.id, username: user.username, role: user.role, perms: user.perms }, limit: 1 };
const snap = label => console.log(`${label}: db tanıtıcıları ${fds().length} [${fds().map(p => path.basename(p)).join(", ")}], işletim sistemi iş parçacığı ${threadCount()}`);
snap("başta");
const mode = process.argv[3];
if (mode === "normal") {
  const r1 = createReportRunner({ max: 2 });
  const t = Date.now();
  await r1.run(job);
  console.log(`normal rapor ${Date.now() - t} ms`);
  await r1.close();
  await new Promise(r => setTimeout(r, 500));
  snap("normal rapor bitip runner kapandıktan 0,5 sn sonra");
} else {
  const r2 = createReportRunner({ max: 2, timeoutMs: 300 });
  const t = Date.now();
  const res = await r2.run(job).catch(e => e.extra?.code || e.message);
  console.log(`zaman aşımı sonucu: ${res} (${Date.now() - t} ms)`);
  const c0 = cpu();
  await r2.close();
  snap("runner.close() çözüldükten hemen sonra");
  for (let i = 1; i <= 8; i += 1) {
    const before = cpu();
    await new Promise(r => setTimeout(r, 1000));
    console.log(`  +${i} sn: CPU tık/sn ${cpu() - before} (ana iş parçacığı boşta; >50 → sonlandırılan iş parçacığı hâlâ çalışıyor), db tanıtıcıları ${fds().length}, iş parçacığı ${threadCount()}`);
  }
}
await app.close();
snap("app.close() sonrası");
