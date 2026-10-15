// 2.3.0 bitiş turu — yargıç bulgusu #1 (15.10.2026): K8 (plan §3.10/3) çek/senet yolunda yoktu. Çekle sayılan taksit tahsilatı
// (routes/cheques.mjs plan-entry etkisi) kartın kalanına bakmadan yazılıyordu: ödenmiş karta 500 TL çek → 200, kartta "fazla", cari −500.
// Kural (routes/plans.mjs assertRoom ile aynı kodlar/metinler): ödenmiş kart 409 plan-paid, kalanı aşan 409 plan-overpay, ödenmiş taksit
// 409 installment-paid; çek yolunda "Fazlasını Avans Yaz" yok. Ters kayıt (karşılıksız; reverse-plan-entry) kurala girmez. Eski kodda
// (1fc87bb) kırmızı: docs/kanit/2026-10-15/yargic-k8-cek-kirmizi.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOf, must } from "./banka-210-ortak.mjs";
import { bootBank, expectStatus } from "./banka-210-hesap-ortak.mjs";
import { balanceOf, customer, trial } from "./banka-230-supheli-ortak.mjs";

const PLANS = "/api/workspace/plans";
const CHEQUES = "/api/workspace/cheques";
const cheque = (api, body) => api.post(CHEQUES, { direction: "in", instrument: "cheque", issueDate: "2026-10-03", dueDate: "2026-12-31", drawer: "Keşideci", bank: "Ziraat", ...body });
const planOf = (api, id) => must("kart", api.get(`${PLANS}/${id}`));

describe("2.3.0 K8 — çekle sayılan taksit tahsilatı kartın kalanına bakar", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());

  it("ödenmiş karta çek → 409 plan-paid; kart, cari ve 101 değişmez; evrak yazılmaz", async () => {
    const acc = await customer(ctx.api, "K8 Çek Ltd.");
    const plan = await must("kart", ctx.api.post(PLANS, { name: "Kart A", accountId: acc.id, total: 1000, count: 2, firstDue: "2026-10-01", registeredOn: "2026-10-01" }));
    await must("nakit 1.000", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: 1000, date: "2026-10-02", method: "cash" }));
    const before = await trial(ctx.api);
    const balance = await balanceOf(ctx.api, acc.id);
    const res = await cheque(ctx.api, { amount: "500", serialNo: "K8-1", accountId: acc.id, planId: plan.id });
    expectStatus(res, 409, "plan-paid", "ödenmiş karta çek");
    assert.match(res.error || "", /Bu kart ödendi/);
    const detail = await planOf(ctx.api, plan.id);
    assert.equal(detail.totals.extra, 0, "kartta fazla yok");
    assert.equal(detail.totals.remaining, 0);
    assert.equal(await balanceOf(ctx.api, acc.id), balance, "cari bakiyesi değişmedi");
    assert.equal((await trial(ctx.api))(101), before(101), "101 değişmedi");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM cheques WHERE serial_no = 'K8-1'").n, 0, "evrak yazılmadı");
    assert.equal((await integrityOf(ctx.api)).ok, true, "Mutabakat Testi tamam");
  });

  it("kalanı aşan çek → 409 plan-overpay (kalan/fazla ek alanda); kalan kadar çek → 200, kart kapanır", async () => {
    const acc = await customer(ctx.api, "K8 Çek2 Ltd.");
    const plan = await must("kart", ctx.api.post(PLANS, { name: "Kart B", accountId: acc.id, total: 1000, count: 2, firstDue: "2026-10-01", registeredOn: "2026-10-01" }));
    const res = await cheque(ctx.api, { amount: "1.500", serialNo: "K8-2", accountId: acc.id, planId: plan.id });
    expectStatus(res, 409, "plan-overpay", "kalanı aşan çek");
    assert.equal(res.data.remaining, 1000);
    assert.equal(res.data.excess, 500);
    assert.equal((await planOf(ctx.api, plan.id)).totals.paid, 0, "kart değişmedi");
    await must("kalan kadar çek", cheque(ctx.api, { amount: "1.000", serialNo: "K8-3", accountId: acc.id, planId: plan.id }));
    const detail = await planOf(ctx.api, plan.id);
    assert.equal(detail.totals.remaining, 0, "kart kapandı");
    assert.equal(detail.totals.extra, 0);
    expectStatus(await cheque(ctx.api, { amount: "0,01", serialNo: "K8-4", accountId: acc.id, planId: plan.id }), 409, "plan-paid", "1 kuruş daha");
    assert.equal((await integrityOf(ctx.api)).ok, true, "Mutabakat Testi tamam");
  });

  it("ödenmiş taksite seçili çek → 409 installment-paid; açık taksite → 200; karşılıksızda ters kayıt kurala girmez (yeniden açılır)", async () => {
    const acc = await customer(ctx.api, "K8 Çek3 Ltd.");
    const plan = await must("kart", ctx.api.post(PLANS, { name: "Kart C", accountId: acc.id, total: 1000, count: 2, firstDue: "2026-10-01", registeredOn: "2026-10-01" }));
    const items = (await planOf(ctx.api, plan.id)).items;
    await must("1. taksit nakit", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: 500, date: "2026-10-02", method: "cash", itemId: items[0].id }));
    expectStatus(await cheque(ctx.api, { amount: "500", serialNo: "K8-5", accountId: acc.id, planId: plan.id, itemId: items[0].id }), 409, "installment-paid", "ödenmiş taksite çek");
    const ok = await must("açık taksite çek", cheque(ctx.api, { amount: "500", serialNo: "K8-6", accountId: acc.id, planId: plan.id, itemId: items[1].id }));
    assert.equal((await planOf(ctx.api, plan.id)).totals.remaining, 0, "kart kapandı");
    await must("karşılıksız", ctx.api.post(`${CHEQUES}/${ok.id}/actions`, { action: "bounce", date: "2026-10-05", status: ok.status }));
    assert.equal((await planOf(ctx.api, plan.id)).totals.remaining, 500, "ters kayıt yazıldı; taksit yeniden açık");
    assert.equal((await integrityOf(ctx.api)).ok, true, "Mutabakat Testi tamam");
  });
});
