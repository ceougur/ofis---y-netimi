// Kesin para (v2.1.0, banka modülü; docs/BANKA-MODULU-PLAN.md §5.1, K1). Ülke bilmez: vergi, takvim, kur kaynağı burada yok.
//
//   · Tutar en küçük birimde (kuruş/sent) TAMSAYI: `*_minor` kolonları INTEGER (STRICT tabloda kesir reddedilir).
//   · Oran milyonda bir (ppm): %2,5 = 25.000; %100 = 1.000.000.
//   · Kur ×10^6 (`rate_e6`): 34,2500 = 34.250.000.
//   · Çarpma ve bölme BigInt ile; yarım birim sıfırdan uzağa (money.mjs roundMoney ile aynı kural: 1,005 → 1,01; −1,005 → −1,01).
//   · Bölüştürmede artık SON dilime (taksit motorundaki distribute ile aynı).
//   · Metinden tutar kayan noktaya uğramadan okunur (parseMinor); 2'den çok ondalık 400 — sessizce yuvarlanmaz.
//   · Uç başına sınır 1e12 (ana birim); en büyük tutar 1e14 kuruş < 2^53, JS Number'da kesin. Daha büyük toplamlar BigInt ile.
// Mevcut REAL tutar kolonları (payments.amount …) bu projede değişmez; onlardan okunan değer toMinor ile kuruşa çevrilir.
import { HttpError } from "./http.mjs";

/** Para birimlerinin ondalık basamak sayısı (ISO 4217). Yeni para birimi buraya eklenir. */
export const CURRENCY_DIGITS = Object.freeze({ TRY: 2, USD: 2, EUR: 2, GBP: 2 });
/** Bir tutarın üst sınırı (ana birimde, dahil): 1e12 TL. */
export const MAX_MAJOR = 1_000_000_000_000;
export const PPM_SCALE = 1_000_000;
export const RATE_SCALE = 1_000_000;
/** Kur üst sınırı (ana birim): 1.000.000. */
export const MAX_RATE = 1_000_000;

const CURRENCY_NAMES = { TRY: "TL" };
const bad = (code, message, extra = {}) => new HttpError(400, message, { code, ...extra });

/** Para biriminin ondalık basamağı; tanınmayan para biriminde 400 currency-unsupported. */
export function currencyDigits(currency = "TRY") {
  const code = String(currency ?? "").trim().toUpperCase();
  if (!Object.hasOwn(CURRENCY_DIGITS, code)) throw bad("currency-unsupported", `Para birimi desteklenmiyor (${String(currency ?? "").slice(0, 10) || "boş"}). Desteklenenler: ${Object.keys(CURRENCY_DIGITS).join(", ")}.`, { field: "currency" });
  return CURRENCY_DIGITS[code];
}
const normalizeCurrency = currency => {
  currencyDigits(currency);
  return String(currency).trim().toUpperCase();
};
const pow10 = digits => 10n ** BigInt(digits);

// ---------- Metin → ölçekli tamsayı (ortak ayrıştırıcı) ----------
// Kabul edilen biçimler (boşluklar ve ₺/$/€/£/TL/TRY/USD/EUR/GBP eki atılır):
//   "1234" · "1234,56" (virgül ondalık) · "1.234" / "1.234,56" / "12.345.678" (noktalar 3'lü binlik; ilk grup 0 ile başlamaz)
//   · "1234.56" / "12.34" (tek nokta, 3'lü binlik değilse ondalık). Virgül binlik ("1,234.56") kabul edilmez: "1,234" Türkçede
//   1,234'tür ve 3 ondalık olduğu için reddedilir (belirsiz girdi sessizce 1234 sayılmaz).
const UNIT = /^(?:₺|\$|€|£|tl|try|usd|eur|gbp)/i;
const UNIT_END = /(?:₺|\$|€|£|tl|try|usd|eur|gbp)$/i;
const THOUSANDS = /^[1-9]\d{0,2}(?:\.\d{3})+(?:,(\d+))?$/;
/**
 * @returns {{ negative: boolean, intPart: string, frac: string } | null}  null: biçim tanınmadı
 */
function decimalParts(raw, { dotDecimal = false } = {}) {
  let s = String(raw).replace(/[\s\u00a0\u202f]/g, "");
  s = s.replace(UNIT, "").replace(UNIT_END, "");
  let negative = false;
  if (/^[-−+]/.test(s)) {
    negative = s[0] !== "+";
    s = s.slice(1);
    s = s.replace(UNIT, "");
  }
  if (!s) return null;
  let match;
  if (/^\d+$/.test(s)) return { negative, intPart: s, frac: "" };
  if ((match = /^(\d+),(\d+)$/.exec(s))) return { negative, intPart: match[1], frac: match[2] };
  // dotDecimal (kur): virgülsüz tek nokta her zaman ondalıktır ("34.250" = 34,25; binlik sanılmaz).
  if (dotDecimal && (match = /^(\d+)\.(\d+)$/.exec(s))) return { negative, intPart: match[1], frac: match[2] };
  if ((match = THOUSANDS.exec(s))) return { negative, intPart: s.split(",")[0].replace(/\./g, ""), frac: match[1] || "" };
  if ((match = /^(\d+)\.(\d+)$/.exec(s))) return { negative, intPart: match[1], frac: match[2] };
  return null;
}
// Sayı girdisi: en kısa ondalık gösterim (String) üzerinden; 0.1 + 0.2 = "0.30000000000000004" → 17 ondalık → reddedilir.
// Sayıda nokta her zaman ondalıktır (12.345 sayısı 12,345'tir; Türkçe binlik kuralı yalnız metne uygulanır).
function numberParts(value) {
  const text = Object.is(value, -0) ? "0" : String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  return match ? { negative: match[1] === "-", intPart: match[2], frac: match[3] || "" } : null;
}
/**
 * Metin/sayıyı verilen ondalıkla ölçekli BigInt'e çevirir.
 * @returns {{ ok: true, value: bigint } | { ok: false, reason: "invalid" | "precision" | "range" }}
 */
function scaledOf(value, digits, options = {}) {
  let parts;
  if (typeof value === "bigint") parts = { negative: value < 0n, intPart: (value < 0n ? -value : value).toString(), frac: "" };
  else if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, reason: "invalid" };
    if (/e/i.test(String(value))) return { ok: false, reason: Math.abs(value) >= 1 ? "range" : "precision" };
    parts = numberParts(value);
  } else if (typeof value === "string") parts = decimalParts(value, options);
  else return { ok: false, reason: "invalid" };
  if (!parts) return { ok: false, reason: "invalid" };
  if (parts.frac.length > digits) return { ok: false, reason: "precision" };
  const magnitude = BigInt(parts.intPart) * pow10(digits) + BigInt((parts.frac || "").padEnd(digits, "0") || "0");
  return { ok: true, value: parts.negative ? -magnitude : magnitude };
}

/**
 * Tutar metni ya da sayısı → en küçük birimde güvenli tamsayı (kuruş).
 * @param {string|number|bigint} value  "1.234,56", "1234.56", 1234.56, "₺ 3.000"
 * @param {{ currency?: string, label?: string, allowZero?: boolean, allowNegative?: boolean, max?: number }} options
 *        max: ana birimde üst sınır (varsayılan 1e12, dahil)
 * @returns {number}
 * @throws {HttpError} 400 amount-invalid | amount-precision | amount-range | currency-unsupported
 */
export function parseMinor(value, { currency = "TRY", label = "Tutar", allowZero = false, allowNegative = false, max = MAX_MAJOR } = {}) {
  const digits = currencyDigits(currency);
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) throw bad("amount-invalid", `${label} gerekli.`, { field: label });
  const parsed = scaledOf(value, digits);
  if (!parsed.ok) {
    if (parsed.reason === "precision") throw bad("amount-precision", `${label} en çok ${digits} ondalık basamak olabilir; daha küçük birim yuvarlanmaz (ör. 1,005 yazılamaz, 1,01 ya da 1,00 yazın).`, { field: label });
    if (parsed.reason === "range") throw bad("amount-range", `${label} en çok ${minorText(BigInt(Math.round(max)) * pow10(digits), currency)} olabilir.`, { field: label });
    throw bad("amount-invalid", `${label} geçerli bir tutar değil (${String(value).slice(0, 30)}). Örnek: 1.234,56`, { field: label });
  }
  const minor = parsed.value;
  const limit = BigInt(Math.round(max)) * pow10(digits);
  if (minor === 0n && !allowZero) throw bad("amount-range", `${label} sıfırdan büyük olmalı.`, { field: label });
  if (minor < 0n && !allowNegative) throw bad("amount-range", `${label} eksi olamaz.`, { field: label });
  if ((minor < 0n ? -minor : minor) > limit) throw bad("amount-range", `${label} en çok ${minorText(limit, currency)} olabilir.`, { field: label });
  if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < -BigInt(Number.MAX_SAFE_INTEGER)) throw bad("amount-range", `${label} çok büyük.`, { field: label });
  return minor === 0n ? 0 : Number(minor);
}

// ---------- REAL ↔ kuruş ----------
/**
 * Mevcut REAL kolondan okunan tutar (ana birim) → en küçük birim. money.mjs toCents ile aynı sonuç (yarım birim sıfırdan uzağa,
 * kayan nokta artığı 15 anlamlı basamakta silinir). Sayı olmayan ya da sonlu olmayan değer hata (sessizce 0 olmaz).
 */
export function toMinor(major, currency = "TRY") {
  const digits = currencyDigits(currency);
  if (typeof major !== "number") throw new TypeError(`Tutar sayı olmalı (${typeof major}).`);
  if (!Number.isFinite(major)) throw new RangeError("Tutar sonlu bir sayı olmalı.");
  if (major === 0) return 0;
  const scaled = Math.round(Number((Math.abs(major) * 10 ** digits).toPrecision(15)));
  if (!Number.isSafeInteger(scaled)) throw new RangeError("Tutar güvenli tamsayı sınırını aşıyor.");
  return scaled === 0 ? 0 : Math.sign(major) * scaled;
}
/** En küçük birim → ana birim (API'de mevcut modüllerle aynı TL sayısı). */
export function fromMinor(minor, currency = "TRY") {
  const digits = currencyDigits(currency);
  const value = Number(toBig(minor)) / 10 ** digits;
  return value === 0 ? 0 : value;
}
/** "1.234,56 TL" — kayan noktasız biçim (sunucu iletileri, PDF/Excel metinleri). */
export function minorText(minor, currency = "TRY") {
  const code = normalizeCurrency(currency);
  const digits = CURRENCY_DIGITS[code];
  const big = toBig(minor);
  const negative = big < 0n;
  const abs = (negative ? -big : big).toString().padStart(digits + 1, "0");
  const intPart = abs.slice(0, abs.length - digits).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const frac = digits ? `,${abs.slice(abs.length - digits)}` : "";
  return `${negative ? "-" : ""}${intPart}${frac} ${CURRENCY_NAMES[code] || code}`;
}

// ---------- BigInt aritmetiği ----------
function toBig(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  throw new TypeError(`Tamsayı bekleniyordu (${String(value).slice(0, 30)}).`);
}
const toSafe = big => {
  if (big > BigInt(Number.MAX_SAFE_INTEGER) || big < -BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Sonuç güvenli tamsayı sınırını aşıyor.");
  return big === 0n ? 0 : Number(big);
};
/** n / d, yarım birim sıfırdan uzağa (BigInt). */
export function divRound(numerator, denominator) {
  const n = toBig(numerator);
  const d = toBig(denominator);
  if (d === 0n) throw new RangeError("Sıfıra bölme.");
  const q = n / d;
  const r = n % d;
  if (r === 0n) return q;
  const twice = (r < 0n ? -r : r) * 2n;
  const ad = d < 0n ? -d : d;
  if (twice < ad) return q;
  return (n < 0n) !== (d < 0n) ? q - 1n : q + 1n;
}
/** round(a × b / c) güvenli tamsayı olarak. */
export function mulDiv(a, b, c) {
  return toSafe(divRound(toBig(a) * toBig(b), toBig(c)));
}
/** Tutar × oran (ppm): 10.000 TL × %2,5 → mulPpm(1_000_000, 25_000) = 25_000 kuruş. */
export function mulPpm(minor, ppm) {
  return mulDiv(minor, ppm, PPM_SCALE);
}
/**
 * Tutar × kur (e6), para birimleri arası çeviri: 1.000 USD × 34,25 → mulRate(100_000, 34_250_000) = 3_425_000 (TL kuruş).
 * Hedef ile kaynak birimin ondalığı farklıysa ölçek ayarlanır.
 */
export function mulRate(minor, rateE6, { from = "TRY", to = "TRY" } = {}) {
  const shift = currencyDigits(to) - currencyDigits(from);
  const numerator = toBig(minor) * toBig(rateE6) * (shift > 0 ? pow10(shift) : 1n);
  const denominator = BigInt(RATE_SCALE) * (shift < 0 ? pow10(-shift) : 1n);
  return toSafe(divRound(numerator, denominator));
}
/** Tamsayı tutarları BigInt ile toplar; sonuç güvenli tamsayı değilse RangeError (sessiz taşma yok). */
export function sumMinor(values) {
  let total = 0n;
  for (const value of values) total += toBig(value);
  return toSafe(total);
}
/**
 * Bölüştürme: artık son dilime. parts sayıysa eşit bölme (dilim = toplam / n sıfıra doğru, son dilim = kalan); dizi ise ağırlıklı
 * (dilim_i = toplam × w_i / Σw sıfıra doğru; kalan son ağırlıklı dilime). Dilimlerin toplamı her zaman toplama eşittir.
 */
export function splitMinor(total, parts) {
  const sum = toBig(total);
  if (typeof parts === "number") {
    if (!Number.isSafeInteger(parts) || parts < 1) throw new RangeError("Dilim sayısı pozitif tamsayı olmalı.");
    const n = BigInt(parts);
    const base = sum / n;
    const out = Array.from({ length: parts }, () => toSafe(base));
    out[parts - 1] = toSafe(sum - base * (n - 1n));
    return out;
  }
  if (!Array.isArray(parts) || !parts.length) throw new RangeError("Ağırlık listesi boş olamaz.");
  const weights = parts.map(weight => {
    const big = toBig(weight);
    if (big < 0n) throw new RangeError("Ağırlık eksi olamaz.");
    return big;
  });
  const weightTotal = weights.reduce((a, b) => a + b, 0n);
  if (weightTotal === 0n) throw new RangeError("Ağırlıkların toplamı sıfır olamaz.");
  const out = weights.map(weight => sum * weight / weightTotal);
  let last = weights.length - 1;
  while (weights[last] === 0n) last -= 1;
  const rest = sum - out.reduce((a, b) => a + b, 0n);
  out[last] += rest;
  return out.map(toSafe);
}

// ---------- Oran (ppm) ve kur (e6) ----------
/**
 * Yüzde metni → ppm. "%2,5", "2,5%", "3.5", 20 → 25.000 / 25.000 / 35.000 / 200.000. En çok 4 ondalık (1 ppm = %0,0001); 0–100.
 * @throws {HttpError} 400 ratio-invalid | ratio-precision | ratio-range
 */
export function parsePpm(value, { label = "Oran", max = 100 } = {}) {
  if (value === null || value === undefined) throw bad("ratio-invalid", `${label} gerekli.`, { field: label });
  const text = typeof value === "string" ? value.replace(/[\s%]/g, "") : value;
  if (typeof text === "string" && (!text || !/^[-−+]?\d+(?:[.,]\d+)?$/.test(text))) throw bad("ratio-invalid", `${label} geçerli bir yüzde değil (ör. 2,5).`, { field: label });
  const parsed = scaledOf(typeof text === "string" ? text.replace(".", ",") : text, 4);
  if (!parsed.ok) {
    if (parsed.reason === "precision") throw bad("ratio-precision", `${label} en çok 4 ondalık basamak olabilir.`, { field: label });
    if (parsed.reason === "range") throw bad("ratio-range", `${label} %0 ile %${max} arasında olmalı.`, { field: label });
    throw bad("ratio-invalid", `${label} geçerli bir yüzde değil (ör. 2,5).`, { field: label });
  }
  if (parsed.value < 0n || parsed.value > BigInt(max) * 10_000n) throw bad("ratio-range", `${label} %0 ile %${max} arasında olmalı.`, { field: label });
  return Number(parsed.value);
}
/** ppm → yüzde metni ("2,5"). */
export function ppmText(ppm) {
  const big = toBig(ppm);
  const negative = big < 0n;
  const abs = negative ? -big : big;
  const whole = abs / 10_000n;
  const frac = (abs % 10_000n).toString().padStart(4, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? `,${frac}` : ""}`;
}
/**
 * Kur metni → e6. "34,2500", "34.25", 35.8, "1.234,5" → 34.250.000 / 34.250.000 / 35.800.000 / 1.234.500.000.
 * En çok 6 ondalık; sıfırdan büyük, en çok 1.000.000.
 * @throws {HttpError} 400 rate-invalid | rate-precision | rate-range
 */
export function parseRate(value, { label = "Kur" } = {}) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) throw bad("rate-invalid", `${label} gerekli.`, { field: label });
  const parsed = scaledOf(value, 6, { dotDecimal: true });
  if (!parsed.ok) {
    if (parsed.reason === "precision") throw bad("rate-precision", `${label} en çok 6 ondalık basamak olabilir.`, { field: label });
    if (parsed.reason === "range") throw bad("rate-range", `${label} en çok ${MAX_RATE.toLocaleString("tr-TR")} olabilir.`, { field: label });
    throw bad("rate-invalid", `${label} geçerli bir sayı değil (ör. 34,2500).`, { field: label });
  }
  if (parsed.value <= 0n) throw bad("rate-range", `${label} sıfırdan büyük olmalı.`, { field: label });
  if (parsed.value > BigInt(MAX_RATE) * BigInt(RATE_SCALE)) throw bad("rate-range", `${label} en çok ${MAX_RATE.toLocaleString("tr-TR")} olabilir.`, { field: label });
  return Number(parsed.value);
}
/** e6 → kur metni; en az `digits` ondalık, gerekirse 6'ya kadar (veri kaybı olmaz): 34.250.000 → "34,2500". */
export function rateText(rateE6, { digits = 4 } = {}) {
  const big = toBig(rateE6);
  const negative = big < 0n;
  const abs = negative ? -big : big;
  const whole = (abs / 1_000_000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  let frac = (abs % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  if (frac.length < digits) frac = frac.padEnd(digits, "0");
  return `${negative ? "-" : ""}${whole}${frac ? `,${frac}` : ""}`;
}
