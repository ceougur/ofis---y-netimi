// 2.4.9 B3 T1 (docs/2.4.9-tasarim/B3-B4.md §B3-1, §B3-5 T1; ölçütler tasarım notunda ÖNCEDEN yazılı): T9 (01.11) 40 toplu gönderimde şirket dosyası 185 → 434 MB, wa_jobs'un
// 175,8 MB'ının 124,8 MB'ı sayfa içi kullanılmayan yer. Kök neden: ~33 KB'lık dondurulmuş PDF işin KENDİ satırındaydı (taşma sayfaları); bakım kesinleşen işte NULL
// yapınca taşma sayfaları boş listeye düşüp yeniden kullanılıyor, ama satırın yaprak sayfadaki yerel kısmı (~0,5–4 KB) bir daha dolmuyordu (iş satırı bir daha büyümez,
// yeni işler sona eklenir) → her iş kalıcı boşluk, geçmişle doğrusal büyüme. Beklenen (A: PDF ayrı tabloda, kesinleşince SATIR silinir): 10 tur × 200 ekstre (her tur
// kabul + bakım) sonunda wa_jobs'ta sayfa içi boş ≤ %10, her bakımdan sonra wa_job_pdfs 0 satır, tur başına sayfa artışı (tur 2–10) sabit.
// Düzenek: gerçek kuyruk + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5) + sahte saat; ölçüm SQLite dbstat (dosya biçiminin kendi sayımı).
// 2.5.0 KÖK NEDEN (CI #1008 Windows Node 22, "tur 2–10: 46, 47, 0, 97, 54, 39, 0, 106, 46"; zorla: test/whatsapp-b3-buyume-zorla.mjs): işçinin bakımı drain()'in sonunda VE her
// runOnce() turunda GERÇEK saatle 60 sn'de bir koşar (scheduler.mjs turn(), maintainMs). Yavaş makinede bu ara bakım bir turun ortasına düşer, o turun kabul edilmiş
// işlerinin PDF'lerini siler; kalan PDF'ler o sayfaları kullanır → o turda page_count artmaz (0), sonraki tur havuzu geri doldurur (≈ 2 tur). Ürün doğru (wa_jobs bayt
// bayt aynı, toplam artış doğrusal); tek tur page_count artışı gerçek saate bağlıydı. Ölçütler bu yüzden (G3 gerekçesi): canlı veri (page_count − freelist_count, tur
// SONU bakımından sonra; PDF havuzunun anlık doluluğundan bağımsız) tur başına ve geçmişle; dosya büyümesi (havuzun yeniden kullanımı) BİRİKİMLİ; boş liste tur başına.
// Eşiklerin ölçeği tur 1 artışı değil PDF baytlarından HAVUZ (ara bakım tur 1'e de düşebilir). Ara bakım ölçüm satırında 6. alan (o tur içinde silinen PDF sayısı).
// Zorla (belirlenimci): node test/whatsapp-b3-buyume-zorla.mjs --tur 4,8 (CI #1008 deseni) · --tur 1 · --tur 1,2,…,10 (test/fixtures/bakim-sicrama.mjs).
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
      const count = () => {
        const pages = g("PRAGMA page_count").page_count;
        const free = g("PRAGMA freelist_count").freelist_count;
        return { pages, free, used: pages - free };
      };
      let before = count();
      for (let round = 1; round <= ROUNDS; round += 1) {
        const res = await ctx.batch({ kind: "statement", ids, preset: "thisMonth", sendAgain: true });
        assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300));
        // drain() = runOnce() döngüsü + sonda bakım; burada ikiye ayrılır ki tur İÇİNDE (gerçek saatle 60 sn dolunca) koşan ara bakım ölçülsün (silinen PDF sayısı).
        const ran = await ctx.drain({ max: 100_000, maintain: false });
        const held = pdfTable() ? g("SELECT COUNT(*) AS n, COALESCE(SUM(length(pdf)), 0) AS bytes FROM wa_job_pdfs") : { n: 0, bytes: 0 };
        const midDeleted = pdfTable() ? PEOPLE - held.n : null;
        await ctx.wa.scheduler.maintain();
        const jobs = g("SELECT SUM(pgsize) AS bytes, SUM(unused) AS unused FROM dbstat WHERE name = 'wa_jobs'");
        const after = count();
        rounds.push({ round, ran, growth: after.pages - before.pages, usedGrowth: after.used - before.used, free: after.free, midDeleted, pdfAvg: held.n ? held.bytes / held.n : null, jobsBytes: jobs.bytes, jobsUnused: jobs.unused, pdfRows: pdfTable() ? g("SELECT COUNT(*) AS n FROM wa_job_pdfs").n : null, accepted: g("SELECT COUNT(*) AS n FROM wa_jobs WHERE state = 'accepted'").n });
        before = after;
        ctx.clock.advance(60_000);
      }
      const last = rounds.at(-1);
      const ratio = last.jobsUnused / last.jobsBytes;
      const perJob = last.jobsUnused / (ROUNDS * PEOPLE);
      // Ölçüm satırı (kanıt): [tur, page_count artışı, wa_jobs boyu, wa_jobs boşu, wa_job_pdfs satırı, tur içi ara bakımın sildiği PDF, canlı sayfa artışı, boş liste].
      console.log(`# B3 T1 ölçüm: ${JSON.stringify(rounds.map(r => [r.round, r.growth, r.jobsBytes, r.jobsUnused, r.pdfRows, r.midDeleted, r.usedGrowth, r.free]))}`);
      assert.deepEqual(rounds.map(r => r.ran), Array(ROUNDS).fill(PEOPLE), "ön koşul: her turda 200 iş yürüdü");
      assert.equal(last.accepted, ROUNDS * PEOPLE, "ön koşul: 2.000 ileti kabul");
      assert.ok(ratio <= 0.1, `wa_jobs sayfa içi boş %${(ratio * 100).toFixed(1)} > %10 (${(last.jobsUnused / 1048576).toFixed(2)} MB, iş başına ${Math.round(perJob)} bayt) — kesinleşen işin PDF'i satırda boşluk bırakıyor`);
      // "Tur başına artış sabit" (tek tek turlar iş kimliği dizininin rastgele UUID bölünmesiyle oynar). HAVUZ = bir turun 200 PDF'inin sayfa sayısı, PDF baytlarından
      // (wa_job_pdfs, bakımdan önce; tablo yoksa — B3 öncesi ürün — tur 1 artışı). 2.5.0: tur 1 artışı havuz yerine KULLANILMAZ, çünkü ara bakım tur 1'in ortasına düşerse
      // (tur 1 > 60 sn gerçek saat; zorla: --tur 1) tur 1 havuzun yarısını, tur 2 öbür yarısını alır (856 + 860) ve tur 1'e bağlı eşikler kırmızı verirdi.
      // (a) tur 2–10'un HER birinde bakımdan sonra kalan canlı veri artışı havuzun %10'undan küçük = kesinleşen işin PDF'i (ya da yeri) canlı kalmıyor;
      // (b) 10 turun BİRİKİMLİ dosya (page_count) artışından bir havuz çıkınca tur başına kalan havuzun %10'undan küçük = boşalan PDF sayfaları yeniden kullanılıyor (dosya bir
      //     havuzdan fazla büyümüyor) — birikimli, çünkü tek tur artışı ara bakımın (gerçek saat) o turun ortasına düşüp düşmemesine bağlı (0 / ≈ 2 tur; KÖK NEDEN);
      // (c) hiçbir turun sonunda boş liste havuzun 1,1 katını aşmıyor = boşalan sayfalar birikmiyor (her tur yeniden kullanılıyor);
      // (d) canlı veri artışında son üç turun ortalaması ilk üç kararlı turun ≤ 1,5 katı = artış geçmişle büyümüyor.
      // NOT (dişi): B3 hatası (v2.4.8: PDF işin satırında) bu düzenekte canlı veri artışını tur başına ~48'den ~110 sayfaya çıkarır — (a)–(d) eşiklerinin ALTINDA; hatayı
      // yakalayan "sayfa içi boş ≤ %10" denetimidir (v2.4.8'de %67,5). (a)–(d) PDF sayfalarının yeniden kullanılmadığı / biriktiği hataları yakalar.
      const pageSize = g("PRAGMA page_size").page_size;
      const avg = Math.max(0, ...rounds.map(r => r.pdfAvg || 0));
      const pool = avg ? Math.ceil((PEOPLE * avg) / pageSize) : rounds[0].growth;
      console.log(`# B3 T1 havuz: ${pool} sayfa (${avg ? `PDF ortalaması ${Math.round(avg)} bayt × ${PEOPLE} / ${pageSize}` : "wa_job_pdfs yok → tur 1 artışı"})`);
      const steady = rounds.slice(1);
      const mean = list => list.reduce((sum, n) => sum + n, 0) / list.length;
      const used = steady.map(r => r.usedGrowth);
      const growth = rounds.map(r => r.growth);
      const total = growth.reduce((sum, n) => sum + n, 0);
      assert.ok(Math.max(...used) < 0.1 * pool, `kesinleşen işlerin PDF yeri bakımdan sonra canlı kalıyor (havuz ${pool} sayfa, tur 2–${ROUNDS} canlı artış: ${used.join(", ")})`);
      assert.ok((total - pool) / ROUNDS < 0.1 * pool, `PDF sayfaları yeniden kullanılmıyor (havuz ${pool} sayfa, tur 1–${ROUNDS} artış: ${growth.join(", ")}; toplam ${total})`);
      assert.ok(Math.max(...rounds.map(r => r.free)) <= 1.1 * pool, `boşalan sayfalar birikiyor (havuz ${pool} sayfa, boş liste tur 1–${ROUNDS}: ${rounds.map(r => r.free).join(", ")})`);
      assert.ok(mean(used.slice(-3)) <= 1.5 * mean(used.slice(0, 3)), `tur başına canlı veri artışı geçmişle büyüyor (tur 2–${ROUNDS}: ${used.join(", ")}; page_count tur 1–${ROUNDS}: ${growth.join(", ")})`);
      assert.deepEqual(rounds.map(r => r.pdfRows), Array(ROUNDS).fill(0), "her bakımdan sonra wa_job_pdfs boş (null = tablo yok)");
    } finally {
      await ctx.close();
    }
  });
});
