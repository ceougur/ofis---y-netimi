// 2.4.3 H2 (fatura modülü yükte hız testi, docs/kanit/2026-10-17/hiz-fatura): her kayıt bütün açık pencerelere yenileme yayıyor; açık her pencere
// tahsilat takvimini (10.000 faturalı veride 2,8 MB) ve kritik stok rozetini (bütün stok hareketleri okunur) yeniden istiyordu.
//  - Takvim (GET /api/workspace/dues): yanıt içeriğin sürümünü taşır; ekran elindeki sürümü (?since=) gönderir; içerik aynıysa yalnız
//    "değişmedi" döner — başka personelin kaydı takvimi değiştirmediyse de. İçerik değişince tamamı yeni sürümle gelir (güncellik).
//    Sürüm kişinin görebildiği kalem türlerini de taşır.
//  - Kritik stok (GET /api/workspace/stock/alerts): sonuç veri tabanına yazma olana kadar saklanır; yazmadan sonraki istek tazedir.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => (response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data);
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date(Date.now() + offset * 86_400_000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

describe("arka plan yenilemesi ucuz, güncellik bozulmaz (2.4.3 H2)", () => {
  let server;
  let admin;
  let customer;
  let item;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    customer = unwrap(await admin.post("/api/workspace/accounts", { name: "Takvim Müşteri", type: "customer", registeredOn: day(-30) })).id;
    item = unwrap(await admin.post("/api/workspace/stock", { name: "Rozet Ürünü", code: "RZT-1", unit: "Adet", unitPrice: 10, salePrice: 20, minQty: 5, openingQty: 50, openingPay: "none" }));
    item = item.id || item.item?.id;
    // Takvimde bir kalem olsun (vadesi 3 gün sonra açık satış faturası).
    const sale = await admin.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: customer, issueDate: day(0), lines: [{ itemId: item, qty: 1, unitPrice: 20, vatRate: 20 }], payment: { rest: "open", dueDate: day(3) }, force: true });
    assert.equal(sale.status, 200, JSON.stringify(sale.data).slice(0, 300));
  });
  after(async () => server?.close());

  const dues = async (client, since = "") => {
    const response = await client.get(`/api/workspace/dues${since ? `?since=${encodeURIComponent(since)}` : ""}`);
    assert.equal(response.status, 200);
    return { data: unwrap(response), bytes: JSON.stringify(response.data).length };
  };

  test("takvim: aynı sürüme 'değişmedi' (küçük yanıt), içerik değişince tamamı yeni sürümle", async () => {
    const first = await dues(admin);
    assert.ok(typeof first.data.version === "string" && first.data.version.length > 10, `yanıt sürüm taşır (${first.data.version})`);
    assert.ok(first.data.items.some(row => row.source === "invoice"), "açık faturanın kalemi takvimde");
    const same = await dues(admin, first.data.version);
    assert.equal(same.data.unchanged, true, `aynı sürüme 'değişmedi' (${JSON.stringify(same.data).slice(0, 200)})`);
    assert.equal(same.data.version, first.data.version);
    assert.equal(same.data.items, undefined, "kalemler yeniden gönderilmez");
    assert.ok(same.bytes < 200, `küçük yanıt (${same.bytes} bayt)`);
    // Takvimi DEĞİŞTİRMEYEN kayıt (peşin ödenmiş satış): sunucu takvimi yeniden hesaplar ama içerik aynı → yine 'değişmedi'.
    const paid = await admin.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: customer, issueDate: day(0), lines: [{ itemId: item, qty: 1, unitPrice: 10, vatRate: 20 }], payment: { cash: [{ amount: 12, method: "cash" }], rest: "open" }, force: true });
    assert.equal(paid.status, 200, JSON.stringify(paid.data).slice(0, 300));
    const afterPaid = await dues(admin, first.data.version);
    assert.equal(afterPaid.data.unchanged, true, "takvimi değiştirmeyen kayıttan sonra da 'değişmedi'");
    // Takvimi DEĞİŞTİREN kayıt (vadesi yarın açık satış): tamamı, yeni sürümle, yeni kalemle (güncellik).
    const open = await admin.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: customer, issueDate: day(0), lines: [{ itemId: item, qty: 2, unitPrice: 20, vatRate: 20 }], payment: { rest: "open", dueDate: day(1) }, force: true });
    assert.equal(open.status, 200);
    const changed = await dues(admin, first.data.version);
    assert.notEqual(changed.data.unchanged, true, "içerik değişti: 'değişmedi' denmez");
    assert.notEqual(changed.data.version, first.data.version, "yeni sürüm");
    assert.ok(changed.data.items.some(row => row.invoiceId === open.data.data.id), "yeni faturanın kalemi gelir");
    // Tahsilatla kapanan kalem de hemen düşer.
    const pay = await admin.post(`/api/workspace/accounts/${customer}/entries`, { kind: "in", amount: 48, date: day(0), method: "cash", invoiceId: open.data.data.id });
    assert.equal(pay.status, 200, JSON.stringify(pay.data).slice(0, 200));
    const closed = await dues(admin, changed.data.version);
    assert.notEqual(closed.data.unchanged, true, "kapanan kalem: 'değişmedi' denmez");
    assert.ok(!closed.data.items.some(row => row.invoiceId === open.data.data.id), "kapanan faturanın kalemi düştü");
  });

  test("takvim sürümü kişinin görebildiği kalem türlerini taşır (faturayı göremeyen başkasının sürümüyle 'değişmedi' almaz)", async () => {
    const own = await dues(admin);
    const staff = await createUser(server, admin, { username: "takvim-personel", role: "personel" });
    const theirs = await dues(staff, own.data.version);
    assert.notEqual(theirs.data.unchanged, true, "farklı yetkide yöneticinin sürümü geçmez");
    assert.notEqual(theirs.data.version, own.data.version);
    assert.ok(!theirs.data.items.some(row => row.source === "invoice"), "faturayı göremeyen fatura kalemi almaz");
    const again = await dues(staff, theirs.data.version);
    assert.equal(again.data.unchanged, true, "kendi sürümüyle 'değişmedi'");
  });

  test("kritik stok rozeti: veri değişmeden ikinci istek stok hareketlerini yeniden okumaz; değişince hemen tazedir", async () => {
    const store = server.app.context.store;
    const original = store.all;
    let moveReads = 0;
    store.all = function patched(sql, ...args) {
      if (/FROM stock_moves/.test(String(sql))) moveReads += 1;
      return original.call(this, sql, ...args);
    };
    try {
      const alerts = async () => unwrap(await admin.get("/api/workspace/stock/alerts"));
      const before = await alerts();
      assert.ok(!before.some(row => row.id === item), "ürün henüz kritik değil (50 > 5)");
      moveReads = 0;
      assert.deepEqual(await alerts(), before);
      assert.deepEqual(await alerts(), before);
      assert.equal(moveReads, 0, `veri değişmeden stok hareketleri yeniden okunmaz (${moveReads} okuma)`);
      // Satış ürünü kritik seviyeye indirir (50 − 1 − 1 − 2 = 46; 44 adet daha) → rozet hemen.
      const sale = await admin.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: customer, issueDate: day(0), lines: [{ itemId: item, qty: 44, unitPrice: 20, vatRate: 20 }], payment: { rest: "open" }, force: true });
      assert.equal(sale.status, 200, JSON.stringify(sale.data).slice(0, 300));
      const now = await alerts();
      const row = now.find(entry => entry.id === item);
      assert.ok(row, `satıştan sonra ürün kritik (${JSON.stringify(now)})`);
      assert.equal(row.qty, 2);
      // Kritik seviye düşürülünce rozet hemen boşalır (ürün kartı yazımı).
      const card = unwrap(await admin.get(`/api/workspace/stock/${item}`));
      const edit = await admin.put(`/api/workspace/stock/${item}`, { name: card.name, code: card.code, unit: card.unit, unitPrice: card.unitPrice, salePrice: card.salePrice, minQty: 1, kind: card.kind });
      assert.equal(edit.status, 200, JSON.stringify(edit.data).slice(0, 300));
      assert.ok(!(await alerts()).some(entry => entry.id === item), "kritik seviye 1 olunca rozetten düştü");
      // Dönen liste ortak değildir: çağıranın değiştirmesi sonraki yanıtı bozmaz.
      const first = await alerts();
      first.push({ id: "uydurma" });
      assert.ok(!(await alerts()).some(entry => entry.id === "uydurma"));
    } finally {
      store.all = original;
    }
  });
});
