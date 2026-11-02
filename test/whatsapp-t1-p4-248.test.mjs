// 2.4.8 T1 (kâhin karşılaştırması) P4 — GECICI-02-bes-art-arda: art arda 5 geçici hatada (131016) duraklayan toplu işte 5. hatayı ALAN iş de "Duraklatıldı"
// oluyordu. Beklenen (plan §7a 13: "Duraklayan toplu işte hatayı alan iş 'Başarısız' (kodlu), bekleyenler 'Duraklatıldı'"; §7a 15 "5 kez art arda" sayacı):
// 5. hatayı alan iş Başarısız (Meta hata kodu 131016), öbürleri Duraklatıldı; Başarısız işin PDF'i kesin durumda Meta'dan silinir (S3 A).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startWa } from "./whatsapp-248-ortak.mjs";

const metaError = (code, message = "hata") => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "Abc" } });

describe("2.4.8 T1 P4 — art arda 5 geçici hata: hatayı alan iş Başarısız, bekleyenler Duraklatıldı", () => {
  it("A, B, C her ileti isteğinde 131016: A(1) B(2) C(3) → 30 sn → A(4) B(5) → toplu iş duraklar; B Başarısız (131016), A ve C Duraklatıldı; B'nin PDF'i silinir", async () => {
    const ctx = await startWa();
    try {
      const ids = [];
      for (const [name, phone] of [["Ayşe Yılmaz", "0532 111 22 33"], ["Burak Kaya", "0533 444 55 66"], ["Cem Ak", "0534 777 88 99"]]) ids.push((await ctx.account(name, phone, 500)).id);
      ctx.fake.state.failNext = { match: /\/messages$/, status: 500, body: metaError(131016, "Service unavailable"), sticky: true };
      const res = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      const id = res.data.data.batch.id;
      await ctx.drain();
      ctx.clock.advance(31_000);
      await ctx.drain();
      const detail = await ctx.detail(id);
      assert.equal(ctx.messageRequests().length, 5, "beş ileti isteği (hepsi 131016)");
      assert.equal(detail.state, "paused");
      assert.equal(detail.pauseCode, "meta-unreachable");
      const byName = Object.fromEntries(detail.jobs.map(job => [job.accountName, job]));
      assert.equal(byName["Burak Kaya"].state, "failed", `5. hatayı alan iş Başarısız olmalı (geldi ${byName["Burak Kaya"].state})`);
      assert.equal(byName["Burak Kaya"].errorCode, 131016);
      assert.equal(byName["Ayşe Yılmaz"].state, "paused");
      assert.equal(byName["Cem Ak"].state, "paused");
      assert.equal(byName["Burak Kaya"].mediaDeleted, true, "Başarısız işin PDF'i Meta'dan silindi (S3 A)");
      assert.equal(ctx.fake.state.deleted.length, 1);
    } finally {
      await ctx.close();
    }
  });
});
