// 2.5.0 Ç7b tur 2e — SIFIRLA ↔ KDV MAHSUBU = HATA (BAŞ MİMAR KARARI 19.11 09:29; docs/erp/C7B-FATURA-TASARIM.md §15.3): Şirket Verisini Sıfırla KDV Mahsup Fişlerini (vat_offsets) de siler.
// Önce (2.4.3'ten beri): "Tüm Hareketleri Sil" ve "Tümünü Sıfırla" faturaları siliyor, mahsupları bırakıyordu → mizan faturasız 191 / 360 / 391 kalıyor, Mutabakat Testi yeşil (beklenen değer
// mahsupları aynı tablodan okur — yetim mahsup iki yana eşit girer), KDV Mahsup Fişi listesinde "Güncel Değil" ay; sıfırlamadan sonra aynı ayın mahsubu "zaten mahsup edildi" diye engelleniyordu.
// KÂHİN (elle — ders 5). Sahte saat 10.02.2027 (ders 13):
//   Aralık 2026: satış 10.000 + KDV 2.000, alış 1.000 + KDV 200 → mahsup H 2.000 / İ 200 / ödenecek 1.800. Ocak 2027: satış 1.000 + KDV 200 → mahsup H 200 / ödenecek 200.
//   Sıfırlamadan önce mizan 191 = 0, 391 = 0, 360 = −2.000. Sonra (iki kip): 191 / 360 / 391 / 190 = 0, mahsup listesi boş, Mutabakat Testi yeşil.
//   "Tüm Hareketleri Sil": cari kartları kalır (2), "Tümünü Sıfırla": cari kartı yok (0). Sıfırlamadan sonra Ocak satışı 500 + KDV 100 → Ocak mahsubu YAZILIR (engel yok): H 100 / ödenecek 100; 360 = −100.
// NASIL BOZARIM: listeye vat_offsets'i eklememek (iki kip); yalnız bir kipte silmek; mahsubu silip 190 / 360'ın öbür kaynaklarını bırakmak.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { BANK, bootBank, trialBalances } from "./banka-210-hesap-ortak.mjs";
import { ADMIN_PASSWORD } from "./helpers.mjs";

const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const NOW = "2027-02-10T12:00:00+03:00";
const KDV = ["191", "190", "360", "391"];
const pick = trial => Object.fromEntries(KDV.map(code => [code, trial[code] ?? 0]));

async function scenario(mode) {
  const ctx = await bootBank({ now: NOW });
  const api = ctx.api;
  try {
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    const M = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Sıfırla Müşteri", type: "customer", registeredOn: "2026-12-01" }))).id;
    const T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Sıfırla Tedarikçi", type: "supplier", registeredOn: "2026-12-01" }))).id;
    const sell = (date, net) => must(`satış ${date}`, api.post(INV, { scenario: "service_sale", accountId: M, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }));
    await sell("2026-12-10", 10000);
    await must("alış", api.post(INV, { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: "2026-12-15", number: "SF-1", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 1000, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }));
    await sell("2027-01-10", 1000);
    await must("Aralık mahsubu", api.post(`${TAX}/vat-offset`, { month: "2026-12" }));
    await must("Ocak mahsubu", api.post(`${TAX}/vat-offset`, { month: "2027-01" }));
    assert.deepEqual(pick(await trialBalances(api)), { 191: 0, 190: 0, 360: -2000, 391: 0 }, `${mode}: ön koşul — iki mahsuptan sonra 360 = −2.000 (kâhin)`);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM vat_offsets").n, 2, `${mode}: ön koşul — iki mahsup`);
    await must(`sıfırla (${mode})`, api.post("/api/companies/sirket-001/reset", { mode, confirm: "001", password: ADMIN_PASSWORD }));
    // Veri tabanı (ders 3): faturalar ve mahsuplar silindi; kartlar kipe göre.
    assert.deepEqual([ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n, ctx.store.get("SELECT COUNT(*) AS n FROM vat_offsets").n], [0, 0], `${mode}: faturalar ve KDV mahsupları silindi`);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM accounts").n, mode === "movements" ? 2 : 0, `${mode}: cari kartları (Tüm Hareketleri Sil'de kalır)`);
    const audit = JSON.parse(ctx.store.get("SELECT payload_json AS p FROM audit_events WHERE type = 'company.reset' ORDER BY rowid DESC LIMIT 1").p);
    assert.equal(audit.counts?.vat_offsets, 2, `${mode}: işlem geçmişinde silinen mahsup sayısı`);
    assert.deepEqual(pick(await trialBalances(api)), { 191: 0, 190: 0, 360: 0, 391: 0 }, `${mode}: sıfırlamadan sonra mizanda KDV hesapları 0`);
    assert.deepEqual((await must("mahsup listesi", api.get(`${TAX}/vat-offset`))).offsets, [], `${mode}: KDV Mahsup Fişi listesi boş`);
    await integrityOk(api, `${mode}: sıfırlamadan sonra`);
    // Sıfırlamadan sonra aynı ayın mahsubu sıfırdan (eski mahsup "zaten mahsup edildi" / "sonraki ay mahsup edilmiş" engeli koymaz).
    const M2 = mode === "movements" ? M : (await must("müşteri (yeni)", api.post("/api/workspace/accounts", { name: "Sıfırla Müşteri 2", type: "customer", registeredOn: "2027-01-01" }))).id;
    await must("Ocak satışı (sıfırlamadan sonra)", api.post(INV, { scenario: "service_sale", accountId: M2, issueDate: "2027-01-20", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" } }));
    const preview = (await must("Ocak ön izleme", api.get(`${TAX}/vat-offset?month=2027-01`))).preview;
    assert.deepEqual({ allowed: preview.allowed, blocks: preview.blocks, out: preview.outMinor, payable: preview.payableMinor }, { allowed: true, blocks: [], out: 10000, payable: 10000 }, `${mode}: Ocak mahsubu sıfırdan (kâhin H 100)`);
    await must("Ocak mahsubu (yeniden)", api.post(`${TAX}/vat-offset`, { month: "2027-01" }));
    assert.deepEqual(pick(await trialBalances(api)), { 191: 0, 190: 0, 360: -100, 391: 0 }, `${mode}: yeni mahsuptan sonra 360 = −100`);
    await integrityOk(api, `${mode}: yeni mahsuptan sonra`);
  } finally {
    await ctx.server.close();
  }
}

describe("Ç7b tur 2e — Şirket Verisini Sıfırla KDV Mahsup Fişlerini de siler", () => {
  it("Tüm Hareketleri Sil: mahsuplar silinir, KDV hesapları 0, Mutabakat yeşil, yeni mahsup sıfırdan; cari kartları kalır", () => scenario("movements"));
  it("Tümünü Sıfırla: mahsuplar silinir, KDV hesapları 0, Mutabakat yeşil, yeni mahsup sıfırdan", () => scenario("all"));
});
