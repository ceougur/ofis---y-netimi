// 2.5.0 Ç6-HESAP tur 2 — S209 = B (kullanıcı kuralıyla öneri uygulandı 19.11 22:45). docs/erp/C6-HESAP-TASARIM.md §3, §7.
// BEKLENENLER ELLE (kitabın formülüyle; programın çıktısından değil).
// S209 — ürün Q: 05.01 alış 10 × 10,00 = 100,00; 10.01 tedarikçiye iade 5 Adet 150,00 → pay 100 − 150 = −50,00, payda 10 − 5 = 5 → formül birim −10,00, miktar 5 → −50,00.
//   B: birim maliyet 0'a kırpılır, ürün değeri 0; kırpılan −50,00 ayrıntıda + Kesin Değil "Eksi Birim Maliyet". 153 defter hareketi 100 − 150 = −50,00 → T = −50,00 − 0 = −50,00.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { balanceSheet, incomeStatement } from "../server/lib/financial-statements.mjs";
import { MOVE_CLASS, createStockValuation } from "../server/lib/stock-valuation.mjs";

const L = (account, debit, credit, sub = "", party = "") => ({ account, debit, credit, ...(sub ? { sub } : {}), ...(party ? { party } : {}) });
const E = (id, date, ...lines) => ({ id, date, source: "test", text: id, lines });
const gt = (from, to, entries, valuation) => incomeStatement({ entries, valuation, from, to, bookType: "balance" });
const cost = out => out.items.find(row => row.kod === "D").tutarMinor;

describe("S209 = B — alış iadesi alışlardan değerliyse birim maliyet 0'a kırpılır + Kesin Değil (kırpılan tutar görünür)", () => {
  const Q_VAL = () => createStockValuation({
    items: [{ id: "Q", code: "Q", name: "Ürün Q", unit: "Adet", unitPriceE4: 100000, deletedDay: "" }],
    moves: [{ itemId: "Q", date: "2026-01-05", cls: MOVE_CLASS.purchase, qtyMilli: 10000, valueMinor: 10000 }, { itemId: "Q", date: "2026-01-10", cls: MOVE_CLASS.purchaseReturn, qtyMilli: -5000, valueMinor: 15000 }],
  });
  const Q_ENTRIES = [E("invoice:q1", "2026-01-05", L("153", 10000, 0), L("320", 0, 10000, "", "S")), E("stock:q2", "2026-01-10", L("320", 15000, 0, "", "S"), L("153", 0, 15000))];
  it("değerleme: ürün değeri 0 (−50,00 değil), kırpılan −50,00 ürün ayrıntısında ve toplu listede", () => {
    const at = Q_VAL().at("2026-01-31", { detail: true });
    assert.equal(at.totals.dssMinor, 0);
    assert.deepEqual(at.clipped.map(row => [row.name, row.clippedMinor]), [["Ürün Q", -5000]]);
    assert.deepEqual(at.products.map(row => [row.name, row.qty, row.unitCost, row.valueMinor, row.kirpilanMinor]), [["Ürün Q", 5, 0, 0, -5000]]);
    assert.ok(!at.warnings.some(row => row.type === "eksi-birim-maliyet"), "uyarı değil Kesin Değil nedeni");
  });
  it("Gelir Tablosu: satışların maliyeti T = −50,00 − 0 = −50,00; Kesin Değil 'Eksi Birim Maliyet' + ayrıntı", () => {
    const out = gt("2026-01-01", "2026-01-31", Q_ENTRIES, Q_VAL());
    assert.equal(cost(out), -5000);
    const reason = out.kesinDegil.find(row => row.kod === "eksi-birim-maliyet");
    assert.ok(reason, JSON.stringify(out.kesinDegil));
    assert.deepEqual(reason.ayrinti, ["Ürün Q: −50,00 TL"]);
  });
  it("Bilanço aynı değerlemeyi okur: 153 = 0, aynı neden; Aktif = Pasif", () => {
    const out = balanceSheet({ entries: Q_ENTRIES, valuation: Q_VAL(), date: "2026-01-31", bookType: "balance", closedOn: "" });
    const stocks = out.aktif.gruplar[0].kalemler.find(row => row.kod === "I.E");
    assert.deepEqual(stocks.hesaplar.map(row => [row.hesap, row.tutarMinor]), [["159", 5000]], "153 = 0 (kırpıldı); tedarikçi S iadeyle 50,00 borçlu → 159 (elle: −100 + 150)");
    assert.deepEqual(out.kesinDegil.find(row => row.kod === "eksi-birim-maliyet").ayrinti, ["Ürün Q: −50,00 TL"]);
    assert.equal(out.toplamlar.farkMinor, 0);
  });
});
