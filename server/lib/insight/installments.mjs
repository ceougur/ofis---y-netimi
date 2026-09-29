// Ay matrisi → taksit defteri (v2.0.2). Excel'deki yatay ay hücreleri (Ocak … Aralık, "Eylül taksiti" …) doğrudan
// uyarıya çevrilmez; önce her kayıt için bağımsız taksit satırlarına (defter) indirgenir. Defterde yalnızca kaydın
// geçerlilik aralığına düşen aylar bulunur; aralık dışındaki boş hücreler (girişten önce, çıkıştan sonra) için
// hiçbir taksit satırı açılmaz. Takvim/uyarı motoru ve raporlar yalnız bu defteri sorgular.
//
// Geçerlilik aralığı (kayıt başına):
//   başlangıç — başlangıç/kayıt tarihi kolonu; yoksa ilk yazılı ay ("–", "muaf" dahil: o ay kayıt vardı ama ücret yok);
//               hiçbir ay yazılmamışsa ve ücret kolonu doluysa içinde bulunulan ay (yeni kayıt).
//   bitiş     — bitiş/ayrılış tarihi kolonu; yoksa son yazılı aydan sonra, bu aydan önce üst üste `dormantMonths` (3) tam boş ay geçmişse
//               kayıt "durgun" sayılır ve son yazılı ayda kapanır (ayrılan müşteri); aksi hâlde açıktır ve bu ay dahil
//               beklenir. Aralığın içindeki boş ay ise ödenmemiş taksittir (Ocak ödendi, Şubat boş, Mart ödendi → Şubat).
// Durgun kayıtlar uyarı üretmez; ayrı listede ("ödeme kesilmiş olabilir") raporda görünür, sessizce yutulmaz.
//
// İki okuma kipi (tablo başına, `detectMonthPlan`):
//   ödeme kipi — ay hücresine YAPILAN ödeme yazılır ("3.000 ₺", "✓", "ödendi"); boş ay ödenmemiştir.
//   plan kipi  — ay hücresine ÖDENECEK taksit yazılır (Eylül 10.000, Ekim 10.000, Toplam 20.000). Hücredeki tutar tek
//                başına "ödendi" demek değildir (kullanıcı kararı, v2.0.3): ay, kart detayındaki o aya düşen tahsilatla,
//                hücredeki ödeme işaretiyle ("10.000 ödendi", "✓", "Gerçekleştirildi") ya da "Ödenen" kolonu /
//                Toplam − Kalan ile (en eski taksitten başlayarak) kapanır. Bu kipte yalnız tutar yazılı aylar taksittir;
//                boş ay taksit değildir.
//                Kanıt: tabloda ayrı bir aylık ücret/aidat kolonu yok; ve dolu ay hücrelerinin çoğu tutar taşıyor ya da
//                gelecek ayların hücrelerinde tutar var. Aylık ücret kolonu olan tablo her zaman ödeme kipindedir: ay
//                hücresindeki tutar ücrete göre ödenen miktardır, gelecek aya yazılan tutar peşin ödemedir.
//                "Toplam = ayların toplamı" kanıt sayılmaz: Excel'in TOPLA formülü ödeme defterinde de aynı sonucu verir.
import { cell } from "./columns.mjs";
import { isEmptyCell } from "./cells.mjs";
import { foldText, parseAmount, parseDate } from "./validators.mjs";

export const LEDGER = { dormantMonths: 3, planShare: 0.3, amountShare: 0.5 };
const TOTAL_HEADER = /\b(toplam tutar|toplam ucret|toplam borc|toplam|sozlesme tutari|anlasilan tutar|yillik ucret|genel toplam|tutar)\b/;
const PAID_HEADER = /\b(odenen\w*|odenmis|tahsil edilen|tahsilat|yatan|yatirilan|alinan)\b/;
const REMAINING_HEADER = /\b(kalan\w*|bakiye|kalan borc)\b/;
const MARK_ONLY = /^[✓✔☑]$/;
const UNPAID_MARK = /^(0|0 00|yok|odenmedi|odemedi|odenmemis|borc|borclu|bekliyor|gecikti|gecikme|x|hayir|h)$/;
const NOT_DUE_MARK = /^(muaf|ucretsiz|burslu|odemesiz|yok sayilir|kayitli degil|n\/a)$/;
const SETTLED_MARK = /\b(odendi|odenmistir|odeme alindi|tahsil edildi|tahsilat yapildi|kapandi|kapatildi|gerceklestirildi|gerceklestirilmistir|paid)\b/;
export const notDue = text => /^\s*[-–—]+\s*$/.test(String(text ?? "")) || NOT_DUE_MARK.test(foldText(text));

const monthIndex = ms => {
  const date = new Date(ms);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
};
const monthStartOf = ms => {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
};
const monthOfValue = value => {
  const date = parseDate(value);
  return date ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) : null;
};

/** Bir hücrenin taksit durumu: paid | partial | due | skip (ücret yok) . */
export function cellState(value, fee) {
  const text = String(value ?? "").trim();
  if (notDue(text)) return { state: "skip", paidAmount: null };
  if (!text || isEmptyCell(text)) return { state: "due", paidAmount: null };
  const folded = foldText(text);
  if (UNPAID_MARK.test(folded)) return { state: "due", paidAmount: null };
  if (SETTLED_MARK.test(folded)) return { state: "paid", paidAmount: fee || null };
  const paidAmount = parseAmount(text);
  if (paidAmount !== null && paidAmount > 0 && fee && paidAmount < fee - 0.01) return { state: "partial", paidAmount };
  return { state: "paid", paidAmount: paidAmount && paidAmount > 0 ? paidAmount : fee || null };
}

const amountIn = value => {
  const text = String(value ?? "").trim();
  if (!text || isEmptyCell(text) || notDue(text)) return null;
  // "10.000 ödendi", "Gerçekleştirildi · 10.000", "✓ 10000" → 10000 (yazı ve işaretler atılır, tutar kalır).
  const stripped = text.replace(/[A-Za-zÇĞİÖŞÜçğıöşü]+\.?/g, " ").replace(/[·•✓✔☑:|]/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped) return null;
  const amount = parseAmount(stripped);
  return amount !== null && amount > 0 ? amount : null;
};

/**
 * Ay hücrelerinin ödeme mi yoksa ödenecek taksit planı mı taşıdığını tablo düzeyinde karar verir.
 * @returns {{plan:boolean, reason:string|null, totalColumn:string|null, paidColumn:string|null, remainingColumn:string|null, feeColumn:string|null}}
 */
/**
 * Toplam / ödenen / kalan kolonları: başlığı öyle diyen ve hücrelerinde tutar yazan kolonlar (`exclude` dışındakiler).
 * Takvim (plan kipi) ve tablodan taksit kartına aktarma (v2.0.8) aynı kuralı kullanır.
 * @returns {{ totalColumn: string|null, paidColumn: string|null, remainingColumn: string|null }}
 */
export function paymentColumns({ rows, columns, exclude = [] }) {
  const skip = new Set(exclude);
  const others = columns.filter(column => !skip.has(column));
  const hasAmounts = column => rows.some(row => amountIn(cell(row, column)) !== null);
  const paidColumn = others.find(column => PAID_HEADER.test(foldText(column)) && !REMAINING_HEADER.test(foldText(column)) && hasAmounts(column)) || null;
  const remainingColumn = others.find(column => REMAINING_HEADER.test(foldText(column)) && hasAmounts(column)) || null;
  const totalColumn = others.find(column => {
    const folded = foldText(column);
    return TOTAL_HEADER.test(folded) && !PAID_HEADER.test(folded) && !REMAINING_HEADER.test(folded) && !/\b(aylik|taksit tutari)\b/.test(folded) && hasAmounts(column);
  }) || null;
  return { totalColumn, paidColumn, remainingColumn };
}

export function detectMonthPlan({ rows, months, columns, now = new Date() }) {
  const { totalColumn, paidColumn, remainingColumn } = paymentColumns({ rows, columns, exclude: months.map(entry => entry.column) });
  // Aylık ücret / aidat / kira bedeli kolonu (takvim motorunun "kendi tutar" kolonu): varsa ay hücresindeki tutar ödemedir.
  const feeColumn = months.find(entry => entry.amountColumn)?.amountColumn || null;
  const result = { plan: false, reason: null, totalColumn, paidColumn, remainingColumn, feeColumn };
  const currentMonth = Date.UTC(now.getFullYear(), now.getMonth(), 1);
  let withAmounts = 0;
  let future = 0;
  let filled = 0;
  let amountCells = 0;
  for (const row of rows) {
    let any = false;
    let ahead = false;
    for (const entry of months) {
      const text = String(cell(row, entry.column) ?? "").trim();
      if (!text || isEmptyCell(text) || notDue(text)) continue;
      filled += 1;
      const amount = amountIn(text);
      if (amount === null) continue;
      amountCells += 1;
      any = true;
      if (entry.time > currentMonth) ahead = true;
    }
    if (!any) continue;
    withAmounts += 1;
    if (ahead) future += 1;
  }
  // Aylık ücret kolonu varsa ay hücresi ödeme kaydıdır (gelecek aya yazılan tutar peşin ödemedir); plan sayılmaz.
  if (!withAmounts || feeColumn) return result;
  if (amountCells / Math.max(filled, 1) >= LEDGER.amountShare) return { ...result, plan: true, reason: "amounts" };
  if (future / withAmounts >= LEDGER.planShare) return { ...result, plan: true, reason: "future" };
  return result;
}

// Tahsilat notundaki aylar ("eylül taksiti", "Ekim ödemesi · Ekim 2026", "Kasım-Aralık 2026") → [{month, year|null}].
const NOTE_MONTHS = { ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6, temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12 };
export function monthsInText(text) {
  const folded = foldText(text);
  if (!folded) return [];
  const found = [];
  const pattern = /\b(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)\b(?:\s*(?:ayi|ayina|ayinin|ay)?\s*(\d{4}))?/g;
  let match;
  while ((match = pattern.exec(folded))) found.push({ month: NOTE_MONTHS[match[1]], year: match[2] ? Number(match[2]) : null });
  // Tek yıl yazılmışsa ("Kasım-Aralık 2026") yılı olmayan aylara da uygulanır.
  const years = [...new Set(found.map(item => item.year).filter(Boolean))];
  if (years.length === 1) for (const item of found) item.year ??= years[0];
  const seen = new Set();
  return found.filter(item => {
    const key = `${item.month}|${item.year}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Bir kaydın ay hücrelerini taksit satırlarına çevirir.
 * @param {object} input
 * @param {object} input.row
 * @param {Array<{column:string, time:number, label:string, amountColumn?:string|null}>} input.months  ay kolonları (zaman sırasında olmak zorunda değil)
 * @param {string|null} [input.startColumn]  başlangıç / kayıt tarihi kolonu
 * @param {string|null} [input.endColumn]    bitiş / ayrılış tarihi kolonu
 * @param {Date} input.now
 * @returns {{start:number|null, end:number|null, open:boolean, dormant:{lastWritten:number, emptyMonths:number}|null, rows:Array<{column:string, time:number, label:string, state:string, fee:number|null, paidAmount:number|null, amount:number|null}>}}
 */
export function installmentLedger({ row, months, startColumn = null, endColumn = null, now = new Date(), plan = null }) {
  const empty = { start: null, end: null, open: false, dormant: null, rows: [] };
  if (!row || !months?.length) return empty;
  const currentMonth = Date.UTC(now.getFullYear(), now.getMonth(), 1);
  const ordered = [...months].sort((a, b) => a.time - b.time);
  if (plan?.plan) return planLedger({ row, ordered, plan, startColumn, endColumn });
  const feeOf = entry => (entry.amountColumn ? parseAmount(cell(row, entry.amountColumn)) : null);
  const written = ordered.filter(entry => {
    const text = String(cell(row, entry.column) ?? "").trim();
    return text && (!isEmptyCell(text) || notDue(text));
  });
  const boundStart = startColumn ? monthOfValue(cell(row, startColumn)) : null;
  const boundEnd = endColumn ? monthOfValue(cell(row, endColumn)) : null;

  let start = boundStart;
  if (start === null && written.length) start = written[0].time;
  if (start === null) {
    // Hiçbir ay yazılmamış: ücreti belli yeni kayıt için yalnız bu ay; ücret de yoksa taksit yok.
    const fee = ordered.some(entry => (feeOf(entry) || 0) > 0);
    if (!fee) return empty;
    start = currentMonth;
  }

  let end = boundEnd;
  let dormant = null;
  let open = end === null;
  if (end === null && written.length) {
    const lastWritten = written[written.length - 1].time;
    // Son yazılı ay ile bu ay arasındaki tam boş aylar (bu ay sayılmaz: henüz ödenmemiş olabilir).
    const gap = monthIndex(currentMonth) - monthIndex(lastWritten) - 1;
    if (gap >= LEDGER.dormantMonths) {
      end = lastWritten;
      open = false;
      dormant = { lastWritten, emptyMonths: gap };
    }
  }
  // Bitiş yazılıysa ve gelecekteyse kayıt açık sayılır; bu ayın ötesi zaten beklenmez.
  const upper = end === null ? Math.max(currentMonth, monthStartOf(start)) : Math.min(end, currentMonth);
  const rows = [];
  for (const entry of ordered) {
    if (entry.time < start || entry.time > upper) continue; // aralık dışı: hiçbir satır açılmaz
    const fee = feeOf(entry);
    const { state, paidAmount } = cellState(cell(row, entry.column), fee);
    if (state === "skip") continue;
    const amount = fee && fee > 0 ? (state === "partial" && paidAmount ? Math.round((fee - paidAmount) * 100) / 100 : state === "paid" ? 0 : fee) : null;
    rows.push({ column: entry.column, time: entry.time, label: entry.label, state, fee: fee && fee > 0 ? fee : null, paidAmount, amount });
  }
  return { start, end, open, dormant, rows };
}

/**
 * Ödeme kipindeki ay matrisinin TÜM dönemi (v2.0.8, tablodan taksit kartına aktarma): takvim yalnız bugüne kadarki
 * ayları bekler; karta aktarırken dönemin kalan ayları da taksittir. Dönem: başlangıç (kayıt tarihi kolonu, yoksa ilk yazılı
 * ay) → bitiş (ayrılış tarihi kolonu; yoksa tablodaki son ay kolonu; son yazılı aydan sonra üst üste `dormantMonths` tam boş
 * ay geçmişse son yazılı ay — ayrılmış olabilir). "–", "muaf", "burslu" yazılı ay taksit değildir.
 * Her ayın tutarı aylık ücret kolonundan; ücret yoksa hücreye yazılan ödeme tutarı. Hücredeki tutar ücreti aşarsa fazlası
 * `extraPaid` olarak döner (sonraki açık aylara sayılır).
 * @returns {{ start:number|null, end:number|null, dormant:{lastWritten:number, emptyMonths:number}|null, extraPaid:number,
 *   rows: Array<{ column:string, time:number, label:string, amount:number|null, paid:number, state:string }> }}
 */
export function seasonLedger({ row, months, startColumn = null, endColumn = null, now = new Date() }) {
  const empty = { start: null, end: null, dormant: null, extraPaid: 0, rows: [] };
  if (!row || !months?.length) return empty;
  const currentMonth = Date.UTC(now.getFullYear(), now.getMonth(), 1);
  const ordered = [...months].sort((a, b) => a.time - b.time);
  const feeOf = entry => {
    const fee = entry.amountColumn ? parseAmount(cell(row, entry.amountColumn)) : null;
    return fee !== null && fee > 0 ? fee : null;
  };
  const written = ordered.filter(entry => {
    const text = String(cell(row, entry.column) ?? "").trim();
    return text && (!isEmptyCell(text) || notDue(text));
  });
  const boundStart = startColumn ? monthOfValue(cell(row, startColumn)) : null;
  const boundEnd = endColumn ? monthOfValue(cell(row, endColumn)) : null;
  let start = boundStart;
  if (start === null && written.length) start = written[0].time;
  if (start === null) {
    if (!ordered.some(entry => feeOf(entry))) return empty;
    start = Math.max(ordered[0].time, Math.min(currentMonth, ordered.at(-1).time));
  }
  let end = boundEnd;
  let dormant = null;
  if (end === null && written.length) {
    const lastWritten = written.at(-1).time;
    const gap = monthIndex(currentMonth) - monthIndex(lastWritten) - 1;
    if (gap >= LEDGER.dormantMonths) {
      end = lastWritten;
      dormant = { lastWritten, emptyMonths: gap };
    }
  }
  if (end === null) end = ordered.at(-1).time;
  const rows = [];
  let extraPaid = 0;
  for (const entry of ordered) {
    if (entry.time < start || entry.time > end) continue;
    const fee = feeOf(entry);
    const { state, paidAmount } = cellState(cell(row, entry.column), fee);
    if (state === "skip") continue;
    const written = paidAmount !== null && paidAmount > 0 ? paidAmount : null;
    const amount = fee ?? (state !== "due" ? written : null);
    let paid = 0;
    if (state === "paid") paid = amount ?? 0;
    else if (state === "partial") paid = written ?? 0;
    if (written !== null && amount !== null && written > amount + 0.004) extraPaid += written - amount;
    rows.push({ column: entry.column, time: entry.time, label: entry.label, amount, paid: Math.round(Math.min(paid, amount ?? paid) * 100) / 100, state });
  }
  return { start, end, dormant, extraPaid: Math.round(extraPaid * 100) / 100, rows };
}

// Plan kipi: yalnız tutar (ya da ödeme işareti) yazılı aylar taksittir; geçerlilik aralığı ilk ve son planlı aydır
// (başlangıç/bitiş kolonu varsa o). Plan bittiyse kayıt "durgun" sayılmaz: ödenecek başka taksit yoktur.
function planLedger({ row, ordered, plan, startColumn, endColumn }) {
  const boundStart = startColumn ? monthOfValue(cell(row, startColumn)) : null;
  const boundEnd = endColumn ? monthOfValue(cell(row, endColumn)) : null;
  const lines = [];
  for (const entry of ordered) {
    if (boundStart !== null && entry.time < boundStart) continue;
    if (boundEnd !== null && entry.time > boundEnd) continue;
    const text = String(cell(row, entry.column) ?? "").trim();
    if (!text || isEmptyCell(text) || notDue(text)) continue; // boş ay: planda taksit yok, satır açılmaz
    const folded = foldText(text);
    const fee = amountIn(text) ?? (entry.amountColumn ? parseAmount(cell(row, entry.amountColumn)) : null);
    const paidMark = SETTLED_MARK.test(folded) || MARK_ONLY.test(text);
    if (!paidMark && fee === null) continue; // ne tutar ne işaret: taksit sayılmaz
    lines.push({ column: entry.column, time: entry.time, label: entry.label, state: paidMark ? "paid" : "due", fee: fee && fee > 0 ? fee : null, paidAmount: paidMark ? fee : null, amount: paidMark ? 0 : fee });
  }
  // Ödenen tutar: "Ödenen" kolonu, yoksa Toplam − Kalan. En eski taksitten başlayarak düşülür.
  let paid = plan.paidColumn ? parseAmount(cell(row, plan.paidColumn)) : null;
  if (paid === null && plan.remainingColumn && plan.totalColumn) {
    const total = parseAmount(cell(row, plan.totalColumn));
    const remaining = parseAmount(cell(row, plan.remainingColumn));
    if (total !== null && remaining !== null) paid = Math.max(0, total - remaining);
  }
  // "Ödenen" (ya da Toplam − Kalan) o güne kadar ödenen TOPLAM'dır: hücresinde "ödendi" yazan ayların tutarı zaten bu
  // toplamın içindedir, yeniden dağıtılmaz (v2.0.8; önceden işaretli ay + Ödenen iki kez sayılıyordu).
  if (paid && paid > 0) paid -= lines.reduce((sum, line) => sum + (line.state === "paid" ? line.fee || 0 : 0), 0);
  if (paid && paid > 0) {
    let left = paid;
    for (const line of lines) {
      if (line.state === "paid" || line.amount === null || left <= 0.004) continue;
      const used = Math.min(line.amount, left);
      left -= used;
      line.paidAmount = used;
      line.amount = Math.round((line.amount - used) * 100) / 100;
      line.state = line.amount <= 0.004 ? "paid" : "partial";
    }
  }
  const start = lines.length ? lines[0].time : boundStart;
  const end = lines.length ? lines[lines.length - 1].time : boundEnd;
  return { start, end, open: false, dormant: null, rows: lines, plan: true };
}
