// 2.4.9 B3 T1 (docs/2.4.9-tasarim/B3-B4.md §B3-1, §B3-5 T1; ölçütler tasarım notunda ÖNCEDEN yazılı): T9 (01.11) 40 toplu gönderimde şirket dosyası 185 → 434 MB, wa_jobs'un
// 175,8 MB'ının 124,8 MB'ı sayfa içi kullanılmayan yer. Kök neden: ~33 KB'lık dondurulmuş PDF işin KENDİ satırındaydı (taşma sayfaları); bakım kesinleşen işte NULL
// yapınca taşma sayfaları boş listeye düşüp yeniden kullanılıyor, ama satırın yaprak sayfadaki yerel kısmı (~0,5–4 KB) bir daha dolmuyordu (iş satırı bir daha büyümez,
// yeni işler sona eklenir) → her iş kalıcı boşluk, geçmişle doğrusal büyüme. Beklenen (A: PDF ayrı tabloda, kesinleşince SATIR silinir): 10 tur × 200 ekstre (her tur
// kabul + bakım) sonunda wa_jobs'ta sayfa içi boş ≤ %10, her bakımdan sonra wa_job_pdfs 0 satır, tur başına sayfa artışı (tur 2–10) sabit.
// Düzenek: gerçek kuyruk + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat; ölçüm SQLite dbstat (dosya biçiminin kendi sayımı).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startWa } from "./whatsapp-248-ortak.mjs";

const PEOPLE = 200;
const ROUNDS = 10;

describe("2.4.9 B3 T1 — toplu gönderimler şirket dosyasında kalıcı boşluk bırakmaz", () => {
  it(`${ROUNDS} tur × ${PEOPLE} ekstre (kabul + bakım): wa_jobs sayfa içi boş ≤ %10, bakımdan sonra wa_job_pdfs 0, tur başına sayfa artışı sabit`, async () => {
    const ctx = await startWa();
    try {
      ctx.fake.state.tier = "TIER_2K";
      const ids = [];
      for (let i = 0; i < PEOPLE; i += 1) ids.push((await ctx.account(`Büyüme ${i}`, `0554 100 ${String(Math.floor(i / 100)).padStart(2, "0")} ${String(i % 100).padStart(2, "0")}`, 100 + i)).id);
      const g = sql => ctx.store.get(sql);
      const pdfTable = () => Boolean(g("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'wa_job_pdfs'"));
      const rounds = [];
      let pages = g("PRAGMA page_count").page_count;
      for (let round = 1; round <= ROUNDS; round += 1) {
        const res = await ctx.batch({ kind: "statement", ids, preset: "thisMonth", sendAgain: true });
        assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
        const ran = await ctx.drain({ max: 100_000 });
        const jobs = g("SELECT SUM(pgsize) AS bytes, SUM(unused) AS unused FROM dbstat WHERE name = 'wa_jobs'");
        const now = g("PRAGMA page_count").page_count;
        rounds.push({ round, ran, growth: now - pages, jobsBytes: jobs.bytes, jobsUnused: jobs.unused, pdfRows: pdfTable() ? g("SELECT COUNT(*) AS n FROM wa_job_pdfs").n : null, accepted: g("SELECT COUNT(*) AS n FROM wa_jobs WHERE state = 'accepted'").n });
        pages = now;
        ctx.clock.advance(60_000);
      }
      const last = rounds.at(-1);
      const ratio = last.jobsUnused / last.jobsBytes;
      const perJob = last.jobsUnused / (ROUNDS * PEOPLE);
      // Ölçüm satırı (kanıt): tur başına sayfa artışı, wa_jobs boyu / boşu, wa_job_pdfs satırı.
      console.log(`# B3 T1 ölçüm: ${JSON.stringify(rounds.map(r => [r.round, r.growth, r.jobsBytes, r.jobsUnused, r.pdfRows]))}`);
      assert.deepEqual(rounds.map(r => r.ran), Array(ROUNDS).fill(PEOPLE), "ön koşul: her turda 200 iş yürüdü");
      assert.equal(last.accepted, ROUNDS * PEOPLE, "ön koşul: 2.000 ileti kabul");
      assert.ok(ratio <= 0.1, `wa_jobs sayfa içi boş %${(ratio * 100).toFixed(1)} > %10 (${(last.jobsUnused / 1048576).toFixed(2)} MB, iş başına ${Math.round(perJob)} bayt) — kesinleşen işin PDF'i satırda boşluk bırakıyor`);
      // "Tur başına artış sabit": tek tek turlar sayfa bölünmesiyle oynar (iş kimliği dizini rastgele UUID) → (a) tur 2–10'un her biri tur 1'in (200 PDF'in ilk yeri) %10'undan
      // küçük = boşalan PDF sayfaları sonraki turda yeniden kullanılıyor; (b) son üç turun ortalaması ilk üç kararlı turun ≤ 1,5 katı = artış geçmişle büyümüyor.
      const steady = rounds.slice(1).map(r => r.growth);
      const mean = list => list.reduce((sum, n) => sum + n, 0) / list.length;
      assert.ok(Math.max(...steady) < 0.1 * rounds[0].growth, `PDF sayfaları yeniden kullanılmıyor (tur 1: ${rounds[0].growth}, tur 2–${ROUNDS}: ${steady.join(", ")})`);
      assert.ok(mean(steady.slice(-3)) <= 1.5 * mean(steady.slice(0, 3)), `tur başına sayfa artışı geçmişle büyüyor (tur 2–${ROUNDS}: ${steady.join(", ")})`);
      assert.deepEqual(rounds.map(r => r.pdfRows), Array(ROUNDS).fill(0), "her bakımdan sonra wa_job_pdfs boş (null = tablo yok)");
    } finally {
      await ctx.close();
    }
  });
});
