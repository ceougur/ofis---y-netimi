// ANLIK DURUM (v2.0.7): ana ekrandaki canlı özet kartı ve "Rapor Al" raporları (mizan, cari ekstre, nakit akışı).
//
// Tek kaynak ilkesi: karttaki her rakam, ilgili ekranın kendi hesabından okunur (ayrı bir sorguyla yeniden türetilmez):
//   Kasa / Banka  = Kasa ekranındaki "Güncel kasa" (cash.report → totals.balance)
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

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => {
  if (!DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};
const OVERVIEW_KINDS = new Set(["cash", "accounts", "plans", "stock", "cheques"]);
const MAX_RANGE_DAYS = 36_600; // 100 yıl (yalnız doğrulama; "tüm zaman" mizanı için geniş aralık serbest)
const PDF_ROWS = 20_000;
const collator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
const TYPE_TEXT = { customer: "Müşteri", supplier: "Tedarikçi", other: "Diğer" };
const SOURCE_TEXT = { plan: "Taksit", cheque: "Çek", note: "Senet", cash: "Kasa (ileri tarihli)", table: "Tablo", promise: "Ödeme sözü", deadline: "Son tarih" };
// Vade takip kaynakları (v2.0.9) ve görme koşulu: çek/senet ve Kasa, ANLIK DURUM yetkisi ya da o modülün yetkisiyle.
const DUE_SOURCES = ["plan", "cheque", "note", "cash", "table", "promise", "deadline"];
const STATE_TEXT = { overdue: "Gecikmiş", today: "Bugün", month: "Bu ay", upcoming: "Yaklaşan" };
const GROUPS = new Set(["day", "week", "month"]);

const MONEY_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function registerOverviewRoutes(router, { store, auth, audit, events, dataset = null, cash = () => null, accounts = () => null, plans = () => null, stock = () => null, cheques = () => null, tables = () => null, now: clock = () => new Date() }) {
  const today = () => isoDay(clock());
  const office = () => store.setting("office.name", "");
  const userName = user => user.display_name || user.username || "";

  // ---------- Canlı olay: para/stok değişince herkese tek "overview.changed" ----------
  let timer = null;
  const kinds = new Set();
  events?.tap?.((event, data) => {
    if (event !== "workspace.changed" || !OVERVIEW_KINDS.has(data?.kind)) return;
    kinds.add(data.kind);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const list = [...kinds];
      kinds.clear();
      events.publish("overview.changed", { kinds: list, at: new Date().toISOString() });
    }, 250);
    timer.unref?.();
  });

  // ---------- Kart verisi ----------
  const tableState = table => {
    const row = store.get(`SELECT COUNT(*) || '/' || COALESCE(MAX(COALESCE(updated_at, created_at)), '') AS state FROM ${table}`);
    return row?.state || "";
  };
  const fingerprint = day =>
    [
      day,
      tableState("payments"),
      tableState("cash_entries"),
      plans()?.fingerprint?.() || "",
      accounts()?.fingerprint?.() || "",
      stock()?.fingerprint?.() || "",
      cheques()?.fingerprint?.() || "",
    ].join("|");
  let cache = { key: "", value: null };
  function compute() {
    const day = today();
    const key = fingerprint(day);
    if (cache.key === key && cache.value) return cache.value;
    const admin = { id: "", role: "admin" };
    const started = Date.now();
    // Kasa: Kasa ekranıyla aynı kaynak tanımlarından SQL toplamı (satırlar belleğe alınmaz). Bakiye, Kasa ekranındaki
    // "güncel kasa" gibi tüm hareketleri kapsar.
    const cashSummary = cash()?.summary ? cash().summary(day) : { balance: 0, today: { in: 0, out: 0 }, month: { in: 0, out: 0 }, futureEntries: 0 };
    // Kart "bugünkü kasa"yı gösterir (ileri tarihli kira/maaş henüz kasadan çıkmadı); nakit akışı da buradan başlar.
    // Kasa ekranındaki "güncel kasa (tüm hareketler)" ileri tarihlileri de içerir; fark kartta ayrıca yazılır.
    const cashBlock = { balance: cashSummary.balanceToday, allEntries: cashSummary.balance, today: cashSummary.today, month: cashSummary.month, futureEntries: cashSummary.futureEntries, byMethod: cashSummary.byMethod || null };
    // Stok: Stok listesiyle aynı sayım (hizmet kalemleri kritik/tükendi sayılmaz).
    const stockTotals = stock()?.list ? stock().list(admin, {}).totals : { count: 0, low: 0, out: 0, services: 0, value: 0 };
    const stockBlock = { critical: stockTotals.low, out: stockTotals.out, products: stockTotals.count - (stockTotals.services || 0), services: stockTotals.services || 0, value: stockTotals.value };
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
    const value = { today: day, at: new Date().toISOString(), cash: cashBlock, stock: stockBlock, receivable, payable, cheques: chequeSummary, tookMs: Date.now() - started };
    cache = { key, value };
    return value;
  }
  // ANLIK DURUM'u görme yetkisi (yönetici ya da yöneticinin kişiye özel yetki verdiği kişi) kartın tamamını kapsar:
  // yönetici bu kişiye kasa, alacak/borç ve stok özetini birlikte açmış olur.
  function forUser() {
    const data = compute();
    return { today: data.today, at: data.at, cash: data.cash, stock: data.stock, receivable: data.receivable, payable: data.payable, chequesVisible: true, canReport: true };
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
    const range = rangeOf(params, { preset: "thisMonth" });
    const type = TYPE_TEXT[text(params.get("type"))] ? text(params.get("type")) : "";
    const side = ["debtor", "creditor", "zero", "nonzero"].includes(text(params.get("side"))) ? text(params.get("side")) : "";
    const q = text(params.get("q")).toLocaleLowerCase("tr-TR").slice(0, 120);
    const includeIdle = params.get("idle") === "1";
    const ledgers = accounts()?.allLedgers ? accounts().allLedgers() : { accounts: [], lines: new Map() };
    // Arama: ad, cari no, grup; üç haneden uzun rakam dizisi telefonda da aranır (v2.0.9).
    const qDigits = q.replace(/\D/g, "");
    const hit = account => !q || `${account.name} ${account.refNo} ${account.groupName} ${account.subgroupName || ""}`.toLocaleLowerCase("tr-TR").includes(q) || (qDigits.length >= 3 && String(account.phone || "").replace(/\D/g, "").includes(qDigits));
    const list = ledgers.accounts.filter(account => (!type || account.type === type) && hit(account));
    const result = trialBalance(list, ledgers.lines, { ...range, includeIdle });
    let rows = result.rows;
    if (side) rows = rows.filter(row => (side === "nonzero" ? row.side !== "zero" : row.side === side));
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
  const SIDE_FILTER = { debtor: "Borçlular", creditor: "Alacaklılar", nonzero: "Sadece bakiyesi olanlar", zero: "Bakiyesi sıfır" };
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
  });
  router.get("/api/workspace/overview/mizan.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = mizan(url.searchParams);
    const clipped = data.rows.length > PDF_ROWS;
    const table = mizanTable({ ...data, rows: data.rows.slice(0, PDF_ROWS) });
    const pdf = tablePdf({ title: "Cari Mizanı", subtitle: [rangeText(data), data.type ? TYPE_TEXT[data.type] : "Tüm cariler", SIDE_FILTER[data.side] || "", clipped ? "ilk 20.000 satır (tamamı Excel'de)" : ""].filter(Boolean).join(" · "), ...table, officeName: office(), userName: userName(user), brand: office() || "DestekOfis" });
    audit(user, "overview.exported", "mizan.pdf", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Mizan ${fileRange(data)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/overview/mizan.xlsx", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = mizan(url.searchParams);
    const money = value => MONEY_FORMAT.format(value || 0);
    const columns = ["Cari No", "Cari", "Tür", "Grup", "Devir", "Dönem Borç", "Dönem Alacak", "Bakiye", "Durum"];
    const rows = data.rows.map(row => ({ "Cari No": row.refNo, Cari: row.name, Tür: TYPE_TEXT[row.type] || "", Grup: [row.groupName, row.subgroupName].filter(Boolean).join(" › "), Devir: money(row.opening), "Dönem Borç": money(row.debit), "Dönem Alacak": money(row.credit), Bakiye: money(row.closing), Durum: sideText(row.closing) }));
    rows.push({ "Cari No": "", Cari: "TOPLAM", Tür: "", Grup: "", Devir: money(data.totals.opening), "Dönem Borç": money(data.totals.debit), "Dönem Alacak": money(data.totals.credit), Bakiye: money(data.totals.closing), Durum: `Borçlular ${money(data.totals.closingDebtor)} · Alacaklılar ${money(data.totals.closingCreditor)}` });
    const buffer = buildXlsx([{ name: "Mizan", columns, rows }], { title: `Cari Mizanı ${rangeText(data)}` });
    audit(user, "overview.exported", "mizan.xlsx", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `Mizan ${fileRange(data)}.xlsx` });
  });

  // ---------- A2. Cari ekstre (tarih aralıklı) ----------
  function ekstre(user, params) {
    const range = rangeOf(params, { preset: "thisMonth" });
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
      title: `Cari Ekstre · ${data.account.name}`,
      subtitle: [data.account.refNo ? `Cari No ${data.account.refNo}` : "", rangeText(data), "B: borçlu · A: alacaklı"].filter(Boolean).join(" · "),
      headers: ["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"],
      types: ["", "", "", "money", "money", "money"],
      rows: ekstreRows(data),
      summary: [["Devir", tl(data.opening)], ["Dönem Borç", tl(data.debit)], ["Dönem Alacak", tl(data.credit)], ["Dönem Sonu Bakiye", `${tl(Math.abs(data.closing))} ${sideText(data.closing)}`]],
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
      { Tarih: dayText(data.to), İşlem: "Dönem sonu", Açıklama: sideText(data.closing), "Makbuz No": "", Borç: money(data.debit), Alacak: money(data.credit), Bakiye: money(data.closing) },
    ];
    const buffer = buildXlsx([{ name: "Ekstre", columns, rows }], { title: `Cari Ekstre ${data.account.name}` });
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
    // Tablolardaki ödeme günleri ve ödeme sözleri (v2.0.9, tahsilat takvimiyle aynı kalemler) beklenen giriştir. Taksit
    // kartı olan kişinin sözü kartındaki taksitle aynı parayı anlatır; nakit tahmininde ikinci kez sayılmaz.
    if (withTable) for (const item of await tableItems()) if (!item.deadline && item.amount > 0 && !(item.promise && item.carded)) flows.push(tableFlow(item, { projection: true }));
    // Kasa'ya ileri tarihle girilmiş hareketler (ör. kira, maaş): kendi tarihinde beklenen hareket sayılır.
    // Bugünkü kasa SQL toplamından (Kasa ekranıyla aynı kaynaklar); yalnız ileri tarihli satırlar okunur.
    const cashToday = cash()?.summary ? cash().summary(day).balanceToday : 0;
    for (const entry of cash()?.entries ? cash().entries({ after: day }) : []) flows.push(cashFlow(entry));
    const result = projection({ today: day, from: range.from, to: range.to, cashToday, flows, includeOverdue });
    return { ...result, requested: range, withTable, group, periods: group ? groupFlows(result, group) : null };
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
  const flowSummary = data => [
    ["Bugünkü Kasa", tl(data.cashToday)],
    ...(data.carried.in || data.carried.out ? [["Başlangıca Kadar Beklenen", `+${tl(data.carried.in)} / −${tl(data.carried.out)}`]] : []),
    ["Başlangıç Kasası", tl(data.opening)],
    ["Beklenen Giriş", tl(data.totals.in)],
    ["Beklenen Çıkış", tl(data.totals.out)],
    ["Dönem Sonu Tahmini Kasa", tl(data.closing)],
    ["En Düşük Tahmini Kasa", `${tl(data.lowest.balance)} (${dayText(data.lowest.date)})`],
    ["Gecikmiş Alacak / Borç", `${tl(data.overdueTotals.in)} / ${tl(data.overdueTotals.out)}`],
  ];
  router.get("/api/workspace/overview/nakit-akisi.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = await cashflow(user, url.searchParams);
    const pdf = tablePdf({
      title: "Nakit Akış Projeksiyonu",
      subtitle: [`${dayText(data.from)} – ${dayText(data.to)}`, `Taksit, çek/senet${data.withTable ? ", tablodaki ödeme günleri" : ""} ve ileri tarihli Kasa hareketleri`, data.group ? `${GROUP_TEXT[data.group]} toplamlar` : "Aynı gün önce çıkışlar yazılır"].join(" · "),
      ...(data.group
        ? { headers: [GROUP_HEAD[data.group], "Hareket", "Giriş", "Çıkış", "Net", "Dönem sonu kasa"], types: ["", "number", "money", "money", "money", "money"], rows: periodRows(data) }
        : { headers: ["Vade", "Kaynak", "Açıklama", "Kimden / Kime", "Giriş", "Çıkış", "Beklenen Kasa"], types: ["", "", "", "", "money", "money", "money"], rows: flowRows(data) }),
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
    const columns = ["Vade", "Kaynak", "Açıklama", "Kimden / Kime", "Giriş", "Çıkış", "Beklenen Kasa"];
    const rows = [
      { Vade: dayText(data.from), Kaynak: "Başlangıç", Açıklama: "Bugünkü kasa" + (data.carried.in || data.carried.out ? " + başlangıca kadar beklenenler" : "") + (data.includeOverdue ? " + gecikmişler" : ""), "Kimden / Kime": "", Giriş: "", Çıkış: "", "Beklenen Kasa": money(data.opening) },
      ...data.rows.map(row => ({ Vade: dayText(row.date), Kaynak: SOURCE_TEXT[row.source] || row.source, Açıklama: row.label, "Kimden / Kime": row.party || "", Giriş: row.direction === "in" ? money(row.amount) : "", Çıkış: row.direction === "out" ? money(row.amount) : "", "Beklenen Kasa": money(row.balance) })),
    ];
    const overdue = data.overdue.map(row => ({ Vade: dayText(row.date), Kaynak: SOURCE_TEXT[row.source] || row.source, Açıklama: row.label, "Kimden / Kime": row.party || "", Giriş: row.direction === "in" ? money(row.amount) : "", Çıkış: row.direction === "out" ? money(row.amount) : "", "Beklenen Kasa": "" }));
    const summary = flowSummary(data).map(([label, value]) => ({ Kalem: label, Tutar: value }));
    const periodColumns = [GROUP_HEAD[data.group || "month"], "Hareket", "Giriş", "Çıkış", "Net", "Dönem sonu kasa"];
    const periods = data.group ? periodRows(data).map(row => Object.fromEntries(periodColumns.map((column, index) => [column, row[index]]))) : [];
    const buffer = buildXlsx(
      [
        ...(data.group ? [{ name: `${GROUP_TEXT[data.group]} toplamlar`.slice(0, 31), columns: periodColumns, rows: periods }] : []),
        { name: "Nakit Akışı", columns, rows },
        { name: "Gecikmiş", columns, rows: overdue },
        { name: "Özet", columns: ["Kalem", "Tutar"], rows: summary },
      ],
      { title: "Nakit Akış Projeksiyonu" },
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
  const visibleSources = user => DUE_SOURCES.filter(source => (source === "cheque" || source === "note" ? canUser(user, "overview.view") || canUser(user, "cheques.view") : source === "cash" ? canUser(user, "overview.view") || canUser(user, "cash.view") : true));
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
    if (sources.has("cash") && cash()?.entries) for (const entry of cash().entries({ after: day })) items.push(cashFlow(entry));
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
    const buffer = buildXlsx(sheets, { title: "Vade Takip" });
    audit(user, "overview.exported", "vade-takip.xlsx", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `Vade-takip ${dayText(data.today)}.xlsx` });
  });

  return { compute, forUser, mizan, cashflow, vadeTakip };
}
