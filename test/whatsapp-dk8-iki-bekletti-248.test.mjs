// 2.4.8 dar kontrol 8 DÜŞÜK-4 (sunucu; dişsiz test) — aynı toplu işte iki Meta Bekletti: biri 2. denemede KABUL, öbürü İptal Et ile durdu → kabul edilen sayılır,
//   öbürü sayılmaz. Yalnız SON denemenin bırakılması sayımı kaldırır (defter sentBefore'da releases eşlemesi r.attempt = c.attempt; eşleme kaldırılınca 21/21 yeşil kalmıştı).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
// Zorla üretildi: dar kontrol 8 yoklaması p-sunucu.mjs s5.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const P_TEL = "+905334445566";
const Q_TEL = "+905335556677";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const ts = ctx => String(Math.floor(ctx.clock().getTime() / 1000));
const h131049 = (ctx, wamid, recipient = "905334445566") => ({
  id: wamid,
  status: "failed",
  timestamp: ts(ctx),
  recipient_id: recipient,
  errors: [{ code: 131049, title: "This message was not delivered to maintain healthy ecosystem engagement." }],
});

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

describe("2.4.8 dar kontrol 8 DÜŞÜK-4 (sunucu) — aynı toplu işte iki Meta Bekletti: 2. denemede kabul edilen sayılır, İptal Et ile duran sayılmaz", () => {
  it("P 2. denemede Meta Kabul Etti, Q Meta Bekletti'de beklerken İptal Et → P 'Daha Önce Gönderildi', Q 'gönderilecek'", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const qq = await ctx.account("Ceren Ak", "0533 555 66 77", 500);
      const body = { kind: "statement", ids: [p.id, qq.id], preset: "thisMonth" };
      const o = await ok(await ctx.batch(body), "O");
      await ctx.drain();
      const js = await ctx.jobs(o.batch.id);
      const pJob = js.find(job => job.phone === P_TEL);
      const qJob = js.find(job => job.phone === Q_TEL);
      ctx.clock.advance(60_000);
      assert.equal(ctx.statuses([h131049(ctx, pJob.wamid)]).applied, 1, "ön koşul: P 131049");
      ctx.clock.advance(2 * HOUR);
      assert.equal(ctx.statuses([h131049(ctx, qJob.wamid, "905335556677")]).applied, 1, "ön koşul: Q 131049");
      ctx.clock.advance(22 * HOUR + 5 * 60_000);
      await ctx.drain();
      const mid = (await ctx.jobs(o.batch.id)).map(job => `${job.phone}:${job.state}:${job.attempt}`).sort();
      assert.deepEqual(mid, [`${P_TEL}:accepted:2`, `${Q_TEL}:held:1`], "ön koşul: P 2. denemede kabul, Q hâlâ Meta Bekletti");
      await ok(await ctx.api.post(`${URLS.batches}/${o.batch.id}/cancel`, {}), "İptal Et");
      const pv = await ok(await ctx.api.post(URLS.preview, body), "önizleme");
      const byName = Object.fromEntries((pv.people || []).map(person => [person.phone || person.name, person.skip || "gönderilecek"]));
      assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi", "gönderilecek"], `P sayılır (son denemesi kabul), Q sayılmaz (son denemesi bırakıldı + iptal): ${JSON.stringify(byName)}`);
    } finally {
      await ctx.close();
    }
  });
});
