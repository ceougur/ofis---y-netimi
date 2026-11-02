// 2.4.8 İş H — KULLANICI KARARI (31.10.2026 ~11:10 UTC "b"; ★ soru 4): özel aralığın tarihleri O GÜN hazır seçimin ("Geçen Ay" = önceki ayın 1'i–son günü; "Bu Ay" =
// ayın 1'i–bugün) tarihleriyle BİREBİR aynıysa aynı dönem (R3 "Daha Önce Gönderildi" + "Zaten Kuyrukta"). Tek yer lib/whatsapp/donem.mjs (anahtar kümesi).
// Değişmeyen (gerileme): aynı tarihli iki özel aralık (farklı günlerde de) aynı dönem; bir gün farklı özel aralık ayrı dönem; "Bu Ay"/"Geçen Ay" aynı takvim ayı (T2-1).
// Komşular (ders 10): R3 (defter sentBefore), Zaten Kuyrukta (queued; süren işin günü açıldığı gün), Sonucu Belirsiz elemesi (unsettled), ay sonu, yıl dönümü.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
async function start(y, m, d) {
  const ctx = await startWa({ now: { time: localIso(y, m, d, 10), fixed: true } });
  const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
  return { ctx, p };
}
const custom = (p, from, to) => ({ kind: "statement", ids: [p.id], from, to });
const preset = (p, name) => ({ kind: "statement", ids: [p.id], preset: name });
async function sent(ctx, body, label) {
  const o = await ok(await ctx.batch(body), label);
  await ctx.drain();
  assert.deepEqual((await ctx.jobs(o.batch.id)).map(job => job.state), ["accepted"], `ön koşul: ${label} kabul`);
}
const previewSkip = async (ctx, body, label) => skipOf(await ok(await ctx.api.post(URLS.preview, body), label));

describe("2.4.8 İş H (★ soru 4) — özel aralık o günün hazır seçimine birebir eşitse aynı dönem", () => {
  it("Bu Ay (03.11) gönderildi → aynı gün özel 01.11–03.11 'Daha Önce Gönderildi'; özel 01.11–02.11 ayrı dönem", async () => {
    const { ctx, p } = await start(2026, 11, 3);
    try {
      await sent(ctx, preset(p, "thisMonth"), "Bu Ay");
      ctx.clock.advance(HOUR);
      assert.deepEqual(await previewSkip(ctx, custom(p, "2026-11-01", "2026-11-03"), "özel = Bu Ay"), ["Daha Önce Gönderildi"], "özel aralık o günün Bu Ay'ına eşit → aynı dönem");
      assert.deepEqual(await previewSkip(ctx, custom(p, "2026-11-01", "2026-11-02"), "özel ≠ Bu Ay"), ["gönderilecek"], "bir gün farklı özel aralık ayrı dönem");
    } finally {
      await ctx.close();
    }
  });

  it("Geçen Ay (03.11 → Ekim) gönderildi → özel 01.10–31.10 'Daha Önce Gönderildi'; özel 01.10–30.10 ayrı dönem", async () => {
    const { ctx, p } = await start(2026, 11, 3);
    try {
      await sent(ctx, preset(p, "lastMonth"), "Geçen Ay");
      ctx.clock.advance(HOUR);
      assert.deepEqual(await previewSkip(ctx, custom(p, "2026-10-01", "2026-10-31"), "özel = Geçen Ay"), ["Daha Önce Gönderildi"], "özel aralık o günün Geçen Ay'ına eşit → aynı dönem");
      assert.deepEqual(await previewSkip(ctx, custom(p, "2026-10-01", "2026-10-30"), "özel ≠ Geçen Ay"), ["gönderilecek"], "ay sonu eksik → ayrı dönem");
    } finally {
      await ctx.close();
    }
  });

  it("Önce özel aralık: 03.11'de özel 01.11–03.11 (o gün Bu Ay) gönderildi → 05.11'de Bu Ay 'Daha Önce Gönderildi'; aynı özel aralık yine aynı dönem (gerileme)", async () => {
    const { ctx, p } = await start(2026, 11, 3);
    try {
      await sent(ctx, custom(p, "2026-11-01", "2026-11-03"), "özel (o gün Bu Ay)");
      ctx.clock.advance(2 * DAY);
      assert.deepEqual(await previewSkip(ctx, preset(p, "thisMonth"), "05.11 Bu Ay"), ["Daha Önce Gönderildi"], "özel aralık o gün Bu Ay'dı → sonraki Bu Ay aynı dönem");
      assert.deepEqual(await previewSkip(ctx, custom(p, "2026-11-01", "2026-11-03"), "05.11 aynı özel"), ["Daha Önce Gönderildi"], "aynı tarihli özel aralık (farklı gün) aynı dönem");
      assert.deepEqual(await previewSkip(ctx, custom(p, "2026-11-01", "2026-11-05"), "05.11 özel = o günün Bu Ay'ı"), ["Daha Önce Gönderildi"], "05.11'in Bu Ay'ına eşit özel → aynı takvim ayı");
    } finally {
      await ctx.close();
    }
  });

  it("Önce özel aralık, o gün hazır seçime EŞİT DEĞİL: 05.11'de özel 01.11–03.11 gönderildi → Bu Ay ayrı dönem (gönderilecek)", async () => {
    const { ctx, p } = await start(2026, 11, 5);
    try {
      await sent(ctx, custom(p, "2026-11-01", "2026-11-03"), "özel (o gün Bu Ay değil)");
      ctx.clock.advance(HOUR);
      assert.deepEqual(await previewSkip(ctx, preset(p, "thisMonth"), "Bu Ay"), ["gönderilecek"], "o gün hazır seçime eşit olmayan özel aralık Bu Ay ile aynı dönem değil");
    } finally {
      await ctx.close();
    }
  });

  it("Zaten Kuyrukta: 03.11'de açılan özel 01.11–03.11 işi sırada beklerken 04.11'de Bu Ay 'Zaten Kuyrukta' (süren işin günü açıldığı gün); Bu Ay işi beklerken özel eşit 'Zaten Kuyrukta'", async () => {
    const { ctx, p } = await start(2026, 11, 3);
    try {
      ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131056, "Pair rate limit hit") };
      await ok(await ctx.batch(custom(p, "2026-11-01", "2026-11-03")), "özel (sırada kalacak)");
      await ctx.drain();
      ctx.clock.advance(DAY);
      assert.deepEqual(await previewSkip(ctx, preset(p, "thisMonth"), "04.11 Bu Ay"), ["Zaten Kuyrukta"], "süren özel iş (açıldığı gün Bu Ay) → Bu Ay Zaten Kuyrukta");
      const q = await start(2026, 11, 3);
      try {
        q.ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131056, "Pair rate limit hit") };
        await ok(await q.ctx.batch(preset(q.p, "thisMonth")), "Bu Ay (sırada kalacak)");
        await q.ctx.drain();
        q.ctx.clock.advance(HOUR);
        assert.deepEqual(await previewSkip(q.ctx, custom(q.p, "2026-11-01", "2026-11-03"), "özel = Bu Ay"), ["Zaten Kuyrukta"], "süren Bu Ay işi → eşit özel aralık Zaten Kuyrukta");
        assert.deepEqual(await previewSkip(q.ctx, custom(q.p, "2026-11-02", "2026-11-03"), "özel ≠ Bu Ay"), ["gönderilecek"], "eşit olmayan özel aralık kuyruktaki Bu Ay ile aynı dönem değil");
      } finally {
        await q.ctx.close();
      }
    } finally {
      await ctx.close();
    }
  });

  it("Ay sonu ve yıl dönümü: 30.11'de Bu Ay = 01.11–30.11; 05.01.2027'de Geçen Ay = Aralık 2026", async () => {
    const a = await start(2026, 11, 30);
    try {
      await sent(a.ctx, preset(a.p, "thisMonth"), "30.11 Bu Ay");
      a.ctx.clock.advance(HOUR);
      assert.deepEqual(await previewSkip(a.ctx, custom(a.p, "2026-11-01", "2026-11-30"), "özel tam Kasım"), ["Daha Önce Gönderildi"], "ay sonu: tam ay özel aralık = Bu Ay");
    } finally {
      await a.ctx.close();
    }
    const b = await start(2027, 1, 5);
    try {
      await sent(b.ctx, custom(b.p, "2026-12-01", "2026-12-31"), "05.01 özel tam Aralık");
      b.ctx.clock.advance(HOUR);
      assert.deepEqual(await previewSkip(b.ctx, preset(b.p, "lastMonth"), "05.01 Geçen Ay"), ["Daha Önce Gönderildi"], "yıl dönümü: tam Aralık özel aralık = Geçen Ay (2026-12)");
    } finally {
      await b.ctx.close();
    }
  });

  it("Sonucu Belirsiz elemesi de aynı eşlikle (komşu): özel 01.11–03.11 (o gün Bu Ay) belirsiz kaldı → Bu Ay yeni gönderimde 'Sonucu Belirsiz'", async () => {
    const { ctx, p } = await start(2026, 11, 3);
    try {
      ctx.fake.state.dropAfter = /\/messages$/;
      const o = await ok(await ctx.batch(custom(p, "2026-11-01", "2026-11-03")), "özel (belirsiz kalacak)");
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      assert.deepEqual((await ctx.jobs(o.batch.id)).map(job => job.state), ["uncertain"], "ön koşul: Sonucu Belirsiz");
      ctx.clock.advance(HOUR);
      assert.deepEqual(await previewSkip(ctx, preset(p, "thisMonth"), "Bu Ay"), ["Sonucu Belirsiz"], "eşit özel aralığın belirsiz denemesi Bu Ay'da da eler");
    } finally {
      await ctx.close();
    }
  });
});
