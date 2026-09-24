/* DestekOfis — Excel/CSV ayrıştırma işçisi.
 * Ayrıştırma ana sayfadan yalıtılmış bir Worker'da yapılır: büyük dosyalar arayüzü dondurmaz ve
 * SheetJS 0.18.5'teki bilinen "prototype pollution" / ReDoS açıkları ana sayfayı etkileyemez. */
import * as XLSX from "/assets/xlsx-DGuHH-KN.js";

self.onmessage = event => {
  try {
    const workbook = XLSX.read(event.data.buffer, { type: "array", cellDates: false });
    const rows = [];
    for (const sheetName of workbook.SheetNames) {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
      const [header = [], ...body] = matrix;
      const columns = header.map((cell, index) => String(cell || `Kolon ${index + 1}`).trim());
      for (const line of body) {
        const record = { __sheet: sheetName };
        columns.forEach((column, index) => {
          record[column] = String(line[index] ?? "").trim();
        });
        if (Object.values(record).some(value => value && value !== sheetName)) rows.push(record);
      }
    }
    self.postMessage({ ok: true, rows, tabs: workbook.SheetNames });
  } catch (error) {
    self.postMessage({ ok: false, error: (error && error.message) || String(error) });
  }
};
