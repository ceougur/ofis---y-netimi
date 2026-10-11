// İşlem başlığının (fin_events) salt okuma kopyası — tek tanım (v2.1.0; docs/BANKA-MODULU-PLAN.md §3.3 adım 5, §3.11 bank:event, §10.6).
//
// Kopya, olayın para satırından türetilen dizindir (para kaynağı satırın kendisidir): kaynak tablo/satır, yön, tutar (kuruş), yol, hesap
// (bank_ref = fin_ref), cari, fatura/kart/çek bağı ve tarih. Aynı kural üç yerde kullanılır: bank.post'un finalize'ı (yazımdan sonra
// kopyayı yeniler), açılış onarımı (eski sürümün değiştirdiği satırın kopyası) ve kapı denetimi (bank:event; SQL ifadeleri COPY_SQL —
// bağımsız ikinci yol: JS kopyası ile SQL beklenenin eşitliği denetlenir).
import { createHash } from "node:crypto";
import { toMinor } from "../minor.mjs";
import { NON_MONEY_TYPES, directionOf, typeOf } from "./event-types.mjs";
import { MODULE_TABLES } from "./money-lines.mjs";

const MODULE_SET = new Set(MODULE_TABLES);
/** Olay kopyasının alanları (fin_events kolonları). Gözden geçirme D1 (Aşama 2): tür (type) de satırdan türetilir — Kasa girişi çıkışa
 * çevrilince tür cash_in → cash_out, Taksite Aktar'da kayıt tahsilatı karta geçince record_in → plan_in. İşlem No (no, year, seq) kalıcı
 * kimliktir: tarih başka yıla düzeltilse de değişmez (§5.4 notu). */
export const COPY_FIELDS = Object.freeze(["src_table", "src_id", "type", "direction", "amount_minor", "try_minor", "currency", "method", "party_id", "invoice_id", "plan_id", "cheque_id", "date", "bank_ref"]);

const partyOf = (store, table, row) => {
  if (table === "account_entries" || table === "stock_moves") return String(row.account_id || "");
  if (table === "plan_entries") return String(store.get("SELECT account_id AS a FROM plans WHERE id = ?", row.plan_id)?.a || "");
  if (table === "cheque_events") return String(store.get("SELECT account_id AS a FROM cheques WHERE id = ?", row.cheque_id)?.a || "");
  return "";
};
const invoiceOf = (table, row) => {
  if (table === "account_entries") return row.source === "invoice" ? String(row.source_id || "") : "";
  if (table === "stock_moves" || table === "cheque_events") return String(row.invoice_id || "");
  return "";
};

/** Satırdan (kolon adlarıyla) olay kopyası. */
export function eventCopy(store, table, row) {
  const amount = toMinor(Math.abs(Number(row.amount) || 0));
  return {
    src_table: table,
    src_id: String(row.id),
    type: typeOf(table, row),
    direction: directionOf(table, row),
    amount_minor: amount,
    try_minor: amount,
    currency: "TRY",
    method: String(row.method || "cash"),
    party_id: partyOf(store, table, row),
    invoice_id: invoiceOf(table, row),
    plan_id: table === "plan_entries" ? String(row.plan_id || "") : "",
    cheque_id: table === "cheque_events" ? String(row.cheque_id || "") : "",
    date: String(row.date || ""),
    bank_ref: String(row.fin_ref || ""),
  };
}

// Transferde iki bacak aynı olayda: kopya banka bacağından (olayın "direction"ı bank_ref'e göre, §5.2).
export const primaryRow = rows => rows.find(item => item.table === "cash_entries" && item.row.method && item.row.method !== "cash") || rows[0];

/** Kasa ↔ Banka transferinin iki bacağı mı (tek olayı paylaşan tek meşru satır çifti)? */
export const isTransferPair = rows => rows.length === 2 && rows.every(item => item.table === "cash_entries" && item.row.transfer_id) && rows[0].row.transfer_id === rows[1].row.transfer_id;

/** Olayın para satırları (bütün modül tablolarında; Taksite Aktar satırı tablo değiştirir). */
export function eventRows(store, id) {
  // "event_id <> ''" kısmi indeksin (idx_<tablo>_event_id) kullanılması için yazılı (parametreden çıkarılamaz).
  return MODULE_TABLES.flatMap(table => store.all(`SELECT * FROM ${table} WHERE event_id = ? AND event_id <> ''`, id).map(row => ({ table, row })));
}

/** Kopyası satırlarından türetilen olay mı (modül satırı olayı; Banka Fişi ve para dışı türler değil)? */
export const isModuleEvent = event => Boolean(event) && MODULE_SET.has(event.src_table) && !NON_MONEY_TYPES.has(event.type);

/**
 * Olayın kopyasını satırlarından yeniler: satırı kalmayan olay "cancelled" (kopyası kalır), satırı olan olay "active" ve kopyası satırdan.
 * Dönüş: "cancelled" | "refreshed" | "same" | "skip" (modül olayı değil) | "missing".
 * stamp: { by, at } güncelleme damgası ya da null (yeni açılan olayda damga yazılmaz).
 */
export function refreshEvent(store, id, { stamp = null } = {}) {
  const event = store.get("SELECT * FROM fin_events WHERE id = ?", id);
  if (!event) return "missing";
  if (!isModuleEvent(event)) return "skip";
  const rows = eventRows(store, id);
  const touch = stamp ? { updated_by: stamp.by, updated_at: stamp.at } : {};
  if (!rows.length) {
    if (event.status === "cancelled") return "same";
    const columns = { status: "cancelled", ...touch };
    store.run(`UPDATE fin_events SET ${Object.keys(columns).map(key => `${key} = ?`).join(", ")} WHERE id = ?`, ...Object.values(columns), id);
    return "cancelled";
  }
  const primary = primaryRow(rows);
  const copy = { status: "active", ...eventCopy(store, primary.table, primary.row) };
  const changed = Object.keys(copy).filter(key => event[key] !== copy[key]);
  if (!changed.length) return "same";
  const columns = { ...Object.fromEntries(changed.map(key => [key, copy[key]])), ...touch };
  store.run(`UPDATE fin_events SET ${Object.keys(columns).map(key => `${key} = ?`).join(", ")} WHERE id = ?`, ...Object.values(columns), id);
  return "refreshed";
}

/**
 * Ekstre eşleşmesinin "özet"i (bank_matches.digest; §3.13, §10.6/b): eşleşme anındaki kopyanın tutar, yön, hesap, tarih, para birimi ve
 * yolu. Eşleşmiş olayın satırı sonradan değişirse özet değişir (eşleşme geçersizdir).
 */
export function eventDigest(copy) {
  const key = [Number(copy.amount_minor) || 0, String(copy.direction || ""), String(copy.bank_ref || ""), String(copy.date || ""), String(copy.currency || "TRY"), String(copy.method || "")];
  return createHash("sha256").update(JSON.stringify(key)).digest("hex").slice(0, 32);
}

// ---------- Kapı denetimi için SQL karşılıkları (r = satır) ----------
const KIND_DIRECTION = "CASE WHEN r.kind = 'out' THEN 'out' ELSE 'in' END";
/** Kopyanın satırdan beklenen değerleri (SQL). JS karşılıkları yukarıda (eventCopy); ikisi bağımsız yazılmıştır. */
export const COPY_SQL = Object.freeze({
  payments: { type: "'record_in'", direction: "'in'", party: "''" },
  cash_entries: { type: "CASE WHEN COALESCE(r.transfer_id, '') <> '' THEN 'cash_transfer' WHEN r.kind = 'out' THEN 'cash_out' ELSE 'cash_in' END", direction: KIND_DIRECTION, party: "''" },
  account_entries: { type: "CASE WHEN r.source = 'invoice' THEN 'invoice_cash' WHEN r.kind = 'out' THEN 'party_out' ELSE 'party_in' END", direction: KIND_DIRECTION, party: "COALESCE(r.account_id, '')" },
  plan_entries: { type: "CASE WHEN r.kind = 'out' THEN 'plan_out' ELSE 'plan_in' END", direction: KIND_DIRECTION, party: "COALESCE((SELECT p.account_id FROM plans p WHERE p.id = r.plan_id), '')" },
  stock_moves: { type: "'stock_cash'", direction: "CASE WHEN r.kind = 'in' THEN 'out' ELSE 'in' END", party: "COALESCE(r.account_id, '')" },
  cheque_events: { type: "CASE WHEN r.kind = 'pay' THEN 'cheque_pay' ELSE 'cheque_collect' END", direction: "CASE WHEN r.kind = 'pay' THEN 'out' ELSE 'in' END", party: "COALESCE((SELECT c.account_id FROM cheques c WHERE c.id = r.cheque_id), '')" },
});
/** Olay kopyası ↔ satır uyuşmazlığının SQL koşulu (e = fin_events, r = kaynak satır; LEFT JOIN). */
export function copyMismatchSql(table) {
  const spec = COPY_SQL[table];
  return `(r.id IS NULL
    OR e.type <> ${spec.type}
    OR e.amount_minor <> CAST(ROUND(ABS(r.amount) * 100) AS INTEGER)
    OR e.direction <> ${spec.direction}
    OR e.method <> CASE WHEN COALESCE(r.method, '') = '' THEN 'cash' ELSE r.method END
    OR e.date <> COALESCE(r.date, '')
    OR e.bank_ref <> COALESCE(r.fin_ref, '')
    OR e.party_id <> ${spec.party})`;
}
