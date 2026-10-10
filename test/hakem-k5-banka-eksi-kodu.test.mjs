// Hakem K5 (10.10.2026; docs/kanit/2026-10-10/kahin/hakem-hukumleri.json → BANKA-EKSI-KODU). Banka hesabının eksi bakiye reddi programda
// bank-negative / bank-blocked kodu ve yalnız negativeOk onayıyla dönüyordu. Plan (docs/BANKA-MODULU-PLAN.md):
//   §7   "Mevcut cash-negative ve cash-blocked kodlarına accountId alanı eklenir." (yeni kod listesinde bank-negative / bank-blocked yok)
//   §3.9 "Uyarıyı geçmek ("Yine de Kaydet", cashForce) bank.move ister."
//   §12.5 adım 37 "… biri 200, öbürü 409 cash-blocked" (Engelle'deki Garanti banka hesabı)
// Düzeltme: hesap bazlı ret 409 cash-negative / cash-blocked + accountId; onay cashForce (gövde ya da ?cashForce=1); eski istemcinin negativeOk'u
// eşanlamlı. Ekran Kasa sorusunu onaylarken (HOF.api cashForce) banka hesabını henüz sormadıysa negativeOk:false (?negativeOk=0) ekler: cashForce
// o zaman yalnız Kasa'yı geçer, banka hesabı ayrıca sorulur (iki soru; tek onay ikisini birden sessizce geçmez).
//
// Nasıl bozarım (önce yazıldı):
//   N1 Planın bayrağıyla (yalnız cashForce) Uyar'ı geç → hâlâ 409? (200 olmalı)
//   N2 Engelle'yi cashForce + negativeOk ile geç → (409 cash-blocked, hiçbir bayrak geçmez)
//   N3 Silmede ?cashForce=1 (HOF.api'nin silmede eklediği) → banka hesabı da geçer
//   N4 Kasa + banka aynı istekte: Kasa onayı (cashForce + negativeOk:false) bankayı sessizce geçer mi? (geçmez: 409 + accountId); yalnız cashForce
//      (plan: tek onay) ikisini geçer
//   N5 Kasa'nın kendi reddi değişmedi (cash-negative, accountId yok, method cash)
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const INV = "/api/workspace/invoices";
const entries = id => `/api/workspace/accounts/${id}/entries`;
const balanceOf = async (api, account) => (await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor / 100;
const cashOf = async api => (await must("Kasa", api.get("/api/workspace/cash"))).byMethod.cash;

describe("K5 — banka hesabının eksi bakiye reddi: cash-negative / cash-blocked + accountId; onay cashForce (negativeOk eşanlamlı)", () => {
  let ctx;
  let garanti;
  let party;
  before(async () => {
    ctx = await bootBank();
    garanti = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100", confirmed: true } });
    party = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
  });
  after(() => ctx.server.close());

  it("N1: Uyar — 150 havale ödemesi (bakiye 100) → 409 cash-negative + accountId; yalnız cashForce → 200 (planın bayrağı)", async () => {
    const body = { kind: "out", amount: "150", method: "bank", bankAccountId: garanti.id, date: TODAY };
    const warned = await ctx.api.post(entries(party.id), body);
    expectStatus(warned, 409, "cash-negative", "Uyar");
    assert.equal(warned.data?.accountId, garanti.id, "ret hangi hesabın olduğunu söyler");
    assert.match(warned.error, /Garanti BBVA · Ana TL Hesabı hesabında 100,00 TL var/, `metin banka hesabının adı ve bakiyesiyle: ${warned.error}`);
    await must("Yine de Kaydet (cashForce)", ctx.api.post(entries(party.id), { ...body, cashForce: true }));
    assert.equal(await balanceOf(ctx.api, garanti), -50);
  });

  it("N1b: eski istemcinin negativeOk'u eşanlamlı → 200; Banka Fişi'nde de aynı kod ve onay", async () => {
    await must("negativeOk", ctx.api.post(entries(party.id), { kind: "out", amount: "10", method: "bank", bankAccountId: garanti.id, date: TODAY, negativeOk: true }));
    assert.equal(await balanceOf(ctx.api, garanti), -60);
    const voucher = { type: "other_out", accountId: garanti.id, amount: "5", date: TODAY, gl: "659" };
    const warned = await ctx.api.post(`${BANK}/vouchers`, voucher);
    expectStatus(warned, 409, "cash-negative", "Banka Fişi Uyar");
    assert.equal(warned.data?.accountId, garanti.id);
    await must("Banka Fişi cashForce", ctx.api.post(`${BANK}/vouchers`, { ...voucher, cashForce: true }));
    assert.equal(await balanceOf(ctx.api, garanti), -65);
  });

  it("N4a: cashForce + negativeOk:false (ekranın Kasa onayı) banka hesabını geçmez → 409 cash-negative + accountId", async () => {
    const res = await ctx.api.post(entries(party.id), { kind: "out", amount: "1", method: "bank", bankAccountId: garanti.id, date: TODAY, cashForce: true, negativeOk: false });
    expectStatus(res, 409, "cash-negative", "yalnız Kasa onayı");
    assert.equal(res.data?.accountId, garanti.id);
    assert.equal(await balanceOf(ctx.api, garanti), -65);
  });

  it("N3: silmede ?cashForce=1 banka hesabını da geçer (HOF.api silmede adrese ekler); ?cashForce=1&negativeOk=0 geçmez", async () => {
    const income = await must("tahsilat", ctx.api.post(entries(party.id), { kind: "in", amount: "20", method: "bank", bankAccountId: garanti.id, date: TODAY }));
    const path = `${entries(party.id)}/${income.entryId}`;
    expectStatus(await ctx.api.del(path), 409, "cash-negative", "silme Uyar");
    expectStatus(await ctx.api.del(`${path}?cashForce=1&negativeOk=0`), 409, "cash-negative", "silme yalnız Kasa onayı");
    await must("silme cashForce", ctx.api.del(`${path}?cashForce=1`));
    assert.equal(await balanceOf(ctx.api, garanti), -65);
  });

  it("N2: Engelle — 409 cash-blocked + accountId; cashForce ve negativeOk birlikte de geçmez; hiçbir şey yazılmaz", async () => {
    await must("Engelle", ctx.api.put(`${BANK}/accounts/${garanti.id}`, { negativePolicy: "block" }));
    const body = { kind: "out", amount: "1", method: "bank", bankAccountId: garanti.id, date: TODAY };
    const blocked = await ctx.api.post(entries(party.id), body);
    expectStatus(blocked, 409, "cash-blocked", "Engelle");
    assert.equal(blocked.data?.accountId, garanti.id);
    expectStatus(await ctx.api.post(entries(party.id), { ...body, cashForce: true, negativeOk: true }), 409, "cash-blocked", "Engelle (iki bayrak)");
    expectStatus(await ctx.api.post(`${BANK}/vouchers`, { type: "other_out", accountId: garanti.id, amount: "1", date: TODAY, gl: "659", cashForce: true }), 409, "cash-blocked", "Banka Fişi Engelle");
    assert.equal(await balanceOf(ctx.api, garanti), -65);
    await must("Uyar'a dön", ctx.api.put(`${BANK}/accounts/${garanti.id}`, { negativePolicy: "warn" }));
  });

  it("N5: Kasa'nın kendi reddi değişmedi — cash-negative, accountId yok, method cash", async () => {
    const res = await ctx.api.post(entries(party.id), { kind: "out", amount: "1", method: "cash", date: TODAY });
    expectStatus(res, 409, "cash-negative", "Kasa");
    assert.equal(res.data?.accountId, undefined, "Kasa reddinde banka hesabı yok");
    assert.equal(res.data?.method, "cash");
  });

  it("Mutabakat Testi tamam", async () => {
    await integrityOk(ctx.api, "K5");
  });
});

describe("K5 — aynı istekte Kasa ve banka hesabı eksiye düşerse (satış faturası iptali: nakit + havale peşin)", () => {
  let ctx;
  let garanti;
  let doc;
  before(async () => {
    ctx = await bootBank();
    garanti = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    const seller = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
    doc = await must("satış", ctx.api.post(INV, { kind: "sale", accountId: buyer.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 200, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "100", method: "cash", lineKey: "n" }, { amount: "100", method: "bank", bankAccountId: garanti.id, lineKey: "h" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    // Kasa ve Garanti'deki parayı çıkar (iptal ikisini de eksiye düşürsün).
    await must("Kasa'dan ödeme", ctx.api.post("/api/workspace/cash", { kind: "out", amount: "100", date: TODAY, description: "Kira" }));
    await must("havale ödemesi", ctx.api.post(entries(seller.id), { kind: "out", amount: "100", method: "bank", bankAccountId: garanti.id, date: TODAY }));
    assert.equal(await cashOf(ctx.api), 0);
    assert.equal(await balanceOf(ctx.api, garanti), 0);
  });
  after(() => ctx.server.close());

  it("N4b: önce Kasa sorulur (cash-negative, accountId yok); Kasa onayı (cashForce + negativeOk:false) banka hesabını ayrıca sorar; fatura yerinde", async () => {
    const first = await ctx.api.post(`${INV}/${doc.id}/cancel`, { reason: "deneme" });
    expectStatus(first, 409, "cash-negative", "iptal: Kasa");
    assert.equal(first.data?.accountId, undefined);
    const second = await ctx.api.post(`${INV}/${doc.id}/cancel`, { reason: "deneme", cashForce: true, negativeOk: false });
    expectStatus(second, 409, "cash-negative", "iptal: banka hesabı ayrıca");
    assert.equal(second.data?.accountId, garanti.id);
    assert.equal(ctx.store.get("SELECT status FROM invoices WHERE id = ?", doc.id).status, "issued");
  });

  it("N4c: yalnız cashForce (planın tek onayı) ikisini birlikte geçer → fatura iptal; Kasa −100, Garanti −100", async () => {
    await must("iptal", ctx.api.post(`${INV}/${doc.id}/cancel`, { reason: "deneme", cashForce: true }));
    assert.equal(ctx.store.get("SELECT status FROM invoices WHERE id = ?", doc.id).status, "cancelled");
    assert.equal(await cashOf(ctx.api), -100);
    assert.equal(await balanceOf(ctx.api, garanti), -100);
    await integrityOk(ctx.api, "K5 iptal");
  });
});
