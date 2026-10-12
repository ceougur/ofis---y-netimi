// 2.2.0 — Kabul 17–28 (plan §12.5; Aşama 10–11 "Çalışıyor Mu"), API'den, sıfırdan, sahte saatle. Beklenen sayılar planın önceden yazılmış
// tablosundan (kâhin; program kodundan türetilmez). Adım 1–16 2.1.0'ın kabul testidir (banka-210-kabul-mizan); burada POS adımları için gereken
// ön koşullar kurulur (Ziraat 90.000: tahsilat + Kasa'ya aktarım + transfer aynen).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BANK, TODAY, acceptanceBase, balanceOf, bootBank, calendarOf, kurus, must, openPos, posCheck, posInvoice, qtyOf, salesOf, settle, subBalances, summaryOf, trialBalances, ziraatPos } from "./banka-220-pos-ortak.mjs";

describe("Kabul 17–28: POS (BSMV Dahil; valör, taksit, iade)", () => {
  let ctx;
  let base;
  let pos;
  let sale20;
  before(async () => {
    ctx = await bootBank();
    base = await acceptanceBase(ctx);
    // Adım 9–16 (2.1.0): Ziraat 120.000 → Kasa'ya 10.000 → Garanti'ye 20.000 = 90.000.
    const invoice = await must("fatura Ürün A", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: base.abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: base.urunA.id, name: "Ürün A", qty: 1, unitPrice: 20000, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    assert.ok(invoice.id);
    await must("tahsilat", ctx.api.post(`/api/workspace/accounts/${base.abc.id}/entries`, { kind: "in", amount: "20.000", method: "bank", bankAccountId: base.acc.ziraat.id, date: TODAY }));
    await must("bankadan kasaya", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "10.000", date: TODAY, bankAccountId: base.acc.ziraat.id }));
    await must("transfer", ctx.api.post(`${BANK}/transfers`, { accountId: base.acc.ziraat.id, toAccountId: base.acc.garanti.id, amount: "20.000", date: TODAY, channel: "virman" }));
    assert.equal(await balanceOf(ctx.api, base.acc.ziraat.id), kurus(90000), "ön koşul Ziraat 90.000");
  });
  after(() => ctx?.server.close());

  it("kabul 17–19: Ziraat Fiziki POS (Banka, BSMV Dahil, Tek Çekim %2,5, 3 Taksit %3,5, valör 2 iş günü, her ay, provizyon aynı gün) → 108.01", async () => {
    pos = await openPos(ctx.api, ziraatPos(base.acc.ziraat.id));
    assert.equal(pos.glSub, "108.01");
    assert.deepEqual([pos.providerKind, pos.tax, pos.valorRule, pos.valorDays, pos.installmentPayout, pos.provisionDays], ["bank", "bsmv_incl", "business", 2, "monthly", 0]);
    assert.deepEqual(pos.rates.map(rate => [rate.installments, rate.ratePpm]), [[1, 25_000], [3, 35_000]]);
  });

  it("kabul 20–22: Satış Faturası Ürün B 10 × 1.000 peşin POS Tek Çekim → Ürün B 15; ABC 0; Ziraat 90.000 (değişmedi); POS Bekleyen 10.000 brüt / 9.750 net; valör 12.10.2026", async () => {
    sale20 = await must("POS'lu fatura", posInvoice(ctx.api, { accountId: base.abc.id, itemId: base.urunB.id, qty: 10, unitPrice: 1000, date: TODAY }));
    assert.equal(await qtyOf(ctx.api, base.urunB.id), 15, "Ürün B 15");
    assert.equal((await must("ABC", ctx.api.get(`/api/workspace/accounts/${base.abc.id}`))).totals.balance, 0, "ABC 0");
    assert.equal(await balanceOf(ctx.api, base.acc.ziraat.id), kurus(90000), "Ziraat 90.000 (satış anında banka +0)");
    const summary = await summaryOf(ctx.api);
    assert.deepEqual([summary.posPending.grossMinor, summary.posPending.netMinor], [kurus(10000), kurus(9750)], "POS Bekleyen 10.000 brüt / 9.750 net");
    const calendar = await calendarOf(ctx.api);
    assert.deepEqual(calendar.rows.map(row => [row.valueDate, row.netMinor, row.kind]), [["2026-10-12", kurus(9750), "pos"]], "valör 12.10.2026");
    const subs = await subBalances(ctx.api);
    assert.equal(kurus(subs["108.01"]?.balance || 0), kurus(10000), "108.01 = 10.000 (B 108.01 / A 120)");
    await posCheck(ctx.api, "kabul 22");
  });

  it("kabul 23–24: saat 12.10.2026 → kuyruk → Ziraat 99.750; POS Bekleyen 0; 653 = 250; İşlem Kartı \"Valör 12.10.2026 (08.10 Perşembe + 2 iş günü)\"", async () => {
    ctx.server.clock.set("2026-10-12T09:00:00+03:00");
    const result = await settle(ctx.api);
    assert.equal(result.settled, 1, "tek gün fişi");
    assert.equal(await balanceOf(ctx.api, base.acc.ziraat.id), kurus(99750), "Ziraat 99.750");
    const summary = await summaryOf(ctx.api);
    assert.deepEqual([summary.posPending.netMinor, summary.posPending.grossMinor], [0, 0], "POS Bekleyen 0");
    const trial = await trialBalances(ctx.api);
    assert.equal(kurus(trial["653"] || 0), kurus(250), "653 = 250 (BSMV 11,90 dahil)");
    const sales = await salesOf(ctx.api);
    const sale = sales.find(item => item.kind === "sale");
    assert.equal(sale.explain, "12.10.2026 (08.10 Perşembe + 2 iş günü)");
    const card = await must("İşlem Kartı", ctx.api.get(`${BANK}/events/${sale.eventNo}`));
    assert.equal(card.pos?.explain, "12.10.2026 (08.10 Perşembe + 2 iş günü)", "İşlem Kartı valör açıklaması");
    const voucherNo = sale.items[0].voucherNo;
    const voucher = await must("gün fişi", ctx.api.get(`${BANK}/events/${voucherNo}`));
    assert.equal(voucher.type, "pos_settlement");
    assert.deepEqual(voucher.lines.map(line => [line.gl, line.side, line.tryMinor]).sort(), [["102", "D", kurus(9750)], ["108", "C", kurus(10000)], ["653", "D", kurus(250)]].sort(), "B 102.01 9.750 · B 653 250 / A 108.01 10.000");
    await posCheck(ctx.api, "kabul 24");
  });

  it("kabul 25–26: 12.10 Satış Faturası Ürün B 12 × 1.000 peşin POS 3 Taksit → Ürün B 3; takvim 12.11 / 14.12 (12.12 Cumartesi) / 12.01.2027 × 3.860; bekleyen net 11.580 (brüt 12.000, komisyon 420)", async () => {
    await must("taksitli POS'lu fatura", posInvoice(ctx.api, { accountId: base.abc.id, itemId: base.urunB.id, qty: 12, unitPrice: 1000, date: "2026-10-12", installments: 3 }));
    assert.equal(await qtyOf(ctx.api, base.urunB.id), 3, "Ürün B 3");
    const calendar = await calendarOf(ctx.api);
    assert.deepEqual(calendar.rows.map(row => [row.valueDate, row.netMinor]), [["2026-11-12", kurus(3860)], ["2026-12-14", kurus(3860)], ["2027-01-12", kurus(3860)]]);
    const summary = await summaryOf(ctx.api);
    assert.deepEqual([summary.posPending.netMinor, summary.posPending.grossMinor], [kurus(11580), kurus(12000)]);
    const sale = (await salesOf(ctx.api)).find(item => item.installments === 3);
    assert.equal(sale.commissionMinor, kurus(420), "komisyon 420");
    await posCheck(ctx.api, "kabul 26");
  });

  it("kabul 27–28: 13.10 Satıştan İade (asıl adım 20) Ürün B 3 = 3.000 POS İadesi, İade Edilmez → Ürün B 6; ABC 0; iade valörü 15.10; Σ iade 3.000 ≤ 10.000; saat 15.10 → Ziraat 96.750", async () => {
    ctx.server.clock.set("2026-10-13T10:00:00+03:00");
    const original = await must("asıl fatura", ctx.api.get(`/api/workspace/invoices/${sale20.id}`));
    const line = original.lines[0];
    const ret = await must("Satıştan İade", ctx.api.post("/api/workspace/invoices", {
      kind: "sale_return", originalId: sale20.id, issueDate: "2026-10-13", lines: [{ originLineId: line.id, qty: 3 }],
      payment: { cash: [{ amount: 3000, method: "card" }], cheques: [], endorse: [], rest: "open" }, force: true,
    }));
    assert.ok(ret.id);
    assert.equal(await qtyOf(ctx.api, base.urunB.id), 6, "Ürün B 6");
    assert.equal((await must("ABC", ctx.api.get(`/api/workspace/accounts/${base.abc.id}`))).totals.balance, 0, "ABC 0");
    const refund = (await salesOf(ctx.api, "?kind=refund"))[0];
    assert.equal(refund.grossMinor, kurus(3000));
    assert.deepEqual(refund.items.map(item => [item.valueDate, item.role, item.grossMinor]), [["2026-10-15", "refund", kurus(3000)]], "iade kalemi valörü 15.10");
    const origin = (await salesOf(ctx.api, "?kind=sale")).find(item => item.grossMinor === kurus(10000));
    assert.equal(origin.refundedMinor, kurus(3000), "Σ iade 3.000 ≤ 10.000");
    assert.equal(refund.origin?.id, origin.id, "asıl satış");
    const card = await must("İade İşlem Kartı", ctx.api.get(`${BANK}/events/${refund.eventNo}`));
    assert.equal(card.party?.name, "ABC Ltd.", "İşlem Kartı ABC");
    assert.equal(card.invoice?.id, ret.id, "iade faturası");
    assert.equal(card.pos?.origin?.id, origin.id, "asıl satış");
    assert.equal(card.pos?.originInvoice?.id, sale20.id, "asıl fatura");
    ctx.server.clock.set("2026-10-15T09:00:00+03:00");
    await settle(ctx.api);
    assert.equal(await balanceOf(ctx.api, base.acc.ziraat.id), kurus(96750), "Ziraat 96.750");
    const trial = await trialBalances(ctx.api);
    assert.equal(kurus(trial["653"] || 0), kurus(250), "İade Edilmez: 653 = 250 kalır");
    const subs = await subBalances(ctx.api);
    assert.equal(kurus(subs["108.01"]?.balance || 0), kurus(12000), "108.01 = 12.000 (taksitli satış bekliyor)");
    const summary = await summaryOf(ctx.api);
    assert.equal(summary.posPending.netMinor, kurus(11580), "POS Bekleyen (Net) 11.580");
    await posCheck(ctx.api, "kabul 28");
  });

  it("adım 33 mizanının POS satırları (ekstre adımları 2.3.0'da): 108.01 = 12.000, 610 = 2.500, 653 = 250; Borç = Alacak", async () => {
    const trial = await trialBalances(ctx.api);
    assert.equal(kurus(trial["108"] || 0), kurus(12000));
    assert.equal(kurus(trial["610"] || 0), kurus(2500), "610 Satıştan İadeler 2.500");
    assert.equal(kurus(trial["600"] || 0), -kurus(35000), "600 Satışlar 35.000 (A)");
    assert.equal(kurus(trial["391"] || 0), -kurus(6500), "391 Hesaplanan KDV 6.500 (A)");
    const ledger = await must("mizan", ctx.api.get("/api/workspace/ledger"));
    assert.equal(kurus(ledger.trial.totals.debit), kurus(ledger.trial.totals.credit));
  });
});
