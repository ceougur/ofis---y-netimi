// 2.1.0 — Aşama 3–4 bağımsız gözden geçirme (GG2): Banka Fişi kuralları.
//
// Bulgular (doğrulandı):
//   - (orta) Planlı İşlemler'de "Atla"ya çift tıklayınca plan iki dönem ilerliyordu (bir ayın talimatı sessizce kayboluyordu). Kural: Atla ve
//     Gerçekleştir planın beklenen tarihini taşır (expectedDate); plan bu arada ilerlediyse 409 bank-plan-moved.
//   - (orta) Eksi Bakiye Denetimi ekranda "Engelle/Uyar" görünüyor ama Banka Fişi'nde uygulanmıyordu (K7). Kural (plan §3.9): yazımdan sonraki
//     son durumla, hesap bazında; bakiye = min(işlem günündeki, bütün hareketlerle) + KMH limiti; Uyar → 409 cash-negative ("Yine de Kaydet"
//     negativeOk), Engelle → 409 cash-blocked; Bakiye Doğrulandı olmayan hesapta Kontrol Yok. Fiş, Düzelt ve Planlı Gerçekleştir aynı kural.
//   - (orta) Kilitli dönemdeki KDV'li (faturalı) masrafın hiçbir düzeltme yolu yoktu. Kural (yaygın uygulama): Ters Kaydet bugün tarihli Alıştan
//     İade faturası + bu hesaba iade girişi yazar (kapanmış dönem değişmez); fatura penceresi kapalı yolu göstermez.
//   - (düşük) Kredi Geri Ödemesi'nde anapara kalan kredi borcunu aşabiliyordu (300 borç bakiyesi). Kural: 409 bank-loan-exceeds.
//   - (düşük) Hesap Eşlemeleri değişince aynı masraf türü BSMV kipinde yeni hesaba, KDV kipinde 770'e gidiyordu. Kural: Banka Masrafları ve
//     Komisyon eşlemesi faturalı masrafın da yazılabildiği hesaplardan (770, 653); iki kip aynı hesaba.
//   - (düşük) Modülden gelen harekette Açıklamayı Düzelt yalnız banka tarafını değiştiriyordu (iki ekranda iki açıklama). Kural: modül hareketinde
//     kapalı, nedeni ekranda (açıklama kendi penceresinden).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk } from "./banka-210-ortak.mjs";
import { BANK, bootBank, expectStatus, lockPeriod, must, openAccount, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";

const events = store => store.get("SELECT COUNT(*) AS n FROM fin_events").n;
const voucher = (api, body) => api.post(`${BANK}/vouchers`, body);

describe("GG2 — Planlı İşlemler: Atla ve Gerçekleştir beklenen tarihle (çift tık bir dönem atlar)", () => {
  let ctx;
  let plan;
  before(async () => {
    ctx = await bootBank();
    const account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    plan = await must("plan", ctx.api.post(`${BANK}/plans`, { type: "fee", accountId: account.id, amount: "25", feeType: "eft", tax: "none", plannedDate: "2026-10-08", repeat: "monthly" }));
  });
  after(() => ctx.server.close());

  it("aynı anda iki Atla (aynı beklenen tarih): biri 200, öbürü 409 bank-plan-moved; plan yalnız bir dönem ilerler", async () => {
    const [a, b] = await Promise.all([
      ctx.api.post(`${BANK}/plans/${plan.id}/skip`, { expectedDate: "2026-10-08" }),
      ctx.api.post(`${BANK}/plans/${plan.id}/skip`, { expectedDate: "2026-10-08" }),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal([a, b].find(res => res.status === 409).code, "bank-plan-moved");
    assert.equal(ctx.store.get("SELECT planned_date AS d FROM bank_plans WHERE id = ?", plan.id).d, "2026-11-08");
  });

  it("eski tarihle Gerçekleştir → 409 bank-plan-moved, fiş yazılmaz", async () => {
    const before = events(ctx.store);
    expectStatus(await ctx.api.post(`${BANK}/plans/${plan.id}/execute`, { expectedDate: "2026-10-08", date: "2026-10-08" }), 409, "bank-plan-moved", "eski dönem");
    assert.equal(events(ctx.store), before);
  });
});

describe("GG2 — K7 eksi bakiye Banka Fişi'nde (fiş, Düzelt, Planlı Gerçekleştir)", () => {
  let ctx;
  let blocked;
  let warned;
  let open;
  let kmh;
  before(async () => {
    ctx = await bootBank();
    blocked = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Engelli", kind: "demand", negativePolicy: "block", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
    warned = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Uyarılı", kind: "demand", negativePolicy: "warn", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
    open = await openAccount(ctx.api, { bankName: "İş Bankası", name: "Doğrulanmamış", kind: "demand", opening: { date: "2026-10-01", amount: "1.000" } });
    kmh = await openAccount(ctx.api, { bankName: "QNB", name: "KMH", kind: "demand", negativePolicy: "block", creditLimit: "60.000", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("Engelle: 50.000 çıkış → 409 cash-blocked, hiçbir şey yazılmaz; negativeOk da geçmez", async () => {
    const before = events(ctx.store);
    expectStatus(await voucher(ctx.api, { type: "other_out", accountId: blocked.id, amount: "50.000", gl: "659", date: "2026-10-05" }), 409, "cash-blocked", "engelle");
    expectStatus(await voucher(ctx.api, { type: "other_out", accountId: blocked.id, amount: "50.000", gl: "659", date: "2026-10-05", negativeOk: true }), 409, "cash-blocked", "engelle + onay");
    assert.equal(events(ctx.store), before);
    await must("bakiye içinde", voucher(ctx.api, { type: "other_out", accountId: blocked.id, amount: "900", gl: "659", date: "2026-10-05" }));
  });

  it("Uyar: 409 cash-negative (bakiye ve sonuç metinde); Yine de Kaydet (negativeOk) 200 ve bakiye −49.000", async () => {
    const res = await voucher(ctx.api, { type: "other_out", accountId: warned.id, amount: "50.000", gl: "659", date: "2026-10-05" });
    expectStatus(res, 409, "cash-negative", "uyar");
    assert.match(res.error, /1\.000,00/);
    assert.match(res.error, /−49\.000,00|-49\.000,00/);
    await must("yine de kaydet", voucher(ctx.api, { type: "other_out", accountId: warned.id, amount: "50.000", gl: "659", date: "2026-10-05", negativeOk: true }));
    assert.equal((await must("hesap", ctx.api.get(`${BANK}/accounts/${warned.id}`))).balanceMinor, -4_900_000);
  });

  it("Bakiye Doğrulandı olmayan hesapta denetim yok; KMH limiti içinde serbest, aşınca engel", async () => {
    await must("doğrulanmamış", voucher(ctx.api, { type: "other_out", accountId: open.id, amount: "50.000", gl: "659", date: "2026-10-05" }));
    await must("KMH içinde", voucher(ctx.api, { type: "other_out", accountId: kmh.id, amount: "50.000", gl: "659", date: "2026-10-05" }));
    expectStatus(await voucher(ctx.api, { type: "other_out", accountId: kmh.id, amount: "20.000", gl: "659", date: "2026-10-06" }), 409, "cash-blocked", "KMH aşımı");
  });

  it("Düzelt ve Planlı Gerçekleştir de aynı kural", async () => {
    const small = await must("küçük çıkış", voucher(ctx.api, { type: "other_out", accountId: blocked.id, amount: "50", gl: "659", date: "2026-10-06" }));
    expectStatus(await ctx.api.post(`${BANK}/events/${small.id}/correct`, { amount: "5.000" }), 409, "cash-blocked", "Düzelt");
    const plan = await must("plan", ctx.api.post(`${BANK}/plans`, { type: "other_out", accountId: blocked.id, amount: "7.000", gl: "659", plannedDate: "2026-10-07", repeat: "none" }));
    expectStatus(await ctx.api.post(`${BANK}/plans/${plan.id}/execute`, { expectedDate: "2026-10-07" }), 409, "cash-blocked", "Gerçekleştir");
    await integrityOk(ctx.api, "K7");
  });
});

describe("GG2 — Kredi Geri Ödemesi anapara kalan borcu aşamaz", () => {
  it("kredi borcu 10.000: anapara 25.000 → 409 bank-loan-exceeds; 10.000 → 200; sonra 0,01 → 409", async () => {
    const ctx = await bootBank();
    try {
      const bank = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
      const loan = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } });
      expectStatus(await voucher(ctx.api, { type: "loan_repay", accountId: bank.id, loanAccountId: loan.id, amount: "25.000", interestAmount: "500", date: "2026-10-05" }), 409, "bank-loan-exceeds", "fazla anapara");
      await must("tam ödeme", voucher(ctx.api, { type: "loan_repay", accountId: bank.id, loanAccountId: loan.id, amount: "10.000", date: "2026-10-05" }));
      expectStatus(await voucher(ctx.api, { type: "loan_repay", accountId: bank.id, loanAccountId: loan.id, amount: "0,01", date: "2026-10-06" }), 409, "bank-loan-exceeds", "kapanmış kredi");
      assert.equal((await subBalances(ctx.api))[loan.glSub]?.balance || 0, 0);
    } finally {
      await ctx.server.close();
    }
  });
});

describe("GG2 — Hesap Eşlemeleri: masraf türünün hesabı vergi kipinden bağımsız", () => {
  it("Banka Masrafları eşlemesi 659 olamaz (400); 653 yapılınca BSMV'li ve KDV'li masraf aynı hesapta", async () => {
    const ctx = await bootBank();
    try {
      const account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
      const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Ziraat Bankası A.Ş.", type: "supplier", registeredOn: "2026-09-01" }));
      expectStatus(await ctx.api.put(`${BANK}/settings`, { values: { gl: { fee: "659" } } }), 400, "", "659 eşlemesi");
      await must("653", ctx.api.put(`${BANK}/settings`, { values: { gl: { fee: "653" } } }));
      await must("BSMV'li", voucher(ctx.api, { type: "fee", accountId: account.id, amount: "10,50", feeType: "eft", tax: "bsmv_incl", date: "2026-10-05" }));
      await must("KDV'li", voucher(ctx.api, { type: "fee", accountId: account.id, amount: "120", feeType: "eft", tax: "vat_incl", partyId: party.id, invoiceNo: "ZB-1", date: "2026-10-05" }));
      const report = await must("masraf raporu", ctx.api.get(`${BANK}/reports/fees?from=2026-10-01&to=2026-10-31`));
      const byGl = report.totals?.byGl || {};
      assert.deepEqual(Object.keys(byGl).sort(), ["653"], `iki kip de 653'te: ${JSON.stringify(byGl)}`);
      const trial = await trialBalances(ctx.api);
      assert.equal(trial["770"] || 0, 0);
    } finally {
      await ctx.server.close();
    }
  });
});

describe("GG2 — kilitli dönemdeki KDV'li masraf: Ters Kaydet bugün tarihli iade faturası yazar", () => {
  let ctx;
  let account;
  let fee;
  let bsmv;
  before(async () => {
    ctx = await bootBank();
    account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Ziraat Bankası A.Ş.", type: "supplier", registeredOn: "2026-09-01" }));
    fee = await must("KDV'li masraf", voucher(ctx.api, { type: "fee", accountId: account.id, amount: "120", feeType: "eft", tax: "vat_incl", partyId: party.id, invoiceNo: "ZB-1", date: "2026-10-05" }));
    bsmv = await must("BSMV'li masraf", voucher(ctx.api, { type: "fee", accountId: account.id, amount: "10,50", feeType: "eft", tax: "bsmv_incl", date: "2026-10-05" }));
    await lockPeriod(ctx.api, "2026-10-06");
  });
  after(() => ctx.server.close());

  it("İşlem Kartı: Ters Kaydet açık; Fatura penceresi kilitli dönemde Banka'dan iade yolunu söyler", async () => {
    const card = await must("İşlem Kartı", ctx.api.get(`${BANK}/events/${fee.id}`));
    assert.equal(card.actions.reverse.allowed, true, card.actions.reverse.reason);
    const invoice = await must("fatura", ctx.api.get(`/api/workspace/invoices/${fee.invoice.id}`));
    const text = `${invoice.cancelBlock || ""} ${invoice.returnBlock || ""}`;
    assert.match(text, /Ters Kaydet/);
  });

  it("Ters Kaydet → 08.10 tarihli Alıştan İade + bankaya 120 giriş; 770, 191, 320 net 0; kilitli dönem değişmez", async () => {
    const trialBefore = await trialBalances(ctx.api, "?to=2026-10-06");
    const done = await must("Ters Kaydet", ctx.api.post(`${BANK}/events/${fee.id}/reverse`, { reason: "Banka masrafı iade etti" }));
    assert.equal(done.original.status, "reversed");
    assert.ok(done.reversal, "iade başlığı");
    assert.equal(done.reversal.date, "2026-10-08");
    const returned = ctx.store.get("SELECT id, kind, status, issue_date AS date, original_id AS originalId, try_payable AS payable FROM invoices WHERE original_id = ?", fee.invoice.id);
    assert.ok(returned, "iade faturası");
    assert.equal(returned.kind, "purchase_return");
    assert.equal(returned.date, "2026-10-08");
    assert.equal(Math.round(returned.payable * 100), 12_000);
    const trial = await trialBalances(ctx.api);
    for (const code of ["191", "320"]) assert.equal(Math.round((trial[code] || 0) * 100), 0, `${code} net 0`);
    assert.equal(Math.round((trial["770"] || 0) * 100), 1050, "770'te yalnız BSMV'li masraf kalır (KDV'li masrafın gideri iadeyle 0)");
    const subs = await subBalances(ctx.api);
    assert.equal(Math.round(subs[account.glSub].balance * 100), 10_000_000 - 1050, "yalnız BSMV'li masraf kalır");
    assert.deepEqual(await trialBalances(ctx.api, "?to=2026-10-06"), trialBefore, "kilitli dönemin mizanı aynı");
    const again = await ctx.api.post(`${BANK}/events/${fee.id}/reverse`, {});
    expectStatus(again, 409, "bank-already-reversed", "ikinci kez");
    const back = await must("iade faturası", ctx.api.get(`/api/workspace/invoices/${returned.id}`));
    assert.match(back.cancelBlock || "", /iade/);
    await integrityOk(ctx.api, "kilitli KDV'li masraf iadesi");
  });

  it("BSMV'li masraf kilitli dönemde de bugün tarihli ters kayıtla (değişmedi)", async () => {
    const done = await must("Ters Kaydet", ctx.api.post(`${BANK}/events/${bsmv.id}/reverse`, {}));
    assert.equal(done.reversal.date, "2026-10-08");
  });
});

describe("GG2 — modül hareketinde Açıklamayı Düzelt kapalı", () => {
  it("cari havalesi hesaba bağlı: İşlem Kartı info kapalı ve nedeni; PUT info → 409 bank-event-module", async () => {
    const ctx = await bootBank();
    try {
      const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
      await must("havale", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "1.000", method: "bank", date: "2026-10-05", note: "Eylül tahsilatı" }));
      const account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
      const legacy = await must("eski", ctx.api.get(`${BANK}/legacy`));
      await must("ata", ctx.api.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: legacy.rows.map(row => ({ table: row.table, id: row.id })) }));
      const eventId = legacy.rows[0].eventId;
      const card = await must("kart", ctx.api.get(`${BANK}/events/${eventId}`));
      assert.equal(card.actions.info.allowed, false);
      assert.match(card.actions.info.reason, /Cari/);
      expectStatus(await ctx.api.put(`${BANK}/events/${eventId}/info`, { description: "Banka penceresinden" }), 409, "bank-event-module", "modül açıklaması");
    } finally {
      await ctx.server.close();
    }
  });
});
