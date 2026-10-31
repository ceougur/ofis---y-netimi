// 2.4.8 T2 bulgu 1 (YÜKSEK; bağımsız gözden geçirme r5) — KULLANICI KARARI T2-1 = A (31.10.2026 ~03:20 UTC: "önerilerini yap"); kural tek yerde
// server/lib/whatsapp/donem.mjs. Bulgu: varsayılan "Bu Ay" (ayın 1'i → BUGÜN), "Son 3 Ay" ve "Tüm Hareketler" bugüne kadar → ertesi gün AYNI seçim farklı dönem
// sayılıyor, "Daha Önce Gönderildi" (R3) ve "Zaten Kuyrukta" (§7a 9) çalışmıyor, aynı kişilere ikinci ekstre gidiyordu.
// Kural A: aynı cari + aynı şablon + aynı dönem —
//   "Bu Ay" / "Geçen Ay": aynı TAKVİM AYI (başlangıç ayı aynıysa aynı dönem, bitiş günü fark etmez); SEÇİM ADI ANAHTARA GİRMEZ (KULLANICI KARARI 31.10.2026
//     ~05:25 UTC "a", dar kontrol 3 ORTA-1): ayın son günü "Bu Ay" ile ertesi gün "Geçen Ay" aynı ekstre → "Daha Önce Gönderildi" / "Zaten Kuyrukta";
//   "Son 3 Ay" / "Tüm Hareketler": aynı seçim SON 7 GÜN içinde gönderilmişse aynı dönem;
//   özel tarih aralığı: başlangıç VE bitiş birebir aynı.
// Uyarı son gönderim tarihini gösterir (sentBefore), varsayılan "Bunları Çıkar" (R3). Ödeme Hatırlatma'nın "aynı gün" kuralı değişmez.
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5); beklenenler kullanıcının kural metninden (A); sahte saat (ders 13).
// Program "bugün"ü süreç YEREL saatinden okur (server/lib/clock.mjs localDay): gün dönümü isteyen başlangıçlar yerel saatle kurulur ve ön koşul olarak
// denetlenir (dar kontrol 3 DÜŞÜK-T: "22:00Z" TR saatinde gün döndürmüyordu); dosya TZ=UTC ve TZ=Europe/Istanbul ile koşulur.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Yerel saatle ISO anı (ay 1–12). */
const localIso = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0).toISOString();

/** Seçimi gönderir (toplu iş + işçi) ve kabul anını döner. */
async function sendOnce(ctx, body) {
  const res = await ctx.batch(body);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  await ctx.drain();
  const job = (await ctx.jobs(res.data.data.batch.id))[0];
  assert.equal(job.state, "accepted", "ön koşul: ilk gönderim Meta'ya kabul ettirildi");
  return job.acceptedAt;
}
/** Önizlemedeki kişinin durumu: eleme nedeni (yoksa "gönderilecek") + son gönderim. */
async function previewOf(ctx, body) {
  const res = await ctx.api.post(URLS.preview, body);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const person = res.data.data.people[0];
  return { skip: person.skip || "gönderilecek", sentBefore: person.sentBefore || null };
}

describe("2.4.8 T2-1 = A — 'Daha Önce Gönderildi' / 'Zaten Kuyrukta' dönem eşliği", () => {
  it("Bu Ay, ertesi gün aynı seçim: gönderilmiş kişi 'Daha Önce Gönderildi', bekleyen kişi 'Zaten Kuyrukta' → yeni toplu iş açılmaz; her kişiye BİR ekstre", async () => {
    const ctx = await startWa({ now: { time: localIso(2026, 11, 3, 22), fixed: true } }); // YEREL 03.11 22:00
    try {
      assert.equal((await ctx.api.put(URLS.sending, { dailyCap: 1 })).status, 200);
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [a.id, b.id], preset: "thisMonth" };
      const first = await ctx.batch(body);
      assert.equal(first.status, 200, JSON.stringify(first.data));
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(first.data.data.batch.id)).map(job => job.state), ["accepted", "limited"], "ön koşul: A gitti, B sınırda");
      ctx.clock.advance(4 * HOUR); // ertesi takvim günü (sınır penceresi henüz açılmadı)
      assert.equal(ctx.clock.today(), "2026-11-04", "ön koşul: program günü döndü (yerel saat)");
      const preview = (await ctx.api.post(URLS.preview, body)).data.data;
      const skip = Object.fromEntries(preview.people.map(person => [person.name, person.skip || "gönderilecek"]));
      assert.deepEqual(skip, { "Ayşe Yılmaz": "Daha Önce Gönderildi", "Burak Kaya": "Zaten Kuyrukta" }, `ertesi gün aynı 'Bu Ay' seçimi aynı dönem sayılmalı (geldi ${JSON.stringify(skip)})`);
      const second = await ctx.batch(body);
      assert.equal(second.status, 400, `bütün seçilenler elendi → toplu iş açılmaz (§7a 31; geldi ${second.status})`);
      ctx.clock.advance(21 * HOUR);
      await ctx.drain();
      ctx.clock.advance(25 * HOUR);
      await ctx.drain();
      const count = phone => ctx.messages().filter(item => item.to === phone).length;
      assert.equal(count("+905321112233"), 1, "A'ya bir ekstre");
      assert.equal(count("+905334445566"), 1, "B'ye bir ekstre");
    } finally {
      await ctx.close();
    }
  });

  it("Bu Ay: ay içinde sonraki bir günde 'Daha Önce Gönderildi' (son gönderim tarihiyle); ay dönümünde yeni ay → gönderilir", async () => {
    const ctx = await startWa(); // 03.11.2026
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const body = { kind: "statement", ids: [a.id], preset: "thisMonth" };
      const sentAt = await sendOnce(ctx, body);
      ctx.clock.advance(DAY);
      assert.deepEqual(await previewOf(ctx, body), { skip: "Daha Önce Gönderildi", sentBefore: sentAt }, "ertesi gün (aynı ay)");
      ctx.clock.advance(16 * DAY); // 20.11
      assert.deepEqual(await previewOf(ctx, body), { skip: "Daha Önce Gönderildi", sentBefore: sentAt }, "ay içinde sonraki gün");
      ctx.clock.advance(12 * DAY); // 02.12: "Bu Ay" artık Aralık
      assert.equal((await previewOf(ctx, body)).skip, "gönderilecek", "ay dönümünde yeni ay ayrı dönem");
    } finally {
      await ctx.close();
    }
  });

  it("Geçen Ay: aynı ay içinde yeniden seçilince 'Daha Önce Gönderildi'; sonraki ayda 'Geçen Ay' başka takvim ayı → gönderilir", async () => {
    const ctx = await startWa(); // 03.11.2026 → Geçen Ay = Ekim
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const body = { kind: "statement", ids: [a.id], preset: "lastMonth" };
      const sentAt = await sendOnce(ctx, body);
      ctx.clock.advance(22 * DAY); // 25.11 → yine Ekim
      assert.deepEqual(await previewOf(ctx, body), { skip: "Daha Önce Gönderildi", sentBefore: sentAt });
      ctx.clock.advance(7 * DAY); // 02.12 → Geçen Ay = Kasım
      assert.equal((await previewOf(ctx, body)).skip, "gönderilecek");
    } finally {
      await ctx.close();
    }
  });

  it("'Bu Ay' (yarım ay, 1–3 Kasım) ile Aralık'taki 'Geçen Ay' (Kasım) aynı takvim ayı → 'Daha Önce Gönderildi'; 'Yine de Gönder' ile gider (KULLANICI KARARI 31.10 'a')", async () => {
    const ctx = await startWa(); // 03.11.2026
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const sentAt = await sendOnce(ctx, { kind: "statement", ids: [a.id], preset: "thisMonth" }); // Kasım (1–3)
      ctx.clock.advance(29 * DAY); // 02.12 → Geçen Ay = Kasım (tam ay)
      const body = { kind: "statement", ids: [a.id], preset: "lastMonth" };
      assert.deepEqual(await previewOf(ctx, body), { skip: "Daha Önce Gönderildi", sentBefore: sentAt }, "seçim adı anahtara girmez: aynı takvim ayı aynı dönem");
      const again = await ctx.batch({ ...body, sendAgain: true });
      assert.equal(again.status, 200, `'Yine de Gönder' ile toplu iş açılır (geldi ${again.status} ${JSON.stringify(again.data)})`);
      await ctx.drain();
      assert.equal(ctx.messages().filter(item => item.to === "+905321112233").length, 2, "'Yine de Gönder' ile ikinci ekstre gider");
    } finally {
      await ctx.close();
    }
  });

  // Dar kontrol 3 ORTA-1 (incelemecinin betiği r1-ay-sonu-bu-ay-gecen-ay.mjs kalıcı teste): ayın SON günü "Bu Ay" (01.10–31.10) gönderildi / sınırda bekliyor;
  // ertesi gün "Geçen Ay" (01.10–31.10, BİREBİR aynı ekstre) → A "Daha Önce Gönderildi", B "Zaten Kuyrukta", ikinci toplu iş açılmaz, kişi başına BİR ekstre.
  // Yıl dönümü: 31.12 "Bu Ay" (Aralık) ↔ 01.01 "Geçen Ay" (önceki yılın Aralık'ı).
  for (const [ad, y, m, d, next, gecenAy] of [
    ["ay sonu 31.10 'Bu Ay' → 01.11 'Geçen Ay'", 2026, 10, 31, "2026-11-01", { from: "2026-10-01", to: "2026-10-31" }],
    ["yıl dönümü 31.12 'Bu Ay' → 01.01 'Geçen Ay'", 2026, 12, 31, "2027-01-01", { from: "2026-12-01", to: "2026-12-31" }],
  ]) {
    it(`${ad}: aynı takvim ayı → 'Daha Önce Gönderildi' / 'Zaten Kuyrukta'; ikinci iş açılmaz, kişi başına BİR ekstre`, async () => {
      const ctx = await startWa({ now: { time: localIso(y, m, d, 10), fixed: true } });
      try {
        assert.equal((await ctx.api.put(URLS.sending, { dailyCap: 1 })).status, 200);
        const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
        const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
        const first = await ctx.batch({ kind: "statement", ids: [a.id, b.id], preset: "thisMonth" });
        assert.equal(first.status, 200, JSON.stringify(first.data));
        assert.deepEqual({ from: first.data.data.batch.period.from, to: first.data.data.batch.period.to }, gecenAy, "ön koşul: 'Bu Ay' ayın tamamı");
        await ctx.drain();
        assert.deepEqual((await ctx.jobs(first.data.data.batch.id)).map(job => job.state), ["accepted", "limited"], "ön koşul: A gitti, B sınırda");
        ctx.clock.advance(23 * HOUR); // ertesi gün 09:00 (yerel; sınır penceresi henüz açılmadı)
        assert.equal(ctx.clock.today(), next, "ön koşul: program günü döndü");
        const body = { kind: "statement", ids: [a.id, b.id], preset: "lastMonth" };
        const preview = (await ctx.api.post(URLS.preview, body)).data.data;
        assert.deepEqual({ from: preview.period.from, to: preview.period.to }, gecenAy, "ön koşul: 'Geçen Ay' birebir aynı aralık");
        const skip = Object.fromEntries(preview.people.map(person => [person.name, person.skip || "gönderilecek"]));
        assert.deepEqual(skip, { "Ayşe Yılmaz": "Daha Önce Gönderildi", "Burak Kaya": "Zaten Kuyrukta" }, `'Bu Ay' ile 'Geçen Ay' aynı takvim ayı → aynı dönem (geldi ${JSON.stringify(skip)})`);
        const second = await ctx.batch(body);
        assert.equal(second.status, 400, `bütün seçilenler elendi → toplu iş açılmaz (§7a 31; geldi ${second.status})`);
        for (let i = 0; i < 4; i += 1) {
          ctx.clock.advance(25 * HOUR);
          await ctx.drain();
        }
        const count = phone => ctx.messages().filter(item => item.to === phone).length;
        assert.equal(count("+905321112233"), 1, "A'ya bir ekstre");
        assert.equal(count("+905334445566"), 1, "B'ye bir ekstre (sınırdan sonra ilk iş)");
      } finally {
        await ctx.close();
      }
    });
  }

  for (const preset of ["last3", "all"]) {
    it(`${preset === "last3" ? "Son 3 Ay" : "Tüm Hareketler"}: aynı seçim 6. gün 'Daha Önce Gönderildi', 8. gün gönderilir`, async () => {
      const ctx = await startWa();
      try {
        const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
        const body = { kind: "statement", ids: [a.id], preset };
        const sentAt = await sendOnce(ctx, body);
        ctx.clock.advance(6 * DAY);
        assert.deepEqual(await previewOf(ctx, body), { skip: "Daha Önce Gönderildi", sentBefore: sentAt }, "6. gün (son 7 gün içinde)");
        assert.equal((await previewOf(ctx, { kind: "statement", ids: [a.id], preset: preset === "last3" ? "all" : "last3" })).skip, "gönderilecek", "öbür seçim ayrı dönem");
        ctx.clock.advance(2 * DAY);
        assert.equal((await previewOf(ctx, body)).skip, "gönderilecek", "8. gün (son 7 günün dışında)");
      } finally {
        await ctx.close();
      }
    });
  }

  it("Özel tarih aralığı: başlangıç ve bitiş birebir aynıysa 'Daha Önce Gönderildi', biri farklıysa gönderilir", async () => {
    const ctx = await startWa();
    try {
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const body = { kind: "statement", ids: [a.id], from: "2026-10-01", to: "2026-10-15" };
      const sentAt = await sendOnce(ctx, body);
      ctx.clock.advance(20 * DAY);
      assert.deepEqual(await previewOf(ctx, body), { skip: "Daha Önce Gönderildi", sentBefore: sentAt }, "birebir aynı aralık");
      assert.equal((await previewOf(ctx, { ...body, to: "2026-10-16" })).skip, "gönderilecek", "bitiş farklı");
      assert.equal((await previewOf(ctx, { ...body, from: "2026-10-02" })).skip, "gönderilecek", "başlangıç farklı");
    } finally {
      await ctx.close();
    }
  });
});
