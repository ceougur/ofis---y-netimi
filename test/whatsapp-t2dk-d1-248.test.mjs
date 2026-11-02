// 2.4.8 T2 dar kontrol D1 (bağımsız dar kontrol DK-2 betiğinden kalıcılaştırıldı): ileti isteği Meta'dayken kullanıcı İptal Et'e basıyor, istek duraklatma sınıfı bir
// hatayla (131031 hesap kilitli / 190 belirteç geçersiz) dönüyordu → toplu iş "İptal"den "Duraklatıldı"ya geçiyordu (kullanıcının iptali kayboluyor; Devam Et görünüyor).
// Beklenen: iptal edilmiş (ya da bitmiş / durdurulmuş) toplu iş yeniden duraklatılmaz; iptal kalır, başka ileti gitmez.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); istek kapıda bekletilir, İptal Et o sırada basılır (yarışın ön koşulu zorla, ders 20).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const metaError = (code, message = "hata") => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "Abc" } });

/** İleti isteğini (POST …/messages) Meta'ya gitmeden bekleten kapı: arm → istek kapıya gelince entered çözülür → open ile bırakılır. */
function gate() {
  let pattern = null;
  let release = null;
  let reached = null;
  let entered = null;
  const fetchImpl = async (url, init = {}) => {
    const line = `${init.method || "GET"} ${new URL(url).pathname}`;
    if (pattern && pattern.test(line)) {
      pattern = null;
      reached?.();
      await new Promise(resolve => (release = resolve));
    }
    return globalThis.fetch(url, init);
  };
  return {
    fetchImpl,
    arm(re) {
      pattern = re;
      entered = new Promise(resolve => (reached = resolve));
    },
    entered: () => entered,
    open: () => release?.(),
  };
}

describe("2.4.8 T2 dar kontrol D1 — istek sürerken İptal Et + Meta duraklatma sınıfı hata: toplu iş İptal kalır", () => {
  for (const code of [131031, 190]) {
    it(`İptal Et basıldı, istek ${code} ile döndü → toplu iş İptal; Devam Et reddedilir; başka ileti gitmez`, async () => {
      const door = gate();
      const ctx = await startWa({ fetchImpl: door.fetchImpl });
      try {
        const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
        const b = await ctx.account("Burak Kaya", "0532 111 22 34", 1250);
        const res = await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" });
        assert.equal(res.status, 200, JSON.stringify(res.data));
        const id = res.data.data.batch.id;
        door.arm(/^POST .*\/messages$/);
        ctx.fake.state.failQueue.push({ match: /^POST .*\/messages$/, status: code === 190 ? 401 : 400, body: metaError(code, "Account locked") });
        const run = ctx.wa.scheduler.runOnce();
        await door.entered();
        assert.equal((await ctx.jobs(id))[0].state, "sending", "ön koşul: istek Meta'da sürüyor");
        assert.equal((await ctx.api.post(`${URLS.batches}/${id}/cancel`, {})).status, 200);
        door.open();
        await run;
        const d = await ctx.detail(id);
        assert.equal(d.state, "canceled", `kullanıcının iptali korunmalı (geldi ${d.state} ${d.pauseCode || ""})`);
        assert.equal(ctx.wa.ledger.batchState(id).reason, "canceled");
        const r = await ctx.api.post(`${URLS.batches}/${id}/resume`, {});
        assert.notEqual(r.status, 200, `iptal edilmiş toplu iş sürdürülemez (geldi ${r.status})`);
        await ctx.drain();
        assert.equal(ctx.messageRequests().length, 1, "iptalden sonra başka ileti isteği gitmemeli");
        assert.equal((await ctx.detail(id)).state, "canceled");
      } finally {
        await ctx.close();
      }
    });
  }
});
