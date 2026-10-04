// Fatura kapama (v2.0.15; v2.0.17 yöne göre) — hangi fatura ne kadar ödendi, neyle kapandı? Saf fonksiyon; veritabanına
// dokunmaz (yol, raporlar ve testler aynı kuralı kullanır).
//
// Kural (Logo / Mikro / SAP'deki "fatura kapama"nın otomatik FIFO karşılığı):
//   1. Faturaya bağlı ödeme önce kendi faturasını kapatır: fatura kesilirken alınan peşin tahsilat/ödeme, faturayla
//      alınan/verilen çek-senet ve ciro, faturanın taksit kartına yapılan tahsilatlar, iade faturasının alacağı (asıl
//      faturaya), cari kartından "Kapatılacak Fatura" seçilerek girilen tahsilat/ödeme, mahsup fişi. Bağlı ödeme faturadan
//      fazlaysa artanı genel havuza düşer.
//   2. Kalan ödemeler (bağsız tahsilat, artanlar) en eski yükümlülükten başlayarak dağıtılır (FIFO).
//
// v2.0.17 (müşteri: "hayalet kısmi ödeme"): ödeme YÖNE göre sayılır. Alacak tarafında (satış, SMM) yalnız ödeme
// niteliğindeki alacak satırları kapatır: tahsilat (Kasa/banka/POS), alınan çek/senet, satıştan iade, taksit tahsilatı.
// Aynı cariye kesilen ALIŞ faturası, elle yazılan "Alacak" ya da taksit kartı kapatma ödeme DEĞİLDİR. Borç tarafında
// (alış) simetrik: ödeme, verilen çek/senet (ciro dahil), alıştan iade; SATIŞ faturası, elle "Borç", stoktan satış
// ödeme değildir. Satış ↔ alış karşılıklı kapama yalnız açık "Mahsup Et" ile (offsets). Cari bakiyesi bundan etkilenmez;
// bakiye zaten net.
//
// v2.0.23 (haftalık ekran testi, docs/EKRAN-HAFTA-TESTI-2026-10-04.md Bulgu 2): fatura ile taksit kartı aynı parayı iki
// kez saymaz, hiçbir tahsilat kaybolmaz:
//   - Faturasız, AYRI borç yazan kart (Taksitler → "Yeni Borç", Taksit Excel'i / Tablodan Aktar, Toplu Taksitlendir) kendi
//     defteridir: borcu, tahsilatı, iadesi ve kapatılması (kalanın silinmesi) faturaları kapatmaz, en eski borç sırasına
//     girmez. Kartın borcunu aşan tahsilat (artan) genel havuza düşer.
//   - Taksitli fatura (faturanın kendi kartı) yalnız bağlı ödemelerle kapanır: peşinat, kartının tahsilatı, iade, mahsup.
//     Bağsız tahsilat onu en eski borç sırasıyla kapatmaz; böylece fatura açığı her zaman kartının kalanına eşittir.
import { roundMoney } from "./money.mjs";

const cents = value => Math.round((Number(value) || 0) * 100);
const RECEIVABLE = new Set(["sale", "smm"]);
const PAYABLE = new Set(["purchase"]);
export const PAY_STATES = Object.freeze({
  paid: "Ödendi",
  partial: "Kısmen Ödendi",
  open: "Açık",
  overdue: "Vadesi Geçti",
  installment: "Taksitte",
  return: "İade",
  draft: "Taslak",
  cancelled: "İptal",
});
export const CLOSER_MODES = Object.freeze({ linked: "Bağlı", auto: "Otomatik (en eski)", offset: "Mahsup" });

/**
 * Satırın kapamadaki rolü (yöne göre). Döndürülen nesnede yalnız geçerli roller true'dur:
 *   recvDue  alacak tarafında yükümlülük (müşteri bize borçlanır)   recvPay  alacak tarafında ödeme (müşteri öder)
 *   payDue   borç tarafında yükümlülük (biz tedarikçiye borçlanırız) payPay   borç tarafında ödeme (biz öderiz)
 * @param {object} line defter satırı; invoiceKind = origin "invoice" ise faturanın türü; chequeEvent = çek olayının türü
 */
export function classifyLine(line, { invoiceKind = "", chequeEvent = "" } = {}) {
  const debit = cents(line.debit) > 0;
  const credit = cents(line.credit) > 0;
  const role = { recvDue: false, recvPay: false, payDue: false, payPay: false };
  if (!debit && !credit) return role;
  switch (line.origin) {
    case "invoice":
      if (line.kind === "in") role.recvPay = true;
      else if (line.kind === "out") role.payPay = true;
      else if (invoiceKind === "sale_return") role.recvPay = credit;
      else if (invoiceKind === "purchase_return") role.payPay = debit;
      else if (debit) role.recvDue = true;
      else role.payDue = true;
      break;
    case "cheque":
      // Alınan çek alacak yazar (ödeme); karşılıksız dönen çek borç yazar (yükümlülük yeniden açılır). Verilen çek ve
      // ciro borç yazar (ödeme); cirolu çek karşılıksız dönünce ciro edilen caride alacak (borcumuz yeniden açılır).
      if (chequeEvent === "bounce") {
        if (debit) role.recvDue = true;
        else role.payDue = true;
      } else if (credit) role.recvPay = true;
      else role.payPay = true;
      break;
    case "plan":
      if (line.kind === "plan-in" || line.kind === "plan-close") role.recvPay = true;
      else role.recvDue = true; // plan (borç), plan-out (taksit iadesi: borç yeniden açılır)
      break;
    case "stock":
      if (debit) role.recvDue = true;
      else role.payDue = true;
      break;
    default:
      // Cari kartı: Tahsilat/Ödeme ödemedir; "Borç Yaz" / "Alacak Yaz" (açılış dahil) yükümlülüktür, ödeme değildir.
      if (line.kind === "in") role.recvPay = true;
      else if (line.kind === "out") role.payPay = true;
      else if (debit) role.recvDue = true;
      else role.payDue = true;
  }
  return role;
}

/**
 * @param {{ lines: Array<{ id, origin, kind, sourceId?, planId?, date, at?, label?, note?, method?, debit, credit }>,
 *           invoices: Array<{ id, kind, status, payable, originalId?, dueDate?, planId?, schedule?: Array<{ dueDate, amount }> }>,
 *           links?: Map<string, string>, chequeEvents?: Map<string, string>,
 *           offsets?: Array<{ id, invoiceId, counterId, counterType: "invoice"|"entry", amount, date, note? }>, today: string }} input
 *   lines        : bir carinin defter satırları (accountLedger), tarih sırasında
 *   links        : defter satırı kimliği → fatura kimliği (peşin ödeme, çek/senet, ciro, seçilerek bağlanan tahsilat/ödeme)
 *   chequeEvents : çek/senet defter satırı kimliği → olay türü (receive/issue/endorse/bounce…)
 *   offsets      : mahsup fişleri (fatura ↔ karşı fatura ya da karşı cari satırı)
 * @returns {Map<string, { payable, paid, open, state, label, closers: Array<{ id, date, label, note, method, amount, mode }> }>}
 */
export function settleInvoices({ lines, invoices, links = new Map(), chequeEvents = new Map(), offsets = [], today }) {
  const out = new Map();
  const byId = new Map(invoices.map(invoice => [invoice.id, invoice]));
  const planOwner = new Map(invoices.filter(invoice => invoice.planId).map(invoice => [invoice.planId, invoice.id]));
  const ordered = [...lines].sort((a, b) => (a.date === b.date ? String(a.at || "").localeCompare(String(b.at || "")) : a.date < b.date ? -1 : 1));
  // v2.0.23: ayrı borç yazan (mevcut borcu taksitlendirmeyen) ve hiçbir faturanın kartı olmayan kartlar.
  const separatePlans = new Set(lines.filter(line => line.origin === "plan" && line.kind === "plan" && !line.covers && line.planId && !planOwner.has(line.planId)).map(line => line.planId));
  const kindOf = line => (line.origin === "invoice" ? byId.get(line.sourceId)?.kind || "" : "");
  // Satırın bağlı olduğu fatura (varsa): iade faturasının satırı asıl faturaya bağlıdır.
  const ownerOf = line => {
    let id = links.get(line.id) || (line.origin === "invoice" ? line.sourceId : "") || (line.planId ? planOwner.get(line.planId) : "") || "";
    const invoice = byId.get(id);
    if (invoice && (invoice.kind === "sale_return" || invoice.kind === "purchase_return")) id = invoice.originalId || "";
    return id;
  };
  const offsetsOf = (invoiceId, side) => {
    const list = [];
    for (const offset of offsets) {
      const amount = cents(offset.amount);
      if (!(amount > 0)) continue;
      if (offset.invoiceId === invoiceId) list.push({ offset, amount });
      else if (offset.counterType === "invoice" && offset.counterId === invoiceId) {
        // Karşı fatura öbür taraftadır: oradaki yükümlülüğü de aynı tutarda kapatır.
        const main = byId.get(offset.invoiceId);
        const counter = byId.get(invoiceId);
        if (main && counter && (side === "receivable" ? RECEIVABLE : PAYABLE).has(counter.kind)) list.push({ offset, amount });
      }
    }
    return list;
  };
  for (const side of ["receivable", "payable"]) {
    const kinds = side === "receivable" ? RECEIVABLE : PAYABLE;
    const dueKey = side === "receivable" ? "recvDue" : "payDue";
    const payKey = side === "receivable" ? "recvPay" : "payPay";
    // Yükümlülükler: sıra korunur; faturanınki fatura kimliğiyle işaretlenir.
    const obligations = [];
    const pool = [];
    const planBooks = new Map();
    for (const line of ordered) {
      const role = classifyLine(line, { invoiceKind: kindOf(line), chequeEvent: chequeEvents.get(line.id) || "" });
      const amount = cents(line.debit) || cents(line.credit);
      // Ayrı kartın satırları kartın kendi defterinde toplanır (fatura sırasına girmez).
      if (line.planId && separatePlans.has(line.planId)) {
        const book = planBooks.get(line.planId) || { due: 0, paid: 0, last: null };
        if (role[dueKey]) book.due += amount;
        if (role[payKey]) {
          book.paid += amount;
          book.last = line;
        }
        planBooks.set(line.planId, book);
        continue;
      }
      if (role[dueKey]) {
        const own = line.origin === "invoice" && kinds.has(kindOf(line)) ? line.sourceId : "";
        // Taksitli fatura (kendi kartı var) yalnız bağlı ödemeyle kapanır; en eski borç sırasında atlanır.
        obligations.push({ invoiceId: own, lineId: line.id, left: amount, closers: [], planned: Boolean(own && byId.get(own)?.planId) });
      }
      if (role[payKey]) pool.push({ line, owner: ownerOf(line), amount, left: amount, mode: links.has(line.id) ? "linked" : "" });
    }
    // Kartın borcunu aşan tahsilat (artan) genel havuza: son tahsilatın tarihiyle, tarih sırası korunarak.
    let excess = false;
    for (const [planId, book] of planBooks) {
      const extra = book.paid - book.due;
      if (extra > 0 && book.last) {
        pool.push({ line: { ...book.last, id: `plan-excess:${planId}`, label: "Taksit kartından artan ödeme" }, owner: "", amount: extra, left: extra, mode: "" });
        excess = true;
      }
    }
    if (excess) pool.sort((a, b) => (a.line.date === b.line.date ? String(a.line.at || "").localeCompare(String(b.line.at || "")) : a.line.date < b.line.date ? -1 : 1));
    const target = new Map(obligations.filter(item => item.invoiceId).map(item => [item.invoiceId, item]));
    const close = (item, payment, take, mode) => {
      item.left -= take;
      payment.left -= take;
      item.closers.push({ id: payment.line.id, date: payment.line.date, label: payment.line.label || "", note: payment.line.note || "", method: payment.line.method || "", amount: roundMoney(take / 100), mode });
    };
    // 0. Mahsup fişleri: iki tarafı da bağlı kapatır (fatura ↔ karşı belge).
    for (const [invoiceId, item] of target) {
      for (const { offset, amount } of offsetsOf(invoiceId, side)) {
        const take = Math.min(item.left, amount);
        if (take <= 0) continue;
        const other = offset.invoiceId === invoiceId ? offset.counterId : offset.invoiceId;
        close(item, { line: { id: `offset:${offset.id}`, date: offset.date, label: offset.label || "Mahsup", note: offset.note || other, method: "" }, left: amount }, take, "offset");
      }
    }
    // Mahsupta karşı taraf bir cari satırıysa (Alacak Yaz / Borç Yaz / açılış) o yükümlülük de aynı tutarda kapanır.
    for (const offset of offsets) {
      if (offset.counterType !== "entry") continue;
      const item = obligations.find(entry => !entry.invoiceId && entry.lineId === offset.counterId);
      if (item) item.left -= Math.min(item.left, cents(offset.amount));
    }
    // 1. Bağlı ödemeler kendi faturasına.
    for (const payment of pool) {
      const own = payment.owner && target.get(payment.owner);
      if (!own) continue;
      const take = Math.min(own.left, payment.left);
      if (take > 0) close(own, payment, take, payment.mode || "linked");
    }
    // 2. Kalanı en eski yükümlülükten başlayarak (ödemeler de tarih sırasında).
    let cursor = 0;
    for (const item of obligations) {
      if (item.planned) continue;
      while (item.left > 0 && cursor < pool.length) {
        const payment = pool[cursor];
        if (payment.left <= 0) {
          cursor += 1;
          continue;
        }
        close(item, payment, Math.min(item.left, payment.left), "auto");
      }
      if (cursor >= pool.length) break;
    }
    for (const [invoiceId, item] of target) {
      const invoice = byId.get(invoiceId);
      const payable = cents(invoice.payable);
      const open = Math.max(0, Math.min(payable, item.left));
      out.set(invoiceId, { payable: roundMoney(payable / 100), paid: roundMoney((payable - open) / 100), open: roundMoney(open / 100), closers: item.closers });
    }
  }
  for (const invoice of invoices) {
    let row = out.get(invoice.id) || { payable: roundMoney(Number(invoice.payable) || 0), paid: 0, open: 0, closers: [] };
    let state;
    if (invoice.status === "draft") state = "draft";
    else if (invoice.status === "cancelled") state = "cancelled";
    else if (invoice.kind === "sale_return" || invoice.kind === "purchase_return") state = "return";
    else if (!out.has(invoice.id)) {
      // Defterde satırı yok (olmamalı; mutabakat kapısı yakalar): açık say.
      row = { payable: row.payable, paid: 0, open: row.payable, closers: [] };
      state = "open";
    } else if (row.open <= 0.005) state = "paid";
    else if (Array.isArray(invoice.schedule) && invoice.schedule.length) {
      const dueByToday = invoice.schedule.filter(item => item.dueDate < today).reduce((sum, item) => sum + cents(item.amount), 0);
      // Bugüne kadar ödenmiş olması gereken: peşin kısım (fatura − taksit kartı) + vadesi geçmiş taksitler (bugün vadeli
      // taksit henüz gecikmiş sayılmaz).
      const expected = cents(Number(invoice.payable) - Number(invoice.planTotal ?? invoice.payable)) + dueByToday;
      state = expected - cents(row.paid) > 0 ? "overdue" : "installment";
    } else if (invoice.dueDate && invoice.dueDate < today) state = "overdue";
    else state = row.paid > 0 ? "partial" : "open";
    out.set(invoice.id, { ...row, state, label: PAY_STATES[state] });
  }
  return out;
}
