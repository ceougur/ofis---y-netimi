/* DestekOfis — Excel/CSV ayrıştırma işçisi.
 * Ayrıştırma ana sayfadan yalıtılmış bir Worker'da yapılır: büyük dosyalar arayüzü dondurmaz ve
 * SheetJS 0.18.5'teki bilinen "prototype pollution" / ReDoS açıkları ana sayfayı etkileyemez.
 * Her sayfa ham hücre matrisi olarak gönderilir; kolon başlıklarını ve sayfadaki alt tabloları (bölümleri)
 * sunucu ayırır — Google Sheets ile aynı kurallar. */
import * as XLSX from "/assets/xlsx-DGuHH-KN.js";

self.onmessage = event => {
  try {
    const workbook = XLSX.read(event.data.buffer, { type: "array", cellDates: false });
    const sheets = [];
    let rowCount = 0;
    for (const sheetName of workbook.SheetNames) {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", blankrows: false }).map(line => {
        const cells = line.map(cell => String(cell ?? "").trim());
        while (cells.length && !cells[cells.length - 1]) cells.pop();
        return cells;
      });
      rowCount += Math.max(0, matrix.filter(cells => cells.length).length - 1);
      sheets.push({ name: sheetName, matrix });
    }
    self.postMessage({ ok: true, sheets, tabs: workbook.SheetNames, rowCount });
  } catch (error) {
    self.postMessage({ ok: false, error: (error && error.message) || String(error) });
  }
};
