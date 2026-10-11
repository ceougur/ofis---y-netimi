// Zaman aşımında iş parçacığı sonlanmadan yenisi başlıyor mu; close() tanıtıcılar kapanmadan çözülüyor mu?
import { readdirSync, readlinkSync } from "node:fs";
const ROOT = "/home/user/ofis---y-netimi";
const dbPath = process.argv[2];
const mode = process.argv[3] || "zaman";
const { createReportRunner } = await import(ROOT + "/server/lib/report-runner.mjs");
const fds = () => readdirSync("/proc/self/fd").map(fd => { try { return readlinkSync(`/proc/self/fd/${fd}`); } catch { return ""; } }).filter(x => x.startsWith(dbPath)).length;
const threads = () => readdirSync("/proc/self/task").length;
const user = { id: "u1", username: "admin", display_name: "Yönetici", role: "admin", role_key: "admin", roleKey: "admin" };
const job = () => ({ dbPath, time: "2026-10-11T09:00:00.000Z", id: "banka-hareket", query: { preset: "all" }, user, limit: 200 });
console.log("başlangıç iş parçacığı", threads(), "db tanıtıcı", fds());
if (mode === "olcu") {
  const r = createReportRunner();
  const t = Date.now();
  const out = await r.run(job()).then(d => "ok toplam " + d.total, e => "HATA " + e.status + " " + e.message);
  console.log("tek rapor", out, Date.now() - t, "ms");
  await r.close();
  process.exit(0);
}
const timeoutMs = Number(process.argv[4] || 300);
const r = createReportRunner({ max: 2, timeoutMs });
const t0 = Date.now();
const results = [];
const ps = [1, 2, 3, 4, 5, 6].map(i => r.run(job()).then(d => results.push(`${i}:ok/${Date.now() - t0}`), e => results.push(`${i}:${e.status}:${e.extra?.code || e.message}/${Date.now() - t0}`)));
let maxThreads = 0, maxFds = 0;
const iv = setInterval(() => { maxThreads = Math.max(maxThreads, threads()); maxFds = Math.max(maxFds, fds()); }, 20);
await Promise.all(ps);
console.log("sonuçlar", results.join(", "), "| en çok iş parçacığı", maxThreads, "en çok db tanıtıcı", maxFds, "| stats", JSON.stringify(r.stats));
const tc = Date.now();
await r.close();
console.log("close() çözüldü", Date.now() - tc, "ms; hemen sonra iş parçacığı", threads(), "db tanıtıcı", fds());
for (const ms of [250, 500, 1000, 2000, 4000]) {
  await new Promise(res => setTimeout(res, ms - (Date.now() - tc) > 0 ? ms - (Date.now() - tc) : 0));
  console.log(`  close'dan ${Date.now() - tc} ms sonra: iş parçacığı ${threads()}, db tanıtıcı ${fds()}`);
}
clearInterval(iv);
