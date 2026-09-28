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
import { cell } from "./columns.mjs";
import { isEmptyCell } from "./cells.mjs";
import { foldText, parseAmount, parseDate } from "./validators.mjs";

export const LEDGER = { dormantMonths: 3 };
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
export function installmentLedger({ row, months, startColumn = null, endColumn = null, now = new Date() }) {
  const empty = { start: null, end: null, open: false, dormant: null, rows: [] };
  if (!row || !months?.length) return empty;
  const currentMonth = Date.UTC(now.getFullYear(), now.getMonth(), 1);
  const ordered = [...months].sort((a, b) => a.time - b.time);
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
