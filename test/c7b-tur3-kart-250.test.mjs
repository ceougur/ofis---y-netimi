// 2.5.0 Ç7b tur 3 (docs/erp/C7B-FATURA-TASARIM.md §16) — kart küçülmesi (karar (4) / 2B-S3 = A), S15 = A, S206 = A (+ S211 = A), S210 ↔ karar (4) (§16.6 K-3a: bu turda karar (4)).
// Sahte saat 08.10.2026. Beklenenler kararların sözünden ELLE (kod koşulmadan):
//  (4) taksitli fatura 900 (3 × 300; 06.10 / 06.11 / 06.12), 06.10 tahsilat 300, 07.10 iade 300 → kart 06.10 300 (ödendi), 06.12 300 açık; 06.11 silinir (en önce gelen AÇIK taksitten).
//      Kısmen ödenmiş ilk taksit (100), iade 300 → 06.10 100 (ödendi), 06.11 200, 06.12 300 (yalnız açık kısım kesilir). İade 900 (kalan 600) → kart kalanı 0, bakiye −300 (fazlası avans).
//      Parası geri verilen iade (nakit 300) → kart DEĞİŞMEZ.
//  S15 taksitli fatura 900, kendi kartına 06.10 tahsilat 300, İptal Et → 200; kart kapalı, faturadan ayrılmış, tutar 0 (300 kartın fazlası); bakiye −300; 689 yok; Kasa 300; sonra 06.10 fatura 500 → açık 200, bakiye 200.
//      Aynı faturanın SİLİNMESİ (Sil) → 409 "taksit kartında tahsilat var; silinmez" (bugünkü gibi; muhasebe kâhini s58). Tahsilatsız kendi kart iptalde silinir (bugünkü gibi).
//  S206 fatura 900, Mevcut Borç kartı 900 (3 × 300), kart tahsilatı 300, fatura İptal Et → kart KAPALI, tutar 300; bakiye −300; sonra fatura 500 → açık 200, bakiye 200.
//  S211 aynı, tahsilatsız → kart KAPALI, tutar 0; bakiye 0.
//  S210 = A (D 20.11 04:15 (3); önceki K-3a 'karar (4)' okumasının yerine) elle Borç 400 (07.10) + fatura 500 → kart 900 (10.10 / 10.11 / 10.12) → tahsilat 300 → fatura iptal →
//      kart KAPALI, tutar 300 (= tahsilat; kalan 0); elle borç kartın dışına çıkar, kendi vadesiyle (07.10) carinin borcunda: bakiye 100, 08.10'da gecikmiş 100 (önceki kodda kart
//      açık 400 / kalan 100, borç kartın 10.10 taksitinde — gecikmiş 0). İptal penceresi kartın kapanacağını söyler.
//  S216 = C (D 20.11 04:15 (4)) iade 300 → kart 06.10 300 (ödendi) · 06.12 300; iade İptal Et → 300 SON taksite: 06.12 600 (bugünkü kod; takvim ilk hâline dönmez — BİLİNEN SINIR).
//  S217 = A (D 20.11 04:15 (5)) Kartı Kapat'la önceden kapatılmış tahsilatlı kendi kartın faturası: İptal Et 409, ileti 'Önce kartı Yeniden Aç ile açın.'
// NASIL BOZARIM (mutantlar): S210'da kartı açık bırakmak; küçülmeyi son taksitten yapmak; ödenmiş kısmı kesmek; S15'te iptali yine reddetmek; iptalde kartın tahsilatını silmek / kalanı düşmek (689); Sil'i kabul
// etmek; kapsayan kartı açık bırakmak; kapsayan kartı küçültmeden kapatmak (kalan düşülür → bakiye değişir).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { must } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";

const W = "/api/workspace";
describe("Ç7b tur 3 — kart küçülmesi (karar (4)), S15, S206 / S210 / S211, S217", () => {
  let ctx;
  let api;
  let n = 0;
  const acc = async () => (await must("cari", api.post(`${W}/accounts`, { name: `Tur3 Müşteri ${(n += 1)}`, type: "customer", registeredOn: "2026-08-01" }))).id;
  const totals = async id => (await must("cari kartı", api.get(`${W}/accounts/${id}`))).totals;
  const items = async id => (await must("kart", api.get(`${W}/plans/${id}`))).items.map(i => `${i.dueDate}:${i.amount}/${i.remaining}`);
  const planRow = id => ({ ...ctx.store.get("SELECT status, total, deleted_at AS deletedAt FROM plans WHERE id = ?", id) });
  const planOf = id => ctx.store.get("SELECT plan_id AS p FROM invoices WHERE id = ?", id).p;
  const invoiceStatus = id => ctx.store.get("SELECT status FROM invoices WHERE id = ?", id).status;
  const trial = async () => Object.fromEntries((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.map(r => [r.code, r.balance]));
  const pay = (planId, amount, date) => must("taksit tahsilatı", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date, method: "cash" }));
  const goods = async (accountId, date, qty, payment) => (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id;
  const service = async (accountId, date, gross, payment) => (await must("satış", api.post(`${W}/invoices`, { scenario: "service_sale", accountId, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: gross / 1.2, vatRate: 20 }], payment }))).id;
  const returnOf = async (accountId, invoiceId, qty, payment = { cash: [] }) => {
    const line = (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id;
    return must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: "2026-10-07", lines: [{ originLineId: line, qty }], payment, force: true }));
  };
  const integrity = async label => {
    const result = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
    assert.equal(result.ok, true, `${label}: ${JSON.stringify(result.failures || result.checks?.filter(c => !c.ok)).slice(0, 600)}`);
  };
  const installments = { rest: "installments", installments: { count: 3, firstDue: "2026-10-06" } };
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
  });
  after(() => ctx?.server.close());

  it("(4) iade kartı vadesi EN ÖNCE gelen AÇIK taksitten küçültür; ödenmiş kısma dokunmaz", async () => {
    const A = await acc();
    const f = await goods(A, "2026-10-06", 3, installments);
    const p = planOf(f);
    await pay(p, 300, "2026-10-06");
    await returnOf(A, f, 1);
    assert.deepEqual(await items(p), ["2026-10-06:300/0", "2026-12-06:300/300"], "06.11 kesilir (en önce gelen açık), 06.12 kalır");
    assert.equal((await totals(A)).balance, 300);
    const B = await acc();
    const g = await goods(B, "2026-10-06", 3, installments);
    const q = planOf(g);
    await pay(q, 100, "2026-10-06");
    await returnOf(B, g, 1);
    assert.deepEqual(await items(q), ["2026-10-06:100/0", "2026-11-06:200/200", "2026-12-06:300/300"], "ilk taksitin yalnız açık kısmı (200) + ikinciden 100");
    await integrity("küçülme");
  });

  it("(4) faturasız stok iadesi: satış kartı kuyrukta AÇIK kalan en önce gelen taksitten küçülür (iadenin kapattığı taksit kesilmez; S140 = A / S151 = B)", async () => {
    // Elle Borç 500 (vade 20.06 — bugünden önce değil, sahte saat 08.10: geçmiş) + stoktan taksitli satış 1.500 (3 × 500; 01.06 / 01.07 / 01.08 — geçmiş tarihli) + faturasız stok iadesi 800 (10.06):
    // bakiye 1.200; kartın fazlası 300. Kuyrukta iade 01.06'yı kapatır → en önce gelen AÇIK taksit 01.07: kart 01.06 500 (iadeyle kapalı) · 01.07 200 · 01.08 500 → kart Kalan 700,
    // elle borç 500 açık (700 + 500 = bakiye). Tabanda (son taksitten) 01.08 200; önceki uçta (kartın kendi hesabıyla) 01.06 kesilir, kart Kalan 1.000 ve iade elle borca kayar.
    const A = (await must("cari", api.post(`${W}/accounts`, { name: `Tur3 Stok ${(n += 1)}`, type: "customer", registeredOn: "2026-05-01" }))).id;
    await must("Borç Yaz", api.post(`${W}/accounts/${A}/entries`, { kind: "debt", amount: "500", date: "2026-05-01", dueDate: "2026-06-20", note: "Elle borç" }));
    const mal = (await must("mal", api.post(`${W}/stock`, { kind: "goods", code: `TUR3-MAL-${n}`, name: "Tur3 Malı", unit: "Adet", openingQty: "1000", salePrice: "100" }))).id;
    await must("taksitli stok satışı", api.post(`${W}/stock/${mal}/moves`, { kind: "out", qty: "1", unitPrice: "1500", pay: "account", accountId: A, date: "2026-05-01", installments: { count: "3", firstDue: "2026-06-01", everyMonths: 1 } }));
    const p = ctx.store.get("SELECT id FROM plans WHERE account_id = ? AND deleted_at IS NULL", A).id;
    await must("faturasız stok iadesi", api.post(`${W}/stock/${mal}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "800", pay: "account", accountId: A, date: "2026-06-10" }));
    assert.deepEqual(await items(p), ["2026-06-01:500/0", "2026-07-01:200/200", "2026-08-01:500/500"], "küçülme kuyrukta açık kalan en önce gelen taksitten (01.07)");
    assert.equal((await must("kart", api.get(`${W}/plans/${p}`))).totals.remaining, 700);
    assert.equal((await totals(A)).balance, 1200);
    await integrity("faturasız stok iadesi");
  });

  it("S216 = C: iade iptal edilince kart bugünkü gibi SON taksitte büyür (takvim ilk hâline dönmez — BİLİNEN SINIR); bakiye ve kart toplamı geri gelir", async () => {
    const A = await acc();
    const f = await goods(A, "2026-10-06", 3, installments);
    const p = planOf(f);
    await pay(p, 300, "2026-10-06");
    const iade = await returnOf(A, f, 1);
    assert.deepEqual(await items(p), ["2026-10-06:300/0", "2026-12-06:300/300"], "iade: karar (4) — 06.11 kesildi");
    await must("iade İptal Et", api.post(`${W}/invoices/${iade.id}/cancel`, { reason: "S216" }));
    assert.deepEqual(await items(p), ["2026-10-06:300/0", "2026-12-06:600/600"], "iade iptali: 300 SON taksite eklenir (S216 = C — bugünkü kod)");
    assert.equal((await must("kart", api.get(`${W}/plans/${p}`))).totals.remaining, 600);
    assert.equal((await totals(A)).balance, 600);
    await integrity("S216");
  });

  it("(4) iade kalanı aşarsa fazlası avans; parası geri verilen iade kartı küçültmez", async () => {
    const A = await acc();
    const f = await goods(A, "2026-10-06", 3, installments);
    const p = planOf(f);
    await pay(p, 300, "2026-10-06");
    await returnOf(A, f, 3);
    assert.equal((await must("kart", api.get(`${W}/plans/${p}`))).totals.remaining, 0, "kartın kalanı 0");
    assert.equal((await totals(A)).balance, -300, "300 avans");
    const B = await acc();
    const g = await goods(B, "2026-10-06", 3, installments);
    const q = planOf(g);
    await pay(q, 300, "2026-10-06");
    const before = await items(q);
    await returnOf(B, g, 1, { cash: [{ amount: 300, method: "cash" }] });
    assert.deepEqual(await items(q), before, "parası geri verilen iade kartı değiştirmez");
    await integrity("avans / geri ödeme");
  });

  it("S15 = A: kendi kartında tahsilatı olan faturanın İptal Et'i kabul; kart kapanır, tahsilat avans; Sil bugünkü gibi 409", async () => {
    const A = await acc();
    const before = await trial();
    const f = await service(A, "2026-10-06", 900, installments);
    const p = planOf(f);
    await pay(p, 300, "2026-10-06");
    const del = await api.del(`${W}/invoices/${f}`);
    assert.equal(del.status, 409, `Sil: ${JSON.stringify(del.data).slice(0, 300)}`);
    assert.match(String(del.data?.error || ""), /taksit kartında tahsilat var; silinmez/, "silme engeli kartın tahsilatından (deleteBlock)");
    assert.equal(invoiceStatus(f), "issued", "reddedilen silme faturayı değiştirmedi");
    const res = await api.post(`${W}/invoices/${f}/cancel`, { reason: "S15" });
    assert.equal(res.status, 200, `İptal Et: ${JSON.stringify(res.data).slice(0, 400)}`);
    assert.equal(invoiceStatus(f), "cancelled");
    assert.deepEqual(planRow(p), { status: "closed", total: 0, deletedAt: null }, "kart kapalı, borç taşımaz (tutar 0; tahsilat kartın fazlası)");
    assert.equal(ctx.store.get("SELECT invoice_id AS i FROM plans WHERE id = ?", p).i, "", "kart iptal edilen faturadan ayrıldı");
    assert.equal((await totals(A)).balance, -300, "tahsilat carinin avansı");
    const after = await trial();
    assert.equal(after["689"] || 0, before["689"] || 0, "kalan düşülmedi (689 yok)");
    assert.equal(roundTo(after["100"] - (before["100"] || 0)), 300, "Kasa'daki tahsilat aynen");
    const g = await service(A, "2026-10-07", 500, { rest: "open" });
    assert.equal((await must("fatura", api.get(`${W}/invoices/${g}`))).open, 200, "sonraki fatura avanstan kapanır");
    assert.equal((await totals(A)).balance, 200);
    const B = await acc();
    const h = await service(B, "2026-10-07", 600, { rest: "installments", installments: { count: 3, firstDue: "2026-10-07" } });
    const r = planOf(h);
    await must("tahsilatsız iptal", api.post(`${W}/invoices/${h}/cancel`, { reason: "tahsilatsız" }));
    assert.ok(planRow(r).deletedAt, "tahsilatsız kendi kart bugünkü gibi kaldırılır");
    await integrity("S15");
  });

  it("S206 = A / S211 = A: faturayı içine almış Mevcut Borç kartı faturanın iptalinde kapanır", async () => {
    const A = await acc();
    const f = await service(A, "2026-10-07", 900, { rest: "open" });
    const p = (await must("kart", api.post(`${W}/plans`, { accountId: A, name: "Mevcut A", total: "900", registeredOn: "2026-10-07", mode: "auto", count: 3, firstDue: "2026-10-10", coversBalance: true }))).id;
    await pay(p, 300, "2026-10-07");
    await must("iptal", api.post(`${W}/invoices/${f}/cancel`, { reason: "S206" }));
    assert.deepEqual(planRow(p), { status: "closed", total: 300, deletedAt: null }, "S206: kart kapalı, tutar = tahsilat");
    assert.equal((await totals(A)).balance, -300);
    const g = await service(A, "2026-10-07", 500, { rest: "open" });
    assert.equal((await must("fatura", api.get(`${W}/invoices/${g}`))).open, 200, "S206 örneği: 500'lük fatura 200 açık");
    assert.equal((await totals(A)).balance, 200);
    const B = await acc();
    const h = await service(B, "2026-10-07", 900, { rest: "open" });
    const q = (await must("kart", api.post(`${W}/plans`, { accountId: B, name: "Mevcut B", total: "900", registeredOn: "2026-10-07", mode: "auto", count: 3, firstDue: "2026-10-10", coversBalance: true }))).id;
    await must("iptal", api.post(`${W}/invoices/${h}/cancel`, { reason: "S211" }));
    assert.deepEqual(planRow(q), { status: "closed", total: 0, deletedAt: null }, "S211: tahsilatsız kart kapalı, tutar 0");
    assert.equal((await totals(B)).balance, 0);
    await integrity("S206 / S211");
  });

  it("Kartı Kapat'la önceden kapatılmış tahsilatlı kendi kartın faturası iptal edilmez (kalan iki kez düşülmesin)", async () => {
    const A = await acc();
    const f = await service(A, "2026-10-07", 900, { rest: "installments", installments: { count: 3, firstDue: "2026-10-07" } });
    const p = planOf(f);
    await pay(p, 300, "2026-10-07");
    await must("Kartı Kapat", api.put(`${W}/plans/${p}`, { status: "closed", closeRemaining: 600 }));
    const balance = (await totals(A)).balance;
    const res = await api.post(`${W}/invoices/${f}/cancel`, { reason: "kapalı kart" });
    assert.equal(res.status, 409, JSON.stringify(res.data).slice(0, 300));
    assert.equal(res.data?.code, "plan-has-payments");
    assert.match(String(res.data?.error || ""), /fatura iptal edilemez\. Önce kartı Yeniden Aç ile açın\.$/, "S217 = A iletisi");
    assert.equal(invoiceStatus(f), "issued");
    assert.equal((await totals(A)).balance, balance, "bakiye değişmedi");
  });

  it("S206 / S211 ailesi: faturayı içine ALMAMIŞ Mevcut Borç kartı iptalde borçtan büyük kalırsa küçülür; kalanı 0'a inen kart kapanır (borçsuz açık kart kalmaz)", async () => {
    // Elle Borç 400 → kart 400 (içine alır) → SONRA fatura 500 (kart onu içine almaz) → bağsız tahsilat 400 (bakiye 500) → fatura İptal Et → bakiye 0; kartın kalanı 400 > 0
    // → kart 400 küçülür (tutar 0), kapanır. Bakiye ve Kasa değişmez.
    const A = await acc();
    await must("Borç Yaz", api.post(`${W}/accounts/${A}/entries`, { kind: "debt", amount: "400", date: "2026-10-07", note: "Elle borç" }));
    const p = (await must("kart", api.post(`${W}/plans`, { accountId: A, name: "Mevcut T", total: "400", registeredOn: "2026-10-07", mode: "auto", count: 2, firstDue: "2026-10-10", coversBalance: true }))).id;
    const f = await service(A, "2026-10-07", 500, { rest: "open" });
    await must("bağsız tahsilat", api.post(`${W}/accounts/${A}/entries`, { kind: "in", amount: "400", date: "2026-10-07", method: "cash", note: "nakit", cashForce: true, similarOk: true, force: true }));
    assert.equal((await totals(A)).balance, 500);
    assert.deepEqual(planRow(p), { status: "active", total: 400, deletedAt: null }, "tahsilattan sonra kart dokunulmadı (borç 500 ≥ kart 400)");
    await must("iptal", api.post(`${W}/invoices/${f}/cancel`, { reason: "içine almamış kart" }));
    assert.deepEqual(planRow(p), { status: "closed", total: 0, deletedAt: null }, "kart 400 küçüldü (tutar 0) ve kapandı");
    assert.equal((await totals(A)).balance, 0);
    await integrity("içine almamış kart");
  });

  it("S210 = A: kartta başka borç da varsa faturanın iptalinde kart yine KAPANIR; elle borç kendi vadesiyle carinin borcuna döner", async () => {
    const A = await acc();
    await must("Borç Yaz", api.post(`${W}/accounts/${A}/entries`, { kind: "debt", amount: "400", date: "2026-10-07", note: "Elle borç" }));
    const f = await service(A, "2026-10-07", 500, { rest: "open" });
    const p = (await must("kart", api.post(`${W}/plans`, { accountId: A, name: "Mevcut K", total: "900", registeredOn: "2026-10-07", mode: "auto", count: 3, firstDue: "2026-10-10", coversBalance: true }))).id;
    await pay(p, 300, "2026-10-07");
    const onceki = await totals(A);
    assert.equal(onceki.balance, 600);
    assert.equal(onceki.overdueDebt, 0, "iptalden önce borç kartın taksitlerinde (ilk vade 10.10)");
    const notice = String((await must("fatura", api.get(`${W}/invoices/${f}`))).cancelNotice || "");
    const trialBefore = await trial();
    await must("iptal", api.post(`${W}/invoices/${f}/cancel`, { reason: "S210" }));
    assert.deepEqual(planRow(p), { status: "closed", total: 300, deletedAt: null }, "S210: kart kapalı, tutar = tahsilat");
    assert.equal((await must("kart", api.get(`${W}/plans/${p}`))).totals.remaining, 0);
    const sonra = await totals(A);
    assert.equal(sonra.balance, 100, "bakiye: 400 + 500 − 300 − 500");
    assert.equal(sonra.overdueDebt, 100, "elle borç kendi vadesiyle (07.10) — 08.10'da gecikmiş 100");
    const trialAfter = await trial();
    assert.equal(trialAfter["689"] || 0, trialBefore["689"] || 0, "kalan düşülmedi (689 yok)");
    assert.equal(roundTo((trialAfter["120"] || 0) - (trialBefore["120"] || 0)), -500, "120 yalnız iptal edilen satış kadar düştü");
    await integrity("S210");
    // İptal penceresi (iptalden ÖNCE okundu) sonucu söyler — kartın durumundan SONRA denetlenir ki önceki kodun kırmızısı kartın kendisinden okunsun (ders 38).
    assert.match(notice, /“Mevcut K” taksit kartı iptalde kapanır; karta alınan 300,00 TL tahsilat carinin avansı olur; karttaki öbür borç kendi vadesiyle carinin borcunda kalır\./, `iptal penceresi: ${notice}`);
  });
});

function roundTo(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
