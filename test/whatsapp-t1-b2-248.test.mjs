// 2.4.8 T1 (kâhin karşılaştırması) B2 — ALICI-131049-bir-kez / -iki-kez: Meta'nın kabul ettiği ileti için durum kancasıyla gelen 131049 (ekosistem sağlığı) işi
// doğrudan "Başarısız" yapıyordu (yalnız eşzamanlı yanıttaki 131049 ayrılıyordu). Beklenen (plan §6 W2 + §7a 14; kod listesi META_D0 ecosystemCode): iş "Meta Bekletti
// (24 Saat Sonra Yeniden)", PDF Meta'dan SİLİNMEZ, 24 saat sonra BİR kez AYNI medyayla yeniden gönderilir; ikinci 131049 Başarısız. Alıcı 24 saatlik farklı kişi
// sayacında kalır (kâhin: pencere 1). Başarılı yeniden gönderimde hata kodu temizlenir (§7a 32).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + programın durum bildirimi çekirdeği (queue.applyStatuses) + sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const failed = (wamid, code) => ({ id: wamid, status: "failed", timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: "905321112233", errors: [{ code, title: "Message failed to send because of an unknown error", message: "Sahte", error_data: { details: "Sahte" } }] });
const plain = (wamid, status) => ({ id: wamid, status, timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: "905321112233" });

async function sent() {
  const ctx = await startWa();
  const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
  const res = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const id = res.data.data.batch.id;
  await ctx.drain();
  const job = (await ctx.jobs(id))[0];
  assert.equal(job.state, "accepted");
  return { ctx, id, wamid: job.wamid };
}
const usage = ctx => ctx.wa.ledger.windowUsage(ctx.store.get("SELECT waba_id FROM wa_batches LIMIT 1").waba_id, new Date(ctx.clock().getTime() - 24 * HOUR).toISOString()).count;

describe("2.4.8 T1 B2 — kancayla gelen 131049: Meta Bekletti (24 Saat Sonra Yeniden), aynı medya, bir kez", () => {
  it("ilk 131049 → Meta Bekletti; PDF silinmez; 24 saat dolmadan gitmez; sonra AYNI medyayla bir kez gider, teslimde hata kodu temizlenir", async () => {
    const { ctx, id, wamid } = await sent();
    try {
      const out = ctx.statuses([failed(wamid, 131049)]);
      assert.equal(out.applied, 1);
      await ctx.drain();
      let job = (await ctx.jobs(id))[0];
      assert.equal(job.state, "held", `kancadaki 131049 → Meta Bekletti olmalı (geldi ${job.state})`);
      assert.equal(job.stateLabel, "Meta Bekletti (24 Saat Sonra Yeniden)");
      assert.equal(job.errorCode, 131049);
      assert.equal(ctx.fake.state.deleted.length, 0, "PDF Meta'dan silinmedi");
      assert.equal(usage(ctx), 1, "alıcı 24 saat sayacında kalır");
      ctx.clock.advance(23 * HOUR);
      await ctx.drain();
      assert.equal(ctx.messages().length, 1, "24 saat dolmadan yeniden gönderilmez");
      ctx.clock.advance(2 * HOUR);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "24 saat sonra bir kez yeniden");
      const [first, second] = ctx.messages();
      assert.equal(second.document.id, first.document.id, "aynı medya (§7a 14)");
      assert.equal(ctx.fake.requests.filter(item => item.method === "POST" && /\/media$/.test(item.path)).length, 1, "PDF yeniden yüklenmedi");
      assert.deepEqual(second.params, first.params, "aynı ileti");
      job = (await ctx.jobs(id))[0];
      assert.equal(job.state, "accepted");
      assert.notEqual(job.wamid, wamid);
      ctx.statuses([plain(job.wamid, "delivered")]);
      job = (await ctx.jobs(id))[0];
      assert.equal(job.state, "delivered");
      assert.equal(job.errorCode, null, "başarılı yeniden gönderimde hata kodu temizlendi (§7a 32)");
    } finally {
      await ctx.close();
    }
  });

  it("ikinci 131049 → Başarısız (kodlu); kesin durumda PDF Meta'dan silinir; üçüncü gönderim olmaz", async () => {
    const { ctx, id, wamid } = await sent();
    try {
      ctx.statuses([failed(wamid, 131049)]);
      ctx.clock.advance(24 * HOUR + 60_000);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2);
      let job = (await ctx.jobs(id))[0];
      ctx.statuses([failed(job.wamid, 131049)]);
      await ctx.drain();
      job = (await ctx.jobs(id))[0];
      assert.equal(job.state, "failed", `ikinci 131049 Başarısız (geldi ${job.state})`);
      assert.equal(job.errorCode, 131049);
      assert.equal(ctx.fake.state.deleted.length, 1, "kesinleşince PDF silindi (S3 A)");
      ctx.clock.advance(48 * HOUR);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "üçüncü gönderim yok");
      assert.equal((await ctx.detail(id)).state, "done");
    } finally {
      await ctx.close();
    }
  });
});
