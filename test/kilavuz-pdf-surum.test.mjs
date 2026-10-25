// Programın içindeki kılavuz PDF'inin (client/kilavuz — güncelleme zip'i ve kurulum bunu taşır) sürümü = kılavuz HTML'inin sürümü = programın
// sürümü (package.json; kaynak budur — pdf-denetle.mjs de package.json'a bakar, test/kilavuz-surum.test.mjs HTML'i ona bağlar).
// Ders 42 (25.10.2026): 2.4.5'te HTML 2.4.5'e güncellendi, PDF "Sürüm 2.4.4" kaldı; tam kapı ve CI #871 yeşildi, çünkü PDF'i yalnız
// docs/kilavuz/pdf-denetle.mjs (pdftotext + tarayıcı, CI'de yok) denetliyordu. Bu test PDF metnini bağımlılıksız okur (test/pdf-metin.mjs,
// yalnız node:zlib) → Linux ve Windows CI işlerinde aynı koşar.
//
// NASIL BOZARIM: (1) sürüm yükseltilir, HTML güncellenir, PDF yeniden üretilmez (ders 42); (2) PDF üretilir ama client/kilavuz'a kopyalanmaz;
// (3) kapak güncel, dip not eski; (4) okuyucu metni okuyamaz → boş metin "sürüm yok" diye geçmemeli (ders 4). Hepsi burada kırmızı.
// Kırmızı kanıt: KILAVUZ_PDF ortam değişkeni başka (eski sürümlü) bir PDF'i gösterir.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { pdfText } from "./pdf-metin.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
const PDF = process.env.KILAVUZ_PDF || path.join(ROOT, "client", "kilavuz", "DestekOfis-Kullanim-Kilavuzu.pdf");
const html = readFileSync(path.join(ROOT, "docs", "kilavuz", "DestekOfis-Kullanim-Kilavuzu.html"), "utf8");
// Chromium "fi" bağ harfini (U+FB01) yazar: "DestekOﬁs" → NFKC ile "DestekOfis"; satır/öğe aralarındaki boşluklar (CRLF dahil) tek boşluk.
const flat = text => text.normalize("NFKC").replace(/\s+/g, " ");
const KAPAK = /Sürüm (\d+\.\d+\.\d+)/g;
const DIP = /DestekOfis (\d+\.\d+\.\d+) · Kısa Kullanım Kılavuzu/g;
const found = (text, re) => [...new Set([...text.matchAll(re)].map(m => m[1]))];

describe("Kılavuz PDF sürümü (client/kilavuz)", () => {
  // PDF okuma hatası (bozuk/okunamayan dosya) suite gövdesinde değil testin içinde atılır → "0 test" değil, kırmızı test olur (ders 2, 4).
  let cache;
  const read = () => (cache ??= flat(pdfText(readFileSync(PDF))));
  const htmlText = flat(html);
  const htmlVersions = [...new Set([...found(htmlText, KAPAK), ...found(htmlText, DIP)])];

  it("PDF metni okunur (boş değil, bilinen başlık var)", () => {
    const text = read();
    assert.ok(text.length > 1000, `PDF metni okunamadı ya da çok kısa (${text.length} karakter): ${PDF}`);
    assert.ok(text.includes("Kısa Kullanım Kılavuzu"), "PDF metninde “Kısa Kullanım Kılavuzu” yok — okuyucu metni çözemedi");
  });
  it("PDF kapağı ve dip notu = HTML sürümü = program sürümü", () => {
    const text = read();
    const kapak = found(text, KAPAK);
    const dip = found(text, DIP);
    assert.ok(kapak.length, "PDF kapağında “Sürüm x.y.z” bulunamadı");
    assert.ok(dip.length, "PDF dip notunda “DestekOfis x.y.z · Kısa Kullanım Kılavuzu” bulunamadı");
    const pdfVersions = [...new Set([...kapak, ...dip])];
    const htmlV = htmlVersions.join(", ") || "yok";
    assert.ok(pdfVersions.length === 1 && htmlVersions.length === 1 && pdfVersions[0] === htmlVersions[0] && htmlVersions[0] === version,
      `PDF sürümü ${pdfVersions.join(", ")} ≠ HTML ${htmlV} ya da program ${version} (kapak: ${kapak.join(", ")}; dip not: ${dip.join(", ")}). ` +
      "Kılavuzu yeniden üretin: node docs/kilavuz/pdf-uret.mjs docs/kilavuz DestekOfis-Kullanim-Kilavuzu && cp docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf client/kilavuz/ && node docs/kilavuz/pdf-denetle.mjs");
  });
});
