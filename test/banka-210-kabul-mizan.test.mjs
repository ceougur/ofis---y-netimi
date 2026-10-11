// 2.1.0 — Kabul 1–16 baştan sona API'den, sıfırdan; adım 16 sonu MİZANI bağımsız modelle (plan §12.5: "Adım 33 sonunda mizan (bağımsız
// modelle karşılaştırılır)" tablosunun 2.1.0'a düşen adımlarla karşılığı; eşleme 222 "adım 16 mizanı bağımsız modelle").
//
// Ön koşullar (§12.5): boş şirket; sahte saat 08.10.2026 Perşembe; Stok: Ürün A 10 Adet, Ürün B 25 Adet (parasız giriş); Kasa 0; dönem kilidi
// yok; satış fiyatları KDV %20 dahil.
// Bağımsız model: her adımın yevmiyesi bu dosyada elle yazılır (programın fonksiyonları çağrılmaz); program üç yerden okunur ve modelle
// karşılaştırılır: (1) Ana Defter mizanı (API), (2) Rapor Merkezi → Hesap Planı Mizanı (ekran JSON, PDF, Excel), (3) Yevmiye Defteri (hesap
// hesap borç/alacak toplamları), (4) Alt Hesap Mizanı (102.01 / 102.02).
// Beklenen (adım 16 sonu): 100 = 10.000 · 102.01 = 90.000 · 102.02 = 70.000 · 120 = 0 · 391 = 3.333,33 (A) · 500 = 150.000 (A) ·
// 600 = 16.666,67 (A) · 770 = 0 (transfer ücreti yok) · Borç = Alacak = 170.000; Ürün A 9, Ürün B 25; Gerçek Banka 160.000; Kasa 10.000.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, must, openAcceptanceAccounts, subBalances, trialBalances, ZIRAAT_IBAN } from "./banka-210-hesap-ortak.mjs";

const kurus = tl => Math.round(tl * 100);
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Number(`${match[1] ? "-" : ""}${match[2].replace(/\./g, "")}.${match[3]}`) : null;
};

/** Bağımsız yevmiye: [hesap, alt hesap, taraf, kuruş]. */
class Model {
  constructor() {
    this.main = new Map();
    this.sub = new Map();
    this.debit = new Map();
    this.credit = new Map();
  }
  post(label, lines) {
    let net = 0;
    for (const [code, sub, side, minor] of lines) {
      const signed = side === "B" ? minor : -minor;
      net += signed;
      this.main.set(code, (this.main.get(code) || 0) + signed);
      if (sub) this.sub.set(sub, (this.sub.get(sub) || 0) + signed);
      const book = side === "B" ? this.debit : this.credit;
      book.set(code, (book.get(code) || 0) + minor);
    }
    assert.equal(net, 0, `model fişi dengesiz: ${label}`);
  }
}

describe("Kabul 1–16 (API, sıfırdan) — adım 16 sonu mizanı bağımsız modelle", () => {
  let ctx;
  let acc;
  let abc;
  let urunA;
  let urunB;
  let invoice;
  const model = new Model();
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx?.server.close());

  it("ön koşul: boş şirket; Ürün A 10, Ürün B 25 Adet parasız giriş (deftere para yazmaz)", async () => {
    urunA = await must("Ürün A", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "A", name: "Ürün A", unit: "Adet", openingQty: "10" }));
    urunB = await must("Ürün B", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "25" }));
    const trial = await trialBalances(ctx.api);
    assert.deepEqual(Object.entries(trial).filter(([, value]) => Math.abs(value) > 0.004), [], "parasız stok girişi mizana para yazmaz");
  });

  it("kabul 1–4: Ziraat 100.000 (102.01) ve Garanti 50.000 (102.02), 01.10.2026, Bakiye Doğrulandı → Gerçek Banka 150.000; 500 = 150.000 (A)", async () => {
    acc = await openAcceptanceAccounts(ctx.api);
    assert.deepEqual([acc.ziraat.glSub, acc.garanti.glSub], ["102.01", "102.02"]);
    model.post("açılış Ziraat", [["102", "102.01", "B", kurus(100000)], ["500", "", "A", kurus(100000)]]);
    model.post("açılış Garanti", [["102", "102.02", "B", kurus(50000)], ["500", "", "A", kurus(50000)]]);
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.realBank.minor, kurus(150000));
    for (const account of [acc.ziraat, acc.garanti]) {
      const view = await must("hesap", ctx.api.get(`${BANK}/accounts/${account.id}`));
      assert.deepEqual([view.balanceConfirmed, view.policy], [true, "warn"], "Bakiye Doğrulandı → Eksi Bakiye Denetimi Uyar");
    }
  });

  it("kabul 5–8: ABC Ltd. (IBAN ile); Satış Faturası Ürün A 1 × 20.000 (KDV %20 dahil, açık) → Matrah 16.666,67, KDV 3.333,33; Ürün A 9; ABC 20.000 borçlu", async () => {
    abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01", iban: ZIRAAT_IBAN }));
    invoice = await must("fatura", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: urunA.id, name: "Ürün A", qty: 1, unitPrice: 20000, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    model.post("satış faturası", [["120", "", "B", kurus(20000)], ["600", "", "A", kurus(16666.67)], ["391", "", "A", kurus(3333.33)]]);
    const doc = await must("fatura kartı", ctx.api.get(`/api/workspace/invoices/${invoice.id}`));
    assert.deepEqual([doc.netTotal, doc.vatTotal, doc.payableTotal], [16666.67, 3333.33, 20000], "Matrah 16.666,67 · KDV 3.333,33 · Toplam 20.000");
    assert.equal((await must("Ürün A", ctx.api.get(`/api/workspace/stock/${urunA.id}`))).qty, 9, "Ürün A 9");
    assert.equal((await must("ABC", ctx.api.get(`/api/workspace/accounts/${abc.id}`))).totals.balance, 20000, "ABC borçlu 20.000");
    assert.equal((await must("özet", ctx.api.get(`${BANK}/summary`))).realBank.minor, kurus(150000), "Gerçek Banka 150.000 (değişmedi)");
  });

  it("kabul 9–12: cari kartından Tahsilat 20.000 Havale/EFT Ziraat → Ziraat 120.000; ABC 0; fatura Ödendi", async () => {
    await must("tahsilat", ctx.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "20.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    model.post("tahsilat", [["102", "102.01", "B", kurus(20000)], ["120", "", "A", kurus(20000)]]);
    assert.equal((await must("Ziraat", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor, kurus(120000));
    assert.equal((await must("ABC", ctx.api.get(`/api/workspace/accounts/${abc.id}`))).totals.balance, 0);
    const doc = await must("fatura kartı", ctx.api.get(`/api/workspace/invoices/${invoice.id}`));
    assert.deepEqual([doc.payState, doc.payStateLabel, doc.open], ["paid", "Ödendi", 0], "fatura Ödendi");
  });

  it("kabul 13–14: Kasa → Bankadan Kasaya Aktar 10.000 (Ziraat) → Ziraat 110.000; Kasa 10.000 (yalnız nakit satırı)", async () => {
    await must("bankadan kasaya", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "10.000", date: TODAY, bankAccountId: acc.ziraat.id }));
    model.post("Kasa ↔ Banka", [["100", "", "B", kurus(10000)], ["102", "102.01", "A", kurus(10000)]]);
    assert.equal((await must("Ziraat", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor, kurus(110000));
    const cash = await must("Kasa", ctx.api.get("/api/workspace/cash"));
    assert.equal(cash.byMethod.cash, 10000, "Kasa 10.000");
  });

  it("kabul 15–16: Transfer Ziraat → Garanti 20.000, ücret 0 → Ziraat 90.000, Garanti 70.000; Kasa + Banka 170.000", async () => {
    await must("transfer", ctx.api.post(`${BANK}/transfers`, { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "20.000", date: TODAY, channel: "virman" }));
    model.post("transfer", [["102", "102.02", "B", kurus(20000)], ["102", "102.01", "A", kurus(20000)]]);
    assert.equal((await must("Ziraat", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor, kurus(90000));
    assert.equal((await must("Garanti", ctx.api.get(`${BANK}/accounts/${acc.garanti.id}`))).balanceMinor, kurus(70000));
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    const cash = await must("Kasa", ctx.api.get("/api/workspace/cash"));
    assert.equal(summary.realBank.minor + kurus(cash.byMethod.cash), kurus(170000), "Kasa + Banka 170.000 (= 150.000 + 20.000)");
  });

  it("adım 16 sonu mizan (Ana Defter, API) = bağımsız model; modelde olmayan hesapta bakiye yok; 770 = 0; Borç = Alacak = 170.000", async () => {
    const trial = await trialBalances(ctx.api);
    const want = { 100: 10000, 102: 160000, 120: 0, 391: -3333.33, 500: -150000, 600: -16666.67, 770: 0 };
    for (const [code, minor] of model.main) assert.equal(kurus(trial[code] || 0), minor, `mizan ${code}: program ${trial[code] || 0} / model ${minor / 100}`);
    for (const [code, value] of Object.entries(want)) assert.equal(kurus(trial[code] || 0), kurus(value), `plan §12.5 karşılığı ${code}`);
    const extra = Object.entries(trial).filter(([code, value]) => !model.main.has(code) && Math.abs(value) > 0.004);
    assert.deepEqual(extra, [], "modelde olmayan hesapta bakiye (ör. 153/621/770)");
    const ledger = await must("mizan", ctx.api.get("/api/workspace/ledger"));
    assert.equal(kurus(ledger.trial.totals.debit), kurus(ledger.trial.totals.credit), "Borç = Alacak");
    const debit = [...model.main.values()].filter(v => v > 0).reduce((a, b) => a + b, 0);
    assert.equal(debit, kurus(170000), "model borç bakiyeleri toplamı 170.000");
    const subs = await subBalances(ctx.api);
    for (const [sub, minor] of model.sub) assert.equal(kurus(subs[sub]?.balance || 0), minor, `Alt Hesap Mizanı ${sub}`);
    assert.equal((await must("Ürün A", ctx.api.get(`/api/workspace/stock/${urunA.id}`))).qty, 9, "Ürün A 9");
    assert.equal((await must("Ürün B", ctx.api.get(`/api/workspace/stock/${urunB.id}`))).qty, 25, "Ürün B 25");
    const result = await integrityOk(ctx.api, "kabul 16");
    for (const code of ["bank:transfer", "gl:102"]) {
      const item = result.checks.find(check => check.code === code || check.code.startsWith(`${code}:`));
      if (item) assert.ok(item.ok, `${code} temiz`);
    }
  });

  it("Rapor Merkezi → Hesap Planı Mizanı (ekran JSON, PDF, Excel) = bağımsız model; Yevmiye Defteri hesap hesap borç/alacak = model", async () => {
    const q = "?from=2026-01-01&to=2026-12-31";
    const report = await must("Hesap Planı Mizanı", ctx.api.get(`/api/workspace/report-center/hesap-mizani${q}`));
    const col = name => report.headers.indexOf(name);
    const rows = Object.fromEntries(report.rows.map(row => [row[0], row]));
    for (const [code, minor] of model.main) {
      const row = rows[code];
      if (!minor) {
        if (row) assert.equal(moneyOf(row[col("Bakiye")]), 0, `rapor ${code} bakiye 0`);
        continue;
      }
      assert.ok(row, `raporda ${code} satırı`);
      const signed = moneyOf(row[col("Bakiye")]) * (row[col("Yön")] === "Alacak" ? -1 : 1);
      assert.equal(kurus(signed), minor, `rapor ${code}: ${row[col("Bakiye")]} ${row[col("Yön")]}`);
      assert.equal(kurus(moneyOf(row[col("Borç")])), model.debit.get(code) || 0, `rapor ${code} dönem borç`);
      assert.equal(kurus(moneyOf(row[col("Alacak")])), model.credit.get(code) || 0, `rapor ${code} dönem alacak`);
    }
    const summary = Object.fromEntries(report.summary);
    assert.equal(moneyOf(summary["Fark"]), 0, "Fark 0");
    assert.equal(moneyOf(summary["Dönem Borç"]), moneyOf(summary["Dönem Alacak"]));
    const pdf = await ctx.api.raw("GET", `/api/workspace/report-center/hesap-mizani/pdf${q}`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    for (const row of report.rows) for (const cell of row) if (moneyOf(cell) !== null) assert.ok(text.includes(cell), `PDF'te "${cell}" (${row[0]})`);
    const xlsx = await ctx.api.raw("GET", `/api/workspace/report-center/hesap-mizani/xlsx${q}`);
    assert.equal(xlsx.status, 200);
    const sheet = Object.values(xlsxSheets(xlsx.buffer))[0];
    for (const row of report.rows) {
      const line = sheet.find(cells => String(cells[0]) === row[0]);
      assert.ok(line, `Excel'de ${row[0]}`);
      assert.equal(Number(line[col("Bakiye")]), moneyOf(row[col("Bakiye")]), `Excel ${row[0]} bakiye`);
    }
    // Yevmiye: her hesabın borç ve alacak toplamı (alt hesap satırları ana hesaba toplanır).
    const journal = await must("Yevmiye", ctx.api.get(`/api/workspace/report-center/yevmiye${q}`));
    const jd = new Map();
    const jc = new Map();
    for (const row of journal.rows) {
      const code = String(row[3]).split(/[ .]/)[0];
      jd.set(code, (jd.get(code) || 0) + kurus(moneyOf(row[4]) || 0));
      jc.set(code, (jc.get(code) || 0) + kurus(moneyOf(row[5]) || 0));
    }
    for (const code of new Set([...model.debit.keys(), ...model.credit.keys(), ...jd.keys(), ...jc.keys()])) {
      assert.equal(jd.get(code) || 0, model.debit.get(code) || 0, `Yevmiye ${code} borç`);
      assert.equal(jc.get(code) || 0, model.credit.get(code) || 0, `Yevmiye ${code} alacak`);
    }
  });
});
