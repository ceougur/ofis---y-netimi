// 2.4.8 dar kontrol 5 ORTA-1 (bağımsız incelemeci, zorla üretildi) — asıl toplu işte kullanıcı R3 sorusunda bilerek "Yine de Gönder" (sendAgain) seçmişken, o işte
// Başarısız / Sonucu Belirsiz kalan kişi için "Başarısızları Yeniden Dene" ve işteki "Yine de Gönder" 400 "Gönderilebilecek kişi yok" veriyordu (R3 yeniden uygulanıyor,
// karar kayboluyor; neden yalnız summary.skipped'de, istemci göstermiyor).
// KULLANICI KARARI (31.10.2026, "a şıkkı"): asıl işin "Yine de Gönder" kararı yeniden denemeye taşınır; yalnız asıl işin AÇILIŞINDAN ÖNCEKİ kabuller yok sayılır; açılıştan
// SONRA başka bir işle aynı kişiye aynı dönem giden yine "Daha Önce Gönderildi" (çift ileti yok). Elenme nedeni iletide görünür (her durumda).
// Karar yalnız asıl işin kaydından gelir (wa_batches.send_again_after, göç v42); dış istek gövdesi onu ya da sınırı zorlayamaz.
// DÜŞÜK-T (aynı tur): ay dönümünde yeniden deneme asıl işin dönemini (Ekim) korur — preset'ten bugüne göre yeniden hesaplanmaz (mutasyon M3).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const B_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const count = (ctx, phone) => ctx.messages().filter(item => item.to === phone).length;
const failB = ctx => (ctx.fake.state.recipientErrors[B_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") });
const healB = ctx => (ctx.fake.state.recipientErrors = {});
const rowOf = (ctx, id) => ctx.store.get("SELECT created_at, send_again_after FROM wa_batches WHERE id = ?", id);
const retry = (ctx, batchId, body = {}) => ctx.api.post(`${URLS.batches}/${batchId}/retry-failed`, body);
const anyway = (ctx, jobId, body = {}) => ctx.api.post(`/api/workspace/whatsapp/jobs/${jobId}/send-anyway`, { confirm: true, ...body });
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
// Dış istek denemesi: kararı / sınırı / dönemi gövdeyle zorlamaya çalışan alanlar (hiçbiri okunmamalı).
const FORCE = { sendAgain: true, sendAgainAfter: "9999-12-31T00:00:00.000Z", send_again_after: "9999-12-31T00:00:00.000Z", since: "9999-12-31T00:00:00.000Z", after: "9999-12-31T00:00:00.000Z" };

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
function assertAlreadySent(res, label, { reminder = false } = {}) {
  assert.equal(res.status, 400, `${label}: toplu iş açılmamalı (geldi ${res.status} ${JSON.stringify(res.data)})`);
  assert.equal(res.data.code, "whatsapp-nothing", `${label}: kod`);
  assert.deepEqual(res.data.summary?.skipped, { "Daha Önce Gönderildi": 1 }, `${label}: neden`);
  assert.match(res.data.error, /Daha Önce Gönderildi: 1/, `${label}: neden İLETİDE görünmeli (geldi "${res.data.error}")`);
  const hint = reminder ? /Bu kişilere bugün daha önce ödeme hatırlatması gönderildi; yeniden göndermek için yeni gönderimde "Yine de Gönder" seçin\./ : /Bu kişilere bu dönem daha önce gönderildi; yeniden göndermek için yeni gönderimde "Yine de Gönder" seçin\./;
  assert.match(res.data.error, hint, `${label}: iletide ne yapılacağı yazmalı (geldi "${res.data.error}")`);
}

/** 03.11 B'ye "Bu Ay" ekstresi gider; 04.11 kullanıcı R3 sorusunda "Yine de Gönder" der, Meta bu kez B için kalıcı hata verir. Dönüş: ikinci (asıl) iş. */
async function sendAgainFailed(ctx, b, { uncertain = false } = {}) {
  const body = { kind: "statement", ids: [b.id], preset: "thisMonth" };
  const first = await ok(await ctx.batch(body), "ilk ekstre");
  await ctx.drain();
  assert.deepEqual((await ctx.jobs(first.batch.id)).map(job => job.state), ["accepted"], "ön koşul: ilk ekstre kabul");
  ctx.clock.advance(24 * HOUR);
  const pv = await ok(await ctx.api.post(URLS.preview, body), "önizleme");
  assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi"], "ön koşul: R3 sorusu çıkar");
  if (uncertain) ctx.fake.state.dropAfter = /\/messages$/;
  else failB(ctx);
  const main = await ok(await ctx.batch({ ...body, sendAgain: true }), "Yine de Gönder ile asıl iş");
  await ctx.drain();
  ctx.fake.state.dropAfter = null;
  healB(ctx);
  const jobs = await ctx.jobs(main.batch.id);
  assert.deepEqual(jobs.map(job => job.state), [uncertain ? "uncertain" : "failed"], "ön koşul: asıl işte B kalmadı");
  assert.equal(rowOf(ctx, main.batch.id).send_again_after, rowOf(ctx, main.batch.id).created_at, "asıl işin kararı kaydında (açılış anı)");
  return { main, job: jobs[0] };
}

describe("2.4.8 dar kontrol 5 — asıl işin 'Yine de Gönder' kararı yeniden denemeye taşınır", () => {
  it("Başarısızları Yeniden Dene: asıl iş 'Yine de Gönder' ile açılmış → B'ye gider (toplam 2 ekstre); yeniden deneme işi aynı kararı taşır", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const { main } = await sendAgainFailed(ctx, b);
      ctx.clock.advance(HOUR);
      const again = await ok(await retry(ctx, main.batch.id, { requestId: "dk5-retry-1" }), "Başarısızları Yeniden Dene");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(again.batch.id)).map(job => job.state), ["accepted"], "yeniden deneme kabul");
      assert.equal(count(ctx, B_TEL), 2, "B'ye iki ekstre (ilk + kullanıcının 'Yine de Gönder' kararı)");
      assert.equal(rowOf(ctx, again.batch.id).send_again_after, rowOf(ctx, main.batch.id).created_at, "yeniden deneme asıl işin açılış anını devralır (zincirde kaymaz)");
    } finally {
      await ctx.close();
    }
  });

  it("Aynı an (sahte saat durur): asıl iş ilk ekstreyle aynı anda açılsa da kararı geçerli — Başarısızları Yeniden Dene B'ye gider", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [b.id], preset: "thisMonth" };
      await ok(await ctx.batch(body), "ilk ekstre");
      await ctx.drain();
      failB(ctx);
      const main = await ok(await ctx.batch({ ...body, sendAgain: true }), "Yine de Gönder ile asıl iş");
      await ctx.drain();
      healB(ctx);
      assert.deepEqual((await ctx.jobs(main.batch.id)).map(job => job.state), ["failed"], "ön koşul: B Başarısız");
      await ok(await retry(ctx, main.batch.id), "Başarısızları Yeniden Dene");
      await ctx.drain();
      assert.equal(count(ctx, B_TEL), 2, "B'ye iki ekstre");
    } finally {
      await ctx.close();
    }
  });

  it("Sonucu Belirsiz → işteki Yine de Gönder: asıl iş 'Yine de Gönder' ile açılmış → yeni iş açılır, Meta'ya üçüncü ileti isteği gider", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const { main, job } = await sendAgainFailed(ctx, b, { uncertain: true });
      ctx.clock.advance(HOUR);
      const again = await ok(await anyway(ctx, job.id), "Yine de Gönder (işte)");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(again.batch.id)).map(item => item.state), ["accepted"], "yeni iş kabul");
      assert.equal(ctx.messageRequests().length, 3, "ilk + belirsiz + Yine de Gönder");
      assert.equal(rowOf(ctx, again.batch.id).send_again_after, rowOf(ctx, main.batch.id).created_at, "yeni iş asıl işin açılış anını devralır");
    } finally {
      await ctx.close();
    }
  });

  it("Sınır: asıl iş açıldıktan SONRA başka bir işle B'ye aynı dönem gitti → Başarısızları Yeniden Dene ve işteki Yine de Gönder 'Daha Önce Gönderildi' (iletide neden), çift ileti yok; gövde sınırı zorlayamaz", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const { main } = await sendAgainFailed(ctx, b);
      ctx.clock.advance(HOUR);
      // Başka bir kullanıcı / sekme aynı dönemi yeniden "Yine de Gönder" ile gönderir; bu kez gider.
      const other = await ok(await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth", sendAgain: true }), "başka iş");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(other.batch.id)).map(job => job.state), ["accepted"], "ön koşul: başka iş kabul");
      assert.equal(count(ctx, B_TEL), 2, "ön koşul: ilk + başka iş");
      ctx.clock.advance(HOUR);
      assertAlreadySent(await retry(ctx, main.batch.id), "Başarısızları Yeniden Dene");
      assertAlreadySent(await retry(ctx, main.batch.id, FORCE), "Başarısızları Yeniden Dene (gövde kararı/sınırı zorluyor)");
      await ctx.drain();
      assert.equal(count(ctx, B_TEL), 2, "B'ye üçüncü ekstre gitmez");
      assert.equal(rowOf(ctx, main.batch.id).send_again_after, rowOf(ctx, main.batch.id).created_at, "asıl işin kaydı değişmedi");
    } finally {
      await ctx.close();
    }
  });

  it("Sınır (Sonucu Belirsiz): asıl iş açıldıktan SONRA başka bir işle B'ye gitti → işteki Yine de Gönder 'Daha Önce Gönderildi', gövde zorlayamaz", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const { job } = await sendAgainFailed(ctx, b, { uncertain: true });
      ctx.clock.advance(HOUR);
      const other = await ok(await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth", sendAgain: true }), "başka iş");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(other.batch.id)).map(item => item.state), ["accepted"], "ön koşul: başka iş kabul");
      ctx.clock.advance(HOUR);
      assertAlreadySent(await anyway(ctx, job.id, FORCE), "Yine de Gönder (işte; gövde zorluyor)");
      await ctx.drain();
      assert.equal(ctx.messageRequests().length, 3, "ilk + belirsiz + başka iş; dördüncü istek yok");
    } finally {
      await ctx.close();
    }
  });

  it("Dış istek: asıl iş 'Yine de Gönder' OLMADAN açıldıysa gövdedeki sendAgain / sendAgainAfter / since yeniden denemeye karar vermez; yeni gönderimde de yalnız sendAgain sayılır", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      failB(ctx);
      const main = await ok(await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth", sendAgainAfter: "2000-01-01T00:00:00.000Z", send_again_after: "2000-01-01T00:00:00.000Z" }), "asıl iş (kararsız)");
      await ctx.drain();
      healB(ctx);
      assert.deepEqual((await ctx.jobs(main.batch.id)).map(job => job.state), ["failed"], "ön koşul: B Başarısız");
      assert.equal(rowOf(ctx, main.batch.id).send_again_after, "", "gövdedeki sendAgainAfter / send_again_after kayda girmez");
      ctx.clock.advance(HOUR);
      const other = await ok(await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" }), "başka iş");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(other.batch.id)).map(job => job.state), ["accepted"], "ön koşul: başka iş kabul");
      ctx.clock.advance(HOUR);
      assertAlreadySent(await retry(ctx, main.batch.id, FORCE), "Başarısızları Yeniden Dene (gövde sendAgain zorluyor)");
      await ctx.drain();
      assert.equal(count(ctx, B_TEL), 1, "B'ye bir ekstre");
    } finally {
      await ctx.close();
    }
  });

  it("Ödeme Hatırlatma (aynı gün kuralı): asıl hatırlatma 'Yine de Gönder' ile → B Başarısız → Yeniden Dene gider; aynı gün yeni hatırlatma 'Daha Önce Gönderildi' (iletide 'bugün'), ertesi gün serbest", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66");
      await ok(await ctx.api.post("/api/workspace/plans", { accountId: b.id, name: "Taksit", total: "3000", count: 3, firstDue: "2026-11-15", startDate: "2026-11-03" }), "taksit kartı");
      ctx.clock.set("2026-12-20T10:00:00+03:00");
      await ok(await ctx.batch({ kind: "reminder", ids: [b.id] }), "ilk hatırlatma");
      await ctx.drain();
      assert.equal(count(ctx, B_TEL), 1, "ön koşul: ilk hatırlatma gitti");
      ctx.clock.advance(HOUR);
      assertAlreadySent(await ctx.batch({ kind: "reminder", ids: [b.id] }), "aynı gün ikinci hatırlatma (karar yok)", { reminder: true });
      failB(ctx);
      const main = await ok(await ctx.batch({ kind: "reminder", ids: [b.id], sendAgain: true }), "Yine de Gönder ile asıl hatırlatma");
      await ctx.drain();
      healB(ctx);
      assert.deepEqual((await ctx.jobs(main.batch.id)).map(job => job.state), ["failed"], "ön koşul: B Başarısız");
      ctx.clock.advance(HOUR);
      const again = await ok(await retry(ctx, main.batch.id), "Başarısızları Yeniden Dene");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(again.batch.id)).map(job => job.state), ["accepted"], "yeniden deneme kabul");
      assert.equal(count(ctx, B_TEL), 2, "B'ye iki hatırlatma");
      ctx.clock.advance(HOUR);
      assertAlreadySent(await ctx.batch({ kind: "reminder", ids: [b.id] }), "aynı gün yeni hatırlatma", { reminder: true });
      ctx.clock.set("2026-12-21T09:00:00+03:00");
      await ok(await ctx.batch({ kind: "reminder", ids: [b.id] }), "ertesi gün yeni hatırlatma");
    } finally {
      await ctx.close();
    }
  });

  // DÜŞÜK-T (mutasyon M3: preset korunur ama dönem bugüne göre yeniden hesaplanır — dar listede yakalanmıyordu).
  it("Ay dönümü: 31.10 'Bu Ay' (Ekim) işi 01.11'de yeniden denenince dönem 01.10–31.10, {{3}} ve PDF Ekim; 01.11 'Geçen Ay' → Daha Önce Gönderildi, 'Bu Ay' → gönderilecek", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 10, 31, 23), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      failB(ctx);
      const main = await ok(await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth" }), "31.10 'Bu Ay'");
      await ctx.drain();
      healB(ctx);
      assert.deepEqual(main.batch.period, { from: "2026-10-01", to: "2026-10-31", preset: "thisMonth" }, "ön koşul: asıl iş Ekim");
      assert.deepEqual((await ctx.jobs(main.batch.id)).map(job => job.state), ["failed"], "ön koşul: B Başarısız");
      ctx.clock.advance(11 * HOUR);
      assert.equal(ctx.clock.today(), "2026-11-01", "ön koşul: program günü 01.11 (yerel saat)");
      const again = await ok(await retry(ctx, main.batch.id), "01.11 Başarısızları Yeniden Dene");
      await ctx.drain();
      assert.deepEqual(again.batch.period, { from: "2026-10-01", to: "2026-10-31", preset: "thisMonth" }, "yeniden deneme dönemi Ekim kalır");
      const message = ctx.messages().filter(item => item.to === B_TEL).at(-1);
      assert.ok(message, "B'ye ekstre gitti");
      assert.equal(message.params?.[2], "01.10.2026 – 31.10.2026", "{{3}} Ekim");
      assert.equal(message.document?.filename, "Ekstre Burak Kaya 01.10.2026-31.10.2026.pdf", "PDF adı Ekim");
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, { kind: "statement", ids: [b.id], preset: "lastMonth" }), "01.11 'Geçen Ay'")), ["Daha Önce Gönderildi"], "01.11 'Geçen Ay' (Ekim)");
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, { kind: "statement", ids: [b.id], preset: "thisMonth" }), "01.11 'Bu Ay'")), ["gönderilecek"], "01.11 'Bu Ay' (Kasım)");
    } finally {
      await ctx.close();
    }
  });
});
