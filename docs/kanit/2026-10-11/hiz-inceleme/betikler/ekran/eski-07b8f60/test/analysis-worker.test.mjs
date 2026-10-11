// Analiz iş parçacığı (v2.0.2, yerel-önce): sonuç ana iş parçacığındakiyle aynıdır, ana iş parçacığı bloke olmaz,
// worker düşerse iş yine tamamlanır, close() süreci temiz bırakır.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeDataset } from "../server/lib/insight/analyze.mjs";
import { createAnalysisRunner } from "../server/lib/insight/worker.mjs";

const rows = Array.from({ length: 3000 }, (_, index) => ({
  "Dosya No": `2026/${index + 1}`,
  Müvekkil: index % 2 ? "Ali Veli" : "Ayşe Kaya",
  Telefon: `0532 ${String(100 + (index % 900)).padStart(3, "0")} 11 11`,
  Tutar: `${1000 + index},00 TL`,
  Vade: `${String((index % 28) + 1).padStart(2, "0")}.10.2026`,
  Durum: index % 3 ? "Aktif" : "Ödendi",
  __sheet: "Dosyalar",
}));
const payload = { rows, label: "Dosyalar.xlsx", tabs: ["Dosyalar"], now: new Date("2026-09-27T10:00:00Z"), sectors: [] };
const strip = result => JSON.stringify({ ...result, ms: 0 });

describe("analiz iş parçacığı", () => {
  it("worker sonucu ana iş parçacığındakiyle aynıdır ve bekleme sırasında olay döngüsü akar", async () => {
    const runner = createAnalysisRunner({ log: null });
    try {
      let ticks = 0;
      const ticker = setInterval(() => (ticks += 1), 5);
      const [viaWorker, inline] = await Promise.all([runner.run(payload), Promise.resolve(analyzeDataset(payload))]);
      clearInterval(ticker);
      assert.equal(strip(viaWorker), strip(inline));
      assert.equal(viaWorker.columns.find(item => item.column === "Vade").certainty, "kesin");
      assert.ok(ticks >= 1, `olay döngüsü bloke olmadı (${ticks} tik)`);
      const stats = runner.stats();
      assert.equal(stats.runs, 1);
      assert.equal(stats.inline, 0);
      assert.equal(stats.active, true);
    } finally {
      await runner.close();
    }
  });

  it("aynı worker art arda işleri sırayla bitirir; kapatıldıktan sonra ana iş parçacığında hesaplar", async () => {
    const runner = createAnalysisRunner({ log: null });
    const results = await Promise.all([runner.run(payload), runner.run({ ...payload, rows: rows.slice(0, 10) })]);
    assert.equal(results[0].rowCount, 3000);
    assert.equal(results[1].rowCount, 10);
    await runner.close();
    const after = await runner.run(payload);
    assert.equal(after.rowCount, 3000);
    assert.equal(runner.stats().inline, 1, "kapalı çalıştırıcı ana iş parçacığına düşer");
  });

  it("zaman aşımında worker sonlandırılır ve iş ana iş parçacığında tamamlanır", async () => {
    const warnings = [];
    const runner = createAnalysisRunner({ log: { warn: (message, error) => warnings.push(`${message}: ${error?.message}`) }, timeoutMs: 1 });
    try {
      const result = await runner.run(payload);
      assert.equal(result.rowCount, 3000);
      assert.ok(warnings.some(text => /bitmedi/.test(text)), warnings.join(" | "));
      assert.equal(runner.stats().inline, 1);
    } finally {
      await runner.close();
    }
  });

  it("devre dışıysa hiç worker açmaz", async () => {
    const runner = createAnalysisRunner({ enabled: false });
    const result = await runner.run(payload);
    assert.equal(result.rowCount, 3000);
    assert.deepEqual({ active: runner.stats().active, inline: runner.stats().inline }, { active: false, inline: 1 });
    await runner.close();
  });
});
