// Excel hücrelerinin Türkçe biçimde metne çevrilmesi (tarayıcıdaki Excel işçisinin kullandığı modül).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { decodeCsv, formatNumber, sheetMatrix } from "../client/assets/hof-excel-format.js";

const XLSX = await import("../client/assets/xlsx-DGuHH-KN.js");

describe("Excel hücre biçimleri", () => {
  it("tarihler gg.aa.yyyy, tutarlar ve yüzdeler Türkçe düzende; genel sayılar gruplanmaz", () => {
    const workbook = XLSX.read(readFileSync(new URL("./fixtures/bicimler.xlsx", import.meta.url)), { type: "buffer", cellDates: false, cellNF: true });
    assert.deepEqual(sheetMatrix(XLSX, workbook.Sheets[workbook.SheetNames[0]]), [
      ["DOSYA NO", "TARİH", "TUTAR", "ORAN", "SAYI", "SAAT", "METİN"],
      ["2025/1", "13.10.2025", "40.000,00TL", "18,5%", "1234567", "13.10.2025 14:30", "Deneme"],
      ["2025/2", "05.01.2025", "₺1.500,50", "100%", "42", "05.01.2025", "12"],
    ]);
  });

  it("biçim kodundaki ayrıntıları uygular", () => {
    const cases = [
      [1234.5, "#,##0.00", "1.234,50"],
      [-1234.5, "#,##0.00", "-1.234,50"],
      [-1234.5, "#,##0.00;[Red](#,##0.00)", "(1.234,50)"],
      [0.5, "0%", "50%"],
      [12, "00000", "00012"],
      [1500, '"₺"#,##0', "₺1.500"],
      [1500, "#,##0 \\T\\L", "1.500 TL"],
      [99.999, "0.0", "100,0"],
      [5321234567, "General", "5321234567"],
      [2.75, "General", "2,75"],
    ];
    for (const [value, format, expected] of cases) assert.equal(formatNumber(value, format), expected, `${value} ${format}`);
  });

  it("CSV: UTF-8 (BOM'lu) ve Türkçe Windows kodlaması doğru okunur; değerler olduğu gibi kalır", () => {
    const utf8 = new TextEncoder().encode("﻿DOSYA NO;TELEFON;TARİH\n2025/1;05321234567;13.10.2025\n");
    const windows = Uint8Array.from([0x49, 0x4c, 0x3b, 0xdd, 0x4c, 0xc7, 0x45, 0x0a, 0x4b, 0x6f, 0x6e, 0x79, 0x61, 0x3b, 0xdd, 0x7a, 0x6d, 0x69, 0x72, 0x0a]);
    const read = bytes => {
      const workbook = XLSX.read(decodeCsv(bytes.buffer), { type: "string", raw: true });
      return sheetMatrix(XLSX, workbook.Sheets[workbook.SheetNames[0]]);
    };
    assert.deepEqual(read(utf8), [["DOSYA NO", "TELEFON", "TARİH"], ["2025/1", "05321234567", "13.10.2025"]]);
    assert.deepEqual(read(windows), [["IL", "İLÇE"], ["Konya", "İzmir"]]);
  });
});
