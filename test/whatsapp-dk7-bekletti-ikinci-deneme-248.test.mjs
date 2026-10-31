// 2.4.8 dar kontrol 7 ORTA-1 (zorla üretildi: dk7 yoklaması p-belirsiz.mjs s3-meta-bekletti-ikinci-deneme) — "Meta Bekletti" (131049) işin 24 saat sonraki 2. denemesi
// Meta'ca EŞZAMANLI reddedilince (defter outcomes 'failed'; failures satırı YOK), 1. denemeden kalan kabul satırı (accepts) yüzünden kişi "Daha Önce Gönderildi"
// sayılıyordu: hiçbir ileti teslim edilmemişken asıl işin (M, "Yine de Gönder") ve işin kendisinin (O) "Başarısızları Yeniden Dene"si ve yeni gönderim kişiyi eliyordu.
// KULLANICI KARARI P3 (teslim edilemeyen ileti "Daha Önce Gönderildi" SAYILMAZ). Komşular (ders 10): 2. deneme kabul / teslim edilirse yine sayılır (R3 değişmedi).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const count = ctx => ctx.messages().filter(item => item.to === P_TEL).length;
const retry = (ctx, batchId) => ctx.api.post(`${URLS.batches}/${batchId}/retry-failed`, {});
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

/**
 * O: P'ye ekstre kabul → (withMain) M "Yine de Gönder" ile, Meta P için kalıcı hata → O'ya kanca 131049 (Meta Bekletti) → 24 saat sonra O'nun 2. denemesi.
 * second: "rejected" (Meta eşzamanlı reddeder → Başarısız) | "accepted" (kabul) | "delivered" (kabul + teslim kancası).
 */
async function heldThenSecond(ctx, p, { withMain, second }) {
  const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
  const o = await ok(await ctx.batch(body), "O (ilk gönderim)");
  await ctx.drain();
  const oJob = (await ctx.jobs(o.batch.id))[0];
  assert.equal(oJob.state, "accepted", "ön koşul: O kabul");
  let main = null;
  if (withMain) {
    ctx.clock.advance(60_000);
    ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
    main = await ok(await ctx.batch({ ...body, sendAgain: true }), "M (Yine de Gönder)");
    await ctx.drain();
    assert.deepEqual((await ctx.jobs(main.batch.id)).map(job => job.state), ["failed"], "ön koşul: M'de P Başarısız");
    ctx.fake.state.recipientErrors = {};
  }
  ctx.clock.advance(60_000);
  const ts = String(Math.floor(ctx.clock().getTime() / 1000));
  const hook = ctx.statuses([{ id: oJob.wamid, status: "failed", timestamp: ts, recipient_id: "905334445566", errors: [{ code: 131049, title: "This message was not delivered to maintain healthy ecosystem engagement." }] }]);
  assert.equal(hook.applied, 1, `ön koşul: 131049 kancası uygulandı (${JSON.stringify(hook)})`);
  assert.equal((await ctx.jobs(o.batch.id))[0].state, "held", "ön koşul: O Meta Bekletti");
  if (second === "rejected") ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
  ctx.clock.advance(24 * HOUR + 60_000);
  await ctx.drain();
  ctx.fake.state.recipientErrors = {};
  const after = (await ctx.jobs(o.batch.id))[0];
  assert.equal(after.attempt, 2, "ön koşul: O 2. kez denendi");
  assert.equal(after.state, second === "rejected" ? "failed" : "accepted", `ön koşul: O'nun 2. denemesi ${second}`);
  if (second === "delivered") {
    const wamid = ctx.messages().filter(item => item.to === P_TEL).at(-1).wamid;
    const done = ctx.statuses([{ id: wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566" }]);
    assert.equal(done.applied, 1, `ön koşul: teslim kancası uygulandı (${JSON.stringify(done)})`);
  }
  ctx.clock.advance(HOUR);
  return { o, main, body };
}

describe("2.4.8 dar kontrol 7 ORTA-1 — Meta Bekletti işin 2. denemesi reddedilince kişi 'Daha Önce Gönderildi' sayılmaz (P3)", () => {
  it("M yolu: O kabul → M (Yine de Gönder) Başarısız → O 131049 → O'nun 2. denemesi eşzamanlı ret → M'nin Yeniden Dene'si P'ye gider; yeni gönderimde P elenmez", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const { main, body } = await heldThenSecond(ctx, p, { withMain: true, second: "rejected" });
      const before = count(ctx);
      // Önizleme salt okur: yeniden denemeden ÖNCE alınır, denetimi M'nin Yeniden Dene'sinden sonra (iki yolun kırmızısı ayrı görünsün).
      const pv = await ok(await ctx.api.post(URLS.preview, body), "yeni gönderim önizlemesi");
      const r = await retry(ctx, main.batch.id);
      assert.equal(r.status, 200, `M'nin Yeniden Dene'si açılmalı (geldi ${r.status} ${JSON.stringify(r.data)})`);
      assert.equal(r.data.data.summary.sendable, 1, "M'nin Yeniden Dene'sinde P gönderilecek");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(r.data.data.batch.id)).map(job => job.state), ["accepted"], "yeniden deneme kabul");
      assert.equal(count(ctx), before + 1, "P'ye ileti gitti");
      assert.deepEqual(skipOf(pv), ["gönderilecek"], "yeni gönderimde P elenmez (teslim edilen ileti yok)");
      assert.equal(pv.alreadySent?.count, 0, `'Daha Önce Gönderildi' sayısı 0 (geldi ${JSON.stringify(pv.alreadySent)})`);
    } finally {
      await ctx.close();
    }
  });

  it("O yolu: O kabul → O 131049 → O'nun 2. denemesi eşzamanlı ret → O'nun kendi Yeniden Dene'si P'ye gider", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const { o } = await heldThenSecond(ctx, p, { withMain: false, second: "rejected" });
      const before = count(ctx);
      const r = await retry(ctx, o.batch.id);
      assert.equal(r.status, 200, `O'nun Yeniden Dene'si açılmalı (geldi ${r.status} ${JSON.stringify(r.data)})`);
      assert.equal(r.data.data.summary.sendable, 1, "O'nun Yeniden Dene'sinde P gönderilecek");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(r.data.data.batch.id)).map(job => job.state), ["accepted"], "yeniden deneme kabul");
      assert.equal(count(ctx), before + 1, "P'ye ileti gitti");
    } finally {
      await ctx.close();
    }
  });

  for (const second of ["accepted", "delivered"]) {
    it(`Komşu (ders 10): O'nun 2. denemesi ${second === "accepted" ? "kabul" : "kabul + teslim"} → yeni gönderimde P 'Daha Önce Gönderildi' (R3 değişmedi)`, async () => {
      const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
      try {
        const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
        const { body } = await heldThenSecond(ctx, p, { withMain: false, second });
        const pv = await ok(await ctx.api.post(URLS.preview, body), "yeni gönderim önizlemesi");
        assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi"], "P 'Daha Önce Gönderildi'");
        assert.equal(pv.alreadySent?.count, 1, "alreadySent 1");
      } finally {
        await ctx.close();
      }
    });
  }
});
