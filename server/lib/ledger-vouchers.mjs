// Saklanan fiş defteri (2.5.0 Ç2; docs/erp/C2-FIS-DEFTERI-TASARIM.md, docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md §3; kural kitabı G-4, G-6, R-03).
//
// Ana Defter alt defterlerden her seferinde türetilir (lib/general-ledger.mjs); bu modül türetilemeyen maddeleri — dönem sonu kapanışı, devir açılışı, açılış
// eşleştirmesi, önceki yıl sonucu, kural farkı düzeltmesi ve bunların ters kayıtları — SATIRLARIYLA saklar (bank_lines gibi). journal() bu satırları aynen alır.
// Fişleri Ç3 (dondurma), Ç5 (Açılış Eşleştirme Fişi, Kural Farkı Düzeltme Fişi) ve D4 (devir kapanış / açılış) bu iç API ile yazar. Kullanıcıya serbest fiş girişi
// YOK (2.5.1). HTTP uçları (routes/ledger.mjs) yalnız liste ve ters kayıttır, dönem kilidini koyabilen yetkiyle (system.manage).
//
// DEĞİŞMEZLER (kural kitabı G-6):
//   - Fiş başına Σ borç = Σ alacak > 0; her satır tek taraflı ve sıfırdan büyük (kuruş tamsayısı); en az iki satır; hesap Ç1 hesap planında (ACCOUNT_PLAN).
//   - Fiş tek işlemde (store.tx) yazılır: başlık + satırlar + iz (audit_events) birlikte; yarım fiş olmaz. Denetimden eklemeye kadar olay döngüsüne sıra verilmez
//     (bütün yol eşzamanlı; ders 47).
//   - Değiştirilemez, silinemez (göç 46 tetikleyicileri); düzeltme yalnız ters kayıt fişiyle (reversal_of; bir fiş bir kez ters kaydedilir; ters kaydın ters
//     kaydı yapılmaz).
//   - Aynı istek kimliği ikinci kez fiş yazmaz: aynı içerikle gelirse ilk fiş döner (replayed), farklı içerikle 409. Kimlik kalıcıdır (request_keys'in 30 günü yok).
//   - Tarihi kilitli döneme düşen fiş 409 (period-locked); ileri tarihli fiş 400. Devrin kendi kapanış fişleri kilit konmadan önce, kilitle AYNI işlemde yazılır
//     (postAll lockThrough).
import { randomUUID } from "node:crypto";
import { systemClock } from "./clock.mjs";
import { ACCOUNT_PLAN, PARTY_ACCOUNTS } from "./general-ledger.mjs";
import { HttpError } from "./http.mjs";
import { LEDGER_VOUCHER_TRIGGERS_V46, LEDGER_VOUCHER_TRIGGER_NAMES } from "./migrations.mjs";
import { isIsoDate } from "./period.mjs";

/** Fiş türleri: ad (yazım düzeni) ve izinli yevmiye sınıfları (ilki varsayılan). Ters kayıt asıl fişin sınıfını alır. */
export const VOUCHER_TYPES = Object.freeze({
  closing: Object.freeze({ label: "Kapanış Fişi", classes: Object.freeze(["closing", "period-end"]) }),
  opening: Object.freeze({ label: "Açılış Fişi", classes: Object.freeze(["opening"]) }),
  "opening-match": Object.freeze({ label: "Açılış Eşleştirme Fişi", classes: Object.freeze(["opening"]) }),
  reversal: Object.freeze({ label: "Ters Kayıt Fişi", classes: Object.freeze([]) }),
  // EK-1 M4 (KG-12 A): K tarihli, kapanış sınıfı, devrin kendi kilit adımıyla aynı işlemde.
  "prior-year-result": Object.freeze({ label: "Önceki Yıl Sonucu Fişi", classes: Object.freeze(["closing"]) }),
  // EK-1 M7 (KG-15 A): ilk açık gün, olağan sınıf (Gelir Tablosu'na girer).
  "rule-diff-correction": Object.freeze({ label: "Kural Farkı Düzeltme Fişi", classes: Object.freeze(["ordinary"]) }),
  // 2.5.1 elle Mahsup Fişi ekranı; 2.5.0'da hiçbir uç yazmaz.
  manual: Object.freeze({ label: "Mahsup Fişi", classes: Object.freeze(["ordinary"]) }),
});
/** Yevmiyede aynı günün sırası (kural kitabı G-4): açılış (günün başı) → olağan → dönem sonu → kapanış (günün sonu). */
export const VOUCHER_CLASSES = Object.freeze(["opening", "ordinary", "period-end", "closing"]);
/** lockThrough ile (kilitle aynı işlemde) yazılabilen türler: devrin kapanış akışı (N-01 … N-08). */
const CLOSING_TYPES = new Set(["closing", "prior-year-result"]);
const MAX_LINES = 100_000;
const KEY = /^[\p{L}\p{N}_.:\-]{8,200}$/u;
const pad = (value, size) => String(value).padStart(size, "0");
/** Fiş numarasının yazılışı: "Fiş 2026-000003" (yıl + yıl içindeki sıra). */
export const voucherNoText = (year, no) => `Fiş ${year}-${pad(no, 6)}`;
const dayText = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const bad = (status, message, code, extra = {}) => new HttpError(status, message, { code, ...extra });
const textOf = (value, max, label) => {
  const text = String(value ?? "").trim();
  if (text.length > max) throw bad(400, `${label} en çok ${max} karakter olabilir.`, "voucher-text", { field: label });
  return text;
};
const has = (store, table) => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));

/**
 * Fiş satırlarının denetimi (bank/voucher.mjs assertLines deseni). lines: [{ account, sub?, party?, debit, credit, note? }] (kuruş tamsayısı).
 * Dönüş: normalleştirilmiş satırlar + toplam. Hata: 400 (code voucher-line / voucher-account / voucher-unbalanced).
 */
export function assertVoucherLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) throw bad(400, "Fişin en az iki satırı olmalı (borç ve alacak).", "voucher-line");
  if (lines.length > MAX_LINES) throw bad(400, `Fiş en çok ${MAX_LINES} satır olabilir.`, "voucher-line");
  let debit = 0;
  let credit = 0;
  const out = lines.map((line, index) => {
    const at = `${index + 1}. satır`;
    const account = String(line?.account ?? "").trim();
    if (!/^\d{3}$/.test(account) || !Object.hasOwn(ACCOUNT_PLAN, account)) throw bad(400, `${at}: ${account || "boş"} hesabı hesap planında yok.`, "voucher-account", { line: index + 1, account });
    const sub = String(line?.sub ?? "").trim();
    if (sub && !new RegExp(`^${account}\\.\\d{2,4}$`).test(sub)) throw bad(400, `${at}: ${sub} alt hesabı ${account} hesabına ait değil.`, "voucher-account", { line: index + 1, account, sub });
    const party = String(line?.party ?? "").trim();
    if (party && !PARTY_ACCOUNTS.has(account)) throw bad(400, `${at}: cari yalnız cari hesaplarına (${[...PARTY_ACCOUNTS].join(", ")}) yazılır.`, "voucher-account", { line: index + 1, account });
    if (party.length > 100) throw bad(400, `${at}: cari kimliği geçerli değil.`, "voucher-line", { line: index + 1 });
    const dr = line?.debit ?? 0;
    const cr = line?.credit ?? 0;
    if (!Number.isSafeInteger(dr) || !Number.isSafeInteger(cr) || dr < 0 || cr < 0) throw bad(400, `${at}: tutar kuruş olarak sıfır ya da artı tam sayı olmalı.`, "voucher-line", { line: index + 1 });
    if ((dr > 0) === (cr > 0)) throw bad(400, `${at}: satır ya borç ya alacak taşır; sıfır tutarlı satır yazılmaz.`, "voucher-line", { line: index + 1 });
    debit += dr;
    credit += cr;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) throw bad(400, "Fiş toplamı çok büyük.", "voucher-line");
    return { seq: index + 1, account, sub, party, debit: dr, credit: cr, note: textOf(line?.note, 300, `${at} açıklaması`) };
  });
  if (debit !== credit || debit <= 0) throw bad(400, `Fiş dengede değil (borç ${debit / 100} ≠ alacak ${credit / 100}).`, "voucher-unbalanced", { debit, credit });
  return { lines: out, total: debit };
}

/** Fişin karşılaştırılabilir içeriği (istek kimliği yinelendiğinde aynı mı?). */
const contentOf = item => JSON.stringify([item.type, item.cls, item.date, item.description, item.source, item.reversalOf || "", item.lines.map(line => [line.account, line.sub, line.party, line.debit, line.credit, line.note])]);

/**
 * Tetikleyicileri aynı işlemde kaldırıp fn'den sonra yeniden kurar (yalnız şirket sıfırlaması ve eski sürüm sıfırlamasının onarımı). İşlem geri alınırsa
 * tetikleyiciler de geri gelir (SQLite'ta DDL işlemseldir). İşlem dışında çağrılamaz.
 */
function withTriggersLifted(store, fn) {
  if (!store.inTransaction) throw new Error("Fiş defteri tetikleyicileri yalnız veri tabanı işleminin içinde kaldırılır (store.tx).");
  for (const name of LEDGER_VOUCHER_TRIGGER_NAMES) store.exec(`DROP TRIGGER IF EXISTS ${name}`);
  const result = fn();
  store.exec(LEDGER_VOUCHER_TRIGGERS_V46);
  return result;
}

/**
 * Şirket Verisini Sıfırla (app.mjs resetData; iki kip): bütün fişler ve satırları silinir, tetikleyiciler aynı işlemde yeniden kurulur. Dönüş: { ledger_vouchers, ledger_voucher_lines } silinen sayılar.
 */
export function clearVouchers(store) {
  if (!has(store, "ledger_vouchers")) return {};
  return withTriggersLifted(store, () => {
    const counts = { ledger_voucher_lines: store.get("SELECT COUNT(*) AS n FROM ledger_voucher_lines").n, ledger_vouchers: store.get("SELECT COUNT(*) AS n FROM ledger_vouchers").n };
    store.run("DELETE FROM ledger_voucher_lines");
    store.run("DELETE FROM ledger_vouchers");
    return counts;
  });
}

const CREATED_TRACE = "ledger.voucher.created";

/**
 * Açılış onarımı (BS-7 TASARIM GİRDİSİ): fiş defterini bilmeyen eski sürüm (≤ 2.4.9) bu dosyada Şirket Verisini Sıfırla yaptıysa hareketleri ve işlem geçmişini
 * siler, fişlere dokunamaz (tetikleyici) — fişler sıfırlanmış verinin üstünde artakalır. Her fiş yazımı aynı işlemde kendi izini (audit_events "ledger.voucher.created")
 * bırakır ve izler yalnız sıfırlamayla silinir; 2.5.0'ın sıfırlaması fişleri de siler. Bu yüzden izi olmayan fiş + işlem geçmişinde "company.reset" = eski sürüm
 * sıfırlamasından artakalan fiştir: aynı işlemde kaldırılır (sıfırlamanın yapacağı iş; eski sürümün sıfırlama öncesi yedeği fişleri taşır), Mutabakat Günlüğü'ne
 * ("repair") ve işlem geçmişine yazılır. Sıfırlama izi yoksa fiş kaldırılmaz, yalnız günlüğe uyarı yazılır. Dönüş: { removed, ids } ya da null.
 */
export function repairLegacyReset({ store, now = systemClock, log = null, newId = () => `int-${randomUUID()}` }) {
  if (!has(store, "ledger_vouchers") || !has(store, "audit_events")) return null;
  const orphans = store.all(`SELECT v.id FROM ledger_vouchers v WHERE NOT EXISTS (SELECT 1 FROM audit_events a WHERE a.entity_id = v.id AND a.type = '${CREATED_TRACE}') ORDER BY v.rowid`).map(row => row.id);
  if (!orphans.length) return null;
  const reset = store.get("SELECT created_at AS at FROM audit_events WHERE type = 'company.reset' ORDER BY rowid DESC LIMIT 1");
  if (!reset) {
    log?.warn?.(`Fiş defteri: işlem geçmişinde izi olmayan ${orphans.length} fiş var (sıfırlama izi yok; dokunulmadı).`);
    return { removed: 0, ids: orphans };
  }
  const at = now().toISOString();
  store.raw("ledger.vouchers.legacy-reset", () =>
    store.tx(() => {
      withTriggersLifted(store, () => {
        const list = JSON.stringify(orphans);
        store.run("DELETE FROM ledger_voucher_lines WHERE voucher_id IN (SELECT value FROM json_each(?))", list);
        // Ters kayıt asıl fişe bağlıdır (yabancı anahtar): önce ters kayıtlar.
        store.run("DELETE FROM ledger_vouchers WHERE id IN (SELECT value FROM json_each(?)) AND reversal_of IS NOT NULL", list);
        store.run("DELETE FROM ledger_vouchers WHERE id IN (SELECT value FROM json_each(?))", list);
      });
      const summary = `Eski sürümde yapılan Şirket Verisini Sıfırla'dan artakalan ${orphans.length} fiş kaldırıldı (sıfırlama ${reset.at}).`;
      if (has(store, "integrity_log")) store.run("INSERT INTO integrity_log (id, at, action, tables, summary, detail_json) VALUES (?, ?, 'repair', 'ledger_vouchers', ?, ?)", newId(), at, summary.slice(0, 500), JSON.stringify({ ids: orphans, resetAt: reset.at }).slice(0, 20000));
      store.run("INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'ledger.vouchers.legacy-reset-removed', 'ledger', 'system', 'Sistem', ?, ?)", `event-${randomUUID()}`, JSON.stringify({ count: orphans.length, ids: orphans.slice(0, 200), resetAt: reset.at }), at);
    }),
  );
  log?.warn?.(`Fiş defteri: eski sürüm sıfırlamasından artakalan ${orphans.length} fiş kaldırıldı.`);
  return { removed: orphans.length, ids: orphans };
}

/** Yevmiye için fişler (routes/ledger.mjs rows; toplu tek sorgu, ders 47): [{ id, seq, date, cls, label, text, lines }]. */
export function voucherJournalRows(store) {
  if (!has(store, "ledger_vouchers") || !has(store, "ledger_voucher_lines")) return [];
  const out = [];
  let current = null;
  for (const row of store.all(
    `SELECT v.id, v.rowid AS seq, v.year, v.no, v.date, v.type, v.journal_class AS cls, v.description, l.account, l.sub, l.party, l.debit_minor AS debit, l.credit_minor AS credit
     FROM ledger_vouchers v CROSS JOIN ledger_voucher_lines l ON l.voucher_id = v.id ORDER BY v.rowid, l.seq`,
  )) {
    if (!current || current.id !== row.id) {
      const no = voucherNoText(row.year, row.no);
      current = { id: row.id, seq: Number(row.seq), date: row.date, cls: row.cls, label: VOUCHER_TYPES[row.type]?.label || "Fiş", text: row.description ? `${no} · ${row.description}` : no, lines: [] };
      out.push(current);
    }
    current.lines.push({ account: row.account, sub: row.sub, party: row.party, debit: Number(row.debit), credit: Number(row.credit) });
  }
  return out;
}

/**
 * Fiş defterinin yapı denetimi (lib/integrity.mjs run "ledger:vouchers"; yalnız fiş varsa): başlığın satır sayısı ve toplamı = satırlar, borç = alacak, hesap planda,
 * ters kayıt asıl fişin aynası (aynı hesap / alt hesap / cari, ters yönde, aynı toplam; asıl fiş ters kayıt değil; tarihi asıl fişten önce değil). Dönüş: sorun metinleri.
 */
export function voucherProblems(store) {
  if (!has(store, "ledger_vouchers") || !has(store, "ledger_voucher_lines")) return [];
  const out = [];
  for (const row of store.all(
    `SELECT v.id, v.year, v.no, v.line_count AS lineCount, v.total_minor AS total, COUNT(l.seq) AS n, COALESCE(SUM(l.debit_minor), 0) AS debit, COALESCE(SUM(l.credit_minor), 0) AS credit
     FROM ledger_vouchers v LEFT JOIN ledger_voucher_lines l ON l.voucher_id = v.id GROUP BY v.id
     HAVING n <> v.line_count OR debit <> credit OR debit <> v.total_minor`,
  )) out.push(`${voucherNoText(row.year, row.no)}: ${row.n}/${row.lineCount} satır, borç ${row.debit / 100}, alacak ${row.credit / 100}, başlık ${row.total / 100}`);
  for (const row of store.all("SELECT DISTINCT l.account, l.sub FROM ledger_voucher_lines l")) {
    if (!Object.hasOwn(ACCOUNT_PLAN, row.account) || (row.sub && !row.sub.startsWith(`${row.account}.`))) out.push(`${row.sub || row.account}: hesap planında yok`);
  }
  const reversals = store.all(
    `SELECT r.id, r.year, r.no, r.date, r.total_minor AS total, o.id AS originalId, o.type AS originalType, o.date AS originalDate, o.total_minor AS originalTotal
     FROM ledger_vouchers r LEFT JOIN ledger_vouchers o ON o.id = r.reversal_of WHERE r.type = 'reversal'`,
  );
  if (reversals.length) {
    const nets = new Map();
    const ids = JSON.stringify(reversals.flatMap(row => [row.id, row.originalId].filter(Boolean)));
    for (const line of store.all("SELECT voucher_id AS id, account, sub, party, SUM(debit_minor - credit_minor) AS net FROM ledger_voucher_lines WHERE voucher_id IN (SELECT value FROM json_each(?)) GROUP BY voucher_id, account, sub, party", ids)) {
      if (!nets.has(line.id)) nets.set(line.id, new Map());
      nets.get(line.id).set(`${line.account}|${line.sub}|${line.party}`, Number(line.net));
    }
    for (const row of reversals) {
      const tag = voucherNoText(row.year, row.no);
      if (!row.originalId) out.push(`${tag}: ters kaydın asıl fişi yok`);
      else if (row.originalType === "reversal") out.push(`${tag}: ters kaydın ters kaydı`);
      else if (row.total !== row.originalTotal || row.date < row.originalDate) out.push(`${tag}: ters kayıt asıl fişle uyuşmuyor (toplam ya da tarih)`);
      else {
        const mine = nets.get(row.id) || new Map();
        const theirs = nets.get(row.originalId) || new Map();
        const keys = new Set([...mine.keys(), ...theirs.keys()]);
        if ([...keys].some(key => (mine.get(key) || 0) + (theirs.get(key) || 0) !== 0)) out.push(`${tag}: ters kayıt asıl fişin aynası değil`);
      }
    }
  }
  return out;
}

/**
 * İç API. period: lib/period.mjs (kilit ve "bugün"); now: iş saati. Kullanıcı (user) iz için: { id, display_name }.
 *   post(user, input, options)     → tek fiş (postAll'un tek elemanlısı)
 *   postAll(user, inputs, { lockThrough }) → fişler tek işlemde; lockThrough verilirse (yalnız kapanış türleri) kilit aynı işlemde o güne konur
 *   reverse(user, id, { date, requestKey, description }) → ters kayıt fişi (R-03)
 *   get(id) · list({ from, to, type, limit })
 * input: { type, cls?, date, description?, source?, requestKey, lines: [{ account, sub?, party?, debit, credit, note? }] } (kuruş).
 * Dönüş: fiş görünümü + replayed (aynı istek kimliğiyle daha önce yazılmış).
 */
// onLockChanged (2.5.0 Ç3; lib/ledger-snapshots.mjs lockChanged): lockThrough kilidi ilerletince AYNI işlemde çağrılır — donmuş defter kapanış fişleriyle birlikte donar
// (kilit + fişler + donmuş satırlar tek işlem; biri düşerse hiçbiri yok).
export function createLedgerVouchers({ store, period = null, now = systemClock, newId = () => `lv-${randomUUID()}`, onLockChanged = null }) {
  const today = () => period?.today?.() || now.today?.() || now().toISOString().slice(0, 10);
  const lockedUntil = () => period?.lockedUntil?.() || "";

  function normalize(input) {
    const type = String(input?.type ?? "");
    if (!Object.hasOwn(VOUCHER_TYPES, type) || type === "reversal") throw bad(400, "Fiş türü geçerli değil.", "voucher-type", { type });
    const allowed = VOUCHER_TYPES[type].classes;
    const cls = input?.cls === undefined || input?.cls === null || input?.cls === "" ? allowed[0] : String(input.cls);
    if (!allowed.includes(cls)) throw bad(400, `${VOUCHER_TYPES[type].label} bu sınıfta yazılmaz (${cls}).`, "voucher-type", { type, cls });
    const date = String(input?.date ?? "").trim();
    if (!isIsoDate(date)) throw bad(400, "Fiş tarihi geçerli değil.", "date-invalid", { field: "date" });
    const requestKey = String(input?.requestKey ?? "").trim();
    if (!KEY.test(requestKey)) throw bad(400, "Fişin istek kimliği gerekli (8–200 harf, rakam ya da _ . : -).", "request-id-invalid");
    const { lines, total } = assertVoucherLines(input?.lines);
    return { type, cls, date, description: textOf(input?.description, 300, "Açıklama"), source: textOf(input?.source, 200, "Kaynak"), requestKey, reversalOf: "", lines, total };
  }

  function view(row, lines = null) {
    if (!row) return null;
    return {
      id: row.id, year: Number(row.year), no: Number(row.no), noText: voucherNoText(row.year, row.no), date: row.date, type: row.type, typeLabel: VOUCHER_TYPES[row.type]?.label || "Fiş",
      cls: row.journal_class, description: row.description, source: row.source, requestKey: row.request_key, reversalOf: row.reversal_of || "", reversedBy: row.reversed_by || "",
      totalMinor: Number(row.total_minor), lineCount: Number(row.line_count), createdBy: row.created_by, createdAt: row.created_at,
      lines: (lines || store.all("SELECT seq, account, sub, party, debit_minor AS debit, credit_minor AS credit, note FROM ledger_voucher_lines WHERE voucher_id = ? ORDER BY seq", row.id)).map(line => ({ seq: Number(line.seq), account: line.account, sub: line.sub, party: line.party, debit: Number(line.debit), credit: Number(line.credit), note: line.note })),
    };
  }
  const HEAD = "SELECT v.*, (SELECT r.id FROM ledger_vouchers r WHERE r.reversal_of = v.id) AS reversed_by FROM ledger_vouchers v";
  const get = id => view(store.get(`${HEAD} WHERE v.id = ?`, String(id ?? "")));
  const byKey = key => view(store.get(`${HEAD} WHERE v.request_key = ?`, key));

  // Sıradaki numara: o yılın en büyük sırası + 1 (UNIQUE (year, no) yedek). İşlemin içinde, eklemeyle aynı eşzamanlı adımda.
  const nextNo = year => Number(store.get("SELECT COALESCE(MAX(no), 0) AS n FROM ledger_vouchers WHERE year = ?", year).n) + 1;

  function write(user, item) {
    // İstek kimliği: aynı içerik → ilk fiş; farklı içerik → 409. Kilit ve tarih denetiminden ÖNCE (yinelenen istek, kilit sonradan konduysa da aynı fişi alır).
    const existing = byKey(item.requestKey);
    if (existing) {
      if (contentOf(existing) !== contentOf(item)) throw bad(409, "Bu istek kimliğiyle daha önce farklı içerikli bir fiş yazıldı.", "request-id-reused", { refId: existing.id });
      return { ...existing, replayed: true };
    }
    if (item.date > today()) throw bad(400, `İleri tarihli fiş yazılamaz (${dayText(item.date)}).`, "date-future", { field: "date" });
    const lock = lockedUntil();
    if (lock && item.date <= lock) throw bad(409, `${VOUCHER_TYPES[item.type].label} ${dayText(item.date)} tarihli; ${dayText(lock)} ve öncesi kapatılmış (kilitli) dönemdir.`, "period-locked", { lockedUntil: lock });
    const year = Number(item.date.slice(0, 4));
    const no = nextNo(year);
    const id = newId();
    const at = now().toISOString();
    store.run(
      `INSERT INTO ledger_vouchers (id, year, no, date, type, journal_class, description, source, request_key, reversal_of, line_count, total_minor, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, year, no, item.date, item.type, item.cls, item.description, item.source, item.requestKey, item.reversalOf || null, item.lines.length, item.total, String(user?.id || "system"), at,
    );
    for (const line of item.lines) store.run("INSERT INTO ledger_voucher_lines (voucher_id, seq, account, sub, party, debit_minor, credit_minor, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, line.seq, line.account, line.sub, line.party, line.debit, line.credit, line.note);
    // İz (repairLegacyReset bununla tanır): fişle aynı işlemde, bağlamın audit işlevinden bağımsız (iş parçacığında ya da kopyada yazılan fiş de izini taşır).
    store.run(
      "INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      `event-${randomUUID()}`, CREATED_TRACE, id, String(user?.id || "system"), String(user?.display_name || user?.name || "Sistem"),
      JSON.stringify({ no: voucherNoText(year, no), type: item.type, date: item.date, totalMinor: item.total, source: item.source, reversalOf: item.reversalOf || "" }), at,
    );
    return { ...get(id), replayed: false };
  }

  function postAll(user, inputs, { lockThrough = "" } = {}) {
    if (!Array.isArray(inputs) || !inputs.length) throw bad(400, "Yazılacak fiş yok.", "voucher-line");
    // Denetim işlemden önce (saf); yazım tek işlemde ve eşzamanlı.
    const items = inputs.map(normalize);
    const keys = new Set(items.map(item => item.requestKey));
    if (keys.size !== items.length) throw bad(400, "Aynı istek kimliği bir istekte iki kez kullanılamaz.", "request-id-invalid");
    if (lockThrough) {
      if (!isIsoDate(lockThrough)) throw bad(400, "Kilit tarihi geçerli değil.", "date-invalid", { field: "lockThrough" });
      if (!period?.setLock) throw new Error("Dönem kilidi hazır değil.");
      for (const item of items) {
        if (!CLOSING_TYPES.has(item.type)) throw bad(400, `${VOUCHER_TYPES[item.type].label} kilitle aynı işlemde yazılmaz (yalnız kapanış akışı).`, "voucher-type", { type: item.type });
        if (item.date > lockThrough) throw bad(400, `Fiş tarihi (${dayText(item.date)}) konacak kilitten (${dayText(lockThrough)}) sonra.`, "date-invalid", { field: "lockThrough" });
      }
    }
    return store.tx(() => {
      const out = items.map(item => write(user, item));
      if (lockThrough) {
        const previous = lockedUntil();
        // Kilit yalnız ileri gider (yinelenen kapanışta düşmez); "Gelecekteki bir dönem kilitlenemez" denetimi setLock'ta.
        if (!previous || lockThrough > previous) {
          period.setLock(lockThrough);
          onLockChanged?.({ previous, next: lockThrough, user, reason: "voucher-closing" });
          store.run(
            "INSERT INTO audit_events (id, type, entity_id, actor_id, actor_name, payload_json, created_at) VALUES (?, 'ledger.period.locked', 'period', ?, ?, ?, ?)",
            `event-${randomUUID()}`, String(user?.id || "system"), String(user?.display_name || user?.name || "Sistem"), JSON.stringify({ previous, lockedUntil: lockThrough, reason: "ledger.voucher.closing", vouchers: out.map(item => item.id) }), now().toISOString(),
          );
        }
      }
      return out;
    });
  }

  function reverse(user, id, { date = "", requestKey = "", description = "" } = {}) {
    const key = String(requestKey ?? "").trim();
    if (!KEY.test(key)) throw bad(400, "Ters kaydın istek kimliği gerekli.", "request-id-invalid");
    return store.tx(() => {
      // Yinelenen istek: ilk ters kayıt döner (asıl fiş artık ters kaydedilmiş olsa da).
      const replay = byKey(key);
      const original = get(id);
      if (!original) {
        if (replay) throw bad(409, "Bu istek kimliğiyle daha önce farklı içerikli bir fiş yazıldı.", "request-id-reused", { refId: replay.id });
        throw bad(404, "Fiş bulunamadı.", "voucher-missing");
      }
      if (original.type === "reversal") throw bad(409, "Ters kayıt fişi ters kaydedilemez; asıl fişi yeniden yazın.", "voucher-reversal-of-reversal");
      const day = String(date || "").trim() || original.date;
      if (!isIsoDate(day)) throw bad(400, "Ters kaydın tarihi geçerli değil.", "date-invalid", { field: "date" });
      if (day < original.date) throw bad(400, `Ters kayıt asıl fişin tarihinden (${dayText(original.date)}) önce olamaz.`, "voucher-reverse-before", { field: "date" });
      const item = {
        type: "reversal", cls: original.cls, date: day, description: textOf(description, 300, "Açıklama") || `Ters kayıt: ${original.noText}`, source: original.source, requestKey: key, reversalOf: original.id,
        lines: original.lines.map((line, index) => ({ seq: index + 1, account: line.account, sub: line.sub, party: line.party, debit: line.credit, credit: line.debit, note: line.note })),
        total: original.totalMinor,
      };
      if (replay) {
        if (contentOf(replay) !== contentOf(item)) throw bad(409, "Bu istek kimliğiyle daha önce farklı içerikli bir fiş yazıldı.", "request-id-reused", { refId: replay.id });
        return { ...replay, replayed: true };
      }
      if (original.reversedBy) throw bad(409, `${original.noText} zaten ters kaydedildi.`, "voucher-reversed", { refId: original.reversedBy });
      return write(user, item);
    });
  }

  function list({ from = "", to = "", type = "", limit = 500 } = {}) {
    if (!has(store, "ledger_vouchers")) return [];
    const where = [];
    const args = [];
    for (const [value, sql] of [[from, "v.date >= ?"], [to, "v.date <= ?"], [type, "v.type = ?"]]) {
      if (!value) continue;
      where.push(sql);
      args.push(String(value));
    }
    const rows = store.all(`${HEAD}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY v.date, v.rowid LIMIT ?`, ...args, Math.max(1, Math.min(5000, Number(limit) || 500)));
    if (!rows.length) return [];
    // Satırlar toplu (öğe başına sorgu yok; ders 47).
    const lines = new Map();
    for (const line of store.all("SELECT voucher_id AS id, seq, account, sub, party, debit_minor AS debit, credit_minor AS credit, note FROM ledger_voucher_lines WHERE voucher_id IN (SELECT value FROM json_each(?)) ORDER BY voucher_id, seq", JSON.stringify(rows.map(row => row.id)))) {
      if (!lines.has(line.id)) lines.set(line.id, []);
      lines.get(line.id).push(line);
    }
    return rows.map(row => view(row, lines.get(row.id) || []));
  }

  return { post: (user, input, options) => postAll(user, [input], options)[0], postAll, reverse, get, list, voucherNoText };
}
