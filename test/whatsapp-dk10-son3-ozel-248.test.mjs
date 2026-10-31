// 2.4.8 İş L5 (İLKEYLE — "KİME KAÇ KEZ" ilkesi (3) "dönem eşliğinde şüphede AYNI dönem"): "Son 3 Ay" / "Tüm Hareketler" gönderiminin o günkü tarihleri özel aralığın
// tarihleriyle BİREBİR aynıysa aynı dönem — R3, Zaten Kuyrukta ve Sonucu Belirsiz elemesi, iki yönde. Seçimin 7 gün penceresi bu eşlikte de geçerli (7 günden eskiyse ayrı).
// Değişmeyen: tarihleri farklı özel aralık ayrı dönem. "Tüm Hareketler" İş Q1'den sonra KİŞİYE ÖZEL dönemiyle (ilk hareket – o gün) eşleşir:
// test/whatsapp-q1-tum-kisi-donemi-248.test.mjs (önce "başlangıç boş → özel aralıkla eşleşmez" yazıyordu).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat, çok günlü (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { removeTestDir } from "./helpers.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const son3 = p => ({ kind: "statement", ids: [p.id], preset: "last3" });
const tum = p => ({ kind: "statement", ids: [p.id], preset: "all" });
const custom = (p, from, to) => ({ kind: "statement", ids: [p.id], from, to });
// 03.11.2026'nın "Son 3 Ay"ı: 01.09.2026 – 03.11.2026.
const SON3_0311 = ["2026-09-01", "2026-11-03"];

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
const previewSkip = async (ctx, body, label) => skipOf(await ok(await ctx.api.post(URLS.preview, body), label));
async function sendWith(ctx, body, { error = null, drop = false } = {}) {
  if (error) ctx.fake.state.recipientErrors[P_TEL] = error;
  if (drop) ctx.fake.state.dropAfter = /\/messages$/;
  const o = await ok(await ctx.batch(body), "gönderim");
  await ctx.drain();
  ctx.fake.state.dropAfter = null;
  return (await ctx.jobs(o.batch.id))[0];
}
const PAIR = { status: 400, body: metaError(131056, "Pair rate limit hit") };
async function start() {
  const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
  const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
  return { ctx, p };
}

describe("2.4.8 İş L5 — Son 3 Ay / Tüm Hareketler'in o günkü tarihleri = özel aralık → aynı dönem (7 gün penceresiyle)", () => {
  it("03.11 Son 3 Ay gönderildi → 05.11 özel 01.09–03.11 'Daha Önce Gönderildi'; 11.11 (8 gün) 'gönderilecek'; tarihleri farklı özel aralık ayrı", async () => {
    const { ctx, p } = await start();
    try {
      assert.equal((await sendWith(ctx, son3(p))).state, "accepted", "ön koşul: Son 3 Ay kabul");
      ctx.clock.set(localIso(2026, 11, 5, 10));
      assert.deepEqual(await previewSkip(ctx, custom(p, ...SON3_0311), "05.11 özel = 03.11 Son 3 Ay"), ["Daha Önce Gönderildi"], "aynı tarihler → aynı dönem");
      assert.deepEqual(await previewSkip(ctx, custom(p, "2026-09-01", "2026-11-02"), "05.11 özel farklı"), ["gönderilecek"], "farklı tarihler ayrı dönem");
      ctx.clock.set(localIso(2026, 11, 11, 10));
      assert.deepEqual(await previewSkip(ctx, custom(p, ...SON3_0311), "11.11 özel"), ["gönderilecek"], "Son 3 Ay'ın 7 gün penceresi bu eşlikte de geçerli");
    } finally {
      await ctx.close();
    }
  });

  it("ters yön: 03.11 özel 01.09–03.11 gönderildi → aynı gün Son 3 Ay 'Daha Önce Gönderildi'; 05.11 Son 3 Ay (01.09–05.11) ayrı", async () => {
    const { ctx, p } = await start();
    try {
      assert.equal((await sendWith(ctx, custom(p, ...SON3_0311))).state, "accepted", "ön koşul: özel kabul");
      ctx.clock.set(localIso(2026, 11, 3, 18));
      assert.deepEqual(await previewSkip(ctx, son3(p), "03.11 Son 3 Ay"), ["Daha Önce Gönderildi"], "aynı tarihler → aynı dönem");
      ctx.clock.set(localIso(2026, 11, 5, 10));
      assert.deepEqual(await previewSkip(ctx, son3(p), "05.11 Son 3 Ay"), ["gönderilecek"], "Son 3 Ay'ın o günkü tarihleri farklı → ayrı");
      // İş Q1 (açıklama bilerek değişti; beklenen aynı): P'nin ilk hareketi 03.11 → 05.11 Tüm Hareketler'in dönemi 03.11–05.11, gönderilen özel aralıktan (01.09–03.11) farklı.
      assert.deepEqual(await previewSkip(ctx, tum(p), "05.11 Tüm Hareketler"), ["gönderilecek"], "Tüm Hareketler'in kişiye özel dönemi (03.11–05.11) bu özel aralıktan farklı → ayrı");
    } finally {
      await ctx.close();
    }
  });

  it("Zaten Kuyrukta (iki yön): 03.11 Son 3 Ay işi sırada → 05.11 özel 01.09–03.11 'Zaten Kuyrukta'; 03.11 özel işi sırada → aynı gün Son 3 Ay 'Zaten Kuyrukta'", async () => {
    const a = await start();
    try {
      await sendWith(a.ctx, son3(a.p), { error: PAIR });
      a.ctx.clock.set(localIso(2026, 11, 5, 10));
      assert.deepEqual(await previewSkip(a.ctx, custom(a.p, ...SON3_0311), "05.11 özel"), ["Zaten Kuyrukta"], "süren Son 3 Ay işi aynı tarihli özel aralığı eler");
      a.ctx.fake.state.recipientErrors = {};
    } finally {
      await a.ctx.close();
    }
    const b = await start();
    try {
      await sendWith(b.ctx, custom(b.p, ...SON3_0311), { error: PAIR });
      b.ctx.clock.set(localIso(2026, 11, 3, 18));
      assert.deepEqual(await previewSkip(b.ctx, son3(b.p), "03.11 Son 3 Ay"), ["Zaten Kuyrukta"], "süren özel iş aynı tarihli Son 3 Ay'ı eler");
      b.ctx.fake.state.recipientErrors = {};
    } finally {
      await b.ctx.close();
    }
  });

  it("Sonucu Belirsiz: 03.11 Son 3 Ay belirsiz → 05.11 özel 01.09–03.11 'Sonucu Belirsiz'; 11.11 (8 gün) elemez", async () => {
    const { ctx, p } = await start();
    try {
      assert.equal((await sendWith(ctx, son3(p), { drop: true })).state, "uncertain", "ön koşul: belirsiz");
      ctx.clock.set(localIso(2026, 11, 5, 10));
      assert.deepEqual(await previewSkip(ctx, custom(p, ...SON3_0311), "05.11 özel"), ["Sonucu Belirsiz"], "aynı tarihler → belirsiz eler");
      ctx.clock.set(localIso(2026, 11, 11, 10));
      assert.deepEqual(await previewSkip(ctx, custom(p, ...SON3_0311), "11.11 özel"), ["gönderilecek"], "7 günden eski Son 3 Ay belirsizi elemez");
    } finally {
      await ctx.close();
    }
  });

  it("taşınan veri: 03.11 Son 3 Ay kabul → defter olmadan taşındı → 05.11 özel 01.09–03.11 'Daha Önce Gönderildi'; 11.11 'gönderilecek'", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-dk10-kaynak-"));
    const copy = mkdtempSync(path.join(tmpdir(), "destekofis-dk10-tasindi-"));
    const ctx = await startWa({ dataDir, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    const fake = ctx.fake;
    let other = null;
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      assert.equal((await sendWith(ctx, son3(p))).state, "accepted", "ön koşul: kabul");
      await ctx.server.close();
      cpSync(dataDir, copy, { recursive: true });
      for (const name of readdirSync(copy)) if (name.startsWith("whatsapp-gonderim.sqlite")) removeTestDir(path.join(copy, name));
      other = await startWa({ dataDir: copy, fake, connect: false, ack: false, now: { time: localIso(2026, 11, 5, 10), fixed: true } });
      assert.deepEqual(await previewSkip(other, custom(p, ...SON3_0311), "taşınan 05.11"), ["Daha Önce Gönderildi"], "taşınan veride aynı eşlik");
      other.clock.set(localIso(2026, 11, 11, 10));
      assert.deepEqual(await previewSkip(other, custom(p, ...SON3_0311), "taşınan 11.11"), ["gönderilecek"], "taşınan veride de 7 gün penceresi");
    } finally {
      await other?.server.close();
      await fake.close();
      removeTestDir(dataDir);
      removeTestDir(copy);
    }
  });
});
