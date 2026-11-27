// 2.5.0 Ç7b — S4 = A (EK-1 §5, kullanıcı 05.11 18:55: "KDV mahsubundan sonra girilen, indirilecek KDV'yi AZALTAN kayıt → girildiği ayın mahsubunda"; sürücü ATANMAMIŞ-S4 / s43).
// docs/erp/C7B-FATURA-TASARIM.md §2.3, §4 (6). Beklenenler testin KENDİ elle hesabı (ders 5):
//   Sahte saat 08.12.2026. Eylül: alış P1 500 + KDV 100, alış P2 200 + KDV 40, satış S1 5.000 + KDV 1.000 · Ekim: satış S2 1.000 + 200, alış P3 300 + 60 · Kasım: satış S3 500 + 100.
//   (a) Eylül mahsubu H 1.000 / İ 140 / ödenecek 860 → Ekim'de P2 İptal Et (Eylül tarihli 191 −40): Eylül "Güncel Değil" DEĞİL (azaltan fark taşınır), Ekim ön izlemesi İ = 60 − 40 = 20,
//       H 200, ödenecek 180 + bilgi satırı; Ekim mahsubundan sonra 191 = 0, 391 = −100 (Kasım'ın mahsupsuz satışı), 360 = −(860 + 180) = −1.040 (toplam H 1.200 − İ 160).
//   (b) Ekim mahsubundan SONRA P1 de İptal Et (Eylül −100): Kasım ön izlemesi İ = 0 + (−140 + (60 − 20)) = −100 (iki ay üst üste: çift sayım yok), H 100, ödenecek 200;
//       toplam H 1.300 − İ 60 = 1.240 = 860 + 180 + 200. Mahsuptan sonra 191 = 391 = 0.
//   (c) Kasım mahsubu Geri Al → kalıntı yeniden ön izlemede (İ −100), 191 = −100 (alacak: taşınmayı bekliyor).
//   (d) Ayrı veri: Eylül mahsubundan sonra Eylül tarihli GEÇ alış (KDV 30; artıran) → Eylül "Güncel Değil" (bugünkü gibi), Ekim ön izlemesi taşımaz (İ = Ekim'in kendisi).
// NASIL BOZARIM: taşımayı kaldırmak (Ekim İ 60, 191 −40 kalır); azaltan farkı da "Güncel Değil" saymak; artıran farkı da taşımak ((d) Ekim İ 90); birikimi her ay yeniden toplamak
//   ((b) çift sayım: İ −240); geçmiş ayın saklı mahsubuna yazmak (Eylül fişi değişir).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { BANK, bootBank, trialBalances } from "./banka-210-hesap-ortak.mjs";

const TAX = "/api/workspace/tax";
const NOW = "2026-12-08T12:00:00+03:00";

async function setup() {
  const ctx = await bootBank({ now: NOW });
  const api = ctx.api;
  await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
  const ids = {};
  ids.M1 = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Müşteri", type: "customer", registeredOn: "2026-09-01" }))).id;
  ids.T1 = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tedarikçi", type: "supplier", registeredOn: "2026-09-01" }))).id;
  let n = 0;
  ids.buy = async (date, net, label = "Kırtasiye") => (await must(`alış ${date}`, api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: ids.T1, issueDate: date, number: `AL-${(n += 1)}`, lines: [{ name: label, qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id;
  ids.sell = async (date, net) => (await must(`satış ${date}`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.M1, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id;
  return { ctx, api, ids };
}
const preview = async (api, month) => (await must(`ön izleme ${month}`, api.get(`${TAX}/vat-offset?month=${month}`))).preview;
const offsets = async api => (await must("liste", api.get(`${TAX}/vat-offset`))).offsets;
const cancel = (api, id) => must("İptal Et", api.post(`/api/workspace/invoices/${id}/cancel`, { reason: "Hatalı fatura", payments: "drop", refund: "none" }));

describe("Ç7b S4 = A — mahsuptan sonra girilen, indirilecek KDV'yi azaltan kayıt girildiği ayın mahsubunda", () => {
  let ctx;
  let api;
  let ids;
  before(async () => {
    ({ ctx, api, ids } = await setup());
    ids.P1 = await ids.buy("2026-09-05", 500);
    ids.P2 = await ids.buy("2026-09-06", 200);
    ids.S1 = await ids.sell("2026-09-07", 5000);
    ids.S2 = await ids.sell("2026-10-07", 1000);
    ids.P3 = await ids.buy("2026-10-08", 300);
    ids.S3 = await ids.sell("2026-11-07", 500);
  });
  after(() => ctx?.server.close());

  it("(a) azaltan kalıntı sonraki ayın mahsubuna girer; geçmiş ay Güncel Değil sayılmaz; 191 = 391 = 0", async () => {
    const sep = await preview(api, "2026-09");
    assert.deepEqual([sep.outMinor, sep.inMinor, sep.payableMinor], [100000, 14000, 86000]);
    await must("Eylül mahsup", api.post(`${TAX}/vat-offset`, { month: "2026-09" }));
    await cancel(api, ids.P2);
    const list = await offsets(api);
    assert.equal(list.find(item => item.month === "2026-09").stale, false, "Eylül: azaltan fark uyarı değil, taşınır");
    const oct = await preview(api, "2026-10");
    assert.deepEqual([oct.outMinor, oct.inMinor, oct.payableMinor, oct.carryOutMinor], [20000, 2000, 18000, 0], "Ekim: İ = 60 − 40");
    assert.equal(oct.carriedInMinor, -4000);
    assert.ok(oct.warnings.some(text => /önceki ayların mahsubundan sonra/i.test(text) && text.includes("40,00 TL")), `bilgi satırı: ${JSON.stringify(oct.warnings)}`);
    await must("Ekim mahsup", api.post(`${TAX}/vat-offset`, { month: "2026-10" }));
    const trial = await trialBalances(api);
    assert.equal(trial["191"] ?? 0, 0, "191 ay sonunda 0");
    assert.equal(trial["391"], -100, "391 yalnız Kasım'ın henüz mahsup edilmemiş satışı (S3 KDV 100)");
    assert.equal(trial["360"], -1040);
    const stored = ctx.store.get("SELECT in_minor AS i FROM vat_offsets WHERE month = '2026-09'");
    assert.equal(stored.i, 14000, "Eylül'ün saklı mahsubu DEĞİŞMEDİ");
    await integrityOk(api, "S4 (a)");
  });

  it("(b) mahsuptan sonra ikinci azaltan kayıt: birikim çift sayılmaz", async () => {
    await cancel(api, ids.P1);
    const list = await offsets(api);
    assert.equal(list.find(item => item.month === "2026-09").stale, false);
    assert.equal(list.find(item => item.month === "2026-10").stale, false, "Ekim de uyarı değil (taşıma sürüyor)");
    const nov = await preview(api, "2026-11");
    assert.deepEqual([nov.outMinor, nov.inMinor, nov.payableMinor], [10000, -10000, 20000], "Kasım: İ = −100");
    assert.equal(nov.allowed, true, nov.blocks.join(" | "));
    await must("Kasım mahsup", api.post(`${TAX}/vat-offset`, { month: "2026-11" }));
    const trial = await trialBalances(api);
    assert.equal(trial["191"] ?? 0, 0);
    assert.equal(trial["391"] ?? 0, 0);
    assert.equal(trial["360"], -1240, "toplam H 1.300 − İ 60");
    await integrityOk(api, "S4 (b)");
  });

  it("(c) Kasım mahsubu Geri Al → kalıntı yeniden ön izlemede; 191 alacak bakiyesi taşınmayı bekler", async () => {
    const nov = (await offsets(api)).find(item => item.month === "2026-11" && item.status === "active");
    await must("Geri Al", api.post(`${TAX}/vat-offset/${nov.id}/reverse`, {}));
    const again = await preview(api, "2026-11");
    assert.equal(again.inMinor, -10000);
    const trial = await trialBalances(api);
    assert.equal(trial["191"], -100);
    await integrityOk(api, "S4 (c)");
  });
});

describe("Ç7b S4 — ARTIRAN geç kayıt taşınmaz (bugünkü gibi Güncel Değil)", () => {
  let ctx;
  let api;
  let ids;
  before(async () => {
    ({ ctx, api, ids } = await setup());
    await ids.buy("2026-09-05", 500);
    await ids.sell("2026-09-07", 5000);
    await ids.buy("2026-10-08", 300);
  });
  after(() => ctx?.server.close());
  it("(d) Eylül mahsubundan sonra Eylül tarihli geç alış: Eylül Güncel Değil, Ekim ön izlemesi yalnız kendi 191'i", async () => {
    await must("Eylül mahsup", api.post(`${TAX}/vat-offset`, { month: "2026-09" }));
    await ids.buy("2026-09-20", 150, "Geç Gelen Fatura");
    const sep = (await offsets(api)).find(item => item.month === "2026-09");
    assert.equal(sep.stale, true, "artıran fark: Güncel Değil");
    assert.equal(sep.nowInMinor, 13000);
    const oct = await preview(api, "2026-10");
    assert.equal(oct.inMinor, 6000, "Ekim İ = 60 (geç fatura taşınmaz)");
    assert.equal(oct.carriedInMinor ?? 0, 0);
  });
});
