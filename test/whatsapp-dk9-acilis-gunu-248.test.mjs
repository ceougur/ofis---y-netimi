// 2.4.8 dar kontrol 9 ORTA-1 (yeniden üretildi; ★ soru 4 kararının eksik uygulanması): özel aralığın "o gün" hazır seçime eşitliği TOPLU İŞİN AÇILDIĞI yerel güne göre
// (BAŞ MİMAR yorumu: "o gün" = özel aralığın kullanıldığı gün = toplu işin açılışı). Önceden talebin anahtar kümesi GÖNDERİM gününe göre hesaplanıyordu: günlük sınırla
// ertesi güne kalan ya da Meta Bekletti'nin ertesi gün 2. denemesiyle giden kişi "Bu Ay" ile aynı dönem sayılmıyor, ona ikinci ekstre gidiyordu; taşınan veride de aynı.
// Değişmeyen: Zaten Kuyrukta zaten açılış gününe bakıyordu; o gün hazır seçime eşit olmayan özel aralık ayrı dönem; hatırlatmanın gün kuralı (gönderim / yeniden deneme
// günü) bu dosyanın konusu değil (test/whatsapp-dk8-g-ek-248.test.mjs, test/whatsapp-dk8-g-son-248.test.mjs).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat, gece yarısı (yerel ≠ UTC günü; ders 13, 22); dosya TZ=UTC ve
// TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { removeTestDir } from "./helpers.mjs";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const A_TEL = "+905321112233";
const B_TEL = "+905334445566";
const localIso = (y, m, d, h = 10, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).toISOString();
const skipOf = data => Object.fromEntries((data?.people || []).map(person => [person.name, person.skip || "gönderilecek"]));
const count = (ctx, phone) => ctx.messages().filter(item => item.to === phone).length;
const ts = ctx => String(Math.floor(ctx.clock().getTime() / 1000));
const CUSTOM = { from: "2026-11-01", to: "2026-11-03" };

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

/**
 * 03.11 23:30 (yerel): günlük sınır 1; özel 01.11–03.11 (o gün "Bu Ay") ile A ve B'ye tek toplu iş. A hemen gider; B sınırda bekler, 05.11 00:30 (yerel; İstanbul'da UTC günü
 * 04.11) gider. Dönüş: { a, b, batchId }.
 */
async function spreadOverDays(ctx) {
  await ok(await ctx.api.put(URLS.sending, { dailyCap: 1 }), "günlük sınır 1");
  const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
  const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
  ctx.clock.set(localIso(2026, 11, 3, 23, 30));
  const o = await ok(await ctx.batch({ kind: "statement", ids: [a.id, b.id], ...CUSTOM }), "özel aralık toplu iş (03.11)");
  await ctx.drain();
  assert.deepEqual([count(ctx, A_TEL), count(ctx, B_TEL)], [1, 0], "ön koşul: A gitti, B sınırda bekliyor");
  ctx.clock.set(localIso(2026, 11, 4, 10, 0));
  const queued = await ok(await ctx.api.post(URLS.preview, { kind: "statement", ids: [b.id], preset: "thisMonth" }), "04.11 Bu Ay önizlemesi (B beklerken)");
  assert.deepEqual(skipOf(queued), { "Burak Kaya": "Zaten Kuyrukta" }, "B beklerken Bu Ay 'Zaten Kuyrukta' (açılış günü; değişmeyen)");
  ctx.clock.set(localIso(2026, 11, 5, 0, 30));
  await ctx.drain();
  assert.deepEqual([count(ctx, A_TEL), count(ctx, B_TEL)], [1, 1], "ön koşul: B 05.11 00:30'da gitti (gönderim günü ≠ açılış günü)");
  await ok(await ctx.api.put(URLS.sending, { dailyCap: null }), "sınır kaldırıldı");
  return { a, b, batchId: o.batch.id };
}

describe("2.4.8 dar kontrol 9 ORTA-1 — toplu işin dönem anahtarı açıldığı güne göre (★ soru 4)", () => {
  it("günlük sınır: 03.11'de açılan özel 01.11–03.11 işinde ertesi günlere kalan B de 10.11'de 'Bu Ay' ile 'Daha Önce Gönderildi'; ikinci ekstre gitmez", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const { a, b } = await spreadOverDays(ctx);
      ctx.clock.set(localIso(2026, 11, 10, 10, 0));
      const body = { kind: "statement", ids: [a.id, b.id], preset: "thisMonth" };
      const pv = await ok(await ctx.api.post(URLS.preview, body), "10.11 Bu Ay önizlemesi");
      assert.deepEqual(skipOf(pv), { "Ayşe Yılmaz": "Daha Önce Gönderildi", "Burak Kaya": "Daha Önce Gönderildi" }, "iki kişi de aynı dönem (B'nin gönderim günü değil, işin açılış günü)");
      const res = await ctx.batch(body);
      assert.equal(res.status, 400, `yeni toplu iş açılmaz (geldi ${res.status})`);
      await ctx.drain();
      assert.equal(count(ctx, B_TEL), 1, "B'ye ikinci Kasım ekstresi gitmedi");
      // Değişmeyen: 05.11'de açılan özel 01.11–03.11 o günün Bu Ay'ı değil → ayrı dönem (aralık eşliği yine aynı tarihli özel aralıkla).
      const other = await ok(await ctx.api.post(URLS.preview, { kind: "statement", ids: [b.id], from: "2026-11-01", to: "2026-11-02" }), "farklı özel aralık");
      assert.deepEqual(skipOf(other), { "Burak Kaya": "gönderilecek" }, "farklı özel aralık ayrı dönem");
    } finally {
      await ctx.close();
    }
  });

  it("Meta Bekletti: 03.11 23:30 özel 01.11–03.11 → 131049 → 2. deneme 04.11 23:45'te kabul → 10.11 'Bu Ay' 'Daha Önce Gönderildi'", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 23, 30), fixed: true } });
    try {
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const o = await ok(await ctx.batch({ kind: "statement", ids: [b.id], ...CUSTOM }), "özel aralık (03.11)");
      await ctx.drain();
      const job = (await ctx.jobs(o.batch.id))[0];
      assert.equal(job.state, "accepted", "ön koşul: kabul");
      ctx.clock.set(localIso(2026, 11, 3, 23, 40));
      const hook = ctx.statuses([{ id: job.wamid, status: "failed", timestamp: ts(ctx), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }]);
      assert.equal(hook.applied, 1, "ön koşul: Meta Bekletti");
      ctx.clock.set(localIso(2026, 11, 4, 23, 45));
      await ctx.drain();
      const after = (await ctx.jobs(o.batch.id))[0];
      assert.deepEqual([after.state, after.attempt], ["accepted", 2], "ön koşul: 2. deneme ertesi gün kabul");
      ctx.clock.set(localIso(2026, 11, 10, 10, 0));
      const pv = await ok(await ctx.api.post(URLS.preview, { kind: "statement", ids: [b.id], preset: "thisMonth" }), "10.11 Bu Ay");
      assert.deepEqual(skipOf(pv), { "Burak Kaya": "Daha Önce Gönderildi" }, "2. denemenin anahtar kümesi de açılış gününe göre");
    } finally {
      await ctx.close();
    }
  });

  it("taşınan veri: aynı çok günlü gönderim başka bilgisayara (defter olmadan) taşınınca 10.11'de 'Bu Ay' iki kişide 'Daha Önce Gönderildi'", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-dk9-kaynak-"));
    const copy = mkdtempSync(path.join(tmpdir(), "destekofis-dk9-tasindi-"));
    const ctx = await startWa({ dataDir, now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    const fake = ctx.fake;
    let other = null;
    try {
      const { a, b } = await spreadOverDays(ctx);
      await ctx.server.close();
      cpSync(dataDir, copy, { recursive: true });
      for (const name of readdirSync(copy)) if (name.startsWith("whatsapp-gonderim.sqlite")) removeTestDir(path.join(copy, name));
      other = await startWa({ dataDir: copy, fake, connect: false, ack: false, now: { time: localIso(2026, 11, 10, 10), fixed: true } });
      const pv = await ok(await other.api.post(URLS.preview, { kind: "statement", ids: [a.id, b.id], preset: "thisMonth" }), "taşınan veride Bu Ay");
      assert.deepEqual(skipOf(pv), { "Ayşe Yılmaz": "Daha Önce Gönderildi", "Burak Kaya": "Daha Önce Gönderildi" }, "taşınan veride de açılış günü");
    } finally {
      await other?.server.close();
      await fake.close();
      removeTestDir(dataDir);
      removeTestDir(copy);
    }
  });
});
