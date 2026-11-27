// Ç5-A tur 1c profil (ders 47): okuma yollarının CPU profili (açılış hariç) — işlev başına öz süre. Kullanım: node profil.mjs <kod kökü> <veri kopyası> <yol: ledger|yevmiye|hesap|mutabakat|integrity|hepsi> [tekrar=2]
import { Session } from "node:inspector/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, which = "hepsi", repeatText = "2", out = ""] = process.argv.slice(2);
const repeat = Number(repeatText) || 2;
const { createApp } = await import(pathToFileURL(path.join(root, "server", "app.mjs")).href);
const { createClient } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const PASS = "Kapi-Olcum-2026!";
const app = createApp({
  dataDir: path.join(dir, "data"), backupDir: path.join(dir, "backups"), logLevel: "silent", scheduleBackups: false,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" },
  startLicenseTimers: false, integrityScan: false, analysisWorker: false, now: "2026-10-08T12:00:00+03:00", moneyStrict: false,
});
const { port } = await app.listen(0, "127.0.0.1");
const st = app.ledger.snapshots.state();
if (st.pending) await app.ledger.snapshots.runPending();
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const RANGE = "from=2026-01-01&to=2026-12-31";
const paths = {
  ledger: "/api/workspace/ledger",
  yevmiye: `/api/workspace/report-center/yevmiye?${RANGE}`,
  hesap: `/api/workspace/report-center/hesap-mizani?${RANGE}`,
  mutabakat: "/api/workspace/report-center/defter-mutabakati",
  integrity: "/api/workspace/ledger/integrity",
};
const chosen = which === "hepsi" ? Object.keys(paths) : which.split(",");
// ısınma
for (const k of chosen) await client.get(paths[k]);
const session = new Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.setSamplingInterval", { interval: 200 });
await session.post("Profiler.start");
const times = {};
for (let i = 0; i < repeat; i += 1) for (const k of chosen) {
  const s = performance.now();
  const r = await client.get(paths[k]);
  (times[k] ||= []).push(Math.round(performance.now() - s));
  if (r.status !== 200) throw new Error(`${k} ${r.status}`);
}
const { profile } = await session.post("Profiler.stop");
if (out) writeFileSync(out, JSON.stringify(profile));
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const self = new Map();
const dt = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i += 1) {
  const n = byId.get(profile.samples[i]);
  const f = n.callFrame;
  const key = `${f.functionName || "(anon)"} ${String(f.url).replace(/^.*\/(server|test)\//, "$1/")}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) || 0) + (dt[i] || 0));
}
// toplam (kapsayıcı) süre: düğüm ağacında
const total = new Map();
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const selfNode = new Map();
for (let i = 0; i < profile.samples.length; i += 1) selfNode.set(profile.samples[i], (selfNode.get(profile.samples[i]) || 0) + (dt[i] || 0));
for (const [id, t] of selfNode) {
  const seen = new Set();
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    const f = byId.get(cur).callFrame;
    const key = `${f.functionName || "(anon)"} ${String(f.url).replace(/^.*\/(server|test)\//, "$1/")}:${f.lineNumber + 1}`;
    if (seen.has(key)) continue;
    seen.add(key);
    total.set(key, (total.get(key) || 0) + t);
  }
}
const ms = v => (v / 1000).toFixed(0);
console.log(`kod ${root} · ${chosen.join(",")} × ${repeat} · süreler ${JSON.stringify(times)} · yük ${readFileSync("/proc/loadavg", "utf8").trim()}`);
console.log("--- öz süre (ms) ilk 35");
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 35)) console.log(`${ms(v).padStart(7)}  ${k}`);
console.log("--- kapsayıcı süre (ms) server/ ilk 45");
for (const [k, v] of [...total].filter(([k]) => k.includes("server/")).sort((a, b) => b[1] - a[1]).slice(0, 45)) console.log(`${ms(v).padStart(7)}  ${k}`);
console.log("--- kapsayıcı süre (ms) ledger-opening / integrity / general-ledger / routes/ledger işlevleri");
for (const [k, v] of [...total].filter(([k]) => /ledger-opening|lib\/integrity\.mjs|general-ledger|routes\/ledger\.mjs|ledger-snapshots/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`${ms(v).padStart(7)}  ${k}`);
await app.close();
