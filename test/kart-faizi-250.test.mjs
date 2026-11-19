// 2.5.0 Ç7a — D-07 Kart faizi / gecikme bedeli (docs/erp/C7A-BANKA-TASARIM.md §2; kural kitabı 3-D D-07 "Kart faizi / gecikme bedeli | işlem tarihi | 780 | 309.NN |
// tutar (+ BS) | kart | GT H"; muhasebe sürücüsü bulgusu P3: kredi kartı hesabına Faiz Gideri / Masraf fişi 400 bank-account-invalid).
//
// ÇALIŞIYOR MU (sahte saat 08.10.2026; banka-210-fis-ortak hesapları: Ziraat 100.000, Garanti 50.000, Şirket Kartı açılış borcu 5.000 (309.k), Kredi 0;
// beklenen testin KENDİ yevmiye modeli — kitabın satırından, programın çıktısından değil):
//   1. Kart ekstresindeki faiz 200 + BSMV 10 → Faiz Gideri fişi KART hesabına: B 780 200 · B 780 10 (BSMV / KKDF) / A 309.k 210; kart borcu 5.000 → 5.210;
//      banka hesapları, Kasa ve cari DEĞİŞMEZ; mizan + alt hesap mizanı modelle aynı; mutabakat temiz.
//   2. Gecikme bedeli 35 (BSMV'siz) → B 780 35 / A 309.k 35 (kitap D-07 aynı satır).
//   3. Ters Kaydet → kart borcu eski hâl; Düzelt (200 → 250) → B 780 250 · 780 10 / A 309.k 260.
// NASIL BOZARIM:
//   - Kart hesabına Masraf (fee), Diğer Gider, Faiz Geliri → 400 bank-account-invalid (kitapta kart için bu satırlar yok; davranış DEĞİŞMEDİ).
//   - Planlı İşlem'de kart hesabına Faiz Gideri → 400 bank-account-invalid (kart faizi planlanmaz; plan Nakit Akış'ta bankadan çıkış sayılırdı); vadesizde
//     planlı faiz gideri serbest (değişmedi).
//   - Kredi / vadeli hesaptan faiz gideri → 400 (değişmedi). Kilitli tarih → 409 period-locked; kartın açılışından önce → 409 bank-before-opening.
//   - Reddedilen hiçbir istek satır yazmaz (ders 3: kod + gövde + veri tabanı sayımı).
import { after, before, describe, it } from "node:test";
import { BANK, Ledger, accountView, assert, bootBank, counts, eventCard, expectStatus, integrityOk, lineKeys, lockPeriod, must, openAccount, openBankSet, openingModel, voucher } from "./banka-210-fis-ortak.mjs";

describe("Ç7a D-07 — kart faizi / gecikme bedeli: Faiz Gideri fişi kredi kartı hesabına (B 780 / A 309.k)", () => {
  let ctx;
  let set;
  const model = new Ledger();
  const post = body => ctx.api.post(`${BANK}/vouchers`, body);
  const cash = () => ctx.store.get("SELECT COUNT(*) AS n FROM cash_entries").n;
  before(async () => {
    ctx = await bootBank();
    set = await openBankSet(ctx.api);
    openingModel(model, set);
  });
  after(() => ctx.server.close());

  it("1–2: faiz + BSMV ve gecikme bedeli kart hesabına; kart borcu artar, banka / Kasa / cari değişmez", async () => {
    const { ziraat: z, garanti: g, card } = set;
    const bankBefore = [(await accountView(ctx.api, z.id)).balanceMinor, (await accountView(ctx.api, g.id)).balanceMinor];
    const entries = counts(ctx.store).entries;
    const kasa = cash();
    assert.equal((await accountView(ctx.api, card.id)).balanceMinor, -500_000, "kart açılış borcu 5.000");
    const interest = await voucher(ctx.api, { type: "interest_out", accountId: card.id, date: "2026-10-08", amount: "200", taxAmount: "10", description: "Ekim ekstresi faizi" });
    assert.equal(interest.typeLabel, "Faiz Gideri");
    assert.deepEqual(lineKeys(interest), [`card|309|${card.glSub}|C|21000`, "expense|780||D|20000", "tax|780||D|1000"].sort(), "D-07: B 780 faiz + BSMV / A 309.k");
    assert.equal(interest.account?.id, card.id, "fişin hesabı kart");
    model.post([["780", "", "D", 21_000], ["309", card.glSub, "C", 21_000]]);
    assert.equal((await accountView(ctx.api, card.id)).balanceMinor, -521_000, "kart borcu 5.210");
    const late = await voucher(ctx.api, { type: "interest_out", accountId: card.id, date: "2026-10-08", amount: "35", description: "Gecikme bedeli" });
    assert.deepEqual(lineKeys(late), [`card|309|${card.glSub}|C|3500`, "expense|780||D|3500"].sort(), "gecikme bedeli BSMV'siz: B 780 / A 309.k");
    model.post([["780", "", "D", 3_500], ["309", card.glSub, "C", 3_500]]);
    assert.equal((await accountView(ctx.api, card.id)).balanceMinor, -524_500, "kart borcu 5.245");
    assert.deepEqual([(await accountView(ctx.api, z.id)).balanceMinor, (await accountView(ctx.api, g.id)).balanceMinor], bankBefore, "banka hesapları değişmez");
    assert.equal(counts(ctx.store).entries, entries, "cari satırı yazılmadı");
    assert.equal(cash(), kasa, "Kasa satırı yazılmadı");
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.debt.cardMinor, 524_500, "Banka özeti: kart borcu 5.245");
    await model.assertMatches(ctx.api, "kart faizi");
    const ledger = await must("mizan", ctx.api.get("/api/workspace/ledger"));
    assert.equal(ledger.trial.accounts.find(row => row.code === "780")?.balance, 245, "780 Finansman Giderleri 245");
    assert.equal(ledger.trial.balanced, true, "mizan dengede");
    await integrityOk(ctx.api, "kart faizi");
  });

  it("3: Ters Kaydet ve Düzelt kart faizinde de çalışır; kart borcu satırlarla yürür", async () => {
    const { card } = set;
    const row = ctx.store.get("SELECT id FROM fin_events WHERE type = 'interest_out' AND bank_ref = ? AND description = 'Gecikme bedeli'", card.id);
    await must("ters", ctx.api.post(`${BANK}/events/${row.id}/reverse`, {}));
    model.post([["309", card.glSub, "D", 3_500], ["780", "", "C", 3_500]]);
    assert.equal((await accountView(ctx.api, card.id)).balanceMinor, -521_000, "ters kayıttan sonra kart borcu 5.210");
    const first = ctx.store.get("SELECT id FROM fin_events WHERE type = 'interest_out' AND bank_ref = ? AND description = 'Ekim ekstresi faizi'", card.id);
    const prior = await eventCard(ctx.api, first.id);
    assert.equal(prior.form?.amount, "200,00", "Düzelt formu: faiz tutarı");
    assert.equal(prior.form?.taxAmount, "10,00", "Düzelt formu: BSMV / KKDF");
    const fixed = await must("düzelt", ctx.api.post(`${BANK}/events/${first.id}/correct`, { amount: "250" }));
    const card2 = await eventCard(ctx.api, fixed.next?.id);
    assert.deepEqual(lineKeys(card2), [`card|309|${card.glSub}|C|26000`, "expense|780||D|25000", "tax|780||D|1000"].sort(), "Düzelt: 250 + 10 / 309.k 260");
    model.post([["309", card.glSub, "D", 21_000], ["780", "", "C", 21_000]]);
    model.post([["780", "", "D", 26_000], ["309", card.glSub, "C", 26_000]]);
    assert.equal((await accountView(ctx.api, card.id)).balanceMinor, -526_000, "Düzelt'ten sonra kart borcu 5.260");
    await model.assertMatches(ctx.api, "ters kayıt ve düzelt");
    await integrityOk(ctx.api, "ters kayıt ve düzelt");
  });

  it("nasıl bozarım: kartta masraf / diğer gider / faiz geliri, planlı kart faizi, kredi ve vadeli hesap, kilit ve açılış öncesi reddedilir; satır yazılmaz", async () => {
    const { ziraat: z, card, loan } = set;
    const plansBefore = ctx.store.get("SELECT COUNT(*) AS n FROM bank_plans").n;
    expectStatus(await post({ type: "fee", accountId: card.id, amount: "5", feeType: "eft", tax: "none" }), 400, "bank-account-invalid", "kart hesabına masraf");
    expectStatus(await post({ type: "other_out", accountId: card.id, amount: "5", gl: "659" }), 400, "bank-account-invalid", "kart hesabından diğer gider");
    expectStatus(await post({ type: "interest_in", accountId: card.id, amount: "5", stoppageRate: "0" }), 400, "bank-account-invalid", "kart hesabına faiz geliri");
    expectStatus(await post({ type: "interest_out", accountId: loan.id, amount: "5" }), 400, "bank-account-invalid", "kredi hesabından faiz gideri");
    const time = await openAccount(ctx.api, { bankName: "İş Bankası", name: "Vadeli", kind: "time", opening: { date: "2026-10-01", amount: "1.000" } });
    const afterTime = counts(ctx.store);
    expectStatus(await post({ type: "interest_out", accountId: time.id, amount: "5" }), 400, "bank-account-invalid", "vadeliden faiz gideri");
    const planned = await ctx.api.post(`${BANK}/plans`, { kind: "interest_out", accountId: card.id, amount: "100", plannedDate: "2026-11-08", repeat: "none" });
    expectStatus(planned, 400, "bank-account-invalid", "kart faizi planlanmaz");
    assert.match(String(planned.error || ""), /kart faizi planlanmaz/, "planlı kart faizinin nedeni yazılı");
    expectStatus(await post({ type: "interest_out", accountId: card.id, date: "2026-09-30", amount: "5" }), 409, "bank-before-opening", "kartın açılışından önce");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM bank_plans").n, plansBefore, "plan yazılmadı");
    const after1 = counts(ctx.store);
    assert.deepEqual({ ...after1 }, { ...afterTime }, "reddedilen istekler satır yazmadı");
    // Vadesizde planlı faiz gideri serbest (değişmedi).
    await must("planlı faiz gideri vadesizde", ctx.api.post(`${BANK}/plans`, { kind: "interest_out", accountId: z.id, amount: "100", plannedDate: "2026-11-08", repeat: "none" }));
    await lockPeriod(ctx.api, "2026-10-05");
    expectStatus(await post({ type: "interest_out", accountId: card.id, date: "2026-10-05", amount: "5" }), 409, "period-locked", "kilitli tarih");
    assert.equal(counts(ctx.store).lines, after1.lines, "kilitli tarihte satır yazılmadı");
    await integrityOk(ctx.api, "nasıl bozarım");
  });
});
