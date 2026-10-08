// İşlem başlığı türleri (fin_events.type) — kod sözlüğü (v2.1.0; docs/BANKA-MODULU-PLAN.md §3.6). Tabloda CHECK yok: yeni tür
// eklemek tablo yeniden kurmayı gerektirmesin (cheques.status ve cheque_events.kind CHECK'lerinin dersi).
//
// Plandaki sözlüğe ek (bilinçli): cash_in / cash_out — Kasa penceresinden elle girilen nakit tahsilat ve ödeme (649 / 659). Plan
// bunlara ayrı tür vermemişti; diğer banka fişi türleriyle (other_in/other_out: 102 ↔ 649) karışmasın diye ayrıldı.
export const EVENT_TYPES = new Set([
  // Banka Fişi (Aşama 4+)
  "opening", "fee", "interest_in", "interest_out", "other_in", "other_out", "card_payment", "loan_draw", "loan_repay", "transfer", "fx_exchange", "revaluation", "carry_close",
  // POS (Aşama 9–10)
  "pos_settlement", "pos_sale", "pos_refund", "pos_cancel_refund",
  // Modül satırları (Aşama 2: bugünkü para yazıcıları)
  "cash_transfer", "cash_in", "cash_out", "party_in", "party_out", "invoice_cash", "plan_in", "plan_out", "record_in", "stock_cash", "cheque_collect", "cheque_pay",
  // Çek tahsile verme (Aşama 8), eski hareket atama (Aşama 3), ters kayıt (Aşama 4)
  "cheque_deposit", "cheque_withdraw", "legacy_assign", "reversal",
]);

/** Modül satırının olay türü (tablo + satırın kolonlarından). */
export function typeOf(table, row = {}) {
  switch (table) {
    case "payments":
      return "record_in";
    case "cash_entries":
      return row.transfer_id ? "cash_transfer" : row.kind === "out" ? "cash_out" : "cash_in";
    case "account_entries":
      return row.source === "invoice" ? "invoice_cash" : row.kind === "out" ? "party_out" : "party_in";
    case "plan_entries":
      return row.kind === "out" ? "plan_out" : "plan_in";
    case "stock_moves":
      return "stock_cash";
    case "cheque_events":
      return row.kind === "pay" ? "cheque_pay" : "cheque_collect";
    default:
      throw new TypeError(`Olay türü bilinmeyen tablo: ${table}`);
  }
}

/** Satırın Kasa/banka yönü (olay kopyasındaki "direction"): stokta satış Kasa'ya giriş, alım çıkış; çekte tahsil giriş, ödeme çıkış. */
export function directionOf(table, row = {}) {
  if (table === "payments") return "in";
  if (table === "stock_moves") return row.kind === "in" ? "out" : "in";
  if (table === "cheque_events") return row.kind === "pay" ? "out" : "in";
  return row.kind === "out" ? "out" : "in";
}
