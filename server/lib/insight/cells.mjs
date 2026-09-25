// Hücre okuma (v1.7.0): bir hücrenin gerçekte ne söylediğini çıkarır. Özet kartları kolonun adına ya da çoğunluğuna
// bakarak değil, kapsamdaki HER hücreyi bu okumayla tek tek sınıflayarak doğrulanır.
//
// Türler:
//   empty  — boş, "-", "—", "?" gibi yer tutucular
//   date   — hücrenin tamamı tek ve takvimde var olan bir tarih ("15.10.2026", "2026-10-15 14:30")
//   amount — hücrenin tamamı tek bir sayı/tutar ("40.000,00 TL", "₺1.500,50", "(250)")
//   phone  — hücrenin tamamı tek bir Türkiye telefon numarası
//   label  — rakam içermeyen kısa ifade ("Derdest", "Tebliğ edildi")
//   text   — rakam içermeyen uzun ifade (açıklama, not)
//   mixed  — rakam içeren ama yukarıdakilerden biri olmayan her şey: tarih + not ("12.03.2025 tebliğ"), birden çok tarih,
//            tutar + not ("1.500 TL + faiz"), birden çok telefon, kod ("İstanbul 5. İcra")…
import { currencyOf, isBlank } from "./columns.mjs";
import { foldText, isTckn, isTrPhone, parseAmount, parseDate } from "./validators.mjs";

export const MAX_CELL = 300;
const PLACEHOLDER = /^[?\-–—_./\\*]+$/;
// Metnin içindeki tarihler (gg.aa.yyyy, g/a/yy, yyyy-aa-gg). Bitişik rakamlar tarih sayılmaz ("1.500.000" tarih değil).
const EMBEDDED_DATE = /(?<!\d)(?:\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2})|\d{4}-\d{1,2}-\d{1,2})(?!\d)/g;
const PHONE_RUN = /\+?\(?\d[\d\s().-]{5,}\d/;

const EMPTY = Object.freeze({ kind: "empty" });

export const isEmptyCell = value => {
  const text = String(value ?? "").trim();
  return isBlank(text) || PLACEHOLDER.test(text);
};

// Metindeki geçerli tarihler (en fazla 6).
export function embeddedDates(text) {
  const dates = [];
  for (const match of String(text).slice(0, MAX_CELL).matchAll(EMBEDDED_DATE)) {
    const date = parseDate(match[0]);
    if (date) dates.push(date);
    if (dates.length >= 6) break;
  }
  return dates;
}

// Tutar gibi okunan ama kimlik/telefon olan değer: ayraçsız 10+ hane (T.C., telefon, hesap no…).
export function looksLikeIdentifier(text) {
  const compact = String(text).replace(/\s+/g, "");
  if (currencyOf(text)) return false;
  return /^\d{10,}$/.test(compact) || isTckn(compact);
}

// Hücredeki telefon numaraları: geçerli olanların sayısı ve telefona benzeyip geçersiz olanların sayısı. Numaralar
// "/", ",", ";", " - ", "ve", "veya" ya da satır sonuyla ayrılmış olabilir; numaranın yanındaki not ("(eşi)") sayılmaz.
const PHONE_SPLIT = /\s*(?:[/,;|\r\n]|\s[-–]\s|\sve\s|\sveya\s)\s*/i;
export function phonesIn(text) {
  let valid = 0;
  let invalid = 0;
  for (const part of String(text).slice(0, MAX_CELL).split(PHONE_SPLIT)) {
    const run = PHONE_RUN.exec(part);
    if (!run) continue;
    if (run[0].replace(/\D+/g, "").length < 7) continue;
    if (isTrPhone(run[0])) valid += 1;
    else invalid += 1;
  }
  return { valid, invalid };
}

export function readCell(value) {
  if (isEmptyCell(value)) return EMPTY;
  const text = String(value).trim();
  const digits = /\d/.test(text);
  if (text.length > MAX_CELL) return { kind: digits ? "mixed" : "text", text, digits };
  if (!digits) {
    const words = text.split(/\s+/).length;
    return { kind: words <= 6 && text.length <= 48 && !/[\r\n]/.test(text) ? "label" : "text", text, digits };
  }
  const date = parseDate(text);
  if (date) return { kind: "date", date, text, digits };
  // Telefon biçimli yazım ("0532 101 11 11", "+90 (212) …") tutar sanılmasın; binlik ayraçlı tutarlar ("2.500.000")
  // telefon sanılmasın.
  if (!/[.,]/.test(text) && (/^[+(0]/.test(text) || /\d\s+\d/.test(text)) && isTrPhone(text)) return { kind: "phone", text, digits };
  const amount = parseAmount(text);
  if (amount !== null) return { kind: "amount", amount, currency: currencyOf(text), identifier: looksLikeIdentifier(text), text, digits };
  return { kind: "mixed", text, digits, dates: embeddedDates(text) };
}

// Kolon başlığındaki para birimi: "TUTAR (TL)", "Bedel USD", "Fiyat (Euro)".
const HEADER_CURRENCY = { tl: "TRY", try: "TRY", usd: "USD", dolar: "USD", eur: "EUR", euro: "EUR", avro: "EUR", gbp: "GBP", sterlin: "GBP" };
export function headerCurrency(header) {
  const text = String(header ?? "");
  const symbol = currencyOf(text.replace(/[()[\]]/g, " "));
  if (symbol) return symbol;
  for (const word of foldText(text).split(" ")) if (HEADER_CURRENCY[word]) return HEADER_CURRENCY[word];
  return null;
}

// "TOPLAM", "Genel toplam" gibi satırlar kayıt değil, toplam satırıdır: tutar toplamına katılmaz.
const TOTAL_LABELS = new Set(["toplam", "toplamlar", "genel toplam", "ara toplam", "toplam tutar", "total", "grand total", "sub total", "subtotal", "yekun", "genel yekun"]);
export function isTotalRow(row, skipColumn) {
  for (const [key, value] of Object.entries(row)) {
    if (key === skipColumn || key.startsWith("__")) continue;
    const text = String(value ?? "");
    if (text.length > 24 || /\d/.test(text)) continue;
    if (TOTAL_LABELS.has(foldText(text))) return true;
  }
  return false;
}

// Örnek değerler: raporda gösterilecek en fazla `limit` farklı değer (kısaltılmış).
export function exampleList(values, limit = 3) {
  const seen = [];
  for (const value of values) {
    const text = String(value).replace(/\s+/g, " ").trim();
    const short = text.length > 40 ? `${text.slice(0, 39)}…` : text;
    if (!seen.includes(short)) seen.push(short);
    if (seen.length >= limit) break;
  }
  return seen;
}
