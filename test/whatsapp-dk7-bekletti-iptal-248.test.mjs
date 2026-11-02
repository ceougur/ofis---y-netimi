// 2.4.8 İş 5 — KULLANICI KARARI (31.10.2026 ~10:10 UTC "a"; zorla üretildi: dk7 yoklaması p-bekletti-iptal.mjs): "Meta Bekletti" (131049; Meta teslim ETMEDİ) iş
// İptal Et ile durdurulunca sonraki gönderimde kişi "Daha Önce Gönderildi" SAYILMAZ (P3 ile aynı mantık: teslim yok, bir daha denenmeyecek). Geç "delivered" / "read"
// gelirse yine SAYILIR (P3'ün geç teslim kuralı). Değişmeyenler: iş Meta Bekletti'de beklerken yeni gönderim "Zaten Kuyrukta" ile elenir; iptal edilmemiş Meta Bekletti
// (toplu iş açık) R3'te sayılmaya devam eder.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const P_TEL = "+905334445566";
const Q_TEL = "+905335556677";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const count = ctx => ctx.messages().filter(item => item.to === P_TEL).length;
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const ts = ctx => String(Math.floor(ctx.clock().getTime() / 1000));

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

/**
 * O: P'ye ekstre kabul → kanca 131049 → O'da P Meta Bekletti. open = true: O'da ikinci kişi (Q) geçici hatayla (131056) sırada kalır → toplu iş "Sürüyor" (yeniden
 * açılmadan); false: tek kişi → toplu iş "Tamamlandı" olmuştu, 131049 onu yeniden açar.
 */
async function heldJob(ctx, { open }) {
  const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
  const ids = [p.id];
  if (open) {
    const q = await ctx.account("Ceren Ak", "0533 555 66 77", 500);
    ids.push(q.id);
    ctx.fake.state.recipientErrors[Q_TEL] = { status: 400, body: metaError(131056, "Pair rate limit hit") };
  }
  const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
  const o = await ok(await ctx.batch({ ...body, ids }), "O");
  await ctx.drain();
  const pJob = (await ctx.jobs(o.batch.id)).find(job => job.phone === P_TEL || job.accountId === p.id);
  assert.equal(pJob.state, "accepted", "ön koşul: O'da P kabul");
  if (open) assert.equal((await ctx.detail(o.batch.id)).batch?.state ?? (await ctx.detail(o.batch.id)).state, "running", "ön koşul: O Sürüyor (Q sırada)");
  ctx.clock.advance(60_000);
  const hook = ctx.statuses([{ id: pJob.wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131049, title: "This message was not delivered to maintain healthy ecosystem engagement." }] }]);
  assert.equal(hook.applied, 1, `ön koşul: 131049 kancası uygulandı (${JSON.stringify(hook)})`);
  assert.equal((await ctx.jobs(o.batch.id)).find(job => job.id === pJob.id).state, "held", "ön koşul: P Meta Bekletti");
  return { o, pJob, body };
}
async function cancel(ctx, batchId) {
  await ok(await ctx.api.post(`${URLS.batches}/${batchId}/cancel`, {}), "İptal Et");
  assert.equal((await ctx.jobs(batchId)).find(job => job.phone === P_TEL || job.state === "canceled").state, "canceled", "ön koşul: P İptal");
}

describe("2.4.8 İş 5 — Meta Bekletti iş iptal edilince kişi 'Daha Önce Gönderildi' sayılmaz; geç teslimde sayılır", () => {
  for (const open of [false, true]) {
    it(`${open ? "Sürüyor (yeniden açılmamış)" : "Tamamlandı → 131049 ile yeniden açılmış"} toplu iş: Meta Bekletti → İptal Et → yeni gönderimde P gönderilecek ve gider`, async () => {
      const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
      try {
        const { o, body } = await heldJob(ctx, { open });
        ctx.fake.state.recipientErrors = {};
        await cancel(ctx, o.batch.id);
        ctx.clock.advance(60_000);
        const pv = await ok(await ctx.api.post(URLS.preview, body), "yeni gönderim önizlemesi");
        assert.deepEqual(skipOf(pv), ["gönderilecek"], "iptal edilen Meta Bekletti teslim edilmedi → P 'Daha Önce Gönderildi' DEĞİL");
        assert.equal(pv.alreadySent?.count, 0, `alreadySent 0 (geldi ${JSON.stringify(pv.alreadySent)})`);
        const before = count(ctx);
        const fresh = await ok(await ctx.batch(body), "yeni gönderim");
        await ctx.drain();
        assert.deepEqual((await ctx.jobs(fresh.batch.id)).map(job => job.state), ["accepted"], "yeni gönderim kabul");
        assert.equal(count(ctx), before + 1, "P'ye ileti gitti");
      } finally {
        await ctx.close();
      }
    });
  }

  it("İptalden sonra geç 'delivered' (1. denemenin wamid'i) → P 'Daha Önce Gönderildi' (geç teslim sayılır)", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const { o, pJob, body } = await heldJob(ctx, { open: false });
      await cancel(ctx, o.batch.id);
      ctx.clock.advance(60_000);
      const late = ctx.statuses([{ id: pJob.wamid, status: "delivered", timestamp: ts(ctx), recipient_id: "905334445566" }]);
      assert.equal(late.applied, 1, `ön koşul: geç teslim kancası uygulandı (${JSON.stringify(late)})`);
      const pv = await ok(await ctx.api.post(URLS.preview, body), "yeni gönderim önizlemesi");
      assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi"], "geç teslim → P sayılır");
      assert.equal(pv.alreadySent?.count, 1, "alreadySent 1");
    } finally {
      await ctx.close();
    }
  });

  it("Değişmeyen: Meta Bekletti beklerken (iptal yok) yeni gönderimde P 'Zaten Kuyrukta'; Yine de Gönder'de de", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const { body } = await heldJob(ctx, { open: false });
      for (const extra of [{}, { sendAgain: true }]) {
        const pv = await ok(await ctx.api.post(URLS.preview, { ...body, ...extra }), `önizleme ${JSON.stringify(extra)}`);
        assert.deepEqual(skipOf(pv), ["Zaten Kuyrukta"], `${JSON.stringify(extra)}: P Zaten Kuyrukta`);
      }
    } finally {
      await ctx.close();
    }
  });
});
