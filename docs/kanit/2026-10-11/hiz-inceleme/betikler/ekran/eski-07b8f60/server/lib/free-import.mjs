// Serbest sayfayı Excel / Google Sheets sayfasından kurma (v2.0.10; "+ Sayfa" penceresi).
// Girdi, Excel okuyucusunun (hof-excel-worker.js) ya da Google Sheets okuyucusunun (sheets.mjs) verdiği ham matristir:
// matrix[i] = sayfanın (start.r + i). satırı, hücreler Excel'de göründüğü gibi metin; formulas = [[satır, kolon, formül]]
// (sayfa adresiyle, 0 tabanlı, başında "=" yok, İngilizce yazım).
// - İlk dolu satır başlık satırıdır (serbest sayfada başlık satırı numaralanmaz); altındaki satırlar veri, sondaki boş
//   satırlar ve iki yandaki boş kolonlar atılır.
// - Formüller serbest sayfanın adreslerine çevrilir: "B2" (Excel'de başlığın altındaki ilk satır) → "B1". Başlık satırına
//   ya da kullanılan alanın dışına başvuru #REF! olur. Başka sayfaya/dosyaya başvuran formül değeriyle kalır.
// - Her formül hücresi için Excel'de görünen değer "fallback" olarak döner: program formülü hesaplayamazsa (desteklenmeyen
//   işlev) hücreye bu değer yazılır (free-sheets.mjs importSheet).
import { HttpError } from "./http.mjs";
import { mapReferences } from "./formula/sheet.mjs";

const text = value => (value === null || value === undefined ? "" : String(value));
const filled = value => text(value).trim() !== "";

// Başlık satırı: ilk 15 dolu satır içinde, en kalabalık satırın en az yarısı kadar (ve en az 2) dolu hücresi olan ilk satır.
// Üstündeki tek hücreli satırlar ("Ofis Giderleri 2026" gibi başlık yazıları) alınmaz. Hiçbir satırda 2 dolu hücre
// yoksa (tek kolonlu liste) ilk dolu satır başlıktır.
export function headerRowOf(rows) {
  const counts = [];
  for (let i = 0; i < rows.length && counts.length < 15; i += 1) {
    const count = (rows[i] || []).filter(filled).length;
    if (count) counts.push([i, count]);
  }
  if (!counts.length) return -1;
  const most = Math.max(...counts.map(([, count]) => count));
  if (most < 2) return counts[0][0];
  const need = Math.max(2, Math.ceil(most / 2));
  return counts.find(([, count]) => count >= need)[0];
}

export function matrixToFree({ matrix, start = { r: 0, c: 0 }, formulas = [] } = {}) {
  const rows = (Array.isArray(matrix) ? matrix : []).map(row => (Array.isArray(row) ? row.map(text) : []));
  const origin = { r: Number(start?.r) || 0, c: Number(start?.c) || 0 };
  const list = (Array.isArray(formulas) ? formulas : []).filter(item => Array.isArray(item) && Number.isInteger(item[0]) && Number.isInteger(item[1]) && typeof item[2] === "string");
  const formulaAt = new Map(list.map(([r, c, f]) => [`${r - origin.r},${c - origin.c}`, f]));
  const headerIndex = headerRowOf(rows);
  if (headerIndex < 0) throw new HttpError(400, "Seçilen sayfa boş; aktarılacak hücre yok.");
  const skippedAbove = rows.slice(0, headerIndex).filter(row => row.some(filled)).length;
  // Veri: başlığın altındaki satırlar; sondaki boş satırlar atılır (formül taşıyan satır boş sayılmaz).
  let last = rows.length - 1;
  const rowUsed = i => rows[i].some(filled) || rows[i].some((_, c) => formulaAt.has(`${i},${c}`));
  while (last > headerIndex && !rowUsed(last)) last -= 1;
  // Kolonlar: başlıkta ya da veride dolu olan ilk ve son kolon.
  let first = Infinity;
  let end = -1;
  for (let i = headerIndex; i <= last; i += 1) {
    rows[i].forEach((cell, c) => {
      if (filled(cell) || formulaAt.has(`${i},${c}`)) {
        first = Math.min(first, c);
        end = Math.max(end, c);
      }
    });
  }
  const width = end - first + 1;
  const names = Array.from({ length: width }, (_, n) => text(rows[headerIndex][first + n]).trim());
  const body = [];
  const fallback = {};
  let formulaCount = 0;
  let foreign = 0;
  for (let i = headerIndex + 1; i <= last; i += 1) {
    const out = [];
    for (let n = 0; n < width; n += 1) {
      const c = first + n;
      const value = text(rows[i][c]);
      const source = formulaAt.get(`${i},${c}`);
      if (!source) {
        out.push(value);
        continue;
      }
      // Başka sayfaya ya da dosyaya başvuru: serbest sayfa yalnız kendi hücrelerini bilir; Excel'deki değer kalır.
      if (/!|\[/.test(source.replace(/"(?:[^"]|"")*"/g, ""))) {
        foreign += 1;
        out.push(value);
        continue;
      }
      const shifted = mapReferences(`=${source}`, ref => {
        const row = sheetRow => (sheetRow === null ? null : sheetRow - origin.r - headerIndex - 1);
        const col = sheetCol => sheetCol - origin.c - first;
        const next = { ...ref, r1: row(ref.r1), r2: row(ref.r2), c1: col(ref.c1), c2: col(ref.c2) };
        if (next.c1 < 0 || next.c2 < 0 || (next.r1 !== null && (next.r1 < 0 || next.r2 < 0))) return null;
        return next;
      });
      formulaCount += 1;
      out.push(shifted);
      fallback[`${body.length},${n}`] = value;
    }
    body.push(out);
  }
  return { names, rows: body, fallback, formulas: formulaCount, foreign, skippedAbove };
}
