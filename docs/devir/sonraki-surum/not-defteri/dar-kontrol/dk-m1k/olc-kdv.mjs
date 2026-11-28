// Dar kontrol hız: KDV Özeti (Bu Yıl, Tüm Zamanlar, tek ay, PDF, Excel) — aynı veri kopyası, önce / sonra. Kullanım: node olc-kdv.mjs <kod kökü> <veri kopyası> [tekrar] [fiskes]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "5", cut = ""] = process.argv.slice(2);
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
if (cut) {
  for (const m of ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]) {
    const res = await client.post("/api/workspace/tax/vat-offset", { month: m });
    console.log(`fiş ${m}: ${res.status}`);
  }
  await app.close?.();
  process.exit(0);
}
const counts = app.store.get("SELECT (SELECT COUNT(*) FROM invoices) AS i, (SELECT COUNT(*) FROM vat_offsets WHERE status = 'active') AS o");
console.log(`veri: ${counts.i} fatura, ${counts.o} etkin mahsup fişi`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const r = v => Math.round(v * 10) / 10;
const cases = [
  ["Bu Yıl", "/api/workspace/report-center/kdv-ozeti?from=2026-01-01&to=2026-12-31"],
  ["Tüm Zamanlar", "/api/workspace/report-center/kdv-ozeti"],
  ["Mart", "/api/workspace/report-center/kdv-ozeti?from=2026-03-01&to=2026-03-31"],
  ["Bu Yıl PDF", "/api/workspace/report-center/kdv-ozeti/pdf?from=2026-01-01&to=2026-12-31"],
  ["Bu Yıl Excel", "/api/workspace/report-center/kdv-ozeti/xlsx?from=2026-01-01&to=2026-12-31"],
];
await client.get(cases[0][1]);
for (const [label, url] of cases) {
  const list = [];
  let loop = 0;
  for (let i = 0; i < repeat; i += 1) {
    h.reset();
    const s = performance.now();
    const res = label.includes("PDF") || label.includes("Excel") ? await client.raw("GET", url) : await client.get(url);
    list.push(performance.now() - s);
    loop = Math.max(loop, h.max / 1e6);
    if (res.status !== 200) throw new Error(`${label} ${res.status}`);
  }
  list.sort((a, b) => a - b);
  console.log(`  ${label}: ortanca ${r(list[Math.floor(list.length / 2)])} ms · en az ${r(list[0])} · en çok ${r(list[list.length - 1])} · olay döngüsü en çok ${r(loop)} ms`);
}
console.log(`yük (sonda) ${load()}`);
await app.close?.();
process.exit(0);
