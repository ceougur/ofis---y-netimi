// Dar kontrol turu 2.4.3 — ek maddeler (kullanıcı kararı: bulunan BÜTÜN bulgular 2.4.3'te düzeltilir). Sahte EDM; ağa çıkmaz; sahte saat (ders 13).
//   Ek 3  Banka → Ters Kaydet (kilitli dönemdeki KDV'li masraf): bugün tarihli Alıştan İade faturası, serisinde daha eski tarihli bekleyen varken
//         O1 gereği numarasız Gönderilecekler'e girer; banka işleminin açıklaması "İade Faturası (gönderilecek)" yazar ve sonradan gönderilince
//         NUMARAYA DÖNÜŞÜR (önceden dönüşmüyordu: renumberNotes banka açıklamasını değiştirmiyordu).
//   Ek 5  Test yardımcısının edocStatusPollMs seçeneği yapılandırmaya hiç ulaşmıyordu (testler 1 + 2 sn'lik üretim aralığıyla koşuyordu).
// Nasıl bozulur: eski tarihli bekleyen varken Ters Kaydet; sonra Tümünü Gönder; mutabakat; kilitli dönem değişmemeli.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { startTestServer } from "./helpers.mjs";
import { integrityOk } from "./banka-210-ortak.mjs";
import { BANK, bootBank, lockPeriod, must, openAccount } from "./banka-210-hesap-ortak.mjs";

describe("gg243 dar kontrol ek 3: Ters Kaydet iade faturası O1 ile ertelenir; banka açıklaması numaraya döner", () => {
  let ctx;
  let edm;
  let fee;
  let waiting;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    const fetchImpl = async (input, init) => {
      const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
      if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
      return globalThis.fetch(input, init);
    };
    ctx = await bootBank({ edocEnabled: true, fetchImpl, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    await must("firma", ctx.api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true }));
    await must("entegratör", ctx.api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    const account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    const bankParty = await must("banka carisi", ctx.api.post("/api/workspace/accounts", { name: "Ziraat Bankası A.Ş.", type: "supplier", partyKind: "company", taxNo: vkn(700000001), taxOffice: "Ulus", address: "Atatürk Blv. 8", district: "Altındağ", city: "Ankara", registeredOn: "2026-09-01" }));
    fee = await must("KDV'li masraf", ctx.api.post(`${BANK}/vouchers`, { type: "fee", accountId: account.id, amount: "120", feeType: "eft", tax: "vat_incl", partyId: bankParty.id, invoiceNo: "ZBA2026000000001", date: "2026-10-05" }));
    const customer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", registeredOn: "2026-09-01" }));
    // Seride (TEA) bugünden eski tarihli numarasız bekleyen.
    waiting = await must("bekleyen", ctx.api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate: "2026-10-07", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    await lockPeriod(ctx.api, "2026-10-06");
  });
  after(async () => {
    await ctx?.server.close();
    await edm?.close();
  });

  test("Ters Kaydet: iade faturası numarasız bekler, açıklama '(gönderilecek)'; Tümünü Gönder sonrası ikisi de numaraya döner, eski tarihli önce", async () => {
    const done = await must("Ters Kaydet", ctx.api.post(`${BANK}/events/${fee.id}/reverse`, { reason: "Banka masrafı iade etti" }));
    assert.equal(done.original.status, "reversed");
    const returned = ctx.store.get("SELECT id, kind, number, e_status AS eStatus, profile, issue_date AS date FROM invoices WHERE original_id = ?", fee.invoice.id);
    assert.equal(returned.kind, "purchase_return");
    assert.equal(returned.date, "2026-10-08");
    assert.equal(returned.profile, "EARSIVFATURA", "ön koşul: bekleyenle aynı seri (TEA)");
    assert.deepEqual([returned.number, returned.eStatus], ["", "waiting"], "O1: seride eski tarihli bekleyen varken numara verilmedi");
    const reversal = () => ctx.store.get("SELECT description FROM fin_events WHERE type = 'reversal' AND invoice_id = ?", returned.id);
    assert.match(reversal().description, /^Ters Kayıt · .+ · İade Faturası \(gönderilecek\)$/);
    const turns = [];
    for (let i = 0; i < 5; i += 1) {
      const r = await must("Tümünü Gönder", ctx.api.post("/api/workspace/invoices/send-pending", { all: true }));
      turns.push(r);
      if (!r.remaining || !r.sent) break;
    }
    assert.equal(turns.reduce((sum, r) => sum + r.sent, 0), 2, JSON.stringify(turns.map(r => r.results)));
    const back = ctx.store.get("SELECT number FROM invoices WHERE id = ?", returned.id).number;
    const first = ctx.store.get("SELECT number FROM invoices WHERE id = ?", waiting.id).number;
    assert.match(back, /^TEA2026\d{9}$/);
    assert.ok(Number(first.slice(7)) < Number(back.slice(7)), `eski tarihli bekleyen önce (${first} < ${back})`);
    assert.equal(reversal().description, reversal().description.replace("(gönderilecek)", ""), `açıklamada yer tutucu kalmadı: ${reversal().description}`);
    assert.match(reversal().description, new RegExp(`İade Faturası ${back}$`), "banka açıklaması iade faturasının numarasını gösterir");
    const notes = ctx.store.all("SELECT note FROM account_entries WHERE source = 'invoice' AND source_id = ?", returned.id).map(row => row.note);
    assert.ok(notes.length && notes.every(note => note.includes(back) && !note.includes("(gönderilecek)")), JSON.stringify(notes));
    await integrityOk(ctx.api, "ertelenen Ters Kaydet iadesi");
  });
});

describe("gg243 dar kontrol ek 5: test yardımcısının edocStatusPollMs seçeneği yapılandırmaya ulaşır", () => {
  test("startTestServer({ edocStatusPollMs: [5, 5] }) → app.config.edocStatusPollMs = [5, 5]; verilmezse tanımsız (üretim 1 sn + 2 sn)", async () => {
    const quick = await startTestServer({ edocEnabled: true, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const plain = await startTestServer({ edocEnabled: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    try {
      assert.deepEqual(quick.app.config.edocStatusPollMs, [5, 5]);
      assert.equal(plain.app.config.edocStatusPollMs, undefined);
    } finally {
      await quick.close();
      await plain.close();
    }
  });
});
