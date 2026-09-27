// Hücre metinleri ↔ formül değerleri (v2.0.1).
// Program hücreleri Excel/Sheets'te göründüğü gibi (Türkçe düzende) saklar: "20.000,00 ₺", "05.03.2026", "%15".
// Formül hesaplarken bu metinler sayıya/tarihe çevrilir; sonuç da aynı kolonun görünüşüne göre yeniden yazılır.

export class CellError {
  constructor(code) {
    this.code = code;
  }
  toString() {
    return this.code;
  }
}
export const ERR = {
  div0: new CellError("#DIV/0!"),
  value: new CellError("#VALUE!"),
  ref: new CellError("#REF!"),
  name: new CellError("#NAME?"),
  num: new CellError("#NUM!"),
  na: new CellError("#N/A"),
};
export const isError = value => value instanceof CellError;

// Hücre değeri: görünen metin + çözümlenmiş değer (sayı, metin, mantıksal ya da boş).
export class Cell {
  constructor(text) {
    this.text = String(text ?? "");
    this.value = parseCellText(this.text);
  }
}

const DAY = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 30);
export const serialFromParts = (y, m, d, hh = 0, mm = 0, ss = 0) => (Date.UTC(y, m - 1, d, hh, mm, ss) - EPOCH) / DAY;
export function partsFromSerial(serial) {
  const date = new Date(EPOCH + Math.round(serial * DAY));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), hh: date.getUTCHours(), mm: date.getUTCMinutes(), ss: date.getUTCSeconds(), dow: date.getUTCDay() };
}
export function todaySerial(now = new Date()) {
  return serialFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
export function nowSerial(now = new Date()) {
  return serialFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
}

const DATE_TR = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const PERCENT = /^%\s*(-?[\d.,]+)$|^(-?[\d.,]+)\s*%$/;
const CURRENCY = /(₺|\$|€|£|\btl\b|\btry\b|\busd\b|\beur\b|\bgbp\b)/gi;

// Türkçe/İngilizce sayı metni → sayı; sayı değilse NaN.
export function parseNumberText(raw) {
  let text = String(raw ?? "").trim();
  if (!text) return Number.NaN;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1).trim();
  }
  text = text.replace(CURRENCY, "").replace(/\s+/g, "");
  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith("+")) text = text.slice(1);
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return Number.NaN;
  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  let normalized;
  if (lastDot >= 0 && lastComma >= 0) {
    // İkisi de varsa en sondaki ondalık ayracıdır: 1.234,56 (TR) ya da 1,234.56 (EN).
    normalized = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = /^\d{1,3}(,\d{3}){2,}$/.test(text) ? text.replace(/,/g, "") : (text.match(/,/g) || []).length === 1 ? text.replace(",", ".") : Number.NaN;
  } else if (lastDot >= 0) {
    normalized = /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, "") : (text.match(/\./g) || []).length === 1 ? text : Number.NaN;
  } else normalized = text;
  if (Number.isNaN(normalized)) return Number.NaN;
  const value = Number(normalized);
  return Number.isFinite(value) ? (negative ? -value : value) : Number.NaN;
}

export function parseCellText(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const upper = raw.toLocaleUpperCase("tr-TR");
  if (upper === "DOĞRU" || upper === "TRUE") return true;
  if (upper === "YANLIŞ" || upper === "FALSE") return false;
  if (raw.startsWith("#")) {
    const error = Object.values(ERR).find(item => item.code === upper);
    if (error) return error;
  }
  let match = DATE_TR.exec(raw);
  if (match) {
    const [, d, m, y, hh = 0, mm = 0, ss = 0] = match.map(value => (value === undefined ? undefined : Number(value)));
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return serialFromParts(y, m, d, hh, mm, ss);
  }
  match = DATE_ISO.exec(raw);
  if (match) {
    const [, y, m, d, hh = 0, mm = 0, ss = 0] = match.map(value => (value === undefined ? undefined : Number(value)));
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return serialFromParts(y, m, d, hh, mm, ss);
  }
  match = PERCENT.exec(raw);
  if (match) {
    const number = parseNumberText(match[1] ?? match[2]);
    if (Number.isFinite(number)) return number / 100;
  }
  // "0532 123 45 67" gibi boşluklu, baştaki sıfırı anlamlı değerler metin kalır.
  if (/^0\d/.test(raw.replace(/^[-+(]/, "")) && !/[.,]/.test(raw)) return raw;
  const number = parseNumberText(raw);
  return Number.isFinite(number) ? number : raw;
}

// ---------- Sonucu kolonun görünüşüne göre yazma ----------
const trNumber = (value, decimals, grouping) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping }).format(value);
const pad = value => String(value).padStart(2, "0");

// Örnek metinden biçim: tarih mi, yüzde mi, sayının önündeki/ardındaki metin, ondalık basamak, binlik ayraç.
export function describeFormat(sample) {
  const raw = String(sample ?? "").trim();
  if (!raw) return null;
  const date = DATE_TR.exec(raw);
  if (date) return { kind: "date", time: Boolean(date[4]), seconds: Boolean(date[6]) };
  if (DATE_ISO.test(raw)) return { kind: "date", time: /[ T]\d{2}:/.test(raw), seconds: false };
  const percent = PERCENT.exec(raw);
  if (percent) {
    const body = percent[1] ?? percent[2];
    const decimals = body.includes(",") ? body.length - body.lastIndexOf(",") - 1 : 0;
    return { kind: "percent", before: raw.startsWith("%"), decimals };
  }
  const match = /^(.*?)(-?)(\d[\d.,]*)(.*)$/.exec(raw);
  if (!match) return null;
  const [, prefix, , body, suffix] = match;
  if (!Number.isFinite(parseNumberText(body))) return null;
  if (/\d/.test(prefix) || /\d/.test(suffix)) return null;
  const lastComma = body.lastIndexOf(",");
  const lastDot = body.lastIndexOf(".");
  const trStyle = lastComma > lastDot || (lastComma < 0 && /^\d{1,3}(\.\d{3})+$/.test(body));
  const decimalIndex = trStyle ? lastComma : lastDot >= 0 && !/^\d{1,3}(\.\d{3})+$/.test(body) ? lastDot : -1;
  const decimals = decimalIndex >= 0 ? body.length - decimalIndex - 1 : 0;
  const integerPart = decimalIndex >= 0 ? body.slice(0, decimalIndex) : body;
  // Binlik ayraç örnekte görünüyorsa ya da örnek küçük bir para tutarıysa (500 TL) kullanılır.
  const grouping = /[.,]/.test(integerPart) || (integerPart.length <= 3 && /\S/.test(prefix + suffix));
  return { kind: "number", prefix, suffix, decimals, grouping };
}

export function formatValue(value, sample, { fallbackDecimals = 2 } = {}) {
  if (value === null || value === undefined) return "";
  if (isError(value)) return value.code;
  if (value instanceof Cell) return value.text;
  if (typeof value === "boolean") return value ? "DOĞRU" : "YANLIŞ";
  if (typeof value === "string") return value;
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
  const format = describeFormat(sample);
  if (format?.kind === "date") {
    const parts = partsFromSerial(value);
    const day = `${pad(parts.d)}.${pad(parts.m)}.${parts.y}`;
    return format.time ? `${day} ${pad(parts.hh)}:${pad(parts.mm)}${format.seconds ? `:${pad(parts.ss)}` : ""}` : day;
  }
  if (format?.kind === "percent") {
    const text = trNumber(value * 100, format.decimals, false);
    return format.before ? `%${text}` : `${text}%`;
  }
  if (format?.kind === "number") {
    const rounded = Math.round(value * 10 ** format.decimals) / 10 ** format.decimals;
    // Örnek tam sayıysa ama sonuç küsuratlıysa küsurat kaybolmasın (Excel "Genel" biçimi gibi en çok 2 basamak).
    const decimals = format.decimals === 0 && !Number.isInteger(Math.round(value * 100) / 100) ? 2 : format.decimals;
    const shown = decimals === format.decimals ? rounded : value;
    const body = trNumber(Math.abs(shown), decimals, format.grouping);
    return `${shown < 0 ? "-" : ""}${format.prefix}${body}${format.suffix}`;
  }
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: fallbackDecimals, useGrouping: false }).format(value);
}

// Hesaplanan sayı → Excel'in metin birleştirmede kullandığı hâl (Türkçe ondalık virgül, gereksiz sıfırsız).
export function numberToText(value) {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Number(value.toPrecision(15));
  return String(rounded).replace(".", ",");
}
