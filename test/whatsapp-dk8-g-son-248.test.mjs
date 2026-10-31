// 2.4.8 İş G son kararları (KULLANICI KARARLARI 31.10.2026, son soru 1/2 ve 2/2, ikisi "a"):
//   1/2: işteki "Yine de Gönder" (onaylı yol) BAŞKA bir denemenin "Sonucu Belirsiz"iyle (defterdeki ya da Yine de Gönder ile aşılmış eski belirsiz) kişiyi ELEMEZ; kişide
//        bekleyen / gönderilmekte ileti varsa "Zaten Kuyrukta" yine eler (ek soru 2/4 sırası).
//   2/2: Ödeme Hatırlatma'nın Başarısızları Yeniden Dene'sinde "aynı gün" eşliği YENİDEN DENEMENİN yerel günüdür (asıl işin açıldığı gün değil); gece yarısı yerel ≠ UTC.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const count = ctx => ctx.messages().filter(item => item.to === P_TEL).length;
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const anyway = (ctx, jobId) => ctx.api.post(`/api/workspace/whatsapp/jobs/${jobId}/send-anyway`, { confirm: true });
const retry = (ctx, batchId) => ctx.api.post(`${URLS.batches}/${batchId}/retry-failed`, {});

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
/** İstek (send) Meta'ya ulaşır, yanıtı gelmez → Sonucu Belirsiz. Dönüş: { batch, job }. */
async function uncertainVia(ctx, send) {
  ctx.fake.state.dropAfter = /\/messages$/;
  const o = await ok(await send(), "belirsiz kalacak gönderim");
  await ctx.drain();
  ctx.fake.state.dropAfter = null;
  const jobs = await ctx.jobs(o.batch.id);
  assert.deepEqual(jobs.map(job => job.state), ["uncertain"], "ön koşul: Sonucu Belirsiz");
  return { batch: o.batch, job: jobs[0] };
}
/** İstek Meta'ca geçici hatayla (131056) reddedilir → iş sırada bekler ("Zaten Kuyrukta" ön koşulu). */
async function pendingVia(ctx, send) {
  ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131056, "Pair rate limit hit") };
  const o = await ok(await send(), "sırada kalacak gönderim");
  await ctx.drain();
  const jobs = await ctx.jobs(o.batch.id);
  assert.ok(["pending", "limited"].includes(jobs[0].state), `ön koşul: iş sırada (${jobs[0].state})`);
  return { batch: o.batch, job: jobs[0] };
}
const heal = ctx => (ctx.fake.state.recipientErrors = {});
async function accepted(ctx, body, label) {
  const o = await ok(await ctx.batch(body), label);
  await ctx.drain();
  assert.deepEqual((await ctx.jobs(o.batch.id)).map(job => job.state), ["accepted"], `ön koşul: ${label} kabul`);
  return o;
}
async function failed(ctx, body, label) {
  ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
  const o = await ok(await ctx.batch(body), label);
  await ctx.drain();
  heal(ctx);
  assert.deepEqual((await ctx.jobs(o.batch.id)).map(job => job.state), ["failed"], `ön koşul: ${label} Başarısız`);
  return o;
}
function assertOnly(res, reason, label) {
  assert.equal(res.status, 400, `${label}: toplu iş açılmamalı (geldi ${res.status} ${JSON.stringify(res.data)})`);
  assert.deepEqual(res.data.summary?.skipped, { [reason]: 1 }, `${label}: tek neden ${reason}`);
  assert.equal(res.data.summary?.alreadySent?.count, 0, `${label}: ${reason} ile elenen R3 sayısına girmez (geldi ${JSON.stringify(res.data.summary?.alreadySent)})`);
}

describe("2.4.8 İş G son 1/2 — işteki Yine de Gönder başka denemenin Sonucu Belirsiz'iyle elenmez; süren iş varken Zaten Kuyrukta", () => {
  /** X: yeni gönderim belirsiz; Y: X'in Yine de Gönder'i belirsiz. */
  async function twoUncertain(ctx) {
    const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
    const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
    const x = await uncertainVia(ctx, () => ctx.batch(body));
    ctx.clock.advance(HOUR);
    const y = await uncertainVia(ctx, () => anyway(ctx, x.job.id));
    ctx.clock.advance(HOUR);
    assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme")), ["Sonucu Belirsiz"], "ön koşul: yeni gönderim belirsiz denemelerle elenir");
    return { x, y };
  }

  it("iki belirsiz iş X ve Y (Y = X'in Yine de Gönder'i): X'te yeniden Yine de Gönder gider (Y'nin ve aşılmış X'in belirsizliği elemez)", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const { x } = await twoUncertain(ctx);
      const again = await ok(await anyway(ctx, x.job.id), "X'te yeniden Yine de Gönder (Y belirsizken)");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(again.batch.id)).map(job => job.state), ["accepted"], "başka denemenin belirsizliği onaylı Yine de Gönder'i elemez");
      assert.equal(count(ctx), 3, "X + Y + onaylı ileti");
    } finally {
      await ctx.close();
    }
  });

  it("iki belirsiz iş X ve Y: Y'nin Yine de Gönder'i sırada beklerken X'in Yine de Gönder'i 'Zaten Kuyrukta' (R3 sayısına girmez)", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const { x, y } = await twoUncertain(ctx);
      await pendingVia(ctx, () => anyway(ctx, y.job.id));
      ctx.clock.advance(HOUR);
      assertOnly(await anyway(ctx, x.job.id), "Zaten Kuyrukta", "süren iş varken X'in Yine de Gönder'i");
      heal(ctx);
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 İş G son 2/2 — hatırlatmanın yeniden denemesinde 'aynı gün' yeniden denemenin yerel günü", () => {
  it("asıl hatırlatma 20.12 10:00 Başarısız; 21.12 23:30 yeniden deneme belirsiz → 21.12 23:50 yeniden deneme 'Sonucu Belirsiz'; 22.12 00:10 gider", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66");
      await ok(await ctx.api.post("/api/workspace/plans", { accountId: p.id, name: "Taksit", total: "3000", count: 3, firstDue: "2026-11-15", startDate: "2026-11-03" }), "taksit kartı");
      const body = { kind: "reminder", ids: [p.id] };
      ctx.clock.set(localIso(2026, 12, 20, 10, 0));
      const main = await failed(ctx, body, "asıl hatırlatma (20.12)");
      ctx.clock.set(localIso(2026, 12, 21, 23, 30));
      await uncertainVia(ctx, () => retry(ctx, main.batch.id));
      ctx.clock.set(localIso(2026, 12, 21, 23, 50));
      const r2 = await retry(ctx, main.batch.id);
      assert.deepEqual([r2.status, r2.data.summary?.skipped], [400, { "Sonucu Belirsiz": 1 }], "belirsiz denemeyle aynı yerel gün (asıl işin günü değil) → eler");
      ctx.clock.set(localIso(2026, 12, 22, 0, 10));
      const r3 = await ok(await retry(ctx, main.batch.id), "22.12 00:10 yeniden deneme");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(r3.batch.id)).map(job => job.state), ["accepted"], "ertesi yerel gün → gider (UTC günü aynı olsa da)");
    } finally {
      await ctx.close();
    }
  });
});
