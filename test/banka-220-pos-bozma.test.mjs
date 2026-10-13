// 2.2.0 — Aşama 10 (POS) "Nasıl Bozarım" (plan §12.3 Aşama 10 satırı) + POS seçimi kuralları (§4.2, §4.6, §7 hata kodları). Her senaryo yanıt
// kodu + gövde + veri tabanındaki sayı (ders 3) ve mutabakat (pos:*). Beklenen sayılar plan tablolarından (kâhin).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BANK, TODAY, balanceOf, bootBank, expectStatus, flagPos, kurus, must, openAcceptanceAccounts, openPos, posCheck, posInvoice, salesOf, settle, subBalances, summaryOf, ziraatPos } from "./banka-220-pos-ortak.mjs";

async function world(options = {}) {
  const ctx = await bootBank(options);
  const acc = await openAcceptanceAccounts(ctx.api);
  const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  const xyz = await must("XYZ", ctx.api.post("/api/workspace/accounts", { name: "XYZ Ltd.", type: "supplier", registeredOn: "2026-10-01" }));
  return { ctx, api: ctx.api, acc, abc, xyz };
}
const collect = (api, accountId, body) => api.post(`/api/workspace/accounts/${accountId}/entries`, { kind: "in", method: "card", date: TODAY, ...body });

describe("POS seçimi: POS yoksa eski davranış (108.00); tek POS kendiliğinden; iki POS'ta seçim zorunlu; banka hesabı verilemez", () => {
  let w;
  before(async () => {
    w = await world();
  });
  after(() => w?.ctx.server.close());

  it("önce fatura/tahsilat (POS yokken) → 108.00 Hesabı Atanmamış; sonra POS tanımlanınca yeni tahsilat 108.01'e, eskisi yerinde", async () => {
    await must("POS'suz kart tahsilatı", collect(w.api, w.abc.id, { amount: "1.000" }));
    let subs = await subBalances(w.api);
    assert.equal(kurus(subs["108.00"]?.balance || 0), kurus(1000), "POS yokken 108.00");
    const pos = await openPos(w.api, ziraatPos(w.acc.ziraat.id));
    await must("POS'lu tahsilat", collect(w.api, w.abc.id, { amount: "2.000" }));
    subs = await subBalances(w.api);
    assert.equal(kurus(subs["108.00"]?.balance || 0), kurus(1000), "eski satır 108.00'de kalır");
    assert.equal(kurus(subs[pos.glSub]?.balance || 0), kurus(2000), "tek POS kendiliğinden seçildi");
    await posCheck(w.api, "önce/sonra");
  });

  it("POS tahsilatında banka hesabı verilirse 400 bank-account-invalid; ödemede POS verilirse 400 pos-not-for-payment", async () => {
    expectStatus(await collect(w.api, w.abc.id, { amount: "100", bankAccountId: w.acc.ziraat.id }), 400, "bank-account-invalid", "POS + banka hesabı");
    const pos = (await must("POS listesi", w.api.get(`${BANK}/pos`))).pos[0];
    expectStatus(await w.api.post(`/api/workspace/accounts/${w.xyz.id}/entries`, { kind: "out", method: "card", amount: "100", date: TODAY, posId: pos.id }), 400, "pos-not-for-payment", "ödemede POS");
    expectStatus(await collect(w.api, w.abc.id, { amount: "100", method: "bank", posId: pos.id }), 400, "pos-not-for-payment", "havalede POS");
  });

  it("ikinci POS açılınca seçim zorunlu (400 pos-required); seçilen POS'a yazılır", async () => {
    const second = await openPos(w.api, ziraatPos(w.acc.garanti.id, { name: "Garanti Sanal POS", kind: "virtual" }));
    assert.equal(second.glSub, "108.02");
    expectStatus(await collect(w.api, w.abc.id, { amount: "300" }), 400, "pos-required", "iki POS");
    await must("seçili POS", collect(w.api, w.abc.id, { amount: "300", posId: second.id }));
    const subs = await subBalances(w.api);
    assert.equal(kurus(subs["108.02"]?.balance || 0), kurus(300));
    await posCheck(w.api, "iki POS");
  });
});

describe("Aşama 10 Nasıl Bozarım", () => {
  let w;
  let pos;
  before(async () => {
    w = await world();
    pos = await openPos(w.api, ziraatPos(w.acc.ziraat.id, { provisionDays: 1 }));
  });
  after(() => w?.ctx.server.close());

  it("tanımsız taksit → 400 pos-rate-missing (\"Bu POS'ta 9 taksit oranı tanımlı değil.\"); taksit sayısı 0 / 40 → 400", async () => {
    const res = await collect(w.api, w.abc.id, { amount: "900", installments: 9 });
    expectStatus(res, 400, "pos-rate-missing", "9 taksit");
    assert.equal(res.error, "Bu POS'ta 9 taksit oranı tanımlı değil.");
    expectStatus(await collect(w.api, w.abc.id, { amount: "900", installments: 40 }), 400, "pos-installments", "40 taksit");
    expectStatus(await collect(w.api, w.abc.id, { amount: "900", installments: 0 }), 400, "pos-installments", "0 taksit");
    assert.equal((await salesOf(w.api)).length, 0, "reddedilen istek satış yazmadı");
  });

  it("aynı provizyon numarası aynı gün aynı POS'ta → 409 pos-auth-duplicate; kart numarasının tamamı → 400 pos-card-last4", async () => {
    await must("ilk", collect(w.api, w.abc.id, { amount: "500", authCode: "A1B2C3", cardLast4: "4242" }));
    expectStatus(await collect(w.api, w.abc.id, { amount: "700", authCode: "a1b2c3", similarOk: true }), 409, "pos-auth-duplicate", "aynı provizyon");
    expectStatus(await collect(w.api, w.abc.id, { amount: "700", cardLast4: "4111111111111111" }), 400, "pos-card-last4", "kart numarası");
    const sales = await salesOf(w.api);
    assert.equal(sales.length, 1);
    assert.deepEqual([sales[0].authCode, sales[0].cardLast4], ["A1B2C3", "4242"]);
    await posCheck(w.api, "provizyon");
  });

  it("pasif POS → 400 pos-passive; etkinleştirince kabul", async () => {
    await must("pasife al", w.api.post(`${BANK}/pos/${pos.id}/status`, { status: "passive" }));
    expectStatus(await collect(w.api, w.abc.id, { amount: "100", posId: pos.id }), 400, "pos-passive", "pasif POS (seçili)");
    // Etkin POS yokken kart tahsilatı eski davranışla (108.00) yazılır (POS'a bağlanmaz).
    await must("etkinleştir", w.api.post(`${BANK}/pos/${pos.id}/status`, { status: "active" }));
    await must("etkin POS", collect(w.api, w.abc.id, { amount: "100", posId: pos.id }));
  });

  it("oran değişince geçmiş değişmez: 09.10'dan geçerli %3 → eski satış komisyonu 12,50 (%2,5) kalır, yeni satış %3; aynı tarihli oran ikinci kez → 409 pos-rate-exists", async () => {
    const before = (await salesOf(w.api)).map(sale => [sale.id, sale.ratePpm, sale.commissionMinor]);
    await must("yeni oran", w.api.post(`${BANK}/pos/${pos.id}/rates`, { validFrom: "2026-10-09", rates: [{ installments: 1, rate: "3" }] }));
    expectStatus(await w.api.post(`${BANK}/pos/${pos.id}/rates`, { validFrom: "2026-10-09", rates: [{ installments: 1, rate: "4" }] }), 409, "pos-rate-exists", "aynı tarih");
    assert.deepEqual((await salesOf(w.api)).map(sale => [sale.id, sale.ratePpm, sale.commissionMinor]), before, "geçmiş satışlar değişmedi");
    w.ctx.server.clock.set("2026-10-09T10:00:00+03:00");
    await must("09.10 satışı", collect(w.api, w.abc.id, { amount: "1.000", date: "2026-10-09" }));
    const sale = (await salesOf(w.api)).find(item => item.date === "2026-10-09");
    assert.deepEqual([sale.ratePpm, sale.commissionMinor], [30_000, kurus(30)], "%3 → 30");
    const old = (await salesOf(w.api)).find(item => item.grossMinor === kurus(500));
    assert.deepEqual([old.ratePpm, old.commissionMinor], [25_000, kurus(12.5)], "08.10 satışı %2,5 → 12,50");
    // Tarih oranın başlangıcından önceyse 400 (oran yok).
    expectStatus(await collect(w.api, w.abc.id, { amount: "100", date: "2026-09-30", installments: 3 }), 400, "pos-rate-missing", "oran başlangıcından önce");
  });

  it("POS sil → yalnız hiç kullanılmamış POS silinir; kullanılmış → 409 pos-in-use; silinen POS'un adıyla yeniden açılan POS yeni alt hesap alır", async () => {
    expectStatus(await w.api.del(`${BANK}/pos/${pos.id}`), 409, "pos-in-use", "kullanılmış POS");
    const temp = await openPos(w.api, ziraatPos(w.acc.ziraat.id, { name: "Geçici POS" }));
    await must("sil", w.api.del(`${BANK}/pos/${temp.id}`));
    const again = await openPos(w.api, ziraatPos(w.acc.ziraat.id, { name: "Geçici POS" }));
    assert.notEqual(again.glSub, temp.glSub, "alt hesap yeniden kullanılmaz");
    await must("pasife al", w.api.post(`${BANK}/pos/${again.id}/status`, { status: "passive" }));
    await posCheck(w.api, "sil/yeniden aç");
  });

  it("POS kartında bağlı hesap değişince bekleyenler ESKİ hesaba (kopya); \"Bekleyenleri Yeni Hesaba Taşı\" ile yenisine", async () => {
    // 09.10 satışı (1.000, %3) bekliyor; POS'un hesabını Garanti yap (İz 3.1: yeni hesap "POS Kullan" işaretli olmalı).
    await flagPos(w.api, w.acc.garanti.id);
    await must("hesap değiştir", w.api.put(`${BANK}/pos/${pos.id}`, { bankAccountId: w.acc.garanti.id }));
    w.ctx.server.clock.set("2026-10-10T10:00:00+03:00");
    await must("10.10 satışı", collect(w.api, w.abc.id, { amount: "2.000", date: "2026-10-10" }));
    const ziraat = await balanceOf(w.api, w.acc.ziraat.id);
    const garanti = await balanceOf(w.api, w.acc.garanti.id);
    w.ctx.server.clock.set("2026-10-15T09:00:00+03:00");
    await settle(w.api);
    // 08.10 satışları (500 + 100 + 1.000 (POS yokken değil)…) ve 09.10 satışı eski hesaba (Ziraat), 10.10 satışı Garanti'ye.
    const sales = await salesOf(w.api);
    const toZiraat = sales.filter(sale => sale.date <= "2026-10-09" && sale.status === "active").reduce((sum, sale) => sum + sale.netMinor, 0);
    const toGaranti = sales.filter(sale => sale.date === "2026-10-10").reduce((sum, sale) => sum + sale.netMinor, 0);
    assert.equal((await balanceOf(w.api, w.acc.ziraat.id)) - ziraat, toZiraat, "bekleyenler eski hesaba (satıştaki kopya)");
    assert.equal((await balanceOf(w.api, w.acc.garanti.id)) - garanti, toGaranti, "yeni satış yeni hesaba");
    // Taşı: yeni bir 15.10 satışı (bekliyor) Ziraat'e bağlı olsun diye hesabı geri al, satış gir, sonra Garanti'ye taşı.
    await must("hesabı geri al", w.api.put(`${BANK}/pos/${pos.id}`, { bankAccountId: w.acc.ziraat.id }));
    await must("15.10 satışı", collect(w.api, w.abc.id, { amount: "4.000", date: "2026-10-15" }));
    await must("hesabı Garanti", w.api.put(`${BANK}/pos/${pos.id}`, { bankAccountId: w.acc.garanti.id }));
    const moved = await must("taşı", w.api.post(`${BANK}/pos/${pos.id}/move-pending`, {}));
    assert.equal(moved.moved, 1, "bir bekleyen satış taşındı");
    const g2 = await balanceOf(w.api, w.acc.garanti.id);
    w.ctx.server.clock.set("2026-10-20T09:00:00+03:00");
    await settle(w.api);
    assert.equal((await balanceOf(w.api, w.acc.garanti.id)) - g2, kurus(4000) - kurus(120), "taşınan satış Garanti'ye (4.000 − %3)");
    await posCheck(w.api, "hesap değişimi");
  });

  it("provizyon süresi geçmiş satışta POS İşlemleri → İptal Et → 409 pos-provision-expired, neden yazısı; provizyon içinde → void, komisyon doğmaz", async () => {
    w.ctx.server.clock.set("2026-10-20T10:00:00+03:00");
    const res = await must("20.10 satışı", collect(w.api, w.abc.id, { amount: "600", date: "2026-10-20" }));
    assert.ok(res);
    let sale = (await salesOf(w.api)).find(item => item.date === "2026-10-20");
    assert.equal(sale.voidable, true, "provizyon (1 gün) içinde");
    w.ctx.server.clock.set("2026-10-22T10:00:00+03:00");
    sale = (await salesOf(w.api)).find(item => item.date === "2026-10-20");
    assert.equal(sale.voidable, false);
    assert.equal(sale.voidReason, "Provizyon süresi geçti; POS İadesi yapın.");
    expectStatus(await w.api.post(`${BANK}/pos/sales/${sale.id}/void`, {}), 409, "pos-provision-expired", "provizyon geçti");
    w.ctx.server.clock.set("2026-10-23T10:00:00+03:00");
    await must("23.10 satışı", collect(w.api, w.abc.id, { amount: "800", date: "2026-10-23" }));
    const fresh = (await salesOf(w.api)).find(item => item.date === "2026-10-23");
    const before = await summaryOf(w.api);
    await must("İptal Et", w.api.post(`${BANK}/pos/sales/${fresh.id}/void`, {}));
    const after = await summaryOf(w.api);
    assert.equal(after.posPending.grossMinor, before.posPending.grossMinor - kurus(800), "void: bekleyenden düştü");
    const voided = (await salesOf(w.api)).find(item => item.id === fresh.id);
    assert.deepEqual([voided.status, voided.items.every(item => item.status === "void")], ["void", true], "satış ve kalemleri void");
    const abc = await must("ABC", w.api.get(`/api/workspace/accounts/${w.abc.id}`));
    assert.ok(!abc.ledger.some(line => line.credit === 800 && line.date === "2026-10-23"), "modül satırı silindi");
    await posCheck(w.api, "void");
  });

  it("faturanın POS peşini POS İşlemleri'nden void edilmez (409 pos-void-invoice; faturayı iptal edin)", async () => {
    const item = await must("ürün", w.api.post("/api/workspace/stock", { kind: "goods", code: "Q", name: "Ürün Q", unit: "Adet", openingQty: "5" }));
    const invoice = await must("POS'lu fatura", posInvoice(w.api, { accountId: w.abc.id, itemId: item.id, name: "Ürün Q", qty: 1, unitPrice: 1200, date: "2026-10-23", extra: { similarOk: true } }));
    const sale = (await salesOf(w.api)).find(entry => entry.invoice?.id === invoice.id);
    expectStatus(await w.api.post(`${BANK}/pos/sales/${sale.id}/void`, {}), 409, "pos-void-invoice", "faturalı void");
  });
});
