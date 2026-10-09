// Banka Hareketleri, İşlem Kartı ve Banka Masraf Raporu verisi (v2.1.0 Aşama 4; docs/BANKA-MODULU-PLAN.md §7 "/bank/movements",
// "/bank/events/:no", §8.6, §8.10, §9.2/9). YALNIZ OKUR: hiçbir uç yazmaz (K3 "GET yazmaz").
//
// Hareketler: dizin fin_events (hesabın olayları: bank_ref ya da counter_ref = hesap; indeksler idx_fin_events_bank / _counter (hesap, tarih,
// kimlik)), tutarlar TEK KAYNAKTAN (moneyLines; olay kimlikleriyle ve hesap süzgeciyle). Sıra (tarih, İşlem kimliği) azalan; imleçli
// sayfalama (imleç = son satırın (tarih, kimlik) anahtarı + yürüyen bakiye + süzgeç izi; HMAC ile imzalı, kurcalanmış imleç 400). Yürüyen
// bakiye yalnız tek hesapta ve tür/yön/arama/durum süzgeci yokken verilir (süzgeçli listede bakiye anlamsızdır): ilk satırın bakiyesi = hesabın
// tek kaynaktaki bakiyesi (bitiş tarihi verildiyse o güne kadar), her satır bir öncekinden kendi tutarı kadar geriye gider.
// Liste dışı: satırsız olaylar (sıfır açılış, sihirbaz başlığı, KDV'li masraf başlığı — parası faturanın ödeme satırında görünür), para dışı
// türler (tahsile verme, eski hareket atama), hesabı atanmamış eski satırlar (Hesabı Atanmamış Eski Hareketler'de). İptal edilmiş olay (satırı
// silinmiş) yalnız "İptal Edildi" süzgecinde, kopyasındaki tutarla; bakiyeye girmez.
//
// Tüm hesaplar (hesap seçilmeden): her hesabın kendi dizininden alınan sayfalar birleştirilir (hareket hesap başına bir satır: kart borcu
// ödemesi bankada −, kartta +); sıra (tarih, kimlik, hesap) azalan.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { HttpError, limited, text } from "../http.mjs";
import { systemClock } from "../clock.mjs";
import { CHART, UNASSIGNED_SUBS } from "../general-ledger.mjs";
import { isIsoDate } from "../period.mjs";
import { addCalendarDays } from "../business-days.mjs";
import { parseMinor, toMinor } from "../minor.mjs";
import { buildXlsx } from "../xlsx-write.mjs";
import { EVENT_TYPES, INTERNAL_TYPES, NON_MONEY_TYPES, STATUS_LABELS, TYPE_GROUPS, isVoucherType, typeLabel } from "./event-types.mjs";
import { MONEY_ROLES } from "./voucher.mjs";

const q = value => `'${String(value).replace(/'/g, "''")}'`;
const NON_MONEY_SQL = [...NON_MONEY_TYPES].map(q).join(", ");
const EVENT_NO = /^[A-Z]{2,6}-\d{4}-\d{1,12}$/;
const dayText = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");
const STATUS_FILTERS = new Set(["", "active", "reversed", "cancelled", "all"]);
const DIRS = new Set(["", "in", "out"]);
export const LIMIT_DEFAULT = 50;
export const LIMIT_MAX = 200;
const COLS = "e.id, e.no, e.type, e.date, e.value_date, e.status, e.direction, e.try_minor, e.amount_minor, e.currency, e.method, e.party_id, e.invoice_id, e.bank_ref, e.counter_ref, e.reversal_of, e.reversed_by, e.description, e.reference, e.src_table, e.src_id, e.origin, e.created_by, e.created_at";
// Modül olayının satırının yeri: İşlem Kartı'nda kaynak ve "nereden düzeltilir" nedeni.
const SOURCE_LABELS = Object.freeze({
  payments: "Kayıt Tahsilatı",
  cash_entries: "Kasa Hareketi",
  account_entries: "Cari Hareketi",
  plan_entries: "Taksit Tahsilatı",
  stock_moves: "Stok Hareketi",
  cheque_events: "Çek ve Senet Hareketi",
});
const MODULE_REASONS = Object.freeze({
  payments: "Bu tahsilat tablodaki kayıttan girildi; kaydın detay kartından düzeltilir ya da silinir.",
  cash_entries: "Bu hareket Kasa penceresinden girildi; Kasa penceresinden düzeltilir ya da silinir.",
  account_entries: "Bu hareket Cari kartından girildi; Cari penceresinden düzeltilir ya da silinir.",
  invoice: "Bu ödeme bir faturanın peşin tahsilatı/ödemesi; Fatura penceresinden düzenlenir ya da iptal edilir.",
  plan_entries: "Bu hareket Taksit kartından girildi; Taksit penceresinden düzeltilir ya da silinir.",
  stock_moves: "Bu hareket Stok penceresinden girildi; Stok penceresinden düzeltilir ya da silinir.",
  cheque_events: "Bu hareket Çek / Senet penceresinden girildi; oradan geri alınır.",
});
const WIZARD_TYPES = new Set(["carry_close", "legacy_assign", "legacy_reclass"]);
const ROLE_OF_GL = { 100: "cash", 102: "bank", 108: "pos", 309: "card", 300: "loan" };

/** "1.234,56" (kuruştan; Excel'de sayıya çevrilir, ekranda aynı). */
export function minorPlain(minor) {
  const n = Math.round(Number(minor) || 0);
  const negative = n < 0;
  const abs = String(Math.abs(n)).padStart(3, "0");
  const int = abs.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${int},${abs.slice(-2)}`;
}
const likeEscape = value => String(value).replace(/[\\%_]/g, ch => `\\${ch}`);
/**
 * Aramanın Türkçe büyük/küçük harf biçimleri: SQLite LIKE yalnız ASCII harflerde büyük/küçük ayırmaz (Ç, Ğ, İ, Ö, Ş, Ü ve ı/i ayrı); yazıldığı
 * gibi, küçük, büyük, cümle düzeni ve her sözcüğün ilki büyük ("ölçüm müşterisi" → "Ölçüm Müşterisi"). LIKE için aynı olanlar (yalnız ASCII
 * harflerinin büyüklüğü farklı) bir kez: her biçim satır başına ayrı LIKE'tır (1.000.000 olayın taramasında süreyi o belirler).
 */
export function searchVariants(value) {
  const lower = value.toLocaleLowerCase("tr-TR");
  const capital = word => (word ? word[0].toLocaleUpperCase("tr-TR") + word.slice(1) : word);
  const out = new Map();
  for (const variant of [value, lower, value.toLocaleUpperCase("tr-TR"), capital(lower), lower.split(/(\s+)/).map(capital).join("")]) {
    const key = variant.replace(/[A-Z]/g, ch => ch.toLowerCase());
    if (!out.has(key)) out.set(key, variant);
  }
  return [...out.values()];
}
const ASCII = /^[\x20-\x7e]*$/;

/**
 * @param {{ store, money, accounts, ledger: () => object, period, now? }} options  now: iş saati (context.now; Excel'in oluşturma damgası)
 *   accounts: banka hesap servisi (lib/bank/accounts.mjs; rowOf, settings); ledger: Ana Defter servisi (İşlem Kartı'nda modül olayının yevmiyesi)
 */
export function createBankMovements({ store, money, accounts, ledger, period, now = systemClock }) {
  // İmlecin imzası (süreç başına gizli anahtar): yeniden başlatmadan sonra eski imleç 400 alır, liste baştan açılır. Veri tabanına yazılmaz.
  const secret = randomBytes(32);
  const mac = body => createHmac("sha256", secret).update(body).digest("base64url").slice(0, 22);

  // ---------- Ortak okuyucular ----------
  const accountMap = () => new Map(store.all("SELECT id, bank_name AS bankName, name, gl, gl_sub AS glSub, kind, currency, status, deleted_at AS deletedAt FROM bank_accounts").map(row => [row.id, row]));
  const accountRef = (map, id) => {
    const row = id ? map.get(id) : null;
    return row ? { id: row.id, label: `${row.bankName} · ${row.name}`, glSub: row.glSub, kind: row.kind, currency: row.currency } : null;
  };
  const namesOf = (table, column, ids) => {
    const list = [...new Set(ids.filter(Boolean))];
    if (!list.length) return new Map();
    return new Map(store.all(`SELECT id, ${column} AS name FROM ${table} WHERE id IN (SELECT value FROM json_each(?))`, JSON.stringify(list)).map(row => [row.id, row.name]));
  };
  const subName = (map, sub) => {
    if (!sub) return "";
    if (UNASSIGNED_SUBS[sub]) return UNASSIGNED_SUBS[sub];
    for (const row of map.values()) if (row.glSub === sub) return `${row.bankName} · ${row.name}`;
    const pos = store.get("SELECT name FROM pos_terminals WHERE gl_sub = ?", sub);
    return pos?.name || "";
  };
  const lockDate = () => period?.lockedUntil?.() || "";
  const feeTypes = () => {
    try {
      return accounts.settings.read().fee.types || [];
    } catch {
      return [];
    }
  };

  /** Olay: kimlik (ev-…) ya da İşlem No (BNK-2026-000001). */
  function eventRow(ref) {
    const key = String(ref ?? "").trim().slice(0, 120);
    if (!key) return null;
    return store.get("SELECT * FROM fin_events WHERE id = ?", key) || store.get("SELECT * FROM fin_events WHERE no = ?", key.toUpperCase()) || null;
  }
  function mustEvent(ref) {
    const row = eventRow(ref);
    if (!row) throw new HttpError(404, "İşlem bulunamadı. İşlem No'yu denetleyin; silinmiş ya da başka şirkete ait olabilir.", { code: "bank-event-missing" });
    return row;
  }
  /** KDV'li masrafın başlığı (satırsız Masraf fişi, faturaya bağlı) mı? */
  const isFeeHeader = event => Boolean(event) && event.type === "fee" && event.src_table === "" && Boolean(event.invoice_id) && !store.get("SELECT 1 AS found FROM bank_lines WHERE event_id = ? LIMIT 1", event.id);
  /** Faturanın KDV'li masraf başlığı (etkin ya da iptal edilmiş; en yenisi). */
  const feeHeaderOf = invoiceId => (invoiceId ? store.get("SELECT id, no, status FROM fin_events WHERE invoice_id = ? AND invoice_id <> '' AND +type = 'fee' AND +src_table = '' ORDER BY created_at DESC LIMIT 1", invoiceId) || null : null);
  /** KDV'li masrafın ödeme olayı (faturanın bu hesaptan havale satırı). */
  const feePaymentOf = header => (header?.invoice_id ? store.get("SELECT id, no, status FROM fin_events WHERE invoice_id = ? AND invoice_id <> '' AND +type = 'invoice_cash' AND +src_table = 'account_entries' ORDER BY created_at DESC LIMIT 1", header.invoice_id) || null : null);
  const reconciled = id => Boolean(id && store.get("SELECT 1 AS found FROM bank_matches WHERE event_id = ? AND undone_at IS NULL", id));

  /**
   * Ters Kaydet / Düzelt yapılabilir mi? null ya da { status, code, reason } (409/404; ekranda pasif düğmenin nedeni). Yetki rota denetler.
   * Kilitli dönemdeki fiş ters kaydedilir (ters fiş bugün tarihli); yalnız faturalı masraf kilitli dönemde iptal edilmez (fatura kuralı).
   */
  function blockOf(event) {
    if (!event) return { status: 404, code: "bank-event-missing", reason: "İşlem bulunamadı." };
    if (event.src_table) {
      const reason = event.type === "invoice_cash" ? (feeHeaderOf(event.invoice_id) ? `Bu ödeme Banka masrafının faturasına ait; masrafın İşlem Kartı'ndan (${feeHeaderOf(event.invoice_id).no}) Ters Kaydet ile iptal edilir.` : MODULE_REASONS.invoice) : MODULE_REASONS[event.src_table] || "Bu hareket kendi penceresinden düzeltilir.";
      return { status: 409, code: "bank-event-module", reason };
    }
    if (event.type === "opening") return { status: 409, code: "bank-event-opening", reason: "Açılış bakiyesi Hesap Detayı'nda Açılışı Düzelt ile değiştirilir." };
    if (WIZARD_TYPES.has(event.type)) return { status: 409, code: "bank-event-wizard", reason: "Kurulum ve Aktarım Sihirbazı kaydı; Kurulum Geçmişi'nden Geri Al ile geri alınır." };
    if (event.type === "reversal") return { status: 409, code: "bank-reversal-of-reversal", reason: "Ters kayıt ters kaydedilmez; asıl işlemi düzeltin." };
    if (event.status === "reversed") {
      const by = event.reversed_by ? store.get("SELECT no FROM fin_events WHERE id = ?", event.reversed_by) : null;
      return { status: 409, code: "bank-already-reversed", reason: `Bu işlem ters kaydedilmiş${by?.no ? ` (${by.no})` : ""}; yeniden ters kaydedilmez.` };
    }
    if (event.status === "cancelled") return { status: 409, code: "bank-already-reversed", reason: "Bu işlem iptal edilmiş." };
    if (!isVoucherType(event.type)) return { status: 409, code: "bank-event-other", reason: `${typeLabel(event.type, event.direction)} bu yoldan ters kaydedilmez.` };
    const header = isFeeHeader(event);
    const payment = header ? feePaymentOf(event) : null;
    if (reconciled(event.id) || reconciled(payment?.id)) return { status: 409, code: "bank-reconciled", reason: "Bu işlem banka ekstresiyle eşleşmiş; önce eşleşmeyi kaldırın." };
    const lock = lockDate();
    if (header && lock && event.date <= lock) return { status: 409, code: "period-locked", reason: `Faturalı masraf ${dayText(event.date)} tarihli; ${dayText(lock)} ve öncesi kilitli dönem. Fatura kilitli dönemde iptal edilmez.` };
    return null;
  }

  // ---------- İşlem Kartı ----------
  function voucherLines(event, map) {
    return store.all("SELECT role, gl, sub, ref, side, try_minor AS tryMinor, currency, fx_minor AS fxMinor, memo FROM bank_lines WHERE event_id = ? ORDER BY seq", event.id).map(line => ({
      role: line.role,
      gl: line.gl,
      glName: CHART[line.gl] || line.gl,
      sub: line.sub,
      subName: subName(map, line.sub),
      ref: line.ref,
      side: line.side,
      tryMinor: Number(line.tryMinor),
      currency: line.currency,
      fxMinor: Number(line.fxMinor) || Number(line.tryMinor),
      memo: line.memo,
    }));
  }
  /** Modül olayının ve KDV'li masrafın yevmiyesi (Ana Defter'in kendi kuralıyla, yalnız bu satırlar). */
  function journalLines(filter, map) {
    const service = ledger?.();
    if (!service?.build) return [];
    const out = [];
    for (const entry of service.build(filter)) {
      for (const line of entry.lines) {
        const minor = Number(line.debit) || Number(line.credit) || 0;
        if (!minor) continue;
        out.push({ role: ROLE_OF_GL[line.account] || "journal", gl: line.account, glName: CHART[line.account] || line.account, sub: line.sub || "", subName: subName(map, line.sub || ""), ref: "", side: line.debit ? "D" : "C", tryMinor: minor, currency: "TRY", fxMinor: minor, memo: entry.text || entry.source || "" });
      }
    }
    return out;
  }
  const moduleRows = event => {
    const rows = [];
    for (const table of Object.keys(SOURCE_LABELS)) for (const row of store.all(`SELECT id FROM ${table} WHERE event_id = ? AND event_id <> ''`, event.id)) rows.push({ table, id: row.id });
    return rows;
  };
  const invoiceOf = id => (id ? store.get("SELECT id, number, status, kind, issue_date AS date, try_net AS tryNet, try_vat AS tryVat, try_payable AS tryPayable FROM invoices WHERE id = ?", id) || null : null);
  const ppmOfMemo = memo => {
    const match = /%\s*([\d.,]+)/.exec(String(memo || ""));
    if (!match) return 0;
    const value = Number(match[1].replace(/\./g, "").replace(",", "."));
    return Number.isFinite(value) ? Math.round(value * 10_000) : 0;
  };
  /** Masraf bilgisi (Masraf fişi): matrah, vergi, toplam, hesap, masraf türü; KDV'li masrafta faturadan. */
  function feeInfo(event, lines) {
    if (event.type !== "fee") return null;
    const types = feeTypes();
    if (isFeeHeader(event)) {
      const invoice = invoiceOf(event.invoice_id);
      const line = invoice ? store.get("SELECT name, gl_account AS gl, vat_rate AS vatRate FROM invoice_lines WHERE invoice_id = ? ORDER BY seq LIMIT 1", invoice.id) : null;
      const baseMinor = invoice ? toMinor(Number(invoice.tryNet) || 0) : 0;
      const vatMinor = invoice ? toMinor(Number(invoice.tryVat) || 0) : 0;
      return { taxKind: "vat", gl: line?.gl || "", feeTypeName: line?.name || "", feeType: types.find(type => type.name === line?.name)?.key || "", baseMinor, taxMinor: vatMinor, vatMinor, bsmvMinor: 0, totalMinor: invoice ? toMinor(Number(invoice.tryPayable) || 0) : 0, ratePpm: Math.round((Number(line?.vatRate) || 0) * 10_000) };
    }
    const sum = role => lines.filter(line => line.role === role).reduce((total, line) => total + (line.side === "D" ? line.tryMinor : -line.tryMinor), 0);
    const expense = lines.find(line => line.role === "expense");
    const tax = lines.find(line => line.role === "tax");
    const baseMinor = sum("expense");
    const taxMinor = sum("tax");
    return { taxKind: tax ? "bsmv" : "none", gl: expense?.gl || "", feeTypeName: expense?.memo || "", feeType: types.find(type => type.name === expense?.memo)?.key || "", baseMinor, taxMinor, bsmvMinor: taxMinor, vatMinor: 0, totalMinor: baseMinor + taxMinor, ratePpm: tax ? ppmOfMemo(tax.memo) : 0 };
  }
  /** Düzelt formunun ön değerleri (sunucu Düzelt'te de bunları kullanır; gönderilen alan üstüne yazar). */
  function formOf(event, lines, fee) {
    const form = { type: event.type, accountId: event.bank_ref, description: event.description, reference: event.reference };
    const sum = (role, side = null) => lines.filter(line => line.role === role && (!side || line.side === side)).reduce((total, line) => total + line.tryMinor, 0);
    const moneyOf = ref => lines.filter(line => MONEY_ROLES.has(line.role) && line.ref === ref).reduce((total, line) => total + (line.side === "D" ? line.tryMinor : -line.tryMinor), 0);
    switch (event.type) {
      case "fee":
        if (fee?.taxKind === "vat") {
          const invoice = invoiceOf(event.invoice_id);
          Object.assign(form, { amount: minorPlain(fee.totalMinor), feeType: fee.feeType, tax: "vat_incl", taxRate: String(fee.ratePpm / 10_000).replace(".", ","), partyId: event.party_id, invoiceNo: invoice?.number || "" });
        } else Object.assign(form, { amount: minorPlain(fee?.totalMinor || 0), feeType: fee?.feeType || "", tax: fee?.taxKind === "bsmv" ? "bsmv_incl" : "none", ...(fee?.taxKind === "bsmv" ? { taxRate: String((fee.ratePpm || 50_000) / 10_000).replace(".", ",") } : {}) });
        break;
      case "interest_in": {
        const gross = sum("income", "C");
        const stoppage = sum("stoppage", "D");
        // Stopaj oranı (ppm → yüzde): Düzelt'te yalnız brüt faiz değişirse stopaj bu oranla yeniden hesaplanır (tutar değişmeden kalırsa aynı).
        const ratePpm = gross ? Math.round((stoppage * 1_000_000) / gross) : 0;
        Object.assign(form, { amount: minorPlain(gross), stoppageAmount: minorPlain(stoppage), stoppageRate: String(ratePpm / 10_000).replace(".", ",") });
        break;
      }
      case "interest_out":
        Object.assign(form, { amount: minorPlain(sum("expense", "D")), taxAmount: minorPlain(sum("tax", "D")) });
        break;
      case "other_in":
        Object.assign(form, { amount: minorPlain(moneyOf(event.bank_ref)), gl: lines.find(line => line.role === "income")?.gl || "" });
        break;
      case "other_out":
        Object.assign(form, { amount: minorPlain(-moneyOf(event.bank_ref)), gl: lines.find(line => line.role === "expense")?.gl || "" });
        break;
      case "card_payment":
        Object.assign(form, { amount: minorPlain(-moneyOf(event.bank_ref)), cardAccountId: event.counter_ref });
        break;
      case "loan_draw":
        Object.assign(form, { amount: minorPlain(moneyOf(event.bank_ref)), loanAccountId: event.counter_ref });
        break;
      case "loan_repay":
        Object.assign(form, { amount: minorPlain(moneyOf(event.counter_ref)), interestAmount: minorPlain(sum("expense", "D")), loanAccountId: event.counter_ref });
        break;
      default:
        break;
    }
    return form;
  }
  function historyOf(event) {
    const ids = [event.id, event.reversal_of, event.reversed_by, event.src_id].filter(Boolean);
    return store
      .all("SELECT type, actor_id AS actorId, actor_name AS actorName, payload_json AS payload, created_at AS at FROM audit_events WHERE entity_id IN (SELECT value FROM json_each(?)) ORDER BY created_at, rowid", JSON.stringify(ids))
      .map(row => {
        let payload = {};
        try {
          payload = JSON.parse(row.payload || "{}") || {};
        } catch {
          payload = {};
        }
        return { type: row.type, actorId: row.actorId, actorName: row.actorName, at: row.at, payload };
      });
  }

  /** İşlem Kartı (§7 "/bank/events/:no"): İşlem No ya da kimlikle. */
  function card(ref) {
    const event = mustEvent(ref);
    return cardOf(event);
  }
  function cardOf(event) {
    const map = accountMap();
    const header = isFeeHeader(event);
    const payment = header ? feePaymentOf(event) : null;
    let lines;
    let linesSource;
    if (!event.src_table) {
      lines = voucherLines(event, map);
      linesSource = "voucher";
      if (!lines.length && header) {
        const paymentRows = payment ? store.all("SELECT id FROM account_entries WHERE event_id = ? AND event_id <> ''", payment.id).map(row => row.id) : [];
        lines = journalLines({ invoices: [event.invoice_id], money: paymentRows.length ? { account_entries: paymentRows } : {} }, map);
        linesSource = "journal";
      }
    } else {
      const rows = moduleRows(event);
      const filter = { money: {} };
      for (const row of rows) (filter.money[row.table] ||= []).push(row.id);
      lines = rows.length ? journalLines(filter, map) : [];
      linesSource = "journal";
    }
    const fee = feeInfo(event, lines);
    const invoice = invoiceOf(event.invoice_id);
    const linked = event.type === "invoice_cash" ? feeHeaderOf(event.invoice_id) : null;
    const people = namesOf("users", "display_name", [event.created_by]);
    const party = event.party_id ? store.get("SELECT id, name FROM accounts WHERE id = ?", event.party_id) : null;
    const relation = id => (id ? store.get("SELECT id, no, date FROM fin_events WHERE id = ?", id) || null : null);
    const block = blockOf(event);
    const lock = lockDate();
    const source = event.src_table ? { table: event.src_table, id: event.src_id, label: SOURCE_LABELS[event.src_table] || event.src_table } : null;
    return {
      id: event.id,
      no: event.no,
      type: event.type,
      typeLabel: typeLabel(event.type, event.direction),
      status: event.status,
      statusLabel: STATUS_LABELS[event.status] || event.status,
      date: event.date,
      valueDate: event.value_date,
      direction: event.direction,
      tryMinor: Number(event.try_minor),
      amountMinor: Number(event.amount_minor),
      currency: event.currency,
      method: event.method,
      description: event.description,
      reference: event.reference,
      channel: event.channel,
      origin: event.origin,
      internal: INTERNAL_TYPES.has(event.type),
      account: accountRef(map, event.bank_ref),
      counterAccount: accountRef(map, event.counter_ref),
      party: party ? { id: party.id, name: party.name } : event.party_id ? { id: event.party_id, name: "" } : null,
      invoice: invoice ? { id: invoice.id, number: invoice.number, status: invoice.status, kind: invoice.kind, date: invoice.date } : null,
      fee,
      payment: payment ? { id: payment.id, no: payment.no, status: payment.status } : null,
      linkedFee: linked ? { id: linked.id, no: linked.no, status: linked.status } : null,
      reversal: { of: relation(event.reversal_of), by: relation(event.reversed_by) },
      source,
      lines,
      linesSource,
      history: historyOf(event),
      createdBy: event.created_by,
      createdByName: people.get(event.created_by) || "",
      createdAt: event.created_at,
      updatedBy: event.updated_by || "",
      updatedAt: event.updated_at || "",
      locked: Boolean(lock && event.date <= lock),
      lockedUntil: lock,
      form: event.src_table ? null : formOf(event, lines, fee),
      actions: {
        reverse: { allowed: !block, reason: block?.reason || "", code: block?.code || "" },
        correct: { allowed: !block, reason: block?.reason || "", code: block?.code || "" },
        info: { allowed: true, reason: "" },
      },
    };
  }

  // ---------- Hareketler ----------
  function filterOf(params = new URLSearchParams()) {
    const get = key => text(params.get?.(key) ?? params[key] ?? "");
    const account = get("account");
    if (account && !accounts.rowOf(account)) throw new HttpError(404, "Banka hesabı bulunamadı. Silinmiş ya da başka şirkete ait olabilir.", { code: "bank-account-missing" });
    const type = get("type");
    if (type && !Object.hasOwn(TYPE_GROUPS, type) && !EVENT_TYPES.has(type)) throw new HttpError(400, `Tür süzgeci tanınmadı (${type.slice(0, 30)}).`, { code: "bank-filter", field: "type" });
    const dir = get("dir");
    if (!DIRS.has(dir)) throw new HttpError(400, "Yön süzgeci Giriş (in) ya da Çıkış (out) olmalı.", { code: "bank-filter", field: "dir" });
    const status = get("status");
    if (!STATUS_FILTERS.has(status)) throw new HttpError(400, "Durum süzgeci Etkin, Ters Kaydedildi, İptal Edildi ya da Tümü olmalı.", { code: "bank-filter", field: "status" });
    const from = get("from");
    const to = get("to");
    for (const [value, field] of [[from, "from"], [to, "to"]]) if (value && !isIsoDate(value)) throw new HttpError(400, "Geçerli bir tarih aralığı seçin.", { code: "date-invalid", field });
    const search = limited(get("q"), 100, "Arama");
    // Tutar süzgeci (§7 min / max; Aşama 4 dilim 4): olayın tutarı (TL, kuruş) aralıkta; sınır dahil. Eksi, metin ve fazla ondalık 400.
    const amountFilter = (key, label) => {
      const value = get(key);
      if (!value) return null;
      try {
        return parseMinor(value, { label, allowZero: true });
      } catch (error) {
        throw new HttpError(400, error.message, { code: error.extra?.code || "bank-filter", field: key });
      }
    };
    const min = amountFilter("min", "En Az Tutar");
    const max = amountFilter("max", "En Çok Tutar");
    if (min !== null && max !== null && max < min) throw new HttpError(400, "En Çok Tutar, En Az Tutar'dan küçük olamaz.", { code: "bank-filter", field: "max" });
    const rawLimit = get("limit");
    let limit = rawLimit === "" ? LIMIT_DEFAULT : Math.trunc(Number(rawLimit));
    if (!Number.isFinite(limit)) limit = LIMIT_DEFAULT;
    limit = Math.max(1, Math.min(LIMIT_MAX, limit));
    const planned = ["1", "true"].includes(get("planned"));
    const f = { account, type, dir, status, from, to, q: search, planned, min, max };
    f.hash = createHash("sha256").update(JSON.stringify([account, type, dir, status, from, to, search, min, max])).digest("base64url").slice(0, 16);
    f.limit = limit;
    f.cursor = get("cursor");
    // Yürüyen bakiye: tek hesap, yalnız tarih süzgeci (durum: varsayılan = Etkin + Ters Kaydedildi).
    f.balance = Boolean(account) && !type && !dir && !status && !search && min === null && max === null;
    return f;
  }
  const badCursor = () => new HttpError(400, "Sayfa imleci geçersiz ya da süresi doldu; listeyi baştan açın.", { code: "bank-cursor" });
  function encodeCursor(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${mac(body)}`;
  }
  function decodeCursor(value, f) {
    if (!value) return null;
    const parts = String(value).split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0].length > 2000) throw badCursor();
    const expected = Buffer.from(mac(parts[0]));
    const given = Buffer.from(parts[1]);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw badCursor();
    let payload;
    try {
      payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    } catch {
      throw badCursor();
    }
    if (!payload || typeof payload !== "object" || payload.f !== f.hash || !isIsoDate(payload.d) || typeof payload.i !== "string" || payload.i.length > 120) throw badCursor();
    if (f.balance && !Number.isSafeInteger(payload.b)) throw badCursor();
    if (!f.account && typeof payload.a !== "string") throw badCursor();
    return payload;
  }

  /** Ortak koşullar (durum, tür, arama; satırsız ve para dışı olaylar hariç) ve parametreleri. */
  function conditions(f) {
    const where = ["+e.try_minor > 0", `+e.type NOT IN (${NON_MONEY_SQL})`];
    const params = {};
    if (!f.status) where.push("+e.status IN ('active', 'reversed')");
    else if (f.status !== "all") {
      where.push("+e.status = :status");
      params.status = f.status;
    }
    if (f.type) {
      const types = TYPE_GROUPS[f.type] || [f.type];
      const list = types.map(q).join(", ");
      // Masraf süzgeci KDV'li masrafın ödeme satırını da kapsar (masraf başlığı faturaya bağlı; parası faturanın havale satırında).
      where.push(types.includes("fee") ? `(+e.type IN (${list}) OR (+e.type = 'invoice_cash' AND e.invoice_id <> '' AND EXISTS (SELECT 1 FROM fin_events f WHERE f.invoice_id = e.invoice_id AND f.invoice_id <> '' AND +f.type = 'fee' AND +f.src_table = '')))` : `+e.type IN (${list})`);
    }
    if (f.q) {
      const variants = searchVariants(f.q);
      const parts = [];
      const partyParts = [];
      variants.forEach((variant, index) => {
        params[`q${index}`] = `%${likeEscape(variant)}%`;
        parts.push(`e.description LIKE :q${index} ESCAPE '\\'`, `e.reference LIKE :q${index} ESCAPE '\\'`);
        // İşlem No yalnız ASCII (BNK-2026-000123): Türkçe harfli biçim onda eşleşemez.
        if (ASCII.test(variant)) parts.push(`e.no LIKE :q${index} ESCAPE '\\'`);
        partyParts.push(`name LIKE :q${index} ESCAPE '\\'`);
      });
      parts.push(`(e.party_id <> '' AND e.party_id IN (SELECT id FROM accounts WHERE ${partyParts.join(" OR ")}))`);
      where.push(`(${parts.join(" OR ")})`);
    }
    if (f.min !== null && f.min !== undefined) {
      where.push("+e.try_minor >= :min");
      params.min = f.min;
    }
    if (f.max !== null && f.max !== undefined) {
      where.push("+e.try_minor <= :max");
      params.max = f.max;
    }
    if (f.from) {
      where.push("e.date >= :from");
      params.from = f.from;
    }
    if (f.to) {
      where.push("e.date <= :to");
      params.to = f.to;
    }
    return { where, params };
  }
  /**
   * Hesap(lar)ın dizininden en çok n olay (bank_ref ve counter_ref kolu), (tarih, kimlik) azalan. accountIds: tek hesap ya da hesap listesi (satırın
   * hesabı ref_account kolonunda). after: { d, i, inclusive } (imleç). since: yalnız bu günden itibaren (aramanın yakın penceresi). scan: tablo
   * baştan sona bir kez taranır (NOT INDEXED; nadir aramada dizinde satır satır gezmekten hızlı).
   */
  function indexPage(accountIds, f, after, n, { since = "", scan = false } = {}) {
    const { where, params } = conditions(f);
    const single = accountIds.length === 1 && !scan;
    Object.assign(params, { a: single ? accountIds[0] : JSON.stringify(accountIds), n });
    if (after) Object.assign(params, { cd: after.d, ci: after.i });
    if (since) params.since = since;
    const opposite = { in: "out", out: "in" };
    if (f.dir) Object.assign(params, { dir: f.dir, odir: opposite[f.dir] });
    const order = "ORDER BY date DESC, id DESC LIMIT :n";
    const cursorSql = after ? [`(e.date, e.id) ${after.inclusive ? "<=" : "<"} (:cd, :ci)`] : [];
    if (scan) {
      // Tablo taraması tek geçişte (iki kol ayrı ayrı taransa süre iki katı; 1.000.000 olayda ~0,9 → ~0,7 sn): eşleşen olaylar bir kez
      // toplanır, hesap ve karşı hesap kolları bu kümeden ayrılır (aynı olay iki seçili hesabın kolunda iki satır olabilir).
      const IN = "IN (SELECT value FROM json_each(:a))";
      const leg = (column, counter) =>
        `SELECT * FROM (SELECT m.*, ${counter ? 1 : 0} AS counter, m.${column} AS ref_account FROM m WHERE m.${column} <> '' AND m.${column} ${IN}${f.dir ? ` AND m.direction = ${counter ? ":odir" : ":dir"}` : ""} ${order})`;
      return store.all(
        `WITH m AS MATERIALIZED (SELECT ${COLS} FROM fin_events e NOT INDEXED WHERE (e.bank_ref ${IN} OR (e.counter_ref <> '' AND e.counter_ref ${IN})) AND ${[...cursorSql, ...where].join(" AND ")})
         ${leg("bank_ref", false)} UNION ALL ${leg("counter_ref", true)} ${order}`,
        params,
      );
    }
    const branch = (column, counter) => {
      const own = [single ? `e.${column} = :a` : `e.${column} IN (SELECT value FROM json_each(:a))`];
      if (column === "counter_ref") own.push("e.counter_ref <> ''");
      own.push(...cursorSql);
      if (since) own.push("e.date >= :since");
      if (f.dir) own.push(`+e.direction = ${counter ? ":odir" : ":dir"}`);
      return `SELECT * FROM (SELECT ${COLS}, ${counter ? 1 : 0} AS counter, e.${column} AS ref_account FROM fin_events e WHERE ${[...own, ...where].join(" AND ")} ${order})`;
    };
    return store.all(`${branch("bank_ref", false)} UNION ALL ${branch("counter_ref", true)} ${order}`, params);
  }
  // Aramanın yakın penceresi (gün): sık geçen sözcük son aylarda bulunur (dizin, birkaç ms); pencerede sayfa dolmazsa tablo bir kez taranır.
  const SEARCH_WINDOW_DAYS = 92;
  const byKey = (x, y) => (x.row.date !== y.row.date ? (x.row.date < y.row.date ? 1 : -1) : x.row.id !== y.row.id ? (x.row.id < y.row.id ? 1 : -1) : x.accountId < y.accountId ? 1 : x.accountId > y.accountId ? -1 : 0);
  /** Sayfanın adayları (n'den çok olabilir; sıralı): { row, counter, accountId }. */
  function fetchCandidates(f, cursor, n) {
    const candidatesOf = (rows, fallback = "") => rows.map(row => ({ row, counter: Boolean(row.counter), accountId: row.ref_account || fallback }));
    const afterKey = item => !cursor || item.row.date < cursor.d || (item.row.date === cursor.d && (item.row.id < cursor.i || (item.row.id === cursor.i && item.accountId < cursor.a)));
    if (f.account && !f.q) return candidatesOf(indexPage([f.account], f, cursor ? { d: cursor.d, i: cursor.i, inclusive: false } : null, n), f.account);
    const accountIds = f.account ? [f.account] : store.all("SELECT id FROM bank_accounts WHERE deleted_at IS NULL ORDER BY id").map(row => row.id);
    if (!accountIds.length) return [];
    // Tüm hesaplarda imleç (tarih, kimlik, hesap) olduğundan dizin koşulu "≤" ve tam anahtar burada süzülür.
    const after = cursor ? { d: cursor.d, i: cursor.i, inclusive: !f.account } : null;
    const collect = rows => candidatesOf(rows).filter(item => (f.account ? true : afterKey(item))).sort(byKey);
    if (f.q) {
      const today = period?.today?.() || now().toISOString().slice(0, 10);
      const since = addCalendarDays(cursor?.d || (f.to && f.to < today ? f.to : today), -SEARCH_WINDOW_DAYS);
      const near = collect(indexPage(accountIds, f, after, n + 1, { since }));
      if (near.length >= n) return near;
      return collect(indexPage(accountIds, f, after, n + 1, { scan: true }));
    }
    // Tüm hesaplar, arama yok: her hesabın kendi dizininden sayfa, birleşim.
    const merged = [];
    for (const id of accountIds) merged.push(...collect(indexPage([id], f, after, n + 1)));
    return merged.sort(byKey);
  }
  /** Olaylara hesabın tek kaynaktaki tutarı (kuruş, işaretli): olay → tutar. Görünmeyen satır (silinmiş cari) tutar taşımaz. */
  function amountsFor(accountId, ids) {
    const out = new Map();
    if (!ids.length) return out;
    for (const line of money.lines({ events: ids, ref: accountId, light: true })) out.set(line.event_id, (out.get(line.event_id) || 0) + (line.kind === "in" ? 1 : -1) * Number(line.cents));
    return out;
  }
  /** Adaylar → satırlar (tutar, ad, bağ). Görünmeyen (tutarsız) etkin olay düşer; iptal edilmiş olay kopyasındaki tutarla. */
  function shapeRows(candidates) {
    const map = accountMap();
    const byAccount = new Map();
    for (const item of candidates) {
      if (!byAccount.has(item.accountId)) byAccount.set(item.accountId, []);
      byAccount.get(item.accountId).push(item.row.id);
    }
    const amounts = new Map();
    for (const [accountId, ids] of byAccount) for (const [id, cents] of amountsFor(accountId, ids)) amounts.set(`${id}|${accountId}`, cents);
    const parties = namesOf("accounts", "name", candidates.map(item => item.row.party_id));
    const users = namesOf("users", "display_name", candidates.map(item => item.row.created_by));
    const invoiceIds = [...new Set(candidates.filter(item => item.row.type === "invoice_cash" && item.row.invoice_id).map(item => item.row.invoice_id))];
    const fees = new Map(invoiceIds.length ? store.all("SELECT invoice_id AS invoiceId, no FROM fin_events WHERE invoice_id IN (SELECT value FROM json_each(?)) AND +type = 'fee' AND +src_table = '' ORDER BY created_at", JSON.stringify(invoiceIds)).map(row => [row.invoiceId, row.no]) : []);
    const invoices = namesOf("invoices", "number", candidates.map(item => item.row.invoice_id));
    const out = [];
    for (const item of candidates) {
      const row = item.row;
      let signed;
      if (row.status === "cancelled") signed = (row.direction === "out" ? -1 : 1) * (item.counter ? -1 : 1) * Number(row.try_minor);
      else {
        signed = amounts.get(`${row.id}|${item.accountId}`);
        if (signed === undefined) {
          out.push(null);
          continue;
        }
      }
      const otherId = item.counter ? row.bank_ref : row.counter_ref;
      out.push({
        eventId: row.id,
        no: row.no,
        type: row.type,
        typeLabel: typeLabel(row.type, item.counter ? (row.direction === "in" ? "out" : "in") : row.direction),
        date: row.date,
        valueDate: row.value_date,
        status: row.status,
        statusLabel: STATUS_LABELS[row.status] || row.status,
        accountId: item.accountId,
        accountLabel: accountRef(map, item.accountId)?.label || "",
        counterAccountId: otherId || "",
        counterAccountLabel: accountRef(map, otherId)?.label || "",
        direction: signed >= 0 ? "in" : "out",
        signedMinor: signed,
        balanceAfterMinor: null,
        partyId: row.party_id,
        partyName: parties.get(row.party_id) || "",
        description: row.description,
        reference: row.reference,
        reversalOf: row.reversal_of,
        reversedBy: row.reversed_by,
        invoiceId: row.invoice_id,
        invoiceNo: invoices.get(row.invoice_id) || "",
        feeNo: row.type === "invoice_cash" ? fees.get(row.invoice_id) || "" : "",
        internal: INTERNAL_TYPES.has(row.type),
        sourceTable: row.src_table,
        createdBy: row.created_by,
        createdByName: users.get(row.created_by) || "",
      });
    }
    return out;
  }
  /** Hesabın tek kaynaktaki bakiyesi (kuruş); to verilirse o günün sonuna kadar (toplam − sonrası; ikisi de moneyLines'ın total'ı, saklanır). */
  function balanceAt(accountId, to = "") {
    const total = money.refTotal({ ref: accountId }).cents;
    return to ? total - money.refTotal({ ref: accountId, after: to }).cents : total;
  }

  /** İşlem No'yla tam arama (hızlı yol): olay + KDV'li masrafın ödeme olayı. null: İşlem No değil ya da yok. */
  function exactEvents(f) {
    const key = f.q.toUpperCase();
    if (!EVENT_NO.test(key)) return null;
    const event = store.get(`SELECT ${COLS} FROM fin_events e WHERE e.no = ?`, key);
    if (!event) return null;
    const list = [event];
    if (event.type === "fee" && event.invoice_id && !event.src_table) list.push(...store.all(`SELECT ${COLS} FROM fin_events e WHERE e.invoice_id = ? AND e.invoice_id <> '' AND +e.type = 'invoice_cash'`, event.invoice_id));
    return list;
  }
  const keep = (f, row, counter) => {
    if (!(Number(row.try_minor) > 0) || NON_MONEY_TYPES.has(row.type)) return false;
    if (!f.status ? !["active", "reversed"].includes(row.status) : f.status !== "all" && row.status !== f.status) return false;
    if (f.from && row.date < f.from) return false;
    if (f.to && row.date > f.to) return false;
    if (f.min !== null && f.min !== undefined && Number(row.try_minor) < f.min) return false;
    if (f.max !== null && f.max !== undefined && Number(row.try_minor) > f.max) return false;
    if (f.dir && (counter ? (row.direction === "in" ? "out" : "in") : row.direction) !== f.dir) return false;
    if (f.type) {
      const types = TYPE_GROUPS[f.type] || [f.type];
      if (!types.includes(row.type) && !(types.includes("fee") && row.type === "invoice_cash" && feeHeaderOf(row.invoice_id))) return false;
    }
    return true;
  };

  /**
   * Hareketler sayfası. Dönüş: { rows, nextCursor, hasMore, balance, account, planned }.
   */
  function list(params) {
    const f = filterOf(params);
    if (f.planned) return plannedRows(f);
    const cursor = decodeCursor(f.cursor, f);
    const exact = f.q ? exactEvents(f) : null;
    if (exact) {
      const candidates = [];
      for (const row of exact) {
        for (const [ref, counter] of [[row.bank_ref, false], [row.counter_ref, true]]) {
          if (!ref || (f.account && ref !== f.account) || !keep(f, row, counter)) continue;
          candidates.push({ row, counter, accountId: ref });
        }
      }
      const rows = shapeRows(candidates).filter(Boolean);
      return { rows, nextCursor: null, hasMore: false, balance: false, account: f.account || null };
    }
    const n = f.limit + 1;
    const fetched = fetchCandidates(f, cursor, n);
    const hasMore = fetched.length > f.limit;
    const examined = fetched.slice(0, f.limit);
    const shaped = shapeRows(examined);
    let running = f.balance ? (cursor ? cursor.b : balanceAt(f.account, f.to)) : 0;
    const rows = [];
    shaped.forEach(row => {
      if (!row) return;
      if (f.balance) {
        row.balanceAfterMinor = running;
        running -= row.signedMinor;
      }
      rows.push(row);
    });
    const last = examined.at(-1);
    const nextCursor = hasMore && last ? encodeCursor({ f: f.hash, d: last.row.date, i: last.row.id, ...(f.account ? {} : { a: last.accountId }), ...(f.balance ? { b: running } : {}) }) : null;
    return { rows, nextCursor, hasMore: Boolean(hasMore && last), balance: f.balance, account: f.account || null };
  }

  // ---------- Planlı İşlemler görünümü (bank_plans; yazılmamış, deftere girmez) ----------
  const PLAN_OUT = new Set(["fee", "interest_out", "other_out", "card_payment", "loan_repay"]);
  function plannedRows(f) {
    const map = accountMap();
    const today = period?.today?.() || "";
    const where = ["p.status = 'planned'"];
    const args = [];
    if (f.account) {
      where.push("(p.bank_account_id = ? OR p.to_account_id = ?)");
      args.push(f.account, f.account);
    }
    if (f.from) {
      where.push("p.planned_date >= ?");
      args.push(f.from);
    }
    if (f.to) {
      where.push("p.planned_date <= ?");
      args.push(f.to);
    }
    if (f.min !== null && f.min !== undefined) {
      where.push("p.amount_minor >= ?");
      args.push(f.min);
    }
    if (f.max !== null && f.max !== undefined) {
      where.push("p.amount_minor <= ?");
      args.push(f.max);
    }
    const rows = store.all(`SELECT p.* FROM bank_plans p WHERE ${where.join(" AND ")} ORDER BY p.planned_date, p.created_at`, ...args).map(plan => {
      const own = !f.account || plan.bank_account_id === f.account;
      const sign = (PLAN_OUT.has(plan.kind) ? -1 : 1) * (own ? 1 : -1);
      const accountId = own ? plan.bank_account_id : plan.to_account_id;
      return {
        planId: plan.id,
        eventId: "",
        no: "",
        type: plan.kind,
        typeLabel: typeLabel(plan.kind, PLAN_OUT.has(plan.kind) ? "out" : "in"),
        date: plan.planned_date,
        status: "planned",
        statusLabel: "Planlı",
        due: plan.planned_date <= today,
        accountId,
        accountLabel: accountRef(map, accountId)?.label || "",
        counterAccountId: own ? plan.to_account_id : plan.bank_account_id,
        signedMinor: sign * Number(plan.amount_minor),
        balanceAfterMinor: null,
        description: plan.description,
      };
    });
    return { rows, nextCursor: null, hasMore: false, balance: false, account: f.account || null, planned: true };
  }

  // ---------- Banka Masraf Raporu verisi (§8.10) ----------
  /**
   * Masraf fişleri (BSMV'li ve vergisiz: satırlarından; KDV'li: faturasından), ters kaydedilenlerin ters kaydı (kendi tarihinde eksi). İptal
   * edilmiş KDV'li masraf (Ters Kaydet → fatura iptal) raporda yoktur. Hesap (770 / 653), BSMV ve KDV ayrı kolonlarda; toplamlar hesap kodu ve
   * banka hesabı bazında.
   */
  function feeReport(params = new URLSearchParams()) {
    const get = key => text(params.get?.(key) ?? params[key] ?? "");
    const from = get("from");
    const to = get("to");
    for (const [value, field] of [[from, "from"], [to, "to"]]) if (value && !isIsoDate(value)) throw new HttpError(400, "Geçerli bir tarih aralığı seçin.", { code: "date-invalid", field });
    const account = get("account");
    if (account && !accounts.rowOf(account)) throw new HttpError(404, "Banka hesabı bulunamadı.", { code: "bank-account-missing" });
    const where = ["e.src_table = ''"];
    const args = [];
    if (from) {
      where.push("e.date >= ?");
      args.push(from);
    }
    if (to) {
      where.push("e.date <= ?");
      args.push(to);
    }
    if (account) {
      where.push("e.bank_ref = ?");
      args.push(account);
    }
    const events = store.all(
      `SELECT e.* FROM fin_events e WHERE e.type = 'fee' AND +e.status IN ('active', 'reversed') AND ${where.join(" AND ")}
       UNION ALL
       SELECT e.* FROM fin_events e WHERE e.type = 'reversal' AND EXISTS (SELECT 1 FROM fin_events o WHERE o.id = e.reversal_of AND o.type = 'fee') AND ${where.join(" AND ")}
       ORDER BY date, year, seq`,
      ...args, ...args,
    );
    const map = accountMap();
    const ids = events.map(event => event.id);
    const linesOf = new Map();
    if (ids.length) {
      for (const line of store.all("SELECT event_id AS eventId, role, gl, side, try_minor AS tryMinor, memo FROM bank_lines WHERE event_id IN (SELECT value FROM json_each(?)) ORDER BY event_id, seq", JSON.stringify(ids))) {
        if (!linesOf.has(line.eventId)) linesOf.set(line.eventId, []);
        linesOf.get(line.eventId).push({ ...line, tryMinor: Number(line.tryMinor) });
      }
    }
    const rows = [];
    for (const event of events) {
      const lines = linesOf.get(event.id) || [];
      const signed = role => lines.filter(line => line.role === role).reduce((sum, line) => sum + (line.side === "D" ? line.tryMinor : -line.tryMinor), 0);
      let row;
      if (!lines.length) {
        if (event.type !== "fee" || !event.invoice_id || event.status !== "active") continue;
        const invoice = invoiceOf(event.invoice_id);
        if (!invoice || invoice.status !== "issued") continue;
        const line = store.get("SELECT name, gl_account AS gl FROM invoice_lines WHERE invoice_id = ? ORDER BY seq LIMIT 1", invoice.id);
        const base = toMinor(Number(invoice.tryNet) || 0);
        const vat = toMinor(Number(invoice.tryVat) || 0);
        row = { gl: line?.gl || "", feeTypeName: line?.name || "", baseMinor: base, bsmvMinor: 0, vatMinor: vat, totalMinor: base + vat, invoiceId: invoice.id, invoiceNo: invoice.number };
      } else {
        const expense = lines.find(line => line.role === "expense");
        const base = signed("expense");
        const bsmv = signed("tax");
        row = { gl: expense?.gl || "", feeTypeName: expense?.memo || "", baseMinor: base, bsmvMinor: bsmv, vatMinor: 0, totalMinor: base + bsmv, invoiceId: "", invoiceNo: "" };
      }
      rows.push({
        eventId: event.id,
        no: event.no,
        date: event.date,
        type: event.type,
        typeLabel: typeLabel(event.type, event.direction),
        status: event.status,
        statusLabel: STATUS_LABELS[event.status] || event.status,
        accountId: event.bank_ref,
        accountLabel: accountRef(map, event.bank_ref)?.label || "",
        glName: CHART[row.gl] || row.gl,
        description: event.description,
        reference: event.reference,
        reversalOf: event.reversal_of,
        ...row,
      });
    }
    const blank = () => ({ baseMinor: 0, bsmvMinor: 0, vatMinor: 0, totalMinor: 0, count: 0 });
    const totals = { ...blank(), byGl: {}, byAccount: {} };
    for (const row of rows) {
      for (const bucket of [totals, (totals.byGl[row.gl] ||= blank()), (totals.byAccount[row.accountId] ||= blank())]) {
        bucket.baseMinor += row.baseMinor;
        bucket.bsmvMinor += row.bsmvMinor;
        bucket.vatMinor += row.vatMinor;
        bucket.totalMinor += row.totalMinor;
        bucket.count += 1;
      }
    }
    return { rows, totals, from, to, account: account || null };
  }
  /** Banka Masraf Raporu Excel'i: açıklama ve referans metin hücresi (formül değil); tutarlar sayı. */
  function feeXlsx(report) {
    const columns = ["Tarih", "İşlem No", "Banka Hesabı", "Masraf Türü", "Hesap Kodu", "Matrah", "BSMV", "KDV", "Toplam", "Fatura No", "Açıklama", "Referans"];
    const rows = report.rows.map(row => ({
      Tarih: dayText(row.date),
      "İşlem No": row.no,
      "Banka Hesabı": row.accountLabel,
      "Masraf Türü": row.type === "reversal" ? `${row.feeTypeName} (Ters Kayıt)` : row.feeTypeName,
      "Hesap Kodu": row.gl ? `${row.gl} ${CHART[row.gl] || ""}`.trim() : "",
      Matrah: minorPlain(row.baseMinor),
      BSMV: minorPlain(row.bsmvMinor),
      KDV: minorPlain(row.vatMinor),
      Toplam: minorPlain(row.totalMinor),
      "Fatura No": row.invoiceNo,
      Açıklama: row.description,
      Referans: row.reference,
    }));
    const footer = { Tarih: "TOPLAM", Matrah: minorPlain(report.totals.baseMinor), BSMV: minorPlain(report.totals.bsmvMinor), KDV: minorPlain(report.totals.vatMinor), Toplam: minorPlain(report.totals.totalMinor) };
    return buildXlsx([{ name: "Banka Masraf Raporu", columns, rows, footer }], { now: now(), title: "Banka Masraf Raporu" });
  }

  return { list, card, cardOf, eventRow, mustEvent, blockOf, isFeeHeader, feePaymentOf, feeHeaderOf, feeReport, feeXlsx, balanceAt, filterOf };
}
