// 2.4.8 dar kontrol 9 — İş J (yeniden denemede "o gün") ve İş L ("KİME KAÇ KEZ" genel ilkesi S1a, S2, S3, S4). KULLANICI KARARLARI (31.10.2026):
//   J  (dk9 soru 1/7 "a"): Başarısızları Yeniden Dene / işteki Yine de Gönder'in açtığı işte özel aralığın "o gün"ü ASIL işin açıldığı gündür.
//   L1 (S1a): hazır seçimle (Bu Ay / Geçen Ay) yapılan gönderimin o günkü tarihleri de kümeye girer → aynı tarihli özel aralık sonraki bir günde de aynı dönem.
//   L2 (S2): taşınan veride şirket dosyasında Sonucu Belirsiz duran iş yeni toplu işte ve Başarısızları Yeniden Dene'de eler; işteki Yine de Gönder çalışır; ileti onaylı yol.
//   L3 (S3): Şirket Verisini Sıfırla ile duran, teslim edilmemiş Meta Bekletti "Daha Önce Gönderildi" sayılmaz; geç teslim gelirse sayılır.
//   L4 (S4): Meta Bekletti sonrası 2. deneme Sonucu Belirsiz kalınca kişi "Sonucu Belirsiz" ile elenir (deneme bazında); onaylı yol çalışır, ileti onaysız yolu önermez;
//        1. denemenin geç teslimi gelirse "Daha Önce Gönderildi" (kesin aldı).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat, çok günlü ve gece yarısı (yerel ≠ UTC günü; ders 13, 22); dosya TZ=UTC ve
// TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD, removeTestDir } from "./helpers.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const count = ctx => ctx.messages().filter(item => item.to === P_TEL).length;
const ts = ctx => String(Math.floor(ctx.clock().getTime() / 1000));
const anyway = (ctx, jobId) => ctx.api.post(`/api/workspace/whatsapp/jobs/${jobId}/send-anyway`, { confirm: true });
const retry = (ctx, batchId) => ctx.api.post(`${URLS.batches}/${batchId}/retry-failed`, {});
const thisMonth = p => ({ kind: "statement", ids: [p.id], preset: "thisMonth" });
const custom = (p, from, to) => ({ kind: "statement", ids: [p.id], from, to });

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
const previewSkip = async (ctx, body, label) => skipOf(await ok(await ctx.api.post(URLS.preview, body), label));
async function sendWith(ctx, send, { error = null, drop = false } = {}) {
  if (error) ctx.fake.state.recipientErrors[P_TEL] = error;
  if (drop) ctx.fake.state.dropAfter = /\/messages$/;
  const o = await ok(await send(), "gönderim");
  await ctx.drain();
  ctx.fake.state.recipientErrors = {};
  ctx.fake.state.dropAfter = null;
  const jobs = await ctx.jobs(o.batch.id);
  return { batch: o.batch, job: jobs[0] };
}
const FAIL = { status: 400, body: metaError(131026, "Message undeliverable") };
const PAIR = { status: 400, body: metaError(131056, "Pair rate limit hit") };
function assertUncertainOnly(res, label) {
  assert.equal(res.status, 400, `${label}: toplu iş açılmamalı (geldi ${res.status} ${JSON.stringify(res.data)})`);
  assert.deepEqual(res.data.summary?.skipped, { "Sonucu Belirsiz": 1 }, `${label}: neden`);
  assert.match(res.data.error, /göndermek için işteki "Yine de Gönder"i kullanın\./, `${label}: onaylı yol (geldi "${res.data.error}")`);
  assert.doesNotMatch(res.data.error, /yeni gönderim başlatın/, `${label}: onaysız yol önerilmez`);
}

describe("2.4.8 İş J (dk9 soru 1/7) — yeniden denemede özel aralığın 'o gün'ü asıl işin günü", () => {
  it("03.11 23:30 asıl iş özel 01.11–03.11, P Başarısız → 04.11 P'ye 'Bu Ay' gitti → 05.11 00:30 asıl işin Yeniden Dene'si P'yi 'Daha Önce Gönderildi' ile eler", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 23, 30), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const main = await sendWith(ctx, () => ctx.batch(custom(p, "2026-11-01", "2026-11-03")), { error: FAIL });
      assert.equal(main.job.state, "failed", "ön koşul: asıl işte Başarısız");
      ctx.clock.set(localIso(2026, 11, 4, 12, 0));
      const other = await sendWith(ctx, () => ctx.batch(thisMonth(p)));
      assert.equal(other.job.state, "accepted", "ön koşul: 04.11 Bu Ay gitti");
      ctx.clock.set(localIso(2026, 11, 5, 0, 30));
      const before = count(ctx);
      const res = await retry(ctx, main.batch.id);
      assert.deepEqual([res.status, res.data.summary?.skipped], [400, { "Daha Önce Gönderildi": 1 }], `asıl işin günü (03.11 = Bu Ay) → aynı dönem (geldi ${res.status} ${JSON.stringify(res.data.summary?.skipped)})`);
      await ctx.drain();
      assert.equal(count(ctx), before, "ikinci ekstre gitmedi");
    } finally {
      await ctx.close();
    }
  });

  it("Yine de Gönder: 03.11 23:30 özel 01.11–03.11 belirsiz → 05.11 00:30 işteki Yine de Gönder kabul → belirsiz çözülünce 10.11 'Bu Ay' 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 23, 30), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const u = await sendWith(ctx, () => ctx.batch(custom(p, "2026-11-01", "2026-11-03")), { drop: true });
      assert.equal(u.job.state, "uncertain", "ön koşul: belirsiz");
      ctx.clock.set(localIso(2026, 11, 5, 0, 30));
      const sent = await sendWith(ctx, () => anyway(ctx, u.job.id));
      assert.equal(sent.job.state, "accepted", "ön koşul: Yine de Gönder kabul");
      const wamid = ctx.messages().filter(item => item.to === P_TEL)[0].wamid;
      const hook = ctx.statuses([{ id: wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", biz_opaque_callback_data: u.job.id, errors: [{ code: 131026, title: "x" }] }], { signed: true });
      assert.equal(hook.applied, 1, "ön koşul: belirsiz iş çözüldü (teslim edilemedi)");
      ctx.clock.set(localIso(2026, 11, 10, 10, 0));
      assert.deepEqual(await previewSkip(ctx, thisMonth(p), "10.11 Bu Ay"), ["Daha Önce Gönderildi"], "Yine de Gönder'in işi asıl işin gününü (03.11) taşır");
      assert.equal(ctx.store.get("SELECT key_day FROM wa_batches WHERE id = ?", sent.batch.id)?.key_day, "2026-11-03", "kayıt: key_day asıl işin günü (davranış denetimlerinden sonra — eski kodda sütun yok, ders 38)");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 İş L1 (S1a) — hazır seçimin o günkü tarihleri de dönem kümesinde", () => {
  it("03.11 'Bu Ay' gönderildi → 05.11 özel 01.11–03.11 'Daha Önce Gönderildi'; 03.11 Bu Ay işi beklerken 05.11 özel 01.11–03.11 'Zaten Kuyrukta'", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const q = await ctx.account("Ceren Ak", "0533 555 66 77", 500);
      await sendWith(ctx, () => ctx.batch(thisMonth(p)));
      ctx.fake.state.recipientErrors["+905335556677"] = PAIR;
      await ok(await ctx.batch(thisMonth(q)), "Q Bu Ay (sırada kalacak)");
      await ctx.drain();
      ctx.clock.set(localIso(2026, 11, 5, 0, 30));
      assert.deepEqual(await previewSkip(ctx, custom(p, "2026-11-01", "2026-11-03"), "P 05.11 özel"), ["Daha Önce Gönderildi"], "03.11 Bu Ay'ın tarihleri = özel aralık → aynı dönem");
      assert.deepEqual(await previewSkip(ctx, custom(q, "2026-11-01", "2026-11-03"), "Q 05.11 özel"), ["Zaten Kuyrukta"], "bekleyen Bu Ay işi aynı tarihli özel aralığı eler");
      assert.deepEqual(await previewSkip(ctx, custom(p, "2026-11-01", "2026-11-04"), "P 05.11 başka özel"), ["gönderilecek"], "tarihleri farklı özel aralık ayrı dönem");
      ctx.fake.state.recipientErrors = {};
    } finally {
      await ctx.close();
    }
  });

  it("03.11 'Geçen Ay' (Ekim) gönderildi → 15.12'de özel 01.10–31.10 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      await sendWith(ctx, () => ctx.batch({ kind: "statement", ids: [p.id], preset: "lastMonth" }));
      ctx.clock.set(localIso(2026, 12, 15, 10, 0));
      assert.deepEqual(await previewSkip(ctx, custom(p, "2026-10-01", "2026-10-31"), "15.12 özel Ekim"), ["Daha Önce Gönderildi"], "Geçen Ay'ın tarihleri = özel aralık");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 İş L2 (S2) — taşınan veride dosyadaki Sonucu Belirsiz eler; onaylı yol açık", () => {
  it("kaynakta P Sonucu Belirsiz (Bu Ay) + asıl işte Başarısız → taşınan veride yeni gönderim ve Yeniden Dene 'Sonucu Belirsiz' (onaylı yol iletide); işteki Yine de Gönder gider", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-dk9l2-kaynak-"));
    const copy = mkdtempSync(path.join(tmpdir(), "destekofis-dk9l2-tasindi-"));
    const ctx = await startWa({ dataDir, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    const fake = ctx.fake;
    let other = null;
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const main = await sendWith(ctx, () => ctx.batch(thisMonth(p)), { error: FAIL });
      assert.equal(main.job.state, "failed", "ön koşul: asıl işte Başarısız");
      ctx.clock.set(localIso(2026, 11, 3, 11, 0));
      const u = await sendWith(ctx, () => ctx.batch(thisMonth(p)), { drop: true });
      assert.equal(u.job.state, "uncertain", "ön koşul: belirsiz");
      await ctx.server.close();
      cpSync(dataDir, copy, { recursive: true });
      for (const name of readdirSync(copy)) if (name.startsWith("whatsapp-gonderim.sqlite")) removeTestDir(path.join(copy, name));
      other = await startWa({ dataDir: copy, fake, connect: false, ack: false, now: { time: localIso(2026, 11, 4, 10), fixed: true } });
      assert.deepEqual(await previewSkip(other, thisMonth(p), "taşınan veride Bu Ay"), ["Sonucu Belirsiz"], "dosyadaki belirsiz iş eler");
      assertUncertainOnly(await other.batch(thisMonth(p)), "taşınan veride yeni gönderim");
      assertUncertainOnly(await retry(other, main.batch.id), "taşınan veride Yeniden Dene");
      const sent = await sendWith(other, () => anyway(other, u.job.id));
      assert.equal(sent.job.state, "accepted", "işteki Yine de Gönder gider (çıkmaz yok)");
    } finally {
      await other?.server.close();
      await fake.close();
      removeTestDir(dataDir);
      removeTestDir(copy);
    }
  });
});

describe("2.4.8 İş L3 (S3) — Şirket Verisini Sıfırla ile duran Meta Bekletti sayılmaz; geç teslim sayılır", () => {
  it("P Meta Bekletti → Şirket Verisini Sıfırla (Yalnız Hareketler; cari kalır) → P 'gönderilecek'; 1. denemenin geç 'delivered'ı → 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const o = await sendWith(ctx, () => ctx.batch(thisMonth(p)));
      ctx.clock.advance(60_000);
      assert.equal(ctx.statuses([{ id: o.job.wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }]).applied, 1, "ön koşul: Meta Bekletti");
      await ok(await ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }), "Şirket Verisini Sıfırla");
      assert.equal(ctx.wa.ledger.batchState(o.batch.id).reason, "reset", "ön koşul: defterde sıfırlamayla durdu");
      ctx.clock.advance(60_000);
      assert.deepEqual(await previewSkip(ctx, thisMonth(p), "sıfırlamadan sonra"), ["gönderilecek"], "teslim edilmemiş, sıfırlamayla duran Meta Bekletti sayılmaz");
      const late = ctx.statuses([{ id: o.job.wamid, status: "delivered", timestamp: ts(ctx), recipient_id: "905334445566" }]);
      assert.equal(late.applied, 1, `geç teslim uygulandı (iş dosyada yok; geldi ${JSON.stringify(late)})`);
      assert.deepEqual(await previewSkip(ctx, thisMonth(p), "geç teslimden sonra"), ["Daha Önce Gönderildi"], "kesin aldı → sayılır");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 İş L4 (S4) — Meta Bekletti sonrası 2. deneme belirsizse 'Sonucu Belirsiz'", () => {
  it("P kabul → 131049 → 24 saat sonra 2. deneme belirsiz → yeni gönderim 'Sonucu Belirsiz' (onaylı yol iletide); 1. denemenin geç teslimi → 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const o = await sendWith(ctx, () => ctx.batch(thisMonth(p)));
      const w1 = o.job.wamid;
      ctx.clock.advance(60_000);
      assert.equal(ctx.statuses([{ id: w1, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }]).applied, 1, "ön koşul: Meta Bekletti");
      ctx.clock.advance(24 * 3_600_000 + 60_000);
      ctx.fake.state.dropAfter = /\/messages$/;
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      const job = (await ctx.jobs(o.batch.id))[0];
      assert.deepEqual([job.state, job.attempt], ["uncertain", 2], "ön koşul: 2. deneme Sonucu Belirsiz");
      ctx.clock.advance(60_000);
      assert.deepEqual(await previewSkip(ctx, thisMonth(p), "önizleme"), ["Sonucu Belirsiz"], "2. denemenin belirsizliği 1. denemenin kabulüyle gizlenmez");
      assertUncertainOnly(await ctx.batch(thisMonth(p)), "yeni gönderim");
      const late = ctx.statuses([{ id: w1, status: "delivered", timestamp: ts(ctx), recipient_id: "905334445566" }]);
      assert.equal(late.applied, 1, "ön koşul: 1. denemenin geç teslimi");
      assert.deepEqual(await previewSkip(ctx, thisMonth(p), "geç teslimden sonra"), ["Daha Önce Gönderildi"], "kesin aldı → R3");
    } finally {
      await ctx.close();
    }
  });

  it("onaylı yol: 2. deneme belirsizken işteki Yine de Gönder gider", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const o = await sendWith(ctx, () => ctx.batch(thisMonth(p)));
      ctx.clock.advance(60_000);
      ctx.statuses([{ id: o.job.wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }]);
      ctx.clock.advance(24 * 3_600_000 + 60_000);
      ctx.fake.state.dropAfter = /\/messages$/;
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      const job = (await ctx.jobs(o.batch.id))[0];
      assert.equal(job.state, "uncertain", "ön koşul");
      ctx.clock.advance(60_000);
      const sent = await sendWith(ctx, () => anyway(ctx, job.id));
      assert.equal(sent.job.state, "accepted", "işteki Yine de Gönder gider");
    } finally {
      await ctx.close();
    }
  });
});
