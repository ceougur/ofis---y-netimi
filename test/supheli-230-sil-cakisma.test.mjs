// Şüpheli kaydı silme çakışması (15.10.2026; Uzun Doğrulama #199 tohum 10 işlem 3482 supheli-sil): silinen kaydın tahsilatları öbür kayda kayınca
// daha önce ÇIKARILMIŞ bir kaydın "Şüpheliden Çıkar" başlığı (yevmiyedeki çıkarılan tutar) artık tutmaz — kapı doubtful:records close-amount
// yazımı geri alıyordu ama kullanıcıya genel "ledger-integrity … yöneticinize bildirin" dönüyordu. Beklenen: silme AÇIK 409 doubtful-delete-conflict
// (kapı örneği metinde), hiçbir şey yazılmaz; öbür kayıtlar ve Mutabakat Testi değişmez. Aynı kural Değersiz Alacak satırı silmede (removeWriteOff).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";
import { ACC, collect, customer, debt, listOf, release, take } from "./banka-230-supheli-ortak.mjs";

describe("şüpheli kaydı silme: başka kaydın çıkarma başlığını bozacaksa açık 409 doubtful-delete-conflict", () => {
  let ctx;
  let api;
  let acc;
  let a;
  let b;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    acc = await customer(api, "Silme Çakışma Müşterisi");
    await debt(api, acc.id, 1500, "2026-09-10");
    a = (await must("al A", take(api, acc.id, { amount: 1000, date: "2026-10-01", reason: "lawsuit", note: "A" }))).record;
    b = (await must("al B", take(api, acc.id, { amount: 500, date: "2026-10-02", reason: "enforcement", note: "B" }))).record;
    await collect(api, acc.id, 1000, "2026-10-03"); // önce en eski kayıt A'dan düşer; B'nin kalanı 500
    await must("çıkar B", release(api, acc.id, b.id, { date: "2026-10-05", note: "Çıkar" })); // çıkarma başlığı 500
  });
  after(() => ctx?.server.close());

  it("A silinince tahsilat B'ye kayar, B'nin çıkarma başlığı (500) tutmaz → 409 doubtful-delete-conflict; hiçbir şey yazılmaz", async () => {
    const before = await listOf(api, acc.id);
    const res = await api.del(`${ACC}/${acc.id}/doubtful/${a.id}`);
    assert.equal(res.status, 409, JSON.stringify(res.data).slice(0, 400));
    assert.equal(res.data.code, "doubtful-delete-conflict", JSON.stringify(res.data).slice(0, 400));
    // K5 (16.10.2026): ileti kapının iç örneği değil — ham kayıt kimliği yok, kayıt tarih + tutarla, para "TL", ne yapılacağı yazılı.
    assert.match(res.data.error, /02\.10\.2026 tarihli 500,00 TL şüpheli kaydının Şüpheliden Çıkar tutarı değişirdi/, res.data.error);
    assert.match(res.data.error, /Önce o kaydı silin, sonra yeniden deneyin\./, res.data.error);
    assert.doesNotMatch(res.data.error, new RegExp(`${a.id}|${b.id}`), "ham kayıt kimliği yok");
    assert.doesNotMatch(res.data.error, /₺|başlığı \d|yevmiyedeki/, "kapı jargonu ve ₺ yok");
    assert.ok(res.data.problems?.length >= 1, "kapı örneği destek için problems alanında");
    assert.doesNotMatch(res.data.error, /yöneticinize bildirin/, "genel kapı metni değil");
    const after_ = await listOf(api, acc.id);
    assert.deepEqual(after_.records.map(r => [r.id, r.status, r.remainingMinor]), before.records.map(r => [r.id, r.status, r.remainingMinor]), "kayıtlar değişmedi");
    await integrityOk(api, "reddedilen silme sonrası");
  });

  it("çakışma yoksa silme çalışır: B (çıkarılmış) silinir; A'nın durumu değişmez", async () => {
    const res = await api.del(`${ACC}/${acc.id}/doubtful/${b.id}`);
    assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 400));
    const list = await listOf(api, acc.id);
    assert.deepEqual(list.records.map(r => [r.id, r.remainingMinor]), [[a.id, 0]], "yalnız A kaldı, kalanı 0");
    await integrityOk(api, "silme sonrası");
  });
});
