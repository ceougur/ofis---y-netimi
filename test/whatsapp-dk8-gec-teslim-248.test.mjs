// 2.4.8 dar kontrol 8 DÜŞÜK-1 (gerileme b2a28abd) — Meta Bekletti → 2. deneme Meta'ca eşzamanlı reddedildi → 1. denemenin wamid'ine geç "delivered": iş artık o
//   wamid'i taşımaz (2. deneme başlarken silinir); defter teslimi yine yazılır (P3 "geç teslim sayılır"), işin durumu değişmez; başka şirketin kuyruğu ve
//   "delivered/read" dışı durum teslim yazmaz.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); sahte saat (ders 13); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
// Zorla üretildi: dar kontrol 8 yoklaması p-sunucu.mjs s1.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const P_TEL = "+905334445566";
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const metaError = (code, message) => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "x" } });
const countTo = (ctx, tel = P_TEL) => ctx.messages().filter(item => item.to === tel).length;
const skipOf = data => (data?.people || []).map(person => person.skip || "gönderilecek");
const ts = ctx => String(Math.floor(ctx.clock().getTime() / 1000));
const h131049 = (ctx, wamid, recipient = "905334445566") => ({
  id: wamid,
  status: "failed",
  timestamp: ts(ctx),
  recipient_id: recipient,
  errors: [{ code: 131049, title: "This message was not delivered to maintain healthy ecosystem engagement." }],
});

async function ok(res, label) {
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.data;
}

describe("2.4.8 dar kontrol 8 DÜŞÜK-1 — Meta Bekletti'den sonra 2. deneme reddedildi; 1. denemenin wamid'ine geç teslim sayılır", () => {
  /** P Meta Bekletti → 24 saat sonra 2. deneme Meta'ca eşzamanlı reddedilir (131026) → iş Başarısız (2. deneme). */
  async function secondRejected(ctx) {
    const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
    const body = { kind: "statement", ids: [p.id], preset: "thisMonth" };
    const o = await ok(await ctx.batch(body), "O");
    await ctx.drain();
    const pJob = (await ctx.jobs(o.batch.id))[0];
    assert.equal(pJob.state, "accepted", "ön koşul: P kabul");
    ctx.clock.advance(60_000);
    assert.equal(ctx.statuses([h131049(ctx, pJob.wamid)]).applied, 1, "ön koşul: 131049");
    ctx.fake.state.recipientErrors[P_TEL] = { status: 400, body: metaError(131026, "Message undeliverable") };
    ctx.clock.advance(24 * HOUR + 60_000);
    await ctx.drain();
    ctx.fake.state.recipientErrors = {};
    const after = (await ctx.jobs(o.batch.id))[0];
    assert.deepEqual([after.attempt, after.state], [2, "failed"], `ön koşul: 2. deneme Başarısız (${after.attempt} ${after.state})`);
    assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme")), ["gönderilecek"], "ön koşul: teslim yok → sayılmaz (P3)");
    return { o, pJob, body, p };
  }

  it("geç 'delivered' uygulanır: P 'Daha Önce Gönderildi', Bu Ay 1, yeni gönderim gitmez; iş Başarısız kalır", async () => {
    const ctx = await startWa({ now: NOW });
    try {
      const { o, pJob, body } = await secondRejected(ctx);
      ctx.clock.advance(60_000);
      const late = ctx.statuses([{ id: pJob.wamid, status: "delivered", timestamp: ts(ctx), recipient_id: "905334445566" }]);
      assert.equal(late.applied, 1, `1. denemenin wamid'ine geç teslim uygulandı (geldi ${JSON.stringify(late)})`);
      assert.equal((await ctx.jobs(o.batch.id))[0].state, "failed", "işin durumu değişmez (2. deneme Başarısız)");
      const pv = await ok(await ctx.api.post(URLS.preview, body), "önizleme");
      assert.deepEqual(skipOf(pv), ["Daha Önce Gönderildi"], "geç teslim → P sayılır (P3)");
      assert.equal((await ok(await ctx.api.get(URLS.stats), "sayaç")).delivered, 1, "Bu Ay Gönderilen İleti Sayısı 1");
      const before = countTo(ctx);
      const fresh = await ctx.batch(body);
      assert.equal(fresh.status, 400, `yeni gönderim reddedildi (hepsi elendi): ${fresh.status}`);
      await ctx.drain();
      assert.equal(countTo(ctx), before, "P'ye ikinci ileti gitmedi");
      const again = ctx.statuses([{ id: pJob.wamid, status: "read", timestamp: ts(ctx), recipient_id: "905334445566" }]);
      assert.equal(again.unknown, 0, "yinelenen 'read' bilinmeyen sayılmaz");
      assert.equal((await ok(await ctx.api.get(URLS.stats), "sayaç")).delivered, 1, "yinelenen bildirim sayacı artırmaz");
    } finally {
      await ctx.close();
    }
  });

  it("teslim dışı durum ('sent', 'failed') ve başka şirketin kuyruğu teslim YAZMAZ", async () => {
    const ctx = await startWa({ maxCompanies: 2, now: NOW });
    try {
      const queues = new Map();
      const sch = ctx.server.app.whatsapp.scheduler;
      const reg = sch.register.bind(sch);
      sch.register = (key, queue) => {
        queues.set(String(key), queue);
        return reg(key, queue);
      };
      const created = await ok(await ctx.api.post("/api/companies", { name: "Deneme Şirketi", select: false }), "ikinci şirket");
      const second = created.company || created;
      const q = `hofCompany=${encodeURIComponent(second.id)}`;
      await ok(await ctx.api.put(`${URLS.conn}?${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN }), "ikinci şirket bağlantısı");
      const { pJob, body } = await secondRejected(ctx);
      ctx.clock.advance(60_000);
      for (const value of ["sent", "failed"]) {
        const res = ctx.statuses([{ id: pJob.wamid, status: value, timestamp: ts(ctx), recipient_id: "905334445566", ...(value === "failed" ? { errors: [{ code: 131026, title: "x" }] } : {}) }]);
        assert.equal(res.applied, 0, `'${value}' uygulanmaz (${JSON.stringify(res)})`);
      }
      const otherQueue = queues.get(second.id);
      assert.ok(otherQueue, "ön koşul: ikinci şirketin kuyruğu");
      const cross = otherQueue.applyStatuses([{ id: pJob.wamid, status: "delivered", timestamp: ts(ctx), recipient_id: "905334445566" }], { phoneNumberId: PNID });
      assert.deepEqual(cross, { applied: 0, ignored: 0, unknown: 1 }, "başka şirketin kuyruğu bu wamid'i tanımaz");
      assert.equal((await ok(await ctx.api.get(URLS.stats), "sayaç")).delivered, 0, "teslim yazılmadı");
      assert.deepEqual(skipOf(await ok(await ctx.api.post(URLS.preview, body), "önizleme")), ["gönderilecek"], "P sayılmaz");
    } finally {
      await ctx.close();
    }
  });
});
