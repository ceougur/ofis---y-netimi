// 2.2.0 — POS bütün tahsilat formlarında (plan §4.2: cari, fatura peşini, kayıt, taksit, stok) ve POS İadesi yolları (§4.6: taksit iadesi,
// stok müşteri iadesi, cari POS İadesi); blokeli POS (Ek 4), ANLIK DURUM POS Bekleyen (K10), Nakit Akış POS kaynakları (§4.7), yetkiler (§9.1),
// şirket ayrımı. Her adımda mutabakat (pos:*).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { apiOf } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";
import { BANK, TODAY, balanceOf, bootBank, calendarOf, expectStatus, kurus, must, openAcceptanceAccounts, openPos, posCheck, salesOf, settle, summaryOf, ziraatPos } from "./banka-220-pos-ortak.mjs";

describe("POS modül yolları: kayıt, taksit, stok; iade yolları", () => {
  let ctx;
  let acc;
  let pos;
  let party;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id));
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Taksitli Müşteri", type: "customer", registeredOn: "2026-10-01" }));
  });
  after(() => ctx?.server.close());

  it("kayıt tahsilatı POS 3 Taksit → satış (3 kalem, %3,5); sil → void (valörden önce, komisyonsuz)", async () => {
    const created = await must("kayıt tahsilatı", ctx.api.post("/api/workspace/cases/K-POS/payments", { amount: "3.000", date: TODAY, method: "card", installments: 3, caseTitle: "Kayıt" }));
    let sale = (await salesOf(ctx.api)).find(item => item.grossMinor === kurus(3000));
    assert.deepEqual([sale.installments, sale.commissionMinor, sale.items.length], [3, kurus(105), 3]);
    assert.equal(ctx.store.get("SELECT fin_ref FROM payments WHERE id = ?", created.id).fin_ref, pos.id);
    await must("sil", ctx.api.del(`/api/workspace/payments/${created.id}`));
    sale = (await salesOf(ctx.api)).find(item => item.id === sale.id);
    assert.equal(sale.status, "void");
    await posCheck(ctx.api, "kayıt");
  });

  it("taksit kartı tahsilatı POS → satış; taksit iadesi kart yoluyla → POS İadesi (asıl satış karttan bulunur)", async () => {
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: party.id, name: party.name, total: "6.000", mode: "auto", count: 3, firstDue: "2026-10-15" }));
    await must("taksit tahsilatı", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "2.000", method: "card", date: TODAY }));
    await must("taksit iadesi", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "out", amount: "500", method: "card", date: TODAY }));
    const sale = (await salesOf(ctx.api, "?kind=sale")).find(item => item.grossMinor === kurus(2000));
    const refund = (await salesOf(ctx.api, "?kind=refund")).find(item => item.grossMinor === kurus(500));
    assert.equal(refund.origin?.id, sale.id, "asıl satış taksit kartından");
    assert.equal(sale.refundedMinor, kurus(500));
    await posCheck(ctx.api, "taksit");
  });

  it("stok peşin satış POS → satış; stok müşteri iadesi kart yoluyla (asıl işlemle) → POS İadesi", async () => {
    const item = await must("ürün", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "S", name: "Ürün S", unit: "Adet", openingQty: "10" }));
    const sold = await must("stok satışı", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "2", unitPrice: "750", pay: "cash", method: "card", date: TODAY }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM stock_moves WHERE id = ?", sold.moveId).fin_ref, pos.id);
    const sale = (await salesOf(ctx.api, "?kind=sale")).find(entry => entry.grossMinor === kurus(1500));
    assert.ok(sale, "stok satışının POS satışı");
    await must("müşteri iadesi", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "750", pay: "cash", method: "card", date: TODAY, posRefundOf: sale.id }));
    const refund = (await salesOf(ctx.api, "?kind=refund")).find(entry => entry.origin?.id === sale.id);
    assert.equal(refund?.grossMinor, kurus(750));
    await posCheck(ctx.api, "stok");
  });

  it("cari POS İadesi (Banka → POS İşlemleri → İade) asıl satışa bağlı; Kaynaksız (Eski Satış) iadesi asıl satış olmadan", async () => {
    await must("cari POS", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "1.200", method: "card", date: TODAY }));
    const sale = (await salesOf(ctx.api, "?kind=sale")).find(entry => entry.grossMinor === kurus(1200));
    await must("POS İadesi", ctx.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "200", date: TODAY }));
    const refunds = (await salesOf(ctx.api, "?kind=refund")).filter(entry => entry.origin?.id === sale.id);
    assert.equal(refunds.length, 1);
    await must("kaynaksız", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount: "100", method: "card", date: TODAY, posSourceless: true }));
    const sourceless = (await salesOf(ctx.api, "?kind=refund")).find(entry => entry.src === "sourceless");
    assert.deepEqual([sourceless.grossMinor, sourceless.origin], [kurus(100), null]);
    await posCheck(ctx.api, "cari iade");
  });

  it("ANLIK DURUM: POS Bekleyen (Net) = özet; Nakit Akış'ta POS kaynakları valör gününde net", async () => {
    const summary = await summaryOf(ctx.api);
    const overview = await must("ANLIK DURUM", ctx.api.get("/api/workspace/overview"));
    const bank = overview.bank || overview.cash?.bank || overview;
    const block = JSON.stringify(overview);
    assert.ok(block.includes('"pos":true'), "POS tanımlı: ANLIK DURUM'da görünür");
    assert.ok(block.includes(`"posNet":${summary.posPending.netMinor / 100}`), `posNet ${summary.posPending.netMinor / 100}`);
    assert.ok(bank);
    const flow = await must("Nakit Akış", ctx.api.get("/api/workspace/overview/nakit-akisi?preset=next90"));
    const text = JSON.stringify(flow);
    assert.ok(text.includes("POS ·") || text.includes('"source":"pos"'), "POS kaynağı nakit akışında");
  });
});

describe("Blokeli POS (Ek 4): 30 takvim günü bloke → valör 07.11 Cumartesi → 09.11; ayrı kategori", () => {
  it("bloke kalem Blokeli POS'ta; ANLIK DURUM POS Bekleyen'e değil Blokeli POS'a", async () => {
    const ctx = await bootBank();
    try {
      const acc = await openAcceptanceAccounts(ctx.api);
      await openPos(ctx.api, ziraatPos(acc.ziraat.id, { blockDays: 30 }));
      const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Bloke Müşteri", type: "customer", registeredOn: "2026-10-01" }));
      await must("satış", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: TODAY }));
      const sale = (await salesOf(ctx.api))[0];
      assert.deepEqual([sale.items[0].valueDate, sale.items[0].blocked, sale.blocked], ["2026-11-09", true, true]);
      const summary = await summaryOf(ctx.api);
      assert.deepEqual([summary.posPending.netMinor, summary.posPending.blockedMinor], [0, kurus(9750)]);
      const calendar = await calendarOf(ctx.api);
      assert.deepEqual(calendar.rows.map(row => [row.valueDate, row.kind, row.kindLabel, row.netMinor]), [["2026-11-09", "blocked", "Blokeli POS", kurus(9750)]]);
      ctx.server.clock.set("2026-11-09T09:00:00+03:00");
      await settle(ctx.api);
      assert.equal(await balanceOf(ctx.api, acc.ziraat.id), kurus(109750));
      await posCheck(ctx.api, "bloke");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("Yetkiler (plan §9.1) ve şirket ayrımı", () => {
  it("personel: POS listesi 403, POS açma 403; muhasebe: açar; POS tahsilatı personel için tahsilat yetkisiyle", async () => {
    const ctx = await bootBank();
    try {
      const acc = await openAcceptanceAccounts(ctx.api);
      const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "pos-personel", role: "personel" }));
      const accountant = apiOf(await createUser(ctx.server, ctx.api.client, { username: "pos-muhasebe", role: "muhasebe" }));
      expectStatus(await staff.get(`${BANK}/pos`), 403, "", "personel liste");
      expectStatus(await staff.post(`${BANK}/pos`, ziraatPos(acc.ziraat.id)), 403, "", "personel açma");
      const pos = (await must("muhasebe POS açar", accountant.post(`${BANK}/pos`, ziraatPos(acc.ziraat.id)))).pos;
      expectStatus(await staff.post(`${BANK}/pos/${pos.id}/rates`, { validFrom: "2026-10-09", rates: [{ installments: 1, rate: "1" }] }), 403, "", "personel oran");
      const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Personel Müşterisi", type: "customer", registeredOn: "2026-10-01" }));
      await must("personel POS tahsilatı", staff.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "100", method: "card", date: TODAY }));
      const choices = await must("seçici", staff.get(`${BANK}/choices`));
      assert.deepEqual([choices.forms.pos.single, choices.pos.length], [true, 1], "seçicide POS (bakiye yok)");
      assert.ok(!("pending" in choices.pos[0]), "seçici bakiye/bekleyen dönmez");
      expectStatus(await staff.post(`${BANK}/settle`, {}), 403, "", "personel Şimdi Aktar");
      await posCheck(ctx.api, "yetki");
    } finally {
      await ctx.server.close();
    }
  });
});
