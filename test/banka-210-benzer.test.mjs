// 2.1.0 — Aşama 4, dilim 3: Benzer İşlem Uyarısı (K8) ve istek kimliği (docs/BANKA-MODULU-PLAN.md §3.10, Ek A #9, A.2/4).
//
// ÇALIŞIYOR MU:
//   - Aynı iş günü, aynı hesap, aynı tür, aynı yön, aynı tutar, aynı cari ve hedef → 409 bank-similar (önceki İşlem No, giren, tarih);
//     "Yine de Kaydet" (similarOk) → 200; uyarı yalnız hesaba bağlı satırlarda (Banka Fişi hep bağlı).
//   - Aynı istek kimliği + aynı gövde → tek fiş (ikincisi replayed, aynı İşlem No); similarOk eklenmiş yeniden gönderim aynı istek sayılır.
// NASIL BOZARIM:
//   - Cumartesi girilen masraf ile Pazartesi girilen aynı masraf (aynı iş günü: Pazartesi) → 409; Cuma ↔ Pazartesi → 200 (farklı iş günü).
//   - Farklı tutar / hesap / tür → 200. Ters kaydedilmiş fişle aynı → 200.
//   - Benzer İşlem Uyarısı ayardan kapatılınca → 200.
//   - Aynı istek kimliği farklı gövdeyle → 409 request-id-reused.
//   - Aynı anda iki istek (farklı kimlik, aynı içerik) → biri 200, öbürü 409 bank-similar; tek fiş.
//   - Nakit (Kasa) hareketinde Benzer İşlem denetimi yok (hesaba bağlı değil): aynı gün aynı tutar iki Kasa girişi 200.
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { BANK, assert, bootBank, expectStatus, must, openBankSet, voucher } from "./banka-210-fis-ortak.mjs";

describe("Aşama 4 — Benzer İşlem ve istek kimliği", () => {
  let ctx;
  let set;
  before(async () => {
    ctx = await bootBank();
    set = await openBankSet(ctx.api);
  });
  after(() => ctx.server.close());
  const post = body => ctx.api.post(`${BANK}/vouchers`, body);

  it("aynı gün aynı masraf → 409 bank-similar (önceki İşlem No ile); Yine de Kaydet → 200; farklı tutar/hesap/tür 200", async () => {
    const body = { type: "fee", accountId: set.ziraat.id, date: "2026-10-08", amount: "10,50", feeType: "eft", tax: "bsmv_incl" };
    const first = await voucher(ctx.api, body);
    const res = await post(body);
    expectStatus(res, 409, "bank-similar", "benzer");
    const payload = res.data;
    assert.equal(payload.eventNo, first.no, "önceki İşlem No");
    assert.ok(payload.createdByName, "önceki işlemi giren");
    assert.match(payload.error, new RegExp(first.no));
    const forced = await voucher(ctx.api, { ...body, similarOk: true }, "Yine de Kaydet");
    assert.notEqual(forced.no, first.no);
    await voucher(ctx.api, { ...body, amount: "10,60" }, "farklı tutar");
    await voucher(ctx.api, { ...body, accountId: set.garanti.id }, "farklı hesap");
    await voucher(ctx.api, { type: "other_out", accountId: set.ziraat.id, date: "2026-10-08", amount: "10,50" }, "farklı tür");
  });

  it("aynı iş günü: Cumartesi ↔ Pazartesi benzer (409); Cuma ↔ Pazartesi değil (200); ters kaydedilmiş fiş benzer sayılmaz", async () => {
    const base = { type: "other_out", accountId: set.garanti.id, amount: "33" };
    await voucher(ctx.api, { ...base, date: "2026-10-03" }, "Cumartesi");
    expectStatus(await post({ ...base, date: "2026-10-05" }), 409, "bank-similar", "Pazartesi (aynı iş günü)");
    const friday = await voucher(ctx.api, { ...base, amount: "44", date: "2026-10-02" }, "Cuma");
    await voucher(ctx.api, { ...base, amount: "44", date: "2026-10-05" }, "Pazartesi (farklı iş günü)");
    await must("ters", ctx.api.post(`${BANK}/events/${friday.id}/reverse`, {}));
    await voucher(ctx.api, { ...base, amount: "44", date: "2026-10-02" }, "ters kaydedilenle aynı");
  });

  it("ayar kapalıyken uyarı yok", async () => {
    const body = { type: "interest_out", accountId: set.ziraat.id, amount: "9" };
    await voucher(ctx.api, body);
    expectStatus(await post(body), 409, "bank-similar", "açıkken");
    await must("kapat", ctx.api.put(`${BANK}/settings`, { values: { similar: { enabled: false } } }));
    try {
      await voucher(ctx.api, body, "kapalıyken");
    } finally {
      await must("aç", ctx.api.put(`${BANK}/settings`, { values: { similar: { enabled: true } } }));
    }
  });

  it("istek kimliği: aynı kimlik + gövde tek fiş; similarOk eklenince aynı istek; farklı gövde 409", async () => {
    const requestId = `req-${randomUUID()}`;
    const body = { type: "other_in", accountId: set.ziraat.id, amount: "123", requestId };
    const first = await voucher(ctx.api, body);
    const again = await voucher(ctx.api, body, "yineleme");
    assert.equal(again.replayed, true);
    assert.equal(again.no, first.no);
    const withOk = await voucher(ctx.api, { ...body, similarOk: true }, "similarOk ile yineleme");
    assert.equal(withOk.no, first.no);
    expectStatus(await post({ ...body, amount: "124" }), 409, "request-id-reused", "farklı gövde");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE type = 'other_in' AND try_minor = 12300").n, 1);
  });

  it("aynı anda iki istek (farklı kimlik, aynı içerik): biri 200, öbürü 409 bank-similar; tek fiş", async () => {
    const body = { type: "fee", accountId: set.garanti.id, amount: "77", feeType: "fast", tax: "none" };
    const results = await Promise.all([post({ ...body, requestId: `req-${randomUUID()}` }), post({ ...body, requestId: `req-${randomUUID()}` })]);
    const statuses = results.map(res => res.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal(results.find(res => res.status === 409).code, "bank-similar");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE type = 'fee' AND try_minor = 7700").n, 1);
  });

  it("nakit (Kasa) hareketinde Benzer İşlem denetimi yok", async () => {
    for (let i = 0; i < 2; i += 1) await must(`Kasa girişi ${i + 1}`, ctx.api.post("/api/workspace/cash", { kind: "in", amount: "50", description: "Aynı tutar", date: "2026-10-08" }));
  });
});
