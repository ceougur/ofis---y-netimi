// 2.1.0 — yargıç + eleştirmen (11.10.2026) bulguları: hesabı atanmamış ESKİ satırların kuralları (plan §3.5 kural 1/4, §3.9, §10.3, §10.4, Y1).
//
// Yeniden üretim betikleri: docs/kanit/2026-10-11/yargic/p3, p8, p9, p10, p11, p12 ve docs/kanit/2026-10-11/elestirmen/e1, e2, e4.
//   B1 (engel, gerileme): banka hesabı açılınca açılıştan önceki hesapsız havale/kart satırının tutarı/tarihi düzeltilemiyor, eski tarihli
//      yeni havale girilemiyordu (409 bank-before-opening; pickRef tek hesabı kendiliğinden seçip açılış denetimine düşürüyordu). Kural (§3.5/1):
//      tarih uygun hesapların açılışından önceyse satır hesapsız kalır; çok hesapta açıkça "Hesapsız (Açılıştan Önce)" (bankAccountId "none"
//      ya da "") yalnız tarih bir hesabın açılışından önceyse kabul.
//   Y1 + B4 + Y2: Devir Kapanışı / Kart Borcuna Aktar / Bankaya Geçmiş Say havuzundaki eski satırda parayı değiştiren işlem fişi netlemiyordu
//      (kart borcu iki kez, 108.00/102.00'da takılı artık, Mutabakat Testi "tamam"). Kural: 409 bank-reclass-active + Kurulum Geçmişi yolu;
//      Mutabakat Testi bank:pool sapmayı gösterir.
//   B2: Kurulum Sihirbazı Geri Al, sihirbazın bağlaması ve "Bu Hesaba Ata" K7'yi (Engelle 409 cash-blocked, Uyar 409 cash-negative +
//      negativeOk) ve pasif hesap kuralını (400 bank-account-passive) uygular.
//   B3: banka fişi Ters Kaydet / Düzelt ve Açılışı Düzelt pasif hesapta 400 bank-account-passive.
// Sahte saat 08.10.2026 (banka-210-hesap-ortak). Bağımsız beklenen: testin kendi tuttuğu sayılar (açılış + girilen tutarlar).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { integrityOf, rawRun } from "./banka-210-ortak.mjs";
import { BANK, bootBank, expectStatus, must, subBalances, TODAY } from "./banka-210-hesap-ortak.mjs";
import { readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const TL = 100;
const ENTRIES = id => `/api/workspace/accounts/${id}/entries`;
const finRefOf = (store, table, id) => store.get(`SELECT fin_ref AS f FROM ${table} WHERE id = ?`, id)?.f;
const amountOf = (store, table, id) => store.get(`SELECT amount AS a FROM ${table} WHERE id = ?`, id)?.a;
const summary = api => must("özet", api.get(`${BANK}/summary`));
const party = (api, name, type = "customer") => must(`cari ${name}`, api.post("/api/workspace/accounts", { name, type, registeredOn: "2026-08-01" }));
const openBank = (api, name, date, amount, extra = {}) =>
  must(`hesap ${name}`, api.post(`${BANK}/accounts`, { bankName: "Ziraat", name, kind: "demand", opening: { date, amount, confirmed: true }, ...extra }));
const openCard = (api, name, limit = "10.000", extra = {}) =>
  must(`kart ${name}`, api.post(`${BANK}/accounts`, { bankName: "Garanti", name, kind: "card", creditLimit: limit, opening: { date: "2026-10-01", amount: "0", confirmed: true }, ...extra }));
async function poolCheck(api) {
  const result = await integrityOf(api);
  return { result, pool: result.checks.find(item => item.code === "bank:pool") };
}
async function integrityClean(api, label) {
  const result = await integrityOf(api);
  assert.equal(result.ok, true, `${label}: Mutabakat Testi ${JSON.stringify(result.failures).slice(0, 600)}`);
}

describe("B1 — tek hesap: açılıştan önceki hesapsız satırlar düzeltilir, eski tarihli hareket hesapsız girilir (§3.5/1)", () => {
  it("cari havale ve kurumsal kart ödemesi: tutar, tarih, yeni eski tarihli satır, boş hesap; Gerçek Banka değişmez", async () => {
    const ctx = await bootBank();
    const { api, store } = ctx;
    try {
      const cus = await party(api, "Müşteri");
      const sup = await party(api, "Tedarikçi", "supplier");
      // Hesap yokken (2.0.26 gibi) 15.09 hesapsız havale tahsilatı 1.000 ve kartla ödeme 400.
      const h = (await must("havale", api.post(ENTRIES(cus.id), { kind: "in", method: "bank", date: "2026-09-15", amount: "1.000" }))).entryId;
      const k = (await must("kart", api.post(ENTRIES(sup.id), { kind: "out", method: "card", date: "2026-09-15", amount: "400" }))).entryId;
      const A = await openBank(api, "A", "2026-10-01", "5.000");
      await openCard(api, "KK");

      const amount = await api.put(`${ENTRIES(cus.id)}/${h}`, { kind: "in", method: "bank", date: "2026-09-15", amount: "1.100" });
      expectStatus(amount, 200, "", "eski havale tutar 1.000 → 1.100");
      assert.equal(amountOf(store, "account_entries", h), 1100);
      assert.equal(finRefOf(store, "account_entries", h), "", "eski havale hesapsız kalır");
      expectStatus(await api.put(`${ENTRIES(cus.id)}/${h}`, { kind: "in", method: "bank", date: "2026-09-16", amount: "1.100" }), 200, "", "eski havale tarih 15.09 → 16.09");
      expectStatus(await api.put(`${ENTRIES(cus.id)}/${h}`, { kind: "in", method: "bank", date: "2026-09-16", amount: "1.200", bankAccountId: "" }), 200, "", "eski havale tutar + boş hesap");
      assert.equal(finRefOf(store, "account_entries", h), "");

      const card = await api.put(`${ENTRIES(sup.id)}/${k}`, { kind: "out", method: "card", date: "2026-09-15", amount: "450" });
      expectStatus(card, 200, "", "eski kartla ödeme 400 → 450");
      assert.equal(finRefOf(store, "account_entries", k), "", "eski kartla ödeme hesapsız kalır");

      const fresh = await api.post(ENTRIES(cus.id), { kind: "in", method: "bank", date: "2026-09-20", amount: "50" });
      expectStatus(fresh, 200, "", "unutulmuş eski havale 20.09 (hesap verilmeden)");
      assert.equal(finRefOf(store, "account_entries", fresh.data.entryId), "");
      const freshNone = await api.post(ENTRIES(cus.id), { kind: "in", method: "bank", date: "2026-09-21", amount: "25", bankAccountId: "none" });
      expectStatus(freshNone, 200, "", "eski havale 21.09, açıkça Hesapsız (Açılıştan Önce)");
      assert.equal(finRefOf(store, "account_entries", freshNone.data.entryId), "");
      // Açılıştan sonraki yeni havale hesaba bağlanır (tek hesap kendiliğinden).
      const now = await must("bugünkü havale", api.post(ENTRIES(cus.id), { kind: "in", method: "bank", date: TODAY, amount: "300" }));
      assert.equal(finRefOf(store, "account_entries", now.entryId), A.id);
      // Açıkça seçilen hesabın açılışından önce: 409, metin gerçek yolu söyler.
      const explicit = await api.post(ENTRIES(cus.id), { kind: "in", method: "bank", date: "2026-09-22", amount: "10", bankAccountId: A.id });
      expectStatus(explicit, 409, "bank-before-opening", "açıkça seçilen hesabın açılışından önce");
      assert.match(explicit.error, /Hesapsız \(Açılıştan Önce\)/, "hata metni hesapsız yolunu söyler");

      const view = await summary(api);
      assert.equal(view.realBank.minor, (5000 + 300) * TL, "Gerçek Banka = açılış + açılıştan sonraki havale");
      assert.equal(view.unassigned.bankMinor, (1200 + 50 + 25) * TL, "Hesabı Atanmamış (102.00) = eski havaleler");
      assert.equal(view.unassigned.cardMinor, -450 * TL, "Hesabı Atanmamış (108.00) = eski kartla ödeme");
      await integrityClean(api, "B1 cari");
    } finally {
      await ctx.server.close();
    }
  });

  it("taksit tahsilatı, stok peşini, Kasa → Banka transferi ve fatura peşini: eski tarihli hesapsız satır düzeltilir/girilir", async () => {
    const ctx = await bootBank();
    const { api, store } = ctx;
    const D = "2026-09-15";
    try {
      const cus = await party(api, "Müşteri");
      const plan = await must("taksit kartı", api.post("/api/workspace/plans", { accountId: cus.id, name: "Müşteri", total: "6.000", mode: "auto", count: 3, firstDue: "2026-09-10", registeredOn: "2026-09-01" }));
      const planIn = await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "500", method: "bank", date: D }));
      const item = await must("stok kartı", api.post("/api/workspace/stock", { name: "Ürün", unit: "Adet", openingQty: "10", unitPrice: "100" }));
      const sold = await must("stok satış", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "150", pay: "cash", method: "bank", date: D }));
      const transfer = await must("Kasa → Banka", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "200", date: D, cashForce: true }));
      await openBank(api, "A", "2026-10-01", "5.000");

      expectStatus(await api.put(`/api/workspace/plans/${plan.id}/entries/${planIn.entryId}`, { amount: "600", method: "bank", date: D }), 200, "", "taksit tahsilatı 500 → 600");
      assert.equal(finRefOf(store, "plan_entries", planIn.entryId), "");
      expectStatus(await api.put(`/api/workspace/stock/${item.id}/moves/${sold.moveId}`, { kind: "out", qty: "1", unitPrice: "160", pay: "cash", method: "bank", date: D }), 200, "", "stok peşin 150 → 160");
      assert.equal(finRefOf(store, "stock_moves", sold.moveId), "");
      expectStatus(await api.put(`/api/workspace/cash/${transfer.id}`, { kind: "out", amount: "250", date: D, description: "Kasadan Bankaya", cashForce: true }), 200, "", "Kasa → Banka 200 → 250");
      const newPlan = await api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "100", method: "bank", date: "2026-09-20" });
      expectStatus(newPlan, 200, "", "eski tarihli yeni taksit tahsilatı");
      const invoice = await api.post("/api/workspace/invoices", {
        kind: "sale", accountId: cus.id, issueDate: "2026-09-25", pricesIncludeVat: true, force: true,
        lines: [{ name: "Hizmet", qty: 1, unitPrice: 700, discountRate: 0, vatRate: 0 }],
        payment: { cash: [{ amount: "700", method: "bank" }], cheques: [], endorse: [], rest: "open" },
      });
      expectStatus(invoice, 200, "", "eski tarihli fatura peşin havale");
      assert.equal(store.get("SELECT fin_ref AS f FROM account_entries WHERE source = 'invoice' AND source_id = ?", invoice.data.id)?.f, "", "fatura peşin satırı hesapsız");

      const view = await summary(api);
      assert.equal(view.realBank.minor, 5000 * TL, "Gerçek Banka = açılış (açılıştan önceki satırlar hesaba girmez)");
      assert.equal(view.unassigned.bankMinor, (600 + 160 + 250 + 100 + 700) * TL, "Hesabı Atanmamış = eski satırlar");
      await integrityClean(api, "B1 modüller");
    } finally {
      await ctx.server.close();
    }
  });

  it("gerçek 2.0.26 verisi (o sürümün koduyla üretilmiş fikstür): ilk hesap bugünkü açılışla; eski havaleler düzeltilir, eski tarihli havale girilir", async () => {
    const name = "surum-2.0.26-zincir";
    const before = readFixture(name).oncesi;
    const fixture = unpackFixture(name);
    const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: `${before.today}T12:00:00+03:00` });
    try {
      const api = await server.login();
      const store = server.app.store;
      const rows = store.all("SELECT e.id, e.account_id AS accountId, e.kind, e.amount, e.date FROM account_entries e WHERE e.method = 'bank' AND e.kind IN ('in','out') AND e.fin_ref = '' AND (e.source = '' OR e.source IS NULL) AND e.date < ? ORDER BY e.date DESC LIMIT 3", before.today);
      assert.ok(rows.length >= 1, "fikstürde hesapsız eski havale var");
      const acc = await api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: before.today, amount: "10.000", confirmed: true } });
      assert.equal(acc.status, 200, `ilk banka hesabı ${acc.status}`);
      for (const row of rows) {
        const res = await api.put(`/api/workspace/accounts/${row.accountId}/entries/${row.id}`, { kind: row.kind, method: "bank", date: row.date, amount: String(row.amount + 1).replace(".", ",") });
        assert.equal(res.status, 200, `eski havale ${row.date} ${row.amount} → +1: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
        assert.equal(store.get("SELECT fin_ref AS f FROM account_entries WHERE id = ?", row.id).f, "");
      }
      const add = await api.post(`/api/workspace/accounts/${rows[0].accountId}/entries`, { kind: "in", method: "bank", date: rows[0].date, amount: "50" });
      assert.equal(add.status, 200, `unutulmuş eski havale ${rows[0].date}: ${add.status} ${JSON.stringify(add.data).slice(0, 200)}`);
    } finally {
      await server.close();
      fixture.cleanup();
    }
  });
});

describe("B1 — çok hesap: tarih yalnız bir hesabın açılışından sonraysa o hesap; açıkça Hesapsız yalnız açılıştan önceki harekette", () => {
  it("A 01.09, B 01.10: 15.09 → A; Hesapsız seçimi; 15.08 → hesapsız; 05.10 seçim zorunlu", async () => {
    const ctx = await bootBank();
    const { api, store } = ctx;
    try {
      const cus = await party(api, "Müşteri");
      const A = await openBank(api, "A", "2026-09-01", "5.000");
      const B = await openBank(api, "B", "2026-10-01", "5.000");
      const post = body => api.post(ENTRIES(cus.id), { kind: "in", method: "bank", amount: "10", ...body });
      const onlyA = await post({ date: "2026-09-15" });
      expectStatus(onlyA, 200, "", "15.09: yalnız A açık");
      assert.equal(finRefOf(store, "account_entries", onlyA.data.entryId), A.id);
      const none = await post({ date: "2026-09-15", bankAccountId: "none" });
      expectStatus(none, 200, "", "15.09: Hesapsız (Açılıştan Önce) — B'nin açılışından önce");
      assert.equal(finRefOf(store, "account_entries", none.data.entryId), "");
      const blank = await post({ date: "2026-09-16", bankAccountId: "" });
      expectStatus(blank, 200, "", "16.09: bankAccountId \"\" (API) — B'nin açılışından önce");
      assert.equal(finRefOf(store, "account_entries", blank.data.entryId), "");
      const early = await post({ date: "2026-08-15" });
      expectStatus(early, 200, "", "15.08: iki hesabın da açılışından önce");
      assert.equal(finRefOf(store, "account_entries", early.data.entryId), "");
      const required = await post({ date: "2026-10-05" });
      expectStatus(required, 400, "bank-account-required", "05.10: iki hesap açık, seçim zorunlu");
      assert.match(required.error, /Banka Hesabı seçin/);
      const wrongNone = await post({ date: "2026-10-05", bankAccountId: "none" });
      expectStatus(wrongNone, 400, "bank-account-required", "05.10: Hesapsız yalnız açılıştan önceki harekette");
      assert.match(wrongNone.error, /açılışından önceki/);
      expectStatus(await post({ date: "2026-10-05", bankAccountId: B.id }), 200, "", "05.10 B seçilerek");
      await integrityClean(api, "B1 çok hesap");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("Y1 / B4 / Y2 — Devir Kapanışı havuzundaki eski satır parası değişmez (409 bank-reclass-active)", () => {
  it("tutar, silme, nakde çevirme ve yeni eski tarihli satır 409; açıklama ve havuz içinde tarih serbest; Geri Al'dan sonra düzeltilir", async () => {
    const ctx = await bootBank();
    const { api, store } = ctx;
    try {
      const cus = await party(api, "Müşteri");
      const h = (await must("havale", api.post(ENTRIES(cus.id), { kind: "in", method: "bank", date: "2026-09-15", amount: "1.000" }))).entryId;
      const A = await openBank(api, "A", "2026-10-01", "5.000");
      const run = await must("sihirbaz", api.post(`${BANK}/setup`, { accountId: A.id, carryClose: true, assign: "all" }));
      assert.equal(run.carry.bankMinor, 1000 * TL, "Devir Kapanışı 1.000");
      const subsBefore = await subBalances(api);

      const amount = await api.put(`${ENTRIES(cus.id)}/${h}`, { kind: "in", method: "bank", date: "2026-09-15", amount: "1.100" });
      expectStatus(amount, 409, "bank-reclass-active", "Devir Kapanışı'ndaki satırın tutarı");
      assert.match(amount.error, /Kurulum Geçmişi/);
      assert.ok(amount.error.includes(`${run.no} kaydını`), `metin Kurulum Geçmişi'ndeki kaydın numarasını söyler (${run.no}): ${amount.error}`);
      assert.equal(amount.data?.pool, "carry", "havuz türü");
      expectStatus(await api.del(`${ENTRIES(cus.id)}/${h}`), 409, "bank-reclass-active", "Devir Kapanışı'ndaki satırı sil");
      expectStatus(await api.put(`${ENTRIES(cus.id)}/${h}`, { kind: "in", method: "cash", date: "2026-09-15", amount: "1.000", cashForce: true }), 409, "bank-reclass-active", "nakde çevir");
      expectStatus(await api.post(ENTRIES(cus.id), { kind: "in", method: "bank", date: "2026-09-20", amount: "50" }), 409, "bank-reclass-active", "Devir Kapanışı'ndan önce yeni hesapsız havale");
      assert.equal(amountOf(store, "account_entries", h), 1000, "satır değişmedi");
      expectStatus(await api.put(`${ENTRIES(cus.id)}/${h}`, { kind: "in", method: "bank", date: "2026-09-15", amount: "1.000", note: "açıklama" }), 200, "", "yalnız açıklama");
      expectStatus(await api.put(`${ENTRIES(cus.id)}/${h}`, { kind: "in", method: "bank", date: "2026-09-16", amount: "1.000" }), 200, "", "havuz içinde tarih (kapanış tutarı aynı)");
      const subsAfter = await subBalances(api);
      assert.equal(subsAfter["102.00"]?.balance ?? 0, subsBefore["102.00"]?.balance ?? 0, "102.00 değişmedi");
      assert.equal((await summary(api)).unassigned.bankMinor, 0, "Hesabı Atanmamış 0 (takılı artık yok)");
      await integrityClean(api, "Y1 devir");

      // Doğru yol: Kurulum Geçmişi → Geri Al → düzelt → sihirbazı yeniden çalıştır.
      await must("Geri Al", api.post(`${BANK}/setup/${run.id}/undo`, {}));
      expectStatus(await api.put(`${ENTRIES(cus.id)}/${h}`, { kind: "in", method: "bank", date: "2026-09-16", amount: "1.100" }), 200, "", "Geri Al'dan sonra tutar");
      const again = await must("sihirbaz yeniden", api.post(`${BANK}/setup`, { accountId: A.id, carryClose: true, assign: "all" }));
      assert.equal(again.carry.bankMinor, 1100 * TL, "yeni Devir Kapanışı 1.100");
      assert.equal((await summary(api)).unassigned.bankMinor, 0);
      await integrityClean(api, "Y1 devir yeniden");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("Y1 / B4 — Kart Borcuna Aktar ve Bankaya Geçmiş Say havuzu (409 bank-reclass-active, satır karta kendiliğinden bağlanmaz)", () => {
  it("Kart Borcuna Aktar edilmiş kartla ödeme: tutar ve silme 409; kart borcu tek kez; K7 gerçek borçla", async () => {
    const ctx = await bootBank();
    const { api, store } = ctx;
    try {
      const sup = await party(api, "Tedarikçi", "supplier");
      const k = (await must("kartla ödeme", api.post(ENTRIES(sup.id), { kind: "out", method: "card", date: "2026-10-05", amount: "500" }))).entryId;
      const KK = await openCard(api, "KK", "1.000");
      await must("Engelle", api.put(`${BANK}/accounts/${KK.id}`, { negativePolicy: "block" }));
      await must("Kart Borcuna Aktar", api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: KK.id, amount: "500", date: "2026-10-08" }));
      const edit = await api.put(`${ENTRIES(sup.id)}/${k}`, { kind: "out", method: "card", date: "2026-10-05", amount: "450" });
      expectStatus(edit, 409, "bank-reclass-active", "aktarılmış kartla ödemenin tutarı");
      assert.match(edit.error, /Kart Borcuna Aktar/);
      expectStatus(await api.del(`${ENTRIES(sup.id)}/${k}`), 409, "bank-reclass-active", "aktarılmış kartla ödemeyi sil");
      assert.equal(amountOf(store, "account_entries", k), 500);
      assert.equal(finRefOf(store, "account_entries", k), "", "satır karta kendiliğinden bağlanmadı");
      const view = await summary(api);
      assert.equal(view.debt.cardMinor, 500 * TL, "Kart ve Kredi Borcu tek kez 500");
      assert.equal(view.unassigned.cardMinor, 0, "108.00'da artık yok");
      // K7: gerçek borç 500 + 480 = 980 ≤ 1.000 → geçer; sonra 30 daha → Engelle.
      expectStatus(await api.post(ENTRIES(sup.id), { kind: "out", method: "card", date: TODAY, amount: "480" }), 200, "", "kartla yeni ödeme 480");
      expectStatus(await api.post(ENTRIES(sup.id), { kind: "out", method: "card", date: TODAY, amount: "30", similarOk: true }), 409, "cash-blocked", "limit aşımı 30");
      await integrityClean(api, "Y1 kart");
    } finally {
      await ctx.server.close();
    }
  });

  it("Bankaya Geçmiş Say edilmiş POS tahsilatı: tutar ve silme 409; aynı penceredeki yeni POS tahsilatı serbest", async () => {
    const ctx = await bootBank();
    const { api } = ctx;
    try {
      const cus = await party(api, "Müşteri");
      const p = (await must("POS", api.post(ENTRIES(cus.id), { kind: "in", method: "card", date: "2026-10-05", amount: "800" }))).entryId;
      const A = await openBank(api, "A", "2026-10-01", "0");
      await must("Bankaya Geçmiş Say", api.post(`${BANK}/legacy/reclass`, { mode: "bank", accountId: A.id, amount: "800", date: "2026-10-08" }));
      expectStatus(await api.put(`${ENTRIES(cus.id)}/${p}`, { kind: "in", method: "card", date: "2026-10-05", amount: "750" }), 409, "bank-reclass-active", "aktarılmış POS tahsilatının tutarı");
      expectStatus(await api.del(`${ENTRIES(cus.id)}/${p}`), 409, "bank-reclass-active", "aktarılmış POS tahsilatını sil");
      expectStatus(await api.post(ENTRIES(cus.id), { kind: "in", method: "card", date: "2026-10-06", amount: "100" }), 200, "", "pencere içinde yeni POS tahsilatı (aktarılabilir artar)");
      const subs = await subBalances(api);
      assert.equal(subs["108.00"]?.balance ?? 0, 100, "108.00 = yalnız yeni POS tahsilatı");
      await integrityClean(api, "Y1 POS");
    } finally {
      await ctx.server.close();
    }
  });

  it("Mutabakat Testi bank:pool havuz sapmasını gösterir (store dışı yazım)", async () => {
    const ctx = await bootBank();
    const { api, db } = ctx;
    try {
      const sup = await party(api, "Tedarikçi", "supplier");
      const k = (await must("kartla ödeme", api.post(ENTRIES(sup.id), { kind: "out", method: "card", date: "2026-10-05", amount: "500" }))).entryId;
      const KK = await openCard(api, "KK");
      await must("Kart Borcuna Aktar", api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: KK.id, amount: "500", date: "2026-10-08" }));
      const clean = await poolCheck(api);
      assert.ok(clean.pool, "bank:pool denetimi listede");
      assert.equal(clean.pool.ok, true);
      rawRun(db, "UPDATE account_entries SET amount = 450 WHERE id = ?", k);
      const broken = await poolCheck(api);
      assert.equal(broken.pool?.ok, false, `bank:pool sapmayı göstermeli: ${JSON.stringify(broken.pool)}`);
    } finally {
      await ctx.server.close();
    }
  });
});

describe("B2 — Kurulum Sihirbazı Geri Al, sihirbazın bağlaması ve Bu Hesaba Ata: K7 ve pasif hesap", () => {
  async function setupScenario(policy) {
    const ctx = await bootBank();
    const { api } = ctx;
    const cus = await party(api, "Müşteri");
    await must("eski havale", api.post(ENTRIES(cus.id), { kind: "in", method: "bank", date: "2026-10-05", amount: "1.000" }));
    const A = await openBank(api, "A", "2026-10-01", "0", { negativePolicy: policy });
    const run = await must("sihirbaz", api.post(`${BANK}/setup`, { accountId: A.id, carryClose: true, assign: "all" }));
    const sup = await party(api, "Tedarikçi", "supplier");
    await must("1.000 havale ödeme", api.post(ENTRIES(sup.id), { kind: "out", method: "bank", bankAccountId: A.id, date: TODAY, amount: "1.000" }));
    return { ctx, api, A, run };
  }
  const balance = async (api, A) => (await must("hesap", api.get(`${BANK}/accounts/${A.id}`))).balanceMinor;

  it("Geri Al: Engelle → 409 cash-blocked; Uyar → 409 cash-negative, negativeOk ile geçer", async () => {
    const blocked = await setupScenario("block");
    try {
      const undo = await blocked.api.post(`${BANK}/setup/${blocked.run.id}/undo`, {});
      expectStatus(undo, 409, "cash-blocked", "Geri Al (Engelle)");
      assert.equal(await balance(blocked.api, blocked.A), 0, "bakiye değişmedi");
      const runs = await must("kurulum geçmişi", blocked.api.get(`${BANK}/setup`));
      assert.equal(runs.runs.find(item => item.id === blocked.run.id)?.status, "active", "kurulum etkin kaldı");
    } finally {
      await blocked.ctx.server.close();
    }
    const warned = await setupScenario("warn");
    try {
      expectStatus(await warned.api.post(`${BANK}/setup/${warned.run.id}/undo`, {}), 409, "cash-negative", "Geri Al (Uyar)");
      expectStatus(await warned.api.post(`${BANK}/setup/${warned.run.id}/undo`, { negativeOk: true }), 200, "", "Geri Al (Uyar, Yine de Kaydet)");
      assert.equal(await balance(warned.api, warned.A), -1000 * TL);
      await integrityClean(warned.api, "B2 Geri Al uyar");
    } finally {
      await warned.ctx.server.close();
    }
  });

  it("Geri Al pasif hesapta 400 bank-account-passive", async () => {
    const ctx = await bootBank();
    const { api } = ctx;
    try {
      const cus = await party(api, "Müşteri");
      await must("eski havale", api.post(ENTRIES(cus.id), { kind: "in", method: "bank", date: "2026-10-05", amount: "1.000" }));
      const A = await openBank(api, "A", "2026-10-01", "0");
      const run = await must("sihirbaz", api.post(`${BANK}/setup`, { accountId: A.id, carryClose: true, assign: "all" }));
      await must("pasife al", api.post(`${BANK}/accounts/${A.id}/status`, { status: "passive" }));
      expectStatus(await api.post(`${BANK}/setup/${run.id}/undo`, {}), 400, "bank-account-passive", "pasif hesapta Geri Al");
      assert.equal(await balance(api, A), 1000 * TL, "pasif hesabın bakiyesi değişmedi");
    } finally {
      await ctx.server.close();
    }
  });

  it("Bu Hesaba Ata ve sihirbaz eski ödemeyi Engelle'deki hesaba bağlamaz (409 cash-blocked); Uyar'da negativeOk; pasif hesapta 400", async () => {
    for (const how of ["ata", "sihirbaz"]) {
      const ctx = await bootBank();
      const { api } = ctx;
      try {
        const sup = await party(api, "Tedarikçi", "supplier");
        const p = (await must("eski ödeme", api.post(ENTRIES(sup.id), { kind: "out", method: "bank", date: "2026-10-05", amount: "2.000" }))).entryId;
        const A = await openBank(api, "A", "2026-10-01", "500", { negativePolicy: "block" });
        const send = body => (how === "ata" ? api.post(`${BANK}/legacy/assign`, { accountId: A.id, rows: [{ table: "account_entries", id: p }], ...body }) : api.post(`${BANK}/setup`, { accountId: A.id, carryClose: true, assign: "all", ...body }));
        expectStatus(await send({}), 409, "cash-blocked", `${how}: Engelle`);
        assert.equal(await balance(api, A), 500 * TL, `${how}: bakiye değişmedi`);
        await must("Uyar", api.put(`${BANK}/accounts/${A.id}`, { negativePolicy: "warn" }));
        expectStatus(await send({}), 409, "cash-negative", `${how}: Uyar`);
        await must("pasife al", api.post(`${BANK}/accounts/${A.id}/status`, { status: "passive" }));
        expectStatus(await send({ negativeOk: true }), 400, "bank-account-passive", `${how}: pasif hesap`);
        await must("etkinleştir", api.post(`${BANK}/accounts/${A.id}/status`, { status: "active" }));
        expectStatus(await send({ negativeOk: true }), 200, "", `${how}: Uyar + Yine de Kaydet`);
        assert.equal(await balance(api, A), -1500 * TL);
        await integrityClean(api, `B2 ${how}`);
      } finally {
        await ctx.server.close();
      }
    }
  });
});

describe("B3 — pasif hesapta banka fişi Ters Kaydet / Düzelt ve Açılışı Düzelt 400 bank-account-passive", () => {
  it("masraf Ters Kaydet, Düzelt, transferin alıcısı pasif, Açılışı Düzelt; etkinleştirince Ters Kaydet geçer", async () => {
    const ctx = await bootBank();
    const { api } = ctx;
    try {
      const A = await openBank(api, "A", "2026-10-01", "5.000");
      const B = await openBank(api, "B", "2026-10-01", "5.000");
      const fee = await must("masraf", api.post(`${BANK}/vouchers`, { type: "fee", accountId: B.id, amount: "50", tax: "bsmv_incl", date: TODAY }));
      const tr = await must("transfer", api.post(`${BANK}/transfers`, { type: "transfer", accountId: A.id, toAccountId: B.id, amount: "1.000", date: TODAY }));
      const balance = async () => (await must("B", api.get(`${BANK}/accounts/${B.id}`))).balanceMinor;
      const was = await balance();
      await must("pasife al", api.post(`${BANK}/accounts/${B.id}/status`, { status: "passive" }));
      expectStatus(await api.post(`${BANK}/events/${fee.id}/reverse`, {}), 400, "bank-account-passive", "masraf Ters Kaydet");
      expectStatus(await api.post(`${BANK}/events/${fee.id}/correct`, { amount: "60" }), 400, "bank-account-passive", "masraf Düzelt");
      expectStatus(await api.post(`${BANK}/events/${tr.id}/reverse`, {}), 400, "bank-account-passive", "transfer Ters Kaydet (alıcı pasif)");
      expectStatus(await api.post(`${BANK}/accounts/${B.id}/opening`, { date: "2026-10-01", amount: "7.000", confirmed: true }), 400, "bank-account-passive", "Açılışı Düzelt");
      assert.equal(await balance(), was, "pasif hesabın bakiyesi değişmedi");
      await must("etkinleştir", api.post(`${BANK}/accounts/${B.id}/status`, { status: "active" }));
      expectStatus(await api.post(`${BANK}/events/${fee.id}/reverse`, {}), 200, "", "etkin hesapta Ters Kaydet");
      await integrityClean(api, "B3");
    } finally {
      await ctx.server.close();
    }
  });
});
