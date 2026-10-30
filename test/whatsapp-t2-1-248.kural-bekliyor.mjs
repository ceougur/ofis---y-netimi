// 2.4.8 T2 bulgu 1 (YÜKSEK; bağımsız gözden geçirme r5) — KURAL BEKLİYOR (ders 43: "kime kaç kez" kuralı kullanıcıya soruldu; yanıt gelene dek ne kodda ne
// testte kesinleşmez). BU DOSYA BİLEREK `*.test.mjs` DEĞİL: npm test / CI'ye girmez (kırmızıdır — kural verilince beklentiler kurala göre yazılır ve dosya
// test/whatsapp-t2-1-248.test.mjs adıyla suite'e alınır). Elle koşu: node --disable-warning=ExperimentalWarning --test test/whatsapp-t2-1-248.kural-bekliyor.mjs
//
// Bulgu: varsayılan dönem "Bu Ay" (preset thisMonth → from = ayın 1'i, to = BUGÜN) — "Son 3 Ay" ve "Tüm Hareketler" de bugüne kadar. Çift başlatma (§7a 9 "Zaten
// Kuyrukta") ve R3 ("Daha Önce Gönderildi") dönemi period_from|period_to ile karşılaştırıyor → ertesi gün AYNI "Bu Ay" seçimi FARKLI dönem sayılıyor, aynı kişilere
// ikinci ekstre gidiyor. Dönem eşliği tek yerde: server/lib/whatsapp/donem.mjs (periodKeyOf / queueKeyOf).
//
// Aşağıdaki beklenti T2'nin yazdığı sonuçtur (ertesi gün aynı seçim: bekleyen kişi "Zaten Kuyrukta", gönderilmiş kişi "Daha Önce Gönderildi"; her kişiye bir
// ekstre) — KULLANICININ KARARI DEĞİLDİR; kural gelince ona göre düzeltilir.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URLS, startWa } from "./whatsapp-248-ortak.mjs";

const HOUR = 3_600_000;

describe("2.4.8 T2-1 — 'Bu Ay' ertesi gün aynı dönem mi (KURAL BEKLİYOR)", () => {
  it("gün 1: A gider, B sınırda bekler; gün 2 aynı 'Bu Ay' seçimi: B 'Zaten Kuyrukta', A 'Daha Önce Gönderildi' → yeni toplu iş açılmaz; her kişiye BİR ekstre", async () => {
    const ctx = await startWa({ now: { time: "2026-11-03T22:00:00Z", fixed: true } });
    try {
      assert.equal((await ctx.api.put(URLS.sending, { dailyCap: 1 })).status, 200);
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const b = await ctx.account("Burak Kaya", "0533 444 55 66", 800);
      const body = { kind: "statement", ids: [a.id, b.id], preset: "thisMonth" };
      const first = await ctx.batch(body);
      assert.equal(first.status, 200, JSON.stringify(first.data));
      await ctx.drain();
      assert.deepEqual((await ctx.jobs(first.data.data.batch.id)).map(job => job.state), ["accepted", "limited"], "ön koşul: A gitti, B sınırda");
      // Ertesi takvim günü (sınır penceresi henüz açılmadı).
      ctx.clock.advance(4 * HOUR);
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
});
