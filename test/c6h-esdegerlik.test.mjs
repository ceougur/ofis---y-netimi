// 2.5.0 Ç6-HESAP tur 3 — B-g (b) EŞDEĞERLİK (docs/erp/C6-HESAP-TASARIM.md §8 "B-g (b) TASARIMI"; BAŞ MİMAR KARARI 20.11 11:37; ders 47: hız düzeltmesi eşdeğerlik testiyle).
// Kilitli kipte Bilanço ve Gelir Tablosu donmuş dönemi TOPLAMLARDAN (ledger-snapshots frozenSums) okur; ESKİ okuma (c6h2-uc'nin bileşimi: karma yevmiyenin maddeleri + aynı saf işlevler,
// frozen girdisi YOK) ile çıktı BİREBİR (deepStrictEqual — sıra, işaret, Kesin Değil ayrıntısının sırası dahil). Beklenen sayı programın yeni çıktısından türetilmez: karşılaştırılan, aynı
// verinin eski okumasıdır. Veri programın KENDİ API'sinden + fiş defterine iki olağan Mahsup Fişi (692 sonra 690 — önekle sınıflanamayan 6 hesabı; ilk görünüş sırası sıralı sıranın
// TERSİ: sınıflandırılmamış hesap ayrıntısının sırası denetlenir; dondurma iş parçacığı fişleri veri tabanından okur, donmuş satırlara girer). Kural kancası (__testLedgerRule, yalnız test;
// dondurma iş parçacığında YOK) kilitten SONRA açılınca satış maddelerinin 600 / 120'sine 100,00 ekler (donmuş ≠ canlı: kilitli dönemde canlıyı okuyan ya da Kural Değişikliği Farkı'nı
// düşüren yol kırılır). Aşamalar ("nasıl bozulur"): kilitsiz; boş donmuş dönem (kilit veriden önce); kilit 31.03.2026 (t ve
// Gelir Tablosu dönemi kilidin içinde / üstünde / dışında); kilit kaldırılır → Kapanış Fişi 31.12.2025 → yeniden kilit (kapanış sınıfı donmuş); kilit 30.06.2026'ya uzar. Her aşamada yeni okumanın
// donmuş satırları madde madde OKUMADIĞI da denetlenir (book() yalnız kapsamdan sonrasını ister).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";
import { lockAndWait } from "./fixtures/donma-bekle.mjs";
import { bookTypeOf } from "../server/lib/book-type.mjs";
import { balanceSheet, balanceSheetOf, closingDayOf, incomeStatement, incomeStatementOf, periodRuleDiff } from "../server/lib/financial-statements.mjs";
import { frozenSums } from "../server/lib/ledger-snapshots.mjs";
import { createStockValuation, loadValuationInput } from "../server/lib/stock-valuation.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const USER = { id: "admin", display_name: "Yönetici" };
const DATES = ["2025-03-01", "2025-06-30", "2025-12-31", "2026-01-15", "2026-03-30", "2026-03-31", "2026-04-01", "2026-06-30", "2026-07-01", "2026-09-30", "2026-12-31", "2028-02-29"];
const RANGES = [
  ["2025-01-01", "2025-12-31"], ["2025-04-01", "2025-06-30"], ["2025-12-01", "2025-12-31"], ["2026-01-01", "2026-12-31"], ["2026-02-01", "2026-02-28"], ["2026-03-01", "2026-06-30"],
  ["2026-04-01", "2026-04-30"], ["2026-01-01", "2026-03-31"], ["2026-03-31", "2026-03-31"], ["2026-07-01", "2026-09-30"], ["2028-02-01", "2028-02-29"],
];

// ESKİ OKUMA — c6h2-uc'nin balanceSheetOf / incomeStatementOf gövdesi AYNEN (frozen girdisi yok; donmuş dönem karma yevmiyeden madde madde).
function oldBalance(store, ledger, date) {
  const checked = ledger.check();
  const live = checked.entries;
  const entries = ledger.book({ to: date, live });
  const cover = ledger.snapshots?.state?.().coverage || "";
  // Tur 4 (ORTA-1): Bilanço'nun kural farkı cari boyutlu (party) — iki okuma aynı saf işlevi aynı seçenekle çağırır.
  const ruleDiff = cover ? periodRuleDiff({ frozen: entries, live, from: "", to: date < cover ? date : cover, accounts: () => true, party: true }) : null;
  const valuation = createStockValuation(loadValuationInput(store));
  const names = new Map();
  const partyNames = { get: id => (names.has(id) ? names.get(id) : (names.set(id, store.get("SELECT name FROM accounts WHERE id = ?", id)?.name || ""), names.get(id))) };
  return balanceSheet({ entries, valuation, date, bookType: bookTypeOf(store), closedOn: closingDayOf(store, date), ruleDiff, reconciliation: checked.reconciliation, partyNames });
}
function oldIncome(store, ledger, from, to) {
  const start = `${from.slice(0, 4)}-01-01`;
  const cover = ledger.snapshots?.state?.().coverage || "";
  let entries;
  let ruleDiff = null;
  if (cover && cover >= start) {
    const live = ledger.build();
    entries = ledger.book({ from: start, to, live });
    ruleDiff = periodRuleDiff({ frozen: entries, live, from: start, to: to < cover ? to : cover });
  } else entries = ledger.book({ from: start, to });
  const valuation = createStockValuation(loadValuationInput(store));
  return incomeStatement({ entries, valuation, from, to, bookType: bookTypeOf(store), ruleDiff });
}

describe("Ç6-HESAP tur 3 — B-g (b): donmuş toplamlarla okuma ↔ eski okuma BİREBİR (Bilanço, Gelir Tablosu; kilitli / kilitsiz, kapanış fişi, kural farkı)", () => {
  const rule = { diff: false };
  rule.fn = entries => entries.map(entry => {
    let lines = entry.lines;
    if (rule.diff && lines.some(line => line.account === "600")) lines = lines.map(line => (line.account === "600" ? { ...line, credit: line.credit + 10000 } : line.account === "120" ? { ...line, debit: line.debit + 10000 } : line));
    return lines === entry.lines ? entry : { ...entry, lines };
  });
  let ctx;
  let api;
  before(async () => {
    ctx = await boot({ now: { time: NOW, fixed: true }, __testLedgerRule: rule });
    api = ctx.api;
    const supplier = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Tedarikçi T", type: "supplier" }))).id;
    const ayse1 = (await must("Ayşe 1", api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer" }))).id;
    const ayse2 = (await must("Ayşe 2", api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", force: true }))).id;
    const item = (await must("ürün", api.post("/api/workspace/stock", { name: "Ürün P", unit: "Adet", unitPrice: "50", openingQty: "10", openingDate: "2025-01-10" }))).id;
    const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
    // Alt hesap boyutu (102.NN) donmuş dönemde: banka hesabı açılışı + havale tahsilatı (Bilanço I.A 102'nin alt satırları).
    await must("banka kurulumu kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
    const bank = await must("banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2025-01-05", amount: "2500", confirmed: true } }));
    await must("2025 kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "1000", description: "Danışmanlık", date: "2025-02-01" }));
    await must("2025 kasa çıkışı", api.post("/api/workspace/cash", { kind: "out", amount: "200", description: "Kırtasiye", date: "2025-03-01" }));
    await must("2025 alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier, number: "AL-1", issueDate: "2025-03-05", lines: [{ itemId: item, name: "", qty: 20, unitPrice: 60, discountRate: 0, vatRate: 20 }], payment: pay, force: true }));
    await must("2025 satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ayse1, issueDate: "2025-05-04", lines: [{ itemId: item, name: "", qty: 25, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: pay, force: true }));
    await must("2025 Ayşe 2 avans", api.post(`/api/workspace/accounts/${ayse2}/entries`, { kind: "in", amount: "400", date: "2025-06-01", note: "Avans" }));
    await must("2025 Ayşe 1 havale", api.post(`/api/workspace/accounts/${ayse1}/entries`, { kind: "in", amount: "500", date: "2025-07-01", method: "bank", bankAccountId: bank.id }));
    await must("2026 alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier, number: "AL-2", issueDate: "2026-01-20", lines: [{ itemId: item, name: "", qty: 10, unitPrice: 70, discountRate: 0, vatRate: 20 }], payment: pay, force: true }));
    await must("2026 satış (Şubat)", api.post("/api/workspace/invoices", { kind: "sale", accountId: ayse1, issueDate: "2026-02-10", lines: [{ itemId: item, name: "", qty: 3, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: pay, force: true }));
    await must("2026 kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "500", description: "Hizmet", date: "2026-02-28" }));
    await must("2026 tedarikçiye iade (31.03)", api.post(`/api/workspace/stock/${item}/moves`, { kind: "out", reason: "preturn", qty: "2", unitPrice: "70", pay: "account", accountId: supplier, date: "2026-03-31" }));
    await must("2026 satış (01.04)", api.post("/api/workspace/invoices", { kind: "sale", accountId: ayse1, issueDate: "2026-04-01", lines: [{ itemId: item, name: "", qty: 2, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: pay, force: true }));
    await must("2026 kasa çıkışı", api.post("/api/workspace/cash", { kind: "out", amount: "300", description: "Kırtasiye", date: "2026-07-20" }));
    await must("2026 müşteri iadesi", api.post(`/api/workspace/stock/${item}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "100", pay: "account", accountId: ayse1, date: "2026-08-05" }));
    const vouchers = ctx.app.context.ledger.vouchers;
    vouchers.post(USER, { type: "manual", date: "2025-02-15", requestKey: "c6h3-mahsup-692", description: "Sınama 692", lines: [{ account: "692", debit: 10000 }, { account: "500", credit: 10000 }] });
    vouchers.post(USER, { type: "manual", date: "2025-04-15", requestKey: "c6h3-mahsup-690", description: "Sınama 690", lines: [{ account: "690", debit: 5000 }, { account: "500", credit: 5000 }] });
  });
  after(() => ctx?.server.close());

  // Yeni okuma — book() çağrıları kaydedilir: kilitliyken donmuş satırları madde madde isteyen çağrı (from ≤ kapsam) olmamalı.
  const compare = label => {
    const store = ctx.app.store;
    const ledger = ctx.app.context.ledger;
    const cover = ledger.snapshots.state().coverage || "";
    const calls = [];
    const spied = { ...ledger, book: args => (calls.push({ ...args, live: undefined }), ledger.book(args)) };
    let compared = 0;
    for (const date of DATES) {
      calls.length = 0;
      const neu = balanceSheetOf({ store, ledger: spied, date });
      assert.deepStrictEqual(neu, oldBalance(store, ledger, date), `${label}: Bilanço ${date}`);
      if (cover) assert.ok(calls.every(call => call.from && call.from > cover), `${label}: Bilanço ${date} donmuş satırları madde madde okumadı (${JSON.stringify(calls)})`);
      compared += 1;
    }
    for (const [from, to] of RANGES) {
      calls.length = 0;
      const neu = incomeStatementOf({ store, ledger: spied, from, to });
      assert.deepStrictEqual(neu, oldIncome(store, ledger, from, to), `${label}: Gelir Tablosu ${from} – ${to}`);
      if (cover && cover >= `${from.slice(0, 4)}-01-01`) assert.ok(calls.every(call => call.from && call.from > cover), `${label}: Gelir Tablosu ${from} – ${to} donmuş satırları madde madde okumadı (${JSON.stringify(calls)})`);
      compared += 1;
    }
    return compared;
  };

  it("kilitsiz → boş donmuş dönem → kilit 31.03.2026 (kural farkıyla) → kilit kaldır + Kapanış Fişi 31.12.2025 + yeniden kilit → kilit 30.06.2026: her aşamada BİREBİR", { timeout: 120_000 }, async () => {
    assert.equal(compare("kilitsiz"), DATES.length + RANGES.length);
    // Boş donmuş dönem: kilit veriden önce (kapsam var, satır yok).
    await lockAndWait(api.client, "2024-12-31");
    assert.equal(ctx.app.ledger.snapshots.state().coverage, "2024-12-31");
    assert.equal(frozenSums(ctx.app.store, { through: "2024-12-31" }).groups.length, 0, "ön koşul: donmuş satır yok");
    compare("boş donmuş dönem");
    // Kilit 31.03.2026: t / dönem kilidin içinde, sınırında, üstünde.
    await lockAndWait(api.client, "2026-03-31");
    assert.equal(ctx.app.ledger.snapshots.state().coverage, "2026-03-31");
    const sums = frozenSums(ctx.app.store, { through: "2026-03-31" });
    assert.ok(sums.groups.some(row => row.account === "692") && sums.groups.some(row => row.account === "690") && sums.groups.some(row => row.party), "ön koşul: donmuş dönemde plan dışı hesap ve cari boyutu var");
    assert.ok(sums.groups.some(row => row.account === "102" && /^102\.\d+$/.test(row.sub)), `ön koşul: donmuş dönemde alt hesap boyutu (102.NN) var: ${JSON.stringify(sums.groups.filter(row => row.account === "102"))}`);
    compare("kilit 31.03.2026");
    const gt2025 = incomeStatementOf({ store: ctx.app.store, ledger: ctx.app.context.ledger, from: "2025-01-01", to: "2025-12-31" });
    assert.deepEqual(gt2025.kesinDegil.find(row => row.kod === "siniflandirilmamis-hesap")?.ayrinti, ["692: 100,00 TL", "690: 50,00 TL"], "ön koşul: ayrıntı ilk görünüş sırasıyla (sıralı değil)");
    rule.diff = true;
    try {
      const out = balanceSheetOf({ store: ctx.app.store, ledger: ctx.app.context.ledger, date: "2026-06-30" });
      assert.ok(out.kesinDegil.some(row => row.kod === "kural-farki"), "ön koşul: kural farkı görünür (donmuş ≠ canlı)");
      compare("kilit 31.03.2026 + kural farkı");
    } finally {
      rule.diff = false;
    }
    // Kilit kaldırılır → Kapanış Fişi (kapanış sınıfı) → yeniden kilit: yeni koşu, kapanış sınıfı donmuş.
    await lockAndWait(api.client, "");
    assert.equal(ctx.app.ledger.snapshots.state().coverage || "", "");
    ctx.app.context.ledger.vouchers.post(USER, { type: "closing", date: "2025-12-31", requestKey: "c6h3-kapanis-2025", description: "2025 kapanışı (sınama)", lines: [
      { account: "649", sub: "649.90", debit: 100000 }, { account: "770", sub: "770.90", credit: 20000 }, { account: "590", credit: 80000 },
    ] });
    compare("kilitsiz + Kapanış Fişi");
    await lockAndWait(api.client, "2026-03-31");
    const closed = balanceSheetOf({ store: ctx.app.store, ledger: ctx.app.context.ledger, date: "2026-06-30" });
    assert.equal(closed.smm.closedYear, 2025, "ön koşul: 2025 kapanmış");
    compare("yeniden kilit 31.03.2026 (kapanış fişli)");
    rule.diff = true;
    try {
      compare("yeniden kilit + kural farkı");
    } finally {
      rule.diff = false;
    }
    await lockAndWait(api.client, "2026-06-30");
    assert.equal(ctx.app.ledger.snapshots.state().coverage, "2026-06-30");
    compare("kilit 30.06.2026");
    rule.diff = true;
    try {
      compare("kilit 30.06.2026 + kural farkı");
    } finally {
      rule.diff = false;
    }
  });

  it("uç (iş parçacığı) = iş parçacığısız yeni okuma = eski okuma — kilitli t (30.06.2026 kilidiyle)", { timeout: 60_000 }, async () => {
    const fs = ctx.app.context.financialStatements;
    for (const date of ["2026-03-31", "2026-06-30", "2026-09-30"]) {
      const viaWorker = await must(`uç ${date}`, api.get(`/api/workspace/financial-statements/balance-sheet?date=${date}`));
      assert.deepEqual(viaWorker, JSON.parse(JSON.stringify(fs.inline({ kind: "balance", date }))), `uç ↔ inline ${date}`);
      assert.deepEqual(viaWorker, JSON.parse(JSON.stringify(oldBalance(ctx.app.store, ctx.app.context.ledger, date))), `uç ↔ eski okuma ${date}`);
    }
    const income = await must("GT uç", api.get("/api/workspace/financial-statements/income-statement?from=2026-03-01&to=2026-09-30"));
    assert.deepEqual(income, JSON.parse(JSON.stringify(oldIncome(ctx.app.store, ctx.app.context.ledger, "2026-03-01", "2026-09-30"))));
  });
});

// Saf işlev düzeyi (programın kendi yollarının üretemediği satırlar dahil): elle yazılmış maddeler — planda olmayan 1–5 hesabı (197 sonra 196) ve 6 hesabı (695 sonra 690), kapanış sınıfı
// (voucher-close:) ve dönem sonu sınıfı (voucher-end:) 153 / 621 satırı, kimliği ':' içermeyen madde, dengesiz madde. Donmuş toplamlar SQL'in kuralıyla (kimlik öneki, 'voucher' öneki,
// madde = kimlik × tarih) bu dosyada JS ile kurulur; okuyan işlevler (frozenPartOf → balanceSheet / incomeStatement / periodRuleDiff) eski okumayla BİREBİR olmalı.
describe("Ç6-HESAP tur 3 — B-g (b) saf işlevler: donmuş toplam ↔ madde madde (elle maddeler; sınıf, sıra, dengesiz madde)", async () => {
  const { frozenPartOf } = await import("../server/lib/financial-statements.mjs");
  const prefixOf = id => (id.includes(":") ? id.slice(0, id.indexOf(":")) : id.slice(0, -1));
  const sumsOf = (entries, { from = "", through, split = "" }) => {
    const groups = new Map();
    const perEntry = new Map();
    for (const entry of entries) {
      if (entry.date < from || entry.date > through) continue;
      const year = Number(entry.date.slice(0, 4));
      const part = entry.date >= split ? 1 : 0;
      const ekey = `${entry.id}|${entry.date}`;
      const e = perEntry.get(ekey) || { year, part, net: 0 };
      for (const line of entry.lines) {
        const net = line.debit - line.credit;
        e.net += net;
        const key = [year, part, prefixOf(entry.id), entry.id.startsWith("voucher"), line.account, line.sub || "", line.party || ""].join("|");
        const g = groups.get(key) || { year, part, prefix: prefixOf(entry.id), voucher: entry.id.startsWith("voucher"), account: line.account, sub: line.sub || "", party: line.party || "", net: 0, lines: 0, last: "" };
        g.net += net;
        g.lines += 1;
        if (entry.date > g.last) g.last = entry.date;
        groups.set(key, g);
      }
      perEntry.set(ekey, e);
    }
    const counts = new Map();
    for (const e of perEntry.values()) {
      const key = `${e.year}|${e.part}`;
      const c = counts.get(key) || { year: e.year, part: e.part, entries: 0, unbalanced: 0 };
      c.entries += 1;
      if (e.net !== 0) c.unbalanced += 1;
      counts.set(key, c);
    }
    const order = entries.filter(entry => entry.date >= from && entry.date <= through);
    return {
      from, through, split, groups: [...groups.values()].sort((a, b) => a.account.localeCompare(b.account)), entries: [...counts.values()],
      firstSeen: accounts => order.flatMap(entry => entry.lines.filter(line => accounts.includes(line.account)).map(line => ({ account: line.account, year: Number(entry.date.slice(0, 4)), part: entry.date >= split ? 1 : 0, prefix: prefixOf(entry.id) }))),
    };
  };
  const L = (account, debit, credit, extra = {}) => ({ account, debit, credit, ...extra });
  const entries = [
    { id: "stock-open:1", date: "2025-01-10", lines: [L("153", 50000, 0), L("519", 0, 50000)] },
    { id: "cash:1", date: "2025-02-01", lines: [L("100", 100000, 0), L("649", 0, 100000, { sub: "649.90" }), L("197", 0, 3000), L("695", 3000, 0)] },
    { id: "cash:2", date: "2025-03-01", lines: [L("770", 20000, 0, { sub: "770.90" }), L("100", 0, 20000), L("196", 0, 1000), L("690", 1000, 0)] },
    { id: "invoice:1", date: "2025-05-04", lines: [L("120", 300000, 0, { party: "c1" }), L("600", 0, 250000), L("391", 0, 50000)] },
    { id: "payment:1", date: "2025-06-01", lines: [L("100", 40000, 0), L("120", 0, 40000, { party: "c2" })] },
    { id: "bozuk", date: "2025-06-02", lines: [L("100", 100, 0), L("600", 0, 90)] },
    { id: "voucher-end:n01", date: "2025-12-31", lines: [L("621", 30000, 0), L("153", 0, 30000)] },
    { id: "voucher-close:k1", date: "2025-12-31", lines: [L("649", 100000, 0, { sub: "649.90" }), L("590", 0, 100000)] },
    { id: "invoice:2", date: "2026-02-10", lines: [L("120", 36000, 0, { party: "c1" }), L("600", 0, 30000), L("391", 0, 6000), L("695", 500, 0), L("197", 0, 500)] },
    { id: "stock:1", date: "2026-03-31", lines: [L("320", 16800, 0, { party: "s1" }), L("153", 0, 14000), L("191", 0, 2800)] },
    { id: "invoice:3", date: "2026-04-01", lines: [L("120", 24000, 0, { party: "c1" }), L("600", 0, 20000), L("391", 0, 4000)] },
  ];
  const valuation = { firstYear: 2025, yearEnd: () => ({ totals: { dssMinor: 0 }, negative: [], clipped: [] }), at: () => ({ totals: { dssMinor: 1000, openingMinor: 0, purchaseMinor: 0, returnMinor: 0 }, negative: [], clipped: [], warnings: [] }) };
  for (const cover of ["2025-06-01", "2025-12-31", "2026-03-31"]) {
    it(`kapsam ${cover}: Bilanço (her t) ve Gelir Tablosu (her dönem) — donmuş toplam + kuyruk = madde madde`, () => {
      const head = entries.filter(entry => entry.date <= cover);
      const tail = entries.filter(entry => entry.date > cover);
      for (const date of ["2025-05-31", "2025-06-01", "2025-12-31", "2026-02-10", "2026-03-31", "2026-06-30"]) {
        const through = date < cover ? date : cover;
        const frozen = frozenPartOf(sumsOf(entries, { through }));
        const ruleOld = periodRuleDiff({ frozen: entries.filter(entry => entry.date <= date), live: [], from: "", to: through, accounts: () => true });
        const ruleNew = periodRuleDiff({ frozen: tail.filter(entry => entry.date <= date), frozenSums: frozen, live: [], from: "", to: through, accounts: () => true });
        assert.deepStrictEqual(ruleNew, ruleOld, `kural farkı ${date}`);
        const old = balanceSheet({ entries: head.concat(tail).filter(entry => entry.date <= date), valuation, date, ruleDiff: ruleOld });
        const neu = balanceSheet({ entries: date > cover ? tail : [], valuation, date, ruleDiff: ruleNew, frozen });
        assert.deepStrictEqual(neu, old, `Bilanço ${date}`);
      }
      for (const [from, to] of [["2025-01-01", "2025-12-31"], ["2025-03-01", "2025-06-30"], ["2025-12-01", "2025-12-31"], ["2026-01-01", "2026-12-31"], ["2026-03-01", "2026-03-31"], ["2026-04-01", "2026-12-31"]]) {
        const start = `${from.slice(0, 4)}-01-01`;
        if (cover < start) continue;
        const through = to < cover ? to : cover;
        const part = frozenPartOf(sumsOf(entries, { from: start, through, split: from }));
        const year = Number(start.slice(0, 4));
        const list = entries.filter(entry => entry.date >= start);
        const old = incomeStatement({ entries: list, valuation, from, to });
        const neu = incomeStatement({ entries: to > cover ? tail : [], valuation, from, to, frozen: part.years.get(year) || { year, split: from, entries: 0, unbalanced: 0, income: [], flow153: [0, 0], has621: false, any67: false, rule: new Map(), unclassifiedOrder: [] } });
        assert.deepStrictEqual(neu, old, `Gelir Tablosu ${from} – ${to}`);
      }
    });
  }
  it("ön koşul: elle maddelerde ayrıntı sırası ilk görünüş sırası (197, 196 ve 695, 690 — sıralı değil), dengesiz madde sayılır", () => {
    const out = balanceSheet({ entries: [], valuation, date: "2025-12-31", frozen: frozenPartOf(sumsOf(entries, { through: "2025-12-31" })) });
    const detail = out.kesinDegil.find(row => row.kod === "siniflandirilmamis-hesap")?.ayrinti || [];
    assert.ok(detail.indexOf("197: −30,00 TL") < detail.indexOf("196: −10,00 TL") && detail.indexOf("196: −10,00 TL") >= 0, JSON.stringify(detail));
    const gt = incomeStatement({ entries: [], valuation, from: "2025-01-01", to: "2025-12-31", frozen: frozenPartOf(sumsOf(entries, { from: "2025-01-01", through: "2025-12-31", split: "2025-01-01" })).years.get(2025) });
    assert.deepEqual(gt.kesinDegil.find(row => row.kod === "siniflandirilmamis-hesap")?.ayrinti, ["695: 30,00 TL", "690: 10,00 TL"]);
    assert.equal(gt.smm.posted, true, "621 (dönem sonu sınıfı) yazılmış yıl");
    assert.ok(gt.kesinDegil.some(row => row.kod === "dengesiz-madde" || /dengesiz/i.test(row.baslik)), JSON.stringify(gt.kesinDegil.map(row => row.kod)));
  });
});
