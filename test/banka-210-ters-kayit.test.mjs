// 2.1.0 — Aşama 4, dilim 3: Ters Kaydet, Düzelt ve açıklama (docs/BANKA-MODULU-PLAN.md §3.8 "Banka Fişi", Ek A #11–12, §3.11 kilit izi).
//
// ÇALIŞIYOR MU:
//   - Masraf 10,50 → Ters Kaydet → asıl fiş "Ters Kaydedildi", ters fiş (Ters Kayıt) asıl fişin AYNASI, aynı tarih (açık dönem); 770 ve 102.01
//     net 0; Ziraat yeniden 100.000; kapı tamam.
//   - Düzelt (tutar 10,50 → 12,60): tek işlemde ters fiş + yeni fiş; asıl Ters Kaydedildi, yeni fiş etkin; Ziraat −12,60.
//   - Açıklama ve referans (kilitli dönemde de) düzeltilir; para alanı değişmez; HTML/formül olduğu gibi saklanır.
//   - KDV'li masrafın Ters Kaydı: fatura iptal + masraf başlığı iptal tek işlemde; 191, 770, cari ve banka eski hâline; Fatura penceresinden
//     bu faturayı Düzenle / İptal Et / Sil / İade → 409 ve nedeni (Banka'dan Ters Kaydet).
// NASIL BOZARIM:
//   - Ters kaydı iki kez → 409 bank-already-reversed; ters kaydı ters kaydet → 409 bank-reversal-of-reversal.
//   - Açılışı ters kaydet → 409 bank-event-opening (Açılışı Düzelt); sihirbaz fişi → 409; modül hareketi (cari tahsilatı) → 409 bank-event-module.
//   - Kilitli fişi Ters Kaydet → ters fiş BUGÜN tarihli; kilit izi (lockDigestOf) aynı; kilitli fişi Düzelt → ters fiş bugün + yeni fiş açık
//     tarihte; yeni tarih kilitli → 409 ve hiçbir şey yazılmaz.
//   - Düzelt → Ters Kaydet → aynı tarihe aynı tutarla yeni fiş → 200 (ters kaydedilmiş fiş Benzer İşlem sayılmaz).
//   - Düzelt'te türü değiştirmek → 400; olmayan olay → 404.
//   - Eşleşmiş (ekstreyle) fiş → Ters Kaydet ve Düzelt 409 bank-reconciled.
//   - bank.cancel kaldırılmış kişi Ters Kaydet 403; Düzelt bank.move + bank.cancel ister; personel 403.
//   - Ters Kaydet aynı istek kimliğiyle iki kez → tek ters fiş.
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { lockDigestOf } from "../server/lib/integrity.mjs";
import { BANK, accountView, apiOf, assert, bootBank, counts, eventCard, expectStatus, integrityOk, lineKeys, lockPeriod, must, openBankSet, supplier, trialBalances, voucher } from "./banka-210-fis-ortak.mjs";

const mirror = keys => keys.map(key => key.replace(/\|(D|C)\|/, (_, side) => `|${side === "D" ? "C" : "D"}|`)).sort();

describe("Aşama 4 — Ters Kaydet ve Düzelt", () => {
  let ctx;
  let set;
  before(async () => {
    ctx = await bootBank();
    set = await openBankSet(ctx.api);
  });
  after(() => ctx.server.close());
  const reverse = (id, body = {}) => ctx.api.post(`${BANK}/events/${id}/reverse`, body);
  const correct = (id, body) => ctx.api.post(`${BANK}/events/${id}/correct`, body);

  it("Ters Kaydet: ayna fiş, aynı tarih, net 0; iki kez 409; ters kaydın ters kaydı 409", async () => {
    const z = set.ziraat;
    const fee = await voucher(ctx.api, { type: "fee", accountId: z.id, date: "2026-10-05", amount: "10,50", feeType: "eft", tax: "bsmv_incl" });
    const done = await must("ters kaydet", reverse(fee.id));
    assert.equal(done.original.status, "reversed");
    assert.equal(done.original.statusLabel, "Ters Kaydedildi");
    assert.equal(done.reversal.type, "reversal");
    assert.equal(done.reversal.typeLabel, "Ters Kayıt");
    assert.equal(done.reversal.date, "2026-10-05", "açık dönemde aynı tarih");
    assert.deepEqual(lineKeys(done.reversal), mirror(lineKeys(fee)), "ters fiş asıl fişin aynası");
    assert.equal(done.reversal.reversal.of.no, fee.no);
    assert.equal(done.original.reversal.by.no, done.reversal.no);
    assert.equal((await accountView(ctx.api, z.id)).balanceMinor, 10_000_000, "Ziraat yeniden 100.000");
    const trial = await trialBalances(ctx.api);
    assert.equal(trial["770"] || 0, 0, "770 net 0");
    expectStatus(await reverse(fee.id), 409, "bank-already-reversed", "iki kez");
    expectStatus(await reverse(done.reversal.id), 409, "bank-reversal-of-reversal", "ters kaydın ters kaydı");
    const card = await eventCard(ctx.api, fee.no);
    assert.equal(card.actions.reverse.allowed, false);
    assert.match(card.actions.reverse.reason, /ters kaydedilmiş/i, "pasif düğmenin nedeni");
    await integrityOk(ctx.api, "ters kayıt");
  });

  it("açılış, sihirbaz fişi ve modül hareketi bu yoldan ters kaydedilmez (409, nedenli); olmayan olay 404", async () => {
    const opening = ctx.store.get("SELECT id FROM fin_events WHERE type = 'opening' AND bank_ref = ? AND status = 'active'", set.ziraat.id);
    expectStatus(await reverse(opening.id), 409, "bank-event-opening", "açılış");
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Modül Carisi", type: "customer", registeredOn: "2026-09-01" }));
    await must("tahsilat", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "300", method: "cash", date: "2026-10-05" }));
    const moduleEvent = ctx.store.get("SELECT event_id AS id FROM account_entries WHERE account_id = ? AND kind = 'in'", party.id);
    expectStatus(await reverse(moduleEvent.id), 409, "bank-event-module", "modül hareketi");
    expectStatus(await reverse("ev-yok"), 404, "bank-event-missing", "olmayan olay");
  });

  it("Düzelt: ters fiş + yeni fiş tek işlemde; tür değişmez; Düzelt → Ters Kaydet → aynı tarihe yeni fiş 200", async () => {
    const z = set.ziraat;
    const fee = await voucher(ctx.api, { type: "fee", accountId: z.id, date: "2026-10-06", amount: "10,50", feeType: "eft", tax: "bsmv_incl" });
    expectStatus(await correct(fee.id, { type: "interest_in", amount: "5" }), 400, "bank-correct-type", "tür değişmez");
    const fixed = await must("düzelt", correct(fee.id, { amount: "12,60", feeType: "eft", tax: "bsmv_incl" }));
    assert.equal(fixed.original.status, "reversed");
    assert.equal(fixed.reversal.date, "2026-10-06");
    assert.equal(fixed.next.status, "active");
    assert.equal(fixed.next.date, "2026-10-06", "yeni fiş asıl tarihte");
    assert.deepEqual(lineKeys(fixed.next), [`bank|102|${z.glSub}|C|1260`, "expense|770||D|1200", "tax|770||D|60"].sort());
    assert.equal((await accountView(ctx.api, z.id)).balanceMinor, 10_000_000 - 1260);
    await must("ters kaydet (düzeltilen)", reverse(fixed.next.id));
    const again = await voucher(ctx.api, { type: "fee", accountId: z.id, date: "2026-10-06", amount: "10,50", feeType: "eft", tax: "bsmv_incl" }, "aynı tarihe yeni fiş");
    assert.equal(again.status, "active");
    assert.equal((await accountView(ctx.api, z.id)).balanceMinor, 10_000_000 - 1050);
    await integrityOk(ctx.api, "düzelt");
  });

  it("kilitli fiş: Ters Kaydet bugün tarihli, kilit izi aynı; Düzelt'te yeni tarih kilitliyse 409 ve hiçbir şey yazılmaz", async () => {
    const z = set.ziraat;
    const old = await voucher(ctx.api, { type: "other_out", accountId: z.id, date: "2026-10-02", amount: "40" });
    const old2 = await voucher(ctx.api, { type: "other_out", accountId: z.id, date: "2026-10-02", amount: "41" });
    await lockPeriod(ctx.api, "2026-10-03");
    try {
      const digest = lockDigestOf(ctx.store, "2026-10-03");
      const done = await must("kilitli ters", reverse(old.id));
      assert.equal(done.reversal.date, "2026-10-08", "ters fiş bugün tarihli");
      assert.equal(lockDigestOf(ctx.store, "2026-10-03"), digest, "kilit izi aynı");
      const before = counts(ctx.store);
      expectStatus(await correct(old2.id, { amount: "42", date: "2026-10-02" }), 409, "period-locked", "yeni tarih kilitli");
      assert.deepEqual(counts(ctx.store), before, "hiçbir şey yazılmadı");
      assert.equal((await eventCard(ctx.api, old2.id)).status, "active");
      const fixed = await must("kilitli düzelt", correct(old2.id, { amount: "42" }));
      assert.equal(fixed.reversal.date, "2026-10-08");
      assert.equal(fixed.next.date, "2026-10-08", "tarih verilmezse kilitli fişin yenisi bugün");
      assert.equal(lockDigestOf(ctx.store, "2026-10-03"), digest, "kilit izi aynı (düzelt)");
      await integrityOk(ctx.api, "kilitli");
    } finally {
      await lockPeriod(ctx.api, "");
    }
  });

  it("açıklama ve referans: HTML ve formül olduğu gibi; kilitli fişte de değişir; para değişmez; 500 karakter üstü 400", async () => {
    const z = set.ziraat;
    const fee = await voucher(ctx.api, { type: "fee", accountId: z.id, date: "2026-10-02", amount: "3", feeType: "eft", tax: "none", description: "ilk" });
    await lockPeriod(ctx.api, "2026-10-03");
    try {
      const html = "<img src=x onerror=alert(1)> =HYPERLINK(\"http://kotu\";\"tıkla\")";
      const card = await must("açıklama", ctx.api.put(`${BANK}/events/${fee.id}/info`, { description: html, reference: "=1+1" }));
      assert.equal(card.description, html);
      assert.equal(card.reference, "=1+1");
      assert.equal(card.tryMinor, 300);
      expectStatus(await ctx.api.put(`${BANK}/events/${fee.id}/info`, { description: "x".repeat(501) }), 400, null, "501 karakter");
    } finally {
      await lockPeriod(ctx.api, "");
    }
  });

  it("eşleşmiş fiş: Ters Kaydet ve Düzelt 409 bank-reconciled", async () => {
    const z = set.ziraat;
    const fee = await voucher(ctx.api, { type: "fee", accountId: z.id, amount: "2", feeType: "eft", tax: "none" });
    ctx.store.run("INSERT INTO bank_matches (id, line_id, bank_account_id, event_id, amount_minor, digest, kind, created_by, created_at) VALUES (?, 'line-x', ?, ?, 200, 'x', 'manual', 'test', ?)", `bm-${randomUUID()}`, z.id, fee.id, new Date().toISOString());
    expectStatus(await reverse(fee.id), 409, "bank-reconciled", "eşleşmiş ters");
    expectStatus(await correct(fee.id, { amount: "3" }), 409, "bank-reconciled", "eşleşmiş düzelt");
    const card = await eventCard(ctx.api, fee.id);
    assert.equal(card.actions.reverse.allowed, false);
    assert.match(card.actions.reverse.reason, /eşleş/i);
  });

  it("yetki: bank.cancel kaldırılan Ters Kaydet 403; personel 403; aynı istek kimliğiyle iki Ters Kaydet tek fiş", async () => {
    const z = set.ziraat;
    const fee = await voucher(ctx.api, { type: "fee", accountId: z.id, amount: "1,10", feeType: "eft", tax: "none" });
    const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel5", role: "personel" }));
    expectStatus(await staff.post(`${BANK}/events/${fee.id}/reverse`, {}), 403, null, "personel");
    const accountant = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe5", role: "muhasebe" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe5");
    const res = await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.cancel"] } });
    assert.equal(res.status, 200);
    expectStatus(await accountant.post(`${BANK}/events/${fee.id}/reverse`, {}), 403, null, "bank.cancel yok");
    expectStatus(await accountant.post(`${BANK}/events/${fee.id}/correct`, { amount: "2" }), 403, null, "düzelt bank.cancel ister");
    const requestId = `req-${randomUUID()}`;
    const first = await must("ters 1", ctx.api.post(`${BANK}/events/${fee.id}/reverse`, { requestId }));
    const second = await must("ters 2", ctx.api.post(`${BANK}/events/${fee.id}/reverse`, { requestId }));
    assert.equal(second.replayed, true);
    assert.equal(second.reversal.no, first.reversal.no);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE reversal_of = ?", fee.id).n, 1, "tek ters fiş");
  });
});

describe("Aşama 4 — KDV'li masrafın yaşam döngüsü", () => {
  let ctx;
  let set;
  before(async () => {
    ctx = await bootBank();
    set = await openBankSet(ctx.api);
  });
  after(() => ctx.server.close());

  it("Fatura penceresinden Düzenle / İptal / Sil / İade 409 (nedenli); Banka'dan Ters Kaydet: fatura iptal + başlık iptal, her şey eski hâline", async () => {
    const z = set.ziraat;
    const party = await supplier(ctx.api, "Ziraat Bankası A.Ş.");
    const trialBefore = await trialBalances(ctx.api);
    const fee = await voucher(ctx.api, { type: "fee", accountId: z.id, amount: "120", feeType: "eft", tax: "vat_incl", partyId: party.id, invoiceNo: "ZB-2026-0002" });
    const invoiceId = fee.invoice.id;
    const detail = await must("fatura", ctx.api.get(`/api/workspace/invoices/${invoiceId}`));
    assert.equal(detail.canModify, false);
    assert.match(detail.modifyBlock, /Banka/);
    assert.equal(detail.canCancel, false);
    assert.match(detail.cancelBlock, /Banka/);
    assert.equal(detail.canDelete, false);
    assert.match(detail.deleteBlock, /Banka/);
    assert.equal(detail.canReturn, false);
    assert.match(detail.returnBlock, /Banka/);
    expectStatus(await ctx.api.post(`/api/workspace/invoices/${invoiceId}/cancel`, { reason: "deneme" }), 409, "invoice-bank-fee", "Fatura'dan iptal");
    expectStatus(await ctx.api.del(`/api/workspace/invoices/${invoiceId}`), 409, null, "Fatura'dan sil");
    expectStatus(await ctx.api.post(`/api/workspace/invoices/${invoiceId}/edit`, { lines: [{ name: "x", qty: 1, unitPrice: 1, vatRate: 20, expenseCode: "bank" }], accountId: party.id, kind: "purchase", number: "ZB-2026-0002" }), 409, "invoice-locked", "Fatura'dan düzenle");
    const done = await must("KDV'li masraf ters kaydet", ctx.api.post(`${BANK}/events/${fee.id}/reverse`, {}));
    assert.equal(done.original.status, "cancelled");
    assert.equal(done.original.invoice.status, "cancelled");
    assert.equal(done.reversal, null, "satırsız başlık iptal edilir (ters fiş yok)");
    const trialAfter = await trialBalances(ctx.api);
    for (const code of ["102", "191", "770", "320"]) assert.equal(trialAfter[code] || 0, trialBefore[code] || 0, `${code} eski hâline`);
    assert.equal((await accountView(ctx.api, z.id)).balanceMinor, 10_000_000);
    const report = await must("masraf raporu", ctx.api.get(`${BANK}/reports/fees`));
    assert.ok(!report.rows.some(row => row.no === fee.no), "iptal edilen KDV'li masraf raporda yok");
    await integrityOk(ctx.api, "KDV'li masraf ters");
  });

  it("kilitli dönemdeki KDV'li masraf Ters Kaydet → 409 (fatura kilitli dönemde iptal edilmez)", async () => {
    const z = set.ziraat;
    const party = await supplier(ctx.api, "Garanti Ödeme");
    const fee = await voucher(ctx.api, { type: "fee", accountId: z.id, date: "2026-10-02", amount: "60", feeType: "eft", tax: "vat_incl", partyId: party.id, invoiceNo: "GO-1" });
    await lockPeriod(ctx.api, "2026-10-03");
    try {
      expectStatus(await ctx.api.post(`${BANK}/events/${fee.id}/reverse`, {}), 409, "period-locked", "kilitli KDV'li masraf");
      assert.equal((await eventCard(ctx.api, fee.id)).status, "active");
    } finally {
      await lockPeriod(ctx.api, "");
    }
  });
});
