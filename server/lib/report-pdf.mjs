// Rapor PDF'i (v2.0.2): dinamik kolonlu tablo. Kolon genişlikleri içeriğe göre (başlık ve en uzun hücrelerin p90'ı),
// sayfaya sığmayan geniş tablolarda yatay (landscape) sayfa; uzun hücreler satır içinde sarılır; her sayfada başlık
// satırı ve altbilgi (sayfa no). Kasa dökümüyle aynı yazı tipi ve bağımlılıksız PDF yazıcı (pdf-write.mjs).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { A4, PdfDocument, loadFont } from "./pdf-write.mjs";

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");
let fonts = null;
const loadFonts = () => {
  fonts ||= { regular: loadFont(join(FONT_DIR, "LiberationSans-Regular.ttf")), bold: loadFont(join(FONT_DIR, "LiberationSans-Bold.ttf")) };
  return fonts;
};
const pad = value => String(value).padStart(2, "0");
// Biçimlendirici bir kez kurulur (her çağrıda kurmak büyük raporlarda saniyeler sürüyordu).
const moneyFormat = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tl = value => `${moneyFormat.format(Number(value) || 0)} TL`;

/**
 * @param {{ title: string, subtitle?: string, headers: string[], rows: string[][], types?: string[], summary?: Array<[string, string]>, footer?: string[] | null, officeName?: string, userName?: string, brand?: string, now?: Date }} input
 * footer (v2.0.20): tablonun altındaki kalın TOPLAM satırı (rapor merkezi hesaplar; yoksa çizilmez).
 * brand: altbilgideki ad (varsayılan "DestekOfis"); boş metin yalnız başlığı yazar (müşteriye verilen belgeler, v2.0.6).
 */
export function tablePdf({ title, subtitle = "", headers, rows, types = [], summary = [], footer = null, officeName = "", userName = "", brand = "DestekOfis", now = new Date() }) {
  const M = 36;
  const landscape = headers.length > 7;
  const size = landscape ? { width: A4.height, height: A4.width } : A4;
  const doc = new PdfDocument({ fonts: loadFonts(), size, title, author: officeName || "DestekOfis", subject: title });
  const W = size.width - M * 2;
  const bottomLimit = size.height - 48;
  const muted = "#6b7280";
  const ink = "#111827";
  const fontSize = headers.length > 10 ? 7 : headers.length > 7 ? 7.5 : 8.5;
  const cellPad = 4;

  // Kolon genişlikleri: başlık ve hücre ölçümlerinin p90'ı, en az 40 ve en çok W/3.
  const sample = rows.slice(0, 400);
  const widths = headers.map((header, index) => {
    const samples = sample.map(row => doc.measure(String(row[index] ?? ""), "regular", fontSize)).sort((a, b) => a - b);
    const p90 = samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.9))] : 0;
    return Math.min(W / 3, Math.max(40, Math.max(doc.measure(header, "bold", fontSize) + 6, p90) + cellPad * 2));
  });
  // Sayfaya sığmayınca (v2.0.6) yalnız sözcüklü metin kolonları (ad, grup, not) daralıp satır içinde sarılır; tutar, tarih,
  // telefon gibi bölünmez değerler kendi genişliğinde kalır ("03.09.202 / 6" diye kırılmasın). Yetmezse hepsi orantılanır.
  const sum = list => list.reduce((total, value) => total + value, 0);
  const rigid = index => types[index] === "money" || types[index] === "number" || sample.every(row => !/\s/.test(String(row[index] ?? "").trim()));
  const floor = index => Math.max(48, Math.min(widths[index], doc.measure(headers[index], "bold", fontSize) + 6 + cellPad * 2));
  let cols = widths.slice();
  if (sum(widths) > W) {
    const flex = headers.map((_, index) => index).filter(index => !rigid(index));
    let room = W - sum(widths.filter((_, index) => rigid(index)));
    if (flex.length && room >= sum(flex.map(floor))) {
      let pool = flex;
      while (pool.length) {
        const scale = room / sum(pool.map(index => widths[index]));
        const under = pool.filter(index => widths[index] * scale < floor(index));
        if (!under.length) {
          pool.forEach(index => (cols[index] = widths[index] * scale));
          break;
        }
        under.forEach(index => {
          cols[index] = floor(index);
          room -= cols[index];
        });
        pool = pool.filter(index => !under.includes(index));
      }
    } else cols = widths.map(width => (width * W) / sum(widths));
  } else if (sum(widths) < W) {
    // Dar tablo sayfanın bir kısmında kalıp sağı boş görünmesin (v2.0.10): kolonlar orantılı genişleyip satırı doldurur.
    cols = widths.map(width => (width * W) / sum(widths));
  }
  const lefts = cols.map((_, index) => M + cols.slice(0, index).reduce((sum, width) => sum + width, 0));
  const align = index => (types[index] === "money" || types[index] === "number" ? "right" : "left");

  let page = null;
  let top = 0;
  // v2.1.0 Aşama 14: sığmayan kolon başlığı kesilmez, sözcük sınırından en çok iki satıra iner (K10 adları — "Hesabı Atanmamış Eski Hareketler"
  // — Birleşik Rapor'un dar kolonunda "Hesabı Atan…" diye kesiliyordu). Sığan başlık bugünkü gibi tek satırdır (satır yüksekliği aynı).
  const headerLines = headers.map((text, index) => {
    const width = cols[index] - cellPad * 2;
    if (doc.measure(text, "bold", fontSize) <= width) return [text];
    const lines = doc.wrap(text, width, "bold", fontSize);
    return lines.length > 2 ? [lines[0], doc.fit(lines.slice(1).join(" "), width, "bold", fontSize)] : lines.length ? lines : [doc.fit(text, width, "bold", fontSize)];
  });
  const headerHeight = headerLines.some(lines => lines.length > 1) ? 18 + fontSize + 2 : 18;
  const header = () => {
    page.rect(M, top, W, headerHeight, { fill: "#f3f4f6" });
    headerLines.forEach((lines, index) => lines.forEach((line, lineIndex) => page.text(lefts[index] + cellPad, top + 12 + lineIndex * (fontSize + 2), lineIndex || lines.length > 1 ? line : doc.fit(line, cols[index] - cellPad * 2, "bold", fontSize), { font: "bold", size: fontSize, color: "#374151", align: align(index), width: align(index) === "right" ? cols[index] - cellPad * 2 : undefined })));
    top += headerHeight;
  };
  const created = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const newPage = first => {
    page = doc.addPage();
    top = M;
    if (first) {
      if (officeName) page.text(M, top + 8, doc.fit(officeName, W * 0.6, "bold", 9), { font: "bold", size: 9, color: muted });
      page.text(M, top + 30, title, { font: "bold", size: 18, color: ink });
      if (subtitle) page.text(M, top + 46, doc.fit(subtitle, W, "regular", 10), { size: 10, color: "#374151" });
      page.text(M, top + 8, `Oluşturma: ${created}`, { size: 8, color: muted, align: "right", width: W });
      if (userName) page.text(M, top + 20, `Hazırlayan: ${doc.fit(userName, W * 0.35, "regular", 8)}`, { size: 8, color: muted, align: "right", width: W });
      top += subtitle ? 58 : 44;
      if (summary.length) {
        const gap = 6;
        // v2.1.0 Aşama 14: altıdan çok özet kutusu iki (ya da daha çok) sıraya dizilir; tek sırada tutar kutuya sığmayıp kesiliyordu
        // ("33.114,2…"). Altı ve daha az kutu bugünkü gibi tek sıradadır.
        const perRow = summary.length > 6 ? Math.ceil(summary.length / Math.ceil(summary.length / 6)) : summary.length;
        const cardWidth = (W - gap * (perRow - 1)) / perRow;
        // v2.0.23: uzun özet başlığı ("Güncel Kasa (tüm hareketler)") kesilmez, sözcük sınırından en çok iki satıra iner;
        // kutular aynı boyda. Tek başına sığmayan sözcükte yazı küçülür (en az 6 punto); yine sığmazsa sözcük tireyle bölünür
        // ("Taksitlendiril-" / "miş"), harf ortasından sessizce kesilmez.
        const labelOf = label => {
          const width = cardWidth - 16;
          const words = String(label ?? "").split(/\s+/).filter(Boolean);
          const longest = Math.max(0, ...words.map(word => doc.measure(word, "regular", 7.5)));
          const size = longest > width ? Math.max(6, Math.floor(((7.5 * width) / longest) * 10) / 10) : 7.5;
          const lines = [];
          let line = "";
          for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (doc.measure(candidate, "regular", size) <= width) {
              line = candidate;
              continue;
            }
            if (line) lines.push(line);
            line = word;
            while (line.length > 1 && doc.measure(line, "regular", size) > width) {
              let cut = 1;
              while (cut < line.length - 1 && doc.measure(`${line.slice(0, cut + 1)}-`, "regular", size) <= width) cut += 1;
              lines.push(`${line.slice(0, cut)}-`);
              line = line.slice(cut);
            }
          }
          if (line) lines.push(line);
          return { size, lines: lines.length > 2 ? [lines[0], doc.fit(lines.slice(1).join(" "), width, "regular", size)] : lines.length ? lines : [""] };
        };
        const labels = summary.map(([label]) => labelOf(label));
        const twoLines = labels.some(label => label.lines.length > 1);
        const cardHeight = twoLines ? 45 : 36;
        summary.forEach(([, value], index) => {
          const row = Math.floor(index / perRow);
          const left = M + (index % perRow) * (cardWidth + gap);
          const y = top + row * (cardHeight + gap);
          page.rect(left, y, cardWidth, cardHeight, { fill: "#f9fafb", stroke: "#e5e7eb", radius: 5 });
          const { size, lines } = labels[index];
          lines.forEach((line, lineIndex) => page.text(left + 8, y + 13 + lineIndex * (size + 1.5), line, { size, color: muted }));
          page.text(left + 8, y + cardHeight - 8, doc.fit(value, cardWidth - 16, "bold", 10), { font: "bold", size: 10, color: ink });
        });
        top += Math.ceil(summary.length / perRow) * (cardHeight + gap) - gap + 10;
      }
    } else {
      page.text(M, top + 8, `${title}${subtitle ? ` · ${subtitle}` : ""}`, { font: "bold", size: 8, color: muted });
      top += 18;
    }
    header();
  };
  newPage(true);
  if (!rows.length) {
    page.text(M + cellPad, top + 14, "Bu süzgeçlerle satır bulunamadı.", { size: 9, color: muted });
    top += 22;
  }
  rows.forEach((row, rowIndex) => {
    const wrapped = row.map((value, index) => {
      const lines = doc.wrap(String(value ?? ""), cols[index] - cellPad * 2, "regular", fontSize);
      return lines.length > 4 ? [...lines.slice(0, 3), doc.fit(`${lines[3]}…`, cols[index] - cellPad * 2, "regular", fontSize)] : lines.length ? lines : [""];
    });
    const height = 6 + Math.max(...wrapped.map(lines => lines.length)) * (fontSize + 3);
    if (top + height > bottomLimit) newPage(false);
    if (rowIndex % 2) page.rect(M, top, W, height, { fill: "#fcfcfd" });
    wrapped.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => page.text(lefts[index] + cellPad, top + fontSize + 3 + lineIndex * (fontSize + 3), line, { size: fontSize, color: ink, align: align(index), width: align(index) === "right" ? cols[index] - cellPad * 2 : undefined }));
    });
    top += height;
    page.line(M, top, M + W, top, { color: "#e5e7eb", width: 0.4 });
  });
  // TOPLAM satırı (v2.0.20): son satırın altında, üstte koyu çizgi ve açık zemin; sayfaya sığmazsa yeni sayfada başlıkla.
  if (footer && rows.length) {
    const wrapped = footer.map((value, index) => {
      const lines = doc.wrap(String(value ?? ""), cols[index] - cellPad * 2, "bold", fontSize);
      return lines.length ? lines.slice(0, 2) : [""];
    });
    const height = 8 + Math.max(...wrapped.map(lines => lines.length)) * (fontSize + 3);
    if (top + height > bottomLimit) newPage(false);
    page.rect(M, top, W, height, { fill: "#eef6f1" });
    page.line(M, top, M + W, top, { color: "#374151", width: 1 });
    wrapped.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => page.text(lefts[index] + cellPad, top + fontSize + 4 + lineIndex * (fontSize + 3), line, { font: "bold", size: fontSize, color: ink, align: align(index), width: align(index) === "right" ? cols[index] - cellPad * 2 : undefined }));
    });
    top += height;
    page.line(M, top, M + W, top, { color: "#374151", width: 1 });
  }
  const count = doc.pages.length;
  doc.pages.forEach((item, index) => {
    const footer = size.height - 24;
    item.line(M, footer - 10, M + W, footer - 10, { color: "#e5e7eb", width: 0.5 });
    item.text(M, footer, brand ? `${brand} · ${title}` : title, { size: 7.5, color: muted });
    item.text(M, footer, `Sayfa ${index + 1} / ${count}`, { size: 7.5, color: muted, align: "right", width: W });
  });
  return doc.toBuffer({ now });
}

export { tl };
