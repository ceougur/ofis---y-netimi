// DK-C6H45 s-buyuk2: temiz 100 bin — gerçekçi kilit geçmişi (aylık kilit 12 ay + 24 kez kilit aç / yeniden kilitle) → donmuş kart satırı sayısı, her kilidin süresi,
// sonra değerleme / Bilanço / Gelir Tablosu süreleri (3 tur; ılık ilk tur atılmaz — hepsi yazılır) ve özet sha (eski ↔ yeni karşılaştırması için).
// Kullanım: node s-buyuk2.mjs <ROOT> <veri kopyası> <çıktı.json>
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const [root, dir, out] = process.argv.slice(2);
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
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
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const R = { load0: load(), locks: [], reads: [] };
const lock = async to => {
  h.reset();
  const s = performance.now();
  const r = await client.put("/api/admin/period-lock", { lockedUntil: to });
  let view;
  for (;;) {
    view = (await client.get("/api/workspace/ledger/lock")).data.data;
    if (!view.freeze?.active) break;
    await new Promise(z => setTimeout(z, 25));
  }
  R.locks.push([to, r.status, Math.round(performance.now() - s), Math.round(h.max / 1e6), view.frozenThrough]);
};
const months = ["2025-10-31", "2025-11-30", "2025-12-31", "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30"];
for (const m of months) await lock(m);
for (let i = 0; i < 24; i += 1) {
  await lock("2026-08-31");
  await lock("2026-09-30");
}
const store = app.store;
R.runs = store.get("SELECT COUNT(*) AS n, SUM(kind = 'freeze') AS f FROM ledger_snapshot_runs");
try {
  R.cards = store.get("SELECT COUNT(*) AS n FROM ledger_valuation_cards").n;
} catch (e) {
  R.cards = String(e.message);
}
R.items = store.get("SELECT COUNT(*) AS n FROM stock_items").n;
const FS = "/api/workspace/financial-statements";
const READS = { v0630: `${FS}/stock-valuation?date=2026-06-30`, vNow: `${FS}/stock-valuation?date=2026-10-08`, bsNow: `${FS}/balance-sheet?date=2026-10-08`, gt26: `${FS}/income-statement?from=2026-01-01&to=2026-10-08`, bs0630: `${FS}/balance-sheet?date=2026-06-30` };
const sha = v => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
for (let t = 0; t < 3; t += 1) {
  for (const [k, url] of Object.entries(READS)) {
    // Önbellek (bağlantının değişiklik sayaçları) her okumadan önce mali tabloya girmeyen bir ayar yazımıyla geçersiz kılınır → her okuma soğuk hesap.
    store.setSetting("dkc6h45.olcum", `${t}-${k}`);
    h.reset();
    const s = performance.now();
    const r = await client.get(url);
    const d = r.data?.data ?? r.data;
    R.reads.push([t, k, r.status, Math.round(performance.now() - s), Math.round(h.max / 1e6), sha(d)]);
  }
}
R.load1 = load();
await app.close();
writeFileSync(out, JSON.stringify(R, null, 1));
console.log("yazıldı", out);
