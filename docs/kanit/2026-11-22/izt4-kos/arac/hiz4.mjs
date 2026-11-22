// HIZ (ders 47, 53 (a)) — İzleyen tur 4 (S255 = A): değişen her yol, temiz 100 bin satır (KOPYADA). Kullanım: node hiz4.mjs <kod kökü> <veri kopyası>
// Yollar: cari kartı GET, kart penceresi GET, fatura kartı GET, Taksitler listesi, Cari listesi, Açık Faturalar, Anlık Durum, Vade Takip, Alacak Yaşlandırma, Nakit Akışı;
// faturaya BAĞLI tahsilat yazımı (Kapatılacak Fatura — kartın içine aldığı fatura) ve BAĞSIZ tahsilat yazımı. Listeler her yazımdan sonra (artımlı yenileme) ve bir kez soğuk (ilk).
import { readFileSync } from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const [root, dir] = process.argv.slice(2);
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
const W = "/api/workspace";
const s = app.store;
console.log(`kod ${root} · yük başta ${load()}`);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const rows = [];
async function time(label, call) {
  h.reset();
  const t = performance.now();
  const res = await call();
  const ms = performance.now() - t;
  rows.push({ label, ms, loop: h.max / 1e6, status: res.status });
  if (res.status !== 200) console.log(`  ${label}: durum ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  return res;
}
// Kartın içine aldığı fatura: Mevcut Borç kartı faturadan SONRA açılmış, faturanın iadesi yok; carinin satır sayısına göre (kalabalık cariler önce).
const candidates = s.all(`SELECT i.id AS inv, p.id AS plan, i.account_id AS acc, (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = i.account_id) AS n
  FROM invoices i JOIN plans p ON p.account_id = i.account_id AND p.deleted_at IS NULL AND p.status = 'active' AND p.covers_balance = 1 AND p.invoice_id = ''
  WHERE i.status = 'issued' AND i.kind = 'sale' AND i.plan_id = '' AND COALESCE(NULLIF(i.issued_at, ''), i.created_at) <= p.created_at
    AND NOT EXISTS (SELECT 1 FROM invoices r WHERE r.original_id = i.id AND r.status = 'issued')
  GROUP BY i.account_id ORDER BY n DESC LIMIT 6`);
console.log(`aday ${candidates.length}`);
const lists = [
  ["Taksitler listesi", () => client.get(`${W}/plans?status=all`)],
  ["Cari listesi", () => client.get(`${W}/accounts`)],
  ["Açık Faturalar", () => client.get(`${W}/report-center/acik-faturalar`)],
  ["Anlık Durum", () => client.get(`${W}/overview`)],
  ["Vade Takip", () => client.get(`${W}/overview/vade-takip?from=2025-01-01&to=2027-12-31`)],
  ["Alacak Yaşlandırma", () => client.get(`${W}/report-center/alacak-yaslandirma`)],
  ["Nakit Akışı", () => client.get(`${W}/overview/nakit-akisi?from=2026-10-08&to=2027-06-30`)],
];
for (const [label, call] of lists) await time(`${label} (ilk — soğuk)`, call);
for (const c of candidates) {
  await time("cari kartı GET", () => client.get(`${W}/accounts/${encodeURIComponent(c.acc)}`));
  await time("kart penceresi GET", () => client.get(`${W}/plans/${encodeURIComponent(c.plan)}`));
  await time("fatura kartı GET", () => client.get(`${W}/invoices/${encodeURIComponent(c.inv)}`));
  await time("bağlı tahsilat yazımı (Kapatılacak Fatura)", () => client.post(`${W}/accounts/${encodeURIComponent(c.acc)}/entries`, { kind: "in", amount: "150", date: "2026-10-08", method: "cash", invoiceId: c.inv, note: "ölçüm bağlı" }));
  await time("cari kartı GET (yazımdan sonra)", () => client.get(`${W}/accounts/${encodeURIComponent(c.acc)}`));
  await time("kart penceresi GET (yazımdan sonra)", () => client.get(`${W}/plans/${encodeURIComponent(c.plan)}`));
  for (const [label, call] of lists) await time(label, call);
  await time("bağsız tahsilat yazımı", () => client.post(`${W}/accounts/${encodeURIComponent(c.acc)}/entries`, { kind: "in", amount: "150", date: "2026-10-08", method: "cash", note: "ölçüm bağsız" }));
  await time("cari kartı GET (yazımdan sonra)", () => client.get(`${W}/accounts/${encodeURIComponent(c.acc)}`));
}
h.disable();
const by = new Map();
for (const row of rows) {
  if (!by.has(row.label)) by.set(row.label, []);
  by.get(row.label).push(row);
}
for (const [label, list] of by) {
  const ms = list.map(row => row.ms).sort((a, b) => a - b);
  const loop = Math.max(...list.map(row => row.loop));
  const bad = list.filter(row => row.status !== 200).length;
  console.log(`SONUÇ | ${label} | n ${list.length} | en iyi ${ms[0].toFixed(1)} | ortanca ${ms[Math.floor((ms.length - 1) / 2)].toFixed(1)} | olay döngüsü en çok ${loop.toFixed(1)} | 200 dışı ${bad}`);
}
console.log(`yük sonda ${load()}`);
await app.close();
