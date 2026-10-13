// POS (v2.2.0; docs/BANKA-MODULU-PLAN.md §4, Aşama 10–11) — sunucu servisi: POS kartı ve tarihli oran ızgarası, modül formlarında POS
// seçimi (module-ref.mjs pickRef'in kart yolu), bank.post'un POS kancası (adım 7: satış/iade, valör takvimi, void, İptal İadesi, yeniden
// planlama), valör kuyruğu (gün sonu net fişi, kilit kuralı, onay kipi), KDV kipinin komisyon kesintisi ve aylık taslak faturası, okuma uçları
// (POS İşlemleri, POS Ödeme Takvimi, nakit akışı kaynakları, ANLIK DURUM'un POS Bekleyen'i, İşlem Kartı) ve mutabakat denetimleri (pos:*).
//
// Temel kurallar (plan §4.2–§4.6):
//   - POS bir tahsilat YOLUDUR: modül satırı (cari tahsilatı, fatura peşini, kayıt/taksit tahsilatı, stok satışı) kart yoluyla ve fin_ref = POS
//     yazılır; satış anında B 108.T / A 120 (banka +0). Satır çıkışsa (satıştan iade, cari POS İadesi, stok müşteri iadesi, taksit iadesi) POS
//     İadesidir. Firmanın kartla ödemesi (alış, cari ödeme, stok alımı) Kredi Kartı hesabıdır (309), POS değil.
//   - Satış anındaki oran, vergi kipi, sabit ücret, ödeme biçimi, bağlı banka hesabı ve sağlayıcı carisi pos_sales'e KOPYALANIR: POS kartı ya da
//     oran sonradan değişse de geçmiş değişmez.
//   - Valör takvimi pos_items'tadır (lib/bank/pos-math.mjs). İade, asıl satışın bekleyen kalemlerine SONDAN BAŞA aynı valör gününde kendi
//     "refund" kalemiyle düşer (plan §4.6 "kalem brütü küçülür": gün fişinde ve takvimde net görünür; iade silinince iz kaybı olmadan geri
//     alınır — karar); bekleyen kalem yetmezse artanı iadenin kendi valörüne yazılır.
//   - Gün sonu: (POS, valör günü, bağlı hesap) başına TEK net Banka Fişi (pos_settlement). Kalemler koşullu UPDATE (status = 'pending') ile
//     bağlanır; BEGIN IMMEDIATE altında iki tetik aynı anda çalışsa da tek fiş oluşur. GET uçları yazmaz.
import { randomUUID } from "node:crypto";
import { HttpError, limited, text } from "../http.mjs";
import { addCalendarDays } from "../business-days.mjs";
import { createTrCalendar } from "../calendars/tr.mjs";
import { canUser } from "../permissions.mjs";
import { minorText, parseMinor, parsePpm, ppmText, toMinor } from "../minor.mjs";
import { eventCopy, eventRows } from "./event-copy.mjs";
import { directionOf } from "./event-types.mjs";
import { TAX_CHOICES, TAX_LABELS, dayTotals, defaultTaxFor, deductionOf, isVatKind, refundSchedule, saleSchedule, taxChoiceOf, valueDateOf, vatSplit } from "./pos-math.mjs";

/** Valör kuyruğunun (sistem) aktörü: işlem geçmişinde "Sistem (Valör)". */
export const SYSTEM_ACTOR = Object.freeze({ id: "system", role: "admin", display_name: "Sistem (Valör)" });
export const POS_KINDS = Object.freeze({ physical: "Fiziki POS", virtual: "Sanal POS", mobile: "Mobil POS" });
export const PROVIDER_KINDS = Object.freeze({ bank: "Banka", payment_institution: "Ödeme Kuruluşu" });
export const VALOR_RULES = Object.freeze({ business: "İş Günü", calendar: "Takvim Günü", same_day: "Aynı Gün" });
export const PAYOUTS = Object.freeze({ monthly: "Taksit Taksit (Her Ay)", single: "Tek Seferde", first_valor: "İlki Valör Gününde" });
export const REFUND_RULES = Object.freeze({ none: "İade Edilmez", proportional: "Oransal", full: "Tam" });
export const SETTLE_MODES = Object.freeze({ inherit: "Banka Ayarlarındaki Gibi", auto: "Otomatik (Valör Gününde)", statement: "Ekstre ile", manual: "Elle Onay" });
const OUTCOMES = new Set(["refunded", "entry-error", "void"]);
const BANK_FORM_KINDS = new Set(["demand", "commercial", "other"]);
const ROUND_GROUPS = 200;
const ROUND_MS = 1000;

const dayText = iso => (iso ? iso.split("-").reverse().join(".") : "");
const shortDay = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : "");
const bad = (status, message, code, extra = {}) => new HttpError(status, message, { code, ...extra });
const newId = prefix => `${prefix}-${randomUUID()}`;
const tl = minor => minorText(minor);
const installmentText = n => (Number(n) > 1 ? `${n} Taksit` : "Tek Çekim");

/**
 * POS satırının ek bilgisi (form/gövde): { installments, authCode, cardLast4, refundOf, sourceless }. Alan adları: installments (ya da
 * posInstallments), authCode, cardLast4, posRefundOf, posSourceless. Kart numarası saklanmaz; yalnız son 4 hane (CHECK).
 * @throws {HttpError} 400 pos-installments | pos-auth-code | pos-card-last4
 */
export function posMetaOf(source = {}) {
  if (!source || typeof source !== "object") return null;
  const raw = source.installments ?? source.posInstallments;
  const has = ["installments", "posInstallments", "authCode", "cardLast4", "posRefundOf", "posSourceless"].some(key => source[key] !== undefined && source[key] !== null && source[key] !== "");
  if (!has) return null;
  let installments = 1;
  if (raw !== undefined && raw !== null && raw !== "") {
    installments = Number(raw);
    if (!Number.isInteger(installments) || installments < 1 || installments > 36) throw bad(400, "POS taksit sayısı 1 (Tek Çekim) ile 36 arasında bir tamsayı olmalı.", "pos-installments", { field: "installments" });
  }
  const authCode = text(source.authCode).toUpperCase();
  if (authCode && !/^[A-Z0-9-]{1,20}$/.test(authCode)) throw bad(400, "Provizyon No en çok 20 karakter: harf, rakam ve tire.", "pos-auth-code", { field: "authCode" });
  const cardLast4 = text(source.cardLast4);
  if (cardLast4 && !/^\d{4}$/.test(cardLast4)) throw bad(400, "Kartın Son 4 Hanesi 4 rakam olmalı (kart numarasının tamamı yazılmaz).", "pos-card-last4", { field: "cardLast4" });
  return { installments, authCode, cardLast4, refundOf: text(source.posRefundOf).slice(0, 120), sourceless: source.posSourceless === true || source.posSourceless === "1" || source.posSourceless === 1 };
}

/**
 * @param {{ store, bank, money, period, settings: { read() }, audit, now, log?, invoices?: () => object, notify?: Function }} options
 */
export function createPos({ store, bank, money, period, settings, audit, now, log = null, invoices = () => null, notify = () => {} }) {
  const today = () => period.today();
  const lockDate = () => period.lockedUntil?.() || "";
  const stamp = () => now().toISOString();
  const has = name => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", name));
  let ready = null;
  const isReady = () => (ready ??= has("pos_terminals") && has("pos_items"));

  // ---------- Takvim (Banka Ayarları → Tatil + şirketin tatil ekleri; post.mjs businessDayOf ile aynı kaynak) ----------
  function calendar() {
    try {
      const raw = JSON.parse(store.setting("bank.settings", "") || "{}");
      const rows = has("bank_holidays") ? store.all("SELECT date, kind, name FROM bank_holidays") : [];
      return createTrCalendar({
        weekend: raw?.holidayAdvanced?.weekend === "sun" ? [0] : [6, 0],
        halfDayIsBusiness: raw?.holidayAdvanced?.halfDay !== "holiday",
        added: rows.filter(row => row.kind !== "removed").map(row => ({ date: row.date, name: row.name, half: row.kind === "half" })),
        removed: rows.filter(row => row.kind === "removed").map(row => row.date),
      });
    } catch {
      return createTrCalendar();
    }
  }
  const settingsOf = () => {
    try {
      return settings.read();
    } catch {
      return {};
    }
  };
  const commissionGl = () => settingsOf()?.gl?.commission || "653";

  // ---------- POS kartı ----------
  const terminal = id => (id ? store.get("SELECT * FROM pos_terminals WHERE id = ?", id) || null : null);
  const mustTerminal = id => {
    const row = terminal(text(id));
    if (!row || row.deleted_at) throw bad(404, "POS bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", "pos-missing", { field: "posId" });
    return row;
  };
  // usePos (İz 2.2, göç 21): "POS Kullan" işareti — POS yalnız işaretli hesaba bağlanır (İz 3.1).
  const bankRow = id => (id ? store.get("SELECT id, code, kind, bank_name AS bankName, name, currency, gl_sub AS glSub, status, deleted_at AS deletedAt, use_pos AS usePos FROM bank_accounts WHERE id = ?", id) || null : null);
  const partyRow = id => (id ? store.get("SELECT id, name, type, deleted_at AS deletedAt FROM accounts WHERE id = ?", id) || null : null);
  const rateRows = (posId, date = "") =>
    store.all(
      `SELECT r.installments, r.rate_ppm AS ratePpm, r.valor_days AS valorDays, r.valid_from AS validFrom FROM pos_rates r
       WHERE r.pos_id = ?1 ${date ? "AND r.valid_from <= ?2" : ""}
         AND r.valid_from = (SELECT MAX(x.valid_from) FROM pos_rates x WHERE x.pos_id = r.pos_id AND x.installments = r.installments ${date ? "AND x.valid_from <= ?2" : ""})
       ORDER BY r.installments`,
      ...(date ? [posId, date] : [posId]),
    );
  const rateFor = (posId, installments, date) =>
    store.get("SELECT rate_ppm AS ratePpm, valor_days AS valorDays, valid_from AS validFrom FROM pos_rates WHERE pos_id = ? AND installments = ? AND valid_from <= ? ORDER BY valid_from DESC LIMIT 1", posId, installments, date) || null;
  const settleModeOf = pos => {
    if (pos.settle_mode && pos.settle_mode !== "inherit") return pos.settle_mode;
    return settingsOf()?.posAdvanced?.settlement || "auto";
  };

  function terminalView(row, { history = false } = {}) {
    const account = bankRow(row.bank_account_id);
    const provider = partyRow(row.provider_account_id);
    const tax = taxChoiceOf(row);
    const current = rateRows(row.id, today());
    const pending = store.get(
      "SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN role = 'refund' THEN -gross_minor ELSE gross_minor END), 0) AS gross, COALESCE(SUM(planned_net_minor), 0) AS net FROM pos_items WHERE pos_id = ? AND status = 'pending'",
      row.id,
    );
    return {
      id: row.id,
      code: row.code,
      glSub: row.gl_sub,
      name: row.name,
      label: `${row.code} · ${row.name}`,
      bankName: row.bank_name,
      bankAccountId: row.bank_account_id,
      bankAccount: account ? { id: account.id, code: account.code, label: `${account.bankName} · ${account.name}`, glSub: account.glSub, status: account.status } : null,
      kind: row.kind,
      kindLabel: POS_KINDS[row.kind] || row.kind,
      providerKind: row.provider_kind,
      providerKindLabel: PROVIDER_KINDS[row.provider_kind] || row.provider_kind,
      tax,
      taxLabel: TAX_LABELS[tax],
      providerAccountId: row.provider_account_id,
      providerAccount: provider ? { id: provider.id, name: provider.name } : null,
      merchantNo: row.merchant_no,
      terminalNo: row.terminal_no,
      currency: row.currency,
      valorRule: row.valor_rule,
      valorRuleLabel: VALOR_RULES[row.valor_rule] || row.valor_rule,
      valorDays: row.valor_days,
      provisionDays: row.provision_days,
      blockDays: row.block_days,
      installmentPayout: row.installment_payout,
      installmentPayoutLabel: PAYOUTS[row.installment_payout] || row.installment_payout,
      refundCommission: row.refund_commission,
      refundCommissionLabel: REFUND_RULES[row.refund_commission] || row.refund_commission,
      settleMode: row.settle_mode,
      settleModeLabel: SETTLE_MODES[row.settle_mode] || row.settle_mode,
      effectiveSettleMode: settleModeOf(row),
      fixedFeeMinor: Number(row.fixed_fee_minor) || 0,
      integration: row.integration,
      status: row.status,
      statusLabel: row.status === "active" ? "Etkin" : "Pasif",
      description: row.description,
      rates: current.map(rate => ({ installments: rate.installments, label: installmentText(rate.installments), ratePpm: rate.ratePpm, rate: ppmText(rate.ratePpm), valorDays: rate.valorDays, validFrom: rate.validFrom })),
      startDate: store.get("SELECT MIN(valid_from) AS d FROM pos_rates WHERE pos_id = ?", row.id)?.d || "",
      pending: { count: Number(pending?.n) || 0, grossMinor: Number(pending?.gross) || 0, netMinor: Number(pending?.net) || 0 },
      // İz 3.1 (ekran): Sil'in nedeni önceden görünsün (kullanılmış POS silinmez) ve "Bekleyenleri Yeni Hesaba Taşı" yalnız bekleyen satışı eski
      // hesaba bağlı POS'ta çıksın.
      used: usedOf(row.id),
      pendingElsewhere: (() => {
        const other = store.get("SELECT COUNT(DISTINCT s.id) AS n, COALESCE(SUM(i.planned_net_minor), 0) AS net FROM pos_items i JOIN pos_sales s ON s.id = i.sale_id WHERE i.pos_id = ? AND i.status = 'pending' AND s.bank_account_id <> ?", row.id, row.bank_account_id);
        return { count: Number(other?.n) || 0, netMinor: Number(other?.net) || 0 };
      })(),
      ...(history ? { rateHistory: store.all("SELECT installments, rate_ppm AS ratePpm, valor_days AS valorDays, valid_from AS validFrom, created_by AS createdBy, created_at AS createdAt FROM pos_rates WHERE pos_id = ? ORDER BY valid_from DESC, installments", row.id).map(rate => ({ ...rate, rate: ppmText(rate.ratePpm), label: installmentText(rate.installments) })) } : {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at || "",
    };
  }
  function list({ status = "" } = {}) {
    if (!isReady()) return [];
    return store.all(`SELECT * FROM pos_terminals WHERE deleted_at IS NULL ${status === "active" ? "AND status = 'active'" : ""} ORDER BY gl_sub`).map(row => terminalView(row));
  }
  const detail = id => terminalView(mustTerminal(id), { history: true });

  // POS kartı alanları (talimat 12; plan §4.1). Varsayılanlar Banka Ayarları → POS'tan (yoksa kod varsayılanı).
  function terminalInput(body = {}, existing = null) {
    const defaults = settingsOf();
    const pick = (key, column, fallback) => (body[key] !== undefined ? body[key] : existing ? existing[column] : fallback);
    const name = limited(pick("name", "name", ""), 80, "POS Adı");
    if (!name) throw bad(400, "POS Adı yazın (ör. Ziraat Fiziki POS).", "pos-name", { field: "name" });
    const accountId = text(pick("bankAccountId", "bank_account_id", ""));
    const account = bankRow(accountId);
    if (!accountId || !account || account.deletedAt) throw bad(400, "Bağlı Hesap seçin: POS'un parası hangi banka hesabına geçiyor? (Vadesiz, Ticari ya da Diğer TL hesap.)", "pos-bank-account", { field: "bankAccountId" });
    if (account.status !== "active") throw bad(400, `${account.bankName} · ${account.name} pasif; POS'u etkin bir hesaba bağlayın.`, "pos-bank-account", { field: "bankAccountId" });
    if (account.currency !== "TRY" || !BANK_FORM_KINDS.has(account.kind)) throw bad(400, `${account.bankName} · ${account.name}: POS yalnız Vadesiz, Ticari ya da Diğer TL hesaba bağlanır.`, "pos-bank-account", { field: "bankAccountId" });
    // İz 3.1 (müşteri madde 6, 12.10.2026: POS bankanın içinden tanımlanır): POS yalnız "POS Kullan" işaretli hesaba bağlanır. Yalnız YENİ bağda
    // denetlenir (POS açma, bağlı hesabı değiştirme); bağı değişmeyen POS'un düzeltmesi işaretten bağımsız sürer (bağlı POS varken işaret zaten
    // kapatılamaz: 409 bank-flag-in-use). Karar: geriye uyum istisnası yok — POS uçları 2.2.0 ile geldi, yayımlanmış eski bir API yolu yok.
    if ((!existing || existing.bank_account_id !== account.id) && !Number(account.usePos)) throw bad(400, `${account.bankName} · ${account.name} hesabında “POS Kullan” işaretli değil; önce hesabın Düzenle'sinden “POS Kullan”ı işaretleyin (POS'lar o hesabın altında tanımlanır).`, "pos-account-flag", { field: "bankAccountId" });
    const kind = text(pick("kind", "kind", "physical")) || "physical";
    if (!POS_KINDS[kind]) throw bad(400, "POS Türü Fiziki, Sanal ya da Mobil olmalı.", "pos-kind", { field: "kind" });
    const providerKind = text(pick("providerKind", "provider_kind", "bank")) || "bank";
    if (!PROVIDER_KINDS[providerKind]) throw bad(400, "Sağlayıcı Türü Banka ya da Ödeme Kuruluşu olmalı.", "pos-provider-kind", { field: "providerKind" });
    const defaultTax = defaults?.pos?.taxMode && defaults.pos.taxMode !== "by_provider" ? defaults.pos.taxMode : defaultTaxFor(providerKind);
    const tax = text(body.tax !== undefined ? body.tax : existing && body.providerKind === undefined ? taxChoiceOf(existing) : defaultTax) || defaultTax;
    if (!TAX_CHOICES[tax]) throw bad(400, "Komisyon Vergisi BSMV Dahil, BSMV Hariç, KDV Dahil, KDV Hariç ya da Yok olmalı.", "pos-tax", { field: "tax" });
    const providerAccountId = text(pick("providerAccountId", "provider_account_id", ""));
    if (TAX_CHOICES[tax].taxKind === "vat") {
      const party = partyRow(providerAccountId);
      if (!providerAccountId || !party || party.deletedAt) throw bad(400, "KDV'li (faturalı) komisyonda Sağlayıcı Carisi zorunlu: komisyon faturası hangi cariden gelecek?", "pos-provider-account", { field: "providerAccountId" });
    } else if (providerAccountId) {
      const party = partyRow(providerAccountId);
      if (!party || party.deletedAt) throw bad(400, "Sağlayıcı Carisi bulunamadı.", "pos-provider-account", { field: "providerAccountId" });
    }
    const intOf = (key, column, fallback, min, max, label) => {
      const value = Number(pick(key, column, fallback));
      if (!Number.isInteger(value) || value < min || value > max) throw bad(400, `${label} ${min} ile ${max} arasında bir tamsayı olmalı.`, "pos-field", { field: key });
      return value;
    };
    const valorRule = text(pick("valorRule", "valor_rule", defaults?.pos?.valorRule || "business")) || "business";
    if (!VALOR_RULES[valorRule]) throw bad(400, "Valör Kuralı İş Günü, Takvim Günü ya da Aynı Gün olmalı.", "pos-field", { field: "valorRule" });
    const installmentPayout = text(pick("installmentPayout", "installment_payout", defaults?.posAdvanced?.installmentPayout || "monthly")) || "monthly";
    if (!PAYOUTS[installmentPayout]) throw bad(400, "Taksitli Satışta Ödeme Taksit Taksit, Tek Seferde ya da İlki Valör Gününde olmalı.", "pos-field", { field: "installmentPayout" });
    const refundCommission = text(pick("refundCommission", "refund_commission", defaults?.pos?.refundCommission || "none")) || "none";
    if (!REFUND_RULES[refundCommission]) throw bad(400, "İadede Komisyon İade Edilmez, Oransal ya da Tam olmalı.", "pos-field", { field: "refundCommission" });
    const settleMode = text(pick("settleMode", "settle_mode", "inherit")) || "inherit";
    if (!SETTLE_MODES[settleMode]) throw bad(400, "Bankaya Geçiş Otomatik, Ekstre ile ya da Elle Onay olmalı.", "pos-field", { field: "settleMode" });
    // Ekstre ve Mutabakat 2.3.0'da (plan §12.1, ertelenen görünmez): "Ekstre ile" bu sürümde seçilemez — kalemler eşleşecek ekstre olmadan
    // yalnız elle onayla geçerdi. Kayıtlı değer (yalnız geliştirme verisi) dokunulmadıkça kalır.
    if (settleMode === "statement" && (!existing || existing.settle_mode !== "statement")) throw bad(400, "“Ekstre ile” bankaya geçiş Ekstre ve Mutabakat ile gelir; şimdilik Otomatik ya da Elle Onay seçin.", "pos-settle-later", { field: "settleMode" });
    const fixedRaw = body.fixedFee !== undefined ? body.fixedFee : null;
    const fixedFee = fixedRaw === null ? (existing ? Number(existing.fixed_fee_minor) || 0 : 0) : parseMinor(fixedRaw === "" ? "0" : fixedRaw, { label: "Sabit İşlem Ücreti", allowZero: true });
    return {
      name,
      bank_account_id: account.id,
      bank_name: account.bankName,
      kind,
      provider_kind: providerKind,
      merchant_no: limited(pick("merchantNo", "merchant_no", ""), 40, "Üye İşyeri No"),
      terminal_no: limited(pick("terminalNo", "terminal_no", ""), 40, "Terminal No"),
      valor_rule: valorRule,
      valor_days: intOf("valorDays", "valor_days", defaults?.pos?.valorDays ?? 1, 0, 60, "Valör Günü"),
      provision_days: intOf("provisionDays", "provision_days", defaults?.posAdvanced?.provisionDays ?? 0, 0, 30, "Provizyon Süresi"),
      block_days: intOf("blockDays", "block_days", defaults?.posAdvanced?.blockDays ?? 0, 0, 365, "Bloke Süresi"),
      installment_payout: installmentPayout,
      tax_kind: TAX_CHOICES[tax].taxKind,
      tax_mode: TAX_CHOICES[tax].taxMode,
      tax_ppm: TAX_CHOICES[tax].taxPpm,
      provider_account_id: providerAccountId,
      refund_commission: refundCommission,
      settle_mode: settleMode,
      fixed_fee_minor: fixedFee,
      description: limited(pick("description", "description", ""), 300, "Açıklama"),
    };
  }
  /** Oran ızgarası girdisi: [{ installments, rate ("%2,5" / 2.5), valorDays? }] — taksit sayısı tekil, 1–36. */
  function ratesInput(list) {
    if (!Array.isArray(list) || !list.length) throw bad(400, "En az bir oran satırı girin (Tek Çekim ya da taksit).", "pos-rates", { field: "rates" });
    const seen = new Set();
    return list.slice(0, 36).map((item, index) => {
      const installments = Number(item?.installments);
      if (!Number.isInteger(installments) || installments < 1 || installments > 36) throw bad(400, `${index + 1}. oran satırı: taksit sayısı 1 (Tek Çekim) ile 36 arasında olmalı.`, "pos-rates", { field: "rates", line: index });
      if (seen.has(installments)) throw bad(400, `${installmentText(installments)} iki kez girildi; her taksit sayısının bir oranı olur.`, "pos-rates", { field: "rates", line: index });
      seen.add(installments);
      const ratePpm = item?.ratePpm !== undefined ? Number(item.ratePpm) : parsePpm(item?.rate, { label: `${installmentText(installments)} Oranı` });
      if (!Number.isInteger(ratePpm) || ratePpm < 0 || ratePpm > 1_000_000) throw bad(400, `${installmentText(installments)} oranı %0 ile %100 arasında olmalı.`, "pos-rates", { field: "rates", line: index });
      let valorDays = null;
      if (item?.valorDays !== undefined && item?.valorDays !== null && item?.valorDays !== "") {
        valorDays = Number(item.valorDays);
        if (!Number.isInteger(valorDays) || valorDays < 0 || valorDays > 400) throw bad(400, `${installmentText(installments)} valör günü 0 ile 400 arasında olmalı.`, "pos-rates", { field: "rates", line: index });
      }
      return { installments, ratePpm, valorDays };
    });
  }
  const validFromOf = value => {
    const date = text(value) || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad(400, "Geçerlilik Başlangıcı geçerli bir tarih değil.", "pos-rates", { field: "validFrom" });
    return date;
  };
  function writeRates(user, posId, validFrom, rates) {
    for (const rate of rates) {
      if (store.get("SELECT 1 AS found FROM pos_rates WHERE pos_id = ? AND installments = ? AND valid_from = ?", posId, rate.installments, validFrom)) {
        throw bad(409, `${installmentText(rate.installments)} için ${dayText(validFrom)} tarihinden geçerli oran zaten var; oran kaydı yerinde değiştirilmez, yeni bir tarih seçin.`, "pos-rate-exists", { field: "validFrom" });
      }
      store.run("INSERT INTO pos_rates (id, pos_id, installments, rate_ppm, valor_days, valid_from, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", newId("prate"), posId, rate.installments, rate.ratePpm, rate.valorDays, validFrom, user.id, stamp());
    }
  }
  const codeTaken = (code, exceptId = "") => Boolean(store.get("SELECT 1 AS found FROM pos_terminals WHERE code = ? COLLATE NOCASE AND deleted_at IS NULL AND id <> ?", code, exceptId));

  function create(user, body = {}, { requestId = "" } = {}) {
    const input = terminalInput(body);
    const rates = body.rates !== undefined ? ratesInput(body.rates) : null;
    if (rates && !canUser(user, "bank.commission")) throw bad(403, "POS oranlarını girmek için \"POS Komisyon Oranları\" yetkisi gerekir.", "bank-permission", { permission: "bank.commission" });
    const validFrom = validFromOf(body.validFrom);
    const id = newId("pos");
    const codeWanted = limited(body.code, 30, "POS Kodu");
    const result = bank.post({
      user, module: "bank", op: "create", requestId, scope: "bank.pos.create", body,
      write: () => {
        const used = store.all("SELECT gl_sub AS sub FROM pos_terminals").map(row => Number(String(row.sub).split(".")[1]) || 0);
        const number = Math.max(0, ...used) + 1;
        const glSub = `108.${String(number).padStart(2, "0")}`;
        let code = codeWanted;
        if (code && codeTaken(code)) throw bad(409, `${code} kodu başka bir POS'ta kullanılıyor; POS Kodu tekil olmalı.`, "pos-code-exists", { field: "code" });
        if (!code) {
          code = `POS-${String(number).padStart(2, "0")}`;
          for (let n = 2; codeTaken(code); n += 1) code = `POS-${String(number).padStart(2, "0")}-${n}`;
        }
        store.run(
          `INSERT INTO pos_terminals (id, code, gl_sub, name, bank_name, bank_account_id, kind, provider_kind, merchant_no, terminal_no, currency, valor_rule, valor_days, provision_days, block_days,
             installment_payout, tax_kind, tax_mode, tax_ppm, provider_account_id, refund_commission, settle_mode, fixed_fee_minor, integration, status, description, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TRY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'active', ?, ?, ?)`,
          id, code, glSub, input.name, input.bank_name, input.bank_account_id, input.kind, input.provider_kind, input.merchant_no, input.terminal_no, input.valor_rule, input.valor_days, input.provision_days,
          input.block_days, input.installment_payout, input.tax_kind, input.tax_mode, input.tax_ppm, input.provider_account_id, input.refund_commission, input.settle_mode, input.fixed_fee_minor, input.description, user.id, stamp(),
        );
        if (rates) writeRates(user, id, validFrom, rates);
        return { id };
      },
      audit: { type: "bank.pos.created", entityId: id, payload: { ...input, rates: rates || [], validFrom } },
    });
    const ref = result?.replayed ? result.refId : id;
    return { ...(result?.replayed ? { replayed: true } : {}), pos: terminal(ref) ? terminalView(terminal(ref)) : null };
  }
  function update(user, id, body = {}) {
    const row = mustTerminal(id);
    const input = terminalInput(body, row);
    bank.post({
      user, module: "bank", op: "update", prev: row,
      write: () => {
        store.run(
          `UPDATE pos_terminals SET name = ?, bank_name = ?, bank_account_id = ?, kind = ?, provider_kind = ?, merchant_no = ?, terminal_no = ?, valor_rule = ?, valor_days = ?, provision_days = ?, block_days = ?,
             installment_payout = ?, tax_kind = ?, tax_mode = ?, tax_ppm = ?, provider_account_id = ?, refund_commission = ?, settle_mode = ?, fixed_fee_minor = ?, description = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
          input.name, input.bank_name, input.bank_account_id, input.kind, input.provider_kind, input.merchant_no, input.terminal_no, input.valor_rule, input.valor_days, input.provision_days, input.block_days,
          input.installment_payout, input.tax_kind, input.tax_mode, input.tax_ppm, input.provider_account_id, input.refund_commission, input.settle_mode, input.fixed_fee_minor, input.description, user.id, stamp(), row.id,
        );
        return { id: row.id };
      },
      audit: { type: "bank.pos.updated", entityId: row.id, payload: { next: input } },
    });
    return terminalView(terminal(row.id), { history: true });
  }
  function setStatus(user, id, status) {
    const row = mustTerminal(id);
    if (status !== "active" && status !== "passive") throw bad(400, "Durum Etkin ya da Pasif olmalı.", "pos-field", { field: "status" });
    if (status === "active") {
      const account = bankRow(row.bank_account_id);
      if (!account || account.deletedAt || account.status !== "active") throw bad(400, "POS'un bağlı hesabı pasif ya da silinmiş; önce POS kartında etkin bir hesap seçin.", "pos-bank-account", { field: "bankAccountId" });
    }
    bank.post({
      user, module: "bank", op: "update", prev: row,
      write: () => {
        store.run("UPDATE pos_terminals SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?", status, user.id, stamp(), row.id);
        return { id: row.id };
      },
      audit: { type: status === "active" ? "bank.pos.activated" : "bank.pos.passivated", entityId: row.id, payload: { name: row.name } },
    });
    return terminalView(terminal(row.id));
  }
  /** POS kullanılmış mı (satış, modül satırı ya da fiş satırı var mı)? Kullanılmış POS silinmez (Pasife Alınır). */
  function usedOf(posId) {
    return Boolean(
      store.get("SELECT 1 AS found FROM pos_sales WHERE pos_id = ? LIMIT 1", posId) || store.get("SELECT 1 AS found FROM bank_lines WHERE ref = ? LIMIT 1", posId) ||
        ["payments", "account_entries", "plan_entries", "stock_moves", "cheque_events"].some(table => store.get(`SELECT 1 AS found FROM ${table} WHERE fin_ref = ? LIMIT 1`, posId)),
    );
  }
  /** Sil: yalnız hiç kullanılmamış POS (satış, modül satırı, fiş satırı yok); kullanılmışsa 409 pos-in-use → Pasife Al. */
  function remove(user, id) {
    const row = mustTerminal(id);
    const used = usedOf(row.id);
    if (used) throw bad(409, `${row.name} kullanılmış (satışı ya da hareketi var); silinmez. Kullanmayacaksanız Pasife Al.`, "pos-in-use");
    bank.post({
      user, module: "bank", op: "delete", prev: row,
      write: () => {
        store.run("UPDATE pos_terminals SET deleted_by = ?, deleted_at = ? WHERE id = ?", user.id, stamp(), row.id);
        return { id: row.id };
      },
      audit: { type: "bank.pos.deleted", entityId: row.id, payload: { name: row.name, code: row.code } },
    });
    return { id: row.id };
  }
  function addRates(user, id, body = {}) {
    const row = mustTerminal(id);
    const rates = ratesInput(body.rates);
    const validFrom = validFromOf(body.validFrom);
    bank.post({
      user, module: "bank", op: "create", scope: "bank.pos.rates", body,
      write: () => {
        writeRates(user, row.id, validFrom, rates);
        return { id: row.id };
      },
      audit: { type: "bank.pos.rates", entityId: row.id, payload: { validFrom, rates } },
    });
    return terminalView(terminal(row.id), { history: true });
  }
  /** "Bekleyenleri Yeni Hesaba Taşı" (§4.6): bekleyen kalemi olan satışların bağlı hesap kopyası POS kartındaki hesaba (ya da verilene). */
  function movePending(user, id, body = {}) {
    const row = mustTerminal(id);
    const target = bankRow(text(body.bankAccountId) || row.bank_account_id);
    if (!target || target.deletedAt || target.status !== "active" || target.currency !== "TRY" || !BANK_FORM_KINDS.has(target.kind)) throw bad(400, "Taşınacak hesap etkin bir Vadesiz, Ticari ya da Diğer TL hesap olmalı.", "pos-bank-account", { field: "bankAccountId" });
    if (target.id !== row.bank_account_id && !Number(target.usePos)) throw bad(400, `${target.bankName} · ${target.name} hesabında “POS Kullan” işaretli değil; bekleyenler yalnız POS Kullan işaretli hesaba taşınır.`, "pos-account-flag", { field: "bankAccountId" });
    let moved = 0;
    bank.post({
      user, module: "bank", op: "update", prev: { posId: row.id },
      write: () => {
        actorId = user.id;
        moved = setSale("bank_account_id = ?", "pos_id = ? AND bank_account_id <> ? AND status IN ('active', 'cancelled') AND id IN (SELECT sale_id FROM pos_items WHERE status = 'pending')", [target.id], [row.id, target.id]);
        return { id: row.id };
      },
      audit: { type: "bank.pos.pending-moved", entityId: row.id, payload: { from: row.bank_account_id, to: target.id } },
    });
    return { moved, pos: terminalView(terminal(row.id)) };
  }

  // ---------- Modül formlarında POS seçimi (module-ref.mjs pickRef, kart yolu + tahsilat/POS iadesi) ----------
  /**
   * Satırın POS'u (fin_ref). value: posId; bankValue: formdan gelen banka hesabı (POS yolunda hesap verilmez); previous/changed: düzeltmede.
   * POS tanımlı değilse '' (eski davranış: 108.00 Hesabı Atanmamış). Tek etkin POS kendiliğinden; birden çoksa 400 pos-required.
   */
  function pick({ value, bankValue = undefined, date = "", previous = null, changed = true, refundOf = "", legacy = false } = {}) {
    const bankId = bankValue === undefined || bankValue === null ? "" : text(bankValue);
    if (bankId && bankId !== "none") throw bad(400, "POS tahsilatı ve POS iadesi banka hesabına bağlanmaz; POS seçin (banka hesabı alanını boş bırakın).", "bank-account-invalid", { field: "bankAccountId" });
    if (!isReady()) return "";
    const id = text(value);
    const before = previous && String(previous.method || "") === "card" ? String(previous.finRef ?? previous.fin_ref ?? "") : "";
    const beforePos = before ? terminal(before) : null;
    if (id) {
      if (beforePos && id === before && !changed) return before;
      const row = mustTerminal(id);
      if (row.status !== "active") throw bad(400, `${row.name} pasif; bu POS'a tahsilat girmek için önce POS kartından Etkinleştir.`, "pos-passive", { field: "posId" });
      return row.id;
    }
    if (previous && String(previous.method || "") === "card") {
      if (beforePos) {
        if (!changed) return before;
        if (beforePos.status !== "active" || beforePos.deleted_at) throw bad(400, `${beforePos.name} pasif; tutarı ya da tarihi değişen POS tahsilatı için etkin bir POS seçin.`, "pos-passive", { field: "posId" });
        return before;
      }
      if (!changed) return "";
    }
    if (refundOf) {
      const origin = saleByRef(refundOf);
      if (origin) return origin.pos_id;
    }
    if (legacy) return "";
    const defined = store.get("SELECT COUNT(*) AS n FROM pos_terminals WHERE deleted_at IS NULL").n;
    if (!defined) return "";
    const open = store.all("SELECT id FROM pos_terminals WHERE deleted_at IS NULL AND status = 'active' AND currency = 'TRY' ORDER BY gl_sub").map(row => row.id);
    if (!open.length) return "";
    if (open.length > 1) {
      throw bad(400, `POS seçin: kartla tahsilat hangi POS'tan çekildi${date ? ` (${dayText(date)})` : ""}?`, "pos-required", { field: "posId" });
    }
    return open[0];
  }

  // ---------- Yazıcılar (yalnız bank.post bağlamında; K6 izinli listesinde "cekirdek" / "yardimci") ----------
  function writeSale(fields) {
    const id = newId("psale");
    store.run(
      `INSERT INTO pos_sales (id, event_id, pos_id, kind, src, origin_id, date, installments, rate_ppm, tax_kind, tax_mode, tax_ppm, fixed_minor, refund_commission, payout, block_days,
         bank_account_id, provider_account_id, gross_minor, commission_minor, tax_minor, net_minor, commission_refund_minor, blocked, auth_code, card_last4, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      id, fields.eventId, fields.posId, fields.kind, fields.src, fields.originId || "", fields.date, fields.installments, fields.ratePpm, fields.taxKind, fields.taxMode, fields.taxPpm, fields.fixedMinor,
      fields.refundCommission, fields.payout, fields.blockDays, fields.bankAccountId, fields.providerAccountId || "", fields.gross, fields.commission, fields.tax, Math.max(0, fields.net),
      fields.commissionRefund || 0, fields.blocked ? 1 : 0, fields.authCode || "", fields.cardLast4 || "", fields.user, stamp(),
    );
    return id;
  }
  function writeItems(saleId, posId, role, items, user) {
    for (const item of items) {
      store.run(
        `INSERT INTO pos_items (id, sale_id, pos_id, seq, role, value_date, blocked, gross_minor, commission_minor, tax_minor, fee_minor, net_minor, planned_net_minor, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'pending', ?, ?)`,
        newId("pitem"), saleId, posId, item.seq, role, item.valueDate, item.blocked ? 1 : 0, item.gross, item.commission, item.tax, item.net, item.plannedNet, user, stamp(),
      );
    }
  }
  /** pos_sales güncellemesi (durum, bağlı hesap kopyası); dönüş: değişen satır sayısı. */
  function setSale(setSql, whereSql, setArgs, whereArgs) {
    const result = store.run(`UPDATE pos_sales SET ${setSql}, updated_by = ?, updated_at = ? WHERE ${whereSql}`, ...setArgs, currentActor(), stamp(), ...whereArgs);
    return Number(result?.changes) || 0;
  }
  function setItems(setSql, whereSql, setArgs, whereArgs) {
    const result = store.run(`UPDATE pos_items SET ${setSql}, updated_by = ?, updated_at = ? WHERE ${whereSql}`, ...setArgs, currentActor(), stamp(), ...whereArgs);
    return Number(result?.changes) || 0;
  }
  /** İşlem başlığının POS bağı (Hareketler ?pos= süzgeci ve İşlem Kartı). Kopya alanı değildir (COPY_FIELDS dışında). */
  function markEvent(eventId, posId) {
    store.run("UPDATE fin_events SET pos_id = ? WHERE id = ? AND pos_id <> ?", posId, eventId, posId);
  }
  /**
   * KDV kipinin komisyon satırı (§4.3/1): sağlayıcı carisine account_entries(source 'bank'). out + card + POS = kesinti (B 320 / A 108.T);
   * out + bank + hesap = Komisyon Tahsili (B 320 / A 102.x); in + card + POS = komisyon iadesi (B 108.T / A 320). source_id = gün fişi.
   */
  function writeFee(user, { partyId, kind, method, finRef, amountMinor, date, note, voucherId }) {
    const id = newId("aentry");
    const eventId = bank.eventFor("account_entries", { kind, source: "bank", date, method, fin_ref: finRef });
    store.run(
      "INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, method, invoice_id, fin_ref, event_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, 'bank', ?, ?, '', ?, ?, ?, ?)",
      id, partyId, kind, amountMinor / 100, date, note, voucherId, method, finRef, eventId, user.id, stamp(),
    );
    return id;
  }
  function dropFees(voucherId) {
    store.run("DELETE FROM account_entries WHERE source = 'bank' AND source_id = ?", voucherId);
  }
  /** Aylık komisyon faturası kaydedilince o ayın kesinti ve iade satırları faturaya bağlanır (Kapatılacak Fatura bağı; para alanı değil). */
  function linkFees(invoiceId, ids) {
    store.run("UPDATE account_entries SET invoice_id = ? WHERE source = 'bank' AND invoice_id = '' AND id IN (SELECT value FROM json_each(?))", invoiceId, JSON.stringify(ids));
  }
  let actorId = "system";
  const currentActor = () => actorId;

  // ---------- Kanca (bank.post adım 7) ----------
  const POS_TABLES = new Set(["payments", "account_entries", "plan_entries", "stock_moves"]);
  /** Olayın POS'a bağlı etkin modül satırı (kart yolu, fin_ref = POS; KDV kesinti satırları hariç). */
  function posRowOf(eventId) {
    for (const item of eventRows(store, eventId)) {
      if (!POS_TABLES.has(item.table)) continue;
      if (item.table === "account_entries" && item.row.source === "bank") continue;
      if (String(item.row.method || "") !== "card" || !item.row.fin_ref) continue;
      const pos = terminal(item.row.fin_ref);
      if (!pos) continue;
      const amount = toMinor(Math.abs(Number(item.row.amount) || 0));
      if (!(amount > 0)) continue;
      return { table: item.table, row: item.row, pos, amount, direction: directionOf(item.table, item.row), date: String(item.row.date || "") };
    }
    return null;
  }
  const activeSaleOf = eventId => store.get("SELECT * FROM pos_sales WHERE event_id = ? AND status = 'active' AND src <> 'cancel' ORDER BY created_at DESC LIMIT 1", eventId) || null;
  const itemsOf = saleId => store.all("SELECT * FROM pos_items WHERE sale_id = ? ORDER BY seq, created_at", saleId);
  const refundsOf = saleId => store.all("SELECT * FROM pos_sales WHERE origin_id = ? AND kind = 'refund' AND status = 'active'", saleId);
  const refundedOf = saleId => Number(store.get("SELECT COALESCE(SUM(gross_minor), 0) AS n FROM pos_sales WHERE origin_id = ? AND kind = 'refund' AND status = 'active'", saleId).n) || 0;
  function saleByRef(ref) {
    const value = text(ref);
    if (!value) return null;
    return (
      store.get("SELECT * FROM pos_sales WHERE id = ? AND kind = 'sale'", value) ||
      store.get("SELECT s.* FROM pos_sales s JOIN fin_events e ON e.id = s.event_id WHERE e.no = ? AND s.kind = 'sale' ORDER BY s.created_at DESC LIMIT 1", value) ||
      store.get("SELECT * FROM pos_sales WHERE event_id = ? AND kind = 'sale' ORDER BY created_at DESC LIMIT 1", value) ||
      null
    );
  }

  /**
   * Kanca: işlemin olaylarından POS'a dokunanları uzlaştırır. ctx: en dıştaki bank.post bağlamı (op, user, posMeta, posOutcome).
   */
  function reconcile(ctx, eventIds) {
    if (!isReady() || !eventIds.size) return;
    actorId = ctx.user?.id || "system";
    const touchedGroups = new Set();
    // Sıra: önce kaldırılan, sonra değişen, en son yeni satışlar (aynı işlemde eski satış void olmadan yenisi aynı provizyonla yazılmasın;
    // satışlar iadelerden önce: aynı işlemdeki iade asıl satışını bulsun).
    const plan = [];
    for (const eventId of [...eventIds].sort()) {
      const sale = activeSaleOf(eventId);
      const row = posRowOf(eventId);
      if (!sale && !row) continue;
      const meta = ctx.posMeta.get(eventId) || null;
      if (row && sale) {
        const same = sale.pos_id === row.pos.id && Number(sale.gross_minor) === row.amount && sale.date === row.date && (sale.kind === "sale") === (row.direction === "in") && (!meta || sale.kind !== "sale" || Number(meta.installments || 1) === Number(sale.installments));
        if (!same) plan.push({ order: sale.kind === "refund" ? 1 : 2, run: () => changeSale(ctx, sale, eventId, row, meta, touchedGroups) });
        // İz 3 (bilinen hata, 12.10.2026): tutar, tarih, POS ve taksit aynı kalıp YALNIZ provizyon no ya da kartın son 4 hanesi değişince (fatura
        // Düzenle, cari tahsilatı düzelt) satış kaydı güncellenmiyordu — eski provizyon kalıyor, mükerrer denetimi eski numarayla yapılıyordu.
        // Yerinde düzeltilir (valör takvimi ve para değişmez); yeni provizyon aynı gün aynı POS'ta başka etkin satıştaysa 409.
        else if (meta && sale.kind === "sale" && (meta.authCode !== (sale.auth_code || "") || meta.cardLast4 !== (sale.card_last4 || ""))) plan.push({ order: 2, run: () => relabelSale(ctx, sale, meta) });
      } else if (sale) plan.push({ order: sale.kind === "refund" ? 0 : 1, run: () => removeSale(ctx, sale, ctx.posOutcome || "entry-error", touchedGroups) });
      else {
        plan.push({ order: row.direction === "in" ? 3 : 4, run: () => {
          const voided = ctx.op === "restore" ? store.get("SELECT * FROM pos_sales WHERE event_id = ? AND status = 'void' AND src <> 'cancel' ORDER BY updated_at DESC, created_at DESC LIMIT 1", eventId) : null;
          if (voided && voided.pos_id === row.pos.id && Number(voided.gross_minor) === row.amount && voided.date === row.date && (voided.kind === "sale") === (row.direction === "in")) restoreSale(ctx, voided, touchedGroups);
          else if (row.direction === "in") createSale(ctx, eventId, row, meta, touchedGroups);
          else createRefund(ctx, eventId, row, meta, touchedGroups);
        } });
      }
    }
    for (const step of plan.sort((a, b) => a.order - b.order)) step.run();
    // Yeniden planlanan ya da geçmiş tarihli kalemlerin vadesi gelmiş günleri aynı işlemde (gün fişi r+1; §4.6 bank.replan).
    if (touchedGroups.size) settleGroups(ctx.user || SYSTEM_ACTOR, dueGroups({ keys: touchedGroups }), { inline: true });
  }

  /** Satışın valör takvimi (POS kartının o günkü kuralları ve oranı); satış yazımı ve formun önizlemesi aynı hesabı kullanır. */
  function scheduleOf(pos, rate, { date, gross, installments }) {
    const tax = taxChoiceOf(pos);
    return saleSchedule({
      date, gross, installments, payout: pos.installment_payout, ratePpm: rate.ratePpm, fixedMinor: Number(pos.fixed_fee_minor) || 0,
      taxKind: TAX_CHOICES[tax].taxKind, taxMode: TAX_CHOICES[tax].taxMode, taxPpm: Number(pos.tax_ppm), valorRule: pos.valor_rule, valorDays: Number(pos.valor_days),
      rateValorDays: Number.isInteger(rate.valorDays) ? rate.valorDays : null, blockDays: Number(pos.block_days) || 0, calendar: calendar(),
    });
  }
  const rateMissing = (pos, installments, date) => {
    const any = store.get("SELECT MIN(valid_from) AS d FROM pos_rates WHERE pos_id = ? AND installments = ?", pos.id, installments)?.d;
    return bad(400, any && any > date ? `${pos.name} için ${installmentText(installments)} oranı ${dayText(any)} tarihinden geçerli; ${dayText(date)} tarihli tahsilat bu oranla girilemez.` : `Bu POS'ta ${installments > 1 ? `${installments} taksit` : "Tek Çekim"} oranı tanımlı değil.`, "pos-rate-missing", { field: "installments", installments });
  };
  /**
   * Tahsilat formunun önizlemesi (§8.9: "Komisyon %3,50 · Bankaya Geçecek 3.860,00 TL × 3 · İlk Valör 09.11.2026"): satış yazımıyla AYNI hesap
   * (scheduleOf); hiçbir şey yazmaz. Dönüş: oran, komisyon, vergi, kesinti, net ve kalemler (valör günü, brüt, net, bloke).
   */
  function preview({ posId, amount, installments = 1, date = "" } = {}) {
    const pos = mustTerminal(posId);
    if (pos.status !== "active") throw bad(400, `${pos.name} pasif; bu POS'a tahsilat girmek için önce POS kartından Etkinleştir.`, "pos-passive", { field: "posId" });
    const count = Number(installments) || 1;
    if (!Number.isInteger(count) || count < 1 || count > 36) throw bad(400, "POS taksit sayısı 1 (Tek Çekim) ile 36 arasında bir tamsayı olmalı.", "pos-installments", { field: "installments" });
    const day = /^\d{4}-\d{2}-\d{2}$/.test(text(date)) ? text(date) : today();
    const gross = parseMinor(amount, { label: "Tutar" });
    const rate = rateFor(pos.id, count, day);
    if (!rate) throw rateMissing(pos, count, day);
    const schedule = scheduleOf(pos, rate, { date: day, gross, installments: count });
    const tax = taxChoiceOf(pos);
    return {
      posId: pos.id, posName: pos.name, date: day, installments: count, installmentLabel: installmentText(count), ratePpm: rate.ratePpm, rate: ppmText(rate.ratePpm), tax, taxLabel: TAX_LABELS[tax],
      grossMinor: gross, commissionMinor: schedule.totals.commission, taxMinor: schedule.totals.tax, deductionMinor: schedule.totals.deduction, netMinor: schedule.totals.net,
      blocked: schedule.items.some(item => item.blocked), items: schedule.items.map(item => ({ seq: item.seq, valueDate: item.valueDate, grossMinor: item.gross, netMinor: item.plannedNet, blocked: Boolean(item.blocked) })),
    };
  }
  /**
   * POS İadesinin asıl işlem önerisi (§4.6 "aynı cari ve faturadan öneri"): etkin, iade edilebilir kalanı olan satışlar — satıştan iade
   * faturasında asıl faturanın, cari/taksit iadesinde o cari/kartın POS satışları (en yenisi önce). Bakiye/oran dönmez.
   */
  function origins({ invoiceId = "", partyId = "", planId = "", posId = "" } = {}) {
    if (!isReady()) return [];
    const where = ["s.kind = 'sale'", "s.status = 'active'"];
    const args = [];
    const original = invoiceId ? store.get("SELECT original_id AS id FROM invoices WHERE id = ?", invoiceId)?.id || invoiceId : "";
    if (original) where.push("e.invoice_id = ?") && args.push(original);
    else if (planId) where.push("e.plan_id = ?") && args.push(planId);
    else if (partyId) where.push("e.party_id = ?") && args.push(partyId);
    else return [];
    if (posId) where.push("s.pos_id = ?") && args.push(posId);
    return store.all(`SELECT s.*, e.no AS eventNo FROM pos_sales s JOIN fin_events e ON e.id = s.event_id WHERE ${where.join(" AND ")} ORDER BY s.date DESC, s.created_at DESC LIMIT 50`, ...args)
      .map(sale => ({ id: sale.id, eventNo: sale.eventNo || "", posId: sale.pos_id, posName: terminal(sale.pos_id)?.name || "", date: sale.date, installments: sale.installments, grossMinor: Number(sale.gross_minor), remainingMinor: Number(sale.gross_minor) - refundedOf(sale.id), authCode: sale.auth_code, cardLast4: sale.card_last4 }))
      .filter(sale => sale.remainingMinor > 0);
  }

  function createSale(ctx, eventId, row, meta, touched) {
    const pos = row.pos;
    if (pos.deleted_at) throw bad(404, "POS bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", "pos-missing", { field: "posId" });
    if (pos.status !== "active") throw bad(400, `${pos.name} pasif; bu POS'a tahsilat girmek için önce POS kartından Etkinleştir.`, "pos-passive", { field: "posId" });
    const installments = Number(meta?.installments) || 1;
    const rate = rateFor(pos.id, installments, row.date);
    if (!rate) throw rateMissing(pos, installments, row.date);
    if (meta?.authCode) {
      const twin = store.get("SELECT s.id, e.no FROM pos_sales s LEFT JOIN fin_events e ON e.id = s.event_id WHERE s.pos_id = ? AND s.auth_code = ? AND s.date = ? AND s.status = 'active' LIMIT 1", pos.id, meta.authCode, row.date);
      if (twin) throw bad(409, `${meta.authCode} provizyon numarası ${dayText(row.date)} tarihinde bu POS'ta zaten kayıtlı${twin.no ? ` (${twin.no})` : ""}; aynı kart işlemi ikinci kez girilemez.`, "pos-auth-duplicate", { field: "authCode", eventNo: twin.no || "" });
    }
    const schedule = scheduleOf(pos, rate, { date: row.date, gross: row.amount, installments });
    const saleId = writeSale({
      eventId, posId: pos.id, kind: "sale", src: "module", date: row.date, installments, ratePpm: rate.ratePpm, taxKind: pos.tax_kind, taxMode: pos.tax_mode, taxPpm: Number(pos.tax_ppm),
      fixedMinor: Number(pos.fixed_fee_minor) || 0, refundCommission: pos.refund_commission, payout: pos.installment_payout, blockDays: Number(pos.block_days) || 0,
      bankAccountId: pos.bank_account_id, providerAccountId: pos.provider_account_id, gross: row.amount, commission: schedule.totals.commission, tax: schedule.totals.tax,
      net: schedule.totals.net, blocked: schedule.items.some(item => item.blocked), authCode: meta?.authCode || "", cardLast4: meta?.cardLast4 || "", user: actorId,
    });
    writeItems(saleId, pos.id, "sale", schedule.items, actorId);
    markEvent(eventId, pos.id);
    for (const item of schedule.items) touched.add(groupKey(pos.id, item.valueDate, pos.bank_account_id));
    return saleId;
  }

  /** Asıl satış: posRefundOf (satış kimliği / İşlem No) → iade faturasının asıl faturası → taksit kartı → tek aday (aynı cari). */
  function originOf(eventId, row, meta) {
    if (meta?.sourceless) return null;
    if (meta?.refundOf) {
      const sale = saleByRef(meta.refundOf);
      if (!sale || sale.status !== "active") throw bad(404, "Asıl POS işlemi bulunamadı ya da iptal edilmiş.", "pos-refund-origin", { field: "posRefundOf" });
      if (sale.pos_id !== row.pos.id) throw bad(400, "İade asıl satışın POS'undan yapılır; POS seçimi asıl işlemle aynı olmalı.", "pos-refund-origin", { field: "posId" });
      return sale;
    }
    // Satırın kopyası satırın kendisinden (işlem başlığının kopyası bu işlemin sonunda yenilenir; kanca ondan önce çalışır).
    const copy = eventCopy(store, row.table, row.row);
    const event = { partyId: copy.party_id, invoiceId: copy.invoice_id, planId: copy.plan_id };
    const remaining = sale => Number(sale.gross_minor) - refundedOf(sale.id);
    const pickFrom = (list, strict) => {
      const fit = list.filter(sale => remaining(sale) >= row.amount && sale.date <= row.date);
      if (fit.length === 1 || (!strict && fit.length)) return fit[0];
      return null;
    };
    const base = "SELECT s.* FROM pos_sales s JOIN fin_events e ON e.id = s.event_id WHERE s.kind = 'sale' AND s.status = 'active' AND s.pos_id = ?";
    // Satıştan iade faturası: asıl faturanın POS satışları (en yenisi önce).
    const original = event.invoiceId ? store.get("SELECT original_id AS id FROM invoices WHERE id = ?", event.invoiceId)?.id || "" : "";
    if (original) {
      const found = pickFrom(store.all(`${base} AND e.invoice_id = ? ORDER BY s.date DESC, s.created_at DESC`, row.pos.id, original), false);
      if (found) return found;
    }
    if (event.planId) {
      const found = pickFrom(store.all(`${base} AND e.plan_id = ? ORDER BY s.date DESC, s.created_at DESC`, row.pos.id, event.planId), false);
      if (found) return found;
    }
    if (event.partyId) {
      const found = pickFrom(store.all(`${base} AND e.party_id = ? ORDER BY s.date DESC, s.created_at DESC`, row.pos.id, event.partyId), true);
      if (found) return found;
    }
    throw bad(400, "Asıl POS işlemini seçin (POS İadesi hangi kart tahsilatının iadesi?) ya da eski satışın iadesiyse \"Kaynaksız (Eski Satış)\" işaretleyin.", "pos-refund-origin", { field: "posRefundOf" });
  }

  function createRefund(ctx, eventId, row, meta, touched) {
    const pos = row.pos;
    if (pos.deleted_at) throw bad(404, "POS bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", "pos-missing", { field: "posId" });
    const origin = originOf(eventId, row, meta);
    if (origin && row.date < origin.date) throw bad(400, `POS iadesinin tarihi (${dayText(row.date)}) asıl satıştan (${dayText(origin.date)}) önce olamaz.`, "pos-refund-before-sale", { field: "date" });
    return writeRefund({ eventId, pos, origin, amount: row.amount, date: row.date, src: origin ? "module" : "sourceless" }, touched);
  }

  /** İade kaydı (module | cancel | sourceless): Σ iade ≤ satış; kalemler bekleyen kalemlere sondan başa, artanı iade valörüne. */
  function writeRefund({ eventId, pos, origin, amount, date, src }, touched) {
    if (origin) {
      const already = refundedOf(origin.id);
      if (already + amount > Number(origin.gross_minor)) {
        throw bad(409, `İade toplamı satışı aşıyor: satış ${tl(Number(origin.gross_minor))}, önceki iadeler ${tl(already)}, bu iade ${tl(amount)}.`, "pos-refund-exceeds", { saleId: origin.id, remainingMinor: Number(origin.gross_minor) - already });
      }
    }
    const cal = calendar();
    const refundValueDate = valueDateOf(cal, date, pos.valor_rule, Number(rateFor(pos.id, 1, date)?.valorDays ?? pos.valor_days) || 0);
    const pending = [];
    let before = { gross: 0, commission: 0, tax: 0 };
    if (origin) {
      const prior = refundsOf(origin.id);
      before = prior.reduce((sum, item) => ({ gross: sum.gross + Number(item.gross_minor), commission: sum.commission + Number(item.commission_refund_minor), tax: sum.tax + Number(item.tax_minor) }), before);
      const items = itemsOf(origin.id).filter(item => item.role === "sale" && item.status === "pending");
      for (const item of items) {
        const taken = Number(store.get("SELECT COALESCE(SUM(i.gross_minor), 0) AS n FROM pos_items i JOIN pos_sales s ON s.id = i.sale_id WHERE s.origin_id = ? AND s.status = 'active' AND i.role = 'refund' AND i.seq = ? AND i.status <> 'void'", origin.id, item.seq).n) || 0;
        pending.push({ seq: item.seq, valueDate: item.value_date, blocked: item.blocked, capacity: Number(item.gross_minor) - taken });
      }
    }
    const sale = origin
      ? { gross: Number(origin.gross_minor), commission: Number(origin.commission_minor), tax: Number(origin.tax_minor), fixedMinor: Number(origin.fixed_minor), taxMode: origin.tax_mode }
      : { gross: amount, commission: 0, tax: 0, fixedMinor: 0, taxMode: pos.tax_mode };
    const policy = origin ? origin.refund_commission : "none";
    const plan = refundSchedule({ amount, pending, refundValueDate, policy, sale, before });
    const deduction = plan.commission + (sale.taxMode === "excluded" ? plan.tax : 0);
    const bankAccountId = origin ? origin.bank_account_id : pos.bank_account_id;
    const refundId = writeSale({
      eventId, posId: pos.id, kind: "refund", src, originId: origin?.id || "", date, installments: 1, ratePpm: origin ? Number(origin.rate_ppm) : 0, taxKind: origin ? origin.tax_kind : pos.tax_kind,
      taxMode: sale.taxMode, taxPpm: origin ? Number(origin.tax_ppm) : Number(pos.tax_ppm), fixedMinor: 0, refundCommission: policy, payout: "single", blockDays: 0, bankAccountId,
      providerAccountId: origin ? origin.provider_account_id : pos.provider_account_id, gross: amount, commission: 0, tax: plan.tax, net: amount - deduction, commissionRefund: plan.commission, user: actorId,
    });
    writeItems(refundId, pos.id, "refund", plan.items, actorId);
    if (eventId) markEvent(eventId, pos.id);
    for (const item of plan.items) touched.add(groupKey(pos.id, item.valueDate, bankAccountId));
    return refundId;
  }

  /** Bekleyen satışın (ya da iadenin) kalemleri void; bankaya geçmiş kalemi varsa önce yeniden planlama (yoksa 409 pos-settled). */
  function voidRecord(sale, touched, why) {
    const settled = itemsOf(sale.id).filter(item => item.status === "settled");
    if (settled.length) replan(settled, touched, why);
    setItems("status = 'void'", "sale_id = ? AND status = 'pending'", [], [sale.id]);
    setSale("status = 'void'", "id = ?", [], [sale.id]);
  }
  /** §4.6 bank.replan: ilgili gün fişleri (eşleşmemiş ve açık dönemde) ters kaydedilir, kalemleri yeniden bekler; eşleşmiş/kilitliyse 409. */
  function replan(items, touched, why = "") {
    const vouchers = [...new Set(items.map(item => item.event_id).filter(Boolean))];
    const lock = lockDate();
    for (const voucherId of vouchers) {
      const event = store.get("SELECT id, no, date, status FROM fin_events WHERE id = ?", voucherId);
      if (!event || event.status !== "active") continue;
      const matched = has("bank_matches") && store.get("SELECT 1 AS found FROM bank_matches WHERE event_id = ? AND undone_at IS NULL", voucherId);
      // Gün fişinin KDV'li kesintisi kaydedilmiş komisyon faturasına bağlıysa fiş değişmez (fatura "Ödendi"si bozulmasın).
      const invoiced = store.get("SELECT 1 AS found FROM account_entries WHERE source = 'bank' AND source_id = ? AND invoice_id <> '' LIMIT 1", voucherId);
      if (matched || invoiced || (lock && event.date <= lock)) {
        const where = matched ? "; gün fişi banka ekstresiyle eşleştirilmiş" : invoiced ? "; gün fişinin komisyon kesintisi kaydedilmiş komisyon faturasına bağlı" : "; gün fişi kapatılmış (kilitli) dönemde";
        throw bad(409, `Bu POS tahsilatı bankaya geçti (${event.no}, ${dayText(event.date)})${where}. ${why || "Müşteriye iade ise POS İadesi yapın."}`, "pos-settled", { eventNo: event.no });
      }
      for (const item of store.all("SELECT i.pos_id AS posId, i.value_date AS valueDate, s.bank_account_id AS bankAccountId FROM pos_items i JOIN pos_sales s ON s.id = i.sale_id WHERE i.event_id = ?", voucherId)) touched.add(groupKey(item.posId, item.valueDate, item.bankAccountId));
      dropFees(voucherId);
      bank.reverse(voucherId, { date: event.date, description: `Ters Kayıt · ${event.no} (POS Gün Sonu Düzeltmesi)` });
      setItems("status = 'pending', event_id = '', settled_on = '', late = 0", "event_id = ?", [], [voucherId]);
    }
  }

  function removeSale(ctx, sale, outcome, touched) {
    if (!OUTCOMES.has(outcome)) outcome = "entry-error";
    if (sale.kind === "refund") {
      voidRecord(sale, touched, "İade bankaya geçti; düzeltme için yeni bir POS tahsilatı ya da iade girin.");
      audit?.(ctx.user || SYSTEM_ACTOR, "bank.pos.refund-voided", sale.id, { eventId: sale.event_id, grossMinor: Number(sale.gross_minor) });
      return;
    }
    const refunds = refundsOf(sale.id).filter(item => item.src !== "cancel");
    if (refunds.length) throw bad(409, `Bu POS tahsilatının ${refunds.length} iadesi var; önce iadeleri silin ya da iptal edin.`, "pos-has-refunds", { saleId: sale.id });
    const items = itemsOf(sale.id);
    const settled = items.some(item => item.status === "settled");
    if (outcome === "refunded") {
      const pos = terminal(sale.pos_id);
      const window = addCalendarDays(sale.date, Number(pos?.provision_days) || 0);
      if (!settled && today() <= window) {
        voidRecord(sale, touched);
        audit?.(ctx.user || SYSTEM_ACTOR, "bank.pos.voided", sale.id, { eventId: sale.event_id, outcome, grossMinor: Number(sale.gross_minor) });
        return;
      }
      cancelRefund(ctx, sale, touched);
      return;
    }
    // Kayıt hatası (modül satırını silmek, düzeltmek, "Kayıt Hatası" ile iptal): provizyondan bağımsız void; geçmişse yeniden planlama.
    voidRecord(sale, touched, "Müşteriye iade ise POS İadesi yapın.");
    audit?.(ctx.user || SYSTEM_ACTOR, "bank.pos.voided", sale.id, { eventId: sale.event_id, outcome, grossMinor: Number(sale.gross_minor), settled });
  }

  /** İptal İadesi (§4.6): modül satırı iptalle silindi; satışın tamamı (önceki iadeler hariç) iade; geçmiş gün fişleri değişmez. */
  function cancelRefund(ctx, sale, touched) {
    const pos = terminal(sale.pos_id);
    const date = today();
    const event = store.get("SELECT no, party_id AS partyId, invoice_id AS invoiceId FROM fin_events WHERE id = ?", sale.event_id) || {};
    const head = bank.voucher({ type: "pos_cancel_refund", date, posId: sale.pos_id, partyId: event.partyId || "", invoiceId: event.invoiceId || "", description: `POS İptal İadesi · ${pos?.name || ""}${event.no ? ` · ${event.no}` : ""}` }, []);
    const amount = Number(sale.gross_minor) - refundedOf(sale.id);
    if (amount > 0) writeRefund({ eventId: head.id, pos, origin: sale, amount, date, src: "cancel" }, touched);
    setSale("status = 'cancelled'", "id = ?", [], [sale.id]);
    audit?.(ctx.user || SYSTEM_ACTOR, "bank.pos.cancel-refund", sale.id, { eventId: sale.event_id, refundEventId: head.id, eventNo: head.no, grossMinor: amount });
  }

  function changeSale(ctx, sale, eventId, row, meta, touched) {
    if (sale.kind === "sale") {
      const refunds = refundsOf(sale.id).filter(item => item.src !== "cancel");
      if (refunds.length) throw bad(409, `Bu POS tahsilatının ${refunds.length} iadesi var; tutarı, tarihi, POS'u ya da taksiti değiştirilmez. Önce iadeleri silin.`, "pos-has-refunds", { saleId: sale.id });
    }
    const keep = meta || { installments: Number(sale.installments) || 1, authCode: sale.auth_code, cardLast4: sale.card_last4, refundOf: sale.origin_id, sourceless: sale.src === "sourceless" };
    voidRecord(sale, touched, "Müşteriye iade ise POS İadesi yapın.");
    if (row.direction === "in") createSale(ctx, eventId, row, keep, touched);
    else createRefund(ctx, eventId, row, keep, touched);
    audit?.(ctx.user || SYSTEM_ACTOR, "bank.pos.replanned", sale.id, { eventId, previous: { posId: sale.pos_id, grossMinor: Number(sale.gross_minor), date: sale.date, installments: sale.installments } });
  }

  /** Yalnız provizyon no / kartın son 4 hanesi değişen satış: kayıt yerinde (kalemler ve para aynı). Yeni provizyon tekil olmalı (aynı gün, aynı POS). */
  function relabelSale(ctx, sale, meta) {
    if (meta.authCode && meta.authCode !== (sale.auth_code || "")) {
      const twin = store.get("SELECT s.id, e.no FROM pos_sales s LEFT JOIN fin_events e ON e.id = s.event_id WHERE s.pos_id = ? AND s.auth_code = ? AND s.date = ? AND s.status = 'active' AND s.id <> ? LIMIT 1", sale.pos_id, meta.authCode, sale.date, sale.id);
      if (twin) throw bad(409, `${meta.authCode} provizyon numarası ${dayText(sale.date)} tarihinde bu POS'ta zaten kayıtlı${twin.no ? ` (${twin.no})` : ""}; aynı kart işlemi ikinci kez girilemez.`, "pos-auth-duplicate", { field: "authCode", eventNo: twin.no || "" });
    }
    setSale("auth_code = ?, card_last4 = ?", "id = ?", [meta.authCode || "", meta.cardLast4 || ""], [sale.id]);
    audit?.(ctx.user || SYSTEM_ACTOR, "bank.pos.relabeled", sale.id, { eventId: sale.event_id, previous: { authCode: sale.auth_code || "", cardLast4: sale.card_last4 || "" }, next: { authCode: meta.authCode || "", cardLast4: meta.cardLast4 || "" } });
  }

  /** Silinenler'den geri yükleme (§3.8): void satış asıl valörleriyle yeniden etkin; aynı provizyonla etkin satış varsa 409. */
  function restoreSale(ctx, sale, touched) {
    if (sale.auth_code) {
      const twin = store.get("SELECT e.no FROM pos_sales s LEFT JOIN fin_events e ON e.id = s.event_id WHERE s.pos_id = ? AND s.auth_code = ? AND s.date = ? AND s.status = 'active' AND s.id <> ? LIMIT 1", sale.pos_id, sale.auth_code, sale.date, sale.id);
      if (twin) throw bad(409, `${sale.auth_code} provizyon numarasıyla bu POS'ta etkin bir satış var${twin.no ? ` (${twin.no})` : ""}; geri yüklenirse aynı kart işlemi iki kez sayılır.`, "pos-auth-duplicate", { eventNo: twin.no || "" });
    }
    if (sale.origin_id) {
      const origin = store.get("SELECT * FROM pos_sales WHERE id = ?", sale.origin_id);
      if (!origin || origin.status !== "active") throw bad(409, "Bu POS iadesinin asıl satışı artık etkin değil; iade geri yüklenemez.", "pos-refund-origin");
      if (refundedOf(origin.id) + Number(sale.gross_minor) > Number(origin.gross_minor)) throw bad(409, "Geri yüklenirse iade toplamı satışı aşar.", "pos-refund-exceeds");
    }
    setSale("status = 'active'", "id = ?", [], [sale.id]);
    setItems("status = 'pending', event_id = '', settled_on = '', late = 0", "sale_id = ? AND status = 'void'", [], [sale.id]);
    for (const item of itemsOf(sale.id)) touched.add(groupKey(sale.pos_id, item.value_date, sale.bank_account_id));
    audit?.(ctx.user || SYSTEM_ACTOR, "bank.pos.restored", sale.id, { eventId: sale.event_id });
  }

  // ---------- Valör kuyruğu (§4.4) ----------
  const groupKey = (posId, valueDate, bankAccountId) => `${posId}|${valueDate}|${bankAccountId}`;
  /** Vadesi gelmiş bekleyen gruplar (POS, valör günü, bağlı hesap). keys: yalnız bunlar; posId: yalnız bu POS. */
  function dueGroups({ upTo = today(), keys = null, posId = "", limit = 0 } = {}) {
    const rows = store.all(
      `SELECT i.pos_id AS posId, i.value_date AS valueDate, s.bank_account_id AS bankAccountId, COUNT(*) AS n FROM pos_items i JOIN pos_sales s ON s.id = i.sale_id
       WHERE i.status = 'pending' AND s.status <> 'repair' AND i.value_date <= ? ${posId ? "AND i.pos_id = ?" : ""}
       GROUP BY i.pos_id, i.value_date, s.bank_account_id ORDER BY i.value_date, i.pos_id, s.bank_account_id ${limit ? `LIMIT ${Number(limit)}` : ""}`,
      ...(posId ? [upTo, posId] : [upTo]),
    );
    return keys ? rows.filter(row => keys.has(groupKey(row.posId, row.valueDate, row.bankAccountId))) : rows;
  }
  /** Grubun gün fişi tarihi: valör günü; kilitliyse ilk açık gün (late); o da bugünden sonraysa bekler (null). */
  function settleDateOf(valueDate) {
    const lock = lockDate();
    if (!lock || valueDate > lock) return { date: valueDate, late: false };
    const next = addCalendarDays(lock, 1);
    if (next > today()) return null;
    return { date: next, late: true };
  }
  /**
   * Grubun gün fişi: kalemler koşullu bağlanır (status = 'pending'); net fiş + KDV kipinin kesinti satırları. override: onay kipinde gerçek tarih ve
   * net tutar ({ date, bankMinor }); fark BSMV/vergisiz kipte 653'e, KDV kipinde sağlayıcı carisine ("Komisyon Farkı"). Dönüş: fiş ya da null.
   */
  function settleGroup(user, group, { override = null } = {}) {
    const pos = terminal(group.posId);
    if (!pos) return null;
    const account = bankRow(group.bankAccountId);
    if (!account || account.deletedAt) throw bad(409, `${pos.name} gün sonu: bağlı hesap silinmiş; POS kartından "Bekleyenleri Yeni Hesaba Taşı".`, "pos-settle-account");
    const when = override ? { date: override.date, late: false } : settleDateOf(group.valueDate);
    if (!when) return null;
    const items = store.all(
      `SELECT i.*, s.kind AS saleKind, s.tax_kind AS taxKind, s.tax_mode AS taxMode, s.provider_account_id AS provider FROM pos_items i JOIN pos_sales s ON s.id = i.sale_id
       WHERE i.status = 'pending' AND s.status <> 'repair' AND i.pos_id = ? AND i.value_date = ? AND s.bank_account_id = ? ORDER BY i.created_at, i.id`,
      group.posId, group.valueDate, group.bankAccountId,
    );
    if (!items.length) return null;
    const totals = dayTotals(items.map(item => ({ role: item.role, gross: Number(item.gross_minor), deduction: deductionOf({ commission: Number(item.commission_minor), tax: Number(item.tax_minor) }, item.taxMode) + Number(item.fee_minor || 0), taxKind: item.taxKind, provider: item.provider })));
    let { e653 } = totals;
    const vat = new Map(totals.vat);
    const vatMode = isVatKind(pos.tax_kind) || [...vat.keys()].length > 0;
    let diff = 0;
    if (override) {
      // Onay: gerçek net − planlanan net (artı: banka fazla ödedi). BSMV/vergisiz kipte 653 azalır; KDV kipinde sağlayıcıya "Komisyon Farkı".
      diff = override.bankMinor - totals.bank;
      if (vatMode && pos.provider_account_id) vat.set(pos.provider_account_id, (vat.get(pos.provider_account_id) || 0) - diff);
      else e653 -= diff;
    }
    const split = vatSplit({ g108: totals.g108, vat });
    const l108 = split.l108;
    const bankLine = l108 - e653;
    const lines = [];
    const memo = `POS Gün Sonu · ${dayText(group.valueDate)}`;
    if (l108) lines.push({ role: "pos", gl: "108", sub: pos.gl_sub, ref: pos.id, side: l108 > 0 ? "C" : "D", tryMinor: Math.abs(l108), memo });
    if (bankLine) lines.push({ role: "bank", gl: "102", sub: account.glSub, ref: account.id, side: bankLine > 0 ? "D" : "C", tryMinor: Math.abs(bankLine), memo });
    if (e653) lines.push({ role: "expense", gl: commissionGl(), sub: "", ref: "", side: e653 > 0 ? "D" : "C", tryMinor: Math.abs(e653), memo: e653 > 0 ? "POS Komisyonu" : "POS Komisyon İadesi" });
    const revision = Number(store.get("SELECT COUNT(*) AS n FROM fin_events WHERE origin_key LIKE ?", `pos-day:${pos.id}:${group.valueDate}:%`).n) + 1;
    const head = bank.voucher({
      type: "pos_settlement", date: when.date, valueDate: group.valueDate, bankRef: account.id, counterRef: pos.id, posId: pos.id, origin: "system",
      originKey: `pos-day:${pos.id}:${group.valueDate}:r${revision}`, description: `POS Gün Sonu · ${pos.name}${when.late ? " · Gecikmeli Aktarım" : ""}${override ? " · Onaylandı" : ""}`, reference: pos.merchant_no || "",
    }, lines);
    const changed = setItems("status = 'settled', event_id = ?, settled_on = ?, late = ?, settle_error = ''", "status = 'pending' AND id IN (SELECT value FROM json_each(?))", [head.id, when.date, when.late ? 1 : 0], [JSON.stringify(items.map(item => item.id))]);
    if (changed !== items.length) throw bad(409, "POS kalemleri başka bir aktarımda bağlandı; yeniden deneyin.", "pos-settle-race");
    for (const row of split.rows) if (!partyRow(row.provider) || partyRow(row.provider).deletedAt) throw bad(409, `${pos.name}: KDV'li komisyonun sağlayıcı carisi bulunamadı (silinmiş); POS kartında Sağlayıcı Carisi seçin.`, "pos-provider-account");
    for (const row of split.rows) {
      const note = `${pos.name} · Valör ${dayText(group.valueDate)}`;
      if (row.fromPos) writeFee(user, { partyId: row.provider, kind: "out", method: "card", finRef: pos.id, amountMinor: row.fromPos, date: when.date, note: `POS Komisyon Kesintisi · ${note}${override ? " · Komisyon Farkı Dahil" : ""}`, voucherId: head.id });
      if (row.fromBank) writeFee(user, { partyId: row.provider, kind: "out", method: "bank", finRef: account.id, amountMinor: row.fromBank, date: when.date, note: `POS Komisyon Tahsili · ${note}`, voucherId: head.id });
      if (row.toPos) writeFee(user, { partyId: row.provider, kind: "in", method: "card", finRef: pos.id, amountMinor: row.toPos, date: when.date, note: `POS Komisyon İadesi · ${note}`, voucherId: head.id });
    }
    return { ...head, bankMinor: bankLine - split.rows.reduce((sum, row) => sum + row.fromBank, 0), diff, late: when.late };
  }
  /** Grupları aynı işlemde yazar (bütçe: 200 grup ya da 1 sn). inline: kullanıcı işleminin içinde (yeniden planlama). Dönüş: yazılan fiş sayısı. */
  function settleGroups(user, groups, { inline = false } = {}) {
    let count = 0;
    const started = Date.now(); // saat: gerçek (süre ölçümü; tur bütçesi)
    for (const group of groups) {
      const pos = terminal(group.posId);
      if (!pos) continue;
      // Onay kipindeki POS'un kalemi "Onay Bekleyen"de kalır (kullanıcı onaylar; yeniden planlamada da).
      if (settleModeOf(pos) !== "auto") continue;
      if (settleGroup(user, group)) count += 1;
      if (!inline && (count >= ROUND_GROUPS || Date.now() - started > ROUND_MS)) break; // saat: gerçek (süre ölçümü)
    }
    return count;
  }
  /**
   * Kuyruk turu (sistem): vadesi gelmiş grupları kendi işleminde yazar; işlem reddedilirse gruplar tek tek denenir, düşen grup settle_error ile
   * işaretlenir (zil). Kalan varsa next() ile sonraki tur. Dönüş: { settled, failed, remaining }.
   */
  function runQueue({ upTo = today(), posId = "" } = {}) {
    if (!isReady()) return { settled: 0, failed: 0, remaining: 0 };
    const groups = dueGroups({ upTo, posId, limit: ROUND_GROUPS }).filter(group => terminal(group.posId) && settleModeOf(terminal(group.posId)) === "auto" && settleDateOf(group.valueDate));
    let settled = 0;
    let failed = 0;
    if (groups.length) {
      try {
        settled = bank.post({ user: SYSTEM_ACTOR, module: "bank", op: "create", origin: "system", write: () => {
          actorId = SYSTEM_ACTOR.id;
          return settleGroups(SYSTEM_ACTOR, groups);
        }, audit: { type: "bank.pos.settled", entityId: posId || "pos", payload: { groups: groups.length } } });
      } catch (error) {
        log?.warn?.("POS valör kuyruğu toplu turda reddedildi; gruplar tek tek deneniyor", error);
        for (const group of groups) {
          try {
            settled += bank.post({ user: SYSTEM_ACTOR, module: "bank", op: "create", origin: "system", write: () => {
              actorId = SYSTEM_ACTOR.id;
              return settleGroup(SYSTEM_ACTOR, group) ? 1 : 0;
            }, audit: { type: "bank.pos.settled", entityId: group.posId, payload: { valueDate: group.valueDate } } });
          } catch (single) {
            failed += 1;
            markError(group, single);
          }
        }
      }
    }
    const remaining = dueGroups({ upTo, posId }).filter(group => terminal(group.posId) && settleModeOf(terminal(group.posId)) === "auto" && settleDateOf(group.valueDate)).length;
    if (settled) notify({ kind: "bank", pos: true });
    return { settled, failed, remaining };
  }
  function markError(group, error) {
    const message = String(error?.message || error).slice(0, 300);
    try {
      bank.post({ user: SYSTEM_ACTOR, module: "bank", op: "create", origin: "system", write: () => {
        actorId = SYSTEM_ACTOR.id;
        setItems("settle_error = ?", "status = 'pending' AND pos_id = ? AND value_date = ? AND sale_id IN (SELECT id FROM pos_sales WHERE bank_account_id = ?)", [message], [group.posId, group.valueDate, group.bankAccountId]);
        return { id: group.posId };
      } });
    } catch (inner) {
      log?.error?.("POS aktarım hatası işaretlenemedi", inner);
    }
    log?.error?.(`POS valör aktarımı yapılamadı (${group.posId} ${group.valueDate})`, error);
  }
  /** Bütün vadesi gelmiş grupları turlar hâlinde yazar (Şimdi Aktar, kilit öncesi, testler). */
  function drain({ upTo = today(), posId = "" } = {}) {
    let settled = 0;
    let failed = 0;
    for (let round = 0; round < 1000; round += 1) {
      const result = runQueue({ upTo, posId });
      settled += result.settled;
      failed += result.failed;
      if (!result.remaining || (!result.settled && !result.failed) || result.failed) return { settled, failed, remaining: result.remaining };
    }
    return { settled, failed, remaining: dueGroups({ upTo, posId }).length };
  }
  /** Onay kipi (§4.4/7): grubu gerçek tarih ve net tutarla yazar. */
  function confirm(user, body = {}) {
    const pos = mustTerminal(body.posId);
    const valueDate = text(body.valueDate);
    const group = dueGroups({ upTo: valueDate || today(), posId: pos.id }).find(item => item.valueDate === valueDate);
    if (!group) throw bad(404, "Bu POS'ta bu valör gününde onay bekleyen kalem yok.", "pos-confirm-missing");
    const date = text(body.date) || valueDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) throw bad(400, "Bankaya geçiş tarihi geçerli ve bugünden sonra olmayan bir tarih olmalı.", "pos-confirm-date", { field: "date" });
    period.assertOpen(date, "POS gün sonu");
    const bankMinor = parseMinor(body.netAmount, { label: "Bankaya Geçen Net Tutar", allowZero: true, allowNegative: true });
    const result = bank.post({ user, module: "bank", op: "create", requestId: text(body.requestId), scope: "bank.pos.confirm", body, write: () => {
      actorId = user.id;
      const head = settleGroup(user, group, { override: { date, bankMinor } });
      if (!head) throw bad(409, "Kalemler başka bir aktarımda bağlandı.", "pos-settle-race");
      return { id: head.id, no: head.no, diff: head.diff };
    }, audit: { type: "bank.pos.confirmed", entityId: pos.id, payload: { valueDate, date, bankMinor } } });
    return result;
  }
  /**
   * Dönem kilidi konmadan önce (§4.4/6): kilitlenecek döneme düşen vadesi gelmiş kalemler için kuyruk; hâlâ bekleyen varsa 409
   * bank-pending-before-lock + liste ("Yine de Kilitle" force geçer).
   */
  function beforeLock(lockedUntil, force = false) {
    if (!isReady() || !lockedUntil) return;
    drain({ upTo: lockedUntil < today() ? lockedUntil : today() });
    if (force) return;
    const left = store.all(
      `SELECT p.name, i.value_date AS valueDate, COUNT(*) AS n, COALESCE(SUM(i.planned_net_minor), 0) AS net FROM pos_items i JOIN pos_terminals p ON p.id = i.pos_id
       WHERE i.status = 'pending' AND i.value_date <= ? GROUP BY i.pos_id, i.value_date ORDER BY i.value_date LIMIT 50`,
      lockedUntil,
    );
    if (left.length) {
      throw bad(409, `Kilitlenecek döneme düşen ${left.length} POS valör günü bankaya aktarılmadı (${left.slice(0, 3).map(row => `${row.name} ${dayText(row.valueDate)}`).join("; ")}). Önce Banka → POS'tan aktarın ya da onaylayın; "Yine de Kilitle" ile kilitlenirse fişler kilitten sonraki ilk güne Gecikmeli Aktarım olarak yazılır.`, "bank-pending-before-lock", {
        pending: left.map(row => ({ pos: row.name, valueDate: row.valueDate, count: Number(row.n), netMinor: Number(row.net) })),
      });
    }
  }

  // ---------- Okuma uçları (GET yazmaz) ----------
  /**
   * Bekleyen kalemlerin TÜRE göre gün satırları (§4.6–§4.7; Eleştirmen E-1/E-2): tür kalemin ROLÜNDEN — tutarın işaretinden değil. Birim: satış
   * kalemi + ona yazılan iade kalemleri (iade kalemi seq > 0, asıl satışın aynı seq'li kalemi); valörden SONRAKİ iadenin artanı (seq 0) kendi
   * biriminde kalır (POS, eksi; Komisyon Tahsili DEĞİL). Neti eksiye düşen satış birimi "Komisyon Tahsili" (fee; §4.6 E1.06), öbürleri blokeli
   * ya da POS. Satırlar (gün, POS, tür) başına; blokeli, Komisyon Tahsili ve POS aynı günde ayrı satır (§4.7).
   */
  function kindRows(where = ["i.status = 'pending'"], args = []) {
    return store.all(
      `WITH u AS (
         SELECT i.value_date AS valueDate, i.pos_id AS posId, i.role AS role, i.blocked AS blocked, i.planned_net_minor AS net, i.settle_error AS error,
                CASE WHEN i.role = 'refund' THEN -i.gross_minor ELSE i.gross_minor END AS gross,
                CASE WHEN i.role = 'sale' THEN 's:' || i.sale_id || ':' || i.seq WHEN i.role = 'refund' AND i.seq > 0 AND s.origin_id <> '' THEN 's:' || s.origin_id || ':' || i.seq ELSE 'i:' || i.id END AS unit
         FROM pos_items i JOIN pos_sales s ON s.id = i.sale_id WHERE ${where.join(" AND ")} AND s.status <> 'repair'
       ), g AS (
         SELECT valueDate, posId, SUM(net) AS net, SUM(gross) AS gross, COUNT(*) AS n, MAX(blocked) AS blocked, MAX(error) AS error,
                CASE WHEN MAX(role = 'fee') = 1 OR (substr(unit, 1, 2) = 's:' AND SUM(net) < 0) THEN 'fee' WHEN MAX(blocked) = 1 THEN 'blocked' ELSE 'pos' END AS kind
         FROM u GROUP BY valueDate, posId, unit
       )
       SELECT g.valueDate, g.posId, p.name AS posName, g.kind, SUM(g.net) AS net, SUM(g.gross) AS gross, SUM(g.n) AS n, MAX(g.error) AS error
       FROM g JOIN pos_terminals p ON p.id = g.posId
       GROUP BY g.valueDate, g.posId, g.kind ORDER BY g.valueDate, p.gl_sub, CASE g.kind WHEN 'pos' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END`,
      ...args,
    );
  }
  /** ANLIK DURUM / Genel Bakış: POS Bekleyen (Net), Blokeli POS, brüt, Komisyon Tahsili Bekleyen, Valörü Gelmiş Aktarılmadı, Onay Bekleyen. */
  function pendingStats() {
    const empty = { netMinor: 0, blockedMinor: 0, grossMinor: 0, feeMinor: 0, due: { count: 0, netMinor: 0 }, awaiting: { count: 0, netMinor: 0 }, errors: 0 };
    if (!isReady()) return empty;
    const row = store.get(
      `SELECT COALESCE(SUM(CASE WHEN blocked = 0 THEN planned_net_minor ELSE 0 END), 0) AS net, COALESCE(SUM(CASE WHEN blocked = 1 THEN planned_net_minor ELSE 0 END), 0) AS blocked,
              COALESCE(SUM(CASE WHEN role = 'refund' THEN -gross_minor ELSE gross_minor END), 0) AS gross, SUM(CASE WHEN settle_error <> '' THEN 1 ELSE 0 END) AS errors
       FROM pos_items WHERE status = 'pending' AND sale_id NOT IN (SELECT id FROM pos_sales WHERE status = 'repair')`,
    );
    const days = store.all("SELECT i.pos_id AS posId, i.value_date AS valueDate, SUM(i.planned_net_minor) AS net, COUNT(*) AS n FROM pos_items i WHERE i.status = 'pending' AND i.sale_id NOT IN (SELECT id FROM pos_sales WHERE status = 'repair') GROUP BY i.pos_id, i.value_date");
    // Komisyon Tahsili Bekleyen: yalnız fee türündeki birimler (kindRows; valörden sonraki iade sayılmaz — Eleştirmen E-1).
    const fee = kindRows().reduce((sum, item) => sum + (item.kind === "fee" ? -Number(item.net) : 0), 0);
    const due = { count: 0, netMinor: 0 };
    const awaiting = { count: 0, netMinor: 0 };
    const day = today();
    for (const item of days) {
      if (item.valueDate <= day) {
        const pos = terminal(item.posId);
        const target = pos && settleModeOf(pos) !== "auto" ? awaiting : due;
        target.count += Number(item.n);
        target.netMinor += Number(item.net);
      }
    }
    return { netMinor: Number(row?.net) || 0, blockedMinor: Number(row?.blocked) || 0, grossMinor: Number(row?.gross) || 0, feeMinor: fee, due, awaiting, errors: Number(row?.errors) || 0 };
  }
  /** POS Ödeme Takvimi (§4.7): bekleyen kalemler valör gününe göre NET; blokeli ve Komisyon Tahsili ayrı satır. */
  function calendarView({ from = "", to = "", posId = "" } = {}) {
    if (!isReady()) return { rows: [], totals: { netMinor: 0, blockedMinor: 0, feeMinor: 0, totalMinor: 0 } };
    const args = [];
    const where = ["i.status = 'pending'"];
    if (from) where.push("i.value_date >= ?") && args.push(from);
    if (to) where.push("i.value_date <= ?") && args.push(to);
    if (posId) where.push("i.pos_id = ?") && args.push(posId);
    // Eleştirmen E-2: tür kalemin rolünden (kindRows); önceden (gün, POS, blokeli) grubu neti eksiyse "Komisyon Tahsili" sayılıyordu — aynı günün
    // Komisyon Tahsili POS satırına karışıyor, valörden sonraki iade Komisyon Tahsili görünüyordu.
    const rows = kindRows(where, args);
    const day = today();
    const out = rows.map(row => {
      const net = Number(row.net) || 0;
      const kind = row.kind;
      const pos = terminal(row.posId);
      return {
        valueDate: row.valueDate, posId: row.posId, posName: row.posName, kind, kindLabel: kind === "fee" ? "Komisyon Tahsili" : kind === "blocked" ? "Blokeli POS" : "POS",
        netMinor: net, grossMinor: Number(row.gross) || 0, count: Number(row.n) || 0, due: row.valueDate <= day, awaiting: row.valueDate <= day && pos && settleModeOf(pos) !== "auto", error: row.error || "",
      };
    });
    const totals = out.reduce((sum, row) => ({
      netMinor: sum.netMinor + (row.kind === "pos" ? row.netMinor : 0),
      blockedMinor: sum.blockedMinor + (row.kind === "blocked" ? row.netMinor : 0),
      feeMinor: sum.feeMinor + (row.kind === "fee" ? -row.netMinor : 0),
      totalMinor: sum.totalMinor + row.netMinor,
    }), { netMinor: 0, blockedMinor: 0, feeMinor: 0, totalMinor: 0 });
    return { rows: out, totals };
  }
  /** Nakit akışı kaynakları (§4.7, §8.9): bekleyen kalemler valör gününde net tutarla; POS / Blokeli POS / Komisyon Tahsili. */
  function flows() {
    return calendarView().rows.map(row => ({
      date: row.valueDate, direction: row.netMinor < 0 ? "out" : "in", amount: Math.abs(row.netMinor) / 100, source: row.kind === "fee" ? "posFee" : row.kind === "blocked" ? "posBlocked" : "pos",
      label: `${row.kindLabel} · ${row.posName}`, party: "", ref: { type: "pos", id: row.posId },
    })).filter(item => item.amount > 0);
  }
  function saleView(sale, { items = true } = {}) {
    const event = store.get("SELECT no, status, date, party_id AS partyId, invoice_id AS invoiceId, plan_id AS planId, src_table AS srcTable FROM fin_events WHERE id = ?", sale.event_id) || {};
    const pos = terminal(sale.pos_id);
    const party = event.partyId ? partyRow(event.partyId) : null;
    const invoice = event.invoiceId ? store.get("SELECT id, number, kind FROM invoices WHERE id = ?", event.invoiceId) : null;
    const list = items ? itemsOf(sale.id) : [];
    const settled = list.filter(item => item.status === "settled");
    const window = addCalendarDays(sale.date, Number(pos?.provision_days) || 0);
    const voidable = sale.kind === "sale" && sale.status === "active" && !settled.length && today() <= window;
    const origin = sale.origin_id ? store.get("SELECT s.id, s.date, s.gross_minor AS grossMinor, e.no FROM pos_sales s LEFT JOIN fin_events e ON e.id = s.event_id WHERE s.id = ?", sale.origin_id) : null;
    const cal = calendar();
    const explain = sale.kind === "sale" && list.length ? explainOf(sale, pos, cal) : "";
    return {
      id: sale.id, kind: sale.kind, kindLabel: sale.kind === "sale" ? "POS Satışı" : sale.src === "cancel" ? "POS İptal İadesi" : "POS İadesi", src: sale.src,
      status: sale.status, statusLabel: { active: "Etkin", void: "İptal Edildi (Void)", cancelled: "İptal İadesi Yapıldı" }[sale.status] || sale.status,
      eventId: sale.event_id, eventNo: event.no || "", date: sale.date, posId: sale.pos_id, posName: pos?.name || "", installments: sale.installments, installmentLabel: installmentText(sale.installments),
      ratePpm: sale.rate_ppm, rate: ppmText(sale.rate_ppm), tax: taxChoiceOf(sale), taxLabel: TAX_LABELS[taxChoiceOf(sale)], grossMinor: Number(sale.gross_minor), commissionMinor: Number(sale.commission_minor),
      taxMinor: Number(sale.tax_minor), netMinor: Number(sale.net_minor), commissionRefundMinor: Number(sale.commission_refund_minor), refundedMinor: sale.kind === "sale" ? refundedOf(sale.id) : 0,
      blocked: Boolean(sale.blocked), authCode: sale.auth_code, cardLast4: sale.card_last4, bankAccountId: sale.bank_account_id, providerAccountId: sale.provider_account_id,
      party: party ? { id: party.id, name: party.name } : null, invoice: invoice ? { id: invoice.id, number: invoice.number, kind: invoice.kind } : null,
      // Satırın bölümü (İz 3.3: POS İşlemleri'nde İptal Et'in nedeni — cari tahsilatı burada, fatura peşini faturadan, kayıt/taksit/stok kendi bölümünden).
      source: event.srcTable || "",
      origin: origin ? { id: origin.id, eventNo: origin.no || "", date: origin.date, grossMinor: Number(origin.grossMinor) } : null,
      voidable, voidReason: sale.kind !== "sale" || sale.status !== "active" ? "" : settled.length ? "Bankaya geçti; POS İadesi yapın." : today() > window ? "Provizyon süresi geçti; POS İadesi yapın." : "",
      explain,
      items: list.map(item => ({ id: item.id, seq: item.seq, role: item.role, valueDate: item.value_date, blocked: Boolean(item.blocked), grossMinor: Number(item.gross_minor), commissionMinor: Number(item.commission_minor), taxMinor: Number(item.tax_minor), netMinor: Number(item.net_minor), plannedNetMinor: Number(item.planned_net_minor), status: item.status, settledOn: item.settled_on, late: Boolean(item.late), error: item.settle_error, voucherNo: item.event_id ? store.get("SELECT no FROM fin_events WHERE id = ?", item.event_id)?.no || "" : "" })),
    };
  }
  /** "12.10.2026 (08.10 Perşembe + 2 iş günü)" — ilk kalemin valör açıklaması (İşlem Kartı). */
  function explainOf(sale, pos, cal) {
    try {
      if (!pos) return "";
      const first = store.get("SELECT value_date AS d, blocked FROM pos_items WHERE sale_id = ? AND role = 'sale' ORDER BY seq LIMIT 1", sale.id);
      if (!first) return "";
      if (Number(sale.installments) > 1 && sale.payout === "monthly") return cal.explainValue(sale.date, "month", 1);
      const rate = rateFor(sale.pos_id, Number(sale.installments) || 1, sale.date);
      const days = Number.isInteger(rate?.valorDays) ? rate.valorDays : Number(pos.valor_days) || 0;
      const rule = pos.valor_rule === "same_day" ? "business" : pos.valor_rule;
      const text_ = cal.explainValue(sale.date, rule, pos.valor_rule === "same_day" ? 0 : days);
      return first.blocked ? `${dayText(first.d)} (Blokeli POS, ${sale.block_days} gün; ${text_})` : text_;
    } catch {
      return "";
    }
  }
  /** row: "tablo:kimlik" — modül satırının (cari, kayıt, taksit, stok) POS kaydı (formdaki satırdan POS İşlemi'ne). */
  function sales({ posId = "", from = "", to = "", status = "", kind = "", limit = 200, row = "" } = {}) {
    if (!isReady()) return [];
    const where = ["1 = 1"];
    const args = [];
    if (row) {
      const [table, id] = String(row).split(":");
      if (!POS_TABLES.has(table) || !id) throw bad(400, "Satır başvurusu tablo:kimlik biçiminde olmalı (payments, account_entries, plan_entries, stock_moves).", "pos-row", { field: "row" });
      const eventId = store.get(`SELECT event_id AS e FROM ${table} WHERE id = ?`, id)?.e || "";
      if (!eventId) return [];
      where.push("event_id = ?") && args.push(eventId);
    }
    if (posId) where.push("pos_id = ?") && args.push(posId);
    if (from) where.push("date >= ?") && args.push(from);
    if (to) where.push("date <= ?") && args.push(to);
    if (status) where.push("status = ?") && args.push(status);
    if (kind) where.push("kind = ?") && args.push(kind);
    return store.all(`SELECT * FROM pos_sales WHERE ${where.join(" AND ")} ORDER BY date DESC, created_at DESC LIMIT ${Math.min(1000, Math.max(1, Number(limit) || 200))}`, ...args).map(sale => saleView(sale));
  }
  /** POS İşlemleri → İptal Et: satışın etkin modül satırı (tablo, kimlik, kaynak). */
  const voidTarget = eventId => {
    const row = posRowOf(eventId);
    return row ? { table: row.table, id: row.row.id, source: row.row.source || "", sourceId: row.row.source_id || "" } : null;
  };
  const saleDetail = id => {
    const sale = store.get("SELECT * FROM pos_sales WHERE id = ?", text(id));
    if (!sale) throw bad(404, "POS işlemi bulunamadı.", "pos-sale-missing");
    return { ...saleView(sale), refunds: store.all("SELECT * FROM pos_sales WHERE origin_id = ? ORDER BY created_at", sale.id).map(item => saleView(item, { items: true })) };
  };
  /** İşlem Kartı'nın POS bölümü (movements.mjs): modül olayında satış/iade, gün fişinde kalemler. */
  function eventInfo(event) {
    if (!isReady() || !event) return null;
    if (event.type === "pos_settlement") {
      const items = store.all("SELECT i.*, s.event_id AS saleEvent, s.date AS saleDate, s.kind AS saleKind FROM pos_items i JOIN pos_sales s ON s.id = i.sale_id WHERE i.event_id = ? ORDER BY i.value_date, s.date", event.id);
      if (!items.length) return null;
      const explain = [...new Set(items.filter(item => item.saleKind === "sale").map(item => {
        const sale = store.get("SELECT * FROM pos_sales WHERE id = ?", item.sale_id);
        return sale ? explainOf(sale, terminal(sale.pos_id), calendar()) : "";
      }).filter(Boolean))];
      return { kind: "settlement", explain, items: items.map(item => ({ id: item.id, role: item.role, valueDate: item.value_date, grossMinor: Number(item.gross_minor), plannedNetMinor: Number(item.planned_net_minor), saleEventNo: store.get("SELECT no FROM fin_events WHERE id = ?", item.saleEvent)?.no || "", saleDate: item.saleDate, late: Boolean(item.late) })), fees: store.all("SELECT id, kind, method, amount, note, invoice_id AS invoiceId FROM account_entries WHERE source = 'bank' AND source_id = ?", event.id) };
    }
    const sale = store.get("SELECT * FROM pos_sales WHERE event_id = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'cancelled' THEN 1 ELSE 2 END, created_at DESC LIMIT 1", event.id);
    if (!sale) return null;
    const view = saleView(sale);
    let originInvoice = null;
    if (sale.origin_id) {
      const origin = store.get("SELECT event_id FROM pos_sales WHERE id = ?", sale.origin_id);
      const head = origin ? store.get("SELECT invoice_id AS invoiceId, party_id AS partyId FROM fin_events WHERE id = ?", origin.event_id) : null;
      originInvoice = head?.invoiceId ? store.get("SELECT id, number, kind FROM invoices WHERE id = ?", head.invoiceId) : null;
    }
    return { kind: sale.kind, ...view, originInvoice: originInvoice ? { id: originInvoice.id, number: originInvoice.number, kind: originInvoice.kind } : null };
  }
  /** Form seçicisi (GET /bank/choices): etkin POS'lar, taksit oranları (bugün geçerli), tek POS bayrağı. Bakiye dönmez. */
  function choices() {
    const rows = list({ status: "active" });
    const preferred = settingsOf()?.account?.defaultPosId || "";
    const ids = rows.map(row => row.id);
    return {
      pos: rows.map(row => ({ id: row.id, code: row.code, label: row.label, name: row.name, bankName: row.bankName, glSub: row.glSub, rates: row.rates.map(rate => ({ installments: rate.installments, label: rate.label, rate: rate.rate })), provisionDays: row.provisionDays })),
      form: { ids, single: ids.length === 1, required: ids.length > 0, defaultId: preferred && ids.includes(preferred) ? preferred : ids[0] || "" },
    };
  }

  // ---------- KDV kipi: aylık komisyon faturası taslağı (§4.3/3–4) ----------
  const monthRange = month => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
  };
  const monthOf = value => {
    const month = text(value) || today().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw bad(400, "Ay YYYY-AA biçiminde olmalı.", "pos-month", { field: "month" });
    return month;
  };
  /** Ayın bağlanmamış kesinti ve iadeleri (sağlayıcı ve POS bazında): { posId, providerId, outMinor, inMinor, netMinor, ids } */
  function monthFees(month, posId = "") {
    const { from, to } = monthRange(month);
    const rows = store.all(
      `SELECT e.id, e.kind, e.amount, e.account_id AS providerId, f.pos_id AS posId FROM account_entries e JOIN fin_events f ON f.id = e.source_id
       WHERE e.source = 'bank' AND e.invoice_id = '' AND e.date BETWEEN ? AND ? ${posId ? "AND f.pos_id = ?" : ""} ORDER BY e.date, e.created_at`,
      ...(posId ? [from, to, posId] : [from, to]),
    );
    const groups = new Map();
    for (const row of rows) {
      const key = `${row.posId}|${row.providerId}`;
      const group = groups.get(key) || { posId: row.posId, providerId: row.providerId, outMinor: 0, inMinor: 0, ids: [] };
      const minor = toMinor(Math.abs(Number(row.amount) || 0));
      if (row.kind === "out") group.outMinor += minor;
      else group.inMinor += minor;
      group.ids.push(row.id);
      groups.set(key, group);
    }
    return [...groups.values()].map(group => ({ ...group, netMinor: group.outMinor - group.inMinor }));
  }
  function commissionInvoices({ month = "" } = {}) {
    if (!isReady()) return { month: "", rows: [] };
    const target = monthOf(month);
    const rows = monthFees(target).map(group => {
      const pos = terminal(group.posId);
      const job = store.get("SELECT payload_json AS payload, status FROM bank_jobs WHERE kind = 'comm-invoice' AND ref = ? ORDER BY created_at DESC LIMIT 1", `${group.posId}:${group.providerId}:${target}`);
      const invoiceId = job ? JSON.parse(job.payload || "{}").invoiceId || "" : "";
      const invoice = invoiceId ? store.get("SELECT id, number, status, try_payable AS payable FROM invoices WHERE id = ?", invoiceId) : null;
      return {
        posId: group.posId, posName: pos?.name || "", providerId: group.providerId, providerName: partyRow(group.providerId)?.name || "", outMinor: group.outMinor, inMinor: group.inMinor, netMinor: group.netMinor,
        state: group.netMinor <= 0 ? "refund-credit" : invoice && invoice.status === "draft" ? "draft" : "expected",
        stateLabel: group.netMinor <= 0 ? "İade Alacağı" : invoice && invoice.status === "draft" ? "Taslak Hazır" : "Faturası Beklenen",
        invoice: invoice ? { id: invoice.id, number: invoice.number, status: invoice.status, payable: invoice.payable } : null,
      };
    });
    const linked = store.all(
      `SELECT e.invoice_id AS invoiceId, f.pos_id AS posId, SUM(CAST(ROUND((CASE WHEN e.kind = 'out' THEN e.amount ELSE -e.amount END) * 100) AS INTEGER)) AS net FROM account_entries e JOIN fin_events f ON f.id = e.source_id
       WHERE e.source = 'bank' AND e.invoice_id <> '' AND e.date BETWEEN ? AND ? GROUP BY e.invoice_id, f.pos_id`,
      monthRange(target).from, monthRange(target).to,
    ).map(row => {
      const invoice = store.get("SELECT id, number, status, try_payable AS payable FROM invoices WHERE id = ?", row.invoiceId);
      const payable = toMinor(Number(invoice?.payable) || 0);
      const net = Number(row.net) || 0; // satır başına kuruş (SQL'de yuvarlanmış tam sayı)
      const provider = invoice ? partyRow(store.get("SELECT account_id AS id FROM invoices WHERE id = ?", invoice.id)?.id || "") : null;
      return { posId: row.posId, posName: terminal(row.posId)?.name || "", providerName: provider?.name || "", invoice: invoice ? { id: invoice.id, number: invoice.number, status: invoice.status } : null, linkedMinor: net, payableMinor: payable, differenceMinor: payable - net };
    });
    return { month: target, rows, linked };
  }
  /**
   * Rapor Merkezi → "Faturası Beklenen Komisyonlar" (plan §8.10 ek; §4.3/3–4): tarih aralığındaki ayların KDV'li komisyon kesintileri — Faturası
   * Beklenen, Taslak Hazır, İade Alacağı (net ≤ 0) ve faturası kaydedilmiş olanlar (Fark = fatura − bağlı kesinti). Yalnız kesintisi olan aylar.
   */
  function commissionReport({ from = "", to = "", posId = "" } = {}) {
    if (!isReady()) return { rows: [] };
    const months = store.all(`SELECT DISTINCT substr(e.date, 1, 7) AS month FROM account_entries e WHERE e.source = 'bank' ${from ? "AND e.date >= ?" : ""} ${to ? "AND e.date <= ?" : ""} ORDER BY month`, ...[from, to].filter(Boolean)).map(row => row.month);
    const out = [];
    for (const month of months) {
      const data = commissionInvoices({ month });
      for (const row of data.rows) if (!posId || row.posId === posId) out.push({ month, posName: row.posName, providerName: row.providerName, outMinor: row.outMinor, inMinor: row.inMinor, netMinor: row.netMinor, stateLabel: row.stateLabel, invoiceNo: row.invoice?.number || "", invoiceMinor: row.invoice ? toMinor(Number(row.invoice.payable) || 0) : 0, differenceMinor: 0 });
      for (const row of data.linked) if (!posId || row.posId === posId) out.push({ month, posName: row.posName, providerName: row.providerName, outMinor: row.linkedMinor > 0 ? row.linkedMinor : 0, inMinor: row.linkedMinor < 0 ? -row.linkedMinor : 0, netMinor: row.linkedMinor, stateLabel: row.invoice?.status === "issued" ? (row.differenceMinor ? "Faturalandı (Fark Var)" : "Faturalandı") : "Faturası İptal Edildi", invoiceNo: row.invoice?.number || "", invoiceMinor: row.payableMinor, differenceMinor: row.differenceMinor });
    }
    return { rows: out };
  }
  /** "Şimdi Oluştur" / ayın ilk kuyruk turu: net > 0 olan (POS, sağlayıcı) için KDV Dahil taslak "Hizmet ve Gider Alışı" (653). */
  function createCommissionDrafts(user, { month = "", posId = "" } = {}) {
    const target = monthOf(month);
    const service = invoices();
    if (!service?.createCommissionDraft) throw bad(503, "Fatura modülü hazır değil.", "pos-invoices");
    const created = [];
    for (const group of monthFees(target, posId)) {
      if (group.netMinor <= 0) continue;
      const pos = terminal(group.posId);
      if (!pos || !isVatKind(pos.tax_kind)) continue;
      const ref = `${group.posId}:${group.providerId}:${target}`;
      const job = store.get("SELECT id, payload_json AS payload FROM bank_jobs WHERE kind = 'comm-invoice' AND ref = ? AND status = 'pending'", ref);
      if (job) {
        const invoiceId = JSON.parse(job.payload || "{}").invoiceId || "";
        if (invoiceId && store.get("SELECT 1 AS found FROM invoices WHERE id = ? AND status = 'draft'", invoiceId)) continue;
      }
      const { to } = monthRange(target);
      let date = to < today() ? to : today();
      // Yargıç 2.2.0 Y6: ayın son günü kapanmış (kilitli) dönemdeyse taslak ilk açık günle açılır (K3 "kilitli güne düşen geçiş ilk açık güne";
      // önceden kilitli tarihle açılıyor, Kaydet 409 period-locked veriyordu, kullanıcı tarihi elle değiştirmek zorundaydı).
      const lock = lockDate();
      if (lock && date <= lock) date = addCalendarDays(lock, 1);
      const invoiceId = service.createCommissionDraft(user, { partyId: group.providerId, date, amountMinor: group.netMinor, note: `${pos.name} · ${target} POS komisyonları (${group.ids.length} kesinti satırı)` });
      store.tx(() => {
        if (job) store.run("UPDATE bank_jobs SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE id = ?", user.id, stamp(), job.id);
        store.run("INSERT INTO bank_jobs (id, kind, due_date, ref, payload_json, status, created_by, created_at) VALUES (?, 'comm-invoice', ?, ?, ?, 'pending', ?, ?)", newId("bjob"), date, ref, JSON.stringify({ invoiceId, month: target, posId: group.posId, providerId: group.providerId, netMinor: group.netMinor }), user.id, stamp());
      });
      created.push({ invoiceId, posId: group.posId, providerId: group.providerId, netMinor: group.netMinor });
    }
    return { month: target, created };
  }
  /**
   * Ayın ilk kuyruk turu (§4.3/3 tetik): Banka Ayarları → Komisyon Faturası "Ay Sonunda Toplu Taslak" (varsayılan) ise önceki ayın taslakları
   * (KDV kipindeki POS'lar) bir kez açılır. "Elle" ve "Her Valörde Taslak" bu sürümde POS sekmesindeki "Şimdi Oluştur" ile (karar).
   */
  function autoDrafts() {
    if (!isReady()) return null;
    const mode = settingsOf()?.posAdvanced?.commissionInvoice || "month_end";
    const current = today().slice(0, 7);
    if (mode !== "month_end" || store.setting("bank.pos.draftMonth", "") === current) return null;
    if (!store.get("SELECT 1 AS found FROM pos_terminals WHERE tax_kind = 'vat' LIMIT 1")) return null;
    const [y, m] = current.split("-").map(Number);
    const previous = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const result = createCommissionDrafts(SYSTEM_ACTOR, { month: previous });
    store.setSetting("bank.pos.draftMonth", current);
    return result;
  }
  /** Taslak komisyon faturası kaydedildi (fatura modülünün işlemi içinde): ayın bağlanmamış kesinti/iade satırları faturaya bağlanır. */
  function invoiceIssued(user, invoiceId) {
    if (!isReady()) return;
    const job = store.get("SELECT id, ref, payload_json AS payload FROM bank_jobs WHERE kind = 'comm-invoice' AND status = 'pending' AND json_extract(payload_json, '$.invoiceId') = ?", invoiceId);
    if (!job) return;
    const payload = JSON.parse(job.payload || "{}");
    const group = monthFees(payload.month, payload.posId).find(item => item.providerId === payload.providerId);
    if (group?.ids.length) linkFees(invoiceId, group.ids);
    store.run("UPDATE bank_jobs SET status = 'done', done_ref = ?, updated_by = ?, updated_at = ? WHERE id = ?", invoiceId, user.id, stamp(), job.id);
  }

  // ---------- Mutabakat denetimleri (§3.11 pos:*, bank:party) ----------
  // Kapsam: events verilirse (kapı; dokunulan olaylar) yalnız bu olayların POS'ları, satış/iadeleri (asıl satış ve iadeleriyle) ve gün fişleri;
  // verilmezse (Mutabakat Testi, tam tarama) hepsi. POS'a bağlı modül satırları tek SQL'le okunur (satış başına sorgu yok; 100.000 satırda da).
  const POS_ROW_SQL = filter => {
    const where = filter ? " AND r.event_id IN (SELECT value FROM json_each(?1))" : "";
    return [
      `SELECT 'payments' AS t, r.id, r.event_id AS eventId, r.amount, r.date, r.fin_ref AS posId, 'in' AS dir FROM payments r JOIN pos_terminals p ON p.id = r.fin_ref WHERE r.method = 'card' AND r.event_id <> ''${where}`,
      `SELECT 'account_entries', r.id, r.event_id, r.amount, r.date, r.fin_ref, CASE r.kind WHEN 'out' THEN 'out' ELSE 'in' END FROM account_entries r JOIN pos_terminals p ON p.id = r.fin_ref WHERE r.method = 'card' AND r.source <> 'bank' AND r.kind IN ('in', 'out') AND r.event_id <> ''${where}`,
      `SELECT 'plan_entries', r.id, r.event_id, r.amount, r.date, r.fin_ref, CASE r.kind WHEN 'out' THEN 'out' ELSE 'in' END FROM plan_entries r JOIN pos_terminals p ON p.id = r.fin_ref WHERE r.method = 'card' AND COALESCE(r.cheque_id, '') = '' AND COALESCE(r.opening, 0) = 0 AND r.event_id <> ''${where}`,
      `SELECT 'stock_moves', r.id, r.event_id, r.amount, r.date, r.fin_ref, CASE r.kind WHEN 'in' THEN 'out' ELSE 'in' END FROM stock_moves r JOIN pos_terminals p ON p.id = r.fin_ref WHERE r.method = 'card' AND r.pay = 'cash' AND r.amount > 0 AND r.event_id <> ''${where}`,
    ].join("\n UNION ALL ");
  };
  /** Kapı kapsamı: dokunulan olaylardan POS'lar, kayıtlar (asıl ve iadeleriyle), gün fişleri ve satırların olayları. */
  function scopeOf(events) {
    const list = JSON.stringify([...events]);
    const posIds = new Set(store.all("SELECT DISTINCT pos_id AS id FROM fin_events WHERE id IN (SELECT value FROM json_each(?)) AND pos_id <> ''", list).map(row => row.id));
    const sales = new Set(store.all("SELECT id FROM pos_sales WHERE event_id IN (SELECT value FROM json_each(?1)) UNION SELECT sale_id FROM pos_items WHERE event_id IN (SELECT value FROM json_each(?1))", list).map(row => row.id));
    const first = JSON.stringify([...sales]);
    for (const row of store.all("SELECT origin_id AS id FROM pos_sales WHERE id IN (SELECT value FROM json_each(?1)) AND origin_id <> '' UNION SELECT id FROM pos_sales WHERE origin_id IN (SELECT value FROM json_each(?1))", first)) sales.add(row.id);
    const saleList = JSON.stringify([...sales]);
    const vouchers = new Set(store.all("SELECT id FROM fin_events WHERE id IN (SELECT value FROM json_each(?1)) AND type = 'pos_settlement' UNION SELECT event_id FROM pos_items WHERE sale_id IN (SELECT value FROM json_each(?2)) AND event_id <> ''", list, saleList).map(row => row.id));
    const rowEvents = new Set([...events, ...store.all("SELECT event_id AS id FROM pos_sales WHERE id IN (SELECT value FROM json_each(?))", saleList).map(row => row.id)]);
    for (const row of store.all("SELECT pos_id AS id FROM pos_sales WHERE id IN (SELECT value FROM json_each(?))", saleList)) posIds.add(row.id);
    return { posIds, sales, vouchers, rowEvents };
  }
  function problems({ events = null } = {}) {
    const out = { terminal: [], source: [], refund: [], schedule: [], party: [] };
    if (!isReady()) return out;
    const scope = events ? scopeOf(events) : null;
    if (scope && !scope.posIds.size && !scope.sales.size && !scope.vouchers.size) return out;
    const inList = set => JSON.stringify([...set]);
    // pos:terminal — 108.T = Σ bekleyen kalem brütü (satış − iade); tek kaynaktan (moneyLines) bağımsız toplam.
    const terminals = scope ? store.all("SELECT id, code, name, gl_sub AS sub FROM pos_terminals WHERE id IN (SELECT value FROM json_each(?))", inList(scope.posIds)) : store.all("SELECT id, code, name, gl_sub AS sub FROM pos_terminals");
    // Eleştirmen E-3: "Onarım Bekliyor" kayıtları (açılış onarımı d/g) kapıdan ayrılır — kaydın satırı (108'e yazdığı) ve bankaya geçmiş kalemleri
    // (108'den çıkan) defter tarafından, bekleyen kalemleri bekleyen tarafından düşülür; o POS'un öbür satışları denetlenmeye ve aktarılmaya devam eder.
    const repairSales = store.all("SELECT id, event_id AS eventId, pos_id AS posId FROM pos_sales WHERE status = 'repair'");
    const repairEvents = new Set(repairSales.map(sale => sale.eventId));
    const repairOffset = posId => {
      if (!repairSales.some(sale => sale.posId === posId)) return 0;
      let offset = 0;
      for (const row of store.all(POS_ROW_SQL(true), JSON.stringify(repairSales.filter(sale => sale.posId === posId).map(sale => sale.eventId)))) {
        if (row.posId === posId) offset += (row.dir === "in" ? 1 : -1) * toMinor(Math.abs(Number(row.amount) || 0));
      }
      offset -= Number(store.get("SELECT COALESCE(SUM(CASE WHEN i.role = 'refund' THEN -i.gross_minor ELSE i.gross_minor END), 0) AS n FROM pos_items i JOIN pos_sales s ON s.id = i.sale_id WHERE s.status = 'repair' AND i.pos_id = ? AND i.status = 'settled'", posId).n) || 0;
      return offset;
    };
    for (const pos of terminals) {
      const balance = (money?.refTotal ? Number(money.refTotal({ ref: pos.id }).cents) || 0 : 0) - repairOffset(pos.id);
      const pending = Number(store.get("SELECT COALESCE(SUM(CASE WHEN role = 'refund' THEN -gross_minor ELSE gross_minor END), 0) AS n FROM pos_items WHERE pos_id = ? AND status = 'pending' AND sale_id NOT IN (SELECT id FROM pos_sales WHERE status = 'repair')", pos.id).n) || 0;
      out.terminal.push({ pos, ok: balance === pending, ledgerMinor: balance, pendingMinor: pending });
    }
    // pos:source — etkin satış/iade = olayının POS'a bağlı etkin satırı (POS, tutar, tarih, yön); POS'a bağlı her etkin satırın etkin kaydı var;
    // void kaydın olayında (başka etkin kayıt yoksa) etkin satır yok; İptal İadesi modül satırı taşımaz, asıl satışı "İptal İadesi Yapıldı".
    const rows = new Map();
    for (const row of store.all(POS_ROW_SQL(Boolean(scope)), ...(scope ? [inList(scope.rowEvents)] : []))) rows.set(row.eventId, row);
    const saleSql = scope ? "SELECT * FROM pos_sales WHERE id IN (SELECT value FROM json_each(?))" : "SELECT * FROM pos_sales";
    const salesList = store.all(saleSql, ...(scope ? [inList(scope.sales)] : []));
    const activeByEvent = new Map();
    for (const sale of salesList) if (sale.status === "active" && sale.src !== "cancel") activeByEvent.set(sale.event_id, sale);
    for (const sale of salesList) {
      const fail = why => out.source.push(`${sale.id} (${sale.kind}/${sale.status}): ${why}`);
      const row = rows.get(sale.event_id) || null;
      if (sale.src === "cancel") {
        const head = store.get("SELECT type FROM fin_events WHERE id = ?", sale.event_id);
        if (!head || head.type !== "pos_cancel_refund") fail("İptal İadesinin başlığı pos_cancel_refund değil");
        const origin = store.get("SELECT status, event_id AS eventId FROM pos_sales WHERE id = ?", sale.origin_id);
        if (sale.status === "active" && (!origin || origin.status !== "cancelled")) fail("asıl satış İptal İadesi yapılmış görünmüyor");
        else if (sale.status === "active" && store.all(POS_ROW_SQL(true), JSON.stringify([origin.eventId])).length) fail("İptal İadesi yapılmış satışın etkin modül satırı var");
      } else if (sale.status === "active") {
        if (!row) fail("etkin kaydın POS'a bağlı etkin satırı yok");
        else if (row.posId !== sale.pos_id || toMinor(Math.abs(Number(row.amount) || 0)) !== Number(sale.gross_minor) || row.date !== sale.date || (row.dir === "in") !== (sale.kind === "sale")) fail(`satır (${row.amount} ${row.date} ${row.dir}) ≠ kayıt (${Number(sale.gross_minor) / 100} ${sale.date})`);
      } else if (sale.status === "void" && row && !activeByEvent.has(sale.event_id) && !activeSaleOf(sale.event_id)) fail("void kaydın etkin satırı var");
    }
    for (const row of rows.values()) if (!activeByEvent.has(row.eventId) && !activeSaleOf(row.eventId) && !repairEvents.has(row.eventId)) out.source.push(`${row.t}:${row.id}: POS satırının satışı/iadesi yok`);
    // pos:refund — kaynaklı iadelerde Σ iade ≤ satış.
    for (const row of store.all(`SELECT s.id, s.gross_minor AS gross, COALESCE(SUM(r.gross_minor), 0) AS refunded FROM pos_sales s JOIN pos_sales r ON r.origin_id = s.id AND r.kind = 'refund' AND r.status = 'active' ${scope ? "WHERE s.id IN (SELECT value FROM json_each(?))" : ""} GROUP BY s.id HAVING refunded > gross`, ...(scope ? [inList(scope.sales)] : []))) {
      out.refund.push(`${row.id}: iade ${Number(row.refunded) / 100} > satış ${Number(row.gross) / 100}`);
    }
    // pos:schedule — Σ kalem brütü = kayıt brütü (void hariç); net = planlanandan; bankaya geçmiş kalemin gün fişi etkin; bekleyenin fişi yok.
    // Onarım Bekliyor (açılış onarımı d: kaynak satırı eski sürümde silinmiş, bankaya geçmiş satış) onarım listesinde izlenir; fiş denetimi dışında.
    const saleFilter = scope ? "AND s.id IN (SELECT value FROM json_each(?))" : "";
    for (const row of store.all(`SELECT s.id, s.gross_minor AS gross, COALESCE(SUM(i.gross_minor), 0) AS items FROM pos_sales s LEFT JOIN pos_items i ON i.sale_id = s.id AND i.status <> 'void' WHERE s.status <> 'void' ${saleFilter} GROUP BY s.id`, ...(scope ? [inList(scope.sales)] : []))) {
      if (Number(row.items) !== Number(row.gross)) out.schedule.push(`${row.id}: kalemler ${Number(row.items) / 100} ≠ ${Number(row.gross) / 100}`);
    }
    const itemFilter = scope ? "AND i.sale_id IN (SELECT value FROM json_each(?))" : "";
    for (const item of store.all(`SELECT i.id, i.role, i.status, i.net_minor AS net, i.planned_net_minor AS planned, i.event_id AS eventId, e.status AS eventStatus, e.type AS eventType FROM pos_items i LEFT JOIN fin_events e ON e.id = i.event_id WHERE i.status IN ('pending', 'settled') AND i.sale_id NOT IN (SELECT id FROM pos_sales WHERE status = 'repair') ${itemFilter}`, ...(scope ? [inList(scope.sales)] : []))) {
      // Satış kaleminde net = max(0, planlanan); iade kaleminde planlanan çıkıştır (eksi), net = max(0, −planlanan).
      const want = Math.max(0, item.role === "refund" ? -Number(item.planned) : Number(item.planned));
      if (Number(item.net) !== want) out.schedule.push(`${item.id}: net ${item.net} ≠ ${want}`);
      if (item.status === "settled" && (item.eventStatus !== "active" || item.eventType !== "pos_settlement")) out.schedule.push(`${item.id}: bankaya geçmiş kalemin etkin gün fişi yok`);
      if (item.status === "pending" && item.eventId) out.schedule.push(`${item.id}: bekleyen kalemin fişi var`);
    }
    // bank:party — gün fişinin kesinti satırları = kalemlerin KDV kipi kesintisi (sağlayıcı bazında, kayıttaki sağlayıcı kopyasıyla). Onay kipinde
    // onaylanan fişte "Komisyon Farkı" kesintiye eklenir (planlanandan farkı bilinçli); onların denetimi yalnız fişin etkin olmasıdır.
    const voucherSql = scope ? "SELECT id, no, description FROM fin_events WHERE id IN (SELECT value FROM json_each(?)) AND type = 'pos_settlement' AND status = 'active'" : "SELECT id, no, description FROM fin_events WHERE type = 'pos_settlement' AND status = 'active'";
    for (const voucher of store.all(voucherSql, ...(scope ? [inList(scope.vouchers)] : []))) {
      if (/Onaylandı/.test(voucher.description || "")) continue;
      const items = store.all("SELECT i.role, i.gross_minor AS gross, i.commission_minor AS commission, i.tax_minor AS tax, i.fee_minor AS fee, s.tax_kind AS taxKind, s.tax_mode AS taxMode, s.provider_account_id AS provider FROM pos_items i JOIN pos_sales s ON s.id = i.sale_id WHERE i.event_id = ?", voucher.id);
      const totals = dayTotals(items.map(item => ({ role: item.role, gross: Number(item.gross), deduction: deductionOf({ commission: Number(item.commission), tax: Number(item.tax) }, item.taxMode) + Number(item.fee || 0), taxKind: item.taxKind, provider: item.provider })));
      const fees = new Map();
      for (const row of store.all("SELECT account_id AS provider, kind, amount FROM account_entries WHERE source = 'bank' AND source_id = ?", voucher.id)) {
        fees.set(row.provider, (fees.get(row.provider) || 0) + (row.kind === "out" ? 1 : -1) * toMinor(Math.abs(Number(row.amount) || 0)));
      }
      for (const provider of new Set([...totals.vat.keys(), ...fees.keys()])) {
        if ((totals.vat.get(provider) || 0) !== (fees.get(provider) || 0)) out.party.push(`${voucher.no}: sağlayıcı ${provider} kesinti ${(fees.get(provider) || 0) / 100} ≠ kalemler ${(totals.vat.get(provider) || 0) / 100}`);
      }
    }
    const feeFilter = scope ? "AND e.source_id IN (SELECT value FROM json_each(?))" : "";
    for (const row of store.all(`SELECT e.id FROM account_entries e LEFT JOIN fin_events f ON f.id = e.source_id WHERE e.source = 'bank' ${feeFilter} AND (f.id IS NULL OR f.type <> 'pos_settlement' OR f.status <> 'active')`, ...(scope ? [inList(scope.vouchers)] : []))) out.party.push(`account_entries:${row.id}: kesinti satırının etkin gün fişi yok`);
    return out;
  }
  /** Mutabakat Testi / kapı kalemleri (integrity.mjs bankItems). events: kapıda dokunulan olaylar (yoksa tam tarama). */
  function checkItems({ events = null } = {}) {
    if (!isReady() || !store.get("SELECT 1 AS found FROM pos_terminals LIMIT 1")) return [];
    const found = problems({ events });
    const items = found.terminal.map(item => ({ code: `pos:terminal:${item.pos.sub}`, name: `POS Bekleyen Mutabakatı (${item.pos.sub} ${item.pos.code} · ${item.pos.name})`, ok: item.ok, difference: (item.ledgerMinor - item.pendingMinor) / 100, ledger: item.ledgerMinor / 100, subledger: item.pendingMinor / 100 }));
    const list = (code, name, rows) => ({ code, name, ok: rows.length === 0, count: rows.length, sample: rows.slice(0, 5), ...(events ? { scoped: true, gateCount: rows.length } : {}) });
    items.push(list("pos:source", "POS ile Tahsilat Satırı", found.source), list("pos:refund", "POS İadesi ≤ Satış", found.refund), list("pos:schedule", "POS Valör Takvimi", found.schedule), list("bank:party", "POS Kesintisi ile Sağlayıcı", found.party));
    return items;
  }

  return {
    list, detail, create, update, setStatus, remove, addRates, movePending, rateRows,
    pick, reconcile, runQueue, drain, confirm, beforeLock, settleDue: drain,
    pendingStats, calendarView, flows, sales, saleDetail, saleByRef, eventInfo, choices, voidTarget, preview, origins,
    commissionInvoices, commissionReport, createCommissionDrafts, autoDrafts, invoiceIssued, checkItems, problems, dueGroups, isReady,
    voidable: sale => saleView(sale).voidable,
  };
}

/**
 * Valör kuyruğunun tetikleri (plan §4.4/2): start() açılışta bir tur (setImmediate; açılışı beklemez) + 15 dakikada bir (unref); kalan grup
 * varsa sonraki tur setImmediate ile. kick(): hemen bir tur. stop(): kapanışta. Tur hatası günlüğe yazılır (iş durmaz).
 */
export function createPosQueue({ pos, log = null, minutes = 15 }) {
  let timer = null;
  let scheduled = false;
  let stopped = false;
  function tick() {
    scheduled = false;
    if (stopped) return;
    try {
      const service = pos();
      if (!service?.isReady?.()) return;
      const result = service.runQueue();
      try {
        service.autoDrafts();
      } catch (error) {
        log?.warn?.(`POS komisyon taslağı açılamadı: ${error.message}`);
      }
      if (result.remaining && result.settled && !result.failed) schedule();
    } catch (error) {
      log?.error?.("POS valör kuyruğu çalışmadı", error);
    }
  }
  function schedule() {
    if (scheduled || stopped) return;
    scheduled = true;
    setImmediate(tick);
  }
  return {
    start() {
      if (stopped || timer) return;
      timer = setInterval(schedule, minutes * 60_000);
      timer.unref?.();
      schedule();
    },
    kick: schedule,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
