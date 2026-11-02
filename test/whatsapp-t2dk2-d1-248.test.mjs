// 2.4.8 T2 dar kontrol 2 DÜŞÜK-1 (otomatik deneme kaybı; sonda zz-t2dk2-reopen-yetim kalıcılaştırıldı): 131049 kancasında makine defteri toplu işi şirket dosyası
// yazımından ÖNCE yeniden açıyordu; dosya yazımı (iş → Meta Bekletti) düşünce defter kalıcı "canlı", dosya "Tamamlandı" / iş "Meta Kabul Etti" kalıyordu; Meta aynı
// bildirimi yineleyince reopenBatch false (zaten açık) → iş Meta Bekletti yerine BAŞARISIZ (tek yeniden deneme hakkı kayboldu).
// Beklenen: dosya yazımı (iş + toplu iş) tek işlem; düşerse defterdeki yeniden açma telafi edilir; reopenBatch aynı toplu iş zaten yeniden açıksa true (idempotent).
// İş U3 (dar kontrol 15): düşen dosya yazımı artık yukarı gider (kanca 500, Meta yineler) — testte assert.throws.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + programın durum bildirimi çekirdeği; disk dolu = şirket dosyasının yazım işlevi
// (store.run) yalnız "iş → Meta Bekletti" yazımında bir kez hata atar (ders 20: ön koşul zorla) + sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const diskFull = () => Object.assign(new Error("database or disk is full"), { code: "ERR_SQLITE_ERROR", errcode: 13 });

async function acceptedOnce() {
  const ctx = await startWa();
  try {
    const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
    const id = (await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" })).data.data.batch.id;
    await ctx.drain();
    const wamid = (await ctx.jobs(id))[0].wamid;
    assert.equal((await ctx.detail(id)).state, "done", "ön koşul: toplu iş Tamamlandı");
    const status = () => ({ id: wamid, status: "failed", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905321112233", errors: [{ code: 131049, title: "x", message: "x", error_data: { details: "x" } }] });
    return { ctx, id, status };
  } catch (error) {
    await ctx.close();
    throw error;
  }
}
/** Şirket dosyasının "iş → Meta Bekletti" yazımı bir kez düşer. Dönüş: geri alma işlevi. */
function failHeldWriteOnce(ctx) {
  const store = ctx.server.app.store;
  const run = store.run;
  let once = true;
  store.run = (sql, ...args) => {
    if (once && /^UPDATE wa_jobs SET state = \?/.test(sql) && args[0] === "held") {
      once = false;
      throw diskFull();
    }
    return run.call(store, sql, ...args);
  };
  return () => {
    store.run = run;
  };
}

describe("2.4.8 T2 dar kontrol 2 DÜŞÜK-1 — 131049'da dosya yazımı düşünce defter yetim kalmaz; yinelenen bildirim yine Meta Bekletti yapar", () => {
  it("dosya yazımı düştü → defter dosyayla aynı (Tamamlandı, canlı değil); Meta bildirimi yineleyince iş Meta Bekletti, 24 saat sonra bir kez gider", async () => {
    const { ctx, id, status } = await acceptedOnce();
    const restore = failHeldWriteOnce(ctx);
    try {
      const problems = [];
      // İş U3 (dar kontrol 15 b3; BİLEREK DEĞİŞEN beklenti, ders 28): dosya yazımındaki disk dolu artık YUTULMAZ — yukarı gider (kanca 500, Meta yineler).
      assert.throws(() => ctx.statuses([status()]), /disk is full/, "disk dolu yukarı gider");
      restore();
      let d = await ctx.detail(id);
      if (d.state !== "done" || d.jobs[0].state !== "accepted") problems.push(`ön koşul: dosya yazımı düştü, dosya değişmemeliydi (toplu iş ${d.state}, iş ${d.jobs[0].state})`);
      const ledgerState = ctx.wa.ledger.batchState(id);
      if (ledgerState.live) problems.push(`dosya yazımı düşünce defter yetim kalmamalı (defter ${JSON.stringify(ledgerState)})`);
      ctx.statuses([status()]); // Meta aynı bildirimi yineler
      d = await ctx.detail(id);
      if (d.jobs[0].state !== "held") problems.push(`yinelenen bildirim işi Meta Bekletti yapmalı (geldi ${d.jobs[0].state}: ${d.jobs[0].reason || ""})`);
      if (d.state !== "running") problems.push(`toplu iş yeniden Sürüyor olmalı (geldi ${d.state})`);
      if (!ctx.wa.ledger.batchState(id).live) problems.push("defterde de canlı olmalı");
      ctx.clock.advance(24 * HOUR + 60_000);
      await ctx.drain();
      if (ctx.messages().length !== 2) problems.push(`Meta Bekletti iş 24 saat sonra bir kez gitmeli (ileti ${ctx.messages().length})`);
      assert.deepEqual(problems, []);
    } finally {
      restore();
      await ctx.close();
    }
  });

  it("telafi de yazılamadı (defter yetim kaldı) → yinelenen bildirimde yeniden açma idempotent: iş Meta Bekletti, Başarısız değil", async () => {
    const { ctx, id, status } = await acceptedOnce();
    const restore = failHeldWriteOnce(ctx);
    const ledger = ctx.wa.ledger;
    const stopBatch = ledger.stopBatch;
    ledger.stopBatch = () => false; // defter yazılamıyor (disk dolu) — telafi düşer
    try {
      assert.throws(() => ctx.statuses([status()]), /disk is full/, "İş U3: disk dolu yukarı gider (kanca 500, Meta yineler)");
      restore();
      ledger.stopBatch = stopBatch;
      assert.equal((await ctx.detail(id)).jobs[0].state, "accepted", "ön koşul: dosya yazımı düştü");
      assert.equal(ledger.batchState(id).live, true, "ön koşul: defter yetim (yeniden açık) kaldı");
      ctx.statuses([status()]);
      const d = await ctx.detail(id);
      assert.equal(d.jobs[0].state, "held", `yinelenen bildirim işi Meta Bekletti yapmalı, Başarısız değil (geldi ${d.jobs[0].state}: ${d.jobs[0].reason || ""})`);
      assert.equal(d.state, "running");
      ctx.clock.advance(24 * HOUR + 60_000);
      await ctx.drain();
      assert.equal(ctx.messages().length, 2, "Meta Bekletti iş 24 saat sonra bir kez gider");
    } finally {
      restore();
      ledger.stopBatch = stopBatch;
      await ctx.close();
    }
  });

  it("dosya yazımının İKİNCİ yarısı (toplu iş → Sürüyor) düştü → iş de yazılmaz (tek işlem); yinelenen bildirimde Meta Bekletti, 24 saat sonra bir kez gider", async () => {
    const { ctx, id, status } = await acceptedOnce();
    const store = ctx.server.app.store;
    const run = store.run;
    let once = true;
    store.run = (sql, ...args) => {
      if (once && /^UPDATE wa_batches SET state = \?/.test(sql) && args[0] === "running") {
        once = false;
        throw diskFull();
      }
      return run.call(store, sql, ...args);
    };
    try {
      const problems = [];
      // İş U3 (BİLEREK DEĞİŞEN beklenti, ders 28): yazım hatası yutulmaz, yukarı gider (kanca 500 → Meta yineler); önceki beklenti "hata fırlatmaz"dı.
      assert.throws(() => ctx.statuses([status()]), /disk is full/, "disk dolu yukarı gider");
      store.run = run;
      let d = await ctx.detail(id);
      if (d.jobs[0].state === "held" && d.state === "done") problems.push("iş Meta Bekletti ama toplu iş Tamamlandı kaldı (iş hiç yürütülmez)");
      ctx.statuses([status()]);
      d = await ctx.detail(id);
      if (d.jobs[0].state !== "held" || d.state !== "running") problems.push(`yinelenen bildirimden sonra iş Meta Bekletti + toplu iş Sürüyor olmalı (iş ${d.jobs[0].state}, toplu iş ${d.state})`);
      ctx.clock.advance(24 * HOUR + 60_000);
      await ctx.drain();
      if (ctx.messages().length !== 2) problems.push(`Meta Bekletti iş 24 saat sonra bir kez gitmeli (ileti ${ctx.messages().length})`);
      assert.deepEqual(problems, []);
    } finally {
      store.run = run;
      await ctx.close();
    }
  });

  it("yazım düşmeden: Tamamlandı toplu işte 131049 → iş Meta Bekletti ve toplu iş Sürüyor aynı anda (tek işlem)", async () => {
    const { ctx, id, status } = await acceptedOnce();
    try {
      assert.equal(ctx.statuses([status()]).applied, 1);
      const d = await ctx.detail(id);
      assert.equal(d.jobs[0].state, "held");
      assert.equal(d.state, "running");
      assert.equal(ctx.wa.ledger.batchState(id).live, true);
    } finally {
      await ctx.close();
    }
  });
});
