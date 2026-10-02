// Fatura 2.0.16 — müşteri bildirimleri (CLAUDE.md "2.0.16 müşteri hataları").
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeInvoice, exclusiveParts } from "../server/lib/invoice-math.mjs";
import { buildUbl } from "../server/lib/einvoice/ubl-tr.mjs";

describe("KDV dahil fiyatta iskonto gösterimi (müşteri, 02.10.2026)", () => {
  test("2.000 TL KDV dahil, %10 iskonto: Ara Toplam 1.666,67 − İskonto 166,67 = Matrah 1.500,00; KDV 300,00", () => {
    const { totals } = computeInvoice([{ qty: 1, unitPrice: 2000, discountRate: 10, vatRate: 20 }], { pricesIncludeVat: true });
    assert.deepEqual([totals.baseNet, totals.discountNet, totals.net, totals.vat, totals.gross], [166667, 16667, 150000, 30000, 180000]);
  });
  test("%20 iskonto: 1.666,67 − 333,34 = 1.333,33; KDV 266,67; toplam 1.600,00", () => {
    const { totals } = computeInvoice([{ qty: 1, unitPrice: 2000, discountRate: 20, vatRate: 20 }], { pricesIncludeVat: true });
    assert.deepEqual([totals.baseNet, totals.discountNet, totals.net, totals.vat, totals.gross], [166667, 33334, 133333, 26667, 160000]);
  });
  test("satırlar her durumda kuruşu kuruşuna toplar (Ara Toplam − İskonto = Matrah); KDV hariçte değişiklik yok", () => {
    for (const include of [true, false]) {
      for (let seed = 1; seed < 200; seed += 1) {
        const lines = [1, 2, 3].map(i => ({ qty: ((seed * i) % 7) + 1, unitPrice: ((seed * 37 * i) % 5000) / 100 + 0.01, discountRate: (seed * i) % 35, vatRate: [0, 1, 10, 20][(seed + i) % 4] }));
        const { totals } = computeInvoice(lines, { pricesIncludeVat: include, discountRate: seed % 9 });
        assert.equal(totals.baseNet - totals.discountNet, totals.net, `seed ${seed}`);
        if (!include) assert.deepEqual([totals.baseNet, totals.discountNet], [totals.base, totals.discount]);
      }
    }
  });
  test("kayıtlı faturadan (TL ondalığı) aynı ayrım; UBL iskontosu da KDV hariç", () => {
    const parts = exclusiveParts({ base: 2000, net: 1500, vatRate: 20 }, true, 100);
    assert.deepEqual(parts, { baseNet: 1666.67, discountNet: 166.67 });
    const xml = buildUbl({ number: "X", issueDate: "2026-10-02", currency: "TRY", pricesIncludeVat: true, kind: "sale", party: {}, seller: {}, payableTotal: 1800, lines: [{ name: "Ürün", qty: 1, unit: "Adet", unitPrice: 2000, discountRate: 10, base: 2000, discount: 200, net: 1500, vatRate: 20, vat: 300, gross: 1800 }] });
    assert.match(xml, /<cbc:Amount currencyID="TRY">166\.67<\/cbc:Amount>/);
    assert.match(xml, /<cbc:PriceAmount currencyID="TRY">1666\.67<\/cbc:PriceAmount>/);
  });
});
