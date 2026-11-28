// D3 tur 6 hız kabulü: devir ön izlemesinin (plan + ön denetim + rapor) süresi temiz 100 bin kopyasında; taban ↔ yeni aynı betik, ayrı taze kopya.
// Kullanım: node olc-devir.mjs <kod kökü> <veri kopyası> [tekrar=3]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "3"] = process.argv.slice(2);
const repeat = Number(repeatText) || 3;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
console.log(`kod ${root} · veri ${dir} · yük (başta) ${load()}`);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2027-01-05T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const h = monitorEventLoopDelay({ resolution: 5 }); h.enable();
const r = v => Math.round(v * 10) / 10;
const sleep = ms => new Promise(res => setTimeout(res, ms));
const times = []; let loop = 0; let last = null;
for (let i = 0; i < repeat + 1; i += 1) {
  h.reset();
  const s = performance.now();
  const st = await client.post("/api/admin/devir/preview", { company: "sirket-001", cutoff: "2026-12-31", option: "borc-alacak" });
  if (st.status !== 200) throw new Error(`başlat ${st.status} ${JSON.stringify(st.data).slice(0, 200)}`);
  const id = (st.data?.data || st.data).id;
  let job;
  for (;;) { job = await client.get(`/api/admin/devir/preview/${id}`); const d = job.data?.data || job.data; if (d.state !== "running") { last = d; break; } await sleep(50); }
  const ms = performance.now() - s;
  loop = Math.max(loop, h.max / 1e6);
  if (i > 0) times.push(ms); else console.log(`  ilk (soğuk) ${r(ms)} ms · durum ${last.state}`);
}
times.sort((a, b) => a - b);
const plan = last.result?.plan || {};
console.log(`  devir ön izlemesi (K 31.12.2026): ılık ortanca ${r(times[Math.floor(times.length / 2)])} ms (en az ${r(times[0])}, en çok ${r(times.at(-1))}) · olay döngüsü en çok ${r(loop)} ms · durum ${last.state} · zamanlama ${JSON.stringify(last.result?.zamanlama || {}).slice(0, 300)}`);
console.log(`  özet: taksitKarti ${JSON.stringify(last.result?.onizleme?.taksitKarti ?? plan.onizleme?.taksitKarti ?? null)} · hata ${last.error ? String(last.error).slice(0, 200) : "-"}`);
console.log(`yük (sonda) ${load()}`);
await app.close();
