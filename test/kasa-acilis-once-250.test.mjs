// 2.5.0 Ç5-K — Kasa açılış kuralları (tasarım docs/erp/C5K-KASA-TASARIM.md; kararlar docs/2.5.0-IS-LISTESI.md D, AYNEN):
//   S12 = A  Kasa açılışından ÖNCE tarihli YENİ Kasa hareketi bankadaki gibi reddedilir (409 cash-before-opening; kâhin KASA_ACILIS_ONCE). Kapsam 100'e yazan
//            HER kaynak (kâhin T9); aynı gün olur (T10); açılış yoksa kural yok (T11).
//   B11      (BAŞ MİMAR, kâhin T12) düzeltme de reddedilir: tarihi açılıştan önceye alan ya da açılıştan önce tarihli kaydı Kasa'ya çeviren düzeltme.
//   S20 = A  yedekte / eski sürüm verisinde açılıştan önceki nakit satırı AYNEN gelir; Mutabakat Testi uyarı ("Kasa Açılışından Önce Tarihli Hareket").
//   S26 / S40 / S44 = A  böyle kaydın tarihi değişmeden tutarı, açıklaması, carisi, fatura / taksit bağı, "Normal Cari Hesaba İşle" seçimi düzeltilebilir; uyarı sürer.
//   Z9       (BAŞ MİMAR 07:59) Silinenler'den geri alınan da aynı.
//   S45 = A  bağlıysa carisinin düzeltilmesi "önce bağı kaldırın" ile red — programda cari hareketinin carisini değiştiren yol YOK (tasarım §4): gösterilir.
//   R8 / EK-2B 33  Kasa açılışı ilk nakit hareketinden sonraya düzeltmede de 409 (bugünkü kod; tasarım §5).
//   S54–S57  SORULDU, yanıt yok: bugünkü davranış ölçülür, "S5x yanıtı bekleniyor" diye işaretli.
// Eski sürüm verisi v2.4.9'un GERÇEK koduyla (test/guvenilirlik/surumler.mjs, etiketin ayrı kopyası — ders 17, 23) üretilir; göç ve yedekten geri yükleme ayrı.
// Sahte saat (config.now; ders 13, 22); iki saat diliminde koşulur (TZ=UTC, TZ=Europe/Istanbul). Lisans servisi yerel ölü adres (ders 30).
//
// NASIL BOZARIM (tasarım §7b): bir yol denetimden kaçar; aynı gün reddedilir; açılışsız Kasa'da her nakit reddedilir; tarihi önceye çeken düzeltme geçer ya da tarih
// değişmeyen düzeltme reddedilir; havale → nakit çevirme geçer; fatura Düzenle / Taksite Aktar "yeni" sayılır; Silinenler reddedilir; yedek / göç satırı bozulur ya da
// uyarı yok / kırmızı; önbellek bayatlar (açılış öne alınınca eski tarih); iki şirket karışır; ret yarım yazım bırakır; gün dönümünde yanlış gün.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = "2026-03-20T12:00:00";
const OPEN = "2026-03-10"; // Kasa açılışı
const BEFORE = "2026-03-09";
const AFTER = "2026-03-11";
const EARLY = "2026-03-05";

const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error });
const apiOf = client => ({
  client,
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${res.code || ""} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
const refused = async (label, promise, status = 409, code = "cash-before-opening") => {
  const res = await promise;
  assert.equal(res.status, status, `${label}: beklenen ${status} ${code}, gelen ${res.status} ${res.code || ""} ${JSON.stringify(res.data).slice(0, 300)}`);
  if (code) assert.equal(res.code, code, `${label}: kod ${res.code} (beklenen ${code}) — ${String(res.error || "").slice(0, 200)}`);
  return res;
};
// Ret yarım yazım bırakmaz (ders 3): para tablolarının, olayların, belgelerin satır sayısı ve rowid toplamı aynı.
const TABLES = ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events", "fin_events", "invoices", "cheques", "plans"];
const snapshot = store => JSON.stringify(TABLES.map(table => store.get(`SELECT COUNT(*) AS n, COALESCE(SUM(rowid), 0) AS r FROM ${table}`)));
const cashBalance = async api => (await must("Kasa", api.get("/api/workspace/cash"))).totals.balance;
const integrityOf = async api => must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
const warningOf = integrity => (integrity.checks || []).find(item => item.code === "cash:before-opening") || null;
// Mutabakat Testi: uyarı dışında sapma yok.
const assertIntegrity = (integrity, label) => {
  const hard = (integrity.failures || []).filter(item => item.severity !== "warning");
  assert.deepEqual(hard.map(item => item.code), [], `${label}: uyarı dışı sapma ${JSON.stringify(hard).slice(0, 400)}`);
};
const idOf = data => data?.id || data?.account?.id || data?.item?.id || data?.plan?.id || data?.cheque?.id || data?.invoice?.id || "";

// ---------- Kurulum: cari, banka, ürün, kart, çekler, fatura (bütün yolların ön koşulları; hepsi açılıştan önce de olur — nakit değil) ----------
async function setup(api) {
  await api.post("/api/workspace/bank/setup/dismiss", {});
  const bank = await must("banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Vadesiz", kind: "demand", currency: "TRY", opening: { date: "2026-01-01", amount: "500.000", confirmed: true } }));
  const bankId = idOf(bank);
  await must("banka ayarı", api.put(`/api/workspace/bank/accounts/${bankId}`, { usePos: true, useCheque: true, useNote: true, negativePolicy: "off" }));
  const customer = idOf(await must("müşteri", api.post("/api/workspace/accounts", { name: "Ayşe Nakit", type: "customer", registeredOn: "2026-01-01", similarOk: true, force: true })));
  const supplier = idOf(await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tedarik Nakit", type: "supplier", registeredOn: "2026-01-01", similarOk: true, force: true })));
  const item = idOf(await must("ürün", api.post("/api/workspace/stock", { name: "Kalem", unit: "Adet", kind: "product", code: "K-1", unitPrice: "10,00", vatRate: "20" })));
  const plan = idOf(await must("taksit kartı", api.post("/api/workspace/plans", { accountId: customer, name: "Ayşe Kartı", total: "10.000,00", registeredOn: "2026-01-02", mode: "auto", count: 2, firstDue: "2026-04-01" })));
  const sale = await must("satış faturası (iade için)", api.post("/api/workspace/invoices", { kind: "sale", accountId: customer, issueDate: "2026-03-01", lines: [{ name: "Hizmet", qty: 10, unitPrice: "100,00", vatRate: 20 }], payment: { cash: [], rest: "open" }, force: true }));
  const saleId = idOf(sale);
  const saleCard = await must("fatura kartı", api.get(`/api/workspace/invoices/${saleId}`));
  return { bankId, customer, supplier, item, plan, saleId, saleLine: saleCard.lines[0].id };
}
let serial = 0;
const chequeIn = async (api, ctx) => idOf(await must("alınan çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", accountId: ctx.customer, issueDate: "2026-03-01", dueDate: "2026-03-01", serialNo: `CI-${++serial}`, bank: "Akbank", drawer: "Ayşe Nakit" })));
const chequeOut = async (api, ctx) => idOf(await must("verilen çek", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "200", accountId: ctx.supplier, issueDate: "2026-03-01", dueDate: "2026-03-01", serialNo: `CO-${++serial}`, bank: "Ziraat", drawer: "Biz", bankAccountId: ctx.bankId })));

// 100'e yazan yollar (tasarım §1; kâhin T9). run(api, ctx, date) → yanıt. Her yol bir gün önce / aynı gün / sonra denenir.
const FORCE = { cashForce: true, similarOk: true, force: true, exceedOk: true };
const PATHS = [
  ["1 Kasa Giriş", (api, ctx, date) => api.post("/api/workspace/cash", { kind: "in", amount: "100", date, description: "Kasaya giriş", method: "cash", ...FORCE })],
  ["1b Kasa Çıkış", (api, ctx, date) => api.post("/api/workspace/cash", { kind: "out", amount: "10", date, description: "Kırtasiye", method: "cash", ...FORCE })],
  ["2 Bankadan Kasaya", (api, ctx, date) => api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "50", date, bankAccountId: ctx.bankId, ...FORCE })],
  ["2b Kasadan Bankaya", (api, ctx, date) => api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "5", date, bankAccountId: ctx.bankId, ...FORCE })],
  ["3 Kasa'dan Vergi Ödemesi", (api, ctx, date) => api.post("/api/workspace/tax/payments", { way: "cash", date, taxType: "kdv", amount: "7", description: "KDV", ...FORCE })],
  ["4 cari nakit tahsilat", (api, ctx, date) => api.post(`/api/workspace/accounts/${ctx.customer}/entries`, { kind: "in", amount: "40", date, method: "cash", note: "nakit", ...FORCE })],
  ["4b cari nakit ödeme", (api, ctx, date) => api.post(`/api/workspace/accounts/${ctx.supplier}/entries`, { kind: "out", amount: "4", date, method: "cash", note: "nakit", ...FORCE })],
  ["5 satış faturası peşin nakit", (api, ctx, date) => api.post("/api/workspace/invoices", { kind: "sale", accountId: ctx.customer, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: "100,00", vatRate: 20 }], payment: { cash: [{ amount: "120,00", method: "cash", lineKey: "p1" }], rest: "open" }, ...FORCE })],
  ["5b satıştan iade nakit para iadesi", (api, ctx, date) => api.post("/api/workspace/invoices", { kind: "sale_return", originalId: ctx.saleId, issueDate: date, lines: [{ originLineId: ctx.saleLine, qty: 1 }], payment: { cash: [{ amount: "120,00", method: "cash", lineKey: "r1" }] }, ...FORCE })],
  ["6 taksit tahsilatı nakit", (api, ctx, date) => api.post(`/api/workspace/plans/${ctx.plan}/entries`, { kind: "in", amount: "25", date, method: "cash", ...FORCE })],
  ["7 kayıt tahsilatı", (api, ctx, date) => api.post("/api/workspace/cases/DOSYA-NAKIT/payments", { amount: "15", date, method: "cash", caseTitle: "Dosya Nakit" })],
  ["9 çekin Kasa'dan tahsili", async (api, ctx, date) => api.post(`/api/workspace/cheques/${await chequeIn(api, ctx)}/actions`, { action: "collect", date, method: "cash", ...FORCE })],
  ["9b verilen çekin nakit ödemesi", async (api, ctx, date) => api.post(`/api/workspace/cheques/${await chequeOut(api, ctx)}/actions`, { action: "pay", date, method: "cash", ...FORCE })],
  ["10 nakit stok alımı", (api, ctx, date) => api.post(`/api/workspace/stock/${ctx.item}/moves`, { kind: "in", qty: "1", unitPrice: "10,00", pay: "cash", method: "cash", date, note: "nakit alım", ...FORCE })],
  ["10b nakit stok satışı", (api, ctx, date) => api.post(`/api/workspace/stock/${ctx.item}/moves`, { kind: "out", qty: "1", unitPrice: "12,00", pay: "cash", method: "cash", date, note: "nakit satış", ...FORCE })],
];
// Nakit OLMAYAN eşler: Kasa'ya dokunmaz, açılıştan önce de olur (kâhin T9 "Kasa'ya dokunmayan kayıt").
const NON_CASH = [
  ["cari havale tahsilatı", (api, ctx, date) => api.post(`/api/workspace/accounts/${ctx.customer}/entries`, { kind: "in", amount: "40", date, method: "bank", bankAccountId: ctx.bankId, ...FORCE })],
  ["Borç Yaz", (api, ctx, date) => api.post(`/api/workspace/accounts/${ctx.customer}/entries`, { kind: "debt", amount: "40", date, note: "borç" })],
  ["açık hesap alış faturası", (api, ctx, date) => api.post("/api/workspace/invoices", { kind: "purchase", accountId: ctx.supplier, number: `A-${++serial}`, issueDate: date, scenario: "expense_purchase", lines: [{ name: "Gider", qty: 1, unitPrice: "50,00", vatRate: 20, expenseCode: "other" }], payment: { cash: [], rest: "open" }, force: true })],
  ["çek alma", (api, ctx, date) => api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", accountId: ctx.customer, issueDate: date, dueDate: "2026-04-01", serialNo: `CX-${++serial}`, bank: "Akbank", drawer: "Ayşe Nakit" })],
  ["kayıt havale tahsilatı", (api, ctx, date) => api.post("/api/workspace/cases/DOSYA-HAVALE/payments", { amount: "15", date, method: "bank", bankAccountId: ctx.bankId, caseTitle: "Dosya Havale" })],
  ["açık hesaba stok", (api, ctx, date) => api.post(`/api/workspace/stock/${ctx.item}/moves`, { kind: "in", qty: "1", unitPrice: "10,00", pay: "account", accountId: ctx.supplier, date, note: "açık hesap", ...FORCE })],
];

describe("Ç5-K S12 = A: Kasa açılışından ÖNCE tarihli YENİ nakit hareketi her yolda 409; aynı gün ve sonra 200", () => {
  let server;
  let api;
  let ctx;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    ctx = await setup(api);
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "100.000", date: OPEN }));
  });
  after(() => server?.close());

  for (const [name, run] of PATHS) {
    it(`${name}: ${BEFORE} → 409 cash-before-opening (hiçbir şey yazılmaz), ${OPEN} (aynı gün) → 200, ${AFTER} → 200`, async () => {
      const kasa = await cashBalance(api);
      const before_ = snapshot(server.app.store);
      const res = await refused(`${name} açılıştan bir gün önce`, run(api, ctx, BEFORE));
      assert.equal(res.data?.openingDate, OPEN, "ret gövdesinde açılış günü");
      assert.equal(res.data?.date, BEFORE, "ret gövdesinde işlem günü");
      assert.match(String(res.error || ""), /Kasa açılışından \(10\.03\.2026\) önce/, "ileti nedeni söyler");
      // Çek yolları ret öncesi kendi çekini yazar (ön koşul); karşılaştırma çeki yazdıktan sonraki hâlle.
      if (!name.includes("çek")) assert.equal(snapshot(server.app.store), before_, `${name}: ret yarım yazım bıraktı (ders 3)`);
      assert.equal(await cashBalance(api), kasa, `${name}: Kasa değişmemeli`);
      await must(`${name} aynı gün`, run(api, ctx, OPEN));
      await must(`${name} sonra`, run(api, ctx, AFTER));
    });
  }

  it("nakit OLMAYAN eşleri açılıştan önce de 200 (Kasa'ya dokunmaz)", async () => {
    for (const [name, run] of NON_CASH) await must(`${name} ${BEFORE}`, run(api, ctx, BEFORE));
  });

  it("Mutabakat Testi temiz (yeni kural uyarı üretmez: açılıştan önce satır yok)", async () => {
    const integrity = await integrityOf(api);
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 500));
    assert.equal(warningOf(integrity), null, "açılıştan önce satır yokken uyarı yok");
  });

});

describe("Ç5-K B11 / T12 (düzeltme) — her test kendi kayıtlarıyla (eski kodda kırmızının nedeni S12'nin yokluğu)", () => {
  let server;
  let api;
  let ctx;
  const rows = {};
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    ctx = await setup(api);
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "100.000", date: OPEN }));
    const store = server.app.store;
    rows.cash = idOf(await must("Kasa Giriş", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: AFTER, description: "Kasaya giriş", method: "cash" })));
    rows.account = (await must("cari tahsilat", api.post(`/api/workspace/accounts/${ctx.customer}/entries`, { kind: "in", amount: "40", date: AFTER, method: "cash", note: "nakit" }))).entryId;
    rows.wire = (await must("havale tahsilat (açılıştan önce, nakit değil)", api.post(`/api/workspace/accounts/${ctx.customer}/entries`, { kind: "in", amount: "40", date: BEFORE, method: "bank", bankAccountId: ctx.bankId, ...FORCE }))).entryId;
    rows.payment = idOf(await must("kayıt tahsilatı", api.post("/api/workspace/cases/DOSYA-T12/payments", { amount: "15", date: AFTER, method: "cash", caseTitle: "T12" })));
    await must("taksit tahsilatı", api.post(`/api/workspace/plans/${ctx.plan}/entries`, { kind: "in", amount: "25", date: AFTER, method: "cash" }));
    rows.plan = store.get("SELECT id FROM plan_entries WHERE plan_id = ? AND date = ? AND opening = 0", ctx.plan, AFTER).id;
    await must("stok", api.post(`/api/workspace/stock/${ctx.item}/moves`, { kind: "in", qty: "1", unitPrice: "10,00", pay: "cash", method: "cash", date: AFTER, note: "nakit alım", ...FORCE }));
    rows.move = store.get("SELECT id FROM stock_moves WHERE item_id = ? AND date = ? AND pay = 'cash' AND kind = 'in'", ctx.item, AFTER).id;
    rows.transfer = (await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "50", date: AFTER, bankAccountId: ctx.bankId, ...FORCE }))).id;
  });
  after(() => server?.close());

  it("B11 / T12: düzeltmeyle tarihi açılıştan önceye çekmek 409 (satır değişmez); açılış günü 200 — Kasa Giriş, cari, kayıt, taksit, stok, transfer", async () => {
    const store = server.app.store;
    const res = await refused("Kasa Giriş tarihi önceye", api.put(`/api/workspace/cash/${rows.cash}`, { kind: "in", amount: "100", date: BEFORE, description: "Kasaya giriş" }));
    assert.equal(res.data?.change, true, "düzeltme reddi işaretli");
    assert.match(String(res.error || ""), /Düzeltmeyle hareketin tarihi \(09\.03\.2026\)/);
    assert.equal(store.get("SELECT date FROM cash_entries WHERE id = ?", rows.cash).date, AFTER, "satır değişmedi");
    await must("açılış gününe", api.put(`/api/workspace/cash/${rows.cash}`, { kind: "in", amount: "100", date: OPEN, description: "Kasaya giriş" }));
    await refused("cari tahsilat tarihi önceye", api.put(`/api/workspace/accounts/${ctx.customer}/entries/${rows.account}`, { kind: "in", amount: "40", date: BEFORE, method: "cash", note: "nakit" }));
    assert.equal(store.get("SELECT date FROM account_entries WHERE id = ?", rows.account).date, AFTER);
    await refused("kayıt tahsilatı tarihi önceye", api.put(`/api/workspace/payments/${rows.payment}`, { amount: "15", date: BEFORE, method: "cash" }));
    await refused("taksit tahsilatı tarihi önceye", api.put(`/api/workspace/plans/${ctx.plan}/entries/${rows.plan}`, { kind: "in", amount: "25", date: BEFORE, method: "cash" }));
    await refused("stok hareketi tarihi önceye", api.put(`/api/workspace/stock/${ctx.item}/moves/${rows.move}`, { kind: "in", qty: "1", unitPrice: "10,00", pay: "cash", method: "cash", date: BEFORE, note: "nakit alım", ...FORCE }));
    await refused("transfer tarihi önceye", api.put(`/api/workspace/cash/${rows.transfer}`, { kind: "in", amount: "50", date: BEFORE, description: "Bankadan Kasaya Aktarım", ...FORCE }));
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE transfer_id = (SELECT transfer_id FROM cash_entries WHERE id = ?) AND date = ?", rows.transfer, AFTER).n, 2, "transferin iki bacağı yerinde");
  });

  it("B11 / T12: açılıştan önce tarihli havale tahsilatını NAKDE çeviren düzeltme 409 (converted); havale olarak kalır", async () => {
    const res = await refused("havale → nakit", api.put(`/api/workspace/accounts/${ctx.customer}/entries/${rows.wire}`, { kind: "in", amount: "40", date: BEFORE, method: "cash", note: "nakde çevir" }));
    assert.match(String(res.error || ""), /nakde \(Kasa'ya\) çevrilirse/);
    assert.equal(server.app.store.get("SELECT method FROM account_entries WHERE id = ?", rows.wire).method, "bank");
    await must("havale → nakit, tarih açılış günü", api.put(`/api/workspace/accounts/${ctx.customer}/entries/${rows.wire}`, { kind: "in", amount: "40", date: OPEN, method: "cash", note: "nakde çevir" }));
  });
});

describe("Ç5-K R8 (açılışın düzeltilmesi) — ayrı şirket verisi", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "100.000", date: OPEN }));
    await must("açılış günü Kasa Giriş (ilk hareket)", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: OPEN, description: "ilk", method: "cash" }));
  });
  after(() => server?.close());

  it("R8: açılışı ilk nakit hareketinden sonraya almak düzeltmede de 409 (tarih ve tutar biçimleri); öne almak 200 ve kural yeni tarihle işler (önbellek bayatlamaz)", async () => {
    const opening = (await must("açılış", api.get("/api/workspace/cash/opening"))).opening;
    await refused("açılışı sonraya", api.post("/api/workspace/cash/opening", { amount: "100.000", date: AFTER }), 409, "cash-opening-after-first");
    await refused("Kasa satırından açılışı sonraya", api.put(`/api/workspace/cash/${opening.id}`, { kind: "in", amount: "100.000", date: AFTER, description: opening.description }), 409, "cash-opening-after-first");
    await must("yalnız tutar (tarih aynı)", api.post("/api/workspace/cash/opening", { amount: "90.000", date: OPEN }));
    await must("açılışı öne al", api.post("/api/workspace/cash/opening", { amount: "90.000", date: EARLY }));
    await refused("yeni açılıştan önce", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: "2026-03-04", description: "x", method: "cash" }));
    await must("eski açılıştan önce, yeni açılıştan sonra", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: BEFORE, description: "x", method: "cash" }));
    await refused("açılışı ilk hareketin (09.03) sonrasına", api.post("/api/workspace/cash/opening", { amount: "90.000", date: OPEN }), 409, "cash-opening-after-first");
  });
});

describe("Ç5-K T11: açılışsız Kasa'da kural yok; açılış sonradan girilir", () => {
  let server;
  let api;
  let ctx;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    ctx = await setup(api);
  });
  after(() => server?.close());

  it("açılış yokken bütün yollar her tarihte 200; açılış (≤ ilk hareket) girilince kural işler; ilk hareketten sonraya açılış 409", async () => {
    for (const [name, run] of PATHS) await must(`${name} ${EARLY} (açılışsız)`, run(api, ctx, EARLY));
    await refused("açılış ilk hareketten sonra", api.post("/api/workspace/cash/opening", { amount: "1.000", date: OPEN }), 409, "cash-opening-after-first");
    await must("açılış ilk hareket günü", api.post("/api/workspace/cash/opening", { amount: "1.000", date: EARLY }));
    await refused("açılıştan önce Kasa Giriş", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: "2026-03-04", description: "x", method: "cash" }));
    await must("açılış günü Kasa Giriş", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: EARLY, description: "x", method: "cash" }));
    const integrity = await integrityOf(api);
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 500));
  });
});

describe("Ç5-K Z9 + S26 / S40 / S44: Silinenler'den geri alınan açılış öncesi kayıt aynen döner, tarihi değişmeden düzeltilir, uyarı sürer", () => {
  let server;
  let api;
  let ctx;
  const restored = {};
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    ctx = await setup(api);
    // Açılış yokken açılıştan önceki günlere nakit hareketleri; sonra silinir, açılış girilir, Silinenler'den geri alınır.
    restored.cash = idOf(await must("Kasa Giriş", api.post("/api/workspace/cash", { kind: "in", amount: "100", date: EARLY, description: "eski giriş", method: "cash" })));
    const transfer = await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "60", date: EARLY, bankAccountId: ctx.bankId }));
    restored.transfer = transfer.id;
    const acc = await must("cari tahsilat", api.post(`/api/workspace/accounts/${ctx.customer}/entries`, { kind: "in", amount: "70", date: EARLY, method: "cash", note: "eski tahsilat" }));
    restored.account = acc.entryId;
    restored.payment = idOf(await must("kayıt tahsilatı", api.post("/api/workspace/cases/DOSYA-ESKI/payments", { amount: "30", date: EARLY, method: "cash", caseTitle: "Eski" })));
    const plan = await must("taksit tahsilatı", api.post(`/api/workspace/plans/${ctx.plan}/entries`, { kind: "in", amount: "20", date: EARLY, method: "cash" }));
    restored.plan = plan.entryId || server.app.store.get("SELECT id FROM plan_entries WHERE plan_id = ? AND date = ? AND opening = 0", ctx.plan, EARLY).id;
    await must("Kasa Giriş sil", api.del(`/api/workspace/cash/${restored.cash}`));
    await must("transfer sil", api.del(`/api/workspace/cash/${restored.transfer}`));
    await must("cari tahsilat sil", api.del(`/api/workspace/accounts/${ctx.customer}/entries/${restored.account}`));
    await must("kayıt tahsilatı sil", api.del(`/api/workspace/payments/${restored.payment}`));
    await must("taksit tahsilatı sil", api.del(`/api/workspace/plans/${ctx.plan}/entries/${restored.plan}`));
    await must("Kasa açılışı (silinenlerden sonra)", api.post("/api/workspace/cash/opening", { amount: "5.000", date: OPEN }));
  });
  after(() => server?.close());

  it("Silinenler'den geri yükleme 200 (S12 uygulanmaz); Mutabakat Testi 'Kasa Açılışından Önce Tarihli Hareket' UYARI (5 satır), sapma yok", async () => {
    const listed = await must("Silinenler", api.get("/api/admin/trash"));
    const items = Array.isArray(listed) ? listed : listed.items || [];
    for (const ref of [restored.cash, restored.account, restored.payment, restored.plan, restored.transfer]) {
      const item = items.find(row => row.ref === ref);
      assert.ok(item, `Silinenler'de ${ref} var`);
      await must(`geri yükle ${ref}`, api.post("/api/admin/trash/restore", { id: item.id }));
    }
    const integrity = await integrityOf(api);
    assertIntegrity(integrity, "geri yüklemeden sonra");
    const warning = warningOf(integrity);
    assert.ok(warning, "Mutabakat Testi uyarısı var");
    assert.equal(warning.severity, "warning");
    assert.equal(warning.name, "Kasa Açılışından Önce Tarihli Hareket");
    assert.equal(warning.count, 5, JSON.stringify(warning));
    assert.equal(warning.opening, OPEN);
  });

  it("YENİ açılış öncesi hareket geri yüklemeden sonra da 409 (S12 yalnız yeni kayıtta)", async () => {
    await refused("yeni Kasa Giriş", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: EARLY, description: "yeni", method: "cash" }));
  });

  it("S26 / S40: tarihi değişmeden tutar ve açıklama düzeltmesi 200; uyarı sürer (sayı aynı)", async () => {
    await must("Kasa Giriş tutar + açıklama", api.put(`/api/workspace/cash/${restored.cash}`, { kind: "in", amount: "150", date: EARLY, description: "eski giriş (düzeltildi)" }));
    await must("cari tahsilat tutar", api.put(`/api/workspace/accounts/${ctx.customer}/entries/${restored.account}`, { kind: "in", amount: "75", date: EARLY, method: "cash", note: "eski tahsilat (düzeltildi)" }));
    await must("kayıt tahsilatı tutar", api.put(`/api/workspace/payments/${restored.payment}`, { amount: "35", date: EARLY, method: "cash", note: "düzeltildi" }));
    await must("taksit tahsilatı tutar", api.put(`/api/workspace/plans/${ctx.plan}/entries/${restored.plan}`, { kind: "in", amount: "22", date: EARLY, method: "cash" }));
    await must("transfer tutar", api.put(`/api/workspace/cash/${restored.transfer}`, { kind: "in", amount: "65", date: EARLY, description: "aktarım (düzeltildi)" }));
    const store = server.app.store;
    assert.equal(store.get("SELECT amount FROM cash_entries WHERE id = ?", restored.cash).amount, 150);
    assert.equal(store.get("SELECT amount FROM account_entries WHERE id = ?", restored.account).amount, 75);
    assert.equal(store.get("SELECT amount FROM payments WHERE id = ?", restored.payment).amount, 35);
    assert.equal(store.get("SELECT amount FROM plan_entries WHERE id = ?", restored.plan).amount, 22);
    const integrity = await integrityOf(api);
    assertIntegrity(integrity, "düzeltmeden sonra");
    assert.equal(warningOf(integrity)?.count, 5, "uyarı sürer");
  });

  it("S44: Kapatılacak Fatura bağı (ekle / kaldır) tarihi değişmeden 200", async () => {
    const invoice = idOf(await must("fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: ctx.customer, issueDate: "2026-03-02", lines: [{ name: "Hizmet", qty: 1, unitPrice: "50,00", vatRate: 20 }], payment: { cash: [], rest: "open" }, force: true })));
    await must("bağ ekle", api.put(`/api/workspace/accounts/${ctx.customer}/entries/${restored.account}`, { kind: "in", amount: "75", date: EARLY, method: "cash", note: "bağlı", invoiceId: invoice }));
    assert.equal(server.app.store.get("SELECT invoice_id AS i FROM account_entries WHERE id = ?", restored.account).i, invoice);
    await must("bağı kaldır", api.put(`/api/workspace/accounts/${ctx.customer}/entries/${restored.account}`, { kind: "in", amount: "75", date: EARLY, method: "cash", note: "bağsız", invoiceId: "" }));
    assert.equal(server.app.store.get("SELECT invoice_id AS i FROM account_entries WHERE id = ?", restored.account).i, "");
  });

  it("T12: aynı düzeltmede tarih açılıştan önceki BAŞKA güne → 409, tutar da yazılmaz (düzeltmenin tamamı)", async () => {
    await refused("Kasa Giriş tarih + tutar", api.put(`/api/workspace/cash/${restored.cash}`, { kind: "in", amount: "999", date: "2026-03-06", description: "x" }));
    assert.deepEqual({ ...server.app.store.get("SELECT amount, date FROM cash_entries WHERE id = ?", restored.cash) }, { amount: 150, date: EARLY });
    await refused("cari tahsilat tarih", api.put(`/api/workspace/accounts/${ctx.customer}/entries/${restored.account}`, { kind: "in", amount: "75", date: "2026-03-06", method: "cash", note: "x" }));
    await refused("kayıt tahsilatı tarih", api.put(`/api/workspace/payments/${restored.payment}`, { amount: "35", date: "2026-03-06", method: "cash" }));
    await refused("taksit tahsilatı tarih", api.put(`/api/workspace/plans/${ctx.plan}/entries/${restored.plan}`, { kind: "in", amount: "22", date: "2026-03-06", method: "cash" }));
  });

  it("açılıştan SONRAYA alınan kayıt kabul, uyarıdan çıkar; açılış öne alınınca uyarı kalkar", async () => {
    await must("Kasa Giriş açılış sonrasına", api.put(`/api/workspace/cash/${restored.cash}`, { kind: "in", amount: "150", date: AFTER, description: "eski giriş" }));
    assert.equal(warningOf(await integrityOf(api))?.count, 4);
    await must("açılışı öne al (ilk hareket günü)", api.post("/api/workspace/cash/opening", { amount: "5.000", date: EARLY }));
    const integrity = await integrityOf(api);
    assert.equal(warningOf(integrity), null, "açılış öne alınınca uyarı kalktı");
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 400));
  });
});

describe("Ç5-K önceki hâl eşlemesi — açılış öncesi (Silinenler'den geri yüklenmiş) kayıt tahsilatının Taksite Aktar / Geri Al'ı (aynı İşlem No) yeni hareket sayılmaz", () => {
  let server;
  let api;
  let ctx;
  const ids = {};
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    ctx = await setup(api);
    const matrix = [["Ad Soyad", "Telefon", "Mart 2026 taksiti", "Nisan 2026 taksiti", "Toplam", "Ödenen"], ["Veli Taksit", "0532 111 22 44", "1.000", "1.000", "2.000", ""]];
    const staged = await must("tablo yükle", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: [{ name: "Okul", matrix }] }));
    await must("tablo onayla", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const rows = (await api.client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    ids.key = rows.find(row => row["Ad Soyad"] === "Veli Taksit").__hofKey;
    // Açılış yokken açılıştan önceki güne yazılır, silinir; açılış (OPEN) girilir; Silinenler'den geri alınır (Z9) → açılış öncesi satır.
    ids.payment = idOf(await must("kayıt nakit tahsilatı", api.post(`/api/workspace/cases/${encodeURIComponent(ids.key)}/payments`, { amount: "500", date: EARLY, method: "cash", note: "nakit", caseTitle: "Veli Taksit" })));
    await must("tahsilatı sil", api.del(`/api/workspace/payments/${ids.payment}`));
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "1.000", date: OPEN }));
    const listed = await must("Silinenler", api.get("/api/admin/trash"));
    const items = Array.isArray(listed) ? listed : listed.items || [];
    const item = items.find(row => row.ref === ids.payment);
    assert.ok(item, "Silinenler'de tahsilat");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
  });
  after(() => server?.close());

  it("ön koşul: geri yüklenen tahsilat açılıştan önce (uyarıda)", async () => {
    assert.equal(server.app.store.get("SELECT date FROM payments WHERE id = ?", ids.payment).date, EARLY);
    assert.ok((warningOf(await integrityOf(api))?.count || 0) >= 1, "uyarı var");
  });

  it("Taksite Aktar (aynı İşlem No ile karta taşınır) ve Geri Al 200 — yeni hareket sayılmaz; Kasa değişmez", async () => {
    const kasa = await cashBalance(api);
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const result = await must("Taksite Aktar", api.post("/api/workspace/plans/from-table", { keys: [ids.key], fingerprint: preview.fingerprint }));
    assert.equal(result.paymentsMoved, 1);
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE p.import_id = ? AND e.opening = 0 AND e.date = ?", result.importId, EARLY).n, 1, "taşınan satır açılıştan önce tarihli");
    assert.equal(await cashBalance(api), kasa, "Kasa aynı");
    await must("Geri Al", api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
    assert.equal(server.app.store.get("SELECT date FROM payments WHERE id = ?", ids.payment).date, EARLY);
    assert.equal(await cashBalance(api), kasa, "Kasa aynı");
  });
});

describe("Ç5-K S20 = A: v2.4.9'un GERÇEK koduyla üretilmiş açılış öncesi nakit satırları — göç ve yedekten geri yükleme", { skip: !tagsAvailable(["v2.4.9"]) && "v2.4.9 etiketi bu depoda yok (git fetch --tags)" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "c5k-s20-"));
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  const ids = {};
  let old249 = null;
  let server = null;
  before(async () => {
    // 2.4.9: açılış önce (hareketsiz), sonra açılıştan ÖNCE tarihli nakit hareketleri (2.4.9 S12'yi bilmez) + aynı adlı iki cari + şüpheli kaydı.
    // legacyCasePayments: kayıt tahsilatı 2.4.5'ten beri üretimde kapalı (410); eski verinin kayıt tahsilatını o sürümün kendi API'si üretir (test/helpers.mjs gibi).
    const old = await bootVersion("v2.4.9", { dataDir, backupDir, now: { time: "2026-02-20T12:00:00", fixed: true }, legacyCasePayments: true });
    try {
      const v = await old.login();
      await v.post("/api/workspace/bank/setup/dismiss", {});
      const opening = await v.post("/api/workspace/cash/opening", { amount: "10.000", date: "2026-02-01" });
      assert.equal(opening.status, 200, `2.4.9 açılış: ${JSON.stringify(opening.data).slice(0, 200)}`);
      const c1 = await v.post("/api/workspace/accounts", { name: "Mehmet Aynı", type: "customer", registeredOn: "2026-01-01", similarOk: true, force: true });
      const c2 = await v.post("/api/workspace/accounts", { name: "Mehmet Aynı", type: "customer", registeredOn: "2026-01-01", similarOk: true, force: true });
      ids.c1 = idOf(c1.data);
      ids.c2 = idOf(c2.data);
      assert.ok(ids.c1 && ids.c2 && ids.c1 !== ids.c2, "aynı adlı iki cari");
      // Fatura numarası tarih sırasıyla (seri kronolojisi): önce en eski.
      const f3 = await v.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c2, issueDate: "2026-01-01", lines: [{ name: "Hizmet", qty: 1, unitPrice: "1.000,00", vatRate: 0 }], payment: { cash: [], rest: "open" }, force: true });
      const f1 = await v.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c1, issueDate: "2026-01-05", lines: [{ name: "Hizmet", qty: 1, unitPrice: "1.000,00", vatRate: 0 }], payment: { cash: [], rest: "open" }, force: true });
      const f2 = await v.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c1, issueDate: "2026-01-06", lines: [{ name: "Hizmet", qty: 1, unitPrice: "500,00", vatRate: 0 }], payment: { cash: [], rest: "open" }, force: true });
      ids.f1 = idOf(f1.data);
      ids.f2 = idOf(f2.data);
      assert.ok(ids.f1 && ids.f2 && idOf(f3.data), `2.4.9 faturalar ${f1.status} ${f2.status} ${f3.status}`);
      const doubtful = await v.post(`/api/workspace/accounts/${ids.c2}/doubtful`, { amount: 500, date: "2026-01-02", reason: "lawsuit", note: "dava" });
      assert.equal(doubtful.status, 200, `2.4.9 şüpheli kaydı: ${JSON.stringify(doubtful.data).slice(0, 200)}`);
      const ky = await v.post("/api/workspace/cash", { kind: "in", amount: "300", date: "2026-01-20", description: "eski Kasa girişi", method: "cash" });
      const py = await v.post(`/api/workspace/accounts/${ids.c1}/entries`, { kind: "in", amount: "500", date: "2026-01-25", method: "cash", note: "bağlı tahsilat", invoiceId: ids.f1 });
      const pb = await v.post(`/api/workspace/accounts/${ids.c2}/entries`, { kind: "in", amount: "200", date: "2026-01-26", method: "cash", note: "şüpheli caride tahsilat" });
      const pk = await v.post("/api/workspace/cases/DOSYA-249/payments", { amount: "100", date: "2026-01-27", method: "cash", caseTitle: "Eski Dosya" });
      // Peşin nakitli fatura (fatura Düzenle peşin satırını silip yeniden yazar — önceki hâl eşlemesi).
      const f4 = await v.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c1, issueDate: "2026-01-28", lines: [{ name: "Hizmet", qty: 1, unitPrice: "300,00", vatRate: 0 }], payment: { cash: [{ amount: "300,00", method: "cash", lineKey: "p1" }], rest: "open" }, force: true, cashForce: true });
      for (const [name, res] of Object.entries({ ky, py, pb, pk, f4 })) assert.equal(res.status, 200, `2.4.9 ${name} açılıştan önce kabul edilmeli (S12 yok): ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
      ids.ky = idOf(ky.data);
      ids.py = py.data?.entryId;
      ids.pb = pb.data?.entryId;
      ids.pk = idOf(pk.data);
      ids.f4 = idOf(f4.data);
      const ledger = await v.get("/api/workspace/ledger");
      old249 = Object.fromEntries(ledger.data.trial.accounts.map(row => [String(row.code), Math.round(row.balance * 100)]));
      const backup = await v.post("/api/admin/backups", { scope: "one", companyId: "sirket-001" });
      assert.equal(backup.status, 200, `2.4.9 yedek: ${JSON.stringify(backup.data).slice(0, 200)}`);
      ids.backup = backup.data.backups[0].name;
    } finally {
      await old.close();
    }
    server = await bootVersion(CURRENT, { dataDir, backupDir, now: { time: NOW, fixed: true } });
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  // Güncel kodun oturumu (bu dosyanın apiOf'u: hata kodu ve iletisi yanıttan okunur).
  const login = async () => apiOf((await server.login()).client);

  it("göç (2.4.9 verisi 2.5.0 ile açılır): satırlar aynen, mizan 2.4.9 ile aynı, Mutabakat Testi UYARI (4 satır), sapma yok", async () => {
    const v = await login();
    const store = server.app.store;
    assert.equal(store.get("SELECT date FROM cash_entries WHERE id = ?", ids.ky).date, "2026-01-20");
    assert.equal(store.get("SELECT date FROM account_entries WHERE id = ?", ids.py).date, "2026-01-25");
    const ledger = await v.get("/api/workspace/ledger");
    const now250 = Object.fromEntries(ledger.data.trial.accounts.map(row => [String(row.code), Math.round(row.balance * 100)]));
    assert.deepEqual(now250, old249, "mizan 2.4.9 ile aynı (defter kuralı değişmez)");
    const integrity = (await v.get("/api/workspace/ledger/integrity")).data;
    assertIntegrity(integrity, "göç");
    const warning = warningOf(integrity);
    assert.equal(warning?.count, 5, JSON.stringify(warning));
    assert.equal(warning.opening, "2026-02-01");
  });

  it("S12 göçten sonra: yeni açılış öncesi nakit 409; aynı adlı öbür cariye de 409", async () => {
    const v = await login();
    await refused("yeni Kasa Giriş", v.post("/api/workspace/cash", { kind: "in", amount: "1", date: "2026-01-26", description: "yeni", method: "cash" }));
    await refused("aynı adlı C1", v.post(`/api/workspace/accounts/${ids.c1}/entries`, { kind: "in", amount: "1", date: "2026-01-31", method: "cash" }));
    await refused("aynı adlı C2", v.post(`/api/workspace/accounts/${ids.c2}/entries`, { kind: "in", amount: "1", date: "2026-01-31", method: "cash" }));
    await must("aynı gün C2", v.post(`/api/workspace/accounts/${ids.c2}/entries`, { kind: "in", amount: "1", date: "2026-02-01", method: "cash" }));
  });

  it("S26 / S40 / S44 (eski sürüm verisi): tutar, açıklama, Kapatılacak Fatura (başka faturaya, kaldır), Normal Cari Hesaba İşle düzeltmesi 200; uyarı sürer", async () => {
    const v = await login();
    const store = server.app.store;
    await must("KY tutar", v.put(`/api/workspace/cash/${ids.ky}`, { kind: "in", amount: "350", date: "2026-01-20", description: "eski Kasa girişi (düzeltildi)" }));
    await must("PY açıklama", v.put(`/api/workspace/accounts/${ids.c1}/entries/${ids.py}`, { kind: "in", amount: "500", date: "2026-01-25", method: "cash", note: "açıklama düzeltildi", invoiceId: ids.f1 }));
    await must("PY başka faturaya", v.put(`/api/workspace/accounts/${ids.c1}/entries/${ids.py}`, { kind: "in", amount: "500", date: "2026-01-25", method: "cash", note: "F2'ye", invoiceId: ids.f2 }));
    assert.equal(store.get("SELECT invoice_id AS i FROM account_entries WHERE id = ?", ids.py).i, ids.f2);
    await must("PY bağı kaldır", v.put(`/api/workspace/accounts/${ids.c1}/entries/${ids.py}`, { kind: "in", amount: "500", date: "2026-01-25", method: "cash", note: "bağsız", invoiceId: "" }));
    await must("PY yeniden F1'e", v.put(`/api/workspace/accounts/${ids.c1}/entries/${ids.py}`, { kind: "in", amount: "500", date: "2026-01-25", method: "cash", note: "bağlı", invoiceId: ids.f1 }));
    await must("PB Normal Cari Hesaba İşle", v.put(`/api/workspace/accounts/${ids.c2}/entries/${ids.pb}`, { kind: "in", amount: "200", date: "2026-01-26", method: "cash", note: "normal cari", doubtfulSkip: true }));
    assert.equal(store.get("SELECT doubtful_skip AS d FROM account_entries WHERE id = ?", ids.pb).d, 1);
    await must("PB seçimi kaldır", v.put(`/api/workspace/accounts/${ids.c2}/entries/${ids.pb}`, { kind: "in", amount: "200", date: "2026-01-26", method: "cash", note: "şüpheliden", doubtfulSkip: false }));
    await must("PK tutar", v.put(`/api/workspace/payments/${ids.pk}`, { amount: "110", date: "2026-01-27", method: "cash" }));
    const integrity = (await v.get("/api/workspace/ledger/integrity")).data;
    assertIntegrity(integrity, "düzeltmeler");
    assert.equal(warningOf(integrity)?.count, 5, "uyarı sürer");
  });

  it("fatura Düzenle (eski sürüm verisi, peşin nakitli fatura açılıştan önce): yalnız not 200 (aynı İşlem No), peşin tutarı 200 (aynı fatura, aynı gün), tarihi açılıştan önceki başka güne 409", async () => {
    const v = await login();
    const body = (amount, date = "2026-01-28", note = "") => ({ kind: "sale", accountId: ids.c1, issueDate: date, note, lines: [{ name: "Hizmet", qty: 1, unitPrice: amount, vatRate: 0 }], payment: { cash: [{ amount, method: "cash", lineKey: "p1" }], rest: "open" }, force: true, cashForce: true, similarOk: true });
    const peşin = () => server.app.store.all("SELECT amount, date FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", ids.f4).map(row => [row.amount, row.date]);
    assert.deepEqual(peşin(), [[300, "2026-01-28"]], "ön koşul: 2.4.9'dan gelen peşin satırı");
    await must("yalnız not", v.post(`/api/workspace/invoices/${ids.f4}/edit`, body("300,00", "2026-01-28", "not düzeltildi")));
    await must("peşin tutarı", v.post(`/api/workspace/invoices/${ids.f4}/edit`, body("350,00")));
    assert.deepEqual(peşin(), [[350, "2026-01-28"]]);
    await refused("tarih açılıştan önceki başka güne", v.post(`/api/workspace/invoices/${ids.f4}/edit`, body("350,00", "2026-01-29")));
    assert.deepEqual(peşin(), [[350, "2026-01-28"]], "fatura değişmedi");
  });

  it("T12 (eski sürüm verisi): tarih açılıştan önceki başka güne 409 — bağ ve tutar da değişmez", async () => {
    const v = await login();
    const store = server.app.store;
    const before_ = { ...store.get("SELECT amount, date, invoice_id AS i, note FROM account_entries WHERE id = ?", ids.py) };
    await refused("PY tarih + bağ", v.put(`/api/workspace/accounts/${ids.c1}/entries/${ids.py}`, { kind: "in", amount: "600", date: "2026-01-24", method: "cash", note: "x", invoiceId: ids.f2 }));
    assert.deepEqual({ ...store.get("SELECT amount, date, invoice_id AS i, note FROM account_entries WHERE id = ?", ids.py) }, before_);
  });

  it("S45 / S54 / S57: programda cari hareketinin carisi düzeltilemez — gövdedeki accountId yok sayılır, bağlı satır carisinde kalır (red edilecek istek kurulamaz; S54'ün 'kabul'ü yeni Cari alanı ister — routes/accounts.mjs, tasarım §4 B-K1)", async () => {
    const v = await login();
    const res = await v.put(`/api/workspace/accounts/${ids.c1}/entries/${ids.py}`, { kind: "in", amount: "500", date: "2026-01-25", method: "cash", note: "bağlı", invoiceId: ids.f1, accountId: ids.c2 });
    assert.equal(res.status, 200);
    assert.equal(server.app.store.get("SELECT account_id AS a FROM account_entries WHERE id = ?", ids.py).a, ids.c1, "cari değişmedi");
  });

  it("S56 = A: S44 düzeltmesi şüpheli caride 'Normal Cari' sınırını aşarsa 409 doubtful-normal-exceeds (kâhin SUPHELI_NORMAL_ASIM); satır değişmez — Kasa açılış kuralından ÖNCE (routes/accounts.mjs:773, 2.3.0'dan)", async () => {
    const v = await login();
    const store = server.app.store;
    const before_ = { ...store.get("SELECT amount, doubtful_skip AS d FROM account_entries WHERE id = ?", ids.pb) };
    await refused("Normal Cari sınırı aşımı", v.put(`/api/workspace/accounts/${ids.c2}/entries/${ids.pb}`, { kind: "in", amount: "600", date: "2026-01-26", method: "cash", note: "aşım", doubtfulSkip: true }), 409, "doubtful-normal-exceeds");
    assert.deepEqual({ ...store.get("SELECT amount, doubtful_skip AS d FROM account_entries WHERE id = ?", ids.pb) }, before_, "satır değişmedi");
  });

  it("S55 = A (bağ hedefin doğduğu gün) — kapama kuralı Ç5-B'nin (lib/invoice-settle.mjs); Ç5-K yalnız Kasa denetiminin kayıttan SONRA tarihli faturaya bağı engellemediğini ölçer", async () => {
    const v = await login();
    const later = await v.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c1, issueDate: "2026-02-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "100,00", vatRate: 0 }], payment: { cash: [], rest: "open" }, force: true });
    const s55 = await v.put(`/api/workspace/accounts/${ids.c1}/entries/${ids.py}`, { kind: "in", amount: "500", date: "2026-01-25", method: "cash", note: "sonraki faturaya", invoiceId: idOf(later.data) });
    assert.equal(s55.status, 200, `bağ kaydedilir (Kasa açılış kuralı engellemez): ${s55.status} ${JSON.stringify(s55.data).slice(0, 200)}`);
    await must("bağ geri F1'e", v.put(`/api/workspace/accounts/${ids.c1}/entries/${ids.py}`, { kind: "in", amount: "500", date: "2026-01-25", method: "cash", note: "bağlı", invoiceId: ids.f1 }));
  });

  it("yedekten geri yükleme: 2.4.9 yedeği 2.5.0'a geri yüklenir — silinen açılış öncesi satır aynen döner, uyarı yeniden 4", async () => {
    const v = await login();
    await must("KY'yi sil", apiOf(v.client).del(`/api/workspace/cash/${ids.ky}`));
    assert.equal(warningOf((await v.get("/api/workspace/ledger/integrity")).data)?.count, 4);
    const restore = await must("2.4.9 yedeğini geri yükle", v.post("/api/admin/backups/restore", { name: ids.backup, company: "sirket-001", confirm: "001", password: ADMIN_PASSWORD }));
    // 001 ortak dosyadır: geri yükleme yeniden başlatmada uygulanır (staged) — gerçek kurulum gibi sunucu kapatılıp aynı klasörlerle yeniden açılır.
    if (restore.staged) {
      await server.close();
      server = await bootVersion(CURRENT, { dataDir, backupDir, now: { time: NOW, fixed: true } });
    }
    const fresh = await login();
    const listed = (await must("Kasa", fresh.get("/api/workspace/cash?method=all"))).entries;
    const back = listed.find(row => row.id === ids.ky);
    assert.deepEqual(back && { amount: back.amount, date: back.date }, { amount: 300, date: "2026-01-20" }, `yedekteki satır aynen (Kasa satırları: ${JSON.stringify(listed.map(row => [row.id, row.date, row.amount, row.source])).slice(0, 600)})`);
    const integrity = (await fresh.get("/api/workspace/ledger/integrity")).data;
    assertIntegrity(integrity, "yedekten geri yükleme");
    assert.equal(warningOf(integrity)?.count, 5);
    await refused("geri yüklemeden sonra yeni açılış öncesi", apiOf(fresh.client).post("/api/workspace/cash", { kind: "in", amount: "1", date: "2026-01-20", description: "yeni", method: "cash" }));
    await must("geri yüklenen KY tutar düzeltmesi", apiOf(fresh.client).put(`/api/workspace/cash/${ids.ky}`, { kind: "in", amount: "301", date: "2026-01-20", description: "eski" }));
  });
});

describe("Ç5-K gün dönümü ve iki şirket", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ now: { time: `${OPEN}T00:00:30`, fixed: true } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
  });
  after(() => server?.close());

  it("tarihsiz giriş programın bugününe yazılır: açılış günü 00:00:30 ve 23:59:30 aynı gün 200; dünü (açılıştan önce) 409; gece yarısından sonra ertesi gün 200 (yerel saat, iki TZ)", async () => {
    await must("açılış", api.post("/api/workspace/cash/opening", { amount: "1.000", date: OPEN }));
    await must("açılış günü, gün başı", api.post("/api/workspace/cash", { kind: "in", amount: "1", description: "gün başı", method: "cash" }));
    await refused("gece yarısından hemen sonra dünün tarihiyle", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: BEFORE, description: "dün", method: "cash" }));
    server.clock.set(`${OPEN}T23:59:30`);
    await must("açılış günü, gün sonu", api.post("/api/workspace/cash", { kind: "in", amount: "1", description: "gün sonu", method: "cash" }));
    server.clock.set(`${AFTER}T00:00:30`);
    await must("ertesi gün, gün başı", api.post("/api/workspace/cash", { kind: "in", amount: "1", description: "ertesi gün", method: "cash" }));
    const rows = server.app.store.all("SELECT date FROM cash_entries WHERE is_opening = 0 ORDER BY rowid").map(row => row.date);
    assert.deepEqual(rows, [OPEN, OPEN, AFTER], "girişler yerel güne yazıldı");
    server.clock.set(NOW);
  });

  it("iki şirket: 001'in açılışı 002'yi etkilemez (002 açılışsız, aynı tarih 200); 002'nin açılışı 001'e sızmaz", async () => {
    const companies = await must("şirketler", api.get("/api/companies"));
    const first = (companies.companies || companies).find(row => row.current) || (companies.companies || companies)[0];
    const second = await must("002", api.post("/api/companies", { name: "Kasa İkinci Şirket", select: false }));
    const secondId = second.id || second.company?.id;
    await must("002 seç", api.post("/api/companies/select", { id: secondId }));
    try {
      await api.post("/api/workspace/bank/setup/dismiss", {});
      await must("002 açılışsız, 001 açılışından önce", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: BEFORE, description: "002", method: "cash" }));
      await must("002 açılışı", api.post("/api/workspace/cash/opening", { amount: "1.000", date: BEFORE }));
      await refused("002 kendi açılışından önce", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: EARLY, description: "002", method: "cash" }));
    } finally {
      await must("001 seç", api.post("/api/companies/select", { id: first.id }));
    }
    await refused("001 kendi açılışından önce (002'nin daha erken açılışı sızmaz)", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: BEFORE, description: "001", method: "cash" }));
  });
});
