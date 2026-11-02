// 2.4.8 T2 dar kontrol ORTA-2 (bağımsız dar kontrol DK-5 betiğinden kalıcılaştırıldı): Meta Bekletti (131049) işinin yeniden denemesinde ESKİ wamid işte kalıyordu →
//   - 2. deneme Sonucu Belirsiz iken 1. denemenin (Meta'nın yinelediği) 131049 bildirimi işi BAŞARISIZ yapıyor ve defterde 2. denemenin kilidini çözüyordu → aynı dönem
//     yeniden seçilince ileti ÜÇÜNCÜ kez gidiyordu (2. deneme Meta'da kabul edilmiş olabilir: çift ileti riski, §7a 3);
//   - Sonucu Belirsiz 2. deneme imzalı kancayla (iş kimliği biz_opaque_callback_data) ÇÖZÜLEMİYORDU (aday yalnız wamid'i boş işte aranıyor).
// Beklenen: wamid'in ait olduğu deneme defterden okunur (yalnız o denemeye yazılır); yeni denemede işteki wamid boşaltılır.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + programın durum bildirimi çekirdeği + sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const PERIOD = { from: "2026-11-01", to: "2026-11-03" };
const status = (ctx, wamid, value, extra = {}) => ({ id: wamid, status: value, timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905321112233", ...extra });
const failed = (ctx, wamid, code, extra = {}) => status(ctx, wamid, "failed", { errors: [{ code, title: "x", message: "x", error_data: { details: "x" } }], ...extra });

/** 1. deneme kabul → kancada 131049 (Meta Bekletti) → 24 saat sonra 2. deneme yanıtsız kalır (Sonucu Belirsiz). */
async function secondUncertain() {
  const ctx = await startWa();
  try {
    const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
    const id = (await ctx.batch({ kind: "statement", ids: [a.id], ...PERIOD })).data.data.batch.id;
    await ctx.drain();
    const w1 = (await ctx.jobs(id))[0].wamid;
    assert.ok(w1, "ön koşul: 1. deneme kabul edildi");
    assert.equal(ctx.statuses([failed(ctx, w1, 131049)]).applied, 1);
    ctx.clock.advance(24 * HOUR + 60_000);
    ctx.fake.state.dropAfter = /\/messages$/;
    await ctx.drain();
    ctx.fake.state.dropAfter = null;
    const job = ctx.store.get("SELECT * FROM wa_jobs WHERE batch_id = ?", id);
    assert.equal(job.state, "uncertain", "ön koşul: 2. deneme Sonucu Belirsiz");
    assert.equal(job.attempt, 2);
    assert.equal(ctx.messageRequests().length, 2);
    return { ctx, id, job, w1, account: a };
  } catch (error) {
    await ctx.close();
    throw error;
  }
}

describe("2.4.8 T2 dar kontrol ORTA-2 — eski denemenin wamid'i yeni denemeye yazılmaz; belirsiz yeni deneme imzalı kancayla çözülür", () => {
  it("yeni denemede işteki wamid boşaltılır", async () => {
    const { ctx, w1, job } = await secondUncertain();
    try {
      assert.notEqual(job.wamid, w1, "Sonucu Belirsiz 2. denemede 1. denemenin wamid'i işte kalmamalı");
    } finally {
      await ctx.close();
    }
  });

  it("1. denemenin yinelenen 131049 bildirimi (imzasız): iş Sonucu Belirsiz kalır, defterde 2. denemenin kilidi çözülmez, aynı dönem yeniden gitmez", async () => {
    const { ctx, id, job, w1, account } = await secondUncertain();
    try {
      ctx.statuses([failed(ctx, w1, 131049)]);
      const after = ctx.store.get("SELECT state FROM wa_jobs WHERE id = ?", job.id);
      assert.equal(after.state, "uncertain", `1. denemenin bildirimi 2. denemeye yazılmamalı (geldi ${after.state})`);
      const second = ctx.wa.ledger.attempts(job.id).find(row => row.attempt === 2);
      assert.notEqual(second?.outcome, "failed", `2. denemenin defter kilidi çözülmemeli (${JSON.stringify(ctx.wa.ledger.attempts(job.id))})`);
      const again = await ctx.batch({ kind: "statement", ids: [account.id], ...PERIOD });
      // Kilit çözülmediyse kişi "Daha Önce Gönderildi" ile elenir (toplu iş açılmaz); eski kodda toplu iş açılıp ileti üçüncü kez gidiyordu.
      assert.ok(again.status === 200 || again.data?.code === "whatsapp-nothing", JSON.stringify(again.data));
      await ctx.drain();
      assert.equal(ctx.messageRequests().length, 2, "Meta'da kabul edilmiş olabilecek 2. deneme varken ileti üçüncü kez gitmemeli");
      assert.equal((await ctx.detail(id)).jobs[0].state, "uncertain");
    } finally {
      await ctx.close();
    }
  });

  it("1. denemenin İMZALI bildirimi (iş kimliğiyle) da 2. denemeye yazılmaz", async () => {
    const { ctx, job, w1 } = await secondUncertain();
    try {
      ctx.statuses([failed(ctx, w1, 131049, { biz_opaque_callback_data: job.id })], { signed: true });
      const after = ctx.store.get("SELECT state FROM wa_jobs WHERE id = ?", job.id);
      assert.equal(after.state, "uncertain", `eski wamid'li imzalı bildirim 2. denemeye yazılmamalı (geldi ${after.state})`);
    } finally {
      await ctx.close();
    }
  });

  it("Sonucu Belirsiz 2. deneme, kendi wamid'iyle gelen İMZALI bildirimle (iş kimliği) çözülür", async () => {
    const { ctx, job } = await secondUncertain();
    try {
      const out = ctx.statuses([status(ctx, "wamid.IKINCI-DENEME", "delivered", { biz_opaque_callback_data: job.id })], { signed: true });
      const after = ctx.store.get("SELECT state, wamid FROM wa_jobs WHERE id = ?", job.id);
      assert.equal(after.state, "delivered", `imzalı bildirim belirsiz 2. denemeyi çözmeli (geldi ${after.state}; ${JSON.stringify(out)})`);
      assert.equal(after.wamid, "wamid.IKINCI-DENEME");
    } finally {
      await ctx.close();
    }
  });
});
