// Doğrulanabilir veri türleri: matematiksel sağlaması veya resmi listesi olan değerler. Bunlar tahmin değil ispattır;
// kolon tanıma bu doğrulamaları "kesin" kanıt olarak kullanır.

const digitsOf = value => String(value ?? "").replace(/\D+/g, "");

// T.C. Kimlik No: 11 hane, ilk hane 0 değil; 10. hane = ((tek hanelerin toplamı × 7) − çift hanelerin toplamı) mod 10;
// 11. hane = ilk 10 hanenin toplamı mod 10.
export function isTckn(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{11}$/.test(text) || text[0] === "0") return false;
  const d = [...text].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = d.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
  return d[9] === tenth && d[10] === eleventh;
}

// Vergi Kimlik No (tüzel kişi, 10 hane): Gelir İdaresi algoritması.
export function isVkn(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{10}$/.test(text)) return false;
  const d = [...text].map(Number);
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    const tmp = (d[index] + (9 - index)) % 10;
    let part = (tmp * 2 ** (9 - index)) % 9;
    if (tmp !== 0 && part === 0) part = 9;
    sum += part;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

// IBAN: ülke kodu + 2 kontrol hanesi; ISO 13616 mod 97 = 1. Türkiye IBAN'ı 26 karakterdir.
export function isIban(value) {
  const text = String(value ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(text)) return false;
  if (text.startsWith("TR") && text.length !== 26) return false;
  const moved = `${text.slice(4)}${text.slice(0, 4)}`.replace(/[A-Z]/g, char => String(char.charCodeAt(0) - 55));
  let remainder = 0;
  for (let index = 0; index < moved.length; index += 7) remainder = Number(`${remainder}${moved.slice(index, index + 7)}`) % 97;
  return remainder === 1;
}

// Türkiye telefon numarası (sabit veya cep): +90 / 0 önekli ya da öneksiz 10 hane, alan kodu 2-5 ile başlar.
export function isTrPhone(value) {
  const text = String(value ?? "").trim();
  if (!text || /[a-zçğıöşü]{3,}/i.test(text)) return false;
  let digits = digitsOf(text);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits.length === 10 && /^[2-5]/.test(digits);
}

export const isEmail = value => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(value ?? "").trim());
// Doğrusal denetim (düzenli ifadedeki iç içe tekrarlar uzun değerlerde sunucuyu kilitleyebilirdi): önek, boşluksuz
// devam ve baştan/sondan olmayan en az bir nokta.
export function isUrl(value) {
  const text = String(value ?? "").trim();
  if (text.length > 2048) return false;
  const prefix = /^(?:https?:\/\/|www\.)/i.exec(text);
  if (!prefix) return false;
  const rest = text.slice(prefix[0].length);
  if (!rest || /\s/.test(rest)) return false;
  const dot = rest.indexOf(".", 1);
  return dot > 0 && dot < rest.length - 1;
}

// Türkiye araç plakası: 01-81 il kodu + 1-3 harf + 2-4 rakam (boşluklu veya bitişik).
export function isPlate(value) {
  const match = /^(\d{2})\s*([A-ZÇĞİÖŞÜ]{1,3})\s*(\d{2,4})$/i.exec(String(value ?? "").trim());
  return Boolean(match) && Number(match[1]) >= 1 && Number(match[1]) <= 81;
}

// Tarih: gg.aa.yyyy, g.a.yy, gg/aa/yyyy, yyyy-aa-gg (isteğe bağlı saat). Takvimde gerçekten var olmalıdır.
export function parseDate(value) {
  const text = String(value ?? "").trim();
  let day;
  let month;
  let year;
  let match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(text);
  if (match) {
    [, day, month, year] = match.map(Number);
    if (match[3].length === 2) year += year < 70 ? 2000 : 1900;
  } else {
    match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2}).*)?$/.exec(text);
    if (!match) return null;
    [, year, month, day] = match.map(Number);
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;
  return date;
}

// Tutar/sayı: Türkçe (1.234,56) ve İngilizce (1,234.56) yazımlar, para birimi ve yüzde işaretleri. Sayı değilse null.
export function parseAmount(value) {
  let text = String(value ?? "").trim();
  if (!text || text.length > 40) return null;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text) || /-$/.test(text);
  text = text.replace(/[()]/g, "").replace(/\s+/g, "").replace(/^-|-$/g, "");
  text = text.replace(/^(₺|TL|TRY|\$|USD|€|EUR|£|GBP)/i, "").replace(/(₺|TL|TRY|\$|USD|€|EUR|£|GBP|%)$/i, "");
  if (!/^\d[\d.,]*$/.test(text)) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized;
  if (lastComma > lastDot) normalized = text.replace(/\./g, "").replace(",", "."); // 1.234,56
  else if (lastDot > lastComma) {
    const decimals = text.length - lastDot - 1;
    // "1.234" tek noktalı ve 3 haneyse binlik ayraçtır (Türkçe yazım), "12.5" ondalıktır.
    normalized = lastComma < 0 && decimals === 3 && (text.match(/\./g) || []).length >= 1 ? text.replace(/\./g, "") : text.replace(/,/g, "");
  } else normalized = text;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

// Türkiye'nin 81 ili (resmi liste). İlçe listesi çok uzun olduğundan kullanılmaz.
export const PROVINCES = [
  "adana", "adiyaman", "afyonkarahisar", "agri", "amasya", "ankara", "antalya", "artvin", "aydin", "balikesir", "bilecik", "bingol", "bitlis", "bolu",
  "burdur", "bursa", "canakkale", "cankiri", "corum", "denizli", "diyarbakir", "edirne", "elazig", "erzincan", "erzurum", "eskisehir", "gaziantep",
  "giresun", "gumushane", "hakkari", "hatay", "isparta", "mersin", "istanbul", "izmir", "kars", "kastamonu", "kayseri", "kirklareli", "kirsehir",
  "kocaeli", "konya", "kutahya", "malatya", "manisa", "kahramanmaras", "mardin", "mugla", "mus", "nevsehir", "nigde", "ordu", "rize", "sakarya",
  "samsun", "siirt", "sinop", "sivas", "tekirdag", "tokat", "trabzon", "tunceli", "sanliurfa", "usak", "van", "yozgat", "zonguldak", "aksaray",
  "bayburt", "karaman", "kirikkale", "batman", "sirnak", "bartin", "ardahan", "igdir", "yalova", "karabuk", "kilis", "osmaniye", "duzce",
];
const PROVINCE_SET = new Set(PROVINCES);
const FOLD = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
export const foldText = value =>
  String(value ?? "")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[çğıöşüâîû]/g, char => FOLD[char])
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const PROVINCE_ALIASES = { afyon: "afyonkarahisar", maras: "kahramanmaras", kmaras: "kahramanmaras", urfa: "sanliurfa", antep: "gaziantep", icel: "mersin" };
export const isProvince = value => {
  const key = foldText(value).replace(/\s+/g, "");
  return PROVINCE_SET.has(PROVINCE_ALIASES[key] || key);
};
