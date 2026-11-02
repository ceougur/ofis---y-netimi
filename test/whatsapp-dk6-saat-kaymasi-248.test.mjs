// 2.4.8 dar kontrol 6 ORTA (bağımsız incelemeci, zorla üretildi: dk6 probe p1-saat-kaymasi) — R3 "Yine de Gönder" sınırı (wa_batches.send_again_after, asıl işin
// YEREL saatle açılış anı) geç kabulün zamanıyla (accepts.at) karşılaştırılıyordu; geç kabulde accepts.at Meta'nın durum bildirimi `timestamp`'ından (Meta saati) gelir.
// Meta saati yerelden gerideyse asıl işten SONRA başka işle giden ileti "önce" sayılıyor, asıl işin Başarısızları Yeniden Dene'si aynı kişiye İKİNCİ ekstreyi gönderiyordu.
// KULLANICI KARARI (31.10.2026, dar kontrol 5 "a"): asıl iş açıldıktan SONRA başka işle aynı kişiye aynı dönem giden yine "Daha Önce Gönderildi" (çift ileti yok).
// Düzeltme: sınır TALEP anıyla (claims.at, yerel saat, istekten hemen önce) karşılaştırılır (lib/whatsapp/defter.mjs sentBefore).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase } from "../server/lib/db.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const B_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const count = (ctx, phone) => ctx.messages().filter(item => item.to === phone).length;

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
/** Defterdeki kabul anı (accepts.at) — ön koşulun GERÇEKTEN oluştuğu (kabul anı asıl işin açılışından önce) okunur (ders 20). */
function acceptAt(ctx, jobId) {
  const db = openDatabase(ctx.wa.ledger.file, { readOnly: true });
  try {
    return db.prepare("SELECT at FROM accepts WHERE job_id = ?").get(String(jobId))?.at || null;
  } finally {
    db.close();
  }
}

describe("2.4.8 dar kontrol 6 — Yine de Gönder sınırı Meta saatine bağlı değil", () => {
  for (const skewMin of [2, 30]) {
    it(`Meta saati ${skewMin} dk geride: asıl işten 1 dk SONRA giden (Sonucu Belirsiz → imzalı 'delivered' kancası) ileti asıl işin yeniden denemesini 'Daha Önce Gönderildi' ile eler; B'ye toplam 2 ekstre`, async () => {
      const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
      try {
        const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
        const body = { kind: "statement", ids: [b.id], preset: "thisMonth" };
        const first = await ok(await ctx.batch(body), "ilk ekstre (A)");
        await ctx.drain();
        assert.deepEqual((await ctx.jobs(first.batch.id)).map(job => job.state), ["accepted"], "ön koşul: A kabul");
        // M: ertesi gün "Yine de Gönder" ile asıl iş; Meta B için kalıcı hata verir.
        ctx.clock.advance(24 * HOUR);
        ctx.fake.state.recipientErrors[B_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
        const main = await ok(await ctx.batch({ ...body, sendAgain: true }), "asıl iş (M, Yine de Gönder)");
        await ctx.drain();
        ctx.fake.state.recipientErrors = {};
        assert.deepEqual((await ctx.jobs(main.batch.id)).map(job => job.state), ["failed"], "ön koşul: M'de B Başarısız");
        // O: M'den 1 dk SONRA başka iş "Yine de Gönder"; istek Meta'ya ulaşır, yanıt kaybolur → Sonucu Belirsiz.
        ctx.clock.advance(60_000);
        ctx.fake.state.dropAfter = /\/messages$/;
        const other = await ok(await ctx.batch({ ...body, sendAgain: true }), "başka iş (O, Yine de Gönder)");
        await ctx.drain();
        ctx.fake.state.dropAfter = null;
        const oJob = (await ctx.jobs(other.batch.id))[0];
        assert.equal(oJob.state, "uncertain", "ön koşul: O Sonucu Belirsiz");
        assert.equal(count(ctx, B_TEL), 2, "ön koşul: B'ye A + O (iki ekstre)");
        const mRow = ctx.store.get("SELECT created_at, send_again_after FROM wa_batches WHERE id = ?", main.batch.id);
        const oRow = ctx.store.get("SELECT created_at FROM wa_batches WHERE id = ?", other.batch.id);
        assert.ok(oRow.created_at > mRow.send_again_after, `ön koşul: O, M'nin açılışından SONRA (${oRow.created_at} > ${mRow.send_again_after})`);
        // Meta'nın durum bildirimi: Meta saati yerelden skewMin dk geride → timestamp M'nin açılışından ÖNCE.
        const ts = Math.floor((Date.parse(oRow.created_at) - skewMin * 60_000) / 1000);
        const wamid = ctx.messages().filter(item => item.to === B_TEL).at(-1).wamid;
        const hook = ctx.statuses([{ id: wamid, status: "delivered", timestamp: String(ts), recipient_id: "905334445566", biz_opaque_callback_data: oJob.id }], { signed: true });
        assert.equal(hook.applied, 1, `ön koşul: imzalı kanca uygulandı (${JSON.stringify(hook)})`);
        assert.equal((await ctx.jobs(other.batch.id))[0].state, "delivered", "ön koşul: O teslim edildi (geç kabul)");
        const accepted = acceptAt(ctx, oJob.id);
        assert.ok(accepted && accepted < mRow.send_again_after, `ön koşul: defterdeki kabul anı Meta saatinden, M'nin açılışından ÖNCE (${accepted} < ${mRow.send_again_after})`);
        // M'nin Başarısızları Yeniden Dene'si: O ile B'ye bu dönem zaten gitti → elenir.
        ctx.clock.advance(HOUR);
        const res = await ctx.api.post(`${URLS.batches}/${main.batch.id}/retry-failed`, {});
        await ctx.drain();
        assert.equal(res.status, 400, `M'nin yeniden denemesi iş açmamalı (geldi ${res.status} ${JSON.stringify(res.data)})`);
        assert.equal(res.data.code, "whatsapp-nothing", "kod");
        assert.deepEqual(res.data.summary?.skipped, { "Daha Önce Gönderildi": 1 }, "neden");
        assert.match(res.data.error, /Daha Önce Gönderildi: 1/, `neden iletide (geldi "${res.data.error}")`);
        assert.equal(count(ctx, B_TEL), 2, "B'ye toplam 2 ekstre (A + O) — çift ileti yok");
      } finally {
        await ctx.close();
      }
    });
  }
});
