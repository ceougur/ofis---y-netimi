// 2.4.8 İş O (dar kontrol 11): kilitli şirket dosyasında İş N'nin komşuları.
//   O1 (ORTA-1): bakım turunun PDF silme döngüsü media_deleted_at yazımı kilide takılınca aynı turda ikinci yazımı (media_delete_tries) deniyordu → bakım ~30 sn olay döngüsünü
//       tutuyordu. Şimdi kilitte tur bırakılır (~10 sn); PDF Meta'da silinmiş kalır, kayıt kilit kalkınca yazılır — Meta'ya İKİNCİ silme isteği gitmez.
//   O2 (DÜŞÜK-1, 135ce3f3 gerilemesi): Devam Et dosyaya "art arda" 0 yazıyor ama bellekteki kilit sayacı kalıyordu → Devam Et sonrası TEK disk dolu hatası "art arda 5 kez".
//   O3 (DÜŞÜK-2, dişsiz test): bellekteki kilit sayacı kilit kalkınca dosyaya geçer (sonraki hatayla birlikte) ve işin başarılı yürütülmesi onu sıfırlar.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); kilit ayrı bağlantıyla (gerçek SQLite kilidi; süre gerçek saat — busy_timeout 10 sn).
// Dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();
const NOW = { time: localIso(2026, 11, 3, 10), fixed: true };
const lockOf = ctx => {
  const db = new DatabaseSync(ctx.server.app.config.dbPath);
  db.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
  return {
    release() {
      try {
        db.exec("ROLLBACK");
        db.close();
      } catch {
        // zaten kalktı
      }
    },
  };
};
const batchRow = (ctx, id) => ctx.store.get("SELECT state, troubles, pause_code FROM wa_batches WHERE id = ?", id);

/**
 * 7 cari, bir toplu iş; ilk tur kilitsiz (bakım + 1. iş gider). Sonra dosya kilitlenir ve 4 tur işçi işi dener (bakım vakti gelmemiş; her tur bir işi kilit yüzünden bekletir) →
 * bellekteki kilit sayacı 4. Kilit kalkar. Dönüş: { ctx, id }.
 */
async function lockedFour() {
  const ctx = await startWa({ now: NOW });
  const ids = [];
  for (let i = 0; i < 7; i += 1) ids.push((await ctx.account(`Sayaç ${i}`, `0533 444 56 ${String(10 + i)}`, 100 + i)).id);
  const created = await ctx.batch({ kind: "statement", ids, preset: "thisMonth" });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const id = created.data.data.batch.id;
  await ctx.wa.scheduler.runOnce();
  assert.equal(ctx.messages().length, 1, "ön koşul: ilk iş kilitsiz gitti");
  const lock = lockOf(ctx);
  try {
    for (let i = 0; i < 4; i += 1) await ctx.wa.scheduler.runOnce();
  } finally {
    lock.release();
  }
  assert.equal(ctx.messages().length, 1, "ön koşul: kilitte ileti gitmedi");
  assert.equal(batchRow(ctx, id).troubles, 0, "ön koşul: kilitte dosyaya sayaç yazılmadı");
  return { ctx, id };
}
/** Sonraki "Hazırlanıyor" yazımı bir kez disk dolu ile düşer (kilit DEĞİL — yerel hata yolu). */
function diskFullOnce(ctx) {
  const store = ctx.store;
  const run = store.run;
  const state = { hit: false };
  store.run = (sql, ...args) => {
    if (!state.hit && /^UPDATE wa_jobs SET state = \?, next_at = \?/.test(sql) && args[0] === "preparing") {
      state.hit = true;
      throw Object.assign(new Error("database or disk is full"), { code: "ERR_SQLITE_ERROR", errcode: 13 });
    }
    return run.call(store, sql, ...args);
  };
  return { state, restore: () => (store.run = run) };
}

describe("2.4.8 İş O — kilitli dosyada bakım turu ve bellekteki 'art arda' sayacı", () => {
  it("O1: teslim edilmiş iletinin PDF'i silinmemişken dosya kilitli → bakım ≤ 12 sn (önce ~30 sn); kilit kalkınca kayıt yazılır, Meta'ya ikinci silme isteği gitmez", { timeout: 180_000 }, async () => {
    const ctx = await startWa({ now: NOW });
    let lock = null;
    try {
      const a = await ctx.account("Medya Bir", "0533 444 55 61", 800);
      const created = await ctx.batch({ kind: "statement", ids: [a.id], preset: "thisMonth" });
      const id = created.data.data.batch.id;
      await ctx.drain();
      const job = ctx.store.get("SELECT id, wamid, media_id FROM wa_jobs WHERE batch_id = ?", id);
      assert.ok(job.media_id, "ön koşul: PDF Meta'ya yüklendi");
      const st = ctx.statuses([{ id: job.wamid, status: "delivered", timestamp: String(Math.floor(ctx.clock().getTime() / 1000)), recipient_id: "905334445561" }]);
      assert.equal(st.applied, 1, "ön koşul: Teslim Edildi");
      const deletes = () => ctx.fake.requests.filter(item => item.method === "DELETE").length;
      lock = lockOf(ctx);
      const t0 = Date.now();
      await ctx.wa.scheduler.maintain();
      const ms = Date.now() - t0;
      assert.ok(ms <= 12_000, `kilitte bakım olay döngüsünü en çok ~10 sn tutar (geldi ${ms} ms)`);
      assert.equal(deletes(), 1, "ön koşul: PDF Meta'dan silindi (kayıt kilit yüzünden yazılamadı)");
      lock.release();
      lock = null;
      await ctx.wa.scheduler.maintain();
      const after = ctx.store.get("SELECT media_deleted_at, media_delete_tries FROM wa_jobs WHERE id = ?", job.id);
      assert.ok(after.media_deleted_at, "kilit kalkınca silinme kaydı yazıldı");
      assert.equal(deletes(), 1, "Meta'ya ikinci silme isteği gitmedi");
      assert.equal(after.media_delete_tries, 0, "silme denemesi başarısız sayılmadı");
    } finally {
      lock?.release();
      await ctx.close();
    }
  });

  it("O2: kilitte sayaç birikti → Duraklat → Devam Et → tek disk dolu hatası toplu işi DURAKLATMAZ (art arda 1)", { timeout: 180_000 }, async () => {
    const { ctx, id } = await lockedFour();
    try {
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/pause`, {})).status, 200, "Duraklat");
      assert.equal((await ctx.api.post(`${URLS.batches}/${id}/resume`, {})).status, 200, "Devam Et");
      const fault = diskFullOnce(ctx);
      try {
        await ctx.wa.scheduler.runOnce();
      } finally {
        fault.restore();
      }
      assert.ok(fault.state.hit, "ön koşul: disk dolu hatası uygulandı");
      const row = batchRow(ctx, id);
      assert.deepEqual([row.state, row.troubles], ["running", 1], `Devam Et sonrası tek hata: art arda 1, Sürüyor (geldi ${JSON.stringify(row)})`);
    } finally {
      await ctx.close();
    }
  });

  it("O3a: kilitte biriken 4 + kilit kalkınca tek disk dolu hatası = art arda 5 → Duraklatıldı (bellekteki sayaç dosyaya geçer)", { timeout: 180_000 }, async () => {
    const { ctx, id } = await lockedFour();
    try {
      const fault = diskFullOnce(ctx);
      try {
        await ctx.wa.scheduler.runOnce();
      } finally {
        fault.restore();
      }
      assert.ok(fault.state.hit, "ön koşul: disk dolu hatası uygulandı");
      const row = batchRow(ctx, id);
      assert.deepEqual([row.state, row.troubles, row.pause_code], ["paused", 5, "local"], `art arda 5 → Duraklatıldı (geldi ${JSON.stringify(row)})`);
    } finally {
      await ctx.close();
    }
  });

  it("O3b: kilitte biriken 4 → kilit kalkınca bir iş BAŞARIYLA gider (sayaç sıfırlanır) → sonraki tek disk dolu hatası art arda 1", { timeout: 180_000 }, async () => {
    const { ctx, id } = await lockedFour();
    try {
      // Olay döngüsünün kilitte tutulması sahte Meta'nın açık bağlantısını düşürebilir (ECONNRESET → "Bağlantı Bekleniyor", kendiliğinden sürer): bir iş gidene dek.
      for (let i = 0; i < 4 && ctx.messages().length < 2; i += 1) {
        await ctx.wa.scheduler.runOnce();
        if (ctx.messages().length < 2) ctx.clock.advance(60_000);
      }
      assert.equal(ctx.messages().length, 2, "ön koşul: kilit kalkınca bir iş gitti");
      const fault = diskFullOnce(ctx);
      try {
        await ctx.wa.scheduler.runOnce();
      } finally {
        fault.restore();
      }
      assert.ok(fault.state.hit, "ön koşul: disk dolu hatası uygulandı");
      const row = batchRow(ctx, id);
      assert.deepEqual([row.state, row.troubles], ["running", 1], `başarıdan sonra tek hata: art arda 1 (geldi ${JSON.stringify(row)})`);
    } finally {
      await ctx.close();
    }
  });
});
