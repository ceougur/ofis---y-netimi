// Bir sekmedeki alt alta tabloları (bölümleri) ayırır ve satırları kayıtlara çevirir.
// Google Sheets ve Excel yüklemeleri aynı kuralları kullanır; belirli bir tabloya özgü değildir.
//
// Tanınan düzenler:
//   1) Sekmenin en üstünde bir veya birkaç başlık satırı ("ÖNEMLİ İCRA DOSYALARI"), sonra kolon başlıkları.
//   2) Tablonun ortasında başlık satırı + yeni kolon başlıkları (kolonlar öncekinden farklı olabilir):
//        GAYRİMENKUL SATIŞ DOSYALARI / SIRA | ALACAKLI | … / kayıtlar / MENKUL SATIŞ … / SIRA | … / kayıtlar
//   3) Tablonun ortasında yalnızca grup etiketi satırları (kolonlar aynı kalır):
//        SIRA | AD | … / MUHASEBE / kayıtlar / HUKUK / kayıtlar
//   4) Araya yeniden konmuş aynı kolon başlığı satırı (sayfa sonu tekrarı): atlanır, kayıt sayılmaz.
//
// Kurallar yanlış alarm vermemek için tutucudur; emin olunamayan her durumda eski davranış geçerlidir
// (sekmenin ilk satırı kolon başlığı, geri kalanı kayıt). Tek bölümlü sekmelerde sekme adı aynen kalır;
// böylece mevcut düzeltmeler, silmeler ve notlar aynı kayıtlara bağlı kalır. Birden çok bölüm varsa her bölümün
// kaydı "Sekme › Bölüm" etiketini taşır; arayüz bunları sekmenin içinde alt başlıklar olarak gösterir.

export const SECTION_SEPARATOR = " › ";

const CASE_KEY = /\b(?:19|20)\d{2}\/\d+\b/;
const DATE = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const NUMBERISH = /^[-+(]?\s*[\d.,]+\s*(?:tl|₺|try|usd|eur|\$|€|%|adet)?\s*\)?$/i;
const MAX_LABEL = 60;
const MAX_TITLE = 120;

const FOLD = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
// Türkçe büyük/küçük harf farkı ve şapkalı/noktalı harfler yok sayılır ("İCRA DAİRESİ" = "icra dairesi").
// toLocaleLowerCase("tr-TR") büyük tablolarda çok yavaş olduğundan İ elle çevrilir; I zaten i'ye iner (ı da i'ye
// katlandığından sonuç aynıdır).
export const fold = value =>
  String(value ?? "")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[çğıöşüâîû]/g, char => FOLD[char])
    .replace(/[.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Kolon başlıklarında sık geçen kelimeler (Türkçe ve İngilizce). Kısa olanlar tam eşleşir; uzun olanlar ek almış
// hâlini de kapsar (TARİHİ → tarih, DURUMU → durum, NAMES → name).
const SHORT_WORDS = new Set(["no", "nr", "tc", "ad", "adi", "il", "tel", "gsm", "not", "yil", "ay", "turu", "id", "qty", "sn"]);
const LONG_WORDS = [
  // Türkçe
  "sira", "dosya", "esas", "alacakli", "alacak", "borclu", "muvekkil", "karsi", "taraf", "icra", "mahkeme", "tarih",
  "durum", "tutar", "telefon", "adres", "soyad", "unvan", "avans", "kiymet", "haciz", "satis", "karar", "konu",
  "aciklama", "vekil", "miktar", "takip", "teblig", "sonuc", "ilce", "banka", "iban", "odeme", "taksit", "numara",
  "kimlik", "plaka", "arac", "tasinmaz", "sorumlu", "personel", "avukat", "dava", "davaci", "davali", "harc", "faiz",
  "masraf", "bakiye", "vade", "kategori", "asama", "statu", "gorev", "isim", "sehir", "eposta", "fiyat", "toplam",
  "urun", "musteri", "firma", "sirket", "departman", "birim", "aciklama", "baslik", "kod", "saat", "gun",
  // İngilizce
  "name", "email", "mail", "phone", "address", "city", "country", "date", "status", "total", "amount", "price",
  "company", "category", "description", "title", "type", "code", "note", "quantity", "customer", "client", "file",
  "case", "court", "debtor", "creditor", "number", "department", "owner", "due",
];

export function hasHeaderWord(text) {
  const words = fold(text).split(" ").filter(Boolean);
  return words.some(word => SHORT_WORDS.has(word) || LONG_WORDS.some(stem => stem.length > 3 && word.startsWith(stem)));
}

const looksLikeData = text => CASE_KEY.test(text) || DATE.test(text) || ISO_DATE.test(text) || NUMBERISH.test(text) || text.length > MAX_LABEL || /[\r\n]/.test(text);

// Satır özeti. Kelime sayımı ve katlanmış metinler pahalı olduğundan yalnızca gerektiğinde (veri hücresi
// içermeyen, yani başlık adayı satırlarda) ve bir kez hesaplanır; büyük tablolar hızlı kalır.
function analyze(values) {
  const cells = new Array(values.length);
  const filled = [];
  let data = 0;
  for (let index = 0; index < values.length; index += 1) {
    const text = String(values[index] ?? "").trim();
    cells[index] = text;
    if (!text) continue;
    filled.push(index);
    if (looksLikeData(text)) data += 1;
  }
  return { cells, filled, count: filled.length, data, keywordCount: null, foldedCells: null };
}

const keywordsOf = row => {
  if (row.keywordCount === null) row.keywordCount = row.filled.filter(index => !looksLikeData(row.cells[index]) && hasHeaderWord(row.cells[index])).length;
  return row.keywordCount;
};

const foldedOf = (row, index) => {
  row.foldedCells ??= new Map();
  if (!row.foldedCells.has(index)) row.foldedCells.set(index, fold(row.cells[index]));
  return row.foldedCells.get(index);
};

const textOf = row => row.cells[row.filled[0]].replace(/\s+/g, " ").trim();

// Kolon başlığı olma puanı (yalnızca metin hücreli satırlar). Bağlamla birlikte değerlendirilir.
function headerScore(row, next, afterTitle) {
  if (!row || row.count < 2 || row.data > 0) return 0;
  const texts = row.filled.map(index => foldedOf(row, index));
  let score = Math.min(3, keywordsOf(row));
  if (next && next.data > 0) score += 2; // başlık metin, altındaki satır veri: tür karşıtlığı
  if (afterTitle) score += 1;
  if (row.count >= 3) score += 1;
  if (new Set(texts).size === texts.length && row.filled.every(index => row.cells[index].length <= 40)) score += 1;
  return score;
}

// Aynı kolon başlığının tekrarı mı?
function repeatsHeader(row, header) {
  if (!header || row.count < 2 || row.data > 0) return false;
  const same = row.filled.filter(index => header.cells[index] && foldedOf(header, index) === foldedOf(row, index)).length;
  return same >= 2 && same >= Math.ceil(Math.max(row.count, header.count) * 0.6);
}

function columnNames(header, lines, group = null) {
  // Döngüyle: yayma (...) çok satırlı tablolarda çağrı yığınını taşırır.
  let width = header.cells.length;
  for (const row of lines) width = Math.max(width, row.cells.length);
  const names = [];
  const used = new Map();
  for (let index = 0; index < width; index += 1) {
    let name = (header.cells[index] || "").replace(/\s+/g, " ").trim();
    // Gruplu başlıkta alt başlığı boş kolon üst grubun adını alır ("Ödeme" grubunda tek kolon).
    if (!name && group?.cells[index]) name = group.cells[index].replace(/\s+/g, " ").trim();
    // Başlığı boş ama altında veri olan kolon kaybolmasın.
    if (!name && lines.some(row => row.cells[index])) name = `Kolon ${index + 1}`;
    if (!name) {
      names.push("");
      continue;
    }
    const seen = used.get(name) || 0;
    used.set(name, seen + 1);
    names.push(seen ? `${name} (${seen + 1})` : name);
  }
  return names;
}

// Toplam satırı: ilk dolu hücre "TOPLAM", "Ara toplam", "Genel toplam", "Total"… Kayıt olarak kalır (formüllü toplam
// satırı programda yeniden hesaplanır) ama kimlik, sayım ve takvimde kayıt sayılmaz; grup kipi oranına da katılmaz.
const TOTAL_PREFIXES = ["toplam", "toplamlar", "genel toplam", "ara toplam", "total", "grand total", "sub total", "subtotal", "yekun", "genel yekun"];
const isTotalText = text => {
  const folded = fold(text);
  return text.length <= 40 && TOTAL_PREFIXES.some(prefix => folded === prefix || folded.startsWith(`${prefix} `));
};
const isTotalRow = row => row.count > 0 && isTotalText(row.cells[row.filled[0]]);
// Dipnot: tablonun sonundaki tek hücreli açıklama ("* Kırmızı satırlar…", "Hazırlayan: Selin", "Not: liste güncellenecek").
const FOOTNOTE = /^(\*|not\b|notlar\b|aciklama\b|kaynak\b|hazirlayan\b|guncelleme\b|guncellenme\b|son guncelleme\b|dipnot\b|uyari\b|onemli\b)/;
const isFootnote = (row, firstColumn) => {
  if (row.count !== 1 || looksLikeData(row.cells[row.filled[0]])) return false;
  const text = row.cells[row.filled[0]];
  return row.filled[0] !== firstColumn || FOOTNOTE.test(fold(text)) || /:/.test(text) || text.startsWith("*");
};

/**
 * @param {Array<Array<unknown>>} matrix  Sekmenin satırları (hücre değerleri); boş satırlar atlanır.
 * @param {string} tabTitle               Sekme adı ("" olabilir).
 * @param {{ layout?: boolean }} [options] layout: her kaydın matristeki satır sırası ve kolon adları da döner
 *                                         (formülleri kayıtlara bağlamak için, v2.0.1).
 * @returns {{ rows: Array<Record<string,string>>, tabs: string[], sections: Array<{ title: string, label: string, columns: string[], count: number }>, layout?: Array<{ record: object, line: number, names: string[] }> }}
 */
export function matrixToRecords(matrix, tabTitle = "", options = {}) {
  const tab = String(tabTitle || "").trim();
  const lines = [];
  (Array.isArray(matrix) ? matrix : []).forEach((values, index) => {
    const row = analyze(Array.isArray(values) ? values : []);
    row.index = index;
    if (row.count > 0) lines.push(row);
  });
  if (!lines.length) return { rows: [], tabs: tab ? [tab] : [], sections: [], ...(options.layout ? { layout: [], blocks: [] } : {}) };

  let firstColumn = Infinity;
  for (const row of lines) firstColumn = Math.min(firstColumn, row.filled[0]);
  const headingText = row => {
    if (row.count !== 1 || row.filled[0] !== firstColumn) return false;
    const text = textOf(row);
    return text.length >= 2 && text.length <= MAX_TITLE && !CASE_KEY.test(text) && !DATE.test(text) && !ISO_DATE.test(text) && !NUMBERISH.test(text) && !/[\r\n]/.test(text);
  };
  // Tablonun üstünde, ilk kolonda olmayan tek hücreli not ("Güncelleme: 12.09.2026" sağ köşede): başlık değildir.
  const strayNote = (row, next, after) => row.count === 1 && Boolean(next) && next.count >= 2 && next.data === 0 && headerScore(next, after, true) >= 4;

  const sections = [];
  let current = null;
  const open = (title, header, at = header?.index ?? 0, group = null) => {
    current = { title, header, group, lines: [], at };
    sections.push(current);
  };

  // Gruplu (iki satırlı) başlık: üstte birleştirilmiş grup adları ("Kişi bilgileri", "Ödeme"), altta asıl başlıklar.
  // Alt satır veri içermiyor, üsttekinden belirgin biçimde daha dolu ve daha çok başlık kelimesi taşıyorsa asıl başlık odur.
  // Grup satırı ilk kolonda başlamayan tek bir hücre de olabilir; o zaman uzak not değil grup adıdır.
  const groupedHeader = (top, below, after) =>
    Boolean(top && below) && top.data === 0 && below.data === 0 && below.count >= 2 && top.count * 2 <= below.count + 1 && keywordsOf(below) >= keywordsOf(top) && headerScore(below, after, true) >= 4 && !headingText(top);

  // 1) En üstteki başlık satırları, ardından ilk kolon başlığı (eski davranış: ilk geniş satır başlıktır).
  let index = 0;
  const topTitles = [];
  if (lines.some(row => row.count >= 2)) {
    while (index < lines.length - 1 && (headingText(lines[index]) || (strayNote(lines[index], lines[index + 1], lines[index + 2]) && !groupedHeader(lines[index], lines[index + 1], lines[index + 2])))) {
      if (headingText(lines[index])) topTitles.push(textOf(lines[index]));
      index += 1;
    }
  }
  if (groupedHeader(lines[index], lines[index + 1], lines[index + 2])) {
    open(topTitles.length ? topTitles[topTitles.length - 1] : null, lines[index + 1], lines[index + 1].index, lines[index]);
    index += 2;
  } else {
    open(topTitles.length ? topTitles[topTitles.length - 1] : null, lines[index]);
    index += 1;
  }

  // Grup etiketi kipi: ilk kolonu çoğunlukla veri (sıra no, dosya no, tarih…) olan bir tabloda, o kolonda duran tek
  // hücreli metin satırları ve en az iki tane. Böylece yarım doldurulmuş tek bir kayıt yanlışlıkla bölüm sayılmaz.
  // Toplam satırları ("Ara toplam") bu orana katılmaz.
  const firstColumnValues = lines.slice(index).filter(row => row.count >= 2 && row.cells[firstColumn] && !isTotalRow(row)).map(row => row.cells[firstColumn]);
  const firstColumnIsData = firstColumnValues.length >= 3 && firstColumnValues.filter(looksLikeData).length / firstColumnValues.length >= 0.7;
  const groupCandidates = lines.slice(index).filter((row, offset, rest) => headingText(row) && rest[offset + 1] && !headingText(rest[offset + 1]) && headerScore(rest[offset + 1], rest[offset + 2], true) < 4);
  const groupMode = firstColumnIsData && groupCandidates.length >= 2;

  // 2) Gövde.
  for (; index < lines.length; index += 1) {
    const row = lines[index];
    const next = lines[index + 1];
    if (headingText(row) && next) {
      if (headerScore(next, lines[index + 2], true) >= 4) {
        open(textOf(row), next); // başlık + yeni kolon başlıkları
        index += 1;
        continue;
      }
      if (groupMode && !headingText(next)) {
        open(textOf(row), current.header, row.index); // grup etiketi: kolonlar aynı
        continue;
      }
    }
    if (repeatsHeader(row, current.header)) continue; // tekrarlanan kolon başlığı
    if (row.count >= 3 && headerScore(row, next, false) >= 6 && current.lines.length > 0) {
      open(null, row); // başlıksız ama belirgin biçimde yeni bir tablo
      continue;
    }
    current.lines.push(row);
  }
  // Bölüm sonundaki dipnotlar kayıt değildir (tek kolonlu listelerde her satır tek hücrelidir; onlara dokunulmaz).
  for (const section of sections) {
    if (section.header.count < 2) continue;
    while (section.lines.length && isFootnote(section.lines[section.lines.length - 1], firstColumn)) section.lines.pop();
  }

  // 3) Kayıtlar ve etiketler.
  const filledSections = sections.filter(section => section.lines.length > 0);
  const rows = [];
  const tabs = [];
  const summary = [];
  const layout = options.layout ? [] : null;
  // Kayıt blokları (açılır listeleri kolonlara bağlamak için, v2.0.2): bloğun matris satır aralığı ve kolon adları.
  const blocks = options.layout ? [] : null;
  const usedLabels = new Map();
  // Her bölüm, yan yana tablolara bölünebilir: aralarında tamamen boş kolon(lar) bulunan, kendi başlıkları olan bloklar.
  const parts = [];
  for (const section of filledSections) for (const part of splitSideBySide(section)) parts.push(part);
  const multiple = parts.length > 1;
  parts.forEach((part, position) => {
    const { section, names, lines: partLines } = part;
    let label = tab;
    if (multiple) {
      let name = part.title || section.title || `Bölüm ${position + 1}`;
      const seen = usedLabels.get(name) || 0;
      usedLabels.set(name, seen + 1);
      if (seen) name = `${name} (${seen + 1})`;
      label = tab ? `${tab}${SECTION_SEPARATOR}${name}` : name;
    }
    let count = 0;
    const lineIndexes = [];
    for (const line of partLines) {
      const record = {};
      names.forEach((name, column) => {
        if (name) record[name] = line.cells[column] || "";
      });
      if (!Object.values(record).some(Boolean)) continue;
      if (label) record.__sheet = label;
      rows.push(record);
      layout?.push({ record, line: line.index, names });
      lineIndexes.push(line.index);
      count += 1;
    }
    if (!count) return;
    if (label && !tabs.includes(label)) tabs.push(label);
    summary.push({ title: part.title || section.title || "", label, columns: names.filter(Boolean), count });
    if (blocks) {
      const next = sections[sections.indexOf(section) + 1];
      blocks.push({ label, from: section.at + (section.header && section.header.index === section.at ? 1 : 0), to: next ? next.at - 1 : Infinity, names, lines: lineIndexes });
    }
  });
  return { rows, tabs: tabs.length ? tabs : tab ? [tab] : [], sections: summary, ...(layout ? { layout, blocks } : {}) };
}

// Yan yana tablolar: başlık satırında ve tüm satırlarda boş kalan kolon(lar) tabloları ayırır. Her blokta en az iki
// başlık olmalı ve satır dolulukları farklı olmalı (bir tabloda dolu, diğerinde boş satır var); yoksa tek tablodur
// (içinde boş bir ayraç kolonu bulunan tablo bölünmez). Blok adı ilk başlığıdır ("Öğrenci", "Şoför").
function splitSideBySide(section) {
  const header = section.header;
  const names = columnNames(header, section.lines, section.group);
  const whole = [{ section, names, lines: section.lines, title: "" }];
  let width = header.cells.length;
  for (const row of section.lines) width = Math.max(width, row.cells.length);
  const runs = [];
  let run = null;
  for (let column = 0; column < width; column += 1) {
    const empty = !header.cells[column] && section.lines.every(row => !row.cells[column]);
    if (empty) run = null;
    else if (run) run.to = column;
    else runs.push((run = { from: column, to: column }));
  }
  if (runs.length < 2) return whole;
  const headed = runs.map(item => ({ ...item, headers: header.filled.filter(column => column >= item.from && column <= item.to).length }));
  if (headed.some(item => item.headers < 2)) return whole;
  const filledIn = (row, block) => row.filled.some(column => column >= block.from && column <= block.to);
  const differs = section.lines.some(row => {
    const flags = headed.map(block => filledIn(row, block));
    return flags.some(Boolean) && !flags.every(Boolean);
  });
  if (!differs) return whole;
  return headed.map(block => ({
    section,
    title: header.cells[header.filled.find(column => column >= block.from && column <= block.to)].replace(/\s+/g, " ").trim(),
    names: names.map((name, column) => (column >= block.from && column <= block.to ? name : "")),
    lines: section.lines.filter(row => filledIn(row, block)),
  }));
}
