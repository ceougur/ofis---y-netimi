// Tur 2e ölçüm: Kural Farkı ön izlemesi (×3), Mutabakat Testi (×3), Defter Mutabakatı (×3); istenirse kayıt (POST, bir kez). <kod kökü> <veri kökü> <bugün> [kaydet]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, today, mode = ""] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: process.env.ESD_PASS || ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: `${today}T12:00:00+03:00`, fixed: true }, moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
await app.ledger.snapshots.runPending();
const client = createClient(`http://127.0.0.1:${port}`);
await client.login("admin", process.env.ESD_PASS || ADMIN_PASSWORD);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const h = monitorEventLoopDelay({ resolution: 2 });
const out = [];
async function timed(label, fn, times = 3) {
  const ms = [];
  let loop = 0;
  let last;
  for (let i = 0; i < times; i += 1) {
    h.reset(); h.enable();
    const s = performance.now();
    last = await fn();
    ms.push(Math.round(performance.now() - s));
    h.disable();
    loop = Math.max(loop, Math.round(h.max / 1e6));
  }
  const sorted = [...ms].sort((a, b) => a - b);
  out.push(`${label}: ${last.status} · ${ms.join("/")} ms (en iyi ${sorted[0]}, ortanca ${sorted[Math.floor(sorted.length / 2)]}) · döngü en çok ${loop} ms`);
  return unwrap(last);
}
if (process.env.KILIT) {
  const r = await client.put("/api/admin/period-lock", { lockedUntil: process.env.KILIT });
  if (r.status !== 200) throw new Error(`kilit ${r.status}`);
  await app.ledger.snapshots.runPending();
}
console.log(`yük (başta) ${load()} · kilit ${app.period?.lockedUntil?.() || "yok"}`);
const view = await timed("Kural Farkı ön izleme", () => client.get("/api/admin/ledger/rule-diff-correction"));
await timed("Mutabakat Testi", () => client.get("/api/workspace/ledger/integrity"));
await timed("Defter Mutabakatı", () => client.get("/api/workspace/report-center/defter-mutabakati"));
out.push(`  ön izleme: ${view.disabled ? `pasif (${view.code})` : "etkin"} · satır ${view.lines?.length} · kaynak ${view.sourceCount} · yazılmış fiş ${view.vouchers?.length}`);
if (mode === "kaydet" && !view.disabled) {
  await timed("Kural Farkı kaydı (POST)", () => client.post("/api/admin/ledger/rule-diff-correction", { requestId: `olcum-kf-${process.pid}-00000001`, digest: view.digest, confirm: true }), 1);
}
for (const line of out) console.log(line);
console.log(`yük (sonda) ${load()}`);
await app.close();
