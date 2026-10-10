// 2.1.0 — Plan testlerinin eksiklerinin tamamlanması (docs/2.1.0-PLAN-TEST-ESLEME.md 161, 166, 176/17; plan §12.4 "Sıra", "Ad/kod",
// "Tutar/metin"). Hesaba bağlı (havale/EFT) para hareketiyle:
//   S1 (161) Önce cari / önce taksit / önce kayıt: aynı 3.000'lik borç ve aynı Ziraat havalesi üç farklı sırayla girilir — (a) cari → taksit
//      kartı → taksit tahsilatı; (b) taksit kartı (cari kendiliğinden açılır) → taksit tahsilatı; (c) tablodaki kayda havale tahsilatı →
//      Taksite Aktar (kart ve cari kayıttan; tahsilat karta taşınır). Üçünde de sonuç aynı: Ziraat +3.000 (bir kez), cari 0, kart Ödendi,
//      tek cari (çift cari yok), Alt Hesap Mizanı = defter, Kasa değişmez, Mutabakat Testi tutarlı.
//   S2 (166) Sil → aynı adla yeniden aç (cari): bağsız cari silinir, aynı adla yenisi açılır, yenisine Ziraat havalesi; eski cari Silinenler'den
//      geri yüklenince iki aynı adlı cari olur ve havale yalnız yenisinde kalır (hesap, olay, bakiye karışmaz).
//   S3 (176, 17) Modül uçlarında 2'den çok ondalık: plan §5.1'in "400" kuralı yalnız banka uçlarınındır (yargıç kararı, CLAUDE.md); modül uçları
//      bugünkü gibi yuvarlar — cari tahsilatı, taksit tahsilatı ve kayıt tahsilatı "1,005" havale → 1,01 TL ve hesap +1,01 (101 kuruş); Banka
//      Fişi "1,005" → 400 amount-precision.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin } from "./helpers.mjs";
import { integrityOk } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, must, openAcceptanceAccounts, subBalance } from "./banka-210-hesap-ortak.mjs";

const balanceOf = async (api, account) => (await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor;
const cashOf = async api => (await must("Kasa", api.get("/api/workspace/cash"))).summary?.balance;
const accountsNamed = (store, name) => store.all("SELECT id FROM accounts WHERE name = ? AND deleted_at IS NULL", name).map(row => row.id);

describe("S1 — önce cari / önce taksit / önce kayıt (hesaba bağlı havaleyle aynı sonuç)", () => {
  let ctx;
  let acc;
  let start;
  let cash;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    start = await balanceOf(ctx.api, acc.ziraat);
    cash = await cashOf(ctx.api);
  });
  after(() => ctx?.server.close());

  /** Kartın ve carinin son hâli: kart ödenmiş, kalan 0; cari 0; tahsilat Ziraat'e bağlı ve tek. */
  async function settled(planId, label) {
    const plan = await must("kart", ctx.api.get(`/api/workspace/plans/${planId}`));
    const accountId = plan.accountId || plan.plan?.accountId;
    assert.ok(accountId, `${label}: kartın carisi var`);
    const card = ctx.store.get("SELECT total, (SELECT COALESCE(SUM(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) FROM plan_entries WHERE plan_id = p.id) AS paid FROM plans p WHERE id = ?", planId);
    assert.equal(card.total, 3000, `${label}: kart toplamı`);
    assert.equal(card.paid, 3000, `${label}: kart ödendi`);
    const bound = ctx.store.all("SELECT fin_ref, amount, method FROM plan_entries WHERE plan_id = ?", planId);
    assert.deepEqual(bound.map(row => [row.fin_ref, row.amount, row.method]), [[acc.ziraat.id, 3000, "bank"]], `${label}: tek tahsilat, Ziraat'e bağlı`);
    const party = await must("cari", ctx.api.get(`/api/workspace/accounts/${accountId}`));
    assert.equal(party.totals.balance, 0, `${label}: cari bakiye 0`);
    return { accountId, name: party.account?.name || party.name };
  }

  it("(a) önce cari → kart → havale tahsilatı", async () => {
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Cari Önce", type: "customer", registeredOn: "2026-09-01" }));
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: party.id, name: "Cari Önce", total: "3.000", mode: "auto", count: 1, firstDue: TODAY, registeredOn: "2026-09-01" }));
    await must("tahsilat", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "3.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    await settled(plan.id, "önce cari");
    assert.equal(accountsNamed(ctx.store, "Cari Önce").length, 1, "tek cari");
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 300_000);
  });

  it("(b) önce taksit (cari kendiliğinden açılır) → havale tahsilatı", async () => {
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { name: "Taksit Önce", total: "3.000", mode: "auto", count: 1, firstDue: TODAY, registeredOn: "2026-09-01" }));
    await must("tahsilat", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "3.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    const { accountId } = await settled(plan.id, "önce taksit");
    assert.deepEqual(accountsNamed(ctx.store, "Taksit Önce"), [accountId], "kartın açtığı tek cari");
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 600_000);
  });

  it("(c) önce kayıt: tablodaki kayda havale tahsilatı → Taksite Aktar (kart + cari kayıttan; tahsilat karta taşınır, hesap bağı korunur)", async () => {
    const matrix = [
      ["Ad Soyad", "Telefon", "Ekim 2026 taksiti", "Kasım 2026 taksiti", "Toplam", "Ödenen"],
      ["Kayıt Önce", "0532 444 55 66", "1.500", "1.500", "3.000", ""],
    ];
    const staged = await must("yükle", ctx.api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "sira.xlsx", sheets: [{ name: "Sıra", matrix }] }));
    await must("onayla", ctx.api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const client = await loginAdmin(ctx.server);
    const rows = (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    const key = rows.find(row => row["Ad Soyad"] === "Kayıt Önce").__hofKey;
    const pay = await must("kayıt havalesi", ctx.api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "3.000", date: TODAY, method: "bank", bankAccountId: acc.ziraat.id, note: "Havale", caseTitle: "Kayıt Önce" }));
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 900_000, "kayıt tahsilatı Ziraat'e girdi");
    const eventBefore = ctx.store.get("SELECT event_id FROM payments WHERE id = ?", pay.id).event_id;
    const preview = await must("ön izleme", ctx.api.get("/api/workspace/plans/from-table"));
    const result = await must("Taksite Aktar", ctx.api.post("/api/workspace/plans/from-table", { keys: [key], fingerprint: preview.fingerprint }));
    assert.equal(result.paymentsMoved, 1, `tahsilat karta taşındı: ${JSON.stringify(result).slice(0, 600)} · ön izleme ${JSON.stringify(preview).slice(0, 600)}`);
    const planId = ctx.store.get("SELECT id FROM plans WHERE import_id = ?", result.importId).id;
    const { accountId } = await settled(planId, "önce kayıt");
    assert.deepEqual(accountsNamed(ctx.store, "Kayıt Önce"), [accountId], "kayıttan tek cari");
    assert.equal(ctx.store.get("SELECT event_id FROM plan_entries WHERE plan_id = ?", planId).event_id, eventBefore, "olay (İşlem No) aynı; para yeniden yazılmadı");
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 900_000, "Taksite Aktar Ziraat'i değiştirmez (çift sayım yok)");
  });

  it("son: Ziraat = açılış + 3 × 3.000; Alt Hesap Mizanı aynı; Kasa değişmedi; Mutabakat Testi tutarlı", async () => {
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 900_000);
    assert.equal(Math.round((await subBalance(ctx.api, acc.ziraat.glSub)) * 100), start + 900_000, "Alt Hesap Mizanı");
    assert.equal(await cashOf(ctx.api), cash, "Kasa (nakit) değişmedi");
    await integrityOk(ctx.api, "son");
  });
});

describe("S2 — cari sil → aynı adla yeniden aç → hesaba bağlı havale; eski cari geri yüklenince havale yenisinde kalır", () => {
  let ctx;
  let acc;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
  });
  after(() => ctx?.server.close());

  it("iki aynı adlı cari; Ziraat havalesi yalnız yeni caride; hesap ve olay karışmaz", async () => {
    const start = await balanceOf(ctx.api, acc.ziraat);
    const old = await must("eski cari", ctx.api.post("/api/workspace/accounts", { name: "Aynı Ad Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    await must("eski cari sil", ctx.api.del(`/api/workspace/accounts/${old.id}`));
    const fresh = await must("yeni cari (aynı ad)", ctx.api.post("/api/workspace/accounts", { name: "Aynı Ad Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    assert.notEqual(fresh.id, old.id, "yeni kimlik");
    await must("havale", ctx.api.post(`/api/workspace/accounts/${fresh.id}/entries`, { kind: "in", amount: "1.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 100_000);
    assert.ok(ctx.store.get("SELECT deleted_at FROM accounts WHERE id = ?", old.id).deleted_at, "eski cari silinmiş (Silinenler'de)");
    await must("eski cariyi geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `account:${old.id}` }));
    assert.deepEqual(accountsNamed(ctx.store, "Aynı Ad Ltd.").sort(), [old.id, fresh.id].sort(), "iki aynı adlı cari");
    const oldCard = await must("eski cari", ctx.api.get(`/api/workspace/accounts/${old.id}`));
    const freshCard = await must("yeni cari", ctx.api.get(`/api/workspace/accounts/${fresh.id}`));
    assert.equal(oldCard.totals.balance, 0, "eski caride hareket yok");
    assert.equal(freshCard.totals.balance, -1000, "havale yeni caride (alacaklı 1.000)");
    const bound = ctx.store.all("SELECT account_id, fin_ref FROM account_entries WHERE fin_ref = ?", acc.ziraat.id);
    assert.deepEqual(bound.map(row => row.account_id), [fresh.id], "Ziraat'e bağlı tek satır, yeni carinin");
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 100_000, "geri yükleme hesabı değiştirmedi");
    await integrityOk(ctx.api, "son");
  });
});

describe("S3 — modül uçlarında 3 ondalık bugünkü gibi yuvarlanır (1,005 → 1,01); Banka Fişi 400", () => {
  let ctx;
  let acc;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
  });
  after(() => ctx?.server.close());

  it("cari, taksit ve kayıt tahsilatı \"1,005\" havale → 1,01 TL; Ziraat her birinde +101 kuruş; Banka Fişi \"1,005\" → 400", async () => {
    const start = await balanceOf(ctx.api, acc.ziraat);
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Kuruş Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    await must("cari tahsilatı", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "1,005", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    assert.deepEqual(ctx.store.all("SELECT amount FROM account_entries WHERE account_id = ?", party.id).map(row => row.amount), [1.01], "cari tahsilatı 1,01");
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 101);
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: party.id, name: "Kuruş Kartı", total: "10", mode: "auto", count: 1, firstDue: TODAY, registeredOn: "2026-09-01" }));
    await must("taksit tahsilatı", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1,005", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, similarOk: true }));
    assert.equal(ctx.store.get("SELECT amount FROM plan_entries WHERE plan_id = ?", plan.id).amount, 1.01, "taksit tahsilatı 1,01");
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 202);
    const pay = await must("kayıt tahsilatı", ctx.api.post("/api/workspace/cases/KURUS-1/payments", { amount: "1,005", date: TODAY, method: "bank", bankAccountId: acc.ziraat.id, caseTitle: "Kuruş Kaydı", similarOk: true }));
    assert.equal(ctx.store.get("SELECT amount FROM payments WHERE id = ?", pay.id).amount, 1.01, "kayıt tahsilatı 1,01");
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 303);
    expectStatus(await ctx.api.post(`${BANK}/vouchers`, { type: "fee", accountId: acc.ziraat.id, date: TODAY, amount: "1,005", feeType: "eft", tax: "bsmv_incl" }), 400, "amount-precision", "Banka Fişi 1,005");
    assert.equal(await balanceOf(ctx.api, acc.ziraat), start + 303, "reddedilen fiş hesabı değiştirmedi");
    await integrityOk(ctx.api, "son");
  });
});
