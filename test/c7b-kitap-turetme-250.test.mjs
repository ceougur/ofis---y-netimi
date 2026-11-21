// 2.5.0 Ç7b — kitap türetme kuralları: fatura / KDV / taksit / kayıt (docs/erp/C7B-FATURA-TASARIM.md §1–§2, §11). Beklenenler testin KENDİ elle hesabı (kural kitabı satırı +
// kullanıcı kararı), programın çıktısından değil (ders 5):
//   K-01 / K-02 (KG-3 A + BAŞ MİMAR KARARI 19.11): carisiz Kasa girişi B 100 / A 649.90, çıkışı B 770.90 / A 100 · C-01 / C-02 (KG-4 A): Borç Yaz A 602.90, Alacak Yaz B 770.90 ·
//   KG-2 = A (S-03 / S-04 / H-03): stok satışı (veresiye / peşin) A 600.90, müşteri iadesi B 610.90, taksit Yeni Borç A 600.90 — tamamı, KDV ayrılmaz · KG-3 = A (T-14): kayıt
//   tahsilatı A 336.90 (gelir değil; cari değil) · KG-24 = A (F-02): ihracat istisna kodlu (301 / 302) kalem 601 · KG-8 = A (F-07): satıştan iade KDV'si B 191 · F-08: alıştan iade KDV'si
//   A 391 · F-06 / M14: gider türü → 770 / 760 / 255 (+ 653 komisyon) — kod değişmedi, kalıcı test.
// ÖRNEK (sahte saat 08.10.2026; Eylül 2026; TL): Kasa açılışı 1.000 (519 — .90'a GİTMEZ) · Kasa + 300 · Kasa − 200 · M1 Borç Yaz 500 · M1 Alacak Yaz 150 · ürün açık hesap alımı 10 × 100
//   (T1) · veresiye satış 4 × 300 = 1.200 (M1) · müşteri iadesi (cari) 240 · peşin satış 2 × 300 = 600 · peşin iade 120 · taksit Yeni Borç 6.000 (M1) · Mevcut Borcu Taksitlendir 500 (madde
//   yok) · kayıt tahsilatı 1.000 · S1 satış 10 × 1.000 %20 (10.000 + 2.000) · E1 ihracat 5.000 %0 (301) · X1 karma: 3.000 %20 + 2.000 %0 (302) · S1'den iade 1 × 1.000 (+200) · P1 gider
//   alışı (T1): Kırtasiye 2 × 1.000, Reklam 1.000, Demirbaş 500, POS Komisyonu 100, hepsi %20 (KDV 720) · P1'den iade Kırtasiye 1 × 1.000 (+200).
//   Mizan: 649 / 649.90 = −300 · 770 = 200 + 150 + 1.000 = 1.350, 770.90 = 350 · 602 = 0, 602.90 = −500 · 600 = −(1.200 + 600 + 6.000 + 10.000 + 3.000) = −20.800, 600.90 = −7.800 ·
//   601 = −7.000 · 610 = 240 + 120 + 1.000 = 1.360, 610.90 = 360 · 336 = 336.90 = −1.000 · 191 = 720 + 200 = 920 · 391 = −(2.000 + 600 + 200) = −2.800 · 760 1.000 · 255 500 · 653 100.
//   KDV Mahsup (Eylül): H = 2.800, İ = 920, ödenecek 1.880 — eski kuralla da H = 2.400, İ = 520, ödenecek 1.880 (KG-8: "mahsup sonucu iki dalda aynı"); mahsuptan sonra 191 = 391 = 0.
// NASIL BOZARIM: Kasa / Borç Yaz / Alacak Yaz alt hesabını düşürmek (649 / 602 / 770 ana hesapta — alt hesap beklenini kırılır); Kasa açılışını .90'a göndermek (519 kırılır);
//   belgesizde KDV ayırmak (600.90 ≠ tutar); Mevcut Borç kartını 600.90'a yazmak (çift gelir); kayıt tahsilatını 602'ye geri yazmak (336.90 kırılır) ya da expected 336'yı
//   unutmak (Defter Mutabakatı 336 farkı); ihracatı 600'de bırakmak / karma faturayı bütünüyle 601'e taşımak; iade KDV'sini eski hesaba yazmak (191 / 391 ve mahsup İ / H kırılır).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { BANK, bootBank, trialBalances } from "./banka-210-hesap-ortak.mjs";
import { subBalances } from "../server/lib/general-ledger.mjs";

const TAX = "/api/workspace/tax";
const lineSet = entry => entry.lines.map(line => `${line.account}${line.sub ? `/${line.sub}` : ""}:${line.debit}:${line.credit}`).sort();

describe("Ç7b — fatura / KDV / taksit / kayıt türetme kuralları (KG-2, KG-3, KG-4, KG-8, KG-24, F-06, F-08, K-01 / K-02)", () => {
  let ctx;
  let api;
  const ids = {};
  const entries = () => ctx.server.app.ledger.build();
  const entryOf = id => {
    const list = entries().filter(entry => entry.id === id);
    assert.equal(list.length, 1, `${id}: tek madde (${list.length})`);
    return list[0];
  };
  const last = (table, where = "1 = 1", ...args) => ctx.store.get(`SELECT id FROM ${table} WHERE ${where} ORDER BY rowid DESC LIMIT 1`, ...args).id;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    const acc = async (key, name, type) => (ids[key] = (await must(name, api.post("/api/workspace/accounts", { name, type, registeredOn: "2026-09-01" }))).id);
    await acc("M1", "Müşteri Bir", "customer");
    await acc("T1", "Tedarikçi Bir", "supplier");
    await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "1.000", date: "2026-09-01" }));
    ids.cashOpen = last("cash_entries");
    await must("Kasa +", api.post("/api/workspace/cash", { kind: "in", amount: "300", method: "cash", date: "2026-09-02", description: "Hurda satışı" }));
    ids.cashIn = last("cash_entries");
    await must("Kasa −", api.post("/api/workspace/cash", { kind: "out", amount: "200", method: "cash", date: "2026-09-02", description: "Çay ocağı" }));
    ids.cashOut = last("cash_entries");
    await must("Borç Yaz", api.post(`/api/workspace/accounts/${ids.M1}/entries`, { kind: "debt", amount: "500", date: "2026-09-03", note: "Hizmet bedeli" }));
    ids.debt = last("account_entries", "account_id = ?", ids.M1);
    await must("Alacak Yaz", api.post(`/api/workspace/accounts/${ids.M1}/entries`, { kind: "credit", amount: "150", date: "2026-09-03", note: "İndirim" }));
    ids.credit = last("account_entries", "account_id = ?", ids.M1);
    const item = await must("ürün", api.post("/api/workspace/stock", { name: "Vida Kutusu", unit: "Adet", kind: "product", code: "VK-1", unitPrice: "100", vatRate: "20" }));
    ids.item = item.id || item.item?.id;
    const move = body => must(`stok ${body.note}`, api.post(`/api/workspace/stock/${ids.item}/moves`, { date: "2026-09-04", ...body }));
    await move({ kind: "in", qty: "10", unitPrice: "100", pay: "account", accountId: ids.T1, note: "Açık hesap alım" });
    await move({ kind: "out", qty: "4", unitPrice: "300", pay: "account", accountId: ids.M1, note: "Veresiye satış" });
    ids.stockDebt = last("account_entries", "account_id = ? AND source = 'stock'", ids.M1);
    await move({ kind: "in", qty: "1", unitPrice: "240", pay: "account", accountId: ids.M1, reason: "return", note: "Müşteri iadesi" });
    ids.stockReturn = last("account_entries", "account_id = ? AND source = 'stock'", ids.M1);
    await move({ kind: "out", qty: "2", unitPrice: "300", pay: "cash", method: "cash", note: "Peşin satış" });
    ids.cashSale = last("stock_moves");
    await move({ kind: "in", qty: "1", unitPrice: "120", pay: "cash", method: "cash", reason: "return", note: "Peşin iade" });
    ids.cashReturn = last("stock_moves");
    const plan = await must("Yeni Borç kartı", api.post("/api/workspace/plans", { accountId: ids.M1, name: "M1 Taksit", total: "6.000", registeredOn: "2026-09-05", mode: "auto", count: 3, firstDue: "2026-10-05" }));
    ids.plan = plan.id || plan.plan?.id;
    const covers = await must("Mevcut Borç kartı", api.post("/api/workspace/plans", { accountId: ids.M1, name: "M1 Borç", total: "500", registeredOn: "2026-09-05", mode: "auto", count: 1, firstDue: "2026-10-05", coversBalance: true }));
    ids.covers = covers.id || covers.plan?.id;
    await must("kayıt tahsilatı", api.post("/api/workspace/cases/DOSYA-1/payments", { amount: "1.000", date: "2026-09-06", method: "cash", caseTitle: "Dosya Bir" }));
    ids.payment = last("payments");
    const inv = (label, body) => must(label, api.post("/api/workspace/invoices", body));
    const S1 = await inv("S1 satış", { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-09-10", lines: [{ name: "Danışmanlık", qty: 10, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } });
    ids.S1 = S1.id;
    ids.E1 = (await inv("E1 ihracat", { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-09-11", lines: [{ name: "Yurt Dışı Danışmanlık", qty: 1, unitPrice: 5000, vatRate: 0, exemptionCode: "301" }], payment: { rest: "open" } })).id;
    ids.X1 = (await inv("X1 karma", { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-09-12", lines: [{ name: "Yurt İçi", qty: 1, unitPrice: 3000, vatRate: 20 }, { name: "Yurt Dışı", qty: 1, unitPrice: 2000, vatRate: 0, exemptionCode: "302" }], payment: { rest: "open" } })).id;
    const P1 = await inv("P1 gider alışı", { kind: "purchase", scenario: "expense_purchase", accountId: ids.T1, issueDate: "2026-09-13", number: "AL-1", lines: [
      { name: "Kırtasiye", qty: 2, unitPrice: 1000, vatRate: 20, expenseCode: "office" },
      { name: "Reklam", qty: 1, unitPrice: 1000, vatRate: 20, expenseCode: "marketing" },
      { name: "Bilgisayar", qty: 1, unitPrice: 500, vatRate: 20, expenseCode: "asset" },
      { name: "POS Komisyonu", qty: 1, unitPrice: 100, vatRate: 20, expenseCode: "commission" },
    ], payment: { rest: "open" } });
    ids.P1 = P1.id;
    const card = id => must("fatura", api.get(`/api/workspace/invoices/${id}`));
    const s1Line = (await card(ids.S1)).lines[0].id;
    ids.SR = (await inv("S1 iadesi", { kind: "sale_return", accountId: ids.M1, originalId: ids.S1, issueDate: "2026-09-20", lines: [{ originLineId: s1Line, qty: 1 }], payment: { cash: [] }, force: true })).id;
    const officeLine = (await card(ids.P1)).lines.find(line => line.name === "Kırtasiye").id;
    ids.PR = (await inv("P1 iadesi", { kind: "purchase_return", accountId: ids.T1, originalId: ids.P1, issueDate: "2026-09-21", number: "AI-1", lines: [{ originLineId: officeLine, qty: 1 }], payment: { cash: [] }, force: true })).id;
  });
  after(() => ctx?.server.close());

  it("1. K-01 / K-02 / C-01 / C-02: carisiz Kasa 649.90 / 770.90, Borç Yaz 602.90, Alacak Yaz 770.90; Kasa açılışı 519'da kalır", () => {
    assert.deepEqual(lineSet(entryOf(`cash:${ids.cashIn}`)), ["100:30000:0", "649/649.90:0:30000"], "Kasa + B 100 / A 649.90");
    assert.deepEqual(lineSet(entryOf(`cash:${ids.cashOut}`)), ["100:0:20000", "770/770.90:20000:0"], "Kasa − B 770.90 / A 100");
    assert.deepEqual(lineSet(entryOf(`cash:${ids.cashOpen}`)), ["100:100000:0", "519:0:100000"], "Kasa açılışı B 100 / A 519 (alt hesapsız)");
    assert.deepEqual(lineSet(entryOf(`account:${ids.debt}`)), ["120:50000:0", "602/602.90:0:50000"], "Borç Yaz B 120 / A 602.90");
    assert.deepEqual(lineSet(entryOf(`account:${ids.credit}`)), ["120:0:15000", "770/770.90:15000:0"], "Alacak Yaz B 770.90 / A 120");
  });

  it("2. KG-2 = A: stok satışı / iadesi ve taksit Yeni Borç belgesiz alt hesapta, tutarın TAMAMI (KDV ayrılmaz); Mevcut Borç kartı maddesiz", () => {
    assert.deepEqual(lineSet(entryOf(`account:${ids.stockDebt}`)), ["120:120000:0", "600/600.90:0:120000"], "veresiye satış 1.200 tamamı 600.90");
    assert.deepEqual(lineSet(entryOf(`account:${ids.stockReturn}`)), ["120:0:24000", "610/610.90:24000:0"], "müşteri iadesi 240 B 610.90");
    assert.deepEqual(lineSet(entryOf(`stock:${ids.cashSale}`)), ["100:60000:0", "600/600.90:0:60000"], "peşin satış 600");
    assert.deepEqual(lineSet(entryOf(`stock:${ids.cashReturn}`)), ["100:0:12000", "610/610.90:12000:0"], "peşin iade 120");
    assert.deepEqual(lineSet(entryOf(`plan:${ids.plan}`)), ["120:600000:0", "600/600.90:0:600000"], "Yeni Borç 6.000 A 600.90 (602 değil)");
    assert.equal(entries().filter(entry => entry.id === `plan:${ids.covers}`).length, 0, "Mevcut Borcu Taksitlendir kartı yeni alacak değil — madde yok");
  });

  it("3. KG-3 = A: kayıt tahsilatı B 100 / A 336.90 — gelir değil, cari satırı değil", () => {
    const entry = entryOf(`payment:${ids.payment}`);
    assert.deepEqual(lineSet(entry), ["100:100000:0", "336/336.90:0:100000"]);
    assert.equal(entry.lines.find(line => line.account === "336").party, undefined, "336.90 satırı bir cariye ait değil");
  });

  it("4. KG-24 = A: ihracat kalemi 601; karma faturada yalnız istisna kodlu kalem", () => {
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.E1}`)), ["120:500000:0", "601:0:500000"], "E1 B 120 / A 601 5.000, 391 yok");
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.X1}`)), ["120:560000:0", "391:0:60000", "600:0:300000", "601:0:200000"], "X1 600 3.000 + 601 2.000 + 391 600");
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.S1}`)), ["120:1200000:0", "391:0:200000", "600:0:1000000"], "yurt içi satış değişmez (F-01)");
  });

  it("5. KG-8 = A / F-08: satıştan iade KDV'si B 191, alıştan iade KDV'si A 391; F-06 / M14 gider türü hesapları", () => {
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.SR}`)), ["120:0:120000", "191:20000:0", "610:100000:0"], "satıştan iade B 610 1.000, B 191 200 / A 120 1.200");
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.PR}`)), ["320:120000:0", "391:0:20000", "770:0:100000"], "alıştan iade B 320 1.200 / A 770 1.000, A 391 200");
    assert.deepEqual(lineSet(entryOf(`invoice:${ids.P1}`)), ["191:72000:0", "255:50000:0", "320:0:432000", "653:10000:0", "760:100000:0", "770:200000:0"], "F-06: 770 / 760 / 255 / 653 + 191");
  });

  it("6. mizan, alt hesap mizanı ve Defter Mutabakatı (336 / 191 / 391 beklenenleri) temiz", async () => {
    const trial = await trialBalances(api);
    const subs = Object.fromEntries([...subBalances(entries())].map(([sub, minor]) => [sub, minor / 100]));
    assert.equal(trial["649"], -300);
    assert.equal(subs["649.90"], -300);
    assert.equal(trial["770"], 1350);
    assert.equal(subs["770.90"], 350);
    assert.equal(trial["602"] ?? 0, -500);
    assert.equal(subs["602.90"], -500);
    assert.equal(trial["600"], -20800);
    assert.equal(subs["600.90"], -7800);
    assert.equal(trial["601"], -7000);
    assert.equal(trial["610"], 1360);
    assert.equal(subs["610.90"], 360);
    assert.equal(trial["336"], -1000);
    assert.equal(subs["336.90"], -1000);
    assert.equal(trial["191"], 920);
    assert.equal(trial["391"], -2800);
    assert.equal(trial["519"], -1000);
    await integrityOk(api, "Ç7b kuralları");
    const ledger = await must("Defter Mutabakatı", api.get("/api/workspace/ledger"));
    const check = code => ledger.reconciliation.checks.find(item => item.code === code);
    for (const code of ["336", "191", "391", "120", "100"]) assert.equal(check(code)?.ok, true, `${code} Defter Mutabakatı`);
    assert.equal(check("336").subledger, -1000, "336 beklenen = carilerin toplamı (0) − kayıt tahsilatları (1.000)");
  });

  it("7. KDV Mahsup (Eylül): H 2.800, İ 920, ödenecek 1.880 (eski kuralla da 1.880); mahsuptan sonra 191 = 391 = 0", async () => {
    const view = (await must("ön izleme", api.get(`${TAX}/vat-offset?month=2026-09`))).preview;
    assert.equal(view.outMinor, 280000);
    assert.equal(view.inMinor, 92000);
    assert.equal(view.payableMinor, 188000);
    await must("mahsup", api.post(`${TAX}/vat-offset`, { month: "2026-09" }));
    const trial = await trialBalances(api);
    assert.equal(trial["191"] ?? 0, 0);
    assert.equal(trial["391"] ?? 0, 0);
    assert.equal(trial["360"], -1880);
    await integrityOk(api, "mahsuptan sonra");
  });
});
