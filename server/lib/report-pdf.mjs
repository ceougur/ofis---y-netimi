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

const MARGIN = 36;
const CELL_PAD = 4;
// Sayfa düzeni kolon sayısından: 7'den çok kolon yatay sayfa; yazı boyu kolon sayısıyla küçülür.
const layoutOf = count => {
  const size = count > 7 ? { width: A4.height, height: A4.width } : A4;
  return { size, W: size.width - MARGIN * 2, fontSize: count > 10 ? 7 : count > 7 ? 7.5 : 8.5 };
};
// Kolon ölçüleri: başlık ve hücre ölçümlerinin p90'ı, en az 40 ve en çok W/3. 2.4.4 U3: tutar ve sayı kolonunda p90 değil EN GENİŞ hücre (bütün
// satırların en uzun metni ve kalın TOPLAM hücreleri dahil) — en büyük tutarlar ve TOPLAM satır ortasından bölünmesin ("36.00 / 0,00").
// rigid: bölünmez kolon (tutar, sayı, boşluksuz değer: tarih, telefon, numara); floor: sözcüklü kolonun en dar hâli (başlığı sığar).
function columnMeasures(doc, { headers, rows, types, totals, fontSize, W, wrapHeads = false }) {
  const sample = rows.slice(0, 400);
  const numeric = index => types[index] === "money" || types[index] === "number";
  const widths = headers.map((header, index) => {
    const samples = sample.map(row => doc.measure(String(row[index] ?? ""), "regular", fontSize)).sort((a, b) => a - b);
    let content = samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.9))] : 0;
    if (numeric(index)) {
      // Rakamlar eşit genişlikte: bütün satırlarda yalnız en uzun metin ölçülür (büyük raporda da hızlı).
      let longest = "";
      for (const row of rows) {
        const value = String(row[index] ?? "");
        if (value.length > longest.length) longest = value;
      }
      content = Math.max(samples.length ? samples[samples.length - 1] : 0, doc.measure(longest, "regular", fontSize), ...totals.map(line => doc.measure(String(line[index] ?? ""), "bold", fontSize)));
    }
    return Math.min(W / 3, Math.max(40, Math.max(doc.measure(header, "bold", fontSize) + 6, content) + CELL_PAD * 2));
  });
  const rigid = index => numeric(index) || sample.every(row => !/\s/.test(String(row[index] ?? "").trim()));
  // wrapHeads (2.4.7, yalnız isteyen rapor — Ayrıntılı Cari Ekstre): sözcüklü kolonun en dar hâli başlığın İKİ SATIRA bölünmüş genişliğidir (başlık çizimde zaten
  // en çok iki satıra iner); verilmezse bugünkü gibi tek satır başlık genişliği.
  const headWidth = index => {
    const text = String(headers[index] ?? "");
    const full = doc.measure(text, "bold", fontSize);
    if (!wrapHeads) return full;
    const words = text.split(/\s+/).filter(Boolean);
    let best = full;
    for (let cut = 1; cut < words.length; cut += 1) best = Math.min(best, Math.max(doc.measure(words.slice(0, cut).join(" "), "bold", fontSize), doc.measure(words.slice(cut).join(" "), "bold", fontSize)));
    return best;
  };
  const floor = index => Math.max(48, Math.min(widths[index], headWidth(index) + 6 + CELL_PAD * 2));
  // 2.4.6 (2.4.5 gezinti B4): sözcüklü kolonun en dar hâli en uzun SÖZCÜĞÜ de taşır — "Makbuz 1" yüzünden sözcüklü sayılan Belge No kolonu
  // "FIS2026000000001"i "FIS20260000 / 00001" diye bölüyordu. Yalnız sayfaya sığarsa kullanılır (drawTablePdf); sığmazsa eski en dar hâl.
  const wordFloors = new Map();
  const wordFloor = index => {
    if (wordFloors.has(index)) return wordFloors.get(index);
    let longest = 0;
    for (const row of sample) for (const word of String(row[index] ?? "").split(/\s+/)) if (word) longest = Math.max(longest, doc.measure(word, "regular", fontSize));
    const value = Math.max(floor(index), Math.min(widths[index], longest + CELL_PAD * 2));
    wordFloors.set(index, value);
    return value;
  };
  return { widths, rigid, floor, wordFloor };
}
const totalsOf = ({ footer = null, footers = null }) => (Array.isArray(footers) && footers.length ? footers : footer ? [footer] : []);

/**
 * @param {{ title: string, subtitle?: string, headers: string[], rows: string[][], types?: string[], summary?: Array<[string, string]>, footer?: string[] | null, footers?: string[][] | null, officeName?: string, officeLines?: string[] | null, userName?: string, brand?: string, now?: Date, optional?: number[], optionalNote?: (count: number) => string }} input
 * footer (v2.0.20): tablonun altındaki kalın TOPLAM satırı (rapor merkezi hesaplar; yoksa çizilmez). footers (2.4.3 UX24): birden çok
 * TOPLAM satırı (yönü karışık raporda "TOPLAM Satış", "TOPLAM Alış", "Net"); verilirse footer yerine bunlar sırayla çizilir.
 * officeLines (2.4.5 madde 6c): Tabela Adı açıkken sol üstteki başlık satırları (lib/report-header.mjs); verilmezse tek satır officeName.
 * brand: altbilgideki ad (varsayılan "DestekOfis"); boş metin yalnız başlığı yazar (müşteriye verilen belgeler, v2.0.6).
 *
 * optional (2.4.4 U3): sayfaya sığmazsa bırakılabilecek kolonların sırası (tablo raporlarının özel alan kolonları; Excel'de hepsi var). Bölünmez kolonların
 * ve sözcüklü kolonların en dar hâlinin toplamı sayfaya sığana kadar sağdaki bırakılabilir kolon çıkarılır — tutar ve başlık sözcük ortasından bölünmez
 * (önceden 18 kolonlu Tablodaki Kişiler'de bütün kolonlar orantılanıyor, "36.00 / 0,00", "Kayna k" çıkıyordu). Bırakılan sayı alt başlığa optionalNote(n)
 * ile yazılır. optional verilmezse kolon bırakılmaz.
 */
export function tablePdf(input) {
  const optional = Array.isArray(input.optional) ? input.optional.filter(index => Number.isInteger(index) && index >= 0 && index < input.headers.length) : [];
  if (!optional.length) return drawTablePdf(input);
  const pick = keep => ({
    ...input,
    headers: keep.map(index => input.headers[index]),
    types: keep.map(index => (input.types || [])[index] ?? ""),
    rows: input.rows.map(row => keep.map(index => row[index])),
    footer: input.footer ? keep.map(index => input.footer[index]) : null,
    footers: Array.isArray(input.footers) ? input.footers.map(line => keep.map(index => line[index])) : null,
  });
  const measurer = new PdfDocument({ fonts: loadFonts(), size: A4 });
  const fits = part => {
    const { W, fontSize } = layoutOf(part.headers.length);
    const { widths, rigid, floor } = columnMeasures(measurer, { ...part, types: part.types, totals: totalsOf(part), fontSize, W });
    return widths.reduce((total, width, index) => total + (rigid(index) ? width : floor(index)), 0) <= W;
  };
  const left = [...new Set(optional)].sort((a, b) => a - b);
  let keep = input.headers.map((_, index) => index);
  while (left.length && !fits(pick(keep))) {
    const drop = left.pop();
    keep = keep.filter(index => index !== drop);
  }
  const dropped = input.headers.length - keep.length;
  if (!dropped) return drawTablePdf(input);
  const note = typeof input.optionalNote === "function" ? input.optionalNote(dropped) : `${dropped} kolon sayfaya sığmadı`;
  return drawTablePdf({ ...pick(keep), subtitle: [input.subtitle, note].filter(Boolean).join(" · ") });
}

function drawTablePdf({ title, subtitle = "", headers, rows, types = [], summary = [], footer = null, footers = null, officeName = "", officeLines = null, userName = "", brand = "DestekOfis", now = new Date(), wrapHeads = false, cellLines: maxCellLines = 4 }) {
  const M = MARGIN;
  // cellLines (2.4.7): hücre en çok kaç satıra sarılır (sonrası "…"); varsayılan 4 (bugünkü). Ayrıntılı Cari Ekstre kalem açıklaması kesilmesin diye 40 verir.
  const cellLines = Number.isInteger(maxCellLines) && maxCellLines >= 1 ? maxCellLines : 4;
  const { size, W, fontSize } = layoutOf(headers.length);
  const doc = new PdfDocument({ fonts: loadFonts(), size, title, author: officeName || "DestekOfis", subject: title });
  const bottomLimit = size.height - 48;
  const muted = "#6b7280";
  const ink = "#111827";
  const cellPad = CELL_PAD;

  const measures = columnMeasures(doc, { headers, rows, types, totals: totalsOf({ footer, footers }), fontSize, W, wrapHeads: wrapHeads === true });
  const { widths, rigid } = measures;  // Sayfaya sığmayınca (v2.0.6) yalnız sözcüklü metin kolonları (ad, grup, not) daralıp satır içinde sarılır; tutar, tarih,
  // telefon gibi bölünmez değerler kendi genişliğinde kalır ("03.09.202 / 6" diye kırılmasın). Yetmezse hepsi orantılanır.
  const sum = list => list.reduce((total, value) => total + value, 0);
  let cols = widths.slice();
  if (sum(widths) > W) {
    const flex = headers.map((_, index) => index).filter(index => !rigid(index));
    let room = W - sum(widths.filter((_, index) => rigid(index)));
    const floor = flex.length && room >= sum(flex.map(measures.wordFloor)) ? measures.wordFloor : measures.floor;
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
      // 2.4.5 madde 6c: Tabela Adı açıkken başlık satırları (lib/report-header.mjs; ilki koyu, gerisi firma bilgisi); kapalıyken tek satır unvan (bugünkü).
      const heads = Array.isArray(officeLines) && officeLines.length ? officeLines : officeName ? [officeName] : [];
      heads.forEach((line, index) => page.text(M, top + 8 + index * 10, doc.fit(line, W * 0.6, index ? "regular" : "bold", index ? 8 : 9), { font: index ? "regular" : "bold", size: index ? 8 : 9, color: muted }));
      top += Math.max(0, heads.length - 1) * 10;
      page.text(M, top + 30, title, { font: "bold", size: 18, color: ink });
      // m6 (10.10.2026): uzun alt başlık kesilmez, sözcük sınırından en çok üç satıra iner (Nakit Akış'ın başlangıç tanımı "… Gerçek Banka…" diye
      // kesiliyordu). Sığan alt başlık bugünkü gibi tek satırdır (yerleşim aynı).
      const subLines = subtitle ? doc.wrap(subtitle, W, "regular", 10) : [];
      const shownSub = subLines.length > 3 ? [...subLines.slice(0, 2), doc.fit(subLines.slice(2).join(" "), W, "regular", 10)] : subLines;
      shownSub.forEach((line, index) => page.text(M, top + 46 + index * 12, line, { size: 10, color: "#374151" }));
      page.text(M, M + 8, `Oluşturma: ${created}`, { size: 8, color: muted, align: "right", width: W });
      if (userName) page.text(M, M + 20, `Hazırlayan: ${doc.fit(userName, W * 0.35, "regular", 8)}`, { size: 8, color: muted, align: "right", width: W });
      top += shownSub.length ? 58 + (shownSub.length - 1) * 12 : 44;
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
          // m6 komşusu: sığmayan değer önce küçülür (en az 7 punto), ancak yine sığmazsa kesilir ("10.000,00 TL (1…" tarihi yutuyordu).
          const valueWidth = cardWidth - 16;
          const wide = doc.measure(String(value ?? ""), "bold", 10);
          const valueSize = wide > valueWidth ? Math.max(7, Math.floor(((10 * valueWidth) / wide) * 10) / 10) : 10;
          page.text(left + 8, y + cardHeight - 8, doc.fit(value, valueWidth, "bold", valueSize), { font: "bold", size: valueSize, color: ink });
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
      return lines.length > cellLines ? [...lines.slice(0, cellLines - 1), doc.fit(`${lines[cellLines - 1]}…`, cols[index] - cellPad * 2, "regular", fontSize)] : lines.length ? lines : [""];
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
  const totals = Array.isArray(footers) && footers.length ? footers : footer ? [footer] : [];
  if (rows.length) for (const [totalIndex, line] of totals.entries()) {
    const wrapped = line.map((value, index) => {
      const lines = doc.wrap(String(value ?? ""), cols[index] - cellPad * 2, "bold", fontSize);
      return lines.length ? lines.slice(0, 2) : [""];
    });
    const height = 8 + Math.max(...wrapped.map(lines => lines.length)) * (fontSize + 3);
    if (top + height > bottomLimit) newPage(false);
    page.rect(M, top, W, height, { fill: "#eef6f1" });
    page.line(M, top, M + W, top, { color: totalIndex ? "#9ca3af" : "#374151", width: totalIndex ? 0.4 : 1 });
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
