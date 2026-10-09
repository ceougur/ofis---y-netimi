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
// Varlık bazında kod (E1.16): bank:event ve bank:sub sapması hesabın koduyla raporlanır (bank:event:<hesap>, bank:sub:<alt hesap>); bir
// hesaptaki taban sapması öbür hesaptaki işlemi engellemez (B3 imza kuralı yalnız kendi kodunu kilitler).
import { copyMismatchSql } from "./event-copy.mjs";
import { NON_MONEY_TYPES } from "./event-types.mjs";
import { MODULE_TABLES, MONEY_SOURCES, moneyWhere } from "./money-lines.mjs";

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

  return { ready, inUse, marks, eventless, unknownWays, brokenEvents, reportMismatches };
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
