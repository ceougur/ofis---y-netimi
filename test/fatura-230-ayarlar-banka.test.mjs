// 2.3.0 İz 3.4 — Fatura Ayarları → Banka Hesapları (plan §8.9 E2.16 / #31) ve toplu kesimde belge başına ayrı bank.post (plan A7; eşleme 92, 175, 288, 289).
// Beklenenler plandan (kâhin): ilk banka hesabı açılana kadar Fatura Ayarları'ndaki eski liste (seller.banks) belgeye basılır ve düzenlenebilir;
// ilk hesap açıldıktan sonra liste YALNIZ "IBAN Faturada Gösterilsin" işaretli hesaplardan dolar, eski liste sihirbaz önerisine döner. Toplu kesimde
// 200 belge; kapıda düşen yalnız o belge; kesim sürerken başka kullanıcının tekil tahsilatı beklemez. Eski kodda (b24e0c2) KIRMIZI:
//   A2  hesap açıldıktan sonra eski liste belgeye basılmaya devam ediyordu (iki liste birleştiriliyordu); PUT eski listeyi değiştiriyordu; bankAccounts yoktu.
//   A3  göç v24 yoktu (eski listedeki IBAN'ı taşıyan hesap işaretlenmiyordu → hesap açılınca fatura bankasız kalırdı).
//   B2  toplu kesim sürerken tekil tahsilat toplu yanıtın sonuna kadar bekliyordu (döngü olay döngüsüne dönmüyordu).
// Sahte saat 08.10.2026 (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MIGRATIONS } from "../server/lib/migrations.mjs";
import { BANK, TODAY, bootBank, must, openAccount, trIban } from "./banka-210-hesap-ortak.mjs";

const INV = "/api/workspace/invoices";
const SET = `${INV}/settings`;
const IBAN_A = trIban(10, 1111111); // Ziraat (hesap olarak açılır)
const IBAN_B = trIban(62, 2222222); // eski listede kalır (hesap olarak açılmamış)
const IBAN_C = trIban(64, 3333333); // sonradan açılan, işaretsiz hesap
const normalize = iban => String(iban || "").replace(/\s+/g, "").toUpperCase();

async function world() {
  const ctx = await bootBank();
  const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  const item = await must("Ürün B", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "1000" }));
  return { ctx, api: ctx.api, abc, item };
}
const saleBody = (w, unitPrice, extra = {}) => ({ kind: "sale", accountId: w.abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: w.item.id, name: "Ürün B", qty: 1, unitPrice, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true, ...extra });
const sellerBanksOf = async (w, invoiceId) => (await must("belge", w.api.get(`${INV}/${invoiceId}`))).seller?.banks || [];
// Satıcı bilgisi belgeye KAYIT ANINDA yazılır (seller_json); sonraki değişiklik eski belgeyi değiştirmez → her denetim yeni belgeyle.
let seq = 0;
const freshBanks = async w => sellerBanksOf(w, (await must("fatura", w.api.post(INV, saleBody(w, 100 + (seq += 1))))).id);

describe("A — Fatura Ayarları → Banka Hesapları (E2.16 / #31): ilk hesap açılana kadar eski liste; sonra yalnız IBAN Faturada Gösterilsin işaretli hesaplar", () => {
  it("A1 hesap yokken: bankAccounts.active false; eski liste düzenlenir ve belgeye basılır", async () => {
    const w = await world();
    try {
      const before = await must("ayarlar", w.api.get(SET));
      assert.deepEqual(before.bankAccounts, { active: false, accounts: [], suggestions: [] }, "hesap yok: modül etkin değil");
      const saved = await must("eski liste", w.api.put(SET, { seller: { banks: [{ name: "Ziraat Bankası", iban: IBAN_A }, { name: "Garanti BBVA", iban: IBAN_B }] } }));
      assert.deepEqual(saved.seller.banks.map(bank => bank.iban), [IBAN_A, IBAN_B], "eski liste kaydedildi");
      assert.equal(saved.bankAccounts.active, false);
      const doc = await must("fatura", w.api.post(INV, saleBody(w, 100)));
      assert.deepEqual((await sellerBanksOf(w, doc.id)).map(bank => [bank.name, bank.iban]), [["Ziraat Bankası", IBAN_A], ["Garanti BBVA", IBAN_B]], "belgede eski liste");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("A2 ilk hesap açılınca: belgede yalnız işaretli hesap (eski listedeki B basılmaz); B öneriye döner; PUT eski listeyi değiştirmez; işaret kalkınca / hesap pasifken listeden düşer", async () => {
    const w = await world();
    try {
      await must("eski liste", w.api.put(SET, { seller: { banks: [{ name: "Ziraat Bankası", iban: IBAN_A }, { name: "Garanti BBVA", iban: IBAN_B }] } }));
      const ziraat = await openAccount(w.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: IBAN_A, showOnInvoice: true, opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
      const state = (await must("ayarlar", w.api.get(SET))).bankAccounts;
      assert.equal(state.active, true, "modül etkin");
      assert.deepEqual(state.accounts.map(row => [row.id, row.bankName, normalize(row.iban)]), [[ziraat.id, "Ziraat Bankası", IBAN_A]], "basılacak hesaplar: yalnız işaretli Ziraat");
      assert.deepEqual(state.suggestions.map(bank => bank.iban), [IBAN_B], "eski listede olup hesap olarak açılmamış: Garanti");
      const doc = await must("fatura", w.api.post(INV, saleBody(w, 100)));
      assert.deepEqual((await sellerBanksOf(w, doc.id)).map(bank => bank.iban), [IBAN_A], "belgede yalnız hesaptan gelen IBAN (eski listedeki B basılmaz)");
      // Eski liste artık düzenlenmez: gövdedeki yeni liste yok sayılır, önceki liste (öneri kaynağı) aynen kalır.
      const put = await must("PUT (yok sayılır)", w.api.put(SET, { seller: { banks: [{ name: "Yeni Banka", iban: IBAN_C }] } }));
      assert.deepEqual(put.seller.banks.map(bank => bank.iban), [IBAN_A, IBAN_B], "eski liste değişmedi");
      assert.deepEqual(put.bankAccounts.suggestions.map(bank => bank.iban), [IBAN_B]);
      // İşaretsiz ikinci hesap belgeye girmez; işaretlenince girer; hesap pasife alınınca düşer.
      const halk = await openAccount(w.api, { bankName: "Halkbank", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: IBAN_C, opening: { date: "2026-10-01", amount: "0", confirmed: true } });
      assert.deepEqual((await freshBanks(w)).map(bank => bank.iban), [IBAN_A], "işaretsiz hesap basılmaz");
      await must("işaretle", w.api.put(`${BANK}/accounts/${halk.id}`, { showOnInvoice: true }));
      assert.deepEqual((await freshBanks(w)).map(bank => bank.iban), [IBAN_A, IBAN_C], "işaretlenince yeni belgede");
      assert.deepEqual((await sellerBanksOf(w, doc.id)).map(bank => bank.iban), [IBAN_A], "kaydedilmiş eski belge değişmez (satıcı bilgisi kayıt anında yazılır)");
      await must("pasif", w.api.post(`${BANK}/accounts/${halk.id}/status`, { status: "passive" }));
      assert.deepEqual((await freshBanks(w)).map(bank => bank.iban), [IBAN_A], "pasif hesap basılmaz");
      await must("işareti kaldır", w.api.put(`${BANK}/accounts/${ziraat.id}`, { showOnInvoice: false }));
      assert.deepEqual(await freshBanks(w), [], "hiç işaretli hesap yoksa belgede banka yok (eski listeye dönülmez)");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("A3 göç v24: hiçbir hesap işaretli değilse eski listedeki IBAN'ı taşıyan hesaplar bir kez işaretlenir; işaretli hesap varsa dokunulmaz; silinmiş hesap işaretlenmez", async () => {
    const w = await world();
    try {
      const v24 = MIGRATIONS.find(item => item.version === 24);
      assert.ok(v24, "v24 göçü tanımlı");
      await must("eski liste", w.api.put(SET, { seller: { banks: [{ name: "Ziraat Bankası", iban: IBAN_A }, { name: "Garanti BBVA", iban: IBAN_B }] } }));
      const ziraat = await openAccount(w.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: IBAN_A, opening: { date: "2026-10-01", amount: "0", confirmed: true } });
      const halk = await openAccount(w.api, { bankName: "Halkbank", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: IBAN_C, opening: { date: "2026-10-01", amount: "0", confirmed: true } });
      const flags = () => Object.fromEntries(w.ctx.store.all("SELECT id, show_on_invoice AS flag FROM bank_accounts").map(row => [row.id, row.flag]));
      assert.deepEqual(flags(), { [ziraat.id]: 0, [halk.id]: 0 }, "göç öncesi hiçbiri işaretli değil");
      v24.up(w.ctx.store);
      assert.deepEqual(flags(), { [ziraat.id]: 1, [halk.id]: 0 }, "yalnız eski listedeki IBAN'ı taşıyan Ziraat işaretlendi");
      // İşaretli hesap varken yeniden koşarsa kullanıcı seçimine dokunmaz.
      await must("Ziraat işaretini kaldır, Halk işaretle", w.api.put(`${BANK}/accounts/${ziraat.id}`, { showOnInvoice: false }));
      await must("Halk işaretle", w.api.put(`${BANK}/accounts/${halk.id}`, { showOnInvoice: true }));
      v24.up(w.ctx.store);
      assert.deepEqual(flags(), { [ziraat.id]: 0, [halk.id]: 1 }, "işaretli hesap varken göç dokunmaz");
      // Eski liste boşsa hiçbir şey olmaz; para/defter değişmez.
      await must("Halk işaretini kaldır", w.api.put(`${BANK}/accounts/${halk.id}`, { showOnInvoice: false }));
      w.ctx.store.run("UPDATE settings SET value = ? WHERE key = 'invoice.settings'", JSON.stringify({ ...JSON.parse(w.ctx.store.get("SELECT value FROM settings WHERE key = 'invoice.settings'").value), seller: { banks: [] } }));
      v24.up(w.ctx.store);
      assert.deepEqual(flags(), { [ziraat.id]: 0, [halk.id]: 0 }, "eski liste boş: değişiklik yok");
      const check = await must("Mutabakat Testi", w.api.get("/api/workspace/ledger/integrity"));
      assert.equal(check.ok, true, JSON.stringify(check).slice(0, 300));
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("B — toplu kesim (plan A7; eşleme 92, 175, 289): 200 belge, her belge kendi işleminde; kapıda düşen yalnız o belge; kesim sürerken tekil tahsilat beklemez", () => {
  it("B1 200 taslak + 1 pasif hesaba bağlı taslak → 200 kesildi, 1 düştü (bank-account-invalid); öbürleri numaralı; mutabakat ok", async () => {
    const w = await world();
    try {
      const ziraat = await openAccount(w.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: IBAN_A, opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
      const halk = await openAccount(w.api, { bankName: "Halkbank", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: IBAN_C, opening: { date: "2026-10-01", amount: "0", confirmed: true } });
      const ids = [];
      for (let i = 0; i < 199; i += 1) {
        const draft = await must(`taslak ${i}`, w.api.post(INV, saleBody(w, 100 + i, { status: "draft", payment: { cash: [{ amount: 100 + i, method: "bank", bankAccountId: ziraat.id }], cheques: [], endorse: [], rest: "open" } })));
        ids.push(draft.id);
      }
      const bad = await must("pasif hesaplı taslak", w.api.post(INV, saleBody(w, 5000, { status: "draft", payment: { cash: [{ amount: 5000, method: "bank", bankAccountId: halk.id }], cheques: [], endorse: [], rest: "open" } })));
      ids.push(bad.id);
      await must("Halk pasif", w.api.post(`${BANK}/accounts/${halk.id}/status`, { status: "passive" }));
      const result = await must("toplu kesim", w.api.post(`${INV}/bulk-issue`, { ids, force: true }));
      assert.deepEqual([result.issued, result.failed], [199, 1], JSON.stringify(result.results.filter(item => !item.ok)).slice(0, 400));
      const failed = result.results.find(item => !item.ok);
      assert.deepEqual([failed.id, failed.code], [bad.id, "bank-account-invalid"], "yalnız pasif hesaplı belge düştü");
      assert.equal(w.ctx.store.get("SELECT status FROM invoices WHERE id = ?", bad.id).status, "draft", "düşen belge taslak kaldı");
      assert.equal(w.ctx.store.get("SELECT COUNT(*) AS n FROM invoices WHERE status = 'issued' AND number <> ''").n, 199, "199 belge numaralı");
      const sum = w.ctx.store.get("SELECT COALESCE(SUM(amount), 0) AS n FROM account_entries WHERE source = 'invoice' AND kind = 'in' AND fin_ref = ?", ziraat.id).n;
      assert.equal(Math.round(sum * 100), Array.from({ length: 199 }, (_, i) => 100 + i).reduce((a, b) => a + b, 0) * 100, "Ziraat'e 199 peşin");
      const check = await must("Mutabakat Testi", w.api.get("/api/workspace/ledger/integrity"));
      assert.equal(check.ok, true, JSON.stringify(check).slice(0, 300));
    } finally {
      await w.ctx.server.close();
    }
  });

  it("B2 toplu kesim (120 belge) sürerken başka kullanıcının tekil tahsilatı toplu yanıttan ÖNCE döner; her iki iş de yazılır", async () => {
    const w = await world();
    try {
      const ziraat = await openAccount(w.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: IBAN_A, opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
      const ids = [];
      for (let i = 0; i < 120; i += 1) ids.push((await must(`taslak ${i}`, w.api.post(INV, saleBody(w, 100 + i, { status: "draft", payment: { cash: [{ amount: 100 + i, method: "bank", bankAccountId: ziraat.id }], cheques: [], endorse: [], rest: "open" } })))).id);
      const order = [];
      const bulk = w.api.post(`${INV}/bulk-issue`, { ids, force: true }).then(res => (order.push("bulk"), res));
      // Toplu istek sunucuya ulaşsın (bağlantı kuruldu), sonra tekil tahsilat.
      await new Promise(resolve => setTimeout(resolve, 30));
      const single = w.api.post(`/api/workspace/accounts/${w.abc.id}/entries`, { kind: "in", method: "bank", amount: "77", date: TODAY, bankAccountId: ziraat.id }).then(res => (order.push("single"), res));
      const [bulkRes, singleRes] = await Promise.all([bulk, single]);
      assert.equal(singleRes.status, 200, JSON.stringify(singleRes.data).slice(0, 200));
      assert.equal(bulkRes.status, 200);
      assert.deepEqual([bulkRes.data.issued, bulkRes.data.failed], [120, 0], JSON.stringify(bulkRes.data.results.filter(item => !item.ok)).slice(0, 300));
      assert.deepEqual(order, ["single", "bulk"], "tekil tahsilat toplu kesimin sonunu beklemedi");
      assert.equal(w.ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND kind = 'in'", w.abc.id).n, 121, "120 peşin + 1 tekil tahsilat");
      const check = await must("Mutabakat Testi", w.api.get("/api/workspace/ledger/integrity"));
      assert.equal(check.ok, true, JSON.stringify(check).slice(0, 300));
    } finally {
      await w.ctx.server.close();
    }
  });
});
