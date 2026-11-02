// 2.4.8 T1 (kâhin karşılaştırması) P6 — CIFT-02 / CIFT-03 (yalnız S3 kısmı): Sonucu Belirsiz iş için "Yine de Gönder" yeni toplu iş açıp PDF'i YENİDEN yüklüyordu ve
// belirsiz işin PDF'i Meta'da silinmeden kalıyordu (S3 A: kesinleşince PDF Meta'dan silinir; belirsiz iş hiç kesinleşmeyebilir). Beklenen (§7a 15 "yeniden denemede
// medya geçerliyse aynısı"; kâhin: medya_yukleme 1, medya_silme 1): Yine de Gönder belirsiz işin dondurulmuş içeriğini ve Meta'daki PDF'ini DEVRALIR (yeniden yükleme
// yok, aynı ileti), PDF'in tek sahibi yeni iştir ve yeni iş kesinleşince Meta'dan BİR kez silinir.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; dropAfter: istek işlenir, yanıt gelmez → Sonucu Belirsiz) + sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startWa } from "./whatsapp-248-ortak.mjs";

const uploads = ctx => ctx.fake.requests.filter(item => item.method === "POST" && /\/media$/.test(item.path)).length;
const delivered = wamid => ({ id: wamid, status: "delivered", timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: "905321112233" });

describe("2.4.8 T1 P6 — Yine de Gönder belirsiz işin PDF'ini devralır; PDF bir kez yüklenir, bir kez silinir", () => {
  it("yanıtsız ileti → Sonucu Belirsiz → Yine de Gönder: aynı medya ve aynı değişkenler; yeni iş teslim edilince PDF Meta'dan bir kez silinir", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      ctx.fake.state.dropAfter = /\/messages$/;
      const res = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      const first = (await ctx.jobs(res.data.data.batch.id))[0];
      assert.equal(first.state, "uncertain", "ön koşul: Sonucu Belirsiz");
      assert.equal(uploads(ctx), 1);
      const again = await ctx.api.post(`/api/workspace/whatsapp/jobs/${first.id}/send-anyway`, { confirm: true });
      assert.equal(again.status, 200, JSON.stringify(again.data));
      await ctx.drain();
      assert.equal(ctx.messages().length, 2);
      const [m1, m2] = ctx.messages();
      assert.equal(uploads(ctx), 1, `Yine de Gönder PDF'i yeniden yüklememeli (yükleme ${uploads(ctx)})`);
      assert.equal(m2.document.id, m1.document.id, "aynı medya (§7a 15)");
      assert.deepEqual(m2.params, m1.params, "aynı ileti");
      const second = (await ctx.jobs(again.data.data.batch.id))[0];
      assert.equal(second.state, "accepted");
      ctx.statuses([delivered(second.wamid)]);
      await ctx.drain();
      assert.equal(ctx.fake.state.deleted.length, 1, `PDF Meta'dan bir kez silindi (geldi ${ctx.fake.state.deleted.length})`);
      assert.equal(ctx.fake.state.media.size, 0, "Meta'da PDF kalmadı");
      assert.equal((await ctx.jobs(res.data.data.batch.id))[0].state, "uncertain", "belirsiz iş kayıtta kalır");
    } finally {
      await ctx.close();
    }
  });
});
