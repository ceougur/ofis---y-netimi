// HIZ (kabul E; ders 47, 53 (a)) — Ç7b DK + S229 ALTIN turunun değişen yolları, temiz 100 bin satır (KOPYADA). Kullanım: node hiz.mjs <kod kökü> <veri kopyası>
// Yollar: Kartı Kapat (PUT), iade yazımı (kapalı Mevcut Borç kartının faturasına — S234), iade yazımı (açık kartın faturasına — karşılaştırma), iade İptal Et (büyüme), fatura İptal Et
// (settleCoverOnCancel → trimCovers closed:false), kart penceresi GET, Taksitler listesi GET, fatura kartı GET (coverCancelText — Ç7b dar kontrolünün DOĞRULANMADI'sı), Faturalar listesi
// GET (shape — ownPayState), fatura Düzenle (aynı içerikle).
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
const body = res => (res.data && typeof res.data === "object" && "ok" in res.data ? (res.data.ok ? res.data.data : res.data) : res.data);
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
// Adaylar: açık Mevcut Borç kartının açıldığı andan önce kesilmiş, iade edilebilir kalemli satış faturası (kart onu kapsar); en kalabalık cariler önce.
const candidates = s.all(`SELECT i.id AS inv, p.id AS plan, i.account_id AS acc, (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = i.account_id) AS n
  FROM invoices i JOIN plans p ON p.account_id = i.account_id AND p.deleted_at IS NULL AND p.status = 'active' AND p.covers_balance = 1 AND p.invoice_id = ''
  WHERE i.status = 'issued' AND i.kind = 'sale' AND i.plan_id = '' AND COALESCE(NULLIF(i.issued_at, ''), i.created_at) <= p.created_at
    AND NOT EXISTS (SELECT 1 FROM invoices r WHERE r.original_id = i.id AND r.status = 'issued')
  GROUP BY i.account_id ORDER BY n DESC LIMIT 12`);
console.log(`aday ${candidates.length}`);
const returnable = async id => {
  const got = await client.get(`${W}/invoices/${encodeURIComponent(id)}`);
  const doc = body(got) || {};
  if (got.status !== 200) console.log(`  aday ${id}: fatura GET ${got.status} ${JSON.stringify(doc).slice(0, 160)}`);
  const item = (doc.returnable || []).find(row => Number(row.left) > 0);
  if (!item) console.log(`  aday ${id}: iade edilebilir kalem yok (${JSON.stringify(doc.returnable || null).slice(0, 160)}; canReturn ${doc.canReturn})`);
  return item ? { doc, line: item.lineId || item.id || item.originLineId, qty: Math.min(1, Number(item.left)) } : { doc, line: "" };
};
let closedDone = 0;
let openDone = 0;
for (const c of candidates) {
  if (closedDone >= 4 && openDone >= 2) break;
  const { doc, line, qty } = await returnable(c.inv);
  if (!line) continue;
  const closeIt = closedDone < 4;
  const tag = closeIt ? "KAPALI" : "AÇIK";
  await time(`kart penceresi GET`, () => client.get(`${W}/plans/${encodeURIComponent(c.plan)}`));
  await time(`fatura kartı GET`, () => client.get(`${W}/invoices/${encodeURIComponent(c.inv)}`));
  if (closeIt) {
    const v = body(await client.get(`${W}/plans/${encodeURIComponent(c.plan)}`));
    const r = await time(`Kartı Kapat PUT`, () => client.put(`${W}/plans/${encodeURIComponent(c.plan)}`, { status: "closed", closeRemaining: v.totals.remaining }));
    if (r.status !== 200) continue;
  }
  const ret = await time(`iade yazımı (${tag} kart)`, () => client.post(`${W}/invoices`, { kind: "sale_return", accountId: c.acc, originalId: c.inv, issueDate: "2026-10-08", lines: [{ originLineId: line, qty }], payment: { cash: [] }, force: true }));
  if (ret.status !== 200) continue;
  await time(`kart penceresi GET (iade sonrası)`, () => client.get(`${W}/plans/${encodeURIComponent(c.plan)}`));
  await time(`iade İptal Et (${tag} kart — büyüme)`, () => client.post(`${W}/invoices/${encodeURIComponent(body(ret).id)}/cancel`, { reason: "hız" }));
  if (closeIt) closedDone += 1;
  else openDone += 1;
  void doc;
}
// Fatura İptal Et (S206 / S210 yolu: settleCoverOnCancel) — kalan adaylardan iki (iadesiz kalan).
let cancels = 0;
for (const c of candidates.slice().reverse()) {
  if (cancels >= 2) break;
  const still = s.get("SELECT status FROM invoices WHERE id = ?", c.inv)?.status;
  if (still !== "issued" || s.get("SELECT 1 AS x FROM invoices WHERE original_id = ? AND status = 'issued'", c.inv)) continue;
  const r = await time(`fatura İptal Et (kapsayan kartlı)`, () => client.post(`${W}/invoices/${encodeURIComponent(c.inv)}/cancel`, { reason: "hız" }));
  if (r.status === 200) cancels += 1;
}
// Okumalar: 5'er kez.
for (let i = 0; i < 5; i += 1) {
  await time(`Taksitler listesi GET`, () => client.get(`${W}/plans?status=all`));
  await time(`Faturalar listesi GET`, () => client.get(`${W}/invoices?tab=all&limit=200`));
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
