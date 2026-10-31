// 2.4.8 İş Q5 (T1 G5-02): R3 "Daha Önce Gönderildi" tarihi (alreadySent.last, kişi satırı sentBefore) SON kabul edilen denemenin anıdır. accepts iş başına tek satırdır ve
// İLK kabul edilen denemeden kalır: "Meta Bekletti" (131049) → 24 saat sonra 2. deneme kabul edilince tarih 1. denemeyi gösteriyordu. Pencereler (Son 3 Ay / Tüm
// Hareketler, since) aynı andan okunur.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

describe("2.4.8 İş Q5 — 'Daha Önce Gönderildi' tarihi son kabul edilen denemenin anı", () => {
  it("131049 → 24 saat sonra 2. deneme kabul → önizlemede tarih 2. denemenin kabul anı (1. değil); kişi yine elenir", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
      const o = await ok(await ctx.batch(body), "ilk gönderim");
      await ctx.drain();
      const first = (await ctx.jobs(o.batch.id))[0];
      assert.equal(first.state, "accepted", "ön koşul: 1. deneme kabul");
      const firstAt = first.acceptedAt;
      ctx.clock.advance(60_000);
      const ts = String(Math.floor(ctx.clock().getTime() / 1000));
      const hook = ctx.statuses([{ id: first.wamid, status: "failed", timestamp: ts, recipient_id: "905334445566", errors: [{ code: 131049, title: "This message was not delivered to maintain healthy ecosystem engagement." }] }]);
      assert.equal(hook.applied, 1, "ön koşul: 131049");
      ctx.clock.advance(24 * HOUR + 60_000);
      await ctx.drain();
      const second = (await ctx.jobs(o.batch.id))[0];
      assert.deepEqual([second.attempt, second.state], [2, "accepted"], "ön koşul: 2. deneme kabul");
      assert.equal(ctx.messages().filter(item => item.to === P_TEL).length, 2, "ön koşul: iki istek gitti");
      const secondAt = second.acceptedAt;
      assert.ok(Date.parse(secondAt) - Date.parse(firstAt) >= 24 * HOUR, `ön koşul: 2. kabul 24 saatten sonra (${firstAt} → ${secondAt})`);
      ctx.clock.advance(HOUR);
      const pv = await ok(await ctx.api.post(URLS.preview, body), "yeni gönderim önizlemesi");
      assert.equal(pv.alreadySent?.count, 1, `kişi Daha Önce Gönderildi (${JSON.stringify(pv.alreadySent)})`);
      assert.equal(pv.alreadySent.last, secondAt, `tarih 2. denemenin kabul anı (beklenen ${secondAt}, 1. deneme ${firstAt}, geldi ${pv.alreadySent.last})`);
      const person = pv.people.find(item => item.id === p.id || item.accountId === p.id);
      assert.equal(person?.sentBefore, secondAt, `kişi satırında da 2. denemenin anı (geldi ${JSON.stringify(person)})`);
    } finally {
      await ctx.close();
    }
  });

  it("Son 3 Ay (7 günlük pencere): 1. kabul 7 günden eski, 2. deneme 7 gün içinde kabul → kişi 'Daha Önce Gönderildi' (taşınan verideki iş satırı yolu ile aynı)", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [p.id], preset: "last3" };
      const o = await ok(await ctx.batch(body), "ilk gönderim");
      await ctx.drain();
      const first = (await ctx.jobs(o.batch.id))[0];
      assert.equal(first.state, "accepted", "ön koşul: 1. deneme kabul");
      ctx.clock.advance(60_000);
      const hook = ctx.statuses([{ id: first.wamid, status: "failed", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }]);
      assert.equal(hook.applied, 1, "ön koşul: 131049");
      ctx.clock.advance(24 * HOUR + 60_000);
      await ctx.drain();
      const second = (await ctx.jobs(o.batch.id))[0];
      assert.deepEqual([second.attempt, second.state], [2, "accepted"], "ön koşul: 2. deneme kabul");
      // 1. kabulden 7 gün + 12 saat sonra: 1. kabul pencere dışında, 2. kabul (6,5 gün önce) içinde.
      ctx.clock.advance(6 * 24 * HOUR + 12 * HOUR - 2 * 60_000);
      assert.ok(ctx.clock().getTime() - Date.parse(first.acceptedAt) > 7 * 24 * HOUR && ctx.clock().getTime() - Date.parse(second.acceptedAt) < 7 * 24 * HOUR, "ön koşul: saat iki kabulün arasında");
      const pv = await ok(await ctx.api.post(URLS.preview, body), "yeni Son 3 Ay önizlemesi");
      assert.equal(pv.alreadySent?.count, 1, `kişi 7 gün içinde ileti aldı → Daha Önce Gönderildi (geldi ${JSON.stringify(pv.alreadySent)})`);
      assert.equal(pv.alreadySent.last, second.acceptedAt, "tarih 2. denemenin anı");
    } finally {
      await ctx.close();
    }
  });
});
