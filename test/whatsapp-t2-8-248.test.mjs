// 2.4.8 T2 bulgu 8 (DÜŞÜK, bu sürümde — KVKK onayı; bağımsız gözden geçirme r8): bir kez onay ("Aydınlatma metnimi okudum, carilerime ulaştıracağım.")
// gönderim sürerken Yönetim → WhatsApp'tan KALDIRILINCA süren toplu iş göndermeyi sürdürüyor, duraklatılmış iş Devam Et ile onaysız gidiyordu (queue.mjs resume /
// step onay denetlemiyordu). Beklenen (plan §1 ürün kuralı + kullanıcı kararı 30.10.2026 "onay kutusu işaretlenmeden toplu gönderim BAŞLAMAZ"; §7a 28 "bir kez onay
// toplu ve tekli gönderimde şart"): onay yokken HİÇBİR ileti gitmez — Devam Et reddedilir (409 + neden), süren iş ilk adımında DURAKLAR (neden görünür);
// onay yeniden işaretlenince Devam Et ile sürer. Firma adı (iletinin değişkeni) silinince de aynı kural (başlatma engeliyle aynı sıra).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OFFICE, URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const PEOPLE = [["Ayşe Yılmaz", "0532 111 22 33"], ["Burak Kaya", "0533 444 55 66"], ["Cem Ak", "0534 777 88 99"]];

async function setup() {
  const ctx = await startWa();
  // Sınır 1: ilk kişi gider, öbürleri "Sınır Nedeniyle Bekliyor" (gönderim sürüyor).
  assert.equal((await ctx.api.put(URLS.sending, { dailyCap: 1 })).status, 200);
  const ids = [];
  for (const [name, phone] of PEOPLE) ids.push((await ctx.account(name, phone, 400)).id);
  const res = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  await ctx.drain();
  assert.equal(ctx.messages().length, 1, "ön koşul: onayla ilk ileti gitti, iki kişi sınırda bekliyor");
  return { ctx, ids, batchId: res.data.data.batch.id };
}

describe("2.4.8 T2-8 — Gönderim Onayı kaldırılınca hiçbir ileti gitmez", () => {
  it("duraklatılmış iş onaysız Devam Et ile SÜRDÜRÜLMEZ (409 + neden); onay yeniden işaretlenince sürer", async () => {
    const { ctx, batchId } = await setup();
    try {
      assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/pause`, {})).status, 200);
      assert.equal((await ctx.api.put(URLS.ack, { ack: false })).status, 200);
      const resumed = await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {});
      assert.equal(resumed.status, 409, `onaysız Devam Et reddedilmeli (geldi ${resumed.status})`);
      assert.equal(resumed.data.code, "whatsapp-ack-required");
      assert.match(resumed.data.error, /Aydınlatma metnimi okudum, carilerime ulaştıracağım\./);
      ctx.clock.advance(25 * HOUR);
      await ctx.drain();
      assert.equal(ctx.messages().length, 1, "onaysız ileti gitmedi");
      assert.equal((await ctx.detail(batchId)).state, "paused");
      assert.equal((await ctx.api.put(URLS.ack, { ack: true })).status, 200);
      assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {})).status, 200);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "onay dönünce Devam Et ile sürer (sınır 1)");
    } finally {
      await ctx.close();
    }
  });

  it("süren toplu iş onay kaldırılınca ilk adımında DURAKLAR (Duraklatıldı + neden), bekleyenlere gitmez; onay + Devam Et ile sürer", async () => {
    const { ctx, batchId } = await setup();
    try {
      assert.equal((await ctx.api.put(URLS.ack, { ack: false })).status, 200);
      ctx.clock.advance(25 * HOUR);
      await ctx.drain();
      const detail = await ctx.detail(batchId);
      assert.equal(ctx.messages().length, 1, `onay kaldırıldıktan sonra ileti gitmemeli (giden ${ctx.messages().length}; toplu iş ${detail.state})`);
      assert.equal(detail.state, "paused");
      assert.equal(detail.pauseCode, "ack");
      assert.match(detail.pauseReason, /onay/i);
      assert.deepEqual(detail.jobs.map(job => job.state).sort(), ["accepted", "paused", "paused"]);
      assert.equal((await ctx.api.put(URLS.ack, { ack: true })).status, 200);
      assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {})).status, 200);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2);
    } finally {
      await ctx.close();
    }
  });

  it("firma adı silinince süren iş duraklar (iletinin değişkeni boş gitmez); Devam Et firma adı yazılana dek reddedilir", async () => {
    const { ctx, batchId } = await setup();
    try {
      ctx.store.setSetting("office.name", "");
      ctx.clock.advance(25 * HOUR);
      await ctx.drain();
      let detail = await ctx.detail(batchId);
      assert.equal(ctx.messages().length, 1, "firma adı yokken ileti gitmedi");
      assert.equal(detail.state, "paused");
      assert.equal(detail.pauseCode, "office");
      const refused = await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {});
      assert.equal(refused.status, 409);
      assert.equal(refused.data.code, "whatsapp-office-missing");
      ctx.store.setSetting("office.name", OFFICE);
      assert.equal((await ctx.api.post(`${URLS.batches}/${batchId}/resume`, {})).status, 200);
      await ctx.drain();
      detail = await ctx.detail(batchId);
      assert.equal(ctx.messages().length, 2);
      assert.equal(ctx.messages().at(-1).params[1], OFFICE, "ileti firma adıyla gitti");
    } finally {
      await ctx.close();
    }
  });
});
