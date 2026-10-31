// 2.4.8 T2 bulgu 2 (ORTA; bağımsız gözden geçirme r1): "İptal Et" / "Duraklat" bir işin Meta'ya giden OKUMA ya da PDF YÜKLEME isteği sürerken basılırsa ileti
// yine de gidiyordu — işçi (lib/whatsapp/queue.mjs step) bekleme noktalarından (şablon / sınır okuması, PDF yükleme) sonra iş ve toplu işin durumunu yeniden
// okumuyor, "İptal"i "Gönderiliyor"a çeviriyordu. Beklenen (plan §6 W2 durum makinesi + §7a 13; S3 A): iptal / duraklatma o andan sonra Meta'ya İLETİ
// GÖNDERTMEZ; iptal edilen işin yüklenmiş PDF'i kesin durumda Meta'dan silinir; duraklatılan iş Devam Et ile (aynı PDF'le) bir kez gider.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; beklentiler plandan) + istek kapısı (fetchImpl: istek Meta'ya gitmeden bekletilir,
// kullanıcı eylemi tam o anda yapılır — ders 20: yarışın ön koşulu zorla kurulur, her denemede "iş o anda Hazırlanıyor" ayrıca doğrulanır).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const MIN = 60_000;
const metaError = (code, message = "hata") => ({ error: { message, type: "OAuthException", code, error_data: { messaging_product: "whatsapp", details: message }, fbtrace_id: "Abc" } });

/** İstek kapısı: eşleşen ilk istek, açılana dek Meta'ya gitmez. entered(): istek kapıya geldi. */
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

async function setup() {
  const door = gate();
  const ctx = await startWa({ fetchImpl: door.fetchImpl });
  const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
  const res = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return { ctx, door, batchId: res.data.data.batch.id };
}
const uploads = ctx => ctx.fake.requests.filter(item => item.method === "POST" && /\/media$/.test(item.path)).length;

describe("2.4.8 T2-2 — İptal / Duraklat Meta isteği sürerken basılınca ileti GİTMEZ", () => {
  it("PDF yüklenirken İptal Et: ileti gitmez, iş 'İptal' kalır (Gönderiliyor'a dönmez), yüklenen PDF Meta'dan silinir", async () => {
    const { ctx, door, batchId } = await setup();
    try {
      door.arm(/^POST .*\/media$/);
      const run = ctx.wa.scheduler.runOnce();
      await door.entered();
      assert.equal((await ctx.jobs(batchId))[0].state, "preparing", "ön koşul: iş PDF yüklenirken Hazırlanıyor");
      const act = await ctx.api.post(`${URLS.batches}/${batchId}/cancel`, {});
      assert.equal(act.status, 200, JSON.stringify(act.data));
      door.open();
      await run;
      await ctx.drain();
      const detail = await ctx.detail(batchId);
      assert.equal(ctx.messages().length, 0, `iptalden sonra Meta'ya ileti gitmemeli (giden: ${ctx.messages().length}; iş ${detail.jobs[0].state})`);
      assert.equal(detail.state, "canceled");
      assert.equal(detail.jobs[0].state, "canceled", `iş İptal kalmalı (geldi: ${detail.jobs[0].state})`);
      assert.equal(uploads(ctx), 1, "PDF bir kez yüklendi");
      assert.equal(ctx.fake.state.media.size, 0, "yüklenen PDF Meta'dan silindi (S3)");
      assert.equal(ctx.fake.state.deleted.length, 1);
      assert.equal(detail.jobs[0].mediaDeleted, true);
    } finally {
      await ctx.close();
    }
  });

  it("PDF yüklenirken Duraklat: ileti gitmez, iş 'Duraklatıldı'; Devam Et ile AYNI PDF'le bir kez gider", async () => {
    const { ctx, door, batchId } = await setup();
    try {
      door.arm(/^POST .*\/media$/);
      const run = ctx.wa.scheduler.runOnce();
      await door.entered();
      assert.equal((await ctx.jobs(batchId))[0].state, "preparing", "ön koşul: iş PDF yüklenirken Hazırlanıyor");
      assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/pause`, {})).status, 200);
      door.open();
      await run;
      await ctx.drain();
      let detail = await ctx.detail(batchId);
      assert.equal(ctx.messages().length, 0, `duraklatmadan sonra ileti gitmemeli (giden: ${ctx.messages().length}; iş ${detail.jobs[0].state})`);
      assert.equal(detail.state, "paused");
      assert.equal(detail.jobs[0].state, "paused", `iş Duraklatıldı olmalı (geldi: ${detail.jobs[0].state})`);
      assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {})).status, 200);
      await ctx.drain();
      detail = await ctx.detail(batchId);
      assert.equal(ctx.messages().length, 1, "Devam Et → bir kez");
      assert.equal(detail.jobs[0].state, "accepted");
      assert.equal(uploads(ctx), 1, "duraklatmadan önce yüklenen PDF yeniden kullanıldı (§7a 15)");
    } finally {
      await ctx.close();
    }
  });

  it("şablon okuması sürerken İptal Et ya da Duraklat: ileti gitmez, PDF yüklenmez; iş durumu kullanıcının seçtiği kalır", async () => {
    for (const action of ["cancel", "pause"]) {
      const { ctx, door, batchId } = await setup();
      try {
        // Şablon önbelleği (R2: en geç 10 dk) dolsun: işçi Meta'dan şablon listesini yeniden okur — bekleme noktası.
        ctx.clock.advance(11 * MIN);
        door.arm(/^GET .*\/message_templates$/);
        const run = ctx.wa.scheduler.runOnce();
        await door.entered();
        assert.equal((await ctx.jobs(batchId))[0].state, "pending", `${action}: ön koşul — iş şablon okunurken Bekliyor`);
        assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/${action}`, {})).status, 200);
        door.open();
        await run;
        await ctx.drain();
        const detail = await ctx.detail(batchId);
        const expected = action === "cancel" ? "canceled" : "paused";
        assert.equal(ctx.messages().length, 0, `${action}: ileti gitmemeli (iş ${detail.jobs[0].state})`);
        assert.equal(uploads(ctx), 0, `${action}: PDF yüklenmemeli`);
        assert.equal(detail.jobs[0].state, expected, `${action}: iş ${expected} olmalı (geldi: ${detail.jobs[0].state})`);
      } finally {
        await ctx.close();
      }
    }
  });

  it("PDF yüklenirken İptal Et ve yükleme Meta hatasıyla düşerse: iş 'İptal' kalır (Başarısız / Bekliyor'a dönmez)", async () => {
    const { ctx, door, batchId } = await setup();
    try {
      ctx.fake.state.failQueue.push({ match: /^POST .*\/media$/, status: 400, body: metaError(131053, "Media upload error") });
      door.arm(/^POST .*\/media$/);
      const run = ctx.wa.scheduler.runOnce();
      await door.entered();
      assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/cancel`, {})).status, 200);
      door.open();
      await run;
      await ctx.drain();
      const detail = await ctx.detail(batchId);
      assert.equal(ctx.messages().length, 0);
      assert.equal(detail.jobs[0].state, "canceled", `iş İptal kalmalı (geldi: ${detail.jobs[0].state})`);
    } finally {
      await ctx.close();
    }
  });
});
