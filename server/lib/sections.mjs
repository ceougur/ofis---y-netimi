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

function columnNames(header, lines) {
  // Döngüyle: yayma (...) çok satırlı tablolarda çağrı yığınını taşırır.
  let width = header.cells.length;
  for (const row of lines) width = Math.max(width, row.cells.length);
  const names = [];
  const used = new Map();
  for (let index = 0; index < width; index += 1) {
    let name = (header.cells[index] || "").replace(/\s+/g, " ").trim();
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

/**
 * @param {Array<Array<unknown>>} matrix  Sekmenin satırları (hücre değerleri); boş satırlar atlanır.
 * @param {string} tabTitle               Sekme adı ("" olabilir).
 * @returns {{ rows: Array<Record<string,string>>, tabs: string[], sections: Array<{ title: string, label: string, columns: string[], count: number }> }}
 */
export function matrixToRecords(matrix, tabTitle = "") {
  const tab = String(tabTitle || "").trim();
  const lines = (Array.isArray(matrix) ? matrix : []).map(values => analyze(Array.isArray(values) ? values : [])).filter(row => row.count > 0);
  if (!lines.length) return { rows: [], tabs: tab ? [tab] : [], sections: [] };

  let firstColumn = Infinity;
  for (const row of lines) firstColumn = Math.min(firstColumn, row.filled[0]);
  const headingText = row => {
    if (row.count !== 1 || row.filled[0] !== firstColumn) return false;
    const text = textOf(row);
    return text.length >= 2 && text.length <= MAX_TITLE && !CASE_KEY.test(text) && !DATE.test(text) && !ISO_DATE.test(text) && !NUMBERISH.test(text) && !/[\r\n]/.test(text);
  };

  const sections = [];
  let current = null;
  const open = (title, header) => {
    current = { title, header, lines: [] };
    sections.push(current);
  };

  // 1) En üstteki başlık satırları, ardından ilk kolon başlığı (eski davranış: ilk geniş satır başlıktır).
  let index = 0;
  const topTitles = [];
  if (lines.some(row => row.count >= 2)) {
    while (index < lines.length - 1 && headingText(lines[index])) topTitles.push(textOf(lines[index++]));
  }
  open(topTitles.length ? topTitles[topTitles.length - 1] : null, lines[index]);
  index += 1;

  // Grup etiketi kipi: ilk kolonu çoğunlukla veri (sıra no, dosya no, tarih…) olan bir tabloda, o kolonda duran tek
  // hücreli metin satırları ve en az iki tane. Böylece yarım doldurulmuş tek bir kayıt yanlışlıkla bölüm sayılmaz.
  const firstColumnValues = lines.slice(index).filter(row => row.count >= 2 && row.cells[firstColumn]).map(row => row.cells[firstColumn]);
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
        open(textOf(row), current.header); // grup etiketi: kolonlar aynı
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

  // 3) Kayıtlar ve etiketler.
  const filledSections = sections.filter(section => section.lines.length > 0);
  const multiple = filledSections.length > 1;
  const rows = [];
  const tabs = [];
  const summary = [];
  const usedLabels = new Map();
  filledSections.forEach((section, position) => {
    const names = columnNames(section.header, section.lines);
    let label = tab;
    if (multiple) {
      let name = section.title || `Bölüm ${position + 1}`;
      const seen = usedLabels.get(name) || 0;
      usedLabels.set(name, seen + 1);
      if (seen) name = `${name} (${seen + 1})`;
      label = tab ? `${tab}${SECTION_SEPARATOR}${name}` : name;
    }
    let count = 0;
    for (const line of section.lines) {
      const record = {};
      names.forEach((name, column) => {
        if (name) record[name] = line.cells[column] || "";
      });
      if (!Object.values(record).some(Boolean)) continue;
      if (label) record.__sheet = label;
      rows.push(record);
      count += 1;
    }
    if (!count) return;
    if (label && !tabs.includes(label)) tabs.push(label);
    summary.push({ title: section.title || "", label, columns: names.filter(Boolean), count });
  });
  return { rows, tabs: tabs.length ? tabs : tab ? [tab] : [], sections: summary };
}
