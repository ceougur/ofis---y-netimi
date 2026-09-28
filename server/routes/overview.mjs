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
import { presetRange, projection, statement, trialBalance } from "../lib/finance-report.mjs";
import { HttpError, limited, ok, sendBuffer, text } from "../lib/http.mjs";
import { roundMoney } from "../lib/money.mjs";
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
const SOURCE_TEXT = { plan: "Taksit", cheque: "Çek", note: "Senet", cash: "Kasa (ileri tarihli)" };

const MONEY_FORMAT = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function registerOverviewRoutes(router, { store, auth, audit, events, cash = () => null, accounts = () => null, plans = () => null, stock = () => null, cheques = () => null, now: clock = () => new Date() }) {
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
    const cashBlock = { balance: cashSummary.balance, today: cashSummary.today, month: cashSummary.month, futureEntries: cashSummary.futureEntries };
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
  router.get("/api/workspace/overview", async ({ req, res }) => {
    auth.requirePermission(req, "overview.view");
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
  const rangeText = ({ from, to }) => `${from ? dayText(from) : "…"} – ${to ? dayText(to) : "…"}`;
  const fileRange = ({ from, to }) => `${from ? dayText(from) : "baslangic"}-${to ? dayText(to) : "bugun"}`;

  // ---------- A. Mizan ----------
  function mizan(params) {
    const range = rangeOf(params, { preset: "thisMonth" });
    const type = TYPE_TEXT[text(params.get("type"))] ? text(params.get("type")) : "";
    const side = ["debtor", "creditor"].includes(text(params.get("side"))) ? text(params.get("side")) : "";
    const q = text(params.get("q")).toLocaleLowerCase("tr-TR").slice(0, 120);
    const includeIdle = params.get("idle") === "1";
    const ledgers = accounts()?.allLedgers ? accounts().allLedgers() : { accounts: [], lines: new Map() };
    const list = ledgers.accounts.filter(account => (!type || account.type === type) && (!q || `${account.name} ${account.refNo} ${account.groupName}`.toLocaleLowerCase("tr-TR").includes(q)));
    const result = trialBalance(list, ledgers.lines, { ...range, includeIdle });
    let rows = result.rows;
    if (side) rows = rows.filter(row => row.side === side);
    rows.sort((a, b) => collator.compare(String(a.refNo || "~"), String(b.refNo || "~")) || collator.compare(a.name, b.name));
    const totals = side ? trialBalance(list.filter(account => rows.some(row => row.id === account.id)), ledgers.lines, { ...range, includeIdle: true }).totals : result.totals;
    return { ...range, type, side, q, includeIdle, rows, totals, today: today() };
  }
  router.get("/api/workspace/overview/mizan", async ({ req, res, url }) => {
    auth.requirePermission(req, "overview.view");
    const data = mizan(url.searchParams);
    const limit = Math.min(5000, Math.max(1, Math.trunc(Number(url.searchParams.get("limit")) || 1000)));
    ok(res, { ...data, rows: data.rows.slice(0, limit), total: data.rows.length, hasMore: data.rows.length > limit });
  });
  const sideText = value => (value > 0.005 ? "Borçlu (bize borçlu)" : value < -0.005 ? "Alacaklı (biz borçluyuz)" : "Kapalı");
  const mizanTable = data => ({
    headers: ["Cari No", "Cari", "Tür", "Devir", "Borç", "Alacak", "Bakiye", "Durum"],
    types: ["", "", "", "money", "money", "money", "money", ""],
    rows: data.rows.map(row => [row.refNo, row.name, TYPE_TEXT[row.type] || "", tl(row.opening), tl(row.debit), tl(row.credit), tl(Math.abs(row.closing)), sideText(row.closing)]),
    summary: [
      ["Cari sayısı", String(data.totals.count)],
      ["Devir (net)", tl(data.totals.opening)],
      ["Dönem borç", tl(data.totals.debit)],
      ["Dönem alacak", tl(data.totals.credit)],
      ["Bize borçlu (alacağımız)", tl(data.totals.closingDebtor)],
      ["Biz borçluyuz (borcumuz)", tl(data.totals.closingCreditor)],
    ],
  });
  router.get("/api/workspace/overview/mizan.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = mizan(url.searchParams);
    const clipped = data.rows.length > PDF_ROWS;
    const table = mizanTable({ ...data, rows: data.rows.slice(0, PDF_ROWS) });
    const pdf = tablePdf({ title: "Cari Mizanı", subtitle: [rangeText(data), data.type ? TYPE_TEXT[data.type] : "Tüm cariler", clipped ? "ilk 20.000 satır (tamamı Excel'de)" : ""].filter(Boolean).join(" · "), ...table, officeName: office(), userName: userName(user), brand: office() || "DestekOfis" });
    audit(user, "overview.exported", "mizan.pdf", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, pdf, { type: "application/pdf", name: `Mizan ${fileRange(data)}.pdf`, inline: url.searchParams.get("download") !== "1" });
  });
  router.get("/api/workspace/overview/mizan.xlsx", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = mizan(url.searchParams);
    const money = value => MONEY_FORMAT.format(value || 0);
    const columns = ["Cari No", "Cari", "Tür", "Grup", "Devir", "Dönem borç", "Dönem alacak", "Bakiye", "Durum"];
    const rows = data.rows.map(row => ({ "Cari No": row.refNo, Cari: row.name, Tür: TYPE_TEXT[row.type] || "", Grup: [row.groupName, row.subgroupName].filter(Boolean).join(" › "), Devir: money(row.opening), "Dönem borç": money(row.debit), "Dönem alacak": money(row.credit), Bakiye: money(row.closing), Durum: sideText(row.closing) }));
    rows.push({ "Cari No": "", Cari: "TOPLAM", Tür: "", Grup: "", Devir: money(data.totals.opening), "Dönem borç": money(data.totals.debit), "Dönem alacak": money(data.totals.credit), Bakiye: money(data.totals.closing), Durum: `Bize borçlu ${money(data.totals.closingDebtor)} · Biz borçluyuz ${money(data.totals.closingCreditor)}` });
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
    [dayText(data.from), "Devir", "Dönem başı bakiye", "", "", tl(Math.abs(data.opening)) + (data.opening > 0.005 ? " B" : data.opening < -0.005 ? " A" : "")],
    ...data.lines.map(line => [dayText(line.date), line.label, [line.note, line.receiptNo ? `Makbuz ${line.receiptNo}` : ""].filter(Boolean).join(" · "), line.debit ? tl(line.debit) : "", line.credit ? tl(line.credit) : "", tl(Math.abs(line.balance)) + (line.balance > 0.005 ? " B" : line.balance < -0.005 ? " A" : "")]),
  ];
  router.get("/api/workspace/overview/ekstre.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = ekstre(user, url.searchParams);
    const pdf = tablePdf({
      title: `Cari Ekstre · ${data.account.name}`,
      subtitle: [data.account.refNo ? `Cari No ${data.account.refNo}` : "", rangeText(data), "B: bize borçlu · A: biz borçluyuz"].filter(Boolean).join(" · "),
      headers: ["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"],
      types: ["", "", "", "money", "money", "money"],
      rows: ekstreRows(data),
      summary: [["Devir", tl(data.opening)], ["Dönem borç", tl(data.debit)], ["Dönem alacak", tl(data.credit)], ["Dönem sonu bakiye", `${tl(Math.abs(data.closing))} ${sideText(data.closing)}`]],
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
      { Tarih: dayText(data.from), İşlem: "Devir", Açıklama: "Dönem başı bakiye", "Makbuz No": "", Borç: "", Alacak: "", Bakiye: money(data.opening) },
      ...data.lines.map(line => ({ Tarih: dayText(line.date), İşlem: line.label, Açıklama: line.note, "Makbuz No": line.receiptNo ? String(line.receiptNo) : "", Borç: line.debit ? money(line.debit) : "", Alacak: line.credit ? money(line.credit) : "", Bakiye: money(line.balance) })),
      { Tarih: dayText(data.to), İşlem: "Dönem sonu", Açıklama: sideText(data.closing), "Makbuz No": "", Borç: money(data.debit), Alacak: money(data.credit), Bakiye: money(data.closing) },
    ];
    const buffer = buildXlsx([{ name: "Ekstre", columns, rows }], { title: `Cari Ekstre ${data.account.name}` });
    audit(user, "overview.exported", "ekstre.xlsx", { accountId: data.account.id, from: data.from, to: data.to });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `Ekstre ${data.account.name} ${fileRange(data)}.xlsx` });
  });

  // ---------- B. Nakit akış projeksiyonu ----------
  function cashflow(user, params) {
    const range = rangeOf(params, { preset: "next30" });
    const day = today();
    const includeOverdue = params.get("overdue") === "1";
    const flows = [];
    if (plans()?.openItems) flows.push(...plans().openItems(day));
    if (cheques()?.flows) flows.push(...cheques().flows());
    // Kasa'ya ileri tarihle girilmiş hareketler (ör. kira, maaş): kendi tarihinde beklenen hareket sayılır.
    // Bugünkü kasa SQL toplamından (Kasa ekranıyla aynı kaynaklar); yalnız ileri tarihli satırlar okunur.
    const cashToday = cash()?.summary ? cash().summary(day).balanceToday : 0;
    for (const entry of cash()?.entries ? cash().entries({ after: day }) : []) {
      flows.push({ date: entry.date, direction: entry.kind === "out" ? "out" : "in", amount: entry.amount, source: "cash", label: entry.description || (entry.kind === "in" ? "Tahsilat" : "Ödeme"), party: entry.accountName || entry.planName || entry.caseTitle || "", ref: null });
    }
    const result = projection({ today: day, from: range.from, to: range.to, cashToday, flows, includeOverdue });
    return { ...result, requested: range };
  }
  router.get("/api/workspace/overview/nakit-akisi", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = cashflow(user, url.searchParams);
    ok(res, { ...data, rows: data.rows.slice(0, 5000), rowTotal: data.rows.length });
  });
  const flowRows = data => [
    ...data.rows.map(row => [dayText(row.date), SOURCE_TEXT[row.source] || row.source, row.label, row.party || "", row.direction === "in" ? tl(row.amount) : "", row.direction === "out" ? tl(row.amount) : "", tl(row.balance)]),
    ...(data.overdue.length ? [["", "", `— Vadesi geçmiş, kapanmamış (${data.includeOverdue ? "başlangıca eklendi" : "tahmine dahil değil"}) —`, "", "", "", ""]] : []),
    ...data.overdue.map(row => [dayText(row.date), `${SOURCE_TEXT[row.source] || row.source} · gecikmiş`, row.label, row.party || "", row.direction === "in" ? tl(row.amount) : "", row.direction === "out" ? tl(row.amount) : "", ""]),
  ];
  const flowSummary = data => [
    ["Bugünkü kasa", tl(data.cashToday)],
    ...(data.carried.in || data.carried.out ? [["Başlangıca kadar beklenen", `+${tl(data.carried.in)} / −${tl(data.carried.out)}`]] : []),
    ["Başlangıç kasası", tl(data.opening)],
    ["Beklenen giriş", tl(data.totals.in)],
    ["Beklenen çıkış", tl(data.totals.out)],
    ["Dönem sonu tahmini kasa", tl(data.closing)],
    ["En düşük tahmini kasa", `${tl(data.lowest.balance)} (${dayText(data.lowest.date)})`],
    ["Gecikmiş alacak / borç", `${tl(data.overdueTotals.in)} / ${tl(data.overdueTotals.out)}`],
  ];
  router.get("/api/workspace/overview/nakit-akisi.pdf", async ({ req, res, url }) => {
    const user = auth.requirePermission(req, "overview.view");
    const data = cashflow(user, url.searchParams);
    const pdf = tablePdf({
      title: "Nakit Akış Projeksiyonu",
      subtitle: [`${dayText(data.from)} – ${dayText(data.to)}`, "Taksit, çek/senet ve ileri tarihli Kasa hareketleri", "Aynı gün önce çıkışlar yazılır"].join(" · "),
      headers: ["Vade", "Kaynak", "Açıklama", "Kimden / kime", "Giriş", "Çıkış", "Beklenen kasa"],
      types: ["", "", "", "", "money", "money", "money"],
      rows: flowRows(data),
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
    const data = cashflow(user, url.searchParams);
    const money = value => MONEY_FORMAT.format(value || 0);
    const columns = ["Vade", "Kaynak", "Açıklama", "Kimden / kime", "Giriş", "Çıkış", "Beklenen kasa"];
    const rows = [
      { Vade: dayText(data.from), Kaynak: "Başlangıç", Açıklama: "Bugünkü kasa" + (data.carried.in || data.carried.out ? " + başlangıca kadar beklenenler" : "") + (data.includeOverdue ? " + gecikmişler" : ""), "Kimden / kime": "", Giriş: "", Çıkış: "", "Beklenen kasa": money(data.opening) },
      ...data.rows.map(row => ({ Vade: dayText(row.date), Kaynak: SOURCE_TEXT[row.source] || row.source, Açıklama: row.label, "Kimden / kime": row.party || "", Giriş: row.direction === "in" ? money(row.amount) : "", Çıkış: row.direction === "out" ? money(row.amount) : "", "Beklenen kasa": money(row.balance) })),
    ];
    const overdue = data.overdue.map(row => ({ Vade: dayText(row.date), Kaynak: SOURCE_TEXT[row.source] || row.source, Açıklama: row.label, "Kimden / kime": row.party || "", Giriş: row.direction === "in" ? money(row.amount) : "", Çıkış: row.direction === "out" ? money(row.amount) : "", "Beklenen kasa": "" }));
    const summary = flowSummary(data).map(([label, value]) => ({ Kalem: label, Tutar: value }));
    const buffer = buildXlsx(
      [
        { name: "Nakit akışı", columns, rows },
        { name: "Gecikmiş", columns, rows: overdue },
        { name: "Özet", columns: ["Kalem", "Tutar"], rows: summary },
      ],
      { title: "Nakit Akış Projeksiyonu" },
    );
    audit(user, "overview.exported", "nakit-akisi.xlsx", { from: data.from, to: data.to, count: data.rows.length });
    sendBuffer(res, buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `Nakit-akisi ${dayText(data.from)}-${dayText(data.to)}.xlsx` });
  });

  return { compute, forUser, mizan, cashflow };
}
