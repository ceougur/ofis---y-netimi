// 2.1.0 — Hızlı "Nasıl Bozarım" (hesap seçimi; kullanıcı isteği 09.10.2026, bağımsız saldırgan test). Liste ve sonuçlar: docs/2.1.0-KANIT.md →
// "Hızlı Nasıl Bozarım (hesap seçimi)". Bu dosyada: bulunan açıkların kırmızı → yeşil testleri (H1–H3) ve dayanan saldırıların kalıcı testleri (D1–D4).
//   H1  Fatura İPTALİ bağlı peşin havaleyi Engelle'deki hesaptan düşer → hesap eksiye (K7 atlatılıyordu; taksit tahsilatı silmesi 409 veriyordu)
//   H2  Kayıtlı faturayı SİLME (DELETE) aynı açık; Uyar'da ?negativeOk=1 ile "Yine de Sil"
//   H3  Bağlı satırın tarihi hesap açılışından önceye ya da pasif hesaptaki satırın tutarı — hesap kimliği gövdeden çıkarılınca denetimsiz geçiyordu
//       (açılış öncesi genel "defterler arasında sapma … yöneticinize bildirin" 409'una düşüyordu; pasifte kabul ediliyordu)
//   D1  Engelle'deki hesaptan aynı anda iki ödeme (ikisi ayrı ayrı sığar, birlikte sığmaz) → biri 409 cash-blocked, hesap eksiye düşmez
//   D2  Aynı istek kimliği farklı gövde (başka tutar/hesap) → 409 request-id-reused, ikinci satır yazılmaz
//   D3  Başka şirketin hesap kimliği (iki yönde, ?hofCompany=) → 404 bank-account-missing
//   D4  bank.move'suz personel bağlı satırın yolunu nakde çevirip bağı koparamaz (403), yalnız açıklamayı düzeltir
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, must, openAcceptanceAccounts } from "./banka-210-hesap-ortak.mjs";

const INV = "/api/workspace/invoices";
const entries = id => `/api/workspace/accounts/${id}/entries`;
const balance = async (api, account) => (await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor / 100;
const setPolicy = (api, account, policy) => must(`politika ${policy}`, api.put(`${BANK}/accounts/${account.id}`, { negativePolicy: policy }));
const sale = (accountId, amount, bankAccountId) => ({ kind: "sale", accountId, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: amount, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: String(amount), method: "bank", bankAccountId }], cheques: [], endorse: [], rest: "open" }, force: true });

describe("Hızlı Nasıl Bozarım — hesap seçimi", () => {
  let ctx;
  let acc;
  let buyer;
  let seller;
  let clerk;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    seller = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
    clerk = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    assert.equal((await ctx.api.client.patch(`/api/admin/users/${users.find(user => user.username === "muhasebe1").id}`, { grants: { add: [], remove: ["bank.move", "bank.cancel"] } })).status, 200);
  });
  after(() => ctx.server.close());

  it("H1: fatura iptali bağlı peşini Engelle'deki hesaptan düşüremez (409 cash-blocked, fatura Kaydedildi kalır); Uyar'da sorulur → negativeOk", async () => {
    const doc = await must("satış", ctx.api.post(INV, sale(buyer.id, 20000, acc.garanti.id)));
    const g = await balance(ctx.api, acc.garanti);
    assert.equal(g, 70000);
    await must("ödeme", ctx.api.post(entries(seller.id), { kind: "out", amount: "60.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    await setPolicy(ctx.api, acc.garanti, "block");
    expectStatus(await ctx.api.post(`${INV}/${doc.id}/cancel`, { reason: "deneme" }), 409, "cash-blocked", "Engelle iptal");
    expectStatus(await ctx.api.post(`${INV}/${doc.id}/cancel`, { reason: "deneme", negativeOk: true }), 409, "cash-blocked", "Engelle iptal (negativeOk geçmez)");
    assert.equal(ctx.store.get("SELECT status FROM invoices WHERE id = ?", doc.id).status, "issued");
    assert.equal(await balance(ctx.api, acc.garanti), 10000);
    await setPolicy(ctx.api, acc.garanti, "warn");
    expectStatus(await ctx.api.post(`${INV}/${doc.id}/cancel`, { reason: "deneme" }), 409, "cash-negative", "Uyar iptal");
    await must("Yine de İptal Et", ctx.api.post(`${INV}/${doc.id}/cancel`, { reason: "deneme", negativeOk: true }));
    assert.equal(await balance(ctx.api, acc.garanti), -10000);
    await integrityOk(ctx.api, "H1");
  });

  it("H2: kayıtlı faturayı silmek aynı kurala bağlı: Engelle 409 (belge yerinde), Uyar 409 → ?negativeOk=1 ile silinir", async () => {
    const doc = await must("satış", ctx.api.post(INV, sale(buyer.id, 5000, acc.ziraat.id)));
    const z = await balance(ctx.api, acc.ziraat);
    await must("ödeme", ctx.api.post(entries(seller.id), { kind: "out", amount: String(z - 1000), method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    await setPolicy(ctx.api, acc.ziraat, "block");
    expectStatus(await ctx.api.del(`${INV}/${doc.id}`), 409, "cash-blocked", "Engelle sil");
    assert.equal(ctx.store.get("SELECT status FROM invoices WHERE id = ?", doc.id).status, "issued");
    assert.equal(await balance(ctx.api, acc.ziraat), 1000);
    await setPolicy(ctx.api, acc.ziraat, "warn");
    expectStatus(await ctx.api.del(`${INV}/${doc.id}`), 409, "cash-negative", "Uyar sil");
    await must("Yine de Sil", ctx.api.del(`${INV}/${doc.id}?negativeOk=1`));
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices WHERE id = ?", doc.id).n, 0);
    assert.equal(await balance(ctx.api, acc.ziraat), -4000);
    // Eski hâline: sonraki testler etkilenmesin.
    await must("Ziraat'e tahsilat", ctx.api.post(entries(buyer.id), { kind: "in", amount: "4.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, description: "denge" }));
    await integrityOk(ctx.api, "H2");
  });

  it("H3: bağlı satırın tarihi açılıştan önceye (hesap kimliği gövdede yok) → 409 bank-before-opening (cari ve kayıt tahsilatı); satır değişmez", async () => {
    const row = (await must("tahsilat", ctx.api.post(entries(buyer.id), { kind: "in", amount: "1.000", method: "bank", bankAccountId: acc.ziraat.id, date: "2026-10-05" }))).entryId;
    const res = await ctx.api.put(`${entries(buyer.id)}/${row}`, { kind: "in", amount: "1.000", method: "bank", date: "2026-09-20" });
    expectStatus(res, 409, "bank-before-opening", "cari tarih açılış öncesi");
    assert.deepEqual({ ...ctx.store.get("SELECT date, fin_ref AS ref FROM account_entries WHERE id = ?", row) }, { date: "2026-10-05", ref: acc.ziraat.id });
    const pay = await must("kayıt tahsilatı", ctx.api.post("/api/workspace/cases/K-1/payments", { amount: "200", date: TODAY, method: "bank", bankAccountId: acc.garanti.id, caseTitle: "K" }));
    expectStatus(await ctx.api.put(`/api/workspace/payments/${pay.id}`, { amount: "200", date: "2026-09-20", method: "bank" }), 409, "bank-before-opening", "kayıt tarih açılış öncesi");
    await integrityOk(ctx.api, "H3a");
  });

  it("H3: pasif hesaba bağlı satırın TUTARI hesap kimliği gönderilmeden değiştirilemez (400 bank-account-invalid, kimlikle de öyle); açıklama değişir", async () => {
    const row = (await must("tahsilat", ctx.api.post(entries(buyer.id), { kind: "in", amount: "400", method: "bank", bankAccountId: acc.garanti.id, date: TODAY, description: "pasif" }))).entryId;
    await must("pasife al", ctx.api.post(`${BANK}/accounts/${acc.garanti.id}/status`, { status: "passive" }));
    try {
      expectStatus(await ctx.api.put(`${entries(buyer.id)}/${row}`, { kind: "in", amount: "450", method: "bank", date: TODAY }), 400, "bank-account-invalid", "kimliksiz");
      expectStatus(await ctx.api.put(`${entries(buyer.id)}/${row}`, { kind: "in", amount: "450", method: "bank", date: TODAY, bankAccountId: acc.garanti.id }), 400, "bank-account-invalid", "kimlikle");
      assert.equal(ctx.store.get("SELECT amount FROM account_entries WHERE id = ?", row).amount, 400);
      await must("yalnız açıklama", ctx.api.put(`${entries(buyer.id)}/${row}`, { kind: "in", amount: "400", method: "bank", date: TODAY, description: "pasif hesap, açıklama düzeldi" }));
      assert.equal(ctx.store.get("SELECT fin_ref FROM account_entries WHERE id = ?", row).fin_ref, acc.garanti.id);
    } finally {
      await must("etkinleştir", ctx.api.post(`${BANK}/accounts/${acc.garanti.id}/status`, { status: "active" }));
    }
    await integrityOk(ctx.api, "H3b");
  });

  it("D1: Engelle'deki hesaptan aynı anda iki ödeme → biri 409 cash-blocked; hesap eksiye düşmez", async () => {
    await setPolicy(ctx.api, acc.ziraat, "block");
    const z = await balance(ctx.api, acc.ziraat);
    const part = Math.round(z * 0.6);
    const results = await Promise.all([1, 2].map(i => ctx.api.post(entries(seller.id), { kind: "out", amount: String(part + i), method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, description: `yarış ${i}` })));
    assert.deepEqual(results.map(res => res.status).sort(), [200, 409]);
    assert.equal(results.find(res => res.status === 409).code, "cash-blocked");
    assert.ok((await balance(ctx.api, acc.ziraat)) >= 0);
    await setPolicy(ctx.api, acc.ziraat, "warn");
    await integrityOk(ctx.api, "D1");
  });

  it("D2: aynı istek kimliği farklı gövde → 409 request-id-reused; ikinci satır yazılmaz", async () => {
    const id = "bozarim-istek-0000000001";
    const count = () => ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", buyer.id).n;
    const first = await ctx.api.client.post(entries(buyer.id), { kind: "in", amount: "100", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }, { "x-hof-request": id });
    assert.equal(first.status, 200);
    const n = count();
    const second = await ctx.api.client.post(entries(buyer.id), { kind: "in", amount: "999", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }, { "x-hof-request": id });
    assert.equal(second.status, 409);
    assert.equal(second.data.code, "request-id-reused");
    assert.equal(count(), n);
  });

  it("D3: başka şirketin hesap kimliği iki yönde 404 bank-account-missing", async () => {
    const second = await must("002", ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    const q = `?hofCompany=${encodeURIComponent(second.id || second.company?.id)}`;
    const other = (await ctx.api.client.post(`${BANK}/accounts${q}`, { bankName: "Akbank", name: "B", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "10", confirmed: true } })).data.data;
    expectStatus(await ctx.api.post(entries(buyer.id), { kind: "in", amount: "10", method: "bank", bankAccountId: other.id, date: TODAY }), 404, "bank-account-missing", "001'den 002'nin hesabı");
    const party = (await ctx.api.client.post(`/api/workspace/accounts${q}`, { name: "B2", type: "customer", registeredOn: "2026-09-01" })).data.data;
    const res = await ctx.api.client.post(`/api/workspace/accounts/${party.id}/entries${q}`, { kind: "in", amount: "10", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY });
    assert.equal(res.status, 404);
    assert.equal(res.data.code, "bank-account-missing");
  });

  it("D4: bank.move'suz personel bağlı satırın yolunu nakde çevirip bağı koparamaz (403); yalnız açıklama düzeltir", async () => {
    const row = (await must("tahsilat", ctx.api.post(entries(buyer.id), { kind: "in", amount: "300", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, description: "D4" }))).entryId;
    expectStatus(await clerk.put(`${entries(buyer.id)}/${row}`, { kind: "in", amount: "300", method: "cash", date: TODAY }), 403, "bank-permission", "nakde çevir");
    expectStatus(await clerk.put(`${entries(buyer.id)}/${row}`, { kind: "in", amount: "350", method: "bank", date: TODAY }), 403, "bank-permission", "tutar");
    await must("açıklama", clerk.put(`${entries(buyer.id)}/${row}`, { kind: "in", amount: "300", method: "bank", date: TODAY, description: "D4 düzeldi" }));
    assert.deepEqual({ ...ctx.store.get("SELECT method, fin_ref AS ref FROM account_entries WHERE id = ?", row) }, { method: "bank", ref: acc.ziraat.id });
    await integrityOk(ctx.api, "D4");
  });
});
