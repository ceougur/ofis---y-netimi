// 2.1.0 — Yargıç ve Eleştirmen bulguları (kullanıcı isteği 09.10.2026: "yargıç ve eleştirmenden de geçsin"; karar: "plana uy her koşulda").
// Bulgular, plan maddesi ve sonuçlar: docs/2.1.0-KANIT.md → "Yargıç ve Eleştirmen Bulguları". Senaryolar bağımsız denetçilerin yeniden üretme
// betiklerinden (eleştirmen e1–e4, yargıç y1–y2) kalıcı teste çevrildi.
//   K1  Banka bağlı tahsilatı olan taksit KARTI silinmez (plan §3.8 "Taksit kartı", Aşama 8, Ek A 13): 409 plan-bank-linked, nedenli; önce
//       tahsilatlar silinir (bank.cancel, K7). Önceden kart silinince bağlı tahsilat sessizce hesaptan düşüyordu (Engelle'deki hesap eksiye,
//       bank.cancel'sız personel de silebiliyordu). Eski veride bağlı satırla silinmiş kartın geri yüklemesi K2'nin kapılarından geçer.
//   K2  Silinenler'den geri yükleme (plan §3.8 "Silinenler'den geri yükleme", §9.2/7, §3.9 K7): banka bağlı satırda kaynak modül yetkisi +
//       bank.move; K7 son durumla (Engelle 409 cash-blocked, Uyar 409 cash-negative → negativeOk); pasif hesap 400 (Hesabı Atanmamış'a
//       düşürülmez). Önceden Engelle'deki Ziraat −50.000'e düşüyordu, satır pasif hesaba geri bağlanıyordu.
//   Y1  Pasif hesabın bakiyesini değiştiren her işlem 400 bank-account-passive (silme, nakde çevirme, fatura iptal/sil/Düzenle'de satırın
//       kalkması ya da başka hesaba taşınması, geri yükleme); yalnız açıklama değişir. Önceden silme/taşıma serbestti.
//   K3  Toplu iptal gövdedeki negativeOk'u toplu silme gibi işler; Engelle hiçbir koşulda delinmez.
//   K4  Fatura peşininde yinelenen satır anahtarı (lineKey) 400 line-key-duplicate (önceden sessizce "a-1" yapılıyordu).
//   H3  Açılış öncesi tarihe taşıma (hesap kimliği gövdede yok) taksit, fatura Düzenle, stok ve Kasa transferinde 409 bank-before-opening.
//   D1  Engelle'deki hesaptan iki AYRI oturum ve bağlantıdan aynı anda iki ödeme (ikisi de sunucuya yanıttan önce ulaşır) → biri 409.
//   T1  Kasa ↔ Banka transferi Kasa modülünün ucudur: "1,005" bugünkü gibi 1,01'e yuvarlanır, iki bacak eşit (karar: KANIT); Banka Fişi 400.
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk, rawRun } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, must, openAcceptanceAccounts } from "./banka-210-hesap-ortak.mjs";

const INV = "/api/workspace/invoices";
const entries = id => `/api/workspace/accounts/${id}/entries`;
const balance = async (api, account) => (await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor / 100;
const setPolicy = (api, account, policy) => must(`politika ${policy}`, api.put(`${BANK}/accounts/${account.id}`, { negativePolicy: policy }));
const setStatus = (api, account, status) => must(`hesap ${status}`, api.post(`${BANK}/accounts/${account.id}/status`, { status }));
const sale = (accountId, amount, cash, extra = {}) => ({ kind: "sale", accountId, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: amount, discountRate: 0, vatRate: 0 }], payment: { cash, cheques: [], endorse: [], rest: "open" }, force: true, ...extra });
const trashId = (store, ref) => {
  const row = store.get("SELECT id FROM trash WHERE ref = ? AND restored_at IS NULL", ref);
  assert.ok(row, `Silinenler'de ${ref} yok`);
  return `trash:${row.id}`;
};
const restore = (api, id, extra = {}) => api.post("/api/admin/trash/restore", { id, ...extra });

async function setup() {
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  const seller = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
  /** Hesabın bakiyesini hedefe getirir (müşteriden tahsilat ya da tedarikçiye ödeme; Uyar'da negativeOk). */
  const level = async (account, target, note = "denge") => {
    const now = await balance(ctx.api, account);
    if (now < target) await must("denge +", ctx.api.post(entries(buyer.id), { kind: "in", amount: String(target - now).replace(".", ","), method: "bank", bankAccountId: account.id, date: TODAY, description: `${note} ${Math.random()}`, similarOk: true }));
    else if (now > target) await must("denge −", ctx.api.post(entries(seller.id), { kind: "out", amount: String(now - target).replace(".", ","), method: "bank", bankAccountId: account.id, date: TODAY, description: `${note} ${Math.random()}`, similarOk: true, negativeOk: true }));
    assert.equal(await balance(ctx.api, account), target);
  };
  return { ctx, acc, buyer, seller, level };
}
/** Banka yetkileri kişiden kaldırılmış kullanıcı (rol + kaldırılanlar). */
async function userWithout(ctx, username, role, remove) {
  const client = await createUser(ctx.server, ctx.api.client, { username, role });
  const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
  assert.equal((await ctx.api.client.patch(`/api/admin/users/${users.find(user => user.username === username).id}`, { grants: { add: [], remove } })).status, 200);
  return apiOf(client);
}

describe("K1: banka bağlı tahsilatı olan taksit kartı silinmez (plan §3.8, Aşama 8, Ek A 13)", () => {
  let s;
  let clerk;
  before(async () => {
    s = await setup();
    clerk = await userWithout(s.ctx, "muhasebe1", "muhasebe", ["bank.move", "bank.cancel"]);
  });
  after(() => s.ctx.server.close());

  it("Engelle'deki hesaba bağlı tahsilatlı kart: yönetici de, bank.cancel'sız personel de 409 plan-bank-linked; kart ve hesap yerinde; kartta Sil'in nedeni yazılı", async () => {
    const { ctx, acc, buyer, level } = s;
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: buyer.id, name: "ABC kart", total: "30.000", mode: "auto", count: 3, firstDue: "2026-10-15" }));
    await must("tahsilat", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "10.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    await must("nakit tahsilat", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1.000", method: "cash", date: TODAY }));
    await level(acc.garanti, 5000);
    await setPolicy(ctx.api, acc.garanti, "block");
    const admin = await ctx.api.del(`/api/workspace/plans/${plan.id}`);
    expectStatus(admin, 409, "plan-bank-linked", "yönetici kart sil");
    assert.match(admin.error, /banka hesabına bağlı/);
    assert.match(admin.error, /önce/i);
    expectStatus(await clerk.del(`/api/workspace/plans/${plan.id}`), 409, "plan-bank-linked", "personel kart sil");
    assert.equal(ctx.store.get("SELECT deleted_at AS d FROM plans WHERE id = ?", plan.id).d, null);
    assert.equal(await balance(ctx.api, acc.garanti), 5000);
    const detail = await must("kart ayrıntısı", ctx.api.get(`/api/workspace/plans/${plan.id}`));
    assert.match(detail.deleteBlock || "", /banka hesabına bağlı/);
    await integrityOk(ctx.api, "K1 engel");
  });

  it("bağlı tahsilatlar silinince (K7 ile: Engelle 409, Uyar → negativeOk) kart silinir; nakit tahsilat kartla birlikte düşer", async () => {
    const { ctx, acc } = s;
    const plan = ctx.store.get("SELECT id FROM plans WHERE name = 'ABC kart' AND deleted_at IS NULL");
    const bound = ctx.store.get("SELECT id FROM plan_entries WHERE plan_id = ? AND fin_ref <> ''", plan.id);
    expectStatus(await ctx.api.del(`/api/workspace/plans/${plan.id}/entries/${bound.id}`), 409, "cash-blocked", "Engelle tahsilat sil");
    await setPolicy(ctx.api, acc.garanti, "warn");
    expectStatus(await ctx.api.del(`/api/workspace/plans/${plan.id}/entries/${bound.id}`), 409, "cash-negative", "Uyar tahsilat sil");
    await must("Yine de Sil", ctx.api.del(`/api/workspace/plans/${plan.id}/entries/${bound.id}?negativeOk=1`));
    assert.equal(await balance(ctx.api, acc.garanti), -5000);
    const detail = await must("kart ayrıntısı", ctx.api.get(`/api/workspace/plans/${plan.id}`));
    assert.equal(detail.deleteBlock || "", "");
    await must("kartı sil", ctx.api.del(`/api/workspace/plans/${plan.id}?cashForce=1`));
    assert.ok(ctx.store.get("SELECT deleted_at AS d FROM plans WHERE id = ?", plan.id).d);
    assert.equal(await balance(ctx.api, acc.garanti), -5000);
    await s.level(acc.garanti, 50000);
    await integrityOk(ctx.api, "K1 sil");
  });

  it("eski veride bağlı tahsilatıyla silinmiş kartın geri yüklemesi: pasif hesap 400 (kart silinmiş kalır), bank.move'suz 403, etkin hesapla 200 ve hesap geri gelir", async () => {
    const { ctx, acc, buyer } = s;
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: buyer.id, name: "Eski kart", total: "6.000", mode: "auto", count: 2, firstDue: "2026-10-20" }));
    await must("tahsilat", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "2.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    // 2.1.0 öncesi kural: kart bağlı tahsilatıyla silinebiliyordu (eski sürümün yaptığı gibi yalnız kart başlığı; para satırı yerinde).
    rawRun(ctx.db, "UPDATE plans SET deleted_at = ?, deleted_by = 'eski-surum' WHERE id = ?", "2026-10-08T10:00:00.000Z", plan.id);
    assert.equal(await balance(ctx.api, acc.garanti), 50000);
    await setStatus(ctx.api, acc.garanti, "passive");
    try {
      const passive = await restore(ctx.api, `plan:${plan.id}`);
      expectStatus(passive, 400, "bank-account-passive", "pasif hesaba kart geri yükle");
      assert.match(passive.error, /pasif/);
      assert.match(passive.error, /Etkinleştir/);
      assert.ok(ctx.store.get("SELECT deleted_at AS d FROM plans WHERE id = ?", plan.id).d, "kart silinmiş kalır");
      assert.equal(ctx.store.get("SELECT fin_ref AS r FROM plan_entries WHERE plan_id = ?", plan.id).r, acc.garanti.id, "bağ düşürülmez");
    } finally {
      await setStatus(ctx.api, acc.garanti, "active");
    }
    const lawyer = await userWithout(ctx, "avukat1", "avukat", ["bank.move"]);
    expectStatus(await restore(lawyer, `plan:${plan.id}`), 403, "bank-permission", "bank.move'suz kart geri yükle");
    await must("kart geri yükle", restore(ctx.api, `plan:${plan.id}`));
    assert.equal(ctx.store.get("SELECT deleted_at AS d FROM plans WHERE id = ?", plan.id).d, null);
    assert.equal(await balance(ctx.api, acc.garanti), 52000);
    await integrityOk(ctx.api, "K1 geri");
  });
});

describe("K2: Silinenler'den geri yükleme K7'den, pasif hesap ve yetki kurallarından geçer (plan §3.8, §9.2/7, §3.9)", () => {
  let s;
  before(async () => {
    s = await setup();
  });
  after(() => s.ctx.server.close());

  it("bağlı cari ödemesi Engelle'deki hesaba geri yüklenemez (409 cash-blocked; satır ve Silinenler kaydı yerinde); Uyar 409 cash-negative → negativeOk 200", async () => {
    const { ctx, acc, seller, level } = s;
    const out = (await must("ödeme", ctx.api.post(entries(seller.id), { kind: "out", amount: "60.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, description: "geri yüklenecek" }))).entryId;
    await must("sil", ctx.api.del(`${entries(seller.id)}/${out}`));
    await level(acc.ziraat, 10000);
    await setPolicy(ctx.api, acc.ziraat, "block");
    const id = trashId(ctx.store, out);
    expectStatus(await restore(ctx.api, id), 409, "cash-blocked", "Engelle geri yükle");
    expectStatus(await restore(ctx.api, id, { negativeOk: true }), 409, "cash-blocked", "Engelle geri yükle (negativeOk geçmez)");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE id = ?", out).n, 0);
    assert.equal(await balance(ctx.api, acc.ziraat), 10000);
    await setPolicy(ctx.api, acc.ziraat, "warn");
    const warn = await restore(ctx.api, id);
    expectStatus(warn, 409, "cash-negative", "Uyar geri yükle");
    assert.match(warn.error, /Yine de/);
    await must("Yine de Geri Yükle", restore(ctx.api, id, { negativeOk: true }));
    assert.equal(ctx.store.get("SELECT fin_ref AS r FROM account_entries WHERE id = ?", out).r, acc.ziraat.id);
    assert.equal(await balance(ctx.api, acc.ziraat), -50000);
    await level(acc.ziraat, 100000);
    await integrityOk(ctx.api, "K2 cari");
  });

  it("stok alımı (bankadan peşin) ve Bankadan Kasaya transfer de: Engelle 409 cash-blocked, Uyar 409 cash-negative → negativeOk", async () => {
    const { ctx, acc, level } = s;
    const item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Ürün K2", unit: "Adet", openingQty: "10", unitPrice: "100" }));
    const move = await must("alım", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "5", unitPrice: "2.000", pay: "cash", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    await must("alımı sil", ctx.api.del(`/api/workspace/stock/${item.id}/moves/${move.moveId}`));
    const tr = await must("transfer", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "8.000", bankAccountId: acc.garanti.id, date: TODAY, description: "nakit çek" }));
    await must("transferi sil", ctx.api.del(`/api/workspace/cash/${tr.id}?cashForce=1`));
    await level(acc.garanti, 5000);
    await setPolicy(ctx.api, acc.garanti, "block");
    expectStatus(await restore(ctx.api, trashId(ctx.store, move.moveId)), 409, "cash-blocked", "Engelle stok alımı geri yükle");
    expectStatus(await restore(ctx.api, trashId(ctx.store, tr.id)), 409, "cash-blocked", "Engelle transfer geri yükle");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM stock_moves WHERE id = ?", move.moveId).n, 0);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE transfer_id = ?", tr.transferId).n, 0);
    await setPolicy(ctx.api, acc.garanti, "warn");
    expectStatus(await restore(ctx.api, trashId(ctx.store, tr.id)), 409, "cash-negative", "Uyar transfer geri yükle");
    await must("Yine de Geri Yükle (transfer)", restore(ctx.api, trashId(ctx.store, tr.id), { negativeOk: true }));
    assert.equal(await balance(ctx.api, acc.garanti), -3000);
    expectStatus(await restore(ctx.api, trashId(ctx.store, move.moveId)), 409, "cash-negative", "Uyar stok alımı geri yükle");
    await must("Yine de Geri Yükle (stok)", restore(ctx.api, trashId(ctx.store, move.moveId), { negativeOk: true }));
    assert.equal(await balance(ctx.api, acc.garanti), -13000);
    await level(acc.garanti, 50000);
    await integrityOk(ctx.api, "K2 stok/transfer");
  });

  it("pasif hesaba bağlı satır (cari, kayıt tahsilatı, taksit, Kasa transferi, stok satışı) geri yüklenmez: 400 bank-account-passive; Hesabı Atanmamış'a düşürülmez; Etkinleştir'den sonra aynı bağla döner", async () => {
    const { ctx, acc, buyer, level } = s;
    const made = [];
    const cari = (await must("cari", ctx.api.post(entries(buyer.id), { kind: "in", amount: "700", method: "bank", bankAccountId: acc.garanti.id, date: TODAY, description: "pasif geri" }))).entryId;
    await must("sil", ctx.api.del(`${entries(buyer.id)}/${cari}`));
    made.push({ id: cari, table: "account_entries" });
    const pay = await must("kayıt", ctx.api.post("/api/workspace/cases/K-7/payments", { amount: "300", date: TODAY, method: "bank", bankAccountId: acc.garanti.id, caseTitle: "K" }));
    await must("sil", ctx.api.del(`/api/workspace/payments/${pay.id}`));
    made.push({ id: pay.id, table: "payments" });
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: buyer.id, name: "Pasif kart", total: "3.000", mode: "auto", count: 1, firstDue: "2026-10-30" }));
    const pe = (await must("taksit", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "400", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }))).entryId;
    await must("sil", ctx.api.del(`/api/workspace/plans/${plan.id}/entries/${pe}`));
    made.push({ id: pe, table: "plan_entries" });
    await must("Kasa açılış", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "5.000", date: TODAY, description: "Açılış" }));
    const tr = await must("transfer", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "500", bankAccountId: acc.garanti.id, date: TODAY, description: "yatır" }));
    await must("sil", ctx.api.del(`/api/workspace/cash/${tr.id}`));
    made.push({ id: tr.id, table: "cash_entries", bound: tr.bankId });
    const item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Ürün P", unit: "Adet", openingQty: "10", unitPrice: "100" }));
    const mv = await must("satış", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "250", pay: "cash", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    await must("sil", ctx.api.del(`/api/workspace/stock/${item.id}/moves/${mv.moveId}`));
    made.push({ id: mv.moveId, table: "stock_moves" });
    const before = await balance(ctx.api, acc.garanti);
    await setStatus(ctx.api, acc.garanti, "passive");
    try {
      for (const row of made) {
        const res = await restore(ctx.api, trashId(ctx.store, row.id));
        expectStatus(res, 400, "bank-account-passive", `pasif ${row.table}`);
        assert.match(res.error, /pasif/);
        assert.equal(ctx.store.get(`SELECT COUNT(*) AS n FROM ${row.table} WHERE id = ?`, row.id).n, 0, `${row.table} yazılmadı`);
      }
      assert.equal(await balance(ctx.api, acc.garanti), before);
    } finally {
      await setStatus(ctx.api, acc.garanti, "active");
    }
    for (const row of made) {
      await must(`etkin ${row.table}`, restore(ctx.api, trashId(ctx.store, row.id)));
      assert.equal(ctx.store.get(`SELECT fin_ref AS r FROM ${row.table} WHERE id = ?`, row.bound || row.id).r, acc.garanti.id, `${row.table} aynı bağla`);
    }
    assert.equal(await balance(ctx.api, acc.garanti), before + 700 + 300 + 400 + 500 + 250);
    await level(acc.garanti, 50000);
    await integrityOk(ctx.api, "K2 pasif");
  });

  it("kaynak modül yetkisi: Kasa Yönetimi kaldırılmış (Silinenler ve bank.move yetkili) kişi bağlı Kasa transferini geri yükleyemez (403); bağsız satırda bugünkü kural", async () => {
    const { ctx, acc } = s;
    const lawyer = await userWithout(ctx, "avukat2", "avukat", ["cash.manage"]);
    const tr = await must("transfer", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "200", bankAccountId: acc.ziraat.id, date: TODAY, description: "yetki", cashForce: true }));
    await must("sil", ctx.api.del(`/api/workspace/cash/${tr.id}?cashForce=1`));
    const res = await restore(lawyer, trashId(ctx.store, tr.id));
    expectStatus(res, 403, "", "cash.manage'siz geri yükle");
    assert.match(res.error, /Kasa/);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE transfer_id = ?", tr.transferId).n, 0);
    const cash = await must("nakit", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "50", date: TODAY, description: "bağsız" }));
    await must("sil", ctx.api.del(`/api/workspace/cash/${cash.id}`));
    await must("bağsız geri yükle", restore(lawyer, trashId(ctx.store, cash.id)));
    await integrityOk(ctx.api, "K2 yetki");
  });
});

describe("Y1: pasif hesabın bakiyesini değiştiren her işlem 400 bank-account-passive; yalnız açıklama değişir", () => {
  let s;
  const fixture = {};
  before(async () => {
    s = await setup();
    const { ctx, acc, buyer } = s;
    const g = acc.garanti.id;
    fixture.cari = (await must("cari", ctx.api.post(entries(buyer.id), { kind: "in", amount: "800", method: "bank", bankAccountId: g, date: TODAY, description: "pasif" }))).entryId;
    fixture.cari2 = (await must("cari2", ctx.api.post(entries(buyer.id), { kind: "in", amount: "900", method: "bank", bankAccountId: g, date: TODAY, description: "pasif 2", similarOk: true }))).entryId;
    fixture.pay = (await must("kayıt", ctx.api.post("/api/workspace/cases/K-2/payments", { amount: "300", date: TODAY, method: "bank", bankAccountId: g, caseTitle: "K" }))).id;
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: buyer.id, name: "Y1 kart", total: "3.000", mode: "auto", count: 1, firstDue: "2026-10-30" }));
    fixture.plan = plan.id;
    fixture.pe = (await must("taksit", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "400", method: "bank", bankAccountId: g, date: TODAY }))).entryId;
    await must("Kasa açılış", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "5.000", date: TODAY, description: "Açılış" }));
    fixture.tr = await must("transfer", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "500", bankAccountId: g, date: TODAY, description: "yatır" }));
    const item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Ürün Y", unit: "Adet", openingQty: "10", unitPrice: "100" }));
    fixture.item = item.id;
    fixture.mv = (await must("satış", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "250", pay: "cash", method: "bank", bankAccountId: g, date: TODAY }))).moveId;
    const cheque = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "600", issueDate: TODAY, dueDate: "2026-12-31", drawer: "K", serialNo: "Y1-1" }));
    fixture.cheque = cheque.id;
    await must("tahsil", ctx.api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: TODAY, method: "bank", bankAccountId: g }));
    fixture.inv = await must("fatura", ctx.api.post(INV, sale(buyer.id, 3000, [{ amount: "3000", method: "bank", bankAccountId: g, lineKey: "k1" }])));
    fixture.inv2 = await must("fatura 2", ctx.api.post(INV, sale(buyer.id, 1500, [{ amount: "1500", method: "bank", bankAccountId: g, lineKey: "k1" }], { similarOk: true })));
    fixture.before = await balance(ctx.api, acc.garanti);
    await setStatus(ctx.api, acc.garanti, "passive");
  });
  after(() => s.ctx.server.close());

  const passive = (res, label) => {
    expectStatus(res, 400, "bank-account-passive", label);
    assert.match(res.error, /pasif/);
    assert.match(res.error, /Etkinleştir/);
  };

  it("silme ve nakde çevirme: cari, kayıt tahsilatı, taksit, Kasa transferi, stok, çek tahsilini geri alma → 400; satırlar yerinde", async () => {
    const { ctx, acc, buyer } = s;
    passive(await ctx.api.del(`${entries(buyer.id)}/${fixture.cari}`), "cari sil");
    passive(await ctx.api.put(`${entries(buyer.id)}/${fixture.cari}`, { kind: "in", amount: "800", method: "cash", date: TODAY }), "cari nakde çevir");
    passive(await ctx.api.del(`/api/workspace/payments/${fixture.pay}`), "kayıt tahsilatı sil");
    passive(await ctx.api.put(`/api/workspace/payments/${fixture.pay}`, { amount: "300", date: TODAY, method: "cash" }), "kayıt tahsilatı nakde çevir");
    passive(await ctx.api.del(`/api/workspace/plans/${fixture.plan}/entries/${fixture.pe}`), "taksit tahsilatı sil");
    passive(await ctx.api.del(`/api/workspace/cash/${fixture.tr.id}?cashForce=1`), "Kasa transferi sil");
    passive(await ctx.api.del(`/api/workspace/stock/${fixture.item}/moves/${fixture.mv}`), "stok satışı sil");
    passive(await ctx.api.put(`/api/workspace/stock/${fixture.item}/moves/${fixture.mv}`, { qty: "1", unitPrice: "250", pay: "none", date: TODAY }), "stok satışı açık hesaba");
    passive(await ctx.api.post(`/api/workspace/cheques/${fixture.cheque}/undo`, {}), "çek tahsilini geri al");
    for (const [table, id] of [["account_entries", fixture.cari], ["payments", fixture.pay], ["plan_entries", fixture.pe], ["cash_entries", fixture.tr.bankId], ["stock_moves", fixture.mv]]) {
      assert.equal(ctx.store.get(`SELECT fin_ref AS r FROM ${table} WHERE id = ?`, id)?.r, acc.garanti.id, `${table} yerinde ve bağlı`);
    }
    assert.equal(await balance(ctx.api, acc.garanti), fixture.before);
  });

  it("fatura: İptal Et, Sil ve Düzenle'de peşinin kalkması ya da başka hesaba taşınması → 400; yalnız not değişen Düzenle 200", async () => {
    const { ctx, acc, buyer } = s;
    passive(await ctx.api.post(`${INV}/${fixture.inv.id}/cancel`, { reason: "x", negativeOk: true }), "fatura iptal");
    passive(await ctx.api.del(`${INV}/${fixture.inv.id}?negativeOk=1`), "fatura sil");
    passive(await ctx.api.post(`${INV}/${fixture.inv.id}/edit`, sale(buyer.id, 3000, [{ amount: "3000", method: "bank", bankAccountId: acc.ziraat.id, lineKey: "k1" }])), "Düzenle: Ziraat'e taşı");
    passive(await ctx.api.post(`${INV}/${fixture.inv.id}/edit`, sale(buyer.id, 3000, [{ amount: "3000", method: "bank", lineKey: "YENI" }])), "Düzenle: satır anahtarı değişti, kimliksiz");
    passive(await ctx.api.post(`${INV}/${fixture.inv.id}/edit`, sale(buyer.id, 3000, [])), "Düzenle: peşin kalktı");
    const bulk = await must("toplu iptal", ctx.api.post(`${INV}/bulk-cancel`, { ids: [fixture.inv2.id], reason: "x", negativeOk: true }));
    assert.equal(bulk.results[0].ok, false);
    assert.equal(bulk.results[0].code, "bank-account-passive");
    assert.equal(ctx.store.get("SELECT status FROM invoices WHERE id = ?", fixture.inv.id).status, "issued");
    assert.equal(await balance(ctx.api, acc.garanti), fixture.before);
    await must("yalnız not", ctx.api.post(`${INV}/${fixture.inv.id}/edit`, sale(buyer.id, 3000, [{ amount: "3000", method: "bank", lineKey: "k1" }], { note: "Pasif hesapta yalnız not düzeldi" })));
    assert.equal(ctx.store.get("SELECT fin_ref AS r FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", fixture.inv.id).r, acc.garanti.id);
    assert.equal(await balance(ctx.api, acc.garanti), fixture.before);
  });

  it("açıklama değişir (cari ve kayıt tahsilatı); Etkinleştir'den sonra silme serbest; mutabakat tutarlı", async () => {
    const { ctx, acc, buyer } = s;
    await must("cari açıklama", ctx.api.put(`${entries(buyer.id)}/${fixture.cari2}`, { kind: "in", amount: "900", method: "bank", date: TODAY, note: "yalnız açıklama" }));
    assert.equal(ctx.store.get("SELECT note FROM account_entries WHERE id = ?", fixture.cari2).note, "yalnız açıklama");
    await must("kayıt açıklama", ctx.api.put(`/api/workspace/payments/${fixture.pay}`, { amount: "300", date: TODAY, method: "bank", note: "yalnız not" }));
    assert.equal(ctx.store.get("SELECT note FROM payments WHERE id = ?", fixture.pay).note, "yalnız not");
    await integrityOk(ctx.api, "Y1 pasif");
    await setStatus(ctx.api, acc.garanti, "active");
    await must("etkin hesapta sil", ctx.api.del(`${entries(buyer.id)}/${fixture.cari}`));
    assert.equal(await balance(ctx.api, acc.garanti), fixture.before - 800);
    await integrityOk(ctx.api, "Y1 etkin");
  });
});

describe("K3–K4: toplu iptal negativeOk; yinelenen satır anahtarı", () => {
  let s;
  before(async () => {
    s = await setup();
  });
  after(() => s.ctx.server.close());

  it("Uyar: toplu iptal ve toplu silme gövdedeki negativeOk ile geçer; Engelle ikisinde de 409 cash-blocked kalır", async () => {
    const { ctx, acc, buyer, level } = s;
    const z = acc.ziraat.id;
    const d1 = await must("f1", ctx.api.post(INV, sale(buyer.id, 7000, [{ amount: "7000", method: "bank", bankAccountId: z }])));
    const d2 = await must("f2", ctx.api.post(INV, sale(buyer.id, 7100, [{ amount: "7100", method: "bank", bankAccountId: z }], { similarOk: true })));
    await level(acc.ziraat, 1000);
    await setPolicy(ctx.api, acc.ziraat, "block");
    for (const url of [`${INV}/bulk-cancel`, `${INV}/bulk-delete`]) {
      const res = await must(url, ctx.api.post(url, { ids: [d1.id], reason: "x", negativeOk: true }));
      assert.deepEqual([res.results[0].ok, res.results[0].code], [false, "cash-blocked"], `${url} Engelle`);
    }
    await setPolicy(ctx.api, acc.ziraat, "warn");
    const ask = await must("toplu iptal sorusuz", ctx.api.post(`${INV}/bulk-cancel`, { ids: [d1.id], reason: "x" }));
    assert.deepEqual([ask.results[0].ok, ask.results[0].code], [false, "cash-negative"]);
    const cancelled = await must("toplu iptal negativeOk", ctx.api.post(`${INV}/bulk-cancel`, { ids: [d1.id], reason: "x", negativeOk: true }));
    assert.equal(cancelled.results[0].ok, true, JSON.stringify(cancelled.results[0]));
    assert.equal(await balance(ctx.api, acc.ziraat), -6000);
    const deleted = await must("toplu sil negativeOk", ctx.api.post(`${INV}/bulk-delete`, { ids: [d2.id], reason: "x", negativeOk: true }));
    assert.equal(deleted.results[0].ok, true, JSON.stringify(deleted.results[0]));
    assert.equal(await balance(ctx.api, acc.ziraat), -13100);
    await level(acc.ziraat, 100000);
    await integrityOk(ctx.api, "K3");
  });

  it("fatura peşininde iki satıra aynı lineKey → 400 line-key-duplicate (yeni kayıtta ve Düzenle'de); belge ve hesaplar değişmez", async () => {
    const { ctx, acc, buyer } = s;
    const z = await balance(ctx.api, acc.ziraat);
    const g = await balance(ctx.api, acc.garanti);
    const count = ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n;
    const dup = [{ amount: "1000", method: "bank", bankAccountId: acc.ziraat.id, lineKey: "a" }, { amount: "2000", method: "bank", bankAccountId: acc.garanti.id, lineKey: "a" }];
    const res = await ctx.api.post(INV, sale(buyer.id, 3000, dup));
    expectStatus(res, 400, "line-key-duplicate", "yeni kayıt");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n, count);
    const doc = await must("tekil anahtarlı", ctx.api.post(INV, sale(buyer.id, 3000, [{ ...dup[0], lineKey: "a" }, { ...dup[1], lineKey: "b" }])));
    expectStatus(await ctx.api.post(`${INV}/${doc.id}/edit`, sale(buyer.id, 3000, [{ ...dup[1], lineKey: "a" }, { ...dup[0], lineKey: "a" }])), 400, "line-key-duplicate", "Düzenle");
    assert.deepEqual(JSON.parse(ctx.store.get("SELECT payment_json AS p FROM invoices WHERE id = ?", doc.id).p).cash.map(item => item.lineKey), ["a", "b"]);
    assert.equal(await balance(ctx.api, acc.ziraat), z + 1000);
    assert.equal(await balance(ctx.api, acc.garanti), g + 2000);
    // Anahtarsız satırlar (eski istemci) sunucuda tekil anahtar alır.
    const legacy = await must("anahtarsız", ctx.api.post(INV, sale(buyer.id, 3000, [{ amount: "1000", method: "cash" }, { amount: "2000", method: "cash" }], { similarOk: true })));
    const keys = JSON.parse(ctx.store.get("SELECT payment_json AS p FROM invoices WHERE id = ?", legacy.id).p).cash.map(item => item.lineKey);
    assert.equal(new Set(keys).size, 2);
    await integrityOk(ctx.api, "K4");
  });
});

describe("H3 kardeşleri: açılış öncesi tarihe taşıma (hesap kimliği gövdede yok) → 409 bank-before-opening; satır değişmez", () => {
  let s;
  before(async () => {
    s = await setup();
  });
  after(() => s.ctx.server.close());

  it("taksit tahsilatı", async () => {
    const { ctx, acc, seller } = s;
    const plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: seller.id, name: "XYZ kart", total: "3.000", mode: "auto", count: 1, firstDue: "2026-10-15" }));
    const en = (await must("tahsilat", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1.000", method: "bank", bankAccountId: acc.ziraat.id, date: "2026-10-05" }))).entryId;
    expectStatus(await ctx.api.put(`/api/workspace/plans/${plan.id}/entries/${en}`, { kind: "in", amount: "1.000", method: "bank", date: "2026-09-20" }), 409, "bank-before-opening", "taksit");
    assert.deepEqual({ ...ctx.store.get("SELECT date, fin_ref AS ref FROM plan_entries WHERE id = ?", en) }, { date: "2026-10-05", ref: acc.ziraat.id });
  });

  it("fatura Düzenle (tarih açılış öncesine; peşin satırın hesabı gövdede yok)", async () => {
    const { ctx, acc, buyer } = s;
    const body = issueDate => sale(buyer.id, 1000, [{ amount: "1000", method: "bank", lineKey: "k1" }], { issueDate });
    const doc = await must("fatura", ctx.api.post(INV, { ...body("2026-10-05"), payment: { cash: [{ amount: "1000", method: "bank", bankAccountId: acc.ziraat.id, lineKey: "k1" }], cheques: [], endorse: [], rest: "open" } }));
    expectStatus(await ctx.api.post(`${INV}/${doc.id}/edit`, body("2026-09-20")), 409, "bank-before-opening", "fatura Düzenle");
    assert.equal(ctx.store.get("SELECT issue_date AS d FROM invoices WHERE id = ?", doc.id).d, "2026-10-05");
    assert.equal(ctx.store.get("SELECT fin_ref AS r FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", doc.id).r, acc.ziraat.id);
  });

  it("stok peşin satışı", async () => {
    const { ctx, acc } = s;
    const item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Ürün X", unit: "Adet", openingQty: "10", unitPrice: "100" }));
    const mv = await must("satış", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "200", pay: "cash", method: "bank", bankAccountId: acc.ziraat.id, date: "2026-10-05" }));
    expectStatus(await ctx.api.put(`/api/workspace/stock/${item.id}/moves/${mv.moveId}`, { qty: "1", unitPrice: "200", pay: "cash", method: "bank", date: "2026-09-20" }), 409, "bank-before-opening", "stok");
    assert.deepEqual({ ...ctx.store.get("SELECT date, fin_ref AS ref FROM stock_moves WHERE id = ?", mv.moveId) }, { date: "2026-10-05", ref: acc.ziraat.id });
  });

  it("Kasa ↔ Banka transferi", async () => {
    const { ctx, acc } = s;
    await must("Kasa açılış", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "5000", date: "2026-10-01", description: "Açılış" }));
    const tr = await must("transfer", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "500", bankAccountId: acc.ziraat.id, date: "2026-10-05", description: "yatır" }));
    expectStatus(await ctx.api.put(`/api/workspace/cash/${tr.id}`, { kind: "out", amount: "500", date: "2026-09-20", description: "yatır", cashForce: true }), 409, "bank-before-opening", "transfer");
    assert.deepEqual({ ...ctx.store.get("SELECT date, fin_ref AS ref FROM cash_entries WHERE id = ?", tr.bankId) }, { date: "2026-10-05", ref: acc.ziraat.id });
    await integrityOk(ctx.api, "H3 kardeşleri");
  });
});

/** Ayrı TCP bağlantısıyla (keep-alive yok, ayrı ajan) JSON isteği; gönderim ve yanıt anları ölçülür. */
function rawRequest(base, cookie, method, path, body) {
  const url = new URL(base + path);
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, path: url.pathname, method, agent: false, headers: { cookie, "content-type": "application/json", "content-length": Buffer.byteLength(payload), connection: "close" } }, res => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", chunk => (text += chunk));
      res.on("end", () => {
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
        resolve({ status: res.statusCode, code: data?.code || "", received: process.hrtime.bigint(), data });
      });
    });
    req.on("error", reject);
    req.end(payload);
  });
}

describe("D1: Engelle'deki hesaptan iki ayrı oturumdan, iki ayrı bağlantıyla aynı anda iki ödeme", () => {
  let s;
  before(async () => {
    s = await setup();
  });
  after(() => s.ctx.server.close());

  it("iki istek de ilk yanıttan önce gönderilir; biri 200, öbürü 409 cash-blocked; hesap eksiye düşmez; mutabakat tutarlı", async () => {
    const { ctx, acc, seller } = s;
    await setPolicy(ctx.api, acc.ziraat, "block");
    const z = await balance(ctx.api, acc.ziraat);
    const part = Math.round(z * 0.6);
    // İki ayrı oturum (iki ayrı giriş çerezi) ve iki ayrı TCP bağlantısı.
    const second = await createUser(ctx.server, ctx.api.client, { username: "ikinci", role: "admin" });
    const base = ctx.server.base;
    const cookies = [ctx.api.client.cookie, second.cookie];
    assert.ok(cookies[0] && cookies[1] && cookies[0] !== cookies[1], "iki ayrı oturum");
    const sent = [];
    const results = await Promise.all(
      [1, 2].map(i => {
        const call = rawRequest(base, cookies[i - 1], "POST", entries(seller.id), { kind: "out", amount: String(part + i), method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, description: `yarış ${i}` });
        sent.push(process.hrtime.bigint());
        return call;
      }),
    );
    const firstReply = results.map(res => res.received).sort((a, b) => (a < b ? -1 : 1))[0];
    assert.ok(sent.every(at => at < firstReply), "iki istek de ilk yanıttan önce gönderildi");
    // Sunucu tek süreçtir; iki istek BEGIN IMMEDIATE işleminde sıraya girer ve ikincisi birincinin yazdığı bakiyeyi görür.
    assert.deepEqual(results.map(res => res.status).sort(), [200, 409]);
    assert.equal(results.find(res => res.status === 409).code, "cash-blocked");
    assert.ok((await balance(ctx.api, acc.ziraat)) >= 0);
    await setPolicy(ctx.api, acc.ziraat, "warn");
    await integrityOk(ctx.api, "D1");
  });
});

describe("T1: Kasa ↔ Banka transferi Kasa modülünün ucu (plan §3.7 #10, §5.1): \"1,005\" bugünkü gibi yuvarlanır; Banka Fişi 400", () => {
  let s;
  before(async () => {
    s = await setup();
  });
  after(() => s.ctx.server.close());

  it("transfer 1,005 → iki bacak 1,01; Banka Fişi 1,005 → 400 amount-precision; mutabakat tutarlı", async () => {
    const { ctx, acc } = s;
    const z = await balance(ctx.api, acc.ziraat);
    const tr = await must("transfer", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "1,005", bankAccountId: acc.ziraat.id, date: TODAY, description: "kuruş" }));
    assert.deepEqual(ctx.store.all("SELECT amount FROM cash_entries WHERE transfer_id = ? ORDER BY method", tr.transferId).map(row => row.amount), [1.01, 1.01]);
    assert.equal(await balance(ctx.api, acc.ziraat), Math.round((z - 1.01) * 100) / 100);
    expectStatus(await ctx.api.post(`${BANK}/vouchers`, { accountId: acc.ziraat.id, type: "fee", date: TODAY, amount: "1,005" }), 400, "amount-precision", "Banka Fişi");
    await integrityOk(ctx.api, "T1");
  });
});
