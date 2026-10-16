// Şüpheli Ticari Alacaklar — çekirdek (2.3.0 İz 1; docs/BANKA-MODULU-PLAN.md §3.11b; kabul docs/2.3.0-SUPHELI-KABUL.md). Kalıp:
// lib/bank/collections.mjs (Bankaya Tahsile Ver): kendi tablosu + fin_events başlığı (para satırı yok), yevmiye lib/general-ledger.mjs'te
// TEK KURALDAN türetilir (lib/doubtful-gl.mjs), kapı denetimi doubtful:records, kilit izi sürüme bağlı girdi (lib/integrity.mjs since "2.3.0").
//
// İz: doubtful_receivables (kayıt: cari, tarih, tutar, neden, evrak; open → released | cancelled) · doubtful_provisions (karşılık; active |
//   cancelled) · account_entries (Değersiz Alacak satırı: kind 'credit', source 'doubtful', source_id = kayıt) · fin_events başlıkları
//   (doubtful_take / doubtful_release / doubtful_provision / doubtful_writeoff; NON_MONEY_TYPES, İşlem No'lu).
// Tahsil edilen, kalan, karşılığın çözülmesi SAKLANMAZ: ayırma kuralı (allocateDoubtful) carinin alacak satırlarından her seferinde aynı
//   sonucu türetir — tahsilatın silinmesi/düzeltilmesi/geri yüklenmesi kendiliğinden tutarlı kalır (bağlı kayıt yok). Beklenenler (routes/
//   ledger.mjs expected) aynı kuralı SQL'den okunan alacak satırlarıyla koşar (ikinci yükleyici); kapı iki yükleyiciyi karşılaştırır.
// Bütün yazımlar rotanın bank.post işleminde (write geri çağrısı): kayıt, başlık, işlem geçmişi ve istek kimliği birlikte ya da hiç.
import { randomUUID } from "node:crypto";
import { DOUBTFUL_REASONS, allocateDoubtful, doubtfulControl, doubtfulStatusOf, doubtfulView, isDoubtfulReason } from "../doubtful-gl.mjs";
import { HttpError, limited, text } from "../http.mjs";
import { fromMinor, parseMinor, toMinor } from "../minor.mjs";
import { newEventId, nextEventNo } from "./event-no.mjs";

export const DOUBTFUL_TABLES = Object.freeze(["doubtful_receivables", "doubtful_provisions"]);
export const DOUBTFUL_TYPES = Object.freeze(new Set(["doubtful_take", "doubtful_release", "doubtful_provision", "doubtful_writeoff"]));
export const DOUBTFUL_SOURCE = "doubtful";
const AUDITOR = Object.freeze({ id: "integrity", role: "admin", permissions: [] });
const dayText = iso => (iso ? String(iso).split("-").reverse().join(".") : "");
// K5 (2.3.0): iletilerde para işareti programın öbür iletileri gibi "TL" (önceden bu modülde "₺", öbürlerinde "TL").
const tl = minor => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((Number(minor) || 0) / 100)} TL`;
const hasTable = (store, name) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", name));
export const hasDoubtful = store => hasTable(store, "doubtful_receivables");
/** Şüpheli alacak hiç kullanılmış mı (iptal edilenler dahil): 128/129 denetimleri yalnız kullanılınca açılır (300/309 ve 121/321 kuralı). */
export const doubtfulUsed = store => hasDoubtful(store) && Boolean(store.get("SELECT 1 AS found FROM doubtful_receivables LIMIT 1"));

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

/**
 * İkinci yükleyici: carinin kontrol hesabını alacaklandıran satırlar SQL'den (yevmiyenin kuralıyla aynı; lib/general-ledger.mjs journal):
 *   cari satırı: tahsilat ("Normal Cari Hesaba İşle" işaretli, fatura peşini ve Kapatılacak Fatura bağlı olanlar HARİÇ — karar 15.10.2026) ve
 *   alacak (fatura kaynaklı hariç; Değersiz Alacak satırı hedefli) · taksit tahsilatı (silinmemiş kart; kartın açılış tarihi openedOn) ·
 *   kapatılan kartın vazgeçilen kalanı (689; kapanış günü; openedOn) · kesilmiş satıştan iade ve alış faturası (ödenecek).
 */
export function doubtfulCredits(store, parties) {
  const list = JSON.stringify([...parties]);
  if (list === "[]") return [];
  const c = column => `CAST(ROUND(${column} * 100) AS INTEGER)`;
  const has = name => hasTable(store, name);
  const parts = [
    // Karar 15.10.2026 (plan §3.11b/2; lib/doubtful-gl.mjs doubtfulSkipOf ikizi): "Normal Cari Hesaba İşle" (doubtful_skip), fatura peşini
    // (source 'invoice') ve Kapatılacak Fatura bağlı (invoice_id) tahsilat şüpheliden düşmez → hiç yüklenmez.
    `SELECT 'account:' || e.id AS key, e.account_id AS party, e.date, ${c("e.amount")} AS minor, CASE WHEN e.source = 'doubtful' THEN e.source_id ELSE '' END AS target, '' AS openedOn
     FROM json_each(?1) j CROSS JOIN account_entries e ON e.account_id = j.value
     WHERE (e.kind = 'in' AND e.doubtful_skip = 0 AND e.source <> 'invoice' AND e.invoice_id = '') OR (e.kind = 'credit' AND e.source <> 'invoice')`,
  ];
  if (has("plans") && has("plan_entries")) {
    // openedOn: kartın açılış tarihi — şüpheli kaydından SONRA açılan kartın taksiti / vazgeçilen kalanı o kayıttan düşmez (doubtful-gl).
    // Kontrol turu 2 K1 (15.10.2026): "Mevcut borcu taksitlendir" (covers_balance) kartı yeni alacak getirmez (yevmiyede 602 yazılmaz; borç
    // caride zaten yazılı) → tarih kapısı YOK, taksiti şüpheliden düşer (önceden 128'den hiç düşmüyor, 120 bitince kapı reddediyordu).
    const openedOn = "CASE WHEN p.covers_balance = 1 THEN '' ELSE COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10)) END";
    parts.push(`SELECT 'plan-entry:' || pe.id, p.account_id, pe.date, ${c("pe.amount")}, '', ${openedOn} FROM json_each(?1) j CROSS JOIN plans p ON p.account_id = j.value AND p.deleted_at IS NULL CROSS JOIN plan_entries pe ON pe.plan_id = p.id WHERE pe.kind = 'in'`);
    // Vazgeçilen kalan kuruşla: kart tutarı (kuruş) − net tahsilat (her satır kuruşa çevrilip toplanır; banka kodunda REAL toplam yok).
    parts.push(
      `SELECT 'plan-close:' || p.id, p.account_id, MAX(COALESCE(p.closed_at, substr(p.updated_at, 1, 10)), ${openedOn}),
              MAX(0, ${c("p.total")} - COALESCE((SELECT SUM(CAST(ROUND((CASE WHEN x.kind = 'in' THEN x.amount ELSE -x.amount END) * 100) AS INTEGER)) FROM plan_entries x WHERE x.plan_id = p.id), 0)), '', ${openedOn}
       FROM json_each(?1) j CROSS JOIN plans p ON p.account_id = j.value AND p.deleted_at IS NULL WHERE p.status = 'closed'`,
    );
  }
  if (has("invoices")) parts.push(`SELECT 'invoice:' || i.id, i.account_id, i.issue_date, ${c("i.try_payable")}, '', '' FROM json_each(?1) j CROSS JOIN invoices i ON i.account_id = j.value WHERE i.status = 'issued' AND i.kind IN ('sale_return', 'purchase')`);
  return store.all(`SELECT * FROM (${parts.join("\nUNION ALL\n")}) WHERE minor > 0`, list).map(row => ({ key: row.key, party: row.party, date: row.date, minor: Number(row.minor), target: row.target || "", openedOn: row.openedOn || "" }));
}

/** Kayıtlar + karşılıklar + SQL alacak satırlarıyla ayırma: { records, provisions, state, allocations }. */
export function doubtfulState(store, { parties = null } = {}) {
  const { records, provisions } = doubtfulRows(store, { parties });
  if (!records.length) return { records, provisions, state: new Map(), allocations: new Map() };
  const credits = doubtfulCredits(store, new Set(records.map(record => record.party)));
  const { state, allocations } = allocateDoubtful({ records, provisions, credits });
  return { records, provisions, state, allocations };
}

/** Ana Defter'in beklenenleri (routes/ledger.mjs expected): 128 = Σ kalan; 129 = −Σ karşılık; kontrol hesabı (120/320/336) başına düşülecek kalan. */
export function doubtfulExpected(store) {
  const { records, state } = doubtfulState(store);
  let openMinor = 0;
  let provisionMinor = 0;
  const byControl = new Map();
  for (const record of records) {
    const s = state.get(record.id);
    if (!s) continue;
    openMinor += s.remaining;
    provisionMinor += s.provision;
    byControl.set(record.control, (byControl.get(record.control) || 0) + s.remaining);
  }
  return { openMinor, provisionMinor, byControl };
}

/**
 * Mutabakat denetimi doubtful:records (§3.11b/4): kuralları bozan kayıtlar [{ key, sample }] — her etkin kaydın etkin başlığı (tür, cari, tarih,
 * tutar), çıkarılmış kaydın kapanış başlığı (tarih ≥ kayıt), etkin karşılığın kaydı ve başlığı, Değersiz Alacak satırının kaydı/carisi/başlığı,
 * her etkin şüpheli başlığının kaydı; silinmiş carinin kaydı. parties: yalnız bu cariler (dokunulan varlıklar).
 */
export function doubtfulProblems(store, { parties = null } = {}) {
  if (!hasDoubtful(store)) return [];
  const list = parties ? JSON.stringify([...parties]) : null;
  if (list === "[]") return [];
  const where = list ? "d.account_id IN (SELECT value FROM json_each(?))" : "1";
  const args = list ? [list] : [];
  const out = [];
  const fail = (key, sample) => out.push({ key, sample });
  const header = (id, type) => (id ? store.get("SELECT id, type, status, src_table AS srcTable, src_id AS srcId, party_id AS partyId, date, try_minor AS tryMinor FROM fin_events WHERE id = ?", id) : null);
  for (const row of store.all(`${RECORD_SQL} WHERE ${where} AND +d.status <> 'cancelled'`, ...args)) {
    const tag = `${row.id} (${row.accountName || row.party})`;
    if (!["open", "released"].includes(row.status)) fail(`${row.id}:status`, `${tag}: tanınmayan durum ${row.status}`);
    if (!(Number(row.amountMinor) > 0)) fail(`${row.id}:amount`, `${tag}: tutar sıfır ya da eksi`);
    if (row.accountDeletedAt || !row.accountType) fail(`${row.id}:account`, `${tag}: carisi silinmiş ya da yok; şüpheli kaydı defterden düştü`);
    const head = header(row.eventId);
    if (!head || head.type !== "doubtful_take" || head.status !== "active" || head.srcTable !== "doubtful_receivables" || head.srcId !== row.id || head.partyId !== row.party || head.date !== row.date || Number(head.tryMinor) !== Number(row.amountMinor)) {
      fail(`${row.id}:event`, `${tag}: Şüpheli Alacağa Al başlığı yok, etkin değil ya da kayıtla uyuşmuyor`);
    }
    if (row.status === "released") {
      const close = header(row.closeEventId);
      if (!row.closedDate || row.closedDate < row.date || !close || close.type !== "doubtful_release" || close.status !== "active" || close.srcId !== row.id || close.date !== row.closedDate) fail(`${row.id}:close`, `${tag}: Şüpheliden Çıkar başlığı ya da kapanış tarihi eksik/uyuşmuyor`);
    } else if (row.closedDate || row.closeEventId) fail(`${row.id}:open`, `${tag}: açık kaydın kapanışı dolu`);
  }
  for (const row of store.all(
    `${PROVISION_SQL} JOIN doubtful_receivables d ON d.id = p.doubtful_id WHERE ${where} AND +p.status = 'active'`,
    ...args,
  )) {
    const record = store.get("SELECT id, date, status FROM doubtful_receivables WHERE id = ?", row.recordId);
    const head = header(row.eventId);
    if (!record || record.status === "cancelled") fail(`${row.id}:record`, `karşılık ${row.id}: kaydı yok ya da iptal edilmiş`);
    else if (row.date < record.date) fail(`${row.id}:date`, `karşılık ${row.id}: tarihi (${dayText(row.date)}) kaydın tarihinden (${dayText(record.date)}) önce`);
    if (!(Number(row.amountMinor) > 0)) fail(`${row.id}:amount`, `karşılık ${row.id}: tutar sıfır ya da eksi`);
    if (!head || head.type !== "doubtful_provision" || head.status !== "active" || head.srcTable !== "doubtful_provisions" || head.srcId !== row.id || head.date !== row.date || Number(head.tryMinor) !== Number(row.amountMinor)) fail(`${row.id}:event`, `karşılık ${row.id}: başlığı yok ya da uyuşmuyor`);
  }
  if (hasTable(store, "account_entries")) {
    for (const row of store.all(
      `SELECT e.id, e.account_id AS party, e.kind, e.date, CAST(ROUND(e.amount * 100) AS INTEGER) AS minor, e.source_id AS recordId, d.id AS did, d.status, d.date AS recordDate, d.account_id AS recordParty
       FROM account_entries e LEFT JOIN doubtful_receivables d ON d.id = e.source_id
       WHERE +e.source = 'doubtful'${list ? " AND e.account_id IN (SELECT value FROM json_each(?))" : ""}`,
      ...args,
    )) {
      if (!row.did || row.status === "cancelled") fail(`${row.id}:record`, `Değersiz Alacak satırı ${row.id}: kaydı yok ya da iptal edilmiş`);
      else if (row.recordParty !== row.party) fail(`${row.id}:party`, `Değersiz Alacak satırı ${row.id}: kaydın carisi başka`);
      else if (row.date < row.recordDate) fail(`${row.id}:date`, `Değersiz Alacak satırı ${row.id}: tarihi kaydın tarihinden önce`);
      if (row.kind !== "credit") fail(`${row.id}:kind`, `Değersiz Alacak satırı ${row.id}: alacak satırı değil (${row.kind})`);
      const head = store.get("SELECT status, date, try_minor AS tryMinor FROM fin_events WHERE type = 'doubtful_writeoff' AND src_table = 'account_entries' AND src_id = ? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END LIMIT 1", row.id);
      if (!head || head.status !== "active" || head.date !== row.date || Number(head.tryMinor) !== Number(row.minor)) fail(`${row.id}:event`, `Değersiz Alacak satırı ${row.id}: başlığı yok, etkin değil ya da uyuşmuyor`);
    }
  }
  // Kaydı olmayan (ya da kaydı kendisini göstermeyen) etkin şüpheli başlıkları.
  for (const row of store.all(
    `SELECT e.id, e.no, e.type, e.src_table AS srcTable, e.src_id AS srcId FROM fin_events e
     WHERE e.type IN ('doubtful_take', 'doubtful_release', 'doubtful_provision', 'doubtful_writeoff') AND +e.status = 'active'${list ? " AND e.party_id IN (SELECT value FROM json_each(?))" : ""}
       AND NOT EXISTS (SELECT 1 FROM doubtful_receivables d WHERE d.id = e.src_id AND d.status <> 'cancelled' AND ((e.type = 'doubtful_take' AND d.event_id = e.id) OR (e.type = 'doubtful_release' AND d.close_event_id = e.id)))
       AND NOT EXISTS (SELECT 1 FROM doubtful_provisions p WHERE e.type = 'doubtful_provision' AND p.id = e.src_id AND p.status = 'active' AND p.event_id = e.id)
       AND NOT EXISTS (SELECT 1 FROM account_entries x WHERE e.type = 'doubtful_writeoff' AND x.id = e.src_id AND x.source = 'doubtful')`,
    ...args,
  )) fail(`${row.id}:orphan`, `${row.no}: şüpheli alacak başlığının (${row.type}) kaydı yok ya da kayıt başka başlığı gösteriyor`);
  // Türetilmiş durum (yargıç 2.3.0 #2, #3, #8; 15.10.2026): kayıt bazında karşılık ≤ kalan (K5/K6) ve kapanan kayıtta karşılık 0; Değersiz Alacak
  // satırı kaydın kalanı içinde (K7 sonradan da: değersiz satırından önceye düşen geriye tarihli tahsilat satırı kayıt dışına taşırırdı — A 120 /
  // B 659, 120 eksi); Şüpheliden Çıkar başlığının tutarı yevmiyedeki çıkarılan tutar (çıkarma gününden önceye düşen tahsilat kalanı değiştirirdi).
  // Tam kapı ve dokunulan yol (lib/integrity-scope.mjs) aynı denetimi koşar: bozan yazım 409 ile reddedilir.
  const derived = doubtfulState(store, { parties });
  for (const record of derived.records) {
    const s = derived.state.get(record.id);
    if (!s) continue;
    const tag = `${record.id} (${record.accountName || record.party})`;
    if (s.provision > s.remaining) fail(`${record.id}:provision`, `${tag}: karşılık (${tl(s.provision)}) kalanı (${tl(s.remaining)}) aşıyor`);
    if (s.remaining <= 0 && s.provision > 0) fail(`${record.id}:provision-left`, `${tag}: kayıt kapandı, karşılık (${tl(s.provision)}) 129'da kaldı`);
    if (record.status === "released" && record.closeEventId) {
      const close = header(record.closeEventId);
      // Başlık çıkarma günündeki yazım sırasına göre o günün (günün sonunda sayılan) tahsilatlarının bir kısmını içerebilir: tolerans
      // [çıkarılan, çıkarılan + o gün düşen]; önceki güne düşen geriye tarihli tahsilat tolerans dışıdır (yargıç G).
      if (close && (Number(close.tryMinor) < s.released || Number(close.tryMinor) > s.released + (s.collectedOnCloseDay || 0))) fail(`${record.id}:close-amount`, `${tag}: Şüpheliden Çıkar başlığı ${tl(close.tryMinor)}, yevmiyedeki çıkarılan ${tl(s.released)} (çıkarma gününden önceye düşen tahsilat kalanı değiştirirdi); tahsilatı çıkarma gününden sonraya yazın ya da kaydı silip yeniden alın`);
    }
  }
  for (const [key, hit] of derived.allocations) {
    if ((hit.outsideMinor || 0) > 0) fail(`${key}:outside`, `Değersiz Alacak satırı ${key.replace(/^account:/, "")}: kaydın kalanını ${tl(hit.outsideMinor)} aşıyor (değersiz satırından önceye düşen tahsilat kalanı küçülttü); tahsilatı değersiz satırından sonraki tarihe yazın ya da önce değersiz satırını silin`);
  }
  return out;
}

/**
 * Cari başına özet (kuruş): açık (kalan) şüpheli, karşılık, tahsil edilen, değersiz yazılan, çıkarılan, kayıt sayısı. Cari kartı ve ANLIK DURUM.
 */
export function doubtfulSummary(store, accountId) {
  const empty = { count: 0, openCount: 0, openMinor: 0, provisionMinor: 0, collectedMinor: 0, writtenOffMinor: 0, releasedMinor: 0 };
  if (!hasDoubtful(store)) return empty;
  const { records, state } = doubtfulState(store, { parties: [accountId] });
  const out = { ...empty };
  for (const record of records) {
    const s = state.get(record.id);
    if (!s) continue;
    out.count += 1;
    if (s.remaining > 0) out.openCount += 1;
    out.openMinor += s.remaining;
    out.provisionMinor += s.provision;
    out.collectedMinor += s.collected;
    out.writtenOffMinor += s.writtenOff;
    out.releasedMinor += s.released;
  }
  return out;
}

/**
 * Cari başına AÇIK şüpheli tutar (2.3.0 İz 1.6; plan §3.11b/5 "ANLIK DURUM, Alacak Yaşlandırma ve hatırlatmalar şüpheli tutarı ayrı gösterir"):
 * kalanı olan kayıtların carisi → { openMinor, provisionMinor, count }; totals bütün carilerin toplamı. Şüpheli hiç kullanılmamışsa tek sorgu
 * (doubtfulUsed) ve boş sonuç — listeler ve ANLIK DURUM bu yardımcıyı her istekte çağırır.
 */
export function doubtfulOpenByAccount(store) {
  const byAccount = new Map();
  const totals = { openMinor: 0, provisionMinor: 0, count: 0, accountCount: 0 };
  if (!doubtfulUsed(store)) return { byAccount, totals };
  const { records, state } = doubtfulState(store);
  for (const record of records) {
    const s = state.get(record.id);
    if (!s || s.remaining <= 0) continue;
    const item = byAccount.get(record.party) || { openMinor: 0, provisionMinor: 0, count: 0 };
    item.openMinor += s.remaining;
    item.provisionMinor += s.provision;
    item.count += 1;
    byAccount.set(record.party, item);
    totals.openMinor += s.remaining;
    totals.provisionMinor += s.provision;
    totals.count += 1;
  }
  totals.accountCount = byAccount.size;
  return { byAccount, totals };
}

/**
 * @param {{ store, bank, period, now: () => Date, accounts: () => object, trash?: object }} options  bank: lib/bank/post.mjs (para dışı yazıcı
 *   denetimi); period: hareket tarihi ve dönem kilidi; accounts: cari servisi (bakiye, Değersiz Alacak satırı yazıcısı)
 */
export function createDoubtful({ store, bank, period, now, accounts, trash = null }) {
  const stamp = () => now().toISOString();
  const byId = (user = null) => user?.id || "system";

  // ---------- Okuma ----------
  function recordRow(id, { accountId = "" } = {}) {
    const row = store.get(`${RECORD_SQL} WHERE d.id = ?`, text(id).slice(0, 120));
    if (!row || row.status === "cancelled" || (accountId && row.party !== accountId)) throw new HttpError(404, "Şüpheli alacak kaydı bulunamadı. Silinmiş ya da başka cariye ait olabilir.", { code: "doubtful-missing" });
    return withControl(row);
  }
  const writeOffsOf = recordId =>
    store.all(
      `SELECT e.id AS entryId, e.date, CAST(ROUND(e.amount * 100) AS INTEGER) AS amountMinor, e.note, COALESCE((SELECT f.no FROM fin_events f WHERE f.type = 'doubtful_writeoff' AND f.src_table = 'account_entries' AND f.src_id = e.id AND f.status = 'active' LIMIT 1), '') AS eventNo
       FROM account_entries e WHERE e.source = 'doubtful' AND e.source_id = ? ORDER BY e.date, e.created_at, e.rowid`,
      recordId,
    );
  function view(record, state, allocations) {
    const base = doubtfulView(record, state);
    const provisions = store.all(`${PROVISION_SQL} WHERE p.doubtful_id = ? AND p.status = 'active' ORDER BY p.date, p.rowid`, record.id).map(item => ({ id: item.id, date: item.date, amountMinor: item.amountMinor, note: item.note, eventNo: item.eventNo }));
    const writeOffs = writeOffsOf(record.id).map(item => {
      const hit = allocations?.get(`account:${item.entryId}`);
      return { ...item, provisionMinor: hit?.provisionUsed || 0, lossMinor: hit ? hit.lossMinor : item.amountMinor };
    });
    return {
      id: record.id, accountId: record.party, accountName: record.accountName, accountRefNo: record.accountRefNo, date: record.date,
      reason: record.reason, reasonLabel: record.reasonLabel, note: record.note, chequeId: record.chequeId, chequeSerialNo: record.chequeSerialNo,
      closedDate: record.closedDate, eventId: record.eventId, eventNo: record.eventNo, closeEventId: record.closeEventId, closeEventNo: record.closeEventNo,
      createdBy: record.createdBy, createdAt: record.createdAt, ...base, provisions, writeOffs,
    };
  }
  /** Carinin kayıtları (iptal edilenler hariç) ve özeti. */
  function listFor(accountId) {
    const { records, state, allocations } = doubtfulState(store, { parties: [accountId] });
    return { records: records.map(record => view(record, state.get(record.id), allocations)), summary: doubtfulSummary(store, accountId) };
  }
  /** Rapor verisi: bütün (silinmemiş) carilerin kayıtları; status open | closed | all; from/to kayıt tarihine. "Açık" durumu TARİH İTİBARIYLA
   *  listedir (eleştirmen E1, 15.10.2026): dönem başlangıcı süzmez — geçen yıl açılmış, hâlâ açık kayıt "Bu Yıl"da görünür, TOPLAM Kalan = 128. */
  function report({ from = "", to = "", status = "open" } = {}) {
    const { records, state, allocations } = doubtfulState(store);
    const rows = records
      .filter(record => (!from || status === "open" || record.date >= from) && (!to || record.date <= to))
      .map(record => view(record, state.get(record.id), allocations))
      .filter(row => (status === "all" ? true : status === "closed" ? row.stateKey !== "open" : row.stateKey === "open"));
    const totals = { count: rows.length, amountMinor: 0, provisionMinor: 0, provisionReleasedMinor: 0, collectedMinor: 0, writtenOffMinor: 0, releasedMinor: 0, remainingMinor: 0 };
    for (const row of rows) for (const key of Object.keys(totals)) if (key !== "count") totals[key] += Number(row[key]) || 0;
    return { rows, totals, from, to, status };
  }
  const stateOf = (record, scope = null) => {
    const { state, allocations } = doubtfulState(store, { parties: [record.party] });
    return { state: state.get(record.id) || null, allocations, ...(scope ? {} : {}) };
  };

  // ---------- Yazım (bank.post'un write geri çağrısında) ----------
  // İşlem başlığı (para satırı yok): dokunulan olaylara girer (kapı, K6).
  function openEvent(ctx, { type, date, srcTable, srcId, partyId, minor, chequeId = "", description, user }) {
    const { year, seq, no } = nextEventNo(store, date, { now });
    const id = newEventId();
    store.run(
      `INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, origin_key, src_table, src_id, bank_ref, direction, amount_minor, try_minor, currency, method, party_id, cheque_id, description, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 'manual', '', ?, ?, '', '', ?, ?, 'TRY', '', ?, ?, ?, ?, ?)`,
      id, year, seq, no, type, date, srcTable, srcId, minor, minor, partyId, chequeId || "", String(description || "").slice(0, 300), byId(user), stamp(),
    );
    bank.assertWrittenNonMoney("fin_events", id);
    ctx?.events?.add(id);
    ctx?.created?.add(id);
    return { id, no };
  }
  function setEventStatus(ctx, id, status, user) {
    if (!id) return;
    store.run("UPDATE fin_events SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?", status, byId(user), stamp(), id);
    bank.assertWrittenNonMoney("fin_events", id);
    ctx?.events?.add(id);
  }
  const accountRow = accountId => store.get("SELECT id, name, type, deleted_at AS deletedAt FROM accounts WHERE id = ?", text(accountId).slice(0, 120));
  const liveAccount = accountId => {
    const account = accountRow(accountId);
    if (!account || account.deletedAt) throw new HttpError(404, "Cari bulunamadı. Silinmiş olabilir.");
    return account;
  };
  /** Carinin kartındaki bakiye (kuruş; cari servisinin kendi hesabı) ve açık şüpheli tutarı. */
  function headroom(accountId) {
    const account = accounts()?.list ? accounts().list(AUDITOR, { status: "all", ids: [accountId] }).accounts[0] : null;
    const balanceMinor = account ? toMinor(Number(account.balance) || 0) : 0;
    const openMinor = doubtfulSummary(store, accountId).openMinor;
    return { balanceMinor, openMinor, roomMinor: balanceMinor - openMinor };
  }
  /** Carinin ilk borç tarihi: cari satırı (borç / ödeme), taksit kartı başlangıcı, kesilmiş satış faturası; yoksa ''. */
  function firstDebitDate(accountId) {
    const dates = [store.get("SELECT MIN(date) AS d FROM account_entries WHERE account_id = ? AND kind IN ('debt', 'out')", accountId)?.d];
    if (hasTable(store, "plans")) dates.push(store.get("SELECT MIN(COALESCE(NULLIF(registered_on, ''), substr(created_at, 1, 10))) AS d FROM plans WHERE account_id = ? AND deleted_at IS NULL", accountId)?.d);
    if (hasTable(store, "invoices")) dates.push(store.get("SELECT MIN(issue_date) AS d FROM invoices WHERE account_id = ? AND status = 'issued' AND kind IN ('sale', 'purchase_return')", accountId)?.d);
    return dates.filter(Boolean).sort()[0] || "";
  }
  const dateAfterRecord = (date, record, label) => {
    if (date < record.date) throw new HttpError(400, `${label} (${dayText(date)}) şüpheli alacak kaydının tarihinden (${dayText(record.date)}) önce olamaz.`, { code: "date-before-record", field: "date" });
  };
  const amountOf = (value, label = "Tutar") => parseMinor(value, { label });
  const describe = (record, head) => [head, record.reasonLabel, record.chequeSerialNo ? `Evrak No ${record.chequeSerialNo}` : "", record.accountName].filter(Boolean).join(" · ");

  /**
   * Şüpheli Alacağa Al (§3.11b/2): yalnız müşteri carisi; tutar ≤ borç bakiyesi − açık şüpheli; neden; karşılıksız evrak kısayolu (chequeId:
   * bu carinin karşılıksız alınan evrakı → neden ve tutar evraktan). Yazılanlar: doubtful_receivables (open) + fin_events (doubtful_take).
   */
  function take(ctx, { user, accountId, body = {} }) {
    const account = liveAccount(accountId);
    if (account.type !== "customer") throw new HttpError(409, `“${account.name}” müşteri carisi değil; şüpheli ticari alacak yalnız müşteri (120) carisinde izlenir.`, { code: "doubtful-customer-only" });
    let cheque = null;
    const chequeId = text(body.chequeId).slice(0, 120);
    if (chequeId) {
      cheque = store.get("SELECT id, direction, instrument, status, amount, serial_no AS serialNo, account_id AS accountId FROM cheques WHERE id = ? AND deleted_at IS NULL", chequeId);
      if (!cheque || cheque.accountId !== account.id) throw new HttpError(404, "Evrak bu caride bulunamadı.", { code: "doubtful-cheque-missing" });
      if (cheque.direction !== "in" || cheque.status !== "bounced") throw new HttpError(409, `${cheque.instrument === "note" ? "Senet" : "Çek"}${cheque.serialNo ? ` No ${cheque.serialNo}` : ""} karşılıksız/protestolu değil; yalnız karşılıksız dönen alınan evrak şüpheli alacağa alınır.`, { code: "doubtful-cheque-not-bounced" });
    }
    const reason = text(body.reason) || (cheque ? (cheque.instrument === "note" ? "note" : "cheque") : "");
    if (!isDoubtfulReason(reason)) throw new HttpError(400, "Neden seçin: Karşılıksız Çek, Protestolu Senet, Dava, İcra ya da Diğer.", { code: "doubtful-reason", field: "reason" });
    const date = period.movementDate(body, { label: "Tarih" });
    const minor = body.amount === undefined || body.amount === null || body.amount === "" ? (cheque ? toMinor(Number(cheque.amount) || 0) : amountOf(body.amount)) : amountOf(body.amount);
    // Yargıç 2.3.0 #7 (15.10.2026): kayıt tarihi carinin ilk borç satırından (cari satırı borç/ödeme, taksit kartı, kesilmiş fatura) önce olamaz —
    // o tarihte alacak yokken 128'e alınırdı (o ayın mizanında 120 eksi).
    const firstDebit = firstDebitDate(account.id);
    if (!firstDebit || date < firstDebit) throw new HttpError(400, firstDebit ? `Kayıt tarihi (${dayText(date)}) carinin ilk borç hareketinden (${dayText(firstDebit)}) önce olamaz; o tarihte şüpheliye alınacak alacak yoktu.` : "Carinin borç hareketi yok; şüpheliye alınacak alacak bulunmuyor.", { code: "doubtful-before-debt", field: "date", firstDebit: firstDebit || "" });
    const room = headroom(account.id);
    if (minor > room.roomMinor) {
      throw new HttpError(400, `Şüpheliye alınacak tutar (${tl(minor)}) carinin borç bakiyesini aşıyor: bakiye ${tl(room.balanceMinor)}${room.openMinor ? `, zaten şüphelide ${tl(room.openMinor)}` : ""} → en çok ${tl(Math.max(0, room.roomMinor))}.`, { code: "doubtful-exceeds-balance", field: "amount", balanceMinor: room.balanceMinor, openMinor: room.openMinor });
    }
    const note = limited(body.note ?? "", 300, "Açıklama");
    const id = `dbt-${randomUUID()}`;
    const label = { reasonLabel: DOUBTFUL_REASONS[reason], chequeSerialNo: cheque?.serialNo || "", accountName: account.name };
    const event = openEvent(ctx, { type: "doubtful_take", date, srcTable: "doubtful_receivables", srcId: id, partyId: account.id, minor, chequeId: cheque?.id || "", description: describe(label, "Şüpheli alacağa alındı"), user });
    store.run(
      "INSERT INTO doubtful_receivables (id, account_id, date, amount_minor, reason, note, cheque_id, status, closed_date, event_id, close_event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', '', ?, '', ?, ?)",
      id, account.id, date, minor, reason, note, cheque?.id || "", event.id, byId(user), stamp(),
    );
    bank.assertWrittenNonMoney("doubtful_receivables", id);
    const record = recordRow(id);
    return { record: view(record, stateOf(record).state, stateOf(record).allocations), event, account, minor, date, reason, note };
  }
  /** Açık (kalanı olan) kayıt; değilse 409 doubtful-closed. */
  function openRecord(accountId, did) {
    const record = recordRow(did, { accountId });
    const { state, allocations } = stateOf(record);
    if (record.status !== "open" || !state || state.remaining <= 0) {
      const why = record.status === "released" ? "şüpheliden çıkarılmış" : state?.writtenOff > 0 ? "değersiz yazılarak kapanmış" : "tamamı tahsil edilmiş";
      throw new HttpError(409, `Bu şüpheli alacak kaydı ${why}; kalan tutar yok.`, { code: "doubtful-closed", recordId: record.id });
    }
    return { record, state, allocations };
  }
  /** Şüpheliden Çıkar (§3.11b/2): kalan B 120 / A 128, karşılık B 129 / A 644 — yevmiye türetir; burada kapanış başlığı + durum. */
  function release(ctx, { user, accountId, did, body = {} }) {
    const { record, state } = openRecord(accountId, did);
    const date = period.movementDate(body, { label: "Tarih" });
    dateAfterRecord(date, record, "Çıkarma tarihi");
    const note = limited(body.note ?? "", 300, "Açıklama");
    const event = openEvent(ctx, { type: "doubtful_release", date, srcTable: "doubtful_receivables", srcId: record.id, partyId: record.party, minor: state.remaining, chequeId: record.chequeId, description: describe(record, `Şüpheliden çıkarıldı${note ? ` · ${note}` : ""}`), user });
    store.run("UPDATE doubtful_receivables SET status = 'released', closed_date = ?, close_event_id = ?, updated_by = ?, updated_at = ? WHERE id = ? AND status = 'open'", date, event.id, byId(user), stamp(), record.id);
    bank.assertWrittenNonMoney("doubtful_receivables", record.id);
    const fresh = recordRow(record.id);
    const after = stateOf(fresh);
    return { record: view(fresh, after.state, after.allocations), event, releasedMinor: state.remaining, date, note };
  }
  /** Karşılık Ayır (§3.11b/3, VUK 323): toplam karşılık ≤ kalan şüpheli. */
  function provision(ctx, { user, accountId, did, body = {} }) {
    const { record, state } = openRecord(accountId, did);
    const date = period.movementDate(body, { label: "Tarih" });
    dateAfterRecord(date, record, "Karşılık tarihi");
    const minor = amountOf(body.amount, "Karşılık tutarı");
    if (state.provision + minor > state.remaining) {
      throw new HttpError(400, `Karşılık (${tl(minor)}) kalan şüpheli tutarı aşıyor: kalan ${tl(state.remaining)}${state.provision ? `, ayrılmış karşılık ${tl(state.provision)}` : ""} → en çok ${tl(Math.max(0, state.remaining - state.provision))}.`, { code: "doubtful-provision-exceeds", field: "amount", remainingMinor: state.remaining, provisionMinor: state.provision });
    }
    const note = limited(body.note ?? "", 300, "Açıklama");
    const id = `dbtp-${randomUUID()}`;
    const event = openEvent(ctx, { type: "doubtful_provision", date, srcTable: "doubtful_provisions", srcId: id, partyId: record.party, minor, chequeId: record.chequeId, description: describe(record, `Karşılık ayrıldı${note ? ` · ${note}` : ""}`), user });
    store.run("INSERT INTO doubtful_provisions (id, doubtful_id, date, amount_minor, note, status, event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)", id, record.id, date, minor, note, event.id, byId(user), stamp());
    bank.assertWrittenNonMoney("doubtful_provisions", id);
    const after = stateOf(record);
    return { record: view(record, after.state, after.allocations), event, provisionId: id, minor, date, note };
  }
  /** Değersiz Alacak Yaz (§3.11b/3): cari kartına alacak satırı (source 'doubtful') + başlık; yevmiye B 129/659 / A 128 türetir. */
  function writeOff(ctx, { user, accountId, did, body = {} }) {
    const { record, state } = openRecord(accountId, did);
    const date = period.movementDate(body, { label: "Tarih" });
    dateAfterRecord(date, record, "Değersiz yazma tarihi");
    const minor = amountOf(body.amount, "Değersiz alacak tutarı");
    if (minor > state.remaining) throw new HttpError(400, `Değersiz yazılacak tutar (${tl(minor)}) kalan şüpheli tutarı (${tl(state.remaining)}) aşıyor.`, { code: "doubtful-writeoff-exceeds", field: "amount", remainingMinor: state.remaining });
    const note = limited(body.note ?? "", 300, "Açıklama");
    const writer = accounts()?.doubtfulEntry;
    if (!writer) throw new HttpError(503, "Cari servisi hazır değil.");
    const entry = writer.add(user, record.party, { amount: fromMinor(minor), date, note: note ? `Değersiz alacak · ${note}` : "Değersiz alacak", recordId: record.id });
    const event = openEvent(ctx, { type: "doubtful_writeoff", date, srcTable: "account_entries", srcId: entry.id, partyId: record.party, minor, chequeId: record.chequeId, description: describe(record, `Değersiz alacak yazıldı${note ? ` · ${note}` : ""}`), user });
    const after = stateOf(record);
    return { record: view(record, after.state, after.allocations), event, entryId: entry.id, minor, date, note };
  }
  const assertOpenDates = (dates, what) => {
    for (const date of dates.filter(Boolean)) period.assertOpen(date, what);
  };
  /**
   * Silme çakışması (15.10.2026; Uzun Doğrulama #199 tohum 10): silinen kaydın tahsilatları carinin öbür kayıtlarına kayar; daha önce çıkarılmış
   * kaydın "Şüpheliden Çıkar" başlığı ya da bir Değersiz Alacak satırı artık kalana sığmazsa yazım tamamen geri alınır ve neden AÇIK yazılır
   * (önceden yalnız kapı "ledger-integrity … yöneticinize bildirin" diyordu). Silme işleminden sonra, aynı işlem içinde çağrılır.
   */
  // K5 (2.3.0 kontrol turu 2): kullanıcıya kapının iç örneği (ham kayıt kimliği) değil, kaydın tarihi ve tutarıyla neden + ne yapacağı yazılır;
  // kapı örnekleri yanıtın `problems` alanında kalır (destek için).
  const conflictReason = key => {
    const [id, kind] = [key.slice(0, key.lastIndexOf(":")), key.slice(key.lastIndexOf(":") + 1)];
    if (kind === "outside") {
      const entry = store.get("SELECT date, amount FROM account_entries WHERE id = ?", id.replace(/^account:/, ""));
      return entry ? { text: `${dayText(entry.date)} tarihli ${tl(Math.round(Number(entry.amount) * 100))} Değersiz Alacak satırı kaydın kalanını aşardı`, fix: "Değersiz Alacak satırını" } : null;
    }
    const record = store.get("SELECT date, amount_minor AS amountMinor FROM doubtful_receivables WHERE id = ?", id);
    if (!record) return null;
    const label = `${dayText(record.date)} tarihli ${tl(record.amountMinor)} şüpheli kaydının`;
    if (kind === "close-amount") return { text: `${label} Şüpheliden Çıkar tutarı değişirdi`, fix: "o kaydı" };
    if (kind === "provision" || kind === "provision-left") return { text: `${label} karşılığı kalan tutarı aşardı`, fix: "o kaydı" };
    return null;
  };
  const assertNoConflict = (party, what, verb = "silinemez") => {
    const problems = doubtfulProblems(store, { parties: [party] });
    if (!problems.length) return;
    const reasons = [...new Map(problems.map(item => conflictReason(item.key)).filter(Boolean).map(item => [item.text, item])).values()];
    const message = reasons.length
      ? `${what} ${verb}: carinin öbür şüpheli kayıtları bozulurdu (${reasons.map(item => item.text).join("; ")}). Önce ${reasons[0].fix} silin, sonra yeniden deneyin.`
      : `${what} ${verb}: carinin öbür şüpheli kayıtları bozulurdu. Önce carinin sonraki şüpheli işlemlerini silin, sonra yeniden deneyin.`;
    throw new HttpError(409, message, { code: "doubtful-delete-conflict", problems: problems.map(item => item.sample) });
  };
  /** Sil (kayıt hatası): kayıt + karşılıkları iptal (başlıklar cancelled), Silinenler'e. Değersiz satırı olan kayıt silinmez (önce satır). */
  function remove(ctx, { user, accountId, did }) {
    const record = recordRow(did, { accountId });
    const provisions = store.all(`${PROVISION_SQL} WHERE p.doubtful_id = ? AND p.status = 'active'`, record.id);
    assertOpenDates([record.date, record.closedDate, ...provisions.map(item => item.date)], "Şüpheli alacak kaydı");
    const writeOffs = writeOffsOf(record.id);
    if (writeOffs.length) throw new HttpError(409, `Bu kaydın ${writeOffs.length} Değersiz Alacak satırı var; önce değersiz yazmayı silin (kart → Değersiz Alacaklar → Sil).`, { code: "doubtful-has-writeoffs", count: writeOffs.length });
    for (const item of provisions) {
      store.run("UPDATE doubtful_provisions SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE id = ?", byId(user), stamp(), item.id);
      bank.assertWrittenNonMoney("doubtful_provisions", item.id);
      setEventStatus(ctx, item.eventId, "cancelled", user);
    }
    setEventStatus(ctx, record.eventId, "cancelled", user);
    setEventStatus(ctx, record.closeEventId, "cancelled", user);
    store.run("UPDATE doubtful_receivables SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE id = ?", byId(user), stamp(), record.id);
    bank.assertWrittenNonMoney("doubtful_receivables", record.id);
    assertNoConflict(record.party, "Şüpheli alacak kaydı");
    const payload = { kind: "record", id: record.id, accountId: record.party, accountName: record.accountName, date: record.date, amountMinor: record.amountMinor, reason: record.reason, note: record.note, status: record.status, closedDate: record.closedDate, eventId: record.eventId, closeEventId: record.closeEventId, provisions: provisions.map(item => ({ id: item.id, date: item.date, amountMinor: item.amountMinor, eventId: item.eventId })) };
    trash?.add({ kind: "doubtful", ref: record.id, title: record.accountName, detail: `${record.reasonLabel} · ${tl(record.amountMinor)} · ${dayText(record.date)}`, payload, user });
    return { record: payload, provisions: provisions.length };
  }
  function removeProvision(ctx, { user, accountId, did, pid }) {
    const record = recordRow(did, { accountId });
    const item = store.get(`${PROVISION_SQL} WHERE p.id = ? AND p.doubtful_id = ? AND p.status = 'active'`, text(pid).slice(0, 120), record.id);
    if (!item) throw new HttpError(404, "Karşılık kaydı bulunamadı.", { code: "doubtful-provision-missing" });
    period.assertOpen(item.date, "Karşılık kaydı");
    store.run("UPDATE doubtful_provisions SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE id = ?", byId(user), stamp(), item.id);
    bank.assertWrittenNonMoney("doubtful_provisions", item.id);
    setEventStatus(ctx, item.eventId, "cancelled", user);
    const payload = { kind: "provision", id: item.id, recordId: record.id, accountId: record.party, accountName: record.accountName, date: item.date, amountMinor: item.amountMinor, note: item.note, eventId: item.eventId };
    trash?.add({ kind: "doubtful-provision", ref: item.id, title: record.accountName, detail: `Karşılık ${tl(item.amountMinor)} · ${dayText(item.date)}`, payload, user });
    return { provision: payload };
  }
  function removeWriteOff(ctx, { user, accountId, did, entryId }) {
    const record = recordRow(did, { accountId });
    const entry = store.get("SELECT * FROM account_entries WHERE id = ? AND source = 'doubtful' AND source_id = ? AND account_id = ?", text(entryId).slice(0, 120), record.id, record.party);
    if (!entry) throw new HttpError(404, "Değersiz Alacak satırı bulunamadı.", { code: "doubtful-writeoff-missing" });
    period.assertOpen(entry.date, "Değersiz Alacak satırı");
    const head = store.get("SELECT id FROM fin_events WHERE type = 'doubtful_writeoff' AND src_table = 'account_entries' AND src_id = ? AND status = 'active'", entry.id);
    accounts().doubtfulEntry.remove(entry.id);
    setEventStatus(ctx, head?.id, "cancelled", user);
    const payload = { kind: "writeoff", id: entry.id, recordId: record.id, accountId: record.party, accountName: record.accountName, date: entry.date, amountMinor: toMinor(Number(entry.amount) || 0), entry, eventId: head?.id || "" };
    assertNoConflict(record.party, "Değersiz Alacak satırı");
    trash?.add({ kind: "doubtful-writeoff", ref: entry.id, title: record.accountName, detail: `Değersiz alacak ${tl(payload.amountMinor)} · ${dayText(entry.date)}`, payload, user });
    return { writeOff: payload };
  }
  /** Silinenler'den geri yükleme (routes/trash.mjs; bank.post op 'restore' içinde): aynı kimlik, tarih ve tutarla. */
  function restore(ctx, { user, payload }) {
    const kind = payload?.kind;
    if (kind === "record") {
      const row = store.get("SELECT * FROM doubtful_receivables WHERE id = ?", payload.id);
      if (!row || row.status !== "cancelled") throw new HttpError(404, "Bu şüpheli alacak kaydı zaten geri yüklenmiş.");
      period.restoreDate(row.date, "Bu şüpheli alacak kaydı");
      if (payload.status === "released" && payload.closedDate) period.restoreDate(payload.closedDate, "Bu kaydın çıkarılması");
      const account = liveAccount(row.account_id);
      store.run("UPDATE doubtful_receivables SET status = ?, closed_date = ?, close_event_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", payload.status === "released" ? "released" : "open", payload.status === "released" ? payload.closedDate || "" : "", payload.status === "released" ? payload.closeEventId || "" : "", byId(user), stamp(), row.id);
      bank.assertWrittenNonMoney("doubtful_receivables", row.id);
      // Yargıç 2.3.0 #4 (15.10.2026): önceki ön denetim kayıt tutarını bugünkü bakiyeyle kıyaslıyor, ayırma kuralının (K3) bu kayda düşüreceği
      // tahsilatı saymıyordu (tahsilatlı kayıt kalıcı 409). Şimdi kayıt geri yüklenmiş hâliyle (aynı işlemde) denetlenir: carinin normal alacağı
      // (120 = kart − açık şüpheli) eksiye düşerse 409, işlem geri alınır; tam kapı (doubtful:balance) aynı kuralı ayrıca koşar.
      if (payload.status !== "released") {
        const room = headroom(account.id);
        if (room.roomMinor < 0) throw new HttpError(409, `Kayıt geri yüklenemez: carinin borç bakiyesi (${tl(room.balanceMinor)}) geri yüklenen kayıtla birlikte açık şüpheli tutarı (${tl(room.openMinor)}) artık karşılamıyor; carinin 120 bakiyesi ${tl(room.roomMinor)} olurdu. Önce carinin tahsilat/alacak satırlarını ya da öbür şüpheli kayıtlarını düzeltin.`, { code: "doubtful-exceeds-balance", balanceMinor: room.balanceMinor, openMinor: room.openMinor });
      }
      setEventStatus(ctx, row.event_id, "active", user);
      if (payload.status === "released") setEventStatus(ctx, payload.closeEventId, "active", user);
      for (const item of payload.provisions || []) {
        period.restoreDate(item.date, "Bu kaydın karşılığı");
        store.run("UPDATE doubtful_provisions SET status = 'active', updated_by = ?, updated_at = ? WHERE id = ? AND status = 'cancelled'", byId(user), stamp(), item.id);
        bank.assertWrittenNonMoney("doubtful_provisions", item.id);
        setEventStatus(ctx, item.eventId, "active", user);
      }
      // Kontrol turu 2 K2 (15.10.2026): geri yükleme de silme gibi carinin öbür kayıtlarını (çıkarma başlığı, değersiz satırı) bozabilir → açık 409.
      assertNoConflict(account.id, "Şüpheli alacak kaydı", "geri yüklenemez");
      return { id: row.id, accountId: row.account_id, message: `“${account.name}” şüpheli alacak kaydı (${tl(row.amount_minor)}) geri geldi.` };
    }
    if (kind === "provision") {
      const row = store.get("SELECT * FROM doubtful_provisions WHERE id = ?", payload.id);
      if (!row || row.status !== "cancelled") throw new HttpError(404, "Bu karşılık kaydı zaten geri yüklenmiş.");
      period.restoreDate(row.date, "Bu karşılık");
      const { record, state } = openRecord(payload.accountId, row.doubtful_id);
      if (state.provision + Number(row.amount_minor) > state.remaining) throw new HttpError(409, `Karşılık geri yüklenemez: kalan şüpheli tutar (${tl(state.remaining)}) karşılığı (${tl(row.amount_minor)}${state.provision ? ` + ayrılmış ${tl(state.provision)}` : ""}) artık karşılamıyor.`, { code: "doubtful-provision-exceeds" });
      store.run("UPDATE doubtful_provisions SET status = 'active', updated_by = ?, updated_at = ? WHERE id = ?", byId(user), stamp(), row.id);
      bank.assertWrittenNonMoney("doubtful_provisions", row.id);
      setEventStatus(ctx, row.event_id, "active", user);
      return { id: row.id, accountId: record.party, message: `“${record.accountName}” karşılığı (${tl(row.amount_minor)}) geri geldi.` };
    }
    if (kind === "writeoff") {
      if (store.get("SELECT 1 AS found FROM account_entries WHERE id = ?", payload.id)) throw new HttpError(404, "Bu Değersiz Alacak satırı zaten geri yüklenmiş.");
      period.restoreDate(payload.date, "Bu Değersiz Alacak satırı");
      const { record, state } = openRecord(payload.accountId, payload.recordId);
      if (Number(payload.amountMinor) > state.remaining) throw new HttpError(409, `Değersiz Alacak satırı geri yüklenemez: kalan şüpheli tutar (${tl(state.remaining)}) tutarı (${tl(payload.amountMinor)}) artık karşılamıyor.`, { code: "doubtful-writeoff-exceeds" });
      accounts().doubtfulEntry.reinsert(user, payload.entry);
      setEventStatus(ctx, payload.eventId, "active", user);
      return { id: payload.id, accountId: record.party, message: `“${record.accountName}” değersiz alacak satırı (${tl(payload.amountMinor)}) geri geldi.` };
    }
    throw new HttpError(400, "Bilinmeyen öğe.");
  }
  /** Cari silinmeden önce (routes/accounts.mjs): şüpheli alacak kaydı olan cari silinmez (defter izi; açık ya da kapanmış). */
  function assertNone(accountId, what = "silinemez", hint = "Önce kayıtları silin ya da cariyi pasife alın.") {
    if (!hasDoubtful(store)) return;
    const n = Number(store.get("SELECT COUNT(*) AS n FROM doubtful_receivables WHERE account_id = ? AND status <> 'cancelled'", accountId)?.n) || 0;
    if (n) throw new HttpError(409, `Bu carinin ${n} şüpheli alacak kaydı var; cari ${what}. ${hint}`, { code: "account-doubtful-open", count: n });
  }
  /** Cari satırının (account_entries) ayırma kuralıyla şüpheli kayıtlara düşen kuruşu (kontrol turu 2 K3; routes/accounts.mjs assertNormalRoom). */
  const allocatedMinor = (accountId, entryId) => (doubtfulState(store, { parties: [accountId] }).allocations.get(`account:${entryId}`)?.records || []).reduce((sum, item) => sum + item.minor, 0);
  return { recordRow, listFor, report, summary: accountId => doubtfulSummary(store, accountId), openByAccount: () => doubtfulOpenByAccount(store), headroom, allocatedMinor, take, release, provision, writeOff, remove, removeProvision, removeWriteOff, restore, assertNone, statusOf: doubtfulStatusOf };
}
