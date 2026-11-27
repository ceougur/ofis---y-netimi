// DONDURULMUŞ KOPYA — v2.4.9 (ccf0b0ca) türetme kuralı; tools/kural-kopyasi-249.mjs üretir. DEĞİŞTİRMEYİN (docs/erp/C3-DONDURMA-TASARIM.md §5).
// Kaynak: v2.4.9 server/lib/bank/doubtful.mjs satır 25–26, 30–39, 41–68 (hasTable / hasDoubtful, kayıt ve karşılık sorguları, doubtfulRows) — AYNEN.
import { DOUBTFUL_REASONS, doubtfulControl } from "./doubtful-gl.mjs";

const hasTable = (store, name) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", name));
export const hasDoubtful = store => hasTable(store, "doubtful_receivables");
const RECORD_SQL = `SELECT d.id, d.rowid AS seq, d.account_id AS party, d.date, d.amount_minor AS amountMinor, d.reason, d.note, d.cheque_id AS chequeId, d.status,
    d.closed_date AS closedDate, d.event_id AS eventId, d.close_event_id AS closeEventId, d.created_by AS createdBy, d.created_at AS createdAt,
    COALESCE(a.type, '') AS accountType, COALESCE(a.name, '') AS accountName, COALESCE(a.ref_no, '') AS accountRefNo, a.deleted_at AS accountDeletedAt,
    COALESCE(c.serial_no, '') AS chequeSerialNo, COALESCE(c.instrument, '') AS chequeInstrument,
    COALESCE(e.no, '') AS eventNo, COALESCE(x.no, '') AS closeEventNo
  FROM doubtful_receivables d LEFT JOIN accounts a ON a.id = d.account_id LEFT JOIN cheques c ON c.id = d.cheque_id AND d.cheque_id <> ''
    LEFT JOIN fin_events e ON e.id = d.event_id LEFT JOIN fin_events x ON x.id = d.close_event_id AND d.close_event_id <> ''`;
const PROVISION_SQL = `SELECT p.id, p.doubtful_id AS recordId, p.date, p.amount_minor AS amountMinor, p.note, p.status, p.event_id AS eventId, COALESCE(e.no, '') AS eventNo
  FROM doubtful_provisions p LEFT JOIN fin_events e ON e.id = p.event_id`;
const withControl = row => ({ ...row, control: doubtfulControl(row.accountType), reasonLabel: DOUBTFUL_REASONS[row.reason] || row.reason });

/**
 * Yevmiyenin ve beklenenlerin kayıtları: silinmemiş carinin iptal edilmemiş kayıtları ve etkin karşılıkları. parties: yalnız bu cariler
 * (dokunulan varlıklar süzgeci; routes/ledger.mjs rows). Tablo yoksa boş.
 */
export function doubtfulRows(store, { parties = null } = {}) {
  if (!hasDoubtful(store)) return { records: [], provisions: [] };
  const list = parties ? JSON.stringify([...parties]) : null;
  if (list === "[]") return { records: [], provisions: [] };
  // Süzgeçli okuma (kapının dokunulan varlıklar yolu; test/banka-210-kapi-plan.test.mjs): kimlik listesinden başlar (json_each CROSS JOIN →
  // idx_doubtful_receivables_account → idx_doubtful_provisions_record), cari ve başlık birincil anahtarla; silinme/durum kolonlarının indeksi
  // tekli + ile kapalı (istatistiksiz planlayıcı accounts.deleted_at indeksini seçip tabloyu dolaşıyordu).
  const records = list
    ? store.all(`${RECORD_SQL.replace("FROM doubtful_receivables d", "FROM json_each(?) j CROSS JOIN doubtful_receivables d ON d.account_id = j.value")} WHERE +a.deleted_at IS NULL AND +d.status <> 'cancelled' ORDER BY d.date, d.rowid`, list).map(withControl)
    : store.all(`${RECORD_SQL} WHERE +a.deleted_at IS NULL AND +d.status <> 'cancelled' ORDER BY d.date, d.rowid`).map(withControl);
  const provisions = list
    ? store.all(
        `SELECT p.id, p.doubtful_id AS recordId, p.date, p.amount_minor AS amountMinor, p.note, p.status, p.event_id AS eventId, COALESCE(e.no, '') AS eventNo
         FROM json_each(?) j CROSS JOIN doubtful_receivables d ON d.account_id = j.value CROSS JOIN doubtful_provisions p ON p.doubtful_id = d.id
           JOIN accounts a ON a.id = d.account_id LEFT JOIN fin_events e ON e.id = p.event_id
         WHERE +a.deleted_at IS NULL AND +p.status = 'active' AND +d.status <> 'cancelled' ORDER BY p.date, p.rowid`,
        list,
      )
    : store.all(
        `${PROVISION_SQL} JOIN doubtful_receivables d ON d.id = p.doubtful_id JOIN accounts a ON a.id = d.account_id
         WHERE +a.deleted_at IS NULL AND +p.status = 'active' AND +d.status <> 'cancelled' ORDER BY p.date, p.rowid`,
      );
  return { records, provisions };
}
