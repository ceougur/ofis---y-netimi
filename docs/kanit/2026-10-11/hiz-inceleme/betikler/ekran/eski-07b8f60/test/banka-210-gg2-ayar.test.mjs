// 2.1.0 — Aşama 3–4 bağımsız gözden geçirme (GG2): etkisiz ayarlar, faturada IBAN, ertelenen özellikler.
//
// Bulgular (orta, doğrulandı):
//   - Banka Ayarları'nda etkisi olmayan seçenekler: Hafta Sonu ("Yalnız Pazar" seçilse de Cumartesi hafta sonu sayılıyordu: Cumartesi ↔ Pazartesi
//     Benzer İşlem), Kanal Alanı (hiçbir formda yok), Elle Banka Fişi (formu yok), Tatil yardımındaki "Tatiller listesi" (yok). Kural: Hafta Sonu
//     iş günü hesabına bağlandı; Kanal Alanı ve Elle Banka Fişi gelene kadar görünmez (yarım özellik görünmez, plan §12.1); yardım metni gerçeği
//     söyler.
//   - Hesap kartındaki "IBAN Faturada Gösterilsin" kutusunun etkisi yoktu. Kural (plan §8.9): işaretli hesabın IBAN'ı faturanın satıcı banka
//     listesine girer (Fatura Ayarları'ndakilerle birlikte; aynı IBAN bir kez; en çok 4).
//   - Ertelenen döviz, POS ve Ekstre görünüyordu (kullanıcı kararı "Ertelenenler 2.1.0'da GÖRÜNMEZ"). Kural: döviz hesabı açılmaz (400
//     bank-currency-later; testler config.fxEnabled ile açar); Döviz ayarları ve Kambiyo Kârı/Zararı eşlemeleri görünmez; POS Tanımlama,
//     Komisyon, Ekstre ve Mutabakat yetkileri Roller ekranında görünmez ve özel rol düzenlenirken kayıtlı değerleri kaybolmaz.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BANK, boot, expectStatus, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const MONDAY = "2026-10-12T12:00:00+03:00";
const IBAN = "TR330006100519786457841326";
const fee = (api, accountId, date) => api.post(`${BANK}/vouchers`, { type: "fee", accountId, amount: "25", feeType: "eft", tax: "none", date });

describe("GG2 — Hafta Sonu ayarı iş günü hesabına bağlı (Benzer İşlem)", () => {
  let ctx;
  let account;
  before(async () => {
    ctx = await boot({ now: MONDAY });
    account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("Cumartesi ve Pazar (varsayılan): Cumartesi masrafı ile Pazartesi aynı masraf aynı iş günü → 409 bank-similar", async () => {
    await must("Cumartesi", fee(ctx.api, account.id, "2026-10-03"));
    expectStatus(await fee(ctx.api, account.id, "2026-10-05"), 409, "bank-similar", "Pazartesi");
  });

  it("Yalnız Pazar: Cumartesi iş günü; Cumartesi ↔ Pazartesi benzer değil, Pazar ↔ Pazartesi benzer", async () => {
    await must("ayar", ctx.api.put(`${BANK}/settings`, { values: { holidayAdvanced: { weekend: "sun" } } }));
    await must("Cumartesi", fee(ctx.api, account.id, "2026-10-10"));
    await must("Pazartesi (benzer değil)", fee(ctx.api, account.id, "2026-10-12"));
    const other = { ...{ type: "fee", accountId: account.id, amount: "30", feeType: "eft", tax: "none" } };
    await must("Pazar", ctx.api.post(`${BANK}/vouchers`, { ...other, date: "2026-10-04" }));
    expectStatus(await ctx.api.post(`${BANK}/vouchers`, { ...other, date: "2026-10-05" }), 409, "bank-similar", "Pazar ↔ Pazartesi");
  });

  it("etkisiz ve ertelenen ayarlar görünmez; Tatil yardımı olmayan listeyi anmaz", async () => {
    const view = await must("ayarlar", ctx.api.get(`${BANK}/settings`));
    const section = id => view.sections.find(item => item.id === id);
    const item = (id, key) => section(id).items.find(entry => entry.key === key);
    for (const id of ["fx", "fxAdvanced", "movement", "pos", "posAdvanced", "statement"]) assert.equal(section(id).available, false, `${id} bölümü görünmez`);
    for (const [id, key] of [["gl", "fxGain"], ["gl", "fxLoss"], ["other", "manualVoucher"]]) assert.equal(item(id, key).available, false, `${id}.${key} görünmez`);
    assert.equal(item("holidayAdvanced", "weekend").available, true, "Hafta Sonu görünür (bağlı)");
    assert.doesNotMatch(item("holiday", "calendar").help, /Tatiller listesi/);
  });
});

describe("GG2 — IBAN Faturada Gösterilsin", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: "2026-10-08T12:00:00+03:00" });
  });
  after(() => ctx.server.close());

  it("işaretli hesabın IBAN'ı satış faturasının satıcı banka listesinde; işaret kalkınca yeni faturada yok", async () => {
    const account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", iban: IBAN, showOnInvoice: true, opening: { date: "2026-10-01", amount: "0" } });
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    const sale = async () => {
      const created = await must("fatura", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: party.id, issueDate: "2026-10-08", lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
      return must("fatura kartı", ctx.api.get(`/api/workspace/invoices/${created.id}`));
    };
    const first = await sale();
    assert.deepEqual((first.seller?.banks || []).map(bank => bank.iban), [IBAN]);
    assert.equal(first.seller.banks[0].name, "Ziraat Bankası");
    await must("işareti kaldır", ctx.api.put(`${BANK}/accounts/${account.id}`, { showOnInvoice: false }));
    const second = await sale();
    assert.deepEqual(second.seller?.banks || [], []);
    assert.deepEqual((await must("ilk fatura", ctx.api.get(`/api/workspace/invoices/${first.id}`))).seller.banks.map(bank => bank.iban), [IBAN], "kesilmiş faturanın kopyası değişmez");
  });
});

describe("GG2 — ertelenen döviz ve POS/Ekstre yetkileri görünmez", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: "2026-10-08T12:00:00+03:00" });
  });
  after(() => ctx.server.close());

  it("döviz hesabı açılmaz (400 bank-currency-later); TL hesap açılır", async () => {
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "USD", currency: "USD", kind: "fx", opening: { date: "2026-10-01", amount: "1.000", rate: "34,25" } }), 400, "bank-currency-later", "USD");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Dolar", currency: "USD", kind: "demand", opening: { date: "2026-10-01", amount: "0" } }), 400, "bank-currency-later", "USD vadesiz");
    const tl = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "TL", kind: "demand", opening: { date: "2026-10-01", amount: "0" } });
    expectStatus(await ctx.api.put(`${BANK}/accounts/${tl.id}`, { currency: "EUR" }), 400, "bank-currency-later", "TL → EUR");
  });

  it("Roller ekranında POS Tanımlama, Komisyon, Ekstre ve Mutabakat yok; özel rol düzenlenince kayıtlı değerleri kalır", async () => {
    const roles = await must("roller", ctx.api.get("/api/admin/roles"));
    const bankGroup = roles.groups.find(group => group.id === "bank");
    const keys = bankGroup.items.map(item => item.key);
    for (const hidden of ["bank.pos", "bank.commission", "bank.statement", "bank.reconcile"]) assert.ok(!keys.includes(hidden), `${hidden} görünmez`);
    assert.ok(keys.includes("bank.move") && keys.includes("bank.settings"));
    assert.doesNotMatch(bankGroup.items.find(item => item.key === "bank.transfer").help, /döviz/i);
    const role = await must("rol", ctx.api.post("/api/admin/roles", { name: "Banka Sorumlusu", permissions: ["bank.view", "bank.move", "bank.pos", "bank.statement"] }));
    const res = await ctx.api.client.patch(`/api/admin/roles/${role.id}`, { name: "Banka Sorumlusu", permissions: ["bank.view", "bank.move", "bank.cancel"] });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const stored = (await must("roller", ctx.api.get("/api/admin/roles"))).custom.find(item => item.key === role.id);
    assert.deepEqual(stored.permissions.filter(key => key !== "bank.granted").sort(), ["bank.cancel", "bank.move", "bank.pos", "bank.statement", "bank.view"]);
  });
});
