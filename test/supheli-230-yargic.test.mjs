// 2.3.0 bitiş turu — bağımsız yargıç bulguları (15.10.2026; yargıç betikleri p1-supheli / s2-k8-cek ile yeniden üretildi; eski kodda
// (1fc87bb) her madde kırmızı: docs/kanit/2026-10-15/yargic-*-kirmizi). Sahte saat 08.10.2026.
//  Y2  Karşılık tarihinden önceye düşen geriye tarihli tahsilat: karşılık AYRILIRKEN de karşılık ≤ kalan (kabul K6 eki) — aşan kısım aynı gün
//      B 129 / A 644; kayıt kapanınca 129 = 0 (önceden 129 kalanı aşıyor, yetim karşılık kalıyordu).
//  Y3  Değersiz yazılmış kayda değersiz satırından önceye düşen tahsilat (K7 sonradan bozulur: satır kayıt dışına taşar, 120 eksi, 659 sahte zarar)
//      → kapı reddeder (doubtful:records; tam + dokunulan yol).
//  Y4  Tahsilatlı kaydın Silinenler'den geri yüklenmesi 200 (önceden kayıt tutarı bugünkü bakiyeyle kıyaslanıp kalıcı 409); 120'yi eksiye
//      düşürecek geri yükleme yine 409 (anlamlı metin).
//  Y5  Açık şüpheli kaydı olan müşteri tedarikçiye çevrilemez (409 account-doubtful-open).
//  Y6  "Kredi Kartına İade" kart hesabı yokken 400 bank-account-invalid (108.00'a sessiz yazım yok).
//  Y7  GET /api/workspace/doubtful raporla aynı kural: Şüpheli Alacak İşlemleri (muhasebe) VEYA Finans Raporları; personel 403.
//  Y8a Kayıt tarihi carinin ilk borç satırından önce olamaz (400 doubtful-before-debt).
//  Y8b Şüpheliden çıkarılmış kayda çıkarma gününden önceye düşen tahsilat → başlık ≠ çıkarılan olurdu → kapı reddeder (doubtful:records).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { apiOf, integrityOf, must } from "./banka-210-ortak.mjs";
import { bootBank, expectStatus, trialBalances } from "./banka-210-hesap-ortak.mjs";
import { ACC, collect, customer, debt, listOf, provision, release, take, trial, writeOff } from "./banka-230-supheli-ortak.mjs";
import { createUser } from "./helpers.mjs";

const entry = (api, accountId, body) => api.post(`${ACC}/${accountId}/entries`, { kind: "in", method: "cash", note: "Tahsilat", ...body });
const trashItem = async (api, ref) => (await must("Silinenler", api.get("/api/admin/trash"))).find(row => row.kind === "doubtful" && row.ref === ref);
const rejectedByGate = (res, label) => {
  assert.equal(res.status, 409, `${label}: 409 beklenir — gelen ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  assert.equal(res.code, "ledger-integrity", `${label}: kapı reddi`);
  assert.match(JSON.stringify(res.data), /doubtful:records/, `${label}: neden doubtful:records`);
};

describe("2.3.0 yargıç bulguları — Şüpheli Alacaklar", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());

  it("Y2: al 01.10 1.000 → karşılık 07.10 1.000 → tahsilat 05.10 600 (geriye tarihli): 129 = −400 (≤ kalan 400), 644 600; değersiz 400 → 129 = 0, 659 = 0", async () => {
    const acc = await customer(ctx.api, "Y2 Geriye Tarihli Karşılık");
    await debt(ctx.api, acc.id, 1000, "2026-09-20");
    const record = (await must("al", take(ctx.api, acc.id, { amount: 1000, date: "2026-10-01", reason: "lawsuit" }))).record;
    await must("karşılık", provision(ctx.api, acc.id, record.id, { amount: 1000, date: "2026-10-07" }));
    const before = await trialBalances(ctx.api);
    await collect(ctx.api, acc.id, 600, "2026-10-05");
    let gl = await trialBalances(ctx.api);
    assert.equal(gl["128"] - (before["128"] ?? 0), -600, "128: 600 tahsil edildi");
    assert.equal(gl["129"] - (before["129"] ?? 0), 600, "129: aşan 600 çözüldü (karşılık 400 = kalan 400)");
    assert.equal(gl["644"] - (before["644"] ?? 0), -600, "644: 600 konusu kalmayan karşılık");
    let view = (await listOf(ctx.api, acc.id)).records.find(row => row.id === record.id);
    assert.equal(view.remainingMinor, 40000, "kalan 400");
    assert.equal(view.provisionMinor, 40000, "karşılık 400 (≤ kalan)");
    assert.equal(view.provisionReleasedMinor, 60000, "çözülen karşılık 600");
    assert.equal((await integrityOf(ctx.api)).ok, true, "Mutabakat Testi tamam");
    await must("değersiz 400", writeOff(ctx.api, acc.id, record.id, { amount: 400, date: "2026-10-08" }));
    gl = await trialBalances(ctx.api);
    assert.equal(gl["129"] - (before["129"] ?? 0), 1000, "129: kayıt kapanınca sıfır (yetim karşılık yok)");
    assert.equal(gl["659"] ?? 0, before["659"] ?? 0, "659: zarar yok (değersiz 400 karşılıktan karşılandı)");
    assert.equal(gl["128"] - (before["128"] ?? 0), -1000, "128: kayıt kapandı");
    view = (await listOf(ctx.api, acc.id)).records.find(row => row.id === record.id);
    assert.equal(view.stateKey, "writtenOff");
    assert.equal(view.provisionMinor, 0);
    const result = await integrityOf(ctx.api);
    assert.equal(result.ok, true, `Mutabakat Testi tamam — ${JSON.stringify((result.checks || []).filter(c => !c.ok)).slice(0, 300)}`);
  });

  it("Y3: değersiz yazılmış kayda değersiz satırından önceye düşen tahsilat → kapı 409 (doubtful:records); 120, 659 ve Kasa değişmez", async () => {
    const acc = await customer(ctx.api, "Y3 Değersiz Sonra Tahsilat");
    await debt(ctx.api, acc.id, 1000, "2026-10-01");
    const record = (await must("al", take(ctx.api, acc.id, { amount: 1000, date: "2026-10-02", reason: "other" }))).record;
    await must("değersiz", writeOff(ctx.api, acc.id, record.id, { amount: 1000, date: "2026-10-06" }));
    const before = await trial(ctx.api);
    rejectedByGate(await entry(ctx.api, acc.id, { amount: 1000, date: "2026-10-04" }), "geriye tarihli tahsilat");
    const gl = await trial(ctx.api);
    for (const code of [100, 120, 128, 659]) assert.equal(gl(code), before(code), `${code} değişmedi`);
    assert.equal((await integrityOf(ctx.api)).ok, true, "Mutabakat Testi tamam");
    // Değersiz satırından SONRA aynı tahsilat yazılır (kayıt kapalı; 120'den düşer, cari alacaklı olur — kapı itiraz etmez).
    const later = await entry(ctx.api, acc.id, { amount: 100, date: "2026-10-07" });
    assert.equal(later.status, 200, `sonraki tarihli tahsilat yazılır — ${JSON.stringify(later.data).slice(0, 200)}`);
  });

  it("Y4: borç 10.000 → al 10.000 (05.10) → tahsilat 8.000 (07.10) → sil → geri yükle 200; 128 = 2.000, Mutabakat tamam", async () => {
    const acc = await customer(ctx.api, "Y4 Geri Yükle");
    await debt(ctx.api, acc.id, 10000, "2026-10-01");
    const record = (await must("al", take(ctx.api, acc.id, { amount: 10000, date: "2026-10-05", reason: "enforcement" }))).record;
    await collect(ctx.api, acc.id, 8000, "2026-10-07");
    const before = await trial(ctx.api);
    await must("sil", ctx.api.del(`${ACC}/${acc.id}/doubtful/${record.id}`));
    const item = await trashItem(ctx.api, record.id);
    assert.ok(item, "Silinenler'de");
    const res = await ctx.api.post("/api/admin/trash/restore", { id: item.id });
    assert.equal(res.status, 200, `geri yükleme — gelen ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    const gl = await trial(ctx.api);
    assert.equal(gl(128), before(128), "128 silmeden önceki gibi (kalan 2.000)");
    assert.equal(gl(120), before(120), "120 silmeden önceki gibi");
    const view = (await listOf(ctx.api, acc.id)).records.find(row => row.id === record.id);
    assert.equal(view.remainingMinor, 200000, "kalan 2.000");
    assert.equal(view.collectedMinor, 800000, "tahsil 8.000");
    assert.equal((await integrityOf(ctx.api)).ok, true, "Mutabakat Testi tamam");
  });

  it("Y4b: 120'yi eksiye düşürecek geri yükleme 409 doubtful-exceeds-balance (anlamlı metin), kayıt Silinenler'de kalır", async () => {
    const acc = await customer(ctx.api, "Y4b Geri Yüklenemez");
    await debt(ctx.api, acc.id, 10000, "2026-10-01");
    const record = (await must("al", take(ctx.api, acc.id, { amount: 10000, date: "2026-10-05", reason: "enforcement" }))).record;
    await must("sil", ctx.api.del(`${ACC}/${acc.id}/doubtful/${record.id}`));
    // Kayıt tarihinden ÖNCE tarihli tahsilat (kayıt silinmişken serbest): geri yüklenince kayda düşmez (K3) → 120 = 2.000 − 10.000.
    await collect(ctx.api, acc.id, 8000, "2026-10-03");
    const item = await trashItem(ctx.api, record.id);
    const res = await ctx.api.post("/api/admin/trash/restore", { id: item.id });
    expectStatus(res, 409, "doubtful-exceeds-balance", "geri yükleme 120'yi eksiye düşürür");
    assert.match(res.error || "", /borç bakiyesi .*2\.000,00/, "metin bakiyeyi söyler");
    assert.ok(await trashItem(ctx.api, record.id), "kayıt Silinenler'de kalır");
    assert.equal((await listOf(ctx.api, acc.id)).records.length, 0, "cari kartında kayıt yok");
    assert.equal((await integrityOf(ctx.api)).ok, true, "Mutabakat Testi tamam");
  });

  it("Y5: açık şüpheli kaydı olan müşteri tedarikçiye çevrilemez (409 account-doubtful-open); bilgi düzeltmesi (ad) serbest", async () => {
    const acc = await customer(ctx.api, "Y5 Tür Değişimi");
    await debt(ctx.api, acc.id, 2000, "2026-10-01");
    await must("al", take(ctx.api, acc.id, { amount: 1500, date: "2026-10-02", reason: "other" }));
    const res = await ctx.api.put(`${ACC}/${acc.id}`, { name: "Y5 Tür Değişimi", type: "supplier", registeredOn: "2026-09-01" });
    expectStatus(res, 409, "account-doubtful-open", "tür değişimi");
    assert.match(res.error || "", /türü değiştirilemez/);
    assert.equal((await must("cari", ctx.api.get(`${ACC}/${acc.id}`))).type, "customer", "tür müşteri kaldı");
    await must("ad düzeltme", ctx.api.put(`${ACC}/${acc.id}`, { name: "Y5 Tür Değişimi A.Ş.", type: "customer", registeredOn: "2026-09-01" }));
    assert.equal((await trial(ctx.api))(320), 0, "320'ye hiçbir şey kaymadı");
  });

  it("Y6: Kredi Kartına İade (cardRefund) tanımlı kart yokken 400 bank-account-invalid; satır yazılmaz", async () => {
    const sup = await must("tedarikçi", ctx.api.post(ACC, { name: "Y6 Tedarikçi", type: "supplier", registeredOn: "2026-09-01" }));
    const res = await entry(ctx.api, sup.id, { amount: 240, date: "2026-10-05", method: "card", cardRefund: true, note: "Fazla ödeme iadesi" });
    expectStatus(res, 400, "bank-account-invalid", "kartsız kredi kartına iade");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", sup.id).n, 0, "satır yok");
  });

  it("Y7: GET /api/workspace/doubtful — muhasebe (Şüpheli Alacak İşlemleri) 200, personel 403; yönetici 200", async () => {
    const muhasebe = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe-yargic", role: "muhasebe" }));
    const personel = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel-yargic", role: "personel" }));
    const m = await muhasebe.get("/api/workspace/doubtful?status=all");
    assert.equal(m.status, 200, `muhasebe raporu görür — ${JSON.stringify(m.data).slice(0, 200)}`);
    assert.ok(Array.isArray(m.data.rows) && m.data.rows.length >= 1, "satırlar geldi");
    expectStatus(await personel.get("/api/workspace/doubtful?status=all"), 403, undefined, "personel");
    await must("yönetici", ctx.api.get("/api/workspace/doubtful?status=all"));
  });

  it("Y8a: kayıt tarihi carinin ilk borç hareketinden önce olamaz (400 doubtful-before-debt); borcu olmayan caride de 400", async () => {
    const acc = await customer(ctx.api, "Y8a Tarih");
    expectStatus(await take(ctx.api, acc.id, { amount: 1, date: "2026-10-02", reason: "other" }), 400, "doubtful-before-debt", "borç hareketi yok");
    await debt(ctx.api, acc.id, 1000, "2026-10-01");
    const res = await take(ctx.api, acc.id, { amount: 1000, date: "2026-09-15", reason: "other" });
    expectStatus(res, 400, "doubtful-before-debt", "borçtan önceki tarih");
    assert.match(res.error || "", /01\.10\.2026/, "metin ilk borç tarihini söyler");
    await must("borç gününde", take(ctx.api, acc.id, { amount: 1000, date: "2026-10-01", reason: "other" }));
    const sept = await trialBalances(ctx.api, "?from=2026-09-01&to=2026-09-30");
    assert.ok(!(sept["120"] < 0), `Eylül mizanında 120 eksi değil: ${sept["120"]}`);
  });

  it("Y8b: çıkarılmış kayda çıkarma gününden önceye düşen tahsilat → kapı 409 (başlık ≠ çıkarılan olurdu); başlık = yevmiye kalır", async () => {
    const acc = await customer(ctx.api, "Y8b Çıkar");
    await debt(ctx.api, acc.id, 1000, "2026-10-01");
    const record = (await must("al", take(ctx.api, acc.id, { amount: 1000, date: "2026-10-02", reason: "other" }))).record;
    const rel = (await must("çıkar", release(ctx.api, acc.id, record.id, { date: "2026-10-06" }))).record;
    rejectedByGate(await entry(ctx.api, acc.id, { amount: 600, date: "2026-10-04" }), "çıkarmadan önceye düşen tahsilat");
    const view = (await listOf(ctx.api, acc.id)).records.find(row => row.id === record.id);
    const head = ctx.store.get("SELECT try_minor AS m FROM fin_events WHERE id = ?", rel.closeEventId);
    assert.equal(Number(head.m), view.releasedMinor, "çıkarma başlığı = yevmiyedeki çıkarılan (1.000)");
    assert.equal(view.releasedMinor, 100000);
    await must("çıkarmadan sonra tahsilat", entry(ctx.api, acc.id, { amount: 600, date: "2026-10-07" }));
    assert.equal((await integrityOf(ctx.api)).ok, true, "Mutabakat Testi tamam");
  });
});
