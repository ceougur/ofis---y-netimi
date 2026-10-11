// E3: report-runner zaman aşımı: iş parçacığı sonlandırılıyor mu, close() onu bekliyor mu, "en çok 2" sınırı tutuyor mu,
// zaman aşımından sonra veri dosyasında açık tanıtıcı kalıyor mu? (createReportRunner'ın kendi timeoutMs seçeneğiyle; ürün kodu değişmez)
import path from "node:path";
import { readdirSync, readlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";
const ROOT = "/home/user/ofis---y-netimi";
const DATA = path.resolve(process.argv[2]);
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server/app.mjs")).href);
const { createReportRunner } = await import(pathToFileURL(path.join(ROOT, "server/lib/report-runner.mjs")).href);
const app = createApp({ dataDir: DATA, backupDir: path.join(path.dirname(DATA), "backups"), logLevel: "silent", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: "Olcek-210-Yonetici!", HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false, moneyStrict: false, gateVerify: false, integrityScan: false, analysisWorker: false, reportWorker: true });
const dbPath = app.config.dbPath;
const fds = () => readdirSync("/proc/self/fd").map(fd => { try { return readlinkSync(`/proc/self/fd/${fd}`); } catch { return ""; } }).filter(p => p === dbPath);
const threads = () => readdirSync("/proc/self/task").map(t => { try { return require("fs").readFileSync(`/proc/self/task/${t}/comm`, "utf8").trim(); } catch { return ""; } });
import { readFileSync } from "node:fs";
const names = () => readdirSync("/proc/self/task").map(t => { try { return readFileSync(`/proc/self/task/${t}/comm`, "utf8").trim(); } catch { return ""; } });
const user = app.context.store.get("SELECT u.id, u.username, u.display_name, u.role, u.role_key, u.active, u.deleted_at, u.must_change_password, u.grants_json FROM users u WHERE u.username = 'admin'");
app.context.access.attach(user);
const job = { dbPath, time: new Date().toISOString(), id: "banka-hareket", query: { preset: "all" }, user: { id: user.id, username: user.username, role: user.role, perms: user.perms }, limit: 1 };
console.log("ana bağlantı tanıtıcısı (db dosyası):", fds().length);
// Ölçüt: zaman aşımı yokken süre
let t = Date.now();
const full = createReportRunner({ max: 2 });
const r = await full.run(job);
console.log(`zaman aşımsız rapor: ${Date.now() - t} ms, toplam satır ${r.total}`);
await full.close();
// Zaman aşımı 150 ms
const runner = createReportRunner({ max: 2, timeoutMs: 150 });
const results = [];
t = Date.now();
const jobs = Array.from({ length: 6 }, (_, i) => runner.run(job).then(() => `bitti`, e => `${e.status || ""} ${e.extra?.code || e.message}`).then(x => results.push([i, Date.now() - t, x])));
const peak = { threads: 0, fds: 0 };
const sampler = setInterval(() => { const n = names().filter(x => x.includes("destekofis") || x.includes("rapor")).length; peak.threads = Math.max(peak.threads, n); peak.fds = Math.max(peak.fds, fds().length); }, 20);
await Promise.all(jobs);
console.log("sonuçlar:", JSON.stringify(results));
console.log("runner.stats (hepsi reddedildikten sonra):", JSON.stringify(runner.stats));
console.log("bu anda 'rapor' iş parçacığı:", names().filter(x => /rapor|destekofis/.test(x)), "db tanıtıcısı:", fds().length);
t = Date.now();
await runner.close();
console.log(`runner.close() ${Date.now() - t} ms'de çözüldü; hemen sonra db tanıtıcısı: ${fds().length}, iş parçacıkları: ${JSON.stringify(names().filter(x => /rapor|destekofis/.test(x)))}`);
const until = Date.now() + 20000;
while (Date.now() < until && fds().length > 1) await new Promise(r => setTimeout(r, 100));
clearInterval(sampler);
console.log(`tanıtıcı 1'e (yalnız ana bağlantı) inene kadar: ${Date.now() - t} ms; şimdi ${fds().length}; zirve aynı anda iş parçacığı adı sayısı ${peak.threads}, zirve db tanıtıcısı ${peak.fds}`);
await app.close();
