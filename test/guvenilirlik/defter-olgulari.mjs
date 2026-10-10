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

// ---------- 2.1.0 Aşama 14 (bilerek değişen iki görünümün 2.0.26 karşılığı; plan §11.4) ----------
// (1) ANLIK DURUM Banka kutusu (K10): ana değer artık Gerçek Banka; eski "Banka / POS" (havale + POS, hesaba atanmış ya da değil; bugüne kadar
//     bakiye, tüm hareketler, bugün giriş/çıkış) aynı tek kaynağın banka tarafı satırlarından (Kasa ?method=noncash) yeniden kurulur. Kabul (§10.5):
//     Gerçek Banka + Hesabı Atanmamış Eski Hareketler = eski "tüm hareketler" değeri (bankK10'da, testler ayrıca karşılaştırır).
// (2) Banka ve POS Hareketleri (§3.4): iç hareketin (Kasa ↔ Banka, bankalar arası transfer) tutarı Giriş/Çıkış kolonunda değil açıklamada
//     "(Transfer Giriş|Çıkış: …)" ve özette "Transfer Giriş/Çıkış". Ters dönüşüm: tutar kolonuna geri eklenir, özet ve TOPLAM eski tanımla kurulur.
const minorOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Math.round(Number(`${match[2].replace(/\./g, "")}.${match[3]}`) * 100) * (match[1] ? -1 : 1) : 0;
};
const tlOf = minor => {
  const abs = Math.abs(minor);
  return `${minor < 0 ? "-" : ""}${String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${String(abs % 100).padStart(2, "0")} TL`;
};
export function legacyBankPos(report) {
  if (!report?.summary?.some(([key]) => key === "Transfer Giriş" || key === "Transfer Çıkış")) return report;
  const at = header => report.headers.indexOf(header);
  const [note, inIndex, outIndex] = [at("Açıklama"), at("Giriş"), at("Çıkış")];
  const rows = report.rows.map(row => {
    const match = /^(.*) \(Transfer (Giriş|Çıkış): ([^)]+ TL)\)$/.exec(String(row[note] ?? ""));
    if (!match) return row;
    const copy = [...row];
    copy[note] = match[1];
    const index = match[2] === "Giriş" ? inIndex : outIndex;
    copy[index] = tlOf(minorOf(copy[index]) + minorOf(match[3]));
    return copy;
  });
  const value = key => minorOf(report.summary.find(([name]) => name === key)?.[1]);
  const inMinor = value("Dönem Giriş") + value("Transfer Giriş");
  const outMinor = value("Dönem Çıkış") + value("Transfer Çıkış");
  const summary = report.summary.filter(([key]) => key !== "Transfer Giriş" && key !== "Transfer Çıkış").map(([key, cell]) => [key, key === "Dönem Giriş" ? tlOf(inMinor) : key === "Dönem Çıkış" ? tlOf(outMinor) : key === "Dönem Net" ? tlOf(inMinor - outMinor) : cell]);
  const footer = report.footer ? report.footer.map((cell, index) => (index === inIndex ? tlOf(rows.reduce((sum, row) => sum + minorOf(row[inIndex]), 0)) : index === outIndex ? tlOf(rows.reduce((sum, row) => sum + minorOf(row[outIndex]), 0)) : cell)) : report.footer;
  return { ...report, rows, summary, footer };
}
/** ANLIK DURUM'un 2.0.26 biçimindeki "Banka / POS" kutusu (aynı satırlardan) ve K10 alanları. */
export async function legacyBankBox(api, overview) {
  const bank = overview?.cash?.bank;
  if (!bank?.labels) return { box: bank, k10: null };
  const noncash = must(await api.get("/api/workspace/cash?method=noncash"), "Kasa (banka tarafı)");
  const day = overview.today;
  let all = 0;
  let upTo = 0;
  let todayIn = 0;
  let todayOut = 0;
  for (const entry of noncash.entries) {
    const minor = cents(entry.amount);
    const signed = entry.kind === "in" ? minor : -minor;
    all += signed;
    if (entry.date <= day) upTo += signed;
    if (entry.date === day) {
      if (entry.kind === "in") todayIn += minor;
      else todayOut += minor;
    }
  }
  return {
    box: { balance: upTo / 100, allEntries: all / 100, today: { in: todayIn / 100, out: todayOut / 100 } },
    // unassigned: bugüne kadarki Hesabı Atanmamış (2.1.0 temel sürüm); unassignedFuture: eski sürümden kalan ileri tarihli bağsız satırlar (ayrı).
    k10: { defined: bank.defined, realBank: cents(bank.balance), unassigned: cents(bank.unassigned?.total), unassignedFuture: cents(bank.unassigned?.future?.total), debt: cents(bank.debt?.total), legacyAll: all },
  };
}

/**
 * (3) Nakit Akış başlangıcı (K10, plan §8.9 / karar 32; 2.1.0 temel sürüm, bilerek): yeni başlangıç = Nakit Kasa + Gerçek Banka; 2.0.26'nın
 * başlangıcı bugüne kadarki bütün yollardı (nakit + havale + POS, hesaba atanmış ya da değil). Yeni yanıt 2.0.26 karşılığına aynı satırlardan
 * çevrilir: fark = bugüne kadarki banka tarafı (Kasa ?method=noncash) − Gerçek Banka. Başlangıç, bakiye sütunu, günler, en düşük ve dönem sonu bu
 * farkla kayar (projeksiyonun sırası ve en düşük gün kaymayla değişmez); yeni "start" kırılımı atılır. Dönüş: { flow, problem } — problem: yeni
 * başlangıç kendi kırılımına (Nakit + Gerçek Banka) eşit değilse.
 */
export async function legacyCashFlow(api, flow) {
  if (!flow?.start) return { flow, problem: "" };
  const start = flow.start;
  const problem = cents(flow.cashToday) === cents(start.cash) + cents(start.realBank ?? 0) || start.realBank === null ? "" : `K10 Nakit Akış: başlangıç ${flow.cashToday} ≠ Nakit ${start.cash} + Gerçek Banka ${start.realBank}`;
  const noncash = must(await api.get("/api/workspace/cash?method=noncash"), "Kasa (banka tarafı)");
  let upTo = 0;
  for (const entry of noncash.entries) if (entry.date <= flow.today) upTo += (entry.kind === "in" ? 1 : -1) * cents(entry.amount);
  const delta = start.realBank === null || start.realBank === undefined ? 0 : upTo - cents(start.realBank);
  const shift = value => (Math.round(cents(value) + delta) / 100);
  const { start: _drop, ...rest } = flow;
  const lowest = { ...flow.lowest, balance: shift(flow.lowest.balance) };
  return {
    flow: {
      ...rest,
      cashToday: shift(flow.cashToday),
      opening: shift(flow.opening),
      closing: shift(flow.closing),
      rows: flow.rows.map(row => ({ ...row, balance: shift(row.balance) })),
      days: flow.days.map(day => ({ ...day, balance: shift(day.balance) })),
      lowest,
      negative: lowest.balance < -0.005,
      ...(flow.periods ? { periods: flow.periods.map(period => ({ ...period, closing: shift(period.closing) })) } : {}),
    },
    problem,
  };
}

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
    const legacy = id === "banka-pos-hareketleri" ? legacyBankPos(report) : report;
    const rows = id === "hesap-mizani" ? report.rows.map(row => (String(row[0]) === "649" && row[1] === "Diğer Olağan Gelir ve Kârlar" ? [row[0], "Diğer Olağan Gelirler (Kasaya Elle)", ...row.slice(2)] : row)) : legacy.rows;
    reports[id] = { total: legacy.total, rows: digest(rows), footer: legacy.footer, summary: legacy.summary };
  }
  const { at, ...overviewLive } = overview;
  const { box, k10 } = await legacyBankBox(api, overview);
  const overviewStable = overviewLive.cash ? { ...overviewLive, cash: { ...overviewLive.cash, bank: box } } : overviewLive;
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
    bankK10: k10,
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
