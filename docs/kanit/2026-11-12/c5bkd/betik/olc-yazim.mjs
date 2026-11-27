// Hız incelemesi (hiz-yazim-istem.txt, İş 1): tek Borç Yaz ve tek cari nakit tahsilatının toplam süresi, COMMIT denetimleri (store.lastTx), kapı yolu
// (integrity.stats().gate: path / reason / sections), olay döngüsü en çok. Yalnız ölçüm; veri KOPYADA.
// Kullanım: HUKUK_LICENSE_URL=http://127.0.0.1:9 flock -x -n scratchpad/olcum.lock node olc-yazim.mjs <kod kökü> <veri kopyası> [tekrar=2]
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "2"] = process.argv.slice(2);
const repeat = Number(repeatText) || 2;
const load = () => readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
console.log(`kod ${root} · veri ${dir} · yük (başta) ${load()}`);
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
console.log(`açılış ${Math.round(performance.now() - t0)} ms`);
const client = createClient(`http://127.0.0.1:${port}`);
const login = await client.login("admin", PASS);
if (login.status !== 200) throw new Error(`giriş ${login.status}`);
const store = app.store;
const one = sql => store.get(sql);
const has = table => Boolean(one(`SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = '${table}'`));
const busiest = one("SELECT account_id AS id, COUNT(*) AS n FROM account_entries GROUP BY account_id ORDER BY n DESC LIMIT 1");
const counts = one("SELECT (SELECT COUNT(*) FROM accounts WHERE deleted_at IS NULL) AS a, (SELECT COUNT(*) FROM account_entries) AS e, (SELECT COUNT(*) FROM invoices) AS i, (SELECT COUNT(*) FROM plans) AS p, (SELECT COUNT(*) FROM cash_entries) AS c, (SELECT COUNT(*) FROM payments) AS y");
console.log(`veri: ${counts.a} cari, ${counts.e} cari satırı, ${counts.i} fatura, ${counts.p} kart, ${counts.c} Kasa satırı, ${counts.y} kayıt tahsilatı; en kalabalık cari ${busiest.n} satır`);
const lock = app.period?.lockedUntil?.() || "";
console.log(`dönem kilidi: '${lock}'`);
// Açılıştaki taban (integrity_log 'baseline' son kaydı) — kapının hangi alanlara güvenmediğini gösterir.
if (has("integrity_log")) {
  const rows = store.all("SELECT at, action, summary, length(detail_json) AS n FROM integrity_log ORDER BY at DESC LIMIT 6");
  for (const row of rows) console.log(`  integrity_log ${row.at} ${row.action} · ${String(row.summary).slice(0, 300)} · ayrıntı ${row.n} bayt`);
}
const st0 = app.integrity.stats();
console.log(`açılış sonrası kapı sayacı: ${JSON.stringify(st0.tally)} · son run bölümleri (en büyük 8): ${JSON.stringify(Object.entries(st0.run?.sections || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, Math.round(v)]))}`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const r = v => (typeof v === "number" ? Math.round(v * 10) / 10 : v);
async function write(label, call) {
  h.reset();
  const started = performance.now();
  const response = await call();
  const ms = performance.now() - started;
  const loop = h.max / 1e6;
  const tx = store.lastTx;
  const gate = app.integrity.stats().gate || {};
  const top = Object.entries(gate.sections || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}=${r(v)}`).join(" ");
  console.log(`${label}: durum ${response.status} · toplam ${r(ms)} ms · olay döngüsü en çok ${r(loop)} ms · lastTx ${JSON.stringify(Object.fromEntries(Object.entries(tx).map(([k, v]) => [k, r(v)])))} · kapı yolu ${gate.path}${gate.reason ? ` (neden: ${gate.reason})` : ""} · kapı ${r(gate.ms)} ms (run ${r(gate.runMs)}, kilit ${r(gate.lockMs)}) · tablolar ${JSON.stringify(gate.tables)}`);
  console.log(`    bölümler (en büyük 10): ${top}`);
  if (gate.scope) console.log(`    kapsam: ${JSON.stringify(gate.scope).slice(0, 400)}`);
  if (response.status !== 200) console.log(`    yanıt: ${JSON.stringify(response.data).slice(0, 400)}`);
}
const other = (one("SELECT id FROM accounts WHERE deleted_at IS NULL AND type = 'customer' ORDER BY rowid LIMIT 1 OFFSET 10") || one("SELECT id FROM accounts WHERE deleted_at IS NULL AND type = 'customer' ORDER BY rowid LIMIT 1")).id;
for (let i = 0; i < repeat; i += 1) {
  await write(`Borç Yaz #${i + 1} (cari ${other})`, () => client.post(`/api/workspace/accounts/${other}/entries`, { kind: "debt", amount: "1", date: "2026-10-08", note: `hız ${i}` }));
  await write(`nakit tahsilat #${i + 1} (en kalabalık cari ${busiest.id})`, () => client.post(`/api/workspace/accounts/${busiest.id}/entries`, { kind: "in", amount: "1", date: "2026-10-08", method: "cash", note: `hız ${i}`, cashForce: true }));
}
// Kopyalanmış Değersiz Alacak satırı olan (taban sapmasının içindeki) bir cariye Borç Yaz — varsa.
const drifting = one("SELECT account_id AS id FROM account_entries WHERE source = 'doubtful' AND id LIKE '%~%' LIMIT 1")?.id;
if (drifting) await write(`Borç Yaz (SAPAN cari ${drifting})`, () => client.post(`/api/workspace/accounts/${drifting}/entries`, { kind: "debt", amount: "1", date: "2026-10-08", note: "hız sapan" }));
// Kasa Giriş (cariye dokunmayan nakit yazım) — karşılaştırma için.
await write("Kasa Giriş", () => client.post("/api/workspace/cash", { kind: "in", amount: "1", date: "2026-10-07", description: "hız", method: "cash" }));
console.log(`kapı sayacı (sonda): ${JSON.stringify(app.integrity.stats().tally)}`);
h.disable();
await app.close();
console.log(`yük (sonda) ${load()}`);
