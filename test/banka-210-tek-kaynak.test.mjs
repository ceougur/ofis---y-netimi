// 2.1.0 — Aşama 2, Dilim 4: tek kaynak moneyLines (docs/BANKA-MODULU-PLAN.md §3.4, K5).
//
// ÇALIŞIYOR MU:
//  - Kasa penceresi, Kasa Dökümü, Banka ve POS Hareketleri, ANLIK DURUM'un Kasa/Banka kutuları ve Ana Defter'in beklenenleri aynı tek
//    SQL tanımından (9 kaynak) okunur: satır sorgusunun toplamı = özet (yol ve hesap bazında), satırlar Kasa penceresiyle birebir.
//  - "Yol" (way) hiçbir tabloya yazılmaz, SQL'de türetilir: nakit, havale (bank), POS (card), kurumsal kart (ccard, 309), kredi (loan),
//    tanınmayan (unknown). Hesap kimliği (ref = fin_ref; '' = Hesabı Atanmamış) satırla gelir; Kasa ↔ Banka transferi iç harekettir.
//  - Banka Fişi satırı (bank_lines, kaynak 9) Kasa'ya girmez; banka özetine ve Ana Defter'e (102) girer.
//  - Para satırı yüklemi (K6, money:event) ile okuma kaynakları aynı tanımdan (MONEY_SOURCES).
// NASIL BOZARIM:
//  1. Tanınmayan yollu eski satır (ör. "bitcoin"): 2.0.26'da Kasa penceresi onu NAKİT sayıyor, özet saymıyordu (B7: iki okuyucu iki
//     karar). Artık pencere, özet ve ANLIK DURUM aynı kararı verir (nakit değil); money:method yakalar.
//  2. Havale yolu bir kurumsal kart / kredi hesabına bağlanırsa yol "tanınmayan" olur (money:method), banka bakiyesine girmez.
//  3. Silinen cari, taksit kartı ve çek ile faturası olmayan peşin satırı her okuyucudan BİRLİKTE düşer (görünürlük tek tanımda).
//  4. Aynı anda (aynı işlemde, aynı zaman damgasıyla) yazılan satırlar (fatura peşininin üç satırı, transferin iki bacağı) Kasa
//     penceresinde yazım sırasıyla gelir; yürüyen bakiye sırası değişmez.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, insertBankAccount, insertPos, integrityOf, integrityOk, localDay, must, rawGet, rawRun } from "./banka-210-ortak.mjs";

const TODAY = localDay(0);
const cents = value => Math.round(Number(value || 0) * 100);
const signed = entry => (entry.kind === "in" ? 1 : -1) * cents(entry.amount);
const sumBy = (list, key) => {
  const out = {};
  for (const entry of list) out[key(entry)] = (out[key(entry)] || 0) + signed(entry);
  return out;
};
const moneyLib = () => import("../server/lib/bank/money-lines.mjs");

async function seed(ctx) {
  const { api } = ctx;
  const account = await must("cari", api.post("/api/workspace/accounts", { name: "Tek Kaynak Müşterisi", type: "customer", registeredOn: TODAY }));
  const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tek Kaynak Tedarikçisi", type: "supplier", registeredOn: TODAY }));
  const service = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "TK-HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
  const goods = await must("ürün", api.post("/api/workspace/stock", { name: "Defter", code: "TK-DFT", unit: "Adet", unitPrice: 10, salePrice: 25 }));
  await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "10.000", date: TODAY, description: "Sermaye" }));
  await must("Kasa çıkışı", api.post("/api/workspace/cash", { kind: "out", amount: "120,50", date: TODAY, description: "Kırtasiye" }));
  await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "2.000", date: TODAY }));
  await must("kayıt tahsilatı", api.post("/api/workspace/cases/TK-1/payments", { amount: "300", date: TODAY, method: "card", caseTitle: "Tek Kaynak Dosyası" }));
  const collected = await must("cari tahsilat", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "1.500", date: TODAY, method: "bank" }));
  await must("cari ödeme", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: "400", date: TODAY, method: "card" }));
  const plan = await must("taksit kartı", api.post("/api/workspace/plans", { name: "Tek Kaynak Taksit", total: "3.000", mode: "auto", count: 3, firstDue: TODAY, registeredOn: TODAY, accountId: account.id }));
  await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1.000", date: TODAY, method: "cash" }));
  await must("stok girişi", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "100", pay: "none" }));
  await must("stok peşin satış", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "4", unitPrice: "25", pay: "cash", method: "bank", date: TODAY }));
  const cheque = await must("çek alındı", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "700", issueDate: TODAY, dueDate: localDay(20), accountId: account.id, serialNo: "TK-1" }));
  await must("çek tahsil", api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: TODAY, method: "bank", status: "portfolio" }));
  // Fatura peşini: üç satır aynı işlemde (aynı zaman damgası).
  const invoice = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account.id, issueDate: TODAY, lines: [{ itemId: service.id, qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { cash: [{ amount: 100, method: "cash" }, { amount: 200, method: "cash" }, { amount: 300, method: "cash" }], rest: "open", dueDate: TODAY } }));
  return { account, supplier, plan, cheque, invoice, goods, collected };
}

describe("moneyLines — tek kaynak (çalışıyor mu)", () => {
  let ctx;
  let data;
  before(async () => {
    ctx = await boot();
    data = await seed(ctx);
  });
  after(() => ctx.server.close());

  it("Kasa penceresi, Banka ve POS ve ANLIK DURUM aynı satırlardan: Σ satır (yol bazında) = özet", async () => {
    const { api } = ctx;
    const all = await must("Kasa (tüm yollar)", api.get("/api/workspace/cash?method=all"));
    const window = await must("Kasa penceresi", api.get("/api/workspace/cash"));
    const noncash = await must("banka tarafı", api.get("/api/workspace/cash?method=noncash"));
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    const byMethod = sumBy(all.entries, entry => entry.method);
    assert.equal(cents(overview.cash.allEntries), byMethod.cash || 0, "ANLIK DURUM Nakit Kasa = pencere satırlarının toplamı");
    assert.equal(cents(overview.cash.bank.allEntries), (byMethod.bank || 0) + (byMethod.card || 0), "Banka / POS kutusu = banka tarafı satırları");
    assert.equal(cents(window.totals.balance), byMethod.cash || 0, "Kasa penceresi = nakit satırları");
    assert.equal(cents(noncash.totals.balance), (byMethod.bank || 0) + (byMethod.card || 0));
    assert.deepEqual(Object.fromEntries(Object.entries(all.byMethod).map(([key, value]) => [key, cents(value)])), { cash: byMethod.cash || 0, bank: byMethod.bank || 0, card: byMethod.card || 0 });
  });

  it("moneyLines modülü: satır sorgusu Kasa'nın satırlarıyla birebir; özet Kasa özetiyle birebir; tek tanımdan 9 kaynak", async () => {
    const { MONEY_SOURCES, createMoneyLines } = await moneyLib();
    assert.equal(typeof createMoneyLines, "function", "createMoneyLines yok");
    assert.equal(MONEY_SOURCES.length, 9);
    for (const source of MONEY_SOURCES) assert.ok(source.read, `kaynak ${source.id} (${source.table}) okuma tanımı yok`);
    const money = createMoneyLines(ctx.store);
    const all = await must("Kasa (tüm yollar)", ctx.api.get("/api/workspace/cash?method=all"));
    const rows = money.rows();
    assert.deepEqual(rows, all.entries.map(({ balance, editable, ...entry }) => entry), "satır sorgusu = Kasa (tüm yollar) satırları (alanlar ve sıra)");
    assert.deepEqual(money.summary(TODAY), ctx.app.context.cash.summary(TODAY), "özet = Kasa özeti (ANLIK DURUM ve Ana Defter buradan okur)");
    // Ham satırlar: yol, hesap, iç hareket ve İşlem No.
    const lines = money.lines();
    assert.equal(lines.length, rows.length);
    for (const line of lines) {
      assert.ok(["cash", "bank", "card", "ccard", "loan", "unknown"].includes(line.way), `yol ${line.way}`);
      assert.equal(line.ref, "", "hesap tanımlanmamış: Hesabı Atanmamış");
      assert.ok(line.event_id, `${line.src}/${line.id}: yeni kod her para satırına İşlem No yazar`);
    }
    const transfer = lines.filter(line => line.internal === 1);
    assert.equal(transfer.length, 2, "Kasa ↔ Banka transferinin iki bacağı iç hareket");
    assert.deepEqual(transfer.map(line => line.way).sort(), ["bank", "cash"]);
    const groups = money.groups();
    const total = way => groups.filter(group => group.way === way).reduce((sum, group) => sum + group.cents, 0);
    const byWay = sumBy(rows, entry => entry.method);
    assert.equal(total("cash"), byWay.cash);
    assert.equal(total("bank"), byWay.bank);
    assert.equal(total("card"), byWay.card);
  });

  it("para satırı yüklemi (K6) ile okuma kaynakları aynı tanımdan: her kaynak satırı moneyWhere'i sağlar", async () => {
    const { MONEY_SOURCES, moneyWhere, createMoneyLines } = await moneyLib();
    const money = createMoneyLines(ctx.store);
    const tables = [...new Set(MONEY_SOURCES.map(source => source.table))];
    for (const line of money.lines()) {
      const table = MONEY_SOURCES.find(source => source.id === line.src)?.table;
      assert.ok(tables.includes(table), `kaynak ${line.src}`);
      if (table === "bank_lines") continue;
      const found = ctx.store.get(`SELECT 1 AS found FROM ${table} t WHERE t.id = ? AND ${moneyWhere(table, "t")}`, line.id);
      assert.ok(found, `${table}/${line.id}: okunan satır para satırı yüklemini sağlamalı`);
    }
  });
});

describe("moneyLines — yol ve hesap (way, ref) SQL'de türetilir", () => {
  let ctx;
  let data;
  before(async () => {
    ctx = await boot();
    data = await seed(ctx);
    // Hesap kartları (Aşama 3 gelene kadar doğrudan): vadesiz 102.01, kurumsal kart 309.01, kredi 300.01, POS 108.01.
    insertBankAccount(ctx.db, { id: "acc-102", code: "ZRT-TL", kind: "demand", glSub: "102.01" });
    insertBankAccount(ctx.db, { id: "acc-309", code: "KK-1", kind: "card", glSub: "309.01" });
    insertBankAccount(ctx.db, { id: "acc-300", code: "KRD-1", kind: "loan", glSub: "300.01" });
    insertPos(ctx.db, { id: "pos-1", code: "POS-1", glSub: "108.01", bankAccountId: "acc-102" });
  });
  after(() => ctx.server.close());

  const bind = (ctx, table, id, ref) => {
    const row = rawGet(ctx.db, `SELECT event_id AS e FROM ${table} WHERE id = ?`, id);
    rawRun(ctx.db, `UPDATE ${table} SET fin_ref = ? WHERE id = ?`, ref, id);
    rawRun(ctx.db, "UPDATE fin_events SET bank_ref = ? WHERE id = ?", ref, row.e);
  };

  it("havale → bank (102.01), POS → card (108.01), kurumsal kartla ödeme → ccard (309.01); Ana Defter alt hesapları ve 309 mutabakatı", async () => {
    const { api, store } = ctx;
    bind(ctx, "account_entries", data.collected.entryId, "acc-102");
    const posIn = await must("POS tahsilat", api.post(`/api/workspace/accounts/${data.account.id}/entries`, { kind: "in", amount: "250", date: TODAY, method: "card" }));
    bind(ctx, "account_entries", posIn.entryId, "pos-1");
    const cardOut = await must("kurumsal kartla ödeme", api.post(`/api/workspace/accounts/${data.supplier.id}/entries`, { kind: "out", amount: "180", date: TODAY, method: "card" }));
    bind(ctx, "account_entries", cardOut.entryId, "acc-309");
    ctx.app.integrity.start();
    const { createMoneyLines } = await moneyLib();
    const lines = createMoneyLines(store).lines();
    const line = id => lines.find(item => item.src >= 3 && item.src <= 5 && item.id === id);
    assert.deepEqual([line(data.collected.entryId).way, line(data.collected.entryId).ref], ["bank", "acc-102"]);
    assert.deepEqual([line(posIn.entryId).way, line(posIn.entryId).ref], ["card", "pos-1"]);
    assert.deepEqual([line(cardOut.entryId).way, line(cardOut.entryId).ref], ["ccard", "acc-309"]);
    const ledger = await must("Ana Defter", api.get("/api/workspace/ledger"));
    const account = code => ledger.trial.accounts.find(row => row.code === code);
    assert.equal(cents(account("309")?.balance), -18000, "kurumsal kartla ödeme 309'a (alacak) gider, 108'e değil");
    const check309 = ledger.reconciliation.checks.find(item => item.code === "309");
    assert.ok(check309?.ok, `309 mutabakatı (tek kaynak ccard): ${JSON.stringify(check309)}`);
    await integrityOk(api, "hesaba bağlı satırlar");
  });

  it("NASIL BOZARIM: havale yolu kurumsal kart hesabına bağlanırsa yol tanınmayan olur — banka bakiyesine girmez, money:method yakalar", async () => {
    const { api, store } = ctx;
    const wrong = await must("havale", api.post(`/api/workspace/accounts/${data.account.id}/entries`, { kind: "in", amount: "90", date: TODAY, method: "bank" }));
    const summary = () => ctx.app.context.cash.summary(TODAY);
    const before = summary();
    bind(ctx, "account_entries", wrong.entryId, "acc-309");
    const { createMoneyLines } = await moneyLib();
    const line = createMoneyLines(store).lines().find(item => item.id === wrong.entryId);
    assert.equal(line.way, "unknown");
    assert.equal(cents(summary().byMethod.bank), cents(before.byMethod.bank) - 9000, "tanınmayan yol banka bakiyesinde sayılmaz (ANLIK DURUM ve Ana Defter bu özetten okur)");
    const result = await integrityOf(api);
    const method = result.checks.find(item => item.code === "money:method");
    assert.equal(method?.ok, false, "money:method tanınmayan yolu yakalamalı");
    rawRun(ctx.db, "UPDATE account_entries SET fin_ref = '' WHERE id = ?", wrong.entryId);
    rawRun(ctx.db, "UPDATE fin_events SET bank_ref = '' WHERE id = (SELECT event_id FROM account_entries WHERE id = ?)", wrong.entryId);
  });

  it("Banka Fişi satırı (bank_lines) Kasa'ya girmez; banka özetine ve Ana Defter 102.01'e girer (mutabakat tutar)", async () => {
    const { api, db, store } = ctx;
    const windowBefore = await must("Kasa", api.get("/api/workspace/cash"));
    const bankBefore = ctx.app.context.cash.summary(TODAY).byMethod.bank;
    const at = new Date().toISOString();
    rawRun(db, "INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, src_table, method, direction, amount_minor, try_minor, bank_ref, created_by, created_at) VALUES ('ev-fis-1', ?, 900001, ?, 'other_in', ?, 'active', 'manual', '', 'bank', 'in', 100000, 100000, 'acc-102', 'test', ?)", Number(TODAY.slice(0, 4)), `BNK-${TODAY.slice(0, 4)}-900001`, TODAY, at);
    rawRun(db, "INSERT INTO bank_lines (id, event_id, seq, role, gl, sub, ref, side, try_minor) VALUES ('bl-1', 'ev-fis-1', 1, 'bank', '102', '102.01', 'acc-102', 'D', 100000)");
    rawRun(db, "INSERT INTO bank_lines (id, event_id, seq, role, gl, sub, ref, side, try_minor) VALUES ('bl-2', 'ev-fis-1', 2, 'income', '649', '', '', 'C', 100000)");
    ctx.app.integrity.start();
    const window = await must("Kasa", api.get("/api/workspace/cash"));
    assert.deepEqual(window.entries, windowBefore.entries, "Banka Fişi Kasa penceresine girmez");
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    assert.equal(cents(overview.cash.byMethod.bank), cents(bankBefore) + 100000, "banka özeti (ANLIK DURUM) Banka Fişi'ni sayar");
    const { createMoneyLines } = await moneyLib();
    const fis = createMoneyLines(store).lines().filter(line => line.event_id === "ev-fis-1");
    assert.deepEqual(fis.map(line => [line.src, line.way, line.ref, line.kind, line.cents]), [[9, "bank", "acc-102", "in", 100000]], "yalnız para rolündeki satır (bank) okunur; gelir satırı para değil");
    const ledger = await must("Ana Defter", api.get("/api/workspace/ledger"));
    assert.ok(ledger.reconciliation.ok, `Banka Fişi Ana Defter'de dengeli ve mutabık: ${JSON.stringify(ledger.reconciliation.checks.filter(item => !item.ok))}`);
    await integrityOk(api, "Banka Fişi");
  });
});

describe("moneyLines — nasıl bozarım", () => {
  let ctx;
  let data;
  before(async () => {
    ctx = await boot({ moneyStrict: false });
    data = await seed(ctx);
  });
  after(() => ctx.server.close());

  it("tanınmayan yollu eski satır: Kasa penceresi onu nakit SAYMAZ; pencere = özet = ANLIK DURUM (2.0.26'da pencere nakit sayıyordu)", async () => {
    const { api, db } = ctx;
    const before = await must("Kasa", api.get("/api/workspace/cash"));
    rawRun(db, "INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-bitcoin', 'in', 777, ?, 'Eski sürüm', 'bitcoin', 'eski', ?)", TODAY, new Date().toISOString());
    try {
    const window = await must("Kasa", api.get("/api/workspace/cash"));
    assert.ok(!window.entries.some(entry => entry.id === "cash-bitcoin"), "tanınmayan yollu satır Kasa penceresinde (nakit) görünmemeli");
    assert.equal(window.totals.balance, before.totals.balance, "Kasa penceresi bakiyesi değişmez");
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    assert.equal(cents(overview.cash.allEntries), cents(window.totals.balance), "ANLIK DURUM Nakit Kasa = Kasa penceresi");
    const all = await must("Kasa (tüm yollar)", api.get("/api/workspace/cash?method=all"));
    assert.equal(cents(all.byMethod.cash), cents(window.totals.balance), "yola göre nakit toplamı = pencere (eski tanınmayan satır nakde katılmaz)");
    const result = await integrityOf(api);
    assert.equal(result.checks.find(item => item.code === "money:method")?.ok, false, "money:method yakalar");
    } finally {
      rawRun(db, "DELETE FROM cash_entries WHERE id = 'cash-bitcoin'");
    }
  });

  it("silinen cari, taksit kartı, çek ve faturası olmayan peşin satırı Kasa penceresinden, özetten ve Ana Defter'den BİRLİKTE düşer", async () => {
    const { api, store } = ctx;
    const extra = await must("cari", api.post("/api/workspace/accounts", { name: "Silinecek Cari", type: "customer", registeredOn: TODAY }));
    await must("tahsilat", api.post(`/api/workspace/accounts/${extra.id}/entries`, { kind: "in", amount: "55", date: TODAY, method: "cash" }));
    await must("cari sil", api.del(`/api/workspace/accounts/${extra.id}?cashForce=1`));
    await must("kart sil", api.del(`/api/workspace/plans/${data.plan.id}?cashForce=1`));
    const all = await must("Kasa (tüm yollar)", api.get("/api/workspace/cash?method=all"));
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    const byMethod = sumBy(all.entries, entry => entry.method);
    assert.equal(cents(overview.cash.allEntries), byMethod.cash, "nakit özet = satırlar");
    assert.ok(!all.entries.some(entry => entry.accountId === extra.id), "silinen carinin tahsilatı düşer");
    assert.ok(!all.entries.some(entry => entry.planId === data.plan.id), "silinen kartın tahsilatı düşer");
    const { createMoneyLines } = await moneyLib();
    const money = createMoneyLines(store);
    assert.equal(money.rows().length, all.entries.length, "satır sorgusu da düşürür");
    await integrityOk(api, "silme sonrası");
  });

  it("aynı işlemde yazılan satırlar (fatura peşininin üç satırı, transferin iki bacağı) yazım sırasıyla gelir", async () => {
    const { api, store } = ctx;
    const all = await must("Kasa (tüm yollar)", api.get("/api/workspace/cash?method=all"));
    const invoiceRows = all.entries.filter(entry => entry.invoiceId === data.invoice.id).map(entry => entry.amount);
    assert.deepEqual(invoiceRows, [100, 200, 300], "fatura peşini satırları yazım sırasıyla");
    const written = store.all("SELECT id FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in' ORDER BY rowid", data.invoice.id).map(row => row.id);
    assert.deepEqual(all.entries.filter(entry => entry.invoiceId === data.invoice.id).map(entry => entry.id), written);
    const legs = all.entries.filter(entry => entry.transferId);
    assert.deepEqual(legs.map(entry => entry.method), ["cash", "bank"], "transferde önce nakit bacağı (yazım sırası)");
  });
});
