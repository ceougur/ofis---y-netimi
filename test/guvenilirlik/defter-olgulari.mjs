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

// ---------- 2.2.0 İz 4.2 (bilerek değişen görünüm; docs/BANKA-MODULU-PLAN.md §3.11a, §11.4) ----------
// Senetler Tekdüzen hesaplarında: alınan senet 121 Alacak Senetleri (121.01 / 121.02), verilen senet 321 Borç Senetleri — önceden çekle birlikte
// 101 / 103; 101 ve 103 Tekdüzen adlarını aldı. Eski sürümün (2.0.26, 2.1.0) olgularıyla karşılaştırmada yeni görünüm ESKİ DÜZENE çevrilir:
// 121 → 101, 321 → 103 katlanır (mizanda borç, alacak, bakiye; mutabakatta ana defter, alt defter, fark toplanır; tutarlı = ikisi de tutarlı) ve
// 101 / 103 adları eski adlara döner. Katlama yalnız TOPLAMI karşılaştırır (eşdeğerlik: 101 + 121 = eski 101, 103 + 321 = eski 103); senedin
// 121/321'de, çekin 101/103'te olduğu ham tablodan ayrıca denetlenir (test/banka-220-senet-121.test.mjs).
export const DOCUMENT_FOLD = Object.freeze({ 121: "101", 321: "103" });
export const DOCUMENT_NAMES = Object.freeze({
  101: Object.freeze({ legacy: "Alınan Çekler ve Senetler (Portföy)", current: "Alınan Çekler" }),
  103: Object.freeze({ legacy: "Verilen Çekler ve Senetler", current: "Verilen Çekler ve Ödeme Emirleri (−)" }),
});
const foldCode = code => DOCUMENT_FOLD[String(code)] || String(code);
const foldGateCode = code => (/^gl:\d+$/.test(code) ? `gl:${foldCode(code.slice(3))}` : code);
/** Metin/JSON'da 101 ve 103'ün eski ve yeni adı aynı belirtece döner (önce uzun eski ad: yeni ad onun ön eki olabilir). */
export function normDocumentNames(text) {
  let out = String(text);
  for (const [code, { legacy, current }] of Object.entries(DOCUMENT_NAMES)) out = out.split(legacy).join(`${code}-AD`).split(current).join(`${code}-AD`);
  return out;
}
/** Mizan hesapları (TL): 121 → 101, 321 → 103 katlanır; ad eski ad. Dönüş aynı biçim (TL), kod sırasıyla. */
export function foldTrialAccounts(accounts) {
  const out = new Map();
  for (const row of accounts) {
    const code = foldCode(row.code);
    const was = out.get(code) || { ...row, code, opening: 0, debit: 0, credit: 0, balance: 0 };
    for (const key of ["opening", "debit", "credit", "balance"]) was[key] = (Math.round(Number(was[key] || 0) * 100) + Math.round(Number(row[key] || 0) * 100)) / 100;
    if (DOCUMENT_NAMES[code]) was.name = DOCUMENT_NAMES[code].legacy;
    out.set(code, was);
  }
  return [...out.values()].sort((a, b) => String(a.code).localeCompare(String(b.code)));
}
/** Defter mutabakatı denetimleri ({ code, name, ledger, subledger, difference, ok }): 121 → 101, 321 → 103. */
export function foldReconciliation(checks) {
  const out = new Map();
  for (const check of checks) {
    const code = foldCode(check.code);
    const was = out.get(code);
    const sum = (a, b) => (Math.round(Number(a || 0) * 100) + Math.round(Number(b || 0) * 100)) / 100;
    out.set(code, was ? { ...was, ledger: sum(was.ledger, check.ledger), subledger: sum(was.subledger, check.subledger), difference: sum(was.difference, check.difference), ok: was.ok && check.ok } : { ...check, code, ...(DOCUMENT_NAMES[code] ? { name: DOCUMENT_NAMES[code].legacy } : {}) });
  }
  return [...out.values()];
}
/** Mutabakat Testi denetimleri ({ code, name, ok, difference?, count?, ledger?, subledger? }): gl:121 → gl:101, gl:321 → gl:103. */
export function foldIntegrityChecks(checks) {
  // Yalnız gl:121 / gl:321 katlanır; öbür denetimler (aynı kodla birden çok olanlar dahil: cents:invoices) olduğu gibi kalır.
  const out = [];
  const at = new Map();
  const sum = (a, b) => (a === undefined && b === undefined ? undefined : (Math.round(Number(a || 0) * 100) + Math.round(Number(b || 0) * 100)) / 100);
  for (const check of checks) {
    const code = foldGateCode(check.code);
    const legacy = code.startsWith("gl:") ? DOCUMENT_NAMES[code.slice(3)] : null;
    if (!legacy) {
      out.push(check);
      continue;
    }
    if (!at.has(code)) {
      at.set(code, out.length);
      out.push({ ...check, code, name: `${code.slice(3)} ${legacy.legacy}` });
      continue;
    }
    const was = out[at.get(code)];
    out[at.get(code)] = { ...was, ok: was.ok && check.ok, difference: sum(was.difference, check.difference), ledger: sum(was.ledger, check.ledger), subledger: sum(was.subledger, check.subledger), ...(was.count !== undefined || check.count !== undefined ? { count: (was.count || 0) + (check.count || 0) } : {}) };
  }
  return out;
}
/** Rapor satırları (Hesap Planı Mizanı: [kod, ad, devir, borç, alacak, |bakiye|, yön]; Defter Mutabakatı: [kod, ad, ana, alt, fark, durum]). */
export function foldDocumentRows(id, rows) {
  if (id !== "hesap-mizani" && id !== "defter-mutabakati") return rows;
  const out = [];
  const at = new Map();
  for (const row of rows) {
    const code = foldCode(row[0]);
    const legacy = DOCUMENT_NAMES[code]?.legacy;
    if (!at.has(code) || !/^\d+$/.test(code)) {
      if (/^\d+$/.test(code)) at.set(code, out.length);
      out.push([code, legacy || row[1], ...row.slice(2)]);
      continue;
    }
    const was = out[at.get(code)];
    if (id === "hesap-mizani") {
      const signed = cells => (cells[6] === "Alacak" ? -1 : 1) * minorOf(cells[5]);
      const balance = signed(was) + signed(row);
      out[at.get(code)] = [code, legacy || was[1], tlOf(minorOf(was[2]) + minorOf(row[2])), tlOf(minorOf(was[3]) + minorOf(row[3])), tlOf(minorOf(was[4]) + minorOf(row[4])), tlOf(Math.abs(balance)), balance > 0 ? "Borç" : balance < 0 ? "Alacak" : ""];
    } else {
      out[at.get(code)] = [code, legacy || was[1], tlOf(minorOf(was[2]) + minorOf(row[2])), tlOf(minorOf(was[3]) + minorOf(row[3])), tlOf(minorOf(was[4]) + minorOf(row[4])), was[5] === "Tutarlı" && row[5] === "Tutarlı" ? "Tutarlı" : "Fark Var"];
    }
  }
  return out;
}
/** Yeni görünümde senet hesabı (121 / 321) satırı var mı (rapor satırı ya da mizan hesabı)? */
export const hasDocumentSplit = codes => codes.some(code => Object.hasOwn(DOCUMENT_FOLD, String(code)));

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
    // 2.2.0 İz 4.2: senet hesapları (121 / 321) eski düzene katlanır, 101 / 103 adları eski adlar (yukarıda, DOCUMENT_FOLD). TOPLAM satırı (Devir, Borç,
    // Alacak) katlamayla değişmez; satır sayısı (total) katlanmış satırlarındır.
    const folded = id === "hesap-mizani" ? foldDocumentRows(id, report.rows) : null;
    const rows = folded ? folded.map(row => (String(row[0]) === "649" && row[1] === "Diğer Olağan Gelir ve Kârlar" ? [row[0], "Diğer Olağan Gelirler (Kasaya Elle)", ...row.slice(2)] : row)) : legacy.rows;
    reports[id] = { total: folded ? folded.length : legacy.total, rows: digest(rows), footer: legacy.footer, summary: legacy.summary };
  }
  const { at, ...overviewLive } = overview;
  const { box, k10 } = await legacyBankBox(api, overview);
  const overviewStable = overviewLive.cash ? { ...overviewLive, cash: { ...overviewLive.cash, bank: box } } : overviewLive;
  return {
    today: lock.today,
    lockedUntil: lock.lockedUntil || "",
    // 2.2.0 İz 4.2: 121 → 101, 321 → 103 (eski düzen; yukarıda). Ayrı senet hesapları documentSplit'te (yeni kodun kendi görünümü).
    integrity: foldIntegrityChecks(integrity.failures).map(item => [item.code, cents(item.difference), item.count ?? 0, item.gateCount ?? "", item.legacy ?? 0].join("|")).sort(),
    checksOk: foldIntegrityChecks(integrity.checks).filter(item => item.ok).map(item => item.code).sort(),
    trial: foldTrialAccounts(ledger.trial.accounts).map(item => [item.code, cents(item.debit), cents(item.credit), cents(item.balance)].join("|")).sort(),
    trialTotals: [cents(ledger.trial.totals.debit), cents(ledger.trial.totals.credit), cents(ledger.trial.totals.difference)],
    reconciliation: foldReconciliation(ledger.reconciliation.checks).map(item => [item.code, cents(item.ledger), cents(item.subledger), item.ok].join("|")).sort(),
    documentSplit: Object.fromEntries(ledger.trial.accounts.filter(item => ["101", "103", "121", "321"].includes(String(item.code))).map(item => [item.code, cents(item.balance)])),
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
    // 2.2.0 İz 4.2: kilit izinin evrak türü girdisi (cheques_instrument_lock, "since 2.2.0"; senedi olan veride satır üretir) sürüme bağlıdır —
    // saklanan 2.0.26 iziyle karşılaştırma 2.1.0'ın iz tanımıyla yapılır (eski sürümün lockDigestOf'u üçüncü bağımsız değişkeni tanımaz, yok sayar).
    const trail = { version: "2.1.0" };
    return {
      version: store.get("PRAGMA user_version").user_version,
      lock,
      lockAll: lockDigestOf(store, "9999-12-31", trail),
      lockAt: lock ? lockDigestOf(store, lock, trail) : "",
      baselines: has ? store.get("SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'baseline'").n : 0,
      rolledBack: has ? store.get("SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'rolled-back'").n : 0,
    };
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
