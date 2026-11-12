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
import { CHART } from "../../server/lib/general-ledger.mjs";
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
// 2.4.3 MM9 (uzman mali müşavir; kullanıcı kararı 18.10.2026, bilerek değişen görünüm): Cari Listesi özetinin adları — "Toplam Borç (Anlaşılan)" →
// "Toplam Borç", "Toplam Alacak (Ödenen)" → "Toplam Alacak", "Borçlular" → "Müşteri Alacakları (Borçlu Cariler)", "Alacaklılar" → "Tedarikçi Borçları
// (Alacaklı Cariler)", adsız "Kalan (Borçlu|Alacaklı)" → işaretli "Net Bakiye (Müşteri Alacakları − Tedarikçi Borçları)". Tutarlar aynı; ters dönüşüm
// eski sırayı ve adları kurar (Kalan = |net|, yönü net'in işareti).
export function legacyAccountList(report) {
  const NET = "Net Bakiye (Müşteri Alacakları − Tedarikçi Borçları)";
  if (!report?.summary?.some(([key]) => key === NET)) return report;
  const get = key => report.summary.find(([name]) => name === key)?.[1];
  const net = minorOf(get(NET));
  const side = net > 0 ? "Borçlu" : net < 0 ? "Alacaklı" : "Kapalı";
  const summary = [["Cari", get("Cari")], ["Toplam Borç (Anlaşılan)", get("Toplam Borç")], ["Toplam Alacak (Ödenen)", get("Toplam Alacak")], [`Kalan (${side})`, tlOf(Math.abs(net))], ["Borçlular", get("Müşteri Alacakları (Borçlu Cariler)")], ["Alacaklılar", get("Tedarikçi Borçları (Alacaklı Cariler)")], ["Geciken Taksit", get("Geciken Taksit")]];
  return { ...report, summary };
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
  // 2.4.3 MM3 (bilerek): 689'un adı Tekdüzen adı "Diğer Olağandışı Gider ve Zararlar" (önceden "Kapatılan Kartlardan Vazgeçilen Alacaklar"; gecikme
  // zammı da 689'a yazılır). Tutar ve kod değişmez — iki ad aynı belirtece.
  out = out.split("Kapatılan Kartlardan Vazgeçilen Alacaklar").join("689-AD").split("Diğer Olağandışı Gider ve Zararlar").join("689-AD");
  // 2.5.0 Ç1 (bilerek): 770'in adı Tekdüzen adı "Genel Yönetim Giderleri" (önceden "Genel Giderler ve Alış Faturaları"). Tutar ve kod değişmez — iki ad aynı belirtece.
  out = out.split("Genel Giderler ve Alış Faturaları").join("770-AD").split("Genel Yönetim Giderleri").join("770-AD");
  // 2.5.0 Ç5-A (§2.1, bilerek): 500'ün adı Tek Düzen adı "Sermaye" (önceden "Açılış ve Devir Bakiyeleri") — yalnız TAM ad (JSON değeri, tırnaklı): "Sermaye Yedekleri" vb. dokunulmaz.
  out = out.split('"Açılış ve Devir Bakiyeleri"').join('"500-AD"').split('"Sermaye"').join('"500-AD"');
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

// ---------- 2.5.0 Ç5-A (bilerek değişen defter kuralı; docs/erp/C5-ACILIS-TASARIM.md §2.2–§2.5, §3.1, §12.2) ----------
// Eski sürümün (2.0.x, 2.4.9) olgularıyla karşılaştırmada Ç5-A'nın BİLİNÇLİ farkları MADDE DÜZEYİNDE, karar numarasıyla eski düzene çevrilir — YALNIZ güncel kurallı (canlı)
// bölgedeki maddelerde (kapsam ve bekleyen 2.4.9 koşusunun günü ≤ maddeler donmuş / eski kural: aynen), YALNIZ açılış karşılığı ve carisiz evrak satırlarında, tutar korunarak:
//   K1 (KG-1, M-01 … M-07, S47; 30.10 açılış düzeni): açılış sınıfı maddenin (Kasa, cari işaretli / aday, banka açılış / Devir Kapanışı, stok, Mevcut Borç açılış satırı) 519 satırı → 500;
//   K2 (M-08 / M-09, S48): Excel açılış evrakı — alınan 519 → 602, verilen 519 → 770, karşılıksız 519 → 770;
//   K3 (S49, S66): formdan carisiz evrak — alınan 649.90 → 602, karşılıksız 649.90 → 770, verilen 770.90 → 770;
//   K4 (KG-5 = A, H-06, B5): yüklenen kartın tek maddesi B CH (T − P) / A 519 → eski iki madde B CH T / A 602 ve her açılış satırı B 500 P / A CH (T, P veri tabanından);
//   K4′ (S127 = A): eski yapıya bağlı kartın maddesi B CH T / A 519 → A 602 (açılış satırı K1 ile 500);
//   K5 (§2.1): 500'ün adı "Sermaye" ↔ "Açılış ve Devir Bakiyeleri" (yalnız ad).
// DİŞ (ders 7, 53 (b)): çevirmeden ÖNCE canlı bölgede fiş dışında 500 satırı olmamalı (bir açılış 500'de kalırsa yakalanır); her 519 satırı yukarıdaki kurallardan birine
// uymalı (tahsilat 519'a yazılırsa yakalanır); KG-5 tutarı T − P olmalı; çevirmeden SONRA 519 / 649.90 / 770.90 kalmamalı. Donmuş dönemin "Kural Değişikliği Farkı" (C3 §8) da aynı
// çeviriyle açıklanmalı: güncel türetmenin her maddesi çevrilince donmuş maddeyle (hesap tutarları) aynı. Sorunlar `problems`'da; çağıran testi kırar.
const OPENING_CLASS_C5A = 2;
const freeKind = id => (/^account:free-(in|out|bounce):/.exec(String(id)) || [])[1] || "";
const linesBy = lines => {
  const out = new Map();
  for (const line of lines) out.set(line.account, (out.get(line.account) || 0) + line.debit - line.credit);
  return [...out.entries()].filter(([, value]) => value).sort((a, b) => a[0].localeCompare(b[0]));
};
/**
 * Ç5-A katlaması (madde düzeyinde). ledger: şirketin defter servisi (context.ledger: build(), snapshots.state() / entries()), store: aynı şirketin deposu.
 * Dönüş: { active, delta: Map(hesap → { debit, credit }) (kuruş, eski − yeni; canlı bölge), entryDelta, problems, ruleDiffExplained, frozen }.
 */
export function c5aOpeningFold(ledger, store) {
  const problems = [];
  const state = ledger.snapshots?.state?.() || { coverage: "" };
  const pending = state.pending && (state.pending.rule === "2.4.9" || state.pending.rule === "2.5.0") ? state.pending.through : "";
  const boundary = [state.coverage || "", pending || ""].sort().at(-1);
  const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
  const cards = new Map();
  if (has("plans") && store.all("PRAGMA table_info(plans)").some(column => column.name === "import_id")) {
    for (const row of store.all("SELECT p.id, p.total, a.type FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE p.deleted_at IS NULL AND p.import_id <> '' AND NOT p.covers_balance")) {
      cards.set(row.id, { total: cents(row.total), control: { customer: "120", supplier: "320", other: "336" }[row.type] || (row.type ? "120" : "127"), openings: store.all("SELECT id, amount, date FROM plan_entries WHERE plan_id = ? AND kind = 'in' AND opening = 1 ORDER BY rowid", row.id).map(entry => ({ id: entry.id, amount: cents(entry.amount) })) });
    }
  }
  const chequeFlag = has("cheques") && store.all("PRAGMA table_info(cheques)").some(column => column.name === "is_opening");
  const openingCheque = id => chequeFlag && Number(store.get("SELECT is_opening AS v FROM cheques WHERE id = ?", String(id).replace(/^account:free-(in|out|bounce):/, ""))?.v) === 1;
  /** Güncel kural maddesi → eski düzende maddeler ([{ id, lines }]); kural dışı 519 / 500 satırı sorun. */
  const legacyOf = entry => {
    const voucher = String(entry.id).startsWith("voucher-");
    const opening = entry.cls === OPENING_CLASS_C5A;
    const kind = freeKind(entry.id);
    if (!voucher) for (const line of entry.lines) if (line.account === "500") problems.push(`${entry.id} (${entry.date}): fişsiz 500 satırı — açılış karşı hesabı 519 olmalı (KG-1)`);
    if (String(entry.id).startsWith("plan:") && entry.lines.some(line => line.account === "519")) {
      const card = cards.get(String(entry.id).slice(5));
      const t = card?.total ?? 0;
      const p = (card?.openings || []).reduce((sum, row) => sum + row.amount, 0);
      const ch = entry.lines.find(line => line.account !== "519");
      const amount = entry.lines.filter(line => line.account === "519").reduce((sum, line) => sum + line.credit - line.debit, 0);
      if (!card) {
        problems.push(`${entry.id}: 519'lu kart maddesi yüklenen kart değil`);
        return [{ id: entry.id, lines: entry.lines }];
      }
      // K4′ (S127): kart maddesi TAM tutarla (eski yapı) → yalnız 519 → 602.
      if (amount === t && !opening) return [{ id: entry.id, lines: entry.lines.map(line => (line.account === "519" ? { ...line, account: "602", sub: undefined } : line)) }];
      if (amount !== t - p) problems.push(`${entry.id}: KG-5 tutarı ${amount} ≠ T − P (${t} − ${p})`);
      const party = ch?.party;
      return [
        { id: entry.id, lines: [{ account: card.control, debit: t, credit: 0, ...(party ? { party } : {}) }, { account: "602", debit: 0, credit: t }] },
        ...card.openings.map(row => ({ id: `plan-entry:${row.id}`, lines: [{ account: "500", debit: row.amount, credit: 0 }, { account: card.control, debit: 0, credit: row.amount, ...(party ? { party } : {}) }] })),
      ];
    }
    const lines = entry.lines.map(line => {
      if (kind && line.sub === "649.90") return { ...line, account: kind === "in" ? "602" : "770", sub: undefined };
      if (kind && line.sub === "770.90") return { ...line, sub: undefined };
      if (line.account !== "519") return line;
      // K2 yalnız AÇILIŞ evrakında (cheques.is_opening — giriş / çıkış açılış sınıfında, karşılıksız işarette); açılış olmayan carisiz evrakın 519'u kural dışıdır.
      if (kind && (kind === "bounce" ? openingCheque(entry.id) : opening)) return { ...line, account: kind === "in" ? "602" : "770" };
      if (kind) {
        problems.push(`${entry.id} (${entry.date}): açılış olmayan carisiz evrakta 519 satırı (S49: 649.90 / 770.90 olmalı)`);
        return line;
      }
      if (opening) return { ...line, account: "500" };
      if (!voucher) problems.push(`${entry.id} (${entry.date}): 519 satırı açılış sınıfı dışında (${entry.source || ""})`);
      return line;
    });
    return [{ id: entry.id, lines }];
  };
  const live = ledger.build();
  const delta = new Map();
  let entryDelta = 0;
  const add = (lines, sign) => {
    for (const line of lines) {
      const row = delta.get(line.account) || { debit: 0, credit: 0 };
      row.debit += sign * line.debit;
      row.credit += sign * line.credit;
      delta.set(line.account, row);
    }
  };
  const legacyById = new Map();
  for (const entry of live) {
    const legacy = legacyOf(entry);
    for (const item of legacy) {
      legacyById.set(item.id, { date: entry.date, lines: item.lines });
      for (const line of item.lines) if (line.account === "519" || line.sub === "649.90" || line.sub === "770.90") problems.push(`${item.id}: çevirmeden sonra ${line.sub || line.account} kaldı`);
    }
    if (entry.date <= boundary) continue;
    add(entry.lines, -1);
    for (const item of legacy) add(item.lines, 1);
    entryDelta += legacy.filter(item => item.lines.some(line => line.debit || line.credit)).length - 1;
  }
  for (const [code, row] of delta) if (!row.debit && !row.credit) delta.delete(code);
  // Donmuş dönemin kural farkı (C3 §8 ruleDiff): güncel türetmenin maddesi çevrilince donmuş maddeyle aynı olmalı (yalnız Ç5-A kural kimlikleri).
  let frozen = 0;
  let ruleDiffExplained = true;
  if (state.coverage && ledger.snapshots?.entries) {
    for (const entry of ledger.snapshots.entries({ to: state.coverage })) {
      frozen += 1;
      const legacy = legacyById.get(entry.id);
      const want = JSON.stringify(linesBy(entry.lines));
      const got = legacy ? JSON.stringify(linesBy(legacy.lines)) : JSON.stringify([]);
      if (want !== got) {
        ruleDiffExplained = false;
        problems.push(`kural farkı Ç5-A ile açıklanamadı: ${entry.id} (${entry.date}) donmuş ${want} · güncel (eski düzende) ${got}`);
      }
    }
  }
  return { active: delta.size > 0 || frozen > 0, delta, entryDelta, problems, ruleDiffExplained, frozen, boundary };
}
/** Mizan hesapları (TL; GET ledger `trial.accounts`) Ç5-A katlamasıyla eski düzende (bütün zaman; kod sırası). */
export function c5aTrialAccounts(accounts, fold, names = {}) {
  if (!fold?.delta?.size) return accounts;
  const rows = new Map(accounts.map(row => [String(row.code), { ...row }]));
  const tl = value => Math.round(value) / 100;
  for (const [code, change] of fold.delta) {
    const row = rows.get(code) || { code, name: names[code] || code, opening: 0, debit: 0, credit: 0, balance: 0 };
    row.debit = tl(cents(row.debit) + change.debit);
    row.credit = tl(cents(row.credit) + change.credit);
    row.balance = tl(cents(row.balance) + change.debit - change.credit);
    rows.set(code, row);
  }
  return [...rows.values()].filter(row => cents(row.debit) || cents(row.credit) || cents(row.opening) || cents(row.balance)).sort((a, b) => String(a.code).localeCompare(String(b.code)));
}
/** Hesap Planı Mizanı (bütün zaman) satırları: [kod, ad, devir, borç, alacak, |bakiye|, yön] + TOPLAM / özet. */
export function c5aMizanReport(report, fold, names = {}) {
  if (!fold?.delta?.size) return report;
  const rows = new Map(report.rows.map(row => [String(row[0]), [...row]]));
  let debit = 0;
  let credit = 0;
  for (const [code, change] of fold.delta) {
    const row = rows.get(code) || [code, names[code] || code, tlOf(0), tlOf(0), tlOf(0), tlOf(0), ""];
    const d = minorOf(row[3]) + change.debit;
    const c = minorOf(row[4]) + change.credit;
    const balance = minorOf(row[2]) + d - c;
    rows.set(code, [row[0], row[1], row[2], tlOf(d), tlOf(c), tlOf(Math.abs(balance)), balance > 0 ? "Borç" : balance < 0 ? "Alacak" : ""]);
    debit += change.debit;
    credit += change.credit;
  }
  const list = [...rows.values()].filter(row => !/^\d+$/.test(String(row[0])) || minorOf(row[2]) || minorOf(row[3]) || minorOf(row[4])).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const footer = report.footer ? report.footer.map((cell, index) => (index === 3 ? tlOf(minorOf(cell) + debit) : index === 4 ? tlOf(minorOf(cell) + credit) : cell)) : report.footer;
  const summary = report.summary ? report.summary.map(([key, cell]) => [key, key === "Dönem Borç" ? tlOf(minorOf(cell) + debit) : key === "Dönem Alacak" ? tlOf(minorOf(cell) + credit) : cell]) : report.summary;
  return { ...report, rows: list, total: report.total - (report.rows.length - list.length), footer, summary };
}
// Ç5-A'nın yeni denetimleri (eski sürümde yok): Açılış Karşılığı (B2), kilitsiz geçmiş yıl bilgisi (S53) ve donmuş dönemin kural farkı (C3 §8 — yalnız Ç5-A ile açıklanmışsa).
const C5A_CHECKS = new Set(["opening:519", "opening:500", "ledger:unlocked-years"]);
/** Mutabakat Testi yanıtı (checks / failures / ok): yeni denetimler tamamsa düşülür; kural farkı Ç5-A ile açıklanmışsa düşülür (açıklanmamışsa KALIR — fark görünür). */
export function c5aIntegrity(data, fold) {
  const drop = check => (C5A_CHECKS.has(check.code) && check.ok) || (check.code === "ledger:rule-diff" && fold?.ruleDiffExplained === true);
  const checks = (data.checks || []).filter(check => !drop(check));
  const failures = (data.failures || []).filter(check => !drop(check));
  const removedBlocking = (data.failures || []).filter(drop).length;
  return { ...data, checks, failures, ...(removedBlocking && !failures.some(check => !check.notice) ? { ok: true } : {}) };
}
/** Defter Mutabakatı raporu: Ç5-A'nın yeni denetim satırları ve (açıklanmışsa) kural farkı satırları düşülür; sonuç / alt başlık kalan satırlardan. */
export function c5aReconciliationReport(report, fold) {
  const ruleRow = row => fold?.ruleDiffExplained === true && (/^Kural Değişikliği Farkı/.test(String(row[1])) || /— Kilitli Dönem \(Donmuş Defter \/ Güncel Kural\)$/.test(String(row[1])));
  const newRow = row => row[0] === "Denetim" && (/^Açılış Karşılığı \(/.test(String(row[1])) || /^Kilitlenmemiş Geçmiş Yıl/.test(String(row[1]))) && row[5] === "Tutarlı";
  const rows = report.rows.filter(row => !ruleRow(row) && !newRow(row));
  if (rows.length === report.rows.length) return report;
  const clean = rows.every(row => row[5] === "Tutarlı");
  const summary = report.summary ? report.summary.map(([key, cell]) => [key, key === "Sonuç" && clean ? "Tutarlı" : cell]) : report.summary;
  const subtitle = clean && report.rows.some(ruleRow) ? "Tüm hesaplar tutarlı; borç toplamı alacak toplamına eşit. Her kayıt yazılmadan önce bu denetimden geçer." : report.subtitle;
  return { ...report, rows, total: report.total - (report.rows.length - rows.length), summary, subtitle };
}

/**
 * Seçili şirketin para olguları (API). fold (2.5.0 Ç5-A, isteğe bağlı): c5aOpeningFold(...) — verilirse Ç5-A'nın bilerek değişen defter görünümü eski düzene çevrilir
 * (mizan, Hesap Planı Mizanı, Mutabakat Testi'nin yeni denetimleri); çevirinin bulduğu sorunlar `c5aProblems`'da (çağıran boş olduğunu denetler).
 */
export async function ledgerFacts(api, { fold: foldOf = null } = {}) {
  const rawIntegrity = must(await api.get("/api/workspace/ledger/integrity"), "Mutabakat Testi");
  // Şirket örneği ilk istekte açılır: katlama (işlev verildiyse) ondan SONRA kurulur.
  const fold = typeof foldOf === "function" ? foldOf() : foldOf;
  const integrity = c5aIntegrity(rawIntegrity, fold);
  const rawLedger = must(await api.get("/api/workspace/ledger"), "Ana Defter");
  const debitDelta = fold ? [...fold.delta.values()].reduce((sum, row) => sum + row.debit, 0) : 0;
  const creditDelta = fold ? [...fold.delta.values()].reduce((sum, row) => sum + row.credit, 0) : 0;
  const ledger = fold
    ? { ...rawLedger, trial: { ...rawLedger.trial, accounts: c5aTrialAccounts(rawLedger.trial.accounts, fold, CHART), totals: { ...rawLedger.trial.totals, debit: (cents(rawLedger.trial.totals.debit) + debitDelta) / 100, credit: (cents(rawLedger.trial.totals.credit) + creditDelta) / 100, difference: (cents(rawLedger.trial.totals.difference) + debitDelta - creditDelta) / 100 } } }
    : rawLedger;
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
    const legacy = id === "banka-pos-hareketleri" ? legacyBankPos(report) : id === "cari-listesi" ? legacyAccountList(report) : report;
    // 2.2.0 İz 4.2: senet hesapları (121 / 321) eski düzene katlanır, 101 / 103 adları eski adlar (yukarıda, DOCUMENT_FOLD). TOPLAM satırı (Devir, Borç,
    // Alacak) katlamayla değişmez; satır sayısı (total) katlanmış satırlarındır.
    // 2.5.0 Ç5-A (bilerek; yukarıda c5aOpeningFold): canlı bölgedeki açılış karşılığı ve carisiz evrak satırları eski düzende.
    const c5a = id === "hesap-mizani" ? c5aMizanReport(report, fold, CHART) : report;
    const folded = id === "hesap-mizani" ? foldDocumentRows(id, c5a.rows) : null;
    // 2.4.3 MM3 (bilerek): 689'un adı Tekdüzen Hesap Planı adı "Diğer Olağandışı Gider ve Zararlar" (önceden "Kapatılan Kartlardan Vazgeçilen Alacaklar").
    // 2.5.0 Ç1 (bilerek): 770'in adı Tekdüzen adı "Genel Yönetim Giderleri" (önceden "Genel Giderler ve Alış Faturaları"); kod ve tutarlar aynı.
    const LEGACY_NAMES = {
      649: ["Diğer Olağan Gelir ve Kârlar", "Diğer Olağan Gelirler (Kasaya Elle)"],
      689: ["Diğer Olağandışı Gider ve Zararlar", "Kapatılan Kartlardan Vazgeçilen Alacaklar"],
      770: ["Genel Yönetim Giderleri", "Genel Giderler ve Alış Faturaları"],
      // 2.5.0 Ç5-A (§2.1, bilerek): 500'ün adı Tek Düzen adı "Sermaye" (önceden "Açılış ve Devir Bakiyeleri"); açılışlar 519'a (K1) — kod ve tutar katlamayla.
      500: ["Sermaye", "Açılış ve Devir Bakiyeleri"],
    };
    const rows = folded ? folded.map(row => (LEGACY_NAMES[String(row[0])]?.[0] === row[1] ? [row[0], LEGACY_NAMES[String(row[0])][1], ...row.slice(2)] : row)) : legacy.rows;
    reports[id] = { total: folded ? folded.length : legacy.total, rows: digest(rows), footer: id === "hesap-mizani" ? c5a.footer : legacy.footer, summary: id === "hesap-mizani" ? c5a.summary : legacy.summary };
  }
  const { at, ...overviewLive } = overview;
  const { box, k10 } = await legacyBankBox(api, overview);
  // 2.3.0 İz 1.6 (bilerek): receivable.doubtful / doubtfulCount yeni alan (eski sürüm üretmez, eski veride 0) — özetten düşülür.
  const { doubtful: _doubtful, doubtfulCount: _doubtfulCount, ...receivableStable } = overviewLive.receivable || {};
  const overviewSansDoubtful = overviewLive.receivable ? { ...overviewLive, receivable: receivableStable } : overviewLive;
  const overviewStable = overviewSansDoubtful.cash ? { ...overviewSansDoubtful, cash: { ...overviewSansDoubtful.cash, bank: box } } : overviewSansDoubtful;
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
    // 2.5.0 Ç5-A: katlamanın dişi (fişsiz 500, kural dışı 519, KG-5 tutarı, açıklanamayan kural farkı) — boş olmalı.
    ...(fold ? { c5aProblems: fold.problems.slice(0, 20) } : {}),
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
      // 2.5.0 Ç5-A (bilerek; C3 §8 + C5 §3.1): donmuş dönemin "Kural Değişikliği Farkı" kapının tabanındadır — yalnız o denetimi taşıyan taban kayıtları (çağıran, farkın Ç5-A ile
      // açıklandığını gördüyse düşer).
      ruleDiffBaselines: has ? (() => {
        // Kural farkı denetimini taşıyan ve başka YENİ sapma getirmeyen taban kaydı (öbür kodları daha önceki bir taban kaydında var).
        const seen = new Set();
        let count = 0;
        for (const row of store.all("SELECT detail_json AS detail FROM integrity_log WHERE action = 'baseline' ORDER BY rowid")) {
          let codes = [];
          try {
            codes = JSON.parse(row.detail || "[]").map(item => item.code);
          } catch {
            codes = ["okunamadı"];
          }
          if (codes.includes("ledger:rule-diff") && codes.every(code => code === "ledger:rule-diff" || seen.has(code))) count += 1;
          for (const code of codes) seen.add(code);
        }
        return count;
      })() : 0,
      rolledBack: has ? store.get("SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'rolled-back'").n : 0,
    };
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
