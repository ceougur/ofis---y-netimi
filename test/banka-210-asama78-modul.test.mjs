// 2.1.0 Aşama 7–8 (daraltılmış: yalnız hesap seçimi) — fatura peşini, taksit tahsilatı, kayıt tahsilatı, stok peşini, çek tahsil/ödeme
// (plan §3.5 K13, §3.7 #4 ve #6–9, §3.8 "Fatura", §3.9 K7, §12.3 Aşama 7 ve 8 — "hesap alanı" kısmı).
//
// Nasıl bozarım (önce yazıldı; testler buradan):
//   F1  İki hesapta fatura peşini havale, hesap seçilmedi → para hangi hesaba? (400 bank-account-required "Banka hesabı seçilmedi"; belge yazılmaz)
//   F2  Seçilen hesaba yazılır mı, satır anahtarı (lineKey) saklanır mı? (Garanti +; payment_json'da lineKey ve hesap)
//   F3  Düzenle'de peşin satırların sırası değişir / ilki silinir → olaylar yanlış satıra geçer mi? (lineKey ile doğru: olay korunur/iptal)
//   F4  Düzenle'de alış peşinini Ziraat'ten Garanti'ye taşı → Garanti için K7 (Uyar 409 → negativeOk; Engelle 409 cash-blocked)
//   F5  İki hesap tanımlıyken eski (hesapsız) peşinli faturayı düzenle → yalnız not: bağsız kalır; tutar değişirse 400 hesap seç
//   F6  Toplu kesimde biri hesapsız → yalnız o "Banka hesabı seçilmedi" ile düşer, öbürleri kesilir
//   F7  Bankadan çıkış yetkisi (bank.move) olmayan muhasebe alış faturasını peşin havaleyle öder → 403 bank-permission
//   F8  Aynı gün aynı müşteriye aynı tutarda aynı hesaba ikinci peşinli fatura → gereksiz uyarı? (hedef fatura farklı: uyarısız, plan §3.10/2)
//   T1  Taksit tahsilatı havale, iki hesapta seçimsiz → 400; seçilen hesaba; aynı istek iki kez → tek satır (replayed); benzer → 409 bank-similar
//   T2  Bakiye Doğrulandı + Engelle hesapta tahsilatı silmek hesabı eksiye düşürür → 409 cash-blocked; Silinenler'den geri yükle → aynı fin_ref
//   T3  Eski bağsız taksit tahsilatının açıklaması → bağsız kalır; tutarı → 400 hesap seç
//   P1  Kayıt (detay kartı) tahsilatı: seçimsiz 400; Garanti; aynı istek iki kez → tek satır; sil → geri yükle → aynı hesap
//   S1  Stok peşin satış havale: seçimsiz 400; Ziraat +; peşin alım bank.move'suz 403; müşteri iadesi Engelle'deki hesabı eksiye düşürür → 409
//   C1  Çek tahsil havale: seçimsiz 400; Garanti +, olay fin_ref'li; tahsili geri al Engelle'de eksiye düşürür → 409; verilen çek ödemesi bank.move'suz 403
//   X   Nakit yolda hesap kimliği yok sayılır; tek hesapta kendiliğinden; döviz/pasif hesap 400 (pickRef ortak; cari testleri ayrıntılı)
// Bağımsız beklenen: her adımda hesap kartı = Alt Hesap Mizanı = testin kendi toplamı; mutabakat (Ana Defter kapısı) tutarlı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk, unwrap } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, must, openAcceptanceAccounts, openAccount, subBalances } from "./banka-210-hesap-ortak.mjs";

const TL = 100;
const INV = "/api/workspace/invoices";
const withId = (api, url, body, id) => api.client.post(url, body, { "x-hof-request": id }).then(unwrap);
async function balances(api, list) {
  const subs = await subBalances(api);
  const out = {};
  for (const [name, account] of Object.entries(list)) {
    const view = await must("hesap", api.get(`${BANK}/accounts/${account.id}`));
    assert.equal(Math.round((subs[account.glSub]?.balance || 0) * TL), view.balanceMinor, `${name}: Alt Hesap Mizanı = hesap kartı`);
    out[name] = view.balanceMinor / TL;
  }
  return out;
}
const setPolicy = (api, account, policy) => must(`politika ${policy}`, api.put(`${BANK}/accounts/${account.id}`, { negativePolicy: policy }));
const line = (unitPrice, name = "Hizmet") => [{ name, qty: 1, unitPrice, discountRate: 0, vatRate: 0 }];
const invoice = (accountId, kind, amount, cash, extra = {}) => ({ kind, accountId, issueDate: TODAY, pricesIncludeVat: true, number: kind === "purchase" ? `AL-${Math.random().toString(36).slice(2, 8)}` : undefined, lines: line(amount), payment: { cash, cheques: [], endorse: [], rest: "open" }, force: true, ...extra });
const cashRows = (store, invoiceId) => store.all("SELECT kind, amount, method, fin_ref AS finRef, event_id AS eventId FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out') ORDER BY rowid", invoiceId);
async function restoreLast(api, kind) {
  const trash = await must("Silinenler", api.get("/api/admin/trash"));
  const list = trash.items || trash.rows || trash;
  const item = list.find(entry => entry.kind === kind && !entry.restoredAt);
  assert.ok(item, `Silinenler'de ${kind}`);
  return must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
}
async function noBankMoveAccountant(ctx, username) {
  const api = apiOf(await createUser(ctx.server, ctx.api.client, { username, role: "muhasebe" }));
  const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
  const target = users.find(user => user.username === username);
  assert.equal((await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.move"] } })).status, 200);
  return api;
}

describe("Aşama 7 — fatura peşini: hesap seçimi, satır anahtarı, Düzenle, toplu kesim", () => {
  let ctx;
  let acc;
  let buyer;
  let seller;
  let legacy;
  before(async () => {
    ctx = await bootBank();
    buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    seller = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-10-01" }));
    // Hesap tanımlanmadan önce kesilmiş peşin havaleli fatura (eski sürüm verisi gibi: hesapsız).
    legacy = await must("eski fatura", ctx.api.post(INV, invoice(buyer.id, "sale", 3000, [{ amount: "3.000", method: "bank" }])));
    acc = await openAcceptanceAccounts(ctx.api);
  });
  after(() => ctx.server.close());

  it("F1: iki hesapta peşin havale hesap seçilmeden → 400 \"Banka hesabı seçilmedi\" (alan satırın hesabı); belge yazılmaz", async () => {
    const count = ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n;
    const res = await ctx.api.post(INV, invoice(buyer.id, "sale", 20000, [{ amount: "20.000", method: "bank" }]));
    expectStatus(res, 400, "bank-account-required", "hesapsız peşin");
    assert.match(res.error, /Banka hesabı seçilmedi: 1\. peşin satır/);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n, count);
  });

  it("F2: peşin havale Garanti → Garanti 50.000 + 20.000; satır anahtarı ve hesap payment_json'da; nakit satırdaki hesap yok sayılır", async () => {
    const doc = await must("fatura", ctx.api.post(INV, invoice(buyer.id, "sale", 21000, [{ amount: "20.000", method: "bank", bankAccountId: acc.garanti.id, lineKey: "k-garanti" }, { amount: "1.000", method: "cash", bankAccountId: acc.ziraat.id, lineKey: "k-nakit" }])));
    const rows = cashRows(ctx.store, doc.id);
    assert.deepEqual(rows.map(row => [row.method, row.finRef]), [["bank", acc.garanti.id], ["cash", ""]]);
    const pay = JSON.parse(ctx.store.get("SELECT payment_json AS j FROM invoices WHERE id = ?", doc.id).j);
    assert.deepEqual(pay.cash.map(item => [item.lineKey, item.bankAccountId || ""]), [["k-garanti", acc.garanti.id], ["k-nakit", ""]]);
    assert.deepEqual(Object.values(await balances(ctx.api, { ziraat: acc.ziraat, garanti: acc.garanti })), [100000, 70000]);
    await integrityOk(ctx.api, "F2");
  });

  it("F3: iki peşin satırın sırası değişir → olaylar satır anahtarıyla korunur; ilk satır silinir → yalnız onun olayı iptal", async () => {
    const doc = await must("fatura", ctx.api.post(INV, invoice(buyer.id, "sale", 3000, [{ amount: "1.000", method: "bank", bankAccountId: acc.ziraat.id, lineKey: "a" }, { amount: "1.000", method: "bank", bankAccountId: acc.garanti.id, lineKey: "b" }])));
    const before = cashRows(ctx.store, doc.id);
    const eventOf = (rows, ref) => rows.find(row => row.finRef === ref).eventId;
    const edited = invoice(buyer.id, "sale", 3000, [{ amount: "1.000", method: "bank", bankAccountId: acc.garanti.id, lineKey: "b" }, { amount: "1.000", method: "bank", bankAccountId: acc.ziraat.id, lineKey: "a" }], { note: "sıra değişti" });
    await must("sıra değişti", ctx.api.post(`${INV}/${doc.id}/edit`, edited));
    const swapped = cashRows(ctx.store, doc.id);
    assert.equal(eventOf(swapped, acc.ziraat.id), eventOf(before, acc.ziraat.id), "Ziraat satırının olayı korunur");
    assert.equal(eventOf(swapped, acc.garanti.id), eventOf(before, acc.garanti.id), "Garanti satırının olayı korunur");
    await must("ilk satır silindi", ctx.api.post(`${INV}/${doc.id}/edit`, invoice(buyer.id, "sale", 3000, [{ amount: "1.000", method: "bank", bankAccountId: acc.garanti.id, lineKey: "b" }])));
    const left = cashRows(ctx.store, doc.id);
    assert.deepEqual(left.map(row => [row.finRef, row.eventId]), [[acc.garanti.id, eventOf(before, acc.garanti.id)]]);
    assert.equal(ctx.store.get("SELECT status FROM fin_events WHERE id = ?", eventOf(before, acc.ziraat.id)).status, "cancelled");
    assert.deepEqual(Object.values(await balances(ctx.api, { ziraat: acc.ziraat, garanti: acc.garanti })), [100000, 71000]);
    await integrityOk(ctx.api, "F3");
  });

  it("F4: alış peşini Ziraat → Garanti taşınır: Garanti Uyar'da 409 cash-negative → negativeOk; Engelle'de 409 cash-blocked", async () => {
    const doc = await must("alış", ctx.api.post(INV, invoice(seller.id, "purchase", 80000, [{ amount: "80.000", method: "bank", bankAccountId: acc.ziraat.id, lineKey: "p1" }])));
    let b = await balances(ctx.api, { ziraat: acc.ziraat, garanti: acc.garanti });
    assert.deepEqual([b.ziraat, b.garanti], [20000, 71000]);
    const body = { ...invoice(seller.id, "purchase", 80000, [{ amount: "80.000", method: "bank", bankAccountId: acc.garanti.id, lineKey: "p1" }]), number: ctx.store.get("SELECT number FROM invoices WHERE id = ?", doc.id).number };
    const warn = await ctx.api.post(`${INV}/${doc.id}/edit`, body);
    expectStatus(warn, 409, "cash-negative", "Garanti Uyar");
    assert.deepEqual(cashRows(ctx.store, doc.id).map(row => row.finRef), [acc.ziraat.id], "yazılmadı");
    await setPolicy(ctx.api, acc.garanti, "block");
    expectStatus(await ctx.api.post(`${INV}/${doc.id}/edit`, { ...body, negativeOk: true }), 409, "cash-blocked", "Garanti Engelle");
    await setPolicy(ctx.api, acc.garanti, "warn");
    await must("Yine de Kaydet", ctx.api.post(`${INV}/${doc.id}/edit`, { ...body, negativeOk: true }));
    b = await balances(ctx.api, { ziraat: acc.ziraat, garanti: acc.garanti });
    assert.deepEqual([b.ziraat, b.garanti], [100000, -9000]);
    await integrityOk(ctx.api, "F4");
  });

  it("F5: eski (hesapsız) peşinli fatura: yalnız not düzelir → bağsız kalır; tutar değişirse 400 hesap seç; seçince bağlanır", async () => {
    const number = ctx.store.get("SELECT number FROM invoices WHERE id = ?", legacy.id).number;
    const body = (amount, extra = {}) => ({ ...invoice(buyer.id, "sale", amount, [{ amount: String(amount), method: "bank", ...extra }]), number });
    await must("yalnız not", ctx.api.post(`${INV}/${legacy.id}/edit`, { ...body(3000), note: "Eski fatura" }));
    assert.deepEqual(cashRows(ctx.store, legacy.id).map(row => row.finRef), [""], "bağsız kaldı");
    expectStatus(await ctx.api.post(`${INV}/${legacy.id}/edit`, body(2500)), 400, "bank-account-required", "tutar değişti");
    await must("hesap seçerek", ctx.api.post(`${INV}/${legacy.id}/edit`, body(2500, { bankAccountId: acc.ziraat.id })));
    assert.deepEqual(cashRows(ctx.store, legacy.id).map(row => row.finRef), [acc.ziraat.id]);
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, 102500);
    await integrityOk(ctx.api, "F5");
  });

  it("F6: toplu kesimde hesapsız taslak yalnız kendisi \"Banka hesabı seçilmedi\" ile düşer; öbürleri kesilir", async () => {
    const draft = cash => must("taslak", ctx.api.post(INV, { ...invoice(buyer.id, "sale", 500, cash), status: "draft" }));
    const ok1 = await draft([{ amount: "500", method: "cash" }]);
    const bad = await draft([{ amount: "500", method: "bank" }]);
    const ok2 = await draft([{ amount: "500", method: "bank", bankAccountId: acc.ziraat.id }]);
    const result = await must("toplu kes", ctx.api.post(`${INV}/bulk-issue`, { ids: [ok1.id, bad.id, ok2.id] }));
    const by = Object.fromEntries(result.results.map(item => [item.id, item]));
    assert.equal(result.issued, 2);
    assert.equal(by[bad.id].ok, false);
    assert.equal(by[bad.id].code, "bank-account-required");
    assert.match(by[bad.id].message, /Banka hesabı seçilmedi/);
    assert.equal(ctx.store.get("SELECT status FROM invoices WHERE id = ?", bad.id).status, "draft");
    assert.deepEqual(cashRows(ctx.store, ok2.id).map(row => row.finRef), [acc.ziraat.id]);
    await integrityOk(ctx.api, "F6");
  });

  it("F7: bank.move'u olmayan muhasebe alış faturasını peşin havaleyle ödeyemez (403); peşin nakitle öder (200)", async () => {
    const accountant = await noBankMoveAccountant(ctx, "muhasebe-f7");
    expectStatus(await accountant.post(INV, invoice(seller.id, "purchase", 100, [{ amount: "100", method: "bank", bankAccountId: acc.ziraat.id }])), 403, "bank-permission", "havale ödeme");
    await must("nakit", accountant.post(INV, { ...invoice(seller.id, "purchase", 100, [{ amount: "100", method: "cash" }]), cashForce: true }));
  });

  it("F8: aynı gün aynı müşteriye aynı tutarda Garanti peşinli iki AYRI fatura → hedef (fatura) farklı: Benzer İşlem sorulmaz, ikisi 200", async () => {
    const body = () => invoice(buyer.id, "sale", 777, [{ amount: "777", method: "bank", bankAccountId: acc.garanti.id }]);
    const before = (await balances(ctx.api, { garanti: acc.garanti })).garanti;
    await must("ilk", ctx.api.post(INV, body()));
    await must("ikinci (uyarısız)", ctx.api.post(INV, body()));
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, before + 1554);
    await integrityOk(ctx.api, "F8");
  });
});

describe("Aşama 8 — taksit tahsilatı ve kayıt (detay kartı) tahsilatı", () => {
  let ctx;
  let acc;
  let party;
  let plan;
  let legacyEntry;
  before(async () => {
    ctx = await bootBank();
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Beyza Ak", type: "customer", registeredOn: "2026-09-01" }));
    plan = await must("kart", ctx.api.post("/api/workspace/plans", { accountId: party.id, name: party.name, total: "30.000", mode: "auto", count: 3, firstDue: "2026-10-15" }));
    legacyEntry = (await must("eski tahsilat", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1.000", method: "bank", date: "2026-10-05" }))).entryId;
    acc = await openAcceptanceAccounts(ctx.api);
  });
  after(() => ctx.server.close());
  const entries = () => `/api/workspace/plans/${plan.id}/entries`;

  it("T1: seçimsiz 400; Ziraat'e 10.000; aynı istek iki kez → tek satır (replayed); farklı istek aynı tutar → 409 bank-similar", async () => {
    expectStatus(await ctx.api.post(entries(), { kind: "in", amount: "10.000", method: "bank", date: TODAY }), 400, "bank-account-required", "seçimsiz");
    const first = await must("tahsilat", withId(ctx.api, entries(), { kind: "in", amount: "10.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }, "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1"));
    assert.equal(ctx.store.get("SELECT fin_ref FROM plan_entries WHERE id = ?", first.entryId).fin_ref, acc.ziraat.id);
    const again = await must("yineleme", withId(ctx.api, entries(), { kind: "in", amount: "10.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }, "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1"));
    assert.equal(again.replayed, true);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE plan_id = ? AND amount = 10000", plan.id).n, 1);
    expectStatus(await withId(ctx.api, entries(), { kind: "in", amount: "10.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }, "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2"), 409, "bank-similar", "benzer");
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, 110000);
    const card = await must("kart", ctx.api.get(`/api/workspace/plans/${plan.id}`));
    assert.equal(card.entries.find(entry => entry.id === first.entryId).finRef, acc.ziraat.id, "kartta hesap");
    await integrityOk(ctx.api, "T1");
  });

  it("T2: Engelle'deki Garanti'ye bağlı tahsilatı silmek eksiye düşürür → 409 cash-blocked; Uyar'da sil → geri yükle → aynı fin_ref ve olay", async () => {
    const res = await must("Garanti tahsilat", ctx.api.post(entries(), { kind: "in", amount: "5.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    const xyz = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ", type: "supplier", registeredOn: "2026-10-01" }));
    await must("Garanti ödeme", ctx.api.post(`/api/workspace/accounts/${xyz.id}/entries`, { kind: "out", amount: "52.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, 3000);
    await setPolicy(ctx.api, acc.garanti, "block");
    expectStatus(await ctx.api.del(`${entries()}/${res.entryId}`), 409, "cash-blocked", "silme eksiye düşürür");
    await setPolicy(ctx.api, acc.garanti, "warn");
    expectStatus(await ctx.api.del(`${entries()}/${res.entryId}`), 409, "cash-negative", "Uyar");
    const row = ctx.store.get("SELECT event_id, fin_ref FROM plan_entries WHERE id = ?", res.entryId);
    await must("Yine de sil", ctx.api.del(`${entries()}/${res.entryId}?negativeOk=1`));
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, -2000);
    await restoreLast(ctx.api, "plan-entry");
    assert.deepEqual({ ...ctx.store.get("SELECT event_id, fin_ref FROM plan_entries WHERE id = ?", res.entryId) }, { ...row });
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, 3000);
    await integrityOk(ctx.api, "T2");
  });

  it("T3: eski bağsız taksit tahsilatı: açıklama → bağsız kalır; tutar → 400 hesap seç; bankadan iade bank.move'suz 403", async () => {
    await must("açıklama", ctx.api.put(`${entries()}/${legacyEntry}`, { amount: "1.000", method: "bank", date: "2026-10-05", note: "Eski havale" }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM plan_entries WHERE id = ?", legacyEntry).fin_ref, "");
    expectStatus(await ctx.api.put(`${entries()}/${legacyEntry}`, { amount: "1.200", method: "bank", date: "2026-10-05" }), 400, "bank-account-required", "tutar");
    const accountant = await noBankMoveAccountant(ctx, "muhasebe-t3");
    expectStatus(await accountant.post(entries(), { kind: "out", amount: "100", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }), 403, "bank-permission", "bankadan iade");
    await integrityOk(ctx.api, "T3");
  });

  it("P1: kayıt tahsilatı seçimsiz 400; Garanti; aynı istek iki kez tek satır; sil → geri yükle → aynı hesap", async () => {
    const url = "/api/workspace/cases/DOSYA-1/payments";
    expectStatus(await ctx.api.post(url, { amount: "700", date: TODAY, method: "bank", caseTitle: "Dosya 1" }), 400, "bank-account-required", "seçimsiz");
    const before = (await balances(ctx.api, { garanti: acc.garanti })).garanti;
    const res = await must("tahsilat", withId(ctx.api, url, { amount: "700", date: TODAY, method: "bank", bankAccountId: acc.garanti.id, caseTitle: "Dosya 1" }, "c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3"));
    const again = await must("yineleme", withId(ctx.api, url, { amount: "700", date: TODAY, method: "bank", bankAccountId: acc.garanti.id, caseTitle: "Dosya 1" }, "c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3"));
    assert.deepEqual([again.replayed, again.id], [true, res.id]);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM payments WHERE case_key = 'DOSYA-1'").n, 1);
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, before + 700);
    await must("sil", ctx.api.del(`/api/workspace/payments/${res.id}`));
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, before);
    await restoreLast(ctx.api, "payment");
    assert.equal(ctx.store.get("SELECT fin_ref FROM payments WHERE id = ?", res.id).fin_ref, acc.garanti.id);
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, before + 700);
    await integrityOk(ctx.api, "P1");
  });
});

describe("Aşama 8 — stok peşini ve çek tahsil/ödeme", () => {
  let ctx;
  let acc;
  let item;
  let accountant;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Ürün A", unit: "Adet", openingQty: "10", unitPrice: "1.000" }));
    accountant = await noBankMoveAccountant(ctx, "muhasebe-s1");
  });
  after(() => ctx.server.close());
  const moves = () => `/api/workspace/stock/${item.id}/moves`;

  it("S1: peşin satış havale seçimsiz 400; Ziraat 2 × 1.500 → Ziraat 103.000; peşin alım bank.move'suz 403", async () => {
    expectStatus(await ctx.api.post(moves(), { kind: "out", qty: "2", unitPrice: "1.500", pay: "cash", method: "bank", date: TODAY }), 400, "bank-account-required", "seçimsiz");
    const sold = await must("satış", ctx.api.post(moves(), { kind: "out", qty: "2", unitPrice: "1.500", pay: "cash", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM stock_moves WHERE id = ?", sold.moveId).fin_ref, acc.ziraat.id);
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, 103000);
    expectStatus(await accountant.post(moves(), { kind: "in", qty: "1", unitPrice: "900", pay: "cash", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }), 403, "bank-permission", "peşin alım");
    await integrityOk(ctx.api, "S1");
  });

  it("S1b: müşteri iadesi (havale) Engelle'deki Garanti'yi eksiye düşürür → 409 cash-blocked; Ziraat'ten iade 200", async () => {
    await setPolicy(ctx.api, acc.garanti, "block");
    expectStatus(await ctx.api.post(moves(), { kind: "in", reason: "return", qty: "1", unitPrice: "60.000", pay: "cash", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }), 409, "cash-blocked", "iade Garanti");
    await must("Ziraat'ten iade", ctx.api.post(moves(), { kind: "in", reason: "return", qty: "1", unitPrice: "1.500", pay: "cash", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    const b = await balances(ctx.api, { ziraat: acc.ziraat, garanti: acc.garanti });
    assert.deepEqual([b.ziraat, b.garanti], [101500, 50000]);
    await setPolicy(ctx.api, acc.garanti, "warn");
    await integrityOk(ctx.api, "S1b");
  });

  it("C1: çek tahsil havale seçimsiz 400; Garanti → 50.000 + 4.000, olay hesaplı; Engelle'de tahsili geri almak 409; verilen çek ödemesi bank.move'suz 403", async () => {
    const cheque = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "4.000", issueDate: TODAY, dueDate: "2026-12-31", drawer: "Keşideci A", serialNo: "C-1" }));
    const act = body => ctx.api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: TODAY, method: "bank", ...body });
    expectStatus(await act({}), 400, "bank-account-required", "seçimsiz tahsil");
    assert.equal(ctx.store.get("SELECT status FROM cheques WHERE id = ?", cheque.id).status, "portfolio", "tahsil yazılmadı");
    await must("tahsil", act({ bankAccountId: acc.garanti.id }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM cheque_events WHERE cheque_id = ? AND kind = 'collect'", cheque.id).fin_ref, acc.garanti.id);
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, 54000);
    const xyz = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ", type: "supplier", registeredOn: "2026-10-01" }));
    await must("Garanti ödeme", ctx.api.post(`/api/workspace/accounts/${xyz.id}/entries`, { kind: "out", amount: "52.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    await setPolicy(ctx.api, acc.garanti, "block");
    expectStatus(await ctx.api.post(`/api/workspace/cheques/${cheque.id}/undo`, {}), 409, "cash-blocked", "tahsili geri al");
    assert.equal(ctx.store.get("SELECT status FROM cheques WHERE id = ?", cheque.id).status, "collected");
    await setPolicy(ctx.api, acc.garanti, "warn");
    const given = await must("verilen çek", ctx.api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "1.000", issueDate: TODAY, dueDate: "2026-12-31", accountId: xyz.id, serialNo: "V-1" }));
    expectStatus(await accountant.post(`/api/workspace/cheques/${given.id}/actions`, { action: "pay", date: TODAY, method: "bank", bankAccountId: acc.ziraat.id }), 403, "bank-permission", "çek ödemesi");
    await must("ödeme", ctx.api.post(`/api/workspace/cheques/${given.id}/actions`, { action: "pay", date: TODAY, method: "bank", bankAccountId: acc.ziraat.id }));
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, 100500);
    await integrityOk(ctx.api, "C1");
  });
});

describe("Aşama 7–8 — tek hesapta kendiliğinden; döviz ve pasif hesap", () => {
  let ctx;
  let a;
  let party;
  before(async () => {
    ctx = await bootBank({ fxEnabled: true });
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Tek Hesap Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    a = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("X: tek hesapta fatura peşini, kayıt tahsilatı ve stok satışı kendiliğinden o hesaba; USD hesap 400 bank-currency; pasif hesap 400", async () => {
    const doc = await must("fatura", ctx.api.post(INV, invoice(party.id, "sale", 1000, [{ amount: "1.000", method: "bank" }])));
    assert.deepEqual(cashRows(ctx.store, doc.id).map(row => row.finRef), [a.id]);
    const pay = await must("kayıt", ctx.api.post("/api/workspace/cases/K-1/payments", { amount: "200", date: TODAY, method: "bank", caseTitle: "K" }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM payments WHERE id = ?", pay.id).fin_ref, a.id);
    const usd = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "USD", kind: "fx", currency: "USD" });
    expectStatus(await ctx.api.post(INV, invoice(party.id, "sale", 1000, [{ amount: "1.000", method: "bank", bankAccountId: usd.id }])), 400, "bank-currency", "USD");
    const c = await openAccount(ctx.api, { bankName: "Akbank", name: "C", kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    await must("pasife al", ctx.api.post(`${BANK}/accounts/${c.id}/status`, { status: "passive" }));
    expectStatus(await ctx.api.post("/api/workspace/cases/K-2/payments", { amount: "10", date: TODAY, method: "bank", bankAccountId: c.id, caseTitle: "K" }), 400, "bank-account-invalid", "pasif");
    assert.equal((await balances(ctx.api, { a })).a, 11200);
    await integrityOk(ctx.api, "X");
  });
});
