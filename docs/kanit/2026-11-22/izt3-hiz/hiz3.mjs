// HIZ (ders 47, 53 (a)) — İzleyen tur 3 (izt3): değişen her yol, temiz 100 bin satır (KOPYADA). Kullanım: node hiz3.mjs <kod kökü> <veri kopyası>
// Yollar: kart penceresi GET, fatura kartı GET; fatura Düzenle (aynı içerik / azaltma / büyük azaltma — azaltma ilk Düzenle'nin yeniden yazdığı satırların rowid'ini yeniden kullanır),
// YENİ kaydedilmiş faturanın Düzenle azaltması; iade yazımı (fatura iadesi); stok iadesi (faturasız) yazımı / düzeltme / silme / Silinenler'den geri yükleme; sıradan stok hareketi düzeltme / silme;
// bütünlük taraması (Mutabakat Testi — Yönetim › Sistem); Dönem Kilidi kilitle / aç. Düzenle'lerde kapı yolu (scoped / full + neden) ayrıca sayılır.
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
const gates = {};
async function time(label, call, { gate = false } = {}) {
  h.reset();
  const t = performance.now();
  const res = await call();
  const ms = performance.now() - t;
  rows.push({ label, ms, loop: h.max / 1e6, status: res.status });
  if (res.status !== 200) console.log(`  ${label}: durum ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  if (gate) {
    const g = app.integrity.stats().gate;
    const key = `${label} → ${g ? (g.path === "full" ? `full(${g.reason})` : "scoped") : "?"}`;
    gates[key] = (gates[key] || 0) + 1;
  }
  return res;
}
const editBody = (doc, acc, lines, payment) => ({ scenario: doc.scenario, accountId: acc, issueDate: doc.issueDate, issueTime: doc.issueTime, profile: doc.profile, pricesIncludeVat: doc.pricesIncludeVat, lines, payment, note: doc.note || "", force: true });
const linesOf = doc => (doc.lines || []).map(l => ({ itemId: l.itemId || "", code: l.code || "", name: l.name, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice, discountRate: l.discountRate || 0, vatRate: l.vatRate, withholdingCode: l.withholdingCode || "", exemptionCode: l.exemptionCode || "" }));
const payOf = doc => ({ cash: (doc.payment?.cash || []).map(x => ({ amount: String(x.amount), method: x.method, lineKey: x.lineKey, bankAccountId: x.bankAccountId || "" })), cheques: [], endorse: [], rest: "account", dueDate: doc.dueDate || "" });
const candidates = s.all(`SELECT i.id AS inv, p.id AS plan, i.account_id AS acc, (SELECT COUNT(*) FROM account_entries e WHERE e.account_id = i.account_id) AS n
  FROM invoices i JOIN plans p ON p.account_id = i.account_id AND p.deleted_at IS NULL AND p.status = 'active' AND p.covers_balance = 1 AND p.invoice_id = ''
  WHERE i.status = 'issued' AND i.kind = 'sale' AND i.plan_id = '' AND COALESCE(NULLIF(i.issued_at, ''), i.created_at) <= p.created_at
    AND NOT EXISTS (SELECT 1 FROM invoices r WHERE r.original_id = i.id AND r.status = 'issued')
  GROUP BY i.account_id ORDER BY n DESC LIMIT 12`);
const goods = s.all("SELECT id, name, unit, sale_price AS price FROM stock_items WHERE deleted_at IS NULL AND kind IN ('product', 'goods') ORDER BY rowid LIMIT 8");
console.log(`aday ${candidates.length} · ürün ${goods.length}`);
let edits = 0;
let fresh = 0;
let returns = 0;
let stockDone = 0;
for (const [k, c] of candidates.entries()) {
  if (edits >= 4 && fresh >= 3 && returns >= 3 && stockDone >= 4) break;
  await time("kart penceresi GET", () => client.get(`${W}/plans/${encodeURIComponent(c.plan)}`));
  const got = await time("fatura kartı GET", () => client.get(`${W}/invoices/${encodeURIComponent(c.inv)}`));
  let doc = body(got) || {};
  if (edits < 4 && doc.canModify) {
    const lines = linesOf(doc);
    const payment = payOf(doc);
    const r = await time("fatura Düzenle (aynı içerik)", () => client.post(`${W}/invoices/${encodeURIComponent(c.inv)}/edit`, editBody(doc, c.acc, lines, payment)), { gate: true });
    if (r.status === 200) edits += 1;
    const big = lines.findIndex(l => Number(l.qty) >= 2);
    if (r.status === 200 && big >= 0) {
      const less = lines.map((l, i) => (i === big ? { ...l, qty: Number(l.qty) - 1 } : l));
      await time("fatura Düzenle (azaltma)", () => client.post(`${W}/invoices/${encodeURIComponent(c.inv)}/edit`, editBody(doc, c.acc, less, payment)), { gate: true });
      const most = lines.findIndex(l => Number(l.qty) >= 3);
      if (most >= 0) {
        const tiny = lines.map((l, i) => (i === most ? { ...l, qty: 1 } : i === big ? { ...l, qty: Number(l.qty) - 1 } : l));
        await time("fatura Düzenle (büyük azaltma)", () => client.post(`${W}/invoices/${encodeURIComponent(c.inv)}/edit`, editBody(doc, c.acc, tiny, payment)), { gate: true });
      }
    }
    doc = body(await client.get(`${W}/invoices/${encodeURIComponent(c.inv)}`)) || {};
  }
  // YENİ kaydedilmiş faturanın Düzenle azaltması (stok hareketleri tablonun son satırları).
  if (fresh < 3 && goods.length) {
    const g = goods[k % goods.length];
    const made = body(await client.post(`${W}/invoices`, { scenario: "goods_sale", accountId: c.acc, issueDate: "2026-10-08", lines: [{ itemId: g.id, name: g.name, unit: g.unit, qty: 3, unitPrice: 250, vatRate: 20 }], payment: { rest: "account" }, force: true }));
    if (made?.id) {
      const d = body(await client.get(`${W}/invoices/${encodeURIComponent(made.id)}`)) || {};
      const r = await time("YENİ fatura Düzenle (azaltma)", () => client.post(`${W}/invoices/${encodeURIComponent(made.id)}/edit`, editBody(d, c.acc, linesOf(d).map(l => ({ ...l, qty: 2 })), payOf(d))), { gate: true });
      if (r.status === 200) fresh += 1;
    }
  }
  const item = (doc.returnable || []).find(row => Number(row.left) > 0);
  if (item && returns < 3) {
    const ret = await time("iade yazımı (fatura iadesi)", () => client.post(`${W}/invoices`, { kind: "sale_return", accountId: c.acc, originalId: c.inv, issueDate: "2026-10-08", lines: [{ originLineId: item.lineId || item.id || item.originLineId, qty: Math.min(1, Number(item.left)) }], payment: { cash: [] }, force: true }));
    if (ret.status === 200) returns += 1;
  }
  // Faturasız stok iadesi (açık hesap — kartlı cari) ve sıradan stok hareketi: yazım / düzeltme / silme / geri yükleme.
  if (stockDone < 4 && goods.length) {
    const g = goods[(k + 3) % goods.length];
    const made = await time("stok iadesi yazımı", () => client.post(`${W}/stock/${encodeURIComponent(g.id)}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "300", pay: "account", accountId: c.acc, date: "2026-10-08" }));
    const moveId = body(made)?.moveId;
    if (made.status === 200 && moveId) {
      await time("stok iadesi düzeltme", () => client.put(`${W}/stock/${encodeURIComponent(g.id)}/moves/${encodeURIComponent(moveId)}`, { qty: "2", unitPrice: "300" }));
      const del = await time("stok iadesi silme", () => client.del(`${W}/stock/${encodeURIComponent(g.id)}/moves/${encodeURIComponent(moveId)}`));
      if (del.status === 200) {
        const row = (body(await client.get("/api/admin/trash")) || []).find(x => x.kind === "stock-move" && x.ref === moveId);
        if (row) await time("stok iadesi geri yükleme", () => client.post("/api/admin/trash/restore", { id: row.id }));
      }
      stockDone += 1;
    }
    const out = body(await client.post(`${W}/stock/${encodeURIComponent(g.id)}/moves`, { kind: "out", qty: "1", unitPrice: "300", pay: "none", date: "2026-10-08", force: true }));
    if (out?.moveId) {
      await time("stok hareketi düzeltme (sıradan)", () => client.put(`${W}/stock/${encodeURIComponent(g.id)}/moves/${encodeURIComponent(out.moveId)}`, { qty: "2", unitPrice: "300", force: true }));
      await time("stok hareketi silme (sıradan)", () => client.del(`${W}/stock/${encodeURIComponent(g.id)}/moves/${encodeURIComponent(out.moveId)}`));
    }
  }
}
for (let i = 0; i < 2; i += 1) await time("bütünlük taraması (Mutabakat Testi)", () => client.get(`${W}/ledger/integrity`));
await time("Dönem Kilidi kilitle", () => client.put("/api/admin/period-lock", { lockedUntil: "2025-12-31" }));
await time("Dönem Kilidi aç", () => client.put("/api/admin/period-lock", { lockedUntil: "" }));
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
for (const [key, n] of Object.entries(gates)) console.log(`KAPI | ${key} | ${n}`);
console.log(`yük sonda ${load()}`);
await app.close();
