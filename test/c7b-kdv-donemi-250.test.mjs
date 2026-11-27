// 2.5.0 Ç7b tur 2d — KG-7 = A "KDV İndirim Dönemi" (KDVK 29/3; EK-1 M8 (1), (2), (6); docs/erp/C7B-FATURA-TASARIM.md §2.6, §14). Alış faturasının 191'i dönem ayının KDV mahsubuna girer
// (varsayılan belge ayı; en geç belge yılını izleyen yılın Aralık'ı); defter maddesi DEĞİŞMEZ (191 belge tarihinde). Beklenenler testin KENDİ elle hesabı (ders 5):
//   Sahte saat 10.02.2027. Aralık 2026: satış S1 10.000 + KDV 2.000 (10.12), alış P1 1.000 + KDV 200 (15.12, dönem boş = Aralık), alış P2 2.000 + KDV 400 (31.12 — ay / yıl sonu, dönem Ocak 2027:
//   "geç gelen Aralık faturası"). Ocak 2027: satış S2 1.000 + 200 (10.01), alış P3 500 + 100 (20.01).
//   Aralık mahsubu: H 2.000 / İ 200 / ödenecek 1.800 (P2 YOK). Mahsuptan sonra 31.12'de 191 = 400 (P2 belge tarihinde, mahsupsuz), 391 = 0.
//   Ocak mahsubu: H 200 / İ 100 + 400 = 500 / D 0 → devreden 300. Sonra 191 = 0, 391 = 0, 190 = 300, 360 = −1.800.
// NASIL BOZARIM (§14.8): alanı yok saymak (Aralık İ 600, Ocak İ 100); sınırı bir ay kaydırmak (izleyen yılın Aralık'ı reddedilir ya da Ocak'ı kabul edilir; belge ayından önceki ay kabul);
//   satışta / iadede alanı sessizce kabul etmek; belge ayını '' yerine saklamak; Düzenle'de aralık dışı dönemi kabul etmek; mahsubu yapılmış aydan çıkan KDV'yi iki kez indirmek.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { BANK, bootBank, trialBalances } from "./banka-210-hesap-ortak.mjs";

const TAX = "/api/workspace/tax";
const INV = "/api/workspace/invoices";
const NOW = "2027-02-10T12:00:00+03:00";

const preview = async (api, month) => (await must(`ön izleme ${month}`, api.get(`${TAX}/vat-offset?month=${month}`))).preview;
const offsets = async api => (await must("liste", api.get(`${TAX}/vat-offset`))).offsets;
const rejected = async (label, promise, status, code, pattern) => {
  const res = await promise;
  assert.equal(res.status, status, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  assert.equal(res.data?.code, code, `${label}: kod ${JSON.stringify(res.data)}`);
  assert.equal(res.data?.field, "vatPeriod", `${label}: alan`);
  if (pattern) assert.match(String(res.data?.error || res.data?.message || ""), pattern, `${label}: ileti ${JSON.stringify(res.data)}`);
  return res.data;
};

describe("Ç7b KG-7 — alış faturasında KDV İndirim Dönemi", () => {
  let ctx;
  let api;
  const ids = {};
  let n = 0;
  const buyBody = (date, net, extra = {}) => ({ kind: "purchase", scenario: "expense_purchase", accountId: ids.T1, issueDate: date, number: `AL-${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" }, ...extra });
  const buy = async (date, net, extra = {}) => (await must(`alış ${date}`, api.post(INV, buyBody(date, net, extra)))).id;
  const sell = async (date, net) => (await must(`satış ${date}`, api.post(INV, { scenario: "service_sale", accountId: ids.M1, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id;
  // Sütunsuz şemada (göç 52 öncesi kod) "(sütun yok)" — eski kodda kırmızının nedeni değerle okunsun (ders 38).
  const stored = id => ctx.store.get("SELECT * FROM invoices WHERE id = ?", id)?.vat_period ?? "(sütun yok)";
  // Düzenle (kaydedilmiş belge): formun gönderdiği gövde — belgenin kendi alanları + değişen alan.
  const editBody = async (id, patch) => {
    const doc = await must("belge", api.get(`${INV}/${id}`));
    return { kind: doc.kind, scenario: doc.scenario, accountId: doc.accountId, issueDate: doc.issueDate, issueTime: doc.issueTime, number: doc.number, lines: doc.lines.map(line => ({ name: line.name, qty: line.qty, unitPrice: line.unitPrice, vatRate: line.vatRate, expenseCode: line.expenseCode })), payment: { rest: "open" }, vatPeriod: doc.vatPeriod, ...patch };
  };
  const edit = async (id, patch) => api.post(`${INV}/${id}/edit`, await editBody(id, patch));

  before(async () => {
    ctx = await bootBank({ now: NOW });
    api = ctx.api;
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    ids.M1 = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Dönem Müşteri", type: "customer", registeredOn: "2026-12-01" }))).id;
    ids.T1 = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Dönem Tedarikçi", type: "supplier", registeredOn: "2026-12-01" }))).id;
  });
  after(() => ctx?.server.close());

  it("(1) sınırlar: belge ayı (boş saklanır) … izleyen yılın Aralık'ı; dışı 400 ve ileti; satışta / iadede / biçim dışı 400", async () => {
    // Taslak da aynı denetimden geçer (deftere işlemez — sınır denemeleri tutarı etkilemez).
    const draft = async period => (await must(`taslak ${period}`, api.post(INV, buyBody("2026-12-05", 100, { status: "draft", vatPeriod: period })))).id;
    await rejected("izleyen yılın Ocak'ından sonra", api.post(INV, buyBody("2026-12-05", 100, { status: "draft", vatPeriod: "2028-01" })), 400, "vat-period-range", /en geç Aralık 2027 olabilir/);
    await rejected("belge ayından önce", api.post(INV, buyBody("2026-12-05", 100, { vatPeriod: "2026-11" })), 400, "vat-period-range", /faturanın ayından \(Aralık 2026\) önce olamaz/);
    assert.equal(stored(await draft("2026-12")), "", "belge ayı seçilirse '' saklanır (boş = belge ayı)");
    assert.equal(stored(await draft("2027-01")), "2027-01", "izleyen ay");
    assert.equal(stored(await draft("2027-12")), "2027-12", "izleyen yılın Aralık'ı — üst sınır KABUL");
    // Ocak faturası: alt sınır Ocak, üst sınır izleyen yılın Aralık'ı (yıl başı).
    await rejected("Ocak faturasının Aralık'ı", api.post(INV, buyBody("2027-01-02", 100, { status: "draft", vatPeriod: "2026-12" })), 400, "vat-period-range", /Ocak 2027/);
    assert.equal(stored(await must("Ocak faturası 2028-12", api.post(INV, buyBody("2027-01-02", 100, { status: "draft", vatPeriod: "2028-12" }))).then(item => item.id)), "2028-12");
    await rejected("biçim", api.post(INV, buyBody("2026-12-05", 100, { status: "draft", vatPeriod: "2027-1" })), 400, "vat-period", /Yıl-Ay/);
    await rejected("satış faturası", api.post(INV, { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-12-05", vatPeriod: "2027-01", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } }), 400, "vat-period-kind", /yalnız alış faturasında/);
    // Boş alan her türde kabul (satış).
    const sale = await must("satış boş alan", api.post(INV, { scenario: "service_sale", accountId: ids.M1, issueDate: "2026-12-05", vatPeriod: "", status: "draft", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } }));
    assert.equal(stored(sale.id), "");
    // Taslaklar silinir (ödemesiz; deftere işlenmedi).
    for (const row of ctx.store.all("SELECT id FROM invoices WHERE status = 'draft'")) await must("taslak sil", api.del(`${INV}/${row.id}`));
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n, 0);
  });

  it("(2) Aralık faturası Ocak dönemine: Aralık mahsubunda YOK, Ocak'ta VAR; defter maddesi belge tarihinde (191 Aralık sonunda 400)", async () => {
    ids.S1 = await sell("2026-12-10", 10000);
    ids.P1 = await buy("2026-12-15", 1000);
    ids.P2 = await buy("2026-12-31", 2000, { vatPeriod: "2027-01" });
    ids.S2 = await sell("2027-01-10", 1000);
    ids.P3 = await buy("2027-01-20", 500);
    const dec = await preview(api, "2026-12");
    assert.deepEqual([dec.outMinor, dec.inMinor, dec.payableMinor], [200000, 20000, 180000], "Aralık: H 2.000 / İ 200 (P2 Ocak'ta) / ödenecek 1.800");
    assert.deepEqual([stored(ids.P1), stored(ids.P2), stored(ids.P3)], ["", "2027-01", ""], "veri tabanı");
    assert.equal((await must("belge", api.get(`${INV}/${ids.P2}`))).vatPeriod, "2027-01", "belge görünümü dönemi taşır");
    await must("Aralık mahsup", api.post(`${TAX}/vat-offset`, { month: "2026-12" }));
    // Defter: P2'nin 191'i belge tarihinde (31.12) — Aralık mahsubundan sonra 31.12'de 191 = 400 (mahsupsuz), 391 = 0.
    const decTrial = await trialBalances(api, "?to=2026-12-31");
    assert.equal(decTrial["191"], 400, "31.12: P2'nin 400 TL KDV'si 191'de bekliyor (defter maddesi belge tarihinde)");
    assert.equal(decTrial["391"] ?? 0, 0);
    const jan = await preview(api, "2027-01");
    assert.deepEqual([jan.outMinor, jan.inMinor, jan.carryInMinor, jan.carryOutMinor, jan.payableMinor], [20000, 50000, 0, 30000, 0], "Ocak: H 200 / İ 100 + 400 / devreden 300");
    assert.equal(jan.carriedInMinor, 0, "taşıma yok");
    await must("Ocak mahsup", api.post(`${TAX}/vat-offset`, { month: "2027-01" }));
    const trial = await trialBalances(api);
    assert.deepEqual([trial["191"] ?? 0, trial["391"] ?? 0, trial["190"], trial["360"]], [0, 0, 300, -1800], "Ocak mahsubundan sonra 191 = 391 = 0, 190 = 300, 360 = −1.800");
    assert.deepEqual((await offsets(api)).map(item => `${item.month} ${item.stale}`), ["2026-12 false", "2027-01 false"]);
    await integrityOk(api, "KG-7 (2)");
  });

  it("(3) Düzenle: dönemi mahsubu yapılmış aya almak ARTIRAN fark (Güncel Değil); geri almak temizler; aralık dışı tarih 400; kilit / mahsup engeli YOK (M8 (6))", async () => {
    // P2'nin dönemi Aralık'a (belge ayı → '' saklanır): Aralık'ın İ'si 200 → 600 (artıran) → Güncel Değil; Ocak'tan çıkan 400 azaltan ama Ocak, Aralık'tan sonra — birikim yalnız ÖNCEKİ aylardan.
    await must("P2 dönem Aralık", edit(ids.P2, { vatPeriod: "2026-12" }));
    assert.equal(stored(ids.P2), "", "belge ayı '' saklanır");
    let list = await offsets(api);
    const dec = list.find(item => item.month === "2026-12");
    assert.deepEqual([dec.stale, dec.nowInMinor], [true, 60000], "Aralık Güncel Değil (İ şimdi 600)");
    // Geri: Ocak'a. Aralık temiz, Ocak temiz.
    await must("P2 dönem Ocak", edit(ids.P2, { vatPeriod: "2027-01" }));
    list = await offsets(api);
    assert.deepEqual(list.map(item => `${item.month} ${item.stale}`), ["2026-12 false", "2027-01 false"], "geri alındı");
    // Tarih ileri (05.02.2027): dolu dönem (Ocak) yeni belge ayından önce → 400, kayıt değişmez.
    await rejected("Düzenle: dönem yeni tarihin aralığı dışında", edit(ids.P2, { issueDate: "2027-02-05" }), 400, "vat-period-range", /faturanın ayından \(Şubat 2027\) önce olamaz/);
    assert.equal(ctx.store.get("SELECT issue_date AS d FROM invoices WHERE id = ?", ids.P2).d, "2026-12-31", "reddedilen düzenleme yazmadı");
    // Alan boşken tarih değişirse dönem yeni ayı izler: P3 (20.01, '') → 03.02 → Ocak İ 100 azalır (azaltan — Şubat'a taşınır, Ocak Güncel Değil DEĞİL).
    await must("P3 tarih Şubat", edit(ids.P3, { issueDate: "2027-02-03" }));
    assert.equal(stored(ids.P3), "");
    list = await offsets(api);
    assert.equal(list.find(item => item.month === "2027-01").stale, false, "azaltan fark uyarı değil (S4)");
    const feb = await preview(api, "2027-02");
    // Şubat: kendi İ 100 (P3) + taşınan −100 (Ocak'tan çıkan) = 0 → iki kez indirim yok; H 0; D = 300 (Ocak devreden).
    assert.deepEqual([feb.outMinor, feb.inMinor, feb.carriedInMinor, feb.carryInMinor], [0, 0, -10000, 30000], "Şubat: İ = 100 − 100 (S4 taşıması)");
    await integrityOk(api, "KG-7 (3)");
  });

  it("(4) mahsubu yapılmış aydan sonraki aya alınan KDV iki kez indirilmez (S4); İptal Et dönem ayından düşer", async () => {
    // P1 (Aralık, mahsuplu) → dönem Şubat: Aralık'tan −200 (azaltan; Ocak'ın mahsubu SONRA yazıldığından Ocak'ın saklı İ'si bu farkı içermez → birikim Aralık −200 + Ocak (şimdi 400 − saklı 500 = −100)).
    await must("P1 dönem Şubat", edit(ids.P1, { vatPeriod: "2027-02" }));
    assert.equal(stored(ids.P1), "2027-02");
    const feb = await preview(api, "2027-02");
    // Elle: Şubat kendi İ = P3 100 + P1 200 = 300; birikim C = (0 − 200) + (400 − 500) = −300 → İ = 300 − 300 = 0 (P1 Aralık'ta indirilmişti, P3'ün 100'ü Ocak'ta indirilmişti).
    assert.deepEqual([feb.inMinor, feb.carriedInMinor], [0, -30000], "Şubat: kendi 300 − taşınan 300");
    assert.deepEqual((await offsets(api)).map(item => `${item.month} ${item.stale}`), ["2026-12 false", "2027-01 false"], "azaltan farklar uyarı değil");
    // P2 İptal Et: Ocak'ın İ'si 400 düşer (Ocak dönemi) — Şubat'a taşınır (−400 daha).
    await must("P2 İptal Et", api.post(`${INV}/${ids.P2}/cancel`, { reason: "Hatalı fatura", payments: "drop", refund: "none" }));
    const feb2 = await preview(api, "2027-02");
    assert.deepEqual([feb2.inMinor, feb2.carriedInMinor], [-40000, -70000], "Şubat: 300 − 700 (Ocak'tan da 400 çıktı)");
    await integrityOk(api, "KG-7 (4)");
  });

  it("(5) alıştan iade faturasında alan yok (400); iade kendi ayında", async () => {
    const doc = await must("P3", api.get(`${INV}/${ids.P3}`));
    const base = { kind: "purchase_return", accountId: ids.T1, originalId: ids.P3, issueDate: "2027-02-05", lines: [{ originLineId: doc.lines[0].id, qty: 1 }], payment: { cash: [] }, status: "draft" };
    await rejected("alıştan iade", api.post(INV, { ...base, vatPeriod: "2027-03" }), 400, "vat-period-kind", /yalnız alış faturasında/);
    const ok = await must("alıştan iade boş alan", api.post(INV, base));
    assert.equal(stored(ok.id), "");
  });
});
