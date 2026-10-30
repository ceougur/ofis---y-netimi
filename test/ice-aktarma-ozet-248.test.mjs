// 2.4.8 I1 — lib/idempotency.mjs streamBodyHash: içe aktarmanın gövde özeti (lib/import-request.mjs) bodyHash'in AYNISI olmalı (VOLATILE kuralı, anahtar sırası,
// dizi / nesne / yaprak yazımı) — ara dizgi kurmadan. Ayrı dosyada: davranış testi (ice-aktarma-istek-kimligi-248) eski kodda (bu işlev yokken) de yüklenebilsin.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bodyHash, streamBodyHash } from "../server/lib/idempotency.mjs";

describe("2.4.8 I1 streamBodyHash = bodyHash (aynı özet, ara dizgisiz)", () => {
  it("rastgele gövdelerde (iç içe nesne, dizi, null, sayı, Türkçe metin, VOLATILE alanlar her düzeyde) iki özet aynı; VOLATILE alan özeti değiştirmez", () => {
    let seed = 248;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const leaf = () => [() => null, () => Math.round(rand() * 1e6) / 100, () => -0, () => rand() < 0.5, () => `Değer ${Math.floor(rand() * 999)} ğüşıöçİ "tırnak" \\ \n`, () => ""][Math.floor(rand() * 6)]();
    const keys = ["matrix", "roles", "requestId", "force", "similarOk", "post", "a", "B", "ç", "10", "2"];
    const value = depth => {
      const roll = rand();
      if (depth > 3 || roll < 0.4) return leaf();
      if (roll < 0.7) return Array.from({ length: Math.floor(rand() * 5) }, () => value(depth + 1));
      return Object.fromEntries(Array.from({ length: Math.floor(rand() * 5) }, () => [keys[Math.floor(rand() * keys.length)], value(depth + 1)]));
    };
    for (let i = 0; i < 400; i += 1) {
      const body = value(0);
      assert.equal(streamBodyHash(body), bodyHash(body), `gövde ${i}: ${JSON.stringify(body).slice(0, 200)}`);
    }
    const big = { matrix: Array.from({ length: 3000 }, (_, r) => Array.from({ length: 12 }, (__, c) => (c % 2 ? `Hücre ${r}-${c} ${"x".repeat(c)}` : r * c))), roles: { 0: "name" }, fileName: "büyük.xlsx" };
    assert.equal(streamBodyHash(big), bodyHash(big), "65 KB tamponu aşan büyük matris");
    assert.equal(streamBodyHash({ ...big, requestId: "abc", force: true }), streamBodyHash(big), "VOLATILE alanlar içerik sayılmaz");
    assert.notEqual(streamBodyHash({ ...big, fileName: "başka.xlsx" }), streamBodyHash(big), "içerik değişince özet değişir");
  });
});
