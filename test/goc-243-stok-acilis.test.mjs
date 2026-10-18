// 2.4.3 göç v30 (MM4: stok açılışı işareti) — ESKİ SÜRÜMÜN GERÇEK KODUYLA üretilen veri (test kuralı): v2.4.2 etiketi açılır, API'sinden ürün kartında
// açılış stoku, Excel'den ürün (miktarlı), Kasa'dan peşin İlk Alım, yalnız miktar girişi ve satış girilir; Eylül kilitlenir. Aynı veri dosyası güncel
// kodla açılır. Beklenen (kullanıcı kararı 18.10.2026: eski verideki açılışlar da mizana gelir): programın yazdığı açılış hareketleri işaretlenir;
// 153 ve 500 açılış toplamı kadar değişir, başka hiçbir hesap değişmez; kilit izi değişmez (kapı "kapanmış dönem" demez); Mutabakat Testi temiz
// (stock:opening dahil); stok miktarı ve değeri aynı. Geri dönüş: v2.4.2 göçlü dosyayı açar ve yazar.
//
// KÂHİN (elle): açılışlar Masa 4 × 1.250 = 5.000 (kart, 15.09) + Sandalye 12 × 300 = 3.600 (Excel) = 8.600. İlk Alım (Lamba 5 × 80 = 400, Kasa) ve
// yalnız miktar girişi (Masa +1, açıklama "Sayım fazlası") açılış DEĞİLDİR.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { LATEST_VERSION } from "../server/lib/migrations.mjs";
import { lockDigestOf } from "../server/lib/integrity.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.4.2";
const NOW = "2026-10-20T12:00:00+03:00";

describe(`göç v30: ${OLD} verisindeki stok açılışları Ana Defter'e gelir (B 153 / A 500)`, () => {
  const root = mkdtempSync(path.join(tmpdir(), "goc-243-acilis-"));
  const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: NOW };
  after(() => rmSync(root, { recursive: true, force: true }));

  test("eski veride açılışlar işaretlenir; yalnız 153 / 500 değişir; kilit izi aynı; Mutabakat Testi temiz; geri dönüş çalışır", async () => {
    const old = await bootVersion(OLD, dirs);
    let before;
    try {
      const api = await old.login();
      const ok = async (label, promise) => {
        const res = await promise;
        assert.equal(res.status, 200, `${OLD} ${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
        return res.data;
      };
      await ok("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
      const masa = await ok("Masa (açılış)", api.post("/api/workspace/stock", { name: "Masa", unit: "Adet", unitPrice: "1.250", openingQty: "4", openingDate: "2026-09-15" }));
      const matrix = [["Ürün Kodu", "Ürün Adı", "Birim", "Miktar", "Birim Fiyat"], ["SN1", "Sandalye", "Adet", "12", "300"], ["DL1", "Dolap", "Adet", "", "900"]];
      const preview = await ok("Excel önizleme", api.post("/api/workspace/stock/import/preview", { matrix }));
      await ok("Excel", api.post("/api/workspace/stock/import", { matrix, headerAt: preview.headerAt, roles: preview.roles }));
      await ok("Lamba (İlk Alım, Kasa)", api.post("/api/workspace/stock", { name: "Lamba", unit: "Adet", unitPrice: "80", openingQty: "5", openingPay: "cash", openingDate: "2026-09-16", cashForce: true }));
      await ok("yalnız miktar", api.post(`/api/workspace/stock/${masa.id}/moves`, { kind: "in", qty: "1", unitPrice: "1.250", pay: "none", date: "2026-09-20", note: "Sayım fazlası" }));
      const customer = await ok("müşteri", api.post("/api/workspace/accounts", { name: "Ofis Kurulum Ltd.", type: "customer" }));
      await ok("veresiye satış", api.post(`/api/workspace/stock/${masa.id}/moves`, { kind: "out", qty: "2", unitPrice: "1.600", pay: "account", accountId: customer.id, date: "2026-09-25" }));
      await ok("kilit", api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" }));
      const ledger = await ok("mizan", api.get("/api/workspace/ledger"));
      const stock = await ok("stok", api.get("/api/workspace/stock"));
      before = {
        accounts: Object.fromEntries(ledger.trial.accounts.map(row => [row.code, row.balance])),
        stock: stock.items.map(item => ({ name: item.name, qty: item.qty, value: item.value })).sort((a, b) => a.name.localeCompare(b.name)),
        value: stock.totals.value,
        digest: lockDigestOf(old.app.store, "2026-09-30"),
      };
      assert.equal(old.app.store.all("PRAGMA table_info(stock_moves)").some(column => column.name === "is_opening"), false, `${OLD} şemasında kolon yok`);
    } finally {
      await old.close();
    }

    const current = await bootVersion(CURRENT, dirs);
    try {
      const api = await current.login();
      assert.equal(current.app.store.get("PRAGMA user_version").user_version, LATEST_VERSION);
      assert.ok(LATEST_VERSION >= 30);
      const flagged = current.app.store.all("SELECT m.note, m.qty, m.unit_price AS price, i.name FROM stock_moves m JOIN stock_items i ON i.id = m.item_id WHERE m.is_opening = 1 ORDER BY i.name");
      assert.deepEqual(flagged.map(row => [row.name, row.qty, row.price]), [["Masa", 4, 1250], ["Sandalye", 12, 300]], "yalnız programın yazdığı açılışlar işaretli");
      const ledger = (await api.get("/api/workspace/ledger")).data;
      const after = Object.fromEntries(ledger.trial.accounts.map(row => [row.code, row.balance]));
      assert.equal((after["153"] ?? 0) - (before.accounts["153"] ?? 0), 8600, "153 açılış kadar arttı (kâhin 8.600)");
      assert.equal((after["500"] ?? 0) - (before.accounts["500"] ?? 0), -8600, "500 açılış kadar azaldı");
      for (const code of new Set([...Object.keys(before.accounts), ...Object.keys(after)])) if (!["153", "500"].includes(code)) assert.equal(after[code] ?? 0, before.accounts[code] ?? 0, `${code} değişmemeli`);
      assert.equal(ledger.trial.balanced, true);
      assert.equal(lockDigestOf(current.app.store, "2026-09-30", { version: "2.4.2" }), before.digest, "kilit izi göç öncesiyle aynı");
      const stock = (await api.get("/api/workspace/stock")).data;
      assert.deepEqual(stock.items.map(item => ({ name: item.name, qty: item.qty, value: item.value })).sort((a, b) => a.name.localeCompare(b.name)), before.stock, "stok miktarı ve değeri aynı");
      const integrity = (await api.get("/api/workspace/ledger/integrity")).data;
      assert.deepEqual(integrity.failures, [], JSON.stringify(integrity.failures).slice(0, 400));
      assert.equal(integrity.checks.find(item => item.code === "stock:opening")?.ok, true);
      // Açık dönemde yeni açılış (güncel kod) da gelir; kapı temiz.
      const res = await api.post("/api/workspace/stock", { name: "Askılık", unit: "Adet", unitPrice: "150", openingQty: "2", openingDate: "2026-10-05" });
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.equal((await api.get("/api/workspace/ledger")).data.trial.accounts.find(row => row.code === "153").balance - (after["153"] ?? 0), 300);
    } finally {
      await current.close();
    }

    // Geri dönüş: v2.4.2 göçlü dosyayı açar, kolonu görmez; açtığı açılış işaretsiz kalır (BİLİNEN SINIR: güncel koda dönünce bu açılış deftere gelmez —
    // göç bir kez koşar). Güncel kod dosyayı yine açar, Mutabakat Testi temiz.
    const back = await bootVersion(OLD, dirs);
    try {
      const api = await back.login();
      assert.equal((await api.post("/api/workspace/stock", { name: "Geri Dönüş Ürünü", unit: "Adet", unitPrice: "10", openingQty: "3", openingDate: "2026-10-06" })).status, 200);
    } finally {
      await back.close();
    }
    const again = await bootVersion(CURRENT, dirs);
    try {
      const api = await again.login();
      assert.equal(again.app.store.get("SELECT m.is_opening AS f FROM stock_moves m JOIN stock_items i ON i.id = m.item_id WHERE i.name = 'Geri Dönüş Ürünü'").f, 0);
      assert.deepEqual((await api.get("/api/workspace/ledger/integrity")).data.failures, []);
    } finally {
      await again.close();
    }
  });
});
