// ANLIK DURUM (v2.0.7): ana ekrandaki canlı özet kartı ve "Rapor Al" raporları (mizan, cari ekstre, nakit akışı).
//
// Tek kaynak ilkesi: karttaki her rakam, ilgili ekranın kendi hesabından okunur (ayrı bir sorguyla yeniden türetilmez):
//   Nakit Kasa     = Kasa ekranındaki nakit bakiye (cash.summary → cashOnly); Banka / POS ayrı kart (noncash)
//   Kritik stok   = Stok listesindeki "Kritik" sayısı (stock.list → totals.low; hizmet kalemleri hariç)
//   Toplam alacak = Cari listesindeki "Bize borçlu" toplamı (tüm cariler, pasifler dahil) + portföydeki alınan çek/senet
//   Toplam borç   = Cari listesindeki "Biz borçluyuz" toplamı + ödenecek verilen çek/senet
// Sonuç, tüm kaynakların parmak izi ve bugünün tarihiyle önbelleğe alınır; bir hareket girilince parmak izi değişir.
// Para ya da stok değiştiren her olaydan sonra herkese (işlemi yapan dahil) tek "overview.changed" olayı gider; açık
// kartlar kendini yeniler.
import { dueList, groupFlows, isAllTimeStart, presetRange, projection, statement, trialBalance } from "../lib/finance-report.mjs";
import { HttpError, limited, ok, sendBuffer, text } from "../lib/http.mjs";
import { foldText } from "../lib/insight/validators.mjs";
import { roundMoney } from "../lib/money.mjs";
import { canUser } from "../lib/permissions.mjs";
import { dayText, isoDay } from "../lib/plans.mjs";
import { tablePdf, tl } from "../lib/report-pdf.mjs";
import { buildXlsx } from "../lib/xlsx-write.mjs";
import { systemClock } from "../lib/clock.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => {
  if (!DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};
// v2.1.0: banka yazımları (hesap, açılış, sihirbaz) da ANLIK DURUM'un Banka kutusunu ve açık pencereleri yeniler.
// v2.1.0 Aşama 14 (plan §8.9 C10): faturanın peşin tahsilatı/ödemesi (nakit, havale) de Kasa ve Banka kutusunu değiştirir; "invoices" de yeniler.
const OVERVIEW_KINDS = new Set(["cash", "accounts", "plans", "stock", "cheques", "bank", "invoices"]);
const MAX_RANGE_DAYS = 36_600; // 100 yıl (yalnız doğrulama; "tüm zaman" mizanı için geniş aralık serbest)
const PDF_ROWS = 20_000;
const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
// Kalıtımsız (v2.0.22): süzgeçteki "constructor" gibi adlar tür sayılmaz.
const TYPE_TEXT = Object.freeze(Object.assign(Object.create(null), { customer: "Müşteri", supplier: "Tedarikçi", other: "Diğer" }));
// legacy (2.1.0 temel sürüm, küçük düzeltmeler): eski sürümden kalan, hesaba atanmamış İLERİ TARİHLİ havale / POS satırı (102.00 / 108.00).
// Önceden "Kasa (ileri tarihli)" yazılıyordu (Nakit Kasa'da olmayan bir hareket). Ekran (hof-overview.js ROW_LABELS), PDF ve Excel aynı adı yazar.
const SOURCE_TEXT = { plan: "Taksit", cheque: "Çek", note: "Senet", invoice: "Fatura (vadeli)", cash: "Kasa (ileri tarihli)", legacy: "Hesabı Atanmamış (ileri tarihli)", table: "Tablo", promise: "Ödeme sözü", deadline: "Son tarih" };
// Vade takip kaynakları (v2.0.9) ve görme koşulu: çek/senet ve Kasa, ANLIK DURUM yetkisi ya da o modülün yetkisiyle.
const DUE_SOURCES = ["plan", "cheque", "note", "invoice", "cash", "table", "promise", "deadline"];
const STATE_TEXT = { overdue: "Gecikmiş", today: "Bugün", month: "Bu ay", upcoming: "Yaklaşan" };
const GROUPS = new Set(["day", "week", "month"]);

const MONEY_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function registerOverviewRoutes(router, { store, auth, audit, events, dataset = null, cash = () => null, accounts = () => null, plans = () => null, stock = () => null, cheques = () => null, invoices = () => null, tables = () => null, money: moneyApi = null, bankAccounts = null, now: clock = systemClock }) {
  const today = () => isoDay(clock());
  const office = () => store.setting("office.name", "");
  const userName = user => user.display_name || user.username || "";

  // ---------- Canlı olay: para/stok değişince herkese tek "overview.changed" ----------
  let timer = null;
  const kinds = new Set();
  events?.tap?.((event, data) => {
    // v2.0.22: yalnız bilgi düzeltmesi (cari notu, adresi…) para ve stok sayısını değiştirmez; ANLIK DURUM yenilenmez.
    if (event !== "workspace.changed" || !OVERVIEW_KINDS.has(data?.kind) || data?.info) return;
    kinds.add(data.kind);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const list = [...kinds];
      kinds.clear();
      events.publish("overview.changed", { kinds: list, at: clock().toISOString() });
    }, 250);
    timer.unref?.();
  });

  // ---------- Kart verisi ----------
  const tableState = table => {
    const row = store.get(`SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(updated_at, created_at)), '') AS state FROM ${table}`);
    return row?.state || "";
  };
  let eventsTable = null;
  const hasEvents = () => (eventsTable ??= Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'fin_events'")));
  const fingerprint = day =>
    [
      day,
      tableState("payments"),
      tableState("cash_entries"),
      plans()?.fingerprint?.() || "",
      accounts()?.fingerprint?.() || "",
      stock()?.fingerprint?.() || "",
      cheques()?.fingerprint?.() || "",
      invoices()?.fingerprint?.() || "",
      // v2.1.0: işlem başlıkları (Banka Fişi dahil; tek kaynağın 9. kaynağı banka fişi satırlarıdır).
      hasEvents() ? tableState("fin_events") : "",
      // Aşama 14 (K10): banka hesap kartları (hesap açma/silme, Pasife Al, tür) Banka kutusunu değiştirir.
      hasEvents() ? tableState("bank_accounts") : "",
    ].join("|");
  let cache = { key: "", value: null };
  // Banka kutusu (v2.1.0 Aşama 14, K10; plan §8.4, §8.9): ana değer Gerçek Banka (Σ 102, hesaba atanmış) — Banka penceresinin Genel Bakış'ıyla
  // aynı tanım ve aynı ad (bankAccounts.summary). Kart ve Kredi Borcu (309 + 300) ve Hesabı Atanmamış Eski Hareketler (102.00 + 108.00) ayrı
  // satırlardır, hiçbir varlık toplamına girmez. Bugün Giriş / Çıkış yalnız dış hareket; iç hareket (Kasa ↔ Banka, bankalar arası transfer, kredi,
  // kart borcu) "Transfer" satırında (moneyLines.flows; §3.4). POS Bekleyen ve Blokeli POS 2.2.0'da (POS); bu sürümde 0 ve görünmez.
  // Bilinçli değişiklik (§8.9): cash.bank.balance artık Gerçek Banka'dır; eski "Banka / POS" değeri (havale + POS, hesaba atanmış ya da değil)
  // = Gerçek Banka + Hesabı Atanmamış Eski Hareketler (+ POS Bekleyen) (§10.5 kabul ölçütü).
  const bankService = () => (typeof bankAccounts === "function" ? bankAccounts() : bankAccounts);
  const moneyLines = () => (typeof moneyApi === "function" ? moneyApi() : moneyApi);
  const minorTl = minor => roundMoney((Number(minor) || 0) / 100);
  const futureOf = summary => {
    const future = summary?.unassigned?.future;
    return future?.count ? { count: future.count, total: minorTl(future.totalMinor), firstDate: future.firstDate } : null;
  };
  function bankBlock(day, legacy) {
    const service = bankService();
    const summary = service?.summary ? service.summary() : null;
    if (!summary) return { balance: legacy.balanceToday, allEntries: legacy.balance, today: legacy.today };
    const flows = moneyLines()?.flows ? moneyLines().flows(day, `${day.slice(0, 7)}-01`) : null;
    const kinds = store.all("SELECT DISTINCT kind FROM bank_accounts WHERE deleted_at IS NULL").map(row => row.kind);
    const flow = item => ({ in: minorTl(item?.inMinor), out: minorTl(item?.outMinor), transferIn: minorTl(item?.transferInMinor), transferOut: minorTl(item?.transferOutMinor) });
    const today = flow(flows?.today);
    const month = flow(flows?.month);
    return {
      labels: summary.labels,
      defined: summary.realBank.defined,
      balance: minorTl(summary.realBank.minor),
      today: { in: today.in, out: today.out },
      transfer: { in: today.transferIn, out: today.transferOut },
      month,
      debt: { card: minorTl(summary.debt.cardMinor), loan: minorTl(summary.debt.loanMinor), total: minorTl(summary.debt.totalMinor), shown: kinds.some(kind => kind === "card" || kind === "loan") },
      // Hesabı Atanmamış: bugüne kadarki satırlar (bankAccounts.summary; tek formül). Eski sürümden kalan ileri tarihli satırlar ayrı bilgi.
      unassigned: { bank: minorTl(summary.unassigned.bankMinor), card: minorTl(summary.unassigned.cardMinor), total: minorTl(summary.unassigned.totalMinor), future: futureOf(summary) },
      posNet: minorTl(summary.posPending?.netMinor),
      posBlocked: minorTl(summary.posPending?.blockedMinor),
      pos: false,
    };
  }
  function compute() {
    const day = today();
    const key = fingerprint(day);
    if (cache.key === key && cache.value) return cache.value;
    const admin = { id: "", role: "admin" };
    const started = Date.now(); // saat: gerçek (süre ölçümü)
    // Kasa: Kasa ekranıyla aynı kaynak tanımlarından SQL toplamı (satırlar belleğe alınmaz). Bakiye, Kasa ekranındaki
    // "güncel kasa" gibi tüm hareketleri kapsar.
    const cashSummary = cash()?.summary ? cash().summary(day) : { balance: 0, today: { in: 0, out: 0 }, month: { in: 0, out: 0 }, futureEntries: 0 };
    // Kart "bugünkü kasa"yı gösterir (ileri tarihli kira/maaş henüz kasadan çıkmadı); nakit akışı da buradan başlar.
    // Kasa ekranındaki "güncel kasa (tüm hareketler)" ileri tarihlileri de içerir; fark kartta ayrıca yazılır.
    // v2.0.17 (müşteri): Kasa yalnız nakit → kart "Nakit Kasa"; banka tarafı (havale/EFT + POS/kredi kartı) ayrı kart.
    const nakit = cashSummary.cashOnly || { balance: cashSummary.balance, balanceToday: cashSummary.balanceToday, today: cashSummary.today, month: cashSummary.month, futureEntries: cashSummary.futureEntries };
    const banka = cashSummary.noncash || { balance: 0, balanceToday: 0, today: { in: 0, out: 0 } };
    const cashBlock = { balance: nakit.balanceToday, allEntries: nakit.balance, today: nakit.today, month: nakit.month, futureEntries: nakit.futureEntries, byMethod: cashSummary.byMethod || null, byMethodAt: cashSummary.byMethodAt || null, bank: bankBlock(day, banka) };
    // Stok: Stok listesiyle aynı sayım (hizmet kalemleri kritik/tükendi sayılmaz).
    const stockTotals = stock()?.list ? stock().list(admin, {}).totals : { count: 0, low: 0, out: 0, negative: 0, services: 0, value: 0 };
    const stockBlock = { critical: stockTotals.low, out: stockTotals.out, negative: stockTotals.negative || 0, products: stockTotals.count - (stockTotals.services || 0), services: stockTotals.services || 0, value: stockTotals.value };
    // Cari: Cari listesinin tüm cariler (aktif + pasif) toplamı.
    const accountTotals = accounts()?.list ? accounts().list(admin, { status: "all" }).totals : { debtor: 0, creditor: 0, overdue: 0, overdueCount: 0, count: 0 };
    const chequeSummary = cheques()?.summary ? cheques().summary(day) : null;
    const chequeIn = chequeSummary?.in || { open: { count: 0, amount: 0 }, overdue: { count: 0, amount: 0 }, today: { count: 0, amount: 0 }, soon: { count: 0, amount: 0 } };
    const chequeOut = chequeSummary?.out || { open: { count: 0, amount: 0 }, overdue: { count: 0, amount: 0 }, today: { count: 0, amount: 0 }, soon: { count: 0, amount: 0 } };
    const receivable = {
      total: roundMoney(accountTotals.debtor + chequeIn.open.amount),
      accounts: accountTotals.debtor,
      cheques: chequeIn.open.amount,
      chequeCount: chequeIn.open.count,
      overdue: accountTotals.overdue,
      overdueCount: accountTotals.overdueCount,
      chequesDue: roundMoney(chequeIn.overdue.amount + chequeIn.today.amount + chequeIn.soon.amount),
    };
    const payable = {
      total: roundMoney(accountTotals.creditor + chequeOut.open.amount),
      accounts: accountTotals.creditor,
      cheques: chequeOut.open.amount,
      chequeCount: chequeOut.open.count,
      chequesDue: roundMoney(chequeOut.overdue.amount + chequeOut.today.amount + chequeOut.soon.amount),
      chequesDueCount: chequeOut.overdue.count + chequeOut.today.count + chequeOut.soon.count,
    };
    // Fatura (v2.0.15): bu ayın faturalı satış ve alışı (KDV hariç, iadeler düşülmüş), ayın KDV sonucu (391 − 191) ve vadeli
    // açık fatura alacağı/borcu (taksitli olanlar taksit kartında).
    let invoiceBlock = null;
    if (invoices()?.openItems) {
      const monthStart = `${day.slice(0, 7)}-01`;
      const month = store.get(
        `SELECT COALESCE(SUM(CASE WHEN kind IN ('sale', 'smm') THEN try_net WHEN kind = 'sale_return' THEN -try_net ELSE 0 END), 0) AS sale,
                COALESCE(SUM(CASE WHEN kind = 'purchase' THEN try_net WHEN kind = 'purchase_return' THEN -try_net ELSE 0 END), 0) AS purchase,
                COALESCE(SUM(CASE WHEN kind IN ('sale', 'smm') THEN try_vat - try_withheld WHEN kind = 'sale_return' THEN -(try_vat - try_withheld)
                                  WHEN kind = 'purchase' THEN -try_vat WHEN kind = 'purchase_return' THEN try_vat ELSE 0 END), 0) AS vat,
                COUNT(CASE WHEN kind IN ('sale', 'smm') THEN 1 END) AS saleCount, COUNT(CASE WHEN kind = 'purchase' THEN 1 END) AS purchaseCount
         FROM invoices WHERE status = 'issued' AND issue_date >= ? AND issue_date <= ?`,
        monthStart, day,
      );
      const open = invoices().openItems(day);
      const sum = filter => roundMoney(open.filter(filter).reduce((total, item) => total + item.open, 0));
      invoiceBlock = {
        month: { sale: roundMoney(month.sale), purchase: roundMoney(month.purchase), vat: roundMoney(month.vat), saleCount: month.saleCount, purchaseCount: month.purchaseCount },
        openSale: sum(item => item.side === "sale"),
        overdueSale: sum(item => item.side === "sale" && item.days < 0),
        openPurchase: sum(item => item.side === "purchase"),
        overduePurchase: sum(item => item.side === "purchase" && item.days < 0),
        drafts: store.get("SELECT COUNT(*) AS n FROM invoices WHERE status = 'draft'").n,
      };
    }
    const value = { today: day, at: clock().toISOString(), cash: cashBlock, stock: stockBlock, receivable, payable, cheques: chequeSummary, invoices: invoiceBlock, tookMs: Date.now() - started }; // saat: gerçek (tookMs süre ölçümü)
    cache = { key, value };
    return value;
  }
  // ANLIK DURUM'u görme yetkisi (yönetici ya da yöneticinin kişiye özel yetki verdiği kişi) kartın tamamını kapsar:
  // yönetici bu kişiye kasa, alacak/borç ve stok özetini birlikte açmış olur.
  function forUser() {
    const data = compute();
    return { today: data.today, at: data.at, cash: data.cash, stock: data.stock, receivable: data.receivable, payable: data.payable, invoices: data.invoices, chequesVisible: true, canReport: true };
  }
  // ANLIK DURUM kartı (v2.0.10): yalnız yönetici. Aynı rakamlar finans raporları yetkisiyle Raporlar'da görülür.
  router.get("/api/workspace/overview", async ({ req, res }) => {
    auth.requirePermission(req, "overview.card");
    ok(res, forUser());
  });

  // ---------- Rapor parametreleri ----------
  const rangeOf = (params, { preset = "", required = true } = {}) => {
    const named = presetRange(text(params.get("preset")) || preset, today());
    let from = text(params.get("from")) || named?.from || "";
    let to = text(params.get("to")) || named?.to || "";
    if (from && !validDate(from)) throw new HttpError(400, "Başlangıç tarihi geçerli değil.");
    if (to && !validDate(to)) throw new HttpError(400, "Bitiş tarihi geçerli değil.");
    if (required && (!from || !to)) throw new HttpError(400, "Başlangıç ve bitiş tarihini seçin.");
    if (from && to && from > to) throw new HttpError(400, "Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    if (from && to && (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > MAX_RANGE_DAYS) throw new HttpError(400, "Tarih aralığı en çok 100 yıl olabilir.");
    return { from, to };
  };
  const allTime = from => isAllTimeStart(from, today());
  const rangeText = ({ from, to }) => (allTime(from) ? `Tüm hareketler · ${to ? dayText(to) : "bugün"} tarihine kadar` : `${from ? dayText(from) : "…"} – ${to ? dayText(to) : "…"}`);
  const fileRange = ({ from, to }) => `${from && !allTime(from) ? dayText(from) : "baslangic"}-${to ? dayText(to) : "bugun"}`;
  const openingDay = from => (allTime(from) ? "" : dayText(from));

  // ---------- A. Mizan ----------
  function mizan(params) {
    const range = rangeOf(params, { preset: "thisYear" });
    const type = TYPE_TEXT[text(params.get("type"))] ? text(params.get("type")) : "";
    const side = ["debtor", "creditor", "zero", "nonzero", "overdue"].includes(text(params.get("side"))) ? text(params.get("side")) : "";
    const q = text(params.get("q")).toLocaleLowerCase("tr-TR").slice(0, 120);
    const includeIdle = params.get("idle") === "1";
    const ledgers = accounts()?.allLedgers ? accounts().allLedgers() : { accounts: [], lines: new Map() };
    // Arama: ad, cari no, grup; üç haneden uzun rakam dizisi telefonda da aranır (v2.0.9).
    const qDigits = q.replace(/\D/g, "");
    const hit = account => !q || `${account.name} ${account.refNo} ${account.groupName} ${account.subgroupName || ""}`.toLocaleLowerCase("tr-TR").includes(q) || (qDigits.length >= 3 && String(account.phone || "").replace(/\D/g, "").includes(qDigits));
    const list = ledgers.accounts.filter(account => (!type || account.type === type) && hit(account));
    const result = trialBalance(list, ledgers.lines, { ...range, includeIdle });
    let rows = result.rows;
    // v2.0.24: "Geciken Taksiti Olan" (ekran bu seçeneği sunuyordu; sunucu yok sayıp bütün carileri listeliyordu).
    if (side === "overdue") {
      const late = new Set((accounts()?.list ? accounts().list({ id: "", role: "admin" }, { status: "all", balance: "overdue", limit: 1e9 }).accounts : []).map(account => account.id));
      rows = rows.filter(row => late.has(row.id));
    } else if (side) rows = rows.filter(row => (side === "nonzero" ? row.side !== "zero" : row.side === side));
    rows.sort((a, b) => collator.compare(String(a.refNo || "~"), String(b.refNo || "~")) || collator.compare(a.name, b.name));
    const totals = side ? trialBalance(list.filter(account => rows.some(row => row.id === account.id)), ledgers.lines, { ...range, includeIdle: true }).totals : result.totals;
    return { ...range, type, side, q, includeIdle, rows, totals, today: today(), accountCount: ledgers.accounts.length };
  }
  router.get("/api/workspace/overview/mizan", async ({ req, res, url }) => {
    auth.requirePermission(req, "overview.view");
    const data = mizan(url.searchParams);
    const limit = Math.min(5000, Math.max(1, Math.trunc(Number(url.searchParams.get("limit")) || 1000)));
    ok(res, { ...data, rows: data.rows.slice(0, limit), total: data.rows.length, hasMore: data.rows.length > limit });
  });
  // Durum (v2.0.10): muhasebe programlarındaki gibi yalın — Borçlu (cari bize borçlu) · Alacaklı (biz cariye borçluyuz).
  const sideText = value => (value > 0.005 ? "Borçlu" : value < -0.005 ? "Alacaklı" : "Kapalı");
  const SIDE_FILTER = { debtor: "Borçlular", creditor: "Alacaklılar", nonzero: "Sadece bakiyesi olanlar", zero: "Bakiyesi sıfır", overdue: "Geciken taksiti olan" };
  const mizanTable = data => ({
    headers: ["Cari No", "Cari", "Tür", "Devir", "Borç", "Alacak", "Bakiye", "Durum"],
    types: ["", "", "", "money", "money", "money", "money", ""],
    rows: data.rows.map(row => [row.refNo, row.name, TYPE_TEXT[row.type] || "", tl(row.opening), tl(row.debit), tl(row.credit), tl(Math.abs(row.closing)), sideText(row.closing)]),
    summary: [
      ["Cari Sayısı", String(data.totals.count)],
      ["Devir (net)", tl(data.totals.opening)],
      ["Dönem Borç", tl(data.totals.debit)],
      ["Dönem Alacak", tl(data.totals.credit)],
      ["Borçlular Toplamı", tl(data.totals.closingDebtor)],
      ["Alacaklılar Toplamı", tl(data.totals.closingCreditor)],
    ],
    // TOPLAM satırı (v2.0.20): bakiye net (borçlular − alacaklılar) ve yönü.
    footer: ["", "TOPLAM", "", tl(data.totals.opening), tl(data.totals.debit), tl(data.totals.credit), tl(Math.abs(data.totals.closing)), sideText(data.totals.closing)],
  });
  router.get("/api/workspace/overview/mizan.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = mizan(url.searchParams);
    const clipped = data.rows.length > PDF_ROWS;
    const table = mizanTable({ ...data, rows: data.rows.slice(0, PDF_ROWS) });
    const pdf = tablePdf({ now: clock(), title: "Cari Mizanı", subtitle: [rangeText(data), data.type ? TYPE_TEXT[data.type] : "Tüm cariler", SIDE_FILTER[data.side] || "", clipped ? "ilk 20.000 satır (tamamı Excel'de)" : ""].filter(Boolean).join(" · "), ...table, officeName: office(), userName: userName(user), brand: office() || "DestekOfis" });
    audit(user, "overview.exported", "mizan.pdf", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Mizan ${fileRange(data)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/overview/mizan.xlsx", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = mizan(url.searchParams);
    const money = value => MONEY_FORMAT.format(value || 0);
    const columns = ["Cari No", "Cari", "Tür", "Grup", "Devir", "Dönem Borç", "Dönem Alacak", "Bakiye", "Durum"];
    const rows = data.rows.map(row => ({ "Cari No": row.refNo, Cari: row.name, Tür: TYPE_TEXT[row.type] || "", Grup: [row.groupName, row.subgroupName].filter(Boolean).join(" › "), Devir: money(row.opening), "Dönem Borç": money(row.debit), "Dönem Alacak": money(row.credit), Bakiye: money(row.closing), Durum: sideText(row.closing) }));
    // TOPLAM satırı (v2.0.20): kalın, süzgeç alanı dışında (sıralayınca yerinden oynamaz).
    const footer = { "Cari No": "", Cari: "TOPLAM", Tür: "", Grup: "", Devir: money(data.totals.opening), "Dönem Borç": money(data.totals.debit), "Dönem Alacak": money(data.totals.credit), Bakiye: money(data.totals.closing), Durum: `Borçlular ${money(data.totals.closingDebtor)} · Alacaklılar ${money(data.totals.closingCreditor)}` };
    const buffer = buildXlsx([{ name: "Mizan", columns, rows, footer }], { now: clock(), title: `Cari Mizanı ${rangeText(data)}` });
    audit(user, "overview.exported", "mizan.xlsx", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `Mizan ${fileRange(data)}.xlsx` });
  });

  // ---------- A2. Cari ekstre (tarih aralıklı) ----------
  function ekstre(user, params) {
    const range = rangeOf(params, { preset: "thisYear" });
    const id = limited(params.get("account"), 120, "Cari");
    if (!id) throw new HttpError(400, "Ekstresi alınacak cariyi seçin.");
    const account = accounts().detail(id, user);
    const result = statement(account.ledger, range);
    return { ...range, account: { id: account.id, refNo: account.refNo, name: account.name, type: account.type, phone: account.phone }, ...result };
  }
  router.get("/api/workspace/overview/ekstre", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    ok(res, ekstre(user, url.searchParams));
  });
  const ekstreRows = data => [
    [openingDay(data.from), "Devir", "Dönem başı bakiye", "", "", tl(Math.abs(data.opening)) + (data.opening > 0.005 ? " B" : data.opening < -0.005 ? " A" : "")],
    ...data.lines.map(line => [dayText(line.date), line.label, [line.note, line.receiptNo ? `Makbuz ${line.receiptNo}` : ""].filter(Boolean).join(" · "), line.debit ? tl(line.debit) : "", line.credit ? tl(line.credit) : "", tl(Math.abs(line.balance)) + (line.balance > 0.005 ? " B" : line.balance < -0.005 ? " A" : "")]),
  ];
  router.get("/api/workspace/overview/ekstre.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = ekstre(user, url.searchParams);
    const pdf = tablePdf({
      now: clock(),
      title: `Cari Ekstre · ${data.account.name}`,
      subtitle: [data.account.refNo ? `Cari No ${data.account.refNo}` : "", rangeText(data), "B: borçlu · A: alacaklı"].filter(Boolean).join(" · "),
      headers: ["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"],
      types: ["", "", "", "money", "money", "money"],
      rows: ekstreRows(data),
      summary: [["Devir", tl(data.opening)], ["Dönem Borç", tl(data.debit)], ["Dönem Alacak", tl(data.credit)], ["Dönem Sonu Bakiye", `${tl(Math.abs(data.closing))} ${sideText(data.closing)}`]],
      footer: [dayText(data.to), "TOPLAM", "Dönem sonu", tl(data.debit), tl(data.credit), tl(Math.abs(data.closing)) + (data.closing > 0.005 ? " B" : data.closing < -0.005 ? " A" : "")],
      officeName: office(),
      userName: userName(user),
      brand: office() || "DestekOfis",
    });
    audit(user, "overview.exported", "ekstre.pdf", { accountId: data.account.id, from: data.from, to: data.to });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Ekstre ${data.account.name} ${fileRange(data)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/overview/ekstre.xlsx", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = ekstre(user, url.searchParams);
    const money = value => MONEY_FORMAT.format(value || 0);
    const columns = ["Tarih", "İşlem", "Açıklama", "Makbuz No", "Borç", "Alacak", "Bakiye"];
    const rows = [
      { Tarih: openingDay(data.from), İşlem: "Devir", Açıklama: "Dönem başı bakiye", "Makbuz No": "", Borç: "", Alacak: "", Bakiye: money(data.opening) },
      ...data.lines.map(line => ({ Tarih: dayText(line.date), İşlem: line.label, Açıklama: line.note, "Makbuz No": line.receiptNo ? String(line.receiptNo) : "", Borç: line.debit ? money(line.debit) : "", Alacak: line.credit ? money(line.credit) : "", Bakiye: money(line.balance) })),
    ];
    const footer = { Tarih: dayText(data.to), İşlem: "TOPLAM", Açıklama: `Dönem sonu · ${sideText(data.closing)}`, "Makbuz No": "", Borç: money(data.debit), Alacak: money(data.credit), Bakiye: money(data.closing) };
    const buffer = buildXlsx([{ name: "Ekstre", columns, rows, footer }], { now: clock(), title: `Cari Ekstre ${data.account.name}` });
    audit(user, "overview.exported", "ekstre.xlsx", { accountId: data.account.id, from: data.from, to: data.to });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `Ekstre ${data.account.name} ${fileRange(data)}.xlsx` });
  });

  // ---------- B. Nakit akış projeksiyonu ----------
  async function cashflow(user, params) {
    const range = rangeOf(params, { preset: "next30" });
    const day = today();
    const includeOverdue = params.get("overdue") === "1";
    const withTable = params.get("table") !== "0";
    const group = GROUPS.has(text(params.get("group"))) ? text(params.get("group")) : "";
    const flows = [];
    if (plans()?.openItems) flows.push(...plans().openItems(day));
    if (cheques()?.flows) flows.push(...cheques().flows());
    // Vadeli (açık hesap) faturaların ödenmemiş kısmı vadesinde beklenen giriş (satış) ya da çıkıştır (alış).
    for (const item of invoices()?.openItems ? invoices().openItems(day, { net: true }) : []) flows.push(invoiceFlow(item));
    // Tablolardaki ödeme günleri ve ödeme sözleri (v2.0.9, tahsilat takvimiyle aynı kalemler) beklenen giriştir. Taksit
    // kartı olan kişinin sözü kartındaki taksitle aynı parayı anlatır; nakit tahmininde ikinci kez sayılmaz.
    if (withTable) for (const item of await tableItems()) if (!item.deadline && item.amount > 0 && !(item.promise && item.carded)) flows.push(tableFlow(item, { projection: true }));
    // İleri tarihli para satırları (ör. Kasa'ya ileri tarihle girilmiş kira, maaş; eski sürümden kalan ileri tarihli havale): kendi tarihinde
    // beklenen hareket — yalnız tarihi gelince "Nakit ve Banka"ya girecek olanlar, kendi kaynak adıyla (aheadFlows).
    const start = flowStart(day);
    flows.push(...aheadFlows(day));
    const result = projection({ today: day, from: range.from, to: range.to, cashToday: start.total, flows, includeOverdue });
    return { ...result, start, requested: range, withTable, group, periods: group ? groupFlows(result, group) : null };
  }
  // Nakit akış başlangıcı (v2.1.0, K10; plan §8.9 ve karar 32): "Bugünkü Nakit ve Banka" = Nakit Kasa (bugüne kadar) + Gerçek Banka (Σ 102,
  // hesaba atanmış). Hesabı Atanmamış Eski Hareketler (102.00 + 108.00) ayrı satırdır, başlangıca GİRMEZ. Değerler ANLIK DURUM'un Kasa ve Banka
  // kutularıyla aynı kaynaktan (cash.summary → cashOnly; bankAccounts.summary → realBank, unassigned) — ikinci formül yok. Önceden başlangıç
  // bütün yolların toplamıydı (cash.summary.balanceToday): hesaba bağlanmamış havale ve POS da başlangıca giriyordu (raporlar-210-banka,
  // 152.280 ↔ 151.380). Banka tabloları yoksa (göç öncesi) eski toplam kalır (bankBlock ile aynı geri dönüş).
  function flowStart(day) {
    const totals = cash()?.summary ? cash().summary(day) : null;
    const nakit = roundMoney(totals?.cashOnly?.balanceToday ?? totals?.balanceToday ?? 0);
    const summary = bankService()?.summary ? bankService().summary() : null;
    if (!summary) return { total: roundMoney(totals?.balanceToday ?? 0), cash: nakit, realBank: null, unassigned: 0, unassignedFuture: null, defined: false, labels: null };
    const realBank = minorTl(summary.realBank.minor);
    return { total: roundMoney(nakit + realBank), cash: nakit, realBank, unassigned: minorTl(summary.unassigned.totalMinor), unassignedFuture: futureOf(summary), defined: summary.realBank.defined, labels: summary.labels };
  }
  router.get("/api/workspace/overview/nakit-akisi", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = await cashflow(user, url.searchParams);
    ok(res, { ...data, rows: data.rows.slice(0, 5000), rowTotal: data.rows.length });
  });
  const flowRows = data => [
    ...data.rows.map(row => [dayText(row.date), SOURCE_TEXT[row.source] || row.source, row.label, row.party || "", row.direction === "in" ? tl(row.amount) : "", row.direction === "out" ? tl(row.amount) : "", tl(row.balance)]),
    ...(data.overdue.length ? [["", "", `— Vadesi geçmiş, kapanmamış (${data.includeOverdue ? "başlangıca eklendi" : "tahmine dahil değil"}) —`, "", "", "", ""]] : []),
    ...data.overdue.map(row => [dayText(row.date), `${SOURCE_TEXT[row.source] || row.source} · gecikmiş`, row.label, row.party || "", row.direction === "in" ? tl(row.amount) : "", row.direction === "out" ? tl(row.amount) : "", ""]),
  ];
  const GROUP_TEXT = { day: "Günlük", week: "Haftalık", month: "Aylık" };
  const GROUP_HEAD = { day: "Gün", week: "Hafta", month: "Ay" };
  const periodRows = data => [[dayText(data.from), "", "", "", "", tl(data.opening)], ...(data.periods || []).map(period => [period.label, String(period.count), tl(period.in), tl(period.out), tl(period.net), tl(period.closing)])];
  // Başlangıç satırları (K10): toplam + kırılımı; Hesabı Atanmamış Eski Hareketler ayrı satır, başlangıca girmez (yalnız varsa yazılır).
  const startSummary = data => {
    const start = data.start || {};
    const labels = start.labels || {};
    return [
      ["Bugünkü Nakit ve Banka", tl(data.cashToday)],
      ...(start.realBank === null || start.realBank === undefined ? [] : [["Nakit Kasa", tl(start.cash)], [labels.realBank || "Gerçek Banka", start.defined ? tl(start.realBank) : "Banka Hesabı Tanımlanmadı"]]),
      ...(Math.abs(start.unassigned || 0) > 0.005 ? [[labels.unassigned || "Hesabı Atanmamış Eski Hareketler", tl(start.unassigned)]] : []),
    ];
  };
  const flowSummary = data => [
    ...startSummary(data),
    ...(data.carried.in || data.carried.out ? [["Başlangıca Kadar Beklenen", `+${tl(data.carried.in)} / −${tl(data.carried.out)}`]] : []),
    // 2.1.0 temel sürüm (K10): projeksiyonun bakiyesi Nakit Kasa + Gerçek Banka'dır; adlar "kasa" demez (ekran, PDF ve Excel aynı).
    ["Başlangıç (Nakit ve Banka)", tl(data.opening)],
    ["Beklenen Giriş", tl(data.totals.in)],
    ["Beklenen Çıkış", tl(data.totals.out)],
    ["Dönem Sonu Tahmini Nakit ve Banka", tl(data.closing)],
    ["En Düşük Tahmini Nakit ve Banka", `${tl(data.lowest.balance)} (${dayText(data.lowest.date)})`],
    ["Gecikmiş Alacak / Borç", `${tl(data.overdueTotals.in)} / ${tl(data.overdueTotals.out)}`],
  ];
  router.get("/api/workspace/overview/nakit-akisi.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = await cashflow(user, url.searchParams);
    const pdf = tablePdf({
      now: clock(),
      title: "Nakit Akış Projeksiyonu",
      // Görünüm adı ekrandaki seçenekle aynı ("Aylık Toplamlar"; yazım düzeni) ve tarih aralığının hemen ardından: alt başlık uzunsa sonu
      // kesilir ("… Gerçek Banka…"), önceden sonda duran görünüm adı PDF'te hiç görünmüyordu.
      subtitle: [`${dayText(data.from)} – ${dayText(data.to)}`, data.group ? `${GROUP_TEXT[data.group]} Toplamlar` : "Aynı gün önce çıkışlar yazılır", `Taksit, çek/senet${data.withTable ? ", tablodaki ödeme günleri" : ""} ve ileri tarihli Kasa hareketleri`, "Başlangıç: Nakit Kasa + Gerçek Banka (hesaba atanmamış eski hareketler girmez)"].join(" · "),
      ...(data.group
        ? { headers: [GROUP_HEAD[data.group], "Hareket", "Giriş", "Çıkış", "Net", "Dönem Sonu Nakit ve Banka"], types: ["", "number", "money", "money", "money", "money"], rows: periodRows(data) }
        : { headers: ["Vade", "Kaynak", "Açıklama", "Kimden / Kime", "Giriş", "Çıkış", "Beklenen Nakit ve Banka"], types: ["", "", "", "", "money", "money", "money"], rows: flowRows(data) }),
      summary: flowSummary(data),
      officeName: office(),
      userName: userName(user),
      brand: office() || "DestekOfis",
    });
    audit(user, "overview.exported", "nakit-akisi.pdf", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Nakit-akisi ${dayText(data.from)}-${dayText(data.to)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/overview/nakit-akisi.xlsx", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = await cashflow(user, url.searchParams);
    const money = value => MONEY_FORMAT.format(value || 0);
    const columns = ["Vade", "Kaynak", "Açıklama", "Kimden / Kime", "Giriş", "Çıkış", "Beklenen Nakit ve Banka"];
    const rows = [
      { Vade: dayText(data.from), Kaynak: "Başlangıç", Açıklama: "Bugünkü nakit ve banka" + (data.carried.in || data.carried.out ? " + başlangıca kadar beklenenler" : "") + (data.includeOverdue ? " + gecikmişler" : ""), "Kimden / Kime": "", Giriş: "", Çıkış: "", "Beklenen Nakit ve Banka": money(data.opening) },
      ...data.rows.map(row => ({ Vade: dayText(row.date), Kaynak: SOURCE_TEXT[row.source] || row.source, Açıklama: row.label, "Kimden / Kime": row.party || "", Giriş: row.direction === "in" ? money(row.amount) : "", Çıkış: row.direction === "out" ? money(row.amount) : "", "Beklenen Nakit ve Banka": money(row.balance) })),
    ];
    const overdue = data.overdue.map(row => ({ Vade: dayText(row.date), Kaynak: SOURCE_TEXT[row.source] || row.source, Açıklama: row.label, "Kimden / Kime": row.party || "", Giriş: row.direction === "in" ? money(row.amount) : "", Çıkış: row.direction === "out" ? money(row.amount) : "", "Beklenen Nakit ve Banka": "" }));
    const summary = flowSummary(data).map(([label, value]) => ({ Kalem: label, Tutar: value }));
    const periodColumns = [GROUP_HEAD[data.group || "month"], "Hareket", "Giriş", "Çıkış", "Net", "Dönem Sonu Nakit ve Banka"];
    const periods = data.group ? periodRows(data).map(row => Object.fromEntries(periodColumns.map((column, index) => [column, row[index]]))) : [];
    const buffer = buildXlsx(
      [
        ...(data.group ? [{ name: `${GROUP_TEXT[data.group]} Toplamlar`.slice(0, 31), columns: periodColumns, rows: periods }] : []),
        { name: "Nakit Akışı", columns, rows },
        { name: "Gecikmiş", columns, rows: overdue },
        { name: "Özet", columns: ["Kalem", "Tutar"], rows: summary },
      ],
      { now: clock(), title: "Nakit Akış Projeksiyonu" },
    );
    audit(user, "overview.exported", "nakit-akisi.xlsx", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `Nakit-akisi ${dayText(data.from)}-${dayText(data.to)}.xlsx` });
  });

  // ---------- C. Vade takip (v2.0.9) ----------
  // Vadesi olan her açık kalem tek listede. Her kaynağın rakamı kendi modülünden gelir (tek kaynak ilkesi):
  //   Taksit      : açık kartların kalanı olan taksitleri (Taksitler ekranıyla aynı dağıtım, allocate)
  //   Çek / Senet : portföydeki alınan (tahsil edilecek) ve ödenecek verilen evrak
  //   Kasa        : Kasa'ya ileri tarihle girilmiş giriş/çıkış (kira, maaş…)
  //   Tablo       : Excel/Sheets tablolarındaki ödeme günleri ve ödeme sözleri (tahsilat takvimiyle aynı kalemler; taksit
  //                 kartı olan kişinin tablodaki ödeme kalemleri ikinci kez sayılmaz) ve son tarihler (tutarsız)
  // Görme: ANLIK DURUM yetkisi ya da rapor yetkisi (yönetici, uzman). Çek/senet ve Kasa kalemleri yalnız ANLIK DURUM ya
  // da o modülün yetkisi olana gider (ekranında göremediği rakamı raporda da görmez).
  const canDues = user => canUser(user, "overview.view") || canUser(user, "reports.view");
  const requireDues = req => {
    const user = auth.requireUser(req);
    if (!canDues(user)) throw new HttpError(403, "Vade takip raporu yönetici ve uzman hesapları ile finans raporları yetkisi verilen kişiler içindir.", { code: "FORBIDDEN" });
    return user;
  };
  const visibleSources = user => DUE_SOURCES.filter(source => (source === "cheque" || source === "note" ? canUser(user, "overview.view") || canUser(user, "cheques.view") : source === "cash" ? canUser(user, "overview.view") || canUser(user, "cash.view") : source === "invoice" ? canUser(user, "overview.view") || canUser(user, "invoices.view") : true));
  // Açık fatura → nakit akışı / vade takip kalemi (fatura modülünün kapama hesabından; tek kaynak).
  const invoiceFlow = item => ({
    date: item.dueDate,
    direction: item.side === "sale" ? "in" : "out",
    amount: item.open,
    source: "invoice",
    label: `${item.side === "sale" ? "Satış" : "Alış"} faturası ${item.number}${item.open < item.payable - 0.005 ? " (kalan)" : ""}`,
    party: item.accountName,
    phone: item.phone || "",
    detail: `Fatura tarihi ${dayText(item.issueDate)}`,
    ref: { type: "invoice", id: item.id },
  });
  async function tableItems() {
    try {
      return tables()?.calendar ? (await tables().calendar(clock())).items : [];
    } catch {
      return [];
    }
  }
  // Tablodaki kayda git: kayıt kullanıcının açık veri oturumundaysa tabloda seçilir; değilse hangi oturumda olduğu söylenir.
  const recordRef = item => ({ type: "record", key: item.caseKey, session: item.session || "", sessionName: item.sessionName || "", current: !dataset?.currentKey || !item.session || item.session === dataset.currentKey() });
  const tableDetail = item => [item.sessionName, item.tab].filter(Boolean).join(" · ");
  // Tablodaki ay kalemi içinde bulunulan ayda "bu ay" beklenir (takvimle aynı): nakit tahmininde bugüne yazılır, vade
  // takipte ayın ilk günüyle "bu ay" olarak görünür.
  function tableFlow(item, { projection: forProjection = false } = {}) {
    const month = item.state === "month";
    return { date: forProjection && month ? today() : item.due, month, direction: "in", amount: item.amount, source: item.promise ? "promise" : "table", label: `${item.label || "Ödeme"}${item.partial ? " (kalan)" : ""}`, party: item.person || item.caseNo || "", phone: item.phone || "", detail: tableDetail(item), ref: recordRef(item) };
  }
  /**
   * İleri tarihli para satırları → nakit akışı / vade takip kalemleri (2.1.0 temel sürüm, küçük düzeltmeler). Projeksiyonun bakiyesi "Nakit ve Banka"
   * = Nakit Kasa + Gerçek Banka (K10, plan §8.4, §8.9); satır, tarihi gelince bu iki kalemden birine girecekse projeksiyona kendi gününde girer:
   *   - Nakit (yol cash) → "Kasa (ileri tarihli)": tarihi gelince Nakit Kasa'dadır (bugünkü Nakit Kasa yalnız bugüne kadarki satırlardır).
   *   - Hesaba atanmamış eski havale / POS (yol bank | card, hesap ''; 102.00 / 108.00) → "Hesabı Atanmamış (ileri tarihli)" (legacy). Hesabın
   *     açılışından SONRA gerçekleşen banka hareketidir (açılıştan öncekiler açılış bakiyesinin içindedir, Devir Kapanışı'yla kapanır); tarihi gelince
   *     "Bu Hesaba Ata" ile Gerçek Banka'ya girer (Eski Hareketler: "Tarihi Gelince Atanabilir"; plan A13 / karar 42). Başlangıca girmez.
   *   - Hesaba atanmış banka satırı (hesap dolu): Gerçek Banka hesabın bütün satırlarını toplar (refTotal) → ikinci kez girmez. Kurumsal kart (309)
   *     ve kredi (300) satırı borçtur, Nakit ve Banka değildir → girmez. (Bugünkü kod ileri tarihli banka satırı yazmaz: 400 date-future.)
   * Önceden Kasa'nın BÜTÜN yollarındaki ileri tarihli satırlar "Kasa (ileri tarihli)" adıyla giriyordu (eski havale Kasa adıyla; hesaba atanmış
   * satır iki kez; kart borcu nakit çıkışı). Satırlar tek kaynaktan (moneyLines; yol ve hesap orada türetilir); yoksa Kasa'nın satırları.
   */
  function aheadFlows(day) {
    const lines = moneyLines();
    if (!lines?.lines || !lines?.shape) return (cash()?.entries ? cash().entries({ after: day }) : []).map(cashFlow);
    const out = [];
    for (const line of lines.lines({ after: day, ways: ["cash", "bank", "card"] })) {
      if (line.way === "cash") out.push(cashFlow(lines.shape(line)));
      else if (!line.ref) out.push({ ...cashFlow(lines.shape(line)), source: "legacy" });
    }
    return out;
  }
  function cashFlow(entry) {
    const ref = entry.source === "account" && entry.accountId ? { type: "account", id: entry.accountId } : entry.source === "plan" && entry.planId ? { type: "plan", id: entry.planId } : entry.source === "cheque" && entry.chequeId ? { type: "cheque", id: entry.chequeId } : { type: "cash" };
    return { date: entry.date, direction: entry.kind === "out" ? "out" : "in", amount: entry.amount, source: "cash", label: entry.description || (entry.kind === "in" ? "Tahsilat" : "Ödeme"), party: entry.accountName || entry.planName || entry.caseTitle || "", ref };
  }
  const vadePreset = (preset, day) => {
    if (preset === "late") return { from: "", to: new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10), late: true };
    if (preset === "open") return { from: "", to: "", late: true };
    if (preset === "today") return { from: day, to: day, late: true };
    const named = presetRange(preset, day);
    return named ? { ...named, late: true } : null;
  };
  async function vadeTakip(user, params) {
    const day = today();
    const preset = text(params.get("preset")) || (params.get("from") || params.get("to") ? "" : "next30");
    const named = vadePreset(preset, day) || { from: "", to: "", late: true };
    const from = text(params.get("from")) || named.from;
    const to = text(params.get("to")) || named.to;
    if (from && !validDate(from)) throw new HttpError(400, "Başlangıç tarihi geçerli değil.");
    if (to && !validDate(to)) throw new HttpError(400, "Bitiş tarihi geçerli değil.");
    if (from && to && from > to) throw new HttpError(400, "Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    const late = params.get("late") === "0" ? false : named.late !== false;
    const direction = ["in", "out"].includes(text(params.get("direction"))) ? text(params.get("direction")) : "";
    const allowed = visibleSources(user);
    const asked = text(params.get("sources")).split(",").map(item => item.trim()).filter(item => allowed.includes(item));
    const sources = new Set(asked.length ? asked : allowed);
    const needle = foldText(text(params.get("q")).slice(0, 120));
    const digits = needle.replace(/\D/g, "");
    const items = [];
    if (sources.has("plan") && plans()?.openItems) {
      for (const item of plans().openItems(day)) items.push({ ...item, detail: [item.accountName && item.accountName !== item.party ? `Cari: ${item.accountName}` : "", item.refNo ? `Kart ${item.refNo}` : ""].filter(Boolean).join(" · ") });
    }
    if ((sources.has("cheque") || sources.has("note")) && cheques()?.flows) for (const flow of cheques().flows()) if (sources.has(flow.source)) items.push(flow);
    if (sources.has("invoice") && invoices()?.openItems) for (const item of invoices().openItems(day, { net: true })) items.push(invoiceFlow(item));
    if (sources.has("cash")) items.push(...aheadFlows(day));
    let dormant = [];
    if (sources.has("table") || sources.has("promise") || sources.has("deadline")) {
      const calendar = tables()?.calendar ? await tables().calendar(clock()) : { items: [], dormant: [] };
      for (const item of calendar.items) {
        if (item.deadline) {
          if (sources.has("deadline")) items.push({ date: item.due, direction: "", amount: null, source: "deadline", label: item.label, party: item.person || item.caseNo || "", phone: item.phone || "", detail: tableDetail(item), ref: recordRef(item) });
        } else if (sources.has(item.promise ? "promise" : "table")) items.push(tableFlow(item));
      }
      if (sources.has("table")) dormant = (calendar.dormant || []).map(item => ({ party: item.person || item.caseNo || "", lastPaid: item.lastPaid, lastPaidText: item.lastPaidText, emptyMonths: item.emptyMonths, detail: tableDetail(item), ref: recordRef(item) }));
    }
    const matches = item => {
      if (direction && item.direction !== direction) return false;
      if (!needle) return true;
      if (foldText(`${item.party || ""} ${item.label || ""} ${item.detail || ""} ${item.accountName || ""}`).includes(needle)) return true;
      return digits.length >= 3 && String(item.phone || "").replace(/\D/g, "").includes(digits);
    };
    const result = dueList({ today: day, from, to, late, items: items.filter(matches) });
    if (needle) dormant = dormant.filter(item => foldText(`${item.party} ${item.detail}`).includes(needle));
    return { ...result, preset, direction, sources: [...sources], allowed, dormant: direction === "out" ? [] : dormant };
  }
  router.get("/api/workspace/overview/vade-takip", async ({ req, res, url }) => {
    const user = requireDues(req);
    const data = await vadeTakip(user, url.searchParams);
    ok(res, { ...data, rows: data.rows.slice(0, 5000), rowTotal: data.rows.length });
  });
  const vadeState = row => (row.state === "overdue" ? `${Math.abs(row.days)} gün gecikti` : row.state === "today" ? "Bugün" : row.state === "month" ? "Bu ay" : `${row.days} gün kaldı`);
  const vadeRows = data => data.rows.map(row => [dayText(row.date), vadeState(row), row.party || "", SOURCE_TEXT[row.source] || row.source, [row.label, row.detail].filter(Boolean).join(" · "), row.direction === "in" && row.amount !== null ? tl(row.amount) : "", row.direction === "out" && row.amount !== null ? tl(row.amount) : ""]);
  const vadeSummary = data => [
    ["Kalem", String(data.totals.count)],
    ["Tahsil Edilecek", tl(data.totals.in.total.amount)],
    ["  gecikmiş", `${tl(data.totals.in.overdue.amount)} (${data.totals.in.overdue.count})`],
    ["Ödenecek", tl(data.totals.out.total.amount)],
    ["  gecikmiş", `${tl(data.totals.out.overdue.amount)} (${data.totals.out.overdue.count})`],
    ["Net (tahsil − ödeme)", tl(data.totals.net)],
    ...(data.totals.noAmount ? [["Tutarsız Kalem (son tarih vb.)", String(data.totals.noAmount)]] : []),
  ];
  const vadeRange = data => (data.from || data.to ? `${data.from ? dayText(data.from) : "…"} – ${data.to ? dayText(data.to) : "…"}` : "Tüm açık kalemler") + (data.late && data.from ? " · gecikmişler dahil" : "");
  router.get("/api/workspace/overview/vade-takip.pdf", async ({ req, res, url }) => {
    const user = requireDues(req);
    const data = await vadeTakip(user, url.searchParams);
    const clipped = data.rows.length > PDF_ROWS;
    const pdf = tablePdf({
      now: clock(),
      title: "Vade Takip",
      subtitle: [vadeRange(data), data.direction === "in" ? "Tahsil edilecekler" : data.direction === "out" ? "Ödenecekler" : "", clipped ? "ilk 20.000 satır (tamamı Excel'de)" : ""].filter(Boolean).join(" · "),
      headers: ["Vade", "Durum", "Kimden / Kime", "Kaynak", "Açıklama", "Tahsil Edilecek", "Ödenecek"],
      types: ["", "", "", "", "", "money", "money"],
      rows: vadeRows({ rows: data.rows.slice(0, PDF_ROWS) }),
      summary: vadeSummary(data),
      officeName: office(),
      userName: userName(user),
      brand: office() || "DestekOfis",
    });
    audit(user, "overview.exported", "vade-takip.pdf", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Vade-takip ${dayText(data.today)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/overview/vade-takip.xlsx", async ({ req, res, url }) => {
    const user = requireDues(req);
    const data = await vadeTakip(user, url.searchParams);
    const columns = ["Vade", "Gün", "Durum", "Kimden / Kime", "Kaynak", "Açıklama", "Ayrıntı", "Tahsil Edilecek", "Ödenecek"];
    const money = value => MONEY_FORMAT.format(value || 0);
    const rows = data.rows.map(row => ({ Vade: dayText(row.date), Gün: String(row.days), Durum: STATE_TEXT[row.state], "Kimden / Kime": row.party || "", Kaynak: SOURCE_TEXT[row.source] || row.source, Açıklama: row.label || "", Ayrıntı: row.detail || "", "Tahsil Edilecek": row.direction === "in" && row.amount !== null ? money(row.amount) : "", Ödenecek: row.direction === "out" && row.amount !== null ? money(row.amount) : "" }));
    const sheets = [{ name: "Vade Takip", columns, rows }];
    if (data.dormant.length) sheets.push({ name: "Ödemesi kesilmiş olabilir", columns: ["Kişi", "Son Ödeme", "Boş Ay", "Kaynak"], rows: data.dormant.map(item => ({ Kişi: item.party, "Son Ödeme": item.lastPaidText, "Boş Ay": String(item.emptyMonths), Kaynak: item.detail })) });
    sheets.push({ name: "Özet", columns: ["Kalem", "Değer"], rows: [{ Kalem: "Kapsam", Değer: vadeRange(data) }, ...vadeSummary(data).map(([label, value]) => ({ Kalem: label.trim(), Değer: value }))] });
    const buffer = buildXlsx(sheets, { now: clock(), title: "Vade Takip" });
    audit(user, "overview.exported", "vade-takip.xlsx", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `Vade-takip ${dayText(data.today)}.xlsx` });
  });

  return { compute, forUser, mizan, cashflow, vadeTakip };
}
