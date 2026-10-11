// 2.1.0 — Aşama 3–4 bağımsız gözden geçirme (GG2): banka hesabına bağlı modül satırının bağı (fin_ref) ve çapraz yetki (K4).
//
// Bulgular (doğrulandı):
//   - (yüksek) Bağlı havale satırının yolu Nakit ya da POS yapılınca bağ kalıyordu: tutar hem Kasa'da (ya da 108'de) hem hesabın kartında ve
//     Hareketler'de sayılıyordu (Hesaplar 104.000 ↔ Genel Bakış 100.000), Mutabakat Testi "tamam". Kural: yol hesabın türüne uymayan satırın
//     bağı aynı işlemde kalkar; kapı (bank:ref) hesaba bağlı satırın yolunu hesabın türüyle denetler.
//   - (orta) Silinenler'den geri yükleme ve Taksite Aktar (ve geri alması) bağı düşürüyordu: tutar hesaptan Hesabı Atanmamış'a geçiyordu (plan
//     §3.5 K13/7). Kural: satır kendi bağını taşır; hesap silinmişse (ya da yol/tarih uymuyorsa) bağsız döner ve kullanıcıya söylenir.
//   - (orta) K4 çapraz yetki modül ekranlarında çalışmıyordu: bank.cancel/bank.move'u kaldırılmış kişi bağlı satırı silebiliyor, tutarını ve
//     yolunu değiştirebiliyordu. Kural (plan §9.2/4): bağlı satırı silmek bank.cancel, parasını (tutar, tarih, yol, hesap) değiştirmek bank.move
//     ister — kişinin kendi girdiği satır da; yalnız açıklama değişimi modül yetkisiyle.
// Bağımsız beklenen: her adımda Gerçek Banka (Genel Bakış) = hesap kartı = Alt Hesap Mizanı 102.01 = testin kendi toplamı; Kasa testin toplamı.
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

describe("GG2 — bağlı satırın yolu banka dışına çıkınca bağ kalkar (cari, taksit, stok)", () => {
  let ctx;
  let party;
  let account;
  const ids = {};
  before(async () => {
    ctx = await bootBank({ bankPickLegacy: true });
    const api = ctx.api;
    party = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    ids.entry = (await must("cari havale", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "4.000", method: "bank", date: "2026-10-06" }))).entryId;
    const plan = await must("taksit kartı", api.post("/api/workspace/plans", { accountId: party.id, name: "ABC Taksit", total: "12.000", mode: "auto", count: 6, firstDue: "2026-10-15" }));
    ids.plan = plan.id;
    await must("taksit havale", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "2.000", itemId: plan.items[0].id, date: "2026-10-06", method: "bank" }));
    ids.planEntry = ctx.store.get("SELECT id FROM plan_entries WHERE plan_id = ? AND opening = 0", plan.id).id;
    const item = await must("ürün", api.post("/api/workspace/stock", { name: "Çay", unit: "kg", unitPrice: "100" }));
    ids.item = item.id || item.item?.id || ctx.store.get("SELECT id FROM stock_items WHERE name = 'Çay'").id;
    await must("havaleli satış", api.post(`/api/workspace/stock/${ids.item}/moves`, { kind: "out", qty: "5", unitPrice: "200", pay: "cash", method: "bank", date: "2026-10-06", force: true }));
    ids.move = ctx.store.get("SELECT id FROM stock_moves WHERE item_id = ? AND pay = 'cash'", ids.item).id;
    account = await openAccount(api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    const legacy = await must("eski", api.get(`${BANK}/legacy`));
    await must("Bu Hesaba Ata", api.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: legacy.rows.map(row => ({ table: row.table, id: row.id })) }));
  });
  after(() => ctx.server.close());

  it("üç satır bağlı: her ekranda 107.000", async () => {
    await agree(ctx.api, account, 107000, "bağlandıktan sonra");
  });

  it("cari satırı Nakit yapılınca bağ kalkar: hesap 103.000, Kasa 4.000", async () => {
    await must("yol nakit", ctx.api.put(`/api/workspace/accounts/${party.id}/entries/${ids.entry}`, { kind: "in", amount: "4.000", method: "cash" }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM account_entries WHERE id = ?", ids.entry).fin_ref, "");
    await agree(ctx.api, account, 103000, "cari nakit");
    assert.equal(await cashBalance(ctx.api), 4000);
  });

  it("taksit tahsilatı POS yapılınca bağ kalkar: hesap 101.000, 108.00 2.000", async () => {
    await must("yol POS", ctx.api.put(`/api/workspace/plans/${ids.plan}/entries/${ids.planEntry}`, { amount: "2.000", date: "2026-10-06", method: "card" }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM plan_entries WHERE id = ?", ids.planEntry).fin_ref, "");
    await agree(ctx.api, account, 101000, "taksit POS");
    assert.equal((await subBalances(ctx.api))["108.00"].balance, 2000);
  });

  it("stok satışı Nakit yapılınca bağ kalkar: hesap 100.000, Kasa 5.000", async () => {
    await must("yol nakit", ctx.api.put(`/api/workspace/stock/${ids.item}/moves/${ids.move}`, { qty: "5", unitPrice: "200", pay: "cash", method: "cash", date: "2026-10-06", force: true }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM stock_moves WHERE id = ?", ids.move).fin_ref, "");
    await agree(ctx.api, account, 100000, "stok nakit");
    assert.equal(await cashBalance(ctx.api), 5000);
  });

  it("kapı (bank:ref): yolu banka dışı satırın hesap bağı ham yazımla bile kalmaz → 409, hiçbir şey yazılmaz", async () => {
    const entry = (await must("yeni havale", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "1.000", method: "bank", date: "2026-10-07" }))).entryId;
    await must("ata", ctx.api.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: [{ table: "account_entries", id: entry }] }));
    let error = null;
    try {
      ctx.store.raw("test: yol değişimi", () => ctx.store.tx(() => ctx.store.run("UPDATE account_entries SET method = 'card' WHERE id = ?", entry)));
    } catch (caught) {
      error = caught;
    }
    assert.ok(error, "kapı reddetmeliydi");
    assert.equal(error.status, 409, `${error.status} ${error.message}`);
    assert.ok((error.extra?.failures || []).some(item => String(item.code).startsWith("bank:ref")), `bank:ref bekleniyordu: ${(error.extra?.failures || []).map(item => item.code).join(", ")}`);
    assert.equal(ctx.store.get("SELECT method FROM account_entries WHERE id = ?", entry).method, "bank");
  });
});

describe("GG2 — Silinenler'den geri yükleme ve Taksite Aktar bağı taşır", () => {
  let ctx;
  let party;
  let account;
  let entryId;
  let cashLeg;
  let api;
  const trashItem = async kind => {
    const trash = await must("Silinenler", api.get("/api/admin/trash"));
    const list = trash.items || trash.rows || trash;
    return (Array.isArray(list) ? list : []).find(item => item.kind === kind && !item.restoredAt);
  };
  before(async () => {
    ctx = await bootBank({ bankPickLegacy: true });
    api = ctx.api;
    party = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    entryId = (await must("havale", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "3.000", method: "bank", date: "2026-10-05", note: "eski havale" }))).entryId;
    await must("nakit", api.post("/api/workspace/cash", { kind: "in", amount: "5.000", method: "cash", date: "2026-10-02", description: "nakit" }));
    const transfer = await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "2.000", date: "2026-10-03" }));
    cashLeg = transfer.id || ctx.store.get("SELECT id FROM cash_entries WHERE transfer_id <> '' AND method = 'cash'").id;
    account = await openAccount(api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    const legacy = await must("eski", api.get(`${BANK}/legacy`));
    await must("ata", api.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: legacy.rows.map(row => ({ table: row.table, id: row.id })) }));
  });
  after(() => ctx.server.close());

  it("cari hareketi sil → geri yükle: bağ ve 105.000 korunur", async () => {
    await agree(api, account, 105000, "başlangıç");
    await must("sil", api.del(`/api/workspace/accounts/${party.id}/entries/${entryId}`));
    await agree(api, account, 102000, "silindikten sonra");
    const item = await trashItem("account-entry");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM account_entries WHERE id = ?", entryId).fin_ref, account.id);
    await agree(api, account, 105000, "geri yüklendikten sonra");
    assert.equal((await subBalances(api))["102.00"]?.balance || 0, 0);
  });

  it("Kasa ↔ Banka transferi sil → geri yükle: banka bacağının bağı korunur", async () => {
    await must("sil", api.del(`/api/workspace/cash/${cashLeg}`));
    const item = await trashItem("cash");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM cash_entries WHERE transfer_id <> '' AND method = 'bank'").fin_ref, account.id);
    await agree(api, account, 105000, "transfer geri yüklendikten sonra");
  });

  it("hesabı silinmiş bağlı satır geri yüklenince bağsız döner ve söylenir", async () => {
    const other = await openAccount(api, { bankName: "Garanti BBVA", name: "B Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "0" } });
    const id = (await must("havale", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "700", method: "bank", date: "2026-10-06" }))).entryId;
    await must("B'ye ata", api.post(`${BANK}/legacy/assign`, { accountId: other.id, rows: [{ table: "account_entries", id }] }));
    await must("sil", api.del(`/api/workspace/accounts/${party.id}/entries/${id}`));
    await must("B'yi sil", api.del(`${BANK}/accounts/${other.id}`));
    const item = await trashItem("account-entry");
    const restored = await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
    assert.match(restored.message, /Hesabı Atanmamış/);
    assert.equal(ctx.store.get("SELECT fin_ref FROM account_entries WHERE id = ?", id).fin_ref, "");
    await integrityOk(api, "silinmiş hesabın satırı geri yüklendi");
  });
});

describe("GG2 — Taksite Aktar ve geri alması bağı taşır", () => {
  let ctx;
  it("havale kayıt tahsilatı hesaba bağlı → Taksite Aktar → Geri Al: Gerçek Banka 102.500 kalır", async () => {
    ctx = await bootBank({ bankPickLegacy: true });
    const api = ctx.api;
    try {
      const matrix = [
        ["Ad Soyad", "Telefon", "Ağustos 2026 taksiti", "Eylül 2026 taksiti", "Ekim 2026 taksiti", "Kasım 2026 taksiti", "Toplam", "Ödenen"],
        ["Ayşe Kaya", "0532 444 55 66", "5.000", "5.000", "5.000", "5.000", "20.000", ""],
      ];
      const staged = await must("yükle", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "okul.xlsx", sheets: [{ name: "Okul", matrix }] }));
      await must("onayla", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
      const client = await loginAdmin(ctx.server);
      const rows = (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
      const key = rows.find(row => row["Ad Soyad"] === "Ayşe Kaya").__hofKey;
      const pay = await must("havale kayıt tahsilatı", api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "2.500", date: "2026-10-05", method: "bank", note: "Havale", caseTitle: "Ayşe Kaya" }));
      const account = await openAccount(api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
      const legacy = await must("eski", api.get(`${BANK}/legacy`));
      await must("ata", api.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: legacy.rows.map(row => ({ table: row.table, id: row.id })) }));
      await agree(api, account, 102500, "bağlı kayıt tahsilatı");
      const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
      const result = await must("Taksite Aktar", api.post("/api/workspace/plans/from-table", { keys: [key], fingerprint: preview.fingerprint }));
      assert.equal(result.paymentsMoved, 1);
      assert.equal(ctx.store.get("SELECT e.fin_ref FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE p.import_id = ? AND e.opening = 0", result.importId).fin_ref, account.id);
      await agree(api, account, 102500, "Taksite Aktar sonrası");
      await must("geri al", api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
      assert.equal(ctx.store.get("SELECT fin_ref FROM payments WHERE id = ?", pay.id).fin_ref, account.id);
      await agree(api, account, 102500, "geri alındıktan sonra");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("GG2 — K4: bağlı satırı silmek bank.cancel, parasını değiştirmek bank.move ister (kendi girdiği satır da)", () => {
  let ctx;
  let accountant;
  let party;
  let e1;
  let e2;
  let account;
  before(async () => {
    ctx = await bootBank({ bankPickLegacy: true });
    accountant = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe1");
    assert.equal((await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.cancel", "bank.move"] } })).status, 200);
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    e1 = (await must("havale 1 (muhasebe)", accountant.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "3.000", method: "bank", date: "2026-10-05" }))).entryId;
    e2 = (await must("havale 2 (muhasebe)", accountant.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "4.000", method: "bank", date: "2026-10-06" }))).entryId;
    account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    await must("ata", ctx.api.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: [{ table: "account_entries", id: e1 }, { table: "account_entries", id: e2 }] }));
  });
  after(() => ctx.server.close());

  it("yetkisi kaldırılmış muhasebe bağlı satırı silemez (403), tutarını/yolunu/tarihini değiştiremez (403); hiçbir şey değişmez", async () => {
    expectStatus(await accountant.del(`/api/workspace/accounts/${party.id}/entries/${e1}`), 403, "bank-permission", "sil");
    expectStatus(await accountant.put(`/api/workspace/accounts/${party.id}/entries/${e2}`, { kind: "in", amount: "400", method: "bank" }), 403, "bank-permission", "tutar");
    expectStatus(await accountant.put(`/api/workspace/accounts/${party.id}/entries/${e2}`, { kind: "in", amount: "4.000", method: "cash" }), 403, "bank-permission", "yol");
    expectStatus(await accountant.put(`/api/workspace/accounts/${party.id}/entries/${e2}`, { kind: "in", amount: "4.000", method: "bank", date: "2026-10-07" }), 403, "bank-permission", "tarih");
    await agree(ctx.api, account, 107000, "reddedilen denemelerden sonra");
  });

  it("açıklamasını değiştirebilir (200); yönetici siler (200)", async () => {
    await must("açıklama", accountant.put(`/api/workspace/accounts/${party.id}/entries/${e2}`, { kind: "in", amount: "4.000", method: "bank", note: "Ekim havalesi" }));
    assert.equal(ctx.store.get("SELECT note FROM account_entries WHERE id = ?", e2).note, "Ekim havalesi");
    await must("yönetici siler", ctx.api.del(`/api/workspace/accounts/${party.id}/entries/${e1}`));
    await agree(ctx.api, account, 104000, "yönetici sildikten sonra");
  });
});
