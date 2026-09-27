/* DestekOfis — Excel/CSV ayrıştırma işçisi.
 * Ayrıştırma ana sayfadan yalıtılmış bir Worker'da yapılır: büyük dosyalar arayüzü dondurmaz ve
 * SheetJS 0.18.5'teki bilinen "prototype pollution" / ReDoS açıkları ana sayfayı etkileyemez.
 * Her sayfa ham hücre matrisi olarak gönderilir; kolon başlıklarını ve sayfadaki alt tabloları (bölümleri)
 * sunucu ayırır — Google Sheets ile aynı kurallar. Hücreler Excel'de göründüğü gibi, Türkçe düzende metne
 * çevrilir (hof-excel-format.js). CSV değerleri olduğu gibi alınır: "0532…" telefonlarının baştaki sıfırı ve
 * "2025/1" gibi dosya numaraları bozulmaz. v2.0.1: formüller de hücre adresleriyle gönderilir. */
import * as XLSX from "/assets/xlsx-DGuHH-KN.js";
import { decodeCsv, sheetFormulas, sheetMatrix } from "/assets/hof-excel-format.js";

self.onmessage = event => {
  try {
    const csv = /\.csv$/i.test(event.data.name || "");
    const workbook = csv ? XLSX.read(decodeCsv(event.data.buffer), { type: "string", raw: true }) : XLSX.read(event.data.buffer, { type: "array", cellDates: false, cellNF: true });
    const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
    const sheets = [];
    let rowCount = 0;
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      // Formüllü sayfada boş satırlar da gönderilir (matristeki sıra = sayfadaki satır); sunucu formülleri kayıtlara
      // bağlar ve programda değişen değerlerle yeniden hesaplar (v2.0.1).
      const formulas = csv ? [] : sheetFormulas(XLSX, sheet);
      const matrix = sheetMatrix(XLSX, sheet, date1904, { keepEmpty: formulas.length > 0 });
      rowCount += Math.max(0, matrix.filter(line => line.length).length - 1);
      const start = sheet && sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]).s : { r: 0, c: 0 };
      sheets.push(formulas.length ? { name: sheetName, matrix, start: { r: start.r, c: start.c }, formulas } : { name: sheetName, matrix });
    }
    self.postMessage({ ok: true, sheets, tabs: workbook.SheetNames, rowCount });
  } catch (error) {
    self.postMessage({ ok: false, error: (error && error.message) || String(error) });
  }
};
