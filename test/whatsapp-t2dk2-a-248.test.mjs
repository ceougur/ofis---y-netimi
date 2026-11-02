// 2.4.8 T2 dar kontrol 2 ORTA-A (ÇİFT İLETİ, Yol 2; bağımsız dar kontrol sondası zz-t2dk2-orta2-delik birebir kalıcılaştırıldı): ORTA-2 eksikti — durum kancasından
// öğrenilen wamid deftere girmiyordu (attemptOfWamid yalnız outcomes.wamid'e bakıyor; outcomes "ilk yazılan kalır" → Sonucu Belirsiz satırında wamid boş; geç kabul
// wamid yazmıyor). Akış: 1. deneme Sonucu Belirsiz → İMZALI kanca W1 + 131049 → Meta Bekletti → 2. deneme Sonucu Belirsiz → W1'in yinelenen İMZALI 131049 bildirimi
// 2. denemeye yazılıyor → iş Başarısız + defter kilidi çözülüyor → aynı dönem yeniden seçilince ÜÇÜNCÜ ileti (2. deneme Meta'da kabul edilmiş olabilir: çift ileti).
// Beklenen: kancadan öğrenilen wamid deftere (job_id, attempt, wamid) satırı olarak yalnız eklenir; attemptOfWamid oradan da okur; yinelenen bildirim yok sayılır.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + programın durum bildirimi çekirdeği (imzalı) + sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const PERIOD = { from: "2026-11-01", to: "2026-11-03" };
const W1 = "wamid.BIRINCI-DENEME";

describe("2.4.8 T2 dar kontrol 2 ORTA-A — kancadan öğrenilen wamid defterde ait olduğu denemeye bağlanır; yinelenen eski bildirim yeni denemeye yazılmaz", () => {
  it("belirsiz 1. deneme → imzalı W1 131049 → belirsiz 2. deneme → W1'in yinelenen imzalı 131049'u: iş Sonucu Belirsiz kalır, kilit çözülmez, üçüncü ileti yok", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], ...PERIOD })).data.data.batch.id;
      ctx.fake.state.dropAfter = /\/messages$/;
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      let job = ctx.store.get("SELECT * FROM wa_jobs WHERE batch_id = ?", id);
      assert.equal(job.state, "uncertain", "ön koşul: 1. deneme Sonucu Belirsiz");
      assert.equal(job.attempt, 1);
      const ts = () => String(Math.floor(ctx.clock().getTime() / 1000));
      const f131049 = () => ({ id: W1, status: "failed", timestamp: ts(), recipient_id: "905321112233", biz_opaque_callback_data: job.id, errors: [{ code: 131049, title: "x", message: "x", error_data: { details: "x" } }] });
      assert.equal(ctx.statuses([f131049()], { signed: true }).applied, 1);
      job = ctx.store.get("SELECT * FROM wa_jobs WHERE batch_id = ?", id);
      assert.equal(job.state, "held", "ön koşul: imzalı W1 131049 → Meta Bekletti");
      ctx.clock.advance(24 * HOUR + 60_000);
      ctx.fake.state.dropAfter = /\/messages$/;
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      job = ctx.store.get("SELECT * FROM wa_jobs WHERE batch_id = ?", id);
      assert.equal(job.state, "uncertain", "ön koşul: 2. deneme Sonucu Belirsiz");
      assert.equal(job.attempt, 2);
      assert.equal(ctx.messageRequests().length, 2);
      // Meta W1'in bildirimini yineler (imzalı, iş kimliğiyle).
      ctx.statuses([f131049()], { signed: true });
      job = ctx.store.get("SELECT * FROM wa_jobs WHERE batch_id = ?", id);
      assert.equal(job.state, "uncertain", `W1'in yinelenen bildirimi 2. denemeye yazılmamalı (geldi ${job.state})`);
      const second = ctx.wa.ledger.attempts(job.id).find(row => row.attempt === 2);
      assert.notEqual(second?.outcome, "failed", `2. denemenin defter kilidi çözülmemeli (${JSON.stringify(ctx.wa.ledger.attempts(job.id))})`);
      const again = await ctx.batch({ kind: "statement", ids: [a.id], ...PERIOD });
      assert.ok(again.status === 200 || again.data?.code === "whatsapp-nothing", JSON.stringify(again.data));
      await ctx.drain();
      assert.equal(ctx.messageRequests().length, 2, `Meta'da kabul edilmiş olabilecek 2. deneme varken ileti üçüncü kez gitmemeli (${ctx.messageRequests().length} ileti isteği)`);
      const owner = ctx.wa.ledger.attemptOfWamid(W1);
      assert.deepEqual(owner && { jobId: owner.jobId, attempt: owner.attempt }, { jobId: job.id, attempt: 1 }, "kancadan öğrenilen W1 defterde 1. denemeye bağlı olmalı");
    } finally {
      await ctx.close();
    }
  });

  it("öğrenilen wamid'in kendi bildirimi (teslim) yine çalışır; bildirim yönlendirmesi (şirket) öğrenilen wamid'den de bulunur", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const id = (await ctx.batch({ kind: "statement", ids: [a.id], ...PERIOD })).data.data.batch.id;
      ctx.fake.state.dropAfter = /\/messages$/;
      await ctx.drain();
      ctx.fake.state.dropAfter = null;
      const job = ctx.store.get("SELECT * FROM wa_jobs WHERE batch_id = ?", id);
      const ts = () => String(Math.floor(ctx.clock().getTime() / 1000));
      assert.equal(ctx.statuses([{ id: W1, status: "sent", timestamp: ts(), recipient_id: "905321112233", biz_opaque_callback_data: job.id }], { signed: true }).applied, 1);
      assert.equal(ctx.store.get("SELECT state FROM wa_jobs WHERE id = ?", job.id).state, "sent");
      assert.equal(ctx.statuses([{ id: W1, status: "delivered", timestamp: ts(), recipient_id: "905321112233" }]).applied, 1);
      assert.equal(ctx.store.get("SELECT state FROM wa_jobs WHERE id = ?", job.id).state, "delivered");
      const routed = ctx.wa.ledger.companyOfWamid(W1);
      assert.ok(routed?.companyId, "öğrenilen wamid'in bildirimi defterden şirketine yönlendirilebilmeli (imzasız bildirimde de)");
      assert.equal(routed.companyId, ctx.wa.ledger.companyOfJob(job.id)?.companyId);
    } finally {
      await ctx.close();
    }
  });
});
