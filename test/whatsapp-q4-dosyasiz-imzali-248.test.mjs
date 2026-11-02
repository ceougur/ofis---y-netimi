// 2.4.8 İş Q4 (dar kontrol 10 DÜŞÜK-4; "KİME KAÇ KEZ" ilkesi 3): ileti Sonucu Belirsiz kaldı (yanıt kayboldu), sonra Şirket Verisini Sıfırla (Yalnız Hareketler) işi
// şirket dosyasından sildi. Meta'nın İMZALI geç bildirimi (iş kimliği biz_opaque_callback_data + wamid) "unknown" düşüyordu: ileti teslim edilmişken kişi "Daha Önce
// Gönderildi" sayılmıyor, yeni gönderim ikinci ileti gönderiyordu (dar kontrol 10 b4: kişiye 2 ileti; yalnız defterde kalan belirsiz yeni gönderimi elemez — ek soru 1/4). Şimdi imzalı bildirim defterdeki son denemenin sonucunu
// kapatır: "delivered" → "Daha Önce Gönderildi" + Bu Ay Gönderilen; "failed" → teslim edilemedi (yeni gönderim gider). İMZASIZ bildirim bu yolu açmaz (P5 aynen).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

/** P'ye "Bu Ay" → yanıt kayboldu (Sonucu Belirsiz) → Şirket Verisini Sıfırla (Yalnız Hareketler). Dönüş: { p, body, jobId, wamid, ts }. */
async function uncertainThenReset(ctx) {
  const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
  const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
  ctx.fake.state.dropAfter = /\/messages$/;
  const o = await ok(await ctx.batch(body), "ilk gönderim");
  await ctx.drain();
  ctx.fake.state.dropAfter = null;
  const job = (await ctx.jobs(o.batch.id))[0];
  assert.equal(job.state, "uncertain", "ön koşul: Sonucu Belirsiz");
  const wamid = ctx.messages().at(-1)?.wamid;
  assert.ok(wamid, "ön koşul: Meta iletiyi aldı (wamid verdi; yanıt kayboldu)");
  ctx.clock.advance(3_600_000);
  await ok(await ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }), "Şirket Verisini Sıfırla");
  assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs").n, 0, "ön koşul: iş dosyadan silindi");
  ctx.clock.advance(3_600_000);
  return { p, body, jobId: job.id, wamid, ts: () => String(Math.floor(ctx.clock().getTime() / 1000)) };
}

describe("2.4.8 İş Q4 — iş dosyada yokken imzalı geç bildirim sonucu belli olmayan son denemeyi kapatır", () => {
  it("imzalı 'delivered' → kişi 'Daha Önce Gönderildi', Bu Ay Gönderilen 1; yeni gönderim kişiye ikinci ileti göndermez", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const { p, body, jobId, wamid, ts } = await uncertainThenReset(ctx);
      const before = (await ok(await ctx.api.post(URLS.preview, body), "önizleme (bildirimden önce)"));
      // KULLANICI KARARI (ek soru 1/4 "a"): yeni toplu iş, iş dosyada OLMAYAN (yalnız defterde kalan) Sonucu Belirsiz denemeyle elemez.
      assert.deepEqual(skipOf(before), ["gönderilecek"], "ön koşul: bildirimden önce kişi elenmiyor (yalnız defterde belirsiz)");
      const late = ctx.statuses([{ id: wamid, status: "delivered", timestamp: ts(), recipient_id: "905334445566", biz_opaque_callback_data: jobId }], { signed: true });
      assert.equal(late.applied, 1, `imzalı geç bildirim uygulandı (geldi ${JSON.stringify(late)})`);
      ctx.clock.advance(60_000);
      const pv = await ok(await ctx.api.post(URLS.preview, body), "önizleme");
      assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi"], "kişi Daha Önce Gönderildi");
      assert.equal(pv.people.find(item => item.id === p.id || item.accountId === p.id)?.sentBefore ? true : false, true, "son gönderim tarihi var");
      const stats = (await ctx.api.get("/api/workspace/whatsapp/stats")).data.data;
      assert.equal(stats?.delivered, 1, `Bu Ay Gönderilen 1 (geldi ${JSON.stringify(stats)})`);
      const sent = ctx.messages().filter(item => item.to === P_TEL).length;
      const b = await ctx.batch(body);
      if (b.status === 200) await ctx.drain();
      assert.equal(ctx.messages().filter(item => item.to === P_TEL).length, sent, "yeni gönderim kişiye ikinci ileti göndermedi");
      const dup = ctx.statuses([{ id: wamid, status: "read", timestamp: ts(), recipient_id: "905334445566", biz_opaque_callback_data: jobId }], { signed: true });
      // İş T (K1, yinelenen bildirim etkisiz; beklenti bilerek değişti — önce "unknown ya da applied 1"): teslimden sonraki "read" defteri değiştirmez, "değişmedi" sayılır.
      assert.equal(dup.applied, 0, `yinelenen / sonraki bildirim etkisiz (geldi ${JSON.stringify(dup)})`);
      assert.equal((await ctx.api.get("/api/workspace/whatsapp/stats")).data.data.delivered, 1, "Bu Ay 1 kalır");
      // §7a 18: teslimden SONRA gelen "failed" yok sayılır (defterde teslim edilemedi yazılmaz).
      const lateFail = ctx.statuses([{ id: wamid, status: "failed", timestamp: ts(), recipient_id: "905334445566", biz_opaque_callback_data: jobId, errors: [{ code: 131026, title: "x" }] }], { signed: true });
      assert.equal(lateFail.applied, 0, `teslimden sonra gelen failed uygulanmaz (geldi ${JSON.stringify(lateFail)})`);
      assert.deepEqual(ctx.wa.ledger.attempts(jobId).map(item => item.outcome), ["uncertain"], "defterde teslim edilemedi yazılmadı");
    } finally {
      await ctx.close();
    }
  });

  it("imzalı 'failed' → teslim edilemedi: kişi elenmez, yeni gönderim gider", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const { body, jobId, wamid, ts } = await uncertainThenReset(ctx);
      const late = ctx.statuses([{ id: wamid, status: "failed", timestamp: ts(), recipient_id: "905334445566", biz_opaque_callback_data: jobId, errors: [{ code: 131026, title: "Message undeliverable" }] }], { signed: true });
      assert.equal(late.applied, 1, `imzalı geç 'failed' uygulandı (geldi ${JSON.stringify(late)})`);
      const pv = await ok(await ctx.api.post(URLS.preview, body), "önizleme");
      assert.deepEqual(skipOf(pv), ["gönderilecek"], "teslim edilemeyen ileti kişiyi elemez");
      const sent = ctx.messages().filter(item => item.to === P_TEL).length;
      await ok(await ctx.batch(body), "yeni gönderim");
      await ctx.drain();
      assert.equal(ctx.messages().filter(item => item.to === P_TEL).length, sent + 1, "yeni gönderim gitti");
    } finally {
      await ctx.close();
    }
  });

  it("İMZASIZ 'delivered' (P5 aynen) → düşer; kişi 'Daha Önce Gönderildi' sayılmaz", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const { body, jobId, wamid, ts } = await uncertainThenReset(ctx);
      const late = ctx.statuses([{ id: wamid, status: "delivered", timestamp: ts(), recipient_id: "905334445566", biz_opaque_callback_data: jobId }], { signed: false });
      assert.deepEqual([late.applied, late.unknown], [0, 1], `imzasız bildirim uygulanmadı (geldi ${JSON.stringify(late)})`);
      const pv = await ok(await ctx.api.post(URLS.preview, body), "önizleme");
      assert.deepEqual(skipOf(pv), ["gönderilecek"], "imzasız bildirim kişiyi 'Daha Önce Gönderildi' yapmaz");
    } finally {
      await ctx.close();
    }
  });

  it("komşu: KABUL edilmiş iletinin işi sıfırlamayla silindikten sonra gelen geç 'delivered' (wamid defterde) Bu Ay Gönderilen'e yazılır; kişi yine Daha Önce Gönderildi", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const o = await ok(await ctx.batch(body), "ilk gönderim");
      await ctx.drain();
      const job = (await ctx.jobs(o.batch.id))[0];
      assert.equal(job.state, "accepted", "ön koşul: kabul");
      ctx.clock.advance(3_600_000);
      await ok(await ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }), "Şirket Verisini Sıfırla");
      ctx.clock.advance(3_600_000);
      const late = ctx.statuses([{ id: job.wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566" }]);
      assert.equal(late.applied, 1, `geç teslim uygulandı (geldi ${JSON.stringify(late)})`);
      const stats = (await ctx.api.get("/api/workspace/whatsapp/stats")).data.data;
      assert.equal(stats?.delivered, 1, `Bu Ay Gönderilen 1 (geldi ${JSON.stringify(stats)})`);
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme")), ["Daha Önce Gönderildi"], "kişi Daha Önce Gönderildi");
    } finally {
      await ctx.close();
    }
  });

  // İş R7 (dar kontrol 12; ilke 1 + 10:10 / 11:00 kararları): KABUL edilmiş iletinin işi sıfırlamayla silindi; teslimden önce gelen "failed" (131026 / 131049; imzalı ve
  // imzasız) → defterde teslim edilemedi, kişi "Daha Önce Gönderildi" sayılmaz, yeni gönderim gider.
  for (const code of [131026, 131049]) {
    for (const signed of [true, false]) {
      it(`R7: kabul → sıfırla → ${signed ? "imzalı" : "imzasız"} failed ${code} → teslim edilemedi, kişi elenmez, yeni gönderim gider`, async () => {
        const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
        try {
          const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
          const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
          const o = await ok(await ctx.batch(body), "ilk gönderim");
          await ctx.drain();
          const job = (await ctx.jobs(o.batch.id))[0];
          assert.equal(job.state, "accepted", "ön koşul: kabul");
          ctx.clock.advance(3_600_000);
          await ok(await ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }), "Şirket Verisini Sıfırla");
          ctx.clock.advance(60_000);
          const st = ctx.statuses([{ id: job.wamid, status: "failed", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566", ...(signed ? { biz_opaque_callback_data: job.id } : {}), errors: [{ code, title: "x" }] }], { signed });
          assert.equal(st.applied, 1, `geç failed uygulandı (geldi ${JSON.stringify(st)})`);
          assert.deepEqual(ctx.wa.ledger.attempts(job.id).map(item => item.outcome), ["failed"], "defterde teslim edilemedi");
          assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme")), ["gönderilecek"], "kişi elenmez");
          const sent = ctx.messages().filter(item => item.to === P_TEL).length;
          await ok(await ctx.batch(body), "yeni gönderim");
          await ctx.drain();
          assert.equal(ctx.messages().filter(item => item.to === P_TEL).length, sent + 1, "yeni gönderim gitti");
        } finally {
          await ctx.close();
        }
      });
    }
  }

  it("R7 gerileme: teslimden sonra gelen failed (iş dosyada yok) yok sayılır; kişi Daha Önce Gönderildi kalır", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const o = await ok(await ctx.batch(body), "ilk gönderim");
      await ctx.drain();
      const job = (await ctx.jobs(o.batch.id))[0];
      ctx.clock.advance(3_600_000);
      await ok(await ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }), "Şirket Verisini Sıfırla");
      const ts = () => String(Math.floor(ctx.clock().getTime() / 1000));
      assert.equal(ctx.statuses([{ id: job.wamid, status: "delivered", timestamp: ts(), recipient_id: "905334445566" }]).applied, 1, "ön koşul: geç teslim");
      const st = ctx.statuses([{ id: job.wamid, status: "failed", timestamp: ts(), recipient_id: "905334445566", errors: [{ code: 131026, title: "x" }] }]);
      assert.equal(st.applied, 0, `teslimden sonra failed uygulanmaz (geldi ${JSON.stringify(st)})`);
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme")), ["Daha Önce Gönderildi"]);
    } finally {
      await ctx.close();
    }
  });
});
