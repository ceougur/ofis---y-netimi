// 2.5.0 Ç7b ADAY DÜZELTME TURU (YB-1; görev metni docs/devir/2.5.0-DEVAM/c7bfix-istem.txt; ana oturumun ekran yürüyüşünde yeniden üretilen ORTA bulgu): Kartı Kapat onayının
// denetimi kart penceresinin GÖSTERDİĞİ kalanla (S129 = A — tek kuyruk; GET /plans/:id totals.remaining) karşılaştırır; 409'un "güncel kalan"ı da o sayıdır. Önceden denetim işlemin
// içinde kartın KENDİ hesabını (allocate) okuyordu: cariye cari kartından (Taksit Tahsilatı değil) tahsilat girilmiş kartta pencere "Kalan 2.500" diye sorup onay alıyor, sunucu
// "güncel kalan 3.000,00 TL" diye 409 veriyor, pencere "Kalan 3.000" diye İKİNCİ KEZ soruyordu (carinin borcu 2.500).
// Sahte saat 08.10.2026 (bootBank). Beklenenler kararların sözünden ve pencerenin gösterdiği sayıdan (GET) — kartın kendi hesabından DEĞİL:
//  K1 en küçük örnek: kart 3.000 (3 taksit, ilk vade 08.09), cari kartından 500 → pencere 2.500 (kartın kendisi 3.000) → closeRemaining 2.500 TEK istekte 200, kart closed; cari bakiye
//     2.500 ve Mizan 120 kapanıştan önceki gibi (Borçta Kalsın — kalan borçta).
//  K2 karışık: Taksit Tahsilatı 1.000 + cari kartından 500 → pencere 1.500 → tek onay.
//  K3 tahsilat silinir (YB-1'in asıl amacı KALIR): pencere 1.500 (1.000 kart + 500 cari) iken kart tahsilatı silinir → eski onay 409; güncel kalan = pencerenin yeni sayısı 2.500
//     (kartın kendisi 3.000 değil); 2.500 ile kapanır. Cari tahsilatı silinince de: 2.500 iken 500 silinir → 409, güncel kalan 3.000.
//  K4 tutar değişir: 3.000 / cari 500 (pencere 2.500), tutar 3.600 → eski onay 409, güncel kalan = pencere (3.100); onunla 200.
//  K5 kalansız kart (S129 'Kalan 0 · Tamamlandı'): kart 600, cari kartından 800 → pencere 0 (kartın kendisi 600) → closeRemaining 0 → 200. Başka kartta tutar 1.200'e çıkınca onay 0 → 409.
//  K6 Mevcut Borç kartı (coversBalance): taksitli (Borç Yaz 3.000, kart 3.000 / 3 taksit, cari kartından 500 → pencere 2.500) ve taksitsiz ('Taksitlendirilmemiş Kalan') — pencerenin
//     kalanıyla tek onay.
//  K7 Borçta Kalsın ile kapanmış kart Yeniden Aç → yine Kartı Kapat: pencerenin kalanıyla tek onay.
//  K8 iki kart aynı caride: cari kartından 1.200 → eski kart pencere 0, yeni kart (ilk vade 08.01.2027) pencere 800 → yeni kart tek onayla kapanır. Yeni kartın kalanı Borçta Kalsın
//     ile kapanışın ertesi günü vadeli olur (S205 = A, S220 = A) ve tek kuyrukta eski kartın 3. taksitinden (08.11) ÖNE geçer: eski kartın penceresi 0'dan büyük bir sayıya döner —
//     önceki "kalan 0" onayı artık eskimiştir → 409 (güncel kalan = pencerenin yeni sayısı), pencerenin yeni sayısıyla tek onay.
//  K9 eski istemci (closeRemaining yok) → bugünkü gibi 200.
// NASIL BOZARIM (mutantlar): denetimi kaldır (eski onay kabul — K3 / K4 / K5'in 409'u gelmez); karşılaştırmayı yine kartın kendi hesabıyla yap (K1 / K2 / K5 / K6 / K7 / K8 409);
// 409'da güncel kalanı kartın kendi hesabından söyle (K3 / K4 'güncel kalan' yanlış); kalansız kartı denetim dışı bırak (K5'in 409'u gelmez).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { must } from "./banka-210-ortak.mjs";
import { BANK, bootBank } from "./banka-210-hesap-ortak.mjs";

const W = "/api/workspace";
const tl = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

describe("Ç7b aday düzeltme — Kartı Kapat onayı pencerenin GÖSTERDİĞİ kalanla (S129 = A)", () => {
  let ctx;
  let api;
  let n = 0;
  const acc = async (name = `Kart Kapat Deneme ${(n += 1)}`) => (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-09-01" }))).id;
  const card = async (accountId, total, extra = {}) => {
    const made = await must("kart", api.post(`${W}/plans`, { accountId, name: `Deneme Kartı ${(n += 1)}`, total: String(total), registeredOn: "2026-09-01", mode: "auto", count: 3, firstDue: "2026-09-08", ...extra }));
    return made.id || made.plan?.id;
  };
  const view = async id => must("kart penceresi", api.get(`${W}/plans/${id}`));
  const shown = async id => Number((await view(id)).totals.remaining);
  const own = async id => Number((await view(id)).totals.ownRemaining);
  const status = id => ctx.store.get("SELECT status FROM plans WHERE id = ?", id).status;
  const accountPay = async (accountId, amount, date = "2026-09-10") => {
    await must("cari kartından tahsilat", api.post(`${W}/accounts/${accountId}/entries`, { kind: "in", amount: String(amount), date, method: "cash" }));
    return ctx.store.get("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", accountId).id;
  };
  const planPay = async (planId, amount, date = "2026-09-10") => {
    await must("Taksit Tahsilatı", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date, method: "cash" }));
    return ctx.store.get("SELECT id FROM plan_entries WHERE plan_id = ? ORDER BY rowid DESC LIMIT 1", planId).id;
  };
  const balance = async accountId => Number((await must("cari kartı", api.get(`${W}/accounts/${accountId}`))).totals.balance);
  const trial120 = async () => Number(Object.fromEntries((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.map(r => [r.code, r.balance]))["120"] || 0);
  const close = (id, closeRemaining) => api.put(`${W}/plans/${id}`, closeRemaining === undefined ? { status: "closed" } : { status: "closed", closeRemaining });
  const closedOnce = async (id, closeRemaining, label) => {
    const res = await close(id, closeRemaining);
    assert.equal(res.status, 200, `${label}: tek onayla kapanmalı — ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    assert.equal(status(id), "closed", `${label}: kart closed (veri tabanı)`);
  };
  const stale = async (id, closeRemaining, expected, label) => {
    const res = await close(id, closeRemaining);
    assert.equal(res.status, 409, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    assert.equal(res.data?.code, "plan-close-stale", label);
    assert.equal(Number(res.data?.remaining), expected, `${label}: güncel kalan pencerenin yeniden göstereceği sayı`);
    assert.ok(String(res.data?.error || "").includes(`güncel kalan ${tl(expected)} TL`), `${label}: ileti ${res.data?.error}`);
    assert.equal(status(id), "active", `${label}: reddedilen istek kartı kapatmadı (veri tabanı)`);
  };
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
  });
  after(() => ctx?.server.close());

  it("K1 en küçük örnek: cari kartından 500 → pencere 2.500 → TEK onayla kapanır; bakiye 2.500, 120 aynı", async () => {
    const A = await acc("Kart Kapat Deneme");
    const id = await card(A, 3000);
    await accountPay(A, 500);
    const v = await view(id);
    assert.equal(Number(v.totals.remaining), 2500, "pencere (tek kuyruk)");
    assert.equal(Number(v.totals.ownRemaining), 3000, "kartın kendi hesabı");
    const bal = await balance(A);
    const t120 = await trial120();
    assert.equal(bal, 2500);
    await closedOnce(id, 2500, "K1");
    assert.equal(await balance(A), 2500, "Borçta Kalsın: carinin borcu değişmez");
    assert.equal(await trial120(), t120, "Mizan 120 değişmez");
  });

  it("K2 karışık: Taksit Tahsilatı 1.000 + cari kartından 500 → pencere 1.500 → tek onay", async () => {
    const A = await acc();
    const id = await card(A, 3000);
    await planPay(id, 1000);
    await accountPay(A, 500);
    assert.equal(await shown(id), 1500);
    assert.equal(await own(id), 2000);
    await closedOnce(id, 1500, "K2");
  });

  it("K3 tahsilat silinir: eski onay 409 KALIR; güncel kalan pencerenin yeni sayısı", async () => {
    const A = await acc();
    const id = await card(A, 3000);
    const entry = await planPay(id, 1000);
    await accountPay(A, 500);
    assert.equal(await shown(id), 1500);
    await must("kart tahsilatını sil", api.del(`${W}/plans/${id}/entries/${entry}`));
    assert.equal(await shown(id), 2500, "pencere: 3.000 − cari 500");
    await stale(id, 1500, 2500, "K3a kart tahsilatı silindi");
    await closedOnce(id, 2500, "K3a güncel onay");

    const B = await acc();
    const id2 = await card(B, 3000);
    const cari = await accountPay(B, 500);
    assert.equal(await shown(id2), 2500);
    await must("cari tahsilatını sil", api.del(`${W}/accounts/${B}/entries/${cari}`));
    assert.equal(await shown(id2), 3000);
    await stale(id2, 2500, 3000, "K3b cari tahsilatı silindi");
    await closedOnce(id2, 3000, "K3b güncel onay");
  });

  it("K4 tutar değişir: eski onay 409; güncel kalan pencerenin sayısı", async () => {
    const A = await acc();
    const id = await card(A, 3000);
    await accountPay(A, 500);
    assert.equal(await shown(id), 2500);
    await must("tutar 3.600", api.put(`${W}/plans/${id}`, { total: "3.600" }));
    const now = await shown(id);
    assert.notEqual(now, await own(id), "örnek pencere ↔ kartın kendisi ayrışmalı");
    assert.equal(now, 3100);
    await stale(id, 2500, now, "K4");
    await closedOnce(id, now, "K4 güncel onay");
  });

  it("K5 kalansız kart (pencere 0, kartın kendisi 600) tek onayla; tutar büyüyünce onay 0 → 409", async () => {
    const A = await acc();
    const id = await card(A, 600);
    await accountPay(A, 800);
    assert.equal(await shown(id), 0, "S129: Kalan 0 · Tamamlandı");
    assert.equal(await own(id), 600);
    await closedOnce(id, 0, "K5a");

    const B = await acc();
    const id2 = await card(B, 600);
    await accountPay(B, 800);
    assert.equal(await shown(id2), 0);
    await must("tutar 1.200", api.put(`${W}/plans/${id2}`, { total: "1.200" }));
    const now = await shown(id2);
    assert.equal(now, 400, "pencere: 1.200 − 800");
    await stale(id2, 0, now, "K5b");
    await closedOnce(id2, now, "K5b güncel onay");
  });

  it("K6 Mevcut Borç kartı (taksitli ve taksitsiz): pencerenin kalanıyla tek onay", async () => {
    // K6a taksitli (3 taksit): cari kartından 500 ilk taksite → pencere 2.500, kartın kendisi 3.000.
    const A = await acc();
    await must("Borç Yaz 3.000", api.post(`${W}/accounts/${A}/entries`, { kind: "debt", amount: "3000", date: "2026-09-01", note: "Önceki borç" }));
    const madeA = await must("Mevcut Borç kartı", api.post(`${W}/plans`, { accountId: A, name: `Mevcut Borç ${(n += 1)}`, total: "3000", registeredOn: "2026-09-01", coversBalance: true, mode: "auto", count: 3, firstDue: "2026-09-08" }));
    const idA = madeA.id || madeA.plan?.id;
    await accountPay(A, 500);
    assert.equal(await shown(idA), 2500);
    assert.equal(await own(idA), 3000);
    await closedOnce(idA, 2500, "K6a");
    assert.equal(await balance(A), 2500);
    // K6b taksitsiz (kalan kuyruğun 'Taksitlendirilmemiş Kalan' kalemi): pencere ne gösteriyorsa onunla tek onay (bu örnekte cari tahsilatı alttaki borç kalemine gider —
    // pencere 3.000; S129 kapanış notu "taksitlere bölünmemiş kısım ... alttaki borç kalemi olarak durur").
    const B = await acc();
    await must("Borç Yaz 3.000", api.post(`${W}/accounts/${B}/entries`, { kind: "debt", amount: "3000", date: "2026-09-01", note: "Önceki borç" }));
    const madeB = await must("Mevcut Borç kartı", api.post(`${W}/plans`, { accountId: B, name: `Mevcut Borç ${(n += 1)}`, total: "3000", registeredOn: "2026-09-01", coversBalance: true }));
    const idB = madeB.id || madeB.plan?.id;
    await accountPay(B, 500);
    await closedOnce(idB, await shown(idB), "K6b");
  });

  it("K7 Borçta Kalsın ile kapanmış kart Yeniden Aç → yine Kartı Kapat: pencerenin kalanıyla tek onay", async () => {
    const A = await acc();
    const id = await card(A, 3000);
    await accountPay(A, 500);
    await closedOnce(id, 2500, "K7 ilk kapanış");
    await must("Yeniden Aç", api.put(`${W}/plans/${id}`, { status: "active" }));
    assert.equal(status(id), "active");
    assert.equal(await shown(id), 2500);
    await closedOnce(id, 2500, "K7 yeniden kapanış");
    assert.equal(await balance(A), 2500);
  });

  it("K8 iki kart aynı caride: her kart kendi pencere sayısıyla tek onay", async () => {
    const A = await acc();
    const eski = await card(A, 1000);
    const yeni = await card(A, 1000, { firstDue: "2027-01-08" });
    await accountPay(A, 1200);
    assert.equal(await shown(eski), 0);
    assert.equal(await shown(yeni), 800);
    assert.equal(await own(yeni), 1000);
    await closedOnce(yeni, 800, "K8 yeni kart");
    const now = await shown(eski);
    assert.ok(now > 0.005, `eski kartın penceresi yeni kartın kapanışından sonra değişti (${now})`);
    await stale(eski, 0, now, "K8 eski kart — eskimiş 'kalan 0' onayı");
    await closedOnce(eski, now, "K8 eski kart — güncel onay");
    assert.equal(await balance(A), 800, "carinin borcu: 2.000 − 1.200");
  });

  it("K9 eski istemci (closeRemaining yok): bugünkü gibi kapanır", async () => {
    const A = await acc();
    const id = await card(A, 3000);
    await accountPay(A, 500);
    await closedOnce(id, undefined, "K9");
  });

  it("değişmez: Mutabakat Testi temiz", async () => {
    const result = await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`));
    assert.equal(result.ok, true, JSON.stringify(result.failures || []).slice(0, 600));
  });
});
