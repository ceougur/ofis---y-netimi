// C1 TUR 1 ölçüm verisi (ders 47; dar kontrol ORTA-1 kurgusu): programın KENDİ API'siyle — kod --kod ile verilen ayrı kopya (git archive; ders 23).
// C1 öncesi kod (35e90e47) üretir: üç sürüm (35e90e47, eaf6b988, fe5bcf27) aynı veriyi açar (sonrakiler göç v45'i açılışta uygular).
//   banka carisine M adet KDV'li EFT masraf fişi (Banka → Fiş, vat_incl: alış faturası + satırsız "fee" başlığı — vouchers.mjs writeSpec),
//   C caride toplam P adet gerçek POS tahsilatı (cari kartı → Tahsilat → POS), K caride POS'lu fatura → ertesi gün fatura silinir (Müşteriye İade Edildi →
//   POS İptal İadesi fişi, pos.mjs cancelRefund); sunucu kapanınca pos_sales ham satırla R toplamına uzatılır (ölçek benzetimi; dar kontrolün kurgusu).
// Kullanım: node olcum-veri-uret.mjs --kod <kopya> --hedef <klasör> [--m 600] [--p 2000] [--c 20] [--k 3] [--r 100000]
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const arg = (name, fallback = "") => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const kod = path.resolve(arg("kod"));
const hedef = path.resolve(arg("hedef"));
const M = Number(arg("m", "600"));
const P = Number(arg("p", "2000"));
const C = Number(arg("c", "20"));
const K = Number(arg("k", "3"));
const R = Number(arg("r", "100000"));
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const imp = rel => import(pathToFileURL(path.join(kod, rel)).href);
const { boot, must } = await imp("test/banka-210-ortak.mjs");
const { BANK, openAcceptanceAccounts, openPos, posInvoice, ziraatPos } = await imp("test/banka-220-pos-ortak.mjs");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

rmSync(hedef, { recursive: true, force: true });
mkdirSync(hedef, { recursive: true });
const dataDir = path.join(hedef, "data");
const backupDir = path.join(hedef, "backups");
const ctx = await boot({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true }, dataDir, backupDir, gateVerify: false, moneyStrict: false, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const ids = { bankParty: "", posCustomers: [], cancelCustomers: [] };
const sure = {};
try {
  const acc = await openAcceptanceAccounts(ctx.api);
  const pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id));
  const bankParty = await must("banka carisi", ctx.api.post("/api/workspace/accounts", { name: "Ziraat Bankası A.Ş.", type: "supplier", registeredOn: "2026-09-01" }));
  ids.bankParty = bankParty.id;
  let t = performance.now();
  for (let i = 0; i < M; i += 1) {
    await must(`KDV'li masraf ${i + 1}`, ctx.api.post(`${BANK}/vouchers`, { type: "fee", accountId: acc.ziraat.id, amount: String(10 + (i % 50)), feeType: "eft", tax: "vat_incl", taxRate: "20", partyId: bankParty.id, invoiceNo: `ZB-2026-${String(i + 1).padStart(6, "0")}`, date: "2026-10-08", similarOk: true }));
  }
  sure.masrafMs = Math.round(performance.now() - t);
  log(`masraf fişi ${M}: ${sure.masrafMs} ms`);
  t = performance.now();
  for (let c = 0; c < C; c += 1) {
    const customer = await must("POS müşterisi", ctx.api.post("/api/workspace/accounts", { name: `POS Müşterisi ${c + 1}`, type: "customer", registeredOn: "2026-09-01" }));
    ids.posCustomers.push(customer.id);
    for (let i = 0; i < Math.ceil(P / C); i += 1) {
      await must("POS tahsilatı", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: String(10 + (i % 90)), date: "2026-10-08", method: "card", posId: pos.id, posInstallments: 1, similarOk: true }));
    }
  }
  sure.posMs = Math.round(performance.now() - t);
  log(`POS tahsilatı ${P}: ${sure.posMs} ms`);
  const item = await must("ürün", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "OLC", name: "Ölçüm Ürünü", unit: "Adet", openingQty: "100" }));
  const invoices = [];
  for (let k = 0; k < K; k += 1) {
    const buyer = await must("POS iadeli", ctx.api.post("/api/workspace/accounts", { name: `POS İadeli ${k + 1}`, type: "customer", registeredOn: "2026-09-01" }));
    ids.cancelCustomers.push(buyer.id);
    invoices.push(await must("POS'lu fatura", posInvoice(ctx.api, { accountId: buyer.id, itemId: item.id, name: "Ölçüm Ürünü", qty: 1, unitPrice: 1200 + k, date: "2026-10-08", posId: pos.id })));
  }
  ctx.server.clock.set("2026-10-09T10:00:00+03:00");
  for (const invoice of invoices) await must("faturayı sil (Müşteriye İade Edildi)", ctx.api.del(`/api/workspace/invoices/${invoice.id}?reason=olcum`));
} finally {
  await ctx.server.close();
}
// Ölçek benzetimi: pos_sales ham satırla R toplamına (dar kontrolün kurgusu; ölçülen yollar bu satırları yalnız tarar).
// Şirket 001'in veri dosyası (veri klasöründe pos_sales tablosu olan destekofis.sqlite).
const files = readdirSync(dataDir, { recursive: true }).map(rel => path.join(dataDir, String(rel))).filter(full => path.basename(full) === "destekofis.sqlite");
const file = files.find(full => {
  const probe = new DatabaseSync(full, { readOnly: true });
  try {
    return Boolean(probe.prepare("SELECT 1 AS f FROM sqlite_master WHERE type = 'table' AND name = 'pos_sales'").get());
  } finally {
    probe.close();
  }
}) || "";
if (!file) throw new Error(`pos_sales tablolu veri dosyası bulunamadı: ${files.join(", ")}`);
const db = new DatabaseSync(file);
const facts = {};
{
  const sample = db.prepare("SELECT pos_id AS posId, bank_account_id AS bankAccountId FROM pos_sales LIMIT 1").get();
  const have = db.prepare("SELECT COUNT(*) AS n FROM pos_sales").get().n;
  db.exec("BEGIN");
  const ps = db.prepare("INSERT INTO pos_sales (id, event_id, pos_id, kind, date, rate_ppm, tax_kind, tax_mode, tax_ppm, refund_commission, payout, bank_account_id, gross_minor, net_minor, created_by, created_at) VALUES (?, ?, ?, 'sale', '2026-09-01', 25000, 'bsmv', 'included', 50000, 'none', 'single', ?, 1000, 975, 'olcum', '2026-09-01T00:00:00Z')");
  for (let i = have; i < R; i += 1) ps.run(`ps-ham-${i}`, `ev-ham-${i}`, sample.posId, sample.bankAccountId);
  db.exec("COMMIT");
  Object.assign(facts, db.prepare("SELECT (SELECT COUNT(*) FROM pos_sales) AS posSales, (SELECT COUNT(*) FROM fin_events WHERE type = 'fee' AND src_table = '' AND party_id = ?1) AS masrafBasligi, (SELECT COUNT(*) FROM invoices WHERE account_id = ?1) AS bankaFaturasi, (SELECT COUNT(*) FROM fin_events WHERE type = 'pos_cancel_refund') AS iptalIadesi, (SELECT COUNT(*) FROM accounts) AS cari, (SELECT COUNT(*) FROM account_entries) AS cariSatiri, (SELECT COUNT(*) FROM fin_events) AS finEvents").get(ids.bankParty));
}
db.close();
writeFileSync(path.join(hedef, "veri.json"), `${JSON.stringify({ kod, M, P, C, K, R, ids, sure, facts: { ...facts }, dosya: file }, null, 1)}\n`);
log("veri", JSON.stringify(facts));
