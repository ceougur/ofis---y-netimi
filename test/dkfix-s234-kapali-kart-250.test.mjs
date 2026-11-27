// 2.5.0 Ç7b DK + S229 ALTIN birleşik küçük tur — S234 = A (görev metni docs/devir/2.5.0-DEVAM/dkfix-istem.txt; tasarım docs/erp/C7B-FATURA-TASARIM.md §18; Ç7b dar kontrolünün BULGU-1'i).
// KARAR (iş listesinden AYNEN): "karar (4) kapalı (kalanı borçta kalan) karta da uygulanır — kart küçülür (vadesi en önce gelen açık taksitten), Kalan 300" — "bakiye ve gecikmiş her seçenekte AYNI".
// Beklenenler kararın sözünden (Kalan = carinin o karttaki borcu; karar (4) sırası) ve TABANIN (dkfix-taban, 94a7b475) aynı senaryodaki bakiye / gecikmiş / Mizan 120 sayılarından (karar: değişmez).
// Sahte saat 08.10.2026 (bootBank). Örnekler §18.1 / §18.6 'nasıl bozulur':
//  T1 (S234-a, BULGU-1): fatura 900 (07.10) → Mevcut Borç kartı 900 (10.10 / 10.11 / 10.12) → 08.10 kart tahsilatı 300 → Kartı Kapat → 08.10 iade 1 × 300 (borçtan) → kart tutarı 600, 10.11 taksiti
//      silinir (en önce gelen AÇIK taksit), 10.12 kalır; pencere / cari kartı özeti / Taksitler listesi Kalan 300 (tabanda 600); bakiye 300, gecikmiş 08.10 0 / 09.10 300, Mizan 120 300, Mutabakat
//      Testi temiz (tabanla aynı); Yeniden Aç → pencere 300 → Kartı Kapat onayı 300 tek istekte 200.
//  T2 (§18.6 (2)): kapanıştan önce vadesi geçmiş açık taksit — kart 900 (05.10 / 05.11 / 05.12), 08.10 Kapat, 08.10 iade 300 → kesim 05.10'dan (karar (4)'ün harfi; açık kartta da böyle);
//      09.10 gecikmiş 600 tabanla aynı. KAPANIŞ GÜNÜ (08.10) gecikmişi tabandan AYRILIR: taban 300 (kuyruk iade alacağını son kaleme kapatıyordu, 05.10 gecikmiş kalıyordu), yeni 0 —
//      rapor KULLANICIYA SORULMALI (uç durum; beklenen burada kararın harfiyle yazıldı).
//  T3 (§18.6 (3)): iade kalanı aşar (iade 3 × 300) → kart tutarı = net tahsilat 300, Kalan 0, bakiye −300 (avans); parası geri verilen iade (nakit) kartı küçültmez (Kalan 600).
//  T4 (§18.6 (4)): iade → iade İptal Et → kart 900'e geri büyür (son taksite), Kalan 600; bakiye 600, gecikmiş tabanla aynı.
//  T5 (§18.6 (6), (12)): ESKİ kuralla kapanmış kart ('2.4.9' — göç 53'ün var olan kapalı kartlara yazdığı değer, burada veri tabanına o değer yazılır) + iade → DEĞİŞMEZ (tutar 900).
//  T6 (§18.6 (7), S226 = C): kapalı Borçta Kalsın kart + açık Mevcut Borç kartı aynı caride, kapalı kartın içine aldığı fatura İptal Et → kapalı kart DEĞİŞMEZ (tutar 900).
//  T7 (§18.6 (13), S234-b): taksitli faturanın KENDİ kartı Borçta Kalsın kapalı + iade 300 → tutar 600, Tahsil Edilen 300 (tabanda 600), Kalan 300; faturanın açığı = kartın kalanı;
//      iade İptal Et → tutar 900, Kalan 600.
//  T8 (§18.6 (9)): iki kart aynı caride — eski kapalı kart (fatura 900'ü almış) + yeni açık kart (fatura 300'ü almış); ilk faturaya iade 300 → kapalı kart 600; iki kartın Kalan toplamı = bakiye.
//      Gecikmiş burada DENETLENMEZ: Tek Yükümlülük Kuyruğu ilk kart küçülünce ikinci kartın kapsamını kapama defterinden ayrı dağıtıyor (ikinci faturayı kapsamsız 'Gecikti' gösteriyor) —
//      tabanda AÇIK iki kartta da aynı; rapor BULGU (kuyruk ↔ kapama defteri; bu turun dosya sınırı dışı).
//  T9 (§18.6 (14)): açılış onarımının yolu (order "tail") kapalı kartı bugünkü gibi küçültmez.
// NASIL BOZARIM (mutantlar): shrinkPlan'da kapalı kart yine atlanır (T1 / T3 / T7 kırmızı); kalanı düşülmüş eski kurallı kart da küçülür (T5 kırmızı); iptal yolunda trimCovers kapalı kartı da
// kırpar (T6 kırmızı); büyüme kapalı karta uygulanmaz (T4 / T7 kırmızı); kesim sondan geriye (T1 10.12 silinir — kırmızı).
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { must } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";

const W = "/api/workspace";

describe("S234 = A — karar (4) Borçta Kalsın ile kapatılmış karta da (kart küçülür, Kalan = carinin karttaki borcu)", () => {
  let ctx;
  let api;
  let n = 0;
  const setDay = day => ctx.server.clock.set(`${day}T12:00:00+03:00`);
  // Kayıt anları sırayla ilerler (Mevcut Borç kartı yalnız açıldığı ANA kadar doğmuş borcu kapsar — lib/invoice-settle.mjs; sabit saatte bütün kayıtlar aynı anda doğardı).
  let minute = 0;
  const tick = (day = "2026-10-08") => ctx.server.clock.set(`${day}T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
  const acc = async () => (await must("cari", api.post(`${W}/accounts`, { name: `S234 Müşteri ${(n += 1)}`, type: "customer", registeredOn: "2026-08-01" }))).id;
  const goods = async (accountId, date, qty, payment) => (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id;
  const cover = async (accountId, total, firstDue, registeredOn = "2026-10-07") => (await must("Mevcut Borç kartı", api.post(`${W}/plans`, { accountId, name: `Mevcut Borç ${(n += 1)}`, total: String(total), registeredOn, mode: "auto", count: 3, firstDue, coversBalance: true }))).id;
  const pay = (planId, amount, date = "2026-10-08") => must("Taksit Tahsilatı", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date, method: "cash" }));
  const view = id => must("kart penceresi", api.get(`${W}/plans/${id}`));
  const close = async id => {
    const v = await view(id);
    const res = await api.put(`${W}/plans/${id}`, { status: "closed", closeRemaining: v.totals.remaining });
    assert.equal(res.status, 200, `Kartı Kapat: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    return Number(v.totals.remaining);
  };
  const lineOf = async invoiceId => (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id;
  const giveBack = async (invoiceId, accountId, qty, payment = { cash: [] }) => (await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: "2026-10-08", lines: [{ originLineId: await lineOf(invoiceId), qty }], payment, force: true }))).id;
  const cancel = id => must("İptal Et", api.post(`${W}/invoices/${id}/cancel`, { reason: "deneme" }));
  const account = id => must("cari kartı", api.get(`${W}/accounts/${id}`));
  const listRow = async id => {
    const list = await must("Taksitler", api.get(`${W}/plans?status=all`));
    return (list.items || list.plans || list.rows || []).find(row => row.id === id);
  };
  const trial120 = async () => Number(Object.fromEntries((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.map(r => [r.code, r.balance]))["120"] || 0);
  const integrityOk = async () => (await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`))).ok;
  const total = id => Number(ctx.store.get("SELECT total FROM plans WHERE id = ?", id).total);
  // Kalanın üç gösterimi: kart penceresi, cari kartındaki kart özeti, Taksitler listesi.
  const shownEverywhere = async (accountId, planId) => {
    const v = await view(planId);
    const a = await account(accountId);
    const summary = (a.plans || []).find(row => row.id === planId);
    const row = await listRow(planId);
    return { window: Number(v.totals.remaining), summary: Number(summary?.totals?.remaining), list: Number(row?.totals?.remaining ?? row?.remaining), items: v.items };
  };

  // Her sınama kendi sunucusunda (fatura seri / tarih sırası sınamalar arasında karışmasın).
  beforeEach(async () => {
    ctx = await bootBank({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
    api = ctx.api;
  });
  afterEach(() => ctx?.server.close());

  it("T1 — kapalı Mevcut Borç kartı + iade: kart en önce gelen açık taksitten küçülür, Kalan her yerde 300; bakiye / gecikmiş / Mizan / Mutabakat Testi tabanla aynı; Yeniden Aç → Kapat 300", async () => {
    setDay("2026-10-08");
    const A = await acc();
    const g = await goods(A, "2026-10-07", 3, { rest: "account" });
    const q = await cover(A, 900, "2026-10-10");
    await pay(q, 300);
    assert.equal(await close(q), 600, "Kartı Kapat onayı 600 (iade öncesi)");
    await giveBack(g, A, 1);
    assert.equal(total(q), 600, "kart tutarı 900 → 600 (karar (4); tabanda 900 kalıyordu)");
    const shown = await shownEverywhere(A, q);
    assert.deepEqual([shown.window, shown.summary, shown.list], [300, 300, 300], "Kalan: pencere / cari kartı özeti / Taksitler listesi 300 (tabanda 600)");
    assert.deepEqual(shown.items.map(item => [item.planDueDate || item.dueDate, Number(item.amount)]), [["2026-10-10", 300], ["2026-12-10", 300]], "10.11 taksiti silindi (en önce gelen AÇIK), 10.12 kaldı");
    const a = await account(A);
    assert.deepEqual([Number(a.totals.balance), Number(a.totals.overdueDebt)], [300, 0], "08.10 bakiye 300, gecikmiş 0 (tabanla aynı)");
    assert.equal(await trial120(), 300, "Mizan 120 = 300 (tabanla aynı)");
    assert.equal(await integrityOk(), true, "Mutabakat Testi temiz");
    setDay("2026-10-09");
    assert.equal(Number((await account(A)).totals.overdueDebt), 300, "09.10 gecikmiş 300 (kapanış ertesi — S205; tabanla aynı)");
    const reopen = await api.put(`${W}/plans/${q}`, { status: "active" });
    assert.equal(reopen.status, 200, "Yeniden Aç");
    assert.equal(Number((await view(q)).totals.remaining), 300, "yeniden açık kart Kalan 300");
    const again = await api.put(`${W}/plans/${q}`, { status: "closed", closeRemaining: 300 });
    assert.equal(again.status, 200, `Kartı Kapat onayı 'Kalan 300' tek istekte (tabanda 600 soruyordu): ${again.status} ${JSON.stringify(again.data).slice(0, 200)}`);
    assert.equal(Number((await account(A)).totals.balance), 300, "yeniden kapatma Borçta Kalsın: bakiye 300");
    assert.equal(await integrityOk(), true, "Mutabakat Testi temiz (yeniden kapalı)");
  });

  it("T2 — kapanıştan önce vadesi geçmiş açık taksit: kesim o taksitten (karar (4)); 09.10 gecikmiş tabanla aynı", async () => {
    setDay("2026-10-08");
    const A = await acc();
    const g = await goods(A, "2026-10-01", 3, { rest: "account" });
    const q = await cover(A, 900, "2026-10-05", "2026-10-02");
    await close(q);
    assert.equal(Number((await account(A)).totals.overdueDebt), 300, "kapanış günü gecikmiş 300 (05.10 taksiti kendi vadesiyle — S205 MIN)");
    await giveBack(g, A, 1);
    assert.equal(total(q), 600, "kart 600");
    const shown = await shownEverywhere(A, q);
    assert.deepEqual(shown.items.map(item => [item.planDueDate || item.dueDate, Number(item.amount)]), [["2026-11-05", 300], ["2026-12-05", 300]], "05.10 taksiti kesildi (en önce gelen açık)");
    assert.deepEqual([shown.window, shown.summary, shown.list], [600, 600, 600], "Kalan 600");
    const a = await account(A);
    assert.deepEqual([Number(a.totals.balance), Number(a.totals.overdueDebt)], [600, 0], "08.10 bakiye 600 (tabanla aynı), gecikmiş 0 (05.10 taksiti kesildi — karar (4); taban 300: KULLANICIYA SORULMALI)");
    setDay("2026-10-09");
    assert.equal(Number((await account(A)).totals.overdueDebt), 600, "09.10 gecikmiş 600 (tabanla aynı)");
    assert.equal(await integrityOk(), true, "Mutabakat Testi temiz");
  });

  it("T3 — iade kalanı aşar: kart net tahsilata iner, Kalan 0, fazlası avans; parası geri verilen iade kartı küçültmez", async () => {
    setDay("2026-10-08");
    const A = await acc();
    const g = await goods(A, "2026-10-07", 3, { rest: "account" });
    const q = await cover(A, 900, "2026-10-10");
    await pay(q, 300);
    await close(q);
    await giveBack(g, A, 3);
    assert.equal(total(q), 300, "kart tutarı = net tahsilat 300");
    // Pencerenin Kalan'ı bu durumda AÇIK kartta da kartın kendi kalanından ayrışıyor (kart tahsilatı avansa döndü; önceden var — rapor 'SONRAKİ SÜRÜME'): kapalı kart açıkla aynı sayıyı verir.
    assert.equal(Number((await view(q)).totals.ownRemaining), 0, "kartın kendi kalanı 0");
    assert.equal(Number((await account(A)).totals.balance), -300, "bakiye −300 (avans; tabanla aynı)");
    const B = await acc();
    const h = await goods(B, "2026-10-07", 3, { rest: "account" });
    const r = await cover(B, 900, "2026-10-10");
    await pay(r, 300);
    await close(r);
    await giveBack(h, B, 1, { cash: [{ amount: 300, method: "cash" }] });
    assert.equal(total(r), 900, "parası geri verilen iade kartı küçültmez (G1)");
    assert.equal((await shownEverywhere(B, r)).window, 600, "Kalan 600");
    assert.equal(Number((await account(B)).totals.balance), 600, "bakiye 600 (borç düşmez)");
    assert.equal(await integrityOk(), true, "Mutabakat Testi temiz");
  });

  // BEKLENTİ BİLEREK DEĞİŞTİ (2.5.0 İzleyen küçük tur — S238 = A, tasarım §19.3): büyüme iadenin kestiği AYNI taksite (önceden S216 = C: son taksite). Bakiye / gecikmiş aynen.
  it("T4 — iade → iade İptal Et: kapalı kart geri büyür (S238 = A: kesilen 10.11 taksiti geri gelir), Kalan 600; bakiye / gecikmiş tabanla aynı", async () => {
    setDay("2026-10-08");
    const A = await acc();
    const g = await goods(A, "2026-10-07", 3, { rest: "account" });
    const q = await cover(A, 900, "2026-10-10");
    await pay(q, 300);
    await close(q);
    const ret = await giveBack(g, A, 1);
    assert.equal(total(q), 600, "iade sonrası 600");
    await cancel(ret);
    assert.equal(total(q), 900, "iade iptali → 900 (S238 = A — aynı taksite)");
    const shown = await shownEverywhere(A, q);
    assert.deepEqual([shown.window, shown.summary, shown.list], [600, 600, 600], "Kalan 600");
    assert.deepEqual(shown.items.map(item => [item.planDueDate || item.dueDate, Number(item.amount)]), [["2026-10-10", 300], ["2026-11-10", 300], ["2026-12-10", 300]], "kesilen 10.11 geri gelir (S238 = A); 10.12 300");
    const a = await account(A);
    assert.deepEqual([Number(a.totals.balance), Number(a.totals.overdueDebt)], [600, 0], "08.10 bakiye 600, gecikmiş 0");
    setDay("2026-10-09");
    assert.equal(Number((await account(A)).totals.overdueDebt), 600, "09.10 gecikmiş 600 (kalanın tamamı kapanış ertesinden — tabanla aynı)");
    assert.equal(await integrityOk(), true, "Mutabakat Testi temiz");
  });

  it("T5 — ESKİ kuralla ('2.4.9', kalanı düşülmüş) kapanmış kart + iade: DEĞİŞMEZ", async () => {
    setDay("2026-10-08");
    const A = await acc();
    const g = await goods(A, "2026-10-07", 3, { rest: "account" });
    const q = await cover(A, 900, "2026-10-10");
    await pay(q, 300);
    await close(q);
    // Göç 53'ün var olan kapalı kartlara yazdığı değer (v2.4.9 verisi — kalan carinin borcundan düşülmüş).
    ctx.store.run("UPDATE plans SET close_rule = '2.4.9' WHERE id = ?", q);
    const before = Number((await account(A)).totals.balance);
    await giveBack(g, A, 1);
    assert.equal(total(q), 900, "eski kurallı kapalı kart küçülmez");
    assert.equal(Number((await account(A)).totals.balance), before - 300, "bakiye iade kadar düşer (eski kural: kalan zaten düşülmüş)");
    assert.equal(await integrityOk(), true, "Mutabakat Testi temiz");
  });

  it("T6 — iptal (S226 = C): kapalı kartın içine aldığı faturanın İptal Et'i kapalı kartı DEĞİŞTİRMEZ (açık Mevcut Borç kartı da varken)", async () => {
    setDay("2026-10-08");
    const A = await acc();
    tick();
    const g = await goods(A, "2026-10-06", 3, { rest: "account" });
    tick();
    const q = await cover(A, 900, "2026-10-10", "2026-10-06");
    tick();
    await close(q);
    tick();
    await goods(A, "2026-10-07", 2, { rest: "account" });
    tick();
    const r = await cover(A, 600, "2026-10-20", "2026-10-07");
    tick();
    await cancel(g);
    assert.equal(total(q), 900, "kapalı kart iptalde değişmez (S226 = C — bugünkü davranış)");
    assert.equal(ctx.store.get("SELECT status FROM plans WHERE id = ?", q).status, "closed", "kapalı kalır");
    assert.equal(total(r), 600, "açık kart (öbür faturayı almış) değişmez");
  });

  it("T7 — taksitli faturanın KENDİ kartı Borçta Kalsın kapalı + iade: tutar 600, Tahsil Edilen 300, Kalan 300; iade İptal Et → 900 / Kalan 600", async () => {
    setDay("2026-10-08");
    const A = await acc();
    const g = await goods(A, "2026-10-06", 3, { rest: "installments", installments: { count: 3, firstDue: "2026-10-06" } });
    const q = ctx.store.get("SELECT plan_id AS id FROM invoices WHERE id = ?", g).id;
    await pay(q, 300);
    await close(q);
    const ret = await giveBack(g, A, 1);
    assert.equal(total(q), 600, "kendi kartı 900 → 600 (karar (4); tabanda 900)");
    const v = await view(q);
    assert.deepEqual([Number(v.totals.paid), Number(v.totals.remaining)], [300, 300], "Tahsil Edilen 300 (tabanda iade alacağıyla 600), Kalan 300");
    const doc = await must("fatura", api.get(`${W}/invoices/${g}`));
    assert.equal(Number(doc.open), Number(v.totals.ownRemaining), "faturanın açığı = kartın kalanı (v2.0.24 değişmezi)");
    const a = await account(A);
    assert.deepEqual([Number(a.totals.balance), Number(a.totals.overdueDebt)], [300, 0], "bakiye 300, gecikmiş 0 (tabanla aynı)");
    await cancel(ret);
    assert.equal(total(q), 900, "iade iptali → 900");
    assert.equal(Number((await view(q)).totals.remaining), 600, "Kalan 600");
    setDay("2026-10-09");
    assert.equal(Number((await account(A)).totals.overdueDebt), 600, "09.10 gecikmiş 600 (tabanla aynı)");
    assert.equal(await integrityOk(), true, "Mutabakat Testi temiz");
  });

  it("T8 — iki kart aynı caride (kapalı eski + açık yeni): ilk faturanın iadesi kapalı kartı küçültür; iki kartın Kalan toplamı = bakiye", async () => {
    setDay("2026-10-08");
    const A = await acc();
    tick();
    const g = await goods(A, "2026-10-05", 3, { rest: "account" });
    tick();
    const q = await cover(A, 900, "2026-10-10", "2026-10-05");
    tick();
    await close(q);
    tick();
    await goods(A, "2026-10-06", 1, { rest: "account" });
    tick();
    const r = await cover(A, 300, "2026-10-20", "2026-10-06");
    tick();
    await giveBack(g, A, 1);
    assert.equal(total(q), 600, "kapalı kart 600");
    assert.equal(total(r), 300, "açık kart 300");
    const a = await account(A);
    const left = (await shownEverywhere(A, q)).window + (await shownEverywhere(A, r)).window;
    assert.equal(left, Number(a.totals.balance), "kartların Kalan toplamı = bakiye (900)");
    assert.equal(Number(a.totals.balance), 900, "bakiye 900");
    assert.equal(await integrityOk(), true, "Mutabakat Testi temiz");
  });

  it("T9 — açılış onarımının yolu (order 'tail') kapalı kartı küçültmez", async () => {
    setDay("2026-10-08");
    const A = await acc();
    await goods(A, "2026-10-07", 3, { rest: "account" });
    const q = await cover(A, 900, "2026-10-10");
    await close(q);
    const plans = ctx.app.context.plans;
    assert.equal(typeof plans?.shrinkPlan, "function", "plans modülü");
    const user = { id: "deneme", role: "admin", permissions: [] };
    assert.equal(ctx.store.tx(() => plans.shrinkPlan(user, q, 100, "deneme", { order: "tail" })), 0, "tail: kapalı kart atlanır");
    assert.equal(total(q), 900, "tutar 900");
  });
});
