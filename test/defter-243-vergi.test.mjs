// 2.4.3 — Uzman mali müşavir MM3 (kullanıcı kararı 18.10.2026): 360 Ödenecek Vergi ve KDV hesapları kapatılabilir.
//   (a) Vergi Ödemesi: bankadan B 360 / A 102 (gecikme zammı B 689), Kasa'dan nakit B 360 / A 100; tür KDV, Muhtasar ve Stopaj, Diğer Vergi; 360
//       bakiyesini aşarsa uyarı (409 tax-exceeds, "Yine de Kaydet" geçer). Plan §3.11: Diğer Gider satırına 360 yine yazılamaz.
//   (b) Ay sonu KDV Mahsup Fişi: 391 ve 191 sıfırlanır, fark 360 (ödenecek) ya da 190 (devreden); önceki devreden kullanılır; aynı ay iki kez yok;
//       mahsuptan sonra o aya KDV'li kayıt → uyarı; geri alma ters kayıt; dönem kilidi; sıra (en son mahsup geri alınır, önceki aya mahsup yapılmaz).
//   Yetki: yönetici + muhasebe (personel 403). Mutabakat Testi her adımda temiz (gl:360, gl:391, gl:191, gl:190, bank:voucher).
// Eski kodda (78fdd05) kırmızı: uçlar yok (404), 360 kapanamıyor.
//
// KÂHİN (elle; fatura tutarlarından, programın kodundan değil):
//   Eylül: kira 10.000 stopaj %20 → 360 A 2.000 · temizlik 2.000 + KDV 400, tevkifat 9/10 (612) → 191 B 400, 360 A 360 · satış 10.000 + KDV 2.000 → 391 A 2.000
//          · alış 4.000 + KDV 800 → 191 B 800.   391 = 2.000, 191 = 1.200, devreden 0 → ödenecek KDV 800:  B 391 2.000 / A 191 1.200 / A 360 800.
//   Ekim:  alış 5.000 + KDV 1.000 → 191 1.000 · satış 2.000 + KDV 400 → 391 400 → indirilecek fazla 600:  B 391 400 / A 191 1.000 / B 190 600.
//   Kasım: satış 5.000 + KDV 1.000 → 391 1.000, devreden 600 → ödenecek 400:  B 391 1.000 / A 190 600 / A 360 400.
//   360 tahakkuk = 2.000 + 360 + 800 + 400 = 3.560. Ödemeler: KDV 800 (banka), Muhtasar 2.000 + gecikme 50 (Kasa), KDV tevkifat 360 (banka) → 360 = 400.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk, must } from "./banka-210-ortak.mjs";
import { BANK, bootBank, expectStatus, lockPeriod, openAccount, trialBalances } from "./banka-210-hesap-ortak.mjs";

const TAX = "/api/workspace/tax";
const NOW = "2026-12-05T12:00:00+03:00";
const bal = (rows, code) => rows[code] ?? 0;

describe("2.4.3 MM3 — Vergi Ödemesi ve KDV Mahsup Fişi", () => {
  let ctx;
  let api;
  let ziraat;
  const ids = {};
  before(async () => {
    ctx = await bootBank({ now: NOW });
    api = ctx.api;
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", opening: { date: "2026-09-01", amount: "100.000", confirmed: true } });
    const acc = async (key, name, type) => (ids[key] = (await must(name, api.post("/api/workspace/accounts", { name, type }))).id);
    await acc("M1", "Müşteri Bir", "customer");
    await acc("T1", "Kırtasiyeci", "supplier");
    await acc("T3", "Temizlik Ltd.", "supplier");
    await acc("T4", "Kiraya Veren", "supplier");
    const inv = (label, body) => must(label, api.post("/api/workspace/invoices", body));
    await inv("kira (stopaj)", { kind: "purchase", scenario: "expense_purchase", accountId: ids.T4, issueDate: "2026-09-01", number: "KIRA-09", profile: "KAGIT", stoppageRate: 20, lines: [{ name: "Eylül Kirası", qty: 1, unitPrice: 10000, vatRate: 0, exemptionCode: "351", expenseCode: "rent" }], payment: { rest: "open" } });
    await inv("temizlik (tevkifat)", { kind: "purchase", scenario: "expense_purchase", accountId: ids.T3, issueDate: "2026-09-04", number: "PRL-33", profile: "KAGIT", lines: [{ name: "Temizlik Hizmeti", qty: 1, unitPrice: 2000, vatRate: 20, withholdingCode: "612", expenseCode: "cleaning" }], payment: { rest: "open" } });
    await inv("Eylül satış", { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-09-05", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 10000, vatRate: 20 }], payment: { rest: "open" } });
    await inv("Eylül alış", { kind: "purchase", scenario: "expense_purchase", accountId: ids.T1, issueDate: "2026-09-06", number: "AL-1", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 4000, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } });
    await inv("Ekim alış", { kind: "purchase", scenario: "expense_purchase", accountId: ids.T1, issueDate: "2026-10-03", number: "AL-2", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 5000, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } });
    await inv("Ekim satış", { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-10-04", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 2000, vatRate: 20 }], payment: { rest: "open" } });
    await inv("Kasım satış", { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-11-05", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 5000, vatRate: 20 }], payment: { rest: "open" } });
    await integrityOk(api, "faturalar");
  });
  after(() => ctx?.server.close());

  it("başlangıç (kâhin): 391 = −3.400, 191 = 2.200, 360 = −2.360", async () => {
    const tb = await trialBalances(api);
    assert.equal(bal(tb, "391"), -3400);
    assert.equal(bal(tb, "191"), 2200);
    assert.equal(bal(tb, "360"), -2360);
  });

  it("KDV Mahsup Fişi Eylül: ön izleme B 391 2.000 / A 191 1.200 / A 360 800; oluşturulunca Eylül sonu 391 = 191 = 0; aynı ay ikinci kez 409", async () => {
    const view = (await must("ön izleme", api.get(`${TAX}/vat-offset?month=2026-09`))).preview;
    assert.deepEqual(view.lines.map(line => [line.account, line.debitMinor, line.creditMinor]), [["391", 200000, 0], ["191", 0, 120000], ["360", 0, 80000]]);
    assert.equal(view.result, "payable");
    assert.equal(view.allowed, true);
    await must("mahsup Eylül", api.post(`${TAX}/vat-offset`, { month: "2026-09" }));
    const sep = await trialBalances(api, "?to=2026-09-30");
    assert.equal(bal(sep, "391"), 0);
    assert.equal(bal(sep, "191"), 0);
    assert.equal(bal(sep, "360"), -3160, "2.000 stopaj + 360 tevkifat + 800 ödenecek KDV");
    expectStatus(await api.post(`${TAX}/vat-offset`, { month: "2026-09" }), 409, "vat-offset-blocked", "aynı ay ikinci kez");
    const journal = await must("yevmiye", api.get("/api/workspace/report-center/yevmiye?from=2026-09-30&to=2026-09-30"));
    assert.ok(journal.rows.some(row => row[1] === "KDV Mahsup Fişi" && row[3] === "360" && row[5] === "800,00 TL"), JSON.stringify(journal.rows));
    await integrityOk(api, "Eylül mahsubu");
  });

  it("Ekim: indirilecek fazla → B 391 400 / A 191 1.000 / B 190 600 (devreden); Kasım: devreden kullanılır → B 391 1.000 / A 190 600 / A 360 400", async () => {
    const oct = (await must("Ekim ön izleme", api.get(`${TAX}/vat-offset?month=2026-10`))).preview;
    assert.deepEqual(oct.lines.map(line => [line.account, line.debitMinor, line.creditMinor]), [["391", 40000, 0], ["191", 0, 100000], ["190", 60000, 0]]);
    assert.equal(oct.result, "carry");
    await must("mahsup Ekim", api.post(`${TAX}/vat-offset`, { month: "2026-10" }));
    assert.equal(bal(await trialBalances(api, "?to=2026-10-31"), "190"), 600);
    const nov = (await must("Kasım ön izleme", api.get(`${TAX}/vat-offset?month=2026-11`))).preview;
    assert.deepEqual(nov.lines.map(line => [line.account, line.debitMinor, line.creditMinor]), [["391", 100000, 0], ["190", 0, 60000], ["360", 0, 40000]]);
    await must("mahsup Kasım", api.post(`${TAX}/vat-offset`, { month: "2026-11" }));
    const tb = await trialBalances(api);
    assert.equal(bal(tb, "391"), 0);
    assert.equal(bal(tb, "191"), 0);
    assert.equal(bal(tb, "190"), 0);
    assert.equal(bal(tb, "360"), -3560, "kâhin: 2.000 + 360 + 800 + 400");
    await integrityOk(api, "üç ay");
  });

  it("sıra: Aralık bitmeden mahsup yok; önceki aya yeni mahsup ve sondan olmayan geri alma 409", async () => {
    const dec = (await must("Aralık", api.get(`${TAX}/vat-offset?month=2026-12`))).preview;
    assert.equal(dec.allowed, false);
    assert.match(dec.blocks.join(" "), /henüz bitmedi/);
    const offsets = (await must("liste", api.get(`${TAX}/vat-offset`))).offsets;
    const oct = offsets.find(item => item.month === "2026-10");
    expectStatus(await api.post(`${TAX}/vat-offset/${oct.id}/reverse`, {}), 409, "vat-offset-later", "Ekim geri alınamaz (Kasım etkin)");
  });

  it("Vergi Ödemesi bankadan (KDV 800) ve Kasa'dan (Muhtasar 2.000 + gecikme 50): 360 düşer, 689 = 50, 100 / 102 azalır; Banka Fişi tax_payment", async () => {
    const card = (await must("bankadan KDV", api.post(`${TAX}/payments`, { way: "bank", accountId: ziraat.id, date: "2026-10-26", taxType: "kdv", amount: "800", description: "Eylül KDV" }))).card;
    assert.equal(card.type, "tax_payment");
    assert.equal(card.typeLabel, "Vergi Ödemesi");
    assert.deepEqual(card.lines.map(line => [line.gl, line.side, line.tryMinor, line.memo]), [["360", "D", 80000, "Ödenen Vergi · KDV"], ["102", "C", 80000, ""]]);
    const cash = await must("Kasa'dan muhtasar", api.post(`${TAX}/payments`, { way: "cash", date: "2026-10-26", taxType: "muhtasar", amount: "2.000", lateAmount: "50", cashForce: true }));
    ids.cashTax = cash.id;
    ids.bankTax = card.id;
    const tb = await trialBalances(api);
    assert.equal(bal(tb, "360"), -760);
    assert.equal(bal(tb, "689"), 50);
    assert.equal(bal(tb, "100"), -2050);
    assert.equal(bal(tb, "102"), 99200);
    const tax = await must("vergi", api.get(TAX));
    assert.deepEqual(Object.fromEntries(tax.types.map(item => [item.key, item.balanceMinor])), { kdv: 76000, muhtasar: 0, other: 76000 }, "KDV kalan 360 tevkifat + 400 Kasım");
    const kasa = await must("Kasa", api.get("/api/workspace/cash"));
    assert.ok(kasa.entries.some(entry => entry.id === ids.cashTax && entry.kind === "out" && entry.amount === 2050), "Kasa'da çıkış");
    await integrityOk(api, "ödemeler");
  });

  it("360 bakiyesini aşan ödeme uyarı verir (409 tax-exceeds); Yine de Kaydet (exceedOk) geçer; Ters Kaydet 360'ı geri getirir; Düzelt 409", async () => {
    const res = await api.post(`${TAX}/payments`, { way: "bank", accountId: ziraat.id, date: "2026-11-26", taxType: "kdv", amount: "5.000" });
    expectStatus(res, 409, "tax-exceeds", "aşan KDV ödemesi");
    assert.match(res.error, /Yine de kaydedilsin mi\?/);
    assert.equal(bal(await trialBalances(api), "360"), -760, "uyarıda yazılmadı");
    const forced = (await must("yine de", api.post(`${TAX}/payments`, { way: "bank", accountId: ziraat.id, date: "2026-11-26", taxType: "other", amount: "1.000", exceedOk: true }))).card;
    assert.equal(bal(await trialBalances(api), "360"), 240, "360 borç bakiyesine geçti (fazla ödeme)");
    await integrityOk(api, "fazla ödeme");
    expectStatus(await api.post(`${BANK}/events/${forced.id}/correct`, { amount: "900" }), 409, "tax-payment-correct", "Düzelt yok");
    await must("Ters Kaydet", api.post(`${BANK}/events/${forced.id}/reverse`, {}));
    assert.equal(bal(await trialBalances(api), "360"), -760);
    await integrityOk(api, "ters kayıt");
  });

  it("plan §3.11 aynen: Diğer Gider satırına 360 yazılamaz (400 bank-gl-forbidden); Kasa'daki vergi satırı Kasa'dan düzeltilmez (409); silinir ve geri gelir", async () => {
    expectStatus(await api.post(`${BANK}/vouchers`, { type: "other_out", accountId: ziraat.id, date: "2026-11-27", amount: "100", gl: "360" }), 400, "bank-gl-forbidden", "Diğer Gider 360");
    expectStatus(await api.put(`/api/workspace/cash/${ids.cashTax}`, { kind: "out", amount: "2.050", date: "2026-10-26", description: "x", cashForce: true }), 409, "cash-tax-payment", "Kasa'dan düzeltme");
    await must("Kasa'dan sil", api.del(`/api/workspace/cash/${ids.cashTax}?cashForce=1`));
    let tb = await trialBalances(api);
    assert.equal(bal(tb, "360"), -2760);
    assert.equal(bal(tb, "689"), 0);
    await integrityOk(api, "silindi");
    const trash = await must("çöp", api.get("/api/admin/trash"));
    const item = trash.find(entry => entry.kind === "cash" && entry.ref === ids.cashTax);
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id, cashForce: true }));
    tb = await trialBalances(api);
    assert.equal(bal(tb, "360"), -760);
    assert.equal(bal(tb, "689"), 50);
    await integrityOk(api, "geri geldi");
  });

  it("mahsuptan sonra o aya KDV'li kayıt gelince uyarı (liste ve KDV Özeti); geri al + yeniden yap düzeltir; geri alma ters kayıttır", async () => {
    await must("Kasım'a geç alış", api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: ids.T1, issueDate: "2026-11-10", number: "AL-3", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 500, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }));
    let list = (await must("liste", api.get(`${TAX}/vat-offset`))).offsets;
    const nov = list.find(item => item.month === "2026-11" && item.status === "active");
    assert.equal(nov.stale, true);
    const kdv = await must("KDV Özeti", api.get("/api/workspace/report-center/kdv-ozeti?from=2026-01-01&to=2026-12-31"));
    assert.ok(kdv.summary.some(([key, value]) => key === "Mahsuptan Sonra Değişen Ay" && /Kasım 2026/.test(value)), JSON.stringify(kdv.summary));
    assert.ok(kdv.summary.some(([key, value]) => key === "KDV Mahsup Fişi" && /Eylül 2026/.test(value)));
    await must("geri al", api.post(`${TAX}/vat-offset/${nov.id}/reverse`, {}));
    const journal = await must("yevmiye", api.get("/api/workspace/report-center/yevmiye?from=2026-11-30&to=2026-11-30"));
    assert.ok(journal.rows.some(row => row[1] === "KDV Mahsup Fişi (Ters Kayıt)"), "ters kayıt yevmiyede");
    const again = (await must("yeniden", api.post(`${TAX}/vat-offset`, { month: "2026-11" }))).offset;
    assert.deepEqual(again.lines.map(line => [line.account, line.debitMinor, line.creditMinor]), [["391", 100000, 0], ["191", 0, 10000], ["190", 0, 60000], ["360", 0, 30000]], "Kasım: 1.000 − 100 − 600 = 300 ödenecek");
    list = (await must("liste", api.get(`${TAX}/vat-offset`))).offsets;
    assert.ok(!list.some(item => item.stale));
    const tb = await trialBalances(api);
    assert.equal(bal(tb, "191"), 0);
    assert.equal(bal(tb, "391"), 0);
    assert.equal(bal(tb, "360"), -660, "760 − 100");
    await integrityOk(api, "yeniden mahsup");
  });

  it("dönem kilidi: Eylül kilitliyken Eylül mahsubu geri alınamaz ve Eylül'e yeni mahsup yazılamaz; kilit açılınca geri alınır", async () => {
    await lockPeriod(api, "2026-09-30");
    const list = (await must("liste", api.get(`${TAX}/vat-offset`))).offsets;
    // Eylül'ü geri almak için önce Kasım ve Ekim geri alınmalı; Kasım ve Ekim açık dönemde.
    const active = month => list.find(item => item.month === month && item.status === "active");
    await must("Kasım geri", api.post(`${TAX}/vat-offset/${active("2026-11").id}/reverse`, {}));
    await must("Ekim geri", api.post(`${TAX}/vat-offset/${active("2026-10").id}/reverse`, {}));
    const res = await api.post(`${TAX}/vat-offset/${active("2026-09").id}/reverse`, {});
    assert.equal(res.status, 409, JSON.stringify(res.data));
    await integrityOk(api, "kilit");
    await lockPeriod(api, "");
    await must("Eylül geri", api.post(`${TAX}/vat-offset/${active("2026-09").id}/reverse`, {}));
    await lockPeriod(api, "2026-09-30");
    const blocked = await api.post(`${TAX}/vat-offset`, { month: "2026-09" });
    expectStatus(blocked, 409, "vat-offset-blocked", "kilitli aya yeni mahsup");
    assert.match(blocked.error, /kapanmış dönemde/);
    await lockPeriod(api, "");
    const tb = await trialBalances(api);
    assert.equal(bal(tb, "391"), -3400);
    assert.equal(bal(tb, "191"), 2300);
    assert.equal(bal(tb, "190"), 0);
    assert.equal(bal(tb, "360"), -2360 + 800 + 2000 + 1000 - 1000, "mahsuplar geri alındı; ödemeler (KDV 800, muhtasar 2.000) kalır");
    await integrityOk(api, "hepsi geri");
  });

  it("yetki: personel 403 (vergi, ödeme, mahsup); muhasebe yapar; Rapor Merkezi KDV Özeti'nde düğme yalnız yetkiliye", async () => {
    const staff = apiOf(await createUser(ctx.server, api.client, { username: "v243-personel", role: "personel" }));
    for (const [method, url, body] of [["get", TAX], ["post", `${TAX}/payments`, { way: "cash", taxType: "kdv", amount: "1" }], ["get", `${TAX}/vat-offset?month=2026-09`], ["post", `${TAX}/vat-offset`, { month: "2026-09" }]]) {
      assert.equal((await staff[method](url, body)).status, 403, `personel ${method} ${url}`);
    }
    const accountant = apiOf(await createUser(ctx.server, api.client, { username: "v243-muhasebe", role: "muhasebe" }));
    await must("muhasebe ön izleme", accountant.get(`${TAX}/vat-offset?month=2026-09`));
    await must("muhasebe mahsup", accountant.post(`${TAX}/vat-offset`, { month: "2026-09" }));
    const catalog = await must("katalog", accountant.get("/api/workspace/report-center"));
    assert.deepEqual(catalog.reports.find(item => item.id === "kdv-ozeti")?.actions, [{ id: "vat-offset", label: "KDV Mahsup Fişi Oluştur" }]);
    const role = await must("rol", api.post("/api/admin/roles", { name: "Fatura Okuyucu 243", permissions: ["invoices.view", "overview.view"] }));
    const reader = apiOf(await createUser(ctx.server, api.client, { username: "v243-okur", role: role.id }));
    const readerCatalog = await must("okur katalog", reader.get("/api/workspace/report-center"));
    const kdv = readerCatalog.reports.find(item => item.id === "kdv-ozeti");
    if (kdv) assert.equal(kdv.actions, undefined, "yetkisize düğme yok");
    await integrityOk(api, "yetki");
  });
});
