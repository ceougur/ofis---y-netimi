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
 * ctx: { now (Date), companyLabel, userName, brand, header }. header (2.4.5 madde 6c): lib/report-header.mjs createReportHeader — Tabela Adı açıksa
 * başlık bloğunun şirket satırı Tabela Adı (ve seçime göre firma bilgisi) olur; kapalıysa companyLabel (bugünkü).
 */
export function reportPdf(data, { now, companyLabel = "", userName = "", brand = "DestekOfis", pdfRows = Infinity, header = null } = {}) {
  const clipped = data.rows.length > pdfRows;
  return tablePdf({
    now,
    title: data.title,
    subtitle: [data.subtitle, clipped ? `ilk ${pdfRows.toLocaleString("tr-TR")} satır (tamamı Excel'de)` : ""].filter(Boolean).join(" · "),
    headers: data.headers,
    types: data.types,
    rows: clipped ? data.rows.slice(0, pdfRows) : data.rows,
    footer: data.footer,
    footers: data.footers || null,
    // 2.4.4 U3: sayfaya sığmazsa bırakılabilir kolonlar (tablo raporlarının özel alan kolonları) ve alt başlıktaki notu.
    optional: data.optional || null,
    optionalNote: data.optionalNote,
    // 2.4.7: sözcüklü kolonlar başlığın iki satırlık genişliğine kadar daralabilir (yalnız isteyen rapor; Ayrıntılı Cari Ekstre 16 kolon).
    ...(data.pdfWrapHeads === true ? { wrapHeads: true } : {}),
    ...(Number.isInteger(data.pdfCellLines) ? { cellLines: data.pdfCellLines } : {}),
    summary: data.summary || [],
    officeName: companyLabel,
    userName,
    brand,
    ...(header ? header.pdf({ withCode: true, brand }) : {}),
  });
}

/** Excel (Buffer): tablo sayfası (başlık bloğu + kolonlar + TOPLAM) ve özet sayfası. */
// 2.4.6 (2.4.5 gezinti B5): ekranda ve PDF'te bakiye "10.000,00 TL B" / "250,00 TL A" yazılır (Cari Ekstre, Ayrıntılı Cari Ekstre). Excel'de bu metin
// toplanamaz, süzülemez; Excel hücresi işaretli SAYI olur — borçlu artı, alacaklı eksi (Raporlar → Cari Mizanı ve Ekstresi sekmesinin ekstre Excel'i 2.0.x'ten beri böyle
// yazar: overview.mjs ekstre.xlsx). Yalnız tutar kolonunda ve tam bu biçimde ("<tutar> TL B|A") çevrilir; başka metin olduğu gibi kalır.
const SIDE_MARK = /^(\d[\d.]*,\d{2}) TL ([BA])$/;
const signedCell = value => {
  const match = SIDE_MARK.exec(String(value ?? "").trim());
  return match ? `${match[2] === "A" ? "-" : ""}${match[1]} TL` : null;
};

export function reportXlsx(data, { now, companyLabel = "", userName = "", header = null } = {}) {
  const unique = data.headers.map((header, index) => (data.headers.indexOf(header) === index && header ? header : `${header || "Kolon"} ${index + 1}`));
  const money = index => (data.types || [])[index] === "money";
  let signed = false;
  const cell = (value, index) => {
    if (!money(index)) return value ?? "";
    const converted = signedCell(value);
    if (converted === null) return value ?? "";
    signed = true;
    return converted;
  };
  const rows = data.rows.map(row => Object.fromEntries(unique.map((header, index) => [header, cell(row[index], index)])));
  const footer = data.footer ? Object.fromEntries(unique.map((header, index) => [header, cell(data.footer[index], index)])) : null;
  // 2.4.3 UX24: birden çok TOPLAM satırı (yönü karışık rapor) — ekran ve PDF ile aynı satırlar, aynı sıra.
  const footers = Array.isArray(data.footers) && data.footers.length ? data.footers.map(line => Object.fromEntries(unique.map((header, index) => [header, cell(line[index], index)]))) : null;
  const made = stampText(now.toISOString());
  const heads = header ? header.preamble({ withCode: true }) : [{ text: companyLabel, bold: true }];
  const subtitle = signed ? String(data.subtitle || "").replace(/ · B: borçlu · A: alacaklı$/, "").concat(" · Bakiye: artı borçlu, eksi alacaklı") : data.subtitle || "";
  const preamble = [...heads, { text: data.title, bold: true }, { text: subtitle.replace(/^ · /, "") }, { text: `Oluşturma: ${made}${userName ? ` · Hazırlayan: ${userName}` : ""}` }];
  const sheets = [{ name: data.title.slice(0, 31), columns: unique, rows, footer, footers, preamble }];
  const summary = data.summary || [];
  if (summary.length) {
    sheets.push({
      name: "Özet",
      columns: ["Kalem", "Değer"],
      rows: [...(header ? header.summaryRows({ withCode: true }) : companyLabel ? [["Şirket", companyLabel]] : []).map(([Kalem, Değer]) => ({ Kalem, Değer })), { Kalem: "Rapor", Değer: data.title }, { Kalem: "Kapsam", Değer: subtitle.replace(/^ · /, "") }, { Kalem: "Hazırlanma", Değer: made }, ...summary.map(([label, value]) => ({ Kalem: label, Değer: value }))],
    });
  }
  return buildXlsx(sheets, { now, title: data.title, company: header ? heads[0]?.text || companyLabel : companyLabel });
}
