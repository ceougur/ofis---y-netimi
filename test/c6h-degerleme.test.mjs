// 2.5.0 Ç6-HESAP tur 1 — dönem sonu stok değerlemesi (docs/erp/C6-HESAP-TASARIM.md §3; kural kitabı §5.1 / §5.2, EK-1 M5 / M6, KG-9 A, KG-10 A, KG-12 A, G-1).
// BEKLENENLER ELLE HESAPLANDI (kitabın formülüyle, aşağıda satır satır yazılı) — programın çıktısından türetilmedi (ders 5):
//   birim maliyet = (DBS değeri + açılış + Σ alış − Σ alış iadesi) ÷ (max(0, DBS miktarı) + açılış miktarı + Σ alış miktarı − Σ alış iadesi miktarı)  [1 Ocak, t]
//   DSS = Σ ürün max(0, t miktarı) × birim maliyet (ürün başına kuruşa yarım yukarı); payda ≤ 0 → kartın alış fiyatı (yoksa 0 + uyarı); eksi miktar → 0 + eksi stok listesi.
// Girdi el ile kurulur (loadValuationInput'un biçimi); hareket sınıfı ayrıca classifyMove ile denenir.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOVE_CLASS, classifyMove, createStockValuation } from "../server/lib/stock-valuation.mjs";

const item = (id, { price = 0, deletedDay = "" } = {}) => ({ id, code: id, name: `Ürün ${id}`, unit: "Adet", unitPriceE4: Math.round(price * 10000), deletedDay });
const mv = (itemId, date, cls, qty, tl = 0) => ({ itemId, date, cls, qtyMilli: Math.round(qty * 1000), valueMinor: Math.round(tl * 100) });
const { opening: AC, purchase: AL, purchaseReturn: IA, quantity: MQ } = MOVE_CLASS;

describe("Ç6-HESAP değerleme — hareket sınıfı (defterin 153 maddeleriyle aynı ayrım)", () => {
  it("açılış / alış / alış iadesi / yalnız miktar", () => {
    assert.equal(classifyMove({ kind: "in", reason: "", pay: "none", invoiced: 0, opening: 1 }), AC);
    assert.equal(classifyMove({ kind: "in", reason: "", pay: "none", invoiced: 1, opening: 0 }), AL, "alış faturası");
    assert.equal(classifyMove({ kind: "in", reason: "", pay: "cash", invoiced: 0, opening: 0 }), AL, "peşin alım");
    assert.equal(classifyMove({ kind: "in", reason: "", pay: "account", invoiced: 0, opening: 0 }), AL, "açık hesap alım");
    assert.equal(classifyMove({ kind: "out", reason: "preturn", pay: "none", invoiced: 1, opening: 0 }), IA, "alıştan iade faturası");
    assert.equal(classifyMove({ kind: "out", reason: "preturn", pay: "account", invoiced: 0, opening: 0 }), IA, "tedarikçiye iade (açık hesap)");
    assert.equal(classifyMove({ kind: "in", reason: "return", pay: "none", invoiced: 1, opening: 0 }), MQ, "müşteri iadesi birim maliyeti değiştirmez (S-04)");
    assert.equal(classifyMove({ kind: "in", reason: "", pay: "none", invoiced: 0, opening: 0 }), MQ, "parasız giriş (S-06)");
    assert.equal(classifyMove({ kind: "out", reason: "", pay: "cash", invoiced: 0, opening: 0 }), MQ, "satış");
    assert.equal(classifyMove({ kind: "out", reason: "preturn", pay: "none", invoiced: 0, opening: 0 }), MQ, "parasız iade");
  });
});

describe("Ç6-HESAP değerleme — dönemsel ağırlıklı ortalama, iki yıl (DBS = önceki yıl DSS, KG-12 A)", () => {
  // Ürün P — 2025: açılış 10 × 50 = 500,00; alış 20 = 1.200,00; satış 25; alış iadesi 5 = 350,00; müşteri iadesi 2.
  //   miktar = 10 + 20 − 25 − 5 + 2 = 2; birim = (500 + 1200 − 350) / (10 + 20 − 5) = 1350 / 25 = 54,00; DSS = 2 × 54 = 108,00;
  //   SMM (stok) = 0 + 500 + 1200 − 350 − 108 = 1.242,00.
  // 2026: alış 10 = 660,00 (10.02); satış 5 (28.02). 31.03: miktar 7; birim = (108 + 660) / (2 + 10) = 64,00; DSS = 448,00; SMM = 108 + 660 − 448 = 320,00.
  //   31.01: miktar 2; birim = 108 / 2 = 54,00; DSS = 108,00.
  const valuation = createStockValuation({
    items: [item("P", { price: 66 })],
    moves: [mv("P", "2025-01-10", AC, 10, 500), mv("P", "2025-03-01", AL, 20, 1200), mv("P", "2025-05-01", MQ, -25), mv("P", "2025-06-01", IA, -5, 350), mv("P", "2025-07-01", MQ, 2),
      mv("P", "2026-02-10", AL, 10, 660), mv("P", "2026-02-28", MQ, -5)],
  });
  it("2025 yıl sonu: DSS 108,00, SMM 1.242,00", () => {
    const end = valuation.yearEnd(2025, { detail: true });
    assert.deepEqual(end.totals, { dbsMinor: 0, openingMinor: 50000, purchaseMinor: 120000, returnMinor: 35000, dssMinor: 10800, smmStockMinor: 124200 });
    assert.equal(end.products[0].unitCost, 54);
    assert.equal(end.products[0].qty, 2);
    assert.equal(end.products[0].basis, "ortalama");
  });
  it("2026: DBS = 2025 DSS; 31.01 DSS 108,00; 31.03 DSS 448,00, SMM 320,00", () => {
    assert.equal(valuation.at("2026-01-31").totals.dssMinor, 10800);
    const q1 = valuation.at("2026-03-31", { detail: true });
    assert.deepEqual(q1.totals, { dbsMinor: 10800, openingMinor: 0, purchaseMinor: 66000, returnMinor: 0, dssMinor: 44800, smmStockMinor: 32000 });
    assert.equal(q1.products[0].unitCost, 64);
    assert.equal(q1.products[0].dbsQty, 2);
  });
  it("yıl sonu ile 31 Aralık 'at' aynı (tek işlev)", () => {
    assert.deepEqual(valuation.at("2025-12-31").totals, valuation.yearEnd(2025).totals);
  });
});

describe("Ç6-HESAP değerleme — G-1 yuvarlama, KG-9, KG-10, M5, 29 Şubat, silinen ürün, eksi birim maliyet", () => {
  it("G-1: ürün başına kuruşa yarım yukarı, toplam = yuvarlanmış satırlar", () => {
    // R: 3 Adet 100,00 → birim 33,3333…; 0,5 Adet kaldı → 16,666… → 16,67. H: 2 Adet 0,03 → birim 1,5 kuruş; 1 Adet → 1,5 → 2 kuruş. Toplam 16,69.
    const valuation = createStockValuation({
      items: [item("R"), item("H")],
      moves: [mv("R", "2026-01-02", AL, 3, 100), mv("R", "2026-01-03", MQ, -2.5), mv("H", "2026-01-02", AL, 2, 0.03), mv("H", "2026-01-03", MQ, -1)],
    });
    const at = valuation.at("2026-01-31", { detail: true });
    assert.deepEqual(at.products.map(row => [row.id, row.valueMinor]), [["R", 1667], ["H", 2]]);
    assert.equal(at.totals.dssMinor, 1669);
  });
  it("KG-9 A: eksi miktar 0 değer + eksi stok listesi; M5: ertesi yıl eksi dönem başı ortalamada 0, miktar devri eksi dahil", () => {
    // N 2025: alış 5 × 10 = 50,00; satış 8 → −3; değer 0. 2026: alış 10 × 12 = 120,00 → birim 120 / (0 + 10) = 12; miktar −3 + 10 = 7 → 84,00.
    const valuation = createStockValuation({ items: [item("N")], moves: [mv("N", "2025-02-01", AL, 5, 50), mv("N", "2025-03-01", MQ, -8), mv("N", "2026-02-01", AL, 10, 120)] });
    const end = valuation.yearEnd(2025);
    assert.equal(end.totals.dssMinor, 0);
    assert.deepEqual(end.negative.map(row => [row.id, row.qty]), [["N", -3]]);
    assert.equal(end.totals.smmStockMinor, 5000, "SMM = 0 + 50 − 0 = 50,00 (eksiye düşen adetlerin maliyeti bu yılda yok — M5 bilinen sonuç)");
    const next = valuation.at("2026-03-31", { detail: true });
    assert.equal(next.products[0].qty, 7);
    assert.equal(next.products[0].unitCost, 12);
    assert.equal(next.totals.dssMinor, 8400);
    assert.deepEqual(next.negative, []);
  });
  it("KG-10 A: alışı ve DBS'si olmayan ürün kartın alış fiyatıyla; fiyat da yoksa 0 + uyarı", () => {
    // K: parasız giriş 4, kart alış fiyatı 25,50 → 102,00 (uyarı kart-fiyati). Z: parasız giriş 3, kart fiyatı 0 → 0 (uyarı fiyat-yok).
    const valuation = createStockValuation({ items: [item("K", { price: 25.5 }), item("Z")], moves: [mv("K", "2026-01-05", MQ, 4), mv("Z", "2026-01-05", MQ, 3)] });
    const at = valuation.at("2026-06-30", { detail: true });
    assert.deepEqual(at.products.map(row => [row.id, row.basis, row.valueMinor]), [["K", "kart", 10200], ["Z", "yok", 0]]);
    assert.deepEqual(at.warnings.map(row => [row.type, row.id]), [["kart-fiyati", "K"], ["fiyat-yok", "Z"]]);
  });
  it("29 Şubat (artık yıl 2028): alış 29.02'de; 28.02'de stok yok, 29.02'de 30,00", () => {
    const valuation = createStockValuation({ items: [item("L")], moves: [mv("L", "2028-02-29", AL, 10, 30)] });
    assert.equal(valuation.at("2028-02-28").totals.dssMinor, 0);
    assert.equal(valuation.at("2028-02-29").totals.dssMinor, 3000);
    assert.equal(valuation.at("2028-02-29").totals.smmStockMinor, 0);
  });
  it("silinmiş ürün kartı silindiği günden itibaren envantere girmez (tasarım §3, S-a A); öncesinde girer", () => {
    // D: alış 2 × 10 = 20,00; kart 01.06.2026'da silindi.
    const valuation = createStockValuation({ items: [item("D", { deletedDay: "2026-06-01" })], moves: [mv("D", "2026-01-05", AL, 2, 20)] });
    assert.equal(valuation.at("2026-05-31").totals.dssMinor, 2000);
    const after = valuation.at("2026-06-30");
    assert.equal(after.totals.dssMinor, 0);
    assert.equal(after.totals.smmStockMinor, 2000);
    assert.deepEqual(after.warnings.map(row => row.type), ["silinmis-urun"]);
  });
  it("alış iadesi alışlardan değerliyse birim maliyet 0'a kırpılır, kırpılan tutar listede (S209 = B; tur 1'in 'eksi değer + uyarı' beklentisi kararla değişti)", () => {
    // E: alış 10 = 1.000,00; iade 9 = 1.080,00 → formül birim (1000 − 1080) / (10 − 9) = −80; miktar 1 → −80,00 → değer 0, kırpılan −80,00.
    const valuation = createStockValuation({ items: [item("E")], moves: [mv("E", "2026-01-02", AL, 10, 1000), mv("E", "2026-01-03", IA, -9, 1080)] });
    const at = valuation.at("2026-01-31");
    assert.equal(at.totals.dssMinor, 0);
    assert.deepEqual(at.clipped.map(row => [row.id, row.clippedMinor]), [["E", -8000]]);
    assert.deepEqual(at.warnings.map(row => row.type), []);
  });
  it("alış iadesi birim maliyeti DÜŞÜRÜR / YÜKSELTİR (iade fiyatı ortalamadan farklıysa)", () => {
    // F: alış 10 × 10 = 100,00 ve 10 × 20 = 200,00; iade 5 × 30 = 150,00 → birim (300 − 150) / (20 − 5) = 10,00; satış 5 → miktar 10 → 100,00.
    const valuation = createStockValuation({ items: [item("F")], moves: [mv("F", "2026-01-02", AL, 10, 100), mv("F", "2026-01-03", AL, 10, 200), mv("F", "2026-01-04", IA, -5, 150), mv("F", "2026-01-05", MQ, -5)] });
    assert.equal(valuation.at("2026-01-31").totals.dssMinor, 10000);
  });
  it("sonradan açılan ürünün açılışı (M-07) kendi yılının dönem başıdır; boş veri 0", () => {
    // S 2025'te yok; 2026-04-01 açılış 5 × 8 = 40,00; 2026-05-01 alış 5 = 60,00 → birim (40 + 60) / 10 = 10; miktar 10 → 100,00.
    const valuation = createStockValuation({ items: [item("S")], moves: [mv("S", "2026-04-01", AC, 5, 40), mv("S", "2026-05-01", AL, 5, 60)] });
    assert.equal(valuation.at("2026-06-30").totals.dssMinor, 10000);
    assert.deepEqual(createStockValuation({}).at("2026-06-30").totals, { dbsMinor: 0, openingMinor: 0, purchaseMinor: 0, returnMinor: 0, dssMinor: 0, smmStockMinor: 0 });
  });
});
