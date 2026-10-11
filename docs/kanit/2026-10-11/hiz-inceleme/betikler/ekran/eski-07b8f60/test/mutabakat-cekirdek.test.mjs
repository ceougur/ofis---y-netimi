// Dört çekirdek (Kasa, Stok, Cari, Taksit) model tabanlı mutabakat testi. Program gerçek API üzerinden rastgele ama
// tekrarlanabilir işlemlerle sürülür; bağımsız model her işlemden sonra Kasa (yola göre), her cari, her ürün, her taksit
// kartı ve programın mutabakat kapısıyla (çift yönlü denge, ana defter ↔ alt defterler, cari bazında) karşılaştırılır.
// Daha uzun koşu: npm run test:mutabakat -- --islem 5000 --tohum 7
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineCents, motorNow, rng, runReconciliation } from "./mutabakat/motor.mjs";
import { roundMoney, sumMoney } from "../server/lib/money.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

describe("kuruş aritmetiği", () => {
  it("roundMoney yarım kuruşu sıfırdan uzağa yuvarlar; kayan nokta artığı taşımaz; −0 üretmez", () => {
    assert.equal(roundMoney(1.005), 1.01);
    assert.equal(roundMoney(-1.005), -1.01);
    assert.equal(roundMoney(2.675), 2.68);
    assert.equal(roundMoney(0.1 + 0.2), 0.3);
    assert.equal(roundMoney(99999999999.995), 100000000000);
    assert.ok(Object.is(roundMoney(-0.001), 0));
    assert.equal(roundMoney(1e-9), 0);
    assert.equal(roundMoney(Number.NaN), 0);
    assert.equal(sumMoney(Array(1000).fill(0.1)), 100);
  });
  it("satır tutarı (miktar × birim fiyat) programda ve bağımsız tam sayı hesabında aynı", () => {
    const R = rng(99);
    for (let i = 0; i < 20000; i++) {
      const qtyMilli = R.int(1, 250000);
      const price4 = R.int(1, 50_000_000);
      assert.equal(Math.round(roundMoney((qtyMilli / 1000) * (price4 / 10000)) * 100), lineCents(qtyMilli, price4), `${qtyMilli / 1000} × ${price4 / 10000}`);
    }
  });
});

describe("dört çekirdek mutabakatı (model tabanlı)", () => {
  for (const seed of [1, 2]) {
    it(`tohum ${seed}: 120 günlük sıralı çizelgede 300 rastgele işlem (hatalı tarih, dönem kilidi, eksiye düşürme dahil) ve 40 eşzamanlı istek; her işlemden sonra tutarlı`, async () => {
      const server = await startTestServer({ bankPickLegacy: true, now: motorNow() });
      try {
        const admin = await loginAdmin(server);
        const report = await runReconciliation({ client: admin, seed, operations: 300, burst: 40, reportEvery: 60 });
        assert.deepEqual(report.mismatches, [], JSON.stringify(report.mismatches, null, 1));
        assert.ok(report.checks >= 300);
        assert.ok(report.reportChecks >= 5, "raporlar denetlendi");
        assert.equal(report.locks.length, 2, "dönem iki kez kilitlendi");
        for (const code of ["date-missing", "date-invalid", "date-future"]) assert.ok(report.rejections[code] > 0, `${code} denendi ve reddedildi`);
        assert.ok(report.rejections["period-locked"] > 0, "kapalı döneme dokunma denendi ve reddedildi");
        assert.ok(report.rejections["due-before-start"] > 0, "işlem tarihinden önceki vade denendi ve reddedildi");
      } finally {
        await server.close();
      }
    });
  }
});
