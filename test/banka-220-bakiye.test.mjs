// v2.2.0 — İz 2.7: hesap seçicilerinde bakiye (sunucu: GET /bank/choices?date= ve GET /bank/balances?date=).
//
// İstek (müşteri, 12.10.2026; docs/2.2.0-IS-LISTESI.md İz 2.7): seçicide her hesabın bakiyesi, seçilenin altında "Bakiye · İşlemden Sonra"
// (SEÇİLEN TARİHTEKİ bakiye; tutar yazıldıkça; eksiye düşecekse kırmızı + K7 Uyar/Engelle kuralı); Kasadan Bankaya Yatır'da Nakit Kasa
// bakiyesi; banka bakiyesini görme yetkisi olmayana bakiye gösterilmez (sunucu da GÖNDERMEZ); seçici açılırken tek istek.
//
// KÂHİN (programdan bağımsız): plan §3.9 K7 — "bakiye = min(işlem günündeki, bütün hareketlerle) + limit (KMH / kart limiti) eksiyse Uyar → 409
// cash-negative, Engelle → 409 cash-blocked; Bakiye Doğrulandı değilse denetim yok". Beklenen sayılar aşağıda elle (tutarlardan) yazıldı.
//
// NASIL BOZARIM (testler buradan):
//   B1 Yetkisiz göz: Banka Görüntüleme yetkisi olmayan personel seçiciyi açar → bakiye GÖNDERİLMEZ (choices'ta balances / cash yok); ayrı
//      bakiye ucu 403. Avukat (Banka ve Kasa Görüntüleme) ikisini de alır.
//   B2 Yanlış gün: sonraki günün hareketi "o günkü" bakiyeye karışır → atMinor yalnız o gün sonuna kadarki hareketler, totalMinor bütün
//      hareketler; bozuk tarih bugüne düşer (çökmez).
//   B3 Ekran "geçer" der, sunucu reddeder (ya da tersi): seçicinin verisiyle kurulan "İşlemden Sonra" (min(o günkü, bütün) − tutar + limit)
//      sunucunun kararıyla sınırda aynı — tam sıfır geçer, 1 kuruş fazlası Engelle'de 409; geçmiş tarihte (o günkü < bütün), KMH limitiyle,
//      kart limitiyle; Uyar'da 409 cash-negative.
//   B4 Kural yanlış: Bakiye Doğrulanmadı → policy "off" + confirmed false (denetim yok, ödeme geçer); hesabın Eksi Bakiye'si boşsa Banka
//      Ayarları'ndaki; Nakit Kasa Yönetim → Eksi Bakiye Denetimi'ndeki.
//   B5 Pasif hesap bakiyesiyle listede → yalnız etkin hesaplar.
//   B6 Nakit Kasa: o günkü / bütün bakiye; Kasadan Bankaya Yatır'da sınır (Engelle) seçicinin verisiyle aynı karar.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf } from "./banka-210-ortak.mjs";
import { BANK, bootBank, expectStatus, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const OPENING = "2026-10-01";
const choicesAt = (api, date = "") => must(`seçici ${date}`, api.get(`${BANK}/choices${date ? `?date=${date}` : ""}`));
const balancesAt = (api, date = "") => must(`bakiye ${date}`, api.get(`${BANK}/balances${date ? `?date=${date}` : ""}`));
/** Seçicinin (ekranın) kararı: plan §3.9 — min(o günkü, bütün) − tutar + limit < 0 ise eksi. */
const wouldGoNegative = (b, amountMinor) => Math.min(b.atMinor, b.totalMinor) - amountMinor + b.limitMinor < 0;

describe("2.2.0 İz 2.7: seçicilerde bakiye (sunucu)", () => {
  let ctx;
  let api;
  let party;
  const acc = {};
  const pay = (account, amount, date, method = "bank") => api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount, method, date, bankAccountId: account.id, note: "İz 2.7 sınır" });
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    acc.z = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", negativePolicy: "block", opening: { date: OPENING, amount: "10.000", confirmed: true } });
    acc.k = await openAccount(api, { bankName: "Garanti BBVA", name: "KMH'li", kind: "demand", negativePolicy: "block", creditLimit: "5.000", opening: { date: OPENING, amount: "1.000", confirmed: true } });
    acc.u = await openAccount(api, { bankName: "Akbank", name: "Doğrulanmamış", kind: "demand", negativePolicy: "block", opening: { date: OPENING, amount: "500", confirmed: false } });
    // Kart bağsız açılır (bakiye kartın bankaya bağından bağımsız; eski kodda da açılabilsin — kırmızı kanıt bakiye adımlarında düşsün).
    acc.c = await openAccount(api, { bankName: "Ziraat Bankası", kind: "card", name: "World", creditLimit: "3.000", negativePolicy: "block", opening: { date: OPENING, amount: "0", confirmed: true } });
    acc.p = await openAccount(api, { bankName: "Halkbank", name: "Pasif", kind: "demand", opening: { date: OPENING, amount: "0", confirmed: true } });
    await must("pasife al", api.post(`${BANK}/accounts/${acc.p.id}/status`, { status: "passive" }));
    party = await must("cari", api.post("/api/workspace/accounts", { name: "İz 2.7 Tedarikçi", type: "supplier", registeredOn: "2026-01-01" }));
    // Ziraat'e 06.10'da 2.000 havale tahsilatı: 05.10'daki bakiye 10.000, bütün bakiye 12.000.
    await must("havale tahsilatı", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "2.000", method: "bank", date: "2026-10-06", bankAccountId: acc.z.id }));
  });
  after(async () => {
    await ctx?.server.close();
  });

  it("[B1] yetki: personelde bakiye yok (choices'ta alan yok, /balances 403); avukatta banka + Nakit Kasa bakiyesi", async () => {
    const clerk = apiOf(await createUser(ctx.server, api.client, { username: "personel227", role: "personel" }));
    const seen = await must("personel seçici", clerk.get(`${BANK}/choices?date=2026-10-08`));
    assert.ok(seen.accounts.length >= 4, "personel seçicide hesapları görür (tahsilat için)");
    assert.equal("balances" in seen, false, "personele banka bakiyesi GÖNDERİLMEZ");
    assert.equal("cash" in seen, false, "personele Nakit Kasa bakiyesi GÖNDERİLMEZ");
    expectStatus(await clerk.get(`${BANK}/balances?date=2026-10-08`), 403, "", "personel bakiye ucu");
    const lawyer = apiOf(await createUser(ctx.server, api.client, { username: "avukat227", role: "avukat" }));
    const full = await must("avukat seçici", lawyer.get(`${BANK}/choices?date=2026-10-08`));
    assert.equal(full.balances?.accounts?.[acc.z.id]?.totalMinor, 1_200_000, "avukat Ziraat bakiyesini görür");
    assert.equal(typeof full.cash?.atMinor, "number", "avukat Nakit Kasa bakiyesini görür");
  });

  it("[B2] seçilen tarihteki bakiye: 05.10 → 10.000 (06.10'daki tahsilat yok), bütün 12.000; 08.10 → 12.000; bozuk tarih bugüne düşer", async () => {
    const before5 = await choicesAt(api, "2026-10-05");
    assert.equal(before5.balances.date, "2026-10-05", "yanıtın günü");
    assert.deepEqual({ at: before5.balances.accounts[acc.z.id].atMinor, total: before5.balances.accounts[acc.z.id].totalMinor }, { at: 1_000_000, total: 1_200_000 }, "05.10");
    const today = await balancesAt(api, "2026-10-08");
    assert.equal(today.balances.accounts[acc.z.id].atMinor, 1_200_000, "08.10");
    const broken = await balancesAt(api, "2026-13-45");
    assert.equal(broken.balances.date, "2026-10-08", "bozuk tarih → bugün");
    const none = await balancesAt(api);
    assert.equal(none.balances.date, "2026-10-08", "tarihsiz → bugün");
  });

  it("[B3] Engelle, geçmiş tarih: 05.10'da 10.000,01 ödeme reddedilir (o günkü bakiye 10.000), 10.000 geçer; seçicinin kararı sunucuyla aynı", async () => {
    const b = (await balancesAt(api, "2026-10-05")).balances.accounts[acc.z.id];
    assert.equal(wouldGoNegative(b, 1_000_001), true, "seçici: 10.000,01 eksiye düşürür");
    const over = await pay(acc.z, "10.000,01", "2026-10-05");
    expectStatus(over, 409, "cash-blocked", "05.10 10.000,01");
    assert.equal(wouldGoNegative(b, 1_000_000), false, "seçici: 10.000 sıfıra indirir (geçer)");
    await must("05.10 10.000", pay(acc.z, "10.000", "2026-10-05"));
    const after5 = (await balancesAt(api, "2026-10-05")).balances.accounts[acc.z.id];
    assert.deepEqual({ at: after5.atMinor, total: after5.totalMinor }, { at: 0, total: 200_000 }, "05.10 sonrası: o gün 0, bütün 2.000");
    // Bugün (08.10): o günkü = bütün = 2.000 → 2.000,01 reddedilir.
    const now = (await balancesAt(api, "2026-10-08")).balances.accounts[acc.z.id];
    assert.equal(wouldGoNegative(now, 200_001), true);
    expectStatus(await pay(acc.z, "2.000,01", "2026-10-08"), 409, "cash-blocked", "08.10 2.000,01");
  });

  it("[B3] KMH limiti: 1.000 bakiye + 5.000 KMH → 6.000 geçer (−5.000), 6.000,01 reddedilir; bakiye −5.000, limit 5.000", async () => {
    const b = (await balancesAt(api, "2026-10-08")).balances.accounts[acc.k.id];
    assert.deepEqual({ at: b.atMinor, limit: b.limitMinor, policy: b.policy, guarded: b.guarded }, { at: 100_000, limit: 500_000, policy: "block", guarded: true });
    assert.equal(wouldGoNegative(b, 600_001), true);
    expectStatus(await pay(acc.k, "6.000,01", "2026-10-08"), 409, "cash-blocked", "KMH 6.000,01");
    assert.equal(wouldGoNegative(b, 600_000), false);
    await must("KMH 6.000", pay(acc.k, "6.000", "2026-10-08"));
    assert.equal((await balancesAt(api, "2026-10-08")).balances.accounts[acc.k.id].atMinor, -500_000, "KMH kullanımda: −5.000");
  });

  it("[B3] kredi kartı limiti: 3.000 limitli kartla 3.000,01 ödeme reddedilir, 3.000 geçer; kartın bakiyesi −3.000 (borç)", async () => {
    const b = (await balancesAt(api, "2026-10-08")).balances.accounts[acc.c.id];
    assert.deepEqual({ at: b.atMinor, limit: b.limitMinor, policy: b.policy, guarded: b.guarded, confirmed: b.confirmed }, { at: 0, limit: 300_000, policy: "block", guarded: true, confirmed: true });
    assert.equal(wouldGoNegative(b, 300_001), true);
    expectStatus(await pay(acc.c, "3.000,01", "2026-10-08", "card"), 409, "cash-blocked", "kart 3.000,01");
    await must("kart 3.000", pay(acc.c, "3.000", "2026-10-08", "card"));
    assert.equal((await balancesAt(api, "2026-10-08")).balances.accounts[acc.c.id].atMinor, -300_000, "kart borcu 3.000");
  });

  it("[B4] kural: doğrulanmamış hesapta policy off (ödeme geçer, eksi görünür); Uyar'da 409 cash-negative; boş → Banka Ayarları", async () => {
    const u = (await balancesAt(api, "2026-10-08")).balances.accounts[acc.u.id];
    assert.deepEqual({ policy: u.policy, confirmed: u.confirmed, at: u.atMinor }, { policy: "off", confirmed: false, at: 50_000 });
    await must("doğrulanmamış hesaptan 600", pay(acc.u, "600", "2026-10-08"));
    assert.equal((await balancesAt(api, "2026-10-08")).balances.accounts[acc.u.id].atMinor, -10_000, "−100 (denetim yok)");
    await must("Ziraat Uyar", api.put(`${BANK}/accounts/${acc.z.id}`, { negativePolicy: "warn" }));
    const z = (await balancesAt(api, "2026-10-08")).balances.accounts[acc.z.id];
    assert.equal(z.policy, "warn");
    assert.equal(wouldGoNegative(z, 200_001), true);
    expectStatus(await pay(acc.z, "2.000,01", "2026-10-08"), 409, "cash-negative", "Uyar 2.000,01");
    await must("Ziraat boş (Banka Ayarları)", api.put(`${BANK}/accounts/${acc.z.id}`, { negativePolicy: "" }));
    const settings = await must("ayarlar", api.get(`${BANK}/settings`));
    const fallback = settings.values?.negative?.policy;
    assert.ok(["warn", "block", "off"].includes(fallback), `Banka Ayarları eksi bakiye: ${JSON.stringify(settings.values?.negative)}`);
    assert.equal((await balancesAt(api, "2026-10-08")).balances.accounts[acc.z.id].policy, fallback, "boş → Banka Ayarları");
  });

  it("[B5] pasif hesap bakiye listesinde yok; etkinler var", async () => {
    const ids = Object.keys((await balancesAt(api, "2026-10-08")).balances.accounts);
    assert.equal(ids.includes(acc.p.id), false, "pasif yok");
    for (const key of ["z", "k", "u", "c"]) assert.ok(ids.includes(acc[key].id), `${key} var`);
  });

  it("[B6] Nakit Kasa: 06.10'da 1.000 tahsilat → 05.10'da 0 / bütün 1.000; Engelle'de Kasadan Bankaya Yatır 1.000,01 reddedilir, 1.000 geçer", async () => {
    await must("Nakit Kasa Engelle", api.put("/api/admin/negative-policy", { cash: "block" }));
    await must("Kasa tahsilatı", api.post("/api/workspace/cash", { kind: "in", amount: "1.000", date: "2026-10-06", description: "İz 2.7 nakit" }));
    const before5 = (await balancesAt(api, "2026-10-05")).cash;
    assert.deepEqual({ at: before5.atMinor, total: before5.totalMinor, policy: before5.policy }, { at: 0, total: 100_000, policy: "block" }, "05.10 Nakit Kasa");
    const today = (await balancesAt(api, "2026-10-08")).cash;
    assert.equal(today.atMinor, 100_000);
    const cashNegative = (c, amountMinor) => Math.min(c.atMinor, c.totalMinor) - amountMinor < 0;
    assert.equal(cashNegative(before5, 1), true, "05.10'da 0,01 bile eksi");
    expectStatus(await api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "0,01", date: "2026-10-05", bankAccountId: acc.k.id }), 409, "cash-blocked", "05.10 yatır 0,01");
    assert.equal(cashNegative(today, 100_001), true);
    expectStatus(await api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "1.000,01", date: "2026-10-08", bankAccountId: acc.k.id }), 409, "cash-blocked", "08.10 yatır 1.000,01");
    assert.equal(cashNegative(today, 100_000), false);
    await must("08.10 yatır 1.000", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "1.000", date: "2026-10-08", bankAccountId: acc.k.id }));
    const after = await balancesAt(api, "2026-10-08");
    assert.equal(after.cash.atMinor, 0, "Nakit Kasa 0");
    assert.equal(after.balances.accounts[acc.k.id].atMinor, -400_000, "KMH'li hesap −5.000 + 1.000 = −4.000");
  });
});
