// Hakem K8 (10.10.2026; docs/kanit/2026-10-10/kahin/hakem-hukumleri.json → KREDI-ANAPARA-ASIMI, komşu yollar; sondalar
// test/bagimsiz/cikti/hakem-KREDI-ANAPARA-ASIMI/kredi-sonda*.mjs). Kredi hesabı (300) borç bakiyesi veremez (Tekdüzen: 300 pasif karakterli;
// ödenen anapara kalan borcu aşamaz — plan §3.3 adım 2 hedef kuralları örüntüsü, §3.7 #17). Programın kuralı geri ödemede doğruydu; üç komşu yol:
//   (a) Kredi Kullanımı'nın Ters Kaydet / Düzelt'i 409'u doğru veriyor ama metni "Kredi Geri Ödemesi'nde anapara … aşamaz" — işlem başka;
//   (b) geri ödeme tarihe bakmıyordu: kullanım 07.10, geri ödeme 03.10 → 200, 03–06.10 arasında 300 ters bakiye. Plan §3.9 "min(işlem günündeki,
//       bütün hareketlerle)" yaklaşımı → kredide de işlem günündeki kalan borç;
//   (c) Açılışı Düzelt kuralı atlatıyordu: açılış borcu 5.000, 5.000 ödendi, açılış 3.000'e düzeltildi → 200, 300'de 2.000 ters bakiye.
//
// Nasıl bozarım (önce yazıldı):
//   N1 Ödenmiş kredinin kullanımını Ters Kaydet / Düzelt ile küçült → kredi hesabı borç bakiyesine geçer mi? (409; metin işleme uygun)
//   N2 Geri ödemeyi kullanımdan önceki bir tarihe yaz → ara dönemde ters bakiye (409; metinde tarih)
//   N3 Ödenmiş açılış borcunu Açılışı Düzelt ile küçült (409; açılış ve bakiye değişmez)
//   N4 Karşı deney: aynı gün geri ödeme, açılış borcunu büyütme, kalan borç kadar geri ödeme → 200
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BANK, bootBank, expectStatus, must, openAccount, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";

const transfer = (api, body) => api.post(`${BANK}/transfers`, body);
const loanBalance = async (api, loan) => (await subBalances(api))[loan.glSub]?.balance ?? 0;
const eventCount = store => store.get("SELECT COUNT(*) AS n FROM fin_events").n;

async function setup() {
  const ctx = await bootBank();
  const ziraat = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
  const loan = await openAccount(ctx.api, { bankName: "Akbank", name: "Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0" } });
  return { ...ctx, ziraat, loan };
}

describe("K8 (a) — Kredi Kullanımı'nın Ters Kaydet ve Düzelt'inde ret metni işleme uygun", () => {
  let ctx;
  let draw;
  before(async () => {
    ctx = await setup();
    draw = await must("kullanım", transfer(ctx.api, { type: "loan_draw", accountId: ctx.ziraat.id, loanAccountId: ctx.loan.id, amount: "1.000", date: "2026-10-05" }));
    await must("geri ödeme", transfer(ctx.api, { type: "loan_repay", accountId: ctx.ziraat.id, loanAccountId: ctx.loan.id, amount: "1.000", date: "2026-10-06" }));
  });
  after(() => ctx.server.close());

  it("N1a: ödenmiş kredinin kullanımı Ters Kaydet → 409 bank-loan-exceeds; metin Kredi Kullanımı'nın ters kaydını anlatır; hiçbir şey yazılmaz", async () => {
    const before = eventCount(ctx.store);
    const res = await ctx.api.post(`${BANK}/events/${draw.id}/reverse`, {});
    expectStatus(res, 409, "bank-loan-exceeds", "kullanımı ters kaydet");
    assert.doesNotMatch(res.error, /Geri Ödemesi'nde anapara/, `metin geri ödemeyi anlatıyor: ${res.error}`);
    assert.match(res.error, /Kredi Kullanımı/, res.error);
    assert.match(res.error, /ters kayd/i, res.error);
    assert.equal(eventCount(ctx.store), before);
    assert.equal(await loanBalance(ctx.api, ctx.loan), 0);
  });

  it("N1b: kullanımı 400'e Düzelt → 409 bank-loan-exceeds; metin Kredi Kullanımı'nın düzeltilmesini anlatır", async () => {
    const res = await ctx.api.post(`${BANK}/events/${draw.id}/correct`, { amount: "400" });
    expectStatus(res, 409, "bank-loan-exceeds", "kullanımı düzelt");
    assert.doesNotMatch(res.error, /Geri Ödemesi'nde anapara/, `metin geri ödemeyi anlatıyor: ${res.error}`);
    assert.match(res.error, /Kredi Kullanımı/, res.error);
    assert.match(res.error, /düzelt/i, res.error);
    assert.equal(await loanBalance(ctx.api, ctx.loan), 0);
  });

  it("N4a: kalan borcu aşan geri ödeme → 409, metin yine geri ödemeyi anlatır (değişmedi)", async () => {
    const res = await transfer(ctx.api, { type: "loan_repay", accountId: ctx.ziraat.id, loanAccountId: ctx.loan.id, amount: "1", date: "2026-10-07" });
    expectStatus(res, 409, "bank-loan-exceeds", "fazla geri ödeme");
    assert.match(res.error, /Kredi Geri Ödemesi'nde anapara \(1,00 TL\)/, res.error);
  });
});

describe("K8 (b) — geri ödeme işlem günündeki kalan borcu aşamaz (plan §3.9 yaklaşımı)", () => {
  let ctx;
  before(async () => {
    ctx = await setup();
    await must("kullanım 07.10", transfer(ctx.api, { type: "loan_draw", accountId: ctx.ziraat.id, loanAccountId: ctx.loan.id, amount: "1.000", date: "2026-10-07" }));
  });
  after(() => ctx.server.close());

  it("N2: kullanım 07.10, geri ödeme 03.10 → 409 bank-loan-exceeds (03.10'da kalan borç 0); 05.10 mizanında 300 = 0", async () => {
    const before = eventCount(ctx.store);
    const res = await transfer(ctx.api, { type: "loan_repay", accountId: ctx.ziraat.id, loanAccountId: ctx.loan.id, amount: "1.000", date: "2026-10-03" });
    expectStatus(res, 409, "bank-loan-exceeds", "kullanımdan önceki geri ödeme");
    assert.match(res.error, /03\.10\.2026/, `metinde işlem günü: ${res.error}`);
    assert.equal(eventCount(ctx.store), before, "hiçbir şey yazılmadı");
    assert.equal((await trialBalances(ctx.api, "?to=2026-10-05"))["300"] ?? 0, 0, "05.10 itibarıyla 300 ters bakiye yok");
    assert.equal(await loanBalance(ctx.api, ctx.loan), -1000);
  });

  it("N4b: aynı gün (07.10) geri ödeme → 200; kredi 0", async () => {
    await must("aynı gün", transfer(ctx.api, { type: "loan_repay", accountId: ctx.ziraat.id, loanAccountId: ctx.loan.id, amount: "1.000", date: "2026-10-07" }));
    assert.equal(await loanBalance(ctx.api, ctx.loan), 0);
    assert.equal((await trialBalances(ctx.api, "?to=2026-10-05"))["300"] ?? 0, 0);
  });
});

describe("K8 (c) — kredi hesabında Açılışı Düzelt ödenen anaparanın altına inemez", () => {
  let ctx;
  let loan;
  before(async () => {
    ctx = await setup();
    loan = await openAccount(ctx.api, { bankName: "Akbank", name: "Kredi Açılışlı", kind: "loan", opening: { date: "2026-10-01", amount: "5.000" } });
    await must("geri ödeme 5.000", transfer(ctx.api, { type: "loan_repay", accountId: ctx.ziraat.id, loanAccountId: loan.id, amount: "5.000", date: "2026-10-05" }));
  });
  after(() => ctx.server.close());

  it("N3: açılış borcu 5.000 → 3.000 (5.000 ödenmiş) → 409 bank-loan-exceeds; açılış ve bakiye değişmez", async () => {
    const before = eventCount(ctx.store);
    const res = await ctx.api.post(`${BANK}/accounts/${loan.id}/opening`, { date: "2026-10-01", amount: "3.000" });
    expectStatus(res, 409, "bank-loan-exceeds", "açılışı küçült");
    assert.equal(eventCount(ctx.store), before, "hiçbir şey yazılmadı");
    assert.equal(await loanBalance(ctx.api, loan), 0);
    const card = await must("hesap", ctx.api.get(`${BANK}/accounts/${loan.id}`));
    assert.equal(card.opening?.amountMinor, 500000, "açılış 5.000 kaldı");
  });

  it("N4c: açılış borcunu 6.000'e büyüt → 200; kalan borç 1.000", async () => {
    await must("açılışı büyüt", ctx.api.post(`${BANK}/accounts/${loan.id}/opening`, { date: "2026-10-01", amount: "6.000" }));
    assert.equal(await loanBalance(ctx.api, loan), -1000);
  });
});
