// Mutabakat testi ve doğrulama katmanı (v2.0.13).
//
// Ne yapar: para taşıyan tablolara (Kasa, cari, taksit, stok, çek/senet) yazan HER işlem, en dış COMMIT'ten hemen
// önce aynı veritabanı işleminin içinde şu denetimlerden geçer (store.addCommitGuard):
//   1. Çift yönlü kayıt: her yevmiye maddesinde borç = alacak; mizanda borç toplamı = alacak toplamı.
//   2. Alt defter ↔ ana defter: Nakit Kasa, Banka, Kredi Kartı (Kasa alt defteri, yola göre), müşteri / tedarikçi /
//      diğer cariler (cari alt defteri — taksit alacakları dahil), carisiz taksit kartları (taksit alt defteri),
//      portföydeki ve ödenecek çek/senet: ana defter bakiyesi alt defterin kendi hesabına kuruşu kuruşuna eşit.
//   3. Kuruş: hiçbir tutar kuruştan küçük küsurat taşımaz, eksi olmaz.
//   4. Stok ↔ cari / Kasa bağı: açık hesaba yazılan her stok hareketinin carideki karşılığı aynı tutarda var; karşılığı
//      olmayan (sızan) ya da hareketi silinmiş (yetim) cari satırı yok; miktar sıfırdan büyük.
//   5. Çek/senet ↔ cari bağı: evraktan gelen her cari satırı var olan bir evraka ve onun tutarına bağlı.
//   6. Fatura (v2.0.15): başlık = kalemler; TL karşılığı denk; cari, stok, çek/senet ve taksit bağları; iade ≤ satılan.
// Sapma bulunursa işlem ROLLBACK edilir (hiçbir satırı diske yazılmaz), kullanıcıya nedeni söylenir (409) ve
// integrity_log'a yazılır.
//
// Eski veri: güncellemeden önce oluşmuş bir sapma (ör. eski sürümde kalmış kuruş farkı) açılışta bulunur ve günlüğe
// "baseline" olarak yazılır; o sapma yüzünden ilgisiz işlemler engellenmez. Kural: hiçbir işlem YENİ bir sapma
// eklemez ve var olanı büyütemez (denetim her işlemde "işlem öncesi durum" ile karşılaştırır).
import { createHash } from "node:crypto";
import { HttpError } from "./http.mjs";
import { partyBalances } from "./general-ledger.mjs";
import { systemClock } from "./clock.mjs";
import { roundMoney, toCents } from "./money.mjs";

const AMOUNT_COLUMNS = [
  ["payments", "amount", ""],
  ["cash_entries", "amount", ""],
  ["account_entries", "amount", ""],
  ["plans", "total", "deleted_at IS NULL"],
  ["plan_items", "amount", ""],
  ["plan_entries", "amount", ""],
  ["stock_moves", "amount", ""],
  ["cheques", "amount", "deleted_at IS NULL"],
  ["cheque_events", "amount", ""],
  ["invoices", "try_payable", "status <> 'draft'"],
  ["invoices", "try_net", "status <> 'draft'"],
  ["invoices", "try_vat", "status <> 'draft'"],
  ["invoices", "try_withheld", "status <> 'draft'"],
  ["invoices", "try_stoppage", "status <> 'draft'"],
  ["invoices", "payable_total", ""],
  ["invoice_lines", "net", ""],
  ["invoice_lines", "vat", ""],
];
const money = value => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} TL`;

export class IntegrityError extends HttpError {
  constructor(failures) {
    const first = failures[0];
    super(409, `İşlem geri alındı: kayıt defterler arasında sapma oluşturacaktı (${first.name}${first.difference ? `: ${money(first.difference)} fark` : ""}). Hiçbir değişiklik yazılmadı; yöneticinize bildirin.`, { code: "ledger-integrity", failures });
    this.failures = failures;
  }
}

/**
 * @param {{ store, ledger: () => ({ check, expected }), log?, newId? }} options
 */
const AUDITOR = { id: "integrity", role: "admin", permissions: [] };
// v2.0.26 (B7): ödeme yolu kolonu olan para tabloları. Tanınmayan yol (nakit/havale/kart dışı) üç okuma yolunda üç ayrı biçimde
// sayılıyordu (Kasa özeti: bakiyede var, yol kırılımında yok; Kasa satırları: nakit; yevmiye: 100). Yeni işlem böyle satır
// yazamaz ("money:method"); açılışta bulunan eski satırlar kimlikleriyle tabandır (A13 kuralı), okunmaya devam eder.
const METHOD_TABLES = ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"];
const KNOWN_METHODS = "('cash', 'bank', 'card')";
// v2.0.26 (A6): çek/senet olayları da (alındı/verildi, tahsil, ciro, ödeme, karşılıksız) tarihli harekettir; eski veride kalan
// ileri tarihli olaylar A13 kuralıyla (açılıştaki kimlikler taban) yeni işlemleri engellemez.
// v2.1.0 (§5.5): fin_events (İşlem No'lu işlem başlığı) de tarihli harekettir. Denetim satırları tabloda kayıt olduğunda görünür
// (Banka modülü kullanılmayan kurulumda Mutabakat Testi'nin denetim listesi ve sayısı değişmesin); satır yazıldığı anda kapı
// tarihi denetler.
const DATED = ["payments", "cash_entries", "account_entries", "stock_moves", "plan_entries", "cheque_events", "fin_events"];
const DATED_WHEN_USED = new Set(["fin_events"]);
// 2. gözden geçirme İ8: denetim adlarında tablo adı yerine kullanıcının bildiği ad (Yönetim'de, Defter Mutabakatı'nda, günlükte görünür).
const TABLE_LABEL = {
  payments: "Kayıt Tahsilatları",
  cash_entries: "Kasa Hareketleri",
  account_entries: "Cari Hareketleri",
  stock_moves: "Stok Hareketleri",
  plan_entries: "Taksit Tahsilatları",
  plan_items: "Taksitler",
  plans: "Taksit Kartları",
  cheque_events: "Çek/Senet Hareketleri",
  cheques: "Çek/Senet",
  invoices: "Faturalar",
  invoice_lines: "Fatura Kalemleri",
  fin_events: "Finansal İşlemler",
};
const labelOf = table => TABLE_LABEL[table] || table;
// Kapanmış dönemin parmak izi: kilit tarihi ve öncesindeki her para satırı (tutar, yön, yol, tarih, cari/kalem bağı) ve
// o dönemde cariye borç yazan kartlar. Kilit altındaki tek bir satır değişirse, silinirse ya da eklenirse iz değişir.
const LOCK_SQL = {
  payments: "SELECT id, amount, date, method FROM payments WHERE date <= ? ORDER BY id",
  cash_entries: "SELECT id, kind, amount, date, method FROM cash_entries WHERE date <= ? ORDER BY id",
  account_entries: "SELECT id, account_id, kind, amount, date, method FROM account_entries WHERE date <= ? ORDER BY id",
  stock_moves: "SELECT id, item_id, kind, qty, amount, date, pay, method, account_id FROM stock_moves WHERE date <= ? ORDER BY id",
  plan_entries: "SELECT id, plan_id, kind, amount, date, method FROM plan_entries WHERE date <= ? ORDER BY id",
  plans: "SELECT id, total, account_id, registered_on FROM plans WHERE deleted_at IS NULL AND covers_balance = 0 AND registered_on <> '' AND registered_on <= ? ORDER BY id",
  // v2.0.15: kapanmış dönemde kesilmiş fatura iptal edilemez, o döneme fatura eklenemez (taslak deftere girmez, sayılmaz).
  invoices: "SELECT id, kind, status, account_id, issue_date, try_payable, try_vat FROM invoices WHERE status <> 'draft' AND issue_date <= ? ORDER BY id",
  // v2.0.26: yukarıdaki 7 girdinin SQL'i ve sırası değişmez; yeni girdiler sona eklenir ve { requires, sql } biçimindedir
  // (anahtar tablo adı değildir). SQL'deki ?1 kilit tarihidir.
  // A3 — party_lock: kapanmış dönemde HERHANGİ bir hareketi (tahsilat/ödeme, Borç Yaz/Alacak Yaz, açılış; taksit kartı borcu
  // ya da tahsilatı) olan her cari, türü ve silinmemiş olduğu bilgisiyle. Silinmiş carinin bütün satırları yevmiyeden düşer
  // (routes/ledger.mjs rows), tür değişikliği 120/320/336 sınıfını kaydırır: ikisi de kilitli mizanı değiştirir.
  party_lock: {
    requires: ["accounts", "account_entries", "plans", "plan_entries"],
    sql: `SELECT a.id, a.type, a.deleted_at IS NULL AS live FROM accounts a
          WHERE EXISTS (SELECT 1 FROM account_entries e WHERE e.account_id = a.id AND e.date <= ?1)
             OR EXISTS (SELECT 1 FROM plans p WHERE p.account_id = a.id AND p.deleted_at IS NULL
                          AND ((p.covers_balance = 0 AND p.registered_on <> '' AND p.registered_on <= ?1)
                               OR EXISTS (SELECT 1 FROM plan_entries pe WHERE pe.plan_id = p.id AND pe.date <= ?1)))
          ORDER BY a.id`,
  },
  // A6 — çek/senet: kapanmış dönemdeki olaylar (alındı/verildi, tahsil, ciro, ödeme, karşılıksız) ve o dönemde alınmış/verilmiş
  // evrakın tutarı, tarihi ve silinmemiş olduğu. Evrakın durumu (status) girmez: kilitli ayda alınan çek bugün tahsil edilir.
  cheque_events_lock: { requires: ["cheque_events"], sql: "SELECT id, cheque_id, kind, amount, date, method FROM cheque_events WHERE date <= ?1 ORDER BY id" },
  cheques_lock: { requires: ["cheques"], sql: "SELECT id, direction, amount, issue_date, deleted_at IS NULL AS live FROM cheques WHERE issue_date <= ?1 ORDER BY id" },
  // Gözden geçirme G2 — kapanmış dönemde tahsilatı olan kartın carisi: tahsilat carinin hesabına (120/320/336) yazılır; kart başka
  // cariye taşınırsa (iki cari de party_lock'ta olsa bile) kilitli dönemin cari bakiyeleri kayar. Silinen kart da izden düşer.
  plans_party_lock: {
    requires: ["plans", "plan_entries"],
    sql: `SELECT p.id, p.account_id FROM plans p
          WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM plan_entries pe WHERE pe.plan_id = p.id AND pe.date <= ?1)
          ORDER BY p.id`,
  },
  // Gözden geçirme G1 — kapanmış dönemde kapatılmış kart: vazgeçilen kalan (689) kapatıldığı gün yazılır (routes/ledger.mjs: closed_at,
  // 2.0.13 öncesi kapatılmışta son güncelleme günü; Kayıt Tarihi'nden önce değil — aynı ifade). Kartın yeniden açılması, silinmesi,
  // tutarı, carisi (ve carinin türü) ya da sonradan gelen tahsilatı kilitli mizanı değiştirir. Kart güncellenirken eski kartın
  // kapanış günü yazılır (plans.mjs FREEZE_CLOSE); gün aynı kaldığı için iz değişmez.
  plans_close_lock: {
    requires: ["plans", "plan_entries", "accounts"],
    sql: `SELECT * FROM (
            SELECT p.id, p.account_id, COALESCE(a.type, '') AS party, p.total,
                   MAX(COALESCE(p.closed_at, substr(p.updated_at, 1, 10)), COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10))) AS closed_on,
                   ROUND(p.total - COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0), 2) AS waived
            FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL
            WHERE p.deleted_at IS NULL AND p.status = 'closed')
          WHERE closed_on <= ?1 ORDER BY id`,
  },
  // v2.1.0 (v20, §5.5): banka girdileri. Eski veride satır üretmezler (yeni kolonlar boş, yeni tablolar boş): göçten sonra kilit izi
  // göç öncesiyle birebir aynıdır (K11). "tablo.kolon" gereksinimi kolonun varlığını da arar (v19 dosyasında atlanır).
  // money_refs: kapanmış dönemdeki para satırının hesap/POS bağı ve İşlem No'su — kilitli satıra "Bu Hesaba Ata" 409 alır.
  money_refs: {
    requires: ["payments.fin_ref", "cash_entries.fin_ref", "account_entries.fin_ref", "plan_entries.fin_ref", "stock_moves.fin_ref", "cheque_events.fin_ref"],
    sql: ["payments", "cash_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"]
      .map(table => `SELECT '${table}' AS t, id, fin_ref, event_id FROM ${table} WHERE date <= ?1 AND (fin_ref <> '' OR event_id <> '')`)
      .join(" UNION ALL ")
      .concat(" ORDER BY t, id"),
  },
  // fx_refs: döviz hesabına cari tahsilatı/ödemesi (13b) satırının döviz tutarı ve kuru.
  fx_refs: {
    requires: ["account_entries.fx_minor"],
    sql: "SELECT id, fx_currency, fx_minor, fx_rate_e6, fx_source FROM account_entries WHERE date <= ?1 AND (fx_currency <> '' OR fx_minor <> 0 OR fx_rate_e6 <> 0 OR fx_source <> '') ORDER BY id",
  },
  // İşlem başlığının değişmeyen alanları (durum ve ters kayıt bağı girmez: kilitli işlem bugün ters kaydedilebilir) ve fişi.
  fin_events_lock: { requires: ["fin_events"], sql: "SELECT id, type, date, reversal_of, bank_ref, counter_ref, amount_minor, try_minor FROM fin_events WHERE date <= ?1 ORDER BY id" },
  bank_lines_lock: {
    requires: ["bank_lines", "fin_events"],
    sql: "SELECT l.id, l.event_id, l.seq, l.role, l.gl, l.sub, l.ref, l.side, l.try_minor, l.currency, l.fx_minor, l.rate_e6 FROM bank_lines l JOIN fin_events e ON e.id = l.event_id WHERE e.date <= ?1 ORDER BY l.id",
  },
  // POS satışının değişmeyen alanları (durum, güncelleme ve sonradan değişebilen iade/bloke alanları girmez).
  pos_sales_lock: {
    requires: ["pos_sales"],
    sql: "SELECT id, event_id, pos_id, kind, src, origin_id, date, installments, rate_ppm, tax_kind, tax_mode, tax_ppm, fixed_minor, refund_commission, payout, block_days, bank_account_id, provider_account_id, gross_minor, commission_minor, tax_minor, net_minor, auth_code FROM pos_sales WHERE date <= ?1 ORDER BY id",
  },
  // Bankaya Tahsile Ver (§3.14): verilme ve kapanış ayrı (kilitli ayda verilen çek açık ayda tahsil edilebilir).
  cheque_collections_given: { requires: ["cheque_collections"], sql: "SELECT id, cheque_id, bank_account_id, given_date FROM cheque_collections WHERE given_date <= ?1 ORDER BY id" },
  cheque_collections_closed: { requires: ["cheque_collections"], sql: "SELECT id, status, closed_date, close_event_id FROM cheque_collections WHERE closed_date <> '' AND closed_date <= ?1 ORDER BY id" },
};

/**
 * Kapanmış dönemin parmak izi (sha256): LOCK_SQL'in her girdisi, kilit tarihi (ve öncesi) için. Gereksinim "tablo" ya da
 * "tablo.kolon"; karşılanmayan girdi atlanır (eski şema). Göç testleri ve araçlar da kullanır (v2.1.0; K11 ölçütü).
 */
export function lockDigestOf(store, lock) {
  if (!lock) return "";
  const tables = new Set(store.all("SELECT name FROM sqlite_master WHERE type = 'table'").map(row => row.name));
  const columns = new Map();
  const has = requirement => {
    const [table, column] = requirement.split(".");
    if (!tables.has(table)) return false;
    if (!column) return true;
    if (!columns.has(table)) columns.set(table, new Set(store.all(`PRAGMA table_info(${table})`).map(row => row.name)));
    return columns.get(table).has(column);
  };
  const hash = createHash("sha256");
  for (const [name, entry] of Object.entries(LOCK_SQL)) {
    const { requires, sql } = typeof entry === "string" ? { requires: [name], sql: entry } : entry;
    if (!requires.every(has)) continue;
    for (const row of store.all(sql, lock)) hash.update(`${name}|${Object.values(row).join("|")}\n`);
  }
  return hash.digest("hex");
}

export function createIntegrity({ store, ledger, accounts = () => null, stock = () => null, plans = () => null, period = () => null, log = null, newId = () => `int-${crypto.randomUUID()}`, now = systemClock }) {
  const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
  const hasColumn = (table, column) => has(table) && store.all(`PRAGMA table_info(${table})`).some(row => row.name === column);
  // İ8: eski sürümden kalan ileri tarihli satır için kullanıcının yapacağı (tablo adı yok). Çek/senet: 2.0.25'te ileri alış/veriliş
  // tarihi girilebiliyordu; Düzenle ile gerçek güne çekilir (işlem görmemiş evrakta), tahsil/ciro/ödeme tarihi ileriyse geri alınıp
  // doğru tarihle yeniden yapılır.
  function futureHint(table, rows, today) {
    if (table === "cheque_events") {
      const cheques = store.get("SELECT COUNT(DISTINCT cheque_id) AS n FROM cheque_events WHERE date > ?", today).n;
      return `Çek/Senet'te ${cheques} evrakta tarihi ileri hareket var (eski sürümden). Alış/Veriliş Tarihi ileriyse evrakın kartında Düzenle ile gerçek güne çekin; tahsil, ciro ya da ödeme tarihi ileriyse o işlemi geri alıp doğru tarihle yeniden yapın. Düzeltilmezse tarihi gelince kendiliğinden kalkar.`;
    }
    return `${labelOf(table)} içinde tarihi ileri ${rows.length} eski hareket var. Tarihi gelince kendiliğinden kalkar; tarih yanlışsa hareketi kendi kartında düzeltin.`;
  }

  /** Tüm denetimler; her biri { code, name, ok, difference?, count?, sample? }. */
  function run() {
    const started = performance.now();
    const checks = [];
    const service = ledger();
    if (service?.check) {
      // Cari listesi bir kez hesaplanır: Ana Defter'in beklenen bakiyeleri (120/320/336) ve cari bazında denetim aynı
      // listeyi kullanır (v2.0.22; önceden her yazmada iki kez hesaplanıyordu — aynı veri, aynı sonuç).
      const list = accounts()?.list ? accounts().list(AUDITOR, { status: "all" }).accounts : null;
      const { reconciliation, entries } = service.check({ accountList: list });
      checks.push({ code: "balance", name: "Çift yönlü kayıt (borç = alacak)", ok: reconciliation.balanced, difference: 0 });
      for (const item of reconciliation.checks) checks.push({ code: `gl:${item.code}`, name: `${item.code} ${item.name}`, ok: item.ok, difference: item.difference, ledger: item.ledger, subledger: item.subledger });
      // Cari bazında: her carinin ana defterdeki bakiyesi = cari kartındaki bakiye (toplamlar tutup kişiler arasında
      // kayma olmasın). Carisiz taksit kartları da kart bazında: kalan alacak = kart tutarı − net tahsilat.
      const parties = partyBalances(entries);
      if (list) {
        const wrong = [];
        let difference = 0;
        const seen = new Set();
        for (const account of list) {
          seen.add(account.id);
          const d = (parties.get(account.id) || 0) - toCents(account.balance);
          if (d) { wrong.push(`${account.refNo || account.id} ${account.name}: defter ${(parties.get(account.id) || 0) / 100} / kart ${account.balance}`); difference += d; }
        }
        for (const [party, value] of parties) if (!party.startsWith("plan:") && !seen.has(party) && value) { wrong.push(`${party}: listede yok, defterde ${value / 100}`); difference += value; }
        checks.push({ code: "party:accounts", name: "Cari bazında mutabakat (her cari ayrı)", ok: wrong.length === 0, count: wrong.length, difference: roundMoney(difference / 100), sample: wrong.slice(0, 5) });
      }
      if (has("plans")) {
        const wrong = [];
        for (const plan of store.all(
          `SELECT p.id, p.name, p.total, p.status, p.covers_balance AS coversBalance,
                  COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
           FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE p.deleted_at IS NULL AND a.id IS NULL`,
        )) {
          const total = plan.coversBalance ? 0 : toCents(plan.total);
          const left = toCents(plan.total) - toCents(plan.paid);
          const want = total - toCents(plan.paid) - (plan.status === "closed" ? Math.max(0, left) : 0);
          const got = parties.get(`plan:${plan.id}`) || 0;
          if (got !== want) wrong.push(`${plan.name}: defter ${got / 100} / kart ${want / 100}`);
        }
        checks.push({ code: "party:plans", name: "Carisiz taksit kartları (kart bazında)", ok: wrong.length === 0, count: wrong.length, sample: wrong.slice(0, 5) });
      }
    }
    // Taksit alt defteri: Taksitler ekranının her kart için gösterdiği toplam ve tahsilat = kartın satırları.
    if (plans()?.list && has("plans")) {
      const raw = new Map(store.all(
        `SELECT p.id, p.total, COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
         FROM plans p WHERE p.deleted_at IS NULL`,
      ).map(row => [row.id, row]));
      const wrong = [];
      for (const plan of plans().list(AUDITOR, { status: "all" }).plans || []) {
        const row = raw.get(plan.id);
        if (!row) continue;
        if (toCents(plan.totals.total) !== toCents(row.total) || toCents(plan.totals.paid) !== toCents(row.paid)) wrong.push(`${plan.refNo || plan.id} ${plan.name}: ekran ${plan.totals.total}/${plan.totals.paid} · satır ${row.total}/${row.paid}`);
        else if (plan.status !== "closed" && toCents(plan.totals.remaining) !== Math.max(0, toCents(row.total) - toCents(row.paid))) wrong.push(`${plan.refNo || plan.id} ${plan.name}: kalan ${plan.totals.remaining}`);
      }
      checks.push({ code: "plans:totals", name: "Taksit kartları (tutar, tahsilat, kalan)", ok: wrong.length === 0, count: wrong.length, sample: wrong.slice(0, 5) });
    }
    // Stok: ekrandaki mevcut = girişler − çıkışlar (hareketlerin kendisinden, bağımsız toplam).
    if (stock()?.list && has("stock_moves")) {
      const raw = new Map(store.all("SELECT item_id AS id, SUM(CASE WHEN kind = 'in' THEN qty ELSE -qty END) AS qty FROM stock_moves GROUP BY item_id").map(row => [row.id, row.qty]));
      const wrong = [];
      for (const item of stock().list(AUDITOR).items || []) {
        if (item.kind === "service" || item.service) continue;
        const want = Math.round((raw.get(item.id) || 0) * 1000);
        if (Math.round((Number(item.qty) || 0) * 1000) !== want) wrong.push(`${item.name}: ekran ${item.qty} / hareketler ${want / 1000}`);
      }
      checks.push({ code: "stock:qty", name: "Stok miktarı (girişler − çıkışlar)", ok: wrong.length === 0, count: wrong.length, sample: wrong.slice(0, 5) });
    }
    // Kuruş ve işaret: 12,345 TL ya da −5 TL gibi tutar yok.
    for (const [table, column, where] of AMOUNT_COLUMNS) {
      if (!hasColumn(table, column)) continue;
      const rows = store.all(`SELECT id, ${column} AS amount FROM ${table} WHERE (ABS(${column} * 100 - ROUND(${column} * 100)) > 0.0001 OR ${column} < 0)${where ? ` AND ${where}` : ""} LIMIT 5`);
      checks.push({ code: `cents:${table}`, name: `Kuruş ve işaret (${labelOf(table)})`, ok: rows.length === 0, count: rows.length, sample: rows.map(row => `${row.id}=${row.amount}`) });
    }
    if (has("stock_moves") && has("account_entries")) {
      // Açık hesaba yazılmış stok hareketi → carideki karşılığı aynı tutarda (sızıntı yok).
      const leaks = store.all(
        `SELECT m.id, m.amount, e.amount AS entryAmount FROM stock_moves m
           JOIN stock_items i ON i.id = m.item_id AND i.deleted_at IS NULL
           LEFT JOIN account_entries e ON e.source = 'stock' AND e.source_id = m.id
         WHERE m.pay = 'account' AND m.amount > 0 AND (e.id IS NULL OR ABS(e.amount - m.amount) > 0.004) LIMIT 5`,
      );
      checks.push({ code: "stock:account", name: "Stok ↔ cari bağı (açık hesap)", ok: leaks.length === 0, count: leaks.length, sample: leaks.map(row => `${row.id}: stok ${row.amount} / cari ${row.entryAmount ?? "yok"}`) });
      const orphans = store.all("SELECT e.id FROM account_entries e LEFT JOIN stock_moves m ON m.id = e.source_id WHERE e.source = 'stock' AND m.id IS NULL LIMIT 5");
      checks.push({ code: "stock:orphan", name: "Stok hareketi silinmiş cari satırı", ok: orphans.length === 0, count: orphans.length, sample: orphans.map(row => row.id) });
      const qty = store.all("SELECT id, qty FROM stock_moves WHERE NOT (qty > 0) LIMIT 5");
      checks.push({ code: "stock:qty", name: "Stok miktarı (sıfırdan büyük)", ok: qty.length === 0, count: qty.length, sample: qty.map(row => `${row.id}=${row.qty}`) });
    }
    if (has("cheques") && has("account_entries")) {
      const bad = store.all(
        `SELECT e.id, e.amount, c.amount AS chequeAmount FROM account_entries e LEFT JOIN cheques c ON c.id = e.source_id
         WHERE e.source = 'cheque' AND (c.id IS NULL OR ABS(c.amount - e.amount) > 0.004) LIMIT 5`,
      );
      checks.push({ code: "cheque:account", name: "Çek/senet ↔ cari bağı", ok: bad.length === 0, count: bad.length, sample: bad.map(row => `${row.id}: cari ${row.amount} / evrak ${row.chequeAmount ?? "yok"}`) });
    }
    // Fatura (v2.0.15): belge ↔ kalemler ↔ cari ↔ stok ↔ çek/senet ↔ taksit bağları.
    if (has("invoices") && has("invoice_lines")) {
      const c = column => `CAST(ROUND(${column} * 100) AS INTEGER)`;
      // 1. Başlık = kalemlerin toplamı (belgenin para biriminde).
      const head = store.all(
        // Takma adlar kolon adlarından ayrı (SQLite HAVING'de "net" önce kalemin net kolonunu bulur).
        `SELECT i.id, i.number, ${c("i.net_total")} AS hnet, ${c("i.vat_total")} AS hvat, ${c("i.withheld_total")} AS hwithheld, ${c("i.payable_total")} AS hpayable, ${c("i.stoppage_total")} AS hstoppage,
                COALESCE(SUM(${c("l.net")}), 0) AS lnet, COALESCE(SUM(${c("l.vat")}), 0) AS lvat, COALESCE(SUM(${c("l.withheld")}), 0) AS lwithheld, COALESCE(SUM(${c("l.payable")}), 0) AS lpayable, COUNT(l.id) AS lcount
         FROM invoices i LEFT JOIN invoice_lines l ON l.invoice_id = i.id GROUP BY i.id
         HAVING lcount = 0 OR hnet <> lnet OR hvat <> lvat OR hwithheld <> lwithheld OR hpayable <> lpayable - hstoppage LIMIT 5`,
      );
      checks.push({ code: "invoice:lines", name: "Fatura toplamı = kalemlerin toplamı", ok: head.length === 0, count: head.length, sample: head.map(row => `${row.number || row.id}: başlık ${row.hpayable / 100} (matrah ${row.hnet / 100}, KDV ${row.hvat / 100}) / kalemler ${(row.lpayable - row.hstoppage) / 100} (matrah ${row.lnet / 100}, KDV ${row.lvat / 100})`) });
      // 2. TL karşılığı: ödenecek = matrah + KDV − tevkifat − stopaj; hesap dağılımı (gl_json) matraha eşit.
      const money = store.all(`SELECT id, number, ${c("try_net")} AS net, ${c("try_vat")} AS vat, ${c("try_withheld")} AS withheld, ${c("try_stoppage")} AS stoppage, ${c("try_payable")} AS payable, gl_json AS gl FROM invoices WHERE status <> 'draft'`);
      const wrongTry = [];
      for (const row of money) {
        let gl = 0;
        try {
          gl = JSON.parse(row.gl || "[]").reduce((sum, item) => sum + Math.round(Number(item.net) || 0), 0);
        } catch {
          gl = Number.NaN;
        }
        if (row.payable !== row.net + row.vat - row.withheld - row.stoppage || gl !== row.net) wrongTry.push(`${row.number || row.id}: ödenecek ${row.payable / 100}, hesaplar ${gl / 100} / matrah ${row.net / 100}`);
      }
      checks.push({ code: "invoice:try", name: "Fatura TL karşılığı (matrah + KDV − tevkifat − stopaj)", ok: wrongTry.length === 0, count: wrongTry.length, sample: wrongTry.slice(0, 5) });
      // 3. Cari: kesilmiş faturanın cari satırı tek ve ödenecek tutar kadar; taslak/iptal faturanın cari satırı yok.
      if (has("account_entries")) {
        const party = store.all(
          `SELECT * FROM (
             SELECT i.id, i.number, i.status, i.kind, ${c("i.try_payable")} AS hpayable,
                    COALESCE((SELECT SUM(${c("e.amount")}) FROM account_entries e WHERE e.source = 'invoice' AND e.source_id = i.id AND e.kind IN ('debt', 'credit') AND e.account_id = i.account_id
                              AND e.kind = CASE WHEN i.kind IN ('sale', 'smm', 'purchase_return') THEN 'debt' ELSE 'credit' END), 0) AS posted,
                    (SELECT COUNT(*) FROM account_entries e WHERE e.source = 'invoice' AND e.source_id = i.id AND e.kind IN ('debt', 'credit')) AS postedRows,
                    (SELECT COUNT(*) FROM account_entries e WHERE e.source = 'invoice' AND e.source_id = i.id) AS anyRows
             FROM invoices i)
           WHERE (status = 'issued' AND (posted <> hpayable OR postedRows <> 1)) OR (status <> 'issued' AND anyRows > 0) LIMIT 5`,
        );
        checks.push({ code: "invoice:account", name: "Fatura ↔ cari bağı", ok: party.length === 0, count: party.length, sample: party.map(row => `${row.number || row.id} (${row.status}): fatura ${row.hpayable / 100} / cari ${row.posted / 100} (${row.postedRows} satır)`) });
        const orphans = store.all("SELECT e.id FROM account_entries e LEFT JOIN invoices i ON i.id = e.source_id WHERE e.source = 'invoice' AND i.id IS NULL LIMIT 5");
        checks.push({ code: "invoice:orphan", name: "Faturası olmayan cari satırı", ok: orphans.length === 0, count: orphans.length, sample: orphans.map(row => row.id) });
        // v2.0.17: fatura bağı ve mahsup fişi yalnız aynı carinin kesilmiş faturasına; mahsup toplamı faturayı aşmaz.
        if (has("invoice_offsets") && store.all("PRAGMA table_info(account_entries)").some(col => col.name === "invoice_id")) {
          const badLinks = store.all("SELECT e.id FROM account_entries e LEFT JOIN invoices i ON i.id = e.invoice_id WHERE e.invoice_id <> '' AND (i.id IS NULL OR i.status <> 'issued' OR i.account_id <> e.account_id) LIMIT 5");
          const badOffsets = store.all(
            `SELECT o.id FROM invoice_offsets o LEFT JOIN invoices i ON i.id = o.invoice_id
               LEFT JOIN invoices ci ON ci.id = o.counter_id AND o.counter_type = 'invoice' LEFT JOIN account_entries ce ON ce.id = o.counter_id AND o.counter_type = 'entry'
             WHERE i.id IS NULL OR i.status <> 'issued' OR i.account_id <> o.account_id OR (o.counter_type = 'invoice' AND (ci.id IS NULL OR ci.status <> 'issued' OR ci.account_id <> o.account_id))
                OR (o.counter_type = 'entry' AND (ce.id IS NULL OR ce.account_id <> o.account_id)) OR o.amount <= 0 LIMIT 5`,
          );
          const over = store.all(`SELECT i.number FROM invoices i WHERE i.status = 'issued' AND (SELECT COALESCE(SUM(${c("o.amount")}), 0) FROM invoice_offsets o WHERE o.invoice_id = i.id OR (o.counter_type = 'invoice' AND o.counter_id = i.id)) > ${c("i.try_payable")} LIMIT 5`);
          const bad = [...badLinks.map(row => `bağ ${row.id}`), ...badOffsets.map(row => `mahsup ${row.id}`), ...over.map(row => `mahsup toplamı faturayı aşıyor: ${row.number}`)];
          checks.push({ code: "invoice:offset", name: "Fatura kapama bağı ve mahsup fişleri", ok: bad.length === 0, count: bad.length, sample: bad.slice(0, 5) });
        }
      }
      // 4. Stok: kesilmiş faturanın stoklu kalemi kendi hareketine bağlı ve miktarı aynı; taslak/iptal faturanın hareketi yok.
      if (has("stock_moves")) {
        const moves = store.all(
          `SELECT l.id, i.number, l.qty, m.qty AS moved FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id AND i.status = 'issued'
             LEFT JOIN stock_moves m ON m.id = l.move_id AND m.invoice_id = i.id
           WHERE l.move_id <> '' AND (m.id IS NULL OR ABS(m.qty - l.qty) > 0.0005) LIMIT 5`,
        );
        const stray = store.all("SELECT m.id FROM stock_moves m LEFT JOIN invoices i ON i.id = m.invoice_id WHERE m.invoice_id <> '' AND (i.id IS NULL OR i.status <> 'issued') LIMIT 5");
        checks.push({ code: "invoice:stock", name: "Fatura ↔ stok bağı", ok: moves.length + stray.length === 0, count: moves.length + stray.length, sample: [...moves.map(row => `${row.number}: kalem ${row.qty} / hareket ${row.moved ?? "yok"}`), ...stray.map(row => `${row.id}: faturası kesilmiş değil`)] });
      }
      // 5. Çek/senet ve taksit: faturayla açılan evrak/kart yalnız kesilmiş faturada yaşar.
      if (has("cheques")) {
        const stray = store.all("SELECT c.id FROM cheques c LEFT JOIN invoices i ON i.id = c.invoice_id WHERE c.invoice_id <> '' AND c.deleted_at IS NULL AND (i.id IS NULL OR i.status <> 'issued') LIMIT 5");
        checks.push({ code: "invoice:cheque", name: "Fatura ↔ çek/senet bağı", ok: stray.length === 0, count: stray.length, sample: stray.map(row => row.id) });
      }
      if (hasColumn("plans", "invoice_id")) {
        const stray = store.all("SELECT p.id FROM plans p LEFT JOIN invoices i ON i.id = p.invoice_id WHERE p.invoice_id <> '' AND p.deleted_at IS NULL AND (i.id IS NULL OR i.status <> 'issued') LIMIT 5");
        checks.push({ code: "invoice:plan", name: "Fatura ↔ taksit kartı bağı", ok: stray.length === 0, count: stray.length, sample: stray.map(row => row.id) });
      }
      // 6. İade: bir kalemden iade edilen toplam miktar asıl miktarı aşmaz.
      const over = store.all(
        `SELECT o.id, i.number, o.qty, SUM(r.qty) AS returned FROM invoice_lines r JOIN invoices ri ON ri.id = r.invoice_id AND ri.status = 'issued'
           JOIN invoice_lines o ON o.id = r.origin_line_id JOIN invoices i ON i.id = o.invoice_id
         WHERE r.origin_line_id <> '' GROUP BY o.id HAVING SUM(r.qty) > o.qty + 0.0005 LIMIT 5`,
      );
      checks.push({ code: "invoice:returns", name: "İade miktarı ≤ faturadaki miktar", ok: over.length === 0, count: over.length, sample: over.map(row => `${row.number}: ${row.qty} satıldı / ${row.returned} iade`) });
    }
    // Tarih: her para hareketinin tarihi dolu ve geçerli takvim günü; ileri tarihli hareket yok (eski sürümden kalanlar
    // taban sayılır, yenisi eklenemez); taksit vadesi kartın Kayıt Tarihi'nden önce değil.
    const today = period()?.today?.() || now.today();
    for (const table of DATED) {
      if (!hasColumn(table, "date")) continue;
      if (DATED_WHEN_USED.has(table) && !store.get(`SELECT 1 AS found FROM ${table} LIMIT 1`)) continue;
      const bad = store.all(`SELECT id, date FROM ${table} WHERE date IS NULL OR trim(date) = '' OR date NOT GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' OR date(date) IS NULL OR date(date) <> date LIMIT 5`);
      checks.push({ code: `dates:format:${table}`, name: `Tarihsiz ya da geçersiz tarihli hareket (${labelOf(table)})`, ok: bad.length === 0, count: bad.length, sample: bad.map(row => `${row.id}=${row.date}`) });
      // v2.0.26 (A13): açılışta bulunan ileri tarihli satırlar (eski sürümden kalan) kimlikleriyle tabandır; kapının imzası yalnız
      // tabanda olmayan (yeni) ileri tarihli satırları sayar (gateCount). Önceden SAYI imzadaydı: gün geçip eski satır geçmişe
      // düştükçe sayı küçülüyor, imza tabanda olmuyor ve yeniden başlatmaya kadar bütün para işlemleri 409 alıyordu.
      // Gözden geçirme G4: eski satır denetim sonucundan gizlenmez (ok false, count hepsi, legacy eskiler): Mutabakat Testi, Defter
      // Mutabakatı ve Mutabakat Günlüğü'nde görünür; yalnız yeni işlemleri engellemez.
      const known = legacyFuture.get(table);
      const rows = store.all(`SELECT id FROM ${table} WHERE date > ?`, today);
      const fresh = known ? rows.filter(row => !known.has(row.id)).length : rows.length;
      // 2. gözden geçirme İ8: yalnız eski satır kaldıysa düzey uyarı (severity) ve ne yapılacağı (hint); ok yine false (G4: gizlenmez).
      const legacyOnly = rows.length > 0 && fresh === 0;
      checks.push({ code: `dates:future:${table}`, name: `İleri tarihli hareket (${labelOf(table)})`, ok: rows.length === 0, count: rows.length, gateCount: fresh, ...(rows.length > fresh ? { legacy: rows.length - fresh } : {}), ...(legacyOnly ? { severity: "warning", hint: futureHint(table, rows, today) } : {}) });
    }
    {
      const wrong = [];
      let legacy = 0;
      for (const table of METHOD_TABLES) {
        if (!hasColumn(table, "method")) continue;
        for (const row of store.all(`SELECT id, method FROM ${table} WHERE method IS NULL OR method NOT IN ${KNOWN_METHODS}`)) {
          if (legacyMethod.has(`${table}:${row.id}`)) legacy += 1;
          else wrong.push(`${table}:${row.id}=${row.method}`);
        }
      }
      // Gözden geçirme G4: eski sürümden kalan satırlar sonuçta görünür (legacy); kapı yalnız yenilere bakar (gateCount).
      const count = wrong.length + legacy;
      checks.push({ code: "money:method", name: "Tanınmayan ödeme yolu (nakit, havale/EFT, POS/kredi kartı dışında)", ok: count === 0, count, gateCount: wrong.length, ...(legacy ? { legacy } : {}), ...(legacy && !wrong.length ? { severity: "warning" } : {}), sample: wrong.slice(0, 5) });
    }
    if (hasColumn("plan_items", "due_date") && hasColumn("plans", "registered_on")) {
      const early = store.all("SELECT i.id, i.due_date AS due, p.registered_on AS start, p.name FROM plan_items i JOIN plans p ON p.id = i.plan_id AND p.deleted_at IS NULL WHERE p.registered_on <> '' AND i.due_date < p.registered_on LIMIT 5");
      const count = early.length ? store.get("SELECT COUNT(*) AS n FROM plan_items i JOIN plans p ON p.id = i.plan_id AND p.deleted_at IS NULL WHERE p.registered_on <> '' AND i.due_date < p.registered_on").n : 0;
      checks.push({ code: "dates:due-before-start", name: "Kayıt Tarihi'nden önceki taksit vadesi", ok: count === 0, count, sample: early.map(row => `${row.name}: vade ${row.due} < kayıt ${row.start}`) });
    }
    const failures = checks.filter(item => !item.ok);
    return { ok: failures.length === 0, checks, failures, durationMs: Math.round(performance.now() - started) };
  }

  // Açılıştaki ileri tarihli satırların kimlikleri (tablo → Set); start() ölçer (A13).
  let legacyFuture = new Map();
  const measureLegacyFuture = () => {
    const today = period()?.today?.() || now.today();
    const out = new Map();
    for (const table of DATED) if (hasColumn(table, "date")) out.set(table, new Set(store.all(`SELECT id FROM ${table} WHERE date > ?`, today).map(row => row.id)));
    return out;
  };
  // Açılıştaki tanınmayan yollu eski satırlar ("tablo:id"); start() ölçer (B7).
  let legacyMethod = new Set();
  const measureLegacyMethod = () => {
    const out = new Set();
    for (const table of METHOD_TABLES) {
      if (!hasColumn(table, "method")) continue;
      for (const row of store.all(`SELECT id FROM ${table} WHERE method IS NULL OR method NOT IN ${KNOWN_METHODS}`)) out.add(`${table}:${row.id}`);
    }
    return out;
  };
  // Sapmanın kimliği: hangi denetim, ne kadar/kaç satır. Aynı sapma sürüyorsa işlem engellenmez; yenisi ya da büyüyeni engellenir.
  // gateCount (G4): eski sürümden kalan satırları taşıyan denetimlerde kapının saydığı (yeni) satırlar; sonuçta count hepsidir.
  const signature = item => `${item.code}|${roundMoney(item.difference || 0)}|${item.gateCount ?? item.count ?? 0}`;
  let baseline = new Set();
  let pending = null;
  const write = (action, tables, failures) => {
    try {
      store.run(
        "INSERT INTO integrity_log (id, at, action, tables, summary, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
        newId(), now().toISOString(), action, [...tables].join(","), failures.map(item => item.name).join("; ").slice(0, 500), JSON.stringify(failures).slice(0, 20000),
      );
    } catch {
      // Günlük yazılamasa da (eski şema) işlem kararı değişmez.
    }
  };

  const lockDigest = lock => lockDigestOf(store, lock);
  let lockState = { lock: "", digest: "" };
  let pendingLock = null;
  let stop = null;
  // Kapıyı kurar (yeniden çağrılırsa öncekini söküp taban durumu yeniden ölçer).
  function start() {
    stop?.();
    legacyFuture = measureLegacyFuture();
    legacyMethod = measureLegacyMethod();
    const result = run();
    baseline = new Set(result.failures.map(signature));
    const lock = period()?.lockedUntil?.() || "";
    lockState = { lock, digest: lockDigest(lock) };
    if (result.failures.length) {
      log?.warn?.(`Mutabakat: güncelleme öncesinden kalan ${result.failures.length} sapma var (${result.failures.map(item => item.name).join("; ")}). Yeni işlemler bu sapmayı büyütemez.`);
      const last = has("integrity_log") ? store.get("SELECT detail_json AS detail FROM integrity_log WHERE action = 'baseline' ORDER BY at DESC LIMIT 1") : null;
      if (last?.detail !== JSON.stringify(result.failures).slice(0, 20000)) write("baseline", [], result.failures);
    }
    const remove = store.addCommitGuard({
      check({ tables }) {
        const result = run();
        const fresh = result.failures.filter(item => !baseline.has(signature(item)));
        // Kapanmış dönem: kilit aynıyken kilit altındaki satırlar değişmiş olamaz.
        const lock = period()?.lockedUntil?.() || "";
        const digest = lock ? lockDigest(lock) : "";
        if (lock && lock === lockState.lock && digest !== lockState.digest) fresh.push({ code: "period-lock", name: `Kapanmış dönem (${lock} ve öncesi) değişemez`, ok: false, count: 1 });
        pendingLock = { lock, digest };
        if (fresh.length) {
          pending = null;
          throw new IntegrityError(fresh.map(item => ({ ...item, tables: [...tables] })));
        }
        pending = result;
      },
      after() {
        if (pending) baseline = new Set(pending.failures.map(signature));
        if (pendingLock) lockState = pendingLock;
        pending = null;
        pendingLock = null;
      },
      rolledBack({ tables, error }) {
        pending = null;
        if (error instanceof IntegrityError) {
          write("rolled-back", tables, error.failures);
          log?.warn?.(`Mutabakat: işlem geri alındı (${error.failures.map(item => item.name).join("; ")}).`);
        }
      },
    });
    stop = remove;
    return { remove, baseline: result };
  }

  return { run, start, recent: (limit = 200) => (has("integrity_log") ? store.all("SELECT id, at, action, tables, summary, detail_json AS detail FROM integrity_log ORDER BY at DESC LIMIT ?", limit) : []) };
}
