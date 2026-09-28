// Taksit modülü PDF'leri (v2.0.4): kart ekstresi (taksitler + hareketler + özet) ve tahsilat makbuzu (A5 yatay iki nüsha
// yerine A4 tek makbuz; yazıcıdan kesilebilir). Kasa dökümüyle aynı yazı tipi ve bağımlılıksız PDF yazıcı.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { A4, PdfDocument, loadFont } from "./pdf-write.mjs";
import { dayText } from "./plans.mjs";

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");
let fonts = null;
const loadFonts = () => {
  fonts ||= { regular: loadFont(join(FONT_DIR, "LiberationSans-Regular.ttf")), bold: loadFont(join(FONT_DIR, "LiberationSans-Bold.ttf")) };
  return fonts;
};
const pad = value => String(value).padStart(2, "0");
const moneyFormat = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tl = value => `${moneyFormat.format(Number(value) || 0)} TL`;
const stamp = now => `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
const STATE = { paid: "Ödendi", partial: "Kısmen", overdue: "Gecikti", today: "Bugün", upcoming: "Yaklaşıyor", open: "Bekliyor", closed: "Kapalı" };
const stateText = item => (item.state === "paid" ? STATE.paid : item.partial ? `${STATE.partial} · ${STATE[item.state] || ""}` : STATE[item.state] || "");
const ink = "#111827";
const muted = "#6b7280";
const green = "#047857";
const red = "#b91c1c";

// Tutarı yazıyla (makbuz için): 12.500,50 → "on iki bin beş yüz TL elli kr".
const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
const below1000 = value => {
  const parts = [];
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const ones = value % 10;
  if (hundreds) parts.push(hundreds === 1 ? "yüz" : `${ONES[hundreds]} yüz`);
  if (tens) parts.push(TENS[tens]);
  if (ones) parts.push(ONES[ones]);
  return parts.join(" ");
};
export function amountInWords(amount) {
  const value = Math.round((Number(amount) || 0) * 100);
  const lira = Math.floor(value / 100);
  const kurus = value % 100;
  if (lira === 0 && kurus === 0) return "sıfır TL";
  const groups = [["", 1], ["bin", 1000], ["milyon", 1_000_000], ["milyar", 1_000_000_000]];
  const parts = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const [name, size] = groups[index];
    const chunk = Math.floor(lira / size) % 1000;
    if (!chunk) continue;
    if (name === "bin" && chunk === 1) parts.push("bin");
    else parts.push(`${below1000(chunk)}${name ? ` ${name}` : ""}`);
  }
  const text = lira ? `${parts.join(" ")} TL` : "";
  return kurus ? `${text}${text ? " " : ""}${below1000(kurus)} kuruş`.trim() : text;
}

const card = (page, doc, left, top, width, label, value, color = ink) => {
  page.rect(left, top, width, 44, { fill: "#f9fafb", stroke: "#e5e7eb", radius: 6 });
  page.text(left + 10, top + 16, label, { size: 8, color: muted });
  page.text(left + 10, top + 34, doc.fit(tl(value), width - 20, "bold", 12), { font: "bold", size: 12, color });
};

/** plan: /api/workspace/plans/:id yanıtı ({ name, phone, note, groupName, subgroupName, items, entries, totals, state }). */
export function planStatementPdf(plan, { officeName = "", userName = "", now = new Date() } = {}) {
  const doc = new PdfDocument({ fonts: loadFonts(), title: `Taksit ekstresi · ${plan.name}`, author: officeName, subject: "Taksit ekstresi" });
  const M = 40;
  const W = A4.width - M * 2;
  const bottomLimit = A4.height - 54;
  let page;
  let top;
  const where = [plan.groupName, plan.subgroupName].filter(Boolean).join(" › ");
  const newPage = first => {
    page = doc.addPage();
    top = M;
    if (first) {
      if (officeName) page.text(M, top + 9, doc.fit(officeName, W * 0.6, "bold", 9), { font: "bold", size: 9, color: muted });
      page.text(M, top + 34, "Taksit ekstresi", { font: "bold", size: 20, color: ink });
      page.text(M, top + 54, doc.fit(`${plan.refNo ? `No ${plan.refNo} · ` : ""}${plan.name}${where ? ` · ${where}` : ""}${plan.phone ? ` · ${plan.phone}` : ""}${plan.registeredOn ? ` · kayıt ${dayText(plan.registeredOn)}` : ""}`, W, "regular", 11), { size: 11, color: "#374151" });
      page.text(M, top + 9, `Oluşturma: ${stamp(now)}`, { size: 8, color: muted, align: "right", width: W });
      if (userName) page.text(M, top + 21, `Hazırlayan: ${doc.fit(userName, W * 0.35, "regular", 8)}`, { size: 8, color: muted, align: "right", width: W });
      top += 70;
      if (plan.note) {
        const lines = doc.wrap(plan.note, W, "regular", 9).slice(0, 3);
        lines.forEach((line, index) => page.text(M, top + index * 12, line, { size: 9, color: "#374151" }));
        top += lines.length * 12 + 6;
      }
      const gap = 8;
      const cardWidth = (W - gap * 3) / 4;
      [["Toplam tutar", plan.totals.total, ink], ["Tahsil edilen", plan.totals.paid, green], ["Kalan", plan.totals.remaining, plan.totals.remaining > 0 ? red : ink], ["Geciken", plan.totals.overdue, plan.totals.overdue > 0 ? red : ink]].forEach(([label, value, color], index) =>
        card(page, doc, M + index * (cardWidth + gap), top, cardWidth, label, value, color),
      );
      top += 60;
    } else {
      page.text(M, top + 10, `Taksit ekstresi · ${plan.name}`, { font: "bold", size: 9, color: muted });
      top += 22;
    }
  };
  const header = (columns, widths) => {
    if (top + 20 > bottomLimit) newPage(false);
    page.rect(M, top, W, 20, { fill: "#f3f4f6" });
    let left = M;
    columns.forEach((label, index) => {
      page.text(left + 6, top + 13.5, label, { font: "bold", size: 8, color: muted, align: index === 0 || index === 1 ? "left" : "right", width: widths[index] - 12 });
      left += widths[index];
    });
    top += 20;
  };
  const line = (cells, widths, { bold = false, colors = [], fill = null } = {}) => {
    if (top + 20 > bottomLimit) newPage(false);
    if (fill) page.rect(M, top, W, 20, { fill });
    let left = M;
    cells.forEach((cell, index) => {
      const right = index > 1;
      page.text(left + 6, top + 13.5, doc.fit(String(cell ?? ""), widths[index] - 12, bold ? "bold" : "regular", 9), { font: bold ? "bold" : "regular", size: 9, color: colors[index] || ink, align: right ? "right" : "left", width: widths[index] - 12 });
      left += widths[index];
    });
    top += 20;
    page.line(M, top, M + W, top, { color: "#e5e7eb", width: 0.5 });
  };
  const section = title => {
    if (top + 30 > bottomLimit) newPage(false);
    page.text(M, top + 12, title, { font: "bold", size: 11, color: ink });
    top += 20;
  };

  newPage(true);
  section(`Taksitler (${plan.items.length})`);
  const itemWidths = [40, W - 40 - 90 - 90 - 90 - 90, 90, 90, 90, 90];
  header(["NO", "VADE", "TUTAR", "ÖDENEN", "KALAN", "DURUM"], itemWidths);
  if (!plan.items.length) line(["", "Taksit tanımlanmamış."], itemWidths);
  plan.items.forEach((item, index) =>
    line([`${item.seq}.`, `${dayText(item.dueDate)}${item.note ? ` · ${item.note}` : ""}`, tl(item.amount), tl(item.paid), tl(item.remaining), stateText(item)], itemWidths, {
      colors: [ink, ink, ink, green, item.remaining > 0 ? red : ink, item.state === "overdue" ? red : ink],
      fill: index % 2 ? "#fcfcfd" : null,
    }),
  );
  line(["", "Toplam", tl(plan.totals.planned), tl(plan.totals.paid), tl(plan.totals.remaining), ""], itemWidths, { bold: true, fill: "#f3f4f6" });
  top += 12;
  section(`Hareketler (${plan.entries.length})`);
  const entryWidths = [70, W - 70 - 90 - 90 - 80, 90, 90, 80];
  header(["TARİH", "AÇIKLAMA", "TAHSİLAT", "ÖDEME", "MAKBUZ"], entryWidths);
  if (!plan.entries.length) line(["", "Henüz hareket yok."], entryWidths);
  plan.entries.forEach((entry, index) =>
    line([dayText(entry.date), `${entry.note || (entry.kind === "in" ? "Tahsilat" : "Ödeme / iade")}${entry.actorName ? ` · ${entry.actorName}` : ""}`, entry.kind === "in" ? tl(entry.amount) : "", entry.kind === "out" ? tl(entry.amount) : "", entry.receiptNo ? `No ${entry.receiptNo}` : ""], entryWidths, {
      colors: [ink, ink, green, red, muted],
      fill: index % 2 ? "#fcfcfd" : null,
    }),
  );
  line(["", "Toplam", tl(plan.totals.paidIn), tl(plan.totals.paidOut), ""], entryWidths, { bold: true, fill: "#f3f4f6" });

  const total = doc.pages.length;
  doc.pages.forEach((item, index) => {
    const footer = A4.height - 28;
    item.line(M, footer - 12, M + W, footer - 12, { color: "#e5e7eb", width: 0.5 });
    item.text(M, footer, `${officeName ? `${officeName} · ` : ""}Taksit ekstresi · ${plan.name}`, { size: 7.5, color: muted });
    item.text(M, footer, `Sayfa ${index + 1} / ${total}`, { size: 7.5, color: muted, align: "right", width: W });
  });
  return doc.toBuffer({ now });
}

/** Tek tahsilatın makbuzu (v2.0.6): A5 dikey (148 × 210 mm); yazıcıya A5 kâğıt konur, kâğıt israf olmaz.
 * Üstte yalnızca ofisin adı yazar (yönetimde verilen firma adı); ad verilmemişse boş kalır. Program adı basılmaz. */
export const A5 = { width: 419.53, height: 595.28 };
export function receiptPdf(plan, entry, { officeName = "", userName = "", now = new Date() } = {}) {
  const doc = new PdfDocument({ fonts: loadFonts(), size: A5, title: `Makbuz · ${plan.name}`, author: officeName, subject: "Tahsilat makbuzu" });
  const M = 26;
  const W = A5.width - M * 2;
  const P = 16; // çerçeve içi boşluk
  const L = M + P; // etiket kolonu
  const V = M + P + 84; // değer kolonu
  const VW = M + W - P - V;
  const page = doc.addPage();
  const item = entry.itemId ? plan.items.find(row => row.id === entry.itemId) : null;
  const incoming = entry.kind === "in";
  const where = [plan.groupName, plan.subgroupName].filter(Boolean).join(" › ");
  let top = M + 26;
  // Başlık: solda firma adı (en çok iki satır), sağda makbuz türü, numarası ve tarihi.
  const office = String(officeName || "").trim();
  if (office) doc.wrap(office, W / 2 - P, "bold", 12).slice(0, 2).forEach((line, index) => page.text(L, top + index * 14, line, { font: "bold", size: 12, color: ink }));
  page.text(M, top, incoming ? "TAHSİLAT MAKBUZU" : "ÖDEME / İADE MAKBUZU", { font: "bold", size: 11.5, color: ink, align: "right", width: W - P });
  page.text(M, top + 14, `${entry.receiptNo ? `No ${entry.receiptNo} · ` : ""}${dayText(entry.date)}`, { size: 9, color: muted, align: "right", width: W - P });
  top += office && doc.wrap(office, W / 2 - P, "bold", 12).length > 1 ? 34 : 26;
  page.line(L, top, M + W - P, top, { color: "#e5e7eb" });
  top += 20;
  const row = (label, value, { bold = false, size = 9.5, color = ink, lines = 1 } = {}) => {
    page.text(L, top, label, { size: 8, color: muted });
    const wrapped = doc.wrap(String(value ?? ""), VW, bold ? "bold" : "regular", size).slice(0, lines);
    wrapped.forEach((line, index) => page.text(V, top + index * (size + 3), index === lines - 1 ? doc.fit(line, VW, bold ? "bold" : "regular", size) : line, { font: bold ? "bold" : "regular", size, color }));
    top += Math.max(1, wrapped.length) * (size + 3) + 7;
  };
  row(incoming ? "Kimden" : "Kime", plan.name, { bold: true, size: 11.5, lines: 2 });
  if (plan.refNo) row(plan.refLabel || "Sıra No", plan.refNo);
  if (where) row("Grup", where, { lines: 2 });
  if (plan.phone) row("Telefon", plan.phone);
  // Cari makbuzunda (v2.0.6) açıklama hareketin türünden gelir ("Cari tahsilat", "Cariye ödeme").
  row("Açıklama", `${item ? `${item.seq}. taksit (vade ${dayText(item.dueDate)})` : entry.label || (incoming ? "Taksit tahsilatı" : "Ödeme / iade")}${entry.note ? ` · ${entry.note}` : ""}`, { lines: 2 });
  top += 2;
  // Tutar kutusu: rakamla ve yazıyla.
  const words = doc.wrap(`# ${amountInWords(entry.amount)} #`, W - P * 2 - 20, "regular", 8.5).slice(0, 2);
  const boxHeight = 34 + words.length * 11;
  page.rect(L, top, W - P * 2, boxHeight, { fill: "#f3f4f6", radius: 6 });
  page.text(L + 10, top + 15, "Tutar", { size: 8, color: muted });
  page.text(L + 10, top + 15, tl(entry.amount), { font: "bold", size: 16, color: incoming ? green : red, align: "right", width: W - P * 2 - 20 });
  words.forEach((line, index) => page.text(L + 10, top + 32 + index * 11, line, { size: 8.5, color: "#374151" }));
  top += boxHeight + 16;
  if (plan.balanceOnly) row(plan.totals.remaining < 0 ? "Bakiye (alacaklı)" : "Güncel bakiye", tl(Math.abs(plan.totals.remaining)), { bold: true });
  else {
    row("Toplam borç", tl(plan.totals.total));
    row("Tahsil edilen", tl(plan.totals.paid));
    row("Kalan borç", tl(plan.totals.remaining), { bold: true });
  }
  if (entry.actorName || userName) row("Tahsil eden", entry.actorName || userName);
  top += 18;
  const half = (W - P * 2 - 16) / 2;
  page.text(L, top, "Teslim eden", { size: 8, color: muted });
  page.text(L + half + 16, top, "Teslim alan / Kaşe · İmza", { size: 8, color: muted });
  page.line(L, top + 34, L + half, top + 34, { color: "#9ca3af" });
  page.line(L + half + 16, top + 34, M + W - P, top + 34, { color: "#9ca3af" });
  top += 50;
  // Çerçeve içeriğe göre; altında yalnız düzenlenme tarihi (program adı yok).
  page.rect(M, M, W, top - M, { stroke: "#d1d5db", radius: 10 });
  page.text(M, top + 14, `Düzenlenme: ${stamp(now)}${entry.updatedAt ? " · düzeltilmiş hareket" : ""}`, { size: 7, color: muted, align: "right", width: W });
  return doc.toBuffer({ now });
}
