// E7: max = 2 sınırı zaman aşımından sonra tutuyor mu? (createReportRunner({ max: 2, timeoutMs: 200 }); 8 iş) — aynı anda yaşayan işletim sistemi
// iş parçacığı sayısı ve veri dosyası tanıtıcısı örneklenir. Ürünün süresi 5 dk; burada yalnız seçenekle kısaltıldı.
import path from "node:path";
import { readdirSync, readlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";
const ROOT = "/home/user/ofis---y-netimi";
const DATA = path.resolve(process.argv[2]);
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server/app.mjs")).href);
const { createReportRunner } = await import(pathToFileURL(path.join(ROOT, "server/lib/report-runner.mjs")).href);
const app = createApp({ dataDir: DATA, backupDir: path.join(path.dirname(DATA), "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Olcek-210-Yonetici!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, moneyStrict: false, gateVerify: false, integrityScan: false, analysisWorker: false, reportWorker: true });
const dbPath = app.config.dbPath;
const fds = () => readdirSync("/proc/self/fd").map(fd => { try { return readlinkSync(`/proc/self/fd/${fd}`); } catch { return ""; } }).filter(p => p === dbPath + "-wal").length;
const threads = () => readdirSync("/proc/self/task").length;
const user = app.context.store.get("SELECT u.id, u.username, u.display_name, u.role, u.role_key, u.active, u.deleted_at, u.must_change_password, u.grants_json FROM users u WHERE u.username = 'admin'");
app.context.access.attach(user);
const job = { dbPath, time: new Date().toISOString(), id: "banka-hareket", query: { preset: "all" }, user: { id: user.id, username: user.username, role: user.role, perms: user.perms }, limit: 1 };
const base = threads(); const baseWal = fds();
const runner = createReportRunner({ max: 2, timeoutMs: 200 });
let peakT = 0, peakW = 0;
const sampler = setInterval(() => { peakT = Math.max(peakT, threads() - base); peakW = Math.max(peakW, fds() - baseWal); }, 10);
const t = Date.now();
const res = await Promise.all(Array.from({ length: 8 }, () => runner.run(job).then(() => "bitti", e => e.extra?.code || e.message)));
console.log(`8 iş ${Date.now() - t} ms'de sonuçlandı: ${JSON.stringify(res)}; runner.stats ${JSON.stringify(runner.stats)}`);
await runner.close();
const w = Date.now();
while (threads() > base && Date.now() - w < 30000) await new Promise(r => setTimeout(r, 50));
clearInterval(sampler);
console.log(`zirve: aynı anda ${peakT} rapor iş parçacığı (sınır 2), veri dosyasında ${peakW} ek -wal tanıtıcısı; close() sonrası iş parçacıklarının sönmesi ${Date.now() - w} ms`);
await app.close();
