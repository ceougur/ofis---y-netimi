// 2.4.3 göç v28 (stok kartında KDV oranı) — ESKİ SÜRÜMÜN GERÇEK KODUYLA üretilen veri (test kuralı): v2.4.2 etiketi açılır, API'sinden stok kartları,
// alış faturası (faturadan yeni stok kartı), satış faturası ve stok hareketi girilir; aynı veri dosyası güncel kodla açılır.
// Beklenen: göç yalnız ekleyici (kolon NULL = tanımsız, bugünkü davranış), stok miktarı / değeri / faturalar aynı, Mutabakat Testi temiz; kart düzenlemesi
// (KDV alanını göndermeyen istemci) oranı değiştirmez; KDV yazılan kart faturada önerilir. Geri dönüş: v2.4.2 göçlü dosyayı açıp yazar; oran silinmez.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.4.2";

describe(`göç v28: ${OLD} verisi güncel kodla açılır (stok kartında KDV oranı)`, () => {
  const root = mkdtempSync(path.join(tmpdir(), "goc-243-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } };
  after(() => rmSync(root, { recursive: true, force: true }));

  test("eski veride oran boş; miktar, değer, faturalar aynı; düzenleme oranı korur; yazılan oran faturada gelir; Mutabakat Testi temiz", async () => {
    const old = await bootVersion(OLD, dirs);
    let before;
    try {
      const api = await old.login();
      const ok = async (label, promise) => {
        const res = await promise;
        assert.equal(res.status, 200, `${OLD} ${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
        return res.data;
      };
      await ok("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
      await ok("stok", api.post("/api/workspace/stock", { name: "Çay 1 Kg", code: "CY1", unit: "Adet", unitPrice: "200", salePrice: "260", openingQty: "40" }));
      await ok("stok", api.post("/api/workspace/stock", { name: "Şeker 5 Kg", code: "SK5", unit: "Adet", unitPrice: "150", salePrice: "190", openingQty: "10", minQty: "12" }));
      const supplier = await ok("tedarikçi", api.post("/api/workspace/accounts", { name: "Gıda Toptan A.Ş.", type: "supplier" }));
      const customer = await ok("müşteri", api.post("/api/workspace/accounts", { name: "Kafe Deniz", type: "customer" }));
      await ok("alış (yeni kart)", api.post("/api/workspace/invoices", { kind: "purchase", scenario: "goods_purchase", accountId: supplier.id, number: "GT-1", lines: [{ name: "Kahve 500 Gr", qty: 20, unitPrice: 300, vatRate: 1, newItem: true, newSalePrice: "420" }], payment: { rest: "open" } }));
      const items = (await ok("liste", api.get("/api/workspace/stock"))).items;
      const cay = items.find(item => item.name === "Çay 1 Kg");
      await ok("satış", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: customer.id, lines: [{ itemId: cay.id, name: "Çay 1 Kg", qty: 5, unitPrice: 260, vatRate: 1 }], payment: { rest: "open" } }));
      const list = await ok("liste", api.get("/api/workspace/stock"));
      before = { totals: list.totals, items: list.items.map(item => ({ name: item.name, qty: item.qty, value: item.value })).sort((a, b) => a.name.localeCompare(b.name)), invoices: old.app.store.get("SELECT COUNT(*) AS n, SUM(try_payable) AS total FROM invoices").n };
      assert.equal(old.app.store.all("PRAGMA table_info(stock_items)").some(column => column.name === "vat_rate"), false, `${OLD} şemasında kolon yok`);
    } finally {
      await old.close();
    }

    const current = await bootVersion(CURRENT, dirs);
    try {
      const api = await current.login();
      assert.equal(current.app.store.get("PRAGMA user_version").user_version, LATEST_VERSION);
      assert.ok(LATEST_VERSION >= 28);
      assert.deepEqual(current.app.store.all("SELECT name, vat_rate AS v FROM stock_items ORDER BY name").map(row => row.v), [null, null, null], "eski kartlarda oran boş");
      const list = (await api.get("/api/workspace/stock")).data;
      assert.deepEqual(list.items.map(item => ({ name: item.name, qty: item.qty, value: item.value })).sort((a, b) => a.name.localeCompare(b.name)), before.items, "miktar ve değer aynı");
      assert.equal(list.totals.value, before.totals.value, "stok değeri aynı");
      assert.equal(current.app.store.get("SELECT COUNT(*) AS n FROM invoices").n, before.invoices, "faturalar aynı");
      const cay = list.items.find(item => item.name === "Çay 1 Kg");
      assert.equal(cay.vatRate, null);
      const search = (await api.get("/api/workspace/invoices/items?q=Çay")).data.items.find(item => item.id === cay.id);
      assert.equal(search.vatRate, null, "fatura araması eski kartta boş oran döner");
      // Eski istemci gibi KDV alanı olmadan düzenleme: oran değişmez (NULL kalır); sonra oran yazılır.
      assert.equal((await api.put(`/api/workspace/stock/${cay.id}`, { name: "Çay 1 Kg", salePrice: "270" })).status, 200);
      assert.equal((await api.get(`/api/workspace/stock/${cay.id}`)).data.vatRate, null);
      assert.equal((await api.put(`/api/workspace/stock/${cay.id}`, { vatRate: "1" })).status, 200);
      assert.equal((await api.get("/api/workspace/invoices/items?q=Çay")).data.items.find(item => item.id === cay.id).vatRate, 1);
      const customer = current.app.store.get("SELECT id FROM accounts WHERE name = 'Kafe Deniz'");
      const sale = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: customer.id, lines: [{ itemId: cay.id, name: "Çay 1 Kg", qty: 1, unitPrice: 270, vatRate: 1 }], payment: { rest: "open" } });
      assert.equal(sale.status, 200, JSON.stringify(sale.data));
      const integrity = await api.get("/api/workspace/ledger/integrity");
      assert.equal(integrity.status, 200);
      assert.deepEqual(integrity.data.failures, [], JSON.stringify(integrity.data.failures).slice(0, 400));
    } finally {
      await current.close();
    }

    // Güncellemeden geri dönüş (deneme kipi önceki sürüme döner): v2.4.2 göçlü dosyayı açar, kolonu görmeden çalışır; yazdığı kartta oran boş kalır.
    const back = await bootVersion(OLD, dirs);
    try {
      const api = await back.login();
      const list = await api.get("/api/workspace/stock");
      assert.equal(list.status, 200);
      assert.equal(list.data.items.length, 3);
      assert.equal((await api.post("/api/workspace/stock", { name: "Geri Dönüş Kartı", unit: "Adet", unitPrice: "5" })).status, 200, `${OLD} göçlü dosyada kart açar`);
      assert.equal((await api.put(`/api/workspace/stock/${list.data.items.find(item => item.name === "Çay 1 Kg").id}`, { name: "Çay 1 Kg", salePrice: "275" })).status, 200);
    } finally {
      await back.close();
    }
    const again = await bootVersion(CURRENT, dirs);
    try {
      const rows = Object.fromEntries(again.app.store.all("SELECT name, vat_rate AS v FROM stock_items").map(row => [row.name, row.v]));
      assert.equal(rows["Geri Dönüş Kartı"], null, "eski sürümün açtığı kartta oran boş");
      assert.equal(rows["Çay 1 Kg"], 1, "eski sürümün düzenlemesi (kolonu bilmeyen UPDATE) oranı silmez");
      const api = await again.login();
      assert.deepEqual((await api.get("/api/workspace/ledger/integrity")).data.failures, []);
    } finally {
      await again.close();
    }
  });
});
