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

// Ay adları (Türkçe ve İngilizce, kısaltmalarıyla): "10 Mart 2027", "10 Mar 27", "Mart 2027" (ayın 1'i), "Sept 2027".
export const MONTH_WORDS = {
  ocak: 1, oca: 1, subat: 2, sub: 2, mart: 3, mar: 3, nisan: 4, nis: 4, mayis: 5, may: 5, haziran: 6, haz: 6, temmuz: 7, tem: 7, agustos: 8, agu: 8,
  eylul: 9, eyl: 9, ekim: 10, eki: 10, kasim: 11, kas: 11, aralik: 12, ara: 12,
  january: 1, jan: 1, february: 2, feb: 2, march: 3, april: 4, apr: 4, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};
const monthWord = word => MONTH_WORDS[foldText(word).replace(/\s+/g, "")] ?? null;

// Tarih: gg.aa.yyyy, g.a.yy, gg/aa/yyyy, yyyy-aa-gg (isteğe bağlı saat), "10 Mart 2027", "Mart 2027". Takvimde
// gerçekten var olmalıdır. Amerikan sırası (aa/gg/yyyy) yalnızca başka türlü okunamayan değerlerde kabul edilir
// ("03/25/2027"); iki türlü okunabilenler ("11/02/2027") gün/ay sayılır.
export function parseDate(value) {
  const text = String(value ?? "").trim();
  let day;
  let month;
  let year;
  let match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(text);
  if (match) {
    [, day, month, year] = match.map(Number);
    if (match[3].length === 2) year += year < 70 ? 2000 : 1900;
    if (month > 12 && day >= 1 && day <= 12) [day, month] = [month, day];
  } else if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2}).*)?$/.exec(text))) {
    [, year, month, day] = match.map(Number);
  } else if ((match = /^(\d{1,2})\s+(\p{L}+)\.?\s+(\d{4}|\d{2})$/u.exec(text))) {
    day = Number(match[1]);
    month = monthWord(match[2]);
    year = Number(match[3]);
    if (match[3].length === 2) year += year < 70 ? 2000 : 1900;
    if (!month) return null;
  } else if ((match = /^(\p{L}+)\.?\s+(\d{4})$/u.exec(text))) {
    month = monthWord(match[1]);
    year = Number(match[2]);
    day = 1;
    if (!month) return null;
  } else return null;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;
  return date;
}

// Tutar/sayı: Türkçe (1.234,56) ve İngilizce (1,234.56) yazımlar, para birimi ve yüzde işaretleri. Sayı değilse null.
export function parseAmount(value) {
  // "1.500,-" kuruşsuz yazımdır (eksi değil).
  let text = String(value ?? "").trim().replace(/(\d)[.,]-{1,2}$/, "$1");
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

// Excel seri tarih sayısı (v2.0.2): 1900 tarih sistemi, 1 = 01.01.1900; 45000 = 15.03.2023. Kolon başlığı tarih
// söylüyor ama hücreler "Genel" biçimde sayı kaldıysa (kullanıcı biçimi bozmuştur) bu sayılar tarihe çevrilir.
export const SERIAL_MIN = 20_000; // 1954
export const SERIAL_MAX = 80_000; // 2119
export function isSerialDate(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{5}$/.test(text)) return false;
  const number = Number(text);
  return number >= SERIAL_MIN && number <= SERIAL_MAX;
}
export function serialToDate(value) {
  if (!isSerialDate(value)) return null;
  const utc = new Date(Date.UTC(1899, 11, 30) + Number(String(value).trim()) * 86_400_000);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}
