// 2.4.8 dar kontrol 6 kapsam dışı gözlem (zorla üretildi: dk6 probe p2-iki-kez-yeniden-dene) — asıl işte (M) Başarısız kalan kişi için "Başarısızları Yeniden Dene"
// iki kez basılınca, ilk yeniden deneme (R1) Sonucu Belirsiz kalmışken (Meta işledi, yanıt yok) ikinci yeniden deneme (R2) aynı kişiye SORU SORMADAN ikinci ekstreyi
// gönderiyordu (M ekranında B hâlâ Başarısız; R3 yalnız "Meta Kabul Etti ve sonrası"nı, §7a 9 yalnız bekleyen işi sayar).
// KULLANICI KARARI (31.10.2026 ~08:00 UTC "A"): "Başarısızları Yeniden Dene"de aynı kişiye aynı dönem iletisi Sonucu Belirsiz kalan kişi "Sonucu Belirsiz" nedeniyle
// ELENİR; göndermek isteyen işteki "Yine de Gönder"i ("iki kez gidebilir" onayıyla) kullanır. Neden iletide. Yeni gönderim ve Yine de Gönder DEĞİŞMEZ.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const B_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const count = ctx => ctx.messages().filter(item => item.to === B_TEL).length;
const retry = (ctx, batchId) => ctx.api.post(`${URLS.batches}/${batchId}/retry-failed`, {});
const anyway = (ctx, jobId, body = {}) => ctx.api.post(`/api/workspace/whatsapp/jobs/${jobId}/send-anyway`, body);
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
function assertUncertainSkip(res, label) {
  assert.equal(res.status, 400, `${label}: toplu iş açılmamalı (geldi ${res.status} ${JSON.stringify(res.data)})`);
  assert.equal(res.data.code, "whatsapp-nothing", `${label}: kod`);
  assert.deepEqual(res.data.summary?.skipped, { "Sonucu Belirsiz": 1 }, `${label}: neden`);
  assert.match(res.data.error, /Sonucu Belirsiz: 1/, `${label}: neden İLETİDE (geldi "${res.data.error}")`);
  assert.match(res.data.error, /Bu kişilerin önceki iletisinin sonucu belirsiz \(ileti iki kez gidebilir\); göndermek için işteki "Yine de Gönder"i kullanın\./, `${label}: ne yapılacağı iletide (geldi "${res.data.error}")`);
  // KULLANICI KARARI (31.10.2026 ~11:45 UTC "A"): iş dosyada dururken onaysız "yeni gönderim başlatın" yolu önerilmez.
  assert.doesNotMatch(res.data.error, /yeni gönderim başlatın/, `${label}: iş dosyada dururken onaysız yeni gönderim önerilmez (geldi "${res.data.error}")`);
}

/** M: B'ye ekstre (sendAgain: önce A gider, M "Yine de Gönder" ile), Meta B için kalıcı hata. Dönüş: M. */
async function mainFailed(ctx, b, { sendAgain = false, preset = "thisMonth" } = {}) {
  const body = { kind: "statement", ids: [b.id], preset };
  if (sendAgain) {
    const first = await ok(await ctx.batch(body), "ilk ekstre (A)");
    await ctx.drain();
    assert.deepEqual((await ctx.jobs(first.batch.id)).map(job => job.state), ["accepted"], "ön koşul: A kabul");
    ctx.clock.advance(24 * HOUR);
  }
  ctx.fake.state.recipientErrors[B_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
  const main = await ok(await ctx.batch({ ...body, ...(sendAgain ? { sendAgain: true } : {}) }), "asıl iş (M)");
  await ctx.drain();
  ctx.fake.state.recipientErrors = {};
  assert.deepEqual((await ctx.jobs(main.batch.id)).map(job => job.state), ["failed"], "ön koşul: M'de B Başarısız");
  return main;
}
/** İstek Meta'ya ulaşır, yanıt kaybolur → Sonucu Belirsiz. Dönüş: işin kendisi. */
async function uncertainVia(ctx, open) {
  ctx.fake.state.dropAfter = /\/messages$/;
  const created = await ok(await open(), "belirsiz kalacak iş");
  await ctx.drain();
  ctx.fake.state.dropAfter = null;
  const job = (await ctx.jobs(created.batch.id))[0];
  assert.equal(job.state, "uncertain", "ön koşul: Sonucu Belirsiz");
  return { ...job, batchIdOf: created.batch.id };
}

describe("2.4.8 dar kontrol 6 — Başarısızları Yeniden Dene Sonucu Belirsiz kalan kişiyi eler", () => {
  for (const sendAgain of [false, true]) {
    it(`İki kez Yeniden Dene (asıl iş ${sendAgain ? "'Yine de Gönder' ile" : "kararsız"}): R1 Sonucu Belirsiz → R2 'Sonucu Belirsiz' ile elenir (iletide neden); işteki Yine de Gönder onaysız 409, onayla gider`, async () => {
      const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
      try {
        const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
        const main = await mainFailed(ctx, b, { sendAgain });
        const base = sendAgain ? 1 : 0;
        ctx.clock.advance(HOUR);
        const r1 = await uncertainVia(ctx, () => retry(ctx, main.batch.id));
        assert.equal(count(ctx), base + 1, "ön koşul: R1'in iletisi Meta'ya ulaştı");
        assert.equal((await ctx.jobs(main.batch.id))[0].state, "failed", "ön koşul: M ekranında B hâlâ Başarısız (düğme görünür)");
        ctx.clock.advance(HOUR);
        assertUncertainSkip(await retry(ctx, main.batch.id), "R2 (ikinci Yeniden Dene)");
        assert.equal(count(ctx), base + 1, "R2 B'ye ikinci ileti göndermedi");
        // Göndermek isteyen: işteki "Yine de Gönder" (bugünkü belirsiz ileti kuralı DEĞİŞMEDİ).
        const noConfirm = await anyway(ctx, r1.id);
        assert.equal(noConfirm.status, 409, `onaysız Yine de Gönder: ${noConfirm.status} ${JSON.stringify(noConfirm.data)}`);
        assert.equal(noConfirm.data.code, "whatsapp-confirm-required", "iki kez gidebilir onayı istenir");
        const sent = await ok(await anyway(ctx, r1.id, { confirm: true }), "onaylı Yine de Gönder");
        await ctx.drain();
        assert.deepEqual((await ctx.jobs(sent.batch.id)).map(job => job.state), ["accepted"], "onaylı Yine de Gönder kabul");
        assert.equal(count(ctx), base + 2, "onayla gönderilen ileti gitti");
      } finally {
        await ctx.close();
      }
    });
  }

  it("Başka iş: M'den sonra yeni gönderim (O) B için Sonucu Belirsiz → M'nin Yeniden Dene'si 'Sonucu Belirsiz'; yeni gönderimin önizlemesi DEĞİŞMEDİ (B gönderilecek)", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const main = await mainFailed(ctx, b);
      ctx.clock.advance(60_000);
      const body = { kind: "statement", ids: [b.id], preset: "thisMonth" };
      await uncertainVia(ctx, () => ctx.batch(body));
      assert.equal(count(ctx), 1, "ön koşul: O'nun iletisi Meta'ya ulaştı");
      ctx.clock.advance(HOUR);
      assertUncertainSkip(await retry(ctx, main.batch.id), "M'nin Yeniden Dene'si");
      assert.equal(count(ctx), 1, "B'ye ikinci ileti gitmedi");
      const pv = await ok(await ctx.api.post(URLS.preview, body), "yeni gönderim önizlemesi");
      assert.deepEqual(skipOf(pv), ["gönderilecek"], "yeni gönderim Sonucu Belirsiz yüzünden elenmez (karar: yeni gönderim değişmez)");
    } finally {
      await ctx.close();
    }
  });

  it("Belirsiz çözülünce: kanca 'failed' (P3 teslim edilemedi) → Yeniden Dene gider; kanca 'delivered' → 'Daha Önce Gönderildi' (R3 önceliği değişmedi)", async () => {
    for (const status of ["failed", "delivered"]) {
      const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
      try {
        const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
        const main = await mainFailed(ctx, b);
        ctx.clock.advance(HOUR);
        const r1 = await uncertainVia(ctx, () => retry(ctx, main.batch.id));
        const wamid = ctx.messages().filter(item => item.to === B_TEL).at(-1).wamid;
        const ts = String(Math.floor(ctx.clock().getTime() / 1000));
        const hookStatus = { id: wamid, status, timestamp: ts, recipient_id: "905334445566", biz_opaque_callback_data: r1.id, ...(status === "failed" ? { errors: [{ code: 131026, title: "Message undeliverable" }] } : {}) };
        const hook = ctx.statuses([hookStatus], { signed: true });
        assert.equal(hook.applied, 1, `${status}: ön koşul kanca uygulandı (${JSON.stringify(hook)})`);
        assert.equal((await ctx.jobs(r1.batchIdOf))[0].state, status, `${status}: ön koşul belirsiz ileti çözüldü`);
        ctx.clock.advance(HOUR);
        const res = await retry(ctx, main.batch.id);
        if (status === "failed") {
          const again = await ok(res, "failed sonrası Yeniden Dene");
          await ctx.drain();
          assert.deepEqual((await ctx.jobs(again.batch.id)).map(job => job.state), ["accepted"], "teslim edilemeyen belirsiz ileti yeniden denemeyi engellemez");
          assert.equal(count(ctx), 2, "B'ye yeniden deneme gitti");
        } else {
          assert.equal(res.status, 400, `delivered sonrası: ${res.status} ${JSON.stringify(res.data)}`);
          assert.deepEqual(res.data.summary?.skipped, { "Daha Önce Gönderildi": 1 }, "teslim edilen R3'e sayılır");
          assert.equal(count(ctx), 1, "çift ileti yok");
        }
      } finally {
        await ctx.close();
      }
    }
  });

  it("T2-1 dönem eşliği: başka dönemin (Bu Ay) Sonucu Belirsiz iletisi Geçen Ay işinin Yeniden Dene'sini ELEMEZ", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const main = await mainFailed(ctx, b, { preset: "lastMonth" });
      ctx.clock.advance(60_000);
      await uncertainVia(ctx, () => ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" }));
      ctx.clock.advance(HOUR);
      const again = await ok(await retry(ctx, main.batch.id), "Geçen Ay işinin Yeniden Dene'si");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(again.batch.id)).map(job => job.state), ["accepted"], "farklı dönem elemez");
      assert.equal(count(ctx), 2, "B'ye Bu Ay (belirsiz) + Geçen Ay (yeniden deneme)");
    } finally {
      await ctx.close();
    }
  });
});
