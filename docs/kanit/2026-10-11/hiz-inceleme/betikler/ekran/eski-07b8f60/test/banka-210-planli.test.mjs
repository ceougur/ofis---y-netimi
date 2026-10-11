// 2.1.0 — Aşama 4, dilim 3: Planlı İşlemler (docs/BANKA-MODULU-PLAN.md §3.7 #23, K3 "GET yazmaz, ileri tarihli satır yazılmaz", Ek A #35).
//
// Karar (en yaygın ve modern; kullanıcıya sorulmadı): planlı banka işlemi (kira, kredi taksiti, kart borcu, masraf talimatı) DEFTERE GİRMEZ;
// bank_plans'ta bekler. Günü gelince "Vadesi Gelen" kuyruğuna düşer (menü rozetinde sayılır); kullanıcı "Gerçekleştir" ile planlı tarihle
// (ya da bugünle) fişi yazar. Kendiliğinden deftere yazma yok: bankanın talimatı gerçekten işleyip işlemediği ekstreyle doğrulanır.
//
// ÇALIŞIYOR MU:
//   - 15.10.2026 tarihli plan (kira 5.000, Diğer Gider) → 200; fin_events / bank_lines sayısı değişmez; Hareketler'in Planlı görünümünde.
//   - Saat 15.10'a ilerler → plan "Vadesi Gelen" (due), rozet +1; Gerçekleştir → 15.10 tarihli fiş (Ziraat −5.000), plan Gerçekleşti, fişe bağlı.
//   - Aylık tekrarlı plan (kredi taksiti) Gerçekleştir → fiş; planın tarihi bir ay ileri, durum Planlı; çalışma geçmişinde fiş.
//   - Atla (tekrarlı) → tarih ilerler, fiş yok; Sil → İptal Edildi.
// NASIL BOZARIM:
//   - GET (liste, rozet, hareketler) hiçbir şey yazmaz (sayımlar ve settings aynı).
//   - Vadesi gelmemiş planı tarih vermeden Gerçekleştir → 400 date-future (ileri tarihli satır yazılmaz); bugünle → 200.
//   - Aynı istek kimliğiyle iki Gerçekleştir → tek fiş; Gerçekleşmiş planı yeniden → 409 bank-plan-done; iptal edilmiş → 409.
//   - Tutar 0 / eksi / 1e13 → 400; tanınmayan tür / tekrar → 400; pasif hesap → 400; personel → 403.
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { BANK, accountView, apiOf, assert, bootBank, counts, expectStatus, integrityOk, must, openBankSet } from "./banka-210-fis-ortak.mjs";

describe("Aşama 4 — Planlı İşlemler", () => {
  let ctx;
  let set;
  before(async () => {
    ctx = await bootBank({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
    set = await openBankSet(ctx.api);
  });
  after(() => ctx.server.close());
  const settingsCount = () => ctx.store.get("SELECT COUNT(*) AS n, COALESCE(MAX(updated_at), '') AS at FROM settings").n;

  it("ileri tarihli plan deftere girmez; GET yazmaz; günü gelince Vadesi Gelen; Gerçekleştir planlı tarihle fiş yazar", async () => {
    const before = counts(ctx.store);
    const plan = await must("plan", ctx.api.post(`${BANK}/plans`, { kind: "other_out", accountId: set.ziraat.id, amount: "5.000", plannedDate: "2026-10-15", description: "Ekim kirası" }));
    assert.equal(plan.status, "planned");
    assert.equal(plan.statusLabel, "Planlı");
    assert.equal(plan.due, false);
    assert.deepEqual(counts(ctx.store), before, "plan deftere girmez");
    const settings = settingsCount();
    const list = await must("liste", ctx.api.get(`${BANK}/plans`));
    await must("rozet", ctx.api.get(`${BANK}/badge?count=1`));
    const planned = await must("planlı görünüm", ctx.api.get(`${BANK}/movements?planned=1`));
    assert.deepEqual(counts(ctx.store), before, "GET yazmaz");
    assert.equal(settingsCount(), settings, "GET ayar da yazmaz");
    assert.equal(list.plans.length, 1);
    assert.equal(planned.rows[0].planId, plan.id);
    assert.equal(planned.rows[0].signedMinor, -500_000);
    expectStatus(await ctx.api.post(`${BANK}/plans/${plan.id}/execute`, {}), 400, "date-future", "vadesi gelmemiş");
    assert.deepEqual(counts(ctx.store), before);
    const badge0 = (await must("rozet", ctx.api.get(`${BANK}/badge?count=1`))).count;
    ctx.server.clock.set("2026-10-15T09:00:00+03:00");
    const due = await must("vadesi gelen", ctx.api.get(`${BANK}/plans?due=1`));
    assert.deepEqual(due.plans.map(item => item.id), [plan.id]);
    assert.equal(due.plans[0].due, true);
    assert.equal((await must("rozet", ctx.api.get(`${BANK}/badge?count=1`))).count, badge0 + 1, "rozet +1");
    const requestId = `req-${randomUUID()}`;
    const done = await must("gerçekleştir", ctx.api.post(`${BANK}/plans/${plan.id}/execute`, { requestId }));
    assert.equal(done.plan.status, "done");
    assert.equal(done.plan.statusLabel, "Gerçekleşti");
    assert.equal(done.event.date, "2026-10-15", "planlı tarihle");
    assert.equal(done.event.type, "other_out");
    assert.equal(done.plan.doneEventNo, done.event.no);
    const again = await must("yineleme", ctx.api.post(`${BANK}/plans/${plan.id}/execute`, { requestId }));
    assert.equal(again.replayed, true);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE type = 'other_out'").n, 1, "tek fiş");
    expectStatus(await ctx.api.post(`${BANK}/plans/${plan.id}/execute`, {}), 409, "bank-plan-done", "gerçekleşmiş plan");
    assert.equal((await accountView(ctx.api, set.ziraat.id)).balanceMinor, 10_000_000 - 500_000);
    await integrityOk(ctx.api, "plan gerçekleşti");
  });

  it("tekrarlı plan: Gerçekleştir → sonraki ay; Atla → tarih ilerler, fiş yok; vadesi gelmemişi bugünle gerçekleştir; Sil → İptal", async () => {
    const plan = await must("aylık", ctx.api.post(`${BANK}/plans`, { kind: "loan_repay", accountId: set.garanti.id, toAccountId: set.loan.id, amount: "1.000", plannedDate: "2026-10-10", repeat: "monthly", description: "Kredi taksiti" }));
    await must("kredi kullan", ctx.api.post(`${BANK}/vouchers`, { type: "loan_draw", accountId: set.garanti.id, loanAccountId: set.loan.id, date: "2026-10-09", amount: "10.000" }));
    const run = await must("gerçekleştir", ctx.api.post(`${BANK}/plans/${plan.id}/execute`, { interestAmount: "50" }));
    assert.equal(run.event.date, "2026-10-10");
    assert.equal(run.plan.status, "planned");
    assert.equal(run.plan.plannedDate, "2026-11-10", "bir ay ileri");
    assert.equal(run.plan.runs.length, 1);
    assert.equal(run.plan.runs[0].eventNo, run.event.no);
    const before = counts(ctx.store);
    const skipped = await must("atla", ctx.api.post(`${BANK}/plans/${plan.id}/skip`, {}));
    assert.equal(skipped.plannedDate, "2026-12-10");
    assert.deepEqual(counts(ctx.store), before, "atla fiş yazmaz");
    const early = await must("bugünle", ctx.api.post(`${BANK}/plans/${plan.id}/execute`, { date: "2026-10-15" }));
    assert.equal(early.event.date, "2026-10-15");
    assert.equal(early.plan.plannedDate, "2027-01-10");
    const removed = await must("sil", ctx.api.del(`${BANK}/plans/${plan.id}`));
    assert.equal(removed.status, "cancelled");
    expectStatus(await ctx.api.post(`${BANK}/plans/${plan.id}/execute`, { date: "2026-10-15" }), 409, "bank-plan-cancelled", "iptal edilmiş plan");
    await integrityOk(ctx.api, "tekrarlı plan");
  });

  it("nasıl bozarım: tutar, tür, tekrar, hesap, personel", async () => {
    const base = { kind: "fee", accountId: set.ziraat.id, amount: "10", plannedDate: "2026-10-20" };
    expectStatus(await ctx.api.post(`${BANK}/plans`, { ...base, amount: "0" }), 400, "amount-range", "sıfır");
    expectStatus(await ctx.api.post(`${BANK}/plans`, { ...base, amount: "-3" }), 400, "amount-range", "eksi");
    expectStatus(await ctx.api.post(`${BANK}/plans`, { ...base, amount: "10000000000000" }), 400, "amount-range", "1e13");
    expectStatus(await ctx.api.post(`${BANK}/plans`, { ...base, kind: "opening" }), 400, "bank-voucher-type", "tür");
    expectStatus(await ctx.api.post(`${BANK}/plans`, { ...base, repeat: "her-gun" }), 400, "bank-plan-repeat", "tekrar");
    expectStatus(await ctx.api.post(`${BANK}/plans`, { ...base, plannedDate: "2026-02-30" }), 400, "date-invalid", "tarih");
    expectStatus(await ctx.api.post(`${BANK}/plans`, { ...base, accountId: set.loan.id }), 400, "bank-account-invalid", "kredi hesabından masraf planı");
    const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel7", role: "personel" }));
    expectStatus(await staff.post(`${BANK}/plans`, base), 403, null, "personel");
    expectStatus(await staff.get(`${BANK}/plans`), 403, null, "personel liste");
  });
});
