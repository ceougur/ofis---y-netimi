// 2.2.0 — POS hesap çekirdeği (lib/bank/pos-math.mjs) bağımsız BigInt modeline karşı (plan §4.3 komisyon ve vergi kipleri tablosu, §4.2
// taksit bölüşümü, §4.6 kısmi iade dağıtımı). Model planın metninden yazıldı (program kodu kullanılmaz): yarım kuruş sıfırdan uzağa; dahil
// vergide matrah = round(kom / (1 + oran)); bölüşümde artık son kaleme; iade bekleyen kalemlere sondan başa.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTrCalendar } from "../server/lib/calendars/tr.mjs";
import { commissionOf, dayTotals, refundSchedule, saleSchedule, vatSplit } from "../server/lib/bank/pos-math.mjs";
import { rng } from "./mutabakat/motor.mjs";

const half = (num, den) => {
  const n = BigInt(num);
  const d = BigInt(den);
  return n >= 0n ? (2n * n + d) / (2n * d) : -((2n * -n + d) / (2n * d));
};
function model({ gross, ppm, fixed, tax }) {
  const kom = half(BigInt(gross) * BigInt(ppm), 1_000_000n) + BigInt(fixed);
  if (tax === "none") return { kom, ded: kom };
  const rate = tax.startsWith("bsmv") ? 50_000n : 200_000n;
  if (tax.endsWith("excl")) return { kom, ded: kom + half(kom * rate, 1_000_000n) };
  return { kom, ded: kom, inner: kom - half(kom * 1_000_000n, 1_000_000n + rate) };
}
const MODES = { bsmv_incl: ["bsmv", "included", 50_000], bsmv_excl: ["bsmv", "excluded", 50_000], vat_incl: ["vat", "included", 200_000], vat_excl: ["vat", "excluded", 200_000], none: ["none", "included", 0] };

describe("POS komisyonu (plan §4.3) — bağımsız BigInt modeli", () => {
  it("plan tablosu: 10.000 @ %2,5 → BSMV Dahil 250 (BSMV 11,90) / 9.750; BSMV Hariç 262,50; KDV Hariç 300 / 9.700; KDV Dahil 250 (matrah 208,33, KDV 41,67); Yok 250", () => {
    const at = (tax, value) => {
      const [taxKind, taxMode, taxPpm] = MODES[tax];
      return commissionOf({ gross: 1_000_000, ratePpm: 25_000, fixedMinor: 0, taxKind, taxMode, taxPpm })[value];
    };
    assert.deepEqual([at("bsmv_incl", "deduction"), at("bsmv_incl", "tax"), at("bsmv_incl", "net")], [25_000, 1_190, 975_000]);
    assert.deepEqual([at("bsmv_excl", "deduction"), at("bsmv_excl", "net")], [26_250, 973_750]);
    assert.deepEqual([at("vat_excl", "deduction"), at("vat_excl", "net")], [30_000, 970_000]);
    assert.deepEqual([at("vat_incl", "deduction"), at("vat_incl", "tax"), at("vat_incl", "commission") - at("vat_incl", "tax")], [25_000, 4_167, 20_833]);
    assert.deepEqual([at("none", "deduction"), at("none", "net")], [25_000, 975_000]);
  });
  it("20.000 rastgele (tutar, oran, sabit ücret, kip): kesinti ve dahil vergi modelle aynı", () => {
    const R = rng(220);
    for (let i = 0; i < 20_000; i += 1) {
      const gross = R.int(1, 50_000_000);
      const ppm = R.int(0, 60_000);
      const fixed = R.chance(0.3) ? R.int(0, 5_000) : 0;
      const tax = R.pick(Object.keys(MODES));
      const [taxKind, taxMode, taxPpm] = MODES[tax];
      const got = commissionOf({ gross, ratePpm: ppm, fixedMinor: fixed, taxKind, taxMode, taxPpm });
      const want = model({ gross, ppm, fixed, tax });
      assert.equal(BigInt(got.commission), want.kom, `kom ${gross} ${ppm} ${fixed} ${tax}`);
      assert.equal(BigInt(got.deduction), want.ded, `kesinti ${gross} ${ppm} ${fixed} ${tax}`);
      if (want.inner !== undefined) assert.equal(BigInt(got.tax), want.inner, `dahil vergi ${gross} ${tax}`);
      assert.equal(got.net, gross - got.deduction);
    }
  });
});

describe("Valör takvimi ve bölüşüm (plan §4.2, §4.5)", () => {
  const cal = createTrCalendar();
  const base = { ratePpm: 35_000, fixedMinor: 0, taxKind: "bsmv", taxMode: "included", taxPpm: 50_000, valorRule: "business", valorDays: 2, calendar: cal };
  it("12.000 / 3 taksit / her ay (08.10.2026) → 09.11, 08.12, 08.01.2027; 4.000 brüt, 140 kom, 3.860 net; tek seferde → tek kalem (oran satırındaki gün)", () => {
    const monthly = saleSchedule({ ...base, date: "2026-10-08", gross: 1_200_000, installments: 3, payout: "monthly" });
    assert.deepEqual(monthly.items.map(item => [item.valueDate, item.gross, item.commission, item.net]), [["2026-11-09", 400_000, 14_000, 386_000], ["2026-12-08", 400_000, 14_000, 386_000], ["2027-01-08", 400_000, 14_000, 386_000]]);
    const single = saleSchedule({ ...base, date: "2026-10-08", gross: 1_200_000, installments: 3, payout: "single", rateValorDays: 30 });
    assert.deepEqual(single.items.map(item => [item.valueDate, item.gross]), [["2026-11-20", 1_200_000]], "08.10 + 30 iş günü");
  });
  it("blokeli 30 takvim günü: 08.10 → 07.11 Cumartesi → 09.11 (blocked)", () => {
    const blocked = saleSchedule({ ...base, ratePpm: 25_000, date: "2026-10-08", gross: 1_000_000, installments: 1, payout: "monthly", blockDays: 30 });
    assert.deepEqual(blocked.items.map(item => [item.valueDate, item.blocked]), [["2026-11-09", 1]]);
  });
  it("rastgele brüt ve taksit: brüt eşit (artık son), komisyon brüt ağırlıklı (aşağı, artık son); toplamlar korunur", () => {
    const R = rng(221);
    for (let i = 0; i < 2_000; i += 1) {
      const gross = R.int(3, 10_000_000);
      const n = R.int(1, 12);
      const out = saleSchedule({ ...base, ratePpm: R.int(0, 60_000), date: "2026-10-08", gross, installments: n, payout: "monthly" });
      const kom = BigInt(out.totals.commission);
      const g = BigInt(gross);
      const parts = Array.from({ length: n }, (_, k) => (k === n - 1 ? g - (g / BigInt(n)) * BigInt(n - 1) : g / BigInt(n)));
      const shares = parts.map(p => (kom * p) / g);
      shares[n - 1] += kom - shares.reduce((a, b) => a + b, 0n);
      assert.deepEqual(out.items.map(item => [BigInt(item.gross), BigInt(item.commission)]), parts.map((p, k) => [p, shares[k]]), `${gross} / ${n}`);
    }
  });
});

describe("Kısmi iade dağıtımı ve gün fişi tutarları (plan §4.6, §4.4)", () => {
  it("sondan başa: kapasite [4.000, 4.000] (2. ve 3. kalem), iade 5.000 → 3. kaleme 4.000, 2. kaleme 1.000; Oransal kom. iadesi round(420 × 5.000 / 12.000) = 175 → 140 + 35", () => {
    const plan = refundSchedule({
      amount: 500_000, refundValueDate: "2026-11-15", policy: "proportional",
      pending: [{ seq: 2, valueDate: "2026-12-14", capacity: 400_000 }, { seq: 3, valueDate: "2027-01-12", capacity: 400_000 }],
      sale: { gross: 1_200_000, commission: 42_000, tax: 0, fixedMinor: 0, taxMode: "included" },
    });
    assert.deepEqual(plan.items.map(item => [item.seq, item.valueDate, item.gross, item.commission]), [[3, "2027-01-12", 400_000, 14_000], [2, "2026-12-14", 100_000, 3_500]]);
    assert.equal(plan.commission, 17_500);
  });
  it("bekleyen kalem yetmezse artanı iade valörüne; İade Edilmez → komisyon iadesi 0; Tam → sabit ücret dahil", () => {
    const none = refundSchedule({ amount: 300_000, refundValueDate: "2026-10-15", policy: "none", pending: [], sale: { gross: 1_000_000, commission: 25_000, tax: 1_190, fixedMinor: 0, taxMode: "included" } });
    assert.deepEqual(none.items.map(item => [item.seq, item.valueDate, item.gross, item.deduction, item.plannedNet]), [[0, "2026-10-15", 300_000, 0, -300_000]]);
    const full = refundSchedule({ amount: 500_000, refundValueDate: "2026-10-15", policy: "full", pending: [], sale: { gross: 1_000_000, commission: 26_500, tax: 0, fixedMinor: 1_500, taxMode: "included" } });
    assert.equal(full.commission, 13_250, "Tam: (25.000 + 1.500) × 5.000 / 10.000");
    const proportional = refundSchedule({ amount: 500_000, refundValueDate: "2026-10-15", policy: "proportional", pending: [], sale: { gross: 1_000_000, commission: 26_500, tax: 0, fixedMinor: 1_500, taxMode: "included" } });
    assert.equal(proportional.commission, 12_500, "Oransal: sabit ücret iade edilmez");
  });
  it("gün fişi: 10.000 satış + 10.000 iade (İade Edilmez) → banka −250; 10 TL + 15 TL ücret → −5; KDV kipinde 108'de kalmayan kesinti bankadan", () => {
    assert.equal(dayTotals([{ role: "sale", gross: 1_000_000, deduction: 25_000, taxKind: "bsmv" }, { role: "refund", gross: 1_000_000, deduction: 0, taxKind: "bsmv" }]).bank, -25_000);
    assert.equal(dayTotals([{ role: "sale", gross: 1_000, deduction: 1_500, taxKind: "none" }]).bank, -500);
    const vat = dayTotals([{ role: "sale", gross: 1_000, deduction: 1_500, taxKind: "vat", provider: "p" }]);
    const split = vatSplit(vat);
    assert.deepEqual([vat.bank, split.l108, split.rows[0].fromPos, split.rows[0].fromBank], [-500, 0, 1_000, 500]);
  });
});
