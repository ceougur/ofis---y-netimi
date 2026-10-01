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
import { createHash } from "node:crypto";
import { HttpError } from "./http.mjs";
import { partyBalances } from "./general-ledger.mjs";
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
const DATED = ["payments", "cash_entries", "account_entries", "stock_moves", "plan_entries"];
// Kapanmış dönemin parmak izi: kilit tarihi ve öncesindeki her para satırı (tutar, yön, yol, tarih, cari/kalem bağı) ve
// o dönemde cariye borç yazan kartlar. Kilit altındaki tek bir satır değişirse, silinirse ya da eklenirse iz değişir.
const LOCK_SQL = {
  payments: "SELECT id, amount, date, method FROM payments WHERE date <= ? ORDER BY id",
  cash_entries: "SELECT id, kind, amount, date, method FROM cash_entries WHERE date <= ? ORDER BY id",
  account_entries: "SELECT id, account_id, kind, amount, date, method FROM account_entries WHERE date <= ? ORDER BY id",
  stock_moves: "SELECT id, item_id, kind, qty, amount, date, pay, method, account_id FROM stock_moves WHERE date <= ? ORDER BY id",
  plan_entries: "SELECT id, plan_id, kind, amount, date, method FROM plan_entries WHERE date <= ? ORDER BY id",
  plans: "SELECT id, total, account_id, registered_on FROM plans WHERE deleted_at IS NULL AND covers_balance = 0 AND registered_on <> '' AND registered_on <= ? ORDER BY id",
};

export function createIntegrity({ store, ledger, accounts = () => null, stock = () => null, plans = () => null, period = () => null, log = null, newId = () => `int-${crypto.randomUUID()}` }) {
  const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
  const hasColumn = (table, column) => has(table) && store.all(`PRAGMA table_info(${table})`).some(row => row.name === column);

  /** Tüm denetimler; her biri { code, name, ok, difference?, count?, sample? }. */
  function run() {
    const started = performance.now();
    const checks = [];
    const service = ledger();
    if (service?.check) {
      const { reconciliation, entries } = service.check();
      checks.push({ code: "balance", name: "Çift yönlü kayıt (borç = alacak)", ok: reconciliation.balanced, difference: 0 });
      for (const item of reconciliation.checks) checks.push({ code: `gl:${item.code}`, name: `${item.code} ${item.name}`, ok: item.ok, difference: item.difference, ledger: item.ledger, subledger: item.subledger });
      // Cari bazında: her carinin ana defterdeki bakiyesi = cari kartındaki bakiye (toplamlar tutup kişiler arasında
      // kayma olmasın). Carisiz taksit kartları da kart bazında: kalan alacak = kart tutarı − net tahsilat.
      const parties = partyBalances(entries);
      const list = accounts()?.list ? accounts().list(AUDITOR, { status: "all" }).accounts : null;
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
    // Tarih: her para hareketinin tarihi dolu ve geçerli takvim günü; ileri tarihli hareket yok (eski sürümden kalanlar
    // taban sayılır, yenisi eklenemez); taksit vadesi kartın Kayıt Tarihi'nden önce değil.
    const today = period()?.today?.() || new Date().toISOString().slice(0, 10);
    for (const table of DATED) {
      if (!hasColumn(table, "date")) continue;
      const bad = store.all(`SELECT id, date FROM ${table} WHERE date IS NULL OR trim(date) = '' OR date NOT GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' OR date(date) IS NULL OR date(date) <> date LIMIT 5`);
      checks.push({ code: `dates:format:${table}`, name: `Tarihsiz ya da geçersiz tarihli hareket (${table})`, ok: bad.length === 0, count: bad.length, sample: bad.map(row => `${row.id}=${row.date}`) });
      const future = store.get(`SELECT COUNT(*) AS n FROM ${table} WHERE date > ?`, today).n;
      checks.push({ code: `dates:future:${table}`, name: `İleri tarihli hareket (${table})`, ok: future === 0, count: future });
    }
    if (hasColumn("plan_items", "due_date") && hasColumn("plans", "registered_on")) {
      const early = store.all("SELECT i.id, i.due_date AS due, p.registered_on AS start, p.name FROM plan_items i JOIN plans p ON p.id = i.plan_id AND p.deleted_at IS NULL WHERE p.registered_on <> '' AND i.due_date < p.registered_on LIMIT 5");
      const count = early.length ? store.get("SELECT COUNT(*) AS n FROM plan_items i JOIN plans p ON p.id = i.plan_id AND p.deleted_at IS NULL WHERE p.registered_on <> '' AND i.due_date < p.registered_on").n : 0;
      checks.push({ code: "dates:due-before-start", name: "Kayıt Tarihi'nden önceki taksit vadesi", ok: count === 0, count, sample: early.map(row => `${row.name}: vade ${row.due} < kayıt ${row.start}`) });
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

  const lockDigest = lock => {
    if (!lock) return "";
    const hash = createHash("sha256");
    for (const [table, sql] of Object.entries(LOCK_SQL)) {
      if (!has(table)) continue;
      for (const row of store.all(sql, lock)) hash.update(`${table}|${Object.values(row).join("|")}\n`);
    }
    return hash.digest("hex");
  };
  let lockState = { lock: "", digest: "" };
  let pendingLock = null;
  let stop = null;
  // Kapıyı kurar (yeniden çağrılırsa öncekini söküp taban durumu yeniden ölçer).
  function start() {
    stop?.();
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
