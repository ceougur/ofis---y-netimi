// Cari (v2.0.6): Operasyon Merkezi'ndeki müşteri/tedarikçi kartları. Her sektöre uyar (öğrenci, veli, sakin, hasta,
// müşteri, firma); fatura ve KDV yoktur. Cari merkezdedir: taksit kartları bir cariye aittir (plans.account_id) ve
// carinin defterinde görünür. Hareketler: borç yaz, alacak yaz, tahsilat (Kasa'ya giriş), ödeme (Kasa'dan çıkış).
// Excel'den toplu alım: bilinen kolonlar (ad, telefon, adres, kayıt tarihi, grup…) alanlara, kalan her kolon kartta
// aynı adla "ek alan" olur; taksit sorulmaz. Toplu taksitlendirme: seçilen carilere tek seferde taksit kartı.
// Hesap kuralı server/lib/accounts.mjs içinde (saf, testli); burada doğrulama, kayıt ve yetki vardır.
import { createHash, randomUUID } from "node:crypto";
import { methodInput } from "../lib/pay-method.mjs";
import { doubtfulSkipOf } from "../lib/doubtful-gl.mjs";
import { negativeConfirmed } from "../lib/bank/module-ref.mjs";
import { posMetaOf } from "../lib/bank/pos.mjs";
import { ACCOUNT_TYPES, TYPE_DEFAULT, accountLedger, accountTypeKey, balanceSide, classifyAccountType, isAccountType, mapAccountHeaders } from "../lib/accounts.mjs";
import { HttpError, limited, ok, readJson, sendBuffer, text } from "../lib/http.mjs";
import { matrixText, parseAmount, roundMoney } from "../lib/money.mjs";
import { canUser } from "../lib/permissions.mjs";
import { receiptPdf } from "../lib/plan-report.mjs";
import { dayText, isoDay, parseDay } from "../lib/plans.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { readSheetMatrices } from "../lib/sheets.mjs";
import { DUE_WINDOW } from "../lib/insight/dues.mjs";
import { inferRolesByValues, findHeaderRow, sanitizeCell, validateRows } from "../lib/import-gate.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";
import { ANONYMOUS_TCKN, RETAIL_NAME, classifyTaxId, isRetailName, isValidIban, isValidMersis, normalizeIban } from "../lib/tax-id.mjs";
import { systemClock } from "../lib/clock.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => DATE.test(value) && !Number.isNaN(new Date(value).getTime());
// 2.4.5 madde 6: Vade Tarihi / Beklenen Ödeme Tarihi takvimde gerçek gün olmalı (2026-02-30 gibi kayan gün reddedilir).
const realDay = value => DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
// Tek seferde en çok bu kadar satır (100 bin cari ~ 7 sn); fazlası raporda "kesildi" olarak bildirilir.
const MAX_IMPORT = 250_000;
const MAX_FIELDS = 60;
const EPS = 0.005;
const KIND_TEXT = { debt: "Borç", credit: "Alacak", in: "Tahsilat", out: "Ödeme" };
// Türkçe sıralama: Intl.Collator, localeCompare'den kat kat hızlıdır (200 bin caride saniyeler yerine yüz ms).
const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });

const MONEY_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function registerAccountRoutes(router, { store, bank, auth, audit, events, trash, config = {}, dataset = null, cash = null, period = null, plans = () => null, cheques = () => null, invoices = () => null, bankModule = () => null, doubtful = () => null, now: clock = systemClock }) {
  const invoiceModule = () => (typeof invoices === "function" ? invoices() : invoices) || null;
  // İş saati (v2.1.0): context.now (config.now); sahte saatli testlerde de tek kaynak.
  const now = () => clock().toISOString();
  const today = () => isoDay(clock());
  const newId = prefix => `${prefix}-${randomUUID()}`;
  const office = () => store.setting("office.name", "");
  const currentSource = () => (dataset?.currentKey ? dataset.currentKey() : "");
  const changed = (user, detail = {}) => events?.publish("workspace.changed", { kind: "accounts", actorId: user.id, actorName: user.display_name, ...detail }, { except: user.id });
  const touched = (user, account, extra = {}) => {
    changed(user, { accountId: account.id, ...extra });
    if (account.caseKey) changed(user, { kind: "activity", caseKey: account.caseKey, datasetKey: account.caseSource || "" });
  };
  const amountOf = (value, label = "Tutar") => {
    const amount = parseAmount(value);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) throw new HttpError(400, `${label} geçerli bir sayı olmalı.`);
    return roundMoney(amount);
  };
  const dateOf = (value, label = "Tarih", fallback = "") => {
    const date = text(value) || fallback;
    if (!validDate(date)) throw new HttpError(400, `${label} için geçerli bir tarih seçin.`);
    return date;
  };
  const digits = value => String(value || "").replace(/\D/g, "");
  // 2.4.5 madde 6 (BAŞ MİMAR KARARI K6.1): Vade Tarihi (dueDate) ve Beklenen Ödeme Tarihi (expectedDate) yalnız elle girilen Borç / Alacak kaydında ve
  // Açılış Bakiyesi'nde (kaynağı boş, tür debt / credit). Tahsilat / ödeme ve faturadan, stoktan, çekten, şüpheli alacaktan gelen satır alan taşımaz.
  const DUE_KINDS = new Set(["debt", "credit"]);
  const isManualDue = entry => !entry.source && DUE_KINDS.has(entry.kind);
  const dueDateOf = (value, label, field) => {
    const day = text(value);
    if (!day) return "";
    if (!realDay(day)) throw new HttpError(400, `${label} için geçerli bir tarih seçin.`, { code: "due-date-invalid", field });
    return day;
  };
  // Biçim YYYY-MM-DD, boş = yok; ikisi de kaydın tarihinden ÖNCE olamaz (400, field). Gövdede anahtar yoksa önceki değer kalır (düzeltme); tür borç /
  // alacak değilse ikisi de boştur (gönderilse de kaydedilmez). Beklenen Ödeme Tarihi Vade Tarihi'nden önce olabilir (müşteri erken ödeme sözü verir).
  function dueInput(body, { kind, date, previous = null, fields = { due: "dueDate", expected: "expectedDate" }, what = "kaydın" }) {
    if (!DUE_KINDS.has(kind)) return { dueDate: "", expectedDate: "" };
    const pick = (key, keep) => (body && Object.hasOwn(body, key) && body[key] !== undefined && body[key] !== null ? body[key] : previous?.[keep] ?? "");
    const dueDate = dueDateOf(pick(fields.due, "dueDate"), "Vade Tarihi", fields.due);
    const expectedDate = dueDateOf(pick(fields.expected, "expectedDate"), "Beklenen Ödeme Tarihi", fields.expected);
    if (dueDate && dueDate < date) throw new HttpError(400, `Vade Tarihi (${dayText(dueDate)}) ${what} tarihinden (${dayText(date)}) önce olamaz.`, { code: "due-date-before", field: fields.due });
    if (expectedDate && expectedDate < date) throw new HttpError(400, `Beklenen Ödeme Tarihi (${dayText(expectedDate)}) ${what} tarihinden (${dayText(date)}) önce olamaz.`, { code: "due-date-before", field: fields.expected });
    return { dueDate, expectedDate };
  }

  // ---------- Okuma ----------
  const ACCOUNT_SQL = `SELECT a.id, a.ref_no AS refNo, a.type, a.name, a.phone, a.email, a.address, a.registered_on AS registeredOn, a.group_id AS groupId, a.subgroup_id AS subgroupId,
      a.note, a.fields_json AS fieldsJson, a.case_key AS caseKey, a.case_source AS caseSource, a.case_title AS caseTitle, a.status,
      a.tax_no AS taxNo, a.tax_office AS taxOffice, a.mersis_no AS mersisNo, a.trade_registry AS tradeRegistry, a.party_kind AS partyKind, a.first_name AS firstName, a.family_name AS familyName,
      a.city, a.district, a.postal_code AS postalCode, a.country, a.website, a.iban, a.due_days AS dueDays, a.e_invoice AS eInvoice, a.e_alias AS eAlias, a.e_profile AS eProfile,
      a.created_by AS createdBy, a.created_at AS createdAt, a.updated_at AS updatedAt, COALESCE(u.display_name, '') AS actorName,
      COALESCE(g.name, '') AS groupName, COALESCE(s.name, '') AS subgroupName
    FROM accounts a LEFT JOIN users u ON u.id = a.created_by LEFT JOIN plan_groups g ON g.id = a.group_id LEFT JOIN plan_groups s ON s.id = a.subgroup_id`;
  const parseFields = json => {
    try {
      const value = JSON.parse(json || "[]");
      return Array.isArray(value) ? value.filter(item => item && typeof item.label === "string").map(item => ({ label: item.label, value: String(item.value ?? "") })) : [];
    } catch {
      return [];
    }
  };
  const withFields = row => {
    const { fieldsJson, ...rest } = row;
    return { ...rest, fields: parseFields(fieldsJson) };
  };
  const accountRow = id => {
    const row = store.get(`${ACCOUNT_SQL} WHERE a.id = ? AND a.deleted_at IS NULL`, limited(id, 120, "Cari"));
    if (!row) throw new HttpError(404, "Cari bulunamadı. Silinmiş olabilir.");
    return withFields(row);
  };
  const exists = id => Boolean(id && store.get("SELECT 1 AS found FROM accounts WHERE id = ? AND deleted_at IS NULL", id));
  const entriesOf = accountId =>
    store.all(
      `SELECT e.id, e.kind, e.amount, e.date, e.note, e.method, e.receipt_no AS receiptNo, e.source, e.source_id AS sourceId, e.invoice_id AS invoiceId, e.fin_ref AS finRef, e.created_by AS createdBy, e.created_at AS createdAt, e.updated_at AS updatedAt,
              e.doubtful_skip AS doubtfulSkip, e.due_date AS dueDate, e.expected_date AS expectedDate, COALESCE(u.display_name, '') AS actorName
       FROM account_entries e LEFT JOIN users u ON u.id = e.created_by WHERE e.account_id = ? ORDER BY e.date, e.created_at, e.rowid`,
      accountId,
    );

  // withRemaining (2.4.5 madde 6): false → borç kayıtlarının Kalan'ı hesaplanmaz (fatura kapaması yalnız defteri ister; aynı kapama iki kez koşmasın).
  function detail(id, user, { withRemaining = true } = {}) {
    const account = accountRow(id);
    const manage = canUser(user, "accounts.manage");
    // Stok ve çek/senetten gelen satırlar (v2.0.6, v2.0.7) kendi kartlarından düzeltilir.
    // 2.3.0 (İz 3.2): giriş + kart + kart hesabına bağlı satır "Kredi Kartına İade"dir (ekran düzeltme formunu kart seçicisiyle açar; POS alanı değil).
    let cardIds = new Set();
    try {
      cardIds = new Set(store.all("SELECT id FROM bank_accounts WHERE kind = 'card'").map(row => row.id));
    } catch {
      cardIds = new Set(); // banka tabloları yoksa (göç öncesi veri)
    }
    // Karar 15.10.2026 (plan §3.11b/2): doubtfulSkip = kullanıcı işareti ("Normal Cari Hesaba İşle"); doubtfulNormal = satırın şüpheliden
    // düşmediği (işaret, fatura peşini ya da Kapatılacak Fatura bağı; lib/doubtful-gl.mjs doubtfulSkipOf) — ekranda "Normal Cariye İşlendi";
    // yalnız şüpheli kaydı olan caride (yoksa her peşin satırı etiketlenirdi).
    const doubtfulSummary = doubtful()?.summary ? doubtful().summary(account.id) : null;
    const hasDoubtful = Boolean(doubtfulSummary && doubtfulSummary.count > 0);
    const entries = entriesOf(account.id).map(entry => ({ ...entry, doubtfulSkip: Number(entry.doubtfulSkip) === 1, doubtfulNormal: hasDoubtful && doubtfulSkipOf(entry), editable: entry.source === "" && (manage || (entry.createdBy === user.id && entry.kind === "in")), ...(entry.kind === "in" && entry.method === "card" && cardIds.has(entry.finRef) ? { cardRefund: true } : {}) }));
    const planList = plans()?.forAccount ? plans().forAccount(account.id, user) : [];
    const ledger = accountLedger(entries, planList);
    // 2.4.5 madde 6 (BAŞ MİMAR KARARI K6.2): elle Borç / Alacak ve Açılış Bakiyesi satırının Kalan'ı (TL, kuruşa yuvarlı) — fatura kapamasıyla aynı
    // kuyruktan (routes/invoices.mjs entryStates → lib/invoice-settle.mjs settleLedger). Kalan > 0 olan satır açıktır; Vade Tarihi sırayı değiştirmez.
    const remaining = withRemaining && invoiceModule()?.entryStates ? invoiceModule().entryStates(account.id, ledger.lines) : null;
    if (remaining) for (const entry of entries) if (isManualDue(entry)) entry.remaining = remaining.get(entry.id)?.remaining ?? roundMoney(Number(entry.amount) || 0);
    return {
      ...account,
      typeLabel: ACCOUNT_TYPES[account.type] || "",
      entries,
      plans: planList.map(plan => ({ id: plan.id, name: plan.name, refNo: plan.refNo, status: plan.status, state: plan.state, totals: plan.totals, next: plan.next, itemCount: plan.itemCount, registeredOn: plan.registeredOn, total: plan.total, coversBalance: Boolean(plan.coversBalance) })),
      ledger: ledger.lines,
      totals: ledger.totals,
      side: balanceSide(ledger.totals.balance),
      canManage: manage,
      canCollect: canUser(user, "accounts.collect"),
      // 2.3.0 İz 1 (plan §3.11b/5 "cari kartında Şüpheli Alacak bilgisi"): açık şüpheli, karşılık, tahsil edilen, değersiz yazılan (kuruş).
      doubtful: doubtfulSummary,
      canDoubtful: manage && canUser(user, "accounts.doubtful"),
      // 2.4.3 (keşif A5): silinemeyen caride Sil pasif, nedeni kartta yazılı (silme ucuyla aynı denetim).
      deleteBlock: manage ? deleteBlock(account)?.message || "" : "",
      // 2.4.5 madde 6: Açılış Bakiyesi satırı (Düzenle formundaki açılış Vade Tarihi / Beklenen Ödeme Tarihi; PUT openingDueDate / openingExpectedDate).
      openingEntryId: openingEntryOf(account.id)?.id || "",
    };
  }

  // Liste: hareket toplamları tek sorguda, taksit özetleri tek geçişte (5 bin caride de hızlı).
  const SORTS = new Set(["no", "name", "balance", "registered", "overdue"]);
  const listQuery = params => ({
    q: text(params.get("q")).slice(0, 120),
    group: text(params.get("group")),
    subgroup: text(params.get("subgroup")),
    type: isAccountType(text(params.get("type"))) ? text(params.get("type")) : "",
    status: ["active", "passive", "all"].includes(text(params.get("status"))) ? text(params.get("status")) : "active",
    balance: ["debtor", "creditor", "zero", "nonzero", "overdue", "all"].includes(text(params.get("balance"))) ? text(params.get("balance")) : "all",
    sort: SORTS.has(text(params.get("sort"))) ? text(params.get("sort")) : "no",
    // Taksit durumu (v2.0.11, Taksitler › Cari Seç): "none" açık taksit kartı olmayanlar, "has" olanlar.
    plan: ["none", "has"].includes(text(params.get("plan"))) ? text(params.get("plan")) : "",
  });
  const refCompare = (a, b) => {
    const x = String(a.refNo || "");
    const y = String(b.refNo || "");
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    return collator.compare(x, y);
  };
  const withExtra = item => {
    const { fieldsJson, ...rest } = item;
    return { ...rest, extra: parseFields(fieldsJson).slice(0, 3) };
  };
  // Arama ve kart süzgeci (listede ve seçici aramasında AYNI kural): durum, tür, grup, alt grup ve arama metni (ad, not, adres, grup, ek
  // alanlar; telefon ve VKN/TCKN rakamla; Cari No tam). Bakiyeye bakmaz.
  const searchOf = q => {
    const needle = String(q || "").toLocaleLowerCase("tr-TR").trim();
    return { needle, numbers: needle.replace(/\D/g, "") };
  };
  function rowMatches(row, { status, type, group, subgroup }, { needle, numbers }) {
    if (status !== "all" && row.status !== status) return false;
    if (type && row.type !== type) return false;
    if (group && row.groupId !== group) return false;
    if (subgroup && row.subgroupId !== subgroup) return false;
    if (needle) {
      // Ek alanlar ham JSON metninde aranır (200 bin caride her satırı ayrıştırmadan); ad, not, adres, grup ayrıca.
      const hay = `${row.name} ${row.note} ${row.address} ${row.city} ${row.district} ${row.taxOffice} ${row.email} ${row.groupName} ${row.subgroupName} ${row.caseTitle} ${row.fieldsJson}`.toLocaleLowerCase("tr-TR");
      // v2.0.15: VKN/TCKN ile de bulunur (faturada cari çoğu zaman vergi numarasıyla aranır).
      const phoneHit = numbers.length >= 3 && (digits(row.phone).includes(numbers) || (numbers.length >= 5 && String(row.taxNo || "").includes(numbers)));
      const refHit = String(row.refNo || "").toLocaleLowerCase("tr-TR") === needle;
      if (!hay.includes(needle) && !phoneHit && !refHit) return false;
    }
    return true;
  }
  // ids (v2.1.0, §3.11 mutabakat kapısı): yalnız bu carilerin satırları ve bakiyeleri (kapı dokunulan carileri denetler); hesap her
  // cari için aynıdır.
  function list(user, { q = "", group = "", subgroup = "", type = "", status = "active", balance = "all", sort = "no", plan = "", ids = null } = {}) {
    const only = ids ? JSON.stringify([...ids]) : null;
    // ids: tekli + deleted_at indeksini kapatır (birincil anahtar seçilir; değer aynı).
    const rows = only ? store.all(`${ACCOUNT_SQL} WHERE +a.deleted_at IS NULL AND a.id IN (SELECT value FROM json_each(?)) ORDER BY a.name COLLATE NOCASE`, only) : store.all(`${ACCOUNT_SQL} WHERE a.deleted_at IS NULL ORDER BY a.name COLLATE NOCASE`);
    const sums = new Map();
    for (const row of only ? store.all("SELECT account_id AS accountId, kind, SUM(amount) AS amount FROM account_entries WHERE account_id IN (SELECT value FROM json_each(?)) GROUP BY account_id, kind", only) : store.all("SELECT account_id AS accountId, kind, SUM(amount) AS amount FROM account_entries GROUP BY account_id, kind")) {
      if (!sums.has(row.accountId)) sums.set(row.accountId, { debt: 0, credit: 0, in: 0, out: 0 });
      sums.get(row.accountId)[row.kind] = Number(row.amount) || 0;
    }
    const planMap = plans()?.summariesByAccount ? plans().summariesByAccount(ids) : new Map();
    // 2.3.0 İz 1.6 (plan §3.11b/5): cari başına açık şüpheli alacak (TL) — listede "Şüpheli" rozeti, ANLIK DURUM alacak toplamında ayrı satır.
    // Şüpheli hiç kullanılmamışsa tek sorgu, boş (lib/bank/doubtful.mjs doubtfulOpenByAccount).
    const doubtfulMap = doubtful()?.openByAccount ? doubtful().openByAccount().byAccount : new Map();
    const search = searchOf(q);
    const totals = { count: 0, debtor: 0, creditor: 0, debtorCount: 0, creditorCount: 0, balance: 0, overdue: 0, overdueCount: 0, planRemaining: 0, doubtful: 0, doubtfulCount: 0 };
    const labels = new Set();
    const out = [];
    for (const row of rows) {
      if (!rowMatches(row, { status, type, group, subgroup }, search)) continue;
      // Ek alanlar sayfaya girerken ayrıştırılır (200 bin satırda hepsini ayrıştırmak boşuna); etiketler ham metinden.
      if (row.fieldsJson && row.fieldsJson !== "[]") for (const match of row.fieldsJson.matchAll(/"label":"((?:[^"\\]|\\.)*)"/g)) labels.add(JSON.parse(`"${match[1]}"`));
      const sum = sums.get(row.id) || { debt: 0, credit: 0, in: 0, out: 0 };
      const accountPlans = planMap.get(row.id) || [];
      let planDebit = 0;
      let planCredit = 0;
      let overdue = 0;
      let overdueCount = 0;
      let planRemaining = 0;
      let next = null;
      for (const plan of accountPlans) {
        const total = roundMoney(Number(plan.total) || 0);
        const paid = roundMoney(Number(plan.totals.paid) || 0);
        planDebit += plan.coversBalance ? 0 : total;
        planCredit += plan.status === "closed" ? Math.max(total, paid) : paid;
        if (plan.status !== "closed") {
          planRemaining += Math.max(0, total - paid);
          overdue += plan.totals.overdue || 0;
          overdueCount += plan.totals.overdueCount || 0;
          if (plan.next && (!next || plan.next.dueDate < next.dueDate)) next = { ...plan.next, planId: plan.id };
        }
      }
      const debit = roundMoney(sum.debt + sum.out + planDebit);
      const credit = roundMoney(sum.credit + sum.in + planCredit);
      const bal = roundMoney(debit - credit);
      const side = balanceSide(bal);
      if (balance === "debtor" && side !== "debtor") continue;
      if (balance === "creditor" && side !== "creditor") continue;
      if (balance === "zero" && side !== "zero") continue;
      // "Sadece bakiyesi olanlar" (v2.0.10): borçlu ya da alacaklı; kapalı cariler gizlenir.
      if (balance === "nonzero" && side === "zero") continue;
      if (balance === "overdue" && !overdueCount) continue;
      const activePlans = accountPlans.filter(item => item.status !== "closed").length;
      if (plan === "none" && activePlans) continue;
      if (plan === "has" && !activePlans) continue;
      totals.count += 1;
      totals.balance = roundMoney(totals.balance + bal);
      if (side === "debtor") {
        totals.debtor = roundMoney(totals.debtor + bal);
        totals.debtorCount += 1;
      }
      if (side === "creditor") {
        totals.creditor = roundMoney(totals.creditor - bal);
        totals.creditorCount += 1;
      }
      totals.overdue = roundMoney(totals.overdue + overdue);
      totals.overdueCount += overdueCount;
      totals.planRemaining = roundMoney(totals.planRemaining + planRemaining);
      const doubtfulOpen = roundMoney((doubtfulMap.get(row.id)?.openMinor || 0) / 100);
      if (doubtfulOpen > 0) {
        totals.doubtful = roundMoney(totals.doubtful + doubtfulOpen);
        totals.doubtfulCount += 1;
      }
      out.push({
        id: row.id,
        refNo: row.refNo || "",
        type: row.type,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        note: row.note,
        registeredOn: row.registeredOn || "",
        groupId: row.groupId,
        subgroupId: row.subgroupId,
        groupName: row.groupName,
        subgroupName: row.subgroupName,
        caseKey: row.caseKey || "",
        caseSource: row.caseSource || "",
        caseTitle: row.caseTitle || "",
        status: row.status,
        // v2.0.15: fatura kimliği (listede VKN/TCKN ile arama, fatura ekranında cari seçimi).
        taxNo: row.taxNo || "",
        taxOffice: row.taxOffice || "",
        partyKind: row.partyKind || "",
        city: row.city || "",
        district: row.district || "",
        eInvoice: Number(row.eInvoice) === 1,
        dueDays: Number(row.dueDays) || 0,
        debit,
        credit,
        balance: bal,
        side,
        planCount: accountPlans.length,
        activePlans,
        planRemaining: roundMoney(planRemaining),
        overdue: roundMoney(overdue),
        overdueCount,
        next,
        // Açık şüpheli alacak (TL; 0 = yok). Kart bakiyesi şüpheliyi de kapsar (120 + 128 = kart).
        doubtfulOpen,
        fieldsJson: row.fieldsJson,
      });
    }
    const byName = (a, b) => collator.compare(a.name, b.name);
    const compare = {
      no: (a, b) => refCompare(a, b) || byName(a, b),
      name: byName,
      balance: (a, b) => b.balance - a.balance || byName(a, b),
      registered: (a, b) => String(b.registeredOn).localeCompare(String(a.registeredOn)) || refCompare(a, b),
      overdue: (a, b) => b.overdue - a.overdue || byName(a, b),
    }[sort];
    out.sort(compare);
    // Grup ağacı carilerin sayısıyla (taksit kartlarıyla aynı gruplar).
    const counts = new Map();
    for (const row of rows) {
      if (row.groupId) counts.set(row.groupId, (counts.get(row.groupId) || 0) + 1);
      if (row.subgroupId) counts.set(row.subgroupId, (counts.get(row.subgroupId) || 0) + 1);
    }
    // ids (kapı): grup ağacı istenmez (bütün kartları sayar; 100.000 satırda ~5 ms/yazım).
    const tree = (!only && plans()?.groupTree ? plans().groupTree() : []).map(item => ({ ...item, count: counts.get(item.id) || 0, subgroups: item.subgroups.map(sub => ({ ...sub, count: counts.get(sub.id) || 0 })) }));
    return { accounts: out, totals, sort, groups: tree, fieldLabels: [...labels].slice(0, 200), canManage: canUser(user, "accounts.manage"), canCollect: canUser(user, "accounts.collect"), canPlan: canUser(user, "plans.manage"), today: today() };
  }

  // Liste sayfa sayfa gelir (200 bin caride tek yanıt 80 MB olurdu): limit/offset; toplamlar ve sayı tüm süzgeç için.
  const pageOf = (data, key, params) => {
    const limit = Math.min(5000, Math.max(1, Math.trunc(Number(params.get("limit")) || 300)));
    const offset = Math.max(0, Math.trunc(Number(params.get("offset")) || 0));
    return { ...data, [key]: data[key].slice(offset, offset + limit).map(withExtra), total: data[key].length, offset, limit, hasMore: offset + limit < data[key].length };
  };
  router.get("/api/workspace/accounts", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    ok(res, pageOf(list(user, listQuery(url.searchParams)), "accounts", url.searchParams));
  });
  // Seçici araması (11.10.2026 hız düzeltmesi; plan §3.11 madde 5 "arama < 1 sn"): eşleşen cariler listedeki kuralla (rowMatches) ve listedeki
  // sırayla (Cari No, ad) bulunur; bakiye ve taksit özeti YALNIZ gösterilecek ilk `limit` cari için hesaplanır (list'in ids kipi — kapının
  // da kullandığı, cari başına aynı hesap). Önceden her harfte bütün carilerin hareket toplamları ve taksit özetleri kuruluyordu (100.000 para
  // satırında istek başına ~0,3 sn; çok kullanıcıda saniyeler). Sonuç aynı.
  function searchAccounts(user, { q = "", type = "", prefer = "", limit = 20 } = {}) {
    const search = searchOf(q);
    const byName = (a, b) => collator.compare(a.name, b.name);
    const matched = store.all(`${ACCOUNT_SQL} WHERE a.deleted_at IS NULL ORDER BY a.name COLLATE NOCASE`)
      .filter(row => rowMatches(row, { status: "all", type, group: "", subgroup: "" }, search))
      .map(row => ({ id: row.id, refNo: row.refNo || "", name: row.name, type: row.type }))
      .sort((a, b) => refCompare(a, b) || byName(a, b));
    // v2.0.17 (müşteri: çek cirosunda cari bulunmuyor): tür KISITI yerine "prefer" — o türdekiler üstte, bütün cariler listede
    // (müşteriye de ciro edilir: borç ödemesi, mal alımı). Ciro, tahsil/ödeme ve teminat seçicileri bunu kullanır.
    if (prefer) matched.sort((a, b) => Number(b.type === prefer) - Number(a.type === prefer));
    const top = matched.slice(0, limit);
    if (!top.length) return [];
    const byId = new Map(list(user, { q, status: "all", type, ids: top.map(item => item.id) }).accounts.map(item => [item.id, item]));
    return top.map(item => byId.get(item.id)).filter(Boolean);
  }
  // Seçici (taksit kartı formu, stok hareketi): hafif arama, en çok 20 sonuç.
  router.get("/api/workspace/accounts/search", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const prefer = isAccountType(text(url.searchParams.get("prefer"))) ? text(url.searchParams.get("prefer")) : "";
    const found = searchAccounts(user, { q: text(url.searchParams.get("q")).slice(0, 120), type: isAccountType(text(url.searchParams.get("type"))) ? text(url.searchParams.get("type")) : "", prefer });
    ok(res, found.map(withExtra).map(item => ({ id: item.id, refNo: item.refNo, name: item.name, phone: item.phone, type: item.type, registeredOn: item.registeredOn || "", groupId: item.groupId || "", subgroupId: item.subgroupId || "", groupName: item.groupName, subgroupName: item.subgroupName, balance: item.balance, status: item.status, caseKey: item.caseKey || "", caseSource: item.caseSource || "", caseTitle: item.caseTitle || "" })));
  });

  // ---------- Yazma ----------
  function fieldsInput(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const out = [];
    for (const item of value.slice(0, MAX_FIELDS)) {
      const label = String(item?.label ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
      const fieldValue = String(item?.value ?? "").trim().slice(0, 1000);
      if (!label || seen.has(label.toLocaleLowerCase("tr-TR"))) continue;
      seen.add(label.toLocaleLowerCase("tr-TR"));
      out.push({ label, value: fieldValue });
    }
    return out;
  }
  const accountInput = (body, user, previous = null) => {
    const name = limited(body.name, 160, "Ad / Unvan");
    if (!name) throw new HttpError(400, "Carinin adını ya da unvanını yazın.");
    const type = isAccountType(text(body.type)) ? text(body.type) : previous?.type || "customer";
    const caseKey = limited(body.caseKey, 200, "Kayıt");
    const caseSource = caseKey ? limited(body.caseSource, 200, "Veri oturumu") || currentSource() : "";
    const caseTitle = caseKey ? limited(body.caseTitle, 200, "Kayıt adı") : "";
    // Tablodaki kayda yeni ya da değişen bağ, açık veri oturumunda var olan kayda gitmeli (taksit kartıyla aynı kural).
    const linkChanged = caseKey !== String(previous?.caseKey || "") || caseSource !== String(previous?.caseSource || "");
    if (caseKey && linkChanged && caseSource === currentSource() && dataset?.hasRecord && !dataset.hasRecord(caseKey)) throw new HttpError(400, "Bağlanacak kayıt açık veri oturumunda bulunamadı. Tablodan seçerek bağlayın.");
    // Bir kayda tek cari bağlanır (v2.0.7): aynı kişi iki carinin defterine bölünmesin.
    if (caseKey && linkChanged) {
      const taken = store.get("SELECT name FROM accounts WHERE deleted_at IS NULL AND case_key = ? AND case_source = ? AND id <> ?", caseKey, caseSource, previous?.id || "");
      if (taken) throw new HttpError(409, `Bu kayda zaten "${taken.name}" carisi bağlı. Aynı kişiyse o cariyi kullanın.`);
    }
    const groups = plans()?.resolveGroups ? plans().resolveGroups(body, user) : { groupId: null, subgroupId: null };
    return {
      ...taxInput(body, previous),
      name,
      type,
      refNo: limited(body.refNo, 30, "Cari No"),
      phone: limited(body.phone, 60, "Telefon"),
      email: limited(body.email, 160, "E-posta"),
      address: limited(body.address, 500, "Adres"),
      note: limited(body.note, 2000, "Bilgi notu"),
      registeredOn: dateOf(body.registeredOn, "Kayıt tarihi", previous?.registeredOn || today()),
      fields: fieldsInput(body.fields ?? previous?.fields),
      status: body.status === "passive" ? "passive" : body.status === "active" ? "active" : previous?.status || "active",
      caseKey,
      caseSource,
      caseTitle,
      ...groups,
    };
  };
  // v2.0.15: carinin fatura kimliği (UBL-TR Party). Kimlik yazıldıysa geçerli olmalı; tür (tüzel/gerçek) seçilmediyse
  // kimliğin uzunluğundan çıkarılır (10 hane VKN → tüzel, 11 hane TCKN → gerçek kişi). Gerçek kişide ad ve soyad e-Belgede
  // ayrı yazılır: kartta boşsa tam addan önerilir (son sözcük soyadı). IBAN ve MERSİS biçim/denetim hanesiyle sınanır.
  // e-Fatura mükellefi işaretli caride VKN/TCKN zorunludur (e-Fatura ancak kimlikle gönderilir).
  function taxInput(body, previous = null) {
    const pick = (key, max, label) => limited(body[key] ?? previous?.[key] ?? "", max, label);
    const taxNo = String(body.taxNo ?? previous?.taxNo ?? "").replace(/\s+/g, "");
    let partyKind = ["company", "person"].includes(text(body.partyKind)) ? text(body.partyKind) : body.partyKind === "" ? "" : previous?.partyKind || "";
    if (taxNo) {
      const id = classifyTaxId(taxNo, { allowAnonymous: true });
      if (!id.ok) throw new HttpError(400, id.kind === "vkn" ? "Vergi kimlik numarası (VKN) geçersiz: denetim hanesi tutmuyor." : id.kind === "tckn" ? "TC kimlik numarası geçersiz: denetim haneleri tutmuyor." : "VKN 10, TCKN 11 haneli olmalı.", { code: "tax-id-invalid", field: "taxNo" });
      if (!partyKind) partyKind = id.kind === "vkn" ? "company" : "person";
      if (partyKind === "company" && id.kind === "tckn" && taxNo !== ANONYMOUS_TCKN) throw new HttpError(400, "Tüzel kişide (şirket) 10 haneli vergi kimlik numarası (VKN) yazılır.", { code: "tax-id-invalid", field: "taxNo" });
    }
    const mersisNo = String(body.mersisNo ?? previous?.mersisNo ?? "").replace(/\s+/g, "");
    if (mersisNo && !isValidMersis(mersisNo)) throw new HttpError(400, "MERSİS numarası 16 haneli olmalı.", { code: "mersis-invalid", field: "mersisNo" });
    const iban = normalizeIban(body.iban ?? previous?.iban ?? "");
    if (iban && !isValidIban(iban)) throw new HttpError(400, "IBAN geçersiz: TR ile başlayan 26 karakter olmalı ve denetim haneleri tutmalı.", { code: "iban-invalid", field: "iban" });
    const eInvoice = body.eInvoice === undefined ? Number(previous?.eInvoice || 0) : body.eInvoice === true || body.eInvoice === 1 || body.eInvoice === "1" || body.eInvoice === "true" ? 1 : 0;
    if (eInvoice && !taxNo) throw new HttpError(400, "e-Fatura mükellefi carinin VKN ya da TCKN'si yazılmalı.", { code: "tax-id-required", field: "taxNo" });
    const dueRaw = body.dueDays ?? previous?.dueDays ?? 0;
    const dueDays = dueRaw === "" || dueRaw === null ? 0 : Math.trunc(Number(dueRaw));
    if (!Number.isFinite(dueDays) || dueDays < 0 || dueDays > 3650) throw new HttpError(400, "Vade günü 0 ile 3650 arasında olmalı.", { code: "due-days-invalid", field: "dueDays" });
    const eProfile = ["TEMELFATURA", "TICARIFATURA"].includes(text(body.eProfile ?? previous?.eProfile)) ? text(body.eProfile ?? previous?.eProfile) : "";
    let firstName = pick("firstName", 80, "Adı");
    let familyName = pick("familyName", 80, "Soyadı");
    if (partyKind !== "person") firstName = familyName = "";
    return {
      taxNo,
      taxOffice: pick("taxOffice", 120, "Vergi Dairesi"),
      mersisNo,
      tradeRegistry: pick("tradeRegistry", 40, "Ticaret Sicil No"),
      partyKind,
      firstName,
      familyName,
      city: pick("city", 80, "İl"),
      district: pick("district", 80, "İlçe"),
      postalCode: pick("postalCode", 10, "Posta Kodu"),
      country: pick("country", 80, "Ülke"),
      website: pick("website", 200, "Web Sitesi"),
      iban,
      dueDays,
      eInvoice,
      eAlias: pick("eAlias", 160, "e-Fatura Posta Kutusu"),
      eProfile,
    };
  }
  const TAX_COLUMNS = [
    ["tax_no", "taxNo"], ["tax_office", "taxOffice"], ["mersis_no", "mersisNo"], ["trade_registry", "tradeRegistry"], ["party_kind", "partyKind"], ["first_name", "firstName"], ["family_name", "familyName"],
    ["city", "city"], ["district", "district"], ["postal_code", "postalCode"], ["country", "country"], ["website", "website"], ["iban", "iban"], ["due_days", "dueDays"], ["e_invoice", "eInvoice"], ["e_alias", "eAlias"], ["e_profile", "eProfile"],
  ];
  const writeTax = (id, input) =>
    store.run(
      `UPDATE accounts SET ${TAX_COLUMNS.map(([column]) => `${column} = ?`).join(", ")} WHERE id = ?`,
      ...TAX_COLUMNS.map(([column, key]) => (["due_days", "e_invoice"].includes(column) ? Math.trunc(Number(input[key]) || 0) : String(input[key] ?? ""))),
      id,
    );
  const nextRef = () => {
    let max = 0;
    for (const row of store.all("SELECT ref_no AS refNo FROM accounts WHERE deleted_at IS NULL")) {
      const value = Number(String(row.refNo || "").replace(",", "."));
      if (Number.isFinite(value) && value > max) max = Math.floor(value);
    }
    return String(max + 1);
  };
  // Numara başka bir caride kullanılıyorsa sıradaki numara verilir (iki carinin aynı numarası olmaz).
  const freeRef = refNo => (refNo && !store.get("SELECT 1 AS found FROM accounts WHERE deleted_at IS NULL AND ref_no = ?", refNo) ? refNo : "");
  function insertAccount(user, input) {
    const id = newId("account");
    store.run(
      "INSERT INTO accounts (id, ref_no, type, name, phone, email, address, registered_on, group_id, subgroup_id, note, fields_json, case_key, case_source, case_title, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, freeRef(input.refNo) || nextRef(), input.type || "customer", input.name, input.phone || "", input.email || "", input.address || "", input.registeredOn || today(), input.groupId || null, input.subgroupId || null, input.note || "", JSON.stringify(input.fields || []),
      input.caseKey || "", input.caseKey ? input.caseSource || currentSource() : "", input.caseKey ? input.caseTitle || "" : "", input.status || "active", user.id, now(), now(),
    );
    if (input.taxNo !== undefined) writeTax(id, input);
    return id;
  }

  // Açılış bakiyesinin yönü (v2.0.13). "auto": türe göre — müşteride artı tutar Borçlu (bize borçlu), tedarikçide artı tutar
  // Alacaklı (tedarikçiye borcumuz; tedarikçi listelerinde bakiye böyle yazılır). "debt"/"credit": kullanıcı seçer.
  // Eksi tutar her zaman ters yöndür.
  const openingKind = (amount, type, side = "auto") => {
    const natural = side === "debt" ? "debt" : side === "credit" ? "credit" : type === "supplier" ? "credit" : "debt";
    return amount > 0 ? natural : natural === "debt" ? "credit" : "debt";
  };
  const sideOf = value => (["debt", "credit"].includes(text(value)) ? text(value) : "auto");
  // 2.4.5 madde 6 (K6.1): Açılış Bakiyesi'nin vade alanları (POST / PUT /api/workspace/accounts). Açılış satırı programın yazdığı açıklamadan tanınır
  // (POST bu adla yazar; Excel'den cari yükleme de) — ilk yazılan; kullanıcı açıklamasını değiştirdiyse satır cari kartındaki Borç / Alacak düzeltmesinden.
  const OPENING_NOTE = "Açılış bakiyesi";
  const OPENING_DUE_FIELDS = Object.freeze({ due: "openingDueDate", expected: "openingExpectedDate" });
  const openingEntryOf = accountId => store.get("SELECT id, kind, date, due_date AS dueDate, expected_date AS expectedDate FROM account_entries WHERE account_id = ? AND source = '' AND kind IN ('debt', 'credit') AND note = ? ORDER BY rowid LIMIT 1", accountId, OPENING_NOTE);
  const assertNoOpeningDue = due => {
    if (due.dueDate || due.expectedDate) throw new HttpError(400, "Vade Tarihi ve Beklenen Ödeme Tarihi açılış bakiyesiyle birlikte girilir; Açılış Bakiyesi'ni yazın ya da tarihleri silin.", { code: "opening-missing", field: due.dueDate ? OPENING_DUE_FIELDS.due : OPENING_DUE_FIELDS.expected });
  };
  // Düzenle (PUT): gövdede openingDueDate / openingExpectedDate anahtarı varsa açılış satırına yazılır (bilgi alanı; tutar, tarih, yön değişmez).
  // Kapanmış dönemdeki açılışın tarihleri cari hareketi gibi kilitlidir. Dönüş: değişti mi.
  function setOpeningDue(user, accountId, body) {
    if (!body || ![OPENING_DUE_FIELDS.due, OPENING_DUE_FIELDS.expected].some(key => Object.hasOwn(body, key))) return false;
    const opening = openingEntryOf(accountId);
    if (!opening) {
      assertNoOpeningDue(dueInput(body, { kind: "debt", date: "", fields: OPENING_DUE_FIELDS }));
      return false;
    }
    const next = dueInput(body, { kind: opening.kind, date: opening.date, previous: opening, fields: OPENING_DUE_FIELDS, what: "açılış bakiyesinin" });
    if (next.dueDate === opening.dueDate && next.expectedDate === opening.expectedDate) return false;
    period?.assertOpen(opening.date, "Açılış bakiyesi");
    store.run("UPDATE account_entries SET due_date = ?, expected_date = ?, updated_by = ?, updated_at = ? WHERE id = ?", next.dueDate, next.expectedDate, user.id, now(), opening.id);
    audit(user, "account.entry.due", opening.id, { accountId, previous: { dueDate: opening.dueDate, expectedDate: opening.expectedDate }, ...next });
    return true;
  }
  router.post("/api/workspace/accounts", async ({ req, res }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const body = await readJson(req);
    const result = store.tx(() => {
      const input = accountInput(body, user);
      if (input.refNo && !freeRef(input.refNo)) throw new HttpError(409, `${input.refNo} numarası başka bir caride kullanılıyor.`);
      // Açılış bakiyesi: ör. önceki programdan devreden borç (+) ya da alacak (−).
      const opening = parseAmount(body.openingBalance);
      const hasOpening = Number.isFinite(opening) && roundMoney(Math.abs(opening)) > 0;
      const kind = hasOpening ? openingKind(opening, input.type, sideOf(body.openingSide)) : "";
      // 2.4.5 madde 6 (K6.1): Açılış Bakiyesi'nin Vade Tarihi / Beklenen Ödeme Tarihi (openingDueDate, openingExpectedDate); açılış yoksa tarih girilmez.
      const due = dueInput(body, { kind: kind || "debt", date: input.registeredOn, fields: OPENING_DUE_FIELDS, what: "açılış bakiyesinin" });
      if (!hasOpening) assertNoOpeningDue(due);
      const id = insertAccount(user, input);
      if (hasOpening) addEntry(user, id, { kind, amount: roundMoney(Math.abs(opening)), date: input.registeredOn, note: OPENING_NOTE, ...due });
      audit(user, "account.created", id, { name: input.name, type: input.type });
      return detail(id, user);
    });
    touched(user, result);
    ok(res, result);
  });
  router.put("/api/workspace/accounts/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const previous = accountRow(params.id);
    const body = await readJson(req);
    let dueChanged = false;
    const result = store.tx(() => {
      // 2.4.3 (uzman UX1): iyimser eşzamanlılık (çek: routes/cheques.mjs "cheque-stale"; tablo hücresi: workspace.mjs). Form, açıldığı andaki
      // sürümü (updatedAt) gönderir; arada başka biri (ya da gönderimde mükellefiyeti düzelten sunucu) kaydettiyse 409 — ikinci kaydeden ilkinin
      // değişikliğini sessizce silmez. Sürüm göndermeyen çağrılar (Pasife Al / Aktif Et, eski istemci) eskisi gibi yazar.
      const current = store.get("SELECT updated_at AS updatedAt FROM accounts WHERE id = ?", previous.id);
      if (body.updatedAt && current && body.updatedAt !== current.updatedAt) throw new HttpError(409, "Bu cari siz düzenlerken başka biri tarafından değiştirildi.", { code: "account-stale", updatedAt: current.updatedAt });
      const wantedRef = limited(body.refNo, 30, "Cari No");
      if (wantedRef && wantedRef !== previous.refNo && store.get("SELECT 1 AS found FROM accounts WHERE deleted_at IS NULL AND ref_no = ? AND id <> ?", wantedRef, previous.id)) throw new HttpError(409, `${wantedRef} numarası başka bir caride kullanılıyor.`);
      // Görünen grup adları birleştirilmez: grup boşaltılınca eski adla yeniden açılmasın.
      const input = accountInput({ ...previous, groupName: "", subgroupName: "", ...body }, user, previous);
      // v2.0.26 (A3): kapanmış dönemde hareketi olan carinin türü değişmez (kilitli mizanda 120/320/336 sınıfı kayardı).
      if (input.type !== previous.type) assertUnlocked(previous.id, "türü değiştirilemez");
      // Yargıç 2.3.0 #5 (15.10.2026; kabul K2 yalnız müşteri): şüpheli alacak kaydı olan carinin türü değişmez (128 satırları 320/336'ya kayardı).
      if (input.type !== previous.type) doubtful()?.assertNone?.(previous.id, "türü değiştirilemez", "Şüpheli ticari alacak yalnız müşteri (120) carisinde izlenir; önce kayıtları silin.");
      // v2.0.22: bilgi kolonları ayrı yazılır; tür ve durum yalnız değiştiyse (bilgi düzeltmesi mutabakat kapısını
      // tetiklemez — lib/db.mjs INFO_COLUMNS).
      store.run(
        "UPDATE accounts SET ref_no = ?, name = ?, phone = ?, email = ?, address = ?, registered_on = ?, group_id = ?, subgroup_id = ?, note = ?, fields_json = ?, case_key = ?, case_source = ?, case_title = ?, updated_by = ?, updated_at = ? WHERE id = ?",
        input.refNo || previous.refNo || nextRef(), input.name, input.phone, input.email, input.address, input.registeredOn, input.groupId, input.subgroupId, input.note, JSON.stringify(input.fields), input.caseKey, input.caseSource, input.caseTitle, user.id, now(), previous.id,
      );
      if (input.type !== previous.type || input.status !== previous.status) store.run("UPDATE accounts SET type = ?, status = ? WHERE id = ?", input.type, input.status, previous.id);
      writeTax(previous.id, input);
      plans()?.followAccount?.(previous.id, { name: previous.name, phone: previous.phone }, { name: input.name, phone: input.phone });
      audit(user, "account.updated", previous.id, { previous: { name: previous.name, phone: previous.phone, status: previous.status }, name: input.name, phone: input.phone, status: input.status });
      dueChanged = setOpeningDue(user, previous.id, body);
      return detail(previous.id, user);
    });
    // Para defterini etkileyen değişiklik (tür, durum) ya da başka pencerelerde görünen ad/telefon/Cari No (taksit kartı,
    // fatura, Kasa satırı) yoksa olay "bilgi" olarak gider: ANLIK DURUM ve açık pencerelerin para/vade yenilemesi
    // tetiklenmez (routes/overview.mjs).
    const money = result.type !== previous.type || result.status !== previous.status;
    const followed = result.name !== previous.name || result.phone !== previous.phone || result.refNo !== previous.refNo;
    touched(user, result, money || followed || dueChanged ? {} : { info: true });
    if (money || followed) changed(user, { kind: "plans" });
    ok(res, result);
  });
  router.delete("/api/workspace/accounts/:id", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const account = accountRow(params.id);
    // 2.4.3 (keşif A5): silme engelleri tek yerde (deleteBlock) — cari kartı Sil düğmesini aynı nedenle pasif gösterir.
    const block = deleteBlock(account);
    if (block) throw new HttpError(block.status || 409, block.message, block.extra);
    // Silinen carinin tahsilat/ödemeleri Kasa'dan ve bankadan düşer: eksi bakiye denetimi (Uyar/Engelle) toplam etkiyle sorar.
    cash?.guardRemove?.(store.all("SELECT kind, amount, method, date FROM account_entries WHERE account_id = ? AND kind IN ('in', 'out') AND source = ''", account.id), url.searchParams.get("cashForce") === "1", "Bu cari silinince tahsilat ve ödemeleriyle birlikte");
    store.tx(() => {
      // Yumuşak silme: hareketleri yerinde durur (Kasa'dan düşer); yönetim panelindeki Silinenler'den geri gelir.
      store.run("UPDATE accounts SET deleted_by = ?, deleted_at = ? WHERE id = ?", user.id, now(), account.id);
      audit(user, "account.deleted", account.id, { name: account.name });
    });
    touched(user, account);
    changed(user, { kind: "cash" });
    ok(res, { id: account.id });
  });

  // v2.0.26 (A3): carinin kapanmış dönemde (kilit tarihi ve öncesi) hareketi var mı — cari satırı (tahsilat/ödeme, Borç Yaz/
  // Alacak Yaz, açılış) ya da taksit kartının borcu/tahsilatı. Varsa silme, geri yükleme ve tür değişikliği kilitli mizanı
  // değiştirir; mutabakat kapısındaki kilit izi (party_lock) aynı tanımı kullanır.
  function lockedSince(accountId) {
    const lock = period?.lockedUntil?.() || "";
    if (!lock) return "";
    const hit = store.get(
      `SELECT 1 AS found WHERE EXISTS (SELECT 1 FROM account_entries WHERE account_id = ?1 AND date <= ?2)
          OR EXISTS (SELECT 1 FROM plans p WHERE p.account_id = ?1 AND p.deleted_at IS NULL
                       AND ((p.covers_balance = 0 AND p.registered_on <> '' AND p.registered_on <= ?2)
                            OR EXISTS (SELECT 1 FROM plan_entries pe WHERE pe.plan_id = p.id AND pe.date <= ?2)
                            -- gözden geçirme G1: kapanmış dönemde kapatılmış kartın vazgeçilen kalanı (689) carinin türüne göre yazılır
                            OR (p.status = 'closed' AND MAX(COALESCE(p.closed_at, substr(p.updated_at, 1, 10)), COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10))) <= ?2)))`,
      accountId, lock,
    );
    return hit ? lock : "";
  }
  /**
   * 2.4.3 (keşif A5): cari silinemiyorsa nedeni ({ message, extra }), silinebiliyorsa null. Silme ucu bununla 409 verir; cari kartı (detail)
   * aynı nedeni deleteBlock olarak taşır, Sil düğmesi pasif ve nedeni görünür yazılır (fatura kartındaki kural). Sıra eski denetim sırasıdır.
   */
  function deleteBlock(account) {
    const planCount = plans()?.countForAccount ? plans().countForAccount(account.id) : 0;
    if (planCount) return { message: `Bu carinin ${planCount} taksit kartı var. Önce kartları silin ya da başka cariye taşıyın; kapatılan kartlar da sayılır.` };
    const stockLinked = store.get(
      "SELECT COUNT(*) AS n FROM account_entries e JOIN stock_moves m ON m.id = e.source_id JOIN stock_items i ON i.id = m.item_id WHERE e.account_id = ? AND e.source = 'stock' AND i.deleted_at IS NULL",
      account.id,
    ).n;
    if (stockLinked) return { message: `Bu cariye yazılmış ${stockLinked} stok hareketi var. Önce stok hareketlerini düzeltin.` };
    const chequeLinked = cheques()?.countForAccount ? cheques().countForAccount(account.id) : 0;
    if (chequeLinked) return { message: `Bu cariye bağlı ${chequeLinked} çek/senet var. Önce Çek/Senet'ten evrakı silin ya da başka cariye taşıyın.` };
    // v2.0.15: faturası olan cari silinmez (fatura yasal belgedir; Logo/Netsis'teki gibi hareketli cari silinemez).
    const invoiceCount = store.get("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'invoices'").n ? store.get("SELECT COUNT(*) AS n FROM invoices WHERE account_id = ? AND status = 'issued'", account.id).n : 0;
    if (invoiceCount) return { message: `Bu carinin ${invoiceCount} faturası var; faturası olan cari silinemez. Cariyi pasife alın.`, extra: { code: "account-has-invoices" } };
    // v2.1.0 Aşama 5 (plan §3.8 "Cari kartı"): banka hesabına bağlı hareketi olan cari silinmez (silinirse hareket banka hesabından düşer,
    // banka bakiyesi bankadakinden ayrılırdı). Pasife Al önerilir.
    const bankLinked = store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND fin_ref <> ''", account.id).n;
    if (bankLinked) return { message: `Bu carinin banka hesabına bağlı ${bankLinked} hareketi var; cari silinirse banka hesabının bakiyesi değişirdi. Cariyi pasife alın (hareketleri korunur).`, extra: { code: "account-bank-linked", count: bankLinked } };
    // 2.3.0 İz 1 (plan §3.11b): şüpheli alacak kaydı olan cari silinmez (kayıt ve 128 satırları defterden düşerdi).
    // v2.0.26 (A3): kapanmış dönemde hareketi olan cari silinmez (silinen carinin satırları defterden düşer).
    for (const check of [() => doubtful()?.assertNone?.(account.id, "silinemez"), () => assertUnlocked(account.id, "silinemez")]) {
      try {
        check();
      } catch (error) {
        if (error instanceof HttpError) return { message: error.message, extra: error.extra, status: error.status };
        throw error;
      }
    }
    return null;
  }
  function assertUnlocked(accountId, what) {
    const lock = lockedSince(accountId);
    if (lock) throw new HttpError(409, `Bu carinin ${dayText(lock)} ve öncesinde (kapatılmış dönem) hareketi var; cari ${what}. Kapanmış dönemin mizanı değişirdi. Gerekirse yönetici dönem kilidini açmalı.`, { code: "period-locked", lockedUntil: lock });
  }

  // ---------- Hareketler ----------
  const receiptNumber = () => {
    if (plans()?.receiptSeq) return plans().receiptSeq();
    const current = Number(store.setting("plans.receiptSeq", "0")) || 0;
    store.setSetting("plans.receiptSeq", String(current + 1));
    return current + 1;
  };
  function addEntry(user, accountId, { kind, amount, date, note, source = "", sourceId = "", method = "cash", invoiceId = "", eventId: keepEvent = "", finRef = "", pos = null, doubtfulSkip = false, dueDate = "", expectedDate = "" }) {
    // Açılış bakiyesi, stoktan ve çekten gelen satırlar dahil: kapanmış döneme cari satırı yazılmaz.
    period?.assertOpen(date, "Cari hareketi");
    const id = newId("aentry");
    const receiptNo = kind === "in" && source !== "stock" && source !== "invoice" ? receiptNumber() : null;
    const way = methodInput(method);
    // v2.1.0 (bank.post): tahsilat/ödeme (para satırı) İşlem No'lu işlem başlığı alır; Borç Yaz / Alacak Yaz, açılış, fatura borcu ve
    // stoktan gelen satır para satırı değildir (olay yok). Para satırı yalnız bank.post'un write geri çağrısında yazılır (K6).
    // keepEvent (gözden geçirme D2): fatura düzenlenirken özeti (yön, tutar, yol, tarih) aynı kalan peşin satır eski işlem başlığıyla yeniden
    // yazılır (İşlem No değişmez); bank.post satırı kalmayan olayı iptal eder, satırı geri gelen olayı yeniden etkin yapar.
    // pos (2.2.0): POS satırının taksit sayısı, provizyon, kart son 4 hanesi, asıl POS işlemi (bank.post'un POS kancası okur).
    const eventId = bank.eventFor("account_entries", { kind, source, date, method: way, event_id: keepEvent, fin_ref: finRef, ...(pos ? { pos } : {}) });
    // finRef (v2.1.0 Aşama 4): banka hesabına bağlı satır (şimdilik yalnız Banka → KDV'li masrafın faturasının havale ödemesi; modül formlarındaki
    // hesap seçimi Aşama 5/7).
    store.run(
      "INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, method, invoice_id, fin_ref, event_id, created_by, created_at, doubtful_skip, due_date, expected_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, accountId, kind, amount, date, note || "", receiptNo, source, sourceId, way, invoiceId || "", finRef || "", eventId, user.id, now(), doubtfulSkip === true ? 1 : 0,
      // 2.4.5 madde 6: Vade Tarihi / Beklenen Ödeme Tarihi yalnız elle Borç / Alacak ve açılışta (dueInput); başka satırda boş.
      source === "" && DUE_KINDS.has(kind) ? dueDate || "" : "", source === "" && DUE_KINDS.has(kind) ? expectedDate || "" : "",
    );
    return { id, receiptNo };
  }
  // Karar 15.10.2026 (plan §3.11b/2): "Normal Cari Hesaba İşle" — tahsilat şüpheliden düşmez, 120'de kalır (lib/doubtful-gl.mjs doubtfulSkipOf).
  // Yalnız tahsilatta (kind 'in'); borç/alacak/ödemede verilirse 400. Düzeltmede anahtar yoksa önceki işaret korunur.
  const doubtfulSkipInput = (body, kind, previous = null) => {
    if (!body || !Object.hasOwn(body, "doubtfulSkip") || body.doubtfulSkip === undefined) return previous ? Number(previous.doubtfulSkip) === 1 : false;
    const value = body.doubtfulSkip === true || body.doubtfulSkip === 1 || body.doubtfulSkip === "1" || body.doubtfulSkip === "true";
    if (value && kind !== "in") throw new HttpError(400, "“Normal Cari Hesaba İşle” yalnız tahsilatta seçilir.", { code: "doubtful-skip-kind", field: "doubtfulSkip" });
    return value;
  };
  // Normal cari hesaba işlenen tahsilat (işaret ya da Kapatılacak Fatura bağı) carinin şüpheli dışı borç bakiyesini (120 = kart − açık şüpheli)
  // aşamaz: aşan kısım şüpheli alacaktan düşmek zorundadır (tam kapı doubtful:balance aynı kuralı sonradan "ledger-integrity" ile reddederdi;
  // burada hiçbir şey yazılmadan açık 409 doubtful-normal-exceeds). Düzeltmede yalnız eklenen fark sayılır.
  const assertNormalRoom = (account, input, previous = null) => {
    if (input.kind !== "in" || account.type !== "customer" || !doubtful()?.headroom) return;
    if (!doubtfulSkipOf({ kind: "in", invoiceId: input.invoiceId, doubtfulSkip: input.doubtfulSkip })) return;
    const room = doubtful().headroom(account.id);
    if (!(room.openMinor > 0)) return;
    // Önceki satırın ZATEN 120'de olan kısmı sayılmaz (işaretliyse tamamı; değilse ayırma kuralının şüpheliye düşürmediği kısmı — ör. kayıt
    // tarihinden önceki tahsilat; kontrol turu 2 K3: önceden tamamı yeni sayılıp defter değişmediği hâlde 409).
    const previousMinor = previous && previous.kind === "in"
      ? (doubtfulSkipOf({ kind: "in", source: previous.source, invoiceId: previous.invoiceId, doubtfulSkip: previous.doubtfulSkip })
        ? Math.round(Number(previous.amount) * 100)
        : Math.round(Number(previous.amount) * 100) - (doubtful().allocatedMinor?.(account.id, previous.id) ?? 0))
      : 0;
    const deltaMinor = Math.round(input.amount * 100) - previousMinor;
    if (deltaMinor <= room.roomMinor) return;
    const roomTl = roundMoney(Math.max(0, room.roomMinor) / 100);
    const why = input.doubtfulSkip ? "“Normal Cari Hesaba İşle” işaretini kaldırın" : "Kapatılacak Fatura bağını kaldırın";
    throw new HttpError(409, `Normal cari hesaba işlenecek tahsilat (${tl(input.amount)}) carinin şüpheli dışı borç bakiyesini (${tl(roomTl)}) aşıyor; fazlası şüpheli alacaktan düşmek zorunda. Tutarı ${tl(roomTl)}'ye indirin ya da ${why}.`, { code: "doubtful-normal-exceeds", field: "amount", roomMinor: room.roomMinor, openMinor: room.openMinor });
  };
  // v2.0.17: tahsilat/ödeme "Kapatılacak Fatura" ile bağlanabilir (boş = otomatik: carinin en eski açık faturası).
  // Bağ yalnız kapamayı belirler; cari bakiyesi ve Kasa değişmez. Fatura aynı carinin, kesilmiş, aynı yönde olmalı.
  // keep (v2.0.23): hareket düzeltilirken değişmeyen eski bağ yeni kurallara takılmaz (taksitli ya da iptal edilmiş faturaya
  // eskiden kurulmuş bağ yalnız açıklama düzeltmesini engelliyordu); fatura artık yoksa bağ düşer. Kapama böyle bir bağı
  // zaten yok sayar (taksitli fatura kendi kartıyla kapanır).
  // 2.4.4 UX18: çek/senet formu da (routes/cheques.mjs) AYNI kuralı kullanır (alınan evrak = tahsilat, verilen evrak = ödeme); extra hata gövdesine
  // eklenir (alan adı), planHint taksitli faturadaki yol önerisidir.
  const invoiceLink = (accountId, kind, value, keep = "", { extra = {}, planHint = "Tahsilatı taksite yazın: cari kartında + Tahsilat → Taksite Yaz." } = {}) => {
    const invoiceId = limited(value, 120, "Fatura");
    if (!invoiceId) return "";
    if (kind !== "in" && kind !== "out") throw new HttpError(400, "Fatura bağı yalnız tahsilat ve ödemede seçilir.", extra);
    const invoice = store.get("SELECT id, kind, status, account_id AS accountId, plan_id AS planId FROM invoices WHERE id = ?", invoiceId);
    if (keep && invoiceId === keep) return invoice && invoice.accountId === accountId ? invoice.id : "";
    if (!invoice || invoice.accountId !== accountId) throw new HttpError(404, "Kapatılacak fatura bu caride bulunamadı.", extra);
    if (invoice.status !== "issued") throw new HttpError(409, "Yalnız kaydedilmiş fatura kapatılır (taslak ya da iptal edilmiş fatura seçilemez).", extra);
    // v2.0.23 (Bulgu 2 F): taksitli fatura kendi taksit kartıyla kapanır; cari kartından bağ kurulursa fatura ile kartı
    // çelişirdi (fatura ödendi, kart ödenmedi). Tahsilat kartın taksitine girilir.
    if (invoice.planId) throw new HttpError(409, `Bu fatura taksitli; kendi taksit kartıyla kapanır. ${planHint}`, extra);
    const side = ["sale", "smm"].includes(invoice.kind) ? "in" : invoice.kind === "purchase" ? "out" : "";
    if (side !== kind) throw new HttpError(409, kind === "in" ? "Tahsilat yalnız satış faturasını kapatır; alış faturası için Ödeme girin." : "Ödeme yalnız alış faturasını kapatır; satış faturası için Tahsilat girin.", extra);
    return invoice.id;
  };
  const entryInput = (body, accountId = "", previous = null) => {
    const kind = text(body.kind);
    if (!KIND_TEXT[kind]) throw new HttpError(400, "Hareket türü borç, alacak, tahsilat ya da ödeme olmalı.");
    const amount = amountOf(body.amount);
    if (!(amount > 0)) throw new HttpError(400, "Tutar sıfırdan büyük olmalı.");
    // v2.0.13: tahsilat/ödemenin yolu (nakit, havale/EFT, kredi kartı); borç/alacak yazmada para hareketi yoktur.
    const date = period ? period.movementDate(body) : dateOf(body.date, "Tarih", today());
    // 2.4.5 madde 6 (K6.1): borç / alacakta Vade Tarihi ve Beklenen Ödeme Tarihi (tahsilat / ödemede boş).
    return { kind, amount, date, note: limited(body.note, 300, "Açıklama"), method: methodInput(body.method), invoiceId: invoiceLink(accountId, kind, body.invoiceId, previous?.invoiceId || ""), doubtfulSkip: doubtfulSkipInput(body, kind, previous), ...dueInput(body, { kind, date, previous }) };
  };
  const entryOf = (accountId, entryId) => {
    const entry = store.get("SELECT id, kind, amount, date, note, method, receipt_no AS receiptNo, source, source_id AS sourceId, invoice_id AS invoiceId, event_id AS eventId, fin_ref AS finRef, created_by AS createdBy, created_at AS createdAt, doubtful_skip AS doubtfulSkip, due_date AS dueDate, expected_date AS expectedDate FROM account_entries WHERE account_id = ? AND id = ?", accountId, limited(entryId, 120, "Hareket"));
    if (!entry) throw new HttpError(404, "Hareket bulunamadı. Başka biri silmiş olabilir.");
    return entry;
  };
  const requireKindRight = (user, kind) => {
    if (kind === "in" && !canUser(user, "accounts.collect")) throw new HttpError(403, "Tahsilat girme yetkiniz yok.");
    if (kind !== "in" && !canUser(user, "accounts.manage")) throw new HttpError(403, "Borç, alacak ve ödeme girişi yönetici, uzman ve muhasebe yetkisidir; tahsilatı herkes girer.");
  };
  const requireEntryRight = (user, entry) => {
    if (entry.source === "stock") throw new HttpError(409, "Bu hareket bir stok hareketinden geldi; Stok'taki hareketten düzeltin ya da silin.");
    if (entry.source === "invoice") throw new HttpError(409, "Bu hareket bir faturadan geldi; Fatura ekranından iptal edin ya da iade faturası kesin.", { code: "invoice-linked", invoiceId: entry.sourceId });
    if (entry.source === "bank") throw new HttpError(409, "Bu hareket Banka penceresinden geldi; Banka → Hareketler'deki işlemden düzeltin (Ters Kaydet ya da Düzelt).", { code: "bank-linked", eventId: entry.eventId || "" });
    if (entry.source === "cheque") throw new HttpError(409, "Bu hareket bir çek/senetten geldi; Çek/Senet'teki evraktan düzeltin (geri al ya da sil).", { code: "cheque-linked", chequeId: entry.sourceId });
    // 2.3.0 İz 1: Değersiz Alacak satırı cari kartından silinmez/düzeltilmez; şüpheli alacak kaydından (Değersiz Alacaklar → Sil) kaldırılır.
    if (entry.source === "doubtful") throw new HttpError(409, "Bu satır şüpheli alacağın değersiz yazılmasından geldi; cari kartındaki Şüpheli Alacak kaydından silin.", { code: "doubtful-linked", recordId: entry.sourceId });
    if (entry.createdBy !== user.id && !canUser(user, "accounts.manage")) throw new HttpError(403, "Başkasının girdiği hareketi yalnızca yönetici, uzman ve muhasebe değiştirebilir.");
    requireKindRight(user, entry.kind);
  };

  // v2.0.26 (A9): mahsup fişinde karşı belge olan Alacak Yaz / Borç Yaz satırı. Silinirse ya da tutarı mahsubun altına
  // iner, yönü değişir, tarihi mahsuptan sonraya kayarsa mahsup fişi boşa düşer (kapı bunu nedensiz 409 ile durduruyordu).
  // Nedenli 409 "offset-linked": önce mahsup kaldırılır.
  const offsetsOf = entryId =>
    hasOffsets()
      ? store.all("SELECT o.amount, o.date, COALESCE(i.number, '') AS number FROM invoice_offsets o LEFT JOIN invoices i ON i.id = o.invoice_id WHERE o.counter_type = 'entry' AND o.counter_id = ? ORDER BY o.date", entryId)
      : [];
  let offsetTable = null;
  const hasOffsets = () => (offsetTable ??= Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'invoice_offsets'")));
  function assertOffsetFree(previous, next = null) {
    const offsets = offsetsOf(previous.id);
    if (!offsets.length) return;
    const used = roundMoney(offsets.reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
    const list = [...new Set(offsets.map(row => row.number).filter(Boolean))];
    const numbers = list.join(", ") || "bir fatura";
    const head = `Bu satır ${numbers} faturasıyla ${tl(used)} mahsup edilmiş.`;
    // v2.0.26 (gözden geçirme G8): mahsup, faturanın kartındaki "Bu Faturayı Kapatanlar" listesinden Kaldır ile kalkar (arayüzde
    // "Fatura → Mahsup" diye bir yer yok).
    const how = `${list.length ? `${numbers} ${list.length > 1 ? "faturalarını" : "faturasını"}` : "Faturayı"} açın; Bu Faturayı Kapatanlar listesindeki mahsup satırında Kaldır'a basın`;
    if (!next) throw new HttpError(409, `${head} Önce mahsubu kaldırın: ${how}, sonra satırı silin.`, { code: "offset-linked", used });
    if (next.kind !== previous.kind) throw new HttpError(409, `${head} Yönü değiştirilemez; önce mahsubu kaldırın: ${how}.`, { code: "offset-linked", used });
    // 2. gözden geçirme İ7: tutar ve tarih kuralı yalnız DEĞİŞEN alana uygulanır. 2.0.25 mahsuplu satırın tarihini mahsuptan sonraya
    // ya da tutarını mahsubun altına çekmeye izin veriyordu; böyle eski bir satırda yalnız açıklama düzeltmesi bile 409 alıyordu.
    const amountChanged = Math.abs(roundMoney(next.amount) - roundMoney(previous.amount)) > 0.004;
    if (amountChanged && next.amount < used - 0.005) throw new HttpError(409, `${head} Tutar mahsup edilenden (${tl(used)}) az olamaz; önce mahsubu kaldırın ya da azaltın: ${how}.`, { code: "offset-linked", used });
    if (next.date !== previous.date && next.date > offsets[0].date) throw new HttpError(409, `${head} Tarih mahsup tarihinden (${dayText(offsets[0].date)}) sonra olamaz; önce mahsubu kaldırın: ${how}.`, { code: "offset-linked", used });
  }
  // v2.1.0 Aşama 5 (plan §3.5, §3.9, §3.10): havale/EFT tahsilat ve ödemesinin banka hesabı (fin_ref; tek hesapta kendiliğinden, birden çokta
  // seçim zorunlu), kalıcı istek kimliği (x-hof-request: aynı istek ikinci kez yazılmaz), Benzer İşlem (hesaba bağlı satırda; similarOk),
  // hesap bazında eksi bakiye (K7; Bakiye Doğrulandı hesapta Uyar/Engelle; onay cashForce ya da negativeOk). Nakit satır bugünkü kuralla (Kasa eksi bakiye).
  const requestIdOf = (req, body) => text(req.headers["x-hof-request"]) || text(body?.requestId);
  const banking = () => bankModule?.() || null;
  const isMoney = kind => kind === "in" || kind === "out";
  // Bankadan çıkış (havale ödemesi) "Banka Hareketi Girme ve Bankadan Çıkış" ister (plan §3.7 #3, §9.1); hesapsız eski kurulumda bugünkü gibi.
  const requireBankOut = (user, kind, ref) => {
    if (kind === "out" && ref && !canUser(user, "bank.move")) throw new HttpError(403, "Bankadan ödeme için \"Banka Hareketi Girme ve Bankadan Çıkış\" yetkisi gerekir.", { code: "bank-permission", permission: "bank.move" });
  };
  const refOf = (input, body, previous = null) => {
    const module = banking();
    if (!module || !isMoney(input.kind)) return "";
    const changed = !previous || previous.method !== input.method || Math.abs(roundMoney(previous.amount) - roundMoney(input.amount)) > 0.004 || previous.date !== input.date;
    // K2 (plan §3.7 #3, §4.6): cari ödemesinde kart yolu firmanın kartıyla ödemedir (309); tahsilatta POS (2.2.0). Cari "POS İadesi"
    // (posRefund / posRefundOf / posSourceless) çıkış olsa da POS'tur (plan §4.6 "alan belge türüne göre seçilir").
    return module.pickRef({ method: input.method, value: body.bankAccountId, date: input.date, previous, changed, corporate: corporateOf(input, body, previous), posId: body.posId, posRefundOf: body.posRefundOf });
  };
  // 2.2.0: cari "POS İadesi" — kart yolunda müşteriye POS'tan iade (POS'a bağlı önceki satır da öyledir).
  const posRefundOf = (body, previous = null) =>
    body?.posRefund === true || Boolean(text(body?.posRefundOf)) || body?.posSourceless === true || Boolean(previous && previous.kind === "out" && previous.method === "card" && previous.finRef && store.get("SELECT 1 AS found FROM pos_terminals WHERE id = ?", previous.finRef));
  // 2.3.0 (İz 3.2; plan §4.6 "ödeme iadesi (giriş) → Kurumsal Kart, POS satışı oluşmaz, 309 düşer"): cari "Kredi Kartına İade" — tedarikçi parayı
  // firmanın kredi kartına iade etti (cardRefund). Giriş olsa da kart yolu POS değil Kredi Kartı hesabıdır; karta bağlı önceki satır da öyledir.
  const isCardAccount = id => Boolean(id && store.get("SELECT 1 AS found FROM bank_accounts WHERE id = ? AND kind = 'card'", id));
  const cardRefundOf = (body, previous = null) => body?.cardRefund === true || Boolean(previous && previous.kind === "in" && previous.method === "card" && isCardAccount(previous.finRef));
  // Kart yolunun anlamı (plan §4.6 "alan belge türüne göre"): çıkış = kartla ödeme (309) — "POS İadesi" değilse; giriş = POS — "Kredi Kartına İade" değilse.
  const corporateOf = (input, body, previous = null) => (input.kind === "out" ? !posRefundOf(body, previous) : input.kind === "in" && input.method === "card" && cardRefundOf(body, previous));
  const negativeOf = (refs, date, force) => banking()?.negative({ refs, date, force }) || { capture() {}, guard: null, prime() {} };
  // Hakem K5: onay cashForce (plan §3.9) ya da eşanlamlı negativeOk (module-ref.mjs negativeConfirmed).
  const negativeForced = (body, url) => negativeConfirmed(body, url);
  router.post("/api/workspace/accounts/:id/entries", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = accountRow(params.id);
    const body = await readJson(req);
    const input = entryInput(body, account.id);
    requireKindRight(user, input.kind);
    assertNormalRoom(account, input);
    const finRef = refOf(input, body);
    requireBankOut(user, input.kind, finRef);
    // Yargıç 2.3.0 #6 (15.10.2026): "Kredi Kartına İade" (cardRefund) kart hesabı ister; tanımlı etkin kart yoksa 108.00'a sessiz yazım yok (400).
    if (input.kind === "in" && input.method === "card" && body.cardRefund === true && !finRef) throw new HttpError(400, "Kredi Kartına İade için etkin bir kredi kartı hesabı gerekir; tanımlı kart yoksa Banka → Hesaplar'dan ekleyin ya da yolu değiştirin.", { code: "bank-account-invalid", field: "bankAccountId" });
    const k7 = negativeOf([finRef], input.date, negativeForced(body));
    const created = bank.post({
      user,
      module: "account",
      op: "create",
      requestId: requestIdOf(req, body),
      scope: "account.entry.create",
      body: { ...body, accountId: account.id },
      similarOk: body.similarOk === true,
      // Hakem K4 (plan §3.3 sırası "1 istek kimliği → 2 prepare", C12 "eksi bakiye işlemin içindedir"): Kasa ön denetimi istek kimliği bakışından
      // SONRA. Önceden önce çalışıyordu: Kasa'yı 0'a indiren ödemenin yinelemesi kaydedilmiş ödemeye 409 "Kasa eksiye düşer" diyordu.
      prepare: () => {
        if (input.kind === "out") cash?.guardOut?.(input.amount, input.date, body.cashForce === true, input.method);
      },
      write: () => {
        k7.capture();
        const cardRefund = corporateOf(input, body) && input.kind === "in";
        const entry = addEntry(user, account.id, { ...input, finRef, pos: finRef && !corporateOf(input, body) ? posMetaOf(body) : null });
        audit(user, `account.entry.${input.kind}`, entry.id, { accountId: account.id, accountName: account.name, ...input, finRef, receiptNo: entry.receiptNo, ...(cardRefund ? { cardRefund: true } : {}) });
        return entry;
      },
      guard: k7.guard,
    });
    k7.prime(created);
    touched(user, account);
    if (isMoney(input.kind) && !created?.replayed) changed(user, { kind: "cash" });
    ok(res, { ...detail(account.id, user), entryId: created?.replayed ? created.refId : created.id, ...(created?.replayed ? { replayed: true } : {}) });
  });
  router.put("/api/workspace/accounts/:id/entries/:entryId", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = accountRow(params.id);
    const previous = entryOf(account.id, params.entryId);
    requireEntryRight(user, previous);
    period?.assertOpen(previous.date, "Bu cari hareketi");
    const body = await readJson(req);
    // v2.0.13: borç ↔ alacak yönü düzeltilebilir (yanlış yönde yazılan açılış bakiyesi gibi); tahsilat/ödeme yön değiştirmez.
    const flip = ["debt", "credit"].includes(previous.kind) && ["debt", "credit"].includes(text(body.kind)) ? text(body.kind) : previous.kind;
    const input = entryInput({ ...previous, ...body, kind: flip }, account.id, previous);
    assertOffsetFree(previous, input);
    assertNormalRoom(account, input, previous);
    const finRef = refOf(input, body, previous);
    if (finRef !== previous.finRef) requireBankOut(user, input.kind, finRef);
    const cashSide = e => (e.kind === "in" || e.kind === "out" ? e : null);
    cash?.guardChange?.(cashSide(previous), cashSide(input), body.cashForce === true);
    const k7 = negativeOf([previous.finRef, finRef], previous.date < input.date ? previous.date : input.date, negativeForced(body));
    const result = bank.post({
      user,
      module: "account",
      op: "update",
      prev: previous,
      requestId: requestIdOf(req, body),
      scope: "account.entry.update",
      body: { ...body, entryId: previous.id },
      write: () => {
        k7.capture();
        const meta = finRef && !corporateOf(input, body, previous) ? posMetaOf(body) : null;
        const eventId = bank.eventFor("account_entries", { kind: input.kind, source: previous.source, date: input.date, method: input.method, event_id: previous.eventId, fin_ref: finRef, ...(meta ? { pos: meta } : {}) });
        store.run("UPDATE account_entries SET kind = ?, amount = ?, date = ?, note = ?, method = ?, invoice_id = ?, fin_ref = ?, event_id = ?, doubtful_skip = ?, due_date = ?, expected_date = ?, updated_by = ?, updated_at = ? WHERE id = ?", input.kind, input.amount, input.date, input.note, input.method, input.invoiceId, finRef, eventId, input.doubtfulSkip ? 1 : 0, previous.source ? "" : input.dueDate, previous.source ? "" : input.expectedDate, user.id, now(), previous.id);
        audit(user, "account.entry.updated", previous.id, { accountId: account.id, previous, ...input, finRef });
        return { id: previous.id };
      },
      guard: k7.guard,
    });
    k7.prime(result);
    touched(user, account);
    changed(user, { kind: "cash" });
    ok(res, { ...detail(account.id, user), ...(result?.replayed ? { replayed: true } : {}) });
  });
  router.delete("/api/workspace/accounts/:id/entries/:entryId", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = accountRow(params.id);
    const previous = entryOf(account.id, params.entryId);
    requireEntryRight(user, previous);
    period?.assertOpen(previous.date, "Bu cari hareketi");
    assertOffsetFree(previous);
    if (previous.kind === "in" || previous.kind === "out") cash?.guardChange?.(previous, null, url.searchParams.get("cashForce") === "1", previous.kind === "in" ? "Bu tahsilat silinince" : "Bu ödeme silinince");
    const k7 = negativeOf([previous.finRef], previous.date, negativeForced(null, url));
    const result = bank.post({
      user,
      module: "account",
      op: "delete",
      prev: previous,
      // 2.2.0 (§3.8): POS'lu satırı silmek kayıt hatası düzeltmesidir (valörden önce void; bankaya geçtiyse yeniden planlama ya da 409 pos-settled).
      posOutcome: "entry-error",
      write: () => {
        k7.capture();
        store.run("DELETE FROM account_entries WHERE id = ?", previous.id);
        trash?.add({ kind: "account-entry", ref: previous.id, title: account.name, detail: previous.note || KIND_TEXT[previous.kind], payload: { ...previous, accountId: account.id, accountName: account.name }, user });
        audit(user, "account.entry.deleted", previous.id, { accountId: account.id, ...previous });
        return { id: previous.id };
      },
      guard: k7.guard,
    });
    k7.prime(result);
    touched(user, account);
    changed(user, { kind: "cash" });
    ok(res, detail(account.id, user));
  });

  // ---------- PDF ve Excel ----------
  const sideText = balance => (balance > EPS ? "borçlu" : balance < -EPS ? "alacaklı" : "");
  router.get("/api/workspace/accounts/:id/ekstre.pdf", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = detail(params.id, user);
    const t = account.totals;
    const pdf = tablePdf({
      now: clock(),
      title: `Cari Ekstre · ${account.name}`,
      subtitle: [account.refNo ? `Cari No ${account.refNo}` : "", ACCOUNT_TYPES[account.type], [account.groupName, account.subgroupName].filter(Boolean).join(" › "), account.phone, account.address].filter(Boolean).join(" · "),
      headers: ["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"],
      types: ["text", "text", "text", "money", "money", "money"],
      rows: account.ledger.map(line => [dayText(line.date), `${line.label}${line.receiptNo ? ` · Makbuz ${line.receiptNo}` : ""}`, line.note || "", line.debit ? tl(line.debit) : "", line.credit ? tl(line.credit) : "", `${tl(Math.abs(line.balance))} ${sideText(line.balance)}`.trim()]),
      // 2.4.3 (keşif A22; kalıcı karar "her raporda alt TOPLAM satırı"): satırların borç/alacak toplamı ve son bakiye (ekrandaki kart tablosuyla aynı).
      footer: account.ledger.length ? ["", "TOPLAM", "", tl(roundMoney(account.ledger.reduce((sum, line) => sum + line.debit, 0))), tl(roundMoney(account.ledger.reduce((sum, line) => sum + line.credit, 0))), `${tl(Math.abs(t.balance))} ${sideText(t.balance)}`.trim()] : null,
      summary: [["Borç Toplamı", tl(t.debit)], ["Alacak Toplamı", tl(t.credit)], ["Bakiye", `${tl(Math.abs(t.balance))} ${sideText(t.balance)}`.trim()], ...(t.planRemaining ? [["Taksitlerden Kalan (bakiyeye dahil)", tl(t.planRemaining)]] : []), ...(t.overdueCount ? [["Geciken", `${tl(t.overdue)} · ${t.overdueCount} taksit`]] : [])],
      officeName: office(),
      userName: user.display_name || user.username || "",
      brand: office(),
    });
    audit(user, "account.statement.exported", account.id, { name: account.name });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Cari-ekstre ${account.name}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/accounts/:id/entries/:entryId/makbuz.pdf", async ({ req, res, params, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const account = detail(params.id, user);
    const entry = account.entries.find(item => item.id === params.entryId);
    if (!entry || !["in", "out"].includes(entry.kind)) throw new HttpError(404, "Makbuz yalnız tahsilat ve ödemeler için alınır.");
    const pdf = receiptPdf(
      { name: account.name, refNo: account.refNo, refLabel: "Cari No", phone: account.phone, groupName: account.groupName, subgroupName: account.subgroupName, items: [], balanceOnly: true, totals: { total: account.totals.debit, paid: account.totals.collected, remaining: account.totals.balance } },
      { ...entry, label: entry.kind === "in" ? "Cari Tahsilat" : "Cariye Ödeme" },
      { officeName: office(), userName: user.display_name || user.username || "", now: clock() },
    );
    sendBuffer(res, pdf, { type: "application/pdf", name: `Makbuz ${entry.receiptNo ? `No ${entry.receiptNo} ` : ""}${account.name} ${dayText(entry.date)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  const STATUS_TEXT = { active: "Aktif", passive: "Pasif", all: "Tümü" };
  // PDF'te en çok bu kadar satır basılır (kâğıt için anlamlı sınır; 200 bin satır 22 MB olurdu). Tamamı Excel'de.
  const PDF_ROWS = 20_000;
  router.get("/api/workspace/accounts/liste.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const clipped = data.accounts.length > PDF_ROWS;
    if (clipped) data.accounts = data.accounts.slice(0, PDF_ROWS);
    const title = limited(url.searchParams.get("title"), 60, "Başlık") || "Cari";
    const pdf = tablePdf({
      now: clock(),
      title: `${title} Listesi`,
      subtitle: [STATUS_TEXT[query.status], query.type ? ACCOUNT_TYPES[query.type] : "", query.q ? `“${query.q}”` : "", clipped ? `ilk ${PDF_ROWS.toLocaleString("tr-TR")} satır (tamamı Excel'de)` : ""].filter(Boolean).join(" · "),
      headers: ["No", "Ad / Unvan", "Tür", "Grup", "Telefon", "Kayıt", "Borç", "Alacak", "Bakiye", "Taksitten Kalan", "Bilgi Notu"],
      types: ["text", "text", "text", "text", "text", "text", "money", "money", "money", "money", "text"],
      rows: data.accounts.map(item => [item.refNo, item.name, ACCOUNT_TYPES[item.type] || "", [item.groupName, item.subgroupName].filter(Boolean).join(" › "), item.phone, dayText(item.registeredOn), tl(item.debit), tl(item.credit), `${tl(Math.abs(item.balance))} ${sideText(item.balance)}`.trim(), item.planRemaining ? tl(item.planRemaining) : "", item.note || ""]),
      summary: [["Cari", String(data.totals.count)], ["Borçlular", tl(data.totals.debtor)], ["Alacaklılar", tl(data.totals.creditor)], ["Geciken Taksit", `${tl(data.totals.overdue)} · ${data.totals.overdueCount}`]],
      officeName: office(),
      userName: user.display_name || user.username || "",
      brand: office(),
    });
    audit(user, "account.list.exported", "list", { ...query, count: data.totals.count });
    sendBuffer(res, pdf, { type: "application/pdf", name: `${title}-listesi ${dayText(today())}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  // Tüm cariler Excel'e: bilinen alanlar, bakiye ve kartın ek alanlarının hepsi (her ek alan bir kolon).
  router.get("/api/workspace/accounts/export.xlsx", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const query = listQuery(url.searchParams);
    const data = list(user, query);
    const fieldsById = new Map(store.all("SELECT id, fields_json AS fieldsJson FROM accounts WHERE deleted_at IS NULL").map(row => [row.id, parseFields(row.fieldsJson)]));
    const base = ["Cari No", "Ad / Unvan", "Tür", "Grup", "Alt Grup", "Telefon", "E-Posta", "Adres", "Kayıt Tarihi", "Durum", "Borç", "Alacak", "Bakiye", "Taksitten Kalan", "Geciken", "Bilgi Notu"];
    const extras = [...new Set(data.accounts.flatMap(item => (fieldsById.get(item.id) || []).map(field => field.label)))].filter(label => !base.includes(label));
    const money = value => MONEY_FORMAT.format(value || 0);
    const rows = data.accounts.map(item => {
      const row = {
        "Cari No": item.refNo,
        "Ad / Unvan": item.name,
        Tür: ACCOUNT_TYPES[item.type] || "",
        Grup: item.groupName,
        "Alt Grup": item.subgroupName,
        Telefon: item.phone,
        "E-Posta": item.email,
        Adres: item.address,
        "Kayıt Tarihi": dayText(item.registeredOn),
        Durum: item.status === "passive" ? "Pasif" : "Aktif",
        Borç: money(item.debit),
        Alacak: money(item.credit),
        Bakiye: money(item.balance),
        "Taksitten Kalan": money(item.planRemaining),
        Geciken: money(item.overdue),
        "Bilgi Notu": item.note,
      };
      for (const field of fieldsById.get(item.id) || []) if (!base.includes(field.label)) row[field.label] = field.value;
      return row;
    });
    const title = limited(url.searchParams.get("title"), 60, "Başlık") || "Cari";
    const buffer = buildXlsx([{ name: title.slice(0, 31), columns: [...base, ...extras], rows }], { now: clock(), title: `${title} Listesi` });
    audit(user, "account.list.exported", "xlsx", { ...query, count: rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `${title}-listesi ${dayText(today())}.xlsx` });
  });

  // Tek cari (statik adreslerden sonra kayıtlı: "liste.pdf", "export.xlsx" kimlik sanılmasın).
  router.get("/api/workspace/accounts/:id", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.view");
    ok(res, detail(params.id, user));
  });

  // ---------- Google Sheets'ten toplu alım (Cari, Stok, Taksitler ortak) ----------
  // Sunucu Sheet'in sekmelerini hücre matrisi olarak okur; tarayıcı Excel'deki gibi sayfayı seçip kolonları eşler.
  router.post("/api/workspace/import/google-sheet", async ({ req, res }) => {
    const user = auth.requireUser(req);
    if (!["accounts.manage", "stock.manage", "plans.manage"].some(permission => canUser(user, permission))) throw new HttpError(403, "Toplu yükleme yönetici, uzman ve muhasebe yetkisidir.");
    const body = await readJson(req);
    const url = limited(body.url, 2000, "Bağlantı");
    if (!url) throw new HttpError(400, "Google Sheets bağlantısını yapıştırın.");
    try {
      const result = await readSheetMatrices(url, { fetchImpl: config.fetchImpl || fetch });
      audit(user, "import.sheet.read", "google-sheet", { tabs: result.sheets.length, rows: result.sheets.reduce((sum, sheet) => sum + sheet.matrix.length, 0) });
      ok(res, result);
    } catch (error) {
      throw new HttpError(400, error.message || "Google Sheets okunamadı.");
    }
  });

  // ---------- Excel'den toplu alım ----------
  // Tarayıcı dosyayı okur (hof-excel-worker.js); başlıklar rollerle eşlenir. 2.0.18: açık tablodan alım (caseKeys ile
  // kayda bağlama) kullanıcı kararıyla kalktı; gelen caseKeys yok sayılır.
  // Taksit sorulmaz. Aynı cari (tablodaki kayıt, Cari No ya da ad + telefon) varsa "atla" ya da "güncelle".
  router.post("/api/workspace/accounts/import/preview", async ({ req, res }) => {
    auth.requirePermission(req, "accounts.manage");
    const body = await readJson(req, { limit: 40_000_000 });
    const matrix = matrixText(body.matrix); // 31e: sayı hücresi Türkçe ondalık metin (money.mjs cellText)
    const headerAt = findHeaderRow(matrix, { mapper: mapAccountHeaders });
    if (headerAt < 0) throw new HttpError(400, "Sayfada başlık satırı bulunamadı.");
    const headers = matrix[headerAt].map(sanitizeCell);
    const rows = matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT);
    // Eşleme: başlıktan, başlık tanınmadıysa değerlerden; kullanıcı eşlemeyi gönderirse (roles) yalnız kapı yeniden hesaplanır.
    const roles = body.roles && typeof body.roles === "object" ? body.roles : inferRolesByValues(headers, rows, mapAccountHeaders(headers), "account");
    const typeMap = typeMapOf(body.typeMap);
    ok(res, { headerAt, headers, roles, rows: matrix.length - headerAt - 1, gate: validateRows(headers, rows, roles, "account", { headerAt, typeMap }), types: typeValues(rows, roles) });
  });
  // v2.0.22: Tür kolonundaki farklı değerler (en çok 60) ve programın okuması — Kolonları Eşle ekranında değer başına tür
  // seçilir; "Müşteri/Tedarikçi" gibi iki türü birden yazan ya da tanınmayan değer sessizce bir türe atanmaz.
  // Değer: bir tür ya da "default" (kullanıcı tanınan değer için "Varsayılan Tür" seçti). Kalıtımsız nesne: "__proto__"
  // gibi Excel değerleri sıradan anahtar olur.
  const typeMapOf = value => {
    const out = Object.create(null);
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const [key, type] of Object.entries(value).slice(0, 500)) if (isAccountType(type) || type === TYPE_DEFAULT) out[accountTypeKey(key)] = type;
    return out;
  };
  function typeValues(rows, roles) {
    const index = Number(Object.entries(roles || {}).find(([, role]) => role === "type")?.[0] ?? -1);
    if (!(index >= 0)) return [];
    const byKey = new Map();
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const value = sanitizeCell(row[index]);
      const key = accountTypeKey(value);
      if (!key) continue;
      const item = byKey.get(key) || { value: value.slice(0, 80), key, count: 0 };
      item.count += 1;
      byKey.set(key, item);
    }
    return [...byKey.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 60)
      .map(item => ({ ...item, ...classifyAccountType(item.value) }));
  }
  function matchExisting({ caseKey, caseSource, refNo, name, phone }) {
    if (caseKey) {
      const found = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND case_key = ? AND case_source = ?", caseKey, caseSource);
      if (found) return found.id;
    }
    // Cari No tek başına kimlik sayılmaz (Excel'deki "S.N" satır numarasıdır, başka carinin numarasıyla çakışabilir):
    // aynı numara ancak ad da aynıysa aynı cari.
    if (refNo) {
      const found = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND ref_no = ? AND name = ? COLLATE NOCASE", refNo, name);
      if (found) return found.id;
    }
    const phoneDigits = digits(phone);
    if (phoneDigits.length >= 7) {
      const found = store.all("SELECT id, phone FROM accounts WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE", name).filter(row => digits(row.phone) === phoneDigits);
      if (found.length === 1) return found[0].id;
    }
    return "";
  }
  router.post("/api/workspace/accounts/import", async ({ req, res }) => {
    const user = auth.requirePermission(req, "accounts.manage");
    const body = await readJson(req, { limit: 40_000_000 });
    const matrix = matrixText(body.matrix); // 31e: sayı hücresi Türkçe ondalık metin (money.mjs cellText)
    const headerAt = Math.max(0, Math.trunc(Number(body.headerAt) || 0));
    const headers = (matrix[headerAt] || []).map(cell => String(cell ?? "").replace(/\s+/g, " ").trim());
    const roles = body.roles && typeof body.roles === "object" ? body.roles : {};
    const columnOf = role => {
      const found = Object.entries(roles).find(([, value]) => value === role);
      return found ? Number(found[0]) : -1;
    };
    const col = Object.fromEntries(["seq", "name", "phone", "email", "address", "city", "district", "taxNo", "taxOffice", "registered", "group", "subgroup", "balance", "type", "note"].map(role => [role, columnOf(role)]));
    const extraColumns = Object.entries(roles).filter(([, value]) => value === "extra").map(([index]) => Number(index)).filter(index => headers[index]);
    if (col.name < 0) throw new HttpError(400, "Ad Soyad / Unvan kolonunu seçin.");
    const mode = body.mode === "update" ? "update" : "skip";
    const openingSide = sideOf(body.openingSide);
    const defaultType = isAccountType(text(body.type)) ? text(body.type) : "customer";
    const typeMap = typeMapOf(body.typeMap);
    const defaults = { groupName: limited(body.groupName, 80, "Grup adı") };
    const source = currentSource();
    const cell = (row, index) => (index >= 0 ? sanitizeCell(row[index]) : "");
    const rows = matrix.slice(headerAt + 1, headerAt + 1 + MAX_IMPORT);
    const report = { created: 0, updated: 0, skipped: [], groups: 0, balances: 0, renumbered: 0, taxInvalid: [], typeDefaulted: [], typeDefaultedTotal: 0, truncated: Math.max(0, matrix.length - headerAt - 1 - MAX_IMPORT) };
    // Tür: kullanıcının değer başına seçimi (typeMap) önce; yoksa tek türü açıkça yazan hücre; iki tür birden ya da tanınmayan
    // değer varsayılan türle açılır ve satır numarasıyla raporlanır (sessizce bir türe atanmaz).
    const typeOf = row => {
      const raw = cell(row, col.type);
      if (!raw) return { type: defaultType, warn: null };
      const mapped = typeMap[accountTypeKey(raw)];
      if (isAccountType(mapped)) return { type: mapped, warn: null };
      if (mapped === TYPE_DEFAULT) return { type: defaultType, warn: null };
      const found = classifyAccountType(raw);
      if (found.state === "ok") return { type: found.type, warn: null };
      return { type: defaultType, warn: { value: raw.slice(0, 80), reason: found.state === "ambiguous" ? "İki tür birden" : "Tanınmadı", type: defaultType } };
    };
    // v2.0.15: vergi kimliği kolonu — geçerli VKN/TCKN karta yazılır; denetim hanesi tutmayan yazılmaz, satır numarasıyla raporlanır.
    const taxOf = (row, index) => {
      const raw = cell(row, col.taxNo).replace(/\s+/g, "").replace(/^TR/i, "");
      if (!raw) return { taxNo: "", partyKind: "" };
      const id = classifyTaxId(raw, { allowAnonymous: true });
      if (!id.ok) {
        if (report.taxInvalid.length < 500) report.taxInvalid.push({ row: headerAt + index + 2, value: raw.slice(0, 20) });
        return { taxNo: "", partyKind: "" };
      }
      return { taxNo: id.value, partyKind: id.kind === "vkn" ? "company" : "person" };
    };
    let skippedTotal = 0;
    // Atlanan satırların hepsi listelenmez (100 bin satırda yanıt şişmesin); sayı ve nedenler tam gelir.
    const skip = (index, reason) => {
      skippedTotal += 1;
      if (report.skipped.length < 500) report.skipped.push({ row: headerAt + index + 2, reason });
      report.skippedTotal = skippedTotal;
    };
    const ensure = (name, parentId = null) => (name && plans()?.resolveGroups ? plans().resolveGroups(parentId ? { groupId: parentId, subgroupName: name } : { groupName: name }, user)[parentId ? "subgroupId" : "groupId"] : null);
    const before = store.get("SELECT COUNT(*) AS n FROM plan_groups").n;
    store.tx(() => {
      let autoRef = Number(nextRef()) - 1;
      rows.forEach((row, index) => {
        if (!Array.isArray(row) || !row.some(value => sanitizeCell(value))) return;
        const name = cell(row, col.name).slice(0, 160);
        if (!name) return skip(index, "Ad boş");
        const fields = [];
        for (const column of extraColumns) {
          const value = cell(row, column);
          if (value) fields.push({ label: headers[column].slice(0, 80), value: value.slice(0, 1000) });
        }
        const typed = typeOf(row);
        const person = {
          name,
          refNo: cell(row, col.seq).slice(0, 30),
          type: typed.type,
          phone: cell(row, col.phone).slice(0, 60),
          email: cell(row, col.email).slice(0, 160),
          address: cell(row, col.address).slice(0, 500),
          note: cell(row, col.note).slice(0, 2000),
          registeredOn: parseDay(cell(row, col.registered)) || today(),
          groupName: (cell(row, col.group) || defaults.groupName).slice(0, 80),
          subgroupName: cell(row, col.subgroup).slice(0, 80),
          fields: fieldsInput(fields),
          caseKey: "",
          caseSource: "",
          caseTitle: "",
        };
        const tax = { ...taxOf(row, index), taxOffice: cell(row, col.taxOffice).slice(0, 120), city: cell(row, col.city).slice(0, 80), district: cell(row, col.district).slice(0, 80) };
        const matched = matchExisting(person);
        if (matched && mode === "skip") return skip(index, "Bu cari zaten var");
        const groupId = person.groupName ? ensure(person.groupName) : null;
        const subgroupId = groupId && person.subgroupName ? ensure(person.subgroupName, groupId) : null;
        if (matched) {
          // Güncelle: dolu gelen alanlar yazılır, boş gelenler eskisi kalır; ek alanlar birleşir. Bakiye tekrar yazılmaz.
          const previous = accountRow(matched);
          const merged = [...previous.fields];
          for (const field of person.fields) {
            const at = merged.findIndex(item => item.label.toLocaleLowerCase("tr-TR") === field.label.toLocaleLowerCase("tr-TR"));
            if (at >= 0) merged[at] = field;
            else merged.push(field);
          }
          store.run(
            "UPDATE accounts SET name = ?, phone = ?, email = ?, address = ?, note = ?, registered_on = ?, group_id = ?, subgroup_id = ?, fields_json = ?, case_key = ?, case_source = ?, case_title = ?, updated_by = ?, updated_at = ? WHERE id = ?",
            person.name, person.phone || previous.phone, person.email || previous.email, person.address || previous.address, person.note || previous.note, cell(row, col.registered) ? person.registeredOn : previous.registeredOn,
            groupId || previous.groupId, subgroupId || previous.subgroupId, JSON.stringify(fieldsInput(merged)), person.caseKey || previous.caseKey, person.caseKey ? person.caseSource : previous.caseSource, person.caseKey ? person.caseTitle : previous.caseTitle, user.id, now(), matched,
          );
          plans()?.followAccount?.(matched, { name: previous.name, phone: previous.phone }, { name: person.name, phone: person.phone || previous.phone });
          // Vergi bilgisi: dolu gelen yazılır, boş gelen eskisi kalır.
          const keep = (value, old) => value || old || "";
          writeTax(matched, { ...previous, taxNo: keep(tax.taxNo, previous.taxNo), partyKind: tax.taxNo ? tax.partyKind : previous.partyKind, taxOffice: keep(tax.taxOffice, previous.taxOffice), city: keep(tax.city, previous.city), district: keep(tax.district, previous.district) });
          report.updated += 1;
          return;
        }
        // Numara: Excel'deki boş değilse ve başka caride yoksa o; değilse sıradaki boş numara (tablo taranmadan).
        let wanted = person.refNo && freeRef(person.refNo) ? person.refNo : "";
        if (!wanted) {
          if (person.refNo) report.renumbered += 1;
          do wanted = String((autoRef += 1));
          while (!freeRef(wanted));
        }
        const id = insertAccount(user, { ...person, ...tax, refNo: wanted, groupId, subgroupId });
        if (typed.warn) {
          report.typeDefaultedTotal += 1;
          if (report.typeDefaulted.length < 500) report.typeDefaulted.push({ row: headerAt + index + 2, ...typed.warn });
        }
        const opening = parseAmount(cell(row, col.balance));
        // 31e N1: eşik kuruşa yuvarlanmış tutarla (0,005 → 0,01 yazılır, 0,004 yazılmaz) — öbür içe alma yollarıyla aynı.
        if (Number.isFinite(opening) && roundMoney(Math.abs(opening)) > 0) {
          addEntry(user, id, { kind: openingKind(opening, person.type, openingSide), amount: roundMoney(Math.abs(opening)), date: person.registeredOn, note: OPENING_NOTE });
          report.balances += 1;
        }
        report.created += 1;
      });
      report.groups = store.get("SELECT COUNT(*) AS n FROM plan_groups").n - before;
      audit(user, "account.imported", "import", { created: report.created, updated: report.updated, skipped: report.skipped.length, groups: report.groups, file: limited(body.fileName, 200, "Dosya adı") });
    });
    changed(user, {});
    changed(user, { kind: "plans", groups: true });
    ok(res, report);
  });

  // ---------- Toplu taksitlendirme ----------
  // Seçilen carilere tek seferde taksit kartı: tutar herkese aynı ya da kartın bir ek alanından (ör. "SERVİS ÜCRETİ").
  router.post("/api/workspace/accounts/bulk-plan", async ({ req, res }) => {
    const user = auth.requirePermission(req, "plans.manage");
    const body = await readJson(req, { limit: 5_000_000 });
    // Seçim: kimlik listesi ya da "süzgeçteki hepsi" (all: true + liste süzgeçleri; 200 bin cari için kimlik taşınmaz).
    const fromFilter = body.all === true ? list(user, { q: text(body.q).slice(0, 120), group: text(body.group), subgroup: text(body.subgroup), type: isAccountType(text(body.type)) ? text(body.type) : "", status: ["active", "passive", "all"].includes(text(body.status)) ? text(body.status) : "active", balance: text(body.balance) || "all", plan: ["none", "has"].includes(text(body.plan)) ? text(body.plan) : "" }).accounts.map(item => item.id) : [];
    // Ön izleme (v2.0.11): hiçbir şey yazılmadan kaç kart açılacağı, toplam ve atlanacaklar (nedeniyle) döner.
    const dryRun = body.dryRun === true;
    // "Hepsini seç, sonra birkaçını çıkar": except — süzgeçteki hepsinden işareti kaldırılanlar.
    const except = new Set(body.all === true && Array.isArray(body.except) ? body.except.map(value => String(value || "")) : []);
    const ids = [...new Set((body.all === true ? fromFilter : Array.isArray(body.ids) ? body.ids : []).map(value => String(value || "").slice(0, 120)).filter(Boolean))].filter(id => !except.has(id));
    if (!ids.length) throw new HttpError(400, "Taksitlendirilecek carileri seçin.");
    if (ids.length > MAX_IMPORT) throw new HttpError(400, `Tek seferde en çok ${MAX_IMPORT} cari seçilebilir.`);
    const byField = body.amountMode === "field";
    // v2.0.13: "Carinin mevcut borcu" — her carinin taksitlendirilmemiş borcu kendi kartına bölünür; ikinci kez borç yazılmaz
    // (veresiye müşterilerin birikmiş borcunu toplu taksitlendirme).
    const byBalance = body.amountMode === "balance";
    const field = limited(body.field, 80, "Alan");
    if (byField && !field) throw new HttpError(400, "Tutarın okunacağı alanı seçin.");
    const fixed = byField || byBalance ? 0 : amountOf(body.total, "Tutar");
    if (!byField && !byBalance && !(fixed > 0)) throw new HttpError(400, "Herkese uygulanacak toplam tutarı yazın.");
    // Taksit sayısı, ilk vade ve aralık, tek kart açılırken kullanılan doğrulamadan geçer.
    const distribution = { count: Math.trunc(Number(body.count)), firstDue: text(body.firstDue), everyMonths: Math.trunc(Number(body.everyMonths) || 1) };
    plans().validDistribution({ ...distribution }, 1);
    const skipExisting = body.skipExisting !== false;
    const planName = limited(body.name, 160, "Kart adı");
    const note = limited(body.note, 1000, "Bilgi notu");
    const report = { created: 0, skipped: [], total: 0, dryRun, names: [] };
    store.tx(() => {
      const active = new Set(store.all("SELECT DISTINCT account_id AS id FROM plans WHERE deleted_at IS NULL AND status = 'active' AND account_id <> ''").map(row => row.id));
      let refNo = Number(plans().nextRef()) - 1;
      for (const id of ids) {
        const found = store.get(`${ACCOUNT_SQL} WHERE a.id = ? AND a.deleted_at IS NULL`, id);
        if (!found) {
          report.skipped.push({ name: id, reason: "Cari bulunamadı" });
          continue;
        }
        const account = withFields(found);
        if (skipExisting && !byBalance && active.has(account.id)) {
          report.skipped.push({ name: account.name, reason: "Açık taksit kartı var" });
          continue;
        }
        let total = fixed;
        if (byField) {
          const value = account.fields.find(item => item.label.toLocaleLowerCase("tr-TR") === field.toLocaleLowerCase("tr-TR"))?.value;
          total = roundMoney(parseAmount(value));
          if (!Number.isFinite(total) || total <= 0) {
            report.skipped.push({ name: account.name, reason: `“${field}” alanında tutar yok` });
            continue;
          }
        }
        if (byBalance) {
          total = plans().uncoveredDebt(account.id, user);
          if (!(total > 0)) {
            report.skipped.push({ name: account.name, reason: "Taksitlendirilecek borcu yok" });
            continue;
          }
        }
        if (!dryRun) plans().createForAccount(user, account, { total, ...distribution, name: planName ? `${account.name} · ${planName}` : "", note, refNo: String((refNo += 1)), coversBalance: byBalance });
        report.created += 1;
        report.total = roundMoney(report.total + total);
        if (report.names.length < 8) report.names.push(account.name);
      }
      if (!dryRun) audit(user, "account.bulk-plan", "bulk", { created: report.created, skipped: report.skipped.length, total: report.total, count: distribution.count, firstDue: distribution.firstDue, field: byField ? field : "", balance: byBalance });
    });
    if (!dryRun) {
      changed(user, {});
      changed(user, { kind: "plans" });
    }
    ok(res, report);
  });

  // ---------- Tablodaki kayıt ----------
  // Kişinin kartı (ortadaki tablo): kayda bağlı cari varsa özeti ve bakiyesi.
  // 2.0.18: kayıttan cari açan uç (POST cases/:key/account) kullanıcı kararıyla kaldırıldı; cari yalnız + Yeni Cari
  // ya da Excel'den açılır, kayda bağ cari formundaki "Tablodaki Kayıt" alanıyla kurulur.
  router.get("/api/workspace/cases/:key/account", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "accounts.view");
    const key = limited(params.key, 200, "Kayıt");
    const found = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND case_key = ? AND case_source = ? ORDER BY created_at LIMIT 1", key, currentSource());
    if (!found) return ok(res, { account: null, canManage: canUser(user, "accounts.manage") });
    const account = detail(found.id, user);
    ok(res, { account: { id: account.id, name: account.name, refNo: account.refNo, type: account.type, totals: account.totals, side: account.side, planCount: account.plans.length }, canManage: account.canManage });
  });

  // ---------- Diğer modüller için ----------
  // Taksit kartı açılırken cari: tablodaki aynı kayda bağlı cari varsa o, yoksa kartın bilgileriyle yeni cari.
  // outcome (isteğe bağlı): { created, linked } — aktarma geri alınırken yalnız kendi açtığı/bağladığı cariye dokunur.
  function createFromPlan(user, person, outcome = null) {
    const source = person.caseSource || currentSource();
    if (person.caseKey) {
      const found = store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND case_key = ? AND case_source = ?", person.caseKey, source);
      if (found) return found.id;
    }
    // v2.0.7: aynı ad + aynı telefon (ya da telefonsuz, aynı grupta tek aynı ad) kesin eşleşirse o cari; boşa cari açılmaz.
    // v2.0.8: kart bir kayda bağlıysa, başka bir kayda bağlı cari kullanılmaz (aynı adlı iki kişinin hesabı karışmaz).
    const matched = matchPerson({ name: person.name, phone: person.phone, groupId: person.groupId || "" });
    const owner = matched ? store.get("SELECT case_key AS caseKey, case_source AS caseSource FROM accounts WHERE id = ?", matched) : null;
    const foreign = Boolean(person.caseKey && owner?.caseKey && (owner.caseKey !== person.caseKey || owner.caseSource !== source));
    if (matched && !foreign) {
      if (person.caseKey && !owner?.caseKey) {
        store.run("UPDATE accounts SET case_key = ?, case_source = ?, case_title = ?, updated_by = ?, updated_at = ? WHERE id = ? AND case_key = ''", person.caseKey, source, person.caseTitle || person.name, user.id, now(), matched);
        if (outcome) outcome.linked = true;
      }
      return matched;
    }
    const id = insertAccount(user, { name: person.name, phone: person.phone, note: person.note, registeredOn: person.registeredOn, groupId: person.groupId, subgroupId: person.subgroupId, caseKey: person.caseKey, caseSource: person.caseKey ? source : "", caseTitle: person.caseTitle, type: "customer", fields: [] });
    audit(user, "account.created", id, { name: person.name, from: "plan" });
    if (outcome) outcome.created = true;
    return id;
  }
  // Taksit Excel'inden gelen kişi için kesin eşleşme: aynı ad + aynı telefon (7+ hane) ya da telefonsuz aynı ad + aynı grup
  // ve bu eşleşme tek olmalı. Şüpheli durumda yeni cari açılır (başka kişinin hesabına yazılmaz).
  function matchPerson(person) {
    const candidates = store.all("SELECT id, phone, group_id AS groupId FROM accounts WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE", person.name);
    const phone = digits(person.phone);
    const hits = phone.length >= 7 ? candidates.filter(row => digits(row.phone) === phone) : candidates.filter(row => !digits(row.phone) && (row.groupId || "") === (person.groupId || ""));
    return hits.length === 1 ? hits[0].id : "";
  }
  // Mizan (v2.0.7): tüm carilerin defter satırları tek geçişte. Her carinin satırları Cari kartındaki defterle aynı
  // kuraldan (accountLedger) gelir; mizan bakiyesi = Cari listesindeki bakiye.
  // invoiced (v2.0.22, bağımsız gözden geçirme bulgusu): fatura ödeme durumu yalnız faturası olan carilerin defterini ister;
  // 20.000 carili kurulumda hepsinin defterini kurmak her yazmadan sonraki ilk listeyi 0,6 sn'ye çıkarıyordu.
  // dated (2.4.5 madde 6): yalnız Vade Tarihi ya da Beklenen Ödeme Tarihi girilmiş elle borç / alacak satırı olan cariler (takvim, zil, Vade Takip).
  const DATED_SQL = "SELECT DISTINCT account_id FROM account_entries WHERE source = '' AND kind IN ('debt', 'credit') AND (due_date <> '' OR expected_date <> '')";
  function allLedgers({ invoiced = false, dated = false } = {}) {
    const scope = invoiced ? "SELECT DISTINCT account_id FROM invoices" : dated ? DATED_SQL : "";
    const only = scope ? ` AND a.id IN (${scope})` : "";
    const rows = store.all(`${ACCOUNT_SQL} WHERE a.deleted_at IS NULL${only} ORDER BY a.name COLLATE NOCASE`).map(({ fieldsJson, ...row }) => row);
    const entries = new Map();
    // v2.0.22: yol ve "Kapatılacak Fatura" bağı da (Cari kartındaki defterle aynı satır; fatura kapamada kullanılır).
    for (const entry of store.all(`SELECT id, account_id AS accountId, kind, amount, date, note, method, receipt_no AS receiptNo, source, source_id AS sourceId, invoice_id AS invoiceId, created_at AS createdAt FROM account_entries${scope ? ` WHERE account_id IN (${scope})` : ""} ORDER BY date, created_at, rowid`)) {
      if (!entries.has(entry.accountId)) entries.set(entry.accountId, []);
      entries.get(entry.accountId).push(entry);
    }
    const planMap = plans()?.ledgerPlansByAccount ? plans().ledgerPlansByAccount() : new Map();
    const lines = new Map();
    for (const row of rows) lines.set(row.id, accountLedger(entries.get(row.id) || [], planMap.get(row.id) || []).lines);
    return { accounts: rows, lines };
  }
  // Kasa (v2.1.0, K5): cari tahsilat ve ödemeleri Kasa'ya tek kaynaktan (lib/bank/money-lines.mjs, kaynak 3) düşer; silinen carinin
  // hareketi orada da düşer.
  // Stok hareketi cariye yazılınca (routes/stock.mjs): borç/alacak satırı stok hareketine bağlı açılır, düzeltilir, silinir.
  const stockEntry = {
    upsert(user, move, { accountId, kind, amount, date, note }) {
      // Açık hesaba yazılan stok hareketinin cari borcu/alacağı para satırı değildir (Kasa'yı değiştirmez).
      const existing = store.get("SELECT id FROM account_entries WHERE source = 'stock' AND source_id = ?", move);
      let id = existing?.id;
      if (existing) store.run("UPDATE account_entries SET account_id = ?, kind = ?, amount = ?, date = ?, note = ?, updated_by = ?, updated_at = ? WHERE id = ?", accountId, kind, amount, date, note, user.id, now(), existing.id);
      else id = addEntry(user, accountId, { kind, amount, date, note, source: "stock", sourceId: move }).id;
      // Yazılan satırın kendisi denetlenir (gözden geçirme D10).
      bank.assertWrittenNonMoney("account_entries", id);
    },
    remove(move) {
      const existing = store.get("SELECT account_id AS accountId FROM account_entries WHERE source = 'stock' AND source_id = ?", move);
      store.run("DELETE FROM account_entries WHERE source = 'stock' AND source_id = ?", move);
      return existing?.accountId || "";
    },
  };
  // v2.0.15: e-Belge kimliği. Mükellef sorgusundan (entegratör) gelen e-Fatura kullanıcılığı ve posta kutusu etiketi; gelen
  // e-Faturanın satıcısı için cari: önce VKN/TCKN ile aranır (kişi bir kez girilir), yoksa vergi bilgileriyle açılır.
  // 2.4.4 (31f U1): "Nihai Tüketici" carisinin kimliği (taxIdentity.retailAccount).
  const RETAIL_ACCOUNT_KEY = "invoice.retailAccountId";
  const taxIdentity = {
    findByTaxNo: taxNo => (taxNo ? store.get("SELECT id FROM accounts WHERE deleted_at IS NULL AND tax_no = ? ORDER BY created_at LIMIT 1", String(taxNo).replace(/\s+/g, ""))?.id || "" : ""),
    setEInvoice(user, accountId, { registered, alias = "", aliases = null, title = "" }) {
      const row = accountRow(accountId);
      // 2.4.3 (uzman UX5): mükellefin birden çok posta kutusu varken (alias boş gelir) kullanıcının daha önce Mükellef Sorgula ile SEÇTİĞİ etiket
      // silinmez; liste verilmişse etiket listede olmalıdır (başka mükellefin etiketi kalmaz). Önceden işaret geri konurken etiket boşalıyordu.
      const keep = registered && !alias && row.eAlias && (!Array.isArray(aliases) || aliases.includes(row.eAlias)) ? row.eAlias : "";
      store.run("UPDATE accounts SET e_invoice = ?, e_alias = ?, updated_by = ?, updated_at = ? WHERE id = ?", registered ? 1 : 0, registered ? String(alias || keep).slice(0, 160) : "", user.id, now(), row.id);
      audit(user, "account.einvoice.checked", row.id, { registered, alias, title });
      touched(user, row);
      return accountRow(row.id);
    },
    createForParty(user, party, type = "supplier") {
      const existing = taxIdentity.findByTaxNo(party.taxNo);
      if (existing) return existing;
      const input = accountInput({ name: party.name || party.taxNo, type, phone: party.phone, email: party.email, address: party.address, taxNo: party.taxNo, taxOffice: party.taxOffice, partyKind: party.partyKind, firstName: party.firstName, familyName: party.familyName, city: party.city, district: party.district, postalCode: party.postalCode, country: party.country, website: party.website, mersisNo: party.mersisNo, tradeRegistry: party.tradeRegistry }, user);
      const id = insertAccount(user, input);
      audit(user, "account.created", id, { name: input.name, type, from: "einvoice" });
      return id;
    },
    // 2.4.4 (31f U1, YÜKSEK; 2.4.3'te de): faturadaki "Nihai Tüketici" hızlı seçeneğinin carisi. Önceden 11111111111'li EN ESKİ cari seçiliyordu;
    // adı belli bir kişiye (ör. "Ayşe Şahin") bu numara yazılmışsa anonim perakende satışlar onun carisine borç yazılıyordu. Şimdi program kendi
    // carisini ayar anahtarında kimliğiyle tanır (Banka Ayarları'ndaki Varsayılan Tahsilat Hesabı kalıbı; ayar şirketin veri dosyasında, yedekle
    // birlikte gider). Kural (sırayla):
    //   1. İşaretli cari geçerliyse o: silinmemiş, VKN/TCKN'si hâlâ 11111111111 ve adı "Nihai Tüketici" (harf büyüklüğü/boşluk gözetilmez). Pasif cari
    //      geçerlidir (pasif cari faturayı engellemez). Adı ya da kimliği değiştirilmiş cari artık bu rolde değildir.
    //   2. Değilse (ilk kullanım, eski sürüm verisi, silinmiş/yeniden adlandırılmış cari): silinmemiş, 11111111111'li ve adı "Nihai Tüketici" olan
    //      carilerin EN ESKİSİ (açılış zamanı, eşitse yazım sırası) benimsenir ve işaretlenir.
    //   3. O da yoksa yeni "Nihai Tüketici" carisi açılır ve işaretlenir. Adı belli bir cari hiçbir adımda seçilmez.
    // Tek işlem içinde (eşzamanlı iki istek iki cari açmaz). Tutar sınırı (ANONYMOUS_LIMIT) ve e-Arşiv kuralları belge denetiminde, değişmez.
    retailAccount(user, { city = "", district = "" } = {}) {
      return store.tx(() => {
        const usable = id => {
          const row = id ? store.get("SELECT id, name, tax_no AS taxNo FROM accounts WHERE id = ? AND deleted_at IS NULL", id) : null;
          return row && row.taxNo === ANONYMOUS_TCKN && isRetailName(row.name) ? row.id : "";
        };
        const previous = store.setting(RETAIL_ACCOUNT_KEY, "") || "";
        const marked = usable(previous);
        if (marked) return { id: marked, created: false, adopted: false };
        const adopted = store.all("SELECT id, name FROM accounts WHERE deleted_at IS NULL AND tax_no = ? ORDER BY created_at, rowid", ANONYMOUS_TCKN).find(row => isRetailName(row.name))?.id || "";
        let id = adopted;
        if (!id) {
          const input = accountInput({ name: RETAIL_NAME, type: "customer", taxNo: ANONYMOUS_TCKN, partyKind: "person", firstName: "Nihai", familyName: "Tüketici", city, district, country: "Türkiye" }, user);
          id = insertAccount(user, input);
          audit(user, "account.created", id, { name: input.name, type: "customer", from: "retail" });
        }
        store.setSetting(RETAIL_ACCOUNT_KEY, id, user.id);
        audit(user, "account.retail.marked", id, { adopted: Boolean(adopted), previous });
        return { id, created: !adopted, adopted: Boolean(adopted) };
      });
    },
  };
  // 2.3.0 İz 1 (plan §3.11b/3 "Değersiz Alacak Yaz … cari bakiyesi o tutar kadar kapanır"): şüpheli alacağın değersiz yazılması cari kartına
  // ALACAK satırı yazar (source 'doubtful', source_id = şüpheli alacak kaydı; para satırı değil, olay yok). Yevmiyesi B 129/659 / A 128
  // (lib/doubtful-gl.mjs). Satır cari kartından düzeltilmez/silinmez (requireEntryRight); kaydın kendi silmesi (reinsert ile geri yükleme).
  const doubtfulEntry = {
    add(user, accountId, { amount, date, note, recordId }) {
      const id = addEntry(user, accountId, { kind: "credit", amount: amountOf(amount), date, note: limited(note, 300, "Açıklama"), source: "doubtful", sourceId: recordId }).id;
      bank.assertWrittenNonMoney("account_entries", id);
      return { id };
    },
    remove(entryId) {
      return store.run("DELETE FROM account_entries WHERE id = ? AND source = 'doubtful'", entryId).changes;
    },
    // Silinenler'den geri yükleme: aynı kimlik, tarih ve tutarla (Değersiz Alacak satırı).
    reinsert(user, row) {
      store.run(
        "INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, method, invoice_id, fin_ref, event_id, created_by, created_at) VALUES (?, ?, 'credit', ?, ?, ?, NULL, 'doubtful', ?, 'cash', '', '', '', ?, ?)",
        row.id, row.account_id, amountOf(row.amount), row.date, String(row.note || ""), row.source_id, row.created_by || user.id, row.created_at || now(),
      );
      bank.assertWrittenNonMoney("account_entries", row.id);
      return { id: row.id };
    },
  };
  // v2.0.15: faturadan doğan cari satırları (borç/alacak + varsa peşin tahsilat/ödeme). source = 'invoice', source_id = fatura.
  // Kasa'ya etkisi fatura modülünün kendi kaynağından gelir (routes/invoices.mjs cashSource); cari kartından düzeltilemez.
  const invoiceEntry = {
    add(user, accountId, { kind, amount, date, note, invoiceId, method = "cash", eventId = "", finRef = "", pos = null }) {
      return addEntry(user, accountId, { kind, amount, date, note, source: "invoice", sourceId: invoiceId, method, eventId, finRef, pos });
    },
    removeFor(invoiceId) {
      return store.run("DELETE FROM account_entries WHERE source = 'invoice' AND source_id = ?", invoiceId).changes;
    },
  };
  // 2.2.0 (plan §7 "POST /bank/pos/sales/:id/refund · void"): Banka → POS İşlemleri'nden cari satırı. refund: cari "POS İadesi" (cari kartındaki
  // ile aynı satır, aynı yetki: ödeme girişi + bankadan çıkış); remove: POS İşlemleri → İptal Et (void; satır Silinenler'e gider).
  const posEntry = {
    refund(user, accountId, { amount, date, note = "", posId = "", refundOf = "", requestId = "" }) {
      requireKindRight(user, "out");
      if (!canUser(user, "bank.move")) throw new HttpError(403, 'POS İadesi için "Banka Hareketi Girme ve Bankadan Çıkış" yetkisi gerekir.', { code: "bank-permission", permission: "bank.move" });
      const account = accountRow(accountId);
      const input = { kind: "out", amount, date, note: limited(note, 300, "Açıklama"), method: "card", invoiceId: "" };
      period?.assertOpen(date, "Cari hareketi");
      const finRef = refOf(input, { posId, posRefundOf: refundOf, posRefund: true });
      const created = bank.post({
        user, module: "account", op: "create", requestId, scope: "account.entry.create", body: { accountId: account.id, amount, date, posId, refundOf },
        write: () => {
          const entry = addEntry(user, account.id, { ...input, finRef, pos: { installments: 1, authCode: "", cardLast4: "", refundOf, sourceless: false } });
          audit(user, "account.entry.out", entry.id, { accountId: account.id, accountName: account.name, ...input, finRef, posRefundOf: refundOf });
          return entry;
        },
      });
      touched(user, account);
      changed(user, { kind: "cash" });
      return created;
    },
    remove(user, entryId) {
      const head = store.get("SELECT account_id AS accountId FROM account_entries WHERE id = ?", text(entryId));
      if (!head) throw new HttpError(404, "Hareket bulunamadı. Başka biri silmiş olabilir.");
      const account = accountRow(head.accountId);
      const previous = entryOf(account.id, entryId);
      requireEntryRight(user, previous);
      period?.assertOpen(previous.date, "Bu cari hareketi");
      assertOffsetFree(previous);
      const result = bank.post({
        user, module: "account", op: "delete", prev: previous, posOutcome: "void",
        write: () => {
          store.run("DELETE FROM account_entries WHERE id = ?", previous.id);
          trash?.add({ kind: "account-entry", ref: previous.id, title: account.name, detail: previous.note || KIND_TEXT[previous.kind], payload: { ...previous, accountId: account.id, accountName: account.name }, user });
          audit(user, "account.entry.deleted", previous.id, { accountId: account.id, ...previous, posVoid: true });
          return { id: previous.id };
        },
      });
      touched(user, account);
      changed(user, { kind: "cash" });
      return result;
    },
  };
  // ---------- 2.4.5 madde 6: carinin vadeli / sözlü borç kayıtları (BAŞ MİMAR KARARI K6.3) ----------
  // Kalan > 0 olan VE Vade Tarihi ya da Beklenen Ödeme Tarihi girilmiş elle Borç / Alacak ve Açılış Bakiyesi bir kalemdir: tarih Beklenen Ödeme Tarihi
  // varsa o ("(Ödeme Sözü)"), yoksa Vade Tarihi; tutar Kalan (fatura kapamasıyla aynı kuyruk, routes/invoices.mjs allEntryStates). Kalanın Mevcut Borç
  // kartınca kapsanan kısmı (covered) kartın taksitleriyle gelir, burada düşülür (birleşik listelerde bir kez — açık faturadaki covered kuralı). Silinmiş
  // carinin satırı kalem değildir. openDueItems ufuksuzdur (Vade Takip kendi aralığını süzer); dueItems takvim / zil ufku (faturayla aynı: geçmişin
  // tamamı + bugünden DUE_WINDOW.aheadDays gün). "Ödendi Say" yoktur: kalem para kaydıyla (tahsilat / ödeme) kapanır.
  const DUE_SQL = `SELECT e.id, e.account_id AS accountId, e.kind, e.amount, e.date, e.due_date AS dueDate, e.expected_date AS expectedDate, a.name, a.phone, a.ref_no AS refNo
    FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
    WHERE e.source = '' AND e.kind IN ('debt', 'credit') AND (e.due_date <> '' OR e.expected_date <> '') ORDER BY e.rowid`;
  const dayGap = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  function openDueItems(day = today()) {
    const rows = store.all(DUE_SQL);
    const states = rows.length && invoiceModule()?.allEntryStates ? invoiceModule().allEntryStates() : null;
    if (!states) return [];
    const out = [];
    for (const row of rows) {
      const state = states.get(row.id);
      if (!state) continue;
      const amount = roundMoney(state.remaining - (state.covered || 0));
      if (!(amount > EPS)) continue;
      const promise = Boolean(row.expectedDate);
      const dueDate = row.expectedDate || row.dueDate;
      const days = dayGap(day, dueDate);
      const incoming = row.kind === "debt";
      out.push({
        id: `account|${row.id}`,
        source: "account",
        accountId: row.accountId,
        entryId: row.id,
        direction: incoming ? "in" : "out",
        person: row.name,
        label: `${incoming ? "Tahsil Edilecek Borç" : "Ödenecek Borç"}${promise ? " (Ödeme Sözü)" : ""}`,
        dueDate,
        dueText: dayText(dueDate),
        amount,
        days,
        state: days === 0 ? "today" : days < 0 ? "overdue" : "upcoming",
        // Bilgi (ekran): kaydın tarihi, tutarı, kendi vade ve beklenen ödeme tarihi; kısmen kapanmış mı.
        entryDate: row.date,
        entryAmount: roundMoney(Number(row.amount) || 0),
        entryDueDate: row.dueDate,
        expectedDate: row.expectedDate,
        partial: amount < roundMoney(Number(row.amount) || 0) - EPS,
        phone: row.phone || "",
        // Aynı adlı iki cari takvimde ve zilde Cari No ile ayrılır (taksit kalemindeki accountRef ile aynı alan; 2.4.3 keşif A21).
        accountRef: row.refNo || "",
        caseNo: "",
        caseKey: "",
        tab: "",
        kind: "date",
      });
    }
    return out;
  }
  const dueItems = (day = today()) => openDueItems(day).filter(item => item.days <= DUE_WINDOW.aheadDays);
  // Takvim önbelleğinin anahtarı (routes/dues.mjs): satır sayısı / son damga / tutar toplamı + tarihli satırların tarihleri (durağan sahte saatte de
  // yalnız tarih değişince ayırt eder) + carilerin silinmesi / adı + mahsup fişleri (Kalan'ı değiştirir).
  const dueFingerprint = () => {
    const row = store.get("SELECT COUNT(*) AS n, COALESCE(MAX(COALESCE(updated_at, created_at)), '') AS at, TOTAL(amount) AS total FROM account_entries");
    const dated = store.get("SELECT COALESCE(group_concat(id || '=' || kind || '=' || due_date || '/' || expected_date, ','), '') AS d FROM (SELECT id, kind, due_date, expected_date FROM account_entries WHERE source = '' AND (due_date <> '' OR expected_date <> '') ORDER BY rowid)").d;
    const people = store.get("SELECT COUNT(*) || '/' || COUNT(deleted_at) || '/' || COALESCE(MAX(updated_at), '') AS f FROM accounts").f;
    const offsets = hasOffsets() ? store.get("SELECT COUNT(*) || '/' || TOTAL(amount) AS f FROM invoice_offsets").f : "";
    return createHash("sha256").update([row.n, row.at, row.total, dated, people, offsets].join("|")).digest("base64url").slice(0, 22);
  };
  const fingerprint = () => {
    const row = store.get("SELECT (SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(updated_at, created_at)), '') FROM account_entries) AS e, (SELECT COUNT(*) || '/' || COALESCE(MAX(updated_at), '') || '/' || COUNT(deleted_at) FROM accounts) AS a");
    return `${row.e}|${row.a}`;
  };
  // Silinenler (routes/trash.mjs): silinen cariler ve cari hareketleri.
  const deletedList = () =>
    store.all("SELECT a.id, a.name, a.ref_no AS refNo, a.deleted_at AS deletedAt, COALESCE(u.display_name, '') AS actorName FROM accounts a LEFT JOIN users u ON u.id = a.deleted_by WHERE a.deleted_at IS NOT NULL").map(item => ({
      id: `account:${item.id}`,
      kind: "account",
      title: item.name,
      detail: item.refNo ? `Cari No ${item.refNo}` : "",
      deletedAt: item.deletedAt,
      actorName: item.actorName,
      restorable: true,
      note: "Hareketleriyle Cari listesine geri döner; Kasa yeniden hesaplanır.",
    }));
  function restoreDeleted(user, id) {
    const account = store.get("SELECT id, name FROM accounts WHERE id = ? AND deleted_at IS NOT NULL", id);
    if (!account) throw new HttpError(404, "Bu cari zaten geri yüklenmiş.");
    // v2.0.26 (A3): kapanmış dönemde hareketi olan cari geri yüklenmez (satırları kilitli mizana geri dönerdi).
    assertUnlocked(account.id, "geri yüklenemez");
    store.tx(() => {
      // Numara bu arada başka bir cariye verildiyse geri gelen cari sıradaki boş numarayı alır (iki carinin aynı numarası olmaz).
      const current = store.get("SELECT ref_no AS refNo FROM accounts WHERE id = ?", account.id)?.refNo || "";
      const refNo = freeRef(current) || nextRef();
      store.run("UPDATE accounts SET deleted_at = NULL, deleted_by = NULL, ref_no = ?, updated_by = ?, updated_at = ? WHERE id = ?", refNo, user.id, now(), account.id);
      audit(user, "account.restored", account.id, { name: account.name, refNo, renumbered: refNo !== current });
    });
    changed(user, { accountId: account.id });
    changed(user, { kind: "cash" });
    return `“${account.name}” carisi geri geldi.`;
  }
  // Silinenler'den dönen borç / alacağın tarihleri: yükteki değer gerçek gün ve kaydın tarihinden önce değilse (bozuk yükte boş döner).
  const restoredDue = payload => {
    if (!DUE_KINDS.has(payload.kind)) return ["", ""];
    const keep = value => (realDay(text(value)) && text(value) >= String(payload.date || "") ? text(value) : "");
    return [keep(payload.dueDate), keep(payload.expectedDate)];
  };
  function restoreEntry(user, item, payload, { force = false, banking = null } = {}) {
    if (!KIND_TEXT[payload.kind]) throw new HttpError(409, "Hareketin bilgisi eksik; geri yüklenemez.");
    const account = store.get("SELECT id, deleted_at AS deletedAt FROM accounts WHERE id = ?", payload.accountId);
    if (!account) throw new HttpError(409, "Hareketin carisi artık yok; geri yüklenemez.");
    if (account.deletedAt) throw new HttpError(409, `“${payload.accountName}” carisi silinmiş. Önce cariyi geri yükleyin.`);
    // v2.0.26 (A7): kapanmış dönemdeki hareket geri yüklenmez; bütün kolonlar (yol, Kapatılacak Fatura bağı) taşınır, tutar
    // kuruşa yuvarlanır. Önceden kaynak boş, fatura bağı yok yazılıyor, tutar olduğu gibi alınıyordu.
    period?.restoreDate(payload.date, "Bu cari hareketi");
    // Silinenler'e yalnız elle girilen satır gider (stok, çek, fatura satırı kendi modülünden silinir).
    if (payload.source) throw new HttpError(409, "Bu hareket başka bir modülden (stok, çek/senet, fatura) geliyordu; o modülden yeniden girin.");
    const method = methodInput(payload.method);
    const amount = roundMoney(Number(payload.amount) || 0);
    if (!(amount > 0)) throw new HttpError(409, "Hareketin tutarı okunamadı; geri yüklenemez.");
    // Kapatılacak Fatura bağı: fatura hâlâ aynı carinin, kaydedilmiş, aynı yöndeki taksitsiz faturasıysa korunur; değilse bağsız döner.
    let invoiceId = "";
    if (payload.invoiceId) {
      try {
        invoiceId = invoiceLink(account.id, payload.kind, payload.invoiceId);
      } catch {
        invoiceId = "";
      }
    }
    // v2.1.0 (bank.post op 'restore'): para satırı silinmeden önceki işlem başlığıyla döner (olay yeniden etkin). GG2 (K13/7): banka hesabı
    // bağıyla döner (önceden bağ düşüyor, tutar hesaptan Hesabı Atanmamış'a geçiyordu); hesap silinmişse bağsız döner ve söylenir.
    const kept = ["in", "out"].includes(payload.kind) ? bank.keepRef(payload.finRef, { method, date: payload.date }) : { ref: "", dropped: "" };
    // Yargıç K2 (plan §3.8, §9.2/7, §3.9): banka bağlı satırda kaynak modül yetkisi + bank.move, pasif hesap 400, K7 son durumla.
    const k7 = banking?.restore(user, { refs: [kept.ref], date: payload.date, force, permission: payload.kind === "in" ? "accounts.collect" : "accounts.manage" }) || { capture() {}, guard: null, prime() {} };
    const result = bank.post({
      user,
      module: "account",
      op: "restore",
      prev: payload,
      guard: k7.guard,
      write: () => {
        k7.capture();
        if (!store.get("SELECT 1 AS found FROM account_entries WHERE id = ?", item.ref)) {
          store.run(
            // Karar 15.10.2026: "Normal Cari Hesaba İşle" işareti (doubtful_skip) silinmeden önceki hâliyle döner.
            "INSERT INTO account_entries (id, account_id, kind, amount, date, note, receipt_no, source, source_id, method, invoice_id, fin_ref, event_id, created_by, created_at, updated_by, updated_at, doubtful_skip, due_date, expected_date) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            item.ref, account.id, payload.kind, amount, payload.date, payload.note || "", payload.receiptNo || null, method, invoiceId, kept.ref,
            bank.eventFor("account_entries", { kind: payload.kind, source: "", date: payload.date, method, event_id: payload.eventId || "" }), payload.createdBy || user.id, payload.createdAt || now(), user.id, now(),
            payload.kind === "in" && (payload.doubtfulSkip === true || Number(payload.doubtfulSkip) === 1) ? 1 : 0,
            // 2.4.5 madde 6: Vade Tarihi / Beklenen Ödeme Tarihi silinmeden önceki hâliyle (2.4.4'te silinen satırın yükünde yok → boş).
            ...restoredDue(payload),
          );
        }
        trash.markRestored(item.id, user);
        audit(user, "account.entry.restored", item.ref, { accountId: account.id, kind: payload.kind, amount, date: payload.date, method, invoiceId, droppedInvoice: payload.invoiceId && !invoiceId ? payload.invoiceId : "" });
      },
    });
    k7.prime(result);
    changed(user, { accountId: account.id });
    changed(user, { kind: "cash" });
    if (payload.invoiceId && !invoiceId) {
      // v2.0.26 (gözden geçirme G8): hangi fatura ve neden bağlanmadığı söylenir (önceki cümle yarım kalıyordu).
      const dropped = store.get("SELECT number, status, plan_id AS planId FROM invoices WHERE id = ?", payload.invoiceId);
      const why = !dropped ? "silindiği için" : dropped.status === "cancelled" ? "iptal edildiği için" : dropped.status !== "issued" ? "kaydedilmiş olmadığı için" : dropped.planId ? "taksitli olduğu (kendi taksit kartıyla kapandığı) için" : "artık bu hareketle kapatılamadığı için";
      return `Cari hareketi geri eklendi. Bağlı olduğu ${dropped?.number ? `${dropped.number} faturası` : "fatura"} ${why} faturaya bağlanmadı; otomatik kapamaya girer.`;
    }
    return `Cari hareketi geri eklendi; bakiye ve Kasa yeniden hesaplandı.${kept.dropped ? ` ${bank.droppedText(kept.dropped)}` : ""}`;
  }

  return { exists, accountRow, createFromPlan, matchPerson, stockEntry, invoiceEntry, posEntry, doubtfulEntry, taxIdentity, fingerprint, deletedList, restoreDeleted, restoreEntry, detail, list, allLedgers, assertUnlocked, invoiceLink, dueItems, openDueItems, dueFingerprint };
}
