// Kasa dökümü PDF'i (v2.0.1): seçilen tarih aralığındaki kasa hareketleri, devreden kasa, dönem toplamları ve her
// satırda yürüyen kasa bakiyesi. A4 dikey; tablo başlığı her sayfada tekrarlanır, altta sayfa numarası yazar.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { A4, PdfDocument, loadFont } from "./pdf-write.mjs";

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");
let fonts = null;
const loadFonts = () => {
  fonts ||= { regular: loadFont(join(FONT_DIR, "LiberationSans-Regular.ttf")), bold: loadFont(join(FONT_DIR, "LiberationSans-Bold.ttf")) };
  return fonts;
};

const pad = value => String(value).padStart(2, "0");
export const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const moneyFormat = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Gömülü yazı tipinde ₺ işareti yok; resmî belgelerdeki gibi "TL" yazılır.
export const tl = value => `${moneyFormat.format(Number(value) || 0)} TL`;

export function rangeLabel(from, to) {
  if (from && to) return `${dayText(from)} – ${dayText(to)}`;
  if (from) return `${dayText(from)} ve sonrası`;
  if (to) return `${dayText(to)} tarihine kadar`;
  return "Tüm hareketler";
}

const describe = entry => {
  if (entry.source === "account") return { text: [entry.kind === "in" ? "Cari tahsilat" : "Cariye ödeme", entry.accountName, entry.description].filter(Boolean).join(" · "), origin: "Cari kartından" };
  if (entry.source === "stock") return { text: entry.description || "", origin: "Stok hareketinden" };
  if (entry.source === "invoice") return { text: entry.description || "", origin: "Faturadan" };
  if (entry.source === "plan") return { text: [entry.kind === "in" ? "Taksit tahsilatı" : "Taksit ödemesi/iadesi", entry.planName, entry.description].filter(Boolean).join(" · "), origin: "Taksit kartından" };
  if (entry.source !== "payment") return { text: entry.description || "", origin: entry.kind === "in" ? "Kasaya elle girilen tahsilat" : "Ödeme" };
  const title = entry.caseTitle || (String(entry.caseKey || "").startsWith("satir:") ? "" : entry.caseKey || "");
  return { text: ["Tahsilat", title, entry.description].filter(Boolean).join(" · "), origin: "Detay kartından tahsilat" };
};

// report: /api/workspace/cash yanıtıyla aynı biçim ({ entries, opening, period, totals }).
export function cashPdf(report, { from = "", to = "", officeName = "", userName = "", now = new Date() } = {}) {
  const range = rangeLabel(from, to);
  // v2.0.13: yola göre döküm (Nakit Kasa, Banka, Kredi Kartı) ya da hepsi (Kasa ve Banka).
  const which = { cash: "Nakit Kasa", bank: "Banka (Havale / EFT)", card: "Kredi Kartı (POS)" }[report.method] || "Kasa ve Banka";
  const doc = new PdfDocument({ fonts: loadFonts(), title: `${which} Dökümü · ${range}`, author: officeName || "DestekOfis", subject: "Kasa hareketleri" });
  const M = 40;
  const W = A4.width - M * 2;
  const bottomLimit = A4.height - 54;
  const col = { date: 58, in: 78, out: 78, balance: 84 };
  col.text = W - col.date - col.in - col.out - col.balance;
  const x = { date: M, text: M + col.date, in: M + col.date + col.text, out: M + col.date + col.text + col.in, balance: M + W - col.balance };
  const cellPad = 6;
  const muted = "#6b7280";
  const ink = "#111827";
  const green = "#047857";
  const red = "#b91c1c";

  const closing = report.entries.length ? report.entries[report.entries.length - 1].balance : report.opening || 0;
  const created = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let page;
  let top;
  const tableHeader = () => {
    page.rect(M, top, W, 20, { fill: "#f3f4f6" });
    const head = (label, left, width, align) => page.text(left + cellPad, top + 13.5, label, { font: "bold", size: 8, color: muted, align, width: width - cellPad * 2 });
    head("TARİH", x.date, col.date, "left");
    head("AÇIKLAMA", x.text, col.text, "left");
    head("TAHSİLAT", x.in, col.in, "right");
    head("ÖDEME", x.out, col.out, "right");
    head("KASA", x.balance, col.balance, "right");
    top += 20;
  };
  const newPage = first => {
    page = doc.addPage();
    top = M;
    if (first) {
      if (officeName) page.text(M, top + 9, doc.fit(officeName, W * 0.6, "bold", 9), { font: "bold", size: 9, color: muted });
      page.text(M, top + 34, `${which} Dökümü`, { font: "bold", size: 20, color: ink });
      page.text(M, top + 54, range, { size: 11, color: "#374151" });
      page.text(M, top + 9, `Oluşturma: ${created}`, { size: 8, color: muted, align: "right", width: W });
      if (userName) page.text(M, top + 21, `Hazırlayan: ${doc.fit(userName, W * 0.35, "regular", 8)}`, { size: 8, color: muted, align: "right", width: W });
      top += 72;
      const cards = [
        ["Devreden kasa", report.opening || 0, ink],
        ["Dönem tahsilatı", report.period.in, green],
        ["Dönem ödemesi", report.period.out, red],
        ["Dönem sonu kasa", closing, ink],
      ];
      const gap = 8;
      const cardWidth = (W - gap * 3) / 4;
      cards.forEach(([label, value, color], index) => {
        const left = M + index * (cardWidth + gap);
        page.rect(left, top, cardWidth, 44, { fill: "#f9fafb", stroke: "#e5e7eb", radius: 6 });
        page.text(left + 10, top + 16, label, { size: 8, color: muted });
        page.text(left + 10, top + 34, doc.fit(tl(value), cardWidth - 20, "bold", 12), { font: "bold", size: 12, color });
      });
      top += 60;
    } else {
      page.text(M, top + 10, `${which} Dökümü · ${range}`, { font: "bold", size: 9, color: muted });
      top += 22;
    }
    tableHeader();
  };
  const row = ({ date = "", lines, sub = "", incoming = null, outgoing = null, balance = null, bold = false, fill = null }) => {
    const height = Math.max(22, 8 + lines.length * 11 + (sub ? 10 : 0) + 4);
    if (top + height > bottomLimit) newPage(false);
    if (fill) page.rect(M, top, W, height, { fill });
    const baseline = top + 14;
    page.text(x.date + cellPad, baseline, date, { size: 8.5, color: "#374151" });
    lines.forEach((line, index) => page.text(x.text + cellPad, baseline + index * 11, line, { font: bold ? "bold" : "regular", size: 9, color: ink }));
    if (sub) page.text(x.text + cellPad, baseline + lines.length * 11 - 1, sub, { size: 7.5, color: muted });
    const amount = (value, left, width, color) => value !== null && page.text(left + cellPad, baseline, tl(value), { font: bold ? "bold" : "regular", size: 9, color, align: "right", width: width - cellPad * 2 });
    amount(incoming, x.in, col.in, green);
    amount(outgoing, x.out, col.out, red);
    amount(balance, x.balance, col.balance, ink);
    top += height;
    page.line(M, top, M + W, top, { color: "#e5e7eb", width: 0.5 });
  };

  newPage(true);
  const textWidth = col.text - cellPad * 2;
  if (from) row({ lines: ["Devreden kasa"], sub: `${dayText(from)} öncesindeki bakiye`, balance: report.opening || 0, bold: true, fill: "#fafafa" });
  if (!report.entries.length) row({ lines: ["Bu aralıkta kasa hareketi yok."] });
  report.entries.forEach((entry, index) => {
    const { text, origin } = describe(entry);
    const lines = doc.wrap(text, textWidth, "regular", 9).slice(0, 3);
    if (doc.wrap(text, textWidth, "regular", 9).length > 3) lines[2] = doc.fit(`${lines[2]}…`, textWidth, "regular", 9);
    row({
      date: dayText(entry.date),
      lines,
      sub: doc.fit(`${origin}${entry.method && entry.method !== "cash" ? ` · ${{ bank: "Havale / EFT", card: "Kredi Kartı" }[entry.method] || ""}` : ""}${entry.actorName ? ` · ${entry.actorName}` : ""}`, textWidth, "regular", 7.5),
      incoming: entry.kind === "in" ? entry.amount : null,
      outgoing: entry.kind === "out" ? entry.amount : null,
      balance: entry.balance,
      fill: index % 2 ? "#fcfcfd" : null,
    });
  });
  row({ lines: ["Dönem toplamı"], sub: `${report.entries.length} hareket · fark ${tl(report.period.net)}`, incoming: report.period.in, outgoing: report.period.out, balance: closing, bold: true, fill: "#f3f4f6" });

  const total = doc.pages.length;
  doc.pages.forEach((item, index) => {
    const footer = A4.height - 28;
    item.line(M, footer - 12, M + W, footer - 12, { color: "#e5e7eb", width: 0.5 });
    item.text(M, footer, `DestekOfis · Kasa dökümü · ${range}`, { size: 7.5, color: muted });
    item.text(M, footer, `Sayfa ${index + 1} / ${total}`, { size: 7.5, color: muted, align: "right", width: W });
  });
  return doc.toBuffer({ now });
}

// Dosya adı ASCII: bazı tarayıcılar indirme adındaki Türkçe harfleri reddedip "download" adıyla kaydediyor.
export const cashPdfName = (from, to) => (from || to ? `Kasa-dokumu ${dayText(from) || "baslangic"}-${dayText(to) || "bugun"}.pdf` : "Kasa-dokumu tumu.pdf");
