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
import { embeddedDates, isEmptyCell, isTotalRow } from "./cells.mjs";
import { foldText, parseAmount } from "./validators.mjs";

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
// Satırı kapatan durumlar ("kısmen ödendi" kapatmaz).
const SETTLED = /\b(odendi|odenmistir|odeme alindi|tahsil edildi|tahsilat yapildi|kapandi|kapali|kapatildi|iptal\w*|tamamlandi|sonuclandi|bitti|feragat|infaz)\b/;
const PARTIAL = /\b(kismen|kismi|eksik)\b/;
// Tutar kolonları: kalemin kendi tutarı ve bağlam olarak kalan borç.
const AMOUNT_OWN = /\b(soz tutari|taahhut tutari|taksit tutari|taksit miktari|aylik taksit|aylik odeme|odenecek|odenecek tutar|kira bedeli|kira|aidat|aylik|aylik ucret|servis ucreti|ucret|ucreti|ayligi)\b/;
// Aylık ödeme kolonları ("Eylül", "Ekim 2026", "Kasım ödemesi"): hücrede ödeme işareti ya da tutar varsa o ay ödenmiştir.
const MONTH_HEADER = /^(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)(?:\s+(\d{4}|\d{2}))?(?:\s+(odemesi|odeme|ucreti|ucret|taksiti|aidati|kirasi|tahsilat))?$/;
const UNPAID_MARK = /^(0|0 00|yok|odenmedi|odemedi|odenmemis|borc|borclu|bekliyor|gecikti|gecikme|x|hayir|h)$/;
// Son tarihi yaklaşan/geçen belgeler (servis aracı, şoför, poliçe…): başlığında bu sözcükler olan tarih kolonları.
const DOCUMENT_DEADLINE = /\b(muayene\w*|sigorta\w*|kasko\w*|police\w*|vize\w*|src|psikoteknik|ehliyet\w*|ruhsat\w*|yenileme\w*|gecerlilik\w*|bitis\w*|son gun\w*|son tarih\w*|izin belgesi)\b/;
const AMOUNT_DEBT = /\b(kalan|bakiye|borc\w*|alacak\w*|toplam borc)\b/;

const dayOf = date => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
const iso = time => new Date(time).toISOString().slice(0, 10);
const numberIn = text => {
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
    let recent = 0;
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
      if (read.time && read.time >= today - 31 * DAY) recent += 1;
    }
    if (!filled) continue;
    if (DAY_OF_MONTH.test(folded)) {
      if (days / filled >= 0.8) recurring.push({ column, label: labelFor(column) });
      continue;
    }
    if (dated / filled < 0.5) continue;
    // Plan mı, gerçekleşen ödeme mi belli olmayan başlık: yakın ya da ileri tarihli değer yoksa takvim sayılmaz.
    if (!strong && recent / Math.max(dated, 1) < 0.15) continue;
    due.push({ column, label: labelFor(column), promise: PROMISE.test(folded), installment: INSTALLMENT.test(folded) ? numberIn(column) : null });
  }
  // Aylık ödeme kolonları: en az iki ay kolonu varsa (tek "Eylül" kolonu başka bir şey olabilir).
  const months = columns
    .map(column => ({ column, match: MONTH_HEADER.exec(foldText(column)) }))
    .filter(item => item.match)
    .map(item => {
      const month = MONTHS[item.match[1]];
      let year = item.match[2] ? Number(item.match[2]) : null;
      if (year !== null && year < 100) year += 2000;
      // Yıl yazılmamışsa o ayın bugünden önceki en yakın hâli (okul yılı Eylül–Haziran gibi dönemler için).
      if (year === null) year = month - 1 <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1;
      return { column: item.column, time: Date.UTC(year, month - 1, 1), label: `${MONTH_NAMES[month - 1]} ödemesi` };
    });
  const monthly = months.length >= 2 ? months : [];
  const moneyLike = analyses.filter(item => item.role === "money" || (item.role === "number" && AMOUNT_OWN.test(foldText(item.column)))).map(item => item.column);
  const pairFor = entry => {
    if (entry.installment === null) return null;
    return moneyLike.find(column => {
      const folded = foldText(column);
      return column !== entry.column && INSTALLMENT.test(folded) && numberIn(column) === entry.installment && !due.some(item => item.column === column);
    }) || null;
  };
  const own = moneyLike.find(column => AMOUNT_OWN.test(foldText(column)) && !due.some(item => item.column === column)) || null;
  const debt = moneyLike.find(column => AMOUNT_DEBT.test(foldText(column))) || null;
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

function labelFor(column) {
  const text = String(column).replace(/\s+/g, " ").trim();
  const folded = foldText(text);
  const n = numberIn(text);
  if (INSTALLMENT.test(folded) && n !== null) return `${n}. taksit`;
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
    for (const row of scope) {
      if (isTotalRow(row)) continue;
      if (statusColumns.some(column => isSettledText(cell(row, column)))) continue;
      const person = primary.person ? String(cell(row, primary.person) ?? "").trim() : "";
      const caseNo = primary.id && primary.id !== primary.person ? String(cell(row, primary.id) ?? "").trim() : "";
      const debtAmount = debt ? parseAmount(cell(row, debt)) : null;
      const base = { caseKey: row.__hofKey, tab, person, caseNo, debt: debtAmount && debtAmount > 0 ? debtAmount : null };
      for (const entry of due) {
        const read = readDue(cell(row, entry.column), now);
        if (!read || read.settled) continue;
        const ownAmount = entry.amountColumn ? parseAmount(cell(row, entry.amountColumn)) : null;
        const amount = ownAmount && ownAmount > 0 ? ownAmount : amountInText(read.rest);
        candidates.push({ ...base, column: entry.column, label: entry.label, promise: entry.promise, kind: read.kind, time: read.time, amount: amount || null });
      }
      for (const entry of monthly) {
        if (entry.time > today || entry.time < from) continue;
        const value = String(cell(row, entry.column) ?? "").trim();
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
    item.id = `due|${item.tab}|${item.caseKey}|${item.column}|${iso(item.time)}`;
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
    const dated = analyses.filter(item => item.role === "date" && (item.kind === "deadline" || DOCUMENT_DEADLINE.test(foldText(item.column))) && !skip.has(`${tab}\u0000${item.column}`));
    if (!dated.length) continue;
    const statusColumns = analyses.filter(item => item.role === "status").map(item => item.column);
    for (const row of scope) {
      if (isTotalRow(row) || statusColumns.some(column => isSettledText(cell(row, column)))) continue;
      for (const item of dated) {
        const value = cell(row, item.column);
        if (isEmptyCell(value) || isSettledText(value)) continue;
        const dates = embeddedDates(String(value));
        if (!dates.length) continue;
        const time = dayOf(dates[0]);
        // Yaklaşanlar ve (belgeler gibi) süresi yakın zamanda geçmiş olanlar: süresi geçen belge de uyarılır.
        if (time > until || time < since || (time < today && !DOCUMENT_DEADLINE.test(foldText(item.column)))) continue;
        // Araç tablosunda (plaka kolonu) başlık plakadır; kişi (şoför) yanında yazar.
        // Tablonun başında hangisi varsa kayıt odur: plaka öndeyse araç tablosu, kişi öndeyse (şoförler) kişi.
        const vehicle = primary.plate && (!primary.person || columns.indexOf(primary.plate) < columns.indexOf(primary.person));
        const plate = vehicle ? String(cell(row, primary.plate) ?? "").trim() : "";
        const person = primary.person ? String(cell(row, primary.person) ?? "").trim() : "";
        out.push({
          id: `deadline|${tab}|${row.__hofKey}|${item.column}|${iso(time)}`,
          caseKey: row.__hofKey,
          tab,
          person: plate || person,
          caseNo: plate ? person : primary.id && primary.id !== primary.person ? String(cell(row, primary.id) ?? "").trim() : "",
          label: String(item.column).trim(),
          due: iso(time),
          dueText: iso(time).split("-").reverse().join("."),
          days: Math.round((time - today) / DAY),
        });
      }
    }
  }
  out.sort((a, b) => a.days - b.days || a.person.localeCompare(b.person, "tr"));
  return out;
}
