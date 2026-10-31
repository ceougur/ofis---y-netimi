// 2.4.8 dar kontrol 7 DÜŞÜK-1 (zorla üretildi: dk7 yoklaması p-belirsiz.mjs s1-geri-yukleme) — yedek geri yüklenince Sonucu Belirsiz yeniden deneme (R1) şirket dosyasından
// gider, makine defterinde kalır; asıl işin "Başarısızları Yeniden Dene"si kişiyi yine "Sonucu Belirsiz" ile eler (doğru: ileti Meta'ya ulaşmış olabilir), ama ileti
// artık hiçbir yerde olmayan işteki "Yine de Gönder"i gösteriyordu. Şimdi: iş şirket dosyasında Sonucu Belirsiz duruyorsa "Yine de Gönder ya da yeni gönderim", yoksa
// yalnız "yeni gönderim başlatın" (ikisinde de "ileti iki kez gidebilir"). İşin dosyada durduğu durum test/whatsapp-dk6-belirsiz-yeniden-dene-248.test.mjs'te.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_PASSWORD } from "./helpers.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const count = ctx => ctx.messages().filter(item => item.to === P_TEL).length;

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

describe("2.4.8 dar kontrol 7 DÜŞÜK-1 — geri yüklemeden sonra Sonucu Belirsiz elemesinin iletisi var olmayan 'Yine de Gönder'i göstermez", () => {
  it("A Başarısız → yedek → R1 Sonucu Belirsiz → geri yükleme (R1 dosyadan gider) → A'nın Yeniden Dene'si: 'Sonucu Belirsiz' + yalnız 'yeni gönderim başlatın'; yeni gönderim gider", async () => {
    const ctx = await startWa({ maxCompanies: 2, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const created = await ok(await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
      const second = created.company || created;
      const q = `hofCompany=${encodeURIComponent(second.id)}`;
      await ok(await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "bağlantı");
      await ok(await ctx.api.put(`${URLS.ack}?${q}`, { ack: true }), "onay");
      const p = await ok(await ctx.api.post(`/api/workspace/accounts?${q}`, { name: "Burak Kaya", phone: "0533 444 55 66", openingBalance: "800" }), "cari");
      ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
      const a = await ok(await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: [p.id], preset: "thisMonth" }), "asıl iş (A)");
      await ctx.drain();
      ctx.fake.state.recipientErrors = {};
      assert.deepEqual((await ctx.api.get(`${URLS.batches}/${a.batch.id}?${q}`)).data.data.jobs.map(job => job.state), ["failed"], "ön koşul: A'da P Başarısız");
      const backup = (await ok(await ctx.api.post("/api/admin/backups", { scope: "one", companyId: second.id }), "yedek")).backups[0].name;
      ctx.clock.advance(HOUR);
      ctx.fake.state.dropAfter = /\/messages$/;
      const r1 = await ok(await ctx.api.post(`${URLS.batches}/${a.batch.id}/retry-failed?${q}`, {}), "R1");
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      assert.deepEqual((await ctx.api.get(`${URLS.batches}/${r1.batch.id}?${q}`)).data.data.jobs.map(job => job.state), ["uncertain"], "ön koşul: R1 Sonucu Belirsiz");
      assert.equal(count(ctx), 1, "ön koşul: R1'in iletisi Meta'ya ulaştı");
      await ok(await ctx.api.post("/api/admin/backups/restore", { name: backup, company: second.id, confirm: second.code, password: ADMIN_PASSWORD }), "geri yükleme");
      const list = (await ctx.api.get(`${URLS.batches}?${q}&limit=200`)).data.data;
      assert.equal(list.some(batch => batch.id === r1.batch.id), false, "ön koşul: R1 şirket dosyasından gitti");
      assert.equal(list.reduce((n, batch) => n + (batch.counts?.uncertain || 0), 0), 0, "ön koşul: dosyada Sonucu Belirsiz iş (Yine de Gönder düğmesi) yok");
      ctx.clock.advance(HOUR);
      const r2 = await ctx.api.post(`${URLS.batches}/${a.batch.id}/retry-failed?${q}`, {});
      assert.equal(r2.status, 400, `A'nın Yeniden Dene'si açılmamalı (geldi ${r2.status} ${JSON.stringify(r2.data)})`);
      assert.deepEqual(r2.data.summary?.skipped, { "Sonucu Belirsiz": 1 }, "neden Sonucu Belirsiz (defterden; geri yükleme silmez)");
      assert.doesNotMatch(r2.data.error, /Yine de Gönder/, `ileti var olmayan "Yine de Gönder"i göstermez (geldi "${r2.data.error}")`);
      assert.match(r2.data.error, /Bu kişilerin önceki iletisinin sonucu belirsiz \(ileti iki kez gidebilir\); göndermek için yeni gönderim başlatın\./, `ileti yeni gönderimi söyler (geldi "${r2.data.error}")`);
      assert.equal(count(ctx), 1, "P'ye ikinci ileti gitmedi");
      // İletinin söylediği yol gerçekten açık: yeni gönderim P'yi elemez ve gider.
      const fresh = await ok(await ctx.api.post(`${URLS.batches}?${q}`, { kind: "statement", ids: [p.id], preset: "thisMonth" }), "yeni gönderim");
      await ctx.drain();
      assert.deepEqual((await ctx.api.get(`${URLS.batches}/${fresh.batch.id}?${q}`)).data.data.jobs.map(job => job.state), ["accepted"], "yeni gönderim kabul");
      assert.equal(count(ctx), 2, "yeni gönderimin iletisi gitti");
    } finally {
      await ctx.close();
    }
  });
});
