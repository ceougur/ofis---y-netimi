// Rapor dosyaları — TEK ÜRETİCİ (2.3.0 İz 5.1): Rapor Merkezi'nin PDF ve Excel çıktısı (routes/report-center.mjs) ile Banka → Hareketler'in
// PDF / Excel düğmeleri (routes/bank.mjs) aynı tablo verisinden ({ title, subtitle, headers, types, rows, footer, summary }) aynı dosyayı üretir;
// başlık bloğu (şirket "001 · Unvan", rapor adı, kapsam, oluşturma, hazırlayan) ve TOPLAM satırı iki yolda da aynıdır.
import { tablePdf } from "./report-pdf.mjs";
import { buildXlsx } from "./xlsx-write.mjs";

const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const isoDay = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const stampText = value => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${dayText(isoDay(date))} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
/** Dosya adı: rapor adı + bugün (yasak karakterler boşluk). */
export const reportFileBase = (title, today) => `${String(title).replace(/[\\/:*?"<>|]+/g, " ").trim()} ${dayText(today)}`;

/**
 * PDF (Buffer). pdfRows: en çok satır; aşılırsa alt başlıkta "ilk N satır (tamamı Excel'de)" yazılır, TOPLAM yine bütün satırlarındır.
 * ctx: { now (Date), companyLabel, userName, brand }.
 */
export function reportPdf(data, { now, companyLabel = "", userName = "", brand = "DestekOfis", pdfRows = Infinity } = {}) {
  const clipped = data.rows.length > pdfRows;
  return tablePdf({
    now,
    title: data.title,
    subtitle: [data.subtitle, clipped ? `ilk ${pdfRows.toLocaleString("tr-TR")} satır (tamamı Excel'de)` : ""].filter(Boolean).join(" · "),
    headers: data.headers,
    types: data.types,
    rows: clipped ? data.rows.slice(0, pdfRows) : data.rows,
    footer: data.footer,
    summary: data.summary || [],
    officeName: companyLabel,
    userName,
    brand,
  });
}

/** Excel (Buffer): tablo sayfası (başlık bloğu + kolonlar + TOPLAM) ve özet sayfası. */
export function reportXlsx(data, { now, companyLabel = "", userName = "" } = {}) {
  const unique = data.headers.map((header, index) => (data.headers.indexOf(header) === index && header ? header : `${header || "Kolon"} ${index + 1}`));
  const rows = data.rows.map(row => Object.fromEntries(unique.map((header, index) => [header, row[index] ?? ""])));
  const footer = data.footer ? Object.fromEntries(unique.map((header, index) => [header, data.footer[index] ?? ""])) : null;
  const made = stampText(now.toISOString());
  const preamble = [{ text: companyLabel, bold: true }, { text: data.title, bold: true }, { text: data.subtitle || "" }, { text: `Oluşturma: ${made}${userName ? ` · Hazırlayan: ${userName}` : ""}` }];
  const sheets = [{ name: data.title.slice(0, 31), columns: unique, rows, footer, preamble }];
  const summary = data.summary || [];
  if (summary.length) {
    sheets.push({
      name: "Özet",
      columns: ["Kalem", "Değer"],
      rows: [...(companyLabel ? [{ Kalem: "Şirket", Değer: companyLabel }] : []), { Kalem: "Rapor", Değer: data.title }, { Kalem: "Kapsam", Değer: data.subtitle || "" }, { Kalem: "Hazırlanma", Değer: made }, ...summary.map(([label, value]) => ({ Kalem: label, Değer: value }))],
    });
  }
  return buildXlsx(sheets, { now, title: data.title, company: companyLabel });
}
