// 2.5.0 Ç7a tur 2b — KG-6 (kural kitabı §9 "POS komisyonu tarihi ve hesabı: satış (çekim) günü (B komisyon hesabı / A 108; valörde net)"; KULLANICI KARARI 05.11 17:16 (5)
// KG-6 = A; S177 = A, S178 = A — 14.11.2026). docs/erp/C7A-BANKA-TASARIM.md §14.
// TEK TANIM: Ana Defter'in türetmesi (routes/ledger rows() → general-ledger journal), defter beklenenleri (money-lines groups — Defter Mutabakatı, Mutabakat Testi, kapı) ve
// Alt Hesap Mizanı (108.POS) bu dosyanın kümesini ve kesinti formülünü kullanır — biri değişip öbürü değişmezse Mutabakat Testi bank:sub:108.NN sapması gösterir.
//
// KÜME: POS kalemi (pos_items rol sale / refund, durum pending / settled) ∧ kaydı (pos_sales) void ya da repair DEĞİL ∧ kaydın vergi türü KDV DEĞİL (S178 = A: KDV kipinde
// kesinti sağlayıcıya borçtur, bugünkü gibi valör gününde). Kalemin kesintisi σ = komisyon + (vergi hariç kipte vergi) + sabit ücret kalemi, iade kaleminde eksi — gün fişinin
// dayTotals'ı ile AYNI formül (pos-math deductionOf + fee_minor; lib/bank/pos.mjs settleGroup).
//   Satış (iade) günü maddesi: kaydın tarihinde B komisyon hesabı / A 108.POS = Σσ (kaydın kümedeki bütün kalemleri — taksitli satışta bütün taksitler).
//   Etkin gün fişi: bağlı kalemlerinin Σσ'sı (S) maddenin 108 satırından ve gider satırından düşer (102 net değişmez). Kalan gider = Komisyon Farkı (S177 = A: valörün gününde).
// Süzgeçli kapı (events): kayıt kapsamı "kaydın işlem başlığı olaylarda", gün fişi kapsamı "gün fişi olaylarda" — iki taraf (türetme ve beklenen) AYNI SQL'den.

export const COMMISSION_GL_DEFAULT = "653";
/** Yevmiye maddesi kimliğinin öneki (general-ledger JOURNAL_CLASS 38: para / cari satırlarından sonra, Banka Fişi'nden önce). */
export const COMMISSION_ENTRY = "pos-commission";

const hasTable = (store, name) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", name));
export const commissionReady = store => hasTable(store, "pos_items") && hasTable(store, "pos_sales");

/** Kümenin koşulu (alias i = pos_items, s = pos_sales). */
const SCOPE = "s.status NOT IN ('void', 'repair') AND s.tax_kind <> 'vat' AND i.status IN ('pending', 'settled') AND i.role IN ('sale', 'refund')";
/** Kalemin işaretli kesintisi (kuruş). */
export const SIGMA_SQL = "(CASE WHEN i.role = 'refund' THEN -1 ELSE 1 END) * (i.commission_minor + CASE WHEN s.tax_mode = 'excluded' THEN i.tax_minor ELSE 0 END + i.fee_minor)";

/**
 * Satış (iade) günü maddelerinin kaynağı: kayıt başına TEK satır (toplu SQL — ders 47): { saleId, seq, date, posId, kind, no, parts (JSON: [[gün fişi, σ, gider hesabı], …]) }.
 * events: süzgeç ifadesi (ör. "(SELECT value FROM json_each(:events))") ya da null (bütün kayıtlar). Kalemin gider hesabı: bankaya geçmiş kalemde gün fişinin saklı gider satırı.
 */
export const salesSql = (events = null) => `SELECT s.id AS saleId, s.rowid AS seq, s.date, s.pos_id AS posId, s.kind, COALESCE(e.no, '') AS no,
    json_group_array(json_array(i.event_id, ${SIGMA_SQL}, CASE WHEN i.event_id <> '' THEN COALESCE((SELECT x.gl FROM bank_lines x WHERE x.event_id = i.event_id AND x.role = 'expense' LIMIT 1), '') ELSE '' END)) AS parts
  FROM pos_sales s CROSS JOIN pos_items i ON i.sale_id = s.id LEFT JOIN fin_events e ON e.id = s.event_id
  WHERE ${SCOPE}${events ? ` AND s.event_id IN ${events}` : ""} GROUP BY s.id`;

/** Gün fişi başına bağlı kalemlerin Σσ'sı: { eventId, posId, minor }. */
export const settledSql = (events = null) => `SELECT i.event_id AS eventId, MAX(i.pos_id) AS posId, SUM(${SIGMA_SQL}) AS minor
  FROM pos_items i CROSS JOIN pos_sales s ON s.id = i.sale_id
  WHERE ${SCOPE} AND i.status = 'settled' AND i.event_id <> ''${events ? ` AND i.event_id IN ${events}` : ""} GROUP BY i.event_id`;

/** Banka Ayarları'ndaki komisyon hesabı (gl.commission; varsayılan 653) — bekleyen kalemin satış günü maddesi. Okunamazsa varsayılan. */
export function commissionGlOf(store) {
  try {
    const raw = JSON.parse(store.setting?.("bank.settings", "") || "{}");
    const gl = raw?.gl?.commission;
    return typeof gl === "string" && /^\d{3}$/.test(gl) ? gl : COMMISSION_GL_DEFAULT;
  } catch {
    return COMMISSION_GL_DEFAULT;
  }
}

/**
 * Defter beklenenlerinin (money-lines groups) POS düzeltmesi: POS → kuruş (beklenenden DÜŞÜLECEK). Kapsamdaki kayıtların Σσ'sı − kapsamdaki gün fişlerinin Σσ'sı (süzgeçsizde
 * = bekleyen kalemlerin Σσ'sı). events: olay kimlikleri (dizi) ya da null.
 */
export function commissionByPos(store, { events = null } = {}) {
  const out = new Map();
  if (!commissionReady(store)) return out;
  const filter = events ? "(SELECT value FROM json_each(:events))" : null;
  const sql = `SELECT posId, SUM(minor) AS minor FROM (
      SELECT s.pos_id AS posId, ${SIGMA_SQL} AS minor FROM pos_sales s CROSS JOIN pos_items i ON i.sale_id = s.id WHERE ${SCOPE}${filter ? ` AND s.event_id IN ${filter}` : ""}
      UNION ALL
      SELECT i.pos_id AS posId, -(${SIGMA_SQL}) AS minor FROM pos_items i CROSS JOIN pos_sales s ON s.id = i.sale_id WHERE ${SCOPE} AND i.status = 'settled' AND i.event_id <> ''${filter ? ` AND i.event_id IN ${filter}` : ""}
    ) GROUP BY posId`;
  for (const row of store.all(sql, ...(filter ? [{ events: JSON.stringify([...events]) }] : []))) if (Number(row.minor)) out.set(row.posId, Number(row.minor));
  return out;
}

/**
 * Alt Hesap Mizanı'nın 108.POS düzeltmesi (Ana Defter'in maddeleriyle aynı yerleşim): POS → { opening, debit, credit } (kuruş, eklenecek fark). Satış günü maddesi: Σσ > 0 alacak,
 * < 0 borç. Gün fişi: saklı 108 satırı (alacak yönlü işaretli v) türetmede v − S → sütun farkı. from'dan önceki maddeler devire (net), to'dan sonrakiler okunmaz.
 */
export function commissionTrial(store, { from = "", to = "" } = {}) {
  const out = new Map();
  if (!commissionReady(store)) return out;
  const cell = posId => {
    if (!out.has(posId)) out.set(posId, { opening: 0, debit: 0, credit: 0 });
    return out.get(posId);
  };
  const place = (posId, date, debit, credit) => {
    if (to && date > to) return;
    const row = cell(posId);
    if (from && date < from) row.opening += debit - credit;
    else {
      row.debit += debit;
      row.credit += credit;
    }
  };
  for (const row of store.all(`SELECT s.pos_id AS posId, s.date, SUM(${SIGMA_SQL}) AS minor FROM pos_sales s CROSS JOIN pos_items i ON i.sale_id = s.id WHERE ${SCOPE} GROUP BY s.id`)) {
    const minor = Number(row.minor) || 0;
    if (minor) place(row.posId, row.date, minor < 0 ? -minor : 0, minor > 0 ? minor : 0);
  }
  for (const row of store.all(`SELECT k.posId, e.date, k.minor, COALESCE((SELECT SUM(CASE x.side WHEN 'C' THEN x.try_minor ELSE -x.try_minor END) FROM bank_lines x WHERE x.event_id = k.eventId AND x.role = 'pos'), 0) AS v
      FROM (${settledSql()}) k CROSS JOIN fin_events e ON e.id = k.eventId`)) {
    const s = Number(row.minor) || 0;
    if (!s) continue;
    const v = Number(row.v) || 0;
    const credit = Math.max(v - s, 0) - Math.max(v, 0);
    const debit = Math.max(s - v, 0) - Math.max(-v, 0);
    place(row.posId, row.date, debit, credit);
  }
  return out;
}
