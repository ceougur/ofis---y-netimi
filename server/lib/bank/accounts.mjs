// Banka hesapları (v2.1.0 Aşama 3; docs/BANKA-MODULU-PLAN.md §3.5, §3.7/1, §3.8 "Açılış", §3.9 K7, §5.6, §7, §10.3, §10.4).
//
// Hesap kartı (bank_accounts): tür (Vadesiz, Ticari, Vadeli, Döviz, Kredi Hesabı, Kurumsal Kredi Kartı, Diğer), para birimi, IBAN (ISO 13616
// mod 97; silinmemiş hesaplar arasında tekil), Hesap Kodu (kullanıcının; tekil, verilmezse önerilir: ZIR-TL), alt hesap kodu (gl_sub; sistem
// verir, değişmez, silinen hesabınki yeniden kullanılmaz: 102.01, 102.02 … / 309.01 / 300.01). Tür ve para birimi yalnız hareketsiz hesapta
// değişir; 102 ailesinden kredi/karta geçilmez (alt hesap kodu değişmez).
//
// Açılış (§3.7/1, §10.3): açılış tarihi D'nin GÜN BAŞINDAKİ bakiye; Banka Fişi "opening": B 102.k / A 500 (KMH'de eksi açılış ters; kart borcu
// B 500 / A 309.k; kredi B 500 / A 300.k; döviz hesabında elle kurla TL karşılığı). Sıfır açılış satırsızdır. "Bakiye Doğrulandı" (K7):
// işaretlenene kadar eksi bakiye denetimi Kontrol Yok, sonra Banka Ayarları'ndaki (ya da hesap kartındaki) politika. Açılışı Düzelt = ters kayıt
// + yeni açılış (tek işlem); kilitli açılış düzeltilmez; yeni tarih hesabın ilk hareketinden sonra olamaz.
//
// Hesabı Atanmamış Eski Hareketler (102.00 / 108.00): hesap tanımlanmadan girilmiş havale/POS hareketleri. "Bu Hesaba Ata" (op 'assign')
// açık dönemdeki, hesabın açılışından sonraki havale satırını hesaba bağlar (olayı yoksa İşlem No'lu olay açar). Kurulum ve Aktarım
// Sihirbazı (§10.3): Devir Kapanışı (açılış gününden önceki 102.00/108.00 bakiyesi 500'e kapanır) + açılıştan sonraki eski havale satırlarını
// hesaba bağlama; tek dış işlem, istek kimlikli, GERİ ALINABİLİR. "Bankaya Geçmiş Say" / "Kart Borcuna Aktar": 108.00 bakiyesinin hesaba
// aktarımı (aynı geri alma yoluyla). Çalışmalar bank_jobs'ta ("setup" kaydı) ve işlem başlığında (legacy_assign) izlenir.
import { randomUUID } from "node:crypto";
import { HttpError, limited, text } from "../http.mjs";
import { systemClock } from "../clock.mjs";
import { CURRENCY_DIGITS, minorText, mulRate, parseMinor, parseRate } from "../minor.mjs";
import { isValidIban, ibanText, normalizeIban } from "../tax-id.mjs";
import { UNASSIGNED_SUBS, subTrial, trialBalance } from "../general-ledger.mjs";
import { KIND_GL } from "./checks.mjs";
import { MODULE_TABLES, MONEY_SOURCES } from "./money-lines.mjs";
import { createBankSettings } from "./settings.mjs";
import { assertLines, carryLines, openingLines, reclassLines } from "./voucher.mjs";

export const ACCOUNT_KINDS = Object.freeze({
  demand: { label: "Vadesiz", forms: ["bank"], negativeOpening: true },
  commercial: { label: "Ticari", forms: ["bank"] },
  time: { label: "Vadeli", forms: [] },
  fx: { label: "Döviz", forms: ["fx"] },
  loan: { label: "Kredi Hesabı", forms: [] },
  card: { label: "Kurumsal Kredi Kartı", forms: ["card"] },
  other: { label: "Diğer", forms: ["bank"] },
});
/** ANLIK DURUM, Genel Bakış ve Birleşik Rapor'da aynı adlar (K10). */
export const K10_LABELS = Object.freeze({ realBank: "Gerçek Banka", posPending: "POS Bekleyen (Net)", posBlocked: "Blokeli POS", debt: "Kart ve Kredi Borcu", unassigned: "Hesabı Atanmamış Eski Hareketler" });
const POLICIES = ["warn", "block", "off"];
const NOT_CONFIRMED = "Açılış bakiyesi doğrulanmadı; eksi bakiye denetimi kapalı.";
const BANK_FORM_KINDS = new Set(["demand", "commercial", "other"]);
const STATUSES = ["active", "passive"];
const SOURCE_TABLE = new Map(MONEY_SOURCES.map(source => [source.id, source.table]));
const CODE_RULE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,29}$/u;
const ASCII = { Ç: "C", Ğ: "G", İ: "I", I: "I", Ö: "O", Ş: "S", Ü: "U" };
const fold = value => String(value || "").toLocaleUpperCase("tr-TR").replace(/[ÇĞİIÖŞÜ]/g, ch => ASCII[ch] || ch).replace(/[^A-Z0-9]/g, "");
const moneyText = minor => minorText(minor, "TRY");
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
const parseExtra = value => {
  try {
    return JSON.parse(value || "{}") || {};
  } catch {
    return {};
  }
};

/**
 * @param {{ store, bank, period, money, ledger: () => object, now? }} options  ledger: Ana Defter servisi (istek anında; Alt Hesap Mizanı)
 */
export function createBankAccounts({ store, bank, period, money, ledger, now = systemClock }) {
  const stamp = () => now().toISOString();
  const today = () => (period ? period.today() : now().toISOString().slice(0, 10));
  const lock = () => period?.lockedUntil?.() || "";

  // ---------- Kartlar ----------
  const rowOf = (id, { deleted = false } = {}) => {
    const row = store.get("SELECT * FROM bank_accounts WHERE id = ?", String(id || ""));
    return row && (deleted || !row.deleted_at) ? row : null;
  };
  const mustRow = id => {
    const row = rowOf(id);
    if (!row) throw new HttpError(404, "Banka hesabı bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", { code: "bank-account-missing" });
    return row;
  };
  const labelOf = row => `${row.bank_name} · ${row.name}`;
  const bankFormOk = row => Boolean(row) && !row.deleted_at && row.status === "active" && row.currency === "TRY" && BANK_FORM_KINDS.has(row.kind);
  const settings = createBankSettings({ store, accountOk: id => bankFormOk(rowOf(id)), posOk: id => Boolean(store.get("SELECT 1 AS found FROM pos_terminals WHERE id = ? AND deleted_at IS NULL AND status = 'active'", id)) });

  /** Etkin açılış: { eventId, no, date, amountMinor (hesabın para biriminde, işaretli), tryMinor (işaretli), direction, lines } ya da null. */
  function openingOf(id) {
    const event = store.get("SELECT id, no, date, direction, amount_minor AS amountMinor, try_minor AS tryMinor FROM fin_events WHERE bank_ref = ? AND +type = 'opening' AND +status = 'active' ORDER BY created_at DESC LIMIT 1", id);
    if (!event) return null;
    const sign = event.direction === "out" ? -1 : 1;
    const lines = store.get("SELECT COUNT(*) AS n FROM bank_lines WHERE event_id = ?", event.id).n;
    return { eventId: event.id, no: event.no, date: event.date, amountMinor: sign * Number(event.amountMinor), tryMinor: sign * Number(event.tryMinor), direction: event.direction, lines: Number(lines) || 0 };
  }
  // Açılış zinciri (açılış fişleri ve ters kayıtları) hareket sayılmaz (lib/bank/checks.mjs openingProblems ile aynı tanım).
  const OPENING_CHAIN = "(e.type = 'opening' OR (e.type = 'reversal' AND EXISTS (SELECT 1 FROM fin_events o WHERE o.id = e.reversal_of AND o.type = 'opening')))";
  /** Hesaba bağlı hareketler (modül satırları + Banka Fişi satırları; açılış zinciri hariç): { count, first, last }. */
  function movementInfo(id) {
    let count = 0;
    let first = "";
    let last = "";
    const take = row => {
      count += Number(row?.n) || 0;
      if (row?.first && (!first || row.first < first)) first = row.first;
      if (row?.last && (!last || row.last > last)) last = row.last;
    };
    for (const table of MODULE_TABLES) take(store.get(`SELECT COUNT(*) AS n, MIN(date) AS first, MAX(date) AS last FROM ${table} WHERE fin_ref = ? AND fin_ref <> ''`, id));
    take(store.get(`SELECT COUNT(*) AS n, MIN(e.date) AS first, MAX(e.date) AS last FROM bank_lines l CROSS JOIN fin_events e ON e.id = l.event_id WHERE l.ref = ? AND NOT ${OPENING_CHAIN}`, id));
    return { count, first, last };
  }
  /** Hesap bazında TL bakiyesi (tek kaynak, kuruş): ref → kuruş. */
  const balances = (groups = money.groups()) => {
    const out = new Map();
    for (const group of groups) if (group.ref) out.set(group.ref, (out.get(group.ref) || 0) + Number(group.cents));
    return out;
  };
  /** Döviz hesabının kendi para birimindeki bakiyesi (Banka Fişi satırları + 13b cari satırları; sent). */
  function fxBalanceOf(row, tlBalance) {
    if (row.currency === "TRY") return tlBalance;
    const lines = store.get("SELECT COALESCE(SUM(CASE side WHEN 'D' THEN fx_minor ELSE -fx_minor END), 0) AS n FROM bank_lines WHERE ref = ? AND role IN ('bank', 'card', 'loan')", row.id).n;
    const entries = store.get("SELECT COALESCE(SUM(CASE kind WHEN 'in' THEN fx_minor WHEN 'out' THEN -fx_minor ELSE 0 END), 0) AS n FROM account_entries WHERE fin_ref = ? AND fin_ref <> '' AND fx_currency <> ''", row.id).n;
    return Number(lines) + Number(entries);
  }
  function view(row, { groups = null } = {}) {
    const confirmed = Boolean(row.balance_confirmed);
    const balance = balances(groups || money.groups()).get(row.id) || 0;
    const opening = openingOf(row.id);
    const moves = movementInfo(row.id);
    const policy = confirmed ? row.negative_policy || settings.read().negative.policy : "off";
    return {
      id: row.id,
      code: row.code,
      gl: row.gl,
      glSub: row.gl_sub,
      kind: row.kind,
      kindLabel: ACCOUNT_KINDS[row.kind]?.label || row.kind,
      bankName: row.bank_name,
      name: row.name,
      label: labelOf(row),
      currency: row.currency,
      iban: row.iban,
      ibanText: row.iban ? ibanText(row.iban) : "",
      accountNo: row.account_no,
      branchName: row.branch_name,
      branchCode: row.branch_code,
      swift: row.swift,
      holder: row.holder,
      description: row.description,
      openingDate: row.opening_date,
      balanceConfirmed: confirmed,
      creditLimitMinor: Number(row.credit_limit_minor) || 0,
      negativePolicy: row.negative_policy,
      policy,
      policyNote: confirmed ? "" : NOT_CONFIRMED,
      statementDay: row.statement_day,
      dueDay: row.due_day,
      showOnInvoice: Boolean(row.show_on_invoice),
      status: row.status,
      position: row.position,
      opening: opening ? { eventId: opening.eventId, no: opening.no, date: opening.date, amountMinor: opening.amountMinor, tryMinor: opening.tryMinor, direction: opening.direction } : null,
      balanceMinor: balance,
      fxBalanceMinor: fxBalanceOf(row, balance),
      movementCount: moves.count,
      firstMovementDate: moves.first,
      lastMovementDate: moves.last,
      deletable: moves.count === 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ---------- Girdi ----------
  const requiredName = (value, label) => {
    const out = limited(value, 120, label);
    if (!out) throw new HttpError(400, `${label} gerekli.`, { code: "bank-name-required", field: label });
    return out;
  };
  function currencyOf(value) {
    const code = text(value, "TRY").toUpperCase() || "TRY";
    if (!Object.hasOwn(CURRENCY_DIGITS, code)) throw new HttpError(400, `Para birimi desteklenmiyor (${code.slice(0, 10)}). Desteklenenler: ${Object.keys(CURRENCY_DIGITS).join(", ")}.`, { code: "currency-unsupported", field: "currency" });
    return code;
  }
  /** Tür ve para birimi kuralı (§3.5): TL dışında 102 ailesi Döviz olur; Döviz türü TL olamaz; kredi, kart ve vadeli yalnız TL. */
  function kindCurrency(kindValue, currencyValue) {
    let kind = text(kindValue);
    if (!Object.hasOwn(ACCOUNT_KINDS, kind)) throw new HttpError(400, "Hesap türü Vadesiz, Ticari, Vadeli, Döviz, Kredi Hesabı, Kurumsal Kredi Kartı ya da Diğer olmalı.", { code: "bank-kind", field: "kind" });
    const currency = currencyOf(currencyValue);
    if (currency !== "TRY" && BANK_FORM_KINDS.has(kind)) kind = "fx";
    if (kind === "fx" && currency === "TRY") throw new HttpError(400, "Döviz hesabının para birimi TL olamaz; TL hesap için Vadesiz ya da Ticari seçin.", { code: "bank-currency", field: "currency" });
    if (["loan", "card", "time"].includes(kind) && currency !== "TRY") throw new HttpError(400, `${ACCOUNT_KINDS[kind].label} yalnız TL olabilir.`, { code: "bank-currency", field: "currency" });
    return { kind, currency };
  }
  function ibanOf(value, exceptId = "") {
    const iban = normalizeIban(value);
    if (!iban) return "";
    if (!isValidIban(iban)) throw new HttpError(400, "IBAN geçersiz: TR ile başlayan 26 karakter olmalı ve denetim haneleri tutmalı.", { code: "iban-invalid", field: "iban" });
    const clash = store.get("SELECT code, bank_name AS bankName, name FROM bank_accounts WHERE iban = ? AND deleted_at IS NULL AND id <> ?", iban, exceptId);
    if (clash) throw new HttpError(409, `Bu IBAN başka bir hesapta kayıtlı (${clash.code} · ${clash.bankName} · ${clash.name}).`, { code: "bank-iban-exists", field: "iban" });
    return iban;
  }
  const codeTaken = (code, exceptId = "") => Boolean(store.get("SELECT 1 AS found FROM bank_accounts WHERE code = ? COLLATE NOCASE AND deleted_at IS NULL AND id <> ?", code, exceptId));
  function codeShape(value) {
    const code = limited(value, 30, "Hesap Kodu");
    if (!CODE_RULE.test(code)) throw new HttpError(400, "Hesap Kodu harf ya da rakamla başlamalı; en çok 30 karakter (harf, rakam, boşluk, nokta, tire).", { code: "bank-code", field: "code" });
    return code;
  }
  function codeOf(value, exceptId = "") {
    const code = codeShape(value);
    if (codeTaken(code, exceptId)) throw new HttpError(409, `${code} kodu başka bir hesapta kullanılıyor; Hesap Kodu tekil olmalı.`, { code: "bank-code-exists", field: "code" });
    return code;
  }
  /** Önerilen kod: bankanın ilk 3 harfi + para birimi/tür (ZIR-TL, GAR-KART, ZIR-USD); doluysa -2, -3 … */
  function suggestCode(bankName, kind, currency) {
    const base = `${fold(bankName).slice(0, 3) || "BNK"}-${kind === "card" ? "KART" : kind === "loan" ? "KREDI" : kind === "time" ? "VADELI" : currency === "TRY" ? "TL" : currency}`;
    if (!codeTaken(base)) return base;
    for (let n = 2; n < 1000; n += 1) if (!codeTaken(`${base}-${n}`)) return `${base}-${n}`;
    return `${base}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }
  const dayOf = (value, label) => {
    if (value === undefined || value === null || value === "") return 0;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 31) throw new HttpError(400, `${label} 1–31 arasında bir gün olmalı (boş: yok).`, { code: "bank-day", field: label });
    return number;
  };
  function policyOf(value) {
    const policy = text(value);
    if (policy && !POLICIES.includes(policy)) throw new HttpError(400, "Eksi bakiye denetimi Uyar, Engelle ya da Kontrol Yok olmalı (boş: Banka Ayarları'ndaki).", { code: "bank-negative-policy", field: "negativePolicy" });
    return policy;
  }
  const limitOf = value => (value === undefined || value === null || value === "" ? 0 : parseMinor(value, { label: "Limit", allowZero: true }));
  /** Bilgi alanları (kartın parası ve türü değil). */
  function infoOf(body, current = {}) {
    const pick = (key, column, max, label) => (body[key] === undefined ? current[column] ?? "" : limited(body[key], max, label));
    return {
      account_no: pick("accountNo", "account_no", 40, "Hesap No"),
      branch_name: pick("branchName", "branch_name", 120, "Şube"),
      branch_code: pick("branchCode", "branch_code", 20, "Şube Kodu"),
      swift: pick("swift", "swift", 20, "SWIFT"),
      holder: pick("holder", "holder", 120, "Hesap Sahibi"),
      description: pick("description", "description", 500, "Açıklama"),
      statement_day: body.statementDay === undefined ? current.statement_day ?? 0 : dayOf(body.statementDay, "Ekstre Kesim Günü"),
      due_day: body.dueDay === undefined ? current.due_day ?? 0 : dayOf(body.dueDay, "Son Ödeme Günü"),
      show_on_invoice: body.showOnInvoice === undefined ? current.show_on_invoice ?? 0 : body.showOnInvoice ? 1 : 0,
    };
  }

  // ---------- Açılış girdisi ----------
  /** { date, amount (hesabın para biriminde, işaretli), tryMinor (işaretli), rateE6, rateSource, confirmed } */
  function openingInput(input = {}, account, { confirmedDefault = false } = {}) {
    const body = input && typeof input === "object" ? input : {};
    const date = period ? period.movementDate(body, { field: "date", label: "Açılış Tarihi" }) : today();
    const raw = body.amount === undefined || body.amount === null || body.amount === "" ? "0" : body.amount;
    const amount = parseMinor(raw, { currency: account.currency, label: "Açılış Bakiyesi", allowZero: true, allowNegative: Boolean(ACCOUNT_KINDS[account.kind]?.negativeOpening) });
    let tryMinor = amount;
    let rateE6 = 1_000_000;
    let rateSource = "";
    if (account.currency !== "TRY" && amount) {
      rateE6 = parseRate(body.rate, { label: "Açılış Kuru" });
      tryMinor = mulRate(amount, rateE6, { from: account.currency, to: "TRY" });
      if (!tryMinor) throw new HttpError(400, "Açılışın TL karşılığı sıfır çıktı; kuru ya da tutarı denetleyin.", { code: "amount-range", field: "amount" });
      rateSource = "manual";
    }
    const confirmed = body.confirmed === undefined ? confirmedDefault : Boolean(body.confirmed);
    return { date, amount, tryMinor, rateE6, rateSource, confirmed };
  }
  const accountShape = row => ({ id: row.id, kind: row.kind, gl: row.gl, glSub: row.gl_sub, currency: row.currency });
  // Açılış fişi (bank.post'un write geri çağrısında).
  function writeOpening(row, opening) {
    const lines = openingLines(accountShape(row), { amount: opening.amount, tryMinor: opening.tryMinor, rateE6: opening.rateE6, rateSource: opening.rateSource });
    if (lines.length) assertLines(lines);
    return bank.voucher({ type: "opening", date: opening.date, bankRef: row.id, currency: row.currency, description: `Açılış Bakiyesi · ${labelOf(row)}` }, lines);
  }
  /** Yeni açılışın tarihi hesabın ilk hareketinden sonra olamaz (§3.8). */
  function assertBeforeFirst(id, date) {
    const { first } = movementInfo(id);
    if (first && date > first) throw new HttpError(409, `Açılış tarihi hesabın ilk hareketinden (${first.split("-").reverse().join(".")}) sonra olamaz. Açılış, o günün başındaki bakiyedir.`, { code: "bank-opening-after-first", firstMovement: first });
  }

  // ---------- Hesap aç, düzelt, durum, sil ----------
  function create(user, body = {}, { requestId = "" } = {}) {
    const bankName = requiredName(body.bankName, "Banka Adı");
    const name = requiredName(body.name, "Hesap Adı");
    const { kind, currency } = kindCurrency(body.kind || "demand", body.currency);
    const iban = normalizeIban(body.iban);
    if (iban && !isValidIban(iban)) ibanOf(iban);
    const code = text(body.code);
    if (code) codeShape(code);
    const info = infoOf(body);
    const creditLimit = limitOf(body.creditLimit);
    const negativePolicy = policyOf(body.negativePolicy);
    const id = `bacc-${randomUUID()}`;
    const draft = { id, kind, currency, gl: KIND_GL[kind], gl_sub: "" };
    const opening = openingInput(body.opening, draft);
    const result = bank.post({
      user, module: "bank", op: "create", requestId, scope: "bank.account.create", body,
      write: () => {
        // Tekillik denetimleri işlemin içinde (aynı anda iki istek; istek kimliğiyle yinelenen istek önce yanıtını alır).
        ibanOf(iban);
        const finalCode = code ? codeOf(code) : suggestCode(bankName, kind, currency);
        const gl = KIND_GL[kind];
        const used = store.all("SELECT gl_sub AS sub FROM bank_accounts WHERE gl = ?", gl).map(row => Number(String(row.sub).split(".")[1]) || 0);
        const glSub = `${gl}.${String(Math.max(0, ...used) + 1).padStart(2, "0")}`;
        const position = Number(store.get("SELECT COALESCE(MAX(position), 0) AS n FROM bank_accounts").n) + 1;
        store.run(
          `INSERT INTO bank_accounts (id, code, gl, gl_sub, kind, bank_name, name, currency, iban, account_no, branch_name, branch_code, swift, holder, description, opening_date,
             balance_confirmed, credit_limit_minor, negative_policy, statement_day, due_day, show_on_invoice, status, position, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
          id, finalCode, gl, glSub, kind, bankName, name, currency, iban, info.account_no, info.branch_name, info.branch_code, info.swift, info.holder, info.description, opening.date,
          opening.confirmed ? 1 : 0, creditLimit, negativePolicy, info.statement_day, info.due_day, info.show_on_invoice, position, user.id, stamp(),
        );
        const row = rowOf(id);
        const event = writeOpening(row, opening);
        return { id, eventNo: event.no };
      },
      audit: { type: "bank.account.created", entityId: id, payload: { code: code || "(önerilen)", bankName, name, kind, currency, iban: iban ? `${iban.slice(0, 4)}…${iban.slice(-4)}` : "", opening: { date: opening.date, amountMinor: opening.amount, tryMinor: opening.tryMinor, confirmed: opening.confirmed } } },
    });
    if (result?.replayed) return { replayed: true, refId: result.refId, account: rowOf(result.refId) ? view(rowOf(result.refId)) : null };
    return view(rowOf(id));
  }

  function update(user, id, body = {}) {
    const row = mustRow(id);
    const next = { ...row };
    if (body.bankName !== undefined) next.bank_name = requiredName(body.bankName, "Banka Adı");
    if (body.name !== undefined) next.name = requiredName(body.name, "Hesap Adı");
    if (body.code !== undefined) next.code = codeOf(body.code, row.id);
    if (body.iban !== undefined) next.iban = ibanOf(body.iban, row.id);
    Object.assign(next, infoOf(body, row));
    if (body.creditLimit !== undefined) next.credit_limit_minor = limitOf(body.creditLimit);
    if (body.negativePolicy !== undefined) next.negative_policy = policyOf(body.negativePolicy);
    if (body.balanceConfirmed !== undefined) next.balance_confirmed = body.balanceConfirmed ? 1 : 0;
    if (body.position !== undefined) {
      const position = Number(body.position);
      if (!Number.isInteger(position) || position < 0 || position > 100000) throw new HttpError(400, "Sıra 0 ya da artı tamsayı olmalı.", { code: "bank-position", field: "position" });
      next.position = position;
    }
    let reopen = null;
    if (body.kind !== undefined || body.currency !== undefined) {
      const { kind, currency } = kindCurrency(body.kind ?? (row.kind === "fx" ? "demand" : row.kind), body.currency ?? row.currency);
      if (kind !== row.kind || currency !== row.currency) {
        if (KIND_GL[kind] !== row.gl) throw new HttpError(409, `${ACCOUNT_KINDS[row.kind].label} hesap ${ACCOUNT_KINDS[kind].label} türüne çevrilemez (ana ve alt hesap kodu değişmez). Yeni hesap açın.`, { code: "bank-kind-family", field: "kind" });
        const opening = openingOf(row.id);
        if (movementInfo(row.id).count || opening?.lines) throw new HttpError(409, "Bu hesabın hareketi ya da açılış bakiyesi var; türü ve para birimi değiştirilemez. Yeni hesap açın.", { code: "bank-account-has-movements" });
        next.kind = kind;
        next.currency = currency;
        // Sıfır açılışın para birimi yenilenir (satırsız açılış iptal, yenisi yeni para biriminde).
        if (opening) reopen = opening;
      }
    }
    const changed = Object.keys(next).filter(key => next[key] !== row[key]);
    if (!changed.length) return view(row);
    const previous = Object.fromEntries(changed.map(key => [key, row[key]]));
    bank.post({
      user, module: "bank", op: "update", prev: previous,
      write: () => {
        const columns = [...changed, "updated_by", "updated_at"];
        const values = [...changed.map(key => next[key]), user.id, stamp()];
        store.run(`UPDATE bank_accounts SET ${columns.map(key => `${key} = ?`).join(", ")} WHERE id = ?`, ...values, row.id);
        if (reopen) {
          bank.cancelBare(reopen.eventId);
          writeOpening(rowOf(row.id), { date: reopen.date, amount: 0, tryMinor: 0, rateE6: 1_000_000, rateSource: "" });
        }
        return { id: row.id };
      },
      audit: { type: "bank.account.updated", entityId: row.id, payload: { previous, next: Object.fromEntries(changed.map(key => [key, next[key]])) } },
    });
    return view(rowOf(row.id));
  }

  function setStatus(user, id, status) {
    const row = mustRow(id);
    if (!STATUSES.includes(status)) throw new HttpError(400, "Hesap durumu Etkin ya da Pasif olmalı.", { code: "bank-status", field: "status" });
    if (row.status === status) return view(row);
    bank.post({
      user, module: "bank", op: "update", prev: { status: row.status },
      write: () => {
        store.run("UPDATE bank_accounts SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?", status, user.id, stamp(), row.id);
        return { id: row.id };
      },
      audit: { type: status === "passive" ? "bank.account.passive" : "bank.account.active", entityId: row.id, payload: { previous: { status: row.status }, next: { status } } },
    });
    return view(rowOf(row.id));
  }

  /**
   * Hesap sil: yalnız hesaba bağlı hareketi olmayan hesap (açılış dışında). Açılışı varsa ters kaydedilir (sıfır açılış iptal); açılış kilitli
   * dönemdeyse 409. Silinen hesabın alt hesap kodu yeniden kullanılmaz; aynı ad, kod ve IBAN'la yeni hesap açılabilir.
   */
  function remove(user, id) {
    const row = mustRow(id);
    const moves = movementInfo(row.id);
    if (moves.count) throw new HttpError(409, `Bu hesaba bağlı ${moves.count} hareket var; hesap silinmez. Kullanılmayacaksa Pasife Alın.`, { code: "bank-account-has-movements", count: moves.count });
    const opening = openingOf(row.id);
    if (opening) period?.assertOpen(opening.date, "Bu hesabın açılışı");
    let reversed = null;
    bank.post({
      user, module: "bank", op: "delete", prev: { id: row.id, code: row.code, opening },
      write: () => {
        if (opening) {
          const result = bank.reverse(opening.eventId, { date: opening.date, description: `Hesap Silindi · ${labelOf(row)}` });
          reversed = result.cancelled ? null : result.no;
        }
        store.run("UPDATE bank_accounts SET deleted_at = ?, deleted_by = ?, updated_by = ?, updated_at = ? WHERE id = ?", stamp(), user.id, user.id, stamp(), row.id);
        return { id: row.id };
      },
      audit: { type: "bank.account.deleted", entityId: row.id, payload: { code: row.code, label: labelOf(row) } },
    });
    return { deleted: true, reversed };
  }

  /** Açılış Bakiyesi Gir (açılışsız hesap) / Açılışı Düzelt (ters kayıt + yeni; bank.cancel gerekir — rota denetler). */
  function setOpening(user, id, body = {}) {
    const row = mustRow(id);
    const existing = openingOf(row.id);
    const opening = openingInput(body, row, { confirmedDefault: Boolean(row.balance_confirmed) });
    if (existing) {
      period?.assertOpen(existing.date, "Bu hesabın açılışı");
      if (existing.date === opening.date && existing.amountMinor === opening.amount && existing.tryMinor === opening.tryMinor) {
        if (Boolean(row.balance_confirmed) !== opening.confirmed) update(user, row.id, { balanceConfirmed: opening.confirmed });
        return { account: view(rowOf(row.id)), reversed: null };
      }
    }
    assertBeforeFirst(row.id, opening.date);
    let reversed = null;
    bank.post({
      user, module: "bank", op: existing ? "update" : "create", prev: existing || undefined,
      write: () => {
        if (existing) {
          bank.reverse(existing.eventId, { date: existing.date, description: `Açılışı Düzelt · ${existing.no}` });
          reversed = existing.no;
        }
        store.run("UPDATE bank_accounts SET opening_date = ?, balance_confirmed = ?, updated_by = ?, updated_at = ? WHERE id = ?", opening.date, opening.confirmed ? 1 : 0, user.id, stamp(), row.id);
        const event = writeOpening(rowOf(row.id), opening);
        return { id: event.id };
      },
      audit: { type: existing ? "bank.account.opening.corrected" : "bank.account.opening.entered", entityId: row.id, payload: { ...(existing ? { previous: { date: existing.date, amountMinor: existing.amountMinor, no: existing.no } } : {}), next: { date: opening.date, amountMinor: opening.amount, tryMinor: opening.tryMinor, confirmed: opening.confirmed } } },
    });
    return { account: view(rowOf(row.id)), reversed };
  }

  // ---------- Liste, özet, seçici ----------
  function list({ status = "" } = {}) {
    const rows = store.all("SELECT * FROM bank_accounts WHERE deleted_at IS NULL ORDER BY position, created_at");
    const groups = money.groups();
    const shown = rows.filter(row => !status || status === "all" || row.status === status);
    return { accounts: shown.map(row => view(row, { groups })), totals: totalsOf(groups, rows) };
  }
  function totalsOf(groups = money.groups(), rows = store.all("SELECT * FROM bank_accounts WHERE deleted_at IS NULL")) {
    const kindOf = new Map(store.all("SELECT id, kind FROM bank_accounts").map(row => [row.id, row.kind]));
    let realBank = 0;
    let unassignedBank = 0;
    let unassignedCard = 0;
    let cardDebt = 0;
    let loanDebt = 0;
    for (const group of groups) {
      const cents = Number(group.cents);
      if (group.way === "bank" && group.ref && KIND_GL[kindOf.get(group.ref)] === "102") realBank += cents;
      else if (group.way === "bank" && !group.ref) unassignedBank += cents;
      else if (group.way === "card" && !group.ref) unassignedCard += cents;
      else if (group.way === "ccard") cardDebt -= cents;
      else if (group.way === "loan") loanDebt -= cents;
    }
    const tl = balances(groups);
    const byCurrency = new Map();
    for (const row of rows) {
      if (KIND_GL[row.kind] !== "102") continue;
      const current = byCurrency.get(row.currency) || { currency: row.currency, fxMinor: 0, tryMinor: 0 };
      const cents = tl.get(row.id) || 0;
      current.tryMinor += cents;
      current.fxMinor += fxBalanceOf(row, cents);
      byCurrency.set(row.currency, current);
    }
    return { realBankMinor: realBank, unassignedBankMinor: unassignedBank, unassignedCardMinor: unassignedCard, cardDebtMinor: cardDebt, loanDebtMinor: loanDebt, byCurrency: [...byCurrency.values()] };
  }
  function repairReport() {
    try {
      return JSON.parse(store.setting("meta.bank.repair", "") || "{}") || {};
    } catch {
      return {};
    }
  }
  function summary() {
    const rows = store.all("SELECT * FROM bank_accounts WHERE deleted_at IS NULL");
    const totals = totalsOf(money.groups(), rows);
    const bankRows = rows.filter(row => KIND_GL[row.kind] === "102");
    const runs = store.get("SELECT COUNT(*) AS n FROM bank_jobs WHERE kind = 'setup' AND status = 'done'").n;
    const unassigned = totals.unassignedBankMinor + totals.unassignedCardMinor;
    return {
      labels: K10_LABELS,
      realBank: { minor: totals.realBankMinor, defined: bankRows.length > 0 },
      posPending: { netMinor: 0, blockedMinor: 0 },
      debt: { cardMinor: totals.cardDebtMinor, loanMinor: totals.loanDebtMinor, totalMinor: totals.cardDebtMinor + totals.loanDebtMinor },
      unassigned: { bankMinor: totals.unassignedBankMinor, cardMinor: totals.unassignedCardMinor, totalMinor: unassigned, newCount: Number(repairReport().unassigned) || 0 },
      byCurrency: totals.byCurrency,
      accounts: { count: rows.length, active: rows.filter(row => row.status === "active").length },
      setup: { needed: bankRows.length === 0 || (unassigned !== 0 && !runs), runs: Number(runs) || 0, suggestions: invoiceBankSuggestions(rows) },
    };
  }
  /** Fatura Ayarları'ndaki eski banka listesi (E2.16): henüz hesap olarak açılmamış IBAN'lar "Hesap Olarak Aç" önerisi. */
  function invoiceBankSuggestions(rows) {
    let banks = [];
    try {
      banks = JSON.parse(store.setting("invoice.settings", "{}") || "{}")?.seller?.banks || [];
    } catch {
      banks = [];
    }
    const have = new Set(rows.map(row => row.iban).filter(Boolean));
    return (Array.isArray(banks) ? banks : []).map(item => ({ bankName: String(item?.name || ""), iban: normalizeIban(item?.iban) })).filter(item => item.iban && !have.has(item.iban));
  }
  function choices() {
    const rows = store.all("SELECT * FROM bank_accounts WHERE deleted_at IS NULL AND status = 'active' ORDER BY position, created_at");
    const accounts = rows.map(row => ({ id: row.id, code: row.code, label: labelOf(row), bankName: row.bank_name, name: row.name, kind: row.kind, kindLabel: ACCOUNT_KINDS[row.kind]?.label || row.kind, currency: row.currency, glSub: row.gl_sub }));
    const preferred = settings.read().account.defaultAccountId;
    const formOf = (filter, preferId = "") => {
      const ids = rows.filter(filter).map(row => row.id);
      const fallback = rows.find(row => filter(row) && row.kind === "demand")?.id || ids[0] || "";
      return { ids, single: ids.length === 1, required: ids.length > 0, defaultId: preferId && ids.includes(preferId) ? preferId : fallback };
    };
    return {
      accounts,
      forms: {
        bank: formOf(bankFormOk, preferred),
        card: formOf(row => row.kind === "card"),
        fx: formOf(row => row.kind === "fx"),
      },
    };
  }

  // ---------- Hesabı Atanmamış Eski Hareketler ----------
  const tableOfLine = line => SOURCE_TABLE.get(Number(line.src));
  /** Hesabı atanmamış satırlar (tek kaynaktan; bağsız havale ve POS/kart). way: bank | card | "" (ikisi). */
  function legacyLines(way = "") {
    const ways = way === "bank" ? ["bank"] : way === "card" ? ["card"] : ["bank", "card"];
    return money.lines({ ways }).filter(line => !line.ref && Number(line.src) !== 9);
  }
  function legacy({ way = "", limit = 1000 } = {}) {
    if (way && !["bank", "card"].includes(way)) throw new HttpError(400, "Yol Banka (bank) ya da POS / Kart (card) olmalı.", { code: "bank-legacy-way" });
    const max = Math.max(1, Math.min(10000, Number(limit) || 1000));
    const locked = lock();
    const lines = legacyLines(way).sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1));
    const ids = [...new Set(lines.map(line => line.event_id).filter(Boolean))];
    const numbers = new Map(ids.length ? store.all("SELECT id, no FROM fin_events WHERE id IN (SELECT value FROM json_each(?))", JSON.stringify(ids)).map(row => [row.id, row.no]) : []);
    const rows = lines.slice(0, max).map(line => {
      const extra = parseExtra(line.extra);
      const isLocked = Boolean(locked) && line.date <= locked;
      return {
        table: tableOfLine(line),
        id: line.id,
        date: line.date,
        kind: line.kind,
        amountMinor: Number(line.cents),
        method: line.method,
        way: line.way,
        partyId: line.party_id || "",
        partyName: extra.accountName || extra.planName || extra.caseTitle || "",
        description: extra.description || extra.note || "",
        eventId: line.event_id || "",
        eventNo: numbers.get(line.event_id) || "",
        locked: isLocked,
        assignable: line.way === "bank" && !isLocked,
      };
    });
    const groups = money.groups();
    const sum = target => groups.filter(group => group.way === target && !group.ref).reduce((total, group) => total + Number(group.cents), 0);
    return { rows, count: lines.length, lockedCount: lines.filter(line => locked && line.date <= locked).length, totals: { bankMinor: sum("bank"), cardMinor: sum("card") }, newCount: Number(repairReport().unassigned) || 0 };
  }
  /** Havale seçicisinde seçilebilen (eski havaleyi alabilen) hesap: etkin, TL, Vadesiz/Ticari/Diğer. */
  function bindable(id) {
    const row = rowOf(id);
    if (!row) throw new HttpError(404, "Banka hesabı bulunamadı.", { code: "bank-account-missing" });
    if (!bankFormOk(row)) throw new HttpError(400, `${labelOf(row)}: eski havale hareketleri yalnız etkin TL Vadesiz, Ticari ya da Diğer hesaba bağlanır.`, { code: "bank-account-invalid", accountId: row.id });
    return row;
  }
  /** Bağlanacak satırın denetimi: tablo, var/görünür, yol havale, bağsız, açılıştan sonra, açık dönemde. Dönüş: tam satır. */
  function legacyRow(item, account) {
    const table = text(item?.table);
    if (!MODULE_TABLES.includes(table)) throw new HttpError(400, `Tanınmayan hareket tablosu (${table.slice(0, 30)}).`, { code: "bank-legacy-table" });
    const id = limited(item?.id, 120, "Hareket");
    const row = store.get(`SELECT * FROM ${table} WHERE id = ?`, id);
    const visible = row ? money.lines({ ids: { [table]: [id] }, light: true }) : [];
    if (!row || !visible.length) throw new HttpError(404, "Hareket bulunamadı (silinmiş ya da carisi/kartı silinmiş olabilir).", { code: "bank-legacy-missing", id });
    const line = visible[0];
    if (line.way !== "bank") throw new HttpError(400, "Yalnız havale/EFT hareketi banka hesabına bağlanır; POS ve kart hareketleri için Bankaya Geçmiş Say ya da Kart Borcuna Aktar.", { code: "bank-legacy-way", id });
    if (row.fin_ref) throw new HttpError(409, "Bu hareket zaten bir banka hesabına bağlı.", { code: "bank-already-assigned", id });
    if (row.date < account.opening_date) throw new HttpError(409, `Hareket (${row.date.split("-").reverse().join(".")}) hesabın açılışından (${account.opening_date.split("-").reverse().join(".")}) önce; açılış bakiyesinin içindedir. Kurulum Sihirbazı'ndaki Devir Kapanışı'yla kapanır.`, { code: "bank-before-opening", id });
    period?.assertOpen(row.date, "Bu hareket");
    return { table, row };
  }
  /** Satırı hesaba bağlar ya da bağı kaldırır (ref ''); olayı yoksa İşlem No'lu olay açar. Kasa ↔ Banka ikizinin nakit bacağı aynı olayı taşır. */
  function bindRow(table, row, ref) {
    const eventId = bank.eventFor(table, row);
    store.run(`UPDATE ${table} SET fin_ref = ?, event_id = ? WHERE id = ?`, ref, eventId, row.id);
    if (table === "cash_entries" && row.transfer_id) {
      const twin = store.get("SELECT id, event_id AS eventId FROM cash_entries WHERE transfer_id = ? AND id <> ?", row.transfer_id, row.id);
      if (twin && !twin.eventId) store.run("UPDATE cash_entries SET event_id = ? WHERE id = ?", eventId, twin.id);
    }
    return eventId;
  }
  function assign(user, body = {}, { requestId = "" } = {}) {
    if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 5000) throw new HttpError(400, "Bağlanacak hareketleri seçin (en çok 5.000).", { code: "bank-legacy-rows" });
    const account = bindable(body.accountId);
    const previous = [];
    const result = bank.post({
      user, module: "bank", op: "assign", requestId, scope: "bank.legacy.assign", body, prev: previous,
      write: () => {
        // Satır denetimleri işlemin içinde (istek kimliğiyle yinelenen istek önce yanıtını alır; aynı anda iki atama).
        const items = body.rows.map(item => legacyRow(item, account));
        for (const item of items) {
          previous.push({ table: item.table, id: item.row.id, fin_ref: item.row.fin_ref, event_id: item.row.event_id });
          bindRow(item.table, store.get(`SELECT * FROM ${item.table} WHERE id = ?`, item.row.id), account.id);
        }
        return { id: account.id, assigned: items.length };
      },
      audit: { type: "bank.legacy.assigned", entityId: account.id, payload: { rows: body.rows.map(item => `${text(item?.table)}:${text(item?.id)}`), previous } },
    });
    if (result?.replayed) return { replayed: true, assigned: 0 };
    return { assigned: result.assigned, account: view(rowOf(account.id)) };
  }

  // ---------- Kurulum ve Aktarım Sihirbazı (§10.3) ----------
  // Devir Kapanışı zinciri (açılış gününde yazılmış Devir Kapanışı fişleri ve ters kayıtları): bir sonraki çalışmada "D'den önceki bakiye" bu
  // fişleri de sayar — aynı bakiye ikinci kez kapanmaz.
  function carryChainIds(date) {
    return new Set(store.all("SELECT e.id FROM fin_events e WHERE e.date = ? AND (e.type = 'carry_close' OR (e.type = 'reversal' AND EXISTS (SELECT 1 FROM fin_events o WHERE o.id = e.reversal_of AND o.type = 'carry_close')))", date).map(row => row.id));
  }
  /** D'den önceki Hesabı Atanmamış bakiyeler (kuruş, işaretli): { bank (102.00), card (108.00) }. */
  function carryOf(date) {
    const chain = carryChainIds(date);
    const out = { bank: 0, card: 0 };
    for (const line of money.lines({ ways: ["bank", "card"], light: true })) {
      if (line.ref) continue;
      if (line.date < date || (Number(line.src) === 9 && line.date === date && chain.has(line.event_id))) out[line.way === "bank" ? "bank" : "card"] += (line.kind === "in" ? 1 : -1) * Number(line.cents);
    }
    return out;
  }
  function setupPlan(body = {}) {
    const account = bindable(body.accountId);
    const opening = openingOf(account.id);
    if (!opening) throw new HttpError(409, "Önce hesabın açılış bakiyesini girin (Açılış Bakiyesi Gir).", { code: "bank-opening-missing" });
    const date = opening.date;
    const carry = body.carryClose === false ? { bank: 0, card: 0 } : carryOf(date);
    const locked = lock();
    const candidates = legacyLines("bank").filter(line => line.date >= date);
    let rows;
    if (body.assign === "none" || body.assign === false) rows = [];
    else if (Array.isArray(body.assign)) {
      const wanted = new Set(body.assign.map(item => `${text(item?.table)}:${text(item?.id)}`));
      rows = candidates.filter(line => wanted.has(`${tableOfLine(line)}:${line.id}`));
      if (rows.length !== wanted.size) throw new HttpError(400, "Seçilen hareketlerden bazıları bu hesaba bağlanamaz (açılıştan önce, POS/kart ya da zaten bağlı).", { code: "bank-legacy-rows" });
    } else rows = candidates;
    const skipped = { locked: rows.filter(line => locked && line.date <= locked).length };
    rows = rows.filter(line => !(locked && line.date <= locked));
    const net = rows.reduce((sum, line) => sum + (line.kind === "in" ? 1 : -1) * Number(line.cents), 0);
    const groups = money.groups();
    const sum = (way, ref) => groups.filter(group => group.way === way && group.ref === ref).reduce((total, group) => total + Number(group.cents), 0);
    return {
      account,
      opening,
      date,
      carry,
      rows,
      preview: {
        accountId: account.id,
        date,
        carry: { bankMinor: carry.bank, cardMinor: carry.card },
        assign: { rows: rows.map(line => ({ table: tableOfLine(line), id: line.id, date: line.date, kind: line.kind, amountMinor: Number(line.cents) })), count: rows.length, amountMinor: net },
        skipped,
        after: { unassignedBankMinor: sum("bank", "") - carry.bank - net, unassignedCardMinor: sum("card", "") - carry.card, accountMinor: sum("bank", account.id) + net },
      },
    };
  }
  function setup(user, body = {}, { dryRun = false, requestId = "" } = {}) {
    if (dryRun) return setupPlan(body).preview;
    bindable(body.accountId);
    const previous = [];
    const auditPayload = { previous };
    const result = bank.post({
      user, module: "bank", op: "assign", requestId, scope: "bank.setup", body, prev: previous,
      write: () => {
        // Plan işlemin içinde kurulur: istek kimliğiyle yinelenen istek önce yanıtını alır; aynı anda iki sihirbaz aynı bakiyeyi iki kez kapatamaz.
        const { account, date, carry, rows } = setupPlan(body);
        if (!carry.bank && !carry.card && !rows.length) throw new HttpError(409, "Aktarılacak eski hareket yok: açılıştan önceki Hesabı Atanmamış bakiye sıfır ve açılıştan sonra bağlanacak havale hareketi yok.", { code: "bank-setup-empty" });
        if (carry.bank || carry.card) period?.assertOpen(date, "Devir Kapanışı (açılış günü)");
        for (const line of rows) previous.push({ table: tableOfLine(line), id: line.id, fin_ref: "", event_id: line.event_id });
        Object.assign(auditPayload, { date, carry: { bankMinor: carry.bank, cardMinor: carry.card }, assigned: rows.length });
        const header = bank.voucher({ type: "legacy_assign", date, bankRef: account.id, origin: "wizard", description: `Kurulum ve Aktarım Sihirbazı · ${labelOf(account)}` }, []);
        let carryEvent = null;
        if (carry.bank || carry.card) {
          const lines = carryLines(carry);
          assertLines(lines);
          carryEvent = bank.voucher({ type: "carry_close", date, origin: "wizard", description: "Devir Kapanışı · Hesabı Atanmamış Eski Hareketler" }, lines);
        }
        const bound = [];
        for (const line of rows) {
          const table = tableOfLine(line);
          const row = store.get(`SELECT * FROM ${table} WHERE id = ?`, line.id);
          if (!row || row.fin_ref) continue;
          bindRow(table, row, account.id);
          bound.push({ table, id: row.id });
        }
        writeJob(user, header, { accountId: account.id, date, carry: { bankMinor: carry.bank, cardMinor: carry.card }, carryEventId: carryEvent?.id || "", rows: bound });
        return { id: header.id, no: header.no, assigned: bound.length, carryNo: carryEvent?.no || "", carry: { bankMinor: carry.bank, cardMinor: carry.card } };
      },
      audit: { type: "bank.setup", entityId: String(body.accountId || ""), payload: auditPayload },
    });
    if (result?.replayed) return { replayed: true, id: result.refId };
    return result;
  }
  function writeJob(user, header, payload) {
    store.run("INSERT INTO bank_jobs (id, kind, due_date, ref, payload_json, status, done_ref, created_by, created_at) VALUES (?, 'setup', ?, ?, ?, 'done', ?, ?, ?)", `job-${randomUUID()}`, payload.date, header.id, JSON.stringify(payload), header.no, user.id, stamp());
  }
  function runs() {
    return store
      .all("SELECT j.id AS jobId, j.ref, j.status, j.payload_json AS payload, j.created_by AS createdBy, j.created_at AS createdAt, e.no, e.date FROM bank_jobs j LEFT JOIN fin_events e ON e.id = j.ref WHERE j.kind = 'setup' ORDER BY j.created_at DESC")
      .map(row => {
        const payload = parseExtra(row.payload);
        const account = rowOf(payload.accountId, { deleted: true });
        return { id: row.ref, no: row.no || "", date: row.date || payload.date || "", accountId: payload.accountId || "", accountLabel: account ? labelOf(account) : "", status: row.status === "done" ? "active" : "undone", assigned: (payload.rows || []).length, carry: payload.carry || null, reclass: payload.reclass || null, createdBy: row.createdBy, createdAt: row.createdAt };
      });
  }
  /** Sihirbazı (ya da Bankaya Geçmiş Say / Kart Borcuna Aktar'ı) Geri Al: fişler ters kaydedilir, bağlar kaldırılır; tek işlem. */
  function undo(user, id) {
    const job = store.get("SELECT * FROM bank_jobs WHERE kind = 'setup' AND ref = ?", String(id || ""));
    if (!job) throw new HttpError(404, "Kurulum kaydı bulunamadı.", { code: "bank-setup-missing" });
    if (job.status !== "done") throw new HttpError(409, "Bu kurulum zaten geri alınmış.", { code: "bank-setup-undone" });
    const payload = parseExtra(job.payload_json);
    period?.assertOpen(payload.date, "Bu kurulum");
    const reversed = [];
    let unassigned = 0;
    let skipped = 0;
    bank.post({
      user, module: "bank", op: "assign", prev: payload,
      write: () => {
        for (const eventId of [payload.carryEventId, payload.reclassEventId].filter(Boolean)) {
          const event = store.get("SELECT status, date FROM fin_events WHERE id = ?", eventId);
          if (!event || event.status !== "active") continue;
          reversed.push(bank.reverse(eventId, { date: event.date, description: "Kurulum Geri Alındı" }).no);
        }
        for (const item of payload.rows || []) {
          if (!MODULE_TABLES.includes(item.table)) continue;
          const row = store.get(`SELECT * FROM ${item.table} WHERE id = ?`, item.id);
          if (!row || row.fin_ref !== payload.accountId) {
            skipped += 1;
            continue;
          }
          period?.assertOpen(row.date, "Bağlanan hareket");
          bindRow(item.table, row, "");
          unassigned += 1;
        }
        bank.cancelBare(job.ref);
        store.run("UPDATE bank_jobs SET status = 'undone', updated_by = ?, updated_at = ? WHERE id = ?", user.id, stamp(), job.id);
        return { id: job.ref };
      },
      audit: { type: "bank.setup.undone", entityId: job.ref, payload: { previous: payload } },
    });
    return { undone: true, unassigned, skipped, reversed };
  }

  /**
   * Hesabı atanmamış POS/kart bakiyesinin aktarımı (§10.3): mode "bank" = Bankaya Geçmiş Say (B 102.k / A 108.00; 108.00'ın artı bakiyesinden),
   * "card" = Kart Borcuna Aktar (B 108.00 / A 309.k; 108.00'ın eksi bakiyesinden). Geri alınabilir (Kurulum kaydı).
   */
  function reclass(user, body = {}, { requestId = "" } = {}) {
    const mode = text(body.mode);
    if (!["bank", "card"].includes(mode)) throw new HttpError(400, "Aktarım Bankaya Geçmiş Say (bank) ya da Kart Borcuna Aktar (card) olmalı.", { code: "bank-legacy-mode", field: "mode" });
    const account = rowOf(body.accountId);
    if (!account) throw new HttpError(404, "Banka hesabı bulunamadı.", { code: "bank-account-missing" });
    if (mode === "bank" ? !bankFormOk(account) : !(account.kind === "card" && account.status === "active")) throw new HttpError(400, mode === "bank" ? `${labelOf(account)}: POS bakiyesi yalnız etkin TL Vadesiz, Ticari ya da Diğer hesaba aktarılır.` : `${labelOf(account)} kurumsal kredi kartı hesabı değil.`, { code: "bank-account-invalid" });
    const date = period ? period.movementDate(body, { label: "Tarih" }) : today();
    if (date < account.opening_date) throw new HttpError(409, `Tarih hesabın açılışından (${account.opening_date.split("-").reverse().join(".")}) önce olamaz.`, { code: "bank-before-opening" });
    const amount = parseMinor(body.amount, { label: "Tutar" });
    const lines = reclassLines(mode, accountShape(account), amount);
    assertLines(lines);
    const result = bank.post({
      user, module: "bank", op: "assign", requestId, scope: "bank.legacy.reclass", body, prev: { mode, accountId: account.id },
      write: () => {
        // 108.00'ın bu tarihe kadarki bakiyesi işlemin içinde okunur (aynı anda iki aktarım aynı bakiyeyi iki kez taşıyamaz).
        const pending = money.lines({ ways: ["card"], light: true }).filter(line => !line.ref && line.date <= date).reduce((sum, line) => sum + (line.kind === "in" ? 1 : -1) * Number(line.cents), 0);
        const available = mode === "bank" ? pending : -pending;
        if (amount > available) throw new HttpError(409, `Hesabı Atanmamış POS / Kart bakiyesi (108.00) ${mode === "bank" ? "tahsilat" : "kart borcu"} yönünde ${moneyText(Math.max(0, available))}; daha fazlası aktarılamaz.`, { code: "bank-legacy-exceeds", availableMinor: Math.max(0, available) });
        const header = bank.voucher({ type: "legacy_assign", date, bankRef: account.id, origin: "wizard", description: `${mode === "bank" ? "Bankaya Geçmiş Say" : "Kart Borcuna Aktar"} · ${labelOf(account)}` }, []);
        const event = bank.voucher({ type: "legacy_reclass", date, bankRef: account.id, origin: "wizard", description: `${mode === "bank" ? "Bankaya Geçmiş Say" : "Kart Borcuna Aktar"} · Hesabı Atanmamış POS / Kart` }, lines);
        writeJob(user, header, { accountId: account.id, date, reclass: { mode, amountMinor: amount }, reclassEventId: event.id, rows: [] });
        return { id: header.id, no: event.no };
      },
      audit: { type: "bank.legacy.reclassed", entityId: account.id, payload: { mode, amountMinor: amount, date } },
    });
    if (result?.replayed) return { replayed: true, id: result.refId };
    return result;
  }

  // ---------- Alt Hesap Mizanı (rapor verisi) ----------
  function subTrialData({ from = "", to = "" } = {}) {
    if ((from && !isDate(from)) || (to && !isDate(to))) throw new HttpError(400, "Geçerli bir tarih aralığı seçin.", { code: "date-invalid" });
    const entries = ledger().build();
    const names = { ...UNASSIGNED_SUBS };
    for (const row of store.all("SELECT gl_sub AS sub, bank_name AS bankName, name FROM bank_accounts")) names[row.sub] = `${row.bankName} · ${row.name}`;
    for (const row of store.all("SELECT gl_sub AS sub, name FROM pos_terminals")) names[row.sub] = row.name;
    const rows = subTrial(entries, { from, to, names });
    const trial = trialBalance(entries, { from, to });
    const mains = ["102", "108", "300", "309"].map(account => {
      const main = trial.accounts.find(row => row.code === account);
      const subs = rows.filter(row => row.account === account);
      const subTotal = Math.round(subs.reduce((sum, row) => sum + Math.round(row.balance * 100), 0)) / 100;
      return { account, name: main?.name || "", balance: main?.balance || 0, subTotal, ok: Math.round((main?.balance || 0) * 100) === Math.round(subTotal * 100) };
    }).filter(item => item.balance || item.subTotal);
    return { rows, mains, from, to };
  }

  return { create, update, setStatus, remove, setOpening, list, summary, choices, legacy, assign, setup, runs, undo, reclass, subTrialData, settings, view, rowOf, openingOf, movementInfo };
}
