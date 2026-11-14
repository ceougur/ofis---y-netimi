// Tur 2e ölçüm: 5.000 aday (v2.4.9 gerçek koduyla; kilit 30.09.2026) — liste, zil, toplu karar (yönetici; Muhasebe AÇIK dönemde — DÜŞÜK-4 sorgusunun yolu), tek karar (Muhasebe), Kural
// Farkı ön izleme, Mutabakat Testi; süre + olay döngüsü en çok. <kod kökü> <veri kökü>
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
console.log(`kod ${root} · yük (başta) ${load()}`);
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: { time: "2026-10-20T12:00:00+03:00", fixed: true }, moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
await app.ledger.snapshots.runPending();
const base = `http://127.0.0.1:${port}`;
const admin = createClient(base);
await admin.login("admin", ADMIN_PASSWORD);
await admin.post("/api/admin/users", { username: "olcum-muh", name: "Ölçüm Muhasebe", role: "muhasebe", password: "Olcum-Muh-2026!", mustChangePassword: false });
const acc = createClient(base);
const lg = await acc.login("olcum-muh", "Olcum-Muh-2026!");
if (lg.status !== 200) throw new Error(`muhasebe giriş ${lg.status}`);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const h = monitorEventLoopDelay({ resolution: 2 });
async function timed(label, fn) {
  h.reset(); h.enable();
  const s = performance.now();
  const r = await fn();
  const ms = Math.round(performance.now() - s);
  h.disable();
  console.log(`  ${label}: ${r.status} · ${ms} ms · döngü en çok ${Math.round(h.max / 1e6)} ms`);
  return unwrap(r);
}
const list = await timed("liste (sayfasız)", () => admin.get("/api/workspace/opening-review"));
await timed("liste (sayfasız, 2.)", () => admin.get("/api/workspace/opening-review"));
await timed("sayfa 1 (200)", () => admin.get("/api/workspace/opening-review?limit=200&offset=0"));
await timed("zil sayısı", () => admin.get("/api/workspace/opening-review?counts=1"));
await timed("Mutabakat Testi", () => admin.get("/api/workspace/ledger/integrity"));
const lock = app.period?.lockedUntil?.() || "";
const open = list.items.filter(item => item.date > lock).map(item => item.id);
const locked = list.items.filter(item => item.date <= lock).map(item => item.id);
console.log(`  aday ${list.items.length} · kilit ${lock} · açık ${open.length} · kilitli ${locked.length}`);
await timed("toplu onay — yönetici, kilitli 1.000", () => admin.post("/api/workspace/opening-review", { ids: locked.slice(0, 1000), decision: "confirm" }));
await timed("toplu ret — Muhasebe, açık 1.000", () => acc.post("/api/workspace/opening-review", { ids: open.slice(0, 1000), decision: "reject" }));
await timed("toplu Geri Al — Muhasebe, açık 1.000", () => acc.post("/api/workspace/opening-review", { ids: open.slice(0, 1000), decision: "undo" }));
await timed("toplu onay — yönetici, açık + kilitli 1.000", () => admin.post("/api/workspace/opening-review", { ids: [...open.slice(1000, 1500), ...locked.slice(1000, 1500)], decision: "confirm" }));
await timed("tek karar — Muhasebe, açık", () => acc.post(`/api/workspace/opening-review/${open[2000]}`, { decision: "reject" }));
await timed("Kural Farkı ön izleme", () => admin.get("/api/admin/ledger/rule-diff-correction"));
await timed("Mutabakat Testi (kararlardan sonra)", () => admin.get("/api/workspace/ledger/integrity"));
console.log(`yük (sonda) ${load()}`);
await app.close();
