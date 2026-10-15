// 2.3.0 bitiş turu — eleştirmen bulguları (15.10.2026; yeniden üretilip test edildi):
//  E1 Şüpheli Alacaklar raporu "Açık" durumunda TARİH İTİBARIYLA liste: dönem başlangıcı kayıt tarihini süzmez (geçen yıl açılmış, hâlâ açık kayıt
//     "Bu Yıl · Açık"ta görünür; TOPLAM Kalan = 128 mizanı). "Kapanan/Tümü"nde dönem kayıt tarihine kalır.
//  E2 Kayıt tarihinden ÖNCE tarihli (geriye tarihli) tahsilat şüpheliden düşmez (K3: alacak satırı kayıttan sonra geldiyse) → carinin 120'si eksiye
//     düşerdi; yazım KAPIDA reddedilir (doubtful:balance; önceden yazılıyor ve kapı "tamam" diyordu). Sayılar plandan: borç 10.000 (01.10) → al 4.000
//     (05.10) → tahsilat 8.000 (03.10) → 120 = −2.000, 128 = 4.000 → sapma.
//  E6 Silinenler'den not/telefon/haciz geri yüklemek de Kayıt Düzeltme (records.edit) ister (silmeyle simetrik).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOf, must } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";
import { collect, customer, debt, take, trial } from "./banka-230-supheli-ortak.mjs";

describe("2.3.0 eleştirmen bulguları — Şüpheli Alacaklar", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());

  it("E1: geçen yıl açılmış açık kayıt 'Bu Yıl · Açık' raporunda görünür; TOPLAM Kalan = 128", async () => {
    const acc = await customer(ctx.api, "Eski Şüpheli", "2025-06-01");
    await debt(ctx.api, acc.id, 9000, "2025-12-01");
    await must("2025 kaydı", take(ctx.api, acc.id, { amount: 5000, date: "2025-12-15", reason: "lawsuit", note: "eski" }));
    await must("2026 kaydı", take(ctx.api, acc.id, { amount: 4000, date: "2026-10-05", reason: "lawsuit", note: "yeni" }));
    const open = await must("rapor açık", ctx.api.get("/api/workspace/doubtful?from=2026-01-01&to=2026-12-31&status=open"));
    assert.equal(open.rows.length, 2, `açık kayıtlar tarih itibarıyla — gelen ${JSON.stringify(open.rows.map(r => [r.note, r.remainingMinor]))}`);
    assert.equal(open.totals.remainingMinor, 900000, "TOPLAM Kalan = 128");
    assert.equal((await trial(ctx.api))(128), 9000, "128 mizanı");
    const all = await must("rapor tümü", ctx.api.get("/api/workspace/doubtful?from=2026-01-01&to=2026-12-31&status=all"));
    assert.equal(all.rows.length, 1, "Tümü: dönem kayıt tarihine göre (yalnız 2026 kaydı)");
  });

  it("E2: kayıt tarihinden önce tarihli tahsilat 120'yi eksiye düşürecekse KAPI reddeder (doubtful:balance); sayılar değişmez", async () => {
    const acc = await customer(ctx.api, "Geriye Tarihli");
    await debt(ctx.api, acc.id, 10000, "2026-10-01");
    await must("al 4.000", take(ctx.api, acc.id, { amount: 4000, date: "2026-10-05", reason: "lawsuit", note: "dava" }));
    const before = await trial(ctx.api); // mizan şirket geneli (E1'in kayıtları da var): farklar okunur
    const res = await ctx.api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 8000, date: "2026-10-03", method: "cash" });
    assert.equal(res.status, 409, `geriye tarihli 8.000 tahsilat reddedilir — gelen ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    assert.match(JSON.stringify(res.data), /doubtful:balance/, "neden: carinin normal alacağı eksiye düşerdi");
    const gl = await trial(ctx.api);
    assert.equal(gl(128), before(128), "128 değişmedi");
    assert.equal(gl(120), before(120), "120 değişmedi (tahsilat yazılmadı)");
    assert.equal(gl(100), before(100), "Kasa'ya para girmedi");
    const result = await integrityOf(ctx.api);
    assert.equal(result.ok, true, "Mutabakat Testi tamam (yazım reddedildiği için)");
    assert.ok((result.checks || []).some(item => item.code === "doubtful:balance" && item.ok), "doubtful:balance denetimi listede ve yeşil");
    // Kayıt tarihinden SONRA aynı tahsilat şüpheliden düşer (K3).
    await collect(ctx.api, acc.id, 8000, "2026-10-07");
    const after = await trial(ctx.api);
    assert.equal(after(128), before(128) - 4000, "128: 4.000 tahsil edildi");
    assert.equal(after(120), before(120) - 4000, "120: kalan 4.000 normal alacaktan düştü");
  });
});
