// 2.4.4 31e (ana oturumun ek işi, 23.10.2026): içe alınan SAYI hücresi (JS number — API ile ya da ham okuyan istemciden gelen 12.125) metne String() ile
// çevrilip "12.125" oluyor, Türkçe binlik yazım sanılıp 12125 TL okunuyordu (2.4.3'te de; yeniden üretildi). Hesapla oluşan tutar (48,5 ÷ 4 = 12,125; faiz, KDV
// ayrıştırma) 1000 kat büyük içe alınabilirdi. Kural: SAYI türündeki hücre sayıdır — içe almada Türkçe ondalıkla, binlik ayraçsız metne çevrilir (tarayıcının Excel
// okuyucusu "Genel" biçimde aynısını üretir: "12,125"); tam sayı (telefon, kimlik, tarih seri no) değişmez; DİZGE hücre kullanıcının yazımıdır, Türkçe kural aynen
// ("12.125" dizgesi 12125, "1.500" 1500). Yollar (ders 9): Tablo (dataset stage), Excel'den cari, taksit, çek/senet, stok yüklemesi, serbest sayfa, Tablodan Aktar.
// "Nasıl bozulur?": S1 sayı hücresi binlik sanılır · S2 dizge kuralı değişir ("1.500" 1,5 olur) · S3 tam sayı (telefon / kimlik) ondalığa döner · S4 0,005 gibi küçük
// sayı 5 olur · S5 bir yol (cari / taksit / çek / stok / serbest sayfa) eski davranışta kalır · S6 eksi ve çok ondalıklı sayı.
import "./fixtures/saat-dilimi-istanbul.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cellText, matrixText, parseAmount as moneyAmount } from "../server/lib/money.mjs";
import { parseAmount } from "../server/lib/insight/validators.mjs";
import { sanitizeCell } from "../server/lib/import-gate.mjs";
import { matrixToFree } from "../server/lib/free-import.mjs";


describe("31e N2: İngilizce yazım '1,234.56' iki çözümleyicide aynı (1234,56); Türkçe kurallar aynen (birim)", () => {
  test("money.parseAmount = insight parseAmount (B10/B11)", () => {
    const cases = [["1,234.56", 1234.56], ["1.234,56", 1234.56], ["1.500", 1500], ["12,125", 12.125], ["12.125", 12125], ["1,5", 1.5], ["1.234.567", 1234567], ["12.5", 12.5], ["-1,234.56", -1234.56]];
    for (const [text, expected] of cases) {
      assert.equal(moneyAmount(text), expected, `money.parseAmount(${text})`);
      assert.equal(parseAmount(text), expected, `insight parseAmount(${text})`);
    }
  });
});

describe("31e sayı hücresi: dönüşüm ve ayrıştırma (birim)", () => {
  test("cellText: 12.125 → '12,125', 0.005 → '0,005', -12.5 → '-12,5', 333.3333333 → '333,3333333'; tam sayı ve dizge olduğu gibi (S1/S3/S4/S6)", () => {
    assert.deepEqual([12.125, 0.005, -12.5, 333.3333333, 1500, 5551234567, 10000000146, 45000, "12.125", "1.500", null].map(cellText), ["12,125", "0,005", "-12,5", "333,3333333", "1500", "5551234567", "10000000146", "45000", "12.125", "1.500", ""]);
    assert.deepEqual(matrixText([["A", 12.125], [1500, "x"]]), [["A", "12,125"], ["1500", "x"]]);
  });

  test("ayrıştırma: sayı türü sayıdır; dizgede Türkçe kural aynen (S2)", () => {
    assert.deepEqual([12.125, 0.005, 1500, "12.125", "1.500", "12,125", "1.234,56"].map(parseAmount), [12.125, 0.005, 1500, 12125, 1500, 12.125, 1234.56]);
    assert.deepEqual(["12,125", "12.125", "1.500"].map(moneyAmount), [12.125, 12125, 1500]);
    assert.equal(parseAmount(cellText(12.125)), 12.125, "içe almada çevrilen metin geri aynı sayı");
    assert.equal(sanitizeCell(12.125), "12,125", "Excel içe alma kapısı (cari / stok / çek)");
    assert.deepEqual(matrixToFree({ matrix: [["Tutar"], [12.125]] }).rows, [["12,125"]], "serbest sayfa içe alma");
  });
});
