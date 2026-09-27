// Tahsilat takvimi (v2.0.1): verinin her sekmesinde ödenmesi beklenen kalemleri (ödeme sözü, taahhüt, vade, taksit
// tarihi, ayın belli günü ödenen kira/aidat) bulur, programda girilen tahsilatlarla eşleştirir ve ödenmemiş olanları
// döndürür. Kayan ödeme şeridi ve "tahsilat alınmadı" / "yaklaşan" bildirimleri bunu kullanır.
//
// İlke, analizin geri kalanı gibi: yanlış alarm vermektense susmak.
//  - Kolon ancak başlığı ödeme takvimi anlatıyorsa ve dolu hücrelerinin çoğu tarih (ya da ay) taşıyorsa takvim sayılır.
//    "Ödeme tarihi" gibi hem plan hem gerçekleşen ödeme olabilen başlıklarda değerlerin bir kısmı yakın/ileri tarihli
//    olmalıdır; "yapılan/ödenen/tahsil edilen" gibi geçmişi anlatan başlıklar hiç sayılmaz.
//  - Satırın durumu "Ödendi / Kapandı / İptal…" ise ya da hücrede "ödendi" yazıyorsa kalem kapalıdır.
//  - Programda girilen tahsilatlar kaydın kalemlerine vade sırasıyla sayılır (tutarı bilinmeyen kalemi herhangi bir
//    tahsilat kapatır). Vadesinden en çok 20 gün önce girilen tahsilat da sayılır.
import { columnOrder as columnsOf } from "../sources.mjs";
import { analyzeColumns, cell, primaryColumns } from "./columns.mjs";
import { embeddedDates, isBlankRecord, isEmptyCell, isSequenceHeader, isTotalRow } from "./cells.mjs";
import { dateMeaning, ordinalOf, subjectOf } from "./temporal.mjs";
import { foldText, parseAmount, parseDate } from "./validators.mjs";

const DAY = 86_400_000;
export const DUE_WINDOW = { pastDays: 90, aheadDays: 7, promiseDays: 30, earlyPaymentDays: 20 };
const MONTHS = { ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6, temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12 };
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// Başlık sınıfları (katlanmış metin üzerinde).
const PAST = /\b(yapilan|odenen|odendigi|odenmis|tahsil edilen|gerceklesen|son odeme yapilan|son tahsilat|son islem)\b/;
const STRONG = /\b(odeme sozu|sozu|soz tarihi|soz|taahhut\w*|vade\w*|son odeme|taksit tarihi|taksit vadesi|planlanan odeme|odenecek tarih\w*|odeme plani|tahsil tarihi|tahsilat tarihi|odeme gunu|vade gunu|taksit gunu|kira gunu|aidat gunu|her ayin)\b/;
const WEAK = /\b(odeme tarihi|odeme|tahsil\w*|taksit\w*)\b/;
const DAY_OF_MONTH = /\b(odeme gunu|vade gunu|taksit gunu|kira gunu|aidat gunu|her ayin)\b/;
const PROMISE = /\b(soz\w*|taahhut\w*)\b/;
const INSTALLMENT = /\btaksit\w*\b/;
// Sıra sayılı ödeme kolonları ("1. Ödeme Tarihi" / "1. Ödeme Tutarı", "Birinci Ödeme") taksit dizisidir (v2.0.2).
const SERIES_PAYMENT = /\b(odeme\w*|tahsilat\w*|aidat\w*|kira\w*)\b/;
const installmentOf = (column, folded = foldText(column)) => {
  const n = numberIn(column);
  if (n === null) return null;
  return INSTALLMENT.test(folded) || SERIES_PAYMENT.test(folded) ? n : null;
};
// Satırı kapatan durumlar ("kısmen ödendi" kapatmaz).
// "Gerçekleştirildi": bildirimdeki düğmeyle hücreye yazılan ibare (v2.0.2) — kalem kapanır, uyarı tekrarlanmaz.
const SETTLED = /\b(odendi|odenmistir|odeme alindi|tahsil edildi|tahsilat yapildi|kapandi|kapali|kapatildi|iptal\w*|tamamlandi|sonuclandi|bitti|feragat|infaz|gerceklestirildi|gerceklestirilmistir)\b/;
const PARTIAL = /\b(kismen|kismi|eksik)\b/;
// Tutar kolonları: kalemin kendi tutarı ve bağlam olarak kalan borç.
const AMOUNT_OWN = /\b(soz tutari|taahhut tutari|taksit tutari|taksit miktari|aylik taksit|aylik odeme|odenecek|odenecek tutar|kira bedeli|kira|aidat|aylik|aylik ucret|servis ucreti|ucret|ucreti|ayligi)\b/;
// Aylık ödeme kolonları ("Eylül", "Ekim 2026", "Kasım ödemesi"): hücrede ödeme işareti ya da tutar varsa o ay ödenmiştir.
const MONTH_HEADER = /^(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)(?:\s+(\d{4}|\d{2}))?(?:\s+(odemesi|odeme|ucreti|ucret|taksiti|aidati|kirasi|tahsilat))?$/;
const UNPAID_MARK = /^(0|0 00|yok|odenmedi|odemedi|odenmemis|borc|borclu|bekliyor|gecikti|gecikme|x|hayir|h)$/;
const AMOUNT_DEBT = /\b(kalan|bakiye|borc\w*|alacak\w*|toplam borc)\b/;
// v2.0.2: şablon satırları ve öğrencinin (üyenin) hizmet dönemi.
// Hizmetin başladığı / bittiği tarih: öncesindeki ve sonrasındaki boş aylar borç sayılmaz.
const START_DATE = /\b(kayit tarihi|kayit|baslangic\w*|baslama\w*|giris tarihi|servise baslama|hizmet baslangic\w*)\b/;
const END_DATE = /\b(ayrilis\w*|ayrilma\w*|ayrildigi|cikis tarihi|birakma\w*|hizmet bitis\w*|servis bitis\w*)\b/;
// Takipten çıkmış kayıt (öğrenci ayrıldı, üye pasif…): hiçbir kalemi beklenmez.
const INACTIVE = /\b(ayrildi|ayrilmistir|ayrilan|pasif|kaydi silindi|kayit silindi|birakti|ilisik kesildi|ayrilmis)\b/;
// Ay hücresinde "o ay ücret yok" yazımları: –, muaf, ücretsiz, burslu.
const NOT_DUE_MARK = /^(muaf|ucretsiz|burslu|odemesiz|yok sayilir|kayitli degil|n\/a)$/;
const notDue = text => /^\s*[-–—]+\s*$/.test(String(text ?? "")) || NOT_DUE_MARK.test(foldText(text));

const dayOf = date => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
const iso = time => new Date(time).toISOString().slice(0, 10);
// Başlıktaki sıra sayısı: "1.", "2nci", "Birinci", "on ikinci" (temporal.mjs), yoksa başlıktaki tek-iki haneli sayı.
const numberIn = text => ordinalOf(text) ?? digitIn(text);
const digitIn = text => {
  const match = /(?:^|\D)(\d{1,2})(?:\D|$)/.exec(text);
  return match ? Number(match[1]) : null;
};
const isSettledText = text => {
  const folded = foldText(text);
  return SETTLED.test(folded) && !PARTIAL.test(folded);
};

// Hücredeki vade: tarih ("15.10.2026", "15.10.2026 - 5.000 TL") ya da ay ("Eylül 2026", "09/2026", "2026-09").
export function readDue(value, now) {
  const text = String(value ?? "").trim();
  if (!text || isEmptyCell(text)) return null;
  if (isSettledText(text)) return { settled: true };
  const dates = embeddedDates(text);
  if (dates.length) return { time: dayOf(dates[0]), kind: "date", rest: text };
  const folded = foldText(text);
  const named = /\b(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)\b(?:\s+(\d{4}|\d{2}))?/.exec(folded);
  if (named) {
    let year = named[2] ? Number(named[2]) : now.getFullYear();
    if (year < 100) year += 2000;
    return { time: Date.UTC(year, MONTHS[named[1]] - 1, 1), kind: "month", rest: text };
  }
  const numeric = /^(\d{1,2})[./-](\d{4})$/.exec(text) || /^(\d{4})-(\d{1,2})$/.exec(text);
  if (numeric) {
    const [month, year] = numeric[0].includes("-") && numeric[1].length === 4 ? [Number(numeric[2]), Number(numeric[1])] : [Number(numeric[1]), Number(numeric[2])];
    if (month >= 1 && month <= 12 && year >= 1990 && year <= 2100) return { time: Date.UTC(year, month - 1, 1), kind: "month", rest: text };
  }
  return null;
}

// Vade hücresinin içinde yazan tutar ("15.10.2026 - 5.000 TL"): tarih çıkarıldıktan sonra kalan para ifadesi.
export function amountInText(text) {
  const rest = String(text ?? "").replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g, " ");
  const money = /(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(₺|tl|try|lira)\b|(₺)\s*(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/i.exec(rest);
  if (!money) return null;
  const value = parseAmount((money[1] || money[4]).replace(/\s/g, "."));
  return value && value > 0 ? value : null;
}

function classifyColumns(rows, columns, analyses, now) {
  const today = dayOf(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  const due = [];
  const recurring = [];
  for (const column of columns) {
    const folded = foldText(column);
    if (!folded || PAST.test(folded)) continue;
    const strong = STRONG.test(folded);
    if (!strong && !WEAK.test(folded)) continue;
    let filled = 0;
    let dated = 0;
    let ahead = 0;
    let days = 0;
    for (const row of rows) {
      const value = cell(row, column);
      if (isEmptyCell(value)) continue;
      filled += 1;
      if (DAY_OF_MONTH.test(folded)) {
        const number = Number(String(value).trim());
        if (Number.isInteger(number) && number >= 1 && number <= 31) days += 1;
        continue;
      }
      const read = readDue(value, now);
      if (!read) continue;
      dated += 1;
      if (read.time && read.time >= today) ahead += 1;
    }
    if (!filled) continue;
    if (DAY_OF_MONTH.test(folded)) {
      if (days / filled >= 0.8) recurring.push({ column, label: labelFor(column) });
      continue;
    }
    if (dated / filled < 0.5) continue;
    // Plan mı, gerçekleşen ödeme mi belli olmayan başlık ("Ödeme tarihi", "Taksit"): ödeme planı ileriye dönüktür; ileri
    // tarihli değerlerin payı en az %25 değilse yapılmış ödemelerin listesidir, takvim sayılmaz (v2.0.2).
    if (!strong && ahead / Math.max(dated, 1) < 0.25) continue;
    due.push({ column, label: labelFor(column), promise: PROMISE.test(folded), installment: installmentOf(column, folded) });
  }
  // Aylık ödeme kolonları: en az iki ay kolonu varsa (tek "Eylül" kolonu başka bir şey olabilir).
  const monthly = paymentMonths(rows, columns, monthColumns(columns, now), analyses);
  const moneyLike = analyses.filter(item => item.role === "money" || (item.role === "number" && AMOUNT_OWN.test(foldText(item.column)))).map(item => item.column);
  const pairFor = entry => {
    if (entry.installment === null) return null;
    return moneyLike.find(column => {
      const folded = foldText(column);
      return column !== entry.column && installmentOf(column, folded) === entry.installment && !due.some(item => item.column === column);
    }) || null;
  };
  const own = moneyLike.find(column => AMOUNT_OWN.test(foldText(column)) && !due.some(item => item.column === column)) || null;
  // Kalan borç: tutar kolonu olarak tanınmış, ya da başlığı kalan/bakiye/borç olan ve tutar yazılmış (seyrek de olsa) kolon.
  const debt = moneyLike.find(column => AMOUNT_DEBT.test(foldText(column))) || columns.find(column => AMOUNT_DEBT.test(foldText(column)) && rows.some(row => parseAmount(cell(row, column)) !== null)) || null;
  for (const entry of due) entry.amountColumn = pairFor(entry) || (entry.installment === null ? own : null);
  for (const entry of monthly) entry.amountColumn = own;
  for (const entry of recurring) {
    entry.amountColumn = own;
    const hint = own ? foldText(own) : "";
    if (entry.label === "Aylık ödeme" && /\bkira\b/.test(hint)) entry.label = "Kira";
    else if (entry.label === "Aylık ödeme" && /\baidat\b/.test(hint)) entry.label = "Aidat";
  }
  return { due, recurring, monthly, debt };
}

// Ay kolonları ve yılları. Yıl yazılmamışsa kolonların sırasından bulunur: aylar tabloda zaman sırasıyla dizilir
// (Eylül, Ekim … Haziran, Temmuz, Ağustos). Ay numarası küçülünce yıl döner. Dizinin başlangıcı, bugüne kadar başlamış
// en yakın dönemdir: Eylül'de başlayan okul yılında Eylül 2026'da Temmuz ve Ağustos 2027 olur (henüz gelmedi); Ocak–Aralık
// takviminde ise Temmuz ve Ağustos 2026 (geçti). Yılı yazılı bir kolon varsa dizi ona göre yerleşir. Sırası karışık
// (24 aydan uzun) dizilerde her ay bugünden önceki en yakın hâlini alır.
export function monthColumns(columns, now) {
  const found = columns
    .map(column => ({ column, match: MONTH_HEADER.exec(foldText(column)) }))
    .filter(item => item.match)
    .map(item => {
      let year = item.match[2] ? Number(item.match[2]) : null;
      if (year !== null && year < 100) year += 2000;
      return { column: item.column, month: MONTHS[item.match[1]], year };
    });
  if (found.length < 2) return [];
  const offsets = [];
  let offset = 0;
  found.forEach((item, index) => {
    if (index) offset += (item.month - found[index - 1].month + 12) % 12;
    offsets.push(offset);
  });
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  let base = null;
  if (offset <= 23) {
    const anchor = found.findIndex(item => item.year !== null);
    if (anchor >= 0) base = found[anchor].year * 12 + found[anchor].month - 1 - offsets[anchor];
    else {
      const first = found[0].month - 1;
      for (let year = now.getFullYear() + 1; year >= now.getFullYear() - 2; year -= 1) {
        if (year * 12 + first <= nowIndex) {
          base = year * 12 + first;
          break;
        }
      }
    }
  }
  return found.map((item, index) => {
    let year = item.year;
    if (year === null && base !== null) year = Math.floor((base + offsets[index]) / 12);
    if (year === null) year = item.month - 1 <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1;
    return { column: item.column, time: Date.UTC(year, item.month - 1, 1), label: `${MONTH_NAMES[item.month - 1]} ödemesi` };
  });
}

// Ay kolonları ancak ödeme kanıtı varsa aidat/ücret/taksit planıdır (v2.0.2); yoksa ("Ocak", "Şubat" satış ya da
// devam tablosu) hiçbir kalem üretmez. Kanıt: başlıkta ödeme eki ("Eylül taksiti", "Ekim ödemesi"), tabloda aylık
// ücret/aidat/kira kolonu, ya da dolu ay hücrelerinin en az yarısında ödeme işareti ("ödendi", "✓", "ödenmedi").
const PAYMENT_MARK = /^(odendi|odenmistir|odeme alindi|alindi|tahsil edildi|tamam|ok|evet|e|var|\+|✓|✔|☑|x|yok|odenmedi|odemedi|odenmemis|bekliyor|borc|borclu|gecikti|hayir|h|kismen|kismi|eksik)$/;
function paymentMonths(rows, columns, months, analyses) {
  if (!months.length) return [];
  if (months.some(entry => MONTH_HEADER.exec(foldText(entry.column))?.[3])) return months;
  const feeColumn = analyses.some(item => (item.role === "money" || item.role === "number") && AMOUNT_OWN.test(foldText(item.column)) && !months.some(entry => entry.column === item.column));
  if (feeColumn) return months;
  let filled = 0;
  let marks = 0;
  for (const row of rows) {
    for (const entry of months) {
      const text = String(cell(row, entry.column) ?? "").trim();
      if (!text || isEmptyCell(text)) continue;
      filled += 1;
      if (PAYMENT_MARK.test(foldText(text)) || /^[✓✔☑✗✘]$/.test(text)) marks += 1;
    }
  }
  return filled >= 3 && marks / filled >= 0.5 ? months : [];
}

// Satır bağlamı (v2.0.2): işin bittiğini söyleyen durumlar ve evet/hayır kolonları.
const DONE_STATE = /\b(tamamlandi|tamamlanmistir|yapildi|yapilmistir|geldi|katildi|teslim edildi|teslim alindi|yenilendi|yenilenmistir|kapandi|kapatildi|sonuclandi|bitti|ertelendi|gerceklesti|gerceklestirildi|gerceklestirilmistir|iptal\w*)\b/;
const FLAG_HEADER = /(\b(mi|mu)\b|\b(yapildi|yenilendi|tamamlandi|geldi|teslim edildi|odendi)\b)/;
const YES_MARK = /^(evet|e|var|yapildi|yenilendi|tamam|tamamlandi|ok|✓|✔|☑|yes|true|1)$/;

// Kaydın hizmet dönemi (ay başı zamanı olarak): başlangıç ve bitiş tarihi kolonlarından.
function serviceBounds(row, startColumn, endColumn) {
  const monthOf = value => {
    const date = parseDate(value);
    return date ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) : null;
  };
  return { start: startColumn ? monthOf(cell(row, startColumn)) : null, end: endColumn ? monthOf(cell(row, endColumn)) : null };
}

function labelFor(column) {
  const text = String(column).replace(/\s+/g, " ").trim();
  const folded = foldText(text);
  const n = installmentOf(text, folded);
  if (n !== null) return INSTALLMENT.test(folded) ? `${n}. taksit` : `${n}. ödeme`;
  if (PROMISE.test(folded)) return "Ödeme sözü";
  if (DAY_OF_MONTH.test(folded)) return /kira/.test(folded) ? "Kira" : /aidat/.test(folded) ? "Aidat" : "Aylık ödeme";
  return text.length > 40 ? `${text.slice(0, 38)}…` : text;
}

const monthLabel = time => {
  const date = new Date(time);
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

/**
 * @param {object} input
 * @param {Array<object>} input.rows  birleşik görünümün satırları (__sheet, __hofKey)
 * @param {string[]} [input.tabs]
 * @param {Array<{caseKey:string, amount:number, date:string}>} [input.payments] programda girilen tahsilatlar
 * @param {Record<string, object>} [input.settled] elle "ödendi say" denen kalemler (kimlik → bilgi)
 * @param {Date} [input.now]
 */
export function computeDues({ rows, tabs = [], payments = [], settled = {}, now = new Date() }) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = Date.UTC(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = Date.UTC(now.getFullYear(), now.getMonth() + 1, 0);
  const from = today - DUE_WINDOW.pastDays * DAY;
  const until = Math.max(monthEnd, today + DUE_WINDOW.aheadDays * DAY);
  // Ödeme sözü kişiye özel bir taahhüttür; açık sözler 30 gün öncesinden takvimde görünür (taksit ve kira bu ay + 7 gün).
  const promiseUntil = Math.max(until, today + DUE_WINDOW.promiseDays * DAY);
  const groups = new Map();
  for (const row of rows) {
    if (!row || !row.__hofKey) continue;
    const tab = String(row.__sheet || "");
    if (!groups.has(tab)) groups.set(tab, []);
    groups.get(tab).push(row);
  }
  const order = [...tabs.filter(tab => groups.has(tab)), ...[...groups.keys()].filter(tab => !tabs.includes(tab))];
  const candidates = [];
  const sources = [];
  for (const tab of order) {
    const scope = groups.get(tab);
    const columns = columnsOf(scope);
    const analyses = analyzeColumns(scope, columns, { now });
    const primary = primaryColumns(analyses);
    const { due, recurring, monthly, debt } = classifyColumns(scope, columns, analyses, now);
    if (!due.length && !recurring.length && !monthly.length) continue;
    const statusColumns = analyses.filter(item => item.role === "status" || /\b(durum\w*|asama\w*|sonuc\w*)\b/.test(foldText(item.column))).map(item => item.column);
    sources.push({ tab, columns: [...due, ...recurring, ...monthly].map(item => item.column) });
    const sequence = new Set(columns.filter(isSequenceHeader));
    const idColumn = primary.id && primary.id !== primary.person && !sequence.has(primary.id) ? primary.id : null;
    const hasIdentity = Boolean(primary.person || idColumn);
    const dateColumn = pattern => columns.find(column => pattern.test(foldText(column)) && !monthly.some(entry => entry.column === column)) || null;
    const startColumn = monthly.length ? dateColumn(START_DATE) : null;
    const endColumn = monthly.length ? dateColumn(END_DATE) : null;
    for (const row of scope) {
      if (isTotalRow(row)) continue;
      if (statusColumns.some(column => isSettledText(cell(row, column)) || INACTIVE.test(foldText(cell(row, column))))) continue;
      const person = primary.person ? String(cell(row, primary.person) ?? "").trim() : "";
      const caseNo = idColumn ? String(cell(row, idColumn) ?? "").trim() : "";
      // Boş şablon satırı (yalnız sıra numarası, ya da adı/kimliği yazılmamış satır) kayıt değildir.
      if (isBlankRecord(row, columns)) continue;
      if (hasIdentity && isEmptyCell(person) && isEmptyCell(caseNo)) continue;
      const debtAmount = debt ? parseAmount(cell(row, debt)) : null;
      // Satır bağlamı: kalan borç / bakiye açıkça 0 ise o kayıttan tahsilat beklenmez (v2.0.2).
      if (debt && debtAmount === 0 && !isEmptyCell(cell(row, debt))) continue;
      // Kimlikte sekmenin asıl adı: sekme kalemle yeniden adlandırılınca kapatılan kalemler geri açılmaz (v2.0.2).
      const base = { caseKey: row.__hofKey, tab, sheet: row.__hofSheet || tab, person, caseNo, debt: debtAmount && debtAmount > 0 ? debtAmount : null };
      for (const entry of due) {
        const read = readDue(cell(row, entry.column), now);
        if (!read || read.settled) continue;
        const ownAmount = entry.amountColumn ? parseAmount(cell(row, entry.amountColumn)) : null;
        const amount = ownAmount && ownAmount > 0 ? ownAmount : amountInText(read.rest);
        candidates.push({ ...base, column: entry.column, label: entry.label, promise: entry.promise, kind: read.kind, time: read.time, amount: amount || null });
      }
      // Hizmet dönemi: başlangıç tarihi kolonu, yoksa ilk dolu ay. Öncesindeki boş aylar borç değildir (ör. Ekim'de gelen
      // öğrencinin Eylül'ü). Hiçbir ayı dolu olmayan yeni kayıt için yalnızca bu ay beklenir.
      const bounds = monthly.length ? serviceBounds(row, startColumn, endColumn) : { start: null, end: null };
      let serviceStart = bounds.start;
      if (monthly.length && serviceStart === null) {
        const filled = monthly.filter(entry => {
          const text = String(cell(row, entry.column) ?? "").trim();
          return text && !isEmptyCell(text) && !notDue(text);
        });
        serviceStart = filled.length ? Math.min(...filled.map(entry => entry.time)) : monthStart;
      }
      for (const entry of monthly) {
        if (entry.time > today || entry.time < from) continue;
        if (serviceStart !== null && entry.time < serviceStart) continue;
        if (bounds.end !== null && entry.time > bounds.end) continue;
        const value = String(cell(row, entry.column) ?? "").trim();
        if (notDue(value) || isSettledText(value)) continue;
        const fee = entry.amountColumn ? parseAmount(cell(row, entry.amountColumn)) : null;
        const folded = foldText(value);
        const paidAmount = value && !UNPAID_MARK.test(folded) ? parseAmount(value) : null;
        // Boş, "ödenmedi", "0" → ödenmedi; tutar ücretten azsa kalanı beklenir; başka bir işaret (✓, Ödendi, tarih) ödenmiş sayılır.
        if (value && !UNPAID_MARK.test(folded) && !isEmptyCell(value) && (paidAmount === null || !fee || paidAmount >= fee - 0.01)) continue;
        const amount = fee && fee > 0 ? (paidAmount && paidAmount > 0 ? fee - paidAmount : fee) : null;
        candidates.push({ ...base, column: entry.column, label: entry.label, promise: false, kind: "month", time: entry.time, amount, monthly: true, cellPaid: amount !== null && paidAmount > 0 });
      }
      for (const entry of recurring) {
        const day = Number(String(cell(row, entry.column)).trim());
        if (!Number.isInteger(day) || day < 1 || day > 31) continue;
        const ownAmount = entry.amountColumn ? parseAmount(cell(row, entry.amountColumn)) : null;
        for (const offset of [-1, 0]) {
          const last = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset + 1, 0)).getUTCDate();
          const time = Date.UTC(now.getFullYear(), now.getMonth() + offset, Math.min(day, last));
          candidates.push({ ...base, column: entry.column, label: entry.label, promise: false, kind: "date", time, amount: ownAmount && ownAmount > 0 ? ownAmount : null, recurring: true });
        }
      }
    }
  }

  // Tahsilatlar kaydın kalemlerine vade sırasıyla sayılır.
  const byCase = new Map();
  for (const item of candidates) {
    item.id = `due|${item.sheet || item.tab}|${item.caseKey}|${item.column}|${iso(item.time)}`;
    if (!byCase.has(item.caseKey)) byCase.set(item.caseKey, []);
    byCase.get(item.caseKey).push(item);
  }
  const paymentsByCase = new Map();
  for (const payment of payments) {
    const time = Date.parse(String(payment.date || "").slice(0, 10));
    if (!Number.isFinite(time) || !(Number(payment.amount) > 0)) continue;
    if (!paymentsByCase.has(payment.caseKey)) paymentsByCase.set(payment.caseKey, []);
    paymentsByCase.get(payment.caseKey).push({ time, amount: Number(payment.amount) });
  }
  for (const [caseKey, items] of byCase) {
    items.sort((a, b) => a.time - b.time);
    for (const item of items) item.paid = 0;
    const list = (paymentsByCase.get(caseKey) || []).sort((a, b) => a.time - b.time);
    for (const payment of list) {
      let left = payment.amount;
      let applied = false;
      for (const item of items) {
        if (left <= 0.004) break;
        if (item.closed) continue;
        // Vadesine 20 günden fazla varken girilen tahsilat sayılmaz; ama bir kalemi kapatıp artan kısım sonraki
        // kalemlere (erken ödeme) sayılır.
        const opens = item.time - DUE_WINDOW.earlyPaymentDays * DAY;
        if (payment.time < opens && !applied) continue;
        applied = true;
        if (item.amount === null) {
          item.closed = true;
          item.paid += left;
          left = 0;
          break;
        }
        const need = item.amount - item.paid;
        const used = Math.min(need, left);
        item.paid += used;
        left -= used;
        if (item.paid >= item.amount - 0.01) item.closed = true;
      }
    }
  }

  const out = [];
  for (const item of candidates) {
    if (item.closed || settled[item.id]) continue;
    if (item.time < from || item.time > (item.promise ? promiseUntil : until)) continue;
    const days = Math.round((item.time - today) / DAY);
    // Ay olarak yazılan kalem ayın ilk gününden itibaren beklenir; içinde bulunulan ay "bu ay" sayılır.
    const state = days < 0 ? (item.kind === "month" && item.time === monthStart ? "month" : "overdue") : days === 0 ? "today" : "upcoming";
    out.push({
      id: item.id,
      caseKey: item.caseKey,
      tab: item.tab,
      person: item.person,
      caseNo: item.caseNo,
      label: item.label,
      column: item.column,
      promise: item.promise,
      kind: item.kind,
      recurring: Boolean(item.recurring),
      due: iso(item.time),
      dueText: item.kind === "month" ? monthLabel(item.time) : iso(item.time).split("-").reverse().join("."),
      days,
      state,
      amount: item.amount === null ? null : Math.round((item.amount - item.paid) * 100) / 100,
      fullAmount: item.amount,
      partial: item.amount !== null && (item.paid > 0.004 || Boolean(item.cellPaid)),
      debt: item.debt,
      thisMonth: item.time >= monthStart && item.time <= monthEnd,
    });
  }
  // Önce gecikenler (en eskiden), sonra bugün, bu ay ve yaklaşanlar (en yakından).
  const rank = item => (item.state === "overdue" ? 0 : item.state === "month" || item.state === "today" ? 1 : 2);
  out.sort((a, b) => rank(a) - rank(b) || a.days - b.days || a.person.localeCompare(b.person, "tr"));
  return { items: out, sources };
}

// Son tarihi yaklaşan işler (bildirim için): ödeme takvimi dışındaki son tarih kolonları (yenileme, bitiş, teslim,
// duruşma…) bugünden itibaren `aheadDays` gün içinde.
export function computeDeadlines({ rows, tabs = [], now = new Date(), aheadDays = 7, pastDays = 30, exclude = [] }) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const since = today - pastDays * DAY;
  const until = today + aheadDays * DAY;
  const skip = new Set(exclude.flatMap(item => item.columns.map(column => `${item.tab}\u0000${column}`)));
  const groups = new Map();
  for (const row of rows) {
    if (!row || !row.__hofKey) continue;
    const tab = String(row.__sheet || "");
    if (!groups.has(tab)) groups.set(tab, []);
    groups.get(tab).push(row);
  }
  const out = [];
  for (const [tab, scope] of groups) {
    const columns = columnsOf(scope);
    const analyses = analyzeColumns(scope, columns, { now });
    const primary = primaryColumns(analyses);
    // Tarihin anlamı tek yerden gelir (temporal.mjs, kolon analizi): bitiş/son gün yaklaşınca ve geçince, planlı tarih
    // (randevu, duruşma, sınav, teslim) yalnız yaklaşınca bildirilir; kayıt/olay tarihi ("Muayene tarihi" klinikte,
    // "Kayıt tarihi") ve belirsiz tarihler hiç bildirilmez.
    const dated = analyses
      .filter(item => item.role === "date" && (item.meaning === "expiry" || item.meaning === "schedule") && !skip.has(`${tab}\u0000${item.column}`))
      .map(item => ({ ...item, type: item.meaning === "expiry" ? "expiry" : "event" }));
    if (!dated.length) continue;
    // Satır bağlamı (v2.0.2): kolon ne derse desin, satırın kendisi işin bittiğini söylüyorsa uyarı verilmez.
    //  - durum kolonu: "tamamlandı, yapıldı, geldi, teslim edildi, yenilendi, iptal, kapandı, ayrıldı…" → satırdan uyarı yok;
    //  - evet/hayır kolonu ("Sigorta yenilendi mi?", "Yapıldı"): "evet" → o konudaki (ya da konusuzsa tüm) uyarılar susar;
    //  - aynı konuda daha yeni tarih: süresi geçen "Muayene bitiş"ten sonra "Yapılan muayene" ya da ileri tarihli yeni bir
    //    bitiş varsa iş yapılmıştır.
    const statusColumns = analyses.filter(item => item.role === "status" || /\b(durum\w*|asama\w*|sonuc\w*)\b/.test(foldText(item.column))).map(item => item.column);
    const flagColumns = columns
      .filter(column => FLAG_HEADER.test(foldText(column)) && !dated.some(item => item.column === column))
      .map(column => ({ column, subject: subjectOf(column) }));
    // Aynı konulu tarih kolonları: seyrek dolu olsalar da (ör. yalnız yapılan işlerde dolu "Yapılan muayene") başlıktan
    // ve hücreden okunur; anlamı varsa kolon analizinden, yoksa başlıktan.
    const subjectDates = columns
      .filter(column => subjectOf(column) && !skip.has(`${tab}\u0000${column}`))
      .map(column => ({ column, subject: subjectOf(column), meaning: analyses.find(item => item.column === column && item.role === "date")?.meaning || dateMeaning(column, 0).meaning }));
    for (const row of scope) {
      if (isTotalRow(row) || isBlankRecord(row, columns)) continue;
      if (statusColumns.some(column => isSettledText(cell(row, column)) || DONE_STATE.test(foldText(cell(row, column))) || INACTIVE.test(foldText(cell(row, column))))) continue;
      for (const item of dated) {
        const value = cell(row, item.column);
        if (isEmptyCell(value) || isSettledText(value) || DONE_STATE.test(foldText(value))) continue;
        const dates = embeddedDates(String(value));
        if (!dates.length) continue;
        const time = dayOf(dates[0]);
        // Yaklaşanlar ve (belgeler gibi) süresi yakın zamanda geçmiş olanlar: süresi geçen belge de uyarılır.
        if (time > until || time < since || (time < today && item.type !== "expiry")) continue;
        const subject = subjectOf(item.column);
        if (flagColumns.some(flag => (!flag.subject || flag.subject === subject) && YES_MARK.test(foldText(cell(row, flag.column))))) continue;
        if (
          subject &&
          subjectDates.some(other => {
            if (other.column === item.column || other.subject !== subject) return false;
            const later = embeddedDates(String(cell(row, other.column) ?? ""))[0];
            if (!later) return false;
            const at = dayOf(later);
            // Yapıldığı gün son günden sonra ya da aynı gün (iş yapıldı) / yeni bitiş ileride (yenilendi).
            return (other.meaning === "record" && at >= time && time <= today) || (other.meaning === "expiry" && at > time && at >= today);
          })
        )
          continue;
        // Araç tablosunda (plaka kolonu) başlık plakadır; kişi (şoför) yanında yazar.
        // Tablonun başında hangisi varsa kayıt odur: plaka öndeyse araç tablosu, kişi öndeyse (şoförler) kişi.
        const vehicle = primary.plate && (!primary.person || columns.indexOf(primary.plate) < columns.indexOf(primary.person));
        const plate = vehicle ? String(cell(row, primary.plate) ?? "").trim() : "";
        const person = primary.person ? String(cell(row, primary.person) ?? "").trim() : "";
        out.push({
          id: `deadline|${row.__hofSheet || tab}|${row.__hofKey}|${item.column}|${iso(time)}`,
          caseKey: row.__hofKey,
          tab,
          person: plate || person,
          caseNo: plate ? person : primary.id && primary.id !== primary.person ? String(cell(row, primary.id) ?? "").trim() : "",
          label: String(item.column).trim(),
          column: item.column,
          due: iso(time),
          dueText: iso(time).split("-").reverse().join("."),
          days: Math.round((time - today) / DAY),
          type: item.type,
        });
      }
    }
  }
  out.sort((a, b) => a.days - b.days || a.person.localeCompare(b.person, "tr"));
  return out;
}
