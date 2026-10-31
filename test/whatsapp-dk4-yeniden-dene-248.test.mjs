// 2.4.8 dar kontrol 4 ORTA-1 (bağımsız incelemeci, zorla üretildi) — "Başarısızları Yeniden Dene" (retry-failed) ve "Yine de Gönder" (send-anyway) yeni toplu işi
// asıl işin dönemini { from, to } olarak gövdeden yeniden açıyordu: preset kayboluyor, dönem özel aralık sayılıyordu (anahtar `aralik|…`). Sonuç: yeniden denemeyle
// giden ekstre sonraki "Bu Ay" / "Son 3 Ay" / "Tüm Hareketler" seçiminde ne "Daha Önce Gönderildi" ne "Zaten Kuyrukta" görülüyor → aynı kişiye ikinci ekstre;
// "Tüm Hareketler" işinde (başlangıç boş) iki düğme 400 "Dönemin başlangıç ve bitiş tarihini seçin." veriyordu.
// Kural (KULLANICI KARARI T2-1 = A + 31.10.2026 "a"; lib/whatsapp/donem.mjs): "Bu Ay"/"Geçen Ay" aynı takvim ayı = aynı dönem; "Son 3 Ay"/"Tüm Hareketler" son 7 gün
// içinde aynı seçim; yeniden deneme / Yine de Gönder AYNI toplu işin dönemindedir (kayıtlı period_from / period_to / preset içeriden taşınır).
// Dış istek (rota) bu dönemi gövdeyle VEREMEZ: gövdedeki "period" alanı okunmaz.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const A_TEL = "+905321112233";
const B_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const skipOf = preview => Object.fromEntries(preview.people.map(person => [person.name, person.skip || "gönderilecek"]));
const count = (ctx, phone) => ctx.messages().filter(item => item.to === phone).length;
const periodOf = batch => ({ from: batch.period.from, to: batch.period.to, preset: batch.period.preset });
// KULLANICI KARARI (31.10.2026, ek soru 2/4 "a"): belirsiz iş dururken "Sonucu Belirsiz" R3'ten önce gelir. Dönem taşımasını R3 üzerinden sınamak için önce belirsiz iş
// Meta'nın imzalı bildirimiyle (iş kimliği) "teslim edilemedi" olarak çözülür (Sonucu Belirsiz elemesi kalkar).
function settleUncertain(ctx, job, phone) {
  const wamid = ctx.messages().filter(item => item.to === phone)[0].wamid;
  const ts = String(Math.floor(ctx.clock().getTime() / 1000));
  const hook = ctx.statuses([{ id: wamid, status: "failed", timestamp: ts, recipient_id: phone.slice(1), biz_opaque_callback_data: job.id, errors: [{ code: 131026, title: "Message undeliverable" }] }], { signed: true });
  assert.equal(hook.applied, 1, `ön koşul: belirsiz iş çözüldü (${JSON.stringify(hook)})`);
}

async function preview(ctx, body) {
  const res = await ctx.api.post(URLS.preview, body);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data.data;
}
/** İkinci toplu iş açılmamalı: 400 + whatsapp-nothing (bütün seçilenler elendi, §7a 31). */
function assertNothing(res, label) {
  assert.equal(res.status, 400, `${label}: toplu iş açılmamalı (geldi ${res.status} ${JSON.stringify(res.data)})`);
  assert.equal(res.data.code, "whatsapp-nothing", `${label}: neden 'bütün seçilenler elendi' olmalı (geldi ${res.data.code})`);
}

describe("2.4.8 dar kontrol 4 — Yeniden Dene / Yine de Gönder asıl toplu işin dönemini taşır", () => {
  it("Bu Ay: B Başarısız → Başarısızları Yeniden Dene → kabul; aynı gün ve ertesi gün 'Bu Ay' iki kişide 'Daha Önce Gönderildi', ikinci iş açılmaz, kişi başına BİR ekstre", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      ctx.fake.state.recipientErrors[B_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
      const body = { kind: "statement", ids: [a.id, b.id], preset: "thisMonth" };
      const first = await ctx.batch(body);
      assert.equal(first.status, 200, JSON.stringify(first.data));
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(first.data.data.batch.id)).map(job => job.state), ["accepted", "failed"], "ön koşul: A gitti, B Başarısız");
      ctx.fake.state.recipientErrors = {};
      const retry = await ctx.api.post(`${URLS.batches}/${first.data.data.batch.id}/retry-failed`, {});
      assert.equal(retry.status, 200, JSON.stringify(retry.data));
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(retry.data.data.batch.id)).map(job => job.state), ["accepted"], "ön koşul: yeniden deneme kabul");
      assert.deepEqual(skipOf(await preview(ctx, body)), { "Ayşe Yılmaz": "Daha Önce Gönderildi", "Burak Kaya": "Daha Önce Gönderildi" }, "aynı gün 'Bu Ay'");
      ctx.clock.advance(24 * HOUR);
      assert.deepEqual(skipOf(await preview(ctx, body)), { "Ayşe Yılmaz": "Daha Önce Gönderildi", "Burak Kaya": "Daha Önce Gönderildi" }, "ertesi gün 'Bu Ay'");
      assertNothing(await ctx.batch(body), "ertesi gün 'Bu Ay'");
      await ctx.drain();
      assert.equal(count(ctx, A_TEL), 1, "A'ya bir ekstre");
      assert.equal(count(ctx, B_TEL), 1, "B'ye bir ekstre (yalnız yeniden deneme)");
      assert.deepEqual(periodOf(retry.data.data.batch), periodOf(first.data.data.batch), "yeniden deneme asıl işin dönemini (preset dahil) taşır");
    } finally {
      await ctx.close();
    }
  });

  it("Zaten Kuyrukta: yeniden deneme işi sınırda beklerken ertesi gün 'Bu Ay' → B 'Zaten Kuyrukta', ikinci iş açılmaz; sınırdan sonra B'ye BİR ekstre", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 22), fixed: true } });
    try {
      assert.equal((await ctx.api.put(URLS.sending, { dailyCap: 1 })).status, 200);
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      ctx.fake.state.recipientErrors[B_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
      const first = await ctx.batch({ kind: "statement", ids: [b.id, a.id], preset: "thisMonth" });
      assert.equal(first.status, 200, JSON.stringify(first.data));
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(first.data.data.batch.id)).map(job => job.state), ["failed", "accepted"], "ön koşul: B Başarısız, A gitti");
      ctx.fake.state.recipientErrors = {};
      const retry = await ctx.api.post(`${URLS.batches}/${first.data.data.batch.id}/retry-failed`, {});
      assert.equal(retry.status, 200, JSON.stringify(retry.data));
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(retry.data.data.batch.id)).map(job => job.state), ["limited"], "ön koşul: yeniden deneme sınırda bekliyor");
      ctx.clock.advance(4 * HOUR);
      assert.equal(ctx.clock.today(), "2026-11-04", "ön koşul: program günü döndü (yerel saat)");
      const body = { kind: "statement", ids: [a.id, b.id], preset: "thisMonth" };
      assert.deepEqual(skipOf(await preview(ctx, body)), { "Ayşe Yılmaz": "Daha Önce Gönderildi", "Burak Kaya": "Zaten Kuyrukta" });
      assertNothing(await ctx.batch(body), "ertesi gün 'Bu Ay'");
      for (let i = 0; i < 4; i += 1) {
        ctx.clock.advance(25 * HOUR);
        await ctx.drain();
      }
      assert.equal(count(ctx, A_TEL), 1, "A'ya bir ekstre");
      assert.equal(count(ctx, B_TEL), 1, "B'ye bir ekstre (sınırdan sonra yeniden deneme)");
    } finally {
      await ctx.close();
    }
  });

  it("Yine de Gönder (Bu Ay, Sonucu Belirsiz): yeni iş asıl işin dönemini taşır; ertesi gün 'Bu Ay' → 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      ctx.fake.state.dropAfter = /\/messages$/;
      const first = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
      assert.equal(first.status, 200, JSON.stringify(first.data));
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      const job = (await ctx.jobs(first.data.data.batch.id))[0];
      assert.equal(job.state, "uncertain", "ön koşul: Sonucu Belirsiz");
      const again = await ctx.api.post(`/api/workspace/whatsapp/jobs/${job.id}/send-anyway`, { confirm: true });
      assert.equal(again.status, 200, JSON.stringify(again.data));
      await ctx.drain();
      assert.equal((await ctx.jobs(again.data.data.batch.id))[0].state, "accepted", "ön koşul: yeni iş kabul");
      ctx.clock.advance(24 * HOUR);
      // İş Q2 (KULLANICI KARARI A; beklenti bilerek değişti — önce "Sonucu Belirsiz"): belirsiz işin Yine de Gönder işi kabul edildi → kaynak elemez, kişi R3'e düşer.
      assert.deepEqual(skipOf(await preview(ctx, { kind: "statement", ids: [a.id], preset: "thisMonth" })), { "Ayşe Yılmaz": "Daha Önce Gönderildi" }, "İş Q2: Yine de Gönder işi kabul edildi → Daha Önce Gönderildi (kaynak belirsiz elemez)");
      settleUncertain(ctx, job, A_TEL);
      assert.deepEqual(skipOf(await preview(ctx, { kind: "statement", ids: [a.id], preset: "thisMonth" })), { "Ayşe Yılmaz": "Daha Önce Gönderildi" });
      assert.deepEqual(periodOf(again.data.data.batch), periodOf(first.data.data.batch), "Yine de Gönder asıl işin dönemini (preset dahil) taşır");
    } finally {
      await ctx.close();
    }
  });

  // Varsayılan seçim "Bu Ay" olduğundan dönemi hiç taşımayan bir yeniden deneme "Bu Ay" senaryolarında rastlantıyla doğru çıkar (mutasyon turu); "Geçen Ay" bunu ayırır.
  it("Geçen Ay: Başarısızları Yeniden Dene ve Yine de Gönder 'Geçen Ay' dönemini taşır; ertesi gün 'Geçen Ay' iki kişide 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 10, 10), fixed: true } });
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [a.id, b.id], preset: "lastMonth" };
      ctx.fake.state.recipientErrors[B_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
      const first = await ctx.batch({ kind: "statement", ids: [b.id], preset: "lastMonth" });
      assert.equal(first.status, 200, JSON.stringify(first.data));
      await ctx.drain();
      assert.equal((await ctx.jobs(first.data.data.batch.id))[0].state, "failed", "ön koşul: B Başarısız");
      ctx.fake.state.recipientErrors = {};
      const retry = await ctx.api.post(`${URLS.batches}/${first.data.data.batch.id}/retry-failed`, {});
      assert.equal(retry.status, 200, JSON.stringify(retry.data));
      await ctx.drain();
      ctx.fake.state.dropAfter = /\/messages$/;
      const firstA = await ctx.batch({ kind: "statement", ids: [a.id], preset: "lastMonth" });
      assert.equal(firstA.status, 200, JSON.stringify(firstA.data));
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      const job = (await ctx.jobs(firstA.data.data.batch.id))[0];
      assert.equal(job.state, "uncertain", "ön koşul: A Sonucu Belirsiz");
      const again = await ctx.api.post(`/api/workspace/whatsapp/jobs/${job.id}/send-anyway`, { confirm: true });
      assert.equal(again.status, 200, JSON.stringify(again.data));
      await ctx.drain();
      ctx.clock.advance(24 * HOUR);
      // İş Q2 (beklenti bilerek değişti — önce A "Sonucu Belirsiz"): A'nın Yine de Gönder işi kabul edildi → kaynak elemez.
      assert.deepEqual(skipOf(await preview(ctx, body)), { "Ayşe Yılmaz": "Daha Önce Gönderildi", "Burak Kaya": "Daha Önce Gönderildi" }, "İş Q2: Yine de Gönder işi kabul edildi → Daha Önce Gönderildi");
      settleUncertain(ctx, job, A_TEL);
      assert.deepEqual(skipOf(await preview(ctx, body)), { "Ayşe Yılmaz": "Daha Önce Gönderildi", "Burak Kaya": "Daha Önce Gönderildi" }, "ertesi gün 'Geçen Ay'");
      assertNothing(await ctx.batch(body), "ertesi gün 'Geçen Ay'");
      const october = { from: "2026-10-01", to: "2026-10-31", preset: "lastMonth" };
      assert.deepEqual(periodOf(retry.data.data.batch), october, "yeniden deneme 'Geçen Ay' dönemini taşır");
      assert.deepEqual(periodOf(again.data.data.batch), october, "Yine de Gönder 'Geçen Ay' dönemini taşır");
    } finally {
      await ctx.close();
    }
  });

  for (const [preset, ad] of [["all", "Tüm Hareketler"], ["last3", "Son 3 Ay"]]) {
    it(`${ad}: Başarısızları Yeniden Dene 200 (dönem korunur), ileti gider; 2 gün sonra aynı seçim 'Daha Önce Gönderildi'`, async () => {
      const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
      try {
        const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
        ctx.fake.state.recipientErrors[B_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
        const body = { kind: "statement", ids: [b.id], preset };
        const first = await ctx.batch(body);
        assert.equal(first.status, 200, JSON.stringify(first.data));
        await ctx.drain();
        assert.equal((await ctx.jobs(first.data.data.batch.id))[0].state, "failed", "ön koşul: Başarısız");
        ctx.fake.state.recipientErrors = {};
        const retry = await ctx.api.post(`${URLS.batches}/${first.data.data.batch.id}/retry-failed`, {});
        assert.equal(retry.status, 200, `yeniden deneme açılmalı (geldi ${retry.status} ${JSON.stringify(retry.data)})`);
        await ctx.drain();
        assert.equal(count(ctx, B_TEL), 1, "yeniden deneme iletisi gitti");
        ctx.clock.advance(48 * HOUR);
        assert.deepEqual(skipOf(await preview(ctx, body)), { "Burak Kaya": "Daha Önce Gönderildi" });
        assertNothing(await ctx.batch(body), `2 gün sonra '${ad}'`);
        assert.equal(count(ctx, B_TEL), 1, "B'ye bir ekstre");
        assert.deepEqual(periodOf(retry.data.data.batch), periodOf(first.data.data.batch), "dönem (preset dahil) korunur");
      } finally {
        await ctx.close();
      }
    });
  }

  it("Tüm Hareketler (Sonucu Belirsiz): Yine de Gönder 200, ileti gider (önceden 400 'Dönemin başlangıç ve bitiş tarihini seçin.')", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      ctx.fake.state.dropAfter = /\/messages$/;
      const first = await ctx.batch({ kind: "statement", ids: [a.id], preset: "all" });
      assert.equal(first.status, 200, JSON.stringify(first.data));
      assert.equal(first.data.data.batch.period.from, "", "ön koşul: Tüm Hareketler başlangıcı boş");
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      const job = (await ctx.jobs(first.data.data.batch.id))[0];
      assert.equal(job.state, "uncertain", "ön koşul: Sonucu Belirsiz");
      const sentBefore = ctx.messages().length;
      const again = await ctx.api.post(`/api/workspace/whatsapp/jobs/${job.id}/send-anyway`, { confirm: true });
      assert.equal(again.status, 200, `Yine de Gönder açılmalı (geldi ${again.status} ${JSON.stringify(again.data)})`);
      assert.deepEqual(periodOf(again.data.data.batch), periodOf(first.data.data.batch), "dönem korunur");
      await ctx.drain();
      assert.equal((await ctx.jobs(again.data.data.batch.id))[0].state, "accepted", "yeni iş kabul");
      assert.equal(ctx.messages().length, sentBefore + 1, "Yine de Gönder iletisi gitti");
    } finally {
      await ctx.close();
    }
  });

  it("Dış istek dönemi gövdeyle veremez: toplu iş ve yeniden deneme gövdesindeki 'period' okunmaz", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const injected = { from: "2020-01-01", to: "2020-01-31", preset: "all" };
      ctx.fake.state.recipientErrors[B_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
      const first = await ctx.batch({ kind: "statement", ids: [b.id], preset: "thisMonth", period: injected });
      assert.equal(first.status, 200, JSON.stringify(first.data));
      assert.deepEqual(periodOf(first.data.data.batch), { from: "2026-11-01", to: "2026-11-03", preset: "thisMonth" }, "gövdedeki period yok sayılır");
      await ctx.drain();
      ctx.fake.state.recipientErrors = {};
      const retry = await ctx.api.post(`${URLS.batches}/${first.data.data.batch.id}/retry-failed`, { period: injected, from: "2020-01-01", to: "2020-01-31", preset: "all" });
      assert.equal(retry.status, 200, JSON.stringify(retry.data));
      assert.deepEqual(periodOf(retry.data.data.batch), { from: "2026-11-01", to: "2026-11-03", preset: "thisMonth" }, "yeniden denemede gövdedeki dönem yok sayılır");
    } finally {
      await ctx.close();
    }
  });
});
