// 2.4.8 İş N (T6 yeniden koşusu Ü2, ORTA gerileme — bütün kullanıcılar için donma): şirket dosyası başka bir süreçte KİLİTLİYKEN (SQLite BEGIN EXCLUSIVE — yedekleme /
// virüs tarayıcı) gönderim işçisinin bir turu olay döngüsünü busy_timeout (10 sn) × 3 yazım ≈ 30 sn tutuyordu (deferLocal ilk yazım düşünce iş + toplu iş sayacını da
// yazmaya çalışıyordu); bu sürede programın HTTP yanıtları da bekliyordu. Şimdi: ilk yazım kilitle düşünce aynı turda başka yazım denenmez (tur ≈ 10 sn).
// Değişmeyen: kilit sürerken ileti GİTMEZ; kilit kalkınca bekleyen iş gider, çift ileti yok; disk dolu yolu (T6-B1/B2) test/whatsapp-t6-b-248.test.mjs'te.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); kilit ayrı bağlantıyla (gerçek SQLite kilidi; süre gerçek saat — busy_timeout).
// Dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();

describe("2.4.8 İş N — şirket dosyası kilitliyken işçi turu olay döngüsünü busy_timeout'tan uzun tutmaz", () => {
  it("kilitli dosyada her tur ≤ 12 sn (önce bakım + iş ~40 sn), ileti gitmez; kilit kalkınca iş gider, çift ileti yok, toplu iş Tamamlandı", { timeout: 120_000 }, async () => {
    // İş P1'den sonra turun başındaki kısa sınama kilidi görür ve turu atlar (test/whatsapp-dk13-arka-plan-kilit-248.test.mjs); bu test TUR İÇİNDE başlayan kilidi
    // (sınamadan sonra) sınar → sınama kapalı, işaret süresi 0 (yalnız test oluşturucu seçenekleri; her tur kilide yeniden takılır — İş N yolu).
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 10), fixed: true }, __testWriteLockProbe: false, __testWriteLockBackoffMs: 0 });
    let lock = null;
    try {
      const p = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const created = await ctx.batch({ kind: "statement", ids: [p.id], preset: "thisMonth" });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const id = created.data.data.batch.id;
      lock = new DatabaseSync(ctx.server.app.config.dbPath);
      lock.exec("PRAGMA busy_timeout = 1000; BEGIN EXCLUSIVE");
      // Bir tur = (vakti geldiyse) bakım + bir iş; ikinci turda bakım yok, iş yürütülür. Programın HTTP yanıtı tur bitene dek bekler (tek olay döngüsü).
      const turns = [];
      for (let i = 0; i < 2; i += 1) {
        const t0 = Date.now();
        await ctx.wa.scheduler.runOnce();
        turns.push(Date.now() - t0);
      }
      assert.equal(ctx.messages().length, 0, "kilit sürerken ileti gitmedi");
      for (const [i, ms] of turns.entries()) assert.ok(ms <= 12_000, `kilitli dosyada ${i + 1}. tur olay döngüsünü en çok ~10 sn (busy_timeout) tutar (turlar ${JSON.stringify(turns)} ms)`);
      lock.exec("ROLLBACK");
      lock.close();
      lock = null;
      // İki kilitli turdan sonra işin bellekteki beklemesi 2 dk (30 sn → 2 dk). Olay döngüsünün uzun tutulması sahte Meta'nın açık bağlantısını düşürebilir (ECONNRESET →
      // "Bağlantı Bekleniyor", 30 sn sonra kendiliğinden sürer; eski kodda da) — bu yüzden en çok üç kez ileri alınıp sürülür.
      let detail = null;
      for (let i = 0; i < 3; i += 1) {
        ctx.clock.advance(3 * 60_000);
        await ctx.drain();
        detail = (await ctx.api.get(`${URLS.batches}/${id}`)).data.data;
        if (detail.state === "done") break;
      }
      assert.deepEqual(detail.jobs.map(job => job.state), ["accepted"], "kilit kalkınca iş gitti");
      assert.equal(ctx.messages().filter(item => item.to === "+905334445566").length, 1, "çift ileti yok");
      assert.equal(detail.state, "done", `toplu iş Tamamlandı (geldi ${detail.state})`);
    } finally {
      try {
        lock?.exec("ROLLBACK");
        lock?.close();
      } catch {
        // kilit zaten kalktı
      }
      await ctx.close();
    }
  });
});
