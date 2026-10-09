// Para defterinin sürümden bağımsız "olguları" (2.1.0 banka göçü, docs/BANKA-MODULU-PLAN.md §10.5, K11). v20 göçünden ÖNCE
// (2.0.26'nın GERÇEK koduyla, fikstürün "oncesi" alanı: tools/surum-verisi.mjs --oncesi) ve SONRA (güncel kod) aynı API'lerden
// okunur ve birebir karşılaştırılır:
//   - kapı imzası: Mutabakat Testi'nin sapmaları (kod | fark | sayı | kapının saydığı | eski satır) — kapının "taban"ı budur;
//   - mizan (hesap planı, kuruş) ve defter mutabakatı (ana defter ↔ alt defter);
//   - Kasa (nakit pencere satırları ve tüm yollar), ANLIK DURUM'un para kutuları, cari bakiyeleri, faturaların ödeme durumu;
//   - Banka ve POS Hareketleri, Kasa Hareketleri, Hesap Planı Mizanı, Cari Listesi, Açık Faturalar raporları (satır, toplam, özet);
//   - kilit izi (lockDigestOf; kilit tarihinde ve bütün tarihler için) — veri dosyasından.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createStore } from "../../server/lib/db.mjs";
import { apiFacts } from "./olgular.mjs";

const cents = value => Math.round(Number(value || 0) * 100);
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
const must = (response, what) => {
  if (response.status !== 200) throw new Error(`${what}: ${response.status} ${JSON.stringify(response.data).slice(0, 300)}`);
  return response.data;
};
const REPORTS = ["kasa-hareketleri", "banka-pos-hareketleri", "hesap-mizani", "cari-listesi", "acik-faturalar"];

/** Seçili şirketin para olguları (API). */
export async function ledgerFacts(api) {
  const integrity = must(await api.get("/api/workspace/ledger/integrity"), "Mutabakat Testi");
  const ledger = must(await api.get("/api/workspace/ledger"), "Ana Defter");
  const lock = must(await api.get("/api/workspace/ledger/lock"), "dönem kilidi");
  const cashAll = must(await api.get("/api/workspace/cash?method=all"), "Kasa (tüm yollar)");
  const cash = must(await api.get("/api/workspace/cash"), "Kasa penceresi");
  const overview = must(await api.get("/api/workspace/overview"), "ANLIK DURUM");
  const invoices = must(await api.get("/api/workspace/invoices?tab=all&limit=5000"), "faturalar");
  const rows = list => list.map(entry => [entry.source || "", entry.id, entry.kind, cents(entry.amount), entry.date, entry.method, cents(entry.balance)].join("|"));
  const reports = {};
  for (const id of REPORTS) {
    const report = must(await api.get(`/api/workspace/report-center/${id}?from=2000-01-01&to=2099-12-31`), `rapor ${id}`);
    // 2.1.0 Aşama 4 (plan §3.11, bilerek): 649'un adı "Diğer Olağan Gelirler (Kasaya Elle)" → "Diğer Olağan Gelir ve Kârlar" (Banka Fişi
    // de 649'a yazar). Ad sürümden bağımsız olgu değildir: yeni ad eski ada çevrilir (fikstürlerdeki "öncesi" olguları 2.0.26 adıyla saklı);
    // hesap kodu, tutarlar ve satır sırası birebir karşılaştırılır.
    const rows = id === "hesap-mizani" ? report.rows.map(row => (String(row[0]) === "649" && row[1] === "Diğer Olağan Gelir ve Kârlar" ? [row[0], "Diğer Olağan Gelirler (Kasaya Elle)", ...row.slice(2)] : row)) : report.rows;
    reports[id] = { total: report.total, rows: digest(rows), footer: report.footer, summary: report.summary };
  }
  const { at, ...overviewStable } = overview;
  return {
    today: lock.today,
    lockedUntil: lock.lockedUntil || "",
    integrity: integrity.failures.map(item => [item.code, cents(item.difference), item.count ?? 0, item.gateCount ?? "", item.legacy ?? 0].join("|")).sort(),
    checksOk: integrity.checks.filter(item => item.ok).map(item => item.code).sort(),
    trial: ledger.trial.accounts.map(item => [item.code, cents(item.debit), cents(item.credit), cents(item.balance)].join("|")).sort(),
    trialTotals: [cents(ledger.trial.totals.debit), cents(ledger.trial.totals.credit), cents(ledger.trial.totals.difference)],
    reconciliation: ledger.reconciliation.checks.map(item => [item.code, cents(item.ledger), cents(item.subledger), item.ok].join("|")).sort(),
    cash: { totals: cashAll.totals, byMethod: cashAll.byMethod, all: digest(rows(cashAll.entries)), window: digest(rows(cash.entries)), windowCount: cash.entries.length, windowTotals: cash.totals },
    overview: digest(overviewStable),
    overviewCash: overviewStable.cash,
    accounts: (await apiFacts(api)).accounts,
    invoices: digest(invoices.invoices.map(item => [item.id, item.kind, item.status, item.number, item.issueDate, item.accountId, cents(item.payableTotal), cents(item.tryPayable), item.payState, cents(item.paid), cents(item.open)].join("|")).sort()),
    invoiceCount: invoices.invoices.length,
    reports,
  };
}

/** Veri dosyasının (kopyasının) kilit izi ve mutabakat günlüğündeki taban kayıt sayısı. lockDigestOf güncel koddan verilir. */
export function fileFacts(file, lockDigestOf) {
  const dir = mkdtempSync(path.join(tmpdir(), "defter-olgu-"));
  const copy = path.join(dir, "kopya.sqlite");
  copyFileSync(file, copy);
  if (existsSync(`${file}-wal`)) copyFileSync(`${file}-wal`, `${copy}-wal`);
  const db = new DatabaseSync(copy);
  try {
    const store = createStore(db);
    const lock = store.setting("ledger.lockedUntil", "") || "";
    const has = Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'integrity_log'"));
    return {
      version: store.get("PRAGMA user_version").user_version,
      lock,
      lockAll: lockDigestOf(store, "9999-12-31"),
      lockAt: lock ? lockDigestOf(store, lock) : "",
      baselines: has ? store.get("SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'baseline'").n : 0,
      rolledBack: has ? store.get("SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'rolled-back'").n : 0,
    };
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
