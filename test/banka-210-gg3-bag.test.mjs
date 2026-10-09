// 2.1.0 — Aşama 3–4 bağımsız gözden geçirme (GG2), ek kapsam: gözden geçirmenin "koddan var, ayrıca koşulmadı" dediği yollar.
//
// banka-210-gg2-bag cari hareketi, taksit tahsilatı, stok satışı ve Kasa ↔ Banka transferini sınıyordu. Gözden geçirme aynı kalıbın şu
// yollarda da olduğunu yazmıştı (çalıştırmadan): kayıt tahsilatının yolu (workspace.mjs PUT payments), kayıt ve taksit tahsilatının
// Silinenler'den geri yüklenmesi (trash.mjs payment / plan-entry), K4'ün kayıt tahsilatı, taksit tahsilatı ve Kasa ↔ Banka transferinde
// (bank.cancel / bank.move). Bu dosya onları gerçek uçlardan koşar.
// Bağımsız beklenen: her adımda Gerçek Banka (Genel Bakış) = hesap kartı = Hesaplar listesi = Alt Hesap Mizanı 102.01 = Hareketler'in
// yürüyen bakiyesi = testin kendi toplamı; Kasa (nakit) testin toplamı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin } from "./helpers.mjs";
import { apiOf, integrityOk } from "./banka-210-ortak.mjs";
import { BANK, bootBank, expectStatus, must, openAccount, subBalances } from "./banka-210-hesap-ortak.mjs";

const TL = 100;
async function agree(api, account, expected, label) {
  const summary = await must("özet", api.get(`${BANK}/summary`));
  const view = await must("hesap", api.get(`${BANK}/accounts/${account.id}`));
  const list = await must("hesaplar", api.get(`${BANK}/accounts`));
  const subs = await subBalances(api);
  const moves = await must("hareketler", api.get(`${BANK}/movements?account=${account.id}`));
  assert.equal(summary.realBank.minor, expected * TL, `${label}: Genel Bakış Gerçek Banka`);
  assert.equal(view.balanceMinor, expected * TL, `${label}: Hesap Detayı`);
  assert.equal(list.accounts.find(item => item.id === account.id).balanceMinor, expected * TL, `${label}: Hesaplar listesi`);
  assert.equal(Math.round((subs[account.glSub]?.balance || 0) * TL), expected * TL, `${label}: Alt Hesap Mizanı`);
  assert.equal(moves.rows[0]?.balanceAfterMinor, expected * TL, `${label}: Hareketler yürüyen bakiyesi (en yeni satır)`);
  await integrityOk(api, label);
}
const cashBalance = async api => (await must("Kasa", api.get("/api/workspace/cash"))).byMethod.cash;
const trashItem = async (api, kind) => {
  const trash = await must("Silinenler", api.get("/api/admin/trash"));
  const list = trash.items || trash.rows || trash;
  return (Array.isArray(list) ? list : []).find(item => item.kind === kind && !item.restoredAt);
};

describe("GG2 ek — kayıt ve taksit tahsilatı: yol değişimi, sil → geri yükle, K4", () => {
  let ctx;
  let api;
  let accountant;
  let account;
  let planId;
  const ids = {};
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    const matrix = [
      ["Ad Soyad", "Telefon", "Tutar"],
      ["Ayşe Kaya", "0532 444 55 66", "20.000"],
    ];
    const staged = await must("yükle", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: [{ name: "Okul", matrix }] }));
    await must("onayla", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const client = await loginAdmin(ctx.server);
    const rows = (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    const key = rows.find(row => row["Ad Soyad"] === "Ayşe Kaya").__hofKey;
    // Kayıt tahsilatları (havale): 2.500 (yolu sonra Nakit yapılacak), 1.500 (silinip geri yüklenecek), 1.000 (K4 denemeleri).
    ids.p1 = (await must("kayıt havale 1", api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "2.500", date: "2026-10-05", method: "bank", note: "Havale 1", caseTitle: "Ayşe Kaya" }))).id;
    ids.p2 = (await must("kayıt havale 2", api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "1.500", date: "2026-10-05", method: "bank", note: "Havale 2", caseTitle: "Ayşe Kaya" }))).id;
    ids.p3 = (await must("kayıt havale 3", api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "1.000", date: "2026-10-06", method: "bank", note: "Havale 3", caseTitle: "Ayşe Kaya" }))).id;
    // Taksit tahsilatı (havale) 2.000.
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    const plan = await must("taksit kartı", api.post("/api/workspace/plans", { accountId: party.id, name: "ABC Taksit", total: "12.000", mode: "auto", count: 6, firstDue: "2026-10-15" }));
    planId = plan.id;
    await must("taksit havale", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "2.000", itemId: plan.items[0].id, date: "2026-10-06", method: "bank" }));
    ids.planEntry = ctx.store.get("SELECT id FROM plan_entries WHERE plan_id = ? AND opening = 0", plan.id).id;
    // Kasa ↔ Banka transferi (Kasadan Bankaya 1.000; önce Kasa'ya nakit 5.000).
    await must("nakit", api.post("/api/workspace/cash", { kind: "in", amount: "5.000", method: "cash", date: "2026-10-02", description: "nakit" }));
    await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "1.000", date: "2026-10-03" }));
    ids.cashLeg = ctx.store.get("SELECT id FROM cash_entries WHERE transfer_id <> '' AND method = 'cash'").id;
    account = await openAccount(api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    const legacy = await must("eski", api.get(`${BANK}/legacy`));
    await must("Bu Hesaba Ata", api.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: legacy.rows.map(row => ({ table: row.table, id: row.id })) }));
    accountant = apiOf(await createUser(ctx.server, api.client, { username: "muhasebe2", role: "muhasebe" }));
    const users = await must("kullanıcılar", api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe2");
    assert.equal((await api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: ["records.delete"], remove: ["bank.cancel", "bank.move"] } })).status, 200);
  });
  after(() => ctx.server.close());

  it("hepsi bağlı: 100.000 + 2.500 + 1.500 + 1.000 + 2.000 + 1.000 = 108.000; Kasa 4.000", async () => {
    await agree(api, account, 108000, "bağlandıktan sonra");
    assert.equal(await cashBalance(api), 4000);
  });

  it("K4: bank.cancel/bank.move'u kaldırılmış muhasebe kayıt tahsilatını, taksit tahsilatını ve transferi silemez, parasını değiştiremez (403)", async () => {
    expectStatus(await accountant.del(`/api/workspace/payments/${ids.p3}`), 403, "bank-permission", "kayıt tahsilatı sil");
    expectStatus(await accountant.put(`/api/workspace/payments/${ids.p3}`, { amount: "100", date: "2026-10-06", method: "bank", note: "Havale 3" }), 403, "bank-permission", "kayıt tahsilatı tutar");
    expectStatus(await accountant.put(`/api/workspace/payments/${ids.p3}`, { amount: "1.000", date: "2026-10-06", method: "cash", note: "Havale 3" }), 403, "bank-permission", "kayıt tahsilatı yol");
    expectStatus(await accountant.del(`/api/workspace/plans/${planId}/entries/${ids.planEntry}`), 403, "bank-permission", "taksit tahsilatı sil");
    expectStatus(await accountant.put(`/api/workspace/plans/${planId}/entries/${ids.planEntry}`, { amount: "1.500" }), 403, "bank-permission", "taksit tahsilatı tutar");
    expectStatus(await accountant.del(`/api/workspace/cash/${ids.cashLeg}`), 403, "bank-permission", "Kasa ↔ Banka transferi sil");
    await agree(api, account, 108000, "reddedilen denemelerden sonra");
    assert.equal(await cashBalance(api), 4000);
    // Açıklama serbest.
    await must("açıklama", accountant.put(`/api/workspace/payments/${ids.p3}`, { amount: "1.000", date: "2026-10-06", method: "bank", note: "Ekim havalesi" }));
    assert.equal(ctx.store.get("SELECT note, fin_ref FROM payments WHERE id = ?", ids.p3).fin_ref, account.id);
  });

  it("kayıt tahsilatının yolu Nakit yapılınca bağ kalkar: hesap 105.500, Kasa 6.500", async () => {
    await must("yol nakit", api.put(`/api/workspace/payments/${ids.p1}`, { amount: "2.500", date: "2026-10-05", method: "cash", note: "Havale 1" }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM payments WHERE id = ?", ids.p1).fin_ref, "");
    await agree(api, account, 105500, "kayıt tahsilatı nakit");
    assert.equal(await cashBalance(api), 6500);
  });

  it("kayıt tahsilatı sil → geri yükle: bağ ve 105.500 korunur", async () => {
    await must("sil", api.del(`/api/workspace/payments/${ids.p2}`));
    await agree(api, account, 104000, "kayıt tahsilatı silindi");
    const item = await trashItem(api, "payment");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM payments WHERE id = ?", ids.p2).fin_ref, account.id);
    await agree(api, account, 105500, "kayıt tahsilatı geri yüklendi");
    assert.equal((await subBalances(api))["102.00"]?.balance || 0, 0);
  });

  it("taksit tahsilatı sil → geri yükle: bağ ve 105.500 korunur", async () => {
    await must("sil", api.del(`/api/workspace/plans/${planId}/entries/${ids.planEntry}`));
    await agree(api, account, 103500, "taksit tahsilatı silindi");
    const item = await trashItem(api, "plan-entry");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM plan_entries WHERE id = ?", ids.planEntry).fin_ref, account.id);
    await agree(api, account, 105500, "taksit tahsilatı geri yüklendi");
    assert.equal((await subBalances(api))["102.00"]?.balance || 0, 0);
  });

  it("bağlı satırın geri yüklenmesi bank.move ister: yetkisi kaldırılmış muhasebe 403, hiçbir şey yazılmaz", async () => {
    await must("sil", api.del(`/api/workspace/payments/${ids.p2}`));
    const item = await trashItem(api, "payment");
    const denied = await accountant.post("/api/admin/trash/restore", { id: item.id });
    // Silinenler yetkisi (records.delete) verildi: ret banka yetkisinden (bank.move) gelmeli, Silinenler yetkisinden değil.
    expectStatus(denied, 403, "bank-permission", "bağlı satırı geri yükleme");
    assert.equal(ctx.store.get("SELECT 1 AS found FROM payments WHERE id = ?", ids.p2), undefined);
    await agree(api, account, 104000, "reddedilen geri yüklemeden sonra");
    await must("yönetici geri yükler", api.post("/api/admin/trash/restore", { id: item.id }));
    await agree(api, account, 105500, "yönetici geri yükledi");
  });
});
