// 2.1.0 — Aşama 4 (Banka Hareketleri), dilim 3: Banka Fişi motoru (docs/BANKA-MODULU-PLAN.md §3.6, §3.7 #12–18, §3.11 beyaz liste, K2).
//
// ÇALIŞIYOR MU (sahte saat 08.10.2026; Ziraat 100.000 / Garanti 50.000 / Kurumsal Kart borç 5.000 / Kredi 0; her fişin yevmiyesi testin
// KENDİ modeline yazılır, programın mizanı ve alt hesap mizanı bu modelle karşılaştırılır):
//   1. Masraf 10,50 BSMV Dahil (EFT)           → 770 10,00 + 770 0,50 (BSMV) / 102.01 10,50; Ziraat 99.989,50.
//   2. Masraf 10,00 BSMV Hariç (Havale)         → 770 10,00 + 0,50 / 102.01 10,50.
//   3. Masraf 7,00 Vergisiz (Hesap İşletim)     → 770 7,00 / 102.01 7,00.
//   4. POS Komisyonu 21,00 BSMV Dahil            → 653 20,00 + 653 1,00 / 102.01 21,00 (hesabı masraf türü belirler).
//   5. Masraf 120 KDV Dahil (EFT, %20)           → TEK İŞLEMDE Hizmet ve Gider Alışı (770 100, 191 20 / 320 120) + peşin havale (320 / 102.01 120):
//                                                  banka −120, cari 0, fatura Ödendi, KDV raporu 191 = 20.
//   6. POS Komisyonu 100 KDV Hariç (Garanti)     → 653 100, 191 20 / 320 120; 320 / 102.02 120.
//   7. Faiz geliri 1.000, stopaj %15 (Garanti)   → 102.02 850, 193 150 / 642 1.000.
//   8. Faiz gideri 200 + BSMV/KKDF 30            → 780 200 + 780 30 / 102.01 230.
//   9. Diğer gelir 500 (649) / diğer gider 75 (659).
//  10. Kart borcu ödemesi 2.000                  → 309.01 2.000 / 102.01 2.000.
//  11. Kredi kullanımı 10.000 / geri ödeme 1.000 + faiz 100 → 102.02 / 300.01; 300.01 1.000 + 780 100 / 102.02 1.100.
//  Kapı her adımda tamam; mizan ve alt hesaplar bağımsız modelle kuruşu kuruşuna aynı; 649'un adı "Diğer Olağan Gelir ve Kârlar".
// NASIL BOZARIM:
//   - Tutar eksi / sıfır / 1e13 / 3 ondalık / "0,005" / boş / metin → 400; stopaj oranı > %100 ya da eksi → 400; stopaj tutarı ≥ brüt → 400.
//   - Tarih ileri → 400 date-future; kilitli → 409 period-locked; hesabın açılışından önce → 409 bank-before-opening.
//   - Hesap: yok / silinmiş → 404; pasif → 400; döviz → 400 bank-currency; kredi hesabından masraf ya da gider (kredi hesabından ödeme) → 400;
//     kart hesabı masraf hesabı olarak → 400; vadeli hesaba masraf → 400; kart ödemesinde kart yerine vadesiz → 400; aynı hesap iki taraf → 400.
//   - Tür: tanınmayan / bu uçtan girilmeyen (opening, reversal, transfer, carry_close) → 400.
//   - Vergi: tanınmayan kip → 400; KDV kipinde cari ya da fatura no yok → 400; tanınmayan masraf türü → 400.
//   - Beyaz liste: diğer gelire 770, diğer gidere 642, herhangi bir rolde 191/120/320/100/102 → 400 bank-gl-forbidden; elle fiş kapalıyken
//     satır listesi → 409 bank-manual-off; elle fişte Kambiyo Kârı rolüne 656, 320'ye satır, dengesiz fiş → 400.
//   - Yetki: personel → 403; bank.move kaldırılmış muhasebe → 403; kredi kullanımı bank.transfer ister; KDV'li masraf invoices.manage ister;
//     salt okunur lisans → 403.
//   - Başka şirketin hesabı (?hofCompany=) → 404. Reddedilen hiçbir istek satır yazmaz.
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import {
  BANK, Ledger, accountView, apiOf, assert, bootBank, counts, eventCard, expectStatus, integrityOk, lineKeys, lockPeriod, must, openAccount, openBankSet, openingModel, supplier, trialBalances, voucher,
} from "./banka-210-fis-ortak.mjs";

describe("Aşama 4 — Banka Fişi: çalışıyor mu (masraf, faiz, diğer, kart, kredi; bağımsız modelle)", () => {
  let ctx;
  let set;
  const model = new Ledger();
  before(async () => {
    ctx = await bootBank();
    set = await openBankSet(ctx.api);
    openingModel(model, set);
  });
  after(() => ctx.server.close());

  it("1–4: masraf BSMV Dahil / Hariç / Yok ve POS komisyonu; hesap masraf türüne göre (770 / 653)", async () => {
    const z = set.ziraat;
    const fee1 = await voucher(ctx.api, { type: "fee", accountId: z.id, date: "2026-10-08", amount: "10,50", feeType: "eft", tax: "bsmv_incl" });
    assert.equal(fee1.type, "fee");
    assert.equal(fee1.typeLabel, "Banka Masrafı");
    assert.match(fee1.no, /^BNK-2026-\d{6}$/);
    assert.deepEqual(lineKeys(fee1), [`bank|102|${z.glSub}|C|1050`, "expense|770||D|1000", "tax|770||D|50"].sort());
    assert.equal(fee1.fee.baseMinor, 1000);
    assert.equal(fee1.fee.taxMinor, 50);
    assert.equal(fee1.fee.totalMinor, 1050);
    assert.equal(fee1.fee.gl, "770");
    assert.equal(fee1.fee.taxKind, "bsmv");
    assert.equal(fee1.direction, "out");
    assert.equal(fee1.tryMinor, 1050);
    model.post([["770", "", "D", 1000], ["770", "", "D", 50], ["102", z.glSub, "C", 1050]]);
    assert.equal((await accountView(ctx.api, z.id)).balanceMinor, 9_998_950, "Ziraat −10,50");

    const fee2 = await voucher(ctx.api, { type: "fee", accountId: z.id, amount: "10", feeType: "havale", tax: "bsmv_excl" });
    assert.deepEqual(lineKeys(fee2), [`bank|102|${z.glSub}|C|1050`, "expense|770||D|1000", "tax|770||D|50"].sort());
    assert.equal(fee2.date, "2026-10-08", "tarih verilmezse bugün");
    model.post([["770", "", "D", 1050], ["102", z.glSub, "C", 1050]]);

    const fee3 = await voucher(ctx.api, { type: "fee", accountId: z.id, amount: "7", feeType: "hesap-isletim", tax: "none" });
    assert.deepEqual(lineKeys(fee3), [`bank|102|${z.glSub}|C|700`, "expense|770||D|700"].sort());
    model.post([["770", "", "D", 700], ["102", z.glSub, "C", 700]]);

    const fee4 = await voucher(ctx.api, { type: "fee", accountId: z.id, amount: "21", feeType: "pos-komisyonu", tax: "bsmv_incl" });
    assert.deepEqual(lineKeys(fee4), [`bank|102|${z.glSub}|C|2100`, "expense|653||D|2000", "tax|653||D|100"].sort());
    assert.equal(fee4.fee.gl, "653");
    model.post([["653", "", "D", 2100], ["102", z.glSub, "C", 2100]]);
    await model.assertMatches(ctx.api, "masraflar");
    await integrityOk(ctx.api, "masraflar");
  });

  it("5–6: KDV'li masraf tek işlemde gider faturası + havale; cari 0; fatura Ödendi; KDV raporu 191 = 20", async () => {
    const z = set.ziraat;
    const bankParty = await supplier(ctx.api, "Ziraat Bankası A.Ş.");
    const before = ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n;
    const fee5 = await voucher(ctx.api, { type: "fee", accountId: z.id, amount: "120", feeType: "eft", tax: "vat_incl", taxRate: "20", partyId: bankParty.id, invoiceNo: "ZB-2026-0001", description: "EFT ücreti faturası" });
    assert.equal(fee5.type, "fee");
    assert.equal(fee5.fee.taxKind, "vat");
    assert.equal(fee5.fee.baseMinor, 10_000);
    assert.equal(fee5.fee.vatMinor, 2_000);
    assert.equal(fee5.fee.totalMinor, 12_000);
    assert.equal(fee5.fee.gl, "770");
    assert.ok(fee5.invoice, "fatura bağlı");
    assert.equal(fee5.invoice.number, "ZB-2026-0001");
    assert.equal(fee5.invoice.status, "issued");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n, before + 1, "tek fatura");
    const invoice = await must("fatura", ctx.api.get(`/api/workspace/invoices/${fee5.invoice.id}`));
    assert.equal(invoice.kind, "purchase");
    assert.equal(invoice.scenario, "expense_purchase");
    assert.equal(Math.round(invoice.tryVat * 100), 2000);
    assert.equal(Math.round(invoice.tryNet * 100), 10_000);
    assert.equal(invoice.payState, "paid", "fatura Ödendi");
    const party = await must("cari", ctx.api.get(`/api/workspace/accounts/${bankParty.id}`));
    assert.equal(Math.round(party.totals.balance * 100), 0, "cari 0");
    assert.equal((await accountView(ctx.api, z.id)).balanceMinor, 9_998_950 - 1050 - 700 - 2100 - 12_000, "Ziraat −120");
    const pay = ctx.store.get("SELECT fin_ref AS ref, method, kind FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'out'", fee5.invoice.id);
    assert.deepEqual({ ...pay }, { ref: z.id, method: "bank", kind: "out" }, "ödeme satırı Ziraat hesabına bağlı");
    model.post([["770", "", "D", 10_000], ["191", "", "D", 2_000], ["320", "", "C", 12_000]]);
    model.post([["320", "", "D", 12_000], ["102", z.glSub, "C", 12_000]]);

    const g = set.garanti;
    const pspParty = await supplier(ctx.api, "Param Ödeme Kuruluşu");
    const fee6 = await voucher(ctx.api, { type: "fee", accountId: g.id, amount: "100", feeType: "pos-komisyonu", tax: "vat_excl", partyId: pspParty.id, invoiceNo: "PRM-77" });
    assert.equal(fee6.fee.gl, "653");
    assert.equal(fee6.fee.totalMinor, 12_000);
    model.post([["653", "", "D", 10_000], ["191", "", "D", 2_000], ["320", "", "C", 12_000]]);
    model.post([["320", "", "D", 12_000], ["102", g.glSub, "C", 12_000]]);

    const kdv = await must("KDV özeti", ctx.api.get("/api/workspace/report-center/kdv-ozeti?preset=all"));
    const input = kdv.summary.find(([label]) => label === "İndirilecek KDV (191)");
    assert.equal(input?.[1], "40,00 TL", "KDV raporu 191 = 20 + 20");
    await model.assertMatches(ctx.api, "KDV'li masraf");
    await integrityOk(ctx.api, "KDV'li masraf");
  });

  it("7–9: faiz geliri (stopaj 193), faiz gideri (780), diğer gelir (649) ve gider (659)", async () => {
    const { ziraat: z, garanti: g } = set;
    const interest = await voucher(ctx.api, { type: "interest_in", accountId: g.id, amount: "1.000", stoppageRate: "15" });
    assert.equal(interest.typeLabel, "Faiz Geliri");
    assert.deepEqual(lineKeys(interest), [`bank|102|${g.glSub}|D|85000`, "income|642||C|100000", "stoppage|193||D|15000"].sort());
    model.post([["102", g.glSub, "D", 85_000], ["193", "", "D", 15_000], ["642", "", "C", 100_000]]);
    const cost = await voucher(ctx.api, { type: "interest_out", accountId: z.id, amount: "200", taxAmount: "30" });
    assert.deepEqual(lineKeys(cost), [`bank|102|${z.glSub}|C|23000`, "expense|780||D|20000", "tax|780||D|3000"].sort());
    model.post([["780", "", "D", 23_000], ["102", z.glSub, "C", 23_000]]);
    const other = await voucher(ctx.api, { type: "other_in", accountId: z.id, amount: "500", description: "Banka promosyonu" });
    assert.deepEqual(lineKeys(other), [`bank|102|${z.glSub}|D|50000`, "income|649||C|50000"].sort());
    model.post([["102", z.glSub, "D", 50_000], ["649", "", "C", 50_000]]);
    const spend = await voucher(ctx.api, { type: "other_out", accountId: z.id, amount: "75", gl: "659" });
    assert.deepEqual(lineKeys(spend), [`bank|102|${z.glSub}|C|7500`, "expense|659||D|7500"].sort());
    model.post([["659", "", "D", 7_500], ["102", z.glSub, "C", 7_500]]);
    const ledger = await must("mizan", ctx.api.get("/api/workspace/ledger"));
    assert.equal(ledger.trial.accounts.find(row => row.code === "649")?.name, "Diğer Olağan Gelir ve Kârlar", "649'un Tekdüzen adı (Aşama 4)");
    assert.equal(ledger.trial.accounts.find(row => row.code === "193")?.balance, 150);
    await model.assertMatches(ctx.api, "faiz ve diğer");
    await integrityOk(ctx.api, "faiz ve diğer");
  });

  it("10–11: kart borcu ödemesi (309) ve kredi kullanımı / geri ödemesi (300); iç hareket", async () => {
    const { ziraat: z, garanti: g, card, loan } = set;
    const pay = await voucher(ctx.api, { type: "card_payment", accountId: z.id, cardAccountId: card.id, amount: "2.000" });
    assert.deepEqual(lineKeys(pay), [`bank|102|${z.glSub}|C|200000`, `card|309|${card.glSub}|D|200000`].sort());
    assert.equal(pay.counterAccount?.id, card.id);
    model.post([["309", card.glSub, "D", 200_000], ["102", z.glSub, "C", 200_000]]);
    assert.equal((await accountView(ctx.api, card.id)).balanceMinor, -300_000, "kart borcu 3.000");
    const draw = await voucher(ctx.api, { type: "loan_draw", accountId: g.id, loanAccountId: loan.id, amount: "10.000" });
    assert.deepEqual(lineKeys(draw), [`bank|102|${g.glSub}|D|1000000`, `loan|300|${loan.glSub}|C|1000000`].sort());
    model.post([["102", g.glSub, "D", 1_000_000], ["300", loan.glSub, "C", 1_000_000]]);
    const repay = await voucher(ctx.api, { type: "loan_repay", accountId: g.id, loanAccountId: loan.id, amount: "1.000", interestAmount: "100" });
    assert.deepEqual(lineKeys(repay), [`bank|102|${g.glSub}|C|110000`, "expense|780||D|10000", `loan|300|${loan.glSub}|D|100000`].sort());
    model.post([["300", loan.glSub, "D", 100_000], ["780", "", "D", 10_000], ["102", g.glSub, "C", 110_000]]);
    await model.assertMatches(ctx.api, "kart ve kredi");
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.debt.cardMinor, 300_000);
    assert.equal(summary.debt.loanMinor, 900_000);
    await integrityOk(ctx.api, "kart ve kredi");
  });

  it("İşlem Kartı: İşlem No ya da kimlikle; satırların adları; bağlar; işlem geçmişi", async () => {
    const list = ctx.store.all("SELECT id, no FROM fin_events WHERE type = 'fee' ORDER BY seq");
    const byNo = await eventCard(ctx.api, list[0].no);
    const byId = await eventCard(ctx.api, list[0].id);
    assert.deepEqual(byNo, byId);
    assert.equal(byNo.account.id, set.ziraat.id);
    assert.equal(byNo.account.label, "Ziraat Bankası · Ana TL Hesabı");
    assert.ok(byNo.lines.every(line => line.glName), "her satırda hesap adı");
    assert.ok(byNo.history.some(item => item.type === "bank.voucher.created"), "işlem geçmişi");
    assert.equal(byNo.actions.reverse.allowed, true);
    expectStatus(await ctx.api.get(`${BANK}/events/BNK-2026-999999`), 404, "bank-event-missing", "olmayan İşlem No");
  });
});

describe("Aşama 4 — Banka Fişi: nasıl bozarım", () => {
  let ctx;
  let set;
  before(async () => {
    ctx = await bootBank({ fxEnabled: true, bankLater: true }); // bankLater: Elle Banka Fişi (bu sürümde gizli ayar) testte açılır
    set = await openBankSet(ctx.api);
  });
  after(() => ctx.server.close());
  const post = body => ctx.api.post(`${BANK}/vouchers`, body);

  it("tutar: eksi, sıfır, 1e13, 3 ondalık, 0,005, boş, metin → 400; stopaj oranı / tutarı sınır dışı → 400; hiçbir satır yazılmaz", async () => {
    const before = counts(ctx.store);
    const base = { type: "fee", accountId: set.ziraat.id, feeType: "eft", tax: "bsmv_incl" };
    expectStatus(await post({ ...base, amount: "-10" }), 400, "amount-range", "eksi");
    expectStatus(await post({ ...base, amount: "0" }), 400, "amount-range", "sıfır");
    expectStatus(await post({ ...base, amount: "10000000000000" }), 400, "amount-range", "1e13");
    expectStatus(await post({ ...base, amount: "1,005" }), 400, "amount-precision", "3 ondalık");
    expectStatus(await post({ ...base, amount: "0,005" }), 400, "amount-precision", "0,005");
    expectStatus(await post({ ...base, amount: "" }), 400, "amount-invalid", "boş");
    expectStatus(await post({ ...base, amount: "on lira" }), 400, "amount-invalid", "metin");
    const interest = { type: "interest_in", accountId: set.garanti.id, amount: "1.000" };
    expectStatus(await post({ ...interest, stoppageRate: "150" }), 400, "ratio-range", "stopaj %150");
    expectStatus(await post({ ...interest, stoppageRate: "-5" }), 400, null, "stopaj eksi");
    expectStatus(await post({ ...interest, stoppageAmount: "1.000" }), 400, "bank-stoppage", "stopaj = brüt");
    expectStatus(await post({ type: "loan_repay", accountId: set.garanti.id, loanAccountId: set.loan.id, amount: "100", interestAmount: "-1" }), 400, "amount-range", "eksi faiz");
    assert.deepEqual(counts(ctx.store), before, "reddedilen istek yazmaz");
  });

  it("tarih: ileri 400, kilitli 409, hesabın açılışından önce 409", async () => {
    const base = { type: "fee", accountId: set.ziraat.id, amount: "5", feeType: "eft", tax: "none" };
    expectStatus(await post({ ...base, date: "2026-10-09" }), 400, "date-future", "ileri tarih");
    expectStatus(await post({ ...base, date: "2026-09-30" }), 409, "bank-before-opening", "açılıştan önce");
    expectStatus(await post({ type: "card_payment", accountId: set.ziraat.id, cardAccountId: set.card.id, amount: "1", date: "2026-09-30" }), 409, "bank-before-opening", "kartın açılışından önce");
    await lockPeriod(ctx.api, "2026-10-03");
    try {
      expectStatus(await post({ ...base, date: "2026-10-02" }), 409, "period-locked", "kilitli");
    } finally {
      await lockPeriod(ctx.api, "");
    }
  });

  it("hesap: yok, pasif, döviz, kredi hesabından ödeme, kart/vadeli hesaba masraf, yanlış karşı hesap, aynı hesap → 404/400", async () => {
    // Açılış fişleri hariç fiş satırları (bu testte açılan pasif ve vadeli hesapların açılışları da satır yazar).
    const voucherLines = () => ctx.store.get("SELECT COUNT(*) AS n FROM bank_lines l JOIN fin_events e ON e.id = l.event_id WHERE e.type <> 'opening'").n;
    const before = voucherLines();
    const fee = { type: "fee", amount: "5", feeType: "eft", tax: "none" };
    expectStatus(await post({ ...fee, accountId: "bacc-yok" }), 404, "bank-account-missing", "olmayan hesap");
    expectStatus(await post({ ...fee }), 400, "bank-account-required", "hesap seçilmedi");
    const passive = await openAccount(ctx.api, { bankName: "Akbank", name: "Pasif", kind: "demand", opening: { date: "2026-10-01", amount: "100" } });
    await must("pasife al", ctx.api.post(`${BANK}/accounts/${passive.id}/status`, { status: "passive" }));
    expectStatus(await post({ ...fee, accountId: passive.id }), 400, "bank-account-invalid", "pasif hesap");
    const usd = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Dolar", kind: "fx", currency: "USD", opening: { date: "2026-10-01", amount: "0" } });
    expectStatus(await post({ ...fee, accountId: usd.id }), 400, "bank-currency", "döviz hesabı");
    expectStatus(await post({ ...fee, accountId: set.loan.id }), 400, "bank-account-invalid", "kredi hesabından masraf");
    expectStatus(await post({ type: "other_out", accountId: set.loan.id, amount: "50" }), 400, "bank-account-invalid", "kredi hesabından ödeme");
    expectStatus(await post({ ...fee, accountId: set.card.id }), 400, "bank-account-invalid", "kart hesabına masraf");
    const time = await openAccount(ctx.api, { bankName: "İş Bankası", name: "Vadeli", kind: "time", opening: { date: "2026-10-01", amount: "1.000" } });
    expectStatus(await post({ ...fee, accountId: time.id }), 400, "bank-account-invalid", "vadeliye masraf");
    await voucher(ctx.api, { type: "interest_in", accountId: time.id, amount: "10", stoppageRate: "0" }, "vadeliye faiz serbest");
    expectStatus(await post({ type: "card_payment", accountId: set.ziraat.id, cardAccountId: set.garanti.id, amount: "1" }), 400, "bank-account-invalid", "kart yerine vadesiz");
    expectStatus(await post({ type: "loan_draw", accountId: set.ziraat.id, loanAccountId: set.card.id, amount: "1" }), 400, "bank-account-invalid", "kredi yerine kart");
    expectStatus(await post({ type: "card_payment", accountId: set.card.id, cardAccountId: set.card.id, amount: "1" }), 400, "bank-account-invalid", "aynı hesap");
    // Yalnız izinli faiz fişi yazıldı: stopaj %0 → 2 satır (B 102 / A 642; stopaj satırı yok).
    assert.equal(voucherLines() - before, 2, "yalnız izinli faiz fişi (2 satır) yazıldı");
  });

  it("tür ve vergi: tanınmayan / bu uçtan girilmeyen tür, tanınmayan vergi kipi ve masraf türü, KDV'de cari ve fatura no zorunlu → 400", async () => {
    const before = counts(ctx.store);
    for (const type of ["opening", "reversal", "transfer", "carry_close", "legacy_assign", "party_in", "yok"]) expectStatus(await post({ type, accountId: set.ziraat.id, amount: "5" }), 400, "bank-voucher-type", `tür ${type}`);
    const fee = { type: "fee", accountId: set.ziraat.id, amount: "5", feeType: "eft" };
    expectStatus(await post({ ...fee, tax: "kdv" }), 400, "bank-tax", "tanınmayan vergi");
    expectStatus(await post({ ...fee, tax: "bsmv_incl", taxRate: "101" }), 400, "ratio-range", "BSMV %101");
    expectStatus(await post({ ...fee, feeType: "kahve" }), 400, "bank-fee-type", "tanınmayan masraf türü");
    expectStatus(await post({ ...fee, tax: "vat_incl", invoiceNo: "X1" }), 400, "bank-fee-party", "KDV'de cari yok");
    const party = await supplier(ctx.api, "Halkbank");
    expectStatus(await post({ ...fee, tax: "vat_incl", partyId: party.id }), 400, "bank-fee-invoice", "KDV'de fatura no yok");
    expectStatus(await post({ ...fee, tax: "vat_incl", partyId: "acct-yok", invoiceNo: "X1" }), 404, null, "olmayan cari");
    assert.deepEqual(counts(ctx.store), before, "reddedilen istek fatura da yazmaz");
  });

  it("beyaz liste: diğer gelire 770, diğer gidere 642, yasak hesaplar → 400; elle fiş kapalıyken 409, açıkken fx_gain'e 656 / 320 / dengesiz → 400", async () => {
    const before = counts(ctx.store);
    const z = set.ziraat.id;
    expectStatus(await post({ type: "other_in", accountId: z, amount: "5", gl: "770" }), 400, "bank-gl-forbidden", "diğer gelire 770");
    expectStatus(await post({ type: "other_out", accountId: z, amount: "5", gl: "642" }), 400, "bank-gl-forbidden", "diğer gidere 642");
    for (const gl of ["191", "120", "320", "100", "102", "336", "127"]) expectStatus(await post({ type: "other_out", accountId: z, amount: "5", gl }), 400, "bank-gl-forbidden", `diğer gidere ${gl}`);
    const manual = { type: "other_out", accountId: z, lines: [{ role: "expense", gl: "659", side: "D", amount: "5" }, { role: "bank", accountId: z, side: "C", amount: "5" }] };
    expectStatus(await post(manual), 409, "bank-manual-off", "elle fiş kapalı");
    await must("elle fişi aç", ctx.api.put(`${BANK}/settings`, { values: { other: { manualVoucher: true } } }));
    try {
      expectStatus(await post({ ...manual, lines: [{ role: "fx_gain", gl: "656", side: "C", amount: "5" }, { role: "bank", accountId: z, side: "D", amount: "5" }] }), 400, "bank-gl-forbidden", "fx_gain'e 656");
      expectStatus(await post({ ...manual, lines: [{ role: "expense", gl: "320", side: "D", amount: "5" }, { role: "bank", accountId: z, side: "C", amount: "5" }] }), 400, "bank-gl-forbidden", "320'ye satır");
      expectStatus(await post({ ...manual, lines: [{ role: "expense", gl: "659", side: "D", amount: "6" }, { role: "bank", accountId: z, side: "C", amount: "5" }] }), 400, "bank-voucher", "dengesiz");
      expectStatus(await post({ ...manual, lines: [{ role: "expense", gl: "659", side: "D", amount: "5" }, { role: "expense", gl: "770", side: "C", amount: "5" }] }), 400, "bank-voucher", "banka satırı yok");
      assert.deepEqual(counts(ctx.store), before, "reddedilen istek yazmaz");
      const ok = await voucher(ctx.api, { ...manual, lines: [{ role: "expense", gl: "659", side: "D", amount: "3" }, { role: "expense", gl: "770", side: "D", amount: "2" }, { role: "bank", accountId: z, side: "C", amount: "5" }] }, "elle fiş");
      assert.equal(ok.lines.length, 3);
      await integrityOk(ctx.api, "elle fiş");
    } finally {
      await must("elle fişi kapat", ctx.api.put(`${BANK}/settings`, { values: { other: { manualVoucher: false } } }));
    }
  });

  it("yetki: personel 403; bank.move kaldırılan 403; kredi bank.transfer, KDV'li masraf invoices.manage ister; avukat masraf girer", async () => {
    const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel4", role: "personel" }));
    const fee = { type: "fee", accountId: set.ziraat.id, amount: "4", feeType: "eft", tax: "none" };
    expectStatus(await staff.post(`${BANK}/vouchers`, fee), 403, null, "personel");
    expectStatus(await staff.get(`${BANK}/movements`), 403, null, "personel hareketler");
    const lawyer = apiOf(await createUser(ctx.server, ctx.api.client, { username: "avukat4", role: "avukat" }));
    await voucher(lawyer, { ...fee, amount: "4,10" }, "avukat masraf");
    const accountant = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe4", role: "muhasebe" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe4");
    const patch = remove => ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove } }).then(res => assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300)));
    await patch(["bank.move"]);
    expectStatus(await accountant.post(`${BANK}/vouchers`, { ...fee, amount: "4,20" }), 403, null, "bank.move yok");
    await patch(["bank.transfer"]);
    expectStatus(await accountant.post(`${BANK}/vouchers`, { type: "loan_draw", accountId: set.garanti.id, loanAccountId: set.loan.id, amount: "1" }), 403, null, "kredi bank.transfer ister");
    await voucher(accountant, { ...fee, amount: "4,30" }, "bank.move geri geldi");
    await patch(["invoices.manage"]);
    const party = await supplier(ctx.api, "Vakıfbank");
    expectStatus(await accountant.post(`${BANK}/vouchers`, { ...fee, amount: "12", tax: "vat_incl", partyId: party.id, invoiceNo: "VB-1" }), 403, null, "KDV'li masraf invoices.manage ister");
  });

  it("başka şirketin hesabı (?hofCompany=) 404; şirketler ayrı", async () => {
    const second = await must("002", ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    const q = `?hofCompany=${encodeURIComponent(second.id || second.company?.id)}`;
    expectStatus(await ctx.api.post(`${BANK}/vouchers${q}`, { type: "fee", accountId: set.ziraat.id, amount: "5", feeType: "eft", tax: "none" }), 404, "bank-account-missing", "002'den 001'in hesabı");
    const event = ctx.store.get("SELECT no FROM fin_events WHERE type = 'fee' LIMIT 1");
    expectStatus(await ctx.api.get(`${BANK}/events/${event.no}${q}`), 404, "bank-event-missing", "002'den 001'in İşlem No'su");
  });
});

describe("Aşama 4 — Banka Fişi: salt okunur lisans", () => {
  it("salt okunur lisans: fiş yazımı 403 LICENSE_READ_ONLY", async () => {
    const server = await startTestServer({ now: "2026-10-08T12:00:00+03:00", adminPassword: ADMIN_PASSWORD, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
    try {
      const api = apiOf(await loginAdmin(server));
      expectStatus(await api.post(`${BANK}/vouchers`, { type: "fee", accountId: "bacc-x", amount: "5", feeType: "eft", tax: "none" }), 403, "LICENSE_READ_ONLY", "salt okunur");
      const list = await must("hareketler", api.get(`${BANK}/movements`));
      assert.deepEqual(list.rows, []);
    } finally {
      await server.close();
    }
  });

  it("boş şirket: hareketler, plan listesi, masraf raporu, fiş meta 200 ve boş", async () => {
    const ctx = await bootBank();
    try {
      const list = await must("hareketler", ctx.api.get(`${BANK}/movements`));
      assert.deepEqual(list.rows, []);
      assert.equal(list.hasMore, false);
      assert.deepEqual((await must("planlar", ctx.api.get(`${BANK}/plans`))).plans, []);
      const report = await must("masraf raporu", ctx.api.get(`${BANK}/reports/fees`));
      assert.deepEqual(report.rows, []);
      assert.equal(report.totals.totalMinor, 0);
      const meta = await must("fiş meta", ctx.api.get(`${BANK}/voucher-meta`));
      assert.ok(meta.types.some(item => item.type === "fee" && item.label === "Banka Masrafı"));
      assert.ok(meta.feeTypes.some(item => item.key === "eft" && item.gl === "770"));
      assert.equal(meta.defaults.tax, "bsmv_incl");
      const trial = await trialBalances(ctx.api);
      assert.deepEqual(trial, {}, "boş şirkette mizan boş");
    } finally {
      await ctx.server.close();
    }
  });
});
