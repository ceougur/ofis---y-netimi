// 2.3.0 İz 3.1 — K8 taksit kuralları (docs/BANKA-MODULU-PLAN.md §3.10/3, Özet K8; docs/2.1.0-KANIT.md "kural yok; davranış 2.0.26 gibi").
//
// BUGÜNKÜ DAVRANIŞ (2.2.0 kodundan okundu; routes/plans.mjs:804 POST /entries, :851 PUT, trash.mjs:413 restore): tahsilatta kartın kalanına
// BAKILMAZ. Kalan 0 olan karta da, kalanı aşan tutar da 200 döner; fazlası lib/plans.mjs allocate "extra" (kartta "fazla"), caride alacak olur.
// Yalnız iade (out) net tahsilatı aşamaz (400 refund-exceeds). Banka/POS yolunda Benzer İşlem (409 bank-similar) ve K7 çalışır, hedef kuralı
// yoktur. Taksite Aktar (op 'move') kalanı aşan aktarımı payments-exceed uyarısıyla yazar (plan-transfer.mjs:173) — bu kural KALIR.
//
// YENİ KURAL (plan §3.10/3; bank.post adım 2 "prepare": istek kimliğinden SONRA, Benzer İşlem'den ÖNCE, aynı BEGIN IMMEDIATE içinde):
//   create (yeni tahsilat) ve restore (Silinenler): kalan 0 → 409 plan-paid; tutar > kalan → 409 plan-overpay; seçilen taksit ödenmiş →
//   409 installment-paid. "Fazlasını Avans Yaz" (overpay:true) yalnız plans.manage: fazlası kartta "extra", caride alacak; yetkisizde 403
//   plan-overpay-permission. update: yalnız tutar büyüyorsa aynı kural. move: değişmez. Mevcut fazla tahsilat okunur, gösterilir, değişmez.
//   Karşılaştırma kuruş tamsayısıyla (toMinor); nakit / banka / POS yolu aynı kural.
//
// NASIL BOZARIM (önce yazıldı; her madde aşağıda bir testtir):
//   N1  Tam ödenmiş karta yeniden tahsilat (nakit) → 409 plan-paid; kart, Kasa, cari değişmez; metin yol gösterir.
//   N2  Kuruş sınırı: kalan 0,01 iken 0,02 → plan-overpay, 0,01 → 200; 1.000 karta 1.000,01 → plan-overpay, 1.000,00 → 200.
//   N3  İki eşzamanlı tahsilat aynı karta / aynı taksite → biri 200, biri 409 (plan-paid / installment-paid); tek hareket.
//   N4  Kısmi + kalan tam → ikisi de 200, sonra 1 kuruş → plan-paid.
//   N5  İade sonrası yeniden: iade kadar tahsilat 200; iadeyi aşan → plan-overpay.
//   N6  Kasa / banka / POS yolu aynı kural; K8 Benzer İşlem'den ÖNCE (aynı gün aynı tutar ikinci havale ödenmiş kartta bank-similar değil
//       plan-paid; kalanı olan kartta bank-similar → similarOk ile geçer; similarOk plan-paid'i geçmez).
//   N7  Eski/mevcut veride fazla tahsilat (kart toplamı tahsilatın altına indirildi): "fazla" gösterilir, yeni tahsilat plan-paid, iade serbest.
//   N8  Silinenler'den geri yükleme: kart bu arada ödendi → plan-paid; kısmen doldu → plan-overpay; yönetici overpay:true → 200.
//   N9  Düzeltme (PUT): tutar büyütüp kalanı aşmak → plan-overpay; küçültmek / aynı tutarla tarih değiştirmek → 200; overpay:true → 200.
//   N10 Yetki: personel (plans.collect) plan-paid metni "yöneticinize"; overpay:true → 403; yönetici overpay:true → 200, extra, cari alacak,
//       Mutabakat Testi tamam; mevcut avans yeni tahsilata yer açmaz.
//   N11 installment-paid: ödenmiş taksite seçili tahsilat → 409; açık taksite → 200.
//   N12 Taksite Aktar bugünkü kuralla kalır (payments-exceed; test/plan-transfer.test.mjs — komşu olarak koşulur, burada yinelenmez).
//   N13 İstek kimliği: aynı kimlikle yineleme ödenmiş kartta replayed (409 değil); aynı kimlik + overpay:true yeniden gönderim 200
//       (overpay içerik karşılaştırmasında VOLATILE).
//   N14 Ekranda düğme: test/e2e/senaryo-banka-210 adım 33 (kalanı olan kartta + Tahsilat 200) koşulur; ödenmiş kartta düğme durumu elle
//       (DENENMEYEN'e yazılır).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { apiOf } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";
import { BANK, TODAY, balanceOf, bootBank, expectStatus, integrityOk, kurus, must, openAcceptanceAccounts, openPos, salesOf, ziraatPos } from "./banka-220-pos-ortak.mjs";

const PLAN = "/api/workspace/plans";
let seq = 0;
const newPlan = (api, party, total, count = 1, extra = {}) =>
  must(`kart ${total}/${count}`, api.post(PLAN, { accountId: party.id, name: `${party.name} K8-${++seq}`, total: String(total), mode: "auto", count, firstDue: "2026-10-15", ...extra }));
const collect = (api, planId, amount, extra = {}) => api.post(`${PLAN}/${planId}/entries`, { kind: "in", amount: String(amount), method: "cash", date: TODAY, ...extra });
const refund = (api, planId, amount, extra = {}) => api.post(`${PLAN}/${planId}/entries`, { kind: "out", amount: String(amount), method: "cash", date: TODAY, cashForce: true, ...extra });
const card = (api, planId) => must("kart oku", api.get(`${PLAN}/${planId}`));
const cashOf = async api => (await must("Kasa", api.get("/api/workspace/cash"))).byMethod.cash;
const partyBalance = async (api, id) => (await must("cari", api.get(`/api/workspace/accounts/${id}`))).totals.balance;
const sameCash = async (api, before, label) => assert.equal(await cashOf(api), before, `${label}: Kasa değişmemeli`);
/** 409/403 gövdesi: code + Türkçe metin + ek alanlar. */
const rejected = (res, status, code, label) => {
  expectStatus(res, status, code, label);
  assert.ok(typeof res.error === "string" && res.error.length > 20, `${label}: hata metni`);
  return res;
};

describe("K8 taksit kuralı — nakit yolu (N1, N2, N4, N5)", () => {
  let ctx;
  let api;
  let party;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    party = await must("cari", api.post("/api/workspace/accounts", { name: "K8 Nakit Müşteri", type: "customer", registeredOn: "2026-10-01" }));
  });
  after(() => ctx?.server.close());

  it("N4+N1: kısmi 300 + kalan 700 → 200; ödenmiş karta 0,01 → 409 plan-paid; kart, Kasa ve cari değişmez; metin yol gösterir", async () => {
    const plan = await newPlan(api, party, 1000, 2);
    await must("300", collect(api, plan.id, "300"));
    await must("700", collect(api, plan.id, "700"));
    let c = await card(api, plan.id);
    assert.deepEqual([c.totals.remaining, c.totals.paid, c.state], [0, 1000, "done"], "kart ödendi");
    const kasa = await cashOf(api);
    const bakiye = await partyBalance(api, party.id);
    const res = rejected(await collect(api, plan.id, "0,01"), 409, "plan-paid", "ödenmiş karta 0,01");
    assert.match(res.error, /ödendi/, "metin: kart ödendi");
    assert.match(res.error, /avans/i, "metin: fazlayı avansa/cariye yazma yolu");
    assert.equal(res.data.remaining, 0, "ek alan: kalan 0");
    c = await card(api, plan.id);
    assert.deepEqual([c.entries.length, c.totals.paid, c.totals.extra], [2, 1000, 0], "kartta yeni hareket yok");
    await sameCash(api, kasa, "plan-paid");
    assert.equal(await partyBalance(api, party.id), bakiye, "cari bakiye değişmemeli");
    rejected(await collect(api, plan.id, "500"), 409, "plan-paid", "ödenmiş karta 500 de plan-paid (overpay değil)");
  });

  it("N2: kuruş sınırı — kalan 0,01 iken 0,02 → plan-overpay (kalan/fazla ek alanda), 0,01 → 200; 1.000'e 1.000,01 → plan-overpay, 1.000,00 → 200", async () => {
    const plan = await newPlan(api, party, 1000, 1);
    await must("999,99", collect(api, plan.id, "999,99"));
    const res = rejected(await collect(api, plan.id, "0,02"), 409, "plan-overpay", "kalan 0,01 iken 0,02");
    assert.deepEqual([res.data.remaining, res.data.amount, res.data.excess], [0.01, 0.02, 0.01], "ek alanlar: kalan, girilen, fazlası");
    assert.match(res.error, /0,01/, "metinde kalan");
    await must("0,01", collect(api, plan.id, "0,01"));
    assert.equal((await card(api, plan.id)).totals.remaining, 0);
    const plan2 = await newPlan(api, party, 1000, 1);
    rejected(await collect(api, plan2.id, "1000,01"), 409, "plan-overpay", "1.000 karta 1.000,01");
    await must("1.000,00", collect(api, plan2.id, "1000"));
    assert.deepEqual([(await card(api, plan2.id)).totals.remaining, (await card(api, plan2.id)).totals.extra], [0, 0]);
  });

  it("N5: iade sonrası yeniden — iade kadar 200; iadeyi aşan plan-overpay; sonra 1 kuruş plan-paid", async () => {
    const plan = await newPlan(api, party, 1000, 2);
    await must("1.000", collect(api, plan.id, "1000"));
    await must("iade 200", refund(api, plan.id, "200"));
    assert.equal((await card(api, plan.id)).totals.remaining, 200, "iade kalanı açar");
    const over = rejected(await collect(api, plan.id, "300"), 409, "plan-overpay", "iadeden sonra 300");
    assert.deepEqual([over.data.remaining, over.data.excess], [200, 100]);
    await must("200", collect(api, plan.id, "200"));
    rejected(await collect(api, plan.id, "0,01"), 409, "plan-paid", "yeniden ödenmiş kart");
    await integrityOk(api, "N5");
  });
});

describe("K8 taksit kuralı — eşzamanlı, taksit seçimi, istek kimliği (N3, N11, N13)", () => {
  let ctx;
  let api;
  let party;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    party = await must("cari", api.post("/api/workspace/accounts", { name: "K8 Eşzamanlı Müşteri", type: "customer", registeredOn: "2026-10-01" }));
  });
  after(() => ctx?.server.close());

  it("N3: aynı karta iki eşzamanlı 500 (farklı istek kimliği) → biri 200, biri 409 plan-paid; tek hareket; Kasa +500", async () => {
    const plan = await newPlan(api, party, 500, 1);
    const kasa = await cashOf(api);
    const results = await Promise.all([collect(api, plan.id, "500", { requestId: "k8-eszamanli-0001" }), collect(api, plan.id, "500", { requestId: "k8-eszamanli-0002" })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409], `durumlar ${JSON.stringify(results.map(r => [r.status, r.code]))}`);
    assert.equal(results.find(r => r.status === 409).code, "plan-paid");
    const c = await card(api, plan.id);
    assert.deepEqual([c.entries.length, c.totals.paid, c.totals.remaining], [1, 500, 0]);
    assert.equal(await cashOf(api), kasa + 500);
  });

  it("N3b: aynı taksite iki eşzamanlı 500 (kartta 2 taksit) → biri 200, biri 409 installment-paid", async () => {
    const plan = await newPlan(api, party, 1000, 2);
    const first = (await card(api, plan.id)).items[0].id;
    const results = await Promise.all([collect(api, plan.id, "500", { itemId: first, requestId: "k8-eszamanli-0003" }), collect(api, plan.id, "500", { itemId: first, requestId: "k8-eszamanli-0004" })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409], JSON.stringify(results.map(r => [r.status, r.code])));
    assert.equal(results.find(r => r.status === 409).code, "installment-paid");
    const c = await card(api, plan.id);
    assert.deepEqual([c.entries.length, c.items[0].remaining, c.items[1].remaining], [1, 0, 500]);
  });

  it("N11: ödenmiş taksite seçili tahsilat → 409 installment-paid (taksit no metinde); açık taksite → 200; taksitsiz (en eski açık) → 200", async () => {
    const plan = await newPlan(api, party, 1000, 2);
    const [a, b] = (await card(api, plan.id)).items.map(item => item.id);
    await must("1. taksite 500", collect(api, plan.id, "500", { itemId: a }));
    const res = rejected(await collect(api, plan.id, "100", { itemId: a }), 409, "installment-paid", "ödenmiş 1. taksite");
    assert.match(res.error, /1\. taksit/, "metinde taksit sırası");
    assert.equal(res.data.seq, 1);
    await must("2. taksite 100", collect(api, plan.id, "100", { itemId: b }));
    await must("taksitsiz 100", collect(api, plan.id, "100"));
    assert.deepEqual((await card(api, plan.id)).items.map(item => item.remaining), [0, 300]);
  });

  it("N13: aynı istek kimliğiyle yineleme ödenmiş kartta replayed (409 değil); 409'dan sonra aynı kimlik + overpay:true → 200", async () => {
    const plan = await newPlan(api, party, 500, 1);
    const first = await must("500 R1", collect(api, plan.id, "500", { requestId: "k8-istek-kimligi-0001" }));
    const again = await must("500 R1 yineleme", collect(api, plan.id, "500", { requestId: "k8-istek-kimligi-0001" }));
    assert.equal(again.replayed, true, "yineleme yazılmadı, 409 da değil");
    assert.equal(again.entryId, first.entryId);
    rejected(await collect(api, plan.id, "100", { requestId: "k8-istek-kimligi-0002" }), 409, "plan-paid", "R2 ilk gönderim");
    const forced = await must("R2 + overpay", collect(api, plan.id, "100", { requestId: "k8-istek-kimligi-0002", overpay: true }));
    assert.notEqual(forced.replayed, true, "overpay'li gönderim yazıldı (yineleme değil)");
    const c = await card(api, plan.id);
    assert.deepEqual([c.entries.length, c.totals.paid, c.totals.extra, c.totals.remaining], [2, 600, 100, 0]);
  });
});

describe("K8 taksit kuralı — banka ve POS yolu, Benzer İşlem sırası (N6)", () => {
  let ctx;
  let api;
  let acc;
  let party;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    acc = await openAcceptanceAccounts(api);
    await openPos(api, ziraatPos(acc.ziraat.id));
    party = await must("cari", api.post("/api/workspace/accounts", { name: "K8 Banka Müşteri", type: "customer", registeredOn: "2026-10-01" }));
  });
  after(() => ctx?.server.close());
  const bank = (planId, amount, extra = {}) => collect(api, planId, amount, { method: "bank", bankAccountId: acc.ziraat.id, ...extra });
  const pos = (planId, amount, extra = {}) => collect(api, planId, amount, { method: "card", ...extra });

  it("N6a: havale 1.000 ile ödenen karta aynı gün aynı tutar ikinci havale → 409 plan-paid (bank-similar DEĞİL; K8 Benzer İşlem'den önce); similarOk da geçmez; hesap bakiyesi değişmez", async () => {
    const plan = await newPlan(api, party, 1000, 1);
    await must("havale 1.000", bank(plan.id, "1000"));
    const before = await balanceOf(api, acc.ziraat.id);
    rejected(await bank(plan.id, "1000"), 409, "plan-paid", "ikinci havale");
    rejected(await bank(plan.id, "1000", { similarOk: true }), 409, "plan-paid", "similarOk ile de");
    rejected(await bank(plan.id, "1000,01"), 409, "plan-paid", "aşan tutar da önce plan-paid (kalan 0)");
    assert.equal(await balanceOf(api, acc.ziraat.id), before, "Ziraat bakiyesi değişmemeli");
    assert.equal((await card(api, plan.id)).entries.length, 1);
  });

  it("N6b: kalanı olan kartta aynı gün aynı tutar → 409 bank-similar, similarOk ile 200; kalan dolunca similarOk'lu dördüncü → plan-paid", async () => {
    const plan = await newPlan(api, party, 3000, 3);
    await must("1. havale", bank(plan.id, "1000"));
    rejected(await bank(plan.id, "1000"), 409, "bank-similar", "2. havale benzer");
    await must("2. havale similarOk", bank(plan.id, "1000", { similarOk: true }));
    await must("3. havale similarOk", bank(plan.id, "1000", { similarOk: true }));
    assert.equal((await card(api, plan.id)).totals.remaining, 0);
    rejected(await bank(plan.id, "1000", { similarOk: true }), 409, "plan-paid", "4. havale");
    rejected(await bank(plan.id, "1", { similarOk: true }), 409, "plan-paid", "1 TL de");
    await integrityOk(api, "N6b");
  });

  it("N6c: POS yolu — 2.000 karta POS 2.000,01 → plan-overpay (POS satışı açılmaz); POS 2.000 → 200; POS 100 → plan-paid; yönetici overpay POS 100 → 200 ve POS satışı", async () => {
    const plan = await newPlan(api, party, 2000, 1);
    const salesBefore = (await salesOf(api, "?kind=sale")).length;
    rejected(await pos(plan.id, "2000,01"), 409, "plan-overpay", "POS aşan");
    assert.equal((await salesOf(api, "?kind=sale")).length, salesBefore, "reddedilen POS tahsilatı satış açmaz");
    await must("POS 2.000", pos(plan.id, "2000"));
    rejected(await pos(plan.id, "100"), 409, "plan-paid", "POS ödenmiş karta");
    assert.equal((await salesOf(api, "?kind=sale")).length, salesBefore + 1);
    await must("POS 100 avans", pos(plan.id, "100", { overpay: true }));
    assert.equal((await salesOf(api, "?kind=sale")).filter(item => item.grossMinor === kurus(100)).length, 1, "avans POS satışı");
    const c = await card(api, plan.id);
    assert.deepEqual([c.totals.paid, c.totals.extra, c.totals.remaining], [2100, 100, 0]);
    await integrityOk(api, "N6c");
  });
});

describe("K8 taksit kuralı — yetki, avans, mevcut fazla tahsilat (N10, N7)", () => {
  let ctx;
  let api;
  let staff;
  let party;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    staff = apiOf(await createUser(ctx.server, api, { username: "tahsildar", role: "personel", name: "Tahsildar" }));
    party = await must("cari", api.post("/api/workspace/accounts", { name: "K8 Yetki Müşteri", type: "customer", registeredOn: "2026-10-01" }));
  });
  after(() => ctx?.server.close());

  it("N10: personel ödenmiş karta → plan-paid 'yöneticinize'; personel overpay:true → 403 plan-overpay-permission; yönetici overpay:true → 200, extra, cari alacak; avans yer açmaz", async () => {
    assert.ok(staff, "personel kullanıcısı");
    const plan = await newPlan(api, party, 1000, 2);
    await must("personel 1.000", collect(staff, plan.id, "1000"));
    const res = rejected(await collect(staff, plan.id, "50"), 409, "plan-paid", "personel ödenmiş karta");
    assert.match(res.error, /yönetici/i, "personele yol: yöneticinize başvurun");
    assert.doesNotMatch(res.error, /Avans Yaz/, "personele düğme adı söylenmez");
    const perm = rejected(await collect(staff, plan.id, "50", { overpay: true }), 403, "plan-overpay-permission", "personel overpay");
    assert.match(perm.error, /yönetici/i);
    const adminRes = rejected(await collect(api, plan.id, "50"), 409, "plan-paid", "yönetici bayraksız");
    assert.match(adminRes.error, /Avans Yaz/, "yöneticiye düğme adı");
    const bakiye = await partyBalance(api, party.id);
    await must("yönetici avans 50", collect(api, plan.id, "50", { overpay: true }));
    const c = await card(api, plan.id);
    assert.deepEqual([c.totals.paid, c.totals.extra, c.totals.remaining, c.state], [1050, 50, 0, "done"], "fazlası kartta extra");
    assert.equal(await partyBalance(api, party.id), bakiye - 50, "caride alacak (avans)");
    rejected(await collect(api, plan.id, "10"), 409, "plan-paid", "mevcut avans yeni tahsilata yer açmaz");
    await integrityOk(api, "N10");
  });

  it("N10b: kalanı aşan tutar personelde plan-overpay (403 değil, bayraksız); overpay:true personelde 403; yönetici overpay:true 200 (kalan kadar + fazlası)", async () => {
    const plan = await newPlan(api, party, 1000, 2);
    await must("600", collect(staff, plan.id, "600"));
    rejected(await collect(staff, plan.id, "500"), 409, "plan-overpay", "personel aşan");
    rejected(await collect(staff, plan.id, "500", { overpay: true }), 403, "plan-overpay-permission", "personel overpay");
    await must("yönetici 500 avans", collect(api, plan.id, "500", { overpay: true }));
    const c = await card(api, plan.id);
    assert.deepEqual([c.totals.paid, c.totals.extra, c.totals.remaining], [1100, 100, 0]);
  });

  it("N7: kartın toplamı tahsilatın altına indirilince mevcut fazla okunur ve gösterilir; yeni tahsilat plan-paid; iade serbest; kalan açılınca tahsilat 200", async () => {
    const plan = await newPlan(api, party, 1000, 1);
    await must("1.000", collect(api, plan.id, "1000"));
    await must("toplamı 800'e indir (Otomatik Dağıt)", api.post(`${PLAN}/${plan.id}/distribute`, { total: "800", count: 1, firstDue: "2026-10-15" }));
    let c = await card(api, plan.id);
    assert.deepEqual([c.totals.total, c.totals.paid, c.totals.extra, c.totals.remaining], [800, 1000, 200, 0], "mevcut fazla gösterilir, değişmez");
    rejected(await collect(api, plan.id, "10"), 409, "plan-paid", "fazla tahsilatlı karta yeni tahsilat");
    await must("iade 300", refund(api, plan.id, "300"));
    c = await card(api, plan.id);
    assert.deepEqual([c.totals.paid, c.totals.extra, c.totals.remaining], [700, 0, 100]);
    rejected(await collect(api, plan.id, "100,01"), 409, "plan-overpay", "kalan 100 iken 100,01");
    await must("100", collect(api, plan.id, "100"));
    await integrityOk(api, "N7");
  });
});

describe("K8 taksit kuralı — Silinenler'den geri yükleme ve düzeltme (N8, N9)", () => {
  let ctx;
  let api;
  let party;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    party = await must("cari", api.post("/api/workspace/accounts", { name: "K8 Geri Yükleme Müşteri", type: "customer", registeredOn: "2026-10-01" }));
  });
  after(() => ctx?.server.close());
  const trashed = async (planName, entryId) => {
    const item = (await must("Silinenler", api.get("/api/admin/trash"))).find(t => t.kind === "plan-entry" && t.id === `plan-entry:${entryId}`) || (await must("Silinenler", api.get("/api/admin/trash"))).find(t => t.kind === "plan-entry" && t.title === planName);
    assert.ok(item, `silinen tahsilat Silinenler'de (${planName})`);
    return item;
  };
  const restore = (item, extra = {}) => api.post("/api/admin/trash/restore", { id: item.id, cashForce: true, ...extra });

  it("N8: 1.000 tahsilat sil → yeniden 1.000 → silineni geri yükle: 409 plan-paid; overpay:true → 200 (extra 1.000)", async () => {
    const plan = await newPlan(api, party, 1000, 1);
    const a = await must("A 1.000", collect(api, plan.id, "1000"));
    await must("A sil", api.del(`${PLAN}/${plan.id}/entries/${a.entryId}?cashForce=1`));
    await must("B 1.000", collect(api, plan.id, "1000"));
    const item = await trashed(plan.name, a.entryId);
    rejected(await restore(item), 409, "plan-paid", "geri yükleme ödenmiş karta");
    assert.equal((await card(api, plan.id)).entries.length, 1, "geri yüklenmedi");
    await must("geri yükle overpay", restore(item, { overpay: true }));
    const c = await card(api, plan.id);
    assert.deepEqual([c.entries.length, c.totals.paid, c.totals.extra], [2, 2000, 1000]);
    await integrityOk(api, "N8");
  });

  it("N8b: 1.000 sil → 600 → geri yükle: 409 plan-overpay (kalan 400, fazlası 600); overpay:true → 200", async () => {
    const plan = await newPlan(api, party, 1000, 1);
    const a = await must("A 1.000", collect(api, plan.id, "1000"));
    await must("A sil", api.del(`${PLAN}/${plan.id}/entries/${a.entryId}?cashForce=1`));
    await must("B 600", collect(api, plan.id, "600"));
    const item = await trashed(plan.name, a.entryId);
    const res = rejected(await restore(item), 409, "plan-overpay", "geri yükleme kalanı aşıyor");
    assert.deepEqual([res.data.remaining, res.data.excess], [400, 600]);
    await must("geri yükle overpay", restore(item, { overpay: true }));
    assert.deepEqual([(await card(api, plan.id)).totals.paid, (await card(api, plan.id)).totals.extra], [1600, 600]);
  });

  it("N9: düzeltmede tutar büyütüp kalanı aşmak → plan-overpay; küçültmek / aynı tutarla tarih → 200; overpay:true → 200; iade düzeltmesi kural dışı", async () => {
    const plan = await newPlan(api, party, 1000, 2);
    const a = await must("A 500", collect(api, plan.id, "500"));
    await must("B 500", collect(api, plan.id, "500"));
    const put = (body, extra = {}) => api.put(`${PLAN}/${plan.id}/entries/${a.entryId}`, { amount: "500", date: TODAY, method: "cash", cashForce: true, ...body, ...extra });
    const res = rejected(await put({ amount: "600" }), 409, "plan-overpay", "A 600");
    assert.deepEqual([res.data.remaining, res.data.excess], [500, 100], "düzeltmede kalan bu satır hariç okunur");
    await must("A 400", put({ amount: "400" }));
    assert.equal((await card(api, plan.id)).totals.remaining, 100);
    await must("A 500 geri", put({ amount: "500" }));
    await must("A aynı tutar, tarih 01.10", put({ amount: "500", date: "2026-10-01" }));
    rejected(await put({ amount: "500,01" }), 409, "plan-overpay", "1 kuruş büyütme");
    await must("A 600 overpay", put({ amount: "600" }, { overpay: true }));
    const c = await card(api, plan.id);
    assert.deepEqual([c.totals.paid, c.totals.extra, c.totals.remaining], [1100, 100, 0]);
    const r = await must("iade 100", refund(api, plan.id, "100"));
    await must("iadeyi 200 yap (kural dışı: para çıkışı)", api.put(`${PLAN}/${plan.id}/entries/${r.entryId}`, { amount: "200", date: TODAY, method: "cash", cashForce: true }));
    assert.deepEqual([(await card(api, plan.id)).totals.paid, (await card(api, plan.id)).totals.remaining], [900, 100]);
    await integrityOk(api, "N9");
  });
});
