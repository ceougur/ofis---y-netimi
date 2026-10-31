// 2.4.8 T2 dar kontrol D2 (bağımsız dar kontrol DK-4 / DK-1 (e) betiklerinden kalıcılaştırıldı): "Meta Bekletti" (131049, held) iş + WABA sınır beklemesi (holdWaba)
// birlikteyken işçi boş döngüye giriyordu: sınır beklemesi held işi kapsamadığından aynı iş her turda yeniden seçiliyor, her turda sınırdaki BÜTÜN bekleyen satırlar
// (40/40) yeniden yazılıyordu (Meta'ya istek yok; disk ve işlemci boşa).
// Beklenen: held iş de bekleme bitene dek ileri alınır (durumu korunur); zaten aynı beklemedeki satır yeniden yazılmaz; bekleme bitince held iş bir kez gider.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WABA, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const failed = (ctx, wamid, code) => ({ id: wamid, status: "failed", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905321112233", errors: [{ code, title: "x", message: "x", error_data: { details: "x" } }] });

async function heldJob() {
  const ctx = await startWa();
  try {
    const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
    const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
    await ctx.drain();
    assert.equal(ctx.statuses([failed(ctx, (await ctx.jobs(id))[0].wamid, 131049)]).applied, 1);
    assert.equal((await ctx.jobs(id))[0].state, "held", "ön koşul: Meta Bekletti");
    return { ctx, id };
  } catch (error) {
    await ctx.close();
    throw error;
  }
}

describe("2.4.8 T2 dar kontrol D2 — Meta Bekletti iş + WABA sınır beklemesi: boş döngü yok, satırlar her turda yeniden yazılmaz", () => {
  it("işçi boş döngüye girmez; bekleme bitince Meta Bekletti iş bir kez gider", async () => {
    const { ctx, id } = await heldJob();
    try {
      ctx.wa.ledger.holdWaba(WABA, new Date(ctx.clock().getTime() + 48 * HOUR).toISOString(), "meta-131048", ctx.clock().toISOString());
      ctx.clock.advance(24 * HOUR + 60_000);
      const turns = await ctx.drain({ max: 200, maintain: false });
      assert.ok(turns < 200, `işçi boş döngüye girmemeli (tur ${turns})`);
      assert.equal((await ctx.jobs(id))[0].state, "held", "bekleme sürerken iş Meta Bekletti kalır");
      assert.equal(ctx.messages().length, 1, "bekleme sürerken gitmez");
      ctx.clock.advance(25 * HOUR);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "bekleme bitince bir kez gider");
      assert.equal((await ctx.jobs(id))[0].state, "accepted");
    } finally {
      await ctx.close();
    }
  });

  it("her turda sınırda bekleyen 40 iş yeniden yazılmaz; Meta'ya ileti gitmez", async () => {
    const { ctx, id } = await heldJob();
    try {
      const ids = [];
      for (let i = 10; i < 50; i += 1) ids.push((await ctx.account(`Kişi ${i}`, `0533 000 00 ${i}`, 10)).id);
      ctx.wa.ledger.holdWaba(WABA, new Date(ctx.clock().getTime() + 48 * HOUR).toISOString(), "meta-131048", ctx.clock().toISOString());
      const id2 = (await ctx.batch({ kind: "statement", ids, preset: "thisMonth" })).data.data.batch.id;
      await ctx.drain({ max: 5, maintain: false });
      ctx.clock.advance(24 * HOUR + 60_000);
      const before = ctx.fake.requests.length;
      const rows = [];
      for (let i = 0; i < 5; i += 1) {
        ctx.clock.advance(1000);
        await ctx.wa.scheduler.runOnce();
        const now = ctx.clock().toISOString();
        rows.push(ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE batch_id = ? AND state = 'limited' AND updated_at = ?", id2, now).n);
      }
      assert.deepEqual(rows, [0, 0, 0, 0, 0], `her turda bekleyen işler yeniden yazılmamalı (turlarda yeniden yazılan: ${rows.join(", ")})`);
      // Turlarda Meta'ya ileti gitmez; yalnız dönemsel denetimin (B3–B5: şablon + bağlantı, 10 dakikada bir) okumaları olabilir — tur sayısıyla artmaz.
      const extra = ctx.fake.requests.slice(before).map(r => `${r.method} ${r.path}`);
      assert.equal(extra.filter(line => line.startsWith("POST")).length, 0, `Meta'ya ileti / yazma isteği gitmemeli (${JSON.stringify(extra)})`);
      assert.ok(extra.length <= 2, `turlarda yalnız dönemsel denetim okuması olabilir (${JSON.stringify(extra)})`);
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs WHERE batch_id = ? AND state = 'limited'", id2).n, 40, "ön koşul: 40 iş sınırda bekliyor");
      assert.equal((await ctx.jobs(id))[0].state, "held");
    } finally {
      await ctx.close();
    }
  });
});
