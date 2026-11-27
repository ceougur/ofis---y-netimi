// 2.5.0 Ç6-HESAP tur 2 — B-a (BAŞ MİMAR KARARI 19.11 22:45): kapanmış yılın ara dönemi. docs/erp/C6-HESAP-TASARIM.md §4, §7.
// BEKLENENLER ELLE (kitabın formülüyle; programın çıktısından değil).
//
// B-a — kapanmış yıl (N-01 / 621 yazılmış) 2026, ürün P (kuruş):
//   05.01 alış 10 × 60,00 = 600,00 (B 153 / A 320) · 15.01 satış 4 Adet (B 120 / A 600 1.000,00) · 10.12 alış 5 × 80,00 = 400,00 (B 153 / A 320)
//   T(t) = DSS_2025 (0) + 153 hareketi [1 Ocak, t] − DSS_t:
//     31.01 … 30.11: miktar 6, birim 60,00 → DSS 360,00 → T = 600 − 360 = 240,00
//     31.12: miktar 11, birim (600 + 400) / 15 = 66,6667 → DSS = 11 × 1000 / 15 = 733,333… → 733,33 (G-1) → T = 1.000,00 − 733,33 = 266,67
//   N-01 (31.12, dönem sonu sınıfı) B 621 / A 153 266,67 (= T(31.12), elle).
//   Aylar: Ocak 240,00 (tahmini) · Şubat–Kasım 0 · Aralık 621 266,67 − T(30.11) 240,00 = 26,67 → toplam 266,67 = yıl (621, kesin).
//   Çeyrekler: Q1 240,00 · Q2 0 · Q3 0 · Q4 266,67 − 240,00 = 26,67 → toplam 266,67.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { balanceSheet, incomeStatement } from "../server/lib/financial-statements.mjs";
import { MOVE_CLASS, createStockValuation } from "../server/lib/stock-valuation.mjs";

const L = (account, debit, credit, sub = "", party = "") => ({ account, debit, credit, ...(sub ? { sub } : {}), ...(party ? { party } : {}) });
const E = (id, date, ...lines) => ({ id, date, source: "test", text: id, lines });
const P_ENTRIES = [
  E("invoice:a1", "2026-01-05", L("153", 60000, 0), L("320", 0, 60000, "", "S")),
  E("invoice:s1", "2026-01-15", L("120", 100000, 0, "", "C"), L("600", 0, 100000)),
  E("invoice:a2", "2026-12-10", L("153", 40000, 0), L("320", 0, 40000, "", "S")),
  E("voucher-end:n01", "2026-12-31", L("621", 26667, 0), L("153", 0, 26667)),
];
const P_VAL = () => createStockValuation({
  items: [{ id: "P", code: "P", name: "Ürün P", unit: "Adet", unitPriceE4: 600000, deletedDay: "" }],
  moves: [
    { itemId: "P", date: "2026-01-05", cls: MOVE_CLASS.purchase, qtyMilli: 10000, valueMinor: 60000 },
    { itemId: "P", date: "2026-01-15", cls: MOVE_CLASS.quantity, qtyMilli: -4000, valueMinor: 0 },
    { itemId: "P", date: "2026-12-10", cls: MOVE_CLASS.purchase, qtyMilli: 5000, valueMinor: 40000 },
  ],
});
const gt = (from, to, entries = P_ENTRIES, valuation = P_VAL()) => incomeStatement({ entries, valuation, from, to, bookType: "balance" });
const cost = out => out.items.find(row => row.kod === "D").tutarMinor;
const MONTH_ENDS = ["01-31", "02-28", "03-31", "04-30", "05-31", "06-30", "07-31", "08-31", "09-30", "10-31", "11-30", "12-31"];

describe("B-a — kapanmış yılın ara dönemi: 31.12'yi içermeyen parça T(b) − T(a − 1), N-01 yalnız 31.12 parçasında", () => {
  it("yıl [01.01, 31.12] kesin: D = 621 266,67, tahmin yok", () => {
    const year = gt("2026-01-01", "2026-12-31");
    assert.equal(cost(year), 26667);
    assert.equal(year.smm.estimated, false);
    assert.ok(!year.kesinDegil.some(row => row.kod === "smm-tahmini"));
  });
  it("aylar (elle): Ocak 240,00, Şubat–Kasım 0, Aralık 26,67; toplam = yıl = 621", () => {
    const months = MONTH_ENDS.map((end, index) => gt(`2026-${String(index + 1).padStart(2, "0")}-01`, `2026-${end}`));
    assert.deepEqual(months.map(cost), [24000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2667]);
    assert.equal(months.reduce((sum, out) => sum + cost(out), 0), 26667);
    assert.equal(months[0].smm.estimated, true, "Ocak tahminidir (Kesin Değil)");
    const dec = months[11];
    assert.deepEqual(dec.items.find(row => row.kod === "D").hesaplar.map(row => [row.hesap, row.ad, row.tutarMinor, Boolean(row.tahmini)]), [["621", "Satılan Ticari Mallar Maliyeti", 26667, false], ["621", "Önceki Dönemlere Dağıtılan Maliyet (Tahmini)", -24000, true]]);
    assert.ok(dec.kesinDegil.some(row => row.kod === "smm-tahmini"), "Aralık parçası tahmin taşır");
    assert.equal(dec.smm.minor, 2667);
  });
  it("çeyrekler (elle): Q1 240,00 · Q2 0 · Q3 0 · Q4 26,67; toplam = yıl; yarıyıl + yarıyıl = yıl", () => {
    const quarters = [["01-01", "03-31"], ["04-01", "06-30"], ["07-01", "09-30"], ["10-01", "12-31"]].map(([a, b]) => gt(`2026-${a}`, `2026-${b}`));
    assert.deepEqual(quarters.map(cost), [24000, 0, 0, 2667]);
    assert.equal(cost(gt("2026-01-01", "2026-06-30")) + cost(gt("2026-07-01", "2026-12-31")), 26667);
    assert.equal(quarters.reduce((sum, out) => sum + out.subtotals.donemNetKari, 0), gt("2026-01-01", "2026-12-31").subtotals.donemNetKari);
  });
  it("yıl içi Bilanço (30.06): 153 = DSS_t 360,00 (N-01 31.12'de; t'den sonra), hesaplanmış = Gelir Tablosu [01.01, 30.06]; Aktif = Pasif", () => {
    const out = balanceSheet({ entries: P_ENTRIES, valuation: P_VAL(), date: "2026-06-30", bookType: "balance", closedOn: "" });
    const stock = out.aktif.gruplar[0].kalemler.find(row => row.kod === "I.E").hesaplar.find(row => row.hesap === "153");
    assert.deepEqual([stock.tutarMinor, stock.tahmini], [36000, true]);
    assert.equal(out.hesaplanmis.donemNetKari.tutarMinor, 100000 - 24000);
    assert.equal(out.toplamlar.farkMinor, 0);
  });
  it("31.12 Bilanço (N-01 yazılmış): 153 defterden 733,33 (= DSS), satışların maliyeti kesin; Aktif = Pasif", () => {
    const out = balanceSheet({ entries: P_ENTRIES, valuation: P_VAL(), date: "2026-12-31", bookType: "balance", closedOn: "" });
    const stock = out.aktif.gruplar[0].kalemler.find(row => row.kod === "I.E").hesaplar.find(row => row.hesap === "153");
    assert.deepEqual([stock.tutarMinor, stock.tahmini], [73333, undefined]);
    assert.equal(out.smm.kesin, true);
    assert.equal(out.hesaplanmis.donemNetKari.tutarMinor, 100000 - 26667);
    assert.equal(out.toplamlar.farkMinor, 0);
    assert.ok(!out.kesinDegil.some(row => row.kod === "smm-tahmini"));
  });
});
