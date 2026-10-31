// 2.4.8 İş G — KULLANICI KARARI (31.10.2026 ~10:55 UTC "b"; ★ soru 1): "Sonucu Belirsiz" kalmış kişi YENİ toplu işte de elenir, neden "Sonucu Belirsiz" (Başarısızları
// Yeniden Dene'deki 08:00 "A" kuralıyla aynı eşlik: aynı tür + dönem eşliği; Son 3 Ay / Tüm Hareketler'de son 7 gün, gönderim anından); göndermek için işteki "Yine de
// Gönder" (onaylı). İleti iş dosyada duruyorsa "işteki Yine de Gönder" (11:45 "A"). Değişmeyen: işteki "Yine de Gönder"in kendisi elenmez (soru 6 A: aşılmış eski belirsiz
// deneme sonraki gönderimleri yine eler). İş dosyada yokken (geri yükleme) yeni gönderimin davranışı KULLANICIYA SORULDU (queue.mjs NEW_BATCH_LEDGER_ONLY_UNSETTLED; bugünkü hâl test/whatsapp-dk7-belirsiz-ileti-248.test.mjs).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const count = ctx => ctx.messages().filter(item => item.to === P_TEL).length;
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const anyway = (ctx, jobId) => ctx.api.post(`/api/workspace/whatsapp/jobs/${jobId}/send-anyway`, { confirm: true });

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
/** Yeni gönderim (body) Meta'ya ulaşır ama yanıtı gelmez → Sonucu Belirsiz. Dönüş: belirsiz iş. */
async function uncertainBatch(ctx, body) {
  ctx.fake.state.dropAfter = /\/messages$/;
  const o = await ok(await ctx.batch(body), "belirsiz kalacak gönderim");
  await ctx.drain();
  ctx.fake.state.dropAfter = null;
  const jobs = await ctx.jobs(o.batch.id);
  assert.deepEqual(jobs.map(job => job.state), ["uncertain"], "ön koşul: Sonucu Belirsiz");
  return jobs[0];
}
function assertUncertainOnly(res, label) {
  assert.equal(res.status, 400, `${label}: toplu iş açılmamalı (geldi ${res.status} ${JSON.stringify(res.data)})`);
  assert.equal(res.data.code, "whatsapp-nothing", `${label}: kod`);
  assert.deepEqual(res.data.summary?.skipped, { "Sonucu Belirsiz": 1 }, `${label}: neden`);
  assert.match(res.data.error, /göndermek için işteki "Yine de Gönder"i kullanın\./, `${label}: iletide onaylı yol (geldi "${res.data.error}")`);
  assert.doesNotMatch(res.data.error, /yeni gönderim başlatın/, `${label}: iş dosyada dururken yeni gönderim önerilmez (geldi "${res.data.error}")`);
}

describe("2.4.8 İş G (★ soru 1) — Sonucu Belirsiz kalmış kişi yeni toplu işte de elenir", () => {
  it("Bu Ay: önceki yeni gönderim Sonucu Belirsiz → aynı dönemde yeni gönderim (önizleme, açma, 'Yine de Gönder' seçimiyle de) P'yi 'Sonucu Belirsiz' ile eler", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      await uncertainBatch(ctx, body);
      ctx.clock.advance(HOUR);
      for (const extra of [{}, { sendAgain: true }]) {
        const pv = await ok(await ctx.api.post(URLS.preview, { ...body, ...extra }), `önizleme ${JSON.stringify(extra)}`);
        assert.deepEqual(skipOf(pv), ["Sonucu Belirsiz"], `${JSON.stringify(extra)}: yeni gönderimde P Sonucu Belirsiz ile elenir`);
        assertUncertainOnly(await ctx.batch({ ...body, ...extra }), `yeni gönderim ${JSON.stringify(extra)}`);
      }
      assert.equal(count(ctx), 1, "P'ye ikinci ileti gitmedi");
    } finally {
      await ctx.close();
    }
  });

  it("Onaylı yol açık ve aşılmış belirsiz deneme yine sayılır: işteki Yine de Gönder gider (Meta Kabul Etti); sonraki yeni gönderim 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const job = await uncertainBatch(ctx, body);
      ctx.clock.advance(HOUR);
      const sent = await ok(await anyway(ctx, job.id), "işteki Yine de Gönder");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(sent.batch.id)).map(item => item.state), ["accepted"], "Yine de Gönder kabul");
      assert.equal(count(ctx), 2, "onaylı ileti gitti");
      ctx.clock.advance(HOUR);
      // Ek soru 2/4 "a": sıra Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi; belirsizle elenen R3 uyarısına girmez.
      for (const extra of [{}, { sendAgain: true }]) {
        const pv = await ok(await ctx.api.post(URLS.preview, { ...body, ...extra }), `önizleme ${JSON.stringify(extra)}`);
        assert.deepEqual(skipOf(pv), ["Sonucu Belirsiz"], `${JSON.stringify(extra)}: soru 6 A — aşılmış eski belirsiz deneme yeni gönderimde kişiyi yine eler (R3'ten önce)`);
        assert.equal(pv.alreadySent?.count, 0, `${JSON.stringify(extra)}: belirsizle elenen R3 sayısına girmez`);
      }
    } finally {
      await ctx.close();
    }
  });

  it("Dönem eşliği: başka dönem (Geçen Ay) elenmez; Son 3 Ay'da belirsiz deneme 7 günden eskiyse elenmez, içindeyse elenir", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      await uncertainBatch(ctx, { kind: "statement", ids: [p.id], preset: "thisMonth" });
      ctx.clock.advance(HOUR);
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, { kind: "statement", ids: [p.id], preset: "lastMonth" }), "Geçen Ay")), ["gönderilecek"], "Geçen Ay başka dönem");
      const son3 = { kind: "statement", ids: [p.id], preset: "last3" };
      await uncertainBatch(ctx, son3);
      ctx.clock.advance(6 * DAY);
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, son3), "Son 3 Ay (6 gün)")), ["Sonucu Belirsiz"], "Son 3 Ay: 7 gün içinde elenir");
      ctx.clock.advance(DAY + HOUR);
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, son3), "Son 3 Ay (7 gün sonra)")), ["gönderilecek"], "Son 3 Ay: 7 günden eski belirsiz deneme elemez (gönderim anından)");
    } finally {
      await ctx.close();
    }
  });
});
