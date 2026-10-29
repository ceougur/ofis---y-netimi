// Maliyet Hesap Kartı — SEKME PDF'i (2.4.7; müşteri isteği 28.10.2026: "4 menüye de yazdır butonu isteriz, PDF'ye aktarım yani").
// Bir sekmenin bütün kartları, ekrandaki değerlerle (kaydedilmemiş taslak dahil; görünümler lib/maliyet/depo.mjs pdfVerisi'nden — hesap yalnız
// hesap.mjs'te). Programın kendi PDF yazıcısı (lib/pdf-write.mjs) ve rapor PDF'lerinin yazı tipi; yeni kütüphane yok. Her kart ayrı başlıklı tablo:
// zincir (malzeme satırları + adımlar), profil gramaj (alt Toplam), fiyat listesi (ölçü × sütun; hesaplanmış fiyat), bilgi (değerler aynen).
// Gösterim ekrandakiyle aynı: girdi tr-TR (binlik ayırıcı, ondalık olduğu gibi), hesaplanan tutar iki basamak, Giden Kğ üç basamak; boş girdi boş.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { A4, PdfDocument, loadFont } from "../pdf-write.mjs";
import { GRAMAJ_SUTUNLAR } from "./sablon.mjs";

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "fonts");
let fonts = null;
const loadFonts = () => {
  fonts ||= { regular: loadFont(join(FONT_DIR, "LiberationSans-Regular.ttf")), bold: loadFont(join(FONT_DIR, "LiberationSans-Bold.ttf")) };
  return fonts;
};

const SAYI = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 15 });
const TUTAR = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KILO = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const isNum = value => typeof value === "number" && Number.isFinite(value);
export const girdiYazi = value => (isNum(value) ? SAYI.format(value) : value === null || value === undefined ? "" : String(value));
export const tutarYazi = value => (isNum(value) ? TUTAR.format(value) : "—");
const kiloYazi = value => (isNum(value) ? KILO.format(value) : "—");
const pad = value => String(value).padStart(2, "0");

const M = 36;
const PAD = 4;
const FONT = 8.5;
const INK = "#111827";
const MUTED = "#6b7280";

// Kartın tablosu: { baslik, headers, types ("text" | "number"), rows: [{ cells, bold? }], footer? }.
function zincirTablo(kart) {
  const rows = kart.satirlar.map(s => ({ cells: [s.ad || "", s.birim || "", girdiYazi(s.miktar), girdiYazi(s.fiyat), tutarYazi(s.tutar)] }));
  for (const a of kart.adimlar) {
    const param = a.kod === "yuzde" || a.kod === "yuzde_ekle" ? `%${girdiYazi(a.oran)}` : a.kod === "bolme" ? `÷${girdiYazi(a.bolen)}` : "";
    const deger = a.kod === "cm_elle" ? girdiYazi(a.deger) : a.hata ? "—" : tutarYazi(a.deger);
    rows.push({ cells: [a.etiket || "—", "", "", param, deger], bold: true, sonuc: a.kod === kart.sonucAdim });
  }
  return { headers: ["Malzeme", "Birim", "Miktar", "Birim Fiyat", "Tutar"], types: ["text", "text", "number", "number", "number"], rows };
}
function gramajTablo(kart) {
  const ad = kod => kart.sutunlar?.[kod] ?? Object.fromEntries(GRAMAJ_SUTUNLAR)[kod];
  const sira = GRAMAJ_SUTUNLAR.map(([kod]) => kod);
  const rows = kart.satirlar.map(s => ({ cells: [s.parca || "", girdiYazi(s.giden_mt), girdiYazi(s.boy), girdiYazi(s.br_gramaj), s.cins || "", s.elle_kg ? girdiYazi(s.giden_kg_girdi) : kiloYazi(s.giden_kg), girdiYazi(s.alis_ft), tutarYazi(s.satir_top)] }));
  return {
    headers: sira.map(ad),
    types: ["text", "number", "number", "number", "text", "number", "number", "number"],
    rows,
    footer: ["Toplam", "", "", "", "", kiloYazi(kart.toplam.giden_kg), "", tutarYazi(kart.toplam.satir_top)],
  };
}
function matrisTablo(kart) {
  return {
    headers: [kart.olcuBasligi || "", ...kart.sutunlar.map(c => c.ad || "")],
    types: ["text", ...kart.sutunlar.map(() => "number")],
    rows: kart.olculer.map(r => ({ cells: [r.ad || "", ...kart.sutunlar.map(c => (kart.hucreler[`${r.kod}${c.kod}`] ? tutarYazi(kart.hucreler[`${r.kod}${c.kod}`].deger) : ""))] })),
  };
}
function bilgiTablo(kart) {
  return {
    headers: ["", ...kart.sutunlar.map(c => c.ad || "")],
    types: ["text", ...kart.sutunlar.map(() => "text")],
    rows: kart.satirlar.map(s => ({ cells: [s.ad || "", ...s.degerler.map(girdiYazi)] })),
  };
}
const TABLO = { zincir: zincirTablo, gramaj: gramajTablo, matris: matrisTablo, bilgi: bilgiTablo };

/**
 * @param {{ sekme: string, kartlar: object[], officeName?: string, officeLines?: string[] | null, userName?: string, brand?: string, now?: Date }} input
 * kartlar: hesap.mjs görünümleri (ekrandaki sırayla). Dönüş: PDF Buffer.
 */
export function maliyetPdf({ sekme, kartlar, officeName = "", officeLines = null, userName = "", brand = "DestekOfis", now = new Date() }) {
  const size = A4;
  const W = size.width - M * 2;
  const bottom = size.height - 48;
  const title = sekme || "Maliyet Hesap Kartı";
  const doc = new PdfDocument({ fonts: loadFonts(), size, title, author: officeName || "DestekOfis", subject: `Maliyet Hesap Kartı · ${title}` });
  let page = null;
  let top = 0;
  const created = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const newPage = first => {
    page = doc.addPage();
    top = M;
    if (!first) {
      page.text(M, top + 8, `${title} · Maliyet Hesap Kartı`, { font: "bold", size: 8, color: MUTED });
      top += 20;
      return;
    }
    const heads = Array.isArray(officeLines) && officeLines.length ? officeLines : officeName ? [officeName] : [];
    heads.forEach((line, index) => page.text(M, top + 8 + index * 10, doc.fit(line, W * 0.6, index ? "regular" : "bold", index ? 8 : 9), { font: index ? "regular" : "bold", size: index ? 8 : 9, color: MUTED }));
    top += Math.max(0, heads.length - 1) * 10;
    page.text(M, top + 30, doc.fit(title, W, "bold", 18), { font: "bold", size: 18, color: INK });
    page.text(M, top + 46, `Maliyet Hesap Kartı · ${kartlar.length} kart`, { size: 10, color: "#374151" });
    page.text(M, M + 8, `Oluşturma: ${created}`, { size: 8, color: MUTED, align: "right", width: W });
    if (userName) page.text(M, M + 20, `Hazırlayan: ${doc.fit(userName, W * 0.35, "regular", 8)}`, { size: 8, color: MUTED, align: "right", width: W });
    top += 64;
  };
  newPage(true);

  for (const kart of kartlar) {
    const tablo = TABLO[kart.tur]?.(kart);
    if (!tablo) continue;
    const { headers, types, rows, footer = null } = tablo;
    // Kolon genişliği: başlık ve hücrelerin en genişi; sayfaya sığdırılır (dar tabloda orantılı genişler, geniş tabloda orantılı daralır).
    const widths = headers.map((header, index) => {
      let width = doc.measure(header, "bold", FONT);
      for (const row of rows) width = Math.max(width, doc.measure(row.cells[index], row.bold ? "bold" : "regular", FONT));
      if (footer) width = Math.max(width, doc.measure(footer[index], "bold", FONT));
      return Math.max(40, width + PAD * 2);
    });
    const total = widths.reduce((sum, width) => sum + width, 0);
    const cols = widths.map(width => (width * W) / total);
    const lefts = cols.map((_, index) => M + cols.slice(0, index).reduce((sum, width) => sum + width, 0));
    const right = index => types[index] === "number";
    const cellText = (value, index, font, y) => page.text(lefts[index] + PAD, y, value, { font, size: FONT, color: INK, align: right(index) ? "right" : "left", width: right(index) ? cols[index] - PAD * 2 : undefined });
    const wrapCells = (cells, font) => cells.map((value, index) => {
      const lines = doc.wrap(String(value ?? ""), cols[index] - PAD * 2, font, FONT);
      return lines.length > 3 ? [...lines.slice(0, 2), doc.fit(lines.slice(2).join(" "), cols[index] - PAD * 2, font, FONT)] : lines.length ? lines : [""];
    });
    const headerLines = wrapCells(headers, "bold");
    const headerHeight = 8 + Math.max(...headerLines.map(lines => lines.length)) * (FONT + 3);
    const drawHeader = () => {
      page.rect(M, top, W, headerHeight, { fill: "#f3f4f6" });
      headerLines.forEach((lines, index) => lines.forEach((line, n) => page.text(lefts[index] + PAD, top + FONT + 4 + n * (FONT + 3), line, { font: "bold", size: FONT, color: "#374151", align: right(index) ? "right" : "left", width: right(index) ? cols[index] - PAD * 2 : undefined })));
      top += headerHeight;
    };
    // Kart başlığı tablo başlığı ve ilk satırla aynı sayfada kalır.
    if (top + 22 + headerHeight + 2 * (FONT + 9) > bottom) newPage(false);
    page.text(M, top + 14, doc.fit(kart.ad || "", W, "bold", 11), { font: "bold", size: 11, color: INK });
    top += 22;
    drawHeader();
    const drawRow = (cells, { bold = false, fill = null, strong = false } = {}) => {
      const font = bold ? "bold" : "regular";
      const wrapped = wrapCells(cells, font);
      const height = 6 + Math.max(...wrapped.map(lines => lines.length)) * (FONT + 3);
      if (top + height > bottom) {
        newPage(false);
        drawHeader();
      }
      if (fill) page.rect(M, top, W, height, { fill });
      wrapped.forEach((lines, index) => lines.forEach((line, n) => cellText(line, index, font, top + FONT + 3 + n * (FONT + 3))));
      top += height;
      page.line(M, top, M + W, top, { color: strong ? "#374151" : "#e5e7eb", width: strong ? 1 : 0.4 });
    };
    rows.forEach((row, index) => drawRow(row.cells, { bold: row.bold, fill: row.sonuc ? "#eef6f1" : row.bold ? "#f9fafb" : index % 2 ? "#fcfcfd" : null, strong: row.sonuc }));
    if (footer) drawRow(footer, { bold: true, fill: "#eef6f1", strong: true });
    top += 14;
  }

  const count = doc.pages.length;
  doc.pages.forEach((item, index) => {
    const y = size.height - 24;
    item.line(M, y - 10, M + W, y - 10, { color: "#e5e7eb", width: 0.5 });
    item.text(M, y, brand ? `${brand} · Maliyet Hesap Kartı · ${title}` : `Maliyet Hesap Kartı · ${title}`, { size: 7.5, color: MUTED });
    item.text(M, y, `Sayfa ${index + 1} / ${count}`, { size: 7.5, color: MUTED, align: "right", width: W });
  });
  return doc.toBuffer({ now });
}
