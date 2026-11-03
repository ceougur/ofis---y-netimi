// 2.4.8 T1 P3 — KULLANICI KARARI P3 = SAYILMAZ (31.10.2026 ~03:20 UTC: "önerilerini yap"): "Süresi Doldu" iş (Meta teslim edemedi; TTL + 1 saat) "Daha Önce Gönderildi"
// (R3) SAYILMAZ — R3 yalnız kişiye ulaşmış ya da ulaşması süren sonuçları sayar (Meta Kabul Etti, Gönderildi, Teslim Edildi, Okundu); Süresi Doldu ve Başarısız gibi
// kişiye ulaşmamış sonuçlar hariç. Önceden süresi dolan kişi aynı dönem için yeni toplu işte "Daha Önce Gönderildi" diye eleniyordu (K0 kâhini CIFT-16: yeni toplu iş
// oluşmadı). Süresi dolduktan sonra Meta geç "delivered" bildirirse ileti kişiye ulaşmıştır → yine "Daha Önce Gönderildi".
// Düzenek: gerçek program (şablonları kendisi açar; Meta listede 3 günlük teslim süresi bildirir — 2.4.9 W-T ön koşulu) + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + programın durum
// bildirimi çekirdeği + sahte saat (ders 13). Bildirim yolu çalışıyor (bir "sent" bildirimi) — süre dolumu yalnız o zaman yazılır (§7a 16).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const APP = "1505264761663625";
const HOUR = 3_600_000;
const ENSURE = "/api/workspace/whatsapp/templates/ensure";

async function sentOnce() {
  const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, appId: APP });
  const ctx = await startWa({ fake, connect: false });
  const close = async () => {
    await ctx.close();
    await fake.close();
  };
  try {
    assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, appId: APP, token: TOKEN })).status, 200);
    assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
    // 2.4.9 W-T — ön koşul bilerek güncellendi (KULLANICI KARARI 03.11.2026, docs/2.4.9-tasarim/W-whatsapp-sablon.md §15): program şablona teslim süresi YAZMAZ;
    // "Süresi Doldu" Meta'nın listede BİLDİRDİĞİ değere bağlıdır. Bu test P3 kuralını sınar (süre değil): Meta 3 günü listede bildirir, Denetle onu okur.
    for (const tpl of fake.state.templates) {
      tpl.status = "APPROVED";
      if (tpl.name.startsWith("destekofis_")) tpl.message_send_ttl_seconds = 259_200;
    }
    assert.equal((await ctx.api.post(ENSURE, {})).status, 200);
    const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
    const body = { kind: "statement", ids: [a.id], preset: "thisMonth" };
    const res = await ctx.batch(body);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    await ctx.drain();
    const job = (await ctx.jobs(res.data.data.batch.id))[0];
    assert.equal(job.state, "accepted", "ön koşul: Meta kabul etti");
    const ts = () => String(Math.floor(ctx.clock.ms() / 1000));
    ctx.statuses([{ id: job.wamid, status: "sent", timestamp: ts() }]);
    return { ctx, fake, close, body, job, ts };
  } catch (error) {
    await close();
    throw error;
  }
}
const previewSkip = async (ctx, body) => {
  const res = await ctx.api.post(URLS.preview, body);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data.data.people[0].skip || "gönderilecek";
};
const expire = async (ctx, job) => {
  ctx.clock.advance(74 * HOUR); // Meta'nın bildirdiği 3 günlük teslim süresi + 1 saat geçti
  await ctx.drain();
  assert.equal((await ctx.jobs(job.batch_id || job.batchId)).find(row => row.id === job.id)?.state, "expired", "ön koşul: iş Süresi Doldu");
};

describe("2.4.8 T1 P3 = SAYILMAZ — Süresi Doldu (ve Başarısız) 'Daha Önce Gönderildi' sayılmaz; kişiye ulaşan sayılır", () => {
  it("Süresi Doldu kişi aynı dönem için yeni toplu işte GÖNDERİLECEK; yeni toplu iş açılır ve ileti bir kez daha gider", async () => {
    const { ctx, close, body, job } = await sentOnce();
    try {
      job.batch_id = ctx.store.get("SELECT batch_id FROM wa_jobs WHERE id = ?", job.id).batch_id;
      await expire(ctx, job);
      assert.equal(await previewSkip(ctx, body), "gönderilecek", "Meta'nın teslim edemediği ileti 'Daha Önce Gönderildi' sayılmamalı");
      const again = await ctx.batch(body);
      assert.equal(again.status, 200, `yeni toplu iş açılmalı (CIFT-16; geldi ${again.status} ${JSON.stringify(again.data?.code || "")})`);
      await ctx.drain();
      assert.equal(ctx.messageRequests().length, 2, "süresi dolan kişiye ikinci ileti gider");
    } finally {
      await close();
    }
  });

  it("Süresi Doldu'dan sonra Meta geç 'delivered' bildirirse ileti ulaşmıştır → 'Daha Önce Gönderildi'", async () => {
    const { ctx, close, body, job, ts } = await sentOnce();
    try {
      job.batch_id = ctx.store.get("SELECT batch_id FROM wa_jobs WHERE id = ?", job.id).batch_id;
      await expire(ctx, job);
      assert.equal(ctx.statuses([{ id: job.wamid, status: "delivered", timestamp: ts() }]).applied, 1);
      assert.equal(await previewSkip(ctx, body), "Daha Önce Gönderildi");
    } finally {
      await close();
    }
  });

  it("Başarısız (kanca: teslim edilemedi 131026) → gönderilecek (mevcut davranış korunur); Teslim Edildi → 'Daha Önce Gönderildi'", async () => {
    const failedCase = await sentOnce();
    try {
      const { ctx, body, job, ts } = failedCase;
      assert.equal(ctx.statuses([{ id: job.wamid, status: "failed", timestamp: ts(), errors: [{ code: 131026, title: "x", message: "x", error_data: { details: "x" } }] }]).applied, 1);
      assert.equal(await previewSkip(ctx, body), "gönderilecek");
    } finally {
      await failedCase.close();
    }
    const deliveredCase = await sentOnce();
    try {
      const { ctx, body, job, ts } = deliveredCase;
      assert.equal(ctx.statuses([{ id: job.wamid, status: "delivered", timestamp: ts() }]).applied, 1);
      assert.equal(await previewSkip(ctx, body), "Daha Önce Gönderildi");
    } finally {
      await deliveredCase.close();
    }
  });
});
