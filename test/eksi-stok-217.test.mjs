// 2.0.17 madde 7 (müşteri: "eksiye düşenin kaça düştüğünü göstermiyor"): 0 → −10 → −15 → −20; her ekranda sayı.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { stockLevel } from "../server/lib/accounts.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

describe("stockLevel: eksi stok durumu ve değeri", () => {
  test("eksi miktar → durum 'negative', değer eksi miktar × son maliyet; 0 → 'out'", () => {
    const level = stockLevel({ minQty: 0, unitPrice: 10 }, [{ kind: "out", qty: 15 }]);
    assert.deepEqual([level.qty, level.state, level.negative, level.value], [-15, "negative", true, -150]);
    assert.equal(stockLevel({ minQty: 0, unitPrice: 10 }, [{ kind: "in", qty: 2 }, { kind: "out", qty: 2 }]).state, "out");
    assert.equal(stockLevel({ minQty: 5, unitPrice: 10 }, [{ kind: "out", qty: 1 }]).low, true, "kritik seviyesi olan eksi ürün kritik listesinde de görünür");
  });
});

describe("Eksi stok API: liste, süzgeç, rapor, ANLIK DURUM, soru metni", () => {
  let server;
  let admin;
  let item;
  const unwrap = r => (r.data && "ok" in r.data ? r.data.data : r.data);
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    item = unwrap(await admin.post("/api/workspace/stock", { name: "Çay 1 Kg", code: "CAY-1", unit: "Adet", unitPrice: 50 }));
  });
  after(() => server.close());

  test("soru metni sonucu söyler; izinle 0 → −10 → −15 → −20", async () => {
    const asked = await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "10", note: "satış" });
    assert.equal(asked.status, 409);
    assert.equal(asked.data.error?.code || asked.data.code, "stock-negative");
    assert.match(asked.data.error?.message || asked.data.error || "", /Kayıttan sonra stok: -10 Adet olacak/);
    for (const [qty, expected] of [["10", -10], ["5", -15], ["5", -20]]) {
      const saved = await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty, note: "satış", force: true });
      assert.equal(saved.status, 200, JSON.stringify(saved.data));
      assert.equal(unwrap(saved).qty, expected);
    }
  });
  test("liste: state=negative süzgeci, totals.negative, değer eksi (−20 × 50 = −1.000)", async () => {
    const all = unwrap(await admin.get("/api/workspace/stock"));
    const row = all.items.find(entry => entry.id === item.id);
    assert.deepEqual([row.qty, row.state, row.value], [-20, "negative", -1000]);
    assert.equal(all.totals.negative, 1);
    const negatives = unwrap(await admin.get("/api/workspace/stock?state=negative"));
    assert.deepEqual(negatives.items.map(entry => entry.id), [item.id]);
    assert.equal(unwrap(await admin.get(`/api/workspace/stock/${item.id}`)).qty, -20);
  });
  test("Stok Durumu raporu: Durum 'Eksi (−20 Adet)', özet 'Eksi Stok'; kategori raporunda Eksi Stok kolonu; ANLIK DURUM eksi sayısı", async () => {
    const report = unwrap(await admin.get("/api/workspace/report-center/stok-durumu?state=negative"));
    assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0].at(-1), "Eksi (-20 Adet)");
    assert.ok(report.summary.some(([label, value]) => label === "Eksi Stok" && value === "1"));
    const groups = unwrap(await admin.get("/api/workspace/report-center/stok-kategori"));
    if (groups?.headers) assert.ok(groups.headers.includes("Eksi Stok"));
    const view = unwrap(await admin.get("/api/workspace/overview"));
    assert.equal(view.stock.negative, 1);
    const hits = unwrap(await admin.get("/api/workspace/invoices/items?q=CAY"));
    assert.equal(hits.items[0].available, -20, "fatura kalemi önerisinde eksi stok sayısı");
  });
});
