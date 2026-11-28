// 2.5.1 D3 — devir planının OKUYUCUSU (docs/devir/D3-D4-TASARIM.md §3.2). Şirket dosyasından devir planının olgularını (plan.mjs buildDevirPlan girdisi) TEK okuma işleminde
// (çağıran BEGIN açar: WAL anlık görüntüsü) toplu SQL ile okur; cari / öğe başına ağır okuma yok (ders 47). HİÇBİR ŞEY YAZMAZ.
//
// Tek kaynaklar OKUNUR, DEĞİŞTİRİLMEZ: karma yevmiye (routes/ledger.mjs build / book), tek borç sırası (lib/obligation-queue.mjs buildObligations + lib/obligation-input.mjs
// girdi kurucusu), şüpheli ayırıcısı (lib/doubtful-gl.mjs allocateDoubtful + lib/bank/doubtful.mjs yükleyicileri), stok değerlemesi (lib/stock-valuation.mjs), mali tablo
// hesabının kapanış günü (lib/financial-statements.mjs closingDayOf), Kural Farkı planı (lib/ledger-opening.mjs). Hiçbir işlevin davranışı değişmedi; dışa açılan işlev yok.
import { createHash } from "node:crypto";
import { buildObligations } from "../obligation-queue.mjs";
import { createObligationInput } from "../obligation-input.mjs";
import { allocateDoubtful } from "../doubtful-gl.mjs";
import { doubtfulCredits, doubtfulRows } from "../bank/doubtful.mjs";
import { createStockValuation, loadValuationInput } from "../stock-valuation.mjs";
import { closingDayOf } from "../financial-statements.mjs";
import { bookTypeOf } from "../book-type.mjs";
import { LEDGER_RULE_VERSION, reconcile, trialBalance } from "../general-ledger.mjs";
import { CLOSE_RULE_WAIVE, closeDaySql } from "../accounts.mjs";
import { postedRuleDiffCorrections, ruleDiffCorrectionPlan, ruleDiffCorrectionYear } from "../ledger-opening.mjs";
import { INVOICE_KINDS } from "../invoice-math.mjs";
import { voucherNoText } from "../ledger-vouchers.mjs";
import { dayAfter } from "./plan.mjs";
import { DEVIR_YEARS_KEY, devirYearsOfSetting } from "./archives.mjs";

/**
 * Şemadaki HER tablonun devirdeki sınıfı (tasarım §2; BAŞ MİMAR KARARI 27.11 (4): adı planda geçmeyen beş defter tablosu dahil). D dokunulmaz · O ortak katman · B ≤K budanır,
 * yeni yılda açılış · A açık olan kalır, kapanmış ≤K budanır. Şemada olup burada olmayan tablo planda "siniflandirilmamis-tablo" sorunudur (plan §8.16; test kırılır).
 * date: B / A tablosunun kesim ölçütü (satırın tarihi; YYYY-MM-DD ya da ISO anı) — yalnız sayım (ön izleme); budamanın kendisi D4'te.
 */
export const DEVIR_TABLE_CLASSES = Object.freeze({
  users: { sinif: "O" }, roles: { sinif: "O" }, sessions: { sinif: "O" }, mobile_access: { sinif: "O" }, mobile_codes: { sinif: "O" }, mobile_devices: { sinif: "O" }, mobile_sessions: { sinif: "O" },
  settings: { sinif: "D" }, records: { sinif: "D" }, overrides: { sinif: "D" }, deleted_records: { sinif: "D" }, notes: { sinif: "D" }, phones: { sinif: "D" }, liens: { sinif: "D" },
  tasks: { sinif: "D" }, messages: { sinif: "D" }, case_notes: { sinif: "D" }, source_snapshots: { sinif: "D" }, case_documents: { sinif: "D" },
  chat_conversations: { sinif: "D" }, chat_members: { sinif: "D" }, chat_messages: { sinif: "D" }, dataset_rows: { sinif: "D" }, dataset_imports: { sinif: "D" },
  free_sheets: { sinif: "D" }, free_rows: { sinif: "D" }, free_cells: { sinif: "D" }, free_history: { sinif: "D" }, plan_groups: { sinif: "D" }, accounts: { sinif: "D" }, stock_items: { sinif: "D" },
  audit_events: { sinif: "D" }, integrity_log: { sinif: "D" }, edoc_usage: { sinif: "D" }, edoc_usage_meta: { sinif: "D" }, einvoice_inbox: { sinif: "D" }, invoice_repeats: { sinif: "D" },
  message_sends: { sinif: "D" }, wa_batches: { sinif: "D" }, wa_jobs: { sinif: "D" }, wa_job_pdfs: { sinif: "D" },
  maliyet_sekmeler: { sinif: "D" }, maliyet_kartlar: { sinif: "D" }, maliyet_satirlar: { sinif: "D" }, maliyet_adimlar: { sinif: "D" }, maliyet_hucreler: { sinif: "D" }, maliyet_basliklar: { sinif: "D" },
  staff_members: { sinif: "D" }, pos_terminals: { sinif: "D" }, pos_rates: { sinif: "D" }, fx_rates: { sinif: "D" }, bank_holidays: { sinif: "D" }, bank_accounts: { sinif: "D" },
  bank_statements: { sinif: "D" }, bank_statement_lines: { sinif: "D" }, bank_matches: { sinif: "D" }, request_keys: { sinif: "D" }, backup_meta: { sinif: "D" }, edoc_usage_defter: { sinif: "D" },
  payments: { sinif: "B", date: "date" }, cash_entries: { sinif: "B", date: "date" }, account_entries: { sinif: "B", date: "date" }, stock_moves: { sinif: "B", date: "date" },
  plan_entries: { sinif: "B", date: "date" }, plan_imports: { sinif: "B", date: "substr(created_at, 1, 10)" }, fin_events: { sinif: "B", date: "date" },
  bank_lines: { sinif: "B", date: "(SELECT e.date FROM fin_events e WHERE e.id = t.event_id)" }, vat_offsets: { sinif: "B", date: "date" }, invoice_offsets: { sinif: "B", date: "date" },
  invoices: { sinif: "B", date: "issue_date" }, invoice_lines: { sinif: "B", date: "(SELECT i.issue_date FROM invoices i WHERE i.id = t.invoice_id)" },
  // BAŞ MİMAR KARARI 27.11 (4) (B-2; C2 §11, C3 §11 önerisi): saklanan fiş ve donmuş defter ≤K budanır, yeni yılda açılış fişi / kapsam K.
  ledger_vouchers: { sinif: "B", date: "date" }, ledger_voucher_lines: { sinif: "B", date: "(SELECT v.date FROM ledger_vouchers v WHERE v.id = t.voucher_id)" },
  ledger_snapshots: { sinif: "B", date: "date" }, ledger_snapshot_runs: { sinif: "B", date: "through" }, ledger_valuation_cards: { sinif: "B", date: "(SELECT r.through FROM ledger_snapshot_runs r WHERE r.no = t.run)" },
  pos_sales: { sinif: "A", date: "date" }, pos_items: { sinif: "A", date: "value_date" }, bank_plans: { sinif: "A", date: "planned_date" }, bank_jobs: { sinif: "A", date: "due_date" },
  trash: { sinif: "A", date: "substr(deleted_at, 1, 10)" }, cheques: { sinif: "A", date: "issue_date" }, cheque_events: { sinif: "A", date: "date" }, cheque_collections: { sinif: "A", date: "given_date" },
  doubtful_receivables: { sinif: "A", date: "date" }, doubtful_provisions: { sinif: "A", date: "date" }, plans: { sinif: "A", date: "registered_on" }, plan_items: { sinif: "A", date: "due_date" },
});

const has = (store, table) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
const columns = (store, table) => new Set(store.all(`PRAGMA table_info(${table})`).map(row => row.name));
const minor = value => Math.round((Number(value) || 0) * 100);
const ms = start => Math.round((performance.now() - start) * 10) / 10;

// Veri damgasına giren denetim izi türleri (D3 tur 4): YALNIZ verinin değişimini yazan iz (kayıt düzenleme / silme satır sayısını değiştirmez — izi değiştirir). Giriş (auth.*), lisans,
// kullanıcı / rol, rapor / özet görüntüleme, WhatsApp gönderimi, mobil ve benzeri izler damgayı DEĞİŞTİRMEZ — yoksa ön izlemeden sonra bir kullanıcının girişi devri "kayıt girildi" diye durdururdu.
// D3 tur 5 (tur 4 DOĞRULANMADI-4; BM-T4-2 KABUL — "liste bu turda sınanır"): kaynak tarayan kalıcı test (test/devir-d3-damga-kaynak.test.mjs) programdaki HER iz türünü bu iki listeden
// biriyle sınıflandırır — yeni bir iz türü (yeni para yazıcısı) listeye girmeden eklenirse test kırılır. Eklenen: kayıt tahsilatı (payments — para tablosu; düzeltmesi satır sayısını
// değiştirmez) ve kayıt eşleştirmesinin tahsilat taşıması (payments.case_key).
export const DATA_AUDIT_TYPES = Object.freeze(["invoice.%", "account.%", "plan.%", "cheque.%", "cash.%", "bank.%", "stock.%", "doubtful.%", "tax.%", "ledger.%", "accounting.%", "company.%", "import.%", "settings.%", "staff.%", "case.payment.%", "dataset.bonds.moved"]);
// D3 tur 5: VERİ ad alanında olup veriyi DEĞİŞTİRMEYEN iz türleri — görüntüleme / dışa aktarma (fatura PDF'i, ekstre, liste Excel'i), entegratör bağlantı denemesi, ekran durumu, şirket
// SEÇİMİ / erişim / öbür şirketin açılıp silinmesi (kayıt defteri; bu dosyanın verisi değil), içe aktarmanın ön okuması. Tur 4'te "invoice.%" / "account.%" / "company.%" önekleri bunları da
// sayıyordu: ön izlemeden sonra bir fatura PDF'ini açmak ya da cari ekstresini indirmek devri "veri değişti" diye yanlış durdururdu (eski kodda kırmızı: test/devir-d3-damga.test.mjs).
export const NON_DATA_AUDIT_TYPES = Object.freeze(["%.exported", "invoice.pdf", "invoice.pdf.bulk", "invoice.ubl.bulk", "invoice.integrator.tested", "invoice.restore-notice.dismissed", "import.sheet.read", "company.selected", "company.access", "company.created", "company.deleted", "settings.client.updated", "settings.office.updated"]);
const DATA_AUDIT_SQL = `SELECT COUNT(*) AS n, COALESCE(MAX(rowid), 0) AS m FROM audit_events WHERE (${DATA_AUDIT_TYPES.map(() => "type LIKE ?").join(" OR ")}) AND NOT (${NON_DATA_AUDIT_TYPES.map(() => "type LIKE ?").join(" OR ")})`;
/** Veri damgasının satır sayısı / en büyük rowid'iyle saydığı tablolar (yeni kayıt ve silme; düzeltmeyi iz türü karşılar). */
export const DEVIR_DAMGA_TABLES = Object.freeze(["account_entries", "cash_entries", "stock_moves", "plan_entries", "plans", "plan_items", "invoices", "invoice_lines", "cheques", "cheque_events", "fin_events", "bank_lines", "vat_offsets", "invoice_offsets", "payments", "doubtful_receivables", "doubtful_provisions", "ledger_vouchers", "accounts", "stock_items", "bank_jobs", "pos_items"]);

/**
 * Veri damgası (tasarım §3.9): okuma anındaki veri — para tablolarının satır sayısı / en büyük rowid'i, verinin değişimini yazan denetim izinin sayısı / son satırı ve dönem kilidi.
 * Ön izlemeden sonra girilen, düzenlenen ya da silinen kayıt damgayı değiştirir; giriş, görüntüleme ve dışa aktarma değiştirmez.
 */
export function devirVeriSurumu(store) {
  const parts = [];
  for (const table of DEVIR_DAMGA_TABLES) {
    if (!has(store, table)) continue;
    const row = store.get(`SELECT COUNT(*) AS n, COALESCE(MAX(rowid), 0) AS m FROM ${table}`);
    parts.push(`${table}:${row.n}:${row.m}`);
  }
  if (has(store, "audit_events")) {
    const row = store.get(DATA_AUDIT_SQL, ...DATA_AUDIT_TYPES, ...NON_DATA_AUDIT_TYPES);
    parts.push(`iz:${row.n}:${row.m}`);
  }
  parts.push(`lock:${store.get("SELECT value FROM settings WHERE key = 'ledger.lockedUntil'")?.value || ""}`);
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}
const dataVersionOf = devirVeriSurumu;

/**
 * Ön izlemeden sonra veri değişti mi? (uzman görüşü (2) → BAŞ MİMAR KARARI 27.11 — SORULABİLEN tek işlev; kullanımı devri UYGULAYAN pakette: değiştiyse devir iletiler.mjs
 * onIzlemeBayatIletisi ile DURUR). onIzleme: ön izleme sonucunun planı ya da veri damgası (plan.meta.veriSurumu). Dönüş: { degisti, onceki, simdiki }.
 */
export function onIzlemedenSonraDegisti(store, onIzleme) {
  const before = typeof onIzleme === "string" ? onIzleme : onIzleme?.meta?.veriSurumu || onIzleme?.plan?.meta?.veriSurumu || "";
  const now = devirVeriSurumu(store);
  return { degisti: !before || before !== now, onceki: before, simdiki: now };
}

/** Tablo bazında sayım (ön izlemenin "Taşınacak Hareket" satırı; tasarım §3.3): B / A tablolarında ≤K ve >K, öbürlerinde toplam. Ortak katman (O) sayılmaz — 001'de de (madde 42). */
function tableCounts(store, K) {
  const out = [];
  const problems = [];
  const tables = store.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(row => row.name);
  for (const table of tables) {
    const spec = DEVIR_TABLE_CLASSES[table];
    if (!spec) {
      // Geçici göç tabloları (ör. integrity_log_v20) yeniden adlandırılmadan kalmışsa da görünür olsun.
      problems.push({ kod: "siniflandirilmamis-tablo", tablo: table });
      continue;
    }
    if (spec.sinif === "O") continue;
    const total = Number(store.get(`SELECT COUNT(*) AS n FROM ${table}`).n) || 0;
    if (spec.sinif === "D" || !spec.date) {
      out.push({ table, sinif: spec.sinif, toplam: total, kOncesi: 0, kSonrasi: total });
      continue;
    }
    const row = store.get(`SELECT COALESCE(SUM(CASE WHEN COALESCE(d, '') <= ?1 THEN 1 ELSE 0 END), 0) AS le, COALESCE(SUM(CASE WHEN COALESCE(d, '') > ?1 THEN 1 ELSE 0 END), 0) AS gt FROM (SELECT ${spec.date} AS d FROM ${table} t)`, K);
    out.push({ table, sinif: spec.sinif, toplam: total, kOncesi: Number(row.le) || 0, kSonrasi: Number(row.gt) || 0 });
  }
  return { counts: out, problems };
}

/** Şüpheli kayıtların K'deki durumu: yükleyiciler aynen, ≤K kayıt / karşılık / alacak satırlarıyla ayırıcı (lib/doubtful-gl.mjs allocateDoubtful) — K sonrası tahsilat 128'i düşürmesin. */
function doubtfulAt(store, K) {
  const rows = doubtfulRows(store);
  if (!rows.records.length) return { list: [], byParty: new Map() };
  const records = rows.records
    .filter(record => record.date <= K)
    .map(record => (record.status === "released" && (!record.closedDate || record.closedDate > K) ? { ...record, status: "open", closedDate: "", closeEventId: "" } : record));
  const provisions = rows.provisions.filter(item => item.date <= K);
  const credits = doubtfulCredits(store, new Set(records.map(record => record.party))).filter(credit => credit.date <= K);
  const { state } = allocateDoubtful({ records, provisions, credits, linked: rows.linked || null, writeOrder: rows.writeOrder || null });
  const list = [];
  const byParty = new Map();
  for (const record of records) {
    const s = state.get(record.id);
    if (!s) continue;
    const item = { id: record.id, party: record.party, date: record.date, remainingMinor: Number(s.remaining) || 0, provisionMinor: Number(s.provision) || 0 };
    list.push(item);
    if (item.remainingMinor > 0) {
      if (!byParty.has(record.party)) byParty.set(record.party, []);
      byParty.get(record.party).push({ id: record.id, date: record.date, remainingMinor: item.remainingMinor });
    }
  }
  return { list, byParty };
}

/** Evrakın K'deki durumu: K ve öncesindeki son olayın varış durumu + bankaya tahsile verilmişlik (cheque_collections). */
function chequesAt(store, K) {
  if (!has(store, "cheques") || !has(store, "cheque_events")) return [];
  const collections = has(store, "cheque_collections");
  const rows = store.all(
    `SELECT c.id, c.direction, c.instrument, c.amount, c.account_id AS party, c.serial_no AS serial, c.due_date AS due,
            (SELECT e.to_status FROM cheque_events e WHERE e.cheque_id = c.id AND e.date <= ?1 ORDER BY e.date DESC, e.rowid DESC LIMIT 1) AS stateK,
            ${collections ? "(SELECT COUNT(*) FROM cheque_collections k WHERE k.cheque_id = c.id AND k.given_date <= ?1 AND (k.closed_date = '' OR k.closed_date > ?1))" : "0"} AS inBank
     FROM cheques c WHERE c.deleted_at IS NULL ORDER BY c.id`,
    K,
  );
  const out = [];
  for (const row of rows) {
    if (!row.stateK) continue; // K'den sonra alınmış / verilmiş evrak
    let state = row.stateK;
    if (state === "portfolio" && Number(row.inBank) > 0) state = "bank";
    const open = ["portfolio", "bank", "endorsed", "bounced", "pending"].includes(state);
    if (!open) continue;
    out.push({ id: row.id, direction: row.direction, instrument: row.instrument, amountMinor: minor(row.amount), party: row.party || "", serial: row.serial || "", due: row.due || "", stateK: state });
  }
  return out;
}

/**
 * D3 tur 4 — uzman görüşü (4) → BAŞ MİMAR KARARI 27.11: stokta ÜRÜN ÜRÜN değişmez. Ürün başına K miktarı DEĞERLEMEDEN BAĞIMSIZ (tek toplu SQL — stok hareketlerinin işaretli toplamı; ders 47):
 * planın açılış miktarı (değerlemeden) bununla ürün ürün karşılaştırılır (plan.mjs değişmez "stok-urun"). Dönüş: Map(ürün → binde bir miktar, tamsayı).
 */
function stockQtyAt(store, K) {
  if (!has(store, "stock_moves")) return new Map();
  return new Map(store.all("SELECT item_id AS id, SUM(CASE WHEN kind = 'out' THEN -qty ELSE qty END) AS q FROM stock_moves WHERE date <= ? GROUP BY item_id", K).map(row => [row.id, Math.round((Number(row.q) || 0) * 1000)]));
}

/**
 * Taksit kartları (K'de var olan): ≤K net tahsilat (kart başına; tek toplu sorgu), K'de kapalı mı, kapanış kuralı.
 * D3 tur 6 (dar kontrol D3 tur 1–5 ORTA-1; BAŞ MİMAR KARARI 27.11 23:01): kapanış günü programın TANIMIYLA (lib/accounts.mjs closeDaySql — cari ekstresi, genel defter 689, kilit,
 * mutabakat aynı ifade): closed_at; 2.0.13 öncesi kapatılmışta closed_at boş → son güncelleme günü; Kayıt Tarihi'nden önce değil. Önceden yalnız closed_at okunuyordu: eski sürümde
 * kapatılmış kart K'de AÇIK sayılıyor, yeni yılda kalanıyla açılacaktı (devirli ≠ devirsiz); carisizse kalanı 127'ye karşılık yazılıp sebepsiz modül farkı durdurması doğuyordu.
 */
function cardsAt(store, K) {
  if (!has(store, "plans")) return [];
  const cols = columns(store, "plans");
  const closeRule = cols.has("close_rule") ? "p.close_rule" : `'${CLOSE_RULE_WAIVE}'`;
  const opened = cols.has("registered_on") ? "COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10))" : "substr(p.created_at, 1, 10)";
  // Sütunu eksik depo (2.0.13 öncesi şema; göçten geçmiş dosyada olmaz): aynı tanımın yedek kolu.
  const closedAt = cols.has("closed_at") && cols.has("registered_on") ? closeDaySql("p") : `MAX(${cols.has("closed_at") ? "COALESCE(p.closed_at, substr(p.updated_at, 1, 10))" : "substr(p.updated_at, 1, 10)"}, ${opened})`;
  const paid = has(store, "plan_entries") ? "COALESCE((SELECT SUM(CAST(ROUND((CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) * 100) AS INTEGER)) FROM plan_entries e WHERE e.plan_id = p.id AND e.date <= ?1), 0)" : "0";
  return store
    .all(
      `SELECT p.id, COALESCE(p.account_id, '') AS party, p.total, p.status, ${closeRule} AS closeRule, ${closedAt} AS closedAt, ${opened} AS opened,
              ${cols.has("covers_balance") ? "p.covers_balance" : "0"} AS coversBalance, ${cols.has("invoice_id") ? "p.invoice_id" : "''"} AS invoiceId, ${paid} AS paidMinor
       FROM plans p WHERE p.deleted_at IS NULL ORDER BY p.id`,
      K,
    )
    .filter(row => row.opened <= K)
    .map(row => ({
      id: row.id,
      party: row.party,
      totalMinor: minor(row.total),
      paidMinor: Number(row.paidMinor) || 0,
      closedAtK: row.status === "closed" && Boolean(row.closedAt) && String(row.closedAt).slice(0, 10) <= K,
      closeRule: row.closeRule === CLOSE_RULE_WAIVE ? "waive" : "keep",
      coversBalance: Number(row.coversBalance) === 1,
      invoiceId: row.invoiceId || "",
    }));
}

/** K sonrası satırların ≤K faturaya bağları (tasarım §3.5 madde 7): açık fatura → devir kalemi, kapanmış → arşiv başvurusu (plan.mjs ayırır). */
function linksAfter(store, K) {
  const out = [];
  const add = (table, rowId, field, date, invoiceId) => out.push({ table, rowId, field, date, invoiceId });
  const before = "SELECT id FROM invoices WHERE issue_date <= ?1";
  if (!has(store, "invoices")) return out;
  if (has(store, "account_entries")) {
    const cols = columns(store, "account_entries");
    if (cols.has("invoice_id")) for (const row of store.all(`SELECT id, date, invoice_id AS inv FROM account_entries WHERE date > ?1 AND invoice_id <> '' AND invoice_id IN (${before})`, K)) add("account_entries", row.id, "invoice_id", row.date, row.inv);
    if (cols.has("refund_of")) for (const row of store.all(`SELECT id, date, refund_of AS inv FROM account_entries WHERE date > ?1 AND refund_of <> '' AND refund_of IN (${before})`, K)) add("account_entries", row.id, "refund_of", row.date, row.inv);
  }
  if (has(store, "invoice_offsets")) {
    for (const row of store.all(`SELECT id, date, invoice_id AS inv FROM invoice_offsets WHERE date > ?1 AND invoice_id IN (${before})`, K)) add("invoice_offsets", row.id, "invoice_id", row.date, row.inv);
    // D3 tur 2 (gerçek bağ, tek borç sırası 0. adım — Mahsup Et iki belgeyi birlikte kapatır): mahsubun KARŞI faturası da ≤K olabilir (belge >K, karşı belge ≤K; ya da iki belge ≤K).
    for (const row of store.all(`SELECT id, date, counter_id AS inv FROM invoice_offsets WHERE date > ?1 AND counter_type = 'invoice' AND counter_id IN (${before})`, K)) add("invoice_offsets", row.id, "counter_id", row.date, row.inv);
    // D3 tur 4 (S-T2-1 = B): mahsubun karşı belgesi ≤K Alacak Yaz / Borç Yaz SATIRI da olabilir (counter_type 'entry') — bağ o satırın devir kalemine yönelir.
    if (has(store, "account_entries")) for (const row of store.all("SELECT id, date, counter_id AS entry FROM invoice_offsets WHERE date > ?1 AND counter_type = 'entry' AND counter_id IN (SELECT id FROM account_entries WHERE date <= ?1)", K)) out.push({ table: "invoice_offsets", rowId: row.id, field: "counter_id", date: row.date, invoiceId: "", entryId: row.entry });
  }
  // D3 tur 2 (tasarım §3.5 madde 7 "iade bağı", G14 (1); tek borç sırası karar (2) "iade → asıl fatura"): K'den SONRA kesilmiş iade faturasının ≤K asıl faturası.
  if (columns(store, "invoices").has("original_id")) for (const row of store.all(`SELECT id, issue_date AS date, original_id AS inv FROM invoices WHERE issue_date > ?1 AND original_id <> '' AND original_id IN (${before})`, K)) add("invoices", row.id, "original_id", row.date, row.inv);
  if (has(store, "cheque_events") && columns(store, "cheque_events").has("invoice_id")) for (const row of store.all(`SELECT id, date, invoice_id AS inv FROM cheque_events WHERE date > ?1 AND invoice_id <> '' AND invoice_id IN (${before})`, K)) add("cheque_events", row.id, "invoice_id", row.date, row.inv);
  if (has(store, "fin_events")) for (const row of store.all(`SELECT id, date, invoice_id AS inv FROM fin_events WHERE date > ?1 AND invoice_id <> '' AND invoice_id IN (${before})`, K)) add("fin_events", row.id, "invoice_id", row.date, row.inv);
  if (has(store, "plans") && columns(store, "plans").has("invoice_id")) for (const row of store.all(`SELECT id, COALESCE(NULLIF(registered_on, ''), substr(created_at, 1, 10)) AS date, invoice_id AS inv FROM plans WHERE deleted_at IS NULL AND invoice_id <> '' AND invoice_id IN (${before})`, K)) add("plans", row.id, "invoice_id", row.date, row.inv);
  return out;
}

// ---------- D3 tur 4 — S-T2-1 = B: K'den SONRA yapılan Mahsup Et'in ≤K belgesi K kuyruğunda o mahsuba AYRILIR ----------
// KULLANICI 27.11.2026 14:18 UTC (AYNEN: "önerilerini uygula açık sorulara") — S-T2-1 = B: "devirde, yeni yılda (K'den sonra) yapılan 'Mahsup Et'in karşı belgesi eski yıldaki (K ve öncesi)
// bir alış faturasıysa devir planı o eski belgeyi K kuyruğunda o mahsuba AYIRIR — DEVİRLİ = DEVİRSİZ"; satış yönü, kısmi mahsup ve mahsubun sonradan silinmesi aynı kural.
// Bugünkü program Mahsup Et'i tarihten bağımsız, tek borç sırasının 0. adımında (her şeyden önce) uygular (lib/obligation-queue.mjs "0: Mahsup Et"). Devirsiz eşi bu yüzden:
//   (1) ayrılan tutar = devirsiz tek borç sırasının (carinin BÜTÜN satırları — programın bugünkü kuyruğu, aynı işlev) o mahsuba verdiği pay (ana faturanın kapatanlarından; kilitli dönem
//       sınırı ve sıra kuyruğun kendisinden — elle formül YOK);
//   (2) K kuyruğunda ≤K belge 0. adımdaki gibi bu pay kadar ÖNCEDEN azaltılır (başka kalemi netleyemez);
//   (3) mahsubun öbür belgesi K'den sonraysa pay yeni yıla o ≤K belgenin AÇIK KALEMİ olarak devreder ("yeni-yila-ayrildi"; yeni yılda mahsup o devir kalemine yönelir — D4a şartı);
//       iki belge de ≤K ise mahsup K'de uygulanmış sayılır ("k-de-kapandi"; yeni yılda yeniden uygulanmaz — D4a şartı).
// Ağır okuma yok (ders 47): devirsiz kuyruk YALNIZ böyle mahsubu olan carilerde kurulur. Silinmiş mahsup tabloda yoktur → hiçbir şey ayrılmaz.
const docKeyOf = line => (line.origin === "invoice" && line.kind !== "in" && line.kind !== "out" ? `inv:${line.sourceId}` : line.origin === "account" && (line.kind === "debt" || line.kind === "credit") ? `line:${line.id}` : "");
const counterKeyOf = offset => (offset.counterType === "invoice" ? `inv:${offset.counterId}` : `line:${offset.counterId}`);
const lineMinor = line => Math.round(((Number(line.debit) || 0) || (Number(line.credit) || 0)) * 100);

/** Bir carinin K sonrası mahsuplarının ≤K belgelere ayırımı. Dönüş: { lines (K kuyruğunun girdisi — ≤K satırlar, ayrılan pay düşülmüş), reserved: Map(kalem anahtarı → kuruş), docs, rows }. */
export function offsetReservations({ party, lines, own, tables, extras, input, K, today, queue = buildObligations }) {
  const docs = new Map();
  for (const line of own) {
    const key = docKeyOf(line);
    if (key) docs.set(key, line);
  }
  const later = (tables.offsetsOf?.get(party) || []).filter(offset => offset.date > K && (docs.has(`inv:${offset.invoiceId}`) || docs.has(counterKeyOf(offset))));
  if (!later.length) return { lines: own, reserved: new Map(), docs, rows: [] };
  const full = queue(input.withExtras(input.batchSettleInput(party, lines, tables, today), extras, party));
  const cut = new Map();
  const reserved = new Map();
  const rows = [];
  for (const offset of later) {
    const take = (full.invoices.get(offset.invoiceId)?.closers || []).filter(closer => closer.mode === "offset" && closer.id === `offset:${offset.id}`).reduce((sum, closer) => sum + Math.round(Number(closer.amount) * 100), 0);
    if (!(take > 0)) continue;
    const sides = [`inv:${offset.invoiceId}`, counterKeyOf(offset)];
    const old = sides.filter(key => docs.has(key));
    for (const key of old) cut.set(key, (cut.get(key) || 0) + take);
    const kind = old.length === 2 ? "k-de-kapandi" : "yeni-yila-ayrildi";
    if (kind === "yeni-yila-ayrildi") reserved.set(old[0], (reserved.get(old[0]) || 0) + take);
    rows.push({ mahsup: offset.id, tarih: offset.date, belgeler: old, karsi: sides.find(key => !docs.has(key)) || "", tutarMinor: take, tur: kind });
  }
  if (!cut.size) return { lines: own, reserved, docs, rows };
  const shrunk = own.map(line => {
    const less = cut.get(docKeyOf(line));
    if (!less) return line;
    const left = Math.max(0, lineMinor(line) - less) / 100;
    return Number(line.debit) > 0 ? { ...line, debit: left } : { ...line, credit: left };
  });
  return { lines: shrunk, reserved, docs, rows };
}

/** Ayrılan payı K kuyruğunun kalemlerine geri ekler (belgenin açık kalemi; yoksa belgenin kendi verisinden kurulur — vade: faturanın vadesi / satırın Vade Tarihi, yoksa belge günü). */
export function withReserved(items, { reserved, docs, lines }, queued) {
  if (!reserved.size) return items;
  const out = items.map(item => (reserved.has(item.key) ? { ...item, remaining: Math.round(item.remaining * 100 + reserved.get(item.key)) / 100 } : item));
  const present = new Set(items.map(item => item.key));
  const order = [...lines].sort((a, b) => (a.date === b.date ? String(a.at || "").localeCompare(String(b.at || "")) : a.date < b.date ? -1 : 1)).map(line => line.id);
  for (const [key, minorValue] of reserved) {
    if (present.has(key)) continue;
    const line = docs.get(key);
    const invoice = key.startsWith("inv:") ? (queued.invoices || []).find(row => row.id === line.sourceId) : null;
    out.push({
      key,
      kind: invoice ? "invoice" : "entry",
      side: Number(line.debit) > 0 ? "receivable" : "payable",
      lineId: line.id,
      invoiceId: invoice ? line.sourceId : "",
      planId: "",
      itemId: "",
      seq: 0,
      origin: line.origin,
      lineKind: line.kind,
      date: line.date,
      vade: (invoice ? invoice.dueDate : queued.dueDates?.get(line.id)) || line.date,
      at: line.at || "",
      rank: Math.max(0, order.indexOf(line.id)),
      sub: 0,
      amount: lineMinor(line) / 100,
      remaining: minorValue / 100,
      promise: queued.promises?.get(line.id) || "",
      due: true,
      doubtful: 0,
    });
  }
  return out;
}

/** Ön denetimin olguları (preflight.mjs; plan §5 + G4 + S-2 / S-3) — yalnız sayım ve küçük örnek listeleri. */
function preflightFacts({ store, ledger, live, K, today, accountList, names = new Map(), archives = [] }) {
  const facts = {};
  // D3 tur 4 — AYNI YIL İKİNCİ KEZ DEVREDİLEMEZ (BAŞ MİMAR KARARI 27.11): çalışma dosyasının devir yılları (devir.years — D4 yazar) ve şirketin arşiv kaydı (sirketler.json archives —
  // routes/devir.mjs işe koyar; yalnız BU şirketin kayıtları, dosyanın diskte olup olmadığıyla). Okunamayan ayar devir yok sayılır; kayıt yine denetler.
  facts.devirYillari = {
    dosya: devirYearsOfSetting(store.get("SELECT value FROM settings WHERE key = ?", DEVIR_YEARS_KEY)?.value || "").map(row => ({ yil: row.year, kesim: row.cutoff, tarih: row.at })),
    kayit: (archives || []).filter(row => /^\d{4}$/.test(String(row?.yil || ""))).map(row => ({ yil: String(row.yil), kesim: String(row.kesim || ""), tarih: String(row.tarih || ""), dosyaVar: row.dosyaVar !== false })),
  };
  const sample = (sql, ...args) => store.all(`${sql} LIMIT 20`, ...args);
  if (has(store, "invoices")) {
    const cols = columns(store, "invoices");
    const one = (where, ...args) => ({ adet: Number(store.get(`SELECT COUNT(*) AS n FROM invoices WHERE ${where}`, ...args).n) || 0, ornek: sample(`SELECT id, number, kind, issue_date AS date, COALESCE((SELECT a.name FROM accounts a WHERE a.id = invoices.account_id), '') AS cari, CAST(ROUND(try_payable * 100) AS INTEGER) AS tutarMinor FROM invoices WHERE ${where} ORDER BY issue_date, rowid`, ...args) });
    if (cols.has("e_status")) {
      // D3 tur 2 (gerçek veri tabanından; tur 1 yalnız e_status 'waiting' / 'processing' sayıyordu): Gönderilecekler'in tanımı programınkiyle AYNI (routes/invoices.mjs unsentSql:
      // 'waiting' YA DA numara almış, gönderilebilir türde, kâğıt olmayan ve gönderilmemiş / hata almış belge); "Sonucu Belirsiz" programınki gibi (uncertainSend: e_status 'none' iken
      // entegratör izi var — istek gitti, yanıt gelmedi) + İşleniyor ('processing'). Belirsiz olan bekleyen sayılmaz (iki kez durdurmaz). Canlı ortamda test serili gönderilmemiş
      // belgenin Gönderilecekler'den düşülmesi (unsentSql'in canlı kolu) burada YOK — raporda DENENMEYEN.
      const sendKinds = Object.entries(INVOICE_KINDS).filter(([, value]) => value.send).map(([key]) => `'${key}'`).join(", ");
      const adapter = cols.has("e_adapter") ? "COALESCE(e_adapter, '') <> ''" : "0";
      const uncertain = `(COALESCE(e_status, '') IN ('', 'none') AND ${adapter})`;
      const unsent = `(e_status = 'waiting' OR (COALESCE(e_status, '') IN ('', 'none', 'error') AND COALESCE(profile, '') <> 'KAGIT' AND COALESCE(number, '') <> '' AND kind IN (${sendKinds})))`;
      facts.eBelgeBekleyen = one(`status = 'issued' AND ${unsent} AND NOT ${uncertain} AND issue_date <= ?`, K);
      facts.eBelgeListedenSilinen = one("status = 'issued' AND e_status = 'withdrawn' AND issue_date <= ?", K);
      facts.eBelgeBelirsiz = one(`status = 'issued' AND (e_status = 'processing' OR ${uncertain}) AND issue_date <= ?`, K);
    }
    facts.taslakFatura = one("status = 'draft' AND issue_date <= ?", K);
  }
  // D3 tur 4 (karşılaştırma §9 "ne oldu"): adet + en eski işin tarihi (kullanıcı hangi işi arayacağını bilsin).
  const jobs = has(store, "bank_jobs") ? store.get("SELECT COUNT(*) AS n, COALESCE(MIN(due_date), '') AS first FROM bank_jobs WHERE status = 'pending'") : null;
  facts.bankaIsi = jobs ? { adet: Number(jobs.n) || 0, enEski: jobs.first || "" } : { adet: 0 };
  const draftMonth = store.get("SELECT value FROM settings WHERE key = 'bank.pos.draftMonth'")?.value || "";
  facts.posGunSonu = { ay: draftMonth };
  facts.posBekleyen = has(store, "pos_items") ? { adet: Number(store.get("SELECT COUNT(*) AS n FROM pos_items WHERE status = 'pending' AND value_date > ?", K).n) || 0 } : { adet: 0 };
  // Defter Mutabakatı (Ana Defter ↔ alt defterler; routes/ledger.mjs check() ile aynı tanım — canlı türetme + beklenenler).
  const rec = reconcile(trialBalance(live), ledger.expected(accountList));
  facts.defterMutabakati = { ok: rec.ok, dengeli: rec.balanced, farklar: rec.checks.filter(check => !check.ok).map(check => ({ hesap: check.code, defter: check.ledger, altDefter: check.subledger, fark: check.difference })) };
  // KG-16 "Açılış Olabilir" onay bekleyen kayıtlar (≤K; S-2).
  if (has(store, "account_entries") && columns(store, "account_entries").has("opening_review")) {
    const where = "e.opening_review = 'candidate' AND e.date <= ? AND a.deleted_at IS NULL";
    facts.acilisOlabilir = { adet: Number(store.get(`SELECT COUNT(*) AS n FROM account_entries e JOIN accounts a ON a.id = e.account_id WHERE ${where}`, K).n) || 0 };
  } else facts.acilisOlabilir = { adet: 0 };
  // Kural Değişikliği Farkı (KG-15; S-3): Yönetim → Kural Farkı Düzeltme ekranının planıyla AYNI tanım (fişle düzeltilebilen satırlar + alt defter hesabı farkları).
  const snapshots = ledger.snapshots;
  const cover = snapshots?.coverage?.() || "";
  const pending = snapshots?.state?.().pending || null;
  if (cover && !pending) {
    const diff = snapshots.ruleDiff({ live, detail: true });
    const lock = store.get("SELECT value FROM settings WHERE key = 'ledger.lockedUntil'")?.value || "";
    const posted = postedRuleDiffCorrections(store);
    const subledger = new Set(Object.keys(ledger.expected([], [], { every: true })));
    const plan = ruleDiffCorrectionPlan({ diff, subledger, year: ruleDiffCorrectionYear({ lock, cover, today }), postedByYear: posted.byYear });
    // D3 tur 3 — S-KD-1 (kullanıcı 27.11 = A): alt defter farkı TOPLAMDAN değil cari / alt hesap başına (ruleDiffCorrectionPlan excluded: hesap|alt hesap|cari, sıfır olmayan); satırları
    // iletiye (cari adı, hesap, yönlü tutar). S-KD-2 (= A): fiş tarihi (kilit + 1) K'den sonraysa ve düzeltilecek fark K ve öncesindeki maddelerdeyse fiş eski yılda yazılmalı — eski
    // yılın fişi (kilit K'den önceki güne alınınca: K'den önceki maddeler, yıl = K yılı, yeni yıldaki fişler ters kaydedilecek sayılır) ve dönem sonucuna etkisi; yeni yılda yazılmış fişler.
    const fisTarihi = dayAfter(lock || cover);
    const kOncesiFark = plan.sources.some(source => !source.excluded && source.date <= K);
    const newYearVouchers = kOncesiFark ? posted.active.filter(voucher => voucher.date > K) : [];
    let eskiYil = null;
    if (kOncesiFark && (fisTarihi > K || newYearVouchers.length)) {
      const year = Number(K.slice(0, 4));
      const kept = new Map([...posted.byYear].filter(([postYear]) => Number(postYear) <= year));
      const before = ruleDiffCorrectionPlan({ diff: { ...diff, entries: (diff.entries || []).filter(entry => entry.date < K) }, subledger, year, postedByYear: kept });
      eskiYil = {
        fisTarihi: K,
        tutarMinor: before.lines.reduce((sum, line) => sum + line.debit, 0),
        // Dönem sonucuna etkisi: fişin 6 / 7 sınıfı satırları (gider borcu kârı azaltır) — artı: kâr artar.
        karEtkisiMinor: -before.lines.filter(line => line.account[0] === "6" || line.account[0] === "7").reduce((sum, line) => sum + line.debit - line.credit, 0),
        satirlar: before.lines.map(line => ({ hesap: line.account, alt: line.sub || "", borc: line.debit, alacak: line.credit })),
      };
    }
    const voucherTotal = id => Number(store.get("SELECT COALESCE(SUM(debit_minor), 0) AS n FROM ledger_voucher_lines WHERE voucher_id = ?", id)?.n) || 0;
    facts.kuralFarki = {
      satir: plan.lines.length,
      altDefter: plan.excluded.length,
      tutarMinor: plan.lines.reduce((sum, line) => sum + line.debit, 0),
      dondurmaSuruyor: false,
      kilit: lock,
      kapsam: cover,
      fisTarihi,
      kaynakSayisi: plan.sources.length,
      kOncesiFark,
      fisSatirlari: plan.lines.map(line => ({ hesap: line.account, alt: line.sub || "", borc: line.debit, alacak: line.credit })),
      altDefterSatirlari: plan.excluded.map(row => ({ hesap: row.account, alt: row.sub || "", cari: row.party || "", cariAd: row.party ? names.get(row.party) || "" : "", minor: row.minor })),
      eskiYil,
      yeniYilFisleri: newYearVouchers.map(voucher => ({ kimlik: voucher.id, no: voucherNoText(voucher.year, voucher.no), tarih: voucher.date, tutarMinor: voucherTotal(voucher.id) })),
    };
  } else facts.kuralFarki = { satir: 0, altDefter: 0, tutarMinor: 0, dondurmaSuruyor: Boolean(pending) };
  // Aralık KDV mahsubu (G4 UYARIR; tasarım §3.8 / B-11).
  const month = `${K.slice(0, 4)}-12`;
  facts.aralikMahsubu = { ay: month, yapildi: has(store, "vat_offsets") ? Boolean(store.get("SELECT 1 AS found FROM vat_offsets WHERE month = ? AND status = 'active'", month)) : false };
  // ≤K içe aktarmalar (Geri Al'ı kapanacak) ve aktif tekrarlayan faturanın ≤K şablonu (G4 UYARIR).
  facts.iceAktarma = has(store, "plan_imports") ? { adet: Number(store.get("SELECT COUNT(*) AS n FROM plan_imports WHERE substr(created_at, 1, 10) <= ? AND COALESCE(undone_at, '') = ''", K).n) || 0 } : { adet: 0 };
  facts.gelenKutusu = has(store, "einvoice_inbox") && columns(store, "einvoice_inbox").has("state") ? { adet: Number(store.get("SELECT COUNT(*) AS n FROM einvoice_inbox WHERE state = 'new' AND issue_date <> '' AND issue_date <= ?", K).n) || 0 } : { adet: 0 };
  // ≤K e-Arşiv belgesi iptal süresi içinde (iletimden 8 gün; arşivde iptal YAPILAMAZ — plan §5 UYARIR).
  if (has(store, "invoices") && columns(store, "invoices").has("e_at")) {
    const since = new Date(`${today}T00:00:00Z`);
    since.setUTCDate(since.getUTCDate() - 8);
    facts.iptalSuresi = { adet: Number(store.get("SELECT COUNT(*) AS n FROM invoices WHERE status = 'issued' AND issue_date <= ? AND e_status IN ('sent', 'accepted') AND profile IN ('EARSIVFATURA', 'ESMM') AND e_at >= ?", K, since.toISOString().slice(0, 10)).n) || 0 };
  } else facts.iptalSuresi = { adet: 0 };
  // D3 tur 3 — S-C5C-9 = A (kullanıcı 27.11 12:01; ilke taslağı §8.1) + BAŞ MİMAR EKİ: devir başlarken durdurulacak toplu WhatsApp işleri (D4 yapar; burada YALNIZ sayım — kuyruk
  // tabloları okunur, değiştirilmez). İş: Sürüyor / Duraklatıldı toplu iş; kişi: lib/whatsapp/queue.mjs stopBatch'in durdurduğu durumlardaki iş (Bekliyor, Hazırlanıyor, Sınır Nedeniyle
  // Bekliyor, Duraklatıldı, Meta Bekletti). Şirket dosyası ayrı → öbür şirketin işi bu dosyada yok.
  if (has(store, "wa_batches") && has(store, "wa_jobs")) {
    const row = store.get(
      `SELECT COUNT(*) AS isler, COALESCE(SUM(CASE WHEN b.state = 'running' THEN 1 ELSE 0 END), 0) AS suren, COALESCE(SUM(CASE WHEN b.state = 'paused' THEN 1 ELSE 0 END), 0) AS duraklatilmis,
              COALESCE(SUM((SELECT COUNT(*) FROM wa_jobs j WHERE j.batch_id = b.id AND j.state IN ('pending', 'limited', 'preparing', 'paused', 'held'))), 0) AS kisi,
              COALESCE(SUM((SELECT COUNT(*) FROM wa_jobs j WHERE j.batch_id = b.id AND j.state = 'limited')), 0) AS sinirda
       FROM wa_batches b WHERE b.state IN ('running', 'paused')`,
    );
    facts.whatsapp = { isSayisi: Number(row.isler) || 0, suren: Number(row.suren) || 0, duraklatilmis: Number(row.duraklatilmis) || 0, kisiSayisi: Number(row.kisi) || 0, sinirda: Number(row.sinirda) || 0 };
  } else facts.whatsapp = { isSayisi: 0, suren: 0, duraklatilmis: 0, kisiSayisi: 0, sinirda: 0 };
  return facts;
}

/**
 * Devir planının olguları. ledger: routes/ledger.mjs servis nesnesi (iş parçacığında salt okunur bağlantıyla kurulmuş); accountList: cari listesi (beklenenler için; verilmezse ledger kendisi
 * okur). Çağıran tek okuma işlemi (BEGIN … COMMIT) içinde çağırır. Dönüş: buildDevirPlan girdisi + preflight + zamanlama (bileşen bileşen, ms).
 */
export function readDevirFacts({ store, ledger, K, today, company = null, accountList = null, archives = [] }) {
  const timings = {};
  let start = performance.now();
  const nextDay = dayAfter(K);
  const dataVersion = dataVersionOf(store);
  const parties = has(store, "accounts") ? store.all("SELECT id, name, type, deleted_at AS deletedAt FROM accounts ORDER BY id").map(row => ({ id: row.id, name: row.name || "", type: row.type || "customer", deleted: Boolean(row.deletedAt) })) : [];
  const invoiceDocs = new Map(has(store, "invoices") ? store.all("SELECT id, number, kind, issue_date AS date FROM invoices WHERE issue_date <= ? AND status = 'issued'", K).map(row => [row.id, { number: row.number || "", kind: row.kind, date: row.date }]) : []);
  const vatPeriods = has(store, "invoices") && columns(store, "invoices").has("vat_period")
    ? new Map(store.all("SELECT id, vat_period AS period FROM invoices WHERE kind = 'purchase' AND status = 'issued' AND vat_period <> '' AND vat_period <> substr(issue_date, 1, 7) AND issue_date <= ?", K).map(row => [`invoice:${row.id}`, row.period]))
    : new Map();
  const vatOffsetMonths = new Map();
  if (has(store, "vat_offsets")) for (const row of store.all("SELECT id, month FROM vat_offsets WHERE date <= ?", K)) {
    vatOffsetMonths.set(`vat-offset:${row.id}`, row.month);
    vatOffsetMonths.set(`vat-offset-reverse:${row.id}`, row.month);
  }
  const bankAccounts = has(store, "bank_accounts") ? store.all("SELECT id, name, kind, gl, gl_sub AS sub FROM bank_accounts ORDER BY id").map(row => ({ id: row.id, name: row.name || "", kind: row.kind || "", gl: row.gl || "", sub: row.sub || "" })) : [];
  // D3 tur 2: POS'un alt hesabı (108.NN) banka hesabında değil POS tanımında (pos_terminals.gl_sub) — yoksa tanımlı POS'un bekleyen alacağı "hesabı atanmamış" sayılıyordu.
  const posTerminals = has(store, "pos_terminals") ? store.all("SELECT id, name, gl_sub AS sub FROM pos_terminals ORDER BY id").map(row => ({ id: row.id, name: row.name || "", sub: row.sub || "" })) : [];
  const cards = cardsAt(store, K);
  const cheques = chequesAt(store, K);
  const repeats = has(store, "invoice_repeats")
    ? store.all("SELECT r.id, r.template_id AS templateId, r.next_date AS nextDate, COALESCE(i.number, '') AS templateNumber FROM invoice_repeats r LEFT JOIN invoices i ON i.id = r.template_id WHERE r.active = 1 AND i.issue_date <= ?", K)
    : [];
  const links = linksAfter(store, K);
  const { counts, problems } = tableCounts(store, K);
  timings.okuma = ms(start);
  // ---- yevmiye: canlı türetme BİR kez; karma yevmiye (kilitli dönem donmuş) ≤K ----
  start = performance.now();
  const live = ledger.build();
  const entries = ledger.book({ to: K, live }).filter(entry => entry.date <= K);
  const closedOn = closingDayOf(store, K);
  timings.yevmiye = ms(start);
  // ---- şüpheli + tek borç sırası (K'de; yalnız ≤K satırlar) ----
  start = performance.now();
  const doubtful = doubtfulAt(store, K);
  const input = createObligationInput({ store });
  const ledgers = input.ledgerLines();
  const tables = input.settleTables();
  const extras = input.obligationExtras(null, doubtful.byParty);
  const obligations = new Map();
  const installments = new Map();
  const offsetRows = [];
  for (const [id, lines] of ledgers) {
    const own = lines.filter(line => line.date <= K);
    if (!own.length) continue;
    // S-T2-1 = B (yukarıda offsetReservations): K sonrası mahsubun ≤K belgeden aldığı pay K kuyruğuna girmeden ayrılır.
    const reservation = offsetReservations({ party: id, lines, own, tables, extras, input, K, today });
    for (const row of reservation.rows) offsetRows.push({ cari: id, ...row });
    const queued = input.withExtras(input.batchSettleInput(id, reservation.lines, tables, nextDay), extras, id);
    const invoiceIds = new Set(own.filter(line => line.origin === "invoice").map(line => line.sourceId));
    queued.invoices = queued.invoices.filter(invoice => invoiceIds.has(invoice.id));
    queued.offsets = queued.offsets.filter(offset => offset.date <= K);
    const result = buildObligations(queued);
    obligations.set(id, withReserved(result.items, reservation, queued));
    for (const [planId, map] of result.installments) {
      const list = [];
      for (const [itemId, row] of map) if (itemId !== "rest" && itemId !== "back") list.push({ itemId, seq: row.seq || 0, vade: row.vade || "", remainingMinor: minor(row.remaining) });
      installments.set(planId, list.sort((a, b) => a.seq - b.seq || (a.itemId < b.itemId ? -1 : 1)));
    }
  }
  for (const card of cards) card.installments = installments.get(card.id) || [];
  timings.tekBorcSirasi = ms(start);
  // ---- değerleme ----
  start = performance.now();
  const valuation = createStockValuation(loadValuationInput(store));
  valuation.at(K, { detail: true });
  const stockQtyK = stockQtyAt(store, K);
  timings.degerleme = ms(start);
  // ---- ön denetimin olguları (Defter Mutabakatı canlı türetmeyle) ----
  start = performance.now();
  const preflight = preflightFacts({ store, ledger, live, K, today, accountList, names: new Map(parties.map(row => [row.id, row.name])), archives });
  timings.onDenetim = ms(start);
  return {
    K,
    today,
    company,
    bookType: bookTypeOf(store),
    dataVersion,
    ruleVersion: LEDGER_RULE_VERSION,
    entries,
    valuation,
    stockQtyK,
    closedOn,
    parties,
    obligations,
    invoiceDocs,
    cards,
    cheques,
    bankAccounts,
    posTerminals,
    doubtful: doubtful.list,
    vatPeriods,
    vatOffsetMonths,
    repeats,
    links,
    offsetReservations: offsetRows,
    counts,
    readProblems: problems,
    preflight,
    timings,
  };
}
