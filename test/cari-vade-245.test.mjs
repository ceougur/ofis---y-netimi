// 2.4.5 madde 6 — CARİ BORÇ VADESİ (docs/2.4.5-IS-LISTESI.md, BAŞ MİMAR KARARLARI S1, K6.1–K6.4; sözleşme AYNEN):
//   K6.1 elle Borç / Alacak ve Açılış Bakiyesi'nde isteğe bağlı Vade Tarihi (dueDate) ve Beklenen Ödeme Tarihi (expectedDate); tahsilat / ödeme ve başka
//        modülden gelen satır taşımaz; kaydın tarihinden önce ya da biçimsiz → 400 (field).
//   K6.2 cari kartının hareketlerinde iki alan + elle borç / alacak ve açılışta Kalan (remaining): fatura kapamasının "Otomatik (En Eski)" kuyruğu (S1).
//   K6.3 GET /api/workspace/dues: Kalan > 0 ve tarihli kayıt "account|<entryId>" kalemidir (etiket, yön, tarih, tutar, ufuk); yalnız accounts.view; Ödendi
//        Say yok; Vade Takip aynı kalemler.
//   K6.4 göç: account_entries.due_date / expected_date ('' varsayılan); Silinenler ve Düzenle taşır.
// "Nasıl bozulur?" listesi (iş başında yazıldı): aynı tarihte iki borç + tahsilat (yazım sırası), vadeli borç + faturayla karışık kuyruk, Kapatılacak
// Fatura bağlı tahsilat FIFO'ya girmez, taksit kartı tahsilatı girmez / Mevcut Borç kartının kapsadığı borç takvimden düşer, tahsilat silinince kalem
// geri açılır (Silinenler'den dönünce yine kapanır), çek karşılıksız dönünce, borç düzenlenip tutar küçülünce, vade < tarih 400, alacak yönlü açılış
// (tedarikçi) → "Ödenecek Borç", 002 şirketi, eski veri (test/goc-245-cari-vade.test.mjs), yetkisiz kullanıcı, cari silinince, ufuk 7 / 8 gün,
// önbellek (durağan saatte yalnız tarih değişince), yevmiye değişmez.
// Sahte DURAĞAN saat (ders 13; bütün satırların created_at'i aynı → aynı tarihli kayıtların sırası yazım sırasıdır, ders 31).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  client,
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
  patch: async (url, body) => unwrap(await client.patch(url, body)),
});

describe("2.4.5 madde 6: cari borç vadesi (Vade Tarihi, Beklenen Ödeme Tarihi, Kalan, takvim kalemi)", () => {
  let server;
  let api;
  let n = 0;
  let item;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    item = (await api.post("/api/workspace/stock", { kind: "service", code: "HZM-245", name: "Hizmet", unit: "Adet", salePrice: "1000" })).data;
  });
  after(async () => server?.close());

  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const refused = async (label, promise, status, field = null, code = null) => {
    const res = await promise;
    assert.equal(res.status, status, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    const body = res.data?.error ? res.data : res.data?.data || res.data;
    if (field) assert.equal(body.field ?? body.data?.field, field, `${label}: field ${JSON.stringify(body).slice(0, 200)}`);
    if (code) assert.equal(body.code ?? body.data?.code, code, `${label}: code ${JSON.stringify(body).slice(0, 200)}`);
    return body;
  };
  const account = async (label, extra = {}) => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Vade ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 245 00 ${String((n += 1)).padStart(2, "0")}`, ...extra }));
  const entry = async (acc, body) => {
    const before_ = new Set((await must("kart", api.get(`/api/workspace/accounts/${acc.id}`))).entries.map(row => row.id));
    const result = await must(`hareket ${body.kind}`, api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", ...body }));
    const created = result.entries.filter(row => !before_.has(row.id));
    assert.equal(created.length, 1, "bir satır yazıldı");
    return created[0];
  };
  const card = async acc => must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
  const rowOf = async (acc, id) => (await card(acc)).entries.find(row => row.id === id);
  const dues = async (client = api) => must("takvim", client.get("/api/workspace/dues"));
  const accountItems = async (client = api) => (await dues(client)).items.filter(row => row.source === "account");
  const dbRow = id => ({ ...server.app.store.get("SELECT kind, amount, date, due_date AS dueDate, expected_date AS expectedDate FROM account_entries WHERE id = ?", id) });
  const sale = async (acc, date, amount) => {
    const doc = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open", dueDate: date } }));
    return must("fatura oku", api.get(`/api/workspace/invoices/${doc.id}`));
  };

  it("K6.4 göç: account_entries'te due_date ve expected_date (TEXT, varsayılan '')", () => {
    const columns = server.app.store.all("PRAGMA table_info(account_entries)");
    for (const name of ["due_date", "expected_date"]) {
      const column = columns.find(item => item.name === name);
      assert.ok(column, `${name} kolonu yok`);
      assert.equal(column.type, "TEXT");
      assert.equal(column.dflt_value, "''");
    }
  });

  it("K6.1 alanlar: Borç ve Alacak'ta saklanır, kartta döner; tahsilat / ödemede gönderilse de kaydedilmez", async () => {
    const acc = await account("Alan");
    const debt = await entry(acc, { kind: "debt", amount: "1.000", date: day(-10), dueDate: day(5), expectedDate: day(3), note: "vadeli borç" });
    assert.equal(debt.dueDate, day(5));
    assert.equal(debt.expectedDate, day(3));
    assert.equal(debt.remaining, 1000, "tahsilat yok: Kalan = tutar");
    assert.deepEqual(dbRow(debt.id), { kind: "debt", amount: 1000, date: day(-10), dueDate: day(5), expectedDate: day(3) });
    const credit = await entry(acc, { kind: "credit", amount: "200", date: day(-9), dueDate: day(1) });
    assert.equal(credit.dueDate, day(1));
    assert.equal(credit.expectedDate, "");
    const paid = await entry(acc, { kind: "in", amount: "100", date: day(-8), dueDate: day(4), expectedDate: day(4) });
    assert.equal(dbRow(paid.id).dueDate, "", "tahsilatta Vade Tarihi kaydedilmez");
    assert.equal(dbRow(paid.id).expectedDate, "");
    assert.equal(paid.remaining, undefined, "tahsilatta Kalan yok");
    const out = await entry(acc, { kind: "out", amount: "50", date: day(-8), dueDate: day(4) });
    assert.equal(dbRow(out.id).dueDate, "", "ödemede Vade Tarihi kaydedilmez");
  });

  it("K6.1 doğrulama: tarihten önce, biçimsiz ya da takvimde olmayan gün → 400 (field); hiçbir satır yazılmaz", async () => {
    const acc = await account("Dogrulama");
    const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", acc.id).n;
    const url = `/api/workspace/accounts/${acc.id}/entries`;
    await refused("vade < tarih", api.post(url, { kind: "debt", amount: "100", date: day(-5), dueDate: day(-6) }), 400, "dueDate");
    await refused("beklenen < tarih", api.post(url, { kind: "debt", amount: "100", date: day(-5), expectedDate: day(-6) }), 400, "expectedDate");
    await refused("biçimsiz", api.post(url, { kind: "debt", amount: "100", date: day(-5), dueDate: "15.11.2026" }), 400, "dueDate");
    await refused("takvimde yok", api.post(url, { kind: "credit", amount: "100", date: day(-5), expectedDate: "2026-11-31" }), 400, "expectedDate");
    // Kâhin (c6b v3) yakaladı: 13. ay geçersiz Date — sunucu 500 veriyordu.
    await refused("13. ay", api.post(url, { kind: "debt", amount: "100", date: day(-5), dueDate: "2026-13-01" }), 400, "dueDate", "due-date-invalid");
    await refused("açılışta 13. ay", api.post("/api/workspace/accounts", { name: "Vade Ay 13", type: "customer", registeredOn: day(-5), openingBalance: "10", openingDueDate: "2026-13-01" }), 400, "openingDueDate", "due-date-invalid");
    await refused("metin", api.post(url, { kind: "debt", amount: "100", date: day(-5), dueDate: "yarın" }), 400, "dueDate");
    assert.equal(count(), 0, "reddedilen istek satır yazmadı");
    const same = await entry(acc, { kind: "debt", amount: "100", date: day(-5), dueDate: day(-5), expectedDate: day(-5) });
    assert.equal(same.dueDate, day(-5), "kaydın günü kabul edilir");
  });

  it("K6.1 düzeltme: anahtar yoksa tarih kalır, boş metin siler; yön değişince kalır; tarih vadeden sonraya alınırsa 400", async () => {
    const acc = await account("Duzelt");
    const debt = await entry(acc, { kind: "debt", amount: "500", date: day(-20), dueDate: day(-12), expectedDate: day(-13) });
    const url = `/api/workspace/accounts/${acc.id}/entries/${debt.id}`;
    await must("açıklama", api.put(url, { kind: "debt", amount: "500", date: day(-20), note: "yalnız açıklama" }));
    assert.deepEqual([dbRow(debt.id).dueDate, dbRow(debt.id).expectedDate], [day(-12), day(-13)], "gövdede anahtar yok: tarihler kalır");
    await must("yön", api.put(url, { kind: "credit", amount: "500", date: day(-20) }));
    assert.equal(dbRow(debt.id).kind, "credit");
    assert.equal(dbRow(debt.id).dueDate, day(-12), "Borç ↔ Alacak düzeltmesinde tarih kalır");
    await refused("tarih vadeden sonra", api.put(url, { kind: "credit", amount: "500", date: day(-11) }), 400, "dueDate");
    assert.equal(dbRow(debt.id).date, day(-20), "reddedilen düzeltme yazmadı");
    await must("beklenen sil", api.put(url, { kind: "credit", amount: "500", date: day(-20), expectedDate: "" }));
    assert.deepEqual([dbRow(debt.id).dueDate, dbRow(debt.id).expectedDate], [day(-12), ""]);
  });

  it("K6.1 Açılış Bakiyesi: POST'ta openingDueDate / openingExpectedDate; tedarikçide alacak yönlü; açılış yoksa ya da tarihten önceyse 400; PUT günceller", async () => {
    const created = await must("açılışlı cari", api.post("/api/workspace/accounts", { name: "Vade Açılış Müşteri", type: "customer", registeredOn: day(-30), openingBalance: "2.500", openingDueDate: day(4), openingExpectedDate: day(6) }));
    const opening = created.entries.find(row => row.id === created.openingEntryId);
    assert.ok(opening, "openingEntryId açılış satırını gösterir");
    assert.deepEqual([opening.kind, opening.dueDate, opening.expectedDate, opening.remaining], ["debt", day(4), day(6), 2500]);
    const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Vade Açılış Tedarikçi", type: "supplier", registeredOn: day(-30), openingBalance: "800", openingDueDate: day(2) }));
    const credit = supplier.entries.find(row => row.id === supplier.openingEntryId);
    assert.deepEqual([credit.kind, credit.dueDate, credit.remaining], ["credit", day(2), 800], "tedarikçide artı açılış alacak yönlü");
    const before_ = server.app.store.get("SELECT COUNT(*) AS n FROM accounts").n;
    await refused("açılışsız vade", api.post("/api/workspace/accounts", { name: "Vade Açılışsız", type: "customer", registeredOn: day(-30), openingDueDate: day(4) }), 400, "openingDueDate", "opening-missing");
    await refused("açılıştan önce", api.post("/api/workspace/accounts", { name: "Vade Önce", type: "customer", registeredOn: day(-30), openingBalance: "100", openingExpectedDate: day(-31) }), 400, "openingExpectedDate");
    assert.equal(server.app.store.get("SELECT COUNT(*) AS n FROM accounts").n, before_, "reddedilen cari açılmadı");
    const fresh = await card(created);
    await must("Düzenle", api.put(`/api/workspace/accounts/${created.id}`, { name: fresh.name, type: fresh.type, registeredOn: fresh.registeredOn, updatedAt: fresh.updatedAt, openingDueDate: day(7), openingExpectedDate: "" }));
    assert.deepEqual([dbRow(opening.id).dueDate, dbRow(opening.id).expectedDate], [day(7), ""], "PUT açılış tarihlerini yazar");
    const again = await card(created);
    await refused("Düzenle tarihten önce", api.put(`/api/workspace/accounts/${created.id}`, { name: again.name, type: again.type, registeredOn: again.registeredOn, updatedAt: again.updatedAt, openingDueDate: day(-31) }), 400, "openingDueDate");
    assert.equal(dbRow(opening.id).dueDate, day(7), "reddedilen Düzenle yazmadı");
    const plain = await account("Acilissiz Duzenle");
    const p = await card(plain);
    assert.equal(p.openingEntryId, "");
    await refused("açılışsız caride Düzenle", api.put(`/api/workspace/accounts/${plain.id}`, { name: p.name, type: p.type, registeredOn: p.registeredOn, updatedAt: p.updatedAt, openingDueDate: day(3) }), 400, "openingDueDate", "opening-missing");
  });

  it("S1 FIFO: aynı gün iki borç + tahsilat → önce yazılan kapanır (yazım sırası); Vade Tarihi sırayı değiştirmez", async () => {
    const acc = await account("FIFO");
    // İkinci borcun vadesi daha YAKIN: sıra yine kayıt tarihi + yazım sırası.
    const first = await entry(acc, { kind: "debt", amount: "1.000", date: day(-10), dueDate: day(6) });
    const second = await entry(acc, { kind: "debt", amount: "500", date: day(-10), dueDate: day(1) });
    const third = await entry(acc, { kind: "debt", amount: "300", date: day(-12), dueDate: day(2) });
    await entry(acc, { kind: "in", amount: "1.200", date: day(-5) });
    assert.equal((await rowOf(acc, third.id)).remaining, 0, "en eski tarihli borç önce kapanır");
    assert.equal((await rowOf(acc, first.id)).remaining, 100, "aynı günde önce yazılan: 1.000 − (1.200 − 300) = 100");
    assert.equal((await rowOf(acc, second.id)).remaining, 500, "aynı günde sonra yazılan açık kalır");
    const items = (await accountItems()).filter(row => row.accountId === acc.id);
    assert.deepEqual(items.map(row => [row.entryId, row.amount]).sort(), [[first.id, 100], [second.id, 500]].sort(), "kalanı olan iki kayıt takvimde, kapanan yok");
  });

  it("S1 karışık kuyruk: vadeli borç + taksitsiz satış faturası tarih sırasıyla; faturanın açığı aynı kuraldan", async () => {
    const acc = await account("Karisik");
    const early = await entry(acc, { kind: "debt", amount: "1.000", date: day(-30), dueDate: day(-20) });
    const invoice = await sale(acc, day(-20), 2000);
    const late = await entry(acc, { kind: "debt", amount: "500", date: day(-10), dueDate: day(3) });
    await entry(acc, { kind: "in", amount: "1.500", date: day(-5) });
    assert.equal((await rowOf(acc, early.id)).remaining, 0, "en eski borç (elle) kapandı");
    const doc = await must("fatura", api.get(`/api/workspace/invoices/${invoice.id}`));
    assert.equal(doc.open, 1500, "fatura: 2.000 − (1.500 − 1.000) = 1.500 açık");
    assert.equal((await rowOf(acc, late.id)).remaining, 500, "faturadan sonraki borç açık");
    const balance = (await card(acc)).totals.balance;
    const open = (await rowOf(acc, late.id)).remaining + doc.open;
    assert.equal(balance, open, "Σ açık = cari bakiyesi (bakiye değişmez)");
  });

  it("S1 bağlı ödeme: Kapatılacak Fatura seçilen tahsilat borç kaydını kapatmaz", async () => {
    const acc = await account("Bagli");
    const debt = await entry(acc, { kind: "debt", amount: "1.000", date: day(-30), dueDate: day(1) });
    const invoice = await sale(acc, day(-20), 400);
    await entry(acc, { kind: "in", amount: "400", date: day(-5), invoiceId: invoice.id });
    assert.equal((await rowOf(acc, debt.id)).remaining, 1000, "faturaya bağlı tahsilat FIFO'ya girmez");
    assert.equal((await must("fatura", api.get(`/api/workspace/invoices/${invoice.id}`))).open, 0, "bağlı fatura kapandı");
  });

  it("KS2: müşterideki elle Alacak karşı taraf yükümlülüğüdür — müşterinin borcuna mahsup EDİLMEZ; vadesi varsa \"Ödenecek Borç\" kalemi", async () => {
    const acc = await account("KS2");
    const debt = await entry(acc, { kind: "debt", amount: "1.000", date: day(-20), dueDate: day(2) });
    const credit = await entry(acc, { kind: "credit", amount: "300", date: day(-10), dueDate: day(3) });
    assert.equal((await rowOf(acc, debt.id)).remaining, 1000, "elle Alacak ödeme değildir: müşterinin borcu açık kalır");
    assert.equal((await rowOf(acc, credit.id)).remaining, 300, "elle Alacak kendi kalanıyla");
    assert.equal((await card(acc)).totals.balance, 700, "bakiye net (değişmez)");
    const items = (await accountItems()).filter(row => row.accountId === acc.id);
    assert.deepEqual(items.map(row => [row.entryId, row.direction, row.label, row.amount]).sort(), [[debt.id, "in", "Tahsil Edilecek Borç", 1000], [credit.id, "out", "Ödenecek Borç", 300]].sort());
    await entry(acc, { kind: "out", amount: "300", date: day(-1) });
    assert.equal((await rowOf(acc, credit.id)).remaining, 0, "müşteriye yapılan ödeme elle Alacak'ı kapatır");
    assert.equal((await rowOf(acc, debt.id)).remaining, 1000, "ödeme müşterinin borcunu açmaz / kapatmaz");
  });

  it("S1 taksit kartı: ayrı kartın tahsilatı borç kaydını kapatmaz; Mevcut Borç kartının kapsadığı borç takvimden düşer (taksitlerle bir kez)", async () => {
    const acc = await account("Kart");
    const debt = await entry(acc, { kind: "debt", amount: "1.000", date: day(-30), dueDate: day(1) });
    const plan = await must("ayrı kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-25), total: "600", accountId: acc.id, mode: "auto", count: "2", firstDue: day(10) }));
    await must("kart tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "600", date: day(-5), method: "cash" }));
    assert.equal((await rowOf(acc, debt.id)).remaining, 1000, "ayrı kartın tahsilatı kartın kendi defterinde");
    const other = await account("Kapsam");
    const covered = await entry(other, { kind: "debt", amount: "900", date: day(-30), dueDate: day(1) });
    assert.ok((await accountItems()).some(row => row.entryId === covered.id), "kart açılmadan önce takvimde");
    const cover = await must("mevcut borç kartı", api.post("/api/workspace/plans", { name: other.name, registeredOn: day(-20), total: "900", accountId: other.id, mode: "auto", count: "3", firstDue: day(5), coversBalance: true }));
    assert.equal((await rowOf(other, covered.id)).remaining, 900, "borç ödenmedi: Kalan 900 (kartta taksitlendirildi)");
    assert.equal((await accountItems()).some(row => row.entryId === covered.id), false, "kapsanan kısım kartın taksitleriyle gelir; cari kalemi yok");
    const planItems = (await dues()).items.filter(row => row.source === "plan" && row.planId === cover.id);
    assert.deepEqual(planItems.map(row => [row.dueDate, row.amount]), [[day(5), 300]], "aynı borç takvimde bir kez: kartın 5 gün sonraki taksiti");
  });

  it("tahsilat silinince kalem geri açılır, Silinenler'den dönünce yine kapanır; silinen borç tarihleriyle geri gelir", async () => {
    const acc = await account("Sil");
    const debt = await entry(acc, { kind: "debt", amount: "700", date: day(-15), dueDate: day(2), expectedDate: day(4), note: "sil borcu" });
    const paid = await entry(acc, { kind: "in", amount: "700", date: day(-3), note: "sil tahsilatı" });
    assert.equal((await rowOf(acc, debt.id)).remaining, 0);
    assert.equal((await accountItems()).some(row => row.entryId === debt.id), false, "Kalan 0: kalem yok");
    await must("tahsilatı sil", api.del(`/api/workspace/accounts/${acc.id}/entries/${paid.id}`));
    assert.equal((await rowOf(acc, debt.id)).remaining, 700, "tahsilat silindi: borç yeniden açık");
    assert.ok((await accountItems()).some(row => row.entryId === debt.id && row.amount === 700), "kalem geri geldi");
    const trash = await must("Silinenler", api.get("/api/admin/trash"));
    const deleted = trash.find(row => row.kind === "account-entry" && row.ref === paid.id);
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: deleted.id }));
    assert.equal((await rowOf(acc, debt.id)).remaining, 0, "tahsilat geri geldi: borç yine kapalı");
    await must("borcu sil", api.del(`/api/workspace/accounts/${acc.id}/entries/${debt.id}`));
    const trash2 = await must("Silinenler", api.get("/api/admin/trash"));
    await must("borcu geri yükle", api.post("/api/admin/trash/restore", { id: trash2.find(row => row.kind === "account-entry" && row.ref === debt.id).id }));
    assert.deepEqual([dbRow(debt.id).dueDate, dbRow(debt.id).expectedDate], [day(2), day(4)], "Silinenler'den tarihleriyle döner");
  });

  it("çek karşılıksız dönünce kapattığı borç kaydı yeniden açılır", async () => {
    const acc = await account("Cek");
    const debt = await entry(acc, { kind: "debt", amount: "1.500", date: day(-20), dueDate: day(-2) });
    const cheque = await must("çek al", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: acc.id, amount: "1.500", issueDate: day(-10), dueDate: day(30), drawer: "Keşideci", serialNo: "VD-245-1", bank: "Ziraat" }));
    assert.equal((await rowOf(acc, debt.id)).remaining, 0, "çek borcu kapattı");
    await must("karşılıksız", api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bounce", date: TODAY }));
    assert.equal((await rowOf(acc, debt.id)).remaining, 1500, "karşılıksız: borç kendi tarihiyle yeniden açık");
    const items = await accountItems();
    assert.ok(items.some(row => row.entryId === debt.id && row.amount === 1500 && row.state === "overdue"), "vadesi geçmiş kalem");
  });

  it("borç düzenlenip tutar küçülünce Kalan küçülür; tutar tahsilatın altına inince kalem kapanır", async () => {
    const acc = await account("Kucul");
    const debt = await entry(acc, { kind: "debt", amount: "1.000", date: day(-20), dueDate: day(3) });
    await entry(acc, { kind: "in", amount: "300", date: day(-5) });
    assert.equal((await rowOf(acc, debt.id)).remaining, 700);
    await must("küçült", api.put(`/api/workspace/accounts/${acc.id}/entries/${debt.id}`, { kind: "debt", amount: "400", date: day(-20) }));
    assert.equal((await rowOf(acc, debt.id)).remaining, 100);
    assert.ok((await accountItems()).some(row => row.entryId === debt.id && row.amount === 100 && row.partial === true));
    await must("küçült 2", api.put(`/api/workspace/accounts/${acc.id}/entries/${debt.id}`, { kind: "debt", amount: "250", date: day(-20) }));
    assert.equal((await rowOf(acc, debt.id)).remaining, 0);
    assert.equal((await accountItems()).some(row => row.entryId === debt.id), false);
  });

  it("K6.3 kalem sözleşmesi: id, source, accountId, entryId, direction, person, label, dueDate, amount, days, state; Beklenen Ödeme Tarihi önce gelir", async () => {
    const acc = await account("Kalem");
    const vade = await entry(acc, { kind: "debt", amount: "400", date: day(-3), dueDate: day(2) });
    const promise = await entry(acc, { kind: "debt", amount: "250", date: day(-3), dueDate: day(6), expectedDate: day(1) });
    const supplier = await account("Kalem Tedarikci", { type: "supplier" });
    const owed = await entry(supplier, { kind: "credit", amount: "900", date: day(-40), dueDate: day(-1) });
    const items = await accountItems();
    const a = items.find(row => row.entryId === vade.id);
    assert.deepEqual({ id: a.id, source: a.source, accountId: a.accountId, entryId: a.entryId, direction: a.direction, person: a.person, label: a.label, dueDate: a.dueDate, amount: a.amount, days: a.days, state: a.state },
      { id: `account|${vade.id}`, source: "account", accountId: acc.id, entryId: vade.id, direction: "in", person: acc.name, label: "Tahsil Edilecek Borç", dueDate: day(2), amount: 400, days: 2, state: "upcoming" });
    const b = items.find(row => row.entryId === promise.id);
    assert.deepEqual([b.label, b.dueDate, b.days, b.state], ["Tahsil Edilecek Borç (Ödeme Sözü)", day(1), 1, "upcoming"], "Beklenen Ödeme Tarihi varsa o gün");
    const c = items.find(row => row.entryId === owed.id);
    assert.deepEqual([c.direction, c.label, c.dueDate, c.days, c.state, c.amount], ["out", "Ödenecek Borç", day(-1), -1, "overdue", 900], "alacak yönlü (carinin alacağı) → Ödenecek Borç");
    const todayItem = await entry(acc, { kind: "credit", amount: "75", date: day(-1), expectedDate: TODAY });
    const t = (await accountItems()).find(row => row.entryId === todayItem.id);
    assert.deepEqual([t.label, t.state, t.days, t.direction], ["Ödenecek Borç (Ödeme Sözü)", "today", 0, "out"]);
  });

  it("K6.3 ufuk: geçmişin tamamı + bugünden 7 gün (8. gün yok); tarihsiz borç kalem değildir", async () => {
    const acc = await account("Ufuk");
    const seven = await entry(acc, { kind: "debt", amount: "10", date: day(-1), dueDate: day(7) });
    const eight = await entry(acc, { kind: "debt", amount: "10", date: day(-1), dueDate: day(8) });
    const old = await entry(acc, { kind: "debt", amount: "10", date: day(-399), dueDate: day(-390) });
    const plain = await entry(acc, { kind: "debt", amount: "10", date: day(-1) });
    const ids = new Set((await accountItems()).map(row => row.entryId));
    assert.ok(ids.has(seven.id), "7 gün sonra vadeli kalem var");
    assert.equal(ids.has(eight.id), false, "8 gün sonra vadeli kalem yok");
    assert.ok(ids.has(old.id), "çok eski vadesi geçmiş kalem var");
    assert.equal(ids.has(plain.id), false, "Vade / Beklenen Ödeme Tarihi girilmemiş borç kalem değil");
  });

  it("K6.3 Vade Takip aynı kalemleri gösterir (kaynak 'account', tarih, tutar, etiket); aralık dışı (8. gün) Vade Takip'te 30 günlükte var", async () => {
    const acc = await account("VadeTakip");
    const near = await entry(acc, { kind: "debt", amount: "333", date: day(-2), expectedDate: day(3) });
    const far = await entry(acc, { kind: "debt", amount: "444", date: day(-2), dueDate: day(20) });
    const report = await must("vade takip", api.get("/api/workspace/overview/vade-takip?preset=next30"));
    assert.ok(report.allowed.includes("account"), "yönetici 'account' kaynağını görür");
    const rows = report.rows.filter(row => row.source === "account" && row.party === acc.name);
    const item = (await accountItems()).find(row => row.entryId === near.id);
    const nearRow = rows.find(row => row.amount === 333);
    assert.deepEqual([nearRow.date, nearRow.amount, nearRow.label, nearRow.direction, nearRow.ref.type, nearRow.ref.id], [item.dueDate, item.amount, item.label, item.direction, "account", acc.id]);
    assert.deepEqual([nearRow.id, nearRow.entryId], [item.id, near.id], "Vade Takip satırı takvimdeki kalemin kimliğini taşır (kâhin satırı kayıt kimliğiyle bulur)");
    assert.ok(rows.some(row => row.amount === 444 && row.date === day(20)), "Vade Takip kendi aralığını süzer (zilin 7 günü değil)");
    assert.equal((await accountItems()).some(row => row.entryId === far.id), false);
    const only = await must("vade takip yalnız cari", api.get("/api/workspace/overview/vade-takip?preset=next30&sources=account"));
    assert.ok(only.rows.length > 0 && only.rows.every(row => row.source === "account"), "Cari (vadeli) süzgeci yalnız cari kalemleri");
  });

  it("K6.3 yetki: Cari görüntüleme yetkisi olmayan kişi kalemi görmez (zil, takvim, Vade Takip); sürüm yetkiyle değişir", async () => {
    const acc = await account("Yetki");
    await entry(acc, { kind: "debt", amount: "100", date: day(-2), dueDate: day(1) });
    const staff = apiOf(await createUser(server, api.client, { username: "vade-personel", role: "muhasebe" }));
    const users = await must("kullanıcılar", api.get("/api/admin/users"));
    const target = users.find(user => user.username === "vade-personel");
    const withRight = await dues(staff);
    assert.ok(withRight.items.some(row => row.source === "account" && row.accountId === acc.id), "yetkili kişi görür");
    await must("yetki kaldır", api.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["accounts.view"] } }));
    const without = await dues(staff);
    assert.equal(without.items.some(row => row.source === "account"), false, "accounts.view yok: cari kalemi yok");
    assert.notEqual(without.version, withRight.version, "sürüm yetkiyle değişir (eski yanıt 'unchanged' sayılmaz)");
    const since = await must("since", staff.get(`/api/workspace/dues?since=${encodeURIComponent(withRight.version)}`));
    assert.notEqual(since.unchanged, true);
    await must("raporlar yetkisi", api.patch(`/api/admin/users/${target.id}`, { grants: { add: ["reports.view"], remove: ["accounts.view"] } }));
    const report = await must("vade takip (yetkisiz cari)", staff.get("/api/workspace/overview/vade-takip?preset=next30"));
    assert.equal(report.allowed.includes("account"), false, "Vade Takip'te 'account' kaynağı yok");
    assert.equal(report.rows.some(row => row.source === "account"), false);
    const asked = await must("istenen kaynak", staff.get("/api/workspace/overview/vade-takip?preset=next30&sources=account"));
    assert.equal(asked.rows.some(row => row.source === "account"), false, "kaynağı adıyla istese de gelmez");
  });

  it("Ödendi Say yok: settle 'account|…' kalemini reddeder (400); kalem yerinde kalır", async () => {
    const acc = await account("Settle");
    const debt = await entry(acc, { kind: "debt", amount: "120", date: day(-2), dueDate: day(1) });
    await refused("settle", api.post("/api/workspace/dues/settle", { id: `account|${debt.id}` }), 400);
    assert.ok((await accountItems()).some(row => row.entryId === debt.id), "kalem duruyor");
  });

  it("önbellek: durağan saatte yalnız Beklenen Ödeme Tarihi değişince kalem o güne kayar (sürüm değişir)", async () => {
    const acc = await account("Onbellek");
    const debt = await entry(acc, { kind: "debt", amount: "600", date: day(-4), dueDate: day(6) });
    const first = await dues();
    assert.equal(first.items.find(row => row.entryId === debt.id).dueDate, day(6));
    await must("söz", api.put(`/api/workspace/accounts/${acc.id}/entries/${debt.id}`, { kind: "debt", amount: "600", date: day(-4), expectedDate: day(2) }));
    const second = await dues();
    assert.notEqual(second.version, first.version);
    const moved = second.items.find(row => row.entryId === debt.id);
    assert.deepEqual([moved.dueDate, moved.label], [day(2), "Tahsil Edilecek Borç (Ödeme Sözü)"]);
    await entry(acc, { kind: "in", amount: "250", date: day(-1) });
    assert.equal((await dues()).items.find(row => row.entryId === debt.id).amount, 350, "kısmi tahsilat tutarı küçültür");
  });

  it("cari silinince kalem yok; geri yüklenince döner", async () => {
    const acc = await account("Silinen Cari");
    const debt = await entry(acc, { kind: "debt", amount: "55", date: day(-2), dueDate: day(1) });
    const before_ = await card(acc);
    // Hareketi olan cari silinebilsin diye (tahsilatsız borç): silme engeli varsa nedeni yazar.
    const removed = await api.del(`/api/workspace/accounts/${acc.id}`);
    if (removed.status !== 200) return assert.fail(`cari silinemedi: ${JSON.stringify(removed.data).slice(0, 200)} (${before_.deleteBlock})`);
    assert.equal((await accountItems()).some(row => row.entryId === debt.id), false, "silinmiş carinin kalemi yok");
    const trash = await must("Silinenler", api.get("/api/admin/trash"));
    await must("cariyi geri yükle", api.post("/api/admin/trash/restore", { id: trash.find(row => row.kind === "account" && row.title === acc.name).id }));
    assert.ok((await accountItems()).some(row => row.entryId === debt.id), "geri gelen carinin kalemi döner");
  });

  it("yevmiye ve mizan değişmez: tarih eklemek / silmek Ana Defter'i değiştirmez", async () => {
    const acc = await account("Yevmiye");
    const debt = await entry(acc, { kind: "debt", amount: "1.234,56", date: day(-6) });
    await entry(acc, { kind: "in", amount: "234,56", date: day(-2) });
    const read = async () => {
      const ledger = await must("defter", api.get("/api/workspace/ledger"));
      const journal = await must("yevmiye", api.get(`/api/workspace/report-center/yevmiye?from=${day(-500)}&to=${day(30)}`));
      return JSON.stringify({ trial: ledger.trial, reconciliation: ledger.reconciliation, rows: journal.rows, footer: journal.footer });
    };
    const plain = await read();
    await must("vade ekle", api.put(`/api/workspace/accounts/${acc.id}/entries/${debt.id}`, { kind: "debt", amount: "1.234,56", date: day(-6), dueDate: day(3), expectedDate: day(1) }));
    assert.equal(await read(), plain, "vade alanları yevmiyeyi ve mizanı değiştirmedi");
    assert.equal((await rowOf(acc, debt.id)).remaining, 1000);
  });

  it("002 şirketi: göç orada da; kalemler şirkete ayrı", async () => {
    const acc = await account("Sirket001");
    const debt = await entry(acc, { kind: "debt", amount: "80", date: day(-2), dueDate: day(1) });
    const companies = await must("şirketler", api.get("/api/companies"));
    const first = (companies.companies || companies).find(row => row.current) || (companies.companies || companies)[0];
    const second = await must("002", api.post("/api/companies", { name: "Vade İkinci Şirket", select: false }));
    const secondId = second.id || second.company?.id;
    await must("002 seç", api.post("/api/companies/select", { id: secondId }));
    try {
      await api.post("/api/workspace/bank/setup/dismiss", {});
      assert.equal((await accountItems()).some(row => row.entryId === debt.id), false, "001'in kalemi 002'de yok");
      const other = await must("002 cari", api.post("/api/workspace/accounts", { name: "Vade 002", type: "customer", registeredOn: day(-30), openingBalance: "90", openingDueDate: day(2) }));
      const items = await accountItems();
      assert.deepEqual(items.map(row => [row.accountId, row.amount, row.dueDate]), [[other.id, 90, day(2)]], "002'de yalnız kendi kalemi");
      // Yedek tatbikatı (002 hemen geri yüklenir): yedek → söz + kısmi tahsilat → geri yükle → yedek anı → yeniden çalış.
      const backup = (await must("002 yedek", api.post("/api/admin/backups", { scope: "one", companyId: secondId }))).backups[0].name;
      const fresh = await card(other);
      await must("söz", api.put(`/api/workspace/accounts/${other.id}`, { name: fresh.name, type: fresh.type, registeredOn: fresh.registeredOn, updatedAt: fresh.updatedAt, openingExpectedDate: day(1) }));
      await entry(other, { kind: "in", amount: "40", date: day(-1) });
      assert.deepEqual((await accountItems()).map(row => [row.amount, row.dueDate, row.label]), [[50, day(1), "Tahsil Edilecek Borç (Ödeme Sözü)"]]);
      const second_ = (await must("şirketler", api.get("/api/companies"))).companies?.find(row => row.id === secondId) || { code: "002" };
      await must("geri yükle", api.post("/api/admin/backups/restore", { name: backup, company: secondId, confirm: second_.code, password: ADMIN_PASSWORD }));
      assert.deepEqual((await accountItems()).map(row => [row.amount, row.dueDate, row.label]), [[90, day(2), "Tahsil Edilecek Borç"]], "geri yüklenince yedek anının kalemi (tarih ve Kalan)");
      await entry(other, { kind: "in", amount: "30", date: day(-1) });
      assert.deepEqual((await accountItems()).map(row => [row.amount, row.dueDate]), [[60, day(2)]], "geri yüklenen veride yeniden çalışır");
    } finally {
      await must("001 seç", api.post("/api/companies/select", { id: first.id }));
    }
    assert.ok((await accountItems()).some(row => row.entryId === debt.id), "001'e dönünce kendi kalemi");
  });
});
