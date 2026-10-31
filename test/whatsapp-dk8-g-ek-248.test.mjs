// 2.4.8 İş G ek kararları (KULLANICI KARARLARI 31.10.2026, ek sorular 1/4–4/4, hepsi "a"):
//   1/4: geri yüklemeden sonra YALNIZ makine defterinde kalan Sonucu Belirsiz deneme (iş şirket dosyasında yok) YENİ toplu işte kişiyi ELEMEZ; dosyada duran belirsiz iş
//        eler; Başarısızları Yeniden Dene'de defterdeki belirsiz yine eler (ileti "yeni gönderim başlatın").
//   2/4: birden çok eleme nedeninde TEK neden; sıra her yerde (yeni toplu iş, Başarısızları Yeniden Dene, işteki Yine de Gönder'in açtığı iş) "Zaten Kuyrukta" →
//        "Sonucu Belirsiz" → "Daha Önce Gönderildi"; ilk ikisiyle elenen R3 uyarısına (sayı / liste) girmez, R3'te "Yine de Gönder" seçilse de ona gitmez.
//   3/4: Ödeme Hatırlatma'da Sonucu Belirsiz eşliği AYNI YEREL GÜN (yeni toplu işte de, yeniden denemede de); gece yarısı sınırı (yerel ≠ UTC günü).
//   4/4: Son 3 Ay / Tüm Hareketler'de Başarısızları Yeniden Dene: sonraki denemenin kabulü gönderim anından geriye 7 gün içindeyse "Daha Önce Gönderildi", eskiyse gider.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const count = ctx => ctx.messages().filter(item => item.to === P_TEL).length;
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const anyway = (ctx, jobId) => ctx.api.post(`/api/workspace/whatsapp/jobs/${jobId}/send-anyway`, { confirm: true });
const retry = (ctx, batchId) => ctx.api.post(`${URLS.batches}/${batchId}/retry-failed`, {});

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}
/** İstek (send) Meta'ya ulaşır, yanıtı gelmez → Sonucu Belirsiz. Dönüş: { batch, job }. */
async function uncertainVia(ctx, send) {
  ctx.fake.state.dropAfter = /\/messages$/;
  const o = await ok(await send(), "belirsiz kalacak gönderim");
  await ctx.drain();
  ctx.fake.state.dropAfter = null;
  const jobs = await ctx.jobs(o.batch.id);
  assert.deepEqual(jobs.map(job => job.state), ["uncertain"], "ön koşul: Sonucu Belirsiz");
  return { batch: o.batch, job: jobs[0] };
}
/** İstek Meta'ca geçici hatayla (131056) reddedilir → iş sırada bekler ("Zaten Kuyrukta" ön koşulu). */
async function pendingVia(ctx, send) {
  ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131056, "Pair rate limit hit") };
  const o = await ok(await send(), "sırada kalacak gönderim");
  await ctx.drain();
  const jobs = await ctx.jobs(o.batch.id);
  assert.ok(["pending", "limited"].includes(jobs[0].state), `ön koşul: iş sırada (${jobs[0].state})`);
  return { batch: o.batch, job: jobs[0] };
}
const heal = ctx => (ctx.fake.state.recipientErrors = {});
async function accepted(ctx, body, label) {
  const o = await ok(await ctx.batch(body), label);
  await ctx.drain();
  assert.deepEqual((await ctx.jobs(o.batch.id)).map(job => job.state), ["accepted"], `ön koşul: ${label} kabul`);
  return o;
}
async function failed(ctx, body, label) {
  ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
  const o = await ok(await ctx.batch(body), label);
  await ctx.drain();
  heal(ctx);
  assert.deepEqual((await ctx.jobs(o.batch.id)).map(job => job.state), ["failed"], `ön koşul: ${label} Başarısız`);
  return o;
}
function assertOnly(res, reason, label) {
  assert.equal(res.status, 400, `${label}: toplu iş açılmamalı (geldi ${res.status} ${JSON.stringify(res.data)})`);
  assert.deepEqual(res.data.summary?.skipped, { [reason]: 1 }, `${label}: tek neden ${reason}`);
  assert.equal(res.data.summary?.alreadySent?.count, 0, `${label}: ${reason} ile elenen R3 sayısına girmez (geldi ${JSON.stringify(res.data.summary?.alreadySent)})`);
}

describe("2.4.8 İş G ek 1/4 — yalnız defterde kalan belirsiz deneme yeni toplu işte elemez", () => {
  it("geri yükleme: belirsiz iş dosyadan gider → yeni gönderim önizlemesi 'gönderilecek', açılır ve gider; Başarısızları Yeniden Dene yine 'Sonucu Belirsiz'", async () => {
    const ctx = await startWa({ maxCompanies: 2, now: NOW });
    try {
      const created = await ok(await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
      const second = created.company || created;
      const q = `hofCompany=${encodeURIComponent(second.id)}`;
      await ok(await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "bağlantı");
      await ok(await ctx.api.put(`${URLS.ack}?${q}`, { ack: true }), "onay");
      const p = await ok(await ctx.api.post(`/api/workspace/accounts?${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" }), "cari");
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
      const main = await ok(await ctx.api.post(`${URLS.batches}?${q}`, body), "asıl iş");
      await ctx.drain();
      heal(ctx);
      const backup = (await ok(await ctx.api.post("/api/admin/backups", { scope: "one", companyId: second.id }), "yedek")).backups[0].name;
      ctx.clock.advance(HOUR);
      ctx.fake.state.dropAfter = /\/messages$/;
      await ok(await ctx.api.post(`${URLS.batches}?${q}`, body), "yeni gönderim (belirsiz kalacak)");
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      const before = (await ok(await ctx.api.post(`${URLS.preview}?${q}`, body), "önizleme (iş dosyada)"));
      assert.deepEqual(skipOf(before), ["Sonucu Belirsiz"], "ön koşul: iş dosyada dururken yeni gönderim eler");
      await ok(await ctx.api.post("/api/admin/backups/restore", { name: backup, company: second.id, confirm: second.code, password: ADMIN_PASSWORD }), "geri yükleme");
      ctx.clock.advance(HOUR);
      const pv = await ok(await ctx.api.post(`${URLS.preview}?${q}`, body), "önizleme (geri yüklemeden sonra)");
      assert.deepEqual(skipOf(pv), ["gönderilecek"], "yalnız defterde kalan belirsiz deneme yeni gönderimi ELEMEZ (ek soru 1/4)");
      const r = await ctx.api.post(`${URLS.batches}/${main.batch.id}/retry-failed?${q}`, {});
      assert.deepEqual([r.status, r.data.summary?.skipped], [400, { "Sonucu Belirsiz": 1 }], "Başarısızları Yeniden Dene'de defterdeki belirsiz yine eler (değişmez)");
      assert.match(r.data.error, /göndermek için yeni gönderim başlatın\./, "ileti yeni gönderimi söyler");
      const before2 = count(ctx);
      const fresh = await ok(await ctx.api.post(`${URLS.batches}?${q}`, body), "yeni gönderim");
      await ctx.drain();
      assert.deepEqual((await ctx.api.get(`${URLS.batches}/${fresh.batch.id}?${q}`)).data.data.jobs.map(job => job.state), ["accepted"], "yeni gönderim kabul");
      assert.equal(count(ctx), before2 + 1, "ileti gitti");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 İş G ek 2/4 — çakışan eleme nedenleri: Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi", () => {
  it("yeni toplu iş: R3 + Sonucu Belirsiz → 'Sonucu Belirsiz', R3 sayısına girmez; R3'te Yine de Gönder seçilse de gitmez", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      await accepted(ctx, body, "ilk ekstre (R3)");
      ctx.clock.advance(HOUR);
      await uncertainVia(ctx, () => ctx.batch({ ...body, sendAgain: true }));
      ctx.clock.advance(HOUR);
      for (const extra of [{}, { sendAgain: true }]) {
        const pv = await ok(await ctx.api.post(URLS.preview, { ...body, ...extra }), `önizleme ${JSON.stringify(extra)}`);
        assert.deepEqual(skipOf(pv), ["Sonucu Belirsiz"], `${JSON.stringify(extra)}: Sonucu Belirsiz, Daha Önce Gönderildi'den önce`);
        assert.equal(pv.alreadySent?.count, 0, `${JSON.stringify(extra)}: R3 uyarısına girmez`);
        assertOnly(await ctx.batch({ ...body, ...extra }), "Sonucu Belirsiz", `yeni gönderim ${JSON.stringify(extra)}`);
      }
      assert.equal(count(ctx), 2, "ilk + belirsiz; üçüncü ileti gitmedi");
    } finally {
      await ctx.close();
    }
  });

  it("yeni toplu iş: R3 + Zaten Kuyrukta → 'Zaten Kuyrukta' (R3 sayısına girmez); Zaten Kuyrukta + Sonucu Belirsiz (+ R3) → 'Zaten Kuyrukta'; işteki Yine de Gönder'in açtığı iş de aynı sıra", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      await accepted(ctx, body, "ilk ekstre (R3)");
      ctx.clock.advance(HOUR);
      const u = await uncertainVia(ctx, () => ctx.batch({ ...body, sendAgain: true }));
      ctx.clock.advance(HOUR);
      await pendingVia(ctx, () => anyway(ctx, u.job.id));
      ctx.clock.advance(HOUR);
      for (const extra of [{}, { sendAgain: true }]) {
        const pv = await ok(await ctx.api.post(URLS.preview, { ...body, ...extra }), `önizleme ${JSON.stringify(extra)}`);
        assert.deepEqual(skipOf(pv), ["Zaten Kuyrukta"], `${JSON.stringify(extra)}: üç neden çakışınca Zaten Kuyrukta`);
        assert.equal(pv.alreadySent?.count, 0, `${JSON.stringify(extra)}: Zaten Kuyrukta ile elenen R3 uyarısına girmez`);
      }
      assertOnly(await anyway(ctx, u.job.id), "Zaten Kuyrukta", "işteki ikinci Yine de Gönder (süren iş varken)");
      heal(ctx);
    } finally {
      await ctx.close();
    }
  });

  it("Başarısızları Yeniden Dene: R3 + Sonucu Belirsiz → 'Sonucu Belirsiz' (R3 sayısına girmez)", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const main = await failed(ctx, body, "asıl iş");
      ctx.clock.advance(HOUR);
      const u = await uncertainVia(ctx, () => ctx.batch(body));
      ctx.clock.advance(HOUR);
      const sent = await ok(await anyway(ctx, u.job.id), "işteki Yine de Gönder (R3 doğar)");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(sent.batch.id)).map(job => job.state), ["accepted"], "ön koşul: kabul (R3)");
      ctx.clock.advance(HOUR);
      assertOnly(await retry(ctx, main.batch.id), "Sonucu Belirsiz", "Yeniden Dene (R3 + belirsiz)");
    } finally {
      await ctx.close();
    }
  });

  it("Başarısızları Yeniden Dene: Zaten Kuyrukta + Sonucu Belirsiz → 'Zaten Kuyrukta'", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const main = await failed(ctx, body, "asıl iş");
      ctx.clock.advance(HOUR);
      const u = await uncertainVia(ctx, () => ctx.batch(body));
      ctx.clock.advance(HOUR);
      await pendingVia(ctx, () => anyway(ctx, u.job.id));
      ctx.clock.advance(HOUR);
      assertOnly(await retry(ctx, main.batch.id), "Zaten Kuyrukta", "Yeniden Dene (süren iş + belirsiz)");
      heal(ctx);
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 İş G ek 3/4 — Ödeme Hatırlatma'da Sonucu Belirsiz eşliği aynı YEREL gün (gece yarısı)", () => {
  /** 20.12.2026 23:00 yerel: gecikmiş taksitli cari. */
  async function reminderCtx() {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    const p = await ctx.account("Burak Kaya", "0533 444 55 66");
    await ok(await ctx.api.post("/api/workspace/plans", { accountId: p.id, name: "Taksit", total: "3000", count: 3, firstDue: "2026-11-15", startDate: "2026-11-03" }), "taksit kartı");
    ctx.clock.set(localIso(2026, 12, 20, 23, 0));
    return { ctx, p, body: { kind: "reminder", ids: [p.id] } };
  }

  it("yeni toplu iş: 23:30'da belirsiz kalan hatırlatma 23:50'de (aynı yerel gün) yeni hatırlatmayı eler, 00:10'da (ertesi yerel gün) elemez", async () => {
    const { ctx, body } = await reminderCtx();
    try {
      ctx.clock.set(localIso(2026, 12, 20, 23, 30));
      await uncertainVia(ctx, () => ctx.batch(body));
      ctx.clock.set(localIso(2026, 12, 20, 23, 50));
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "23:50")), ["Sonucu Belirsiz"], "aynı yerel gün → eler");
      ctx.clock.set(localIso(2026, 12, 21, 0, 10));
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "00:10")), ["gönderilecek"], "ertesi yerel gün → elemez (UTC günü aynı olsa da)");
    } finally {
      await ctx.close();
    }
  });

  it("Başarısızları Yeniden Dene: 23:30'da belirsiz kalan yeniden deneme 23:50'de ikinci yeniden denemeyi eler, 00:10'da elemez (gider)", async () => {
    const { ctx, body } = await reminderCtx();
    try {
      ctx.clock.set(localIso(2026, 12, 20, 23, 20));
      const main = await failed(ctx, body, "asıl hatırlatma");
      ctx.clock.set(localIso(2026, 12, 20, 23, 30));
      await uncertainVia(ctx, () => retry(ctx, main.batch.id));
      ctx.clock.set(localIso(2026, 12, 20, 23, 50));
      const r2 = await retry(ctx, main.batch.id);
      assert.deepEqual([r2.status, r2.data.summary?.skipped], [400, { "Sonucu Belirsiz": 1 }], "aynı yerel gün → eler");
      ctx.clock.set(localIso(2026, 12, 21, 0, 10));
      const r3 = await ok(await retry(ctx, main.batch.id), "00:10 yeniden deneme");
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(r3.batch.id)).map(job => job.state), ["accepted"], "ertesi yerel gün → yeniden deneme gider");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.8 İş G ek 4/4 — Son 3 Ay Başarısızları Yeniden Dene: sonraki kabul 7 gün içindeyse elenir, eskiyse gider", () => {
  for (const [label, gap, want] of [["6 gün 23 saat", 6 * DAY + 23 * HOUR, "Daha Önce Gönderildi"], ["7 gün 1 saat", 7 * DAY + HOUR, "gider"]]) {
    it(`asıl Son 3 Ay işinde P Başarısız → başka işle kabul → ${label} sonra Yeniden Dene: ${want}`, async () => {
      const ctx = await startWa({ now: NOW });
      try {
        const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
        const body = { kind: "statement", ids: [p.id], preset: "last3" };
        const main = await failed(ctx, body, "asıl iş (Son 3 Ay)");
        ctx.clock.advance(HOUR);
        await accepted(ctx, body, "başka iş (Son 3 Ay)");
        ctx.clock.advance(gap);
        const res = await retry(ctx, main.batch.id);
        if (want === "gider") {
          assert.equal(res.status, 200, `7 günden eski kabul elemez (geldi ${res.status} ${JSON.stringify(res.data)})`);
          await ctx.drain();
          assert.deepEqual((await ctx.jobs(res.data.data.batch.id)).map(job => job.state), ["accepted"], "yeniden deneme gitti");
        } else {
          assert.deepEqual([res.status, res.data.summary?.skipped], [400, { "Daha Önce Gönderildi": 1 }], "7 gün içindeki kabul → Daha Önce Gönderildi");
        }
      } finally {
        await ctx.close();
      }
    });
  }
});
