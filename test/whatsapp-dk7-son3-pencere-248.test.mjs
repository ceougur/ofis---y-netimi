// 2.4.8 dar kontrol 7 DÜŞÜK-2 (dişsiz test): "Başarısızları Yeniden Dene"nin Sonucu Belirsiz elemesindeki 7 günlük pencere (defter unsettled `c.at >= ?`, T2-1: "Son 3 Ay" /
// "Tüm Hareketler" yalnız son 7 günde gönderilmişse aynı dönem) testsizdi — mutasyon `(c.at >= ? OR 1)` 24/24 yeşil kalmıştı. Bu dosya: R1 Sonucu Belirsiz kaldıktan
// 6 gün sonra Yeniden Dene "Sonucu Belirsiz" ile elenir, 8 gün sonra gider. Kod değişmedi; dişi mutasyonla gösterilir (eski kodda da yeşil — beklenen).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const DAY = 86_400_000;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const count = ctx => ctx.messages().filter(item => item.to === P_TEL).length;
const retry = (ctx, batchId) => ctx.api.post(`${URLS.batches}/${batchId}/retry-failed`, {});

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

describe("2.4.8 dar kontrol 7 DÜŞÜK-2 — Sonucu Belirsiz elemesinin 7 günlük penceresi (Son 3 Ay / Tüm Hareketler)", () => {
  for (const preset of ["last3", "all"]) {
    it(`${preset === "last3" ? "Son 3 Ay" : "Tüm Hareketler"}: R1 Sonucu Belirsiz → 6. gün Yeniden Dene 'Sonucu Belirsiz' ile elenir → 8. gün gider`, async () => {
      const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
      try {
        const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
        ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
        const main = await ok(await ctx.batch({ kind: "statement", ids: [p.id], preset }), "asıl iş (M)");
        await ctx.drain();
        ctx.fake.state.recipientErrors = {};
        assert.deepEqual((await ctx.jobs(main.batch.id)).map(job => job.state), ["failed"], "ön koşul: M'de P Başarısız");
        ctx.fake.state.dropAfter = /\/messages$/;
        const r1 = await ok(await retry(ctx, main.batch.id), "R1");
        await ctx.drain();
        ctx.fake.state.dropAfter = null;
        assert.deepEqual((await ctx.jobs(r1.batch.id)).map(job => job.state), ["uncertain"], "ön koşul: R1 Sonucu Belirsiz");
        assert.equal(count(ctx), 1, "ön koşul: R1'in iletisi Meta'ya ulaştı");
        ctx.clock.advance(6 * DAY);
        const six = await retry(ctx, main.batch.id);
        assert.equal(six.status, 400, `6. gün: elenmeli (geldi ${six.status} ${JSON.stringify(six.data)})`);
        assert.deepEqual(six.data.summary?.skipped, { "Sonucu Belirsiz": 1 }, "6. gün: neden Sonucu Belirsiz (pencere içinde aynı dönem)");
        assert.equal(count(ctx), 1, "6. gün: ikinci ileti gitmedi");
        ctx.clock.advance(2 * DAY);
        const eight = await retry(ctx, main.batch.id);
        assert.equal(eight.status, 200, `8. gün: pencere dışı, gitmeli (geldi ${eight.status} ${JSON.stringify(eight.data)})`);
        assert.equal(eight.data.data.summary.sendable, 1, "8. gün: P gönderilecek");
        await ctx.drain();
        assert.deepEqual((await ctx.jobs(eight.data.data.batch.id)).map(job => job.state), ["accepted"], "8. gün: yeniden deneme kabul");
        assert.equal(count(ctx), 2, "8. gün: ileti gitti");
      } finally {
        await ctx.close();
      }
    });
  }
});
