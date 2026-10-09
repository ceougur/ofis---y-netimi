// 2.1.0 Aşama 6 (daraltılmış) — Kasa ↔ Banka transferinde banka hesabı (plan §3.7 #10, §8.9 "Kasa", §3.9 K7, §3.10 K8, §12.3 Aşama 6,
// §12.5 kabul 13–14).
//
// Nasıl bozarım (önce yazıldı; testler buradan):
//   K1  İki hesap varken hesap seçmeden transfer → para hangi hesaptan? (400 bank-account-required); tek hesapta kendiliğinden
//   K2  Aynı istek iki kez (çift tıklama) → iki transfer? (tek transfer, replayed)
//   K3  USD hesaba / pasif hesaba transfer (400 bank-currency / 400 bank-account-invalid); açılıştan önceki tarih (409)
//   K4  "Transfer Yapma" yetkisi kaldırılmış Kasa yöneticisi transfer yapar (403); göçün verdiği muhasebe yapar (200); personel (403)
//   K5  Bankadan kasaya aktarımla Bakiye Doğrulandı hesabı eksiye düşür: Uyar (409 bank-negative → negativeOk 200), Engelle (409 bank-blocked)
//   K6  Kasadan bankaya yatırmayı sil → hesap eksiye düşer mi? (K7 sorar)
//   K7  Kasa penceresine banka satırı sızar mı? (yalnız nakit satır; Kasa "Bugün Giriş" nakit bacağı sayar)
//   K8  Kasa elle girişinde havale yolu (400 cash-method — mevcut kural)
//   K9  Transferi sil → Silinenler'den geri yükle → bağ kopar mı? (aynı hesap, aynı olay)
//   K10 Transferin hesabını düzeltmede Ziraat → Garanti taşı; bağsız eski transferin yalnız açıklamasını düzelt (bağsız kalır)
//   K11 Hiç banka hesabı yokken transfer (bugünkü davranış: 200, hesapsız)
//   K12 Aynı gün aynı tutarda ikinci transfer (aynı hesap) → Benzer İşlem (409 bank-similar; "Yine de Kaydet" 200)
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk, unwrap } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, must, openAcceptanceAccounts, openAccount } from "./banka-210-hesap-ortak.mjs";

const TL = 100;
const TRANSFER = "/api/workspace/cash/transfer";
const balanceOf = async (api, account) => (await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor / TL;
const cashOf = async api => must("Kasa", api.get("/api/workspace/cash"));

describe("Aşama 6 — kabul 13–14: Bankadan Kasaya Aktar 10.000 (Ziraat)", () => {
  let ctx;
  let acc;
  let transfer;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    // Kabul 9–12 (Aşama 5): ABC'den 20.000 havale Ziraat'e → 120.000.
    const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    await must("tahsilat", ctx.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "20.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
  });
  after(() => ctx.server.close());

  it("K1: iki hesapta hesap seçmeden → 400 bank-account-required; hiçbir şey yazılmaz", async () => {
    expectStatus(await ctx.api.post(TRANSFER, { direction: "to-cash", amount: "10.000", date: TODAY }), 400, "bank-account-required", "hesapsız");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM cash_entries").n, 0);
  });

  it("kabul 13–14: Ziraat 110.000, Garanti 50.000, Kasa 10.000; Kasa penceresinde yalnız nakit satırı; Kasa Bugün Giriş 10.000", async () => {
    transfer = await must("aktar", ctx.api.client.post(TRANSFER, { direction: "to-cash", amount: "10.000", date: TODAY, bankAccountId: acc.ziraat.id }, { "x-hof-request": "aktar0123456789abcdef" }).then(unwrap));
    assert.equal(await balanceOf(ctx.api, acc.ziraat), 110000);
    assert.equal(await balanceOf(ctx.api, acc.garanti), 50000);
    const cash = await cashOf(ctx.api);
    assert.equal(cash.byMethod.cash, 10000);
    assert.equal(cash.entries.length, 1);
    assert.ok(cash.entries.every(entry => entry.method === "cash"), "Kasa penceresinde yalnız nakit");
    const overview = await must("ANLIK DURUM", ctx.api.get("/api/workspace/overview"));
    assert.equal(overview.cash.cash?.today?.in ?? overview.cash.today?.in, 10000, "Kasa Bugün Giriş");
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.realBank.minor, 16_000_000, "Gerçek Banka 160.000 (110.000 + 50.000)");
    const moves = await must("hareketler", ctx.api.get(`${BANK}/movements?account=${acc.ziraat.id}`));
    const row = moves.rows.find(item => item.type === "cash_transfer");
    assert.ok(row, "Banka Hareketleri'nde transfer satırı");
    assert.equal(row.typeLabel, "Kasa ile Banka Arası");
    await integrityOk(ctx.api, "kabul 14");
  });

  it("K2: aynı istek kimliği → tek transfer (replayed)", async () => {
    const again = await must("yineleme", ctx.api.client.post(TRANSFER, { direction: "to-cash", amount: "10.000", date: TODAY, bankAccountId: acc.ziraat.id }, { "x-hof-request": "aktar0123456789abcdef" }).then(unwrap));
    assert.equal(again.replayed, true);
    assert.equal(again.id, transfer.id);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM cash_entries").n, 2);
    assert.equal(await balanceOf(ctx.api, acc.ziraat), 110000);
  });

  it("K12: aynı gün aynı tutar aynı hesap, yeni kimlik → 409 bank-similar; similarOk → 200", async () => {
    expectStatus(await ctx.api.post(TRANSFER, { direction: "to-cash", amount: "10.000", date: TODAY, bankAccountId: acc.ziraat.id }), 409, "bank-similar", "benzer");
    await must("Yine de Kaydet", ctx.api.post(TRANSFER, { direction: "to-cash", amount: "10.000", date: TODAY, bankAccountId: acc.ziraat.id, similarOk: true }));
    assert.equal(await balanceOf(ctx.api, acc.ziraat), 100000);
    assert.equal((await cashOf(ctx.api)).byMethod.cash, 20000);
  });

  it("K8: Kasa elle girişinde havale yolu → 400 cash-method", async () => {
    expectStatus(await ctx.api.post("/api/workspace/cash", { kind: "in", amount: "100", description: "x", method: "bank", date: TODAY }), 400, "cash-method", "elle havale");
  });

  it("K10: transferin hesabı düzeltmede Ziraat → Garanti taşınır (Ziraat 110.000, Garanti 40.000)", async () => {
    await must("taşı", ctx.api.put(`/api/workspace/cash/${transfer.id}`, { kind: "in", amount: "10.000", date: TODAY, description: "Bankadan Kasaya Aktarım", bankAccountId: acc.garanti.id }));
    assert.equal(await balanceOf(ctx.api, acc.ziraat), 110000);
    assert.equal(await balanceOf(ctx.api, acc.garanti), 40000);
    await integrityOk(ctx.api, "K10");
  });

  it("K9: transferi sil → Silinenler'den geri yükle → aynı hesap ve olay", async () => {
    const bankLeg = ctx.store.get("SELECT id, fin_ref, event_id FROM cash_entries WHERE transfer_id = ? AND method = 'bank'", transfer.transferId);
    await must("sil", ctx.api.del(`/api/workspace/cash/${transfer.id}`));
    assert.equal(await balanceOf(ctx.api, acc.garanti), 50000);
    const trash = await must("Silinenler", ctx.api.get("/api/admin/trash"));
    const list = trash.items || trash.rows || trash;
    const item = list.find(entry => entry.kind === "cash" && !entry.restoredAt);
    await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: item.id }));
    const back = ctx.store.get("SELECT fin_ref, event_id FROM cash_entries WHERE id = ?", bankLeg.id);
    assert.deepEqual([back.fin_ref, back.event_id], [acc.garanti.id, bankLeg.event_id]);
    assert.equal(await balanceOf(ctx.api, acc.garanti), 40000);
    await integrityOk(ctx.api, "K9");
  });
});

describe("Aşama 6 — hesap kuralları, yetki, K7", () => {
  let ctx;
  let a;
  before(async () => {
    ctx = await bootBank({ fxEnabled: true });
  });
  after(() => ctx.server.close());

  it("K11: hiç banka hesabı yokken transfer bugünkü gibi (200, hesapsız)", async () => {
    const res = await must("hesapsız", ctx.api.post(TRANSFER, { direction: "to-bank", amount: "1.000", date: "2026-10-05", cashForce: true }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM cash_entries WHERE id = ?", res.bankId).fin_ref, "");
  });

  it("K1b: tek hesapta seçim yapılmasa da kendiliğinden o hesap; K3: USD 400, pasif 400, açılıştan önce 409", async () => {
    a = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } });
    const res = await must("tek hesap", ctx.api.post(TRANSFER, { direction: "to-bank", amount: "500", date: TODAY, cashForce: true }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM cash_entries WHERE id = ?", res.bankId).fin_ref, a.id);
    const usd = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "USD", kind: "fx", currency: "USD" });
    expectStatus(await ctx.api.post(TRANSFER, { direction: "to-cash", amount: "10", date: TODAY, bankAccountId: usd.id }), 400, "bank-currency", "USD");
    const c = await openAccount(ctx.api, { bankName: "Akbank", name: "C", kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    await must("pasif", ctx.api.post(`${BANK}/accounts/${c.id}/status`, { status: "passive" }));
    expectStatus(await ctx.api.post(TRANSFER, { direction: "to-cash", amount: "10", date: TODAY, bankAccountId: c.id }), 400, "bank-account-invalid", "pasif");
    expectStatus(await ctx.api.post(TRANSFER, { direction: "to-cash", amount: "10", date: "2026-09-30", bankAccountId: a.id }), 409, "bank-before-opening", "açılıştan önce");
  });

  it("K10b: bağsız eski transferin yalnız açıklaması düzelir (bağsız kalır)", async () => {
    const old = ctx.store.get("SELECT c.id FROM cash_entries c WHERE c.method = 'cash' AND c.date = '2026-10-05'");
    await must("açıklama", ctx.api.put(`/api/workspace/cash/${old.id}`, { kind: "out", amount: "1.000", date: "2026-10-05", description: "Eski yatırma", cashForce: true }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM cash_entries WHERE transfer_id = (SELECT transfer_id FROM cash_entries WHERE id = ?) AND method = 'bank'", old.id).fin_ref, "");
  });

  it("K5: Uyar'da eksiye düşüren aktarım 409 bank-negative → negativeOk 200; Engelle 409 bank-blocked", async () => {
    // A: 5.000 açılış + 500 yatırma = 5.500
    const warn = await ctx.api.post(TRANSFER, { direction: "to-cash", amount: "6.000", date: TODAY, bankAccountId: a.id });
    expectStatus(warn, 409, "bank-negative", "Uyar");
    await must("Yine de Kaydet", ctx.api.post(TRANSFER, { direction: "to-cash", amount: "6.000", date: TODAY, bankAccountId: a.id, negativeOk: true }));
    assert.equal(await balanceOf(ctx.api, a), -500);
    await must("Engelle", ctx.api.put(`${BANK}/accounts/${a.id}`, { negativePolicy: "block" }));
    expectStatus(await ctx.api.post(TRANSFER, { direction: "to-cash", amount: "1", date: TODAY, bankAccountId: a.id, negativeOk: true }), 409, "bank-blocked", "Engelle");
    // Kasadan bankaya yatırma hesabı artırır: Engelle'de de geçer.
    await must("yatır", ctx.api.post(TRANSFER, { direction: "to-bank", amount: "2.000", date: TODAY, bankAccountId: a.id }));
    assert.equal(await balanceOf(ctx.api, a), 1500);
  });

  it("K6: kasadan bankaya yatırmayı silmek Engelle'deki hesabı eksiye düşürürse 409 bank-blocked", async () => {
    const id = ctx.store.get("SELECT id FROM cash_entries WHERE method = 'cash' AND kind = 'out' AND amount = 2000").id;
    expectStatus(await ctx.api.del(`/api/workspace/cash/${id}`), 409, "bank-blocked", "yatırmayı sil");
    assert.equal(await balanceOf(ctx.api, a), 1500);
    await integrityOk(ctx.api, "K6");
  });

  it("K4: Transfer Yapma'sı kaldırılmış muhasebe 403; göçün verdiği muhasebe 200; personel 403", async () => {
    const m1 = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" }));
    const m2 = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe2", role: "muhasebe" }));
    const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel1", role: "personel" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe1");
    assert.equal((await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.transfer"] } })).status, 200);
    expectStatus(await m1.post(TRANSFER, { direction: "to-bank", amount: "10", date: TODAY, bankAccountId: a.id }), 403, "bank-permission", "yetkisi kaldırılmış");
    await must("muhasebe2", m2.post(TRANSFER, { direction: "to-bank", amount: "10", date: TODAY, bankAccountId: a.id, cashForce: true, similarOk: true }));
    expectStatus(await staff.post(TRANSFER, { direction: "to-bank", amount: "10", date: TODAY, bankAccountId: a.id }), 403, "", "personel");
  });
});
