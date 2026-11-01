// 2.4.8 İş Q5 (T1 G5-02): R3 "Daha Önce Gönderildi" tarihi (alreadySent.last, kişi satırı sentBefore) SON kabul edilen denemenin anıdır. accepts iş başına tek satırdır ve
// İLK kabul edilen denemeden kalır: "Meta Bekletti" (131049) → 24 saat sonra 2. deneme kabul edilince tarih 1. denemeyi gösteriyordu. Pencereler (Son 3 Ay / Tüm
// Hareketler, since) aynı andan okunur.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { deliveryTtlSeconds } from "../server/lib/whatsapp/templates.mjs";
import { removeTestDir } from "./helpers.mjs";
import { URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

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

  // İş R4 + R8 (dar kontrol 12): 131049 sonrası 2. deneme Sonucu Belirsiz → imzalı kanca çözer. Dosyadaki accepted_at 1. denemede kalıyordu.
  /** Son 3 Ay: 1. deneme kabul → 131049 → 24 sa sonra 2. deneme belirsiz → imzalı bildirim (value) çözer. Dönüş: { body, first, resolvedAt, jobId, batchId }. */
  async function secondResolvedByHook(ctx, value) {
    const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
    const body = { kind: "statement", ids: [p.id], preset: "last3" };
    const o = await ok(await ctx.batch(body), "ilk gönderim");
    await ctx.drain();
    const first = (await ctx.jobs(o.batch.id))[0];
    ctx.clock.advance(60_000);
    ctx.statuses([{ id: first.wamid, status: "failed", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }]);
    ctx.clock.advance(24 * HOUR + 60_000);
    ctx.fake.state.dropAfter = /\/messages$/;
    await ctx.drain();
    ctx.fake.state.dropAfter = null;
    const second = (await ctx.jobs(o.batch.id))[0];
    assert.deepEqual([second.attempt, second.state], [2, "uncertain"], "ön koşul: 2. deneme belirsiz");
    ctx.clock.advance(4 * 60_000);
    const wamid2 = ctx.messages().filter(item => item.to === P_TEL).at(-1).wamid;
    const resolvedAt = new Date(Math.floor(ctx.clock().getTime() / 1000) * 1000).toISOString();
    const hook = ctx.statuses([{ id: wamid2, status: value, timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566", biz_opaque_callback_data: second.id }], { signed: true });
    assert.equal(hook.applied, 1, `ön koşul: imzalı ${value} uygulandı`);
    return { body, first, resolvedAt, jobId: second.id, batchId: o.batch.id };
  }

  it("R4: 2. deneme imzalı bildirimle çözülünce aynı bilgisayar VE taşınan veri (defter yok) 'Daha Önce Gönderildi', aynı tarih (2. denemenin anı)", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "destekofis-r4-tasinan-"));
    const dataDir = path.join(root, "data");
    let ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true }, dataDir });
    try {
      const { body, first, resolvedAt, batchId } = await secondResolvedByHook(ctx, "delivered");
      assert.equal((await ctx.jobs(batchId))[0].acceptedAt, resolvedAt, "dosyada accepted_at 2. denemenin anı");
      ctx.clock.set(new Date(Date.parse(first.acceptedAt) + 7 * 24 * HOUR + 12 * HOUR).toISOString());
      const here = await ok(await ctx.api.post(URLS.preview, body), "aynı bilgisayar");
      assert.equal(here.alreadySent?.count, 1, "ön koşul: aynı bilgisayarda Daha Önce Gönderildi");
      const nowIso = ctx.clock().toISOString();
      await ctx.close();
      ctx = null;
      const moved = path.join(root, "tasindi");
      cpSync(dataDir, moved, { recursive: true });
      for (const name of readdirSync(moved)) if (name.startsWith("whatsapp-gonderim.sqlite")) rmSync(path.join(moved, name), { force: true });
      ctx = await startWa({ now: { time: nowIso, fixed: true }, dataDir: moved, connect: false, ack: false });
      const there = await ok(await ctx.api.post(URLS.preview, body), "taşınan veri");
      assert.equal(there.alreadySent?.count, 1, `taşınan veride de Daha Önce Gönderildi (geldi ${JSON.stringify(there.alreadySent)})`);
      assert.equal(there.alreadySent.last, here.alreadySent.last, "iki yol aynı anı okur");
    } finally {
      await ctx?.close();
      removeTestDir(root);
    }
  });

  it("R8: 2. deneme imzalı 'sent' ile çözüldü → 'Süresi Doldu' 2. denemenin anından ölçülür (1. denemenin TTL'i dolunca iş beklemede kalır)", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true } });
    try {
      const { first, resolvedAt, jobId, batchId } = await secondResolvedByHook(ctx, "sent");
      const ttl = deliveryTtlSeconds(ctx.store, WABA, "destekofis_ekstre") * 1000;
      ctx.clock.set(new Date(Date.parse(first.acceptedAt) + ttl + HOUR + 60_000).toISOString());
      assert.ok(ctx.clock().getTime() < Date.parse(resolvedAt) + ttl + HOUR, "ön koşul: saat iki sürenin arasında");
      ctx.statuses([]); // bildirim yolu çalışıyor (Süresi Doldu yalnız o zaman)
      await ctx.wa.scheduler.maintain();
      assert.equal((await ctx.jobs(batchId))[0].state, "sent", "1. denemenin süresi doldu diye iş Süresi Doldu yapılmadı");
      assert.notEqual(ctx.wa.ledger.attempts(jobId).at(-1).outcome, "failed", "defterde teslim edilemedi yazılmadı");
      ctx.clock.set(new Date(Date.parse(resolvedAt) + ttl + HOUR + 60_000).toISOString());
      ctx.statuses([]);
      await ctx.wa.scheduler.maintain();
      assert.equal((await ctx.jobs(batchId))[0].state, "expired", "2. denemenin süresi dolunca Süresi Doldu");
    } finally {
      await ctx.close();
    }
  });

  it("R4: 2. denemenin kabulü dosyaya yazılamadı (Gönderiliyor'da kaldı) → bakım defterdeki kabulle çözer; accepted_at 2. denemenin defterdeki kabul anı", async () => {
    let fail = false;
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true }, whatsappFault: point => fail && point === "db-accept" });
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const o = await ok(await ctx.batch({ kind: "statement", ids: [p.id], preset: "thisMonth" }), "ilk gönderim");
      await ctx.drain();
      const first = (await ctx.jobs(o.batch.id))[0];
      ctx.clock.advance(60_000);
      ctx.statuses([{ id: first.wamid, status: "failed", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445566", errors: [{ code: 131049, title: "x" }] }]);
      ctx.clock.advance(24 * HOUR + 60_000);
      fail = true;
      await ctx.wa.scheduler.runOnce();
      fail = false;
      const stuck = (await ctx.jobs(o.batch.id))[0];
      assert.deepEqual([stuck.attempt, stuck.state], [2, "sending"], "ön koşul: 2. denemenin kabulü dosyaya yazılamadı");
      // İş S2 (ders 38): kabul anı defter DOSYASINDAN okunur (program API'sine bağlı değil — eski kodda ön koşul değil asıl iddia kırmızı olsun).
      const reader = new DatabaseSync(ctx.wa.ledger.file, { readOnly: true });
      let ledgerAt;
      try {
        ledgerAt = reader.prepare("SELECT at FROM outcomes WHERE job_id = ? AND attempt = 2 AND outcome = 'accepted'").get(stuck.id)?.at;
      } finally {
        reader.close();
      }
      assert.ok(ledgerAt && ledgerAt > first.acceptedAt, `ön koşul: defterde 2. denemenin kabulü (${ledgerAt}, 1. ${first.acceptedAt})`);
      ctx.clock.advance(10 * 60_000);
      await ctx.wa.scheduler.maintain();
      const after = (await ctx.jobs(o.batch.id))[0];
      assert.deepEqual([after.state, after.acceptedAt], ["accepted", ledgerAt], `accepted_at 2. denemenin kabulü (1. deneme ${first.acceptedAt})`);
      assert.equal(ctx.messages().length, 2, "üçüncü istek yok");
    } finally {
      await ctx.close();
    }
  });
});
