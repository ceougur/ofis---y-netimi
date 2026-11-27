// HIZ (ders 47, 53 (a)) — İzleyen tur 2 (izt2): önceki turun yolları + büyük azaltma (kartın kalanından fazla olabilir) + fatura İptal Et (kartlı cari), temiz 100 bin satır (KOPYADA). Kullanım: node hiz.mjs <kod kökü> <veri kopyası>
// Yollar: kart penceresi GET, fatura kartı GET, cari kartı GET (özet), zil / gecikmiş (Tek Yükümlülük Kuyruğu) GET, Kartı Kapat PUT, iade yazımı (açık / kapalı kart), iade İptal Et (büyüme),
// fatura Düzenle kaydı (aynı içerik — kapsam okuması önce / sonra), Taksitler listesi GET, Faturalar listesi GET.
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
const candidates = s.all(`SELECT i.id AS inv, p.id AS plan, i.account_id AS acc, (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = i.account_id) AS n
  FROM invoices i JOIN plans p ON p.account_id = i.account_id AND p.deleted_at IS NULL AND p.status = 'active' AND p.covers_balance = 1 AND p.invoice_id = ''
  WHERE i.status = 'issued' AND i.kind = 'sale' AND i.plan_id = '' AND COALESCE(NULLIF(i.issued_at, ''), i.created_at) <= p.created_at
    AND NOT EXISTS (SELECT 1 FROM invoices r WHERE r.original_id = i.id AND r.status = 'issued')
  GROUP BY i.account_id ORDER BY n DESC LIMIT 12`);
console.log(`aday ${candidates.length}`);
let closedDone = 0;
let openDone = 0;
let edits = 0;
for (const c of candidates) {
  if (closedDone >= 3 && openDone >= 3 && edits >= 4) break;
  await time(`kart penceresi GET`, () => client.get(`${W}/plans/${encodeURIComponent(c.plan)}`));
  const got = await time(`fatura kartı GET`, () => client.get(`${W}/invoices/${encodeURIComponent(c.inv)}`));
  await time(`cari kartı GET`, () => client.get(`${W}/accounts/${encodeURIComponent(c.acc)}`));
  let doc = body(got) || {};
  if (edits < 4 && doc.canModify) {
    const payment = { cash: (doc.payment?.cash || []).map(x => ({ amount: String(x.amount), method: x.method, lineKey: x.lineKey, bankAccountId: x.bankAccountId || "" })), cheques: [], endorse: [], rest: "account", dueDate: doc.dueDate || "" };
    const lines = (doc.lines || []).map(l => ({ itemId: l.itemId || "", code: l.code || "", name: l.name, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice, discountRate: l.discountRate || 0, vatRate: l.vatRate, withholdingCode: l.withholdingCode || "", exemptionCode: l.exemptionCode || "" }));
    const r = await time(`fatura Düzenle kaydı (aynı içerik)`, () => client.post(`${W}/invoices/${encodeURIComponent(c.inv)}/edit`, { scenario: doc.scenario, accountId: c.acc, issueDate: doc.issueDate, issueTime: doc.issueTime, profile: doc.profile, pricesIncludeVat: doc.pricesIncludeVat, lines, payment, note: doc.note || "", force: true }));
    if (r.status === 200) edits += 1;
    const big = lines.findIndex(l => Number(l.qty) >= 2);
    if (r.status === 200 && big >= 0) {
      const less = lines.map((l, i) => (i === big ? { ...l, qty: Number(l.qty) - 1 } : l));
      await time(`fatura Düzenle kaydı (azaltma)`, () => client.post(`${W}/invoices/${encodeURIComponent(c.inv)}/edit`, { scenario: doc.scenario, accountId: c.acc, issueDate: doc.issueDate, issueTime: doc.issueTime, profile: doc.profile, pricesIncludeVat: doc.pricesIncludeVat, lines: less, payment, note: doc.note || "", force: true }));      const most = lines.findIndex(l => Number(l.qty) >= 3);
      if (most >= 0) {
        const tiny = lines.map((l, i) => (i === most ? { ...l, qty: 1 } : i === big ? { ...l, qty: Number(l.qty) - 1 } : l));
        await time(`fatura Düzenle kaydı (büyük azaltma)`, () => client.post(`${W}/invoices/${encodeURIComponent(c.inv)}/edit`, { scenario: doc.scenario, accountId: c.acc, issueDate: doc.issueDate, issueTime: doc.issueTime, profile: doc.profile, pricesIncludeVat: doc.pricesIncludeVat, lines: tiny, payment, note: doc.note || "", force: true }));
      }
    }
    doc = body(await client.get(`${W}/invoices/${encodeURIComponent(c.inv)}`)) || {}; // Düzenle satırları yeniden yazar (yeni kalem kimlikleri) — ölçülmez
  }
  const item = (doc.returnable || []).find(row => Number(row.left) > 0);
  if (!item) continue;
  const closeIt = closedDone < 3;
  if (!closeIt && openDone >= 3) continue;
  const tag = closeIt ? "KAPALI" : "AÇIK";
  if (closeIt) {
    const v = body(await client.get(`${W}/plans/${encodeURIComponent(c.plan)}`));
    const r = await time(`Kartı Kapat PUT`, () => client.put(`${W}/plans/${encodeURIComponent(c.plan)}`, { status: "closed", closeRemaining: v.totals.remaining }));
    if (r.status !== 200) continue;
  }
  const ret = await time(`iade yazımı (${tag} kart)`, () => client.post(`${W}/invoices`, { kind: "sale_return", accountId: c.acc, originalId: c.inv, issueDate: "2026-10-08", lines: [{ originLineId: item.lineId || item.id || item.originLineId, qty: Math.min(1, Number(item.left)) }], payment: { cash: [] }, force: true }));
  if (ret.status !== 200) continue;
  await time(`kart penceresi GET (iade sonrası)`, () => client.get(`${W}/plans/${encodeURIComponent(c.plan)}`));
  await time(`iade İptal Et (${tag} kart — büyüme)`, () => client.post(`${W}/invoices/${encodeURIComponent(body(ret).id)}/cancel`, { reason: "hız" }));
  if (closeIt) closedDone += 1;
  else openDone += 1;
}
// Fatura İptal Et (kartlı caride; kapsam seçimi okunur) — kalan adaylardan en çok 3 (iadesi yok, taksitsiz satış).
let cancels = 0;
for (const c of candidates.slice(6)) {
  if (cancels >= 3) break;
  const r = await time(`fatura İptal Et (kartlı cari)`, () => client.post(`${W}/invoices/${encodeURIComponent(c.inv)}/cancel`, { reason: "hız" }));
  if (r.status === 200) cancels += 1;
}
for (let i = 0; i < 5; i += 1) {
  await time(`zil / gecikmiş GET`, () => client.get(`${W}/dues`));
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
