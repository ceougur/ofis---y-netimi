// 2.5.0 BAŞ MİMAR KARARI 20.11.2026 22:45 (3) — S231 küçük turu: Çek / Senet içe aktarma (eşleme) penceresinin metni S223 = A'dan sonra tam doğru değildi
// ('birebir aynı olan tek cari'); eşleşme artık büyük / küçük harf (Türkçe I / ı, İ / i dahil) ve boşluk farkını saymıyor. Kaynak denetimi (ekrandaki
// metin ekran senaryosunda ayrıca görülür). Satır bölme CRLF'yi bilir (ders 27).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../client/assets/hof-cheques.js", import.meta.url), "utf8");
const NEW = "Keşideci adı aynı olan (büyük / küçük harf ve boşluk farkı sayılmaz) tek cari varsa evrak o cariye bağlanır.";

describe("S231 — Çek / Senet eşleme penceresinin metni", () => {
  it("yeni cümle var (cümle düzeni), eski 'birebir aynı olan tek cari' yok", () => {
    const lines = source.split(/\r?\n/);
    const intro = lines.filter(line => line.includes("Keşideci adı"));
    assert.equal(intro.length, 1, `pencere metni satırı: ${intro.length}`);
    assert.ok(intro[0].includes(NEW), `metin: ${intro[0].trim().slice(0, 260)}`);
    assert.equal(source.includes("birebir aynı olan tek cari"), false, "eski metin kaldı");
  });
});
