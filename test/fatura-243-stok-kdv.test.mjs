// 2.4.3 — stok kartı ve fatura kalemi (fatura hız testi H8; keşif B8, B9). Sahte saat (ders 13).
//   H8  KDV oranı stok kartında yoktu; her kalemde elle seçiliyordu → kartta isteğe bağlı "KDV Oranı" (göç v28, boş = bugünkü davranış); faturanın
//       ürün aramasında gelir; Excel / Sheets yüklemesinde "KDV Oranı" kolonu; düzenlemede gövdede yoksa korunur; faturadan açılan kart kalemin KDV'sini alır.
//   B9  Eksi stoktaki ürün üç göstergede birden (Kritik, Tükenen, Eksi Stokta) sayılıyordu → göstergeler ayrışık; süzgeç = gösterge; uyarı listesi
//       (sol menü rozeti / bildirim) dikkat isteyen hepsini kapsar.
//   B8  "Kritik stok" bildirimi her yeni oturumda yineleniyordu → kullanıcı başına günde bir kez (sunucuda).
// Nasıl bozulur: boş / geçersiz oran, düzenlemede alanı göndermeyen istemci, Excel'de "%20", "0,10", "abc", güncelle kipinde boş hücre; eski veri (NULL);
// 0 / eksi / kritik / bol stok ürünleri aynı listede; iki kullanıcı, aynı gün iki kez, ertesi gün.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ADMIN_PASSWORD, createUser, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

describe("2.4.3: stok kartında KDV oranı, ayrışık stok göstergeleri, günde bir kritik stok bildirimi", () => {
  let server;
  let api;
  let raw;
  before(async () => {
    server = await startTestServer({ now: "2026-06-17T09:00:00" });
    raw = server.client();
    assert.equal((await raw.login("admin", ADMIN_PASSWORD)).status, 200);
    api = { get: async url => unwrap(await raw.get(url)), post: async (url, body) => unwrap(await raw.post(url, body)), put: async (url, body) => unwrap(await raw.put(url, body)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
  });
  after(async () => {
    await server?.close();
  });
  const item = async id => (await api.get(`/api/workspace/stock/${id}`)).data;
  const hit = async name => (await api.get(`/api/workspace/invoices/items?q=${encodeURIComponent(name)}`)).data.items.find(entry => entry.name === name);

  test("H8: kartta KDV oranı yazılır, faturanın ürün aramasında gelir; düzenlemede gövdede yoksa korunur, boşla kalkar; geçersiz oran 400", async () => {
    const created = await api.post("/api/workspace/stock", { name: "Defter A4", unit: "Adet", unitPrice: "20", salePrice: "35", vatRate: "10" });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const id = created.data.id || created.data.item?.id;
    assert.equal((await item(id)).vatRate, 10);
    assert.equal((await hit("Defter A4")).vatRate, 10, "fatura ürün araması KDV oranını verir");
    const kept = await api.put(`/api/workspace/stock/${id}`, { name: "Defter A4", salePrice: "36" });
    assert.equal(kept.status, 200, JSON.stringify(kept.data));
    assert.equal((await item(id)).vatRate, 10, "gövdede yoksa korunur");
    assert.equal((await item(id)).salePrice, 36);
    const bad = await api.put(`/api/workspace/stock/${id}`, { vatRate: "18" });
    assert.equal(bad.status, 400);
    assert.match(bad.data.error, /%0, %1, %10, %20/);
    assert.equal((await item(id)).vatRate, 10, "reddedilen istek değiştirmez");
    const cleared = await api.put(`/api/workspace/stock/${id}`, { vatRate: "" });
    assert.equal(cleared.status, 200);
    assert.equal((await item(id)).vatRate, null, "boş = faturada seçilir");
    const plain = await api.post("/api/workspace/stock", { name: "Kalem", unit: "Adet", unitPrice: "5" });
    assert.equal((await hit("Kalem")).vatRate, null, "oran verilmeyen kart boş (bugünkü davranış)");
    assert.ok(plain.status === 200);
  });

  test("H8: Excel / Sheets yüklemesi — KDV Oranı kolonu tanınır (%20, 1, 0,10); tanınmayan değer boş kalır ve rapora düşer; güncellemede boş hücre eskisini silmez", async () => {
    const matrix = [["Stok Kodu", "Ürün Adı", "Birim", "Birim Fiyat", "KDV Oranı"], ["K1", "Un 1 Kg", "Adet", "30", "%1"], ["K2", "Boya 15 Lt", "Adet", "900", "20"], ["K3", "Kitap", "Adet", "120", "0,10"], ["K4", "Garip Ürün", "Adet", "10", "abc"]];
    const preview = (await api.post("/api/workspace/stock/import/preview", { matrix })).data;
    assert.equal(preview.roles[4], "vat", JSON.stringify(preview.roles));
    assert.equal(preview.roles[3], "price", "Birim Fiyat yine fiyat");
    const done = (await api.post("/api/workspace/stock/import", { matrix, headerAt: preview.headerAt, roles: preview.roles })).data;
    assert.equal(done.created, 4, JSON.stringify(done));
    // Gözden geçirme 2.4.3 (5c): satır aktarılır, yalnız oran boş kalır — "atlandı" değil, not (notes) olarak raporlanır.
    assert.ok(done.notes.some(item => /KDV oranı “abc” tanınmadı/.test(item.reason)), JSON.stringify(done.notes));
    assert.equal(done.skippedTotal, 0, JSON.stringify(done.skipped));
    assert.deepEqual([await hit("Un 1 Kg"), await hit("Boya 15 Lt"), await hit("Kitap"), await hit("Garip Ürün")].map(item => item.vatRate), [1, 20, 10, null]);
    // "KDV Dahil Fiyat" bir fiyat kolonudur, KDV oranı sayılmaz.
    const dahil = (await api.post("/api/workspace/stock/import/preview", { matrix: [["Ürün Adı", "KDV Dahil Fiyat"], ["X", "12"]] })).data;
    assert.notEqual(dahil.roles[1], "vat");
    // Güncelle kipinde boş KDV hücresi kartın oranını silmez; dolu hücre değiştirir.
    const again = [["Stok Kodu", "Ürün Adı", "Birim", "KDV Oranı"], ["K1", "Un 1 Kg", "Adet", ""], ["K2", "Boya 15 Lt", "Adet", "10"]];
    const p2 = (await api.post("/api/workspace/stock/import/preview", { matrix: again })).data;
    const upd = (await api.post("/api/workspace/stock/import", { matrix: again, headerAt: p2.headerAt, roles: p2.roles, mode: "update" })).data;
    assert.equal(upd.updated, 2, JSON.stringify(upd));
    assert.equal((await hit("Un 1 Kg")).vatRate, 1);
    assert.equal((await hit("Boya 15 Lt")).vatRate, 10);
  });

  test("H8: faturadan açılan yeni stok kartı kalemin KDV oranını alır; eski veri (NULL) faturayı bozmaz", async () => {
    const supplier = (await api.post("/api/workspace/accounts", { name: "Toptancı Ltd.", type: "supplier" })).data;
    const invoice = await api.post("/api/workspace/invoices", { kind: "purchase", scenario: "goods_purchase", accountId: supplier.id, number: "ALS-1", lines: [{ name: "Silgi", qty: 10, unitPrice: 4, vatRate: 10, newItem: true, newSalePrice: "7" }], payment: { rest: "open" } });
    assert.equal(invoice.status, 200, JSON.stringify(invoice.data));
    assert.equal((await hit("Silgi")).vatRate, 10);
    // Eski sürümden gelen kart: kolon NULL (göçün varsayılanı) → arama null döner, satış faturası kalemde verilen oranla kesilir.
    server.app.store.raw?.("test.eski-kart", () => server.app.store.run("UPDATE stock_items SET vat_rate = NULL WHERE name = 'Silgi'")) ?? server.app.store.run("UPDATE stock_items SET vat_rate = NULL WHERE name = 'Silgi'");
    const silgi = await hit("Silgi");
    assert.equal(silgi.vatRate, null);
    const buyer = (await api.post("/api/workspace/accounts", { name: "Okul Kantini", type: "customer" })).data;
    const sale = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: buyer.id, lines: [{ itemId: silgi.id, name: "Silgi", qty: 2, unitPrice: 7, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(sale.status, 200, JSON.stringify(sale.data));
    assert.equal(sale.data.lines[0].vatRate, 20);
  });

  test("B9: göstergeler ayrışık (Kritik / Tükenen / Eksi Stokta); süzgeç satırları = gösterge; uyarı listesi dikkat isteyen hepsini kapsar", async () => {
    const make = async (name, minQty, qty) => {
      const created = await api.post("/api/workspace/stock", { name, unit: "Adet", unitPrice: "10", minQty: String(minQty), openingQty: qty > 0 ? String(qty) : "" });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const id = created.data.id || created.data.item?.id;
      if (qty < 0) {
        const out = await api.post(`/api/workspace/stock/${id}/moves`, { kind: "out", qty: String(-qty), date: "2026-06-17", force: true });
        assert.equal(out.status, 200, JSON.stringify(out.data));
      }
      return id;
    };
    const low = await make("Gösterge Kritik", 5, 3);
    const zero = await make("Gösterge Sıfır", 5, 0);
    const negative = await make("Gösterge Eksi", 5, -15);
    await make("Gösterge Bol", 5, 50);
    const all = (await api.get("/api/workspace/stock?q=Gösterge")).data;
    assert.deepEqual([all.totals.low, all.totals.out, all.totals.negative], [1, 1, 1], JSON.stringify(all.totals));
    for (const [state, id] of [["low", low], ["out", zero], ["negative", negative]]) {
      const filtered = (await api.get(`/api/workspace/stock?q=Gösterge&state=${state}`)).data;
      assert.deepEqual(filtered.items.map(item => item.id), [id], `${state} süzgeci`);
    }
    const alerts = (await api.get("/api/workspace/stock/alerts")).data.map(item => item.id);
    for (const id of [low, zero, negative]) assert.ok(alerts.includes(id), "dikkat isteyen ürün uyarı listesinde");
    const overview = (await api.get("/api/workspace/overview")).data;
    if (overview?.stock) assert.equal(overview.stock.critical + overview.stock.out + overview.stock.negative >= 3, true);
  });

  test("B8: Kritik stok bildirimi kullanıcı başına günde bir kez (yeni oturum / başka kullanıcı / ertesi gün)", async () => {
    const first = await api.post("/api/workspace/stock/alerts/notified", {});
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.equal(first.data.show, true);
    assert.equal((await api.post("/api/workspace/stock/alerts/notified", {})).data.show, false, "aynı gün ikinci kez gösterilmez");
    const again = server.client();
    assert.equal((await again.login("admin", ADMIN_PASSWORD)).status, 200);
    assert.equal(unwrap(await again.post("/api/workspace/stock/alerts/notified", {})).data.show, false, "yeni oturumda da yinelenmez");
    const staff = await createUser(server, raw, { username: "depo1", role: "admin" });
    assert.equal(unwrap(await staff.post("/api/workspace/stock/alerts/notified", {})).data.show, true, "başka kullanıcı kendi gününde görür");
    server.clock.advance({ days: 1 });
    assert.equal((await api.post("/api/workspace/stock/alerts/notified", {})).data.show, true, "ertesi gün yeniden");
  });
});
