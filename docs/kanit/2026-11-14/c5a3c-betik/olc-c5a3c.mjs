// Ç5-A tur 3c HIZ (ders 47, 53 (a)): değişen yollar, temiz 100 bin satırın (+ program yoluyla eklenmiş şüpheli + bağlı alacaklı cari) TAZE kopyasında; en iyi + ortanca + olay döngüsü
// en çok; AÇILIŞTAN SONRAKİ İLK ÇAĞRI ayrı satır. Kullanım: node olc-c5a3c.mjs <kod kökü> <veri kopyası> [tekrar=5]  (özel ölçüm kilidiyle çağrılır)
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir, repeatText = "5"] = process.argv.slice(2);
const repeat = Number(repeatText) || 5;
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
const r = v => Math.round(v * 10) / 10;
console.log(`kod ${root} · yük (başta) ${load()} · TZ ${process.env.TZ || "(yerel)"} · açılış ${r(performance.now() - t0)} ms`);
{
  const st = app.ledger.snapshots.state();
  if (st.pending) { const d0 = performance.now(); await app.ledger.snapshots.runPending(); console.log(`donma (bekleyen koşu) ${r(performance.now() - d0)} ms`); }
}
const client = createClient(`http://127.0.0.1:${port}`);
if ((await client.login("admin", PASS)).status !== 200) throw new Error("giriş");
const store = app.store;
const doubtfulAcc = store.get("SELECT id FROM accounts WHERE name = 'Ölçüm Şüpheli Bağlı'")?.id;
const plainAcc = store.get("SELECT a.id FROM accounts a WHERE a.deleted_at IS NULL AND a.type = 'customer' AND NOT EXISTS (SELECT 1 FROM doubtful_receivables d WHERE d.account_id = a.id) ORDER BY (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = a.id) DESC LIMIT 1").id;
const linkInv = store.get("SELECT id FROM invoices WHERE account_id = ? AND status = 'issued' ORDER BY rowid DESC LIMIT 1", doubtfulAcc)?.id;
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const results = new Map();
const timed = async (label, call) => {
  h.reset();
  const s = performance.now();
  const res = await call();
  const ms = performance.now() - s;
  if (!results.has(label)) results.set(label, { ms: [], loop: [], status: new Set() });
  const row = results.get(label);
  row.ms.push(ms); row.loop.push(h.max / 1e6); row.status.add(res.status);
  return res;
};
const RANGE = "from=2026-01-01&to=2026-12-31";
const paths = i => [
  ["Mizan + mutabakat (GET ledger)", () => client.get("/api/workspace/ledger")],
  ["Yevmiye Defteri (rapor)", () => client.get(`/api/workspace/report-center/yevmiye?${RANGE}`)],
  ["Hesap Planı Mizanı (rapor)", () => client.get(`/api/workspace/report-center/hesap-mizani?${RANGE}`)],
  ["Alt Hesap Mizanı (rapor)", () => client.get(`/api/workspace/report-center/alt-hesap-mizani?${RANGE}`)],
  ["Defter Mutabakatı (rapor)", () => client.get("/api/workspace/report-center/defter-mutabakati")],
  ["Mutabakat Testi (GET ledger/integrity)", () => client.get("/api/workspace/ledger/integrity")],
  ["Alacak Yaşlandırma (rapor)", () => client.get("/api/workspace/report-center/alacak-yaslandirma")],
  ["Cari Listesi", () => client.get("/api/workspace/accounts?status=all&limit=200")],
  ["zil (dues)", () => client.get("/api/workspace/dues")],
  ["cari kartı (şüpheli + bağlı)", () => client.get(`/api/workspace/accounts/${doubtfulAcc}`)],
  ["cari kartı (şüphelisiz, en kalabalık)", () => client.get(`/api/workspace/accounts/${plainAcc}`)],
  ["YAZIM bağlı tahsilat (şüpheli cari; kapı)", () => client.post(`/api/workspace/accounts/${doubtfulAcc}/entries`, { kind: "in", amount: "1", date: "2026-10-08", method: "cash", cashForce: true, similarOk: true, invoiceId: linkInv, note: `ölçüm ${i}` })],
  ["YAZIM tahsilat (şüphelisiz cari; kapı)", () => client.post(`/api/workspace/accounts/${plainAcc}/entries`, { kind: "in", amount: "1", date: "2026-10-08", method: "cash", cashForce: true, similarOk: true, note: `ölçüm ${i}` })],
  ["Kural Farkı Düzeltme ön izlemesi", () => client.get("/api/admin/ledger/rule-diff-correction")],
];
// AÇILIŞTAN SONRAKİ İLK ÇAĞRI: her yol bir kez, ayrı satırda.
const first = new Map();
for (const [label, call] of paths(-1)) {
  h.reset();
  const s = performance.now();
  const res = await call();
  first.set(label, { ms: performance.now() - s, loop: h.max / 1e6, status: res.status });
}
for (let i = 0; i < repeat; i += 1) for (const [label, call] of paths(i)) await timed(label, call);
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
for (const [label, row] of first) console.log(`  İLK ${label}: durum ${row.status} · ${r(row.ms)} ms · olay döngüsü en çok ${r(row.loop)} ms`);
for (const [label, row] of results) console.log(`  ${label}: durum ${[...row.status].join("/")} · en iyi ${r(Math.min(...row.ms))} ms · ortanca ${r(median(row.ms))} ms · olay döngüsü en çok ${r(Math.max(...row.loop))} ms (n=${row.ms.length})`);
console.log(`yük (sonda) ${load()}`);
await app.close();
