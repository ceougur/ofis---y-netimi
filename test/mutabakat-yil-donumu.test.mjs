// 2.4.8 MZ — mutabakat motorunun yıl dönümü. Program fatura sıra-tarih kuralını (kronoloji) seri + YIL içinde uygular: numara her yıl 1'den
// başlar, geçen yıl tarihli belge geçen yılın serisinden kesilir (önceden yazılı kural docs/FATURA-QA-RAPORU.md N5 "Geçen yıl: kesilir (ayrı yıl
// serisi) — kronoloji yıl içinde"; ürün tarafı test/fatura-244-numara-tarih-onay.test.mjs "3 yıl dönümü"). Motorun kronoloji anahtarı yalnız
// seriyken zaman çizelgesi 1 Ocak'ı kesen her koşu (CI mutabakat-cekirdek ve Uzun Doğrulama gerçek bugünle span 120: ~1 Ocak–30 Nisan)
// "fatura-hatasi/kronoloji: reddedilmesi gerekirken kaydedildi" ile YANLIŞ kırmızı veriyordu (ürün doğru; docs/2.4.7-IS-LISTESI.md "MOBİL ÖZET
// ÖLÇÜMÜ YAN BULGUSU").
// Ders 13: gerçek bugüne bağlı değil — sunucunun sahte saati SABİT bir Ocak günüdür (motorNow: o gün 06:00'dan akar). Çizelge (38 gün,
// 15.12.2026 → 22.01.2027) yıl sınırını iki dönem kilidinin (%35'te gün − 7 = 18.12, %70'te gün − 3 ≈ 05.01) arasına koyar: Aralık sonu tarihleri
// kilitlenmeden Ocak'ın ilk günleri denenir. Ders 20: yeşil yalnız ön koşul GERÇEKTEN oluştuğunda sayılır — motorun yıl dönümü sayaçları
// (report.yilDonumu) ve iki yılın serileri denetlenir. Kronoloji denemesi seyrek (işlemlerin ~%0,2'si); tohumlar bu çizelgede ön koşulu
// taşıyanlardan seçildi (2.4.8 MZ araması: 40 tohumda Kabul 1, Ret 4). Motorun rastgele sırası değişip ön koşul kaybolursa test kırmızıdır:
// aynı çizelgede tohumu yeniden seçin.
//   Kabul: son kâğıt belge yeni yılda, denenen tarih geçen yılda ve geçen yılın serisinde ondan geç belge YOK → program kesebilir, motor denemez;
//          eski motor burada ret bekliyordu (asıl hata; kırmızı kanıt docs/kanit/2026-10-30/248-mz-*).
//   Ret:   geçen yılın serisinde daha geç belge VAR → program yine 400 "chronology" ile reddeder (kural geçen yılın serisinde de sürer).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { motorNow, runReconciliation } from "./mutabakat/motor.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const SAAT = new Date(2027, 0, 22); // yerel 22.01.2027 06:00 (yıl dönümünden 3 hafta sonra)
const SPAN = 38;
const ISLEM = 600;

async function yilDonumuKosusu(seed) {
  const server = await startTestServer({ bankPickLegacy: true, now: motorNow(SAAT) });
  try {
    const admin = await loginAdmin(server);
    const report = await runReconciliation({ client: admin, seed, operations: ISLEM, verifyEvery: 5, reportEvery: 200, burst: 20, span: SPAN });
    // Önce uyuşmazlık: eski motor (anahtar yalnız seri) "kronoloji: reddedilmesi gerekirken kaydedildi" ile burada düşer (ders 38).
    assert.deepEqual(report.mismatches, [], JSON.stringify(report.mismatches, null, 1));
    const { from, to } = report.timeline;
    assert.ok(from < "2027-01-01" && to >= "2027-01-01", `çizelge yıl sınırını kesmeli: ${from} → ${to}`);
    // Kendi serilerimiz iki yılda da belge taşır; motor sonda her seri-yılın numarasının 1'den boşluksuz ve tarih sırasıyla uyumlu olduğunu
    // denetler ("FIS2026…", "FIS2027…" ayrı sıra).
    const seriler = Object.keys(report.invoiceSeries || {});
    const ikiYil = seriler.filter(key => key.endsWith("2026") && seriler.includes(`${key.slice(0, -4)}2027`));
    assert.ok(ikiYil.length > 0, `iki yılda da numaralanan seri olmalı: ${JSON.stringify(report.invoiceSeries)}`);
    assert.ok(report.checks >= ISLEM / 5, "doğrulama koştu");
    assert.ok(report.reportChecks >= 2, "raporlar denetlendi");
    return report;
  } finally {
    await server.close();
  }
}

describe("mutabakat motoru yıl dönümü (2.4.8 MZ; sahte saat 22.01.2027, çizelge 15.12.2026 → 22.01.2027)", () => {
  it("tohum 39: geçen yıl tarihli, geçen yılın serisinde daha geç belgesi olmayan kronoloji denemesi ret beklemez; her işlem ve iki yılın numara sırası tutarlı", async () => {
    const report = await yilDonumuKosusu(39);
    assert.ok(report.yilDonumu?.kronolojiOncekiYilKabul >= 1, `ön koşul oluşmadı (Kabul): ${JSON.stringify(report.yilDonumu)} — tohumu yeniden seçin`);
  });
  it("tohum 29: geçen yılın serisinde daha geç belge varken geçen yıl tarihli belge yine 400 chronology ile reddedilir; her işlem tutarlı", async () => {
    const report = await yilDonumuKosusu(29);
    assert.ok(report.yilDonumu?.kronolojiOncekiYilRet >= 2, `ön koşul oluşmadı (Ret): ${JSON.stringify(report.yilDonumu)} — tohumu yeniden seçin`);
    assert.ok(report.rejections.chronology >= 2, `kronoloji reddi denendi: ${JSON.stringify(report.rejections)}`);
  });
});
