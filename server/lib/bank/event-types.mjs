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
  // Aşama 3 (plana ek, bilinçli): Hesabı Atanmamış POS/kart bakiyesinin aktarımı — "Bankaya Geçmiş Say" (B 102.k / A 108.00) ve "Kart
  // Borcuna Aktar" (B 108.00 / A 309.k), §10.3. Şirketin kendi hesapları arasında iç harekettir.
  "legacy_reclass",
]);

// İç hareket (§3.4 internal): şirketin kendi hesapları arasında para geçişi (Kasa ↔ Banka, bankalar arası, kredi kullanımı/geri ödemesi,
// döviz al/sat, POS valör geçişi, kurumsal kart borcunun ödenmesi). Banka görünümlerinin "Bugün/Bu Ay" giriş-çıkışında sayılmaz.
export const INTERNAL_TYPES = new Set(["cash_transfer", "transfer", "loan_draw", "loan_repay", "fx_exchange", "pos_settlement", "card_payment", "legacy_reclass"]);
// Para satırı taşımayan işlem başlıkları (§3.11 bank:event): kendi tablolarıyla denetlenir (tahsile verilen çek, eski hareket atama, POS
// iptal iadesi); kopya = satır denetimine girmez.
export const NON_MONEY_TYPES = new Set(["cheque_deposit", "cheque_withdraw", "legacy_assign", "pos_cancel_refund"]);

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

// ---------- Aşama 4: Banka Fişi türleri ve adlar ----------
/** Banka penceresinden (POST /bank/vouchers) girilen Banka Fişi türleri (§3.7 #12, #14–18). transfer (Aşama 9) ve döviz (Aşama 13) ayrı uçta. */
export const VOUCHER_TYPES = Object.freeze(["fee", "interest_in", "interest_out", "other_in", "other_out", "card_payment", "loan_draw", "loan_repay"]);
const VOUCHER_SET = new Set(VOUCHER_TYPES);
export const isVoucherType = type => VOUCHER_SET.has(type);
/** Banka Fişi (satırları bank_lines'ta, Ters Kaydet / Düzelt ile değişen): Banka Fişi türleri + Bankalar Arası Transfer (Aşama 9; ayrı uçtan). */
export const isBankVoucherType = type => VOUCHER_SET.has(type) || type === "transfer";

/** İşlem türünün adı (ekranda, İşlem Kartı'nda, Hareketler'de; başlık yazımı). Yöne bağlı türlerde yön verilir. */
const TYPE_LABELS = Object.freeze({
  opening: "Açılış Bakiyesi",
  fee: "Banka Masrafı",
  interest_in: "Faiz Geliri",
  interest_out: "Faiz Gideri",
  other_in: "Diğer Gelir",
  other_out: "Diğer Gider",
  card_payment: "Kart Borcu Ödemesi",
  loan_draw: "Kredi Kullanımı",
  loan_repay: "Kredi Geri Ödemesi",
  transfer: "Bankalar Arası Transfer",
  fx_exchange: "Döviz Alım Satımı",
  revaluation: "Kur Değerlemesi",
  carry_close: "Devir Kapanışı",
  pos_settlement: "POS Valör Geçişi",
  pos_sale: "POS Satışı",
  pos_refund: "POS İadesi",
  pos_cancel_refund: "POS İptal İadesi",
  cash_transfer: "Kasa ile Banka Arası",
  cash_in: "Kasa Girişi",
  cash_out: "Kasa Çıkışı",
  party_in: "Cari Tahsilatı",
  party_out: "Cari Ödemesi",
  plan_in: "Taksit Tahsilatı",
  plan_out: "Taksit İadesi",
  record_in: "Kayıt Tahsilatı",
  cheque_collect: "Çek ve Senet Tahsili",
  cheque_pay: "Çek ve Senet Ödemesi",
  cheque_deposit: "Bankaya Tahsile Ver",
  cheque_withdraw: "Bankadan Geri Al",
  legacy_assign: "Kurulum ve Aktarım",
  legacy_reclass: "Eski Bakiye Aktarımı",
  reversal: "Ters Kayıt",
});
export function typeLabel(type, direction = "") {
  if (type === "invoice_cash") return direction === "out" ? "Fatura Ödemesi" : "Fatura Tahsilatı";
  if (type === "stock_cash") return direction === "out" ? "Stok Alımı" : "Stok Satışı";
  return TYPE_LABELS[type] || type;
}
export const STATUS_LABELS = Object.freeze({ active: "Etkin", reversed: "Ters Kaydedildi", cancelled: "İptal Edildi" });

/**
 * Hareketler süzgecindeki tür grupları (?type=): bir ya da birden çok işlem türü. "fee" ayrıca KDV'li masrafın (fatura + havale) ödeme
 * satırını kapsar (masraf başlığı faturaya bağlı; lib/bank/movements.mjs).
 */
export const TYPE_GROUPS = Object.freeze({
  fee: ["fee"],
  interest: ["interest_in", "interest_out"],
  other: ["other_in", "other_out"],
  card: ["card_payment"],
  loan: ["loan_draw", "loan_repay"],
  opening: ["opening"],
  reversal: ["reversal"],
  party: ["party_in", "party_out"],
  invoice: ["invoice_cash"],
  plan: ["plan_in", "plan_out"],
  record: ["record_in"],
  stock: ["stock_cash"],
  cheque: ["cheque_collect", "cheque_pay"],
  cash: ["cash_transfer"],
  transfer: ["transfer"],
  legacy: ["carry_close", "legacy_reclass"],
});

/** Süzgeç türlerinin adları (Hareketler → İşlem Türü; başlık yazımı). Liste 2.1.0'da kaydı olabilen türlerdir (yarım özellik görünmez, §12.1). */
export const GROUP_LABELS = Object.freeze({
  fee: "Banka Masrafı",
  interest: "Faiz",
  other: "Diğer Gelir ve Gider",
  card: "Kart Borcu Ödemesi",
  loan: "Kredi",
  opening: "Açılış Bakiyesi",
  reversal: "Ters Kayıt",
  party: "Cari Tahsilat ve Ödeme",
  invoice: "Fatura Tahsilat ve Ödeme",
  plan: "Taksit Tahsilat ve İadesi",
  record: "Kayıt Tahsilatı",
  stock: "Stok Satış ve Alımı",
  cheque: "Çek ve Senet",
  cash: "Kasa ile Banka Arası",
  transfer: "Bankalar Arası Transfer",
  legacy: "Kurulum ve Aktarım",
});
