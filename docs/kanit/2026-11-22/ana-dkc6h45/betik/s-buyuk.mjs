// DK-C6H45 s-buyuk: temiz 100 bin — kilitsiz / kilit 31.12.2025 / kilit 30.06.2026 okumaları (özet = sha + ana sayılar) ve Dönem Kilidi süresi (PUT + dondurmanın bitişi, olay döngüsü en çok).
// Kullanım: node s-buyuk.mjs <ROOT> <veri kopyası> <çıktı.json>
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
const t0 = performance.now();
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const R = { load0: load(), openMs: Math.round(performance.now() - t0), stages: {} };
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const FS = "/api/workspace/financial-statements";
const READS = {
  mizan26: "/api/workspace/ledger?from=2026-01-01&to=2026-10-08", mizanAll: "/api/workspace/ledger?to=2026-10-08", mizan25: "/api/workspace/ledger?from=2025-01-01&to=2025-12-31",
  bs1231: `${FS}/balance-sheet?date=2025-12-31`, bs0630: `${FS}/balance-sheet?date=2026-06-30`, bs0701: `${FS}/balance-sheet?date=2026-07-01`, bsNow: `${FS}/balance-sheet?date=2026-10-08`,
  gt25: `${FS}/income-statement?from=2025-01-01&to=2025-12-31`, gt26: `${FS}/income-statement?from=2026-01-01&to=2026-10-08`, gt26a: `${FS}/income-statement?from=2026-01-01&to=2026-06-30`,
  gt26b: `${FS}/income-statement?from=2026-07-01&to=2026-10-08`, v1231: `${FS}/stock-valuation?date=2025-12-31`, v0630: `${FS}/stock-valuation?date=2026-06-30`, vNow: `${FS}/stock-valuation?date=2026-10-08`,
  cari: "/api/workspace/accounts?status=all&limit=50",
};
const sha = v => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
const stage = async name => {
  const S = (R.stages[name] = {});
  for (const [k, url] of Object.entries(READS)) {
    h.reset();
    const s = performance.now();
    const r = await client.get(url);
    const ms = Math.round(performance.now() - s);
    const d = r.data?.data ?? r.data;
    S[k] = {
      status: r.status, sha: sha(d), ms, loopMax: Math.round(h.max / 1e6),
      kesinDegil: d?.kesinDegil?.map(x => x.kod), bilgi: d?.bilgi, fark: d?.toplamlar?.farkMinor, kar: d?.subtotals?.donemNetKari ?? d?.hesaplanmis?.donemNetKari?.tutarMinor, dss: d?.totals?.dssMinor,
      trial: d?.trial?.totals, entryCount: d?.entryCount,
    };
  }
};
const lock = async to => {
  h.reset();
  const s = performance.now();
  const r = await client.put("/api/admin/period-lock", { lockedUntil: to });
  const putMs = Math.round(performance.now() - s);
  let view;
  for (;;) {
    view = (await client.get("/api/workspace/ledger/lock")).data.data;
    if (!view.freeze?.active) break;
    await new Promise(z => setTimeout(z, 25));
  }
  return { status: r.status, putMs, totalMs: Math.round(performance.now() - s), loopMax: Math.round(h.max / 1e6), frozenThrough: view.frozenThrough, load: load() };
};
await stage("kilitsiz");
R.lock1231 = await lock("2025-12-31");
await stage("k1231");
R.lock0630 = await lock("2026-06-30");
await stage("k0630");
const store = app.store;
R.cards = (() => {
  try {
    return store.all("SELECT run, COUNT(*) AS n FROM ledger_valuation_cards GROUP BY run").map(r => [r.run, r.n]);
  } catch (e) {
    return String(e.message);
  }
})();
R.runs = store.all("SELECT no, kind, state, from_date, through FROM ledger_snapshot_runs ORDER BY no").map(r => [r.no, r.kind, r.state, r.from_date, r.through]);
R.load1 = load();
await app.close();
writeFileSync(out, JSON.stringify(R, null, 1));
console.log("yazıldı", out);
