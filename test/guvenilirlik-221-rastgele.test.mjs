// RASTGELE SIRA testi (2.0.21 güvenilirlik, CLAUDE.md 2.0.21 madde 2) — npm test'teki kısa koşu. Ayrıntı ve değişmez
// kurallar: test/guvenilirlik/rastgele.mjs. Uzun koşu (binlerce işlem, çok tohum, büyük hacimli gerçek sürüm verisi):
//   npm run test:guvenilirlik -- --islem 3000 --tohum 7 --tohumlar 3
// Tohum sabit: aynı sıra her koşuda yeniden üretilir; hata olursa iletide tohum ve işlem günlüğü yazar.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runRandom } from "./guvenilirlik/rastgele.mjs";

describe("şirket ve yedek işlemleri rastgele sırayla: değişmez kurallar her işlemden sonra", () => {
  // Tohum 5 (önceden 1): 2.1.0'da rastgele sıraya hesaba bağlı modül havaleleri (bankModuleOther) girince tohum 1'in sırası değişti ve
  // 120 (160) işlemde "yanlış şirkete geri yükleme" hiç denenemedi (seçildiği anlarda tek şirket vardı: wrongRestores 0). Bu kısa koşunun
  // amacı geri yükleme + yanlış geri yükleme + yedeğin birlikte denenmesi; tohum 5: 9 geri yükleme, 6 yanlış geri yükleme, 10 yedek.
  test("boş kurulum, tohum 5, 120 işlem", async () => {
    const report = await runRandom({ seed: 5, operations: 120, base: "bos" });
    assert.equal(report.checks, 121);
    assert.ok(report.restores > 0 && report.wrongRestores > 0 && report.backups > 0, JSON.stringify(report.byKind));
  });
  test("gerçek v2.0.19 verisi (2.0.16 → 2.0.19 zinciri, güncel sürüme yükseltilmiş), tohum 2, 80 işlem", async () => {
    const report = await runRandom({ seed: 2, operations: 80, base: "surum-2.0.19-zincir" });
    assert.equal(report.checks, 81);
    assert.ok(report.backups > 0, JSON.stringify(report.byKind));
  });
  test("gerçek şirket sınırıyla (en fazla 2, 2.0.25), boş kurulum, tohum 3, 120 işlem: sınırda açma her zaman 409", async () => {
    const report = await runRandom({ seed: 3, operations: 120, base: "bos", maxCompanies: 2 });
    assert.equal(report.checks, 121);
    assert.ok(report.limitRefusals > 0, `sınır denendi: ${report.limitRefusals}`);
  });
});
