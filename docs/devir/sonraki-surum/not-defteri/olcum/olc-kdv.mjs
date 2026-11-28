// M1 hız ölçümü: KDV Özeti yıllık açılışı (GET report-center/kdv-ozeti) temiz 100 bin veri kopyasında; taban ↔ yeni aynı betik, ayrı taze kopya.
// M1 tur 2 kopyası: tur 1'in betiği + elle sağlama için Ağustos tek ay; özet 400 harfe kadar yazılır (ölçülen istekler aynı).
// Kullanım: node olc-kdv.mjs <kod kökü> <veri kopyası> [tekrar=5]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "5"] = process.argv.slice(2);
const repeat = Number(repeatText) || 5;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
console.log(`kod ${root} · veri ${dir} · yük (başta) ${load()}`);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const counts = app.store.get("SELECT (SELECT COUNT(*) FROM invoices) AS i, (SELECT COUNT(*) FROM invoice_lines) AS l, (SELECT COUNT(*) FROM account_entries) AS e");
console.log(`veri: ${counts.i} fatura, ${counts.l} kalem, ${counts.e} cari satırı`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const r = v => Math.round(v * 10) / 10;
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const cases = [
  ["KDV Özeti yıllık (01.01–31.12.2026)", "/api/workspace/report-center/kdv-ozeti?from=2026-01-01&to=2026-12-31"],
  ["KDV Özeti Bu Yıl (preset)", "/api/workspace/report-center/kdv-ozeti?preset=thisYear"],
  ["KDV Özeti tek ay (Eylül 2026)", "/api/workspace/report-center/kdv-ozeti?from=2026-09-01&to=2026-09-30"],
  ["KDV Mahsup ön izlemesi (Eylül 2026)", "/api/workspace/tax/vat-offset?month=2026-09"],
  ["KDV Özeti tek ay (Ağustos 2026) — elle sağlama", "/api/workspace/report-center/kdv-ozeti?from=2026-08-01&to=2026-08-31"],
];
for (const [label, url] of cases) {
  const first = performance.now();
  const res0 = await client.get(url);
  const coldMs = performance.now() - first;
  const times = [];
  let loop = 0;
  for (let i = 0; i < repeat; i += 1) {
    h.reset();
    const s = performance.now();
    const res = await client.get(url);
    times.push(performance.now() - s);
    loop = Math.max(loop, h.max / 1e6);
    if (res.status !== 200) throw new Error(`${label}: ${res.status}`);
  }
  const data = res0.data?.data || res0.data;
  const summary = Array.isArray(data?.summary) ? data.summary.map(([k, v]) => `${k}=${String(v).slice(0, 400)}`).join(" | ") : "";
  console.log(`  ${label}: ${res0.status} · ilk ${r(coldMs)} ms · ılık ortanca ${r(median(times))} ms (en az ${r(Math.min(...times))}, en çok ${r(Math.max(...times))}) · olay döngüsü en çok ${r(loop)} ms · satır ${data?.total ?? "-"}`);
  if (summary) console.log(`    özet: ${summary}`);
}
console.log(`yük (sonda) ${load()}`);
await app.close();
