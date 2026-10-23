// Tablodaki BORÇ — TEK yer (2.4.4 madde 30a, 31d E2/E3, 31f U2 / 31b MM5 / 31f U8).
// Kullananlar: Tahsilat Takvimi / ödeme sözü / zil / Vade Takip / Nakit Akışı / "Önce cari açın" Açılış Bakiyesi (insight/dues.mjs) ve Tablodaki Kişiler
// (reports.mjs). Kurallar:
// 1. Kolon (debtPlan): borç kolonu, tablodaki sırasından bağımsız şu öncelikle seçilir —
//      remaining: başlığı "Kalan" / "Bakiye" olan tutar kolonu;
//      total:     başlığı borç / alacak olan tutar kolonu ("Toplam Borç", "Alacak Tutarı");
//      amount:    ikisi de yoksa, sekmenin TEK tutar kolonu ("Tutar", "Aylık Ücret", "Kira Bedeli", "Ödenecek Tutar" — 2.4.3'teki gibi borç). Yalnız ÖDEME
//                 SÖZÜ tutarı ("Söz Tutarı", "Taahhüt Tutarı") borç değildir: takvimde ve Nakit Akışı Beklenen'de yerini korur, borç toplamına girmez.
//                 (Karar 22.10.2026, kullanıcı adına 5 dk yetkisiyle: taksit / kira / ücret / ödenecek tek sütunu borçtur; müşteri tablosu sessizce boş kalmaz.)
//    Başlığı gün / adet / sayı / ay / yıl / oran / yüzde / % olan kolon tutar değildir ("Kalan Gün" 5 TL borç sayılıyordu — E3).
// 2. Satır (rowDebt): sırayla remaining, total, net (toplam − ödenen), amount hücresinden ilki SAYIYSA o (0 dahil — ödenmiş, sonrakine düşülmez); boş / sayı değilse sonraki (E2).
// 3. Kayıt (debtByRecord): aynı SEKMEDEKİ satırlar ayrı borçtur ve toplanır (T4); aynı anahtar FARKLI sekmelerde de AYRI borç ve ayrı vade kalemidir
//    (2.4.3 gibi; 31e kontrol turu 2 A1 kararı, 23.10.2026 — dönem sekmesi tutan tabloda 2026 kalemleri düşüyordu). Borcu birden çok sekmede olan dosya no
//    görünür not olur (ekran, PDF, Excel ve Tahsilat Takvimi): "ayrı sayıldı; aynı borçsa kopya sekmeyi kaldırın ya da Sekme süzgeciyle bakın".
//    Dosya no'suz satırlar ayrı kalır. Tahsilat (5c) dosya no başına bir kez yazılır — bu kural tahsilat tarafındadır, değişmez.
// 2.4.4 31e T1: Kalan / borç kolonu YOKSA ve tabloda bir ödenen kolonu ("Ödenen", "Tahsil Edilen", "Tahsilat"…) ile bir toplam tutar kolonu ("Tutar",
// "Ödenecek Tutar", "Toplam Borç"…) varsa satırın borcu toplam − ödenen (ödenen boşsa 0; ödenen toplamı aşarsa 0 ve uyarı). Ödenen kolonu borç sayılmaz.
// Kalan kolonu varsa 30a aynen: Kalan; Kalan hücresi boşsa toplam.
// 2.4.4 31e T4: aynı SEKMEDE aynı dosya no'lu birden çok satır (satır başına taksit / kalem) ayrı borçtur, 2.4.3 gibi; farklı sekmeler de ayrı (A1) ve
// görünür not ister (tableNotes — lib/reports.mjs).
import { foldText, parseAmount } from "./validators.mjs";

export const REMAINING_DEBT_HEADER = /\b(kalan|bakiye)\b/;
export const TOTAL_DEBT_HEADER = /\b(borc\w*|alacak\w*)\b/;
// Kalem (beklenen tahsilat) tutarı başlıkları: insight/dues.mjs kalem tutarını bu listeden tanır.
export const EXPECTED_AMOUNT_HEADER = /\b(soz tutari|taahhut tutari|taksit tutari|taksit miktari|aylik taksit|aylik odeme|odenecek|odenecek tutar|kira bedeli|kira|aidat|aylik|aylik ucret|servis ucreti|ucret|ucreti|ayligi)\b/;
// Borç tutarı OLMAYAN sayı kolonları (başlık katlanmış hâlde; "Kalan Gün", "Gecikme Günü", "Taksit Sayısı", "Kalan Ay", "Faiz Oranı", "KDV %"). Tam sözcük:
// "Aylık Taksit", "Yıllık Ücret", "Günlük Ücret" para kolonudur, dışlanmaz.
// Ödeme sözü / taahhüt sözcüğü — TEK tanım (31e tur 11 Z4, tur 12 Z5): söz ailesi TAM SÖZCÜK (söz, sözü; "Sözleşme…" söz değildir), taahhüt ailesi ÖNEK
// (taahhüt, taahhütname, taahhütlü, taahhüdü). insight/dues.mjs söz kalemini, "Ödeme sözü" etiketini ve söz tutarını bununla tanır.
export const PROMISE_HEADER = /\b(soz|sozu|taahhut\w*|taahhud\w*)\b/;
const PROMISE_AMOUNT_WORD = /\b(tutar\w*|miktar\w*)\b/;
/**
 * Ödeme sözü TUTARI sütunu — TEK tanım; Tahsilat Takvimi (dues.mjs) ve borç düzeni (debtPlan → Tablodaki Kişiler, Açılış Bakiyesi, Vade / Nakit) AYNI yardımcıyı
 * kullanır: söz / taahhüt sözcüğü + "tutar" ya da "miktar" sözcüğü ("Söz Tutarı", "Ödeme Sözü Tutarı", "Taahhüt Tutarı", "Taahhütname Tutarı", "Söz Miktarı").
 * Söz tutarı BORÇ DEĞİLDİR (A1 / 31f U2), hiçbir yolda: borç adayı sayılmaz (31e tur 13: aday 22'de borç düzeni tam sözcük "taahhut" kalıbını kullanıyordu —
 * "Taahhütname Tutarı" Takvim'de söz tutarı, Tablodaki Kişiler'de borç). "Taahhütlü Ücret" (tutar / miktar sözcüğü yok) söz tutarı değildir: borç ve dönem tutarı kalır (5b).
 */
export const isPromiseAmountHeader = column => {
  const folded = foldText(column);
  return PROMISE_HEADER.test(folded) && PROMISE_AMOUNT_WORD.test(folded);
};
/**
 * Yalın söz / taahhüt kolonu — söz ailesi başlığı olup ne "tutar" / "miktar" ne dönem sözcüğü ("Ücret", "Kira", "Aidat", "Taksit Tutarı"; EXPECTED_AMOUNT_HEADER)
 * taşıyan kolon ("Ödeme Sözü", "Söz", "Taahhüt" altına tutar yazılmış): PARA KOLONU SAYILMAZ — borç adayı değildir, söz kalemi tutarı da olmaz (31e tur 14;
 * A1 "Ödeme Sözü tutarı borç değil"). Aday 22 bu kolonu yalnız tek tutar / not adaylarından ayırıyordu; f8e9ae4'te borç olabiliyordu ("Ödeme Sözü" 1.500 Kişiler'de).
 * Dönem sözcüğü taşıyan ("Taahhütlü Ücret", "Taahhütlü Kira") normal sınıflanır (5b).
 */
export const isBarePromiseHeader = column => {
  const folded = foldText(column);
  return PROMISE_HEADER.test(folded) && !PROMISE_AMOUNT_WORD.test(folded) && !EXPECTED_AMOUNT_HEADER.test(folded);
};
export const NOT_AMOUNT_HEADER = /\b(gun|gunu|gunler|gunleri|adet|adedi|sayi|sayisi|ay|ayi|yil|yili|oran|orani|yuzde|yuzdesi)\b/;
export const isNotAmountHeader = column => NOT_AMOUNT_HEADER.test(foldText(column)) || String(column ?? "").includes("%");
// Ödenen / tahsil edilen tutar kolonu (borç değil; T1'de toplamdan düşülür). Tarih / gün / no kolonu değil.
export const PAID_AMOUNT_HEADER = /\b(odenen|odenmis|odendi|tahsil edilen|tahsilat|yatan|yatirilan|alinan)\b/;
const isPaidHeader = column => PAID_AMOUNT_HEADER.test(foldText(column)) && !/\b(tarih\w*|gun\w*|no)\b/.test(foldText(column));
// 31e E2: vergi tutarı kolonu (KDV, Vergi, Vergi Tutarı, Stopaj, Tevkifat, ÖTV) borç adayı değildir (ödenen kolonu gibi ayrılır): fatura listesinde "Tutar" + "KDV"
// iki tutar kolonu sayılıp borç seçilemiyor, kişiler Tablodaki Kişiler'den sessizce düşüyordu (2.4.3'te Tutar borçtu).
export const TAX_AMOUNT_HEADER = /\b(kdv|vergi|vergisi|stopaj|stopaji|tevkifat|tevkifati|otv|kkdf|bsmv)\b/;
const isTaxHeader = column => TAX_AMOUNT_HEADER.test(foldText(column)) && !TOTAL_DEBT_HEADER.test(foldText(column)) && !GRAND_TOTAL_HEADER.test(foldText(column));
// KDV dahil toplam ("Genel Toplam", "KDV Dahil Tutar"). Yanında net tutar ("Tutar") da varsa borç hangisi: TEK yer (kullanıcı kararı; A = Genel Toplam, B = Tutar).
export const GRAND_TOTAL_HEADER = /\b(genel toplam|genel toplami|kdv dahil|vergiler dahil|odenecek toplam)\b/;
export const GRAND_TOTAL_WINS = true;
const TIERS = ["remaining", "total", "net", "amount"];
// 31e tur 8 Y1: borç kolonu yalnız tutar kolonudur. Kişi özniteliği başlığı ("Borçlu", "Borçlu Telefon", "Borçlu TC", "Alacaklı Adı"), kimlik / iletişim başlığı
// ("… No", "Telefon", "TC", "IBAN") ve kolon analizinde tutar olamayacak rol (telefon, TCKN, VKN, IBAN, kimlik, tarih, kişi, kuruluş, e-posta, adres, bağlantı)
// hiçbir zaman borç değildir: "Borçlu Telefon" başlığı borç başlığına ("borç…") uyup 10–11 haneli numara tutar sayılıyordu (Kişiler'de 5.321.112.233 TL).
export const PERSON_ATTRIBUTE_HEADER = /\b(borclu\w*|alacakli\w*)\b/;
// "Borçlu Tutarı", "Bakiye Borçlu" (mizan) tutar sözcüğü taşır: tutardır.
const AMOUNT_WORD = /\b(tutar\w*|bakiye\w*|toplam\w*|miktar\w*)\b/;
export const isPersonAttributeHeader = column => {
  const folded = foldText(column);
  return PERSON_ATTRIBUTE_HEADER.test(folded) && !AMOUNT_WORD.test(folded);
};
const IDENTIFIER_HEADER = /\b(no|numara\w*|kod|kodu|tel|telefon\w*|gsm|cep|tc|tckn|vkn|kimlik|iban)\b/;
export const NOT_AMOUNT_ROLES = new Set(["phone", "tckn", "vkn", "iban", "id", "date", "person", "org", "email", "address", "url"]);

/** Tutar kolonu adayları (kolon analizinden; iki yol aynı kümeyi kullanır): tutar rolü, ya da kalem tutarı başlıklı sayı; gün / adet / oran ve yalın söz kolonu değil. */
export const amountCandidates = analyses => (analyses || [])
  .filter(item => item.role === "money" || (item.role === "number" && EXPECTED_AMOUNT_HEADER.test(foldText(item.column))))
  .map(item => item.column)
  .filter(column => column && !isNotAmountHeader(column) && !isPersonAttributeHeader(column) && !isBarePromiseHeader(column));

/**
 * Tutar rolü almamış ama başlığı Kalan / Bakiye / Borç / Alacak olan ve en az bir satırında tutar yazılmış (seyrek) kolon. Tahsilat Takvimi (insight/dues.mjs)
 * ve Tablodaki Kişiler (reports.mjs) AYNI kuralla bulur (31e tur 7 N4: önceden yalnız takvim kullanıyordu; seyrek "Kalan Borç" satırı takvimde 500 TL görünüp
 * Tablodaki Kişiler'den notsuz düşüyordu).
 * 31e tur 8 Y1: kişi özniteliği / kimlik başlığı ve tutar olamayacak rol (NOT_AMOUNT_ROLES; analyses verilirse) seyrek borç kolonu olmaz.
 * @param {string[]} columns sekmenin kolonları
 * @param {object[]} rows sekmenin satırları
 * @param {(row: object, column: string) => unknown} [value] hücre değeri
 * @param {{ analyses?: Array<{ column: string, role: string }> }} [options] sekmenin kolon analizi (rol denetimi)
 */
export const sparseDebtColumn = (columns, rows, value = (row, column) => row?.[column], { analyses = null } = {}) => {
  const roles = new Map((analyses || []).map(item => [item.column, item.role]));
  return (columns || []).find(column => {
    const folded = foldText(column);
    if (isNotAmountHeader(column) || isPersonAttributeHeader(column) || IDENTIFIER_HEADER.test(folded) || NOT_AMOUNT_ROLES.has(roles.get(column))) return false;
    return (REMAINING_DEBT_HEADER.test(folded) || TOTAL_DEBT_HEADER.test(folded)) && (rows || []).some(row => parseAmount(value(row, column)) !== null);
  }) || null;
};

/**
 * Sekmenin borç düzeni.
 * @param {string[]} candidates tutar kolonları, tablodaki sırasıyla (amountCandidates)
 * @param {{ sparse?: string|null }} [options] tutar rolü almamış ama borç başlıklı, seyrek yazılmış kolon (yalnız remaining/total yoksa total sayılır)
 */
export function debtPlan(candidates, { sparse = null } = {}) {
  // Söz tutarı borç adayı değildir (isPromiseAmountHeader): "Tutar" + "Söz Tutarı" sekmesinde "Tutar" sekmenin TEK tutar sütunudur (borç), söz tutarı takvimde kalır.
  const list = (candidates || []).filter(column => column && !isNotAmountHeader(column) && !isPromiseAmountHeader(column));
  const header = column => foldText(column);
  // Kalan: tutar kolonu ya da (31e tur 8 Y3) seyrek yazılmış Kalan / Bakiye kolonu — ikisinde de Kalan hücresi boş satırın borcu ana tutardır.
  const remaining = list.find(column => REMAINING_DEBT_HEADER.test(header(column))) || (sparse && !isNotAmountHeader(sparse) && REMAINING_DEBT_HEADER.test(header(sparse)) ? sparse : null);
  const paid = list.find(column => column !== remaining && isPaidHeader(column)) || null;
  // Ödenen kolonları ve Kalan dışındaki tutarlar: borç başlıklı olan ("Toplam Borç", "Alacak Tutarı") ya da söz tutarı olmayan TEK tutar ("Tutar", "Ödenecek Tutar").
  // 31e tur 7 N4: vergi kolonu (KDV, Vergi Tutarı…) YALNIZ başka bir tutar kolonu varken borç adayından çıkar (Tutar / Genel Toplam yanında KDV borç değildir);
  // sekmenin tek tutar kolonu vergiyse ("Vergiler": Mükellef, Vergi Tutarı, Son Ödeme) o borçtur — 2.4.3 gibi; önceden kişiler Tablodaki Kişiler'den notsuz düşüyordu.
  const amountRest = list.filter(column => column !== remaining && !isPaidHeader(column));
  const nonTax = amountRest.filter(column => !isTaxHeader(column));
  const rest = nonTax.length || remaining ? nonTax : amountRest;
  const headed = rest.find(column => !REMAINING_DEBT_HEADER.test(header(column)) && TOTAL_DEBT_HEADER.test(header(column))) || null;
  const single = rest.length === 1 ? rest[0] : null;
  // 31e E2: iki tutar kolonundan biri KDV dahil toplamsa (Genel Toplam) borç tek kuralla (GRAND_TOTAL_WINS): Genel Toplam ya da öbürü (net Tutar).
  const grandOf = () => {
    if (rest.length !== 2) return null;
    const grand = rest.filter(column => GRAND_TOTAL_HEADER.test(header(column)));
    if (grand.length !== 1) return null;
    const other = rest.find(column => column !== grand[0]);
    return GRAND_TOTAL_WINS ? grand[0] : other;
  };
  const grand = !headed && !single ? grandOf() : null;
  // Kalan var ve Kalan hücresi boşsa satırın ana tutarı (30a "Kalan boşsa Toplam"): borç başlıklı / tek tutar / Genel Toplam. 31e tur 8 Y3: ana tutar
  // belirlenemezse (iki aday: Aidat + Gecikme Faizi, Tutar + Masraf) Kalan'ı boş satır borç sayılmaz ve görünür not alır (grossUnresolved) — bütün raporlarda.
  const gross = headed || single || grand || (!remaining ? sparse : null) || null;
  // Kalan varsa: Kalan; Kalan hücresi boşsa toplam (gross). Kalan yoksa: ödenen varsa toplam − ödenen (net); yoksa borç başlıklı kolon (total) ya da tek tutar (amount).
  const total = remaining ? gross : !paid ? headed || grand || (!headed && !single ? sparse : null) : null;
  const net = !remaining && paid && gross ? gross : null;
  const amount = !remaining && !paid && !total && single ? single : null;
  // Tek sütun bir kalem tutarıysa ("Aylık Ücret", "Kira Bedeli", "Taksit Tutarı", "Ödenecek"): Tablodaki Kişiler'de borçtur (2.4.3 gibi). 31e tur 8 kararı:
  // "Önce cari açın" Açılış Bakiyesi ve takvim kaleminin Kalan Borç'u da raporların satır borcudur (önceden boş geliyordu; amountExpected yalnız bilgi).
  const column = remaining || total || net || amount;
  // 31e E2: borç kolonu seçilemedi (birden çok tutar kolonu, hiçbiri Kalan / borç / Genel Toplam başlıklı değil) — raporda görünür not için aday kolonlar.
  const choices = rest;
  const unresolved = !column && choices.length >= 2 ? choices : null;
  const grossUnresolved = remaining && !gross && choices.length >= 2 ? choices : null;
  // 31e tur 15: sekmede tutar kolonu HİÇ yok (yalnız kişi / telefon / tarih kolonları; seyrek borç kolonu da yok) — isDebtColumnMissing.
  const noAmount = !list.length && !sparse;
  return { remaining, total, net, paid: net ? paid : null, amount, amountExpected: Boolean(amount && EXPECTED_AMOUNT_HEADER.test(header(amount))), column, unresolved, grossUnresolved, noAmount };
}

/**
 * 31e tur 15 (Y1, 23.10.2026: "Borç kolonu yoksa (yalnız kişi / tarih kolonları; söz de yok) … borç YOK (bütün raporlarda 0) ve satır görünür ya da raporda görünür
 * not"): sekmede tutar kolonu yok ve söz / taahhüt kolonu da yok → kişileri borçsuz sayılır, raporlar sekmeyi adlandıran not yazar (tableNotes — lib/reports.mjs).
 * Aday 22: "Takip" (Dosya No, Borçlu, Borçlu Telefon, Son Ödeme) kişileri Tablodaki Kişiler'den notsuz düşüyordu. Söz sekmesi (söz tarihi / söz tutarı; A1) not açmaz.
 * @param {{ noAmount?: boolean }|null} plan debtPlan sonucu
 * @param {string[]} columns sekmenin kolonları
 */
export const isDebtColumnMissing = (plan, columns) => Boolean(plan?.noAmount) && !(columns || []).some(column => PROMISE_HEADER.test(foldText(column)));

/**
 * Bir satırın borcu: sırayla Kalan, Toplam Borç, sekmenin tek tutarı — ilk SAYI hücre (0 dahil); hiçbiri yoksa null.
 * @param {{ remaining: string|null, total: string|null, amount?: string|null }} plan
 * @param {(column: string) => number|null} read hücrenin tutarı (parseAmount)
 * @param {{ expected?: boolean }} [options] expected: false → kalem tutarı olan tek sütun (amountExpected) borç sayılmaz. 31e tur 8'den beri Takvim / Açılış
 *   Bakiyesi de varsayılanı (true) kullanır: kaydın borcu raporların satır borcuyla aynı.
 * @returns {{ amount: number|null, column: string|null, tier: string|null }}
 */
export function rowDebt(plan, read, { expected = true } = {}) {
  for (const tier of TIERS) {
    const column = plan?.[tier];
    if (!column) continue;
    if (tier === "amount" && plan.amountExpected && !expected) continue;
    const value = read(column);
    if (!(typeof value === "number" && Number.isFinite(value))) continue;
    if (tier !== "net") return { amount: value, column, tier };
    // T1: toplam − ödenen (ödenen boşsa 0); ödenen toplamı aşarsa 0 ve uyarı (overpaid).
    const paidValue = plan.paid ? read(plan.paid) : null;
    const left = Math.round((value - (typeof paidValue === "number" && Number.isFinite(paidValue) ? paidValue : 0)) * 100) / 100;
    return { amount: Math.max(0, left), column, tier, ...(left < 0 ? { overpaid: true } : {}) };
  }
  return { amount: null, column: null, tier: null };
}

/**
 * Kayıt (dosya no) başına borç (T4 / A1): aynı SEKMEDEKİ satırlar ayrı borçtur ve toplanır; FARKLI sekmeler de ayrı borçtur (birleştirilmez).
 * byKey: anahtar → sekme → { amount, tier, column } (sekmeler tablo sırasıyla); split: borcu (> 0) birden çok sekmede olan anahtarlar (görünür not için).
 * @param {Array<{ key: string, tab: string, amount: number|null, tier: string|null, column?: string, meta?: object }>} entries satır borçları, tablo sırasıyla
 * @returns {{ byKey: Map<string, Map<string, { tab: string, amount: number, tier: string|null, column: string, rows: number }>>, split: Array<{ key: string, meta: object, tabs: Array<{ tab: string, amount: number }> }> }}
 */
export function debtByRecord(entries) {
  const byKey = new Map();
  const metaOf = new Map();
  for (const entry of entries || []) {
    if (!entry?.key || entry.amount === null || entry.amount === undefined) continue;
    if (!byKey.has(entry.key)) byKey.set(entry.key, new Map());
    if (!metaOf.has(entry.key)) metaOf.set(entry.key, entry.meta);
    const tabs = byKey.get(entry.key);
    const current = tabs.get(entry.tab) || { tab: entry.tab, amount: 0, tier: entry.tier || null, column: entry.column || "", rows: 0 };
    current.amount = Math.round((current.amount + entry.amount) * 100) / 100;
    current.rows += 1;
    tabs.set(entry.tab, current);
  }
  const split = [];
  // Not yalnız borcu (> 0) birden çok sekmede olan dosya no için: Kalan 0 (ödenmiş) sekme borç toplamına bir şey katmaz.
  for (const [key, tabs] of byKey) {
    const owing = [...tabs.values()].filter(item => item.amount > 0);
    if (owing.length > 1) split.push({ key, meta: metaOf.get(key), tabs: owing.map(item => ({ tab: item.tab, amount: item.amount })) });
  }
  return { byKey, split };
}
