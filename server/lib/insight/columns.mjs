// Kolon tanıma: her kolonun ne tür veri taşıdığını (kimlik, kişi, tutar, tarih, durum, telefon, T.C. …) başlığından ve
// değerlerinden çıkarır. Belirleyicidir (aynı veri → aynı sonuç) ve internete çıkmaz.
//
// İlke: yanlış bir şey söylemektense hiçbir şey söylememek. Doğrulanabilen türler (T.C., VKN, IBAN) matematiksel
// sağlamayla kesinleşir ("verified"); tutar, tarih, telefon gibi türler değerlerin büyük çoğunluğu gerçekten o biçimdeyse
// kabul edilir. Başlık tek başına bir kolona tür biçmez; yalnızca değerlerin söylediğini güçlendirir veya ayırt eder
// (ör. aynı sayısal kolon "TUTAR" başlığıyla tutar, "ADET" başlığıyla miktardır).
import { dateMeaning, kindOfMeaning } from "./temporal.mjs";
import { foldText, isEmail, isIban, isPlate, isProvince, isTckn, isTrPhone, isUrl, isVkn, parseAmount, parseDate } from "./validators.mjs";

const SAMPLE = 4000;
// "2025/1234", "İstanbul 2025/1234", "2025/1234 E." gibi dosya/esas numaraları. Ek kısmı en az bir harf ister: iki
// ardışık isteğe bağlı boşluk grubu uzun değerlerde üstel geri izlemeye yol açardı.
export const CASE_NO = /^\s*(?:\S+\s+)?(?:19|20)\d{2}\/\d+(?:\s*[a-zçğıöşü.]{1,6})?\s*$/i;
export const isCaseNo = value => String(value ?? "").length <= 64 && CASE_NO.test(String(value ?? ""));
// Satırın kendi alanı (kolon adı "constructor" gibi bir ad olsa bile nesnenin kalıtılan özelliği okunmaz).
export const cell = (row, column) => (row && Object.hasOwn(row, column) ? row[column] : undefined);
// Biçim denetimleri bu uzunluğa kadar yapılır: daha uzun değer kimlik, tarih, tutar, telefon… olamaz; denetimi
// atlamak kötü niyetli ya da bozuk uzun hücrelerin analizi yavaşlatmasını da önler.
const MAX_FORMAT_LENGTH = 300;

// ---------- Başlık sözlüğü ----------
// Tek kelimeler ek almış hâlleriyle de eşleşir (4+ harfliyse): "tarihi" → "tarih", "borçlusu" → "borclu".
// Birden çok kelimeli ifadeler kelime kelime aynı kuralla ve sırasıyla aranır.
const LEXICON = {
  id: ["no", "nr", "numara", "numarasi", "kod", "kodu", "id", "sicil", "ref", "referans", "barkod", "sku", "protokol", "esas", "seri", "kayit no", "takip no", "is emri", "code", "number", "invoice", "order no", "case no", "file no"],
  sequence: ["sira", "sn", "sayac", "s no", "sira no"],
  // Ad kelimeleri ("Adı Soyadı") ile taraf kelimeleri ("Müşteri", "Borçlu") ayrı tutulur: "Ürün adı" kişi değildir.
  name: ["ad", "adi", "soyad", "soyadi", "isim", "ismi", "adsoyad", "ad soyad", "adi soyadi", "name", "full name", "first name", "last name", "surname"],
  party: [
    "muvekkil", "borclu", "alacakli", "hasta", "musteri", "ogrenci", "veli", "kisi", "kiraci", "malik", "surucu", "uye", "aday", "calisan", "personel",
    "davaci", "davali", "sanik", "tedarikci", "bayi", "firma", "sirket", "unvan", "unvani", "kurum", "cari", "alici", "satici", "gonderen", "gonderici",
    "misafir", "katilimci", "sigortali", "danisan", "kursiyer", "sporcu", "abone", "yolcu", "ortak", "bagisci", "mukellef", "sahibi", "karsi taraf",
    "ev sahibi", "mulk sahibi", "sigorta ettiren", "client", "customer", "patient", "student", "tenant", "employee", "supplier", "vendor", "contact", "member", "guest", "debtor", "creditor", "owner", "driver", "landlord",
  ],
  item: ["urun", "hizmet", "proje", "etkinlik", "kurs", "ders", "paket", "model", "marka", "egitim", "tur", "oda", "menu", "kalem", "malzeme", "parca", "ilac", "dosya", "evrak", "belge", "program", "kampanya", "gorev", "sefer", "guzergah"],
  responsible: [
    "sorumlu", "atanan", "temsilci", "avukat", "danisman", "hekim", "doktor", "ogretmen", "uzman", "eksper", "teknisyen", "sofor", "antrenor", "egitmen", "assigned", "owner", "responsible", "lawyer", "doctor", "teacher",
    "usta", "operator", "ilgili personel", "takip eden", "satis temsilcisi", "musteri temsilcisi", "sorumlu personel", "atanan kisi", "ilgili kisi",
  ],
  money: [
    "tutar", "tutari", "bedel", "bedeli", "fiyat", "fiyati", "ucret", "ucreti", "borc", "borcu", "alacak", "alacagi", "bakiye", "avans", "tahsilat",
    "tahsil", "odeme", "odenen", "kalan", "toplam", "kdv", "tl", "try", "usd", "eur", "doviz", "maliyet", "gelir", "gider", "ciro", "prim", "masraf",
    "harc", "faiz", "kira", "aidat", "depozito", "kapora", "maas", "kredi", "limit", "teminat", "hasar", "tazminat", "brut", "tahakkuk", "hakedis", "vergi",
    "amount", "price", "total", "balance", "fee", "cost", "debt", "paid", "payment", "rent", "salary", "invoice total", "outstanding", "remaining",
  ],
  // Toplanması anlamsız fiyat kolonları (birim fiyatların toplamı bir şey ifade etmez).
  price: ["fiyat", "fiyati", "birim", "birim fiyat", "liste fiyati", "satis fiyati", "alis fiyati"],
  quantity: ["adet", "miktar", "stok", "sayi", "sayisi", "puan", "yas", "kg", "gram", "gr", "litre", "lt", "metre", "m2", "metrekare", "km", "kilometre", "kapasite", "koli", "palet", "desi", "seans", "gece", "kisi sayisi", "qty", "quantity", "count", "age", "score"],
  percent: ["oran", "orani", "yuzde", "iskonto", "marj", "percent"],
  date: ["tarih", "tarihi", "date", "zaman", "vade", "vadesi", "termin", "baslangic", "bitis", "dogum", "teslim", "durusma", "randevu", "donem", "giris", "cikis"],
  // Son tarih: yaklaşan ve tarihi geçen kayıtlar anlamlıdır. Güçlü ifadeler "olay" sözcüklerine üstün gelir
  // ("Başvuru son tarihi" bir son tarihtir), zayıflar gelmez ("Kayıt randevu" gibi belirsizlerde olay sayılır).
  deadlineStrong: ["son tarih", "son gun", "son odeme", "son teslim", "son basvuru", "son kullanma", "vade", "vadesi", "termin", "teslim", "dusum", "bitis", "gecerlilik", "yenileme", "odeme sozu", "sozu", "taahhut", "due", "due date", "deadline", "expiry", "expires", "expiration", "valid until", "renewal", "end date"],
  deadline: ["durusma", "randevu", "hatirlatma", "ihale", "sinav", "muayene", "planlanan", "hedef", "odeme tarihi", "appointment", "hearing", "reminder", "exam", "inspection", "scheduled", "target"],
  // Geçmişte olmuş bir olayın tarihi (son tarih değil): "Son işlem tarihi", "Kayıt tarihi".
  event: ["kayit", "basvuru", "olusturma", "siparis", "giris", "acilis", "takip", "islem", "son islem", "son gorusme", "son ziyaret", "son guncelleme", "son giris", "ekleme", "kabul", "satis", "created", "registered", "last contact", "last visit", "updated", "start date"],
  birth: ["dogum"],
  status: ["durum", "durumu", "asama", "asamasi", "statu", "statusu", "sonuc", "sonucu", "status", "state", "stage", "evre", "safha", "onay", "result", "approved"],
  category: [
    "tur", "turu", "tip", "tipi", "kategori", "kategorisi", "grup", "grubu", "sinif", "sinifi", "sube", "subesi", "departman", "bolum", "birim", "kaynak",
    "kanal", "segment", "marka", "model", "cins", "brans", "hizmet", "urun", "proje", "mahkeme", "daire", "ilce", "bolge", "sektor", "cinsiyet", "oncelik", "etiket",
    "type", "category", "group", "class", "branch", "department", "region", "priority", "tag", "gender",
  ],
  phone: ["tel", "telefon", "telefonu", "gsm", "cep", "mobil", "phone", "irtibat", "whatsapp", "faks", "fax"],
  email: ["e posta", "eposta", "email", "e mail", "mail"],
  address: ["adres", "adresi", "address", "mahalle", "cadde", "sokak"],
  note: ["aciklama", "aciklamasi", "not", "notlar", "notu", "yorum", "gorus", "detay", "icerik", "bilgi", "ozet", "sikayet", "talep", "istek", "mesaj", "gerekce", "son durum", "son durumu", "notes", "comment", "comments", "description", "remarks", "details"],
  tckn: ["tc", "t c", "tckn", "tc no", "tc kimlik", "kimlik no", "kimlik"],
  vkn: ["vkn", "vergi no", "vergi numarasi", "vergi kimlik"],
  iban: ["iban", "hesap no"],
  city: ["il", "sehir", "city", "province"],
  plate: ["plaka", "plakasi"],
  url: ["link", "url", "web", "site", "baglanti"],
};

const wordMatches = (word, key) => word === key || (key.length >= 4 && word.startsWith(key));
export function phraseAt(words, phrase) {
  const parts = phrase.split(" ");
  outer: for (let start = 0; start + parts.length <= words.length; start += 1) {
    for (let offset = 0; offset < parts.length; offset += 1) if (!wordMatches(words[start + offset], parts[offset])) continue outer;
    return true;
  }
  return false;
}

export function headerHits(header) {
  const raw = String(header ?? "").trim();
  const words = foldText(raw).split(" ").filter(Boolean);
  const hits = {};
  for (const [role, list] of Object.entries(LEXICON)) {
    if (list.some(phrase => phraseAt(words, phrase))) hits[role] = true;
  }
  if (raw === "#" || /^s\.?\s?no\.?$/i.test(raw)) hits.sequence = true;
  // "Ürün adı", "Proje ismi": bir şeyin adı; kişi değil.
  if (hits.name && hits.item && !hits.party) hits.itemName = true;
  if (hits.party || (hits.name && !hits.itemName)) hits.person = true;
  return hits;
}

// ---------- Değer yardımcıları ----------
const ORG_TOKENS = ["as", "a s", "ltd", "sti", "san", "tic", "holding", "banka", "bankasi", "bank", "belediyesi", "mudurlugu", "vakfi", "dernegi", "kooperatifi", "koop", "inc", "llc", "gmbh", "grup", "group", "sirketi", "limited", "anonim", "universitesi", "hastanesi", "okulu", "bakanligi", "baskanligi"];
export const isOrg = value => {
  const words = foldText(value).split(" ").filter(Boolean);
  if (words.length < 2) return false;
  const tail = words.slice(-4);
  return ORG_TOKENS.some(token => (token.length >= 4 ? phraseAt(words, token) : phraseAt(tail, token)));
};
const ADDRESS_TOKENS = ["mah", "mahallesi", "mh", "cad", "caddesi", "cd", "sok", "sokak", "sokagi", "sk", "bulvari", "blv", "apt", "apartmani", "daire", "kat", "no", "bina", "sitesi", "koyu", "ilcesi"];
const isAddress = value => {
  if (value.length < 15) return false;
  const words = foldText(value).split(" ").filter(Boolean);
  let hits = 0;
  for (const token of ADDRESS_TOKENS) if (words.includes(token)) hits += 1;
  return hits >= 2 || (hits >= 1 && /\d/.test(value) && /\//.test(value));
};
const looksLikeName = value => {
  const parts = value.split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.length <= 5 && value.length <= 60 && /^[\p{L}.'’\s-]+$/u.test(value) && !isOrg(value);
};
// Tek kelimelik ad ("Mehmet", "Ayşe"): büyük harfle başlar, yalnız harf; başlık kişi söylüyorsa yeter.
const looksLikeFirstName = value => value.length >= 2 && value.length <= 24 && /^\p{Lu}[\p{Ll}\p{Lu}'’-]*$/u.test(value);
// Para birimi: ₺/TL/TRY → TRY; $/USD; €/EUR; £/GBP. İşaretsizse null.
export function currencyOf(value) {
  const text = String(value ?? "");
  if (/₺|(?:^|[\s\d])(?:tl|try)(?:$|[\s.])/i.test(text)) return "TRY";
  if (/\$|(?:^|[\s\d])usd(?:$|[\s.])/i.test(text)) return "USD";
  if (/€|(?:^|[\s\d])eur(?:$|[\s.])/i.test(text)) return "EUR";
  if (/£|(?:^|[\s\d])gbp(?:$|[\s.])/i.test(text)) return "GBP";
  return null;
}

// Excel/Sheets hata değerleri (#SAYI/0!, #DIV/0!, #REF!, #N/A…) boş sayılır: kolonun türünü bozmaz, toplama girmez.
const ERROR_VALUES = new Set(["#DIV/0!", "#REF!", "#N/A", "#VALUE!", "#NAME?", "#NUM!", "#NULL!", "#ERROR!", "#SPILL!", "#CALC!", "#SAYI/0!", "#BAŞV!", "#DEĞER!", "#AD?", "#YOK", "#SAYI!", "#BOŞ!", "#HATA!", "#TAŞMA!", "#DÖNGÜ!"]);
export const isErrorValue = value => {
  const text = String(value ?? "");
  return text.charCodeAt(0) === 35 && ERROR_VALUES.has(text.trim().toLocaleUpperCase("tr-TR"));
};
export const isBlank = value => {
  const text = String(value ?? "").trim();
  return !text || text === "-" || text === "—" || (text.charCodeAt(0) === 35 && isErrorValue(text));
};

function sampleValues(rows, column) {
  const values = [];
  let present = 0;
  let nonEmpty = 0;
  for (const row of rows) {
    if (!Object.hasOwn(row, column)) continue;
    present += 1;
    const value = String(row[column] ?? "").trim();
    if (isBlank(value)) continue;
    nonEmpty += 1;
    values.push(value);
  }
  if (values.length <= SAMPLE) return { values, present, nonEmpty };
  const step = values.length / SAMPLE;
  const sampled = new Array(SAMPLE);
  for (let index = 0; index < SAMPLE; index += 1) sampled[index] = values[Math.floor(index * step)];
  return { values: sampled, present, nonEmpty };
}

const rate = (values, test) => {
  if (!values.length) return 0;
  let hits = 0;
  for (const value of values) if (value.length <= MAX_FORMAT_LENGTH && test(value)) hits += 1;
  return hits / values.length;
};

export function topValues(values, limit = 8) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "tr")).slice(0, limit).map(([value, count]) => ({ value, count }));
}

// Sıra numarası: tamsayılar, tekrarsız ve 1..n aralığını büyük ölçüde dolduruyor.
function isSequence(values) {
  const numbers = [];
  for (const value of values) {
    if (!/^\d{1,7}$/.test(value)) return false;
    numbers.push(Number(value));
  }
  if (numbers.length < 3) return false;
  if (new Set(numbers).size < numbers.length * 0.95) return false;
  let min = Infinity;
  let max = -Infinity;
  for (const number of numbers) {
    if (number < min) min = number;
    if (number > max) max = number;
  }
  return min <= 2 && max - min + 1 <= numbers.length * 1.5;
}

const round = value => Math.round(value * 100) / 100;

// ---------- Kolon çözümlemesi ----------
export function analyzeColumn(rows, column, { now = new Date() } = {}) {
  const hits = headerHits(column);
  const { values, present, nonEmpty } = sampleValues(rows, column);
  const distinct = new Set(values).size;
  let totalLength = 0;
  for (const value of values) totalLength += value.length;
  const avgLength = values.length ? totalLength / values.length : 0;
  const stats = { present, nonEmpty, fill: present ? round(nonEmpty / present) : 0, distinct, uniqueness: values.length ? round(distinct / values.length) : 0, avgLength: Math.round(avgLength * 10) / 10 };
  const header = Object.keys(hits);
  const result = (role, confidence, extra = {}) => ({ column, role, confidence: round(Math.min(1, confidence)), verified: false, ...extra, stats, header });
  if (!nonEmpty) return result("empty", 1);
  // Üç ve daha çok değerde oranlar yeter. Küçük tablolarda (1-2 değer) tür ancak tüm değerler kesin uyuyorsa ve
  // başlık o türü söylüyorsa (ya da en az iki değer varsa) verilir: iki satırlık "Plaka / Muayene bitiş" tablosu da
  // tarih ve plaka kolonu tanısın.
  const enough = values.length >= 3;
  const pass = (score, threshold, hinted = false, hintThreshold = threshold) => (enough ? score >= threshold || (hinted && score >= hintThreshold) : score >= 1 && (hinted || values.length >= 2));
  const embeddedDate = value => {
    const found = /(?<!\d)(\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2}))(?!\d)/.exec(value);
    return Boolean(found && parseDate(found[1]));
  };
  const repeated = distinct <= Math.max(12, values.length * 0.05) && values.length / Math.max(distinct, 1) >= 3 && avgLength <= 40;

  // Excel'in sayıya çevirdiği telefon/T.C. (5.32E+09): rakamlar dosyada yitmiştir; rol başlıktan verilir, uyarı yazılır.
  const scientific = rate(values, text => /^\d(?:[.,]\d+)?E\+\d{1,2}$/i.test(text));
  if (scientific >= 0.3 && (hits.phone || hits.tckn)) return result(hits.tckn ? "tckn" : "phone", 0.6, { warning: "scientific", validRate: 0 });

  // 1) Doğrulanabilen türler: matematiksel sağlama.
  const tckn = rate(values, isTckn);
  if (pass(tckn, 0.9, hits.tckn, 0.6)) return result("tckn", tckn, { verified: true, validRate: round(tckn) });
  const iban = rate(values, isIban);
  if (pass(iban, 0.9, hits.iban, 0.6)) return result("iban", iban, { verified: true, validRate: round(iban) });
  if (hits.vkn) {
    const vkn = rate(values, isVkn);
    if (pass(vkn, 0.6, true)) return result("vkn", vkn, { verified: true, validRate: round(vkn) });
  }

  // 2) Biçimi belirgin türler.
  const email = rate(values, isEmail);
  if (pass(email, 0.85, hits.email)) return result("email", email, { validRate: round(email) });
  const url = rate(values, isUrl);
  if (pass(url, 0.85, hits.url)) return result("url", url, { validRate: round(url) });
  const plate = rate(values, isPlate);
  if (pass(plate, 0.85, hits.plate, 0.6)) return result("plate", plate, { validRate: round(plate) });
  const phone = rate(values, isTrPhone);
  if (pass(phone, 0.8, hits.phone, 0.5)) return result("phone", phone + (hits.phone ? 0.1 : 0), { validRate: round(phone) });
  const caseNo = rate(values, isCaseNo);
  if (pass(caseNo, 0.8, hits.id)) return result("id", caseNo, { kind: "case" });
  // Başlık tarih diyorsa "30.09.2026 (uzatıldı)" gibi tarih + not hücreleri de tarih sayılır.
  const dateHint = hits.date || hits.deadlineStrong || hits.deadline;
  const date = rate(values, value => Boolean(parseDate(value)) || (dateHint && embeddedDate(value)));
  if (pass(date, 0.8, dateHint, 0.5)) {
    // İleri tarihli değerlerin oranı (dolu tarihler içinde): anlamı başlıktan çıkmayan kolonlarda karar verir.
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    let dated = 0;
    let future = 0;
    for (const value of values) {
      const parsed = parseDate(value);
      if (!parsed) continue;
      dated += 1;
      if (parsed.getTime() >= today) future += 1;
    }
    const futureRate = dated ? future / dated : 0;
    // Anlam (v2.0.2, temporal.mjs): bitiş / planlı / kayıt / doğum / belirsiz. "kind" eski adıyla sürer: son tarih kartı
    // (deadline) bitiş ve planlı tarihlerden, "Bu ay" (event) kayıt tarihlerinden kurulur.
    const { meaning, reason } = dateMeaning(column, futureRate);
    return result("date", date + (hits.date ? 0.1 : 0), { validRate: round(date), kind: kindOfMeaning(meaning), meaning, meaningReason: reason, strong: meaning === "expiry", futureRate: round(futureRate) });
  }
  const numeric = rate(values, value => parseAmount(value) !== null);
  const percentSigned = rate(values, value => /%/.test(value) && parseAmount(value.replace(/%/g, "")) !== null);
  if (pass(percentSigned, 0.8, false) || (hits.percent && pass(numeric, 0.9, true))) return result("percent", Math.max(percentSigned, 0.8));
  const province = rate(values, isProvince);
  if (pass(province, 0.8, hits.city, 0.6)) return result("city", province, { values: topValues(values, 6) });

  // 3) Sayısal kolonlar: sıra no, tutar, miktar, sayısal kimlik.
  if (pass(numeric, 0.85, hits.money || hits.quantity || hits.percent || hits.id || hits.sequence)) {
    if ((hits.sequence || /^(no|nr)$/.test(foldText(column))) && isSequence(values)) return result("sequence", 0.95);
    const currencies = new Set();
    let marked = 0;
    for (const value of values) {
      const currency = currencyOf(value);
      if (currency) {
        marked += 1;
        currencies.add(currency);
      }
    }
    const currencyRate = marked / values.length;
    if ((hits.money && !hits.quantity && !hits.percent) || currencyRate >= 0.3) {
      return result("money", 0.6 + (hits.money ? 0.25 : 0) + currencyRate * 0.3, {
        kind: hits.price ? "price" : "amount",
        currency: currencies.size === 1 ? [...currencies][0] : currencies.size ? "mixed" : null,
        validRate: round(numeric),
      });
    }
    if (hits.quantity) return result("number", 0.85, { kind: "quantity" });
    if (hits.id && stats.uniqueness >= 0.9) return result("id", 0.8, { kind: "numeric" });
    // Başlığı ve para işareti olmayan ondalıklı sayı tutar sayılmaz: ölçüm, oran veya puan olabilir.
    return result("number", 0.6, { kind: "number" });
  }

  // 4) Metin kolonlar.
  if (hits.address || rate(values, isAddress) >= 0.4) return result("address", hits.address ? 0.85 : 0.7);
  if (hits.status && repeated) return result("status", 0.9, { values: topValues(values) });
  if (hits.note && !hits.person) return result("note", 0.85);
  const org = rate(values, isOrg);
  const names = rate(values, looksLikeName);
  if (hits.responsible && stats.uniqueness <= 0.5 && names + org >= 0.5) return result("responsible", 0.6 + names * 0.4, { values: topValues(values, 6) });
  // "Şoför", "Avukat" başlıklı kolonda her satır ayrı bir ad taşıyorsa (tek kelimelik adlar dahil) kolon o kişilerin
  // listesidir: "Şoför / Telefon" tablosunda şoför kayıt sahibidir.
  const firstNames = rate(values, looksLikeFirstName);
  if (hits.responsible && !hits.id && (names + org >= 0.5 || firstNames >= 0.8)) return result("person", 0.55 + Math.max(names, firstNames) * 0.3, { kind: "responsible" });
  // "HASTA NO", "ÜYE NO": taraf kelimesi geçse de değerler ad değil koddur.
  const code = hits.id && names < 0.3 && org < 0.3 && stats.uniqueness >= 0.9 && avgLength <= 40;
  if (code) return result("id", 0.75, { kind: "code" });
  if ((hits.person && (names + org >= 0.4 || stats.uniqueness >= 0.5)) || (!hits.itemName && !hits.item && names >= 0.8)) {
    return result(org > names ? "org" : "person", 0.5 + Math.max(names, org) * 0.4 + (hits.person ? 0.1 : 0));
  }

  if (hits.id && stats.uniqueness >= 0.9 && avgLength <= 40) return result("id", 0.75, { kind: "code" });
  if (org >= 0.5) return result("org", org);
  if (hits.status) return result("status", 0.7, { values: topValues(values) });
  if (hits.category) return result("category", repeated ? 0.85 : 0.6, { values: topValues(values) });
  if (repeated) return result("category", 0.55, { values: topValues(values) });
  if (hits.note || avgLength > 40) return result("note", hits.note ? 0.85 : 0.7);
  return result("text", 0.5);
}

// Kolonun önemi (0-100): kimlik ve taraf en önde, sıra numarası ve boş kolon en sonda; dolulukla ağırlıklanır.
const IMPORTANCE = { id: 100, person: 90, org: 86, tckn: 84, money: 85, status: 75, phone: 72, plate: 70, date: 68, responsible: 66, vkn: 60, iban: 58, category: 52, city: 50, email: 48, percent: 45, number: 42, address: 40, note: 30, text: 28, url: 20, sequence: 5, empty: 0 };
export function importance(analysis) {
  let base = IMPORTANCE[analysis.role] ?? 20;
  if (analysis.role === "date" && analysis.kind === "deadline") base = 80;
  if (analysis.role === "date" && analysis.kind === "birth") base = 35;
  if (analysis.role === "money" && analysis.kind === "price") base = 60;
  return Math.round(base * (0.35 + 0.65 * analysis.stats.fill));
}

export function analyzeColumns(rows, columns, options = {}) {
  const analyses = columns.map(column => {
    const analysis = analyzeColumn(rows, column, options);
    return { ...analysis, importance: importance(analysis) };
  });
  inferAcrossColumns(rows, analyses);
  for (const item of analyses) {
    item.evidence = explain(item);
    item.certainty = certaintyOf(item);
  }
  return analyses;
}

// ---------- Çapraz kolon çıkarımı ve kanıt (v2.0.2) ----------
// Kolonun ne olduğuna yalnız başlığı değil değerleri ve öteki kolonlarla ilişkisi karar verir; her karar kanıtlarıyla
// (analiz penceresinde "neden?") ve bir kesinlik derecesiyle döner: kesin / olası / belirsiz.
const ROLE_TR = { id: "kimlik", person: "kişi", org: "kurum", money: "tutar", date: "tarih", status: "durum", category: "kategori", phone: "telefon", email: "e-posta", address: "adres", note: "not", tckn: "T.C. kimlik no", vkn: "vergi no", iban: "IBAN", city: "il", plate: "plaka", url: "bağlantı", number: "sayı", percent: "oran", sequence: "sıra no", responsible: "sorumlu", text: "metin", empty: "boş" };
const HIT_TR = { id: "kimlik", person: "kişi", party: "taraf", name: "ad", money: "tutar", price: "fiyat", quantity: "miktar", percent: "oran", date: "tarih", deadlineStrong: "son tarih", deadline: "son tarih", event: "olay tarihi", birth: "doğum", status: "durum", category: "kategori", phone: "telefon", email: "e-posta", address: "adres", note: "not", tckn: "T.C.", vkn: "vergi no", iban: "IBAN", city: "il", plate: "plaka", url: "bağlantı", sequence: "sıra", responsible: "sorumlu", item: "öğe", itemName: "öğe adı" };
const VALIDATED = new Set(["date", "money", "phone", "email", "plate", "tckn", "iban", "vkn", "url", "percent", "number"]);

// İki tarih kolonu: biri hep ötekinden sonra geliyorsa (≥ %95, en az 5 satır) ve başlığı belirsizse, sonraki bitiş /
// son tarih, önceki başlangıç / kayıt tarihidir ("Tarih 1 / Tarih 2" gibi başlıklarda insan da böyle düşünür).
function inferAcrossColumns(rows, analyses) {
  const dates = analyses.filter(item => item.role === "date" && item.stats.nonEmpty >= 5);
  if (dates.length >= 2 && rows.length <= 50_000) {
    const parsed = new Map(dates.map(item => [item.column, rows.map(row => parseDate(row[item.column]))]));
    for (const a of dates) {
      for (const b of dates) {
        if (a === b || (a.meaning !== "other" && b.meaning !== "other")) continue;
        const left = parsed.get(a.column);
        const right = parsed.get(b.column);
        let both = 0;
        let after = 0;
        for (let index = 0; index < rows.length; index += 1) {
          if (!left[index] || !right[index]) continue;
          both += 1;
          if (right[index].getTime() >= left[index].getTime()) after += 1;
        }
        if (both < 5 || after / both < 0.95) continue;
        if (b.meaning === "other" && !b.inferred) {
          Object.assign(b, { meaning: "expiry", kind: "deadline", strong: false, inferred: `değerleri “${a.column}” tarihinden hep sonra: bitiş / son tarih` });
        }
        if (a.meaning === "other" && !a.inferred) {
          Object.assign(a, { meaning: "record", kind: "event", inferred: `değerleri “${b.column}” tarihinden hep önce: başlangıç / kayıt tarihi` });
        }
      }
    }
  }
}

function explain(item) {
  const out = [];
  const hits = (item.header || []).map(key => HIT_TR[key]).filter(Boolean);
  if (hits.length) out.push(`başlık kelimesi: ${[...new Set(hits)].join(", ")}`);
  const rate = item.validRate ?? null;
  if (rate !== null && VALIDATED.has(item.role)) out.push(`değerlerin %${Math.round(rate * 100)}'i geçerli ${ROLE_TR[item.role] || item.role}${item.verified ? " (sağlama tuttu)" : ""}`);
  if (item.role === "date") {
    if (item.futureRate !== undefined) out.push(`%${Math.round(item.futureRate * 100)}'i ileri tarihli`);
    if (item.inferred) out.push(item.inferred);
    else if (item.meaningReason) out.push(item.meaningReason);
  }
  if (item.currency) out.push(`para birimi ${item.currency}`);
  if ((item.role === "id" || item.role === "person" || item.role === "org") && item.stats.uniqueness >= 0.95) out.push("her satırda farklı değer");
  if ((item.role === "status" || item.role === "category") && item.values?.length) out.push(`${item.stats.distinct} farklı değer: ${item.values.slice(0, 4).join(", ")}${item.stats.distinct > 4 ? "…" : ""}`);
  if (item.role === "responsible" && item.values?.length) out.push(`az sayıda kişi tekrar ediyor: ${item.values.slice(0, 3).join(", ")}`);
  if (item.warning === "scientific") out.push("değerler Excel'de sayıya dönüşmüş (bilimsel gösterim)");
  if (item.stats.fill < 0.5 && item.role !== "empty") out.push(`satırların yalnız %${Math.round(item.stats.fill * 100)}'inde dolu`);
  return out;
}

function certaintyOf(item) {
  if (item.role === "empty") return "kesin";
  const rate = item.validRate ?? null;
  if (item.warning) return "belirsiz";
  if ((item.verified && rate >= 0.9) || (VALIDATED.has(item.role) && rate !== null && rate >= 0.95) || item.confidence >= 0.9) return "kesin";
  if (item.confidence >= 0.7 || (rate !== null && rate >= 0.7)) return "olası";
  return "belirsiz";
}

// Görünümün ana kolonları: göstergeler, arama ipucu, kayıt kimliği ve sektör tahmini bunları kullanır.
export function primaryColumns(analyses) {
  const best = (filter, score) => {
    let winner = null;
    let top = -Infinity;
    for (const item of analyses) {
      if (!filter(item)) continue;
      const value = score(item);
      if (value > top) {
        top = value;
        winner = item;
      }
    }
    return winner ? winner.column : null;
  };
  const filled = item => item.stats.nonEmpty;
  return {
    id: best(item => item.role === "id", item => (item.kind === "case" ? 1e9 : 0) + item.stats.uniqueness * 1e6 + filled(item)),
    person: best(item => item.role === "person" || item.role === "org", item => (item.header.includes("party") ? 2e9 : 0) + (item.header.includes("person") ? 1e9 : 0) + item.stats.uniqueness * 1e6 + filled(item)),
    money: best(item => item.role === "money" && item.kind === "amount" && item.currency !== "mixed", item => (item.header.includes("money") ? 1e9 : 0) + filled(item)),
    deadline: best(item => item.role === "date" && item.kind === "deadline", item => (item.strong ? 1e9 : 0) + (item.futureRate || 0) * 1e6 + filled(item)),
    event: best(item => item.role === "date" && item.kind === "event", filled),
    status: best(item => item.role === "status", item => (item.header.includes("status") ? 1e9 : 0) + filled(item)),
    responsible: best(item => item.role === "responsible", filled),
    phone: best(item => item.role === "phone", filled),
    city: best(item => item.role === "city", filled),
    plate: best(item => item.role === "plate", filled),
    tckn: best(item => item.role === "tckn", filled),
  };
}
