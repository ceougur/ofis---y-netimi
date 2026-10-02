// Fatura hesabı çapraz denetimi (v2.0.15): programın invoice-math.mjs'i ile mutabakat motorunun BAĞIMSIZ modeli
// (test/mutabakat/fatura-model.mjs; yalnız tamsayı/BigInt) rastgele binlerce faturada kuruşu kuruşuna aynı olmalı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WITHHOLDING, computeInvoice, toTry } from "../server/lib/invoice-math.mjs";
import { modelInvoice } from "./mutabakat/fatura-model.mjs";
import { rng } from "./mutabakat/motor.mjs";

describe("fatura hesabı: program = bağımsız model", () => {
  it("30.000 rastgele fatura (KDV dahil/hariç, satır ve genel iskonto, tevkifat, stopaj, döviz)", () => {
    const R = rng(2015);
    let compared = 0;
    for (let n = 0; n < 30_000; n++) {
      const lines = Array.from({ length: R.int(1, 4) }, () => {
        const vat = R.pick([0, 1, 10, 20]);
        const code = vat && R.chance(0.3) ? R.pick(["612", "624", "616", "603"]) : "";
        return { qty: R.int(1, 90_000), price4: R.int(0, 90_000_000), disc: R.pick([0, 0, 3, 5, 12, 100]), vat, whCode: code, wh: code ? [WITHHOLDING[code].num, WITHHOLDING[code].den] : null, account: R.pick(["600", "153", "770"]) };
      });
      const o = { incl: R.chance(0.4), disc: R.chance(0.3) ? R.int(1, 30) : 0, stop: R.chance(0.2) ? R.pick([10, 20]) : 0, rate6: R.chance(0.3) ? R.int(100_000, 50_000_000) : 1_000_000 };
      let program;
      try {
        program = computeInvoice(lines.map(l => ({ qty: l.qty / 1000, unitPrice: l.price4 / 10000, discountRate: l.disc, vatRate: l.vat, withholdingCode: l.whCode, account: l.account })), { pricesIncludeVat: o.incl, discountRate: o.disc, stoppageRate: o.stop });
      } catch {
        continue; // ödenecek sıfır (ör. %100 iskonto): program reddeder
      }
      const model = modelInvoice(lines, o);
      const money = toTry(program.totals, o.rate6 / 1e6);
      assert.deepEqual([program.totals.net, program.totals.vat, program.totals.withheld, program.totals.stoppage, program.totals.payable, money.payable], [model.net, model.vat, model.withheld, model.stoppage, model.payable, model.tryPayable], JSON.stringify({ lines, o }));
      compared += 1;
    }
    assert.ok(compared > 25_000);
  });
});
