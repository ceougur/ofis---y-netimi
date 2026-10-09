// Banka çekirdeğinin mutabakat denetimleri (v2.1.0; docs/BANKA-MODULU-PLAN.md §3.11 "Yeni denetimler", E1.16).
//
//   money:event   Olaysız para satırı: v20'den sonra yazılmış (eski sürüm ya da ham yazım) ve İşlem No'su olmayan para satırı. COMMIT'teki
//                 karşılığı store'daki K6 denetimidir (lib/db.mjs, rowid işareti); bu denetim tam taramadadır.
//   money:method  Tanınmayan yol: tek kaynağın (moneyLines) yol türetmesi "unknown" veren para satırı (nakit/havale/POS dışı yol ya da
//                 havale yolu kurumsal kart / kredi hesabına bağlı).
//   money:report  Rapor = özet: satır yolunun (Kasa penceresi, raporlar) JS toplamı = özet SQL'i (yol ve hesap bazında).
//   bank:event    İşlem başlığı: kopya (tutar, yol, yön, hesap, cari, tarih) = satır; etkin olayın satırı var; iptal olayın etkin satırı
//                 yok; ters kaydedilmiş olayın ters kaydı var; hesaba bağlı (fin_ref dolu) satırın olayı var; satırın olayı kayıtlı.
//   bank:sub:<alt hesap>  Alt hesap mutabakatı: yevmiyedeki alt hesap bakiyesi (102.01, 108.00 …) = tek kaynağın (yol, hesap) grubu.
//   bank:opening:<hesap>  Açılış kuralı (Aşama 3): hesabın en çok bir etkin açılışı (sıfır olabilir); etkin açılışın tarihi kartın açılış
//                 tarihi; açılıştan (yoksa kartın açılış tarihinden) önce tarihli bağlı hareket yok (açılışın kendisi ve ters kaydı hariç); hesap
//                 kartı türüyle uyumlu (102/300/309 ve alt hesap kodu); silinmiş hesabın etkin açılışı ve açılış dışı bağlı hareketi yok.
//   bank:voucher:<hesap>  Banka Fişi dengesi (Aşama 3): Σ borç = Σ alacak (TL kuruş); satır rolü ve THP kodu beyaz listede; para rolünün bağı
//                 ve alt hesabı kartla uyumlu (bağsızsa 102.00 / 108.00); TL satırında döviz = TL ve kur 1; olay kopyası (tutar, yön) = satırlar;
//                 iptal edilmiş fişin satırı yok; ters fiş asıl fişin aynası ve asıl fiş "ters kaydedildi".
// Varlık bazında kod (E1.16): bank:event ve bank:sub sapması hesabın koduyla raporlanır (bank:event:<hesap>, bank:sub:<alt hesap>); bir
// hesaptaki taban sapması öbür hesaptaki işlemi engellemez (B3 imza kuralı yalnız kendi kodunu kilitler).
import { copyMismatchSql } from "./event-copy.mjs";
import { NON_MONEY_TYPES, isVoucherType } from "./event-types.mjs";
import { MODULE_TABLES, MONEY_SOURCES, moneyWhere } from "./money-lines.mjs";
import { FORBIDDEN_GL, MONEY_ROLES, ROLE_GL, UNASSIGNED_SUB } from "./voucher.mjs";

// Hesap türü → ana hesap (Aşama 3, §3.5): 102 ailesi, kredi 300, kurumsal kart 309.
export const KIND_GL = Object.freeze({ demand: "102", commercial: "102", time: "102", fx: "102", other: "102", loan: "300", card: "309" });
const ROLE_OF_KIND = kind => (kind === "card" ? "card" : kind === "loan" ? "loan" : "bank");
// Açılış zinciri (açılış fişleri ve onların ters kayıtları) açılış kuralında "hareket" sayılmaz: accountSpan.

/**
 * Hesabın hareket aralığı (açılış zinciri hariç; modül satırları + Banka Fişi satırları): { count, first, last }. Hesap kartı (hareket sayısı,
 * Sil, tür değişikliği, Açılışı Düzelt) ve açılış kuralı kapısı (bank:opening) aynı tanımı kullanır.
 * v2.1.0 Aşama 4 (1.000.000 hareket ölçümü): önceden hesabın bütün fiş satırları işlem başlığıyla birleştirilip sayılıyordu (hesap kartı
 * ~2,2 sn; açılış kuralı kapısı her Banka Fişi kaydında ~3 sn). Şimdi dizinlerle, aynı sonuç:
 *   - açılış zinciri: hesabın açılış fişleri (kısmi indeks idx_fin_events_opening) ve onların ters kayıtları (reversed_by; kapı ters kaydın
 *     karşılıklı bağını denetler);
 *   - satır sayısı: hesabın fiş satırları − zincirin satırları (idx_bank_lines_ref);
 *   - ilk/son tarih: hesabın ya da karşı hesabın tarih dizininden (idx_fin_events_bank / _counter), bu hesaba fiş satırı olan ilk/son olay
 *     (kapı: para satırının hesabı olayın hesabı ya da karşı hesabıdır);
 *   - modül satırları: (fin_ref, date) kısmi indeksinden ilk/son tarih; sayım yalnız istenince.
 * count: false → sayım yapılmaz (count 0 döner); last: false → son tarih aranmaz. tables: fin_ref kolonu olan modül tabloları.
 */
export function accountSpan(store, id, { count: withCount = true, last: withLast = true, tables = MODULE_TABLES } = {}) {
  let count = 0;
  let first = "";
  let last = "";
  const take = (n, from, to) => {
    count += Number(n) || 0;
    if (from && (!first || from < first)) first = from;
    if (to && to > last) last = to;
  };
  for (const table of tables) {
    const where = `FROM ${table} WHERE fin_ref = ?1 AND fin_ref <> ''`;
    const row = store.get(`SELECT (SELECT MIN(date) ${where}) AS first${withLast ? `, (SELECT MAX(date) ${where}) AS last` : ""}${withCount ? `, (SELECT COUNT(*) ${where}) AS n` : ""}`, id);
    take(row?.n, row?.first, row?.last);
  }
  const chain = JSON.stringify(store.all("SELECT id, reversed_by AS reversedBy FROM fin_events WHERE bank_ref = ? AND type = 'opening'", id).flatMap(row => [row.id, row.reversedBy]).filter(Boolean));
  const edge = (column, order) =>
    store.get(
      `SELECT e.date AS date FROM fin_events e WHERE e.${column} = ?1 AND e.${column} <> '' AND e.id NOT IN (SELECT value FROM json_each(?2))
         AND EXISTS (SELECT 1 FROM bank_lines l WHERE l.ref = ?1 AND l.event_id = e.id) ORDER BY e.date ${order} LIMIT 1`,
      id, chain,
    )?.date || "";
  const from = [edge("bank_ref", "ASC"), edge("counter_ref", "ASC")].filter(Boolean).sort()[0] || "";
  if (!from) return { count, first, last };
  const to = withLast ? [edge("bank_ref", "DESC"), edge("counter_ref", "DESC")].filter(Boolean).sort().at(-1) || "" : "";
  const lines = withCount ? (Number(store.get("SELECT COUNT(*) AS n FROM bank_lines WHERE ref = ?", id).n) || 0) - (Number(store.get("SELECT COUNT(*) AS n FROM bank_lines WHERE ref = ? AND event_id IN (SELECT value FROM json_each(?))", id, chain).n) || 0) : 0;
  take(lines, from, to);
  return { count, first, last };
}

export const LEGACY_MARKS_KEY = "meta.bank.legacyMarks";
export const LEGACY_MARKS_AT_KEY = "meta.bank.legacyMarksAt";
const NON_MONEY_SQL = [...NON_MONEY_TYPES].map(type => `'${type}'`).join(", ");

export function createBankChecks({ store, money }) {
  const tables = () => new Set(store.all("SELECT name FROM sqlite_master WHERE type = 'table'").map(row => row.name));
  const columnsOf = new Map();
  const hasColumn = (table, column) => {
    if (!columnsOf.has(table)) columnsOf.set(table, new Set(store.all(`PRAGMA table_info(${table})`).map(row => row.name)));
    return columnsOf.get(table).has(column);
  };
  const ready = () => tables().has("fin_events") && hasColumn("cash_entries", "event_id");

  /** Banka kullanılıyor mu (hesap, POS ya da Banka Fişi)? Kullanılmıyorsa banka denetimleri yalnız sapma olunca görünür. */
  function inUse() {
    const has = tables();
    return (has.has("bank_accounts") && Boolean(store.get("SELECT 1 AS found FROM bank_accounts LIMIT 1"))) || (has.has("pos_terminals") && Boolean(store.get("SELECT 1 AS found FROM pos_terminals LIMIT 1"))) || (has.has("fin_events") && Boolean(store.get("SELECT 1 AS found FROM fin_events WHERE src_table = '' LIMIT 1")));
  }

  /** Eski satır işaretleri (tablo → en büyük rowid): v20 sonrası ilk açılışta yazılır (onarım). Üstündeki olaysız para satırı eski sürümün. */
  function marks() {
    try {
      const value = JSON.parse(store.setting(LEGACY_MARKS_KEY, "") || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  /** money:event: v20'den sonra yazılmış olaysız para satırları [{ key, table, id, ref }]. */
  function eventless() {
    if (!ready()) return [];
    const mark = marks();
    if (!mark) return [];
    // Gözden geçirme D4: işaret zamanından sonra oluşturulmuş olaysız satır da eski sürümün yazdığıdır (boşaltılan tabloda rowid baştan başlar).
    const at = store.setting(LEGACY_MARKS_AT_KEY, "") || "9999";
    const out = [];
    for (const table of MODULE_TABLES) {
      if (!hasColumn(table, "event_id")) continue;
      for (const row of store.all(`SELECT r.id, r.fin_ref AS ref FROM ${table} r WHERE r.event_id = '' AND (r.rowid > ? OR r.created_at > ?) AND ${moneyWhere(table, "r")}`, Number(mark[table]) || 0, at)) out.push({ key: `${table}:${row.id}`, table, id: row.id, ref: row.ref || "" });
    }
    return out;
  }

  /** money:method: tek kaynağın yol türetmesi "unknown" veren para satırları [{ key, sample }] (nakit/havale/POS dışı yol ya da havale yolu
   * kurumsal kart / kredi hesabına bağlı). Okuyucuların görmediği satır (silinmiş carinin) hiçbir bakiyeye girmediği için sayılmaz. */
  function unknownWays() {
    if (!money) return [];
    const tableOf = new Map(MONEY_SOURCES.map(source => [source.id, source.table]));
    return money.lines({ ways: ["unknown"], light: true }).map(line => ({ key: `${tableOf.get(line.src)}:${line.id}`, ref: line.ref, sample: `${tableOf.get(line.src)}:${line.id}=${line.method}` }));
  }

  /** bank:event: bozuk işlem başlıkları [{ key, ref, sample }]. events verilirse yalnız o olaylar (COMMIT'te dokunulanlar). */
  function brokenEvents({ events = null } = {}) {
    if (!ready()) return [];
    const out = [];
    const list = events ? JSON.stringify([...events]) : null;
    // Olay listesiyle (COMMIT'te dokunulanlar) okuma listeden başlar (CROSS JOIN sırayı belirler): istatistiksiz planlayıcı status/src_table
    // indeksiyle bütün olayları dolaşıyordu (100.000 satırda ~20–150 ms/sorgu). Tam taramada (list yok) sorgular 2.1.0 dilim 4'teki gibidir.
    const events_ = list ? "json_each(?) j CROSS JOIN fin_events e ON e.id = j.value" : "fin_events e";
    const args = list ? [list] : [];
    for (const table of MODULE_TABLES) {
      if (!hasColumn(table, "event_id")) continue;
      // Etkin olay: satırı yok ya da kopyası satırla uyuşmuyor.
      for (const row of store.all(
        `SELECT e.id, e.bank_ref AS ref, CASE WHEN r.id IS NULL THEN 'satırı yok' ELSE 'kopya satırla uyuşmuyor' END AS why
         FROM ${events_} LEFT JOIN ${table} r ON r.id = e.src_id AND r.event_id = e.id
         WHERE e.status = 'active' AND e.src_table = '${table}' AND e.type NOT IN (${NON_MONEY_SQL}) AND ${copyMismatchSql(table)}`,
        ...args,
      )) out.push({ key: row.id, ref: row.ref, sample: `${row.id}: ${row.why}` });
      // İptal edilmiş olayın etkin (yerinde duran) satırı.
      const rows_ = list ? `json_each(?) j CROSS JOIN ${table} r ON r.event_id = j.value CROSS JOIN fin_events e ON e.id = r.event_id` : `${table} r JOIN fin_events e ON e.id = r.event_id`;
      for (const row of store.all(`SELECT DISTINCT r.event_id AS id, e.bank_ref AS ref FROM ${rows_} WHERE r.event_id <> '' AND e.status = 'cancelled'`, ...args)) out.push({ key: row.id, ref: row.ref, sample: `${row.id}: iptal edilmiş olayın satırı var (${table})` });
      if (list) continue;
      // Hesaba bağlı satırın olayı yok; satırın gösterdiği olay kayıtlı değil (tam tarama).
      for (const row of store.all(`SELECT r.id, r.fin_ref AS ref FROM ${table} r WHERE r.fin_ref <> '' AND r.event_id = ''`)) out.push({ key: `${table}:${row.id}`, ref: row.ref, sample: `${table}:${row.id}: hesaba bağlı, işlem başlığı yok` });
      for (const row of store.all(`SELECT r.id, r.fin_ref AS ref, r.event_id AS eventId FROM ${table} r WHERE r.event_id <> '' AND NOT EXISTS (SELECT 1 FROM fin_events e WHERE e.id = r.event_id)`)) out.push({ key: `${table}:${row.id}`, ref: row.ref, sample: `${table}:${row.id}: işlem başlığı (${row.eventId}) kayıtlı değil` });
    }
    // Ters kaydedilmiş olayın ters kaydı var.
    for (const row of store.all(`SELECT e.id, e.bank_ref AS ref FROM ${events_} WHERE e.status = 'reversed' AND NOT EXISTS (SELECT 1 FROM fin_events x WHERE x.id = e.reversed_by AND x.reversal_of = e.id)`, ...args)) out.push({ key: row.id, ref: row.ref, sample: `${row.id}: ters kaydı yok` });
    // Aşama 4 (§3.11 bank:event, Banka Fişi ile modül satırı ayrımı): modül satırı (cari, Kasa, taksit …) bir Banka Fişi'nin işlem başlığını
    // taşıyamaz; bir modül olayının fiş satırı (bank_lines) olamaz. Önceden bank.post içinden fiş olayına bağlanan cari satırı yalnız kopya
    // denetiminden (src_table'a göre) kaçıyordu: para iki kez (fişte ve satırda) sayılırdı.
    for (const table of MODULE_TABLES) {
      if (!hasColumn(table, "event_id")) continue;
      const from = list ? `json_each(?) j CROSS JOIN ${table} r ON r.event_id = j.value CROSS JOIN fin_events f ON f.id = r.event_id` : `${table} r JOIN fin_events f ON f.id = r.event_id`;
      for (const row of store.all(`SELECT r.id, r.event_id AS eventId, f.bank_ref AS ref FROM ${from} WHERE r.event_id <> '' AND +f.src_table = '' LIMIT 20`, ...args)) out.push({ key: row.eventId, ref: row.ref, sample: `${row.eventId}: ${table}:${row.id} Banka Fişi'nin işlem başlığını taşıyor` });
    }
    if (tables().has("bank_lines")) {
      const from = list ? "json_each(?) j CROSS JOIN fin_events f ON f.id = j.value CROSS JOIN bank_lines l ON l.event_id = f.id" : "bank_lines l JOIN fin_events f ON f.id = l.event_id";
      for (const row of store.all(`SELECT DISTINCT f.id, f.bank_ref AS ref, f.src_table AS src FROM ${from} WHERE +f.src_table <> '' LIMIT 20`, ...args)) out.push({ key: row.id, ref: row.ref, sample: `${row.id}: modül olayının (${row.src}) banka fişi satırı var` });
    }
    // Gözden geçirme B1/B2 (Aşama 2; K11 "bir olay = bir para hareketi"): bir olayın birden çok etkin satırı olamaz (tek istisna Kasa ↔ Banka
    // transferinin aynı transfer_id'li iki bacağı). Önceden bank.post dışından başka satırın olayıyla eklenen para satırı ve Silinenler'den
    // geri yüklenen taşınmış tahsilat hiçbir denetimde görünmüyordu (Kasa çift sayılıyordu).
    for (const row of multiRowEvents(list)) out.push({ key: row.id, ref: row.ref, sample: `${row.id}: olayın birden çok etkin satırı var (${row.n} satır: ${row.tables})` });
    return out;
  }

  /** Birden çok etkin satırı olan olaylar [{ id, ref, n, tables }]; list (JSON) verilirse yalnız o olaylar. */
  function multiRowEvents(list = null) {
    const tables = MODULE_TABLES.filter(table => hasColumn(table, "event_id"));
    if (!tables.length) return [];
    const transfer = hasColumn("cash_entries", "transfer_id");
    // Her satır: olay, tablo, transfer kimliği (yalnız Kasa). Kısmi indeks (idx_<tablo>_event_id) "event_id <> ''" ile seçilir.
    const part = (table, where, args) => ({ sql: `SELECT event_id AS e, '${table}' AS t, ${table === "cash_entries" && transfer ? "COALESCE(transfer_id, '')" : "''"} AS x FROM ${table} WHERE ${where}`, args });
    const parts = list
      ? tables.map(table => part(table, "event_id IN (SELECT value FROM json_each(?)) AND event_id <> ''", [list]))
      : tables.map(table => part(table, "event_id <> ''", []));
    return store.all(
      `SELECT g.e AS id, COALESCE(f.bank_ref, '') AS ref, g.n, g.tables FROM (
         SELECT e, COUNT(*) AS n, group_concat(DISTINCT t) AS tables, SUM(CASE WHEN t = 'cash_entries' AND x <> '' THEN 1 ELSE 0 END) AS legs, COUNT(DISTINCT x) AS transfers
         FROM (${parts.map(item => item.sql).join(" UNION ALL ")}) GROUP BY e
       ) g LEFT JOIN fin_events f ON f.id = g.e
       WHERE g.n > 1 AND NOT (g.n = 2 AND g.legs = 2 AND g.transfers = 1)`,
      ...parts.flatMap(item => item.args),
    );
  }

  /** money:report: satır yolu ↔ özet uyuşmazlıkları (yol|hesap). */
  const reportMismatches = ({ events = null } = {}) => (money && ready() ? money.verifyReport({ events }) : []);

  /**
   * bank:opening — açılış kuralı ihlalleri [{ key, ref, sample }]. refs: yalnız bu hesaplar (COMMIT'te dokunulanlar; kimlik kümesinden başlar);
   * null: bütün hesaplar (tam tarama). Bilinmeyen kimlik (hesap kartı olmayan bağ) bank:refs'in konusudur (Aşama 5); burada atlanır.
   */
  function openingProblems({ refs = null } = {}) {
    const has = tables();
    if (!has.has("bank_accounts") || !ready()) return [];
    const list = refs ? JSON.stringify([...refs].filter(Boolean)) : null;
    const accounts = list
      ? store.all("SELECT a.id, a.code, a.kind, a.gl, a.gl_sub AS glSub, a.opening_date AS openingDate, a.deleted_at AS deletedAt FROM json_each(?) j CROSS JOIN bank_accounts a ON a.id = j.value", list)
      : store.all("SELECT id, code, kind, gl, gl_sub AS glSub, opening_date AS openingDate, deleted_at AS deletedAt FROM bank_accounts");
    const out = [];
    const fail = (account, why) => out.push({ key: `${account.id}:${why}`, ref: account.id, sample: `${account.code}: ${why}` });
    for (const account of accounts) {
      if (KIND_GL[account.kind] !== account.gl || !String(account.glSub).startsWith(`${account.gl}.`) || account.glSub === `${account.gl}.00`) fail(account, `hesap türü (${account.kind}) ile ana/alt hesap (${account.gl} / ${account.glSub}) uyuşmuyor`);
      // Açılış fişleri kısmi indeksten (idx_fin_events_opening; hesabın bütün olayları dolaşılmaz).
      const openings = store.all("SELECT e.id, e.date, e.no FROM fin_events e WHERE e.bank_ref = ? AND e.type = 'opening' AND +e.status = 'active'", account.id);
      // Hesaba bağlı en erken hareket (açılış zinciri hariç): modül satırları ve Banka Fişi satırları (accountSpan; sayım yalnız silinmiş hesapta).
      const span = accountSpan(store, account.id, { count: Boolean(account.deletedAt), last: false, tables: MODULE_TABLES.filter(table => hasColumn(table, "fin_ref")) });
      const first = span.first;
      const movements = span.count;
      if (account.deletedAt) {
        if (openings.length) fail(account, "silinmiş hesabın etkin açılışı var");
        if (movements) fail(account, `silinmiş hesaba bağlı ${movements} hareket var`);
        continue;
      }
      if (openings.length > 1) fail(account, `${openings.length} etkin açılış (${openings.map(item => item.no).join(", ")})`);
      if (openings.length === 1 && openings[0].date !== account.openingDate) fail(account, `açılış fişi ${openings[0].date}, kart ${account.openingDate}`);
      const start = openings[0]?.date || account.openingDate;
      if (first && start && first < start) fail(account, `açılıştan (${start}) önce tarihli bağlı hareket (${first})`);
    }
    return out;
  }

  /**
   * bank:voucher — Banka Fişi kuralı ihlalleri [{ key, ref, sample }]. events: yalnız bu olaylar (dokunulanlar); null: bütün Banka Fişleri.
   * Kurallar lib/bank/voucher.mjs'tekiyle aynı ama SQL satırlarından bağımsız yeniden hesaplanır.
   */
  function voucherProblems({ events = null } = {}) {
    if (!ready() || !tables().has("bank_lines")) return [];
    const list = events ? JSON.stringify([...events]) : null;
    const source = list ? "json_each(?) j CROSS JOIN fin_events e ON e.id = j.value" : "fin_events e";
    const args = list ? [list] : [];
    const has = tables();
    const heads = store.all(`SELECT e.id, e.no, e.type, e.status, e.bank_ref AS ref, e.counter_ref AS counterRef, e.invoice_id AS invoiceId, e.direction, e.amount_minor AS amountMinor, e.try_minor AS tryMinor, e.reversal_of AS reversalOf, e.reversed_by AS reversedBy FROM ${source} WHERE e.src_table = ''`, ...args);
    if (!heads.length) return [];
    const ids = JSON.stringify(heads.map(head => head.id));
    const linesOf = new Map();
    for (const line of store.all(
      `SELECT l.event_id AS eventId, l.role, l.gl, l.sub, l.ref, l.side, l.try_minor AS tryMinor, l.currency, l.fx_minor AS fxMinor, l.rate_e6 AS rate,
              a.kind AS accountKind, a.gl_sub AS accountSub, a.currency AS accountCurrency, p.gl_sub AS posSub, (a.id IS NOT NULL) AS isAccount, (p.id IS NOT NULL) AS isPos
       FROM json_each(?) j CROSS JOIN bank_lines l ON l.event_id = j.value LEFT JOIN bank_accounts a ON a.id = l.ref AND l.ref <> '' LEFT JOIN pos_terminals p ON p.id = l.ref AND l.ref <> ''
       ORDER BY l.event_id, l.seq`,
      ids,
    )) {
      if (!linesOf.has(line.eventId)) linesOf.set(line.eventId, []);
      linesOf.get(line.eventId).push(line);
    }
    const out = [];
    const sign = line => (line.side === "D" ? 1 : -1);
    const fxOf = line => (line.currency === "TRY" && !Number(line.fxMinor) ? Number(line.tryMinor) : Number(line.fxMinor));
    const signature = line => [line.role, line.gl, line.sub, line.ref, line.tryMinor, line.currency, line.fxMinor].join("|");
    for (const head of heads) {
      const lines = linesOf.get(head.id) || [];
      const fail = why => out.push({ key: `${head.id}:${why}`, ref: head.ref || "", sample: `${head.no}: ${why}` });
      const net = lines.reduce((sum, line) => sum + sign(line) * Number(line.tryMinor), 0);
      if (net !== 0) fail(`borç ≠ alacak (fark ${net / 100})`);
      if (head.status === "cancelled" && lines.length) fail("iptal edilmiş fişin satırı var");
      if (NON_MONEY_TYPES.has(head.type) && lines.length) fail(`${head.type} fişinin para satırı olmaz`);
      // Aşama 4: satırsız fiş yalnız sıfır açılış, sihirbaz başlığı ve KDV'li masrafın başlığıdır (para faturanın ödeme satırında). KDV'li masraf
      // başlığı kesilmiş faturaya ve o faturanın bu hesaptan (havale) ödemesine bağlıdır; fatura iptal edilince başlık da iptal edilir.
      if (!lines.length && head.status === "active" && isVoucherType(head.type)) {
        if (head.type !== "fee" || !head.invoiceId) fail("satırsız banka fişi (masraf faturası yok)");
        else {
          const invoice = has.has("invoices") ? store.get("SELECT status FROM invoices WHERE id = ?", head.invoiceId) : null;
          if (!invoice || invoice.status !== "issued") fail("masraf başlığının faturası kesilmiş değil");
          else if (!store.get("SELECT 1 AS found FROM account_entries WHERE source = 'invoice' AND source_id = ? AND +kind = 'out' AND +method = 'bank' AND +fin_ref = ? LIMIT 1", head.invoiceId, head.ref || "")) fail("masraf faturasının bu hesaptan ödemesi yok");
        }
      }
      for (const line of lines) {
        const allowed = ROLE_GL[line.role];
        if (!allowed || FORBIDDEN_GL.has(String(line.gl)) || !allowed.includes(String(line.gl))) {
          fail(`${line.role} satırı ${line.gl} hesabına yazılamaz`);
          continue;
        }
        // TL satırında döviz tutarı ya TL tutarıdır ya da şemanın varsayılanı 0'dır ("yok"; fxOf TL tutarını alır); kur 1.
        if (line.currency === "TRY" && ((Number(line.fxMinor) !== 0 && Number(line.fxMinor) !== Number(line.tryMinor)) || Number(line.rate) !== 1_000_000)) fail(`TL satırında döviz tutarı/kur TL ile aynı değil (${line.gl})`);
        if (!MONEY_ROLES.has(line.role)) {
          if (line.ref || line.sub) fail(`${line.role} satırı hesap bağı / alt hesap taşımaz`);
          continue;
        }
        // Aşama 4: para satırının hesabı olayın hesabı ya da karşı hesabıdır (Hareketler dizini bu iki kolondan okur; başka hesaba yazılan satır
        // o hesabın listesinde ve bakiyesinde görünmezdi).
        if (line.ref && line.ref !== (head.ref || "") && line.ref !== (head.counterRef || "")) fail(`para satırının hesabı (${line.sub || line.ref}) olayın hesabı ya da karşı hesabı değil`);
        if (!line.ref) {
          if (line.sub !== UNASSIGNED_SUB[line.role]) fail(`bağsız ${line.role} satırının alt hesabı ${UNASSIGNED_SUB[line.role] || "yok"} olmalı (${line.sub || "boş"})`);
          continue;
        }
        if (line.role === "pos") {
          if (!line.isPos || line.sub !== line.posSub) fail(`POS satırının bağı/alt hesabı POS kartıyla uyuşmuyor (${line.sub})`);
          continue;
        }
        if (!line.isAccount || ROLE_OF_KIND(line.accountKind) !== line.role || line.sub !== line.accountSub) fail(`${line.role} satırının bağı/alt hesabı hesap kartıyla uyuşmuyor (${line.sub || "boş"})`);
        else if (line.currency !== line.accountCurrency) fail(`satırın para birimi (${line.currency}) hesabınkiyle (${line.accountCurrency}) aynı değil`);
      }
      // Olay kopyası = satırlar (hesaba bağlı fişte hesabın para satırlarının neti; bağsızda borç toplamı).
      const money = head.ref ? lines.filter(line => MONEY_ROLES.has(line.role) && line.ref === head.ref) : [];
      if (money.length) {
        const netTry = money.reduce((sum, line) => sum + sign(line) * Number(line.tryMinor), 0);
        const netFx = money.reduce((sum, line) => sum + sign(line) * fxOf(line), 0);
        if (Number(head.tryMinor) !== Math.abs(netTry) || Number(head.amountMinor) !== Math.abs(netFx) || head.direction !== (netTry >= 0 ? "in" : "out")) fail(`kopya (${head.direction} ${Number(head.tryMinor) / 100}) satırlarla (${netTry / 100}) uyuşmuyor`);
      } else {
        const total = lines.reduce((sum, line) => sum + (line.side === "D" ? Number(line.tryMinor) : 0), 0);
        if (Number(head.tryMinor) !== total) fail(`kopya tutarı (${Number(head.tryMinor) / 100}) satırlarla (${total / 100}) uyuşmuyor`);
      }
      // Ters kayıt: asıl fiş var, "ters kaydedildi" ve bu fişi gösteriyor; satırlar aynası.
      if (head.type === "reversal") {
        const origin = store.get("SELECT id, status, reversed_by AS reversedBy FROM fin_events WHERE id = ?", head.reversalOf);
        if (!origin || origin.status !== "reversed" || origin.reversedBy !== head.id) fail("ters kaydın asıl fişi yok ya da ters kaydedilmiş görünmüyor");
        else {
          const originLines = store.all("SELECT role, gl, sub, ref, side, try_minor AS tryMinor, currency, fx_minor AS fxMinor FROM bank_lines WHERE event_id = ?", origin.id);
          const mirror = originLines.map(line => `${signature(line)}|${line.side === "D" ? "C" : "D"}`).sort();
          const own = lines.map(line => `${signature(line)}|${line.side}`).sort();
          if (mirror.join("\n") !== own.join("\n")) fail("ters kayıt asıl fişin aynası değil");
        }
      }
    }
    return out;
  }

  return { ready, inUse, marks, eventless, unknownWays, brokenEvents, reportMismatches, openingProblems, voucherProblems };
}

/** Hesap bazında gruplanmış denetim kalemleri (varlık kodu): '' (Hesabı Atanmamış) → code, hesap → code:hesap. */
export function byEntity(code, name, failures, { legacy = null, label = ref => ref } = {}) {
  const groups = new Map();
  for (const item of failures) {
    const ref = item.ref || "";
    if (!groups.has(ref)) groups.set(ref, []);
    groups.get(ref).push(item);
  }
  return [...groups].map(([ref, items]) => {
    const fresh = legacy ? items.filter(item => !legacy.has(item.key)).length : items.length;
    const old = items.length - fresh;
    return {
      code: ref ? `${code}:${ref}` : code,
      name: ref ? `${name} (${label(ref)})` : name,
      ok: false,
      count: items.length,
      gateCount: fresh,
      ...(old ? { legacy: old } : {}),
      ...(old && !fresh ? { severity: "warning" } : {}),
      sample: items.slice(0, 5).map(item => item.sample || item.key),
    };
  });
}
