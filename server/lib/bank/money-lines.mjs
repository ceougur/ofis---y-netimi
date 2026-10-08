// "Para satırı" tanımı tek yerde (v2.1.0; docs/BANKA-MODULU-PLAN.md §3.4 K5, §3.3/b K6).
//
// moneyLines'ın 9 kaynağı: Kasa'yı, bankayı ya da POS'u gerçekten değiştiren satırlar. Aynı tanımdan hem SQL koşulu (sorgular,
// COMMIT öncesi money:event denetimi) hem JS yüklemi (bank.eventFor, bank.assertNonMoney) üretilir; iki ayrı yazım yoktur.
// Para olmayan satırlar bu tanıma girmez: cari Borç Yaz / Alacak Yaz ve açılışı, fatura borcu/alacağı, çekten ve stoktan gelen
// cari satırı (source 'cheque' / 'stock'), taksit açılışı (opening = 1) ve çekle sayılan taksit tahsilatı (cheque_id dolu), açık
// hesaba ya da yalnız miktar olarak yazılan stok hareketi, çekin alındı/verildi/ciro/karşılıksız olayları.
// (Aşama 2 dilim 4: moneyLines özet ve satır sorguları bu kaynaklardan kurulur.)

/** Kaynak: tablo + koşullar ([kolon, izinli değerler, boşluk değeri]) + isteğe bağlı "sıfırdan büyük" kolon. */
export const MONEY_SOURCES = Object.freeze([
  { id: 1, table: "payments", when: [] },
  // Kasa elle girişleri ve Kasa ↔ Banka transferinin iki bacağı.
  { id: 2, table: "cash_entries", when: [] },
  { id: 3, table: "account_entries", when: [["source", [""], ""], ["kind", ["in", "out"], ""]] },
  { id: 4, table: "account_entries", when: [["source", ["invoice"], ""], ["kind", ["in", "out"], ""]] },
  // POS kesintisi, komisyon tahsili, komisyon iadesi (Aşama 10'da yazılır).
  { id: 5, table: "account_entries", when: [["source", ["bank"], ""]] },
  { id: 6, table: "plan_entries", when: [["cheque_id", [""], ""], ["opening", [0], 0]] },
  { id: 7, table: "stock_moves", when: [["pay", ["cash"], ""]], positive: "amount" },
  { id: 8, table: "cheque_events", when: [["kind", ["collect", "pay"], ""]] },
  { id: 9, table: "bank_lines", when: [["role", ["bank", "pos", "card", "loan"], ""]] },
]);

/** Para satırı taşıyan tablolar (kaynak tabloları). */
export const SOURCE_TABLES = Object.freeze([...new Set(MONEY_SOURCES.map(source => source.table))]);
/** Modül satırı tabloları (event_id kolonu, bugünkü modüllerin yazdığı): bank_lines Banka Fişi'dir. */
export const MODULE_TABLES = Object.freeze(["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]);
/** K6'nın para tabloları (§3.3/a): yazımı bank.post'tan, store.raw'dan ya da izinli listeden geçer. */
export const LEDGER_TABLES = Object.freeze([...MODULE_TABLES, "bank_lines", "fin_events", "pos_sales", "pos_items", "cheque_collections"]);

// K6 (c) kapsamı dışındaki kolonlar: para satırının PARASINI değiştirmeyen yazımlar (açıklama, makbuz no, taksit/fatura/çek bağı,
// güncelleme damgası). İşlem başlığının kopyası (tutar, yol, yön, hesap, cari, tarih) bunlardan etkilenmez; bu kolonlara UPDATE
// bank.post bağlamı dışında da yapılabilir (fatura numarasının açıklamalara yazılması, taksitlerin yeniden kurulması gibi).
const COMMON_FREE = ["note", "updated_by", "updated_at"];
export const FREE_COLUMNS = Object.freeze({
  payments: new Set([...COMMON_FREE, "case_title"]),
  cash_entries: new Set([...COMMON_FREE, "description"]),
  account_entries: new Set([...COMMON_FREE, "receipt_no", "invoice_id"]),
  plan_entries: new Set([...COMMON_FREE, "receipt_no", "item_id"]),
  stock_moves: new Set([...COMMON_FREE]),
  cheque_events: new Set([...COMMON_FREE, "effects_json"]),
  bank_lines: new Set(["memo"]),
  fin_events: new Set(["description", "reference", "counter_name", "counter_iban", "channel", "updated_by", "updated_at"]),
});

const quote = value => (typeof value === "number" ? String(value) : `'${String(value).replace(/'/g, "''")}'`);
const conditionSql = (source, alias) => {
  const p = alias ? `${alias}.` : "";
  const parts = source.when.map(([column, values, empty]) => `COALESCE(${p}${column}, ${quote(empty)}) IN (${values.map(quote).join(", ")})`);
  if (source.positive) parts.push(`${p}${source.positive} > 0`);
  return parts.length ? `(${parts.join(" AND ")})` : "(1 = 1)";
};

/** Tablonun para satırı koşulu (SQL); tablo kaynak değilse null. alias: tablo takma adı (ör. "e"). */
export function moneyWhere(table, alias = "") {
  const sources = MONEY_SOURCES.filter(source => source.table === table);
  if (!sources.length) return null;
  return sources.length === 1 ? conditionSql(sources[0], alias) : `(${sources.map(source => conditionSql(source, alias)).join(" OR ")})`;
}

const valueOf = (row, column, empty) => {
  const value = row?.[column];
  if (value === undefined || value === null) return empty;
  if (typeof empty === "number") return typeof value === "boolean" ? Number(value) : Number(value);
  return String(value);
};
/** Satır (kolon adlarıyla) para satırı mı? Tanım moneyWhere ile aynı kaynaktan. */
export function isMoneyRow(table, row) {
  return MONEY_SOURCES.some(source => source.table === table && source.when.every(([column, values, empty]) => values.includes(valueOf(row, column, empty))) && (!source.positive || Number(row?.[source.positive]) > 0));
}
