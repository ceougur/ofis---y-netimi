// Tarih kolonunun anlamı (v2.0.2). Tüm modüller (özet kartları, "Bu ay", yaklaşan/geçen işler bildirimleri, kayıt
// listeleri) bir tarih kolonunu bu tek sınıflandırmayla yorumlar:
//
//   expiry   — bitiş / son gün: yaklaşınca ve geçince önemlidir ("Sigorta bitiş", "Ehliyet geçerlilik", "Vize", "Vade").
//   schedule — planlı tarih: yaklaşınca hatırlatılır, geçmişi olmuş bitmiştir ("Randevu", "Duruşma", "Sınav",
//              "Teslim tarihi", "Sonraki kontrol").
//   record   — kayıt / olay tarihi: bir şeyin olduğu gün; uyarı üretmez ("Muayene tarihi" klinikte, "Kayıt", "İşlem",
//              "Fatura tarihi", "Son görüşme").
//   birth    — doğum tarihi.
//   other    — belirsiz: hiçbir uyarı ya da kart üretmez (yanlış alarm vermektense susmak).
//
// Karar iki kanıttan çıkar: başlığın NİTELİĞİ ("bitiş", "sonraki", "yapılan", "son"…) ve KONUSU ("muayene", "sigorta",
// "randevu"…), bir de kolonun değerlerinin bugüne göre dağılımı. Konu sözcüğü tek başına anlamı belirlemez: klinikte
// "Muayene tarihi"nin değerleri geçmiştedir (muayene olduğu gün), araç listesinde "Muayene" kolonunun değerleri
// ilerdedir (sıradaki muayene). Nitelik sözcüğü varsa dağılıma bakılmaz.
import { foldText } from "./validators.mjs";

const phrase = list => new RegExp(`(?:^| )(?:${list.join("|")})(?= |$)`);

// Nitelik: bitiş / son gün. ("son" tek başına değil: "son muayene" son yapılan muayenedir.)
const EXPIRY = phrase([
  "bitis\\w*", "bitim\\w*", "son gun\\w*", "son tarih\\w*", "son kullanma", "son teslim\\w*", "son basvuru", "son odeme", "gecerlilik\\w*",
  "gecerli", "yenileme\\w*", "yenilenme\\w*", "yenilen\\w*", "vize\\w*", "vade\\w*", "termin\\w*", "sona erme\\w*", "sure sonu", "suresi dolan", "dolum\\w*",
  "dolus\\w*", "expir\\w*", "valid until", "due date", "deadline", "odeme sozu", "soz", "sozu", "soz tarihi", "taahhut\\w*", "son gecerlilik",
]);
// Nitelik: ileri tarih ("sonraki muayene", "planlanan teslim", "hatırlatma").
const NEXT = phrase([
  "sonraki", "bir sonraki", "gelecek", "planlanan", "planlanmis", "planli", "hedef\\w*", "beklenen", "tahmini", "hatirlatma\\w*", "hatirlatilacak",
  "takip edilecek", "kontrol edilecek", "next", "planned", "reminder", "follow up",
]);
// Nitelik: olmuş iş ("yapılan muayene", "ödendiği tarih", "son görüşme", "teslim edilen").
const PAST = phrase([
  "yapilan", "yapilis", "gerceklesen", "gerceklesme", "tamamlanan", "tamamlanma", "odenen", "tahsil edilen", "teslim edilen", "teslim alinan",
  "kapanis\\w*", "iade\\w*", "son islem", "son gorusme", "son ziyaret", "son guncelleme", "son giris", "son arama", "son temas", "son iletisim",
  "son odeme yapilan", "son satis", "son alim", "last", "done", "completed",
]);
// Türkçe ekler: "-dığı / -duğu" geçmişi (yapıldığı, ödendiği, bittiği), "-mış" geçmişi (tamamlanmış),
// "-acak / -eceği" ileriyi (yapılacak, yenilenecek, biteceği) anlatır. Sözlükte olmayan başlıklar da böyle anlaşılır.
const PAST_SUFFIX = /(?:^| )\w+(?:dig|dug|tig|tug)(?:i|u)(?= |$)|(?:^| )\w+(?:mis|mus)(?= |$)/;
const FUTURE_SUFFIX = /(?:^| )\w+(?:acak|ecek|acag|eceg)\w*(?= |$)/;
// Konu: planlı olaylar.
const SCHEDULE = phrase([
  "randevu\\w*", "durusma\\w*", "sinav\\w*", "toplanti\\w*", "kesif\\w*", "bilirkisi\\w*", "ihale\\w*", "teslim\\w*", "teslimat\\w*", "sevk\\w*",
  "kontrol\\w*", "ameliyat\\w*", "operasyon\\w*", "seans\\w*", "etkinlik\\w*", "organizasyon\\w*", "rezervasyon\\w*", "ucus\\w*", "sefer\\w*",
  "mulakat\\w*", "ders\\w*", "prova\\w*", "cekim\\w*", "dugun\\w*", "nikah\\w*", "kurulum\\w*", "montaj\\w*", "egitim gunu", "tatbikat\\w*",
  "gorusme gunu", "ziyaret gunu", "check in", "appointment", "hearing", "meeting", "booking",
]);
// Nitelik: başlangıç ("Üyelik başlangıç", "İşe giriş"): her zaman olay tarihidir.
const START = phrase(["baslangic\\w*", "baslama\\w*", "baslayis\\w*", "giris\\w*", "kayit\\w*", "imza\\w*", "acilis\\w*", "acilma", "start\\w*"]);
// Konu: süresi olan belge ve periyodik işlemler. Yalın tarihi belirsizdir: değerlerin açıkça çoğu ilerideyse sıradaki
// (bitiş) tarih, değilse yapıldığı gün ("Muayene tarihi": klinikte muayene olduğu gün, araç listesinde sıradaki muayene).
const DOCUMENT = phrase([
  "muayene\\w*", "sigorta\\w*", "kasko\\w*", "police\\w*", "ehliyet\\w*", "ruhsat\\w*", "src", "psikoteknik", "saglik raporu", "rapor\\w*",
  "sertifika\\w*", "belge\\w*", "lisans\\w*", "akreditasyon\\w*", "kalibrasyon\\w*", "bakim\\w*", "garanti\\w*", "izin\\w*", "pasaport\\w*",
  "kimlik\\w*", "takograf\\w*", "egzoz\\w*", "asi\\w*", "tahlil\\w*", "denetim\\w*", "yangin tupu", "vergi levhasi", "faaliyet belgesi",
]);
const DOCUMENT_FUTURE_SHARE = 0.6;
// Konu: süreli hizmet ve sözleşmeler. Yalın tarihi başlangıç günüdür; bitiş ancak nitelikle ("Üyelik bitiş").
const SERVICE = phrase(["uyelik\\w*", "abonelik\\w*", "sozlesme\\w*", "kira\\w*", "vekalet\\w*", "hizmet\\w*", "kayit\\w*"]);
// Konu: kayıt / olay tarihleri.
const RECORD = phrase([
  "kayit\\w*", "basvuru\\w*", "olusturma", "olusturulma", "siparis\\w*", "giris\\w*", "cikis\\w*", "acilis\\w*", "takip\\w*", "islem\\w*",
  "guncelleme", "ekleme", "kabul\\w*", "satis\\w*", "fatura\\w*", "alis\\w*", "baslangic\\w*", "baslama\\w*", "imza\\w*", "teblig\\w*",
  "tebligat\\w*", "karar\\w*", "yatis\\w*", "taburcu\\w*", "tanilama", "tani tarihi", "dava tarihi", "acilma", "odeme tarihi", "tahsilat tarihi",
  "evrak tarihi", "tutanak\\w*", "haciz\\w*", "kaza\\w*", "olay\\w*", "ariza\\w*", "hasar\\w*", "sikayet\\w*", "vefat\\w*", "olum\\w*",
  "tespit\\w*", "ihlal\\w*", "gelis\\w*", "varis\\w*", "hareket\\w*", "odeme", "tahsilat", "masraf\\w*", "gider\\w*", "gelir\\w*",
]);
// Sıra sayısı (v2.0.2): "1.", "2nci", "3üncü", "4'üncü", "birinci", "on ikinci", "yirmi dördüncü"… Bir dizinin (taksit,
// doz, kontrol, seans) parçası olduğunu gösterir.
const ONES = ["", "bir", "iki", "uc", "dort", "bes", "alti", "yedi", "sekiz", "dokuz"];
const ONES_ORDINAL = ["", "birinci", "ikinci", "ucuncu", "dorduncu", "besinci", "altinci", "yedinci", "sekizinci", "dokuzuncu"];
const TENS = ["", "on", "yirmi", "otuz", "kirk", "elli", "altmis"];
const TENS_ORDINAL = ["", "onuncu", "yirminci", "otuzuncu", "kirkinci", "ellinci", "altmisinci"];
const ORDINAL_WORDS = new Map();
for (let tens = 0; tens < TENS.length; tens += 1) {
  for (let ones = 0; ones < ONES.length; ones += 1) {
    const value = tens * 10 + ones;
    if (!value) continue;
    const word = ones ? `${TENS[tens]} ${ONES_ORDINAL[ones]}`.trim() : TENS_ORDINAL[tens];
    ORDINAL_WORDS.set(word, value);
    ORDINAL_WORDS.set(word.replace(" ", ""), value);
  }
}
const ORDINAL_WORD = new RegExp(`(?:^| )(${[...ORDINAL_WORDS.keys()].sort((a, b) => b.length - a.length).join("|")})(?= |$)`);
// Rakamla: "3.", "3'üncü", "3üncü", "3 ncü", "2nci" (ham metinde; nokta sıra sayısıdır: "1. Taksit").
const ORDINAL_DIGITS = /(?:^|[^\d.,])(\d{1,2})\s*(?:\.(?!\d)|'?\s*(?:inci|ıncı|nci|ncı|uncu|üncü|ncu|ncü|ci|cı|cu|cü)(?![a-zçğıöşü]))/i;
/** Başlıktaki sıra sayısı (1–69) ya da null. */
export function ordinalOf(column) {
  const raw = String(column ?? "").toLocaleLowerCase("tr-TR");
  const digits = ORDINAL_DIGITS.exec(raw);
  if (digits) return Number(digits[1]);
  const word = ORDINAL_WORD.exec(foldText(column));
  return word ? ORDINAL_WORDS.get(word[1]) ?? null : null;
}
// Dönem: "Yıllık bakım", "Aylık kontrol", "Periyodik muayene" — tekrarlayan bir işin sıradaki tarihi.
const PERIODIC = phrase(["aylik", "yillik", "haftalik", "gunluk", "periyodik", "donemsel", "\\d+ aylik", "\\d+ yillik"]);

const BIRTH = phrase(["dogum\\w*", "birth\\w*"]);

/**
 * @param {string} column  kolonun başlığı
 * @param {number} futureRate  dolu tarih değerlerinden bugün ya da sonrasına düşenlerin oranı (0–1)
 * @returns {{ meaning: "expiry"|"schedule"|"record"|"birth"|"other", reason: string }}
 */
export function dateMeaning(column, futureRate = 0) {
  const text = foldText(column);
  if (BIRTH.test(text)) return { meaning: "birth", reason: "başlık doğum tarihi" };
  const next = NEXT.test(text);
  // Olmuş iş: sözlük ya da geçmiş eki ("yapıldığı", "tamamlanmış"). Tek bir işlemin tarihi hiçbir zaman uyarı değildir.
  if (PAST.test(text) || (!next && PAST_SUFFIX.test(text))) return { meaning: "record", reason: "başlık olmuş bir işi anlatıyor" };
  if (EXPIRY.test(text)) return { meaning: "expiry", reason: "başlık bitiş / son gün bildiriyor" };
  const document = DOCUMENT.test(text);
  if (next || FUTURE_SUFFIX.test(text)) {
    return document ? { meaning: "expiry", reason: "başlık sıradaki belge / işlem tarihini bildiriyor" } : { meaning: "schedule", reason: "başlık ileri bir tarih bildiriyor" };
  }
  if (SCHEDULE.test(text)) return { meaning: "schedule", reason: "başlık planlı bir tarih bildiriyor" };
  if (START.test(text)) return { meaning: "record", reason: "başlık bir başlangıç / kayıt tarihi" };
  // Belge konusu, niteliksiz: değerlerin açıkça çoğu ilerideyse sıradaki tarih, değilse yapıldığı gün. Dizi ("2. doz aşı",
  // "3. kontrol") ya da dönem ("Yıllık bakım") bildiren başlıkta daha az ileri tarih yeter.
  if (document) {
    const series = ordinalOf(column) !== null || PERIODIC.test(text);
    return futureRate >= (series ? 0.3 : DOCUMENT_FUTURE_SHARE)
      ? { meaning: "expiry", reason: `değerlerin %${Math.round(futureRate * 100)}'i bugün ya da sonrası: sıradaki tarih` }
      : { meaning: "record", reason: "değerler sıradaki tarihi göstermiyor: yapıldığı gün" };
  }
  if (SERVICE.test(text) || RECORD.test(text)) return { meaning: "record", reason: "başlık bir kayıt / olay tarihi" };
  // Başlık ileriye dönük bir anlam taşımıyor ("Tarih", "Mülakat tarihi"): uyarı yok. Değerlerin çoğu geçmişteyse olay
  // tarihi sayılır ("Bu ay" kartı için); anlamı veriden uydurulmaz.
  if (futureRate <= 0.2) return { meaning: "record", reason: "başlık anlam bildirmiyor; değerlerin çoğu geçmişte: olay tarihi" };
  return { meaning: "other", reason: "başlık tarihin ileriye dönük olduğunu bildirmiyor" };
}

// Başlığın konusu (v2.0.2): aynı satırda aynı işi anlatan kolonları bağlamak için ("Sigorta Bitiş", "Sigorta yenilendi mi",
// "Yapılan sigorta"). Belge ya da planlı olay sözcüğünün ilk beş harfi; konu yoksa null.
const SUBJECT = new RegExp(`${DOCUMENT.source}|${SCHEDULE.source}`);
export function subjectOf(column) {
  const match = SUBJECT.exec(foldText(column));
  return match ? match[0].trim().slice(0, 5) : null;
}

// Anlam → eski "kind" alanı (kartlar ve listeler bununla çalışır): son tarih kartı bitiş ve planlı tarihlerden,
// "Bu ay" kartı olay tarihlerinden kurulur.
export const kindOfMeaning = meaning => (meaning === "expiry" || meaning === "schedule" ? "deadline" : meaning === "record" ? "event" : meaning === "birth" ? "birth" : "other");
