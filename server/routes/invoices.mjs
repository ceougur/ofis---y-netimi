// Fatura (v2.0.15): satış, alış, satıştan iade, alıştan iade ve serbest meslek makbuzu. Belge birincil kayıttır; stok
// hareketi, cari borç/alacağı, peşin tahsilat/ödeme (Kasa), çek/senet (portföy, verilen evrak, ciro) ve vadeli satışın
// taksit kartı faturaya bağlı olarak AYNI işlem bloğunda yazılır (store.tx: BEGIN IMMEDIATE … COMMIT; bir adım
// başarısız olursa ROLLBACK, hiçbir satır kalmaz). En dış COMMIT'ten önce mutabakat kapısı (lib/integrity.mjs) fatura
// ↔ kalemler ↔ cari ↔ stok ↔ çek/senet ↔ taksit ↔ Ana Defter eşitliğini denetler; sapma varsa işlem geri alınır.
//
// Yaşam döngüsü
//   taslak (draft)  : deftere dokunmaz, numarası yoktur; düzeltilir, silinir, proforma olarak yazdırılır.
//   kesildi (issued): numara verilir (seri + yıl + 9 hane; VUK sıra-tarih uyumu), defterlere yazılır. Kesilmiş fatura
//                     düzeltilmez (yasal belge): iptal edilir ya da iade faturası kesilir.
//   iptal (cancelled): numara korunur; bütün defter etkileri birebir geri alınır. Tahsilatı olan taksit kartı, tahsil
//                     ya da ciro edilmiş çek, satılmış mal (stok eksiye düşer), kilitli dönem ve iadesi olan fatura
//                     iptali durdurur (iade faturası kesilir).
import { randomUUID } from "node:crypto";
import { parseQty } from "../lib/accounts.mjs";
import { ADAPTERS, DEFAULT_ADAPTER, adapterInfo, connect, integratorUrl } from "../lib/einvoice/adapters.mjs";
import { readUbl } from "../lib/einvoice/ubl-read.mjs";
import { buildUbl, ublFileName } from "../lib/einvoice/ubl-tr.mjs";
import { HttpError, limited, ok, parseJson, readJson, sendBuffer, text } from "../lib/http.mjs";
import { invoicePdf } from "../lib/invoice-pdf.mjs";
import { CURRENCIES, EXEMPTIONS, EXPENSES, INVOICE_KINDS, InvoiceInputError, SCENARIOS, STOPPAGE_DEFAULT, VAT_RATES, WITHHOLDING, amountInWords, computeInvoice, grossFromNet, lineAccount, toTry, typeCode } from "../lib/invoice-math.mjs";
import { PAY_STATES, settleInvoices } from "../lib/invoice-settle.mjs";
import { parseAmount, roundMoney } from "../lib/money.mjs";
import { METHODS, methodOf } from "../lib/pay-method.mjs";
import { canUser } from "../lib/permissions.mjs";
import { createSecretBox } from "../lib/secret-box.mjs";
import { addMonths, dayText, isoDay } from "../lib/plans.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { ANONYMOUS_TCKN, classifyTaxId, isValidIban, isValidMersis, normalizeIban, partyProblems, splitPersonName } from "../lib/tax-id.mjs";
import { unitLabel } from "../lib/units.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";
import { createZip } from "../lib/zip.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDate = value => {
  if (!DATE.test(String(value || ""))) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};
const SETTINGS_KEY = "invoice.settings";
export const PROFILES = Object.freeze({
  KAGIT: "Kâğıt Fatura",
  EARSIVFATURA: "e-Arşiv Fatura",
  TEMELFATURA: "e-Fatura (Temel)",
  TICARIFATURA: "e-Fatura (Ticari)",
  ESMM: "e-SMM",
});
const E_STATES = Object.freeze({ none: "Gönderilmedi", exported: "XML Hazır", processing: "İşleniyor", sent: "Gönderildi", accepted: "Kabul Edildi", rejected: "Reddedildi", error: "Hata", cancelled: "Entegratörde İptal" });
// Gönderilebilir (ilk kez ya da hatadan sonra yeniden) ve sorgulanabilir e-Belge durumları.
const E_SENDABLE = new Set(["", "none", "exported", "error"]);
const E_TRACKED = new Set(["processing", "sent", "accepted", "rejected", "error", "cancelled"]);
const SIDE_KINDS = { sale: ["sale", "smm", "sale_return"], purchase: ["purchase", "purchase_return"] };
const MAX_LINES = 500;
const DEFAULTS = Object.freeze({
  seller: { name: "", partyKind: "company", firstName: "", familyName: "", taxNo: "", taxOffice: "", mersisNo: "", tradeRegistry: "", address: "", district: "", city: "", postalCode: "", country: "Türkiye", phone: "", email: "", website: "", banks: [] },
  // e-Dönüşüm (firmanın GİB'e kayıtlı olduğu sistemler). e-Arşiv, e-Fatura kaydı olmadan kullanılamaz.
  efatura: false,
  earsiv: false,
  esmm: false,
  // paper: programın kestiği bilgi fişi / kâğıt belge serisi (FIS2026000000001); e-Belge serileri bağlantı açılınca.
  series: { paper: "FIS", earsiv: "EAR", efatura: "EFT", smm: "SMM", esmm: "ESM", internal: "IAD" },
  start: {},
  defaults: { vatRate: 20, pricesIncludeVat: false, stoppageRate: STOPPAGE_DEFAULT, efaturaProfile: "TEMELFATURA", dueDays: 0, footer: "", saleScenario: "", purchaseScenario: "" },
  // Entegratör bağlantısı (kullanıcı kararı: şimdilik yalnız EDM Bilişim). Parola veritabanında şifreli tutulur
  // (lib/secret-box.mjs); ekrana ve günlüğe hiç çıkmaz.
  integrator: { id: "edm", env: "test", baseUrl: "", username: "", passwordSealed: "", senderAlias: "", autoSend: false },
});
const clone = value => JSON.parse(JSON.stringify(value));
const fail400 = (message, field = "", extra = {}) => {
  throw new HttpError(400, message, { code: "invoice-invalid", field, ...extra });
};
const pad2 = value => String(value).padStart(2, "0");
const nowTime = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const moneyText = (value, currency = "TRY") => `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)} ${currency === "TRY" ? "TL" : currency}`;
const c2 = value => roundMoney((Number(value) || 0) / 100);
const toCents = value => Math.round((Number(value) || 0) * 100);

export function registerInvoiceRoutes(router, { store, auth, audit, events, config = {}, period = null, cash = null, accounts = () => null, stock = () => null, plans = () => null, cheques = () => null }) {
  // e-Belge bağlantısı kapalıyken (varsayılan; program sahibi açana kadar) her belge kâğıt/bilgi fişidir: e-Fatura,
  // e-Arşiv, XML ve entegratör uçları çalışmaz, ekranda görünmez.
  const edocEnabled = config.edocEnabled === true;
  const requireEdoc = () => {
    if (!edocEnabled) throw new HttpError(404, "e-Belge (e-Fatura / e-Arşiv) bağlantısı bu kurulumda kapalı. Belgeler bilgi amaçlı müşteri fişi olarak kesilir.", { code: "edoc-disabled" });
  };
  let box = null;
  const secrets = () => (box ||= createSecretBox(config.dataDir || "."));
  const now = () => new Date().toISOString();
  const today = () => (period ? period.today() : isoDay(new Date()));
  const newId = prefix => `${prefix}-${randomUUID()}`;
  const AUDITOR = { id: "invoices", role: "admin", permissions: [] };
  const publish = (user, detail) => events?.publish("workspace.changed", { actorId: user.id, actorName: user.display_name, ...detail }, { except: user.id });

  // ---------- Ayarlar ----------
  function settings() {
    const raw = parseJson(store.setting(SETTINGS_KEY, "{}"), {});
    const out = clone(DEFAULTS);
    for (const key of Object.keys(out)) {
      if (raw?.[key] === undefined) continue;
      out[key] = out[key] && typeof out[key] === "object" && !Array.isArray(out[key]) ? { ...out[key], ...(raw[key] || {}) } : raw[key];
    }
    if (!ADAPTERS[out.integrator.id]) out.integrator.id = DEFAULT_ADAPTER;
    if (!out.seller.name) out.seller.name = store.setting("office.name", "") || "";
    if (!Array.isArray(out.seller.banks)) out.seller.banks = [];
    return out;
  }
  function settingsInput(body, previous) {
    const next = clone(previous);
    const seller = body.seller && typeof body.seller === "object" ? body.seller : {};
    const pick = (key, max, label) => limited(seller[key] ?? previous.seller[key] ?? "", max, label);
    next.seller = {
      name: pick("name", 200, "Unvan"),
      partyKind: ["company", "person"].includes(text(seller.partyKind)) ? text(seller.partyKind) : previous.seller.partyKind || "company",
      firstName: pick("firstName", 80, "Adı"),
      familyName: pick("familyName", 80, "Soyadı"),
      taxNo: String(seller.taxNo ?? previous.seller.taxNo ?? "").replace(/\s+/g, ""),
      taxOffice: pick("taxOffice", 120, "Vergi Dairesi"),
      mersisNo: String(seller.mersisNo ?? previous.seller.mersisNo ?? "").replace(/\s+/g, ""),
      tradeRegistry: pick("tradeRegistry", 40, "Ticaret Sicil No"),
      address: pick("address", 500, "Adres"),
      district: pick("district", 80, "İlçe"),
      city: pick("city", 80, "İl"),
      postalCode: pick("postalCode", 10, "Posta Kodu"),
      country: pick("country", 80, "Ülke") || "Türkiye",
      phone: pick("phone", 60, "Telefon"),
      email: pick("email", 160, "E-Posta"),
      website: pick("website", 200, "Web Sitesi"),
      banks: (Array.isArray(seller.banks) ? seller.banks : previous.seller.banks || []).slice(0, 4).map(bank => ({ name: limited(bank?.name, 80, "Banka"), iban: normalizeIban(bank?.iban) })).filter(bank => bank.iban || bank.name),
    };
    if (next.seller.taxNo) {
      const id = classifyTaxId(next.seller.taxNo);
      if (!id.ok) fail400(id.kind === "vkn" ? "Firmanın VKN'si geçersiz: denetim hanesi tutmuyor." : id.kind === "tckn" ? "Firmanın TC kimlik numarası geçersiz." : "VKN 10, TCKN 11 haneli olmalı.", "seller.taxNo");
      next.seller.partyKind = id.kind === "vkn" ? "company" : "person";
    }
    if (next.seller.mersisNo && !isValidMersis(next.seller.mersisNo)) fail400("MERSİS numarası 16 haneli olmalı.", "seller.mersisNo");
    for (const bank of next.seller.banks) if (bank.iban && !isValidIban(bank.iban)) fail400(`IBAN geçersiz (${bank.iban}).`, "seller.banks");
    if (!edocEnabled && (body.efatura === true || body.earsiv === true || body.esmm === true || (body.integrator && typeof body.integrator === "object"))) requireEdoc();
    if (body.efatura !== undefined) next.efatura = body.efatura === true;
    if (body.earsiv !== undefined) next.earsiv = body.earsiv === true;
    if (next.earsiv && !next.efatura) fail400("e-Arşiv için önce e-Fatura mükellefi olmak gerekir (GİB): e-Fatura kutusunu da işaretleyin.", "earsiv");
    if (body.esmm !== undefined) next.esmm = body.esmm === true;
    if (body.series && typeof body.series === "object") {
      for (const key of Object.keys(DEFAULTS.series)) {
        if (body.series[key] === undefined) continue;
        const value = String(body.series[key] || "").trim().toLocaleUpperCase("tr-TR");
        if (!/^[A-Z0-9]{3}$/.test(value)) fail400("Seri 3 karakter olmalı: büyük harf (Türkçe harfsiz) ya da rakam (ör. FTR, EAR).", `series.${key}`);
        next.series[key] = value;
      }
      const used = Object.values(next.series);
      if (new Set(used).size !== used.length) fail400("Her belge türünün serisi farklı olmalı (aynı seri iki türde kullanılamaz).", "series");
    }
    if (body.start && typeof body.start === "object") {
      next.start = {};
      for (const [key, value] of Object.entries(body.start).slice(0, 40)) {
        if (!/^[A-Z0-9]{3}\d{4}$/.test(key)) continue;
        const seq = Math.trunc(Number(value));
        if (!Number.isFinite(seq) || seq < 1 || seq > 999_999_999) fail400("Sonraki numara 1 ile 999.999.999 arasında olmalı.", "start");
        next.start[key] = seq;
      }
    }
    if (body.defaults && typeof body.defaults === "object") {
      const d = body.defaults;
      if (d.vatRate !== undefined) {
        if (!VAT_RATES.includes(Number(d.vatRate))) fail400("Varsayılan KDV oranı %0, %1, %10 ya da %20 olmalı.", "defaults.vatRate");
        next.defaults.vatRate = Number(d.vatRate);
      }
      if (d.pricesIncludeVat !== undefined) next.defaults.pricesIncludeVat = d.pricesIncludeVat === true;
      if (d.stoppageRate !== undefined) {
        const rate = Number(d.stoppageRate);
        if (!Number.isFinite(rate) || rate < 0 || rate > 40) fail400("Stopaj oranı 0 ile 40 arasında olmalı.", "defaults.stoppageRate");
        next.defaults.stoppageRate = rate;
      }
      if (d.efaturaProfile !== undefined) next.defaults.efaturaProfile = d.efaturaProfile === "TICARIFATURA" ? "TICARIFATURA" : "TEMELFATURA";
      if (d.dueDays !== undefined) {
        const days = Math.trunc(Number(d.dueDays) || 0);
        if (days < 0 || days > 3650) fail400("Vade günü 0 ile 3650 arasında olmalı.", "defaults.dueDays");
        next.defaults.dueDays = days;
      }
      if (d.footer !== undefined) next.defaults.footer = limited(d.footer, 500, "Fatura Alt Notu");
      if (d.saleScenario !== undefined) next.defaults.saleScenario = SCENARIOS[d.saleScenario] && ["sale", "smm"].includes(SCENARIOS[d.saleScenario].kind) ? d.saleScenario : "";
      if (d.purchaseScenario !== undefined) next.defaults.purchaseScenario = SCENARIOS[d.purchaseScenario]?.kind === "purchase" ? d.purchaseScenario : "";
    }
    if (body.integrator && typeof body.integrator === "object") {
      const input = body.integrator;
      const prev = previous.integrator;
      const id = text(input.id ?? prev.id) || DEFAULT_ADAPTER;
      if (!ADAPTERS[id]) fail400("Entegratör tanınmadı.", "integrator.id");
      const env = input.env === undefined ? prev.env : input.env === "live" ? "live" : "test";
      const baseUrl = input.baseUrl === undefined ? prev.baseUrl : String(input.baseUrl || "").trim().replace(/\?.*$/, "");
      if (baseUrl && !/^https:\/\/[^\s/]+\/\S+$/i.test(baseUrl) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/\S*$/i.test(baseUrl)) fail400("Servis adresi https:// ile başlayan tam adres olmalı (ör. https://portal2.edmbilisim.com.tr/EFaturaEDM/EFaturaEDM.svc); boş bırakılırsa seçilen ortamın adresi kullanılır.", "integrator.baseUrl");
      const username = input.username === undefined ? prev.username : limited(input.username, 120, "Kullanıcı Adı");
      let passwordSealed = prev.passwordSealed;
      if (input.clearPassword === true) passwordSealed = "";
      else if (typeof input.password === "string" && input.password !== "") {
        if (input.password.length > 200) fail400("Parola en çok 200 karakter olabilir.", "integrator.password");
        passwordSealed = secrets().seal(input.password);
      }
      const senderAlias = input.senderAlias === undefined ? prev.senderAlias : String(input.senderAlias || "").trim();
      if (senderAlias && !/^urn:mail:[^\s@]+@[^\s@]+$/i.test(senderAlias)) fail400("Gönderici birim etiketi urn:mail:…@… biçiminde olmalı (ör. urn:mail:defaultgb@edmbilisim.com.tr); bilmiyorsanız boş bırakın.", "integrator.senderAlias");
      const autoSend = input.autoSend === undefined ? prev.autoSend === true : input.autoSend === true;
      next.integrator = { id, env, baseUrl, username, passwordSealed, senderAlias, autoSend };
    }
    return next;
  }
  const sellerProblems = (profile, s = settings()) => partyProblems(sellerParty(s), { profile: profile === "KAGIT" ? "KAGIT" : profile === "EARSIVFATURA" ? "EARSIV" : profile === "ESMM" ? "EARSIV" : "EFATURA", role: "seller" });
  const sellerParty = s => {
    const seller = { ...s.seller };
    if (seller.partyKind === "person" && (!seller.firstName || !seller.familyName)) Object.assign(seller, { ...splitPersonName(seller.name), ...(seller.firstName ? { firstName: seller.firstName } : {}), ...(seller.familyName ? { familyName: seller.familyName } : {}) });
    return seller;
  };

  // Ekrana giden ayarlar: parola (şifreli hâli de) hiç gönderilmez; yalnız girilmiş olup olmadığı.
  const publicSettings = s => {
    const { passwordSealed, ...rest } = s.integrator;
    return { ...s, integrator: { ...rest, hasPassword: Boolean(passwordSealed), url: integratorUrl(s.integrator), label: ADAPTERS[s.integrator.id]?.label || "" } };
  };
  const integratorSummary = s => ({ id: s.integrator.id, label: ADAPTERS[s.integrator.id]?.label || "", env: s.integrator.env, configured: Boolean(s.integrator.username && s.integrator.passwordSealed), autoSend: s.integrator.autoSend === true });
  function integrator(s = settings()) {
    requireEdoc();
    const cfg = s.integrator;
    if (!cfg.username || !cfg.passwordSealed) throw new HttpError(409, `${ADAPTERS[cfg.id]?.label || "Entegratör"} web servis kullanıcı adı ve parolası girilmemiş. Fatura Ayarları → e-Belge Bağlantısı'ndan girin.`, { code: "integrator-not-configured" });
    const password = secrets().open(cfg.passwordSealed);
    if (!password) throw new HttpError(409, "Kayıtlı entegratör parolası bu bilgisayarda açılamadı (veriler başka bilgisayardan taşınmış olabilir). Fatura Ayarları'nda parolayı yeniden girin.", { code: "integrator-password" });
    return connect({ integrator: { ...cfg, password }, seller: sellerParty(s) });
  }

  // ---------- Okuma ----------
  const INVOICE_SQL = `SELECT i.id, i.kind, i.scenario, i.status, i.series, i.year, i.seq, i.number, i.ettn, i.issue_date AS issueDate, i.issue_time AS issueTime, i.account_id AS accountId,
      i.party_json AS partyJson, i.seller_json AS sellerJson, i.profile, i.type_code AS typeCode, i.currency, i.rate, i.prices_include_vat AS pricesIncludeVat, i.discount_rate AS discountRate,
      i.stoppage_rate AS stoppageRate, i.base_total AS baseTotal, i.discount_total AS discountTotal, i.net_total AS netTotal, i.goods_net AS goodsNet, i.service_net AS serviceNet, i.vat_total AS vatTotal,
      i.withheld_total AS withheldTotal, i.stoppage_total AS stoppageTotal, i.gross_total AS grossTotal, i.payable_total AS payableTotal, i.try_net AS tryNet, i.try_vat AS tryVat,
      i.try_withheld AS tryWithheld, i.try_stoppage AS tryStoppage, i.try_payable AS tryPayable, i.gl_json AS glJson, i.payment_json AS paymentJson, i.due_date AS dueDate, i.plan_id AS planId,
      i.original_id AS originalId, i.order_no AS orderNo, i.order_date AS orderDate, i.despatch_no AS despatchNo, i.despatch_date AS despatchDate, i.paper_no AS paperNo, i.note, i.e_status AS eStatus, i.e_adapter AS eAdapter,
      i.e_message AS eMessage, i.e_at AS eAt, i.created_by AS createdBy, i.created_at AS createdAt, i.updated_at AS updatedAt, i.issued_at AS issuedAt, i.cancelled_at AS cancelledAt, i.cancel_reason AS cancelReason,
      COALESCE(a.name, '') AS accountName, COALESCE(a.ref_no, '') AS accountRef, COALESCE(a.phone, '') AS accountPhone, COALESCE(a.tax_no, '') AS accountTaxNo, COALESCE(a.type, '') AS accountType,
      COALESCE(u.display_name, '') AS actorName, COALESCE(o.number, '') AS originalNumber, COALESCE(o.issue_date, '') AS originalDate
    FROM invoices i LEFT JOIN accounts a ON a.id = i.account_id LEFT JOIN users u ON u.id = i.created_by LEFT JOIN invoices o ON o.id = i.original_id`;
  const LINE_SQL = `SELECT l.id, l.invoice_id AS invoiceId, l.seq, l.item_id AS itemId, l.goods, l.code, l.name, l.description, l.unit, l.qty, l.unit_price AS unitPrice, l.discount_rate AS discountRate,
      l.base, l.discount, l.net, l.vat_rate AS vatRate, l.vat, l.withholding_code AS withholdingCode, l.withholding_num AS withholdingNum, l.withholding_den AS withholdingDen, l.withheld,
      l.exemption_code AS exemptionCode, l.gross, l.payable, l.gl_account AS glAccount, l.expense_code AS expenseCode, l.unit_cost AS unitCost, l.origin_line_id AS originLineId, l.move_id AS moveId
    FROM invoice_lines l`;
  const invoiceRow = id => {
    const row = store.get(`${INVOICE_SQL} WHERE i.id = ?`, limited(id, 120, "Fatura"));
    if (!row) throw new HttpError(404, "Fatura bulunamadı.");
    return row;
  };
  const linesOf = invoiceId => store.all(`${LINE_SQL} WHERE l.invoice_id = ? ORDER BY l.seq`, invoiceId);
  const label = row => INVOICE_KINDS[row.kind]?.label || "Fatura";
  const displayNo = row => row.number || (row.status === "draft" ? "Taslak" : "");
  // İade edilebilir miktar: asıl kalem − kesilmiş iadelerdeki miktar (iptal edilen iade sayılmaz).
  const returnedQty = (lineIds, exceptInvoiceId = "") => {
    const out = new Map();
    if (!lineIds.length) return out;
    for (const row of store.all(
      `SELECT r.origin_line_id AS originId, SUM(r.qty) AS qty FROM invoice_lines r JOIN invoices i ON i.id = r.invoice_id AND i.status = 'issued' AND i.id <> ?
       WHERE r.origin_line_id IN (${lineIds.map(() => "?").join(", ")}) GROUP BY r.origin_line_id`,
      exceptInvoiceId, ...lineIds,
    )) out.set(row.originId, Number(row.qty) || 0);
    return out;
  };

  // Ödeme durumu (kapama): carinin defteri + faturaya bağlı ödemeler (lib/invoice-settle.mjs).
  function paymentStates(rows) {
    const out = new Map();
    const byAccount = new Map();
    for (const row of rows) {
      if (!byAccount.has(row.accountId)) byAccount.set(row.accountId, []);
      byAccount.get(row.accountId).push(row);
    }
    const day = today();
    for (const [accountId, list] of byAccount) {
      let ledger = [];
      try {
        ledger = accounts()?.detail ? accounts().detail(accountId, AUDITOR).ledger || [] : [];
      } catch {
        ledger = [];
      }
      // Bu carinin bütün faturaları (listede olmayanlar da kapamada yer tutar).
      const all = store.all("SELECT id, kind, status, try_payable AS payable, original_id AS originalId, due_date AS dueDate, plan_id AS planId FROM invoices WHERE account_id = ?", accountId);
      const links = new Map();
      for (const entry of store.all("SELECT id, source_id AS invoiceId FROM account_entries WHERE account_id = ? AND source = 'invoice' AND kind IN ('in', 'out')", accountId)) links.set(entry.id, entry.invoiceId);
      for (const event of store.all("SELECT ev.invoice_id AS invoiceId, ev.effects_json AS effects FROM cheque_events ev WHERE ev.invoice_id <> '' AND ev.invoice_id IN (SELECT id FROM invoices WHERE account_id = ?)", accountId)) {
        for (const effect of parseJson(event.effects, [])) if (effect?.table === "account_entries" && effect.id) links.set(effect.id, event.invoiceId);
      }
      const plansById = new Map();
      for (const invoice of all.filter(item => item.planId)) {
        const plan = store.get("SELECT total FROM plans WHERE id = ? AND deleted_at IS NULL", invoice.planId);
        const schedule = store.all("SELECT due_date AS dueDate, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date", invoice.planId);
        plansById.set(invoice.id, { planTotal: Number(plan?.total) || 0, schedule });
      }
      const states = settleInvoices({ lines: ledger, invoices: all.map(item => ({ ...item, ...(plansById.get(item.id) || {}) })), links, today: day });
      for (const row of list) out.set(row.id, states.get(row.id) || { payable: row.tryPayable, paid: 0, open: row.tryPayable, state: "open", label: PAY_STATES.open });
    }
    return out;
  }

  const shape = (row, state = null) => ({
    id: row.id,
    kind: row.kind,
    kindLabel: label(row),
    scenario: row.scenario,
    scenarioLabel: SCENARIOS[row.scenario]?.label || "",
    status: row.status,
    statusLabel: { draft: "Taslak", issued: "Kesildi", cancelled: "İptal Edildi" }[row.status] || row.status,
    number: row.number,
    displayNo: displayNo(row),
    ettn: row.ettn,
    issueDate: row.issueDate,
    issueTime: row.issueTime,
    accountId: row.accountId,
    accountName: parseJson(row.partyJson, {}).name || row.accountName,
    accountRef: row.accountRef,
    accountPhone: row.accountPhone,
    profile: row.profile,
    profileLabel: PROFILES[row.profile] || row.profile,
    typeCode: row.typeCode,
    currency: row.currency,
    rate: row.rate,
    netTotal: row.netTotal,
    vatTotal: row.vatTotal,
    withheldTotal: row.withheldTotal,
    stoppageTotal: row.stoppageTotal,
    payableTotal: row.payableTotal,
    tryNet: row.tryNet,
    tryVat: row.tryVat,
    tryPayable: row.tryPayable,
    dueDate: row.dueDate,
    originalId: row.originalId,
    originalNumber: row.originalNumber,
    originalDate: row.originalDate,
    note: row.note,
    eStatus: row.eStatus,
    eStatusLabel: E_STATES[row.eStatus] || row.eStatus,
    actorName: row.actorName,
    createdAt: row.createdAt,
    payState: state?.state || (row.status === "draft" ? "draft" : row.status === "cancelled" ? "cancelled" : ""),
    payStateLabel: state?.label || (row.status === "draft" ? PAY_STATES.draft : row.status === "cancelled" ? PAY_STATES.cancelled : ""),
    paid: state?.paid ?? 0,
    open: state?.open ?? 0,
  });

  function detail(id, user) {
    const row = invoiceRow(id);
    const lines = linesOf(row.id);
    const returned = returnedQty(lines.map(line => line.id));
    const state = row.status === "issued" ? paymentStates([row]).get(row.id) : null;
    const returns = store.all("SELECT id, number, issue_date AS issueDate, status, try_payable AS tryPayable, kind FROM invoices WHERE original_id = ? ORDER BY issue_date, created_at", row.id);
    const linkedCheques = cheques()?.invoiceCheques ? cheques().invoiceCheques.forInvoice(row.id) : [];
    const plan = row.planId ? store.get("SELECT id, name, total, status, ref_no AS refNo FROM plans WHERE id = ? AND deleted_at IS NULL", row.planId) : null;
    const payments = store.all("SELECT id, kind, amount, date, method FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out') ORDER BY created_at", row.id).map(entry => ({ ...entry, methodLabel: METHODS[entry.method] || METHODS.cash }));
    const manage = canUser(user, "invoices.manage");
    const kind = INVOICE_KINDS[row.kind];
    const activeReturns = returns.filter(item => item.status === "issued").length;
    const returnable = lines.map(line => ({ id: line.id, left: Math.max(0, Math.round((line.qty - (returned.get(line.id) || 0)) * 1000) / 1000) }));
    return {
      ...shape(row, state),
      party: parseJson(row.partyJson, {}),
      seller: parseJson(row.sellerJson, {}),
      pricesIncludeVat: Boolean(row.pricesIncludeVat),
      discountRate: row.discountRate,
      stoppageRate: row.stoppageRate,
      baseTotal: row.baseTotal,
      discountTotal: row.discountTotal,
      goodsNet: row.goodsNet,
      serviceNet: row.serviceNet,
      grossTotal: row.grossTotal,
      tryWithheld: row.tryWithheld,
      tryStoppage: row.tryStoppage,
      gl: parseJson(row.glJson, []),
      orderNo: row.orderNo,
      orderDate: row.orderDate,
      despatchNo: row.despatchNo,
      despatchDate: row.despatchDate,
      paperNo: row.paperNo,
      payment: parseJson(row.paymentJson, {}),
      eMessage: row.eMessage,
      eAt: row.eAt,
      eAdapter: row.eAdapter,
      cancelledAt: row.cancelledAt,
      cancelReason: row.cancelReason,
      amountInWords: amountInWords(row.payableTotal, row.currency),
      byRate: vatBreakdown(lines),
      lines: lines.map(line => ({ ...line, goods: Boolean(line.goods), returned: returned.get(line.id) || 0, expenseLabel: EXPENSES[line.expenseCode]?.label || "" })),
      returnable,
      returns,
      cheques: linkedCheques.map(cheque => ({ id: cheque.id, direction: cheque.direction, instrument: cheque.instrument, instrumentLabel: cheque.instrumentLabel, serialNo: cheque.serialNo, bank: cheque.bank, amount: cheque.amount, dueDate: cheque.dueDate, status: cheque.status, statusLabel: cheque.statusLabel, endorsed: cheque.invoiceId !== row.id })),
      plan,
      payments,
      canManage: manage,
      canEdit: manage && row.status === "draft",
      canIssue: manage && row.status === "draft",
      canDelete: manage && row.status === "draft",
      canCancel: manage && row.status === "issued" && activeReturns === 0,
      cancelBlock: row.status === "issued" && activeReturns ? `Bu faturanın ${activeReturns} iade faturası var; önce iadeleri iptal edin.` : "",
      canReturn: manage && row.status === "issued" && !kind?.return && row.kind !== "smm" && returnable.some(item => item.left > 0),
      canSend: edocEnabled && manage && row.status === "issued" && kind?.send && row.profile !== "KAGIT" && E_SENDABLE.has(row.eStatus || "none"),
      canRefresh: edocEnabled && manage && kind?.send && row.profile !== "KAGIT" && E_TRACKED.has(row.eStatus),
      edocEnabled,
    };
  }
  const vatBreakdown = lines => {
    const map = new Map();
    for (const line of lines) {
      const item = map.get(line.vatRate) || { rate: line.vatRate, net: 0, vat: 0, withheld: 0 };
      item.net = roundMoney(item.net + line.net);
      item.vat = roundMoney(item.vat + line.vat);
      item.withheld = roundMoney(item.withheld + line.withheld);
      map.set(line.vatRate, item);
    }
    return [...map.values()].sort((a, b) => a.rate - b.rate);
  };

  // ---------- Liste ----------
  const SORTS = new Set(["date", "number", "amount", "party"]);
  // Ekran sekmeleri: Kesilen (satış + serbest meslek), Alınan (alış), İadeler, Taslaklar, İptal Edilenler, Tümü.
  const TABS = Object.freeze({
    sale: { kinds: ["sale", "smm"], status: "issued" },
    purchase: { kinds: ["purchase"], status: "issued" },
    returns: { kinds: ["sale_return", "purchase_return"], status: "issued" },
    drafts: { kinds: null, status: "draft" },
    cancelled: { kinds: null, status: "cancelled" },
    all: { kinds: null, status: "" },
  });
  const listQuery = params => ({
    tab: TABS[text(params.get("tab"))] ? text(params.get("tab")) : "",
    side: ["sale", "purchase"].includes(text(params.get("side"))) ? text(params.get("side")) : "",
    kind: INVOICE_KINDS[text(params.get("kind"))] ? text(params.get("kind")) : "",
    status: ["draft", "issued", "cancelled"].includes(text(params.get("status"))) ? text(params.get("status")) : "",
    pay: ["open", "paid", "overdue", "partial", "unpaid"].includes(text(params.get("pay"))) ? text(params.get("pay")) : "",
    profile: PROFILES[text(params.get("profile"))] ? text(params.get("profile")) : "",
    from: validDate(text(params.get("from"))) ? text(params.get("from")) : "",
    to: validDate(text(params.get("to"))) ? text(params.get("to")) : "",
    account: text(params.get("account")).slice(0, 120),
    item: text(params.get("item")).slice(0, 120),
    q: text(params.get("q")).slice(0, 120),
    ids: text(params.get("ids")).split(",").map(value => value.trim()).filter(Boolean).slice(0, 5000),
    sort: SORTS.has(text(params.get("sort"))) ? text(params.get("sort")) : "date",
  });
  function list(user, query) {
    const where = [];
    const args = [];
    if (query.ids?.length) {
      where.push(`i.id IN (${query.ids.map(() => "?").join(", ")})`);
      args.push(...query.ids);
    }
    if (query.side) {
      where.push(`i.kind IN (${SIDE_KINDS[query.side].map(() => "?").join(", ")})`);
      args.push(...SIDE_KINDS[query.side]);
    }
    if (query.tab) {
      const tab = TABS[query.tab];
      if (tab.kinds) {
        where.push(`i.kind IN (${tab.kinds.map(() => "?").join(", ")})`);
        args.push(...tab.kinds);
      }
      if (tab.status) {
        where.push("i.status = ?");
        args.push(tab.status);
      }
    }
    if (query.kind) {
      where.push("i.kind = ?");
      args.push(query.kind);
    }
    if (query.status) {
      where.push("i.status = ?");
      args.push(query.status);
    }
    if (query.profile) {
      where.push("i.profile = ?");
      args.push(query.profile);
    }
    if (query.from) {
      where.push("i.issue_date >= ?");
      args.push(query.from);
    }
    if (query.to) {
      where.push("i.issue_date <= ?");
      args.push(query.to);
    }
    if (query.account) {
      where.push("i.account_id = ?");
      args.push(query.account);
    }
    if (query.item) {
      where.push("EXISTS (SELECT 1 FROM invoice_lines l WHERE l.invoice_id = i.id AND l.item_id = ?)");
      args.push(query.item);
    }
    const needle = String(query.q || "").toLocaleLowerCase("tr-TR").trim();
    let rows = store.all(`${INVOICE_SQL}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`, ...args);
    if (needle) {
      const lineHits = new Set(store.all("SELECT DISTINCT invoice_id AS id FROM invoice_lines WHERE lower(name) LIKE ? OR lower(code) LIKE ?", `%${needle}%`, `%${needle}%`).map(row => row.id));
      rows = rows.filter(row => lineHits.has(row.id) || `${row.number} ${row.accountName} ${parseJson(row.partyJson, {}).name || ""} ${row.accountTaxNo} ${row.note} ${row.orderNo} ${row.despatchNo} ${row.paperNo} ${row.ettn}`.toLocaleLowerCase("tr-TR").includes(needle));
    }
    const states = paymentStates(rows.filter(row => row.status === "issued"));
    let shaped = rows.map(row => shape(row, states.get(row.id)));
    if (query.pay) shaped = shaped.filter(row => (query.pay === "open" ? ["open", "partial", "overdue", "installment"].includes(row.payState) : query.pay === "unpaid" ? row.payState === "open" : row.payState === query.pay));
    const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
    const compare = {
      date: (a, b) => (a.issueDate === b.issueDate ? (a.issueTime === b.issueTime ? (a.createdAt < b.createdAt ? 1 : -1) : a.issueTime < b.issueTime ? 1 : -1) : a.issueDate < b.issueDate ? 1 : -1),
      number: (a, b) => collator.compare(b.displayNo, a.displayNo),
      amount: (a, b) => b.tryPayable - a.tryPayable,
      party: (a, b) => collator.compare(a.accountName, b.accountName),
    }[query.sort];
    shaped.sort(compare);
    // Toplamlar yalnız kesilmiş faturalardan (taslak ve iptal hariç); iade faturaları ters işaretle.
    const totals = { count: shaped.length, issued: 0, sale: 0, purchase: 0, net: 0, vat: 0, payable: 0, open: 0, overdue: 0 };
    for (const row of shaped) {
      if (row.status !== "issued") continue;
      const sign = INVOICE_KINDS[row.kind].return ? -1 : 1;
      totals.issued += 1;
      totals.net = roundMoney(totals.net + sign * row.tryNet);
      totals.vat = roundMoney(totals.vat + sign * row.tryVat);
      totals.payable = roundMoney(totals.payable + sign * row.tryPayable);
      if (INVOICE_KINDS[row.kind].side === "sale") totals.sale = roundMoney(totals.sale + sign * row.tryPayable);
      else totals.purchase = roundMoney(totals.purchase + sign * row.tryPayable);
      totals.open = roundMoney(totals.open + (row.open || 0));
      if (row.payState === "overdue") totals.overdue = roundMoney(totals.overdue + (row.open || 0));
    }
    return { invoices: shaped, totals, tabCounts: tabCounts(query.account), canManage: canUser(user, "invoices.manage") };
  }
  // Sekme sayıları (cari kartından açıldıysa o carininkiler).
  function tabCounts(accountId = "") {
    const rows = store.all(`SELECT kind, status, COUNT(*) AS n FROM invoices${accountId ? " WHERE account_id = ?" : ""} GROUP BY kind, status`, ...(accountId ? [accountId] : []));
    const out = Object.fromEntries(Object.keys(TABS).map(key => [key, 0]));
    for (const row of rows) {
      out.all += row.n;
      for (const [key, tab] of Object.entries(TABS)) if (key !== "all" && (!tab.kinds || tab.kinds.includes(row.kind)) && (!tab.status || tab.status === row.status)) out[key] += row.n;
    }
    return out;
  }

  // ---------- Girdi ----------
  const accountOf = id => {
    const service = accounts();
    if (!id) fail400("Faturanın carisini seçin.", "accountId");
    if (!service?.exists?.(id)) fail400("Seçilen cari bulunamadı; silinmiş olabilir.", "accountId");
    return service.accountRow(id);
  };
  const numberOf = (value, label, field, { min = 0, max = 1e12 } = {}) => {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const number = typeof value === "number" ? value : parseAmount(value);
    if (!Number.isFinite(number) || number < min || number > max) fail400(`${label} geçerli bir sayı olmalı.`, field);
    return number;
  };
  const qtyOf = (value, at) => {
    const qty = typeof value === "number" ? value : parseQty(value);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1e9) fail400(`${at}: miktar sıfırdan büyük olmalı.`, "qty");
    return Math.round(qty * 1000) / 1000;
  };
  // Belge türü (profil). Kendi kestiğimiz belgede GİB kuralı (VUK 509 Sıra No'lu Tebliğ):
  //   alıcı e-Fatura mükellefi ve biz e-Fatura kullanıcısıysak  → e-Fatura (Temel ya da Ticari; seçilebilir)
  //   alıcı e-Fatura mükellefi değilse ve biz e-Arşiv kullanıcısıysak → e-Arşiv
  //   aksi hâlde                                                 → kâğıt fatura
  // Kullanıcı türü değiştirebilir; yasal olmayan seçim nedeni söylenerek engellenir (alıcı e-Fatura mükellefiyken e-Arşiv
  // kesilmez; e-Arşiv kullanıcısı kâğıt fatura kesmez). Karşı tarafın belgesinde (alış, müşterinin iade faturası) tür
  // bize nasıl geldiğidir (bilgi).
  const allowedProfiles = (kind, account, s) => {
    if (!edocEnabled) return ["KAGIT"];
    if (kind === "smm") return s.esmm ? ["ESMM"] : ["KAGIT"];
    if (!INVOICE_KINDS[kind].own) return ["KAGIT", "EARSIVFATURA", "TEMELFATURA", "TICARIFATURA"];
    if (!s.efatura) return ["KAGIT"];
    if (Number(account.eInvoice) === 1) return ["TEMELFATURA", "TICARIFATURA"];
    return s.earsiv ? ["EARSIVFATURA"] : ["KAGIT"];
  };
  function profileFor(kind, account, requested, s) {
    const allowed = allowedProfiles(kind, account, s);
    const auto = kind === "smm" || !INVOICE_KINDS[kind].own ? allowed[0] : allowed.includes("TEMELFATURA") ? (allowed.includes(account.eProfile) ? account.eProfile : s.defaults.efaturaProfile || "TEMELFATURA") : allowed[0];
    if (!requested || !PROFILES[requested]) return auto;
    if (allowed.includes(requested)) return requested;
    const efatura = Number(account.eInvoice) === 1;
    let reason;
    if (kind === "smm") reason = requested === "ESMM" ? "e-SMM için Fatura Ayarları'nda e-SMM kullanıcısı olduğunuzu işaretleyin." : "e-SMM kullanıcısı kâğıt serbest meslek makbuzu düzenlemez.";
    else if (!s.efatura) reason = "e-Fatura / e-Arşiv için Fatura Ayarları'nda e-Fatura mükellefi olduğunuzu işaretleyin (entegratör bilgileriyle).";
    else if (efatura && requested === "EARSIVFATURA") reason = "Alıcı e-Fatura mükellefi: GİB kuralı gereği e-Arşiv değil e-Fatura kesilir. Mükellefiyet bilgisi yanlışsa cari kartında Mükellef Sorgula ile yenileyin.";
    else if (efatura && requested === "KAGIT") reason = "Alıcı e-Fatura mükellefi: kâğıt fatura kesilmez, e-Fatura kesilir.";
    else if (!efatura && (requested === "TEMELFATURA" || requested === "TICARIFATURA")) reason = "Alıcı e-Fatura mükellefi değil: e-Fatura gönderilemez. Mükellef ise cari kartında Mükellef Sorgula ile işaretleyin.";
    else if (requested === "KAGIT" && s.earsiv) reason = "e-Arşiv kullanıcısı e-Fatura mükellefi olmayan alıcıya kâğıt değil e-Arşiv fatura keser.";
    else if (requested === "EARSIVFATURA") reason = "e-Arşiv için Fatura Ayarları'nda e-Arşiv kullanıcısı olduğunuzu işaretleyin.";
    else reason = "Bu belge türü bu alıcıya kesilemez.";
    fail400(reason, "profile", { code: "profile-not-allowed", allowed });
  }
  const partySnapshot = (account, override = null) => {
    const party = {
      id: account.id,
      name: account.name,
      partyKind: account.partyKind || (classifyTaxId(account.taxNo).kind === "tckn" ? "person" : account.taxNo ? "company" : "person"),
      firstName: account.firstName || "",
      familyName: account.familyName || "",
      taxNo: account.taxNo || "",
      taxOffice: account.taxOffice || "",
      mersisNo: account.mersisNo || "",
      tradeRegistry: account.tradeRegistry || "",
      address: account.address || "",
      district: account.district || "",
      city: account.city || "",
      postalCode: account.postalCode || "",
      country: account.country || "Türkiye",
      phone: account.phone || "",
      email: account.email || "",
      website: account.website || "",
      iban: account.iban || "",
      eInvoice: Number(account.eInvoice) === 1,
      eAlias: account.eAlias || "",
    };
    // Nihai tüketici (kimliksiz perakende carisi): alıcının adı/kimliği faturada ayrıca yazılabilir.
    if (override && typeof override === "object" && (!account.taxNo || account.taxNo === ANONYMOUS_TCKN)) {
      for (const key of ["name", "taxNo", "address", "district", "city", "phone", "email"]) {
        const value = limited(override[key], key === "address" ? 500 : 200, "Alıcı");
        if (value) party[key] = key === "taxNo" ? value.replace(/\s+/g, "") : value;
      }
      if (party.taxNo) {
        const id = classifyTaxId(party.taxNo, { allowAnonymous: true });
        if (!id.ok) fail400("Alıcının VKN/TCKN'si geçersiz.", "buyer.taxNo");
        party.partyKind = id.kind === "vkn" ? "company" : "person";
      }
    }
    if (party.partyKind === "person" && (!party.firstName || !party.familyName)) {
      const split = splitPersonName(party.name);
      party.firstName = party.firstName || split.firstName;
      party.familyName = party.familyName || split.familyName;
    }
    return party;
  };

  /**
   * İstek gövdesinden belge. mode: "draft" (eksik ödeme ve stok denetimi yok) ya da "issue".
   * Dönüş: { kind, scenario, account, party, date, time, profile, currency, rate, … lines, computed, money }.
   */
  function documentInput(body, { mode = "issue", existing = null } = {}) {
    const s = settings();
    const scenario = SCENARIOS[text(body.scenario)] ? text(body.scenario) : existing?.scenario || "";
    const kind = INVOICE_KINDS[text(body.kind)] ? text(body.kind) : SCENARIOS[scenario]?.kind || existing?.kind || "";
    if (!INVOICE_KINDS[kind]) fail400("Fatura türünü seçin (satış, alış, iade ya da serbest meslek makbuzu).", "kind");
    if (scenario && SCENARIOS[scenario].kind !== kind) fail400("Seçilen senaryo bu fatura türüne uymuyor.", "scenario");
    const meta = INVOICE_KINDS[kind];
    // İade: asıl fatura zorunlu; cari, para birimi, kur ve fiyatlar asıl faturadan gelir.
    let original = null;
    if (meta.return) {
      const originalId = text(body.originalId) || existing?.originalId || "";
      if (!originalId) fail400("İade edilecek faturayı seçin (üstteki arama kutusundan).", "originalId");
      original = invoiceRow(originalId);
      if (original.kind !== meta.of) fail400(`${meta.label} yalnız ${INVOICE_KINDS[meta.of].label.toLocaleLowerCase("tr-TR")} için kesilir.`, "originalId");
      if (original.status !== "issued") fail400("İptal edilmiş ya da taslak faturanın iadesi olmaz.", "originalId");
    }
    const account = accountOf(original ? original.accountId : text(body.accountId) || existing?.accountId || "");
    const date = text(body.issueDate ?? body.date ?? existing?.issueDate ?? today());
    if (!validDate(date)) fail400("Fatura tarihi geçerli bir tarih değil. Takvimden seçin.", "issueDate");
    if (mode === "issue" && date > today()) fail400(`İleri tarihli fatura kesilemez (${dayText(date)}). Taslak olarak kaydedin; günü gelince kesin.`, "issueDate", { code: "date-future" });
    if (original && date < original.issueDate) fail400(`İade tarihi, asıl faturanın tarihinden (${dayText(original.issueDate)}) önce olamaz.`, "issueDate", { code: "return-before-original" });
    const time = text(body.issueTime ?? existing?.issueTime ?? "") || nowTime();
    if (!TIME.test(time)) fail400("Fatura saati SS:DD biçiminde olmalı (ör. 14:30).", "issueTime");
    const profile = original && !meta.own ? profileFor(kind, account, text(body.profile) || "KAGIT", s) : profileFor(kind, account, text(body.profile ?? (existing && existing.status === "draft" ? "" : existing?.profile) ?? ""), s);
    const currency = original ? original.currency : CURRENCIES[text(body.currency)] ? text(body.currency) : existing?.currency || "TRY";
    let rate = 1;
    if (original) rate = Number(original.rate) || 1;
    else if (currency !== "TRY") {
      rate = numberOf(body.rate ?? existing?.rate, "Döviz kuru", "rate", { min: 0.000001, max: 1e6 });
      if (!(rate > 0)) fail400(`${CURRENCIES[currency].label} kurunu yazın (1 ${currency} kaç TL).`, "rate");
      rate = Math.round(rate * 1e6) / 1e6;
    }
    const pricesIncludeVat = original ? Boolean(original.pricesIncludeVat) : body.pricesIncludeVat === undefined ? (existing ? Boolean(existing.pricesIncludeVat) : s.defaults.pricesIncludeVat) : body.pricesIncludeVat === true;
    const discountRate = original ? Number(original.discountRate) || 0 : numberOf(body.discountRate ?? existing?.discountRate, "Genel iskonto", "discountRate", { min: 0, max: 99.99 }) || 0;
    // Stopaj: SMM'de alıcı tüzel kişiyse (vergi sorumlusu) varsayılan %20; gerçek kişiye (nihai tüketici) stopajsız.
    // Alışta (bize kesilen serbest meslek makbuzu / kira) alıcı biz olduğumuz için kesen biziz: 360'a yazılır.
    let stoppageRate = 0;
    if (original) stoppageRate = Number(original.stoppageRate) || 0;
    else if (kind === "smm" || kind === "purchase") {
      const given = numberOf(body.stoppageRate ?? existing?.stoppageRate, "Stopaj oranı", "stoppageRate", { min: 0, max: 40 });
      stoppageRate = given ?? (kind === "smm" && account.partyKind !== "person" && classifyTaxId(account.taxNo).kind !== "tckn" ? s.defaults.stoppageRate : 0);
    }
    const lines = linesInput(kind, Array.isArray(body.lines) ? body.lines : [], { original, s, existingId: existing?.id || "" });
    let computed;
    try {
      computed = computeInvoice(lines, { pricesIncludeVat, discountRate, stoppageRate });
    } catch (error) {
      if (error instanceof InvoiceInputError) fail400(error.message, error.field);
      throw error;
    }
    const money = toTry(computed.totals, rate);
    const note = limited(body.note ?? existing?.note ?? "", 2000, "Not");
    const dateField = (value, label, field) => {
      const v = text(value);
      if (v && !validDate(v)) fail400(`${label} geçerli bir tarih değil.`, field);
      return v;
    };
    const party = partySnapshot(account, body.buyer || (existing ? parseJson(existing.partyJson, null) : null));
    const number = !meta.own ? limited(body.number ?? existing?.number ?? "", 40, "Fatura No").toLocaleUpperCase("tr-TR") : "";
    return {
      kind,
      scenario: scenario || (kind === "sale" ? (lines.some(line => line.goods) ? "goods_sale" : "service_sale") : kind === "purchase" ? (lines.some(line => line.goods) ? "goods_purchase" : "expense_purchase") : kind),
      meta,
      account,
      party,
      original,
      date,
      time,
      profile,
      currency,
      rate,
      pricesIncludeVat,
      discountRate,
      stoppageRate,
      note,
      number,
      orderNo: limited(body.orderNo ?? existing?.orderNo ?? "", 60, "Sipariş No"),
      orderDate: dateField(body.orderDate ?? existing?.orderDate, "Sipariş tarihi", "orderDate"),
      despatchNo: limited(body.despatchNo ?? existing?.despatchNo ?? "", 60, "İrsaliye No"),
      // Elle kesilen matbu (kâğıt) faturanın seri/numarası (varsa): program fişi yasal faturayla eşleşir.
      paperNo: limited(body.paperNo ?? existing?.paperNo ?? "", 40, "Kâğıt Fatura No"),
      despatchDate: dateField(body.despatchDate ?? existing?.despatchDate, "İrsaliye tarihi", "despatchDate"),
      lines,
      computed,
      money,
      settings: s,
    };
  }

  function linesInput(kind, raw, { original, s, existingId = "" }) {
    if (!raw.length) fail400("Faturaya en az bir kalem ekleyin.", "lines");
    if (raw.length > MAX_LINES) fail400(`Bir faturada en çok ${MAX_LINES} kalem olabilir.`, "lines");
    const meta = INVOICE_KINDS[kind];
    if (meta.return) {
      const originLines = new Map(linesOf(original.id).map(line => [line.id, line]));
      const returned = returnedQty([...originLines.keys()], existingId);
      const seen = new Set();
      return raw.map((item, index) => {
        const at = `${index + 1}. kalem`;
        const origin = originLines.get(text(item?.originLineId));
        if (!origin) fail400(`${at} asıl faturada yok; iade kalemleri asıl faturadan seçilir.`, "lines");
        if (seen.has(origin.id)) fail400(`${at}: aynı kalem iki kez iade edilemez; miktarı tek satırda yazın.`, "lines");
        seen.add(origin.id);
        const qty = qtyOf(item.qty, at);
        const left = Math.round((origin.qty - (returned.get(origin.id) || 0)) * 1000) / 1000;
        if (qty > left + 1e-9) fail400(`${at} (${origin.name}): en çok ${String(left).replace(".", ",")} ${origin.unit} iade edilebilir (faturada ${String(origin.qty).replace(".", ",")}, önce iade edilen ${String(returned.get(origin.id) || 0).replace(".", ",")}).`, "qty", { code: "return-exceeds" });
        return {
          originLineId: origin.id,
          itemId: origin.itemId,
          goods: Boolean(origin.goods),
          code: origin.code,
          name: origin.name,
          description: origin.description,
          unit: origin.unit,
          qty,
          unitPrice: origin.unitPrice,
          discountRate: origin.discountRate,
          vatRate: origin.vatRate,
          withholdingCode: origin.withholdingCode,
          exemptionCode: origin.exemptionCode,
          expenseCode: origin.expenseCode,
          account: kind === "sale_return" ? "610" : origin.glAccount,
        };
      });
    }
    return raw.map((item, index) => {
      const at = `${index + 1}. kalem`;
      if (!item || typeof item !== "object") fail400(`${at} okunamadı.`, "lines");
      const itemId = text(item.itemId);
      const stockItem = itemId ? stock()?.invoiceStock?.itemFor(itemId) : null;
      if (itemId && !stockItem) fail400(`${at}: ürün bulunamadı.`, "lines");
      const goods = Boolean(stockItem && stockItem.kind !== "service");
      if (kind === "smm" && goods) fail400(`${at}: serbest meslek makbuzunda stoklu ürün olmaz; hizmet kalemi yazın.`, "lines");
      const name = limited(item.name || stockItem?.name || "", 200, "Kalem adı");
      if (!name) fail400(`${at}: kalemin adını yazın ya da stoktan ürün seçin.`, "lines");
      const purchaseSide = INVOICE_KINDS[kind].side === "purchase";
      const expenseCode = purchaseSide && !goods ? (EXPENSES[text(item.expenseCode)] ? text(item.expenseCode) : "other") : "";
      const unitPrice = numberOf(item.unitPrice, `${at} birim fiyatı`, "unitPrice", { min: 0, max: 1e12 });
      if (unitPrice === null) fail400(`${at}: birim fiyatı yazın.`, "unitPrice");
      const vatRate = item.vatRate === undefined || item.vatRate === "" || item.vatRate === null ? s.defaults.vatRate : Number(item.vatRate);
      return {
        originLineId: "",
        itemId: stockItem?.id || "",
        goods,
        code: limited(item.code || stockItem?.code || "", 60, "Kod"),
        name,
        description: limited(item.description, 300, "Açıklama"),
        unit: unitLabel(limited(item.unit || stockItem?.unit || "Adet", 20, "Birim")),
        qty: qtyOf(item.qty, at),
        unitPrice: Math.round(unitPrice * 10000) / 10000,
        discountRate: numberOf(item.discountRate, `${at} iskontosu`, "discountRate", { min: 0, max: 100 }) || 0,
        vatRate,
        withholdingCode: text(item.withholdingCode),
        exemptionCode: text(item.exemptionCode),
        expenseCode,
        account: lineAccount(kind, { goods, expenseCode }),
      };
    });
  }

  // Ödeme: { cash: [{ amount, method }], cheques: [{ instrument, amount, dueDate, serialNo, bank }], endorse: [chequeId],
  //          rest: 'open' | 'installments', dueDate, installments: { count, firstDue, everyMonths } }
  function paymentInput(body, doc, user) {
    const p = body.payment && typeof body.payment === "object" ? body.payment : {};
    const kind = doc.kind;
    const payable = c2(doc.money.payable);
    const amount = (value, label, field) => {
      const n = numberOf(value, label, field, { min: 0, max: 1e12 });
      return n === null ? 0 : roundMoney(n);
    };
    const cashList = (Array.isArray(p.cash) ? p.cash : p.cash && typeof p.cash === "object" ? [p.cash] : []).slice(0, 3).map(item => ({ amount: amount(item?.amount, "Peşin tutar", "payment.cash"), method: methodOf(item?.method) })).filter(item => item.amount > 0);
    const chequeAllowed = ["sale", "smm", "purchase"].includes(kind);
    const chequeList = (Array.isArray(p.cheques) ? p.cheques : []).slice(0, 20).map((item, index) => {
      if (!chequeAllowed) fail400("İade faturasında çek/senet alınmaz ya da verilmez; iade Kasa'dan ya da cariden mahsupla yapılır.", "payment.cheques");
      const value = amount(item?.amount, `${index + 1}. evrak tutarı`, "payment.cheques");
      if (!(value > 0)) fail400(`${index + 1}. evrakın tutarını yazın.`, "payment.cheques");
      const dueDate = text(item?.dueDate);
      if (!validDate(dueDate)) fail400(`${index + 1}. evrakın vade tarihini seçin.`, "payment.cheques");
      if (dueDate < doc.date) fail400(`${index + 1}. evrakın vadesi (${dayText(dueDate)}) fatura tarihinden (${dayText(doc.date)}) önce olamaz.`, "payment.cheques", { code: "cheque-due-before-issue" });
      return { instrument: text(item?.instrument) === "note" ? "note" : "cheque", amount: value, dueDate, serialNo: limited(item?.serialNo, 60, "Seri No"), bank: limited(item?.bank, 120, "Banka / Şube"), drawer: limited(item?.drawer, 160, "Keşideci") };
    });
    const endorseIds = kind === "purchase" ? [...new Set((Array.isArray(p.endorse) ? p.endorse : []).map(value => text(value)).filter(Boolean))].slice(0, 20) : [];
    if (!["purchase"].includes(kind) && Array.isArray(p.endorse) && p.endorse.length) fail400("Çek cirosu yalnız alış faturasının ödemesinde kullanılır.", "payment.endorse");
    const endorse = endorseIds.map(id => {
      const cheque = store.get("SELECT id, amount, status, direction, issue_date AS issueDate, account_id AS accountId, serial_no AS serialNo FROM cheques WHERE id = ? AND deleted_at IS NULL", id);
      if (!cheque || cheque.direction !== "in" || cheque.status !== "portfolio") fail400("Ciro edilecek evrak portföyde değil (tahsil edilmiş, ciro edilmiş ya da silinmiş olabilir).", "payment.endorse", { code: "cheque-not-in-portfolio" });
      if (cheque.issueDate > doc.date) fail400(`Evrak${cheque.serialNo ? ` No ${cheque.serialNo}` : ""} fatura tarihinden sonra alınmış; ciro tarihi alış tarihinden önce olamaz.`, "payment.endorse", { code: "cheque-endorse-before-receive" });
      if (cheque.accountId === doc.account.id) fail400("Evrak, alındığı cariye ciro edilemez.", "payment.endorse");
      return { id: cheque.id, amount: roundMoney(cheque.amount) };
    });
    if ((chequeList.length || endorse.length) && !canUser(user, "cheques.manage")) throw new HttpError(403, "Çek/senetle ödeme için Çek / Senet İşlemleri yetkisi gerekir.");
    const paid = roundMoney([...cashList, ...chequeList, ...endorse].reduce((sum, item) => sum + item.amount, 0));
    if (paid > payable + 0.005) fail400(`Ödemeler (${moneyText(paid)}) faturanın ödenecek tutarını (${moneyText(payable)}) aşıyor.`, "payment", { code: "payment-exceeds" });
    const rest = roundMoney(payable - paid);
    let mode = "none";
    let installments = null;
    let dueDate = doc.date;
    if (rest > 0.005 && !doc.meta.return) {
      if (p.rest === "installments") {
        if (!["sale", "smm"].includes(kind)) fail400("Taksitlendirme yalnız satışta (müşteriden alacak) yapılır; alışta vade tarihi yazın.", "payment.rest");
        if (!canUser(user, "plans.manage")) throw new HttpError(403, "Satışı taksitlendirmek taksit yönetimi yetkisidir.");
        const count = Math.trunc(Number(p.installments?.count));
        if (!(count >= 1 && count <= 120)) fail400("Taksit sayısı 1 ile 120 arasında olmalı.", "payment.installments");
        const firstDue = text(p.installments?.firstDue);
        if (!validDate(firstDue)) fail400("İlk taksitin vadesini seçin.", "payment.installments");
        if (firstDue < doc.date) fail400(`İlk vade (${dayText(firstDue)}) fatura tarihinden (${dayText(doc.date)}) önce olamaz.`, "payment.installments", { code: "due-before-start" });
        const everyMonths = Math.min(12, Math.max(1, Math.trunc(Number(p.installments?.everyMonths) || 1)));
        mode = "installments";
        installments = { count, firstDue, everyMonths };
        dueDate = addMonths(firstDue, everyMonths * (count - 1));
      } else {
        mode = "open";
        const days = Number(doc.account.dueDays) || Number(doc.settings.defaults.dueDays) || 0;
        dueDate = text(p.dueDate) || (days ? isoDay(new Date(Date.parse(`${doc.date}T12:00:00`) + days * 86_400_000)) : doc.date);
        if (!validDate(dueDate)) fail400("Vade tarihi geçerli bir tarih değil.", "payment.dueDate");
        if (dueDate < doc.date) fail400(`Vade (${dayText(dueDate)}) fatura tarihinden (${dayText(doc.date)}) önce olamaz.`, "payment.dueDate", { code: "due-before-start" });
      }
    }
    if (doc.meta.return) mode = rest > 0.005 ? "offset" : "none";
    return { cash: cashList, cheques: chequeList, endorse, paid, rest, mode, installments, dueDate };
  }

  // ---------- Numara ----------
  const seriesFor = (kind, profile, s) => {
    if (kind === "smm") return profile === "ESMM" ? s.series.esmm : s.series.smm;
    if (profile === "EARSIVFATURA") return s.series.earsiv;
    if (profile === "TEMELFATURA" || profile === "TICARIFATURA") return s.series.efatura;
    return s.series.paper;
  };
  function nextNumber(series, year, s = settings()) {
    const max = store.get("SELECT COALESCE(MAX(seq), 0) AS n FROM invoices WHERE series = ? AND year = ? AND seq > 0", series, year).n;
    const seq = Math.max(max + 1, Number(s.start?.[`${series}${year}`]) || 1);
    if (seq > 999_999_999) throw new HttpError(409, `${series} serisinde ${year} yılı için numara kalmadı.`);
    return { seq, number: `${series}${year}${String(seq).padStart(9, "0")}` };
  }
  // VUK md. 231 ve GİB: aynı seride numara sırası ile tarih sırası uyuşmalı — yeni fatura serinin son faturasından eski
  // tarihli olamaz (iptal edilmiş numara da sırada yer tutar).
  function assertChronology(series, year, date) {
    const last = store.get("SELECT number, issue_date AS issueDate FROM invoices WHERE series = ? AND year = ? AND seq > 0 ORDER BY seq DESC LIMIT 1", series, year);
    if (last && last.issueDate > date) fail400(`${series} serisinde son belge ${last.number} ${dayText(last.issueDate)} tarihli; yeni belge daha eski tarihli kesilemez (numara ve tarih sırası uyuşmalı).`, "issueDate", { code: "chronology" });
  }

  // ---------- Kesme (tek işlem bloğu) ----------
  const stockKind = kind => INVOICE_KINDS[kind].stock;
  const stockReason = kind => (kind === "sale_return" ? "return" : kind === "purchase_return" ? "preturn" : "");
  const inflow = kind => ["sale", "smm", "purchase_return"].includes(kind);
  const lineTryNet = (line, rate) => (rate === 1 ? line.net : Math.round(line.net * rate));

  function writeIssued(user, doc, payment, { id = null, force = {} } = {}) {
    const s = doc.settings;
    const meta = doc.meta;
    // e-Belge: alıcı ve satıcı bilgisi eksiksiz olmalı (GİB doğrulaması).
    if (doc.profile !== "KAGIT" && meta.own) {
      const problems = [...sellerProblems(doc.profile, s), ...partyProblems(doc.party, { profile: doc.profile === "EARSIVFATURA" || doc.profile === "ESMM" ? "EARSIV" : "EFATURA", role: "buyer" })];
      if (problems.length) fail400(problems.join(" "), "party", { code: "einvoice-party", problems });
    }
    const invoiceId = id || newId("invoice");
    const touched = { accounts: new Set([doc.account.id]), items: new Set(), cash: false, cheques: { accountIds: [], chequeIds: [] }, plans: new Set() };
    const result = store.tx(() => {
      period?.assertOpen(doc.date, "Fatura");
      // Numara (kesme anında; iki kişi aynı anda kesse de BEGIN IMMEDIATE sıraya sokar).
      let series = "";
      let year = 0;
      let seq = 0;
      let number = doc.number;
      if (meta.own || (doc.kind === "sale_return" && !number)) {
        series = meta.own ? seriesFor(doc.kind, doc.profile, s) : s.series.internal;
        year = Number(doc.date.slice(0, 4));
        assertChronology(series, year, doc.date);
        ({ seq, number } = nextNumber(series, year, s));
      } else {
        if (!number) fail400(doc.kind === "purchase" ? "Tedarikçinin fatura numarasını yazın (faturanın üstündeki No)." : "Fatura numarasını yazın.", "number");
        const twin = store.get("SELECT number, issue_date AS issueDate FROM invoices WHERE account_id = ? AND kind = ? AND number = ? AND status = 'issued' AND id <> ?", doc.account.id, doc.kind, number, invoiceId);
        if (twin) throw new HttpError(409, `${number} numaralı ${meta.label.toLocaleLowerCase("tr-TR")} bu caride ${dayText(twin.issueDate)} tarihiyle zaten kayıtlı.`, { code: "invoice-duplicate", field: "number" });
      }
      const totals = doc.computed.totals;
      const money = doc.money;
      const ettn = id ? store.get("SELECT ettn FROM invoices WHERE id = ?", id)?.ettn || randomUUID() : randomUUID();
      const stamp = now();
      const columns = {
        kind: doc.kind,
        scenario: doc.scenario,
        status: "issued",
        series,
        year,
        seq,
        number,
        ettn,
        issue_date: doc.date,
        issue_time: doc.time,
        account_id: doc.account.id,
        party_json: JSON.stringify(doc.party),
        seller_json: JSON.stringify(sellerParty(s)),
        profile: doc.profile,
        type_code: typeCode(doc.kind, doc.computed.lines),
        currency: doc.currency,
        rate: doc.rate,
        prices_include_vat: doc.pricesIncludeVat ? 1 : 0,
        discount_rate: doc.discountRate,
        stoppage_rate: doc.stoppageRate,
        base_total: c2(totals.base),
        discount_total: c2(totals.discount),
        net_total: c2(totals.net),
        goods_net: c2(totals.goodsNet),
        service_net: c2(totals.serviceNet),
        vat_total: c2(totals.vat),
        withheld_total: c2(totals.withheld),
        stoppage_total: c2(totals.stoppage),
        gross_total: c2(totals.gross),
        payable_total: c2(totals.payable),
        try_net: c2(money.net),
        try_vat: c2(money.vat),
        try_withheld: c2(money.withheld),
        try_stoppage: c2(money.stoppage),
        try_payable: c2(money.payable),
        gl_json: JSON.stringify(money.byAccount),
        payment_json: JSON.stringify({ cash: payment.cash, cheques: payment.cheques.map(item => ({ instrument: item.instrument, amount: item.amount, dueDate: item.dueDate, serialNo: item.serialNo, bank: item.bank })), endorse: payment.endorse.map(item => item.id), mode: payment.mode, installments: payment.installments, rest: payment.rest }),
        due_date: payment.dueDate,
        plan_id: "",
        original_id: doc.original?.id || "",
        order_no: doc.orderNo,
        order_date: doc.orderDate,
        despatch_no: doc.despatchNo,
        despatch_date: doc.despatchDate,
        paper_no: doc.paperNo,
        note: doc.note,
        updated_by: user.id,
        updated_at: stamp,
        issued_by: user.id,
        issued_at: stamp,
      };
      if (id) {
        const draft = store.get("SELECT status FROM invoices WHERE id = ?", id);
        if (draft?.status !== "draft") throw new HttpError(409, "Bu taslak bu arada kesilmiş ya da silinmiş. Listeyi yenileyin.", { code: "invoice-stale" });
        store.run("DELETE FROM invoice_lines WHERE invoice_id = ?", id);
        store.run(`UPDATE invoices SET ${Object.keys(columns).map(key => `${key} = ?`).join(", ")} WHERE id = ?`, ...Object.values(columns), id);
      } else {
        const all = { id: invoiceId, ...columns, created_by: user.id, created_at: stamp };
        store.run(`INSERT INTO invoices (${Object.keys(all).join(", ")}) VALUES (${Object.keys(all).map(() => "?").join(", ")})`, ...Object.values(all));
      }
      // Kalemler ve stok hareketleri.
      const what = `${meta.label} ${number}`;
      const noteFor = line => `${what} · ${doc.party.name}${line.description ? ` · ${line.description}` : ""}`.slice(0, 300);
      doc.computed.lines.forEach((line, index) => {
        const input = doc.lines[index];
        const lineId = newId("iline");
        let moveId = "";
        let unitCost = 0;
        if (input.itemId && input.goods && stockKind(doc.kind)) {
          const tryNet = lineTryNet(line, doc.rate);
          unitCost = doc.kind === "purchase" ? roundMoney(tryNet / 100 / line.qty) : 0;
          if (doc.kind === "sale") unitCost = Number(stock().invoiceStock.itemFor(input.itemId).unitPrice) || 0;
          moveId = stock().invoiceStock.add(user, {
            itemId: input.itemId,
            kind: stockKind(doc.kind),
            qty: line.qty,
            unitPrice: roundMoney(tryNet / 100 / line.qty),
            amount: c2(tryNet),
            date: doc.date,
            note: noteFor(input),
            reason: stockReason(doc.kind),
            invoiceId,
            force: force.stock === true,
            unitCost: doc.kind === "purchase" ? tryNet / 100 / line.qty : 0,
          });
          touched.items.add(input.itemId);
        } else if (input.itemId && doc.kind === "sale") unitCost = Number(stock()?.invoiceStock?.itemFor(input.itemId)?.unitPrice) || 0;
        store.run(
          `INSERT INTO invoice_lines (id, invoice_id, seq, item_id, goods, code, name, description, unit, qty, unit_price, discount_rate, base, discount, net, vat_rate, vat, withholding_code, withholding_num,
             withholding_den, withheld, exemption_code, gross, payable, gl_account, expense_code, unit_cost, origin_line_id, move_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          lineId, invoiceId, index + 1, input.itemId, input.goods ? 1 : 0, input.code, input.name, input.description, input.unit, line.qty, line.unitPrice, line.discountRate, c2(line.base), c2(line.discount), c2(line.net),
          line.vatRate, c2(line.vat), line.withholdingCode, line.withholdingNum, line.withholdingDen, c2(line.withheld), line.exemptionCode, c2(line.gross), c2(line.payable), input.account, input.expenseCode, unitCost,
          input.originLineId, moveId,
        );
      });
      // Cari: faturanın borcu/alacağı (TL karşılığı).
      const service = accounts();
      service.invoiceEntry.add(user, doc.account.id, { kind: meta.party, amount: c2(money.payable), date: doc.date, note: `${what}${doc.currency !== "TRY" ? ` (${moneyText(c2(totals.payable), doc.currency)} × ${doc.rate})` : ""}`, invoiceId });
      // Peşin tahsilat / ödeme (Kasa ↔ cari).
      for (const item of payment.cash) {
        const into = inflow(doc.kind);
        if (!into) cash?.guardOut?.(item.amount, doc.date, force.cash === true, item.method);
        service.invoiceEntry.add(user, doc.account.id, { kind: into ? "in" : "out", amount: item.amount, date: doc.date, note: `${what} · ${doc.meta.return ? (into ? "iade tahsilatı" : "iade ödemesi") : into ? "peşin tahsilat" : "peşin ödeme"}`, invoiceId, method: item.method });
        touched.cash = true;
      }
      // Çek / senet: satışta alınan (portföy), alışta verilen; carinin bakiyesiyle mahsup çek olayından gelir.
      for (const item of payment.cheques) {
        const created = cheques().invoiceCheques.create(user, { direction: INVOICE_KINDS[doc.kind].side === "sale" ? "in" : "out", instrument: item.instrument, amount: item.amount, issueDate: doc.date, dueDate: item.dueDate, accountId: doc.account.id, serialNo: item.serialNo, bank: item.bank, drawer: item.drawer || doc.party.name, note: what }, { invoiceId, note: number });
        touched.cheques.chequeIds.push(created.id);
      }
      for (const item of payment.endorse) {
        const endorsed = cheques().invoiceCheques.endorse(user, item.id, { accountId: doc.account.id, date: doc.date, invoiceId, note: number });
        touched.cheques.chequeIds.push(endorsed.id);
        for (const effect of endorsed.effects) if (effect.accountId) touched.accounts.add(effect.accountId);
      }
      // Kalan: taksit kartı (satış) ya da vadeli açık hesap.
      let planId = "";
      if (payment.mode === "installments") {
        planId = plans().createForAccount(user, doc.account, { total: payment.rest, count: payment.installments.count, firstDue: payment.installments.firstDue, everyMonths: payment.installments.everyMonths, note: what, coversBalance: true, registeredOn: doc.date, invoiceId });
        store.run("UPDATE invoices SET plan_id = ? WHERE id = ?", planId, invoiceId);
        touched.plans.add(planId);
      }
      // Satıştan iade: müşterinin borcu düştü; taksitlendirilmiş borç kalandan büyük kalmasın (kart küçülür).
      if (doc.kind === "sale_return" && plans()?.trimCovers) for (const plan of plans().trimCovers(doc.account.id, user, what)) touched.plans.add(plan.id);
      audit(user, id ? "invoice.issued" : "invoice.created", invoiceId, { kind: doc.kind, number, accountId: doc.account.id, payable: c2(money.payable), currency: doc.currency, date: doc.date, originalId: doc.original?.id || "", payment: { cash: payment.cash.length, cheques: payment.cheques.length, endorse: payment.endorse.length, mode: payment.mode } });
      return { id: invoiceId, number };
    });
    publishAll(user, touched, result.id);
    return result;
  }
  function publishAll(user, touched, invoiceId) {
    publish(user, { kind: "invoices", invoiceId });
    for (const accountId of touched.accounts) publish(user, { kind: "accounts", accountId });
    for (const itemId of touched.items) publish(user, { kind: "stock", itemId });
    if (touched.cash) publish(user, { kind: "cash" });
    if (touched.cheques.chequeIds.length || touched.cheques.accountIds.length) cheques()?.invoiceCheques?.publish(user, touched.cheques);
    for (const planId of touched.plans) publish(user, { kind: "plans", planId });
  }

  function writeDraft(user, doc, { id = null } = {}) {
    const invoiceId = id || newId("invoice");
    const totals = doc.computed.totals;
    const money = doc.money;
    store.tx(() => {
      const stamp = now();
      const columns = {
        kind: doc.kind,
        scenario: doc.scenario,
        status: "draft",
        number: doc.meta.own ? "" : doc.number,
        issue_date: doc.date,
        issue_time: doc.time,
        account_id: doc.account.id,
        party_json: JSON.stringify(doc.party),
        seller_json: JSON.stringify(sellerParty(doc.settings)),
        profile: doc.profile,
        type_code: typeCode(doc.kind, doc.computed.lines),
        currency: doc.currency,
        rate: doc.rate,
        prices_include_vat: doc.pricesIncludeVat ? 1 : 0,
        discount_rate: doc.discountRate,
        stoppage_rate: doc.stoppageRate,
        base_total: c2(totals.base),
        discount_total: c2(totals.discount),
        net_total: c2(totals.net),
        goods_net: c2(totals.goodsNet),
        service_net: c2(totals.serviceNet),
        vat_total: c2(totals.vat),
        withheld_total: c2(totals.withheld),
        stoppage_total: c2(totals.stoppage),
        gross_total: c2(totals.gross),
        payable_total: c2(totals.payable),
        try_net: c2(money.net),
        try_vat: c2(money.vat),
        try_withheld: c2(money.withheld),
        try_stoppage: c2(money.stoppage),
        try_payable: c2(money.payable),
        gl_json: JSON.stringify(money.byAccount),
        payment_json: JSON.stringify(doc.paymentDraft || {}),
        original_id: doc.original?.id || "",
        order_no: doc.orderNo,
        order_date: doc.orderDate,
        despatch_no: doc.despatchNo,
        despatch_date: doc.despatchDate,
        paper_no: doc.paperNo,
        note: doc.note,
        updated_by: user.id,
        updated_at: stamp,
      };
      if (id) {
        const row = store.get("SELECT status FROM invoices WHERE id = ?", id);
        if (row?.status !== "draft") throw new HttpError(409, "Yalnız taslak fatura düzeltilir; kesilmiş fatura iptal edilir ya da iade faturası kesilir.", { code: "invoice-not-draft" });
        store.run("DELETE FROM invoice_lines WHERE invoice_id = ?", id);
        store.run(`UPDATE invoices SET ${Object.keys(columns).map(key => `${key} = ?`).join(", ")} WHERE id = ?`, ...Object.values(columns), id);
      } else {
        const all = { id: invoiceId, ...columns, ettn: doc.importUuid || randomUUID(), created_by: user.id, created_at: stamp };
        store.run(`INSERT INTO invoices (${Object.keys(all).join(", ")}) VALUES (${Object.keys(all).map(() => "?").join(", ")})`, ...Object.values(all));
      }
      doc.computed.lines.forEach((line, index) => {
        const input = doc.lines[index];
        store.run(
          `INSERT INTO invoice_lines (id, invoice_id, seq, item_id, goods, code, name, description, unit, qty, unit_price, discount_rate, base, discount, net, vat_rate, vat, withholding_code, withholding_num,
             withholding_den, withheld, exemption_code, gross, payable, gl_account, expense_code, unit_cost, origin_line_id, move_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '')`,
          newId("iline"), invoiceId, index + 1, input.itemId, input.goods ? 1 : 0, input.code, input.name, input.description, input.unit, line.qty, line.unitPrice, line.discountRate, c2(line.base), c2(line.discount), c2(line.net),
          line.vatRate, c2(line.vat), line.withholdingCode, line.withholdingNum, line.withholdingDen, c2(line.withheld), line.exemptionCode, c2(line.gross), c2(line.payable), input.account, input.expenseCode, input.originLineId,
        );
      });
      audit(user, id ? "invoice.draft.updated" : "invoice.draft.created", invoiceId, { kind: doc.kind, accountId: doc.account.id, payable: c2(money.payable) });
    });
    publish(user, { kind: "invoices", invoiceId });
    return invoiceId;
  }

  // ---------- İptal ----------
  // dryRun: bütün engeller ve yazımlar denenir, sonra geri alınır (e-Arşiv iptali entegratöre gitmeden önce programda
  // iptalin yapılabildiği kesinleşsin diye).
  const DRY_RUN = Symbol("dry-run");
  function cancel(user, id, { reason = "", force = {}, confirmExternal = false, dryRun = false } = {}) {
    const touched = { accounts: new Set(), items: new Set(), cash: false, cheques: { accountIds: [], chequeIds: [] }, plans: new Set() };
    let row;
    try {
      row = runCancel();
    } catch (error) {
      if (error === DRY_RUN) return null;
      throw error;
    }
    publishAll(user, touched, row.id);
    return row;
    function runCancel() {
      return store.tx(() => {
      const invoice = invoiceRow(id);
      if (invoice.status === "draft") throw new HttpError(409, "Taslak iptal edilmez; silinir.", { code: "invoice-draft" });
      if (invoice.status === "cancelled") throw new HttpError(409, "Bu fatura zaten iptal edilmiş.", { code: "invoice-cancelled" });
      period?.assertOpen(invoice.issueDate, "Bu fatura");
      const returns = store.get("SELECT COUNT(*) AS n FROM invoices WHERE original_id = ? AND status = 'issued'", invoice.id).n;
      if (returns) throw new HttpError(409, `Bu faturanın ${returns} iade faturası var; önce iade faturalarını iptal edin.`, { code: "invoice-has-returns" });
      if (["sent", "accepted"].includes(invoice.eStatus) && !confirmExternal) throw new HttpError(409, `Bu belge ${E_STATES[invoice.eStatus].toLocaleLowerCase("tr-TR")}. Önce GİB / entegratör tarafında iptal edin (e-Arşiv iptali ya da e-Fatura iade/itiraz), sonra burada onaylayın.`, { code: "einvoice-sent" });
      touched.accounts.add(invoice.accountId);
      for (const planId of plans()?.removeForInvoice ? plans().removeForInvoice(user, invoice.id) : []) touched.plans.add(planId);
      if (cheques()?.invoiceCheques) {
        const voided = cheques().invoiceCheques.voidFor(user, invoice.id);
        touched.cheques = voided;
        for (const accountId of voided.accountIds) touched.accounts.add(accountId);
      }
      // Kasa: iptal edilen peşin tahsilat Kasa'dan düşer (eksiye düşürüyorsa sorulur).
      for (const entry of store.all("SELECT kind, amount, method, date FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out')", invoice.id)) {
        cash?.guardChange?.({ kind: entry.kind, amount: entry.amount, method: entry.method, date: entry.date }, null, force.cash === true);
        touched.cash = true;
      }
      for (const itemId of stock()?.invoiceStock ? stock().invoiceStock.removeFor(invoice.id, { force: force.stock === true }) : []) touched.items.add(itemId);
      accounts().invoiceEntry.removeFor(invoice.id);
      // İade iptali: asıl faturanın taksit kartı iadeyle küçüldüyse geri büyür (müşteri borcu yine taksitlerde izlenir).
      if (invoice.kind === "sale_return" && invoice.originalId && plans()?.growForInvoice) {
        const original = store.get("SELECT plan_id AS planId, payment_json AS paymentJson FROM invoices WHERE id = ?", invoice.originalId);
        const rest = Number(parseJson(original?.paymentJson, {}).rest) || 0;
        const grown = original?.planId ? plans().growForInvoice(user, original.planId, invoice.tryPayable, rest, `İade iptali ${invoice.number}`) : null;
        if (grown) touched.plans.add(grown.id);
      }
      const stamp = now();
      store.run("UPDATE invoices SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?, cancel_reason = ?, updated_by = ?, updated_at = ? WHERE id = ?", user.id, stamp, limited(reason, 300, "İptal nedeni"), user.id, stamp, invoice.id);
      audit(user, "invoice.cancelled", invoice.id, { number: invoice.number, kind: invoice.kind, payable: invoice.tryPayable, reason });
      if (dryRun) throw DRY_RUN;
      return invoice;
      });
    }
  }

  // ---------- Son fiyatlar ----------
  // Ürün (ya da stoksuz kalemde ad) + cari: bu cariye son satış / bu cariden son alış ve başka carilere son satış / alış.
  // Fiyat karşılaştırılabilir olsun diye iskontolu, KDV hariç TL birim fiyat (ve KDV dahil karşılığı) verilir.
  function lastPrices({ itemId = "", name = "", accountId = "" }) {
    if (!itemId && !name) return { thisParty: {}, others: { sale: [], purchase: [] } };
    const rows = store.all(
      `SELECT l.qty, l.net, l.unit_price AS unitPrice, l.discount_rate AS discountRate, l.vat_rate AS vatRate, l.unit, i.kind, i.currency, i.rate, i.prices_include_vat AS includeVat,
              i.issue_date AS date, i.number, i.account_id AS accountId, COALESCE(a.name, '') AS accountName
       FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id AND i.status = 'issued' AND i.kind IN ('sale', 'purchase', 'smm') LEFT JOIN accounts a ON a.id = i.account_id
       WHERE ${itemId ? "l.item_id = ?" : "l.item_id = '' AND l.name = ? COLLATE NOCASE"}
       ORDER BY i.issue_date DESC, i.issue_time DESC, i.created_at DESC LIMIT 400`,
      itemId || name,
    );
    const shapeRow = row => {
      const net = roundMoney((row.net * (row.rate || 1)) / row.qty);
      return { side: row.kind === "purchase" ? "purchase" : "sale", date: row.date, number: row.number, accountId: row.accountId, accountName: row.accountName, qty: row.qty, unit: row.unit, unitNet: net, unitGross: roundMoney(net * (1 + row.vatRate / 100)), vatRate: row.vatRate, entered: row.unitPrice, discountRate: row.discountRate, currency: row.currency, includeVat: Boolean(row.includeVat) };
    };
    const shaped = rows.map(shapeRow);
    const thisParty = {
      sale: shaped.find(row => row.side === "sale" && row.accountId === accountId) || null,
      purchase: shaped.find(row => row.side === "purchase" && row.accountId === accountId) || null,
    };
    const others = { sale: [], purchase: [] };
    for (const side of ["sale", "purchase"]) {
      const seen = new Set();
      for (const row of shaped) {
        if (row.side !== side || row.accountId === accountId || seen.has(row.accountId)) continue;
        seen.add(row.accountId);
        others[side].push(row);
        if (others[side].length >= 3) break;
      }
    }
    // Stok kartından: son alış (maliyet) ve satış fiyatı; stok modülünden (faturasız) yapılan son satış/alış.
    let card = null;
    if (itemId) {
      const item = store.get("SELECT name, unit, unit_price AS unitPrice, sale_price AS salePrice, kind FROM stock_items WHERE id = ?", itemId);
      const move = side => store.get(`SELECT m.date, m.unit_price AS unitPrice, COALESCE(a.name, '') AS accountName FROM stock_moves m LEFT JOIN accounts a ON a.id = m.account_id WHERE m.item_id = ? AND m.invoice_id = '' AND m.pay <> 'none' AND m.kind = ? AND m.reason = '' ORDER BY m.date DESC, m.created_at DESC LIMIT 1`, itemId, side);
      const available = stock()?.invoiceStock && item?.kind !== "service" ? stock().invoiceStock.available(itemId) : null;
      card = item ? { unitCost: item.unitPrice, salePrice: item.salePrice, unit: item.unit, available, lastStockSale: move("out") || null, lastStockPurchase: move("in") || null } : null;
    }
    return { thisParty, others, card };
  }

  // ---------- İade arama ----------
  function returnable({ side = "sale", q = "", accountId = "" }) {
    const kind = side === "purchase" ? "purchase" : "sale";
    const needle = String(q || "").toLocaleLowerCase("tr-TR").trim();
    const rows = store.all(`${INVOICE_SQL} WHERE i.kind = ? AND i.status = 'issued'${accountId ? " AND i.account_id = ?" : ""} ORDER BY i.issue_date DESC, i.issue_time DESC LIMIT 2000`, kind, ...(accountId ? [accountId] : []));
    const out = [];
    for (const row of rows) {
      const party = parseJson(row.partyJson, {});
      const lines = linesOf(row.id);
      if (needle) {
        const hay = `${row.number} ${party.name || row.accountName} ${row.accountTaxNo} ${lines.map(line => `${line.name} ${line.code}`).join(" ")}`.toLocaleLowerCase("tr-TR");
        if (!hay.includes(needle)) continue;
      }
      const returned = returnedQty(lines.map(line => line.id));
      const left = lines.map(line => ({ id: line.id, name: line.name, unit: line.unit, qty: line.qty, left: Math.max(0, Math.round((line.qty - (returned.get(line.id) || 0)) * 1000) / 1000) }));
      if (!left.some(line => line.left > 0)) continue;
      out.push({ id: row.id, number: row.number, issueDate: row.issueDate, accountId: row.accountId, accountName: party.name || row.accountName, tryPayable: row.tryPayable, currency: row.currency, payableTotal: row.payableTotal, lines: left });
      if (out.length >= 50) break;
    }
    return out;
  }

  // ---------- Yollar ----------
  const requireView = req => auth.requirePermission(req, "invoices.view");
  const requireManage = req => auth.requirePermission(req, "invoices.manage");
  const forceOf = body => ({ stock: body?.force === true || body?.stockForce === true, cash: body?.cashForce === true });

  router.get("/api/workspace/invoices/meta", async ({ req, res }) => {
    const user = requireView(req);
    const s = settings();
    ok(res, {
      kinds: Object.fromEntries(Object.entries(INVOICE_KINDS).map(([key, value]) => [key, { label: value.label, short: value.short, side: value.side, return: value.return, own: value.own }])),
      scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([key, value]) => [key, { ...value, side: INVOICE_KINDS[value.kind].side }])),
      profiles: PROFILES,
      vatRates: VAT_RATES,
      withholding: Object.entries(WITHHOLDING).map(([code, value]) => ({ code, label: value.label, num: value.num, den: value.den })),
      exemptions: Object.entries(EXEMPTIONS).map(([code, label]) => ({ code, label })),
      expenses: Object.entries(EXPENSES).map(([code, value]) => ({ code, label: value.label, account: value.account })),
      currencies: Object.entries(CURRENCIES).map(([code, value]) => ({ code, label: value.label, symbol: value.symbol })),
      methods: METHODS,
      payStates: PAY_STATES,
      eStates: E_STATES,
      adapters: edocEnabled ? Object.entries(ADAPTERS).map(([id, value]) => adapterInfo(id, value)) : [],
      edocEnabled,
      settings: { efatura: edocEnabled && s.efatura, earsiv: edocEnabled && s.earsiv, esmm: edocEnabled && s.esmm, defaults: s.defaults, series: s.series, sellerReady: sellerProblems("KAGIT", s).length === 0 && Boolean(s.seller.name), sellerName: s.seller.name, integrator: edocEnabled ? integratorSummary(s) : null },
      today: today(),
      lockedUntil: period?.lockedUntil?.() || "",
      canManage: canUser(user, "invoices.manage"),
      canSettings: canUser(user, "invoices.settings"),
      canCheques: canUser(user, "cheques.manage"),
      canPlans: canUser(user, "plans.manage"),
    });
  });
  router.get("/api/workspace/invoices/settings", async ({ req, res }) => {
    requireView(req);
    const s = settings();
    ok(res, { ...publicSettings(s), edocEnabled, problems: { KAGIT: sellerProblems("KAGIT", s), EARSIVFATURA: sellerProblems("EARSIVFATURA", s), TEMELFATURA: sellerProblems("TEMELFATURA", s) } });
  });
  router.put("/api/workspace/invoices/settings", async ({ req, res }) => {
    const user = auth.requirePermission(req, "invoices.settings");
    const body = await readJson(req);
    const previous = settings();
    const next = settingsInput(body, previous);
    store.tx(() => {
      store.setSetting(SETTINGS_KEY, JSON.stringify(next), user.id);
      // Günlüğe parola yazılmaz; yalnız değişip değişmediği.
      const integratorLog = { id: next.integrator.id, env: next.integrator.env, username: next.integrator.username, passwordChanged: next.integrator.passwordSealed !== previous.integrator.passwordSealed, autoSend: next.integrator.autoSend };
      audit(user, "invoice.settings.updated", "settings", { efatura: next.efatura, earsiv: next.earsiv, series: next.series, integrator: integratorLog });
    });
    publish(user, { kind: "invoices", settings: true });
    ok(res, { ...publicSettings(next), edocEnabled, problems: { KAGIT: sellerProblems("KAGIT", next), EARSIVFATURA: sellerProblems("EARSIVFATURA", next), TEMELFATURA: sellerProblems("TEMELFATURA", next) } });
  });
  router.get("/api/workspace/invoices", async ({ req, res, url }) => {
    const user = requireView(req);
    const data = list(user, listQuery(url.searchParams));
    const limit = Math.min(5000, Math.max(1, Math.trunc(Number(url.searchParams.get("limit")) || 200)));
    const offset = Math.max(0, Math.trunc(Number(url.searchParams.get("offset")) || 0));
    ok(res, { ...data, invoices: data.invoices.slice(offset, offset + limit), total: data.invoices.length, offset, limit, hasMore: offset + limit < data.invoices.length });
  });
  // Kalem için ürün/hizmet araması (fatura yetkisiyle; stok ekranı yetkisi gerekmez): ad, kod; mevcut miktar, son alış
  // (maliyet) ve satış fiyatı.
  router.get("/api/workspace/invoices/items", async ({ req, res, url }) => {
    requireView(req);
    const needle = String(url.searchParams.get("q") || "").toLocaleLowerCase("tr-TR").trim().slice(0, 120);
    const rows = store.all("SELECT id, kind, code, name, unit, unit_price AS unitPrice, sale_price AS salePrice FROM stock_items WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE");
    const hits = [];
    for (const row of rows) {
      if (needle && !`${row.name} ${row.code}`.toLocaleLowerCase("tr-TR").includes(needle)) continue;
      const service = row.kind === "service";
      hits.push({ ...row, kind: row.kind || "product", unit: unitLabel(row.unit), available: service || !stock()?.invoiceStock ? null : stock().invoiceStock.available(row.id) });
      if (hits.length >= 25) break;
    }
    ok(res, { items: hits });
  });
  router.get("/api/workspace/invoices/returnable", async ({ req, res, url }) => {
    requireView(req);
    ok(res, { invoices: returnable({ side: text(url.searchParams.get("side")), q: text(url.searchParams.get("q")).slice(0, 120), accountId: text(url.searchParams.get("account")).slice(0, 120) }) });
  });
  router.get("/api/workspace/invoices/last-prices", async ({ req, res, url }) => {
    requireView(req);
    ok(res, lastPrices({ itemId: text(url.searchParams.get("item")).slice(0, 120), name: text(url.searchParams.get("name")).slice(0, 200), accountId: text(url.searchParams.get("account")).slice(0, 120) }));
  });
  router.get("/api/workspace/invoices/portfolio", async ({ req, res }) => {
    requireView(req);
    ok(res, { cheques: cheques()?.invoiceCheques ? cheques().invoiceCheques.portfolio() : [] });
  });
  // Ön hesap (kaydetmeden): ekranda görülen toplam deftere yazılanla aynı motordan.
  router.post("/api/workspace/invoices/calc", async ({ req, res }) => {
    requireView(req);
    const body = await readJson(req, { limit: 2_000_000 });
    const doc = documentInput(body, { mode: "draft" });
    const t = doc.computed.totals;
    ok(res, {
      kind: doc.kind,
      profile: doc.profile,
      profileLabel: PROFILES[doc.profile],
      profiles: allowedProfiles(doc.kind, doc.account, doc.settings).map(id => ({ id, label: PROFILES[id] })),
      typeCode: typeCode(doc.kind, doc.computed.lines),
      currency: doc.currency,
      rate: doc.rate,
      stoppageRate: doc.stoppageRate,
      lines: doc.computed.lines.map((line, index) => ({ net: c2(line.net), vat: c2(line.vat), withheld: c2(line.withheld), gross: c2(line.gross), payable: c2(line.payable), discount: c2(line.discount), base: c2(line.base), goods: doc.lines[index].goods, account: doc.lines[index].account, originLineId: doc.lines[index].originLineId })),
      totals: { base: c2(t.base), discount: c2(t.discount), net: c2(t.net), vat: c2(t.vat), withheld: c2(t.withheld), stoppage: c2(t.stoppage), gross: c2(t.gross), payable: c2(t.payable), goodsNet: c2(t.goodsNet), serviceNet: c2(t.serviceNet), byRate: t.byRate.map(item => ({ rate: item.rate, net: c2(item.net), vat: c2(item.vat) })), byWithholding: t.byWithholding.map(item => ({ code: item.code, num: item.num, den: item.den, vat: c2(item.vat), withheld: c2(item.withheld) })) },
      try: { net: c2(doc.money.net), vat: c2(doc.money.vat), withheld: c2(doc.money.withheld), stoppage: c2(doc.money.stoppage), payable: c2(doc.money.payable) },
      amountInWords: amountInWords(c2(t.payable), doc.currency),
      party: doc.party,
      partyProblems: doc.profile === "KAGIT" ? [] : partyProblems(doc.party, { profile: doc.profile === "EARSIVFATURA" || doc.profile === "ESMM" ? "EARSIV" : "EFATURA", role: "buyer" }),
      sellerProblems: doc.profile === "KAGIT" || !doc.meta.own ? [] : sellerProblems(doc.profile, doc.settings),
      dueDays: Number(doc.account.dueDays) || Number(doc.settings.defaults.dueDays) || 0,
      nextNumber: doc.meta.own ? nextNumber(seriesFor(doc.kind, doc.profile, doc.settings), Number(doc.date.slice(0, 4)), doc.settings).number : "",
    });
  });
  router.get("/api/workspace/invoices/gross-from-net", async ({ req, res, url }) => {
    requireView(req);
    ok(res, { gross: grossFromNet(parseAmount(url.searchParams.get("net")), Number(url.searchParams.get("rate") ?? STOPPAGE_DEFAULT)) });
  });
  router.post("/api/workspace/invoices", async ({ req, res }) => {
    const user = requireManage(req);
    const body = await readJson(req, { limit: 2_000_000 });
    if (body.status === "draft") {
      const doc = documentInput(body, { mode: "draft" });
      doc.paymentDraft = body.payment && typeof body.payment === "object" ? body.payment : {};
      const id = writeDraft(user, doc);
      return ok(res, detail(id, user));
    }
    const doc = documentInput(body, { mode: "issue" });
    const payment = paymentInput(body, doc, user);
    const result = writeIssued(user, doc, payment, { force: forceOf(body) });
    const autoSend = await maybeAutoSend(user, result.id);
    ok(res, { ...detail(result.id, user), ...(autoSend ? { autoSend } : {}) });
  });
  router.put("/api/workspace/invoices/:id", async ({ req, res, params }) => {
    const user = requireManage(req);
    const existing = invoiceRow(params.id);
    if (existing.status !== "draft") throw new HttpError(409, "Yalnız taslak fatura düzeltilir; kesilmiş fatura iptal edilir ya da iade faturası kesilir.", { code: "invoice-not-draft" });
    const body = await readJson(req, { limit: 2_000_000 });
    const doc = documentInput(body, { mode: "draft", existing });
    doc.paymentDraft = body.payment && typeof body.payment === "object" ? body.payment : parseJson(existing.paymentJson, {});
    writeDraft(user, doc, { id: existing.id });
    ok(res, detail(existing.id, user));
  });
  router.post("/api/workspace/invoices/:id/issue", async ({ req, res, params }) => {
    const user = requireManage(req);
    const existing = invoiceRow(params.id);
    if (existing.status !== "draft") throw new HttpError(409, "Bu fatura zaten kesilmiş.", { code: "invoice-not-draft" });
    const body = await readJson(req, { limit: 2_000_000 });
    const lines = linesOf(existing.id).map(line => ({ itemId: line.itemId, name: line.name, code: line.code, description: line.description, unit: line.unit, qty: line.qty, unitPrice: line.unitPrice, discountRate: line.discountRate, vatRate: line.vatRate, withholdingCode: line.withholdingCode, exemptionCode: line.exemptionCode, expenseCode: line.expenseCode, originLineId: line.originLineId }));
    const merged = { kind: existing.kind, scenario: existing.scenario, accountId: existing.accountId, originalId: existing.originalId, lines, buyer: parseJson(existing.partyJson, {}), payment: parseJson(existing.paymentJson, {}), ...body };
    const doc = documentInput(merged, { mode: "issue", existing });
    const payment = paymentInput(merged, doc, user);
    writeIssued(user, doc, payment, { id: existing.id, force: forceOf(body) });
    const autoSend = await maybeAutoSend(user, existing.id);
    ok(res, { ...detail(existing.id, user), ...(autoSend ? { autoSend } : {}) });
  });
  router.delete("/api/workspace/invoices/:id", async ({ req, res, params }) => {
    const user = requireManage(req);
    const existing = invoiceRow(params.id);
    if (existing.status !== "draft") throw new HttpError(409, "Kesilmiş fatura silinmez (yasal belge); iptal edin.", { code: "invoice-not-draft" });
    store.tx(() => {
      store.run("DELETE FROM invoice_lines WHERE invoice_id = ?", existing.id);
      store.run("DELETE FROM invoices WHERE id = ? AND status = 'draft'", existing.id);
      // Gelen e-Faturadan açılan taslak silinirse belge yeniden "Yeni" olur (tekrar alınabilir).
      store.run("UPDATE einvoice_inbox SET state = 'new', invoice_id = '', updated_at = ? WHERE invoice_id = ?", now(), existing.id);
      audit(user, "invoice.draft.deleted", existing.id, { kind: existing.kind, accountId: existing.accountId, payable: existing.payableTotal });
    });
    publish(user, { kind: "invoices", invoiceId: existing.id });
    ok(res, { id: existing.id });
  });
  router.post("/api/workspace/invoices/:id/cancel", async ({ req, res, params }) => {
    const user = requireManage(req);
    const body = await readJson(req);
    const options = { reason: text(body.reason), force: forceOf(body), confirmExternal: body.confirmExternal === true };
    const existing = invoiceRow(params.id);
    // e-Arşiv: entegratörde de iptal edilir (EDM: taslak, hatalı ya da başarıyla oluşturulmuş e-Arşiv iptal edilebilir).
    // Önce programdaki iptal denenir (iade, kilitli dönem, tahsil edilmiş çek, stok…); geçerse entegratör, sonra program.
    const remote = edocEnabled && existing.status === "issued" && existing.profile === "EARSIVFATURA" && ["processing", "sent", "accepted", "error"].includes(existing.eStatus) && body.localOnly !== true;
    if (remote) {
      cancel(user, existing.id, { ...options, confirmExternal: true, dryRun: true });
      const doc = detail(existing.id, user);
      const result = await integrator().cancel({ invoice: doc });
      store.tx(() => {
        store.run("UPDATE invoices SET e_status = 'cancelled', e_message = ?, e_at = ?, updated_at = ? WHERE id = ?", String(result.message || "").slice(0, 500), now(), now(), existing.id);
        audit(user, "invoice.e.cancelled", existing.id, { number: existing.number, adapter: existing.eAdapter });
      });
      const row = cancel(user, existing.id, { ...options, confirmExternal: true });
      return ok(res, { ...detail(row.id, user), integratorResult: result });
    }
    const row = cancel(user, existing.id, options);
    ok(res, detail(row.id, user));
  });

  // ---------- Belge çıktıları ----------
  const pdfFor = (ids, user) => {
    const docs = ids.map(id => detail(id, user));
    return invoicePdf(docs, { footer: settings().defaults.footer, officeName: store.setting("office.name", "") || "" });
  };
  const safeName = value => String(value || "Fatura").replace(/[^\p{L}\p{N} _.-]+/gu, "-").slice(0, 80);
  router.get("/api/workspace/invoices/:id/fatura.pdf", async ({ req, res, params, url }) => {
    const user = requireView(req);
    const row = invoiceRow(params.id);
    const pdf = pdfFor([row.id], user);
    audit(user, "invoice.pdf", row.id, { number: row.number });
    sendBuffer(res, pdf, { type: "application/pdf", name: `${safeName(row.number || "Taslak Fatura")} ${safeName(parseJson(row.partyJson, {}).name || row.accountName)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/invoices/:id/ubl.xml", async ({ req, res, params, url }) => {
    const user = requireView(req);
    requireEdoc();
    const doc = detail(params.id, user);
    if (doc.status !== "issued") throw new HttpError(409, "Yalnız kesilmiş faturanın e-Belgesi (UBL-TR XML) üretilir.");
    const xml = buildUbl(doc, { variant: url.searchParams.get("peppol") === "1" ? "peppol" : "tr" });
    sendBuffer(res, Buffer.from(xml, "utf8"), { type: "application/xml; charset=utf-8", name: ublFileName(doc, url.searchParams.get("peppol") === "1"), inline: false });
  });
  // ---------- e-Belge: gönder, durum, mükellef, bağlantı ----------
  const sending = new Set();
  const setE = (user, id, { status, adapter = null, message = "" }, action, extra = {}) => {
    store.tx(() => {
      if (adapter) store.run("UPDATE invoices SET e_status = ?, e_adapter = ?, e_message = ?, e_at = ?, updated_at = ? WHERE id = ?", status, adapter, String(message || "").slice(0, 500), now(), now(), id);
      else store.run("UPDATE invoices SET e_status = ?, e_message = ?, e_at = ?, updated_at = ? WHERE id = ?", status, String(message || "").slice(0, 500), now(), now(), id);
      audit(user, action, id, { status, ...extra });
    });
    publish(user, { kind: "invoices", invoiceId: id });
  };
  async function sendInvoice(user, id) {
    requireEdoc();
    const doc = detail(id, user);
    if (!doc.canSend) {
      if (doc.profile === "KAGIT") throw new HttpError(409, "Kâğıt belge / müşteri fişi e-Belge olarak gönderilmez.", { code: "einvoice-paper" });
      if (doc.status !== "issued") throw new HttpError(409, "Yalnız kesilmiş fatura gönderilir.", { code: "einvoice-not-issued" });
      if (!E_SENDABLE.has(doc.eStatus || "none")) throw new HttpError(409, `Bu belge zaten entegratöre iletildi (durum: ${E_STATES[doc.eStatus] || doc.eStatus}). Sonucu Durum Sorgula ile alın.`, { code: "einvoice-already-sent" });
      throw new HttpError(409, "Bu belge gönderilemez.", { code: "einvoice-not-sendable" });
    }
    const s = settings();
    const seller = sellerProblems(doc.profile, s);
    if (seller.length) throw new HttpError(409, `Firma bilgisi eksik (Fatura Ayarları): ${seller.join(" ")}`, { code: "seller-incomplete", problems: seller });
    const buyer = partyProblems(doc.party, { profile: doc.profile === "EARSIVFATURA" || doc.profile === "ESMM" ? "EARSIV" : "EFATURA", role: "buyer" });
    if (buyer.length) throw new HttpError(409, `Alıcı bilgisi eksik: ${buyer.join(" ")}`, { code: "buyer-incomplete", problems: buyer });
    if (sending.has(doc.id)) throw new HttpError(409, "Bu belge şu anda gönderiliyor; birkaç saniye bekleyin.", { code: "einvoice-sending" });
    sending.add(doc.id);
    try {
      const link = integrator(s);
      const xml = buildUbl(doc, { variant: "tr" });
      let result;
      try {
        result = await link.send({ invoice: doc, xml });
      } catch (error) {
        // Entegratör reddettiyse belge gitmemiştir: "Hata" işlenir, düzeltilip yeniden gönderilir. Bağlantı koptuysa
        // sonuç belirsizdir: durum değişmez (aynı ETTN ikinci kez kabul edilmez; önce Durum Sorgula).
        const code = error?.extra?.code || error?.code || "";
        const rejected = ["integrator-rejected", "integrator-contract", "integrator-alias"].includes(code);
        setE(user, doc.id, { status: rejected ? "error" : doc.eStatus || "none", adapter: link.id, message: error?.message || String(error) }, "invoice.e.send-failed", { adapter: link.id, code });
        throw error;
      }
      setE(user, doc.id, { status: result.status, adapter: link.id, message: result.message }, "invoice.e.sent", { adapter: link.id, reference: result.reference });
      return result;
    } finally {
      sending.delete(doc.id);
    }
  }
  async function maybeAutoSend(user, id) {
    if (!edocEnabled) return null;
    const s = settings();
    if (!s.integrator.autoSend) return null;
    const doc = detail(id, user);
    if (!doc.canSend) return null;
    try {
      return { ok: true, ...(await sendInvoice(user, id)) };
    } catch (error) {
      return { ok: false, message: error?.message || String(error) };
    }
  }
  router.post("/api/workspace/invoices/:id/send", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const result = await sendInvoice(user, invoiceRow(params.id).id);
    ok(res, { ...detail(params.id, user), sendResult: result });
  });
  router.post("/api/workspace/invoices/:id/e-refresh", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const doc = detail(invoiceRow(params.id).id, user);
    if (!doc.canRefresh) throw new HttpError(409, doc.profile === "KAGIT" ? "Kâğıt belgenin e-Belge durumu olmaz." : "Bu belge henüz entegratöre gönderilmedi.", { code: "einvoice-not-sent" });
    const result = await integrator().status({ invoice: doc });
    setE(user, doc.id, { status: result.status, message: result.message }, "invoice.e.status", { raw: result.raw || "" });
    const hint = result.status === "rejected" && doc.status === "issued" ? "Alıcı faturayı reddetti: faturayı programda İptal edin (stok, cari ve kasa etkileri geri alınır), gerekirse yeniden kesin." : "";
    ok(res, { ...detail(doc.id, user), statusResult: { ...result, hint } });
  });
  router.post("/api/workspace/invoices/integrator/test", async ({ req, res }) => {
    const user = auth.requirePermission(req, "invoices.settings");
    requireEdoc();
    const s = settings();
    const result = await integrator(s).test();
    audit(user, "invoice.integrator.tested", "settings", { id: s.integrator.id, env: s.integrator.env, contract: result.contract?.source || "" });
    ok(res, result);
  });
  // Mükellef sorgusu: VKN/TCKN GİB e-Fatura kullanıcısı mı, posta kutusu etiketi ne? Cari verilirse kartına yazılır.
  router.post("/api/workspace/invoices/check-user", async ({ req, res }) => {
    const user = requireManage(req);
    requireEdoc();
    const body = await readJson(req);
    const taxNo = String(body.taxNo || "").replace(/\s+/g, "");
    const id = classifyTaxId(taxNo);
    if (!id.ok) fail400("Geçerli bir VKN (10 hane) ya da TC kimlik numarası (11 hane) yazın.", "taxNo");
    const result = await integrator().checkUser(taxNo);
    let accountId = "";
    if (text(body.accountId)) accountId = accounts().taxIdentity.setEInvoice(user, text(body.accountId), { registered: result.registered, alias: result.aliases[0] || "", title: result.title }).id;
    ok(res, { ...result, taxNo, accountId });
  });
  // Entegratör portalına elle yüklenen belgenin durumu (Dosya adaptörü): kullanıcı GİB/entegratördeki sonucu işler.
  router.post("/api/workspace/invoices/:id/e-status", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const body = await readJson(req);
    const status = text(body.status);
    if (!["sent", "accepted", "rejected", "exported"].includes(status)) fail400("Durum gönderildi, kabul edildi, reddedildi ya da XML hazır olabilir.", "status");
    const row = invoiceRow(params.id);
    if (row.status !== "issued") throw new HttpError(409, "Yalnız kesilmiş faturanın e-Belge durumu işlenir.");
    store.tx(() => {
      store.run("UPDATE invoices SET e_status = ?, e_message = ?, e_at = ?, updated_at = ? WHERE id = ?", status, limited(body.message, 500, "Açıklama"), now(), now(), row.id);
      audit(user, "invoice.e.status", row.id, { status });
    });
    publish(user, { kind: "invoices", invoiceId: row.id });
    ok(res, detail(row.id, user));
  });
  const idsOf = url => text(url.searchParams.get("ids")).split(",").map(value => value.trim()).filter(Boolean).slice(0, 500);
  router.get("/api/workspace/invoices/toplu.pdf", async ({ req, res, url }) => {
    const user = requireView(req);
    const ids = idsOf(url);
    if (!ids.length) fail400("Yazdırılacak faturaları seçin.", "ids");
    const pdf = pdfFor(ids.map(id => invoiceRow(id).id), user);
    audit(user, "invoice.pdf.bulk", "bulk", { count: ids.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Faturalar (${ids.length}).pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/invoices/ubl.zip", async ({ req, res, url }) => {
    const user = requireView(req);
    requireEdoc();
    const ids = idsOf(url);
    if (!ids.length) fail400("XML'i alınacak faturaları seçin.", "ids");
    const entries = [];
    for (const id of ids) {
      const doc = detail(id, user);
      if (doc.status !== "issued" || doc.profile === "KAGIT" || !INVOICE_KINDS[doc.kind].send) continue;
      entries.push({ name: ublFileName(doc, false), data: Buffer.from(buildUbl(doc, { variant: "tr" }), "utf8") });
    }
    if (!entries.length) fail400("Seçilenler arasında e-Belge olarak gönderilecek kesilmiş fatura yok (kâğıt fatura, taslak, iptal ve alış faturası XML'e girmez).", "ids");
    audit(user, "invoice.ubl.bulk", "bulk", { count: entries.length });
    sendBuffer(res, createZip(entries), { type: "application/zip", name: `e-Belgeler (${entries.length}).zip`, inline: false });
  });
  router.get("/api/workspace/invoices/export.xlsx", async ({ req, res, url }) => {
    const user = requireView(req);
    const data = list(user, listQuery(url.searchParams));
    const money = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
    const columns = ["Tarih", "Saat", "Fatura No", "Tür", "Senaryo", "Durum", "Cari", "Profil", "Para Birimi", "Kur", "Matrah (TL)", "KDV (TL)", "Ödenecek (TL)", "Ödenen (TL)", "Kalan (TL)", "Ödeme Durumu", "Vade", "Not"];
    const rows = data.invoices.map(row => ({
      Tarih: dayText(row.issueDate),
      Saat: row.issueTime,
      "Fatura No": row.displayNo,
      Tür: row.kindLabel,
      Senaryo: row.scenarioLabel,
      Durum: row.statusLabel,
      Cari: row.accountName,
      Profil: row.profileLabel,
      "Para Birimi": row.currency,
      Kur: row.rate,
      "Matrah (TL)": money(row.tryNet),
      "KDV (TL)": money(row.tryVat),
      "Ödenecek (TL)": money(row.tryPayable),
      "Ödenen (TL)": money(row.paid),
      "Kalan (TL)": money(row.open),
      "Ödeme Durumu": row.payStateLabel,
      Vade: dayText(row.dueDate),
      Not: row.note,
    }));
    const lineRows = [];
    for (const row of data.invoices.slice(0, 5000)) {
      for (const line of linesOf(row.id)) lineRows.push({ "Fatura No": row.displayNo, Tarih: dayText(row.issueDate), Cari: row.accountName, Kod: line.code, Kalem: line.name, Miktar: String(line.qty).replace(".", ","), Birim: line.unit, "Birim Fiyat": money(line.unitPrice), "İskonto %": line.discountRate, Matrah: money(line.net), "KDV %": line.vatRate, KDV: money(line.vat), Tevkifat: money(line.withheld), Toplam: money(line.payable) });
    }
    const buffer = buildXlsx([
      { name: "Faturalar", columns, rows },
      { name: "Kalemler", columns: ["Fatura No", "Tarih", "Cari", "Kod", "Kalem", "Miktar", "Birim", "Birim Fiyat", "İskonto %", "Matrah", "KDV %", "KDV", "Tevkifat", "Toplam"], rows: lineRows },
    ], { title: "Faturalar" });
    audit(user, "invoice.exported", "xlsx", { count: rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "Faturalar.xlsx", inline: false });
  });
  router.get("/api/workspace/invoices/liste.pdf", async ({ req, res, url }) => {
    const user = requireView(req);
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const pdf = tablePdf({
      title: "Fatura Listesi",
      subtitle: [query.from || query.to ? `${query.from ? dayText(query.from) : "…"} – ${query.to ? dayText(query.to) : "…"}` : "Tüm tarihler", `${data.invoices.length} belge`].join(" · "),
      headers: ["Tarih", "Fatura No", "Tür", "Cari", "Durum", "Matrah", "KDV", "Ödenecek", "Kalan"],
      types: ["", "", "", "", "", "money", "money", "money", "money"],
      rows: data.invoices.slice(0, 20_000).map(row => [dayText(row.issueDate), row.displayNo, row.kindLabel, row.accountName, row.payStateLabel || row.statusLabel, tl(row.tryNet), tl(row.tryVat), tl(row.tryPayable), tl(row.open)]),
      summary: [["Satış", tl(data.totals.sale)], ["Alış", tl(data.totals.purchase)], ["KDV", tl(data.totals.vat)], ["Açık", tl(data.totals.open)]],
      officeName: store.setting("office.name", "") || "",
      userName: user.display_name || user.username || "",
    });
    sendBuffer(res, pdf, { type: "application/pdf", name: "Fatura Listesi.pdf", inline: url.searchParams.get("download") !== "1" });
  });

  // Tek belge (sabit yollardan sonra: router kayıt sırasıyla eşler).
  // ---------- Gelen e-Faturalar (entegratörün gelen kutusu) ----------
  // Çekilen belgeler einvoice_inbox'a yazılır (ETTN tekil: aynı belge iki kez gelmez), entegratörde "okundu" işaretlenir.
  // "Alış Faturası Olarak Al" belgeden alış faturası TASLAĞI açar: satıcı VKN/TCKN ile cari bulunur ya da vergi
  // bilgileriyle açılır (kişi bir kez girilir), kalemler stok kartına kod ya da adla eşlenir; kullanıcı ödemeyi seçip keser.
  const INBOX_SQL = `SELECT b.id, b.uuid, b.number, b.sender_vkn AS senderVkn, b.sender_name AS senderName, b.issue_date AS issueDate, b.payable, b.currency, b.profile, b.type_code AS typeCode,
      b.status, b.state, b.invoice_id AS invoiceId, b.fetched_at AS fetchedAt, COALESCE(i.number, '') AS invoiceNumber, COALESCE(i.status, '') AS invoiceStatus
    FROM einvoice_inbox b LEFT JOIN invoices i ON i.id = b.invoice_id`;
  const INBOX_STATES = Object.freeze({ new: "Yeni", imported: "Alındı", ignored: "Yok Sayıldı" });
  const inboxShape = row => {
    const accountId = accounts()?.taxIdentity ? accounts().taxIdentity.findByTaxNo(row.senderVkn) : "";
    const twin = accountId && row.number ? store.get("SELECT id, number FROM invoices WHERE account_id = ? AND kind = 'purchase' AND number = ? AND status = 'issued' AND id <> ?", accountId, row.number, row.invoiceId || "") : null;
    return { ...row, stateLabel: INBOX_STATES[row.state] || row.state, accountId, duplicateId: twin?.id || "", duplicateNumber: twin?.number || "" };
  };
  const inboxRow = id => {
    const row = store.get(`${INBOX_SQL} WHERE b.id = ?`, text(id));
    if (!row) throw new HttpError(404, "Gelen belge bulunamadı.", { code: "inbox-not-found" });
    return row;
  };
  const matchItem = line => {
    const code = String(line.code || "").trim();
    const byCode = code ? store.get("SELECT id, name, code FROM stock_items WHERE deleted_at IS NULL AND code <> '' AND code = ? COLLATE NOCASE ORDER BY created_at LIMIT 1", code) : null;
    return byCode || store.get("SELECT id, name, code FROM stock_items WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE ORDER BY created_at LIMIT 1", String(line.name || "").trim()) || null;
  };
  function inboxPreview(row, xml) {
    const parsed = readUbl(xml);
    const s = settings();
    const ours = String(s.seller.taxNo || "");
    return {
      parsed,
      addressedToOther: Boolean(ours && parsed.customer.taxNo && parsed.customer.taxNo !== ours),
      lines: parsed.lines.map(line => {
        const item = matchItem(line);
        return { ...line, itemId: item?.id || "", itemName: item?.name || "" };
      }),
    };
  }
  router.get("/api/workspace/invoices/inbox", async ({ req, res, url }) => {
    requireView(req);
    requireEdoc();
    const state = text(url.searchParams.get("state"));
    const rows = store.all(`${INBOX_SQL}${INBOX_STATES[state] ? " WHERE b.state = ?" : ""} ORDER BY b.issue_date DESC, b.fetched_at DESC LIMIT 1000`, ...(INBOX_STATES[state] ? [state] : []));
    const counts = Object.fromEntries(store.all("SELECT state, COUNT(*) AS n FROM einvoice_inbox GROUP BY state").map(item => [item.state, item.n]));
    ok(res, { items: rows.map(inboxShape), counts, states: INBOX_STATES });
  });
  router.post("/api/workspace/invoices/inbox/fetch", async ({ req, res }) => {
    const user = requireManage(req);
    requireEdoc();
    const body = await readJson(req);
    const to = validDate(body.to) ? body.to : today();
    const from = validDate(body.from) ? body.from : isoDay(new Date(Date.parse(`${to}T00:00:00Z`) - 30 * 86_400_000));
    if (from > to) fail400("Başlangıç tarihi bitişten sonra olamaz.", "from");
    const link = integrator();
    const list = await link.inbox({ from, to, limit: 100 });
    let added = 0;
    let known = 0;
    const stamp = now();
    store.tx(() => {
      for (const item of list) {
        if (!item.uuid) continue;
        if (store.get("SELECT 1 FROM einvoice_inbox WHERE uuid = ?", item.uuid)) {
          known += 1;
          continue;
        }
        store.run(
          "INSERT INTO einvoice_inbox (id, uuid, number, sender_vkn, sender_name, issue_date, payable, currency, profile, type_code, status, xml, state, fetched_by, fetched_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)",
          newId("inb"), item.uuid, String(item.number || "").slice(0, 40), String(item.senderVkn || "").slice(0, 11), String(item.senderName || "").slice(0, 200), String(item.issueDate || "").slice(0, 10), roundMoney(item.payable),
          String(item.currency || "TRY").slice(0, 3), String(item.profile || "").slice(0, 40), String(item.typeCode || "").slice(0, 40), String(item.status || "").slice(0, 300), String(item.xml || ""), user.id, stamp, stamp,
        );
        added += 1;
      }
      audit(user, "invoice.inbox.fetched", "inbox", { from, to, received: list.length, added, known });
    });
    // Kaydedilenler entegratörde okundu işaretlenir; işaret konamasa da belge kaybolmaz (bir sonraki çekişte "zaten var").
    let marked = true;
    try {
      await link.markRead(list.map(item => item.uuid).filter(Boolean));
    } catch {
      marked = false;
    }
    publish(user, { kind: "invoices", inbox: true });
    ok(res, { from, to, received: list.length, added, known, marked });
  });
  router.get("/api/workspace/invoices/inbox/:id", async ({ req, res, params }) => {
    requireView(req);
    requireEdoc();
    const row = inboxRow(params.id);
    const xml = store.get("SELECT xml FROM einvoice_inbox WHERE id = ?", row.id).xml;
    let preview = null;
    let readError = "";
    try {
      preview = inboxPreview(row, xml);
    } catch (error) {
      readError = `Belge okunamadı: ${error?.message || error}`;
    }
    ok(res, { ...inboxShape(row), preview, readError });
  });
  router.get("/api/workspace/invoices/inbox/:id/belge.xml", async ({ req, res, params }) => {
    requireView(req);
    requireEdoc();
    const row = inboxRow(params.id);
    const xml = store.get("SELECT xml FROM einvoice_inbox WHERE id = ?", row.id).xml;
    sendBuffer(res, Buffer.from(xml, "utf8"), { type: "application/xml; charset=utf-8", name: `${safeName(row.number || row.uuid)}.xml`, inline: false });
  });
  router.post("/api/workspace/invoices/inbox/:id/import", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const row = inboxRow(params.id);
    if (row.state === "imported" && row.invoiceId) throw new HttpError(409, `Bu belge ${row.invoiceNumber ? `${row.invoiceNumber} numarasıyla ` : ""}zaten alındı.`, { code: "inbox-imported", invoiceId: row.invoiceId });
    const xml = store.get("SELECT xml FROM einvoice_inbox WHERE id = ?", row.id).xml;
    let preview;
    try {
      preview = inboxPreview(row, xml);
    } catch (error) {
      throw new HttpError(422, `Belge okunamadı: ${error?.message || error}`, { code: "inbox-unreadable" });
    }
    const { parsed } = preview;
    if (!classifyTaxId(parsed.supplier.taxNo).ok) throw new HttpError(422, "Belgedeki satıcının VKN/TCKN'si geçersiz; alış faturasını elle girin.", { code: "inbox-supplier" });
    if (!preview.lines.length) throw new HttpError(422, "Belgede kalem yok.", { code: "inbox-empty" });
    const body = await readJson(req);
    let accountId = accounts().taxIdentity.findByTaxNo(parsed.supplier.taxNo);
    const accountCreated = !accountId;
    let draftId = "";
    store.tx(() => {
      if (!accountId) accountId = accounts().taxIdentity.createForParty(user, parsed.supplier, "supplier");
      const goods = preview.lines.some(line => line.itemId);
      const input = {
        kind: "purchase",
        scenario: goods ? "goods_purchase" : "expense_purchase",
        accountId,
        number: parsed.number,
        issueDate: parsed.issueDate,
        issueTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.issueTime) ? parsed.issueTime : "00:00",
        currency: CURRENCIES[parsed.currency] ? parsed.currency : "TRY",
        rate: parsed.rate || 1,
        pricesIncludeVat: false,
        orderNo: parsed.orderNo,
        despatchNo: parsed.despatchNo,
        note: [`e-Fatura ETTN ${parsed.uuid}`, ...parsed.notes].join(" · ").slice(0, 1000),
        lines: preview.lines.map(line => ({ itemId: line.itemId, name: line.name, code: line.code, description: line.description, unit: line.unit, qty: line.qty, unitPrice: line.unitPrice, discountRate: line.discountRate, vatRate: line.vatRate, withholdingCode: line.withholdingCode, exemptionCode: line.exemptionCode, expenseCode: line.itemId ? "" : text(body.expenseCode) || "other" })),
        status: "draft",
      };
      let doc;
      try {
        doc = documentInput(input, { mode: "draft" });
      } catch (error) {
        throw new HttpError(422, `Belge alış faturasına çevrilemedi: ${error?.message || error}`, { code: "inbox-convert", field: error?.extra?.field || "" });
      }
      doc.paymentDraft = { rest: "open" };
      doc.importUuid = parsed.uuid && !store.get("SELECT 1 FROM invoices WHERE ettn = ?", parsed.uuid) ? parsed.uuid : "";
      draftId = writeDraft(user, doc);
      store.run("UPDATE einvoice_inbox SET state = 'imported', invoice_id = ?, updated_at = ? WHERE id = ?", draftId, now(), row.id);
      audit(user, "invoice.inbox.imported", row.id, { uuid: row.uuid, draftId, accountId, accountCreated });
    });
    const draft = detail(draftId, user);
    const difference = roundMoney(draft.payableTotal - (parsed.totals.payable || 0));
    publish(user, { kind: "invoices", inbox: true, invoiceId: draftId });
    ok(res, {
      draft,
      accountCreated,
      unmatched: preview.lines.filter(line => !line.itemId).map(line => line.name),
      difference,
      warning: Math.abs(difference) >= 0.01 ? `Programın hesapladığı toplam (${moneyText(draft.payableTotal, draft.currency)}) belgedekinden (${moneyText(parsed.totals.payable, draft.currency)}) farklı; kalemleri kontrol edip kesin.` : "",
    });
  });
  router.post("/api/workspace/invoices/inbox/:id/state", async ({ req, res, params }) => {
    const user = requireManage(req);
    requireEdoc();
    const row = inboxRow(params.id);
    const body = await readJson(req);
    const state = text(body.state);
    if (!["new", "ignored"].includes(state)) fail400("Durum Yeni ya da Yok Sayıldı olabilir.", "state");
    if (row.state === "imported") throw new HttpError(409, "Alış faturası olarak alınmış belge yok sayılamaz; önce taslağı silin ya da faturayı iptal edin.", { code: "inbox-imported" });
    store.tx(() => {
      store.run("UPDATE einvoice_inbox SET state = ?, updated_at = ? WHERE id = ?", state, now(), row.id);
      audit(user, "invoice.inbox.state", row.id, { state });
    });
    publish(user, { kind: "invoices", inbox: true });
    ok(res, inboxShape(inboxRow(row.id)));
  });

  router.get("/api/workspace/invoices/:id", async ({ req, res, params }) => {
    const user = requireView(req);
    ok(res, detail(params.id, user));
  });

  // ---------- Diğer modüller için ----------
  // Kasa: faturanın peşin tahsilat ve ödemeleri (cari satırı, source = 'invoice'). İptal edilen faturanınki silinmiştir.
  const cashSource = { table: "account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL JOIN invoices i ON i.id = e.source_id", where: "e.source = 'invoice' AND e.kind IN ('in', 'out')", kind: "e.kind", amount: "e.amount", date: "e.date", method: "e.method" };
  const cashEntries = (after = "") =>
    store
      .all(
        `SELECT e.id, e.kind, e.method, e.amount, e.date, e.note, e.account_id AS accountId, a.name AS accountName, i.id AS invoiceId, i.number, i.kind AS invoiceKind,
                e.created_by AS actorId, COALESCE(u.display_name, '') AS actorName, e.created_at AS createdAt, e.updated_at AS updatedAt
         FROM ${cashSource.table} LEFT JOIN users u ON u.id = e.created_by WHERE ${cashSource.where}${after ? ` AND ${cashSource.date} > ?` : ""}`,
        ...(after ? [after] : []),
      )
      .map(({ note, number, invoiceKind, ...row }) => ({ ...row, source: "invoice", description: `${INVOICE_KINDS[invoiceKind]?.short || "Fatura"} ${number} · ${row.kind === "in" ? "tahsilat" : "ödeme"} · ${row.accountName}` }));
  // Vade takip ve nakit akışı: açık (kısmen ödenmiş dahil) vadeli faturalar. Taksitli olanlar taksit kartından gelir.
  function openItems(day = today()) {
    const rows = store.all(`${INVOICE_SQL} WHERE i.status = 'issued' AND i.kind IN ('sale', 'smm', 'purchase') AND i.plan_id = ''`);
    const states = paymentStates(rows);
    return rows
      .map(row => ({ row, state: states.get(row.id) }))
      .filter(({ state }) => state && state.open > 0.005)
      .map(({ row, state }) => ({ id: row.id, number: row.number, kind: row.kind, side: INVOICE_KINDS[row.kind].side, accountId: row.accountId, accountName: parseJson(row.partyJson, {}).name || row.accountName, phone: row.accountPhone, dueDate: row.dueDate || row.issueDate, issueDate: row.issueDate, payable: row.tryPayable, open: state.open, state: state.state, days: Math.round((Date.parse(`${row.dueDate || row.issueDate}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000) }));
  }
  // Tahsilat takvimi ve sağ alt bildirimler: vadesi geçen, bugün ve 7 gün içinde vadesi gelen açık faturalar.
  function dueItems(day = today()) {
    return openItems(day)
      .filter(item => item.days <= 7)
      .map(item => ({
        id: `invoice|${item.id}`,
        source: "invoice",
        invoiceId: item.id,
        direction: item.side === "sale" ? "in" : "out",
        person: item.accountName,
        caseNo: "",
        caseKey: "",
        tab: "",
        label: `${item.side === "sale" ? "Tahsil Edilecek" : "Ödenecek"} Fatura ${item.number}`,
        kind: "date",
        dueDate: item.dueDate,
        dueText: dayText(item.dueDate),
        amount: item.open,
        partial: item.open < item.payable - 0.005,
        days: item.days,
        state: item.days === 0 ? "today" : item.days < 0 ? "overdue" : "upcoming",
      }));
  }
  const fingerprint = () => {
    const row = store.get("SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') AS f FROM invoices");
    // Kapama (ödenen/kalan) cari hareketlerine de bağlıdır: tahsilat girilince açık fatura kapanır.
    const entries = store.get("SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(updated_at, created_at)), '') AS f FROM account_entries");
    return `${row.f}|${entries.f}`;
  };
  const countForAccount = accountId => store.get("SELECT COUNT(*) AS n FROM invoices WHERE account_id = ? AND status <> 'cancelled'", accountId).n;
  return { cashEntries, cashSource, openItems, dueItems, fingerprint, countForAccount, list, detail, settings, paymentStates, lastPrices, returnable, cancel };
}
