// 2.5.0 Ç5-A tur 1f — İş 3 (b): KALICI KAYNAK TARAMA — Ana Defter türetmesinin (routes/ledger.mjs build → rows / journal; şüpheli alacak, saklanan fiş, S127 bağı) kaynak
// sorgularının okuduğu HER tablo.sütun ya kilit izinde (lib/integrity.mjs LOCK_SQL — kilitli satırda değişince izi DEĞİŞTİRİR) ya da aşağıdaki gerekçeli AÇIK İSTİSNA listesinde
// olmak zorunda (docs/erp/C5-ACILIS-TASARIM.md §16). Türetmeye yeni bir sütun eklenip ikisine de yazılmazsa ya da izden bir sütun çıkarılırsa bu test KIRILIR.
// Yöntem (kaynak metni ayrıştırılmaz — CRLF / biçim bağımsız, ders 27): (1) türetme gerçek veriyle bir kez koşulur, hazırlanan SQL'ler yakalanır; her birinin okuduğu tablo.sütun
// SQLite'ın EXPLAIN bayt kodundan (OpenRead → tablo / dizin; Column / Rowid) çıkarılır; (2) her sütun için kilitli dönemdeki satırların değeri TEK TEK, geri alınan bir işlemde
// bozulur ve kilit izinin (lockDigestOf) değişip değişmediğine bakılır — en az bir satırda değişmesi "izde" demektir (yalnız WHERE'de kalan, değeri izlenmeyen sütun da yakalanır).
// Değiştirilmesi tetikleyiciyle engellenen tablolar (donmuş defter, saklanan fiş) korunmuş sayılır. Veri güncel kodla API'den (sahte saat; lisans servisi yok — ders 13, 30);
// türetmenin her dalı satır görsün diye iki kurulum satırı (Kayıt Tarihi boş kart, aynı evrakta ikinci karşılıksız olayı) ayrı bağlantıyla yazılır — bu ikisi API'nin üretemediği,
// yalnız eski sürüm / dış araçla oluşan durumlardır (§16.2).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { createStore } from "../server/lib/db.mjs";
import { lockDigestOf } from "../server/lib/integrity.mjs";
import { registerLedgerRoutes } from "../server/routes/ledger.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const LOCK = "2026-10-10";

// AÇIK İSTİSNALAR — her satır bölüm / karar numarasıyla. Yalnız açıklama alanları ve SINIF 2 / 3 kararları (§16.2–16.4).
export const EXCEPTIONS = new Map([
  // Açıklama (tutar / hesap değişmez; §16.2 "Açıklama alanları").
  ["payments.note", "açıklama (§16.2)"],
  ["cash_entries.description", "açıklama (§16.2)"],
  ["account_entries.note", "açıklama (§16.2)"],
  ["plan_entries.note", "açıklama (§16.2)"],
  ["stock_moves.note", "açıklama (§16.2)"],
  ["cheque_events.note", "açıklama (§16.2)"],
  ["cheques.serial_no", "açıklama (§16.2)"],
  ["invoices.number", "açıklama (§16.2; numaralama kilitli faturada da yazar)"],
  ["fin_events.no", "açıklama (§16.2)"],
  ["fin_events.description", "açıklama (§16.2)"],
  ["doubtful_receivables.note", "açıklama (§16.2)"],
  ["doubtful_provisions.note", "açıklama (§16.2)"],
  ["doubtful_receivables.created_at", "yalnız listeleme (§16.2)"],
  ["doubtful_receivables.created_by", "yalnız listeleme (§16.2)"],
  ["stock_items.name", "açıklama (§16.2)"],
  ["stock_items.unit", "açıklama (§16.2)"],
  ["accounts.name", "şüpheli kaydının etiketi (§16.2)"],
  ["accounts.ref_no", "şüpheli kaydının etiketi (§16.2)"],
  // SINIF 2.
  ["account_entries.opening_review", "SINIF 2 — kapının yazdığı kopya + opening:review denetimi (§15.2 (2), K8-2)"],
  ["account_entries.invoice_id", "SINIF 2 — BAŞ MİMAR KARARI GEREKİYOR (§16.4): fatura iptali kilitli tahsilatın bağını meşru olarak koparır"],
  // SINIF 3 (§16.3).
  ["bank_accounts.id", "SINIF 3 — banka / POS tanımı; dış değişikliği bank:sub görür, kapıdan alt hesap değişmez (§16.3)"],
  ["bank_accounts.kind", "SINIF 3 (§16.3)"],
  ["bank_accounts.gl", "SINIF 3 (§16.3)"],
  ["bank_accounts.gl_sub", "SINIF 3 (§16.3)"],
  ["pos_terminals.id", "SINIF 3 — POS alt hesabı BİLİNEN SINIR adayı (§16.3)"],
  ["pos_terminals.gl_sub", "SINIF 3 (§16.3)"],
  ["vat_offsets.created_at", "SINIF 3 — yalnız aynı tarihli sıra (§16.3)"],
]);
// Bütün tabloların rowid'i: aynı tarihli satır sırası (SINIF 3, §16.3) — ayrı kural (aşağıda).
// Satırları tetikleyiciyle değiştirilemeyen tablolar (değiştirme girişimi ABORT): donmuş defter (C3 §3; kaynak / satır bozukluğu ledger:snapshot) ve saklanan fiş (Ç2; ledger_vouchers_lock).
export const EXCEPTION_TABLES = new Map([
  ["ledger_snapshots", "donmuş defter — tetikleyiciler + ledger:snapshot denetimi (C3-DONDURMA-TASARIM §3, §8)"],
  ["ledger_snapshot_runs", "donmuş defter koşusu — tetikleyiciler + ledger:snapshot denetimi (C3 §3, §8); S127 bağı (§12.1)"],
  ["ledger_vouchers", "saklanan fiş — değiştirme / silme tetikleyiciyle engelli + ledger_vouchers_lock (Ç2)"],
  ["ledger_voucher_lines", "saklanan fiş satırı — tetikleyici + ledger_vouchers_lock (Ç2)"],
]);

const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

let root = "";
let file = "";
const QUIET_LOG = { debug() {}, info() {}, warn() {}, error() {} };
async function makeData() {
  root = mkdtempSync(path.join(tmpdir(), "c5a1f-kaynak-"));
  // Veri girişi 25.09.2026'da (kartın kapanış günü kilitli döneme düşsün); kilit 20.10.2026'da konur (10.10.2026).
  const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: { time: "2026-09-25T12:00:00+03:00", fixed: true }, integrityScan: false, log: QUIET_LOG });
  try {
    const api = await server.login();
    const q = (sql, ...args) => server.app.store.get(sql, ...args);
    await must("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
    const bank = await must("banka", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", currency: "TRY", opening: { date: "2026-09-01", amount: "10.000", confirmed: true } }));
    const bankId = bank.id || bank.account?.id;
    await must("çek kullan", api.put(`/api/workspace/bank/accounts/${bankId}`, { useCheque: true, useNote: true }));
    await must("kasa", api.post("/api/workspace/cash", { kind: "in", amount: "5000", date: "2026-09-01", description: "Kasa girişi" }));
    await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "1000", date: "2026-09-02", bankAccountId: bankId }));
    const A = await must("A", api.post("/api/workspace/accounts", { name: "Kaynak A", type: "customer", registeredOn: "2026-09-01", openingBalance: "700" }));
    const S = await must("S", api.post("/api/workspace/accounts", { name: "Kaynak Kiraya Veren", type: "supplier", registeredOn: "2026-09-01" }));
    const T = await must("T", api.post("/api/workspace/accounts", { name: "Kaynak Temizlik", type: "supplier", registeredOn: "2026-09-01" }));
    await must("A borç", api.post(`/api/workspace/accounts/${A.id}/entries`, { kind: "debt", amount: "3000", date: "2026-09-02", note: "Hizmet" }));
    await must("A havale", api.post(`/api/workspace/accounts/${A.id}/entries`, { kind: "in", amount: "200", date: "2026-09-03", method: "bank", bankAccountId: bankId }));
    const cheque = body => must(`evrak ${body.serialNo}`, api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", dueDate: "2026-12-01", issueDate: "2026-09-03", ...body }));
    const c1 = await cheque({ serialNo: "K-1", amount: "400", accountId: A.id });
    const c2 = await cheque({ serialNo: "K-2", amount: "300" });
    const c4 = await cheque({ serialNo: "K-4", amount: "350", accountId: A.id });
    const c5 = await cheque({ serialNo: "K-5", amount: "150", accountId: A.id });
    await cheque({ serialNo: "K-N", amount: "120", instrument: "note", accountId: A.id });
    await must("verilen çek", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", serialNo: "K-O", bank: "Akbank", amount: "90", issueDate: "2026-09-03", dueDate: "2026-12-01", accountId: S.id }));
    await must("K-2 karşılıksız", api.post(`/api/workspace/cheques/${c2.id}/actions`, { action: "bounce", date: "2026-09-05" }));
    await must("K-4 tahsile ver", api.post(`/api/workspace/cheques/${c4.id}/actions`, { action: "bank-deposit", date: "2026-09-05", bankAccountId: bankId }));
    await must("K-5 tahsile ver", api.post(`/api/workspace/cheques/${c5.id}/actions`, { action: "bank-deposit", date: "2026-09-05", bankAccountId: bankId }));
    await must("K-5 tahsil", api.post(`/api/workspace/cheques/${c5.id}/actions`, { action: "collect", date: "2026-09-07", method: "bank" }));
    await must("K-1 tahsil (nakit)", api.post(`/api/workspace/cheques/${c1.id}/actions`, { action: "collect", date: "2026-09-08", method: "cash" }));
    const goods = await must("ürün", api.post("/api/workspace/stock", { name: "Kaynak Ürün", code: "URN-KYN", unit: "Adet", unitPrice: "10", salePrice: "100", openingQty: "5" }));
    await must("alım", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "100", unitPrice: "10", pay: "none", date: "2026-09-01" }));
    await must("cariye satış", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "5", unitPrice: "100", pay: "account", method: "cash", accountId: A.id, date: "2026-09-04" }));
    await must("iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "100", pay: "account", method: "cash", accountId: A.id, date: "2026-09-05" }));
    await must("peşin satış", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "2", unitPrice: "100", pay: "cash", method: "cash", date: "2026-09-04" }));
    await must("kira (stopaj)", api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: S.id, issueDate: "2026-09-02", number: "KIRA-09", profile: "KAGIT", stoppageRate: 20, lines: [{ name: "Eylül Kirası", qty: 1, unitPrice: 10000, vatRate: 0, exemptionCode: "351", expenseCode: "rent" }], payment: { rest: "open" } }));
    await must("temizlik (tevkifat)", api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: T.id, issueDate: "2026-09-03", number: "PRL-09", profile: "KAGIT", lines: [{ name: "Temizlik Hizmeti", qty: 1, unitPrice: 2000, vatRate: 20, withholdingCode: "612", expenseCode: "cleaning" }], payment: { rest: "open" } }));
    await must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: A.id, issueDate: "2026-09-04", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }));
    const plan = await must("kart", api.post("/api/workspace/plans", { accountId: A.id, name: "Kaynak A", total: "900", mode: "auto", count: 3, firstDue: "2026-11-05", registeredOn: "2026-09-01" }));
    const planId = plan.id || q("SELECT id FROM plans WHERE account_id = ?", A.id).id;
    await must("kart tahsilatı", api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: "100", date: "2026-09-05", method: "cash" }));
    await cheque({ serialNo: "K-6", amount: "200", accountId: A.id, planId, issueDate: "2026-09-06" });
    await must("kapatılan kart", api.post("/api/workspace/plans", { accountId: A.id, name: "Kaynak A Kapalı", total: "100", registeredOn: "2026-09-01" }));
    const closed = q("SELECT id FROM plans WHERE name = 'Kaynak A Kapalı'").id;
    await must("kartı kapat", api.put(`/api/workspace/plans/${closed}`, { status: "closed" }));
    await must("excel kart", api.post("/api/workspace/plans/import", { matrix: [["Ad Soyad", "Toplam", "Taksit", "İlk Vade", "Ödenen", "Kayıt"], ["Kaynak Excel", "1000", "2", "05.11.2026", "400", "01.09.2026"]], headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "paid", 5: "registered" }, fileName: "kaynak.xlsx", linkRecords: false }));
    const record = await must("şüpheli", api.post(`/api/workspace/accounts/${A.id}/doubtful`, { amount: "1000", date: "2026-09-08", reason: "other" }));
    const recordId = record?.record?.id || q("SELECT id FROM doubtful_receivables WHERE account_id = ?", A.id).id;
    await must("karşılık", api.post(`/api/workspace/accounts/${A.id}/doubtful/${recordId}/provision`, { amount: "300", date: "2026-09-09" }));
    await must("A tahsilat", api.post(`/api/workspace/accounts/${A.id}/entries`, { kind: "in", amount: "500", date: "2026-09-09", method: "cash", note: "Tahsilat" }));
    const B = await must("B", api.post("/api/workspace/accounts", { name: "Kaynak B", type: "customer", registeredOn: "2026-09-01" }));
    await must("B borç", api.post(`/api/workspace/accounts/${B.id}/entries`, { kind: "debt", amount: "800", date: "2026-09-02", note: "Hizmet" }));
    const second = await must("şüpheli B", api.post(`/api/workspace/accounts/${B.id}/doubtful`, { amount: "400", date: "2026-09-08", reason: "other" }));
    const secondId = second?.record?.id || q("SELECT id FROM doubtful_receivables WHERE account_id = ?", B.id).id;
    await must("şüpheliden çıkar (B)", api.post(`/api/workspace/accounts/${B.id}/doubtful/${secondId}/release`, { date: "2026-09-09" }));
  } finally {
    await server.close();
  }
  const later = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: NOW, integrityScan: false, log: QUIET_LOG });
  try {
    const api = await later.login();
    await must("KDV mahsubu Eylül", api.post("/api/workspace/tax/vat-offset", { month: "2026-09" }));
    // API'nin üretemediği kaynak durumları (yalnız eski sürüm / dış araç; §16.2): Kayıt Tarihi boş kart, 2.0.13 öncesi kapatılmış kart (kapanış günü yok), aynı evrakta ikinci
    // karşılıksız olayı, kayıt tahsilatı (üretimde kapalı yol).
    const raw = new DatabaseSync(later.app.store.get("PRAGMA database_list").file);
    try {
      raw.exec("PRAGMA busy_timeout = 5000");
      raw.prepare("UPDATE plans SET registered_on = '', created_at = '2026-09-02T09:00:00.000Z', closed_at = NULL WHERE name = 'Kaynak A Kapalı'").run();
      const c2 = raw.prepare("SELECT id FROM cheques WHERE serial_no = 'K-2'").get().id;
      raw.prepare("INSERT INTO cheque_events (id, cheque_id, kind, date, amount, account_id, from_status, to_status, note, effects_json, created_by, created_at) SELECT 'kaynak-bounce-2', cheque_id, 'bounce', '2026-09-06', amount, account_id, from_status, to_status, note, '[]', created_by, '2026-09-06T09:00:00.000Z' FROM cheque_events WHERE cheque_id = ? AND kind = 'bounce'").run(c2);
      raw.prepare("INSERT INTO payments (id, case_key, amount, date, note, case_title, method, fin_ref, event_id, created_by, created_at) VALUES ('kaynak-pay', 'kayit-1', 50, '2026-09-04', '', '', 'cash', '', '', 'admin', '2026-09-04T09:00:00.000Z')").run();
    } finally {
      raw.close();
    }
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    await later.app.ledger.snapshots.runPending();
    file = later.app.store.get("PRAGMA database_list").file;
  } finally {
    await later.close();
  }
}

/** EXPLAIN bayt kodundan sorgunun okuduğu tablo.sütun kümesi (dizin üzerinden okunan sütun tablonun sütunu sayılır). */
function readsOf(db, sql, roots, columnsOf) {
  const out = new Set();
  const cursors = new Map();
  for (const op of db.prepare(`EXPLAIN ${sql}`).all()) {
    if (op.opcode === "OpenRead" || op.opcode === "ReopenIdx") {
      const object = roots.get(Number(op.p2));
      if (object) cursors.set(op.p1, { table: object.tbl_name, cols: columnsOf(object) });
    } else if (op.opcode === "Column") {
      const cursor = cursors.get(op.p1);
      if (cursor) out.add(`${cursor.table}.${cursor.cols[op.p2] ?? "rowid"}`);
    } else if (["Rowid", "IdxRowid", "SeekRowid", "NotExists"].includes(op.opcode)) {
      const cursor = cursors.get(op.p1);
      if (cursor) out.add(`${cursor.table}.rowid`);
    }
  }
  return out;
}

/** Türetmenin kaynak sorguları (yakalanan SQL'ler) ve okudukları sütunlar. */
export function derivationReads(db) {
  const seen = new Set();
  const prepare = DatabaseSync.prototype.prepare;
  db.prepare = function capture(sql) {
    seen.add(sql);
    return prepare.call(this, sql);
  };
  try {
    const ledger = registerLedgerRoutes(new Proxy({}, { get: () => () => {} }), { store: createStore(db), auth: null });
    ledger.build();
  } finally {
    delete db.prepare;
  }
  const roots = new Map(db.prepare("SELECT type, name, tbl_name, rootpage FROM sqlite_master WHERE rootpage > 0").all().map(row => [Number(row.rootpage), row]));
  const cache = new Map();
  const columnsOf = object => {
    if (!cache.has(object.name)) cache.set(object.name, db.prepare(object.type === "index" ? `PRAGMA index_xinfo(${object.name})` : `PRAGMA table_xinfo(${object.name})`).all().map(row => row.name));
    return cache.get(object.name);
  };
  const reads = new Set();
  for (const sql of seen) for (const column of readsOf(db, sql, roots, columnsOf)) reads.add(column);
  return { queries: seen.size, reads };
}

// Bozma değerleri: sayı ±1 (0 / 1 işareti çevrilir), tarih / zaman damgası başka yıla (sıra değişsin), metin sonuna ek; durum / tür benzeri sütunlarda ayrıca sütunun öbür
// değerleri ve programın bilinen değerleri (türetme değeri karşılaştırarak okuyor: "cancelled", "bounced" …).
const ENUM_COLUMNS = new Set(["status", "kind", "source", "method", "reason", "direction", "pay", "instrument", "type", "role", "side", "journal_class"]);
const ENUMS = ["", "cancelled", "released", "closed", "open", "active", "issued", "draft", "bounced", "portfolio", "collected", "endorsed", "returned", "pending", "paid", "in", "out", "debt", "credit", "cheque", "invoice", "stock", "bank", "cash", "card", "sale", "return", "preturn", "note", "customer", "supplier"];
const bump = value => {
  if (value === null || value === undefined) return "x";
  if (typeof value === "number" || typeof value === "bigint") return Number(value) === 1 ? 0 : Number(value) + 1;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return `${text.startsWith("2000") ? "1999" : "2000"}${text.slice(4)}`;
  return `${text}x`;
};

/**
 * Sütunun kilitli dönemdeki değişikliğini kilit izi görüyor mu: satırlar tek tek bozulur (geri alınan işlemde); ilk izi değiştiren bozmada durur. Bozma DEĞERİN kendisidir
 * (bump): yalnız WHERE'de kalan sütunun boş ↔ dolu geçişi yetmez (ör. bağ başka bir bağa döner). Durum / tür benzeri sütunlarda (türetme değeri karşılaştırarak okur) ayrıca
 * sütunun öbür değerleri ve programın bilinen değerleri denenir.
 */
export function tracked(db, store, column, lock, base) {
  const [table, name] = column.split(".");
  const distinct = ENUM_COLUMNS.has(name) ? db.prepare(`SELECT DISTINCT "${name}" AS v FROM ${table} LIMIT 12`).all().map(row => row.v) : [];
  // Dolu değerli satırlar önce ve yalnız onlar (varsa): boş → dolu bozması yalnız WHERE'deki "<> ''" koşulunu sınar, değerin izde olduğunu göstermez.
  const all = db.prepare(`SELECT rowid AS r, "${name}" AS v FROM ${table} ORDER BY rowid`).all();
  const filled = all.filter(row => row.v !== null && row.v !== "" && row.v !== 0);
  for (const row of ENUM_COLUMNS.has(name) || !filled.length ? all : filled) {
    const candidates = [...new Set([bump(row.v), ...distinct, ...(ENUM_COLUMNS.has(name) ? ENUMS : [])])].filter(value => value !== row.v);
    for (const value of candidates) {
      db.exec("SAVEPOINT bozma");
      try {
        try {
          db.prepare(`UPDATE ${table} SET "${name}" = ? WHERE rowid = ?`).run(value, row.r);
        } catch {
          continue; // kısıt (NOT NULL / CHECK / benzersiz) — bu değer yazılamaz
        }
        if (lockDigestOf(store, lock) !== base) return "iz";
      } finally {
        db.exec("ROLLBACK TO bozma");
        db.exec("RELEASE bozma");
      }
    }
  }
  return "";
}

describe("Ç5-A tur 1f — Ana Defter türetmesinin okuduğu her sütun kilit izinde ya da gerekçeli açık istisnada (kalıcı kaynak tarama; §16)", () => {
  before(makeData, { timeout: 180_000 });
  after(() => root && rmSync(root, { recursive: true, force: true }));

  it("türetmenin okuduğu her sütun: kilitli satırda değişince iz değişir ya da açık istisnada; istisnalar güncel (hepsi türetmede okunuyor)", { timeout: 300_000 }, () => {
    const db = new DatabaseSync(file);
    try {
      const { queries, reads } = derivationReads(db);
      assert.ok(queries >= 25, `ön koşul: türetmenin kaynak sorguları yakalandı (${queries})`);
      // Ön koşul (testin kendisi): türetmenin bilinen sütunları okunuyor — yakalama ve EXPLAIN çözümlemesi çalışıyor.
      for (const known of ["cash_entries.transfer_id", "account_entries.source", "plan_entries.opening", "invoices.gl_json", "cheques.status", "cheque_collections.event_id"]) assert.ok(reads.has(known), `ön koşul: ${known} türetmede okunuyor`);
      const store = createStore(db);
      const base = lockDigestOf(store, LOCK);
      const missing = [];
      const outcome = {};
      for (const column of [...reads].sort()) {
        if (column.endsWith(".rowid") || EXCEPTIONS.has(column) || EXCEPTION_TABLES.has(column.split(".")[0])) continue;
        const how = tracked(db, store, column, LOCK, base);
        outcome[column] = how;
        if (!how) missing.push(column);
      }
      assert.equal(lockDigestOf(store, LOCK), base, "bozmalar geri alındı (iz aynı)");
      assert.deepEqual(missing, [], `kilit izinde OLMAYAN ve istisna listesinde de olmayan türetme sütunları (LOCK_SQL'e ekleyin ya da gerekçeyle istisnaya yazın): ${missing.join(", ")}`);
      const stale = [...EXCEPTIONS.keys()].filter(column => !reads.has(column));
      assert.deepEqual(stale, [], `istisna listesinde türetmenin artık okumadığı sütun: ${stale.join(", ")}`);
      for (const table of EXCEPTION_TABLES.keys()) {
        assert.ok(db.prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ? AND sql LIKE '%BEFORE UPDATE%' LIMIT 1").get(table), `istisna tablosu tetikleyiciyle korunuyor: ${table}`);
      }
      const found = Object.values(outcome).filter(how => how === "iz").length;
      console.log(`# kaynak tarama: ${queries} sorgu, ${reads.size} sütun okunuyor; izde ${found}; istisna ${[...reads].filter(column => EXCEPTIONS.has(column)).length}; istisna tablosu ${[...reads].filter(column => EXCEPTION_TABLES.has(column.split(".")[0])).length}; rowid ${[...reads].filter(column => column.endsWith(".rowid")).length}`);
      assert.ok(found >= 60, `ön koşul: izde bulunan sütun sayısı (${found})`);
    } finally {
      db.close();
    }
  });
});
