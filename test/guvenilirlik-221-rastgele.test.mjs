// RASTGELE SIRA testi (2.0.21 güvenilirlik, CLAUDE.md 2.0.21 madde 2) — npm test'teki kısa koşu. Ayrıntı ve değişmez
// kurallar: test/guvenilirlik/rastgele.mjs. Uzun koşu (binlerce işlem, çok tohum, büyük hacimli gerçek sürüm verisi):
//   npm run test:guvenilirlik -- --islem 3000 --tohum 7 --tohumlar 3
// Tohum sabit: aynı sıra her koşuda yeniden üretilir; hata olursa iletide tohum ve işlem günlüğü yazar.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runRandom } from "./guvenilirlik/rastgele.mjs";

describe("şirket ve yedek işlemleri rastgele sırayla: değişmez kurallar her işlemden sonra", () => {
  test("boş kurulum, tohum 1, 120 işlem", async () => {
    const report = await runRandom({ seed: 1, operations: 120, base: "bos" });
    assert.equal(report.checks, 121);
    assert.ok(report.restores > 0 && report.wrongRestores > 0 && report.backups > 0, JSON.stringify(report.byKind));
  });
  test("gerçek v2.0.19 verisi (2.0.16 → 2.0.19 zinciri, güncel sürüme yükseltilmiş), tohum 2, 80 işlem", async () => {
    const report = await runRandom({ seed: 2, operations: 80, base: "surum-2.0.19-zincir" });
    assert.equal(report.checks, 81);
    assert.ok(report.backups > 0, JSON.stringify(report.byKind));
  });
});
