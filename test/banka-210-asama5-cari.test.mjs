// 2.1.0 Aşama 5 (daraltılmış) — Cari kartında havale/EFT tahsilat ve ödemesinin banka hesabı (plan §3.5 K13, §3.7 #2–3, §3.9 K7, §3.10 K8,
// §3.8 "Cari kartı", §12.3 Aşama 5, §12.5 kabul 5–12).
//
// Nasıl bozarım (önce yazıldı; testler buradan):
//   B1  İki hesap tanımlıyken hesap seçmeden havale → para hangi hesaba? (400 bank-account-required; seçilince o hesap)
//   B2  Tek hesapta seçim yapılmazsa satır "Hesabı Atanmamış"a düşer mi? (kendiliğinden o hesap)
//   B3  Nakit tahsilata hesap kimliği gönder → Kasa + hesap çift sayılır mı? (yok sayılır, fin_ref '')
//   B4  Aynı istek iki kez (çift tıklama, ağ yinelemesi) → iki satır? (tek satır, replayed)
//   B5  Farklı kimlik, aynı gün, aynı tutar, aynı hesap, aynı cari → mükerrer? (409 bank-similar; "Yine de Kaydet" geçer)
//   B6  Aynı gün aynı tutarda iki NAKİT tahsilat → gereksiz uyarı? (ikisi de 200)
//   B7  Aynı adlı iki cari, aynı gün aynı tutar aynı hesap → uyarı/karışma? (cari farklı: ikisi 200, bakiyeler ayrı)
//   B8  Pasif hesaba, döviz hesabına, başka şirketin/olmayan hesaba yaz → (400 / 400 bank-currency / 404)
//   B9  Hesabın açılışından önceki tarih; Devir Kapanışı sınırından önceki tarih → para iki kez sayılır mı? (409 before-opening / carry-closed)
//   B10 Bakiye Doğrulandı hesapta eksiye düşüren ödeme: Uyar (409 bank-negative → negativeOk 200), Engelle (409 bank-blocked, onayla da yok)
//   B11 Engelle'de aynı hesaptan aynı anda iki ödeme (farklı cariler) → ikisi birden geçer mi? (biri 200, öbürü 409)
//   B12 Personel ödeme girer (403); kendi havale tahsilatını siler / nakde çevirir / hesabını değiştirir (403); açıklamasını düzeltir (200)
//   B13 bank.move'u kaldırılmış muhasebe bankadan ödeme yapar (403)
//   B14 Sil → Silinenler'den geri yükle → bağ kopar mı? (aynı fin_ref, olay etkin)
//   B15 İki hesap tanımlıyken hesapsız ESKİ satırın açıklamasını düzelt (200, bağsız kalır); tutarını değiştir (400 hesap seç)
//   B16 Düzeltmede hesabı Ziraat → Garanti taşı (iki hesap da doğru); Engelle'deki hesaba taşıyıp eksiye düşür (409)
//   B17 Banka bağlı hareketi olan cariyi sil (409 account-bank-linked → Pasife Al 200)
//   B18 Banka penceresinden gelen (source='bank') cari satırını cari kartından düzelt/sil (409)
//   B19 Eşleşmiş (ekstre) satırı düzelt/sil (409 bank-reconciled)
//   B20 Yazımdan sonra hesap kartı bütün satırları yeniden toplar mı? (money.prime: tam toplam sorgusu yok)
// Bağımsız beklenen: her adımda Genel Bakış Gerçek Banka = hesap kartı = Alt Hesap Mizanı = testin kendi toplamı; mutabakat 0.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk, unwrap } from "./banka-210-ortak.mjs";
import { BANK, NOW, TODAY, boot, bootBank, expectStatus, must, openAcceptanceAccounts, openAccount, subBalances } from "./banka-210-hesap-ortak.mjs";

const TL = 100;
const entries = id => `/api/workspace/accounts/${id}/entries`;
const withId = (api, url, body, id) => api.client.post(url, body, { "x-hof-request": id }).then(unwrap);
async function balances(api, list) {
  const summary = await must("özet", api.get(`${BANK}/summary`));
  const subs = await subBalances(api);
  const out = {};
  for (const [name, account] of Object.entries(list)) {
    const view = await must("hesap", api.get(`${BANK}/accounts/${account.id}`));
    assert.equal(Math.round((subs[account.glSub]?.balance || 0) * TL), view.balanceMinor, `${name}: Alt Hesap Mizanı = hesap kartı`);
    out[name] = view.balanceMinor / TL;
  }
  out.real = summary.realBank.minor / TL;
  return out;
}
const setPolicy = (api, account, policy) => must(`politika ${policy}`, api.put(`${BANK}/accounts/${account.id}`, { negativePolicy: policy }));

describe("Aşama 5 — kabul 5–12: ABC Ltd. faturası Ziraat'e havaleyle tahsil edilir", () => {
  let ctx;
  let acc;
  let abc;
  let invoice;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    invoice = await must("fatura", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Ürün A", qty: 1, unitPrice: 20000, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
  });
  after(() => ctx.server.close());

  it("B1: iki hesapta hesap seçmeden havale → 400 bank-account-required (alan bankAccountId); hiçbir şey yazılmaz", async () => {
    const res = await ctx.api.post(entries(abc.id), { kind: "in", amount: "20.000", method: "bank", date: TODAY });
    expectStatus(res, 400, "bank-account-required", "hesapsız havale");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND kind = 'in'", abc.id).n, 0);
  });

  it("kabul 9–12: Tahsilat 20.000 Havale/EFT Ziraat → Ziraat 120.000, ABC 0, fatura Ödendi; Kasa 0", async () => {
    const res = await must("tahsilat", withId(ctx.api, entries(abc.id), { kind: "in", amount: "20.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }, "0123456789abcdef0123456789abcd09"));
    assert.equal(res.totals.balance, 0, "ABC 0");
    assert.equal(ctx.store.get("SELECT fin_ref FROM account_entries WHERE id = ?", res.entryId).fin_ref, acc.ziraat.id);
    const b = await balances(ctx.api, { ziraat: acc.ziraat, garanti: acc.garanti });
    assert.deepEqual([b.ziraat, b.garanti, b.real], [120000, 50000, 170000]);
    const doc = await must("fatura", ctx.api.get(`/api/workspace/invoices/${invoice.id}`));
    assert.equal(doc.payState, "paid", "fatura Ödendi");
    assert.equal((await must("Kasa", ctx.api.get("/api/workspace/cash"))).byMethod.cash, 0);
    await integrityOk(ctx.api, "kabul 12");
  });

  it("B4: aynı istek kimliğiyle ikinci gönderim → tek satır, replayed", async () => {
    const again = await must("yineleme", withId(ctx.api, entries(abc.id), { kind: "in", amount: "20.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }, "0123456789abcdef0123456789abcd09"));
    assert.equal(again.replayed, true);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND kind = 'in'", abc.id).n, 1);
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, 120000);
  });

  it("B5: farklı kimlik, aynı gün/tutar/hesap/cari → 409 bank-similar (önceki İşlem No ile); similarOk → 200", async () => {
    const res = await withId(ctx.api, entries(abc.id), { kind: "in", amount: "20.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }, "0123456789abcdef0123456789abcd9b");
    expectStatus(res, 409, "bank-similar", "benzer");
    assert.match(res.error, /BNK-2026-/);
    await must("Yine de Kaydet", withId(ctx.api, entries(abc.id), { kind: "in", amount: "20.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, similarOk: true }, "0123456789abcdef0123456789abcd9b"));
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, 140000);
  });

  it("B6–B7: iki nakit tahsilat aynı gün aynı tutar → ikisi 200; aynı adlı iki cariye aynı havale → ikisi 200, bakiyeler ayrı", async () => {
    await must("nakit 1", ctx.api.post(entries(abc.id), { kind: "in", amount: "500", method: "cash", date: TODAY }));
    await must("nakit 2", ctx.api.post(entries(abc.id), { kind: "in", amount: "500", method: "cash", date: TODAY }));
    const a = await must("Ayşe 1", ctx.api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", registeredOn: "2026-10-01" }));
    const b = await must("Ayşe 2", ctx.api.post("/api/workspace/accounts", { name: "Ayşe Yılmaz", type: "customer", registeredOn: "2026-10-01", phone: "05320000002" }));
    const ra = await must("Ayşe 1 havale", ctx.api.post(entries(a.id), { kind: "in", amount: "1.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    const rb = await must("Ayşe 2 havale", ctx.api.post(entries(b.id), { kind: "in", amount: "1.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    assert.equal(ra.totals.balance, -1000);
    assert.equal(rb.totals.balance, -1000);
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, 52000);
    await integrityOk(ctx.api, "B7");
  });

  it("B3: nakit tahsilatta gönderilen hesap kimliği yok sayılır (Kasa'da, hesapta değil)", async () => {
    const res = await must("nakit + hesap", ctx.api.post(entries(abc.id), { kind: "in", amount: "250", method: "cash", bankAccountId: acc.ziraat.id, date: TODAY }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM account_entries WHERE id = ?", res.entryId).fin_ref, "");
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, 140000);
  });
});

describe("Aşama 5 — hesap kuralları: tek hesap, pasif, döviz, açılış ve Devir Kapanışı sınırı", () => {
  let ctx;
  let party;
  let a;
  before(async () => {
    ctx = await bootBank({ fxEnabled: true });
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    // Eski (hesapsız) havaleler: biri Devir Kapanışı'na girecek.
    await must("eski havale", ctx.api.post(entries(party.id), { kind: "in", amount: "8.000", method: "bank", date: "2026-09-20" }));
    a = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("B2: tek uygun hesapta seçim yapılmasa da satır o hesaba bağlanır", async () => {
    const res = await must("havale", ctx.api.post(entries(party.id), { kind: "in", amount: "1.000", method: "bank", date: TODAY }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM account_entries WHERE id = ?", res.entryId).fin_ref, a.id);
  });

  it("B9: açılıştan önceki tarih → 409 bank-before-opening; Devir Kapanışı sınırından önce → 409 bank-carry-closed", async () => {
    const early = await ctx.api.post(entries(party.id), { kind: "in", amount: "300", method: "bank", bankAccountId: a.id, date: "2026-09-25" });
    expectStatus(early, 409, "bank-before-opening", "açılıştan önce");
    await must("sihirbaz", ctx.api.post(`${BANK}/setup`, { accountId: a.id, carryClose: true, assign: "all" }));
    const b = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "B Hesabı", kind: "demand", opening: { date: "2026-09-15", amount: "50.000", confirmed: true } });
    const closed = await ctx.api.post(entries(party.id), { kind: "in", amount: "300", method: "bank", bankAccountId: b.id, date: "2026-09-25" });
    expectStatus(closed, 409, "bank-carry-closed", "Devir Kapanışı'ndan önce");
    assert.match(closed.error, /01\.10\.2026 tarihli Devir Kapanışı/);
    await integrityOk(ctx.api, "B9");
  });

  it("B8: pasif hesap 400, döviz hesabı 400 bank-currency, olmayan hesap 404", async () => {
    const usd = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "USD", kind: "fx", currency: "USD" });
    expectStatus(await ctx.api.post(entries(party.id), { kind: "in", amount: "10", method: "bank", bankAccountId: usd.id, date: TODAY }), 400, "bank-currency", "USD");
    expectStatus(await ctx.api.post(entries(party.id), { kind: "in", amount: "10", method: "bank", bankAccountId: "yok-123", date: TODAY }), 404, "bank-account-missing", "olmayan");
    const c = await openAccount(ctx.api, { bankName: "Akbank", name: "C", kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    await must("pasife al", ctx.api.post(`${BANK}/accounts/${c.id}/status`, { status: "passive" }));
    expectStatus(await ctx.api.post(entries(party.id), { kind: "in", amount: "10", method: "bank", bankAccountId: c.id, date: TODAY }), 400, "bank-account-invalid", "pasif");
  });
});

describe("Aşama 5 — K7 eksi bakiye, eşzamanlı ödeme, düzeltme ve silme", () => {
  let ctx;
  let acc;
  let xyz;
  let klm;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    xyz = await must("XYZ", ctx.api.post("/api/workspace/accounts", { name: "XYZ Ltd.", type: "supplier", registeredOn: "2026-10-01" }));
    klm = await must("KLM", ctx.api.post("/api/workspace/accounts", { name: "KLM Ltd.", type: "supplier", registeredOn: "2026-10-01" }));
  });
  after(() => ctx.server.close());

  it("B10: Uyar → 409 bank-negative, negativeOk → 200; Engelle → 409 bank-blocked (negativeOk da geçmez)", async () => {
    const warn = await ctx.api.post(entries(xyz.id), { kind: "out", amount: "60.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY });
    expectStatus(warn, 409, "bank-negative", "Uyar");
    assert.match(warn.error, /Garanti BBVA · Ana TL Hesabı hesabında 50\.000,00 TL var/);
    await must("Yine de Kaydet", ctx.api.post(entries(xyz.id), { kind: "out", amount: "60.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY, negativeOk: true }));
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, -10000);
    await setPolicy(ctx.api, acc.ziraat, "block");
    const block = await ctx.api.post(entries(xyz.id), { kind: "out", amount: "100.000,01", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, negativeOk: true });
    expectStatus(block, 409, "bank-blocked", "Engelle");
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, 100000);
  });

  it("B11: Engelle'de aynı hesaptan aynı anda iki ödeme (60.000 + 60.000, farklı cariler) → biri 200, öbürü 409 bank-blocked", async () => {
    const [r1, r2] = await Promise.all([
      ctx.api.post(entries(xyz.id), { kind: "out", amount: "60.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }),
      ctx.api.post(entries(klm.id), { kind: "out", amount: "60.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }),
    ]);
    assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
    assert.equal([r1, r2].find(r => r.status === 409).code, "bank-blocked");
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, 40000);
    await integrityOk(ctx.api, "B11");
  });

  it("B16: düzeltmede hesap Ziraat → Garanti taşınır; Engelle'deki hesaba taşıyıp eksiye düşürmek 409", async () => {
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Müşteri M", type: "customer", registeredOn: "2026-10-01" }));
    const res = await must("tahsilat", ctx.api.post(entries(party.id), { kind: "in", amount: "5.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }));
    let b = await balances(ctx.api, { ziraat: acc.ziraat, garanti: acc.garanti });
    assert.deepEqual([b.ziraat, b.garanti], [40000, -5000]);
    await must("Ziraat'e taşı", ctx.api.put(`${entries(party.id)}/${res.entryId}`, { kind: "in", amount: "5.000", method: "bank", bankAccountId: acc.ziraat.id, negativeOk: true }));
    b = await balances(ctx.api, { ziraat: acc.ziraat, garanti: acc.garanti });
    assert.deepEqual([b.ziraat, b.garanti, b.real], [45000, -10000, 35000]);
    // Ziraat (Engelle) 45.000: 5.000'lik tahsilatı silmek 40.000 bırakır (geçer); 50.000'lik ödemeyi Ziraat'e taşımak eksiye düşürür (409).
    const pay = await must("Garanti ödeme", ctx.api.post(entries(xyz.id), { kind: "out", amount: "50.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY, negativeOk: true }));
    const paidId = ctx.store.get("SELECT id FROM account_entries WHERE account_id = ? AND amount = 50000", xyz.id).id;
    expectStatus(await ctx.api.put(`${entries(xyz.id)}/${paidId}`, { kind: "out", amount: "50.000", method: "bank", bankAccountId: acc.ziraat.id }), 409, "bank-blocked", "Engelle'ye taşı");
    assert.ok(pay);
    await integrityOk(ctx.api, "B16");
  });

  it("B14: Ziraat'e bağlı tahsilatı sil → Silinenler'den geri yükle → aynı fin_ref, olay etkin", async () => {
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Geri Yükle Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    const res = await must("tahsilat", ctx.api.post(entries(party.id), { kind: "in", amount: "2.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    const row = ctx.store.get("SELECT event_id, fin_ref FROM account_entries WHERE id = ?", res.entryId);
    const before = (await balances(ctx.api, { ziraat: acc.ziraat })).ziraat;
    await must("sil", ctx.api.del(`${entries(party.id)}/${res.entryId}`));
    assert.equal(ctx.store.get("SELECT status FROM fin_events WHERE id = ?", row.event_id).status, "cancelled");
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, before - 2000);
    const trash = await must("Silinenler", ctx.api.get("/api/admin/trash"));
    const list = trash.items || trash.rows || trash;
    const item = list.find(entry => entry.kind === "account-entry" && !entry.restoredAt);
    await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: item.id }));
    const back = ctx.store.get("SELECT event_id, fin_ref FROM account_entries WHERE id = ?", res.entryId);
    assert.deepEqual([back.fin_ref, back.event_id], [acc.ziraat.id, row.event_id]);
    assert.equal(ctx.store.get("SELECT status FROM fin_events WHERE id = ?", row.event_id).status, "active");
    assert.equal((await balances(ctx.api, { ziraat: acc.ziraat })).ziraat, before);
    await integrityOk(ctx.api, "B14");
  });

  it("B17: banka bağlı hareketi olan cari silinmez (409 account-bank-linked); Pasife Al 200", async () => {
    const linked = await ctx.api.del(`/api/workspace/accounts/${xyz.id}`);
    expectStatus(linked, 409, "account-bank-linked", "bağlı cari");
    assert.ok(ctx.store.get("SELECT 1 AS f FROM accounts WHERE id = ? AND deleted_at IS NULL", xyz.id), "cari duruyor");
    await must("Pasife Al", ctx.api.put(`/api/workspace/accounts/${xyz.id}`, { status: "passive" }));
    await integrityOk(ctx.api, "B17");
  });
});

describe("Aşama 5 — eski bağsız satır, yetki (K4), Banka'dan gelen ve eşleşmiş satır, saklı toplam", () => {
  let ctx;
  let acc;
  let party;
  let legacyId;
  let staff;
  let accountant;
  before(async () => {
    ctx = await bootBank();
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    legacyId = (await must("eski havale", ctx.api.post(entries(party.id), { kind: "in", amount: "3.000", method: "bank", date: "2026-10-05" }))).entryId;
    acc = await openAcceptanceAccounts(ctx.api);
    staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel1", role: "personel" }));
    accountant = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe1");
    assert.equal((await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.move"] } })).status, 200);
  });
  after(() => ctx.server.close());

  it("B15: iki hesap varken eski bağsız satırın açıklaması düzelir (200, bağsız kalır); tutarı değişirse 400 hesap seç", async () => {
    await must("açıklama", ctx.api.put(`${entries(party.id)}/${legacyId}`, { kind: "in", amount: "3.000", method: "bank", date: "2026-10-05", note: "Eylül havalesi" }));
    assert.deepEqual({ ...ctx.store.get("SELECT note, fin_ref FROM account_entries WHERE id = ?", legacyId) }, { note: "Eylül havalesi", fin_ref: "" });
    expectStatus(await ctx.api.put(`${entries(party.id)}/${legacyId}`, { kind: "in", amount: "3.500", method: "bank", date: "2026-10-05" }), 400, "bank-account-required", "tutar değişti");
    await must("hesap seçerek", ctx.api.put(`${entries(party.id)}/${legacyId}`, { kind: "in", amount: "3.000", method: "bank", date: "2026-10-05", bankAccountId: acc.garanti.id }));
    assert.equal(ctx.store.get("SELECT fin_ref FROM account_entries WHERE id = ?", legacyId).fin_ref, acc.garanti.id);
    assert.equal((await balances(ctx.api, { garanti: acc.garanti })).garanti, 53000);
  });

  it("B12: personel ödeme 403; kendi havale tahsilatını siler / nakde çevirir / hesabını değiştirir 403; açıklama 200", async () => {
    expectStatus(await staff.post(entries(party.id), { kind: "out", amount: "100", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }), 403, "", "personel ödeme");
    const own = (await must("personel tahsilat", staff.post(entries(party.id), { kind: "in", amount: "700", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }))).entryId;
    expectStatus(await staff.del(`${entries(party.id)}/${own}`), 403, "bank-permission", "sil");
    expectStatus(await staff.put(`${entries(party.id)}/${own}`, { kind: "in", amount: "700", method: "cash", date: TODAY }), 403, "bank-permission", "nakde çevir");
    expectStatus(await staff.put(`${entries(party.id)}/${own}`, { kind: "in", amount: "700", method: "bank", bankAccountId: acc.garanti.id, date: TODAY }), 403, "bank-permission", "hesap değiştir");
    await must("açıklama", staff.put(`${entries(party.id)}/${own}`, { kind: "in", amount: "700", method: "bank", date: TODAY, note: "Ekim" }));
    assert.deepEqual({ ...ctx.store.get("SELECT note, fin_ref, method FROM account_entries WHERE id = ?", own) }, { note: "Ekim", fin_ref: acc.ziraat.id, method: "bank" });
  });

  it("B13: bank.move'u kaldırılmış muhasebe bankadan ödeme yapamaz (403); nakit ödeme yapar (200)", async () => {
    expectStatus(await accountant.post(entries(party.id), { kind: "out", amount: "100", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }), 403, "bank-permission", "havale ödeme");
    await must("nakit ödeme", accountant.post(entries(party.id), { kind: "out", amount: "100", method: "cash", date: TODAY, cashForce: true }));
  });

  it("B18–B19: Banka'dan gelen (source='bank') satır cari kartından değişmez; ekstreyle eşleşmiş satır düzeltilmez/silinmez (409)", async () => {
    const res = await must("tahsilat", ctx.api.post(entries(party.id), { kind: "in", amount: "1.234", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
    const row = ctx.store.get("SELECT event_id FROM account_entries WHERE id = ?", res.entryId);
    ctx.db.prepare("INSERT INTO bank_matches (id, line_id, bank_account_id, event_id, amount_minor, digest, kind, created_by, created_at) VALUES ('m1', 'l1', ?, ?, 123400, 'x', 'manual', 'admin', ?)").run(acc.ziraat.id, row.event_id, NOW);
    expectStatus(await ctx.api.put(`${entries(party.id)}/${res.entryId}`, { kind: "in", amount: "1.000", method: "bank", date: TODAY }), 409, "bank-reconciled", "eşleşmiş düzelt");
    expectStatus(await ctx.api.del(`${entries(party.id)}/${res.entryId}`), 409, "bank-reconciled", "eşleşmiş sil");
    ctx.db.prepare("UPDATE account_entries SET source = 'bank' WHERE id = ?").run(legacyId);
    expectStatus(await ctx.api.put(`${entries(party.id)}/${legacyId}`, { kind: "in", amount: "3.000", method: "bank", note: "x" }), 409, "bank-linked", "Banka'dan gelen düzelt");
    expectStatus(await ctx.api.del(`${entries(party.id)}/${legacyId}`), 409, "bank-linked", "Banka'dan gelen sil");
    ctx.db.prepare("UPDATE account_entries SET source = '' WHERE id = ?").run(legacyId);
    ctx.db.prepare("DELETE FROM bank_matches WHERE id = 'm1'").run();
  });
});

describe("Aşama 5 — B20: cari havalesinden sonra hesap kartı bütün satırları yeniden toplamaz (money.prime)", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: NOW, gateVerify: false });
  });
  after(() => ctx.server.close());

  it("havale, okuma: tam toplam sorgusu yok; bakiye bağımsız hesapla aynı", async () => {
    const api = ctx.api;
    const account = await openAccount(api, { bankName: "Ziraat Bankası", name: "Hız", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "ABC", type: "customer", registeredOn: "2026-10-01" }));
    const store = ctx.app.context.store;
    const original = store.get.bind(store);
    let full = 0;
    store.get = (sql, ...args) => {
      const named = args[0] && typeof args[0] === "object" ? args[0] : {};
      if (typeof sql === "string" && sql.includes("AS credit FROM (") && named.ref === account.id && !named.events && !named.after) full += 1;
      return original(sql, ...args);
    };
    try {
      const balance = async () => (await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor;
      assert.equal(await balance(), 100_000);
      full = 0;
      await must("havale 1", api.post(entries(party.id), { kind: "in", amount: "100", method: "bank", date: TODAY }));
      await must("havale 2", api.post(entries(party.id), { kind: "out", amount: "50,25", method: "bank", date: TODAY }));
      assert.equal(await balance(), 104_975);
      assert.equal(full, 0, `cari havalesinden sonra hesabın bütün satırları ${full} kez yeniden toplandı`);
    } finally {
      store.get = original;
    }
  });
});
