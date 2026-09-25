// Kolon tanıma: her kolonun ne tür veri taşıdığını (kimlik, kişi, tutar, tarih, durum, telefon, T.C. …) başlığından ve
// değerlerinden çıkarır. Belirleyicidir (aynı veri → aynı sonuç) ve internete çıkmaz.
//
// İlke: yanlış bir şey söylemektense hiçbir şey söylememek. Doğrulanabilen türler (T.C., VKN, IBAN) matematiksel
// sağlamayla kesinleşir ("verified"); tutar, tarih, telefon gibi türler değerlerin büyük çoğunluğu gerçekten o biçimdeyse
// kabul edilir. Başlık tek başına bir kolona tür biçmez; yalnızca değerlerin söylediğini güçlendirir veya ayırt eder
// (ör. aynı sayısal kolon "TUTAR" başlığıyla tutar, "ADET" başlığıyla miktardır).
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
  id: ["no", "nr", "numara", "numarasi", "kod", "kodu", "id", "sicil", "ref", "referans", "barkod", "sku", "protokol", "esas", "seri", "kayit no", "takip no", "is emri"],
  sequence: ["sira", "sn", "sayac", "s no", "sira no"],
  // Ad kelimeleri ("Adı Soyadı") ile taraf kelimeleri ("Müşteri", "Borçlu") ayrı tutulur: "Ürün adı" kişi değildir.
  name: ["ad", "adi", "soyad", "soyadi", "isim", "ismi", "adsoyad", "ad soyad", "adi soyadi"],
  party: [
    "muvekkil", "borclu", "alacakli", "hasta", "musteri", "ogrenci", "veli", "kisi", "kiraci", "malik", "surucu", "uye", "aday", "calisan", "personel",
    "davaci", "davali", "sanik", "tedarikci", "bayi", "firma", "sirket", "unvan", "unvani", "kurum", "cari", "alici", "satici", "gonderen", "gonderici",
    "misafir", "katilimci", "sigortali", "danisan", "kursiyer", "sporcu", "abone", "yolcu", "ortak", "bagisci", "mukellef", "sahibi", "karsi taraf",
    "ev sahibi", "mulk sahibi", "sigorta ettiren",
  ],
  item: ["urun", "hizmet", "proje", "etkinlik", "kurs", "ders", "paket", "model", "marka", "egitim", "tur", "oda", "menu", "kalem", "malzeme", "parca", "ilac", "dosya", "evrak", "belge", "program", "kampanya", "gorev", "sefer", "guzergah"],
  responsible: [
    "sorumlu", "atanan", "temsilci", "avukat", "danisman", "hekim", "doktor", "ogretmen", "uzman", "eksper", "teknisyen", "sofor", "antrenor", "egitmen",
    "usta", "operator", "ilgili personel", "takip eden", "satis temsilcisi", "musteri temsilcisi", "sorumlu personel", "atanan kisi", "ilgili kisi",
  ],
  money: [
    "tutar", "tutari", "bedel", "bedeli", "fiyat", "fiyati", "ucret", "ucreti", "borc", "borcu", "alacak", "alacagi", "bakiye", "avans", "tahsilat",
    "tahsil", "odeme", "odenen", "kalan", "toplam", "kdv", "tl", "try", "usd", "eur", "doviz", "maliyet", "gelir", "gider", "ciro", "prim", "masraf",
    "harc", "faiz", "kira", "aidat", "depozito", "kapora", "maas", "kredi", "limit", "teminat", "hasar", "tazminat", "brut", "tahakkuk", "hakedis", "vergi",
  ],
  // Toplanması anlamsız fiyat kolonları (birim fiyatların toplamı bir şey ifade etmez).
  price: ["fiyat", "fiyati", "birim", "birim fiyat", "liste fiyati", "satis fiyati", "alis fiyati"],
  quantity: ["adet", "miktar", "stok", "sayi", "sayisi", "puan", "yas", "kg", "gram", "gr", "litre", "lt", "metre", "m2", "metrekare", "km", "kilometre", "kapasite", "koli", "palet", "desi", "seans", "gece", "kisi sayisi"],
  percent: ["oran", "orani", "yuzde", "iskonto", "marj", "percent"],
  date: ["tarih", "tarihi", "date", "zaman", "vade", "vadesi", "termin", "baslangic", "bitis", "dogum", "teslim", "durusma", "randevu", "donem", "giris", "cikis"],
  // Son tarih: yaklaşan ve tarihi geçen kayıtlar anlamlıdır. Güçlü ifadeler "olay" sözcüklerine üstün gelir
  // ("Başvuru son tarihi" bir son tarihtir), zayıflar gelmez ("Kayıt randevu" gibi belirsizlerde olay sayılır).
  deadlineStrong: ["son tarih", "son gun", "son odeme", "son teslim", "son basvuru", "son kullanma", "vade", "vadesi", "termin", "teslim", "dusum", "bitis", "gecerlilik", "yenileme", "odeme sozu", "sozu", "taahhut"],
  deadline: ["durusma", "randevu", "hatirlatma", "ihale", "sinav", "muayene", "planlanan", "hedef", "odeme tarihi"],
  // Geçmişte olmuş bir olayın tarihi (son tarih değil): "Son işlem tarihi", "Kayıt tarihi".
  event: ["kayit", "basvuru", "olusturma", "siparis", "giris", "acilis", "takip", "islem", "son islem", "son gorusme", "son ziyaret", "son guncelleme", "son giris", "ekleme", "kabul", "satis"],
  birth: ["dogum"],
  status: ["durum", "durumu", "asama", "asamasi", "statu", "statusu", "sonuc", "sonucu", "status", "state", "stage", "evre", "safha", "onay"],
  category: [
    "tur", "turu", "tip", "tipi", "kategori", "kategorisi", "grup", "grubu", "sinif", "sinifi", "sube", "subesi", "departman", "bolum", "birim", "kaynak",
    "kanal", "segment", "marka", "model", "cins", "brans", "hizmet", "urun", "proje", "mahkeme", "daire", "ilce", "bolge", "sektor", "cinsiyet", "oncelik", "etiket",
  ],
  phone: ["tel", "telefon", "telefonu", "gsm", "cep", "mobil", "phone", "irtibat", "whatsapp", "faks", "fax"],
  email: ["e posta", "eposta", "email", "e mail", "mail"],
  address: ["adres", "adresi", "address", "mahalle", "cadde", "sokak"],
  note: ["aciklama", "aciklamasi", "not", "notlar", "notu", "yorum", "gorus", "detay", "icerik", "bilgi", "ozet", "sikayet", "talep", "istek", "mesaj", "gerekce", "son durum", "son durumu"],
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
// Para birimi: ₺/TL/TRY → TRY; $/USD; €/EUR; £/GBP. İşaretsizse null.
export function currencyOf(value) {
  const text = String(value ?? "");
  if (/₺|(?:^|[\s\d])(?:tl|try)(?:$|[\s.])/i.test(text)) return "TRY";
  if (/\$|(?:^|[\s\d])usd(?:$|[\s.])/i.test(text)) return "USD";
  if (/€|(?:^|[\s\d])eur(?:$|[\s.])/i.test(text)) return "EUR";
  if (/£|(?:^|[\s\d])gbp(?:$|[\s.])/i.test(text)) return "GBP";
  return null;
}

export const isBlank = value => {
  const text = String(value ?? "").trim();
  return !text || text === "-" || text === "—";
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
  const enough = values.length >= 3;
  const repeated = distinct <= Math.max(12, values.length * 0.05) && values.length / Math.max(distinct, 1) >= 3 && avgLength <= 40;

  // 1) Doğrulanabilen türler: matematiksel sağlama.
  const tckn = rate(values, isTckn);
  if (enough && (tckn >= 0.9 || (hits.tckn && tckn >= 0.6))) return result("tckn", tckn, { verified: true, validRate: round(tckn) });
  const iban = rate(values, isIban);
  if (enough && (iban >= 0.9 || (hits.iban && iban >= 0.6))) return result("iban", iban, { verified: true, validRate: round(iban) });
  if (hits.vkn) {
    const vkn = rate(values, isVkn);
    if (enough && vkn >= 0.6) return result("vkn", vkn, { verified: true, validRate: round(vkn) });
  }

  // 2) Biçimi belirgin türler.
  const email = rate(values, isEmail);
  if (enough && email >= 0.85) return result("email", email, { validRate: round(email) });
  const url = rate(values, isUrl);
  if (enough && url >= 0.85) return result("url", url, { validRate: round(url) });
  const plate = rate(values, isPlate);
  if (enough && (plate >= 0.85 || (hits.plate && plate >= 0.6))) return result("plate", plate, { validRate: round(plate) });
  const phone = rate(values, isTrPhone);
  if (enough && (phone >= 0.8 || (hits.phone && phone >= 0.5))) return result("phone", phone + (hits.phone ? 0.1 : 0), { validRate: round(phone) });
  const caseNo = rate(values, isCaseNo);
  if (enough && caseNo >= 0.8) return result("id", caseNo, { kind: "case" });
  const date = rate(values, value => Boolean(parseDate(value)));
  if (enough && (date >= 0.8 || (hits.date && date >= 0.5))) {
    // Alt tür: son tarih (yaklaşan/tarihi geçen anlamlı), olay tarihi (bu ay eklenen), doğum tarihi, diğer.
    const kind = hits.birth ? "birth" : hits.deadlineStrong ? "deadline" : hits.event ? "event" : hits.deadline ? "deadline" : "other";
    // İleri tarihli değerlerin oranı: aynı türden iki kolon varsa (ör. "Muayene tarihi" ve "Randevu tarihi") önümüzdeki
    // günleri taşıyanı son tarih olarak seçmek için.
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const futureRate = rate(values, value => {
      const parsed = parseDate(value);
      return Boolean(parsed) && parsed.getTime() >= today;
    });
    return result("date", date + (hits.date ? 0.1 : 0), { validRate: round(date), kind, strong: Boolean(hits.deadlineStrong), futureRate: round(futureRate) });
  }
  const numeric = rate(values, value => parseAmount(value) !== null);
  const percentSigned = rate(values, value => /%/.test(value) && parseAmount(value.replace(/%/g, "")) !== null);
  if (enough && (percentSigned >= 0.8 || (hits.percent && numeric >= 0.9))) return result("percent", Math.max(percentSigned, 0.8));
  const province = rate(values, isProvince);
  if (enough && (province >= 0.8 || (hits.city && province >= 0.6))) return result("city", province, { values: topValues(values, 6) });

  // 3) Sayısal kolonlar: sıra no, tutar, miktar, sayısal kimlik.
  if (enough && numeric >= 0.85) {
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
  return columns.map(column => {
    const analysis = analyzeColumn(rows, column, options);
    return { ...analysis, importance: importance(analysis) };
  });
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
