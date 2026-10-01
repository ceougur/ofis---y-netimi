// Fatura kapama (v2.0.15) — hangi fatura ne kadar ödendi? Saf fonksiyon; veritabanına dokunmaz (yol, raporlar ve
// testler aynı kuralı kullanır).
//
// Kural (Logo / Mikro / SAP'deki "fatura kapama"nın otomatik FIFO karşılığı):
//   1. Faturaya bağlı ödeme önce kendi faturasını kapatır: fatura kesilirken alınan peşin tahsilat/ödeme, faturayla
//      alınan/verilen çek-senet ve ciro, faturanın taksit kartına yapılan tahsilatlar, iade faturasının alacağı (asıl
//      faturaya). Bağlı ödeme faturadan fazlaysa artanı genel havuza düşer.
//   2. Kalan ödemeler (bağsız tahsilat, açılış alacağı, artanlar) en eski borçtan başlayarak dağıtılır (FIFO).
// Alacak tarafı (satış, SMM): carinin borç satırları yükümlülük, alacak satırları ödemedir. Borç tarafı (alış): carinin
// alacak satırları yükümlülük, borç satırları ödemedir. İade faturaları ödeme aracıdır; kendi durumları "İade"dir.
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

/**
 * @param {{ lines: Array<{ id, origin, kind, sourceId?, planId?, date, at?, debit, credit }>,
 *           invoices: Array<{ id, kind, status, payable, originalId?, dueDate?, planId?, schedule?: Array<{ dueDate, amount }> }>,
 *           links?: Map<string, string>, today: string }} input
 *   lines   : bir carinin defter satırları (accountLedger), tarih sırasında
 *   links   : defter satırı kimliği → fatura kimliği (peşin ödeme, çek/senet, ciro)
 * @returns {Map<string, { payable, paid, open, state, label }>}
 */
export function settleInvoices({ lines, invoices, links = new Map(), today }) {
  const out = new Map();
  const byId = new Map(invoices.map(invoice => [invoice.id, invoice]));
  const planOwner = new Map(invoices.filter(invoice => invoice.planId).map(invoice => [invoice.planId, invoice.id]));
  const ordered = [...lines].sort((a, b) => (a.date === b.date ? String(a.at || "").localeCompare(String(b.at || "")) : a.date < b.date ? -1 : 1));
  // Satırın bağlı olduğu fatura (varsa): iade faturasının satırı asıl faturaya bağlıdır.
  const ownerOf = line => {
    let id = links.get(line.id) || (line.origin === "invoice" ? line.sourceId : "") || (line.planId ? planOwner.get(line.planId) : "") || "";
    const invoice = byId.get(id);
    if (invoice && (invoice.kind === "sale_return" || invoice.kind === "purchase_return")) id = invoice.originalId || "";
    return id;
  };
  for (const side of ["receivable", "payable"]) {
    const kinds = side === "receivable" ? RECEIVABLE : PAYABLE;
    const obligationKey = side === "receivable" ? "debit" : "credit";
    const paymentKey = side === "receivable" ? "credit" : "debit";
    // Yükümlülükler: sıra korunur; faturanınki fatura kimliğiyle işaretlenir.
    const obligations = [];
    const pool = [];
    for (const line of ordered) {
      const due = cents(line[obligationKey]);
      const pay = cents(line[paymentKey]);
      if (due > 0) {
        const own = line.origin === "invoice" && byId.has(line.sourceId) && kinds.has(byId.get(line.sourceId).kind) ? line.sourceId : "";
        obligations.push({ invoiceId: own, left: due });
      }
      if (pay > 0) pool.push({ owner: ownerOf(line), amount: pay });
    }
    const target = new Map(obligations.filter(item => item.invoiceId).map(item => [item.invoiceId, item]));
    let free = 0;
    // 1. Bağlı ödemeler kendi faturasına.
    for (const payment of pool) {
      const own = payment.owner && target.get(payment.owner);
      if (!own) {
        free += payment.amount;
        continue;
      }
      const take = Math.min(own.left, payment.amount);
      own.left -= take;
      free += payment.amount - take;
    }
    // 2. Kalanı en eski yükümlülükten başlayarak.
    for (const item of obligations) {
      if (!free) break;
      const take = Math.min(item.left, free);
      item.left -= take;
      free -= take;
    }
    for (const [invoiceId, item] of target) {
      const invoice = byId.get(invoiceId);
      const payable = cents(invoice.payable);
      const open = Math.max(0, Math.min(payable, item.left));
      out.set(invoiceId, { payable: roundMoney(payable / 100), paid: roundMoney((payable - open) / 100), open: roundMoney(open / 100) });
    }
  }
  for (const invoice of invoices) {
    let row = out.get(invoice.id) || { payable: roundMoney(Number(invoice.payable) || 0), paid: 0, open: 0 };
    let state;
    if (invoice.status === "draft") state = "draft";
    else if (invoice.status === "cancelled") state = "cancelled";
    else if (invoice.kind === "sale_return" || invoice.kind === "purchase_return") state = "return";
    else if (!out.has(invoice.id)) {
      // Defterde satırı yok (olmamalı; mutabakat kapısı yakalar): açık say.
      row = { payable: row.payable, paid: 0, open: row.payable };
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
