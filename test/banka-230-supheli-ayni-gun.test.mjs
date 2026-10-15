// 2.3.0 — Kâhin sürüm 4 tohum 4 bulgusu (15.10.2026): aynı gün açılan iki şüpheli kayıtta tahsilat EN ESKİ (önce açılan) kayıttan düşmeli
// (KABUL K3 "en eski kayıt önce"; plan §3.11b/2). Program aynı tarihte kayıt kimliğine (rastgele UUID) göre sıralıyordu → sıra rastgele.
// Sekiz çift ile denenir: eski kodda her çift yazı tura (2⁻⁸ ≈ %0,4 yeşil kalma olasılığı), yeni kodda hepsi ilk açılan kayıttan düşer.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { must } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";
import { collect, customer, debt, listOf, take } from "./banka-230-supheli-ortak.mjs";

describe("Şüpheli Alacaklar — aynı gün açılan kayıtlarda tahsilat önce açılandan düşer", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());

  for (let pair = 1; pair <= 8; pair += 1) {
    it(`çift ${pair}: aynı gün 3.000 + 2.000 şüpheli → 1.500 tahsilat ilk kayıttan düşer`, async () => {
      const acc = await customer(ctx.api, `Aynı Gün ${pair}`);
      await debt(ctx.api, acc.id, 10000, "2026-10-01");
      const first = (await must("ilk kayıt", take(ctx.api, acc.id, { amount: 3000, date: "2026-10-05", reason: "lawsuit", note: "ilk" }))).record;
      const second = (await must("ikinci kayıt", take(ctx.api, acc.id, { amount: 2000, date: "2026-10-05", reason: "lawsuit", note: "ikinci" }))).record;
      await collect(ctx.api, acc.id, 1500, "2026-10-06");
      const rows = (await listOf(ctx.api, acc.id)).records;
      const of = id => rows.find(row => row.id === id);
      assert.equal(of(first.id).collectedMinor, 150000, `ilk açılan kayıt (${first.note}) tahsil edilen — gelen ${JSON.stringify(rows.map(r => [r.note, r.collectedMinor, r.remainingMinor]))}`);
      assert.equal(of(first.id).remainingMinor, 150000, "ilk kayıt kalan");
      assert.equal(of(second.id).collectedMinor, 0, "ikinci kayıt dokunulmaz");
      assert.equal(of(second.id).remainingMinor, 200000, "ikinci kayıt kalan");
    });
  }
});
