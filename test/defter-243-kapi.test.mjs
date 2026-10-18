// 2.4.3 MM3 / MM4 — Mutabakat Testi'nin (kapı) yeni denetimlerinin DİŞİ: bozulmuş veri ya da bozulmuş yevmiye yakalanır.
//   stock:opening  — yevmiyeden açılış stoku maddesi düşerse (kod hatası benzetimi: Ana Defter servisinin sonucu süzülür) "Açılış Stoku ↔ Ana Defter" kırmızı.
//   bank:voucher   — Vergi Ödemesi rolü (tax_payable, 360) başka türdeki fişe (Diğer Gider) elle yazılırsa kırmızı (plan §3.11 beyaz listesi).
//   balance        — Kasa'daki vergi satırının ayrıntısı (tax_json) tutarla uyuşmazsa madde dengesiz: "Çift yönlü kayıt" kırmızı.
// Bozma ham SQL ile (store dışı; eski sürüm ya da elle düzenleme gibi); tam tarama (GET /ledger/integrity) bulur.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOf, must, rawRun } from "./banka-210-ortak.mjs";
import { BANK, bootBank, openAccount } from "./banka-210-hesap-ortak.mjs";

describe("2.4.3 MM3 / MM4 — kapının yeni denetimleri bozmayı yakalar", () => {
  let ctx;
  let api;
  let ziraat;
  before(async () => {
    ctx = await bootBank({ now: "2026-10-20T12:00:00+03:00", gateVerify: false });
    api = ctx.api;
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", opening: { date: "2026-09-01", amount: "50.000", confirmed: true } });
  });
  after(() => ctx?.server.close());
  const check = async code => (await integrityOf(api)).checks.find(item => item.code === code);

  it("stock:opening: açılış maddesi yevmiyeden düşerse kırmızı; düzelince yeşil", async () => {
    await must("ürün", api.post("/api/workspace/stock", { name: "Masa", unit: "Adet", unitPrice: "1.000", openingQty: "3", openingDate: "2026-09-05" }));
    assert.equal((await check("stock:opening"))?.ok, true);
    const ledger = ctx.app.context.ledger;
    const original = ledger.check;
    ledger.check = (...args) => {
      const result = original(...args);
      return { ...result, entries: result.entries.filter(entry => !entry.id.startsWith("stock-open:")) };
    };
    try {
      const broken = await check("stock:opening");
      assert.equal(broken?.ok, false, JSON.stringify(broken));
      assert.match(broken.sample.join(" "), /defterde yok/);
    } finally {
      ledger.check = original;
    }
    assert.equal((await check("stock:opening"))?.ok, true);
  });

  it("bank:voucher: Diğer Gider fişine 360 (tax_payable) elle yazılırsa kırmızı", async () => {
    const card = await must("Diğer Gider", api.post(`${BANK}/vouchers`, { type: "other_out", accountId: ziraat.id, date: "2026-10-10", amount: "100", gl: "659" }));
    assert.ok(!(await integrityOf(api)).failures.some(item => item.code.startsWith("bank:voucher")));
    rawRun(ctx.db, "UPDATE bank_lines SET role = 'tax_payable', gl = '360' WHERE event_id = ? AND role = 'expense'", card.id);
    const result = await integrityOf(api);
    const voucher = result.failures.find(item => item.code.startsWith("bank:voucher"));
    rawRun(ctx.db, "UPDATE bank_lines SET role = 'expense', gl = '659' WHERE event_id = ? AND role = 'tax_payable'", card.id);
    assert.ok(voucher && voucher.ok === false, JSON.stringify(result.failures).slice(0, 600));
    assert.match(voucher.sample.join(" "), /tax_payable satırı 360 hesabına yazılamaz/);
    assert.ok(!(await integrityOf(api)).failures.some(item => item.code.startsWith("bank:voucher")), "geri alınınca temiz");
  });

  it("balance: Kasa vergi satırının ayrıntısı tutarla uyuşmazsa madde dengesiz (kırmızı)", async () => {
    const paid = await must("Kasa'dan vergi", api.post("/api/workspace/tax/payments", { way: "cash", date: "2026-10-12", taxType: "other", amount: "200", cashForce: true, exceedOk: true }));
    assert.equal((await check("balance"))?.ok, true);
    rawRun(ctx.db, "UPDATE cash_entries SET tax_json = ? WHERE id = ?", JSON.stringify({ type: "other", taxMinor: 15000, lateMinor: 0 }), paid.id);
    assert.equal((await check("balance"))?.ok, false, "200 TL çıkış, 150 TL vergi → borç ≠ alacak");
    rawRun(ctx.db, "UPDATE cash_entries SET tax_json = ? WHERE id = ?", JSON.stringify({ type: "other", taxMinor: 20000, lateMinor: 0 }), paid.id);
    assert.equal((await check("balance"))?.ok, true);
  });
});
