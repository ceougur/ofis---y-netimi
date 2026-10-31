// 2.4.8 T1 P2 (KARAR P2 A, 5 dk yetkisi 31.10.2026 00:05 UTC): toplu iş BAŞLATILIRKEN Meta'ya ulaşılamıyorsa toplu iş açılmaz (bugünkü gibi) ama ileti meta-graph.mjs'in
// "…; sonuç bilinmiyor." metniydi — başlatmada yanıltıcı (hiçbir ileti gitmedi). Beklenen: 502 whatsapp-meta-unreachable + "Meta'ya ulaşılamıyor; gönderim başlatılmadı.
// Bağlantı gelince yeniden başlatın."; hiçbir toplu iş / iş / defter kaydı açılmaz, Meta'ya ileti gitmez; bağlantı dönünce aynı istek başlar.
// Düzenek: gerçek program + yerel sahte Graph (offline: dinleyici kapanır → bağlantı reddi; aynı el — kâhin DEĞİL, ders 5).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startWa } from "./whatsapp-248-ortak.mjs";

describe("2.4.8 T1 P2 — başlatmada Meta'ya ulaşılamıyor: açık ileti, kayıt yok", () => {
  it("Meta'ya ulaşılamıyor → 502 'gönderim başlatılmadı'; wa_batches / wa_jobs / defter boş; bağlantı dönünce başlar", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const body = { kind: "statement", ids: [a.id], preset: "thisMonth", requestId: "p2-istek-0001" };
      await ctx.fake.offline();
      const res = await ctx.batch(body);
      assert.equal(res.status, 502, JSON.stringify(res.data));
      assert.equal(res.data.code, "whatsapp-meta-unreachable");
      assert.equal(res.data.error, "Meta'ya ulaşılamıyor; gönderim başlatılmadı. Bağlantı gelince yeniden başlatın.");
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_batches").n, 0, "toplu iş açılmadı");
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM wa_jobs").n, 0, "iş açılmadı");
      assert.deepEqual(ctx.wa.ledger.liveCompanies(), [], "defterde açık toplu iş yok");
      await ctx.fake.online();
      const ok = await ctx.batch(body);
      assert.equal(ok.status, 200, JSON.stringify(ok.data));
      await ctx.drain();
      assert.equal(ctx.messages().length, 1);
    } finally {
      await ctx.close();
    }
  });
});
