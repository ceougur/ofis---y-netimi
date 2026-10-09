// Banka Fişi motoru (v2.1.0 Aşama 4; docs/BANKA-MODULU-PLAN.md §3.6, §3.7 #12–18, §3.8 "Banka Fişi", §3.10, §3.11, K2, K3, K8, Ek A).
//
// Banka penceresinden girilen, bankanın doğurduğu olaylar: Masraf (BSMV Dahil / Hariç / Yok; KDV Dahil / Hariç → tek işlemde gider faturası +
// bu hesaptan havale), Faiz Geliri (stopaj 193), Faiz Gideri (780 + BSMV/KKDF), Diğer Gelir / Gider (beyaz listedeki hesaplar), Kart Borcu Ödemesi
// (309), Kredi Kullanımı / Geri Ödemesi (300 + faiz 780). Her yazım bank.post'tan geçer (tek işlem, İşlem No, istek kimliği, Benzer İşlem, kapı).
// Satırlar lib/bank/voucher.mjs'teki saf kurucularla kurulur (denge ve beyaz liste assertLines; kapı bank:voucher ayrıca denetler).
//
// Kurallar (Ek A; kullanıcıya sorulmadı, en yaygın ve modern seçenek):
//   - Doğrulama yazımla AYNI işlemin içinde: istek kimliğiyle yinelenen istek önce önceki yanıtını alır (sonradan kilitlenen gün ya da
//     ters kaydedilen fiş yinelemeyi 409'a çevirmez).
//   - Ters Kaydet: ters fiş asıl fişin aynası; asıl fiş açık dönemdeyse AYNI tarihli, kilitliyse BUGÜN tarihli (kilitli dönem değişmez, kilit
//     izi aynı). KDV'li masrafta ters fiş yoktur: fatura iptal edilir (cari, KDV, ödeme satırı geri) ve masraf başlığı iptal edilir; fatura kilitli
//     dönemde iptal edilmediği için kilitli KDV'li masraf 409.
//   - Düzelt = Ters Kaydet + yeni fiş, tek işlemde; tür değişmez (yeni tür için Ters Kaydet + yeni fiş). Yeni fişin tarihi verilmezse asıl tarih
//     (açık dönemde) ya da bugün; verilen tarih kilitliyse 409 ve hiçbir şey yazılmaz.
//   - Açıklama ve referans para alanı değildir: kilitli dönemde de düzeltilir (kapı dışı).
//   - Planlı İşlem (K3): DEFTERE GİRMEZ (bank_plans); günü gelince Vadesi Gelen kuyruğuna düşer, "Gerçekleştir" ile planlı tarihle (ya da
//     verilen tarihle) fiş yazılır. Kendiliğinden deftere yazma yok (bankanın talimatı gerçekten işleyip işlemediği ekstreyle görülür).
//   - Fiş yalnız TL hesapta (döviz hesabı Aşama 13'te).
//   - Eksi bakiye (K7, plan §3.9; GG2): fiş, Düzelt ve Planlı Gerçekleştir yazımdan SONRAKİ son durumla, hesap bazında denetlenir: bakiye =
//     min(işlem günündeki, bütün hareketlerle) + KMH / kart limiti. Bakiye Doğrulandı olmayan hesapta Kontrol Yok; Uyar → 409 bank-negative
//     ("Yine de Kaydet" = negativeOk), Engelle → 409 bank-blocked (onayla da geçmez). Bakiyeyi artıran hesap denetlenmez.
import { randomUUID } from "node:crypto";
import { HttpError, limited, text } from "../http.mjs";
import { systemClock } from "../clock.mjs";
import { addCalendarDays, addMonths } from "../business-days.mjs";
import { isIsoDate } from "../period.mjs";
import { mulPpm, parseMinor, parsePpm } from "../minor.mjs";
import { ACCOUNT_KINDS } from "./accounts.mjs";
import { GROUP_LABELS, VOUCHER_TYPES, isVoucherType, typeLabel } from "./event-types.mjs";
import { CHART } from "../general-ledger.mjs";
import { ROLE_GL, assertLines, cardPaymentLines, feeLines, feeSplit, interestInLines, interestOutLines, loanDrawLines, loanRepayLines, otherLines, roleOfAccount, transferLines } from "./voucher.mjs";
import { minorPlain } from "./movements.mjs";
import { FEE_GL } from "./settings.mjs";

const BANK_KINDS = new Set(["demand", "commercial", "other"]);
// Bankalar arası transfer (Aşama 9; §3.5: vadeli hesap "yalnız transfer ve faiz"): 102 ailesinin TL hesapları. Kredi (300) kullanımı/geri ödemesi
// ve kurumsal kart (309) borcu kendi türleriyle (Kredi Kullanımı, Kredi Geri Ödemesi, Kart Borcu Ödemesi) girilir.
const TRANSFER_KINDS = new Set([...BANK_KINDS, "time"]);
const TYPE_RULES = Object.freeze({
  fee: { main: BANK_KINDS, purpose: "banka masrafı Vadesiz, Ticari ya da Diğer TL hesaptan girilir" },
  interest_in: { main: new Set([...BANK_KINDS, "time"]), purpose: "faiz geliri vadesiz, ticari, diğer ya da vadeli TL hesaba girilir" },
  interest_out: { main: BANK_KINDS, purpose: "faiz gideri Vadesiz, Ticari ya da Diğer TL hesaptan girilir" },
  other_in: { main: BANK_KINDS, purpose: "diğer gelir Vadesiz, Ticari ya da Diğer TL hesaba girilir" },
  other_out: { main: BANK_KINDS, purpose: "diğer gider Vadesiz, Ticari ya da Diğer TL hesaptan girilir" },
  card_payment: { main: BANK_KINDS, purpose: "kart borcu Vadesiz, Ticari ya da Diğer TL hesaptan ödenir", counter: { field: "cardAccountId", kinds: new Set(["card"]), label: "Kurumsal Kredi Kartı", purpose: "kurumsal kredi kartı hesabı değil" } },
  loan_draw: { main: BANK_KINDS, purpose: "kredi Vadesiz, Ticari ya da Diğer TL hesaba kullanılır", counter: { field: "loanAccountId", kinds: new Set(["loan"]), label: "Kredi Hesabı", purpose: "kredi hesabı değil" } },
  loan_repay: { main: BANK_KINDS, purpose: "kredi Vadesiz, Ticari ya da Diğer TL hesaptan ödenir", counter: { field: "loanAccountId", kinds: new Set(["loan"]), label: "Kredi Hesabı", purpose: "kredi hesabı değil" } },
  transfer: { main: TRANSFER_KINDS, purpose: "bankalar arası transfer Vadesiz, Ticari, Vadeli ya da Diğer TL hesaptan yapılır (kredi kullanımı ve kart borcu kendi işlem türüyle)", counter: { field: "toAccountId", kinds: TRANSFER_KINDS, label: "Alıcı Hesap", purpose: "bankalar arası transfer Vadesiz, Ticari, Vadeli ya da Diğer TL hesaba yapılır (kredi geri ödemesi ve kart borcu kendi işlem türüyle)" } },
});
/** Masrafın vergi kipleri (Ek A.1/24: hesabı masraf türü belirler, kip yalnız vergi satırını değiştirir). */
export const FEE_TAXES = Object.freeze({ bsmv_incl: "BSMV Dahil", bsmv_excl: "BSMV Hariç", vat_incl: "KDV Dahil (Faturalı)", vat_excl: "KDV Hariç (Faturalı)", none: "Yok" });
const VAT_TAXES = new Set(["vat_incl", "vat_excl"]);
/** Transfer Yapma yetkisi isteyen türler (§9.1: bankalar arası transfer, kredi kullanımı ve geri ödemesi). */
export const TRANSFER_TYPES = Object.freeze(new Set(["transfer", "loan_draw", "loan_repay"]));
/** POST /bank/transfers'ın türleri (§7: "Bankalar arası, kredi kullanımı/geri ödeme"). Bankalar arası transfer yalnız bu uçtan girilir. */
export const TRANSFER_ENDPOINT_TYPES = Object.freeze(["transfer", "loan_draw", "loan_repay"]);
/** Transferin kanalı (fin_events.channel; ekranda ve İşlem Kartı'nda adıyla; ekstre eşleştirmesinde ipucu). İsteğe bağlı (Ek A). */
export const TRANSFER_CHANNELS = Object.freeze({ eft: "EFT", fast: "FAST", havale: "Havale", virman: "Virman" });
const CHANNEL_KEYS = Object.freeze(Object.fromEntries(Object.entries(TRANSFER_CHANNELS).map(([key, label]) => [label, key])));
/** Transfer ücretinin vergi kipleri: BSMV'li ya da vergisiz (KDV'li, faturalı masraf Banka → + Masraf'tan; fatura numarası gerekir). */
const TRANSFER_FEE_TAXES = new Set(["bsmv_incl", "bsmv_excl", "none"]);
/** Valör en çok işlem tarihinden bu kadar gün sonra olabilir (EFT/FAST'te ertesi iş günü; hafta sonu ve bayram araları dahil). */
export const VALUE_DATE_MAX_DAYS = 30;
export const PLAN_REPEATS = Object.freeze({ none: "Tekrar Yok", weekly: "Haftalık", monthly: "Aylık", quarterly: "Üç Aylık", yearly: "Yıllık" });
export const PLAN_STATUS = Object.freeze({ planned: "Planlı", done: "Gerçekleşti", cancelled: "İptal Edildi" });
const MANUAL_ROLES = new Set(["bank", "expense", "tax", "income", "fx_gain", "fx_loss", "stoppage"]);
// Faturalı masrafın gider türü (lib/invoice-math.mjs EXPENSES): hesap eşlemesindeki kod bu türlerden birine düşer; düşmezse masraf türünün kodu.
const INVOICE_EXPENSE = Object.freeze({ 770: "bank", 653: "commission" });
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const labelOf = row => `${row.bank_name} · ${row.name}`;
const shape = row => ({ id: row.id, kind: row.kind, gl: row.gl, glSub: row.gl_sub, currency: row.currency });
const bad = (status, message, code, extra = {}) => new HttpError(status, message, { code, ...extra });
const given = value => value !== undefined && value !== null && !(typeof value === "string" && !value.trim());

/**
 * @param {{ store, bank, period, accounts, movements, invoices: () => object, parties: () => object, audit, now }} options
 *   accounts: banka hesap servisi (rowOf, settings); movements: İşlem Kartı ve olay okuyucusu; invoices: Fatura servisi (issueBankFee, cancel);
 *   parties: Cari servisi (exists)
 */
export function createBankVouchers({ store, bank, period, money, accounts, movements, invoices = () => null, parties = () => null, audit = () => {}, now = systemClock }) {
  const stamp = () => now().toISOString();
  const settings = () => accounts.settings.read();
  const today = () => period.today();

  // ---------- Girdi ----------
  function accountFor(id, { field = "accountId", label = "Banka Hesabı", kinds, purpose, currencyText = "" }) {
    const key = text(id);
    if (!key) throw bad(400, `${label} seçin.`, "bank-account-required", { field });
    const row = accounts.rowOf(key);
    if (!row) throw bad(404, "Banka hesabı bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", "bank-account-missing", { field });
    if (row.status !== "active") throw bad(400, `${labelOf(row)} pasif; işlem girmek için önce Etkinleştir.`, "bank-account-invalid", { field });
    if (row.currency !== "TRY") throw bad(400, currencyText || `${labelOf(row)} ${row.currency} hesabı; bu işlem yalnız TL hesapta girilir (döviz işlemleri Döviz Alım Satımı'nda).`, "bank-currency", { field });
    if (!kinds.has(row.kind)) throw bad(400, `${labelOf(row)} (${ACCOUNT_KINDS[row.kind]?.label || row.kind}): ${purpose}.`, "bank-account-invalid", { field });
    return row;
  }
  const typeOf = (value, { transfer = false } = {}) => {
    const type = text(value);
    if (type === "transfer" && transfer) return type;
    if (!isVoucherType(type)) throw bad(400, `İşlem türü tanınmadı ya da bu formdan girilmez (${type.slice(0, 30) || "boş"}). Banka Masrafı, Faiz Geliri, Faiz Gideri, Diğer Gelir, Diğer Gider, Kart Borcu Ödemesi, Kredi Kullanımı ya da Kredi Geri Ödemesi seçin.`, "bank-voucher-type", { field: "type" });
    return type;
  };
  const amountOf = (value, label = "Tutar", { allowZero = false } = {}) => parseMinor(value, { label, allowZero });
  const optionalAmount = (value, label) => (given(value) ? amountOf(value, label, { allowZero: true }) : 0);
  function feeOf(body, values) {
    const types = values.fee.types || [];
    const key = text(body.feeType) || (types.find(type => type.key === "diger") || types[0])?.key || "";
    const feeType = types.find(type => type.key === key);
    if (!feeType) throw bad(400, `Masraf türü tanınmadı (${key.slice(0, 40)}). Banka Ayarları → Masraf Türleri'nden seçin.`, "bank-fee-type", { field: "feeType" });
    const tax = text(body.tax) || values.fee.tax;
    if (!Object.hasOwn(FEE_TAXES, tax)) throw bad(400, "Masraf vergisi BSMV Dahil, BSMV Hariç, KDV Dahil, KDV Hariç ya da Yok olmalı.", "bank-tax", { field: "tax" });
    const vat = VAT_TAXES.has(tax);
    const ratePpm = tax === "none" ? 0 : parsePpm(given(body.taxRate) ? body.taxRate : vat ? "20" : "5", { label: vat ? "KDV Oranı" : "BSMV Oranı" });
    // Hesap eşlemesi (Banka Ayarları → Hesap Eşlemeleri): masraf türünün ailesi (770 banka masrafı / 653 komisyon) eşlemedeki koda gider.
    // Eski sürümden kalan izinsiz eşleme (770/653 dışı) türün kendi hesabına düşer: BSMV'li ve faturalı kip aynı hesapta kalır (GG2).
    const mapped = feeType.gl === "653" ? values.gl.commission : values.gl.fee;
    const gl = FEE_GL.includes(mapped) ? mapped : feeType.gl;
    return { feeType, tax, vat, ratePpm, gl };
  }
  /**
   * Bankalar arası transferin ücreti (Aşama 9; §3.7 #11 "Ücretli (EFT 5,00 + BSMV 0,25)"): isteğe bağlı; yoksa ya da sıfırsa null. Vergi kipi
   * BSMV Dahil, BSMV Hariç ya da Yok (varsayılan Banka Ayarları → Masraf Vergisi; KDV'li kip seçiliyse BSMV Dahil). Masraf türü verilmezse
   * kanalın türü (EFT, FAST, Havale), yoksa EFT. Hesabı masraf türü belirler (Hesap Eşlemeleri; masraf fişiyle aynı kural). `fee` nesnesi de
   * kabul edilir (plan §7 "fee isteğe bağlı"): { amount, tax, rate, type }.
   */
  function transferFeeOf(body, values, channelKey) {
    const raw = body.fee && typeof body.fee === "object" ? { feeAmount: body.fee.amount, feeTax: body.fee.tax, feeRate: body.fee.rate, feeType: body.fee.type } : body;
    if (!given(raw.feeAmount)) return null;
    const amountMinor = amountOf(raw.feeAmount, "Ücret", { allowZero: true });
    if (!amountMinor) return null;
    const fallbackTax = TRANSFER_FEE_TAXES.has(values.fee.tax) ? values.fee.tax : "bsmv_incl";
    const tax = text(raw.feeTax) || fallbackTax;
    if (!TRANSFER_FEE_TAXES.has(tax)) throw bad(400, "Transfer ücretinin vergisi BSMV Dahil, BSMV Hariç ya da Yok olmalı. KDV'li (faturalı) banka masrafını Banka → + Masraf ile girin (fatura numarasıyla).", "bank-tax", { field: "feeTax" });
    const types = values.fee.types || [];
    const key = text(raw.feeType) || (types.find(type => type.key === channelKey) ? channelKey : types.find(type => type.key === "eft") ? "eft" : (types.find(type => type.key === "diger") || types[0])?.key || "");
    const feeType = types.find(type => type.key === key);
    if (!feeType) throw bad(400, `Ücret türü tanınmadı (${key.slice(0, 40)}). Banka Ayarları → Masraf Türleri'nden seçin.`, "bank-fee-type", { field: "feeType" });
    const ratePpm = tax === "none" ? 0 : parsePpm(given(raw.feeRate) ? raw.feeRate : "5", { label: "BSMV Oranı" });
    const mapped = feeType.gl === "653" ? values.gl.commission : values.gl.fee;
    const gl = FEE_GL.includes(mapped) ? mapped : feeType.gl;
    return { ...feeSplit({ amountMinor, tax, ratePpm }), tax, ratePpm, gl, feeType };
  }
  /** Transferin kanalı: anahtar (eft) ya da ad (EFT); boş → "". Tanınmazsa 400. */
  function channelOf(value) {
    if (!given(value)) return { key: "", label: "" };
    const raw = text(value);
    const key = Object.hasOwn(TRANSFER_CHANNELS, raw.toLocaleLowerCase("tr-TR")) ? raw.toLocaleLowerCase("tr-TR") : CHANNEL_KEYS[raw] || "";
    if (!key) throw bad(400, `Kanal tanınmadı (${raw.slice(0, 20)}). ${Object.values(TRANSFER_CHANNELS).join(", ")} seçin ya da boş bırakın.`, "bank-channel", { field: "channel" });
    return { key, label: TRANSFER_CHANNELS[key] };
  }
  /** Düz banka fişi alanı ya da { vat } (faturalı masraf) — satırlar. */
  function linesOf(type, body, { account, counter, amountMinor, values, channelKey = "" }) {
    switch (type) {
      case "transfer": {
        const fee = transferFeeOf(body, values, channelKey);
        return { transferFee: fee, lines: transferLines({ from: shape(account), to: shape(counter), amountMinor, fee: fee ? { base: fee.base, tax: fee.taxMinor, gl: fee.gl, name: fee.feeType.name, ratePpm: fee.ratePpm } : null }) };
      }
      case "fee": {
        const fee = feeOf(body, values);
        if (fee.vat) return { fee };
        const built = feeLines({ account: shape(account), amountMinor, tax: fee.tax, ratePpm: fee.ratePpm, gl: fee.gl, feeName: fee.feeType.name });
        return { fee, lines: built.lines };
      }
      case "interest_in": {
        let stoppage;
        if (given(body.stoppageAmount)) stoppage = amountOf(body.stoppageAmount, "Stopaj Tutarı", { allowZero: true });
        else stoppage = mulPpm(amountMinor, parsePpm(given(body.stoppageRate) ? body.stoppageRate : "0", { label: "Stopaj Oranı" }));
        if (stoppage >= amountMinor) throw bad(400, "Stopaj brüt faizden küçük olmalı (net faiz sıfırdan büyük).", "bank-stoppage", { field: "stoppageAmount" });
        return { lines: interestInLines({ account: shape(account), grossMinor: amountMinor, stoppageMinor: stoppage, gl: values.gl.interestIncome }) };
      }
      case "interest_out":
        return { lines: interestOutLines({ account: shape(account), amountMinor, taxMinor: optionalAmount(body.taxAmount, "BSMV / KKDF"), gl: values.gl.interestExpense }) };
      case "other_in":
      case "other_out": {
        const direction = type === "other_in" ? "in" : "out";
        const role = direction === "in" ? "income" : "expense";
        const gl = text(body.gl) || (direction === "in" ? values.gl.otherIncome : values.gl.otherExpense);
        if (!ROLE_GL[role].includes(gl)) throw bad(400, `${gl.slice(0, 10) || "Boş"} hesabı ${direction === "in" ? "Diğer Gelir" : "Diğer Gider"} satırına yazılamaz. İzinli: ${ROLE_GL[role].join(", ")}.`, "bank-gl-forbidden", { field: "gl", gl });
        return { lines: otherLines({ account: shape(account), direction, amountMinor, gl }) };
      }
      case "card_payment":
        return { lines: cardPaymentLines({ bank: shape(account), card: shape(counter), amountMinor }) };
      case "loan_draw":
        return { lines: loanDrawLines({ bank: shape(account), loan: shape(counter), amountMinor }) };
      case "loan_repay":
        return { lines: loanRepayLines({ bank: shape(account), loan: shape(counter), principalMinor: amountMinor, interestMinor: optionalAmount(body.interestAmount, "Faiz"), gl: values.gl.interestExpense }) };
      default:
        throw bad(400, "İşlem türü tanınmadı.", "bank-voucher-type");
    }
  }
  /** Elle Banka Fişi (Banka Ayarları → Diğer → Elle Banka Fişi; yalnız Diğer Gelir / Gider): satırlar beyaz listede, dengede, banka satırlı. */
  function manualLines(type, raw, account) {
    if (!["other_in", "other_out"].includes(type)) throw bad(400, "Elle satır yalnız Diğer Gelir ya da Diğer Gider fişinde girilir.", "bank-voucher", { field: "lines" });
    if (!Array.isArray(raw) || raw.length < 2 || raw.length > 50) throw bad(400, "Elle fişte en az 2, en çok 50 satır olur.", "bank-voucher", { field: "lines" });
    const lines = raw.map((item, index) => {
      const at = `${index + 1}. satır`;
      const role = text(item?.role);
      if (!MANUAL_ROLES.has(role)) throw bad(400, `${at}: satır rolü tanınmadı (${role.slice(0, 20) || "boş"}).`, "bank-gl-forbidden", { field: "lines" });
      const side = text(item?.side);
      if (side !== "D" && side !== "C") throw bad(400, `${at}: taraf Borç (D) ya da Alacak (C) olmalı.`, "bank-voucher", { field: "lines" });
      const minor = amountOf(item?.amount, `${at} tutarı`);
      if (role === "bank") {
        if (text(item?.accountId) !== account.id) throw bad(400, `${at}: banka satırı fişin hesabına (${labelOf(account)}) yazılır.`, "bank-account-invalid", { field: "lines" });
        return { role: roleOfAccount(account), gl: account.gl, sub: account.gl_sub, ref: account.id, side, tryMinor: minor, currency: "TRY", fxMinor: minor };
      }
      return { role, gl: text(item?.gl), side, tryMinor: minor, currency: "TRY", fxMinor: minor, ...(text(item?.memo) ? { memo: limited(item.memo, 120, "Satır Açıklaması") } : {}) };
    });
    assertLines(lines);
    const bankLines = lines.filter(line => line.ref === account.id);
    if (!bankLines.length) throw bad(400, "Elle fişte banka hesabı satırı yok.", "bank-voucher", { field: "lines" });
    const net = bankLines.reduce((sum, line) => sum + (line.side === "D" ? line.tryMinor : -line.tryMinor), 0);
    if (!net || (type === "other_in") !== net > 0) throw bad(400, `${type === "other_in" ? "Diğer Gelir" : "Diğer Gider"} fişinde banka hesabı ${type === "other_in" ? "artmalı (borç)" : "azalmalı (alacak)"}.`, "bank-voucher", { field: "lines" });
    return lines;
  }

  /**
   * Fişin tanımı (doğrulanmış; yazım yok). dateMode: "move" (hareket tarihi: ileri tarih ve kilit denetimi), "plan" (planlı tarih: yalnız
   * biçim ve hesabın açılışı). fallbackDate: tarih gönderilmezse kullanılacak gün (Düzelt, Planlı İşlem).
   */
  function specOf(body = {}, { dateMode = "move", fallbackDate = "", forPlan = false } = {}) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw bad(400, "İşlem bilgisi okunamadı.", "bank-voucher");
    const type = typeOf(body.type, { transfer: true });
    const rule = TYPE_RULES[type];
    const values = settings();
    const isTransfer = type === "transfer";
    // Aşama 9 (plan Aşama 9 Nasıl Bozarım, kullanıcı kararı: döviz ertelendi): farklı para birimli hesaplar arasında transfer 400; ertelenen
    // döviz al/sat ekranda önerilmez. Aynı para birimli döviz hesapları da bu sürümde transfer edilmez (Banka Fişi yalnız TL hesapta).
    if (isTransfer) {
      const from = accounts.rowOf(text(body.accountId));
      const to = accounts.rowOf(text(body[rule.counter.field]));
      if (from && to && from.currency !== to.currency) throw bad(400, `Farklı para birimli hesaplar arasında transfer yapılamaz (${labelOf(from)} ${from.currency === "TRY" ? "TL" : from.currency}, ${labelOf(to)} ${to.currency === "TRY" ? "TL" : to.currency}).`, "bank-currency", { field: rule.counter.field });
    }
    const currencyText = isTransfer ? "Bankalar arası transfer yalnız TL hesaplar arasında yapılır." : "";
    const account = accountFor(body.accountId, { kinds: rule.main, purpose: rule.purpose, currencyText, ...(isTransfer ? { label: "Gönderen Hesap" } : {}) });
    let counter = null;
    if (rule.counter) {
      counter = accountFor(body[rule.counter.field], { field: rule.counter.field, label: rule.counter.label, kinds: rule.counter.kinds, purpose: rule.counter.purpose, currencyText });
      if (counter.id === account.id) throw bad(400, isTransfer ? "Gönderen ve alıcı hesap aynı olamaz; transfer iki farklı hesap arasında yapılır." : "Aynı hesap iki tarafta olamaz.", "bank-account-invalid", { field: rule.counter.field });
    }
    const channel = isTransfer ? channelOf(body.channel) : { key: "", label: "" };
    let date;
    if (dateMode === "plan") {
      date = text(body.plannedDate ?? body.date);
      if (!isIsoDate(date)) throw bad(400, "Planlı tarih geçerli bir tarih değil. Takvimden seçin.", "date-invalid", { field: "plannedDate" });
    } else date = period.movementDate(body, { field: "date", label: "İşlem Tarihi", fallback: fallbackDate });
    for (const row of [account, counter].filter(Boolean)) {
      if (date < row.opening_date) throw bad(409, `İşlem tarihi (${dayText(date)}) ${labelOf(row)} hesabının açılışından (${dayText(row.opening_date)}) önce olamaz. Açılış, o günün başındaki bakiyedir.`, "bank-before-opening", { field: "date", accountId: row.id });
    }
    const manual = Array.isArray(body.lines);
    if (manual && !values.other.manualVoucher) throw bad(409, "Elle Banka Fişi kapalı. Banka Ayarları → Gelişmiş → Diğer → Elle Banka Fişi'nden açılır.", "bank-manual-off", { field: "lines" });
    if (manual && forPlan) throw bad(400, "Elle fiş planlanmaz.", "bank-voucher", { field: "lines" });
    if (manual && isTransfer) throw bad(400, "Transferde elle satır girilmez.", "bank-voucher", { field: "lines" });
    // Valör (Aşama 9): transferde paranın alıcı hesaba geçtiği gün (EFT mesai dışında ertesi iş günü). Bilgidir; satır işlem tarihinde yazılır.
    let valueDate = "";
    if (isTransfer && dateMode !== "plan" && given(body.valueDate)) {
      valueDate = text(body.valueDate);
      const last = addCalendarDays(date, VALUE_DATE_MAX_DAYS);
      if (!isIsoDate(valueDate) || valueDate < date || valueDate > last) throw bad(400, `Valör tarihi işlem tarihi (${dayText(date)}) ile ${dayText(last)} arasında olmalı.`, "bank-value-date", { field: "valueDate" });
      if (valueDate === date) valueDate = "";
    }
    const amountMinor = manual ? 0 : amountOf(body.amount);
    const built = manual ? { lines: manualLines(type, body.lines, account) } : linesOf(type, body, { account, counter, amountMinor, values, channelKey: channel.key });
    if (built.lines) assertLines(built.lines);
    const spec = {
      type,
      account,
      counter,
      date,
      valueDate,
      channel: channel.label,
      transferFee: built.transferFee || null,
      amountMinor,
      lines: built.lines || null,
      fee: built.fee || null,
      description: limited(body.description, 500, "Açıklama"),
      reference: limited(body.reference, 100, "Referans"),
      vat: null,
    };
    if (built.fee?.vat) {
      if (forPlan) throw bad(400, "Faturalı (KDV'li) masraf planlanmaz: faturanın numarası ve tarihi masraf gerçekleşince belli olur. Planı BSMV'li ya da vergisiz girin; faturayı gelince Masraf'tan girin.", "bank-plan-tax", { field: "tax" });
      const partyId = text(body.partyId);
      if (!partyId) throw bad(400, "Faturalı masrafta faturayı kesen cariyi (banka ya da ödeme kuruluşu) seçin.", "bank-fee-party", { field: "partyId" });
      const invoiceNo = limited(body.invoiceNo, 40, "Fatura No").toLocaleUpperCase("tr-TR");
      if (!invoiceNo) throw bad(400, "Faturalı masrafta faturanın numarasını yazın.", "bank-fee-invoice", { field: "invoiceNo" });
      if (!parties()?.exists?.(partyId)) throw bad(404, "Seçilen cari bulunamadı; silinmiş olabilir.", "bank-party-missing", { field: "partyId" });
      const expenseCode = INVOICE_EXPENSE[built.fee.gl] || INVOICE_EXPENSE[built.fee.feeType.gl] || "bank";
      spec.vat = { partyId, invoiceNo, expenseCode, ratePpm: built.fee.ratePpm, includes: built.fee.tax === "vat_incl", name: built.fee.feeType.name };
    }
    return spec;
  }
  /** Bu istek faturalı (KDV'li) masraf mı? (rota: Fatura Yönetimi yetkisi). Vergi verilmezse Banka Ayarları'ndaki varsayılan. */
  function needsInvoice(body = {}) {
    if (text(body?.type) !== "fee") return false;
    const tax = text(body?.tax) || settings().fee.tax;
    return VAT_TAXES.has(tax);
  }

  // ---------- Yazım (bank.post'un write geri çağrısında) ----------
  /** KDV'li masrafın Benzer İşlem denetimi (§3.10/2): aynı hesap, aynı cari, aynı iş günü, aynı ödenecek tutarda etkin faturalı masraf. */
  function vatSimilar(spec, payableMinor, invoiceId) {
    const businessDay = bank.businessDayOf();
    const day = businessDay(spec.date);
    const rows = store.all(
      `SELECT e.id, e.no, e.date, e.created_by AS createdBy, e.created_at AS createdAt, COALESCE(u.display_name, '') AS createdByName, i.try_payable AS payable
       FROM fin_events e LEFT JOIN users u ON u.id = e.created_by JOIN invoices i ON i.id = e.invoice_id
       WHERE e.bank_ref = ? AND e.date BETWEEN ? AND ? AND +e.type = 'fee' AND +e.status = 'active' AND +e.src_table = '' AND +e.party_id = ? AND e.invoice_id <> '' AND e.invoice_id <> ?
       ORDER BY e.date, e.created_at`,
      spec.account.id, addCalendarDays(spec.date, -12), addCalendarDays(spec.date, 12), spec.vat.partyId, invoiceId,
    );
    const match = rows.find(row => Math.round(Number(row.payable) * 100) === payableMinor && businessDay(row.date) === day);
    if (match) throw bank.similarError(match);
  }
  function writeSpec(user, spec, { similarOk = false, checkSimilar = true } = {}) {
    if (spec.vat) {
      const service = invoices();
      if (!service?.issueBankFee) throw new HttpError(500, "Fatura servisi kurulmamış.");
      const invoice = service.issueBankFee(user, {
        partyId: spec.vat.partyId,
        number: spec.vat.invoiceNo,
        date: spec.date,
        name: spec.vat.name,
        expenseCode: spec.vat.expenseCode,
        vatRate: spec.vat.ratePpm / 10_000,
        unitPrice: spec.amountMinor / 100,
        pricesIncludeVat: spec.vat.includes,
        bankAccountId: spec.account.id,
        note: spec.description,
      });
      if (checkSimilar && !similarOk) vatSimilar(spec, invoice.payableMinor, invoice.id);
      const header = bank.voucher({ type: "fee", date: spec.date, bankRef: spec.account.id, partyId: spec.vat.partyId, invoiceId: invoice.id, description: spec.description, reference: spec.reference, originKey: `fee-invoice:${invoice.id}` }, []);
      return { id: header.id, no: header.no, invoiceId: invoice.id, invoiceNo: invoice.number, paymentEventId: invoice.paymentEventId, tryMinor: invoice.payableMinor };
    }
    const event = bank.voucher({ type: spec.type, date: spec.date, valueDate: spec.valueDate || "", channel: spec.channel || "", bankRef: spec.account.id, counterRef: spec.counter?.id || "", description: spec.description, reference: spec.reference }, spec.lines);
    return { id: event.id, no: event.no };
  }
  const auditOf = (spec, written) => ({
    no: written.no,
    type: spec.type,
    date: spec.date,
    accountId: spec.account.id,
    counterAccountId: spec.counter?.id || "",
    amountMinor: spec.amountMinor,
    ...(spec.fee ? { feeType: spec.fee.feeType.key, tax: spec.fee.tax } : {}),
    ...(spec.type === "transfer" ? { toAccountId: spec.counter?.id || "", channel: spec.channel || "", valueDate: spec.valueDate || "", feeMinor: spec.transferFee ? spec.transferFee.base + spec.transferFee.taxMinor : 0, ...(spec.transferFee ? { feeType: spec.transferFee.feeType.key, feeTax: spec.transferFee.tax } : {}) } : {}),
    ...(written.invoiceId ? { invoiceId: written.invoiceId, invoiceNo: written.invoiceNo } : {}),
    ...(spec.lines ? { lines: spec.lines.map(line => `${line.side} ${line.gl}${line.sub ? `/${line.sub}` : ""} ${line.tryMinor}`) } : {}),
  });

  // ---------- K7: eksi bakiye (GG2; plan §3.9) ----------
  // Aşama 9: vadeli hesaptan transfer çıkışı da denetlenir (vadeli hesap eksiye düşmez; bakiyesini artıran faiz denetlenmez).
  const GUARDED_KINDS = new Set(["demand", "commercial", "other", "time", "card"]);
  const tlText = minor => `${minorPlain(minor).replace(/^-/, "−")} TL`;
  /**
   * İşlemin dokunacağı hesapların yazımdan ÖNCEKİ bakiyesi (moneyLines refTotal; aynı işlemin içinde, yazımdan hemen önce). guardNegative
   * değişimi bununla bulur: Düzelt'te asıl fişin ters kaydı ve yeni fiş birlikte (yalnız yeni satırlar sayılsaydı tutarı küçültülen faiz geliri
   * hesabı eksiye düşürürken denetlenmezdi).
   */
  function balancesOf(refs) {
    const out = new Map();
    for (const ref of refs) if (ref && !out.has(ref)) out.set(ref, money.refTotal({ ref }));
    // Yazımdan önceki son işlem başlığı: bundan sonrakiler bu işlemde açılanlardır (iç bank.post'lar dahil; totalAfter).
    out.eventMark = Number(store.get("SELECT COALESCE(MAX(rowid), 0) AS m FROM fin_events").m) || 0;
    return out;
  }
  /**
   * Yazımdan sonraki toplam (GG2 ölçümü, 1.000.000 harekette fiş başına ~2,3 sn): işlemde dokunulan olayların hepsi bu işlemde AÇILDIYSA (yeni
   * fiş, faturalı masraf, Gerçekleştir) toplam = önceki + yeni olayların satırları (olay dizininden). Var olan bir olaya dokunulduysa (Ters
   * Kaydet, Düzelt, faturalı masrafın iadesi) hesabın bütün satırları yeniden toplanır. K6 gereği işlemde yazılan ya da değiştirilen her para
   * satırı bir olaya bağlıdır ve o olay bank.post'ta dokunulmuş sayılır.
   */
  function totalAfter(ref, was, ctx, mark) {
    if (!ctx || !Number.isInteger(mark)) return money.refTotal({ ref });
    const created = new Set(store.all("SELECT id FROM fin_events WHERE rowid > ?", mark).map(row => row.id));
    const touched = new Set([...store.touchedEventIds, ...ctx.events]);
    if (!created.size || [...touched].some(id => !created.has(id))) return money.refTotal({ ref });
    const added = money.eventsTotal({ ref, events: created });
    return { cents: was.cents + added.cents, count: was.count + added.count, debit: was.debit + added.debit, credit: was.credit + added.credit };
  }
  /** COMMIT'ten sonra: K7'nin bulduğu toplamlar saklanır (bir sonraki okuma ve fiş hesabın bütün satırlarını yeniden toplamaz). */
  function primeTotals(settled, result) {
    if (!settled?.size || result?.replayed) return;
    for (const [ref, values] of settled) money.prime(ref, values);
  }
  /**
   * bank.post adım 8 (guard): hesap bazında son durum. Bakiyesi azalan hesapta bakiye = min(date günündeki, bütün hareketlerle) + limit (KMH ya da
   * kart limiti) eksiyse Uyar → 409 bank-negative (negativeOk geçer), Engelle → 409 bank-blocked. Kredi hesabında anapara kalan borcu aşamaz.
   */
  function guardNegative(before, { date, force = false, ctx = null, settled = null }) {
    if (!before?.size || !date) return;
    const fallback = settings().negative?.policy || "warn";
    for (const [ref, wasTotal] of before) {
      const next = totalAfter(ref, wasTotal, ctx, before.eventMark);
      settled?.set(ref, next);
      const was = wasTotal.cents;
      const total = next.cents;
      const change = total - was;
      if (change > 0) {
        // GG2 (düşük): Kredi Geri Ödemesi'nde anapara kalan kredi borcunu aşamaz (300 borç bakiyesi artıya geçmez).
        const loan = accounts.rowOf(ref);
        if (loan?.kind !== "loan" || total <= 0) continue;
        const left = Math.max(0, -was);
        throw bad(409, `Kredi Geri Ödemesi'nde anapara (${tlText(change)}) ${labelOf(loan)} kredisinin kalan borcunu (${tlText(left)}) aşamaz. Faiz ayrı alana (Faiz) yazılır.`, "bank-loan-exceeds", { accountId: loan.id, leftMinor: left, field: "amount" });
      }
      if (change === 0) continue;
      const row = accounts.rowOf(ref);
      if (!row || !GUARDED_KINDS.has(row.kind) || row.currency !== "TRY") continue;
      const policy = row.balance_confirmed ? row.negative_policy || fallback : "off";
      if (policy === "off" || (policy === "warn" && force)) continue;
      // İşlem tarihinden sonra satır yoksa (bugün tarihli fişte olağan) o günkü bakiye = bütün bakiye; ayrıca okunmaz.
      const atDay = money.afterIsEmpty(ref, date) ? total : total - money.refTotal({ ref, after: date }).cents;
      const after = Math.min(total, atDay);
      const limit = Number(row.credit_limit_minor) || 0;
      if (after + limit >= 0) continue;
      const prior = after - change;
      const limitText = limit ? ` (${row.kind === "card" ? "kart" : "KMH"} limiti ${tlText(limit)} dahil kullanılabilir ${tlText(prior + limit)})` : "";
      const base = `${labelOf(row)} hesabında ${tlText(prior)} var${limitText}; bu işlemle bakiye ${tlText(-change)} azalır ve ${tlText(after)} olur (eksi bakiye).`;
      const extra = { accountId: row.id, balanceMinor: prior, afterMinor: after, limitMinor: limit, field: "amount" };
      if (policy === "block") throw bad(409, `${base} Bu hesapta eksi bakiyeye izin verilmiyor (Hesap Detayı → Düzenle → Eksi Bakiye ya da Banka Ayarları → Eksi Bakiye).`, "bank-blocked", extra);
      throw bad(409, `${base} Yine de kaydedilsin mi?`, "bank-negative", extra);
    }
  }

  /**
   * POST /bank/vouchers: Banka Fişi (ya da faturalı masraf); POST /bank/transfers (endpoint "transfers"; Aşama 9): Bankalar Arası Transfer,
   * Kredi Kullanımı ve Kredi Geri Ödemesi. Bankalar arası transfer yalnız Transfer ucundan girilir (§7). Dönüş: İşlem Kartı (+ replayed).
   */
  function create(user, body = {}, { requestId = "", endpoint = "vouchers" } = {}) {
    const transfers = endpoint === "transfers";
    const kind = text(body?.type) || (transfers ? "transfer" : "");
    if (transfers && !TRANSFER_ENDPOINT_TYPES.includes(kind)) throw bad(400, `Transfer formundan Bankalar Arası Transfer, Kredi Kullanımı ya da Kredi Geri Ödemesi girilir (${kind.slice(0, 30)}). Masraf, faiz ve diğer işlemler Banka Fişi'nden.`, "bank-voucher-type", { field: "type" });
    if (!transfers) typeOf(body?.type);
    const input = transfers ? { ...(body || {}), type: kind } : body;
    const auditEntry = kind === "transfer" ? { type: "bank.transfer.created", entityId: "", payload: {} } : { type: "bank.voucher.created", entityId: "", payload: {} };
    const similarOk = body?.similarOk === true;
    let date = "";
    let before = null;
    const settled = new Map();
    const result = bank.post({
      user, module: "bank", op: "create", requestId, scope: kind === "transfer" ? "bank.transfer.create" : "bank.voucher.create", body, similarOk,
      write: () => {
        const spec = specOf(input);
        date = spec.date;
        before = balancesOf([spec.account.id, spec.counter?.id]);
        const written = writeSpec(user, spec, { similarOk });
        auditEntry.entityId = written.id;
        Object.assign(auditEntry.payload, auditOf(spec, written));
        return { id: written.id };
      },
      guard: (_, ctx) => guardNegative(before, { date, force: body?.negativeOk === true, ctx, settled }),
      audit: auditEntry,
    });
    primeTotals(settled, result);
    const id = result?.replayed ? result.refId : result.id;
    return { ...movements.card(id), ...(result?.replayed ? { replayed: true } : {}) };
  }

  /** Olayın önceki hâli (bank.post prev: eşleşme 409'u ve çapraz yetki; işlem geçmişinin "previous"ı). */
  function prevOf(event) {
    const list = [{ event_id: event.id, fin_ref: event.bank_ref, no: event.no, type: event.type, date: event.date, status: event.status, tryMinor: event.try_minor }];
    if (movements.isFeeHeader(event)) {
      const payment = movements.feePaymentOf(event);
      if (payment) list.push({ event_id: payment.id, fin_ref: event.bank_ref, no: payment.no });
    }
    return list;
  }
  function assertReversible(event) {
    const block = movements.blockOf(event);
    if (block) throw bad(block.status, block.reason, block.code, { eventId: event?.id || "", eventNo: event?.no || "" });
  }
  /** Ters Kaydet'in kendisi (yazım işleminin içinde). Dönüş: { id: ters fiş ya da (KDV'li masrafta) başlık, reversalId, cancelled }. */
  function reverseInside(user, event, { reason = "" } = {}) {
    assertReversible(event);
    const lock = period.lockedUntil();
    if (movements.isFeeHeader(event)) {
      if (lock && event.date <= lock) {
        // GG2: kilitli dönemdeki KDV'li masraf — fatura kilitli dönemde iptal edilmez; bugün tarihli Alıştan İade faturası + bu hesaba iade
        // tahsilatı yazılır, başlık satırsız ters kayıtla (iade faturasına bağlı) "ters kaydedildi" olur. Kapanmış dönem değişmez.
        const date = today();
        const back = invoices().issueBankFeeReturn(user, { invoiceId: event.invoice_id, date, bankAccountId: event.bank_ref, note: reason || `Banka'dan Ters Kaydet · ${event.no}` });
        const reversal = bank.reverse(event.id, { date, description: `Ters Kayıt · ${event.no} · İade Faturası ${back.number}`, returnInvoiceId: back.id });
        return { id: reversal.id, reversalId: reversal.id, cancelled: false };
      }
      invoices().cancel(user, event.invoice_id, { reason: reason || `Banka'dan Ters Kaydet · ${event.no}`, fromBank: true });
      bank.cancelBare(event.id);
      return { id: event.id, reversalId: "", cancelled: true };
    }
    const date = lock && event.date <= lock ? today() : event.date;
    const reversal = bank.reverse(event.id, { date, description: `Ters Kayıt · ${event.no}` });
    return { id: reversal.id, reversalId: reversal.id, cancelled: false };
  }
  const fresh = id => store.get("SELECT * FROM fin_events WHERE id = ?", id);

  /** POST /bank/events/:id/reverse → { original, reversal (ya da null: faturalı masraf iptal edildi) }. */
  function reverse(user, ref, body = {}, { requestId = "" } = {}) {
    const event = movements.mustEvent(ref);
    const auditEntry = { type: "bank.voucher.reversed", entityId: event.id, payload: {} };
    let date = "";
    let before = null;
    const settled = new Map();
    const result = bank.post({
      user, module: "bank", op: "delete", requestId, scope: "bank.event.reverse", body: { ...(body || {}), eventId: event.id }, prev: prevOf(event),
      // K7: gelir fişinin (faiz geliri, kredi kullanımı…) ters kaydı da hesabı eksiye düşürebilir.
      guard: (_, ctx) => guardNegative(before, { date, force: body?.negativeOk === true, ctx, settled }),
      write: () => {
        const current = fresh(event.id);
        before = balancesOf([current.bank_ref, current.counter_ref]);
        const done = reverseInside(user, current, { reason: limited(body?.reason, 300, "Neden") });
        date = fresh(done.id)?.date || current.date;
        Object.assign(auditEntry.payload, { no: current.no, type: current.type, date: current.date, reversalId: done.reversalId, cancelled: done.cancelled, reason: limited(body?.reason, 300, "Neden") });
        return { id: done.id };
      },
      audit: auditEntry,
    });
    primeTotals(settled, result);
    const refId = result?.replayed ? result.refId : result.id;
    const row = fresh(refId);
    const reversalId = row?.type === "reversal" ? row.id : "";
    const originalId = reversalId ? row.reversal_of : refId;
    return { original: movements.card(originalId), reversal: reversalId ? movements.card(reversalId) : null, ...(result?.replayed ? { replayed: true } : {}) };
  }

  /** POST /bank/events/:id/correct: Ters Kaydet + yeni fiş tek işlemde → { original, reversal, next }. Tür değişmez. */
  function correct(user, ref, body = {}, { requestId = "" } = {}) {
    const event = movements.mustEvent(ref);
    const auditEntry = { type: "bank.voucher.corrected", entityId: event.id, payload: {} };
    let reversalId = "";
    let date = "";
    let before = null;
    const settled = new Map();
    const result = bank.post({
      user, module: "bank", op: "update", requestId, scope: "bank.event.correct", body: { ...(body || {}), eventId: event.id }, prev: prevOf(event),
      guard: (_, ctx) => guardNegative(before, { date, force: body?.negativeOk === true, ctx, settled }),
      write: () => {
        const current = fresh(event.id);
        assertReversible(current);
        if (given(body?.type) && text(body.type) !== current.type) throw bad(400, "Düzelt'te işlemin türü değişmez. Başka türde işlem için Ters Kaydet ile iptal edip yeni işlem girin.", "bank-correct-type", { field: "type" });
        const card = movements.cardOf(current);
        const lock = period.lockedUntil();
        const fallbackDate = lock && current.date <= lock ? today() : current.date;
        // Gönderilen alanlar formun ön değerlerinin (İşlem Kartı → form) üstüne yazılır; tarih gönderilmezse fallbackDate.
        const merged = { ...(card.form || {}), ...(body || {}), type: current.type };
        delete merged.date;
        if (given(body?.date)) merged.date = body.date;
        if (body?.lines === undefined) delete merged.lines;
        // Faiz gelirinde yalnız brüt değiştiyse stopaj formdaki ORANLA yeniden hesaplanır (eski tutar yeni brütü aşabilirdi).
        if (current.type === "interest_in" && given(body?.amount) && !given(body?.stoppageAmount)) delete merged.stoppageAmount;
        const spec = specOf(merged, { fallbackDate });
        date = spec.date;
        before = balancesOf([current.bank_ref, current.counter_ref, spec.account.id, spec.counter?.id]);
        const done = reverseInside(user, current, { reason: `Düzeltildi · ${current.no}` });
        reversalId = done.reversalId;
        const written = writeSpec(user, spec, { similarOk: true, checkSimilar: false });
        Object.assign(auditEntry.payload, { no: current.no, reversalId: done.reversalId, cancelled: done.cancelled, next: auditOf(spec, written), nextId: written.id });
        return { id: written.id };
      },
      audit: auditEntry,
    });
    primeTotals(settled, result);
    if (result?.replayed) return { replayed: true, next: movements.card(result.refId) };
    return { original: movements.card(event.id), reversal: reversalId ? movements.card(reversalId) : null, next: movements.card(result.id) };
  }

  /** PUT /bank/events/:id/info: açıklama ve referans (para alanı değil; kilitli dönemde de, eşleşmiş olayda da). */
  function info(user, ref, body = {}) {
    const event = movements.mustEvent(ref);
    if (event.src_table) {
      const block = movements.blockOf(event);
      throw bad(409, `${block?.reason || "Bu hareket kendi penceresinden düzeltilir."} Açıklaması da orada değiştirilir.`, "bank-event-module", { eventId: event.id, eventNo: event.no });
    }
    const next = {
      description: body?.description === undefined ? event.description : limited(body.description, 500, "Açıklama"),
      reference: body?.reference === undefined ? event.reference : limited(body.reference, 100, "Referans"),
    };
    if (next.description !== event.description || next.reference !== event.reference) {
      store.tx(() => {
        store.run("UPDATE fin_events SET description = ?, reference = ?, updated_by = ?, updated_at = ? WHERE id = ?", next.description, next.reference, user.id, stamp(), event.id);
        audit(user, "bank.event.info", event.id, { no: event.no, previous: { description: event.description, reference: event.reference }, next });
      });
    }
    return movements.card(event.id);
  }

  // ---------- Planlı İşlemler (K3; §3.7 #23; Ek A #35) ----------
  const planRow = id => store.get("SELECT * FROM bank_plans WHERE id = ?", String(id || "").slice(0, 120)) || null;
  function mustPlan(id) {
    const row = planRow(id);
    if (!row) throw bad(404, "Planlı işlem bulunamadı.", "bank-plan-missing");
    return row;
  }
  const payloadOf = row => {
    try {
      return JSON.parse(row.payload_json || "{}") || {};
    } catch {
      return {};
    }
  };
  /** Sonraki planlı gün: tekrar türüne göre; ay sonuna düşen gün (31) planın ilk gününe göre korunur (31.01 → 28.02 → 31.03). */
  function advance(iso, repeat, anchorDay) {
    if (repeat === "weekly") return addCalendarDays(iso, 7);
    const months = repeat === "monthly" ? 1 : repeat === "quarterly" ? 3 : 12;
    const next = addMonths(iso, months);
    const day = Math.max(1, Math.min(31, Number(anchorDay) || Number(iso.slice(8, 10))));
    const [y, m] = next.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${next.slice(0, 8)}${String(Math.min(day, last)).padStart(2, "0")}`;
  }
  function planView(row, { map = null } = {}) {
    const accountsById = map || new Map(store.all("SELECT id, bank_name, name FROM bank_accounts").map(item => [item.id, item]));
    const payload = payloadOf(row);
    const runs = store
      .all("SELECT payload_json AS payload, created_at AS at, created_by AS by FROM bank_jobs WHERE kind = 'plan-run' AND ref = ? ORDER BY created_at, rowid", row.id)
      .map(job => {
        let data = {};
        try {
          data = JSON.parse(job.payload || "{}") || {};
        } catch {
          data = {};
        }
        return { eventId: data.eventId || "", eventNo: data.eventNo || "", date: data.date || "", plannedDate: data.plannedDate || "", at: job.at, by: job.by };
      });
    const done = row.done_event_id ? store.get("SELECT no FROM fin_events WHERE id = ?", row.done_event_id) : null;
    const accountLabel = id => (accountsById.get(id) ? `${accountsById.get(id).bank_name} · ${accountsById.get(id).name}` : "");
    return {
      id: row.id,
      kind: row.kind,
      typeLabel: typeLabel(row.kind),
      accountId: row.bank_account_id,
      accountLabel: accountLabel(row.bank_account_id),
      toAccountId: row.to_account_id,
      toAccountLabel: accountLabel(row.to_account_id),
      partyId: row.party_id,
      amountMinor: Number(row.amount_minor),
      currency: row.currency,
      plannedDate: row.planned_date,
      repeat: row.repeat,
      repeatLabel: PLAN_REPEATS[row.repeat] || row.repeat,
      description: row.description,
      status: row.status,
      statusLabel: PLAN_STATUS[row.status] || row.status,
      due: row.status === "planned" && row.planned_date <= today(),
      spec: { feeType: payload.feeType || "", tax: payload.tax || "", taxRate: payload.taxRate || "", gl: payload.gl || "", stoppageRate: payload.stoppageRate || "", stoppageAmount: payload.stoppageAmount || "", taxAmount: payload.taxAmount || "", interestAmount: payload.interestAmount || "", reference: payload.reference || "", feeAmount: payload.feeAmount || "", feeTax: payload.feeTax || "", feeRate: payload.feeRate || "", channel: payload.channel || "" },
      doneEventId: row.done_event_id,
      doneEventNo: done?.no || "",
      runs,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at || "",
    };
  }
  /** GET /bank/plans: varsayılan Planlı; due=1 yalnız vadesi gelenler; status=all|done|cancelled; account süzgeci. Yazmaz. */
  function listPlans(params = new URLSearchParams()) {
    const get = key => text(params.get?.(key) ?? params[key] ?? "");
    const status = get("status");
    if (status && !["planned", "done", "cancelled", "all"].includes(status)) throw bad(400, "Durum Planlı, Gerçekleşti, İptal Edildi ya da Tümü olmalı.", "bank-filter", { field: "status" });
    const where = [];
    const args = [];
    if (status !== "all") {
      where.push("status = ?");
      args.push(status || "planned");
    }
    if (["1", "true"].includes(get("due"))) {
      where.push("status = 'planned' AND planned_date <= ?");
      args.push(today());
    }
    const account = get("account");
    if (account) {
      where.push("(bank_account_id = ? OR to_account_id = ?)");
      args.push(account, account);
    }
    const map = new Map(store.all("SELECT id, bank_name, name FROM bank_accounts").map(item => [item.id, item]));
    return { plans: store.all(`SELECT * FROM bank_plans${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY planned_date, created_at`, ...args).map(row => planView(row, { map })) };
  }
  /** Rozet: vadesi gelen planlı işlemler (yazmaz). */
  const dueCount = () => Number(store.get("SELECT COUNT(*) AS n FROM bank_plans WHERE status = 'planned' AND planned_date <= ?", today()).n) || 0;
  // Planın türe özgü alanları (payload_json). Aşama 4 dilim 4: kredi geri ödemesinin faizi (interestAmount) ve referans da saklanır;
  // önceden saklanmadığı için planlı kredi taksiti faizsiz gerçekleşiyordu.
  // Aşama 9: planlı transferin ücreti ve kanalı da saklanır (feeAmount, feeTax, feeRate, channel; masraf türü feeType ortak).
  const PLAN_FIELDS = ["feeType", "tax", "taxRate", "gl", "stoppageRate", "stoppageAmount", "taxAmount", "interestAmount", "reference", "feeAmount", "feeTax", "feeRate", "channel"];
  function createPlan(user, body = {}) {
    const kind = typeOf(body?.kind ?? body?.type, { transfer: true });
    const repeat = text(body?.repeat) || "none";
    if (!Object.hasOwn(PLAN_REPEATS, repeat)) throw bad(400, "Tekrar Yok, Haftalık, Aylık, Üç Aylık ya da Yıllık seçin.", "bank-plan-repeat", { field: "repeat" });
    const rule = TYPE_RULES[kind];
    const counterField = rule.counter?.field || "";
    const voucherBody = { ...body, type: kind, [counterField || "_"]: body?.toAccountId ?? body?.[counterField] };
    const spec = specOf(voucherBody, { dateMode: "plan", forPlan: true });
    const payload = { anchorDay: Number(spec.date.slice(8, 10)) };
    for (const key of PLAN_FIELDS) if (given(body?.[key])) payload[key] = text(body[key]);
    if (spec.fee) Object.assign(payload, { feeType: spec.fee.feeType.key, tax: spec.fee.tax });
    if (spec.transferFee) Object.assign(payload, { feeType: spec.transferFee.feeType.key, feeTax: spec.transferFee.tax });
    const id = `bplan-${randomUUID()}`;
    store.tx(() => {
      store.run(
        "INSERT INTO bank_plans (id, kind, bank_account_id, to_account_id, party_id, amount_minor, currency, planned_date, repeat, description, status, done_event_id, payload_json, created_by, created_at) VALUES (?, ?, ?, ?, '', ?, 'TRY', ?, ?, ?, 'planned', '', ?, ?, ?)",
        id, kind, spec.account.id, spec.counter?.id || "", spec.amountMinor, spec.date, repeat, spec.description, JSON.stringify(payload), user.id, stamp(),
      );
      audit(user, "bank.plan.created", id, { kind, accountId: spec.account.id, toAccountId: spec.counter?.id || "", amountMinor: spec.amountMinor, plannedDate: spec.date, repeat });
    });
    return planView(planRow(id));
  }
  /** Planın fiş gövdesi (Gerçekleştir): planın alanları + gönderilen (tarih, tutar, faiz, vergi, açıklama) üstüne. */
  function planBody(plan, body = {}) {
    const payload = payloadOf(plan);
    const rule = TYPE_RULES[plan.kind];
    const out = { type: plan.kind, accountId: plan.bank_account_id, amount: minorPlain(Number(plan.amount_minor)).replace(/\./g, ""), description: plan.description };
    if (rule?.counter) out[rule.counter.field] = plan.to_account_id;
    for (const key of PLAN_FIELDS) if (given(payload[key])) out[key] = payload[key];
    for (const key of ["amount", "description", "reference", "interestAmount", "taxAmount", "stoppageRate", "stoppageAmount", "taxRate", "gl", "feeType", "feeAmount", "feeTax", "feeRate", "channel", "valueDate"]) if (given(body?.[key])) out[key] = body[key];
    out.date = given(body?.date) ? body.date : plan.planned_date;
    return out;
  }
  /** POST /bank/plans/:id/execute → { plan, event }. Vadesi gelmemiş planı tarihsiz gerçekleştirmek 400 date-future (ileri tarihli satır yazılmaz). */
  function executePlan(user, id, body = {}, { requestId = "" } = {}) {
    mustPlan(id);
    const auditEntry = { type: "bank.plan.executed", entityId: id, payload: {} };
    const similarOk = body?.similarOk === true;
    let date = "";
    let before = null;
    const settled = new Map();
    const result = bank.post({
      user, module: "bank", op: "create", requestId, scope: "bank.plan.execute", body: { ...(body || {}), planId: id }, similarOk,
      guard: (_, ctx) => guardNegative(before, { date, force: body?.negativeOk === true, ctx, settled }),
      write: () => {
        const plan = mustPlan(id);
        if (plan.status === "done") throw bad(409, "Bu planlı işlem zaten gerçekleşti.", "bank-plan-done", { planId: id });
        if (plan.status === "cancelled") throw bad(409, "Bu planlı işlem iptal edilmiş.", "bank-plan-cancelled", { planId: id });
        assertExpected(plan, body);
        const spec = specOf(planBody(plan, body));
        date = spec.date;
        before = balancesOf([spec.account.id, spec.counter?.id]);
        const written = writeSpec(user, spec, { similarOk });
        const payload = payloadOf(plan);
        const next = plan.repeat === "none" ? null : advance(plan.planned_date, plan.repeat, payload.anchorDay);
        store.run("UPDATE bank_plans SET status = ?, planned_date = ?, done_event_id = ?, updated_by = ?, updated_at = ? WHERE id = ?", next ? "planned" : "done", next || plan.planned_date, written.id, user.id, stamp(), plan.id);
        store.run("INSERT INTO bank_jobs (id, kind, due_date, ref, payload_json, status, done_ref, created_by, created_at) VALUES (?, 'plan-run', ?, ?, ?, 'done', ?, ?, ?)", `job-${randomUUID()}`, spec.date, plan.id, JSON.stringify({ eventId: written.id, eventNo: written.no, date: spec.date, plannedDate: plan.planned_date }), written.no, user.id, stamp());
        Object.assign(auditEntry.payload, { no: written.no, date: spec.date, plannedDate: plan.planned_date, next: next || "", event: auditOf(spec, written) });
        return { id: written.id };
      },
      audit: auditEntry,
    });
    primeTotals(settled, result);
    const eventId = result?.replayed ? result.refId : result.id;
    return { plan: planView(mustPlan(id)), event: movements.card(eventId), ...(result?.replayed ? { replayed: true } : {}) };
  }
  /**
   * GG2 (çift tık): Atla ve Gerçekleştir ekranda gördüğü planlı tarihi (expectedDate) taşır; plan bu arada ilerlediyse (ikinci tıklama, başka
   * kullanıcı) 409 bank-plan-moved — bir dönemin talimatı sessizce atlanmaz. Denetim yazımla aynı işlemde (BEGIN IMMEDIATE).
   */
  function assertExpected(plan, body) {
    if (!given(body?.expectedDate)) return;
    const expected = text(body.expectedDate);
    if (expected === plan.planned_date) return;
    throw bad(409, `Bu planlı işlem bu arada ilerledi (${dayText(expected)} → ${dayText(plan.planned_date)}); ikinci kez işlenmedi. Liste yenilendi; yeni tarihi denetleyin.`, "bank-plan-moved", { planId: plan.id, plannedDate: plan.planned_date });
  }
  /** POST /bank/plans/:id/skip: tekrarlı planın bu dönemi atlanır (fiş yazılmaz). */
  function skipPlan(user, id, body = {}) {
    mustPlan(id);
    return store.tx(() => {
      const plan = mustPlan(id);
      if (plan.status !== "planned") throw bad(409, plan.status === "done" ? "Bu planlı işlem gerçekleşti." : "Bu planlı işlem iptal edilmiş.", plan.status === "done" ? "bank-plan-done" : "bank-plan-cancelled");
      if (plan.repeat === "none") throw bad(409, "Tekrarsız plan atlanmaz; Gerçekleştir ya da Sil.", "bank-plan-skip");
      assertExpected(plan, body);
      const next = advance(plan.planned_date, plan.repeat, payloadOf(plan).anchorDay);
      store.run("UPDATE bank_plans SET planned_date = ?, updated_by = ?, updated_at = ? WHERE id = ?", next, user.id, stamp(), plan.id);
      audit(user, "bank.plan.skipped", plan.id, { previous: { plannedDate: plan.planned_date }, next: { plannedDate: next } });
      return planView(planRow(plan.id));
    });
  }
  /** DELETE /bank/plans/:id: plan İptal Edildi (gerçekleşmiş fişler değişmez). */
  function cancelPlan(user, id) {
    const plan = mustPlan(id);
    if (plan.status === "cancelled") return planView(plan);
    if (plan.status === "done") throw bad(409, "Gerçekleşmiş planlı işlem silinmez; fişi İşlem Kartı'ndan ters kaydedin.", "bank-plan-done");
    store.tx(() => {
      store.run("UPDATE bank_plans SET status = 'cancelled', updated_by = ?, updated_at = ? WHERE id = ?", user.id, stamp(), plan.id);
      audit(user, "bank.plan.cancelled", plan.id, { previous: { status: plan.status, plannedDate: plan.planned_date } });
    });
    return planView(planRow(plan.id));
  }

  /**
   * Son kullanılan mevduat stopajı oranı (Banka Ayarları → Faiz → "Son Kullanılan Oran Önerilir"; koda sabit oran yazılmaz): en son
   * kaydedilen ETKİN faiz gelirinin stopaj / brüt oranı ("15", "17,5"); hiç yoksa boş. Ters kaydedilen faizin oranı önerilmez. Yazmaz.
   */
  function lastStoppageRate() {
    const event = store.get("SELECT id FROM fin_events WHERE type = 'interest_in' AND +status = 'active' AND +src_table = '' ORDER BY created_at DESC, rowid DESC LIMIT 1");
    if (!event) return "";
    const sums = store.get("SELECT COALESCE(SUM(CASE WHEN role = 'income' AND side = 'C' THEN try_minor ELSE 0 END), 0) AS gross, COALESCE(SUM(CASE WHEN role = 'stoppage' AND side = 'D' THEN try_minor ELSE 0 END), 0) AS stoppage FROM bank_lines WHERE event_id = ?", event.id);
    const gross = Number(sums?.gross) || 0;
    if (!gross) return "";
    const ppm = Math.round((Number(sums.stoppage) * 1_000_000) / gross);
    return String(ppm / 10_000).replace(".", ",");
  }
  /** Fiş formunun seçenekleri (GET /bank/voucher-meta; yazmaz). */
  function meta() {
    const values = settings();
    // Hareketler süzgecinin türleri ve formların hesap adları (gelir/gider eşlemesi, masraf türlerinin hesapları).
    const codes = new Set([...ROLE_GL.income, ...ROLE_GL.expense, "102", "191", "193", "300", "309", "320", "500", values.gl.fee, values.gl.commission, values.gl.interestIncome, values.gl.interestExpense]);
    return {
      groups: Object.entries(GROUP_LABELS).map(([key, label]) => ({ key, label })),
      glNames: Object.fromEntries([...codes].filter(Boolean).map(code => [code, CHART[code] || code])),
      types: VOUCHER_TYPES.map(type => ({ type, label: typeLabel(type), direction: ["interest_in", "other_in", "loan_draw"].includes(type) ? "in" : "out", transfer: TRANSFER_TYPES.has(type), counter: TYPE_RULES[type].counter ? { field: TYPE_RULES[type].counter.field, label: TYPE_RULES[type].counter.label } : null })),
      feeTypes: (values.fee.types || []).map(type => ({ key: type.key, name: type.name, gl: type.gl })),
      taxes: Object.entries(FEE_TAXES).map(([key, label]) => ({ key, label, invoice: VAT_TAXES.has(key) })),
      repeats: Object.entries(PLAN_REPEATS).map(([key, label]) => ({ key, label })),
      // Aşama 9: Transfer formu — kanallar ve ücretin vergi kipleri (KDV'li kip yok: faturalı masraf + Masraf'tan).
      channels: Object.entries(TRANSFER_CHANNELS).map(([key, label]) => ({ key, label })),
      transferFeeTaxes: Object.entries(FEE_TAXES).filter(([key]) => TRANSFER_FEE_TAXES.has(key)).map(([key, label]) => ({ key, label })),
      transferFeeTax: TRANSFER_FEE_TAXES.has(values.fee.tax) ? values.fee.tax : "bsmv_incl",
      valueDateMaxDays: VALUE_DATE_MAX_DAYS,
      gl: { income: ROLE_GL.income, expense: ROLE_GL.expense },
      defaults: { tax: values.fee.tax, bsmvRate: "5", vatRate: "20", stoppageRate: lastStoppageRate(), otherIncome: values.gl.otherIncome, otherExpense: values.gl.otherExpense, interestIncome: values.gl.interestIncome, interestExpense: values.gl.interestExpense, fee: values.gl.fee, commission: values.gl.commission },
      manualVoucher: Boolean(values.other.manualVoucher),
      similar: values.similar.enabled !== false,
    };
  }

  // negative (Aşama 5–6): K7'nin aynı kuralı modül yazımlarında (cari havale, Kasa ↔ Banka transferi; lib/bank/module-ref.mjs).
  return { negative: { balancesOf, guardNegative, primeTotals }, meta, specOf, needsInvoice, create, reverse, correct, info, listPlans, createPlan, executePlan, skipPlan, cancelPlan, dueCount, planRow, mustPlan };
}
