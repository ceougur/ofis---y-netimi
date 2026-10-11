// Rapor metinleri için Türkçe biçim yardımcıları.
const numberFormat = new Intl.NumberFormat("tr-TR");
const decimalFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
export const trNumber = value => numberFormat.format(value);

// Sayının okunuşunun son kelimesine göre iyelik eki: %17'si (on yedi), %20'si (yirmi), %40'ı (kırk), %99,5'i (beş).
const UNITS = ["ı", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"]; // sıfır, bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz
const TENS = [null, "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"]; // on, yirmi, otuz, kırk, elli, altmış, yetmiş, seksen, doksan
function possessive(text) {
  const digits = text.replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits)) return "ı";
  const last = Number(digits.at(-1));
  if (last) return UNITS[last];
  const tens = Number(digits.at(-2) || 0);
  if (tens) return TENS[tens];
  const hundreds = Number(digits.at(-3) || 0);
  if (hundreds) return "ü"; // yüz
  return "i"; // bin, milyon (on/yüz binler de "bin" diye biter)
}
export const withPossessive = text => `${text}'${possessive(String(text))}`;

// "%99,5'i" — pay/payda oranı, bir ondalık basamağa aşağı yuvarlanır (%99,96 → %99,9: kesin okunmayan varken %100 yazılmaz).
export function percentOf(part, whole) {
  const value = whole ? Math.floor((part / whole) * 1000) / 10 : 100;
  return `%${withPossessive(decimalFormat.format(value))}`;
}
