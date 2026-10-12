// 2.2.0 — Kabul 24'ün KDV kipi (plan §12.5 adım 23–24 "KDV kipi ayrı şirkette") ve §4.3 ek testi (Aşama 11 "Çalışıyor Mu"): ödeme kuruluşu
// POS'unda komisyon KDV Hariç kesilir, sağlayıcı carisine kesinti satırı yazılır, aylık taslak fatura (KDV Dahil) kaydedilince kesintiler ona
// bağlanır ("yalnız bağlı" kapama: ilgisiz açık alış faturası FIFO'ya girmez). Sayılar planın tablosundan (kâhin).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BANK, TODAY, balanceOf, bootBank, flagPos, kurus, must, openAcceptanceAccounts, openPos, posCheck, posInvoice, settle, subBalances, trialBalances, ziraatPos } from "./banka-220-pos-ortak.mjs";

const kdvPos = (bankAccountId, providerAccountId) => ziraatPos(bankAccountId, { name: "Ödeme Kuruluşu Sanal POS", kind: "virtual", providerKind: "payment_institution", tax: "vat_excl", providerAccountId });

async function setup(ctx) {
  const acc = await openAcceptanceAccounts(ctx.api);
  const provider = await must("sağlayıcı", ctx.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
  const customer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  const item = await must("Ürün B", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "100" }));
  const pos = await openPos(ctx.api, kdvPos(acc.ziraat.id, provider.id));
  return { acc, provider, customer, item, pos };
}

describe("Kabul 24 KDV kipi: net 9.700; Ekim taslağı 300 (KDV Dahil 250 + 50); kayıttan sonra 191 = 50 = KDV raporu; taslak Ödendi", () => {
  let ctx;
  let s;
  before(async () => {
    ctx = await bootBank();
    s = await setup(ctx);
  });
  after(() => ctx?.server.close());

  it("POS: Ödeme Kuruluşu, KDV Hariç; KDV kipinde Sağlayıcı Carisi zorunlu (400 pos-provider-account)", async () => {
    assert.deepEqual([s.pos.providerKind, s.pos.tax], ["payment_institution", "vat_excl"]);
    await flagPos(ctx.api, s.acc.ziraat.id); // (setup'taki openPos zaten işaretledi; burada açıkça)
    const res = await ctx.api.post(`${BANK}/pos`, kdvPos(s.acc.ziraat.id, ""));
    assert.equal(res.status, 400);
    assert.equal(res.code, "pos-provider-account");
  });

  it("satış 10.000 (08.10) → 12.10 valör: Ziraat +9.700; kesinti satırı 300 sağlayıcıya (B 320 / A 108.01); 108.01 = 0; 653 yok", async () => {
    await must("POS'lu fatura", posInvoice(ctx.api, { accountId: s.customer.id, itemId: s.item.id, qty: 10, unitPrice: 1000, date: TODAY }));
    const before = await balanceOf(ctx.api, s.acc.ziraat.id);
    ctx.server.clock.set("2026-10-12T09:00:00+03:00");
    await settle(ctx.api);
    assert.equal((await balanceOf(ctx.api, s.acc.ziraat.id)) - before, kurus(9700), "net 9.700");
    const subs = await subBalances(ctx.api);
    assert.equal(kurus(subs["108.01"]?.balance || 0), 0, "108.01 = 0");
    const trial = await trialBalances(ctx.api);
    assert.equal(kurus(trial["653"] || 0), 0, "KDV kipinde komisyon gideri faturadan gelir (653 henüz 0)");
    const provider = await must("sağlayıcı", ctx.api.get(`/api/workspace/accounts/${s.provider.id}`));
    assert.equal(provider.totals.balance, 300, "sağlayıcıda 300 ön ödeme (bizim lehimize)");
    const line = provider.ledger.find(item => item.label === "POS Komisyon Kesintisi");
    assert.ok(line, "ekstrede POS Komisyon Kesintisi");
    await posCheck(ctx.api, "KDV valör");
  });

  it("Ekim taslağı (Şimdi Oluştur) = 300, KDV Dahil: matrah 250, KDV 50; kayıttan sonra 191 = 50 = KDV raporu; taslak fatura Ödendi; 653 = 250", async () => {
    const created = await must("Şimdi Oluştur", ctx.api.post(`${BANK}/pos/commission-invoices`, { month: "2026-10" }));
    assert.equal(created.created.length, 1);
    const draftId = created.created[0].invoiceId;
    const draft = await must("taslak", ctx.api.get(`/api/workspace/invoices/${draftId}`));
    assert.deepEqual([draft.status, draft.kind, draft.payableTotal, draft.netTotal, draft.vatTotal], ["draft", "purchase", 300, 250, 50]);
    assert.equal(draft.lines[0].expenseCode, "commission");
    await must("taslağı kaydet", ctx.api.post(`/api/workspace/invoices/${draftId}/issue`, { number: "OK2026000000001", force: true }));
    const trial = await trialBalances(ctx.api);
    assert.equal(kurus(trial["191"] || 0), kurus(50), "191 = 50");
    assert.equal(kurus(trial["653"] || 0), kurus(250), "653 = 250");
    const report = await must("KDV Özeti", ctx.api.get("/api/workspace/report-center/kdv-ozeti?from=2026-10-01&to=2026-10-31"));
    const input = report.summary.find(([label]) => label.startsWith("İndirilecek KDV"));
    assert.match(input[1], /^50,00\s*(TL)?$/, `KDV raporu indirilecek ${input[1]}`);
    const doc = await must("komisyon faturası", ctx.api.get(`/api/workspace/invoices/${draftId}`));
    assert.deepEqual([doc.payState, doc.open], ["paid", 0], "taslak fatura Ödendi");
    const provider = await must("sağlayıcı", ctx.api.get(`/api/workspace/accounts/${s.provider.id}`));
    assert.equal(provider.totals.balance, 0, "sağlayıcı 0");
    const list = await must("komisyon faturaları", ctx.api.get(`${BANK}/pos/commission-invoices?month=2026-10`));
    assert.deepEqual(list.rows, [], "bağlanmamış kesinti kalmadı");
    assert.equal(list.linked[0].differenceMinor, 0);
    await posCheck(ctx.api, "KDV kayıt");
  });
});

describe("§4.3 ek testi: sağlayıcıda ilgisiz açık alış 1.000 + kesintiler 300 + 300 → taslak 600 Ödendi, ilgisiz Açık 1.000; 610 ile Kısmen Ödendi · Açık 10", () => {
  for (const amount of [600, 610]) {
    it(`komisyon faturası ${amount}`, async () => {
      const ctx = await bootBank();
      try {
        const s = await setup(ctx);
        const unrelated = await must("ilgisiz alış", ctx.api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: s.provider.id, number: "ILG-1", issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20, expenseCode: "advisory" }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
        await must("satış 1", posInvoice(ctx.api, { accountId: s.customer.id, itemId: s.item.id, qty: 10, unitPrice: 1000, date: TODAY }));
        ctx.server.clock.set("2026-10-09T10:00:00+03:00");
        await must("satış 2", posInvoice(ctx.api, { accountId: s.customer.id, itemId: s.item.id, qty: 10, unitPrice: 1000, date: "2026-10-09", extra: { similarOk: true } }));
        ctx.server.clock.set("2026-10-14T09:00:00+03:00");
        assert.equal((await settle(ctx.api)).settled, 2, "iki valör günü");
        let open = await must("ilgisiz", ctx.api.get(`/api/workspace/invoices/${unrelated.id}`));
        assert.deepEqual([open.paid, open.open], [0, 1000], "taslak kaydedilmeden önce ilgisiz fatura Açık 1.000 (kesinti FIFO'ya girmez)");
        assert.ok(["open", "overdue"].includes(open.payState), open.payState);
        const created = await must("taslak", ctx.api.post(`${BANK}/pos/commission-invoices`, { month: "2026-10" }));
        const draftId = created.created[0].invoiceId;
        assert.equal(created.created[0].netMinor, kurus(600));
        const lines = (await must("taslak kartı", ctx.api.get(`/api/workspace/invoices/${draftId}`))).lines.map(line => ({ name: line.name, qty: line.qty, unitPrice: amount, vatRate: 20, expenseCode: "commission" }));
        await must("kaydet", ctx.api.post(`/api/workspace/invoices/${draftId}/issue`, { number: `OK-${amount}`, pricesIncludeVat: true, lines, force: true }));
        const doc = await must("komisyon faturası", ctx.api.get(`/api/workspace/invoices/${draftId}`));
        if (amount === 600) assert.deepEqual([doc.payState, doc.open], ["paid", 0], "komisyon faturası Ödendi");
        else assert.deepEqual([doc.payState, doc.payStateLabel, doc.open], ["partial", "Kısmen Ödendi", 10], "Kısmen Ödendi · Açık 10");
        open = await must("ilgisiz", ctx.api.get(`/api/workspace/invoices/${unrelated.id}`));
        assert.deepEqual([open.paid, open.open], [0, 1000], "ilgisiz fatura yine Açık 1.000");
        const provider = await must("sağlayıcı", ctx.api.get(`/api/workspace/accounts/${s.provider.id}`));
        assert.equal(provider.totals.balance, amount === 600 ? -1000 : -1010, "cari bakiye: bizim borcumuz");
        await posCheck(ctx.api, `ek test ${amount}`);
      } finally {
        await ctx.server.close();
      }
    });
  }
});

describe("Komisyon iadesi > kesinti olan ay → taslak açılmaz, \"İade Alacağı\" (Aşama 11 Nasıl Bozarım)", () => {
  it("Eylül satışı + kesinti 300 (faturalandı); Ekim'de tam iade (İadede Komisyon: Tam) → Ekim neti −300: taslak yok, İade Alacağı", async () => {
    const ctx = await bootBank({ now: "2026-09-25T10:00:00+03:00" });
    try {
      const ziraat = (await must("Ziraat", ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-09-01", amount: "100.000", confirmed: true } })));
      const provider = await must("sağlayıcı", ctx.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-09-01" }));
      const customer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
      await openPos(ctx.api, { ...kdvPos(ziraat.id, provider.id), validFrom: "2026-09-01", refundCommission: "full" });
      await must("satış", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: "10.000", method: "card", date: "2026-09-25" }));
      const sale = (await must("satışlar", ctx.api.get(`${BANK}/pos/sales`))).sales[0];
      ctx.server.clock.set("2026-09-30T10:00:00+03:00");
      await settle(ctx.api);
      const sept = await must("Eylül taslağı", ctx.api.post(`${BANK}/pos/commission-invoices`, { month: "2026-09" }));
      await must("Eylül kaydet", ctx.api.post(`/api/workspace/invoices/${sept.created[0].invoiceId}/issue`, { number: "OK-EYL", force: true }));
      ctx.server.clock.set("2026-10-02T10:00:00+03:00");
      await must("tam iade", ctx.api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "out", amount: "10.000", method: "card", date: "2026-10-02", posRefundOf: sale.id }));
      ctx.server.clock.set("2026-10-06T10:00:00+03:00");
      await settle(ctx.api);
      const october = await must("Ekim", ctx.api.post(`${BANK}/pos/commission-invoices`, { month: "2026-10" }));
      assert.deepEqual(october.created, [], "taslak açılmaz");
      assert.deepEqual(october.rows.map(row => [row.state, row.stateLabel, row.netMinor]), [["refund-credit", "İade Alacağı", -kurus(300)]]);
      const balance = (await must("sağlayıcı", ctx.api.get(`/api/workspace/accounts/${provider.id}`))).totals.balance;
      assert.equal(balance, -300, "sağlayıcı 300 alacaklı (komisyon iadesi bize borcu)");
      await posCheck(ctx.api, "İade Alacağı");
    } finally {
      await ctx.server.close();
    }
  });
});
