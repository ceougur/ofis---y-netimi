/* DestekOfis — Excel/CSV ayrıştırma işçisi.
 * Ayrıştırma ana sayfadan yalıtılmış bir Worker'da yapılır: büyük dosyalar arayüzü dondurmaz ve
 * SheetJS 0.18.5'teki bilinen "prototype pollution" / ReDoS açıkları ana sayfayı etkileyemez.
 * Her sayfa ham hücre matrisi olarak gönderilir; kolon başlıklarını ve sayfadaki alt tabloları (bölümleri)
 * sunucu ayırır — Google Sheets ile aynı kurallar. Hücreler Excel'de göründüğü gibi, Türkçe düzende metne
 * çevrilir (hof-excel-format.js). CSV değerleri olduğu gibi alınır: "0532…" telefonlarının baştaki sıfırı ve
 * "2025/1" gibi dosya numaraları bozulmaz. */
import * as XLSX from "/assets/xlsx-DGuHH-KN.js";
import { decodeCsv, sheetMatrix } from "/assets/hof-excel-format.js";

self.onmessage = event => {
  try {
    const csv = /\.csv$/i.test(event.data.name || "");
    const workbook = csv ? XLSX.read(decodeCsv(event.data.buffer), { type: "string", raw: true }) : XLSX.read(event.data.buffer, { type: "array", cellDates: false, cellNF: true });
    const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
    const sheets = [];
    let rowCount = 0;
    for (const sheetName of workbook.SheetNames) {
      const matrix = sheetMatrix(XLSX, workbook.Sheets[sheetName], date1904);
      rowCount += Math.max(0, matrix.length - 1);
      sheets.push({ name: sheetName, matrix });
    }
    self.postMessage({ ok: true, sheets, tabs: workbook.SheetNames, rowCount });
  } catch (error) {
    self.postMessage({ ok: false, error: (error && error.message) || String(error) });
  }
};
