// 2.1.0 — Aşama 2, Dilim 1: kesin para (server/lib/minor.mjs; docs/BANKA-MODULU-PLAN.md §5.1, K1).
// Yeni banka tablolarında tutar INTEGER kuruş, oran ppm (milyonda bir), kur e6 (×10^6) saklanır; hesap BigInt ile yapılır.
// Mevcut REAL kolonlar bu projede değişmez; kuruş kesinliğini kapı zorunlu tutar. Bu dosyadaki ÖZELLİK TESTİ, REAL kolonda
// saklanan k/100 değerinin hem JS (toCents/toMinor) hem SQL (CAST(ROUND(x*100) AS INTEGER)) tarafında k'ya döndüğünü
// [1 kuruş, 1e12 TL] aralığının sınırlarında ve 10^6 rastgele değerde kanıtlar.
//
// NASIL BOZARIM (bu testlerin kaynağı):
//   - 3 ondalık ("1,005", "0,005", "1.234,567"), "1,500" (İngilizce binlik mi, 1,5 mi? belirsiz) → 400, sessizce yuvarlanmaz.
//   - 1e13 TL, 1e12 TL + 1 kuruş → 400; tam 1e12 TL kabul.
//   - Eksi ("-5", Unicode "−5"), sıfır ("0", "0,00") → 400 (izin verilmedikçe).
//   - Bozuk metin: "", "abc", "1e5", "0x10", "1_000", "1..2", ",5", "5,", "1,234.56", "1.23.456", "١٢٣", null, NaN, Infinity → 400.
//   - Kayan nokta artığıyla gelen sayı (0.1 + 0.2) → 400 (0,30'a yuvarlanmaz).
//   - Tanınmayan para birimi → 400.
//   - BigInt çarpmada güvenli tamsayı sınırını aşan sonuç → hata (sessiz taşma yok); kesirli girdi → hata.
//   - Yarım kuruş: iki yönde sıfırdan uzağa (roundMoney ile aynı: 1,005 → 1,01; −1,005 → −1,01; 2,675 → 2,68).
//   - Bölüştürme: Σ dilim = toplam (eksi toplam, 1 kuruşu 3'e bölme, sıfır ağırlık, ağırlıksız bölme dahil); artık son dilimde.
//   - Oran: "%2,5" = 25.000 ppm; 5 ondalıklı yüzde, %100'ü aşan, eksi → 400. Kur: 7 ondalık, 0, eksi → 400.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { roundMoney, toCents } from "../server/lib/money.mjs";
import {
  CURRENCY_DIGITS,
  MAX_MAJOR,
  divRound,
  fromMinor,
  minorText,
  mulDiv,
  mulPpm,
  mulRate,
  parseMinor,
  parsePpm,
  parseRate,
  ppmText,
  rateText,
  splitMinor,
  sumMinor,
  toMinor,
} from "../server/lib/minor.mjs";

const rejects = (fn, code, label) => {
  assert.throws(fn, error => {
    assert.equal(error.status, 400, `${label}: durum 400 olmalı (${error.message})`);
    if (code) assert.equal(error.extra?.code, code, `${label}: kod ${code} olmalı (${error.extra?.code} · ${error.message})`);
    return true;
  }, `${label}: reddedilmeliydi`);
};

// Tekrarlanabilir rastgele sayı üreteci (mulberry32): hata çıkarsa aynı tohumla yeniden üretilir.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("parseMinor — çalışıyor mu", () => {
  it("Türkçe ve noktalı biçimler kayan noktaya uğramadan kuruşa çevrilir", () => {
    const cases = [
      ["1.234,56", 123456],
      ["1234,56", 123456],
      ["1234.56", 123456],
      ["1.234", 123400], // Türkçe binlik
      ["12.345.678", 1234567800],
      ["12.34", 1234], // tek nokta, 3'lü grup değil → ondalık
      ["0,01", 1],
      ["0,1", 10],
      ["7", 700],
      ["007", 700],
      [" ₺ 3.000 ", 300000],
      ["40.000 TL", 4000000],
      ["40.000,5 TRY", 4000050],
      ["1 234,56", 123456], // boşluklu binlik
      ["1\u00a0234,56", 123456], // bölünmez boşluk
      [1234.56, 123456],
      [0.07, 7],
      [1, 100],
      [5n, 500],
      ["1.000.000.000.000", 100000000000000], // tam 1e12 TL (sınır dahil)
      [1e12, 100000000000000],
      ["999.999.999.999,99", 99999999999999],
    ];
    for (const [input, expected] of cases) assert.equal(parseMinor(input), expected, `${JSON.stringify(String(input))}`);
  });
  it("izin verilince sıfır ve eksi; para birimi tablosu (ISO 4217) ve küçük harfli kod", () => {
    assert.equal(parseMinor("0", { allowZero: true }), 0);
    assert.equal(Object.is(parseMinor("-0", { allowZero: true, allowNegative: true }), 0), true, "−0 üretilmez");
    assert.equal(parseMinor("-1.234,56", { allowNegative: true }), -123456);
    assert.equal(parseMinor("−5", { allowNegative: true }), -500, "Unicode eksi işareti");
    assert.equal(parseMinor("12,5", { currency: "usd" }), 1250);
    assert.deepEqual(Object.keys(CURRENCY_DIGITS).sort(), ["EUR", "GBP", "TRY", "USD"]);
    assert.equal(MAX_MAJOR, 1e12);
  });
});

describe("parseMinor — nasıl bozarım", () => {
  it("2'den çok ondalık 400 amount-precision (sessizce yuvarlanmaz)", () => {
    for (const input of ["1,005", "0,005", "1.234,567", "1,500", "0.005", "12.3456", 0.1 + 0.2, 1e-7, "1,0000", 12.345 /* sayıda nokta ondalık: binlik sanılmaz */]) rejects(() => parseMinor(input), "amount-precision", String(input));
  });
  it("1e12 TL'yi aşan ve 1e13 TL 400 amount-range", () => {
    for (const input of ["1.000.000.000.000,01", "10.000.000.000.000", 1e13, "1e13", 1e21, "99999999999999999999"]) {
      assert.throws(() => parseMinor(input), error => error.status === 400 && ["amount-range", "amount-invalid"].includes(error.extra?.code), String(input));
    }
    rejects(() => parseMinor(1e13), "amount-range", "1e13 sayı");
    rejects(() => parseMinor("10.000.000.000.000"), "amount-range", "1e13 metin");
  });
  it("sıfır ve eksi varsayılan olarak 400 amount-range", () => {
    for (const input of ["0", "0,00", 0, -0, "-5", "−5", -1, "-0,01"]) rejects(() => parseMinor(input), "amount-range", String(input));
  });
  it("bozuk girdi 400 amount-invalid", () => {
    for (const input of ["", "   ", "abc", "1e5", "0x10", "1_000", "1..2", ",5", "5,", "1,234.56", "1.23.456", "1.2345.678", "١٢٣", "12 abc", "--5", "+-5", "1,2,3", null, undefined, Number.NaN, Infinity, -Infinity, {}, [], true]) {
      rejects(() => parseMinor(input, { allowNegative: true, allowZero: true }), "amount-invalid", JSON.stringify(String(input)));
    }
  });
  it("tanınmayan para birimi 400 currency-unsupported", () => {
    rejects(() => parseMinor("5", { currency: "XYZ" }), "currency-unsupported", "XYZ");
    rejects(() => parseMinor("5", { currency: "" }), "currency-unsupported", "boş");
  });
});

describe("toMinor / fromMinor / minorText", () => {
  it("REAL değer kuruşa ve geri; NaN sessizce 0 olmaz", () => {
    assert.equal(toMinor(1234.56), 123456);
    assert.equal(toMinor(-0.01), -1);
    assert.equal(toMinor(1.005), 101, "yarım kuruş sıfırdan uzağa (roundMoney ile aynı)");
    assert.equal(toMinor(-1.005), -101);
    assert.equal(toMinor(2.675), 268);
    assert.equal(Object.is(toMinor(-0.001), 0), true, "−0 yok");
    assert.equal(fromMinor(123456), 1234.56);
    assert.equal(fromMinor(-1n), -0.01);
    assert.throws(() => toMinor(Number.NaN), RangeError);
    assert.throws(() => toMinor("12"), TypeError);
  });
  it("minorText kayan noktasız biçimler", () => {
    assert.equal(minorText(123456), "1.234,56 TL");
    assert.equal(minorText(-5), "-0,05 TL");
    assert.equal(minorText(100000000000000), "1.000.000.000.000,00 TL");
    assert.equal(minorText(1250, "USD"), "12,50 USD");
    assert.equal(minorText(0), "0,00 TL");
  });
});

describe("BigInt çarpma/bölme — yarım birim sıfırdan uzağa, roundMoney ile aynı sonuç", () => {
  it("divRound işaretleri ve yarım birim", () => {
    assert.equal(divRound(5n, 2n), 3n);
    assert.equal(divRound(-5n, 2n), -3n);
    assert.equal(divRound(5n, -2n), -3n);
    assert.equal(divRound(-5n, -2n), 3n);
    assert.equal(divRound(4n, 3n), 1n);
    assert.equal(divRound(-4n, 3n), -1n);
    assert.equal(divRound(0n, 7n), 0n);
    assert.throws(() => divRound(1n, 0n), RangeError);
  });
  it("mulPpm: %2,5 komisyon, BSMV %5, yarım kuruş", () => {
    assert.equal(mulPpm(1_000_000, 25_000), 25_000, "10.000 TL × %2,5 = 250 TL");
    assert.equal(mulPpm(1_000, 50_000), 50, "10 TL × %5 BSMV = 0,50");
    assert.equal(mulPpm(201, 500_000), 101, "2,01 × %50 = 1,005 → 1,01");
    assert.equal(mulPpm(-201, 500_000), -101, "−1,005 → −1,01");
    assert.equal(mulPpm(267, 1_000_000), 267);
  });
  it("mulRate ve mulDiv: döviz ↔ TL", () => {
    assert.equal(mulRate(100_000, 34_250_000), 3_425_000, "1.000 USD × 34,25 = 34.250 TL");
    assert.equal(mulRate(50_000, 35_000_000), 1_750_000, "500 USD × 35 = 17.500 TL");
    assert.equal(mulDiv(3_425_000, 50_000, 100_000), 1_712_500, "ortalama maliyet: 34.250 TL / 1.000 USD × 500 USD");
    assert.equal(mulDiv(1, 1, 3), 0);
    assert.equal(mulDiv(2, 1, 3), 1);
  });
  it("kesirli girdi ve güvenli tamsayıyı aşan sonuç hata (sessiz taşma yok)", () => {
    assert.throws(() => mulPpm(1.5, 10), TypeError);
    assert.throws(() => mulRate(100_000_000_000_000, 1_000_000_000_000), RangeError);
    assert.throws(() => sumMinor([Number.MAX_SAFE_INTEGER, 1]), RangeError);
    assert.equal(sumMinor([1, 2, -3, 10n]), 10);
  });
  it("rastgele 100.000 çift: mulPpm = toCents(roundMoney(tutar × oran)) (ikisi de yarım kuruşu sıfırdan uzağa yuvarlar)", () => {
    const random = rng(20261008);
    for (let i = 0; i < 100_000; i += 1) {
      const minor = Math.floor(random() * 2e8) - 1e8; // ±1.000.000 TL
      const ppm = Math.floor(random() * 1_000_001);
      const expected = toCents(roundMoney((minor / 100) * (ppm / 1e6)));
      assert.equal(mulPpm(minor, ppm), expected, `${minor} × ${ppm} ppm`);
    }
    // Tam yarım kuruşa düşen her durum (minor × ppm = (2j+1) × 5.000): iki yol aynı.
    for (let j = -2000; j < 2000; j += 1) {
      const minor = 2 * j + 1;
      assert.equal(mulPpm(minor, 500_000), toCents(roundMoney((minor / 100) * 0.5)), `yarım: ${minor}`);
    }
  });
});

describe("splitMinor — bölüştürme, artık son dilime", () => {
  it("eşit bölme: dilimler toplamı verir, artık son dilimde", () => {
    assert.deepEqual(splitMinor(1_200_000, 3), [400_000, 400_000, 400_000]);
    assert.deepEqual(splitMinor(1_000, 3), [333, 333, 334]);
    assert.deepEqual(splitMinor(1, 3), [0, 0, 1]);
    assert.deepEqual(splitMinor(-1_000, 3), [-333, -333, -334]);
    assert.deepEqual(splitMinor(42_000, 3), [14_000, 14_000, 14_000], "420 TL komisyon üç taksite");
    assert.deepEqual(splitMinor(7, 1), [7]);
    assert.deepEqual(splitMinor(0, 4), [0, 0, 0, 0]);
  });
  it("ağırlıkla: oranlı, artık son ağırlıklı dilimde, sıfır ağırlık 0 alır", () => {
    assert.deepEqual(splitMinor(1_000, [1, 1, 1]), [333, 333, 334]);
    assert.deepEqual(splitMinor(10_000, [3_000, 1_000]), [7_500, 2_500]);
    assert.deepEqual(splitMinor(101, [1, 1, 0]), [50, 51, 0], "son dilimin ağırlığı 0 → artık son ağırlıklı dilime");
    assert.deepEqual(splitMinor(-101, [1, 1]), [-50, -51]);
  });
  it("nasıl bozarım: 0 dilim, eksi/kesirli ağırlık, toplam ağırlık 0, kesirli toplam → hata", () => {
    assert.throws(() => splitMinor(100, 0), RangeError);
    assert.throws(() => splitMinor(100, 2.5), RangeError);
    assert.throws(() => splitMinor(100, [1, -1]), RangeError);
    assert.throws(() => splitMinor(100, [0, 0]), RangeError);
    assert.throws(() => splitMinor(100, [1.5, 1]), TypeError);
    assert.throws(() => splitMinor(1.5, 2), TypeError);
  });
  it("rastgele 20.000 bölme: Σ = toplam, işaret korunur, eşit bölmede dilimler arası fark yalnız son dilimde", () => {
    const random = rng(7);
    for (let i = 0; i < 20_000; i += 1) {
      const total = Math.floor(random() * 2e9) - 1e9;
      const n = 1 + Math.floor(random() * 36);
      const parts = splitMinor(total, n);
      assert.equal(parts.length, n);
      assert.equal(parts.reduce((s, p) => s + p, 0), total);
      for (const p of parts.slice(0, -1)) assert.equal(p, parts[0]);
      for (const p of parts) assert.ok(total >= 0 ? p >= 0 : p <= 0, `işaret: ${total}/${n}`);
      const weights = Array.from({ length: n }, () => Math.floor(random() * 1000));
      if (weights.every(w => w === 0)) weights[0] = 1;
      const weighted = splitMinor(total, weights);
      assert.equal(weighted.reduce((s, p) => s + p, 0), total);
    }
  });
});

describe("oran (ppm) ve kur (e6)", () => {
  it("çalışıyor mu", () => {
    assert.equal(parsePpm("%2,5"), 25_000);
    assert.equal(parsePpm("2,5%"), 25_000);
    assert.equal(parsePpm("3.5"), 35_000);
    assert.equal(parsePpm(20), 200_000);
    assert.equal(parsePpm("0"), 0);
    assert.equal(parsePpm("100"), 1_000_000);
    assert.equal(parsePpm("0,0001"), 1);
    assert.equal(ppmText(25_000), "2,5");
    assert.equal(ppmText(200_000), "20");
    assert.equal(ppmText(1), "0,0001");
    assert.equal(parseRate("34,2500"), 34_250_000);
    assert.equal(parseRate("34.25"), 34_250_000);
    assert.equal(parseRate("34.250"), 34_250_000, "kurda virgülsüz tek nokta ondalık (binlik sanılmaz)");
    assert.equal(parseRate(35.8), 35_800_000);
    assert.equal(parseRate("0,000001"), 1);
    assert.equal(parseRate("1.234,5"), 1_234_500_000);
    assert.equal(rateText(34_250_000), "34,2500");
    assert.equal(rateText(1_234_567_891, { digits: 6 }), "1.234,567891");
  });
  it("nasıl bozarım", () => {
    for (const input of ["2,55555", "0,00001"]) rejects(() => parsePpm(input), "ratio-precision", input);
    for (const input of ["101", "100,0001", "-1"]) rejects(() => parsePpm(input), "ratio-range", input);
    for (const input of ["", "abc", "%", "2,5,1", null]) rejects(() => parsePpm(input), "ratio-invalid", String(input));
    for (const input of ["34,1234567", "0,0000001"]) rejects(() => parseRate(input), "rate-precision", input);
    for (const input of ["0", "0,000000", "-34", "1.000.001"]) rejects(() => parseRate(input), "rate-range", input);
    for (const input of ["", "abc", "1e3", null]) rejects(() => parseRate(input), "rate-invalid", String(input));
  });
});

describe("ÖZELLİK TESTİ — REAL kolonda saklanan k/100 kuruşa kayıpsız döner (K1; [1 kuruş, 1e12 TL] × 10^6)", () => {
  it("sınır değerleri ve 10^6 rastgele değer: toCents, toMinor ve SQL CAST(ROUND(x*100) AS INTEGER) = k; Σ SQL = Σ BigInt", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, grp INTEGER NOT NULL, k INTEGER NOT NULL, x REAL NOT NULL)");
      const MAX = 100_000_000_000_000; // 1e12 TL = 1e14 kuruş
      const edges = [1, 2, 3, 5, 9, 10, 11, 49, 50, 51, 99, 100, 101, 105, 199, 267, 268, 1005, 2675, 4999, 5000, 5001, 99_999, 100_000, 123_456, 999_999_999, 2 ** 31 - 1, 2 ** 31, 2 ** 32 + 1, 2 ** 40 - 3, 2 ** 46, 9_007_199_254_741, MAX - 101, MAX - 50, MAX - 2, MAX - 1, MAX];
      const values = [...edges, ...edges.map(k => -k)];
      const random = rng(1e9 + 7);
      for (let i = 0; i < 1_000_000; i += 1) {
        // Yarısı tüm aralıkta düzgün, yarısı log-düzgün (küçük tutarlar da bol); %10 eksi.
        let k;
        if (i % 2 === 0) k = 1 + Math.floor(random() * MAX);
        else k = Math.max(1, Math.floor(10 ** (random() * 14)));
        if (k > MAX) k = MAX;
        values.push(random() < 0.1 ? -k : k);
      }
      const insert = db.prepare("INSERT INTO t (grp, k, x) VALUES (?, ?, ?)");
      db.exec("BEGIN");
      values.forEach((k, index) => insert.run(index % 1000, k, k / 100));
      db.exec("COMMIT");
      // 1) JS tarafı: REAL olarak okunan değer → kuruş.
      const read = db.prepare("SELECT k, x, CAST(ROUND(x * 100) AS INTEGER) AS sqlMinor FROM t");
      let checked = 0;
      for (const row of read.iterate()) {
        if (toCents(row.x) !== row.k || toMinor(row.x) !== row.k || row.sqlMinor !== row.k || toMinor(fromMinor(row.k)) !== row.k) {
          assert.fail(`k=${row.k}: x=${row.x} toCents=${toCents(row.x)} toMinor=${toMinor(row.x)} SQL=${row.sqlMinor}`);
        }
        checked += 1;
      }
      assert.equal(checked, values.length);
      assert.ok(checked >= 1_000_000);
      // 2) Toplam: SQL'de kuruş tamsayısıyla toplanan = BigInt toplamı. Tek SUM int64'ü (9,22e18) aşar; 1000 kümede toplanır
      // (her küme ≤ 1000 × 1e14 = 1e17) ve kümeler BigInt'le birleştirilir (setReadBigInts).
      const groups = db.prepare("SELECT grp, SUM(CAST(ROUND(x * 100) AS INTEGER)) AS s FROM t GROUP BY grp ORDER BY grp");
      groups.setReadBigInts(true);
      const expected = new Map();
      values.forEach((k, index) => expected.set(index % 1000, (expected.get(index % 1000) || 0n) + BigInt(k)));
      let sqlTotal = 0n;
      for (const row of groups.iterate()) {
        assert.equal(row.s, expected.get(Number(row.grp)), `küme ${row.grp}`);
        sqlTotal += row.s;
      }
      const bigTotal = values.reduce((sum, k) => sum + BigInt(k), 0n);
      assert.equal(sqlTotal, bigTotal);
      // Not: REAL toplamı (SUM(x)) kuruş kesinliğini garanti etmez; banka kodunda yasak (statik test: banka-210-statik.test.mjs).
    } finally {
      db.close();
    }
  });
});
