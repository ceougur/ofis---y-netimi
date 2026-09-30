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
// Sapma bulunursa işlem ROLLBACK edilir (hiçbir satırı diske yazılmaz), kullanıcıya nedeni söylenir (409) ve
// integrity_log'a yazılır.
//
// Eski veri: güncellemeden önce oluşmuş bir sapma (ör. eski sürümde kalmış kuruş farkı) açılışta bulunur ve günlüğe
// "baseline" olarak yazılır; o sapma yüzünden ilgisiz işlemler engellenmez. Kural: hiçbir işlem YENİ bir sapma
// eklemez ve var olanı büyütemez (denetim her işlemde "işlem öncesi durum" ile karşılaştırır).
import { HttpError } from "./http.mjs";
import { roundMoney } from "./money.mjs";

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
export function createIntegrity({ store, ledger, log = null, newId = () => `int-${crypto.randomUUID()}` }) {
  const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
  const hasColumn = (table, column) => has(table) && store.all(`PRAGMA table_info(${table})`).some(row => row.name === column);

  /** Tüm denetimler; her biri { code, name, ok, difference?, count?, sample? }. */
  function run() {
    const started = performance.now();
    const checks = [];
    const service = ledger();
    if (service?.check) {
      const { reconciliation } = service.check();
      checks.push({ code: "balance", name: "Çift yönlü kayıt (borç = alacak)", ok: reconciliation.balanced, difference: 0 });
      for (const item of reconciliation.checks) checks.push({ code: `gl:${item.code}`, name: `${item.code} ${item.name}`, ok: item.ok, difference: item.difference, ledger: item.ledger, subledger: item.subledger });
    }
    // Kuruş ve işaret: 12,345 TL ya da −5 TL gibi tutar yok.
    for (const [table, column, where] of AMOUNT_COLUMNS) {
      if (!hasColumn(table, column)) continue;
      const rows = store.all(`SELECT id, ${column} AS amount FROM ${table} WHERE (ABS(${column} * 100 - ROUND(${column} * 100)) > 0.0001 OR ${column} < 0)${where ? ` AND ${where}` : ""} LIMIT 5`);
      checks.push({ code: `cents:${table}`, name: `Kuruş ve işaret (${table})`, ok: rows.length === 0, count: rows.length, sample: rows.map(row => `${row.id}=${row.amount}`) });
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
    const failures = checks.filter(item => !item.ok);
    return { ok: failures.length === 0, checks, failures, durationMs: Math.round(performance.now() - started) };
  }

  // Sapmanın kimliği: hangi denetim, ne kadar/kaç satır. Aynı sapma sürüyorsa işlem engellenmez; yenisi ya da büyüyeni engellenir.
  const signature = item => `${item.code}|${roundMoney(item.difference || 0)}|${item.count || 0}`;
  let baseline = new Set();
  let pending = null;
  const write = (action, tables, failures) => {
    try {
      store.run(
        "INSERT INTO integrity_log (id, at, action, tables, summary, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
        newId(), new Date().toISOString(), action, [...tables].join(","), failures.map(item => item.name).join("; ").slice(0, 500), JSON.stringify(failures).slice(0, 20000),
      );
    } catch {
      // Günlük yazılamasa da (eski şema) işlem kararı değişmez.
    }
  };

  let stop = null;
  // Kapıyı kurar (yeniden çağrılırsa öncekini söküp taban durumu yeniden ölçer).
  function start() {
    stop?.();
    const result = run();
    baseline = new Set(result.failures.map(signature));
    if (result.failures.length) {
      log?.warn?.(`Mutabakat: güncelleme öncesinden kalan ${result.failures.length} sapma var (${result.failures.map(item => item.name).join("; ")}). Yeni işlemler bu sapmayı büyütemez.`);
      const last = has("integrity_log") ? store.get("SELECT detail_json AS detail FROM integrity_log WHERE action = 'baseline' ORDER BY at DESC LIMIT 1") : null;
      if (last?.detail !== JSON.stringify(result.failures).slice(0, 20000)) write("baseline", [], result.failures);
    }
    const remove = store.addCommitGuard({
      check({ tables }) {
        const result = run();
        const fresh = result.failures.filter(item => !baseline.has(signature(item)));
        if (fresh.length) {
          pending = null;
          throw new IntegrityError(fresh.map(item => ({ ...item, tables: [...tables] })));
        }
        pending = result;
      },
      after() {
        if (pending) baseline = new Set(pending.failures.map(signature));
        pending = null;
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
