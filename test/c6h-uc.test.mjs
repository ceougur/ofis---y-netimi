// 2.5.0 Ç6-HESAP tur 1 — mali tablolar okuma ucu, programın KENDİ yollarından girilen veriyle (arayüzün kullandığı API; docs/erp/C6-HESAP-TASARIM.md §8, §9).
// BEKLENENLER ELLE (kitabın formülüyle; programın çıktısından değil):
//   Ürün P: açılış 10.01 10 × 50 = 500,00 (M-07) · alış faturası 01.03 20 × 60 = 1.200,00 · satış faturası 04.05 25 × 100 = 2.500,00 · tedarikçiye iade 01.06 5 × 70 = 350,00 (açık hesap)
//   · müşteri iadesi 01.07 2 × 100 = 200,00 (açık hesap) · Kasa girişi 01.02 1.000,00 (carisiz) · Kasa çıkışı 15.08 300,00.
//   30.09: miktar 10 + 20 − 25 − 5 + 2 = 2; birim (500 + 1200 − 350) / (10 + 20 − 5) = 54,00; DSS = 108,00; T = 0 + (500 + 1200 − 350) − 108 = 1.242,00.
//   Gelir Tablosu [01.01, 30.09]: A 2.500,00 · B 200,00 · D 1.242,00 (tahmini) · E 300,00 · F 1.000,00 → Dönem Net Kârı 2.500 − 200 − 1.242 − 300 + 1.000 = 1.758,00.
// İç tutarlılık: kalemlerin hesap tutarları aynı dönemin Hesap Planı Mizanı (GET /api/workspace/ledger) 6 / 7 hareketleriyle birebir.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { apiOf, boot, must } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";
import { lockAndWait } from "./fixtures/donma-bekle.mjs";
import { incomeLineOf } from "../server/lib/financial-statements.mjs";

const FS = "/api/workspace/financial-statements";
const NOW = "2026-10-08T12:00:00+03:00";
const item = (out, kod) => out.items.find(row => row.kod === kod);
const booked = (out, kod) => item(out, kod).hesaplar.filter(row => !row.tahmini).reduce((sum, row) => sum + row.tutarMinor, 0);

describe("Ç6-HESAP okuma ucu — API'den girilen veri, iş parçacığı, yetki, kilit, iki şirket", () => {
  // Kural değişikliği benzetimi (YALNIZ TEST kancası; ana iş parçacığının canlı türetmesi): açıkken satış faturasının 600 satırına ve Kasa çıkışına 100,00 eklenir.
  const rule = { on: false };
  rule.fn = entries => (!rule.on ? entries : entries.map(entry => {
    if (!entry.lines.some(line => line.account === "600") && !(entry.date === "2026-08-15" && entry.lines.some(line => line.account === "770"))) return entry;
    return { ...entry, lines: entry.lines.map(line => (line.account === "600" ? { ...line, credit: line.credit + 10000 } : line.account === "120" ? { ...line, debit: line.debit + 10000 } : line.account === "770" ? { ...line, debit: line.debit + 10000 } : line.account === "100" ? { ...line, credit: line.credit + 10000 } : line)) };
  }));
  let ctx;
  let api;
  const ids = {};
  before(async () => {
    ctx = await boot({ now: { time: NOW, fixed: true }, __testLedgerRule: rule });
    api = ctx.api;
    ids.supplier = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tedarikçi T", type: "supplier" }))).id;
    ids.customer = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Müşteri M", type: "customer" }))).id;
    ids.item = (await must("ürün", api.post("/api/workspace/stock", { name: "Ürün P", unit: "Adet", unitPrice: "50", openingQty: "10", openingDate: "2026-01-10" }))).id;
    await must("kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "1000", description: "Danışmanlık", date: "2026-02-01" }));
    const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
    await must("alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.supplier, number: "AL-1", issueDate: "2026-03-01", lines: [{ itemId: ids.item, name: "", qty: 20, unitPrice: 60, discountRate: 0, vatRate: 20 }], payment: pay, force: true }));
    await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.customer, issueDate: "2026-05-04", lines: [{ itemId: ids.item, name: "", qty: 25, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: pay, force: true }));
    await must("tedarikçiye iade", api.post(`/api/workspace/stock/${ids.item}/moves`, { kind: "out", reason: "preturn", qty: "5", unitPrice: "70", pay: "account", accountId: ids.supplier, date: "2026-06-01" }));
    await must("müşteri iadesi", api.post(`/api/workspace/stock/${ids.item}/moves`, { kind: "in", reason: "return", qty: "2", unitPrice: "100", pay: "account", accountId: ids.customer, date: "2026-07-01" }));
    await must("kasa çıkışı", api.post("/api/workspace/cash", { kind: "out", amount: "300", description: "Kırtasiye", date: "2026-08-15" }));
  });
  after(() => ctx?.server.close());

  it("Gelir Tablosu [01.01, 30.09] elle hesaplanan sayılarla; tahmini satışların maliyeti 1.242,00", async () => {
    const out = await must("gelir tablosu", api.get(`${FS}/income-statement?from=2026-01-01&to=2026-09-30`));
    assert.deepEqual(["A", "B", "D", "E", "F", "G", "H", "I", "J", "K"].map(kod => item(out, kod).tutarMinor), [250000, 20000, 124200, 30000, 100000, 0, 0, 0, 0, 0]);
    assert.equal(out.subtotals.donemNetKari, 175800);
    assert.equal(out.smm.estimated, true);
    assert.equal(out.smm.dssMinor, 10800);
    assert.equal(out.smm.differenceMinor, 0, "153 defter hareketi = stok hareketlerinin tutarı (programın kendi yolu)");
    assert.deepEqual(out.kesinDegil.map(row => row.kod), ["smm-tahmini", "bilgi-amacli"], "Defter Türü seçilmedi → Bilgi Amaçlı");
    assert.equal(out.bilgiAmacli, true);
  });

  it("iç tutarlılık: kalemlerin defter tutarları Hesap Planı Mizanı'nın 6 / 7 hareketleriyle birebir (yıl, çeyrek, ay, boş ay)", async () => {
    for (const [from, to] of [["2026-01-01", "2026-12-31"], ["2026-04-01", "2026-06-30"], ["2026-05-01", "2026-05-31"], ["2026-09-01", "2026-09-30"], ["2026-01-01", "2026-01-31"]]) {
      const out = await must("gelir tablosu", api.get(`${FS}/income-statement?from=${from}&to=${to}`));
      const trial = await must("mizan", api.get(`/api/workspace/ledger?from=${from}&to=${to}`));
      const want = new Map();
      for (const row of trial.trial.accounts) {
        const place = incomeLineOf(row.code);
        if (!place || place === "unclassified") continue;
        const net = Math.round((row.debit - row.credit) * 100);
        want.set(place.kalem, (want.get(place.kalem) || 0) + net);
      }
      for (const kalem of ["A", "B", "D", "E", "F", "G", "H", "I", "J", "K"]) {
        const sign = item(out, kalem).gelir ? -1 : 1;
        assert.equal(booked(out, kalem), sign * (want.get(kalem) || 0) || 0, `${from}…${to} ${kalem}`);
      }
    }
  });

  it("iş parçacığı ↔ iş parçacığısız sonuç birebir; değerleme ucu; önbellek veri değişince düşer", async () => {
    const job = { kind: "income", from: "2026-01-01", to: "2026-09-30" };
    const viaWorker = await must("gelir tablosu", api.get(`${FS}/income-statement?from=${job.from}&to=${job.to}`));
    assert.deepEqual(ctx.app.context.financialStatements.inline(job), viaWorker);
    const valuation = await must("değerleme", api.get(`${FS}/stock-valuation?date=2026-09-30`));
    assert.equal(valuation.totals.dssMinor, 10800);
    assert.deepEqual(valuation.products.map(row => [row.name, row.qty, row.unitCost, row.valueMinor, row.basis]), [["Ürün P", 2, 54, 10800, "ortalama"]]);
    assert.deepEqual(ctx.app.context.financialStatements.inline({ kind: "valuation", date: "2026-09-30" }), valuation);
    await must("kasa çıkışı 2", api.post("/api/workspace/cash", { kind: "out", amount: "50", description: "Çay", date: "2026-09-10" }));
    const again = await must("gelir tablosu", api.get(`${FS}/income-statement?from=${job.from}&to=${job.to}`));
    assert.equal(item(again, "E").tutarMinor, 35000, "yeni kayıt sonrası önbellek düştü");
  });

  it("varsayılan dönem Bu Yıl; çapraz yıl 400 gelir-tablosu-tek-yil; geçersiz tarih 400", async () => {
    const out = await must("varsayılan", api.get(`${FS}/income-statement`));
    assert.deepEqual([out.from, out.to], ["2026-01-01", "2026-12-31"]);
    const cross = await api.get(`${FS}/income-statement?from=2025-12-01&to=2026-01-31`);
    assert.equal(cross.status, 400);
    assert.equal(cross.code, "gelir-tablosu-tek-yil");
    assert.equal((await api.get(`${FS}/income-statement?from=2026-13-01&to=2026-12-31`)).status, 400);
    assert.equal((await api.get(`${FS}/stock-valuation?date=2026-02-30`)).status, 400);
  });

  it("yetki: Muhasebe görür; Personel ve Avukat 403 (Ana Defter raporlarıyla aynı)", async () => {
    const admin = api.client;
    const accounting = apiOf(await createUser(ctx.server, admin, { username: "muh1", role: "muhasebe" }));
    const staff = apiOf(await createUser(ctx.server, admin, { username: "per1", role: "personel" }));
    const lawyer = apiOf(await createUser(ctx.server, admin, { username: "avk1", role: "avukat" }));
    assert.equal((await accounting.get(`${FS}/income-statement?from=2026-01-01&to=2026-09-30`)).status, 200);
    for (const user of [staff, lawyer]) {
      assert.equal((await user.get(`${FS}/income-statement?from=2026-01-01&to=2026-09-30`)).status, 403);
      assert.equal((await user.get(`${FS}/stock-valuation?date=2026-09-30`)).status, 403);
    }
  });

  it("kilitli dönem DONMUŞ defterden, açık dönem canlı türetmeden; kural farkı Kesin Değil nedeni", async () => {
    const before = await must("önce", api.get(`${FS}/income-statement?from=2026-01-01&to=2026-06-30`));
    await lockAndWait(api.client, "2026-06-30");
    const lockedSame = await must("kilitli", api.get(`${FS}/income-statement?from=2026-01-01&to=2026-06-30`));
    assert.deepEqual(lockedSame.items, before.items, "kilit konunca sayılar aynı");
    rule.on = true;
    try {
      const fs = ctx.app.context.financialStatements;
      const locked = fs.inline({ kind: "income", from: "2026-01-01", to: "2026-06-30" });
      assert.equal(item(locked, "A").tutarMinor, 250000, "kilitli dönemin satışı donmuş defterden (canlı türetme +100,00 gösterirdi)");
      assert.ok(locked.kesinDegil.some(row => row.kod === "kural-farki"), JSON.stringify(locked.kesinDegil));
      const open = fs.inline({ kind: "income", from: "2026-07-01", to: "2026-09-30" });
      assert.equal(item(open, "E").tutarMinor, 45000, "açık dönem canlı türetmeden (300 + 50 + benzetimin 100)");
    } finally {
      rule.on = false;
    }
  });

  it("iki şirket: ikinci şirketin Gelir Tablosu boş, birinci şirketinkini görmez; geri dönünce sayılar aynı", async () => {
    const before = await must("001", api.get(`${FS}/income-statement?from=2026-01-01&to=2026-09-30`));
    const list = await must("şirketler", api.get("/api/companies"));
    const first = list.current;
    const created = await must("002", api.post("/api/companies", { name: "İkinci Şirket", select: true }));
    const other = await must("002 gelir tablosu", api.get(`${FS}/income-statement?from=2026-01-01&to=2026-09-30`));
    assert.ok(other.items.every(row => row.tutarMinor === 0), JSON.stringify(other.items.map(row => [row.kod, row.tutarMinor])));
    assert.equal(other.entryCount, 0);
    assert.notEqual(created.company.id, first);
    await must("001 seç", api.post("/api/companies/select", { id: first }));
    assert.deepEqual(await must("001 yeniden", api.get(`${FS}/income-statement?from=2026-01-01&to=2026-09-30`)), before);
  });
});
