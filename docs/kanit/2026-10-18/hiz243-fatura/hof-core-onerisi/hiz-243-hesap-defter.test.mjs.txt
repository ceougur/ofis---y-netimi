// 2.4.3 H2 (fatura modülü yükte hız testi, docs/kanit/2026-10-17/hiz-fatura): faturada her Tab / miktar değişikliği toplamı sunucuya
// hesaplatır (POST /api/workspace/invoices/calc; hiçbir şey yazmaz). hof-core.js her GET olmayan isteği "bu ekranda para/stok değişti"
// (ledger:changed, local) sayıyordu: kritik stok rozeti (hof-stock.js alertsSoon.now()) ve açık para pencereleri beklemeden yeniden isteniyordu
// — 5 pencerede 10 dakikada 1.402 hesap isteği → 1.619 rozet isteği. Yalnız hesaplayan / ön izleyen POST'lar defter değişikliği sayılmaz;
// gerçek yazımlar (fatura kaydı, iptal, tahsilat, Excel'den yükleme) eskisi gibi hemen bildirir.
// Kaynak dosyadaki kural olduğu gibi (metinden) yüklenir (test/liste-kapisi-daha-fazla.test.mjs ile aynı yöntem).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

function loadNote() {
  const src = readFileSync(new URL("../client/assets/hof-core.js", import.meta.url), "utf8");
  const start = src.indexOf("const LEDGER_PATHS = [");
  const end = src.indexOf("// ---------- Yükleme hatası", start);
  assert.ok(start > 0 && end > start, "noteLedgerChange kaynağı bulunamadı");
  const emitted = [];
  const context = { HOF: { emit: (name, detail) => emitted.push({ name, detail }) } };
  vm.runInNewContext(`${src.slice(start, end)}\nglobalThis.note = noteLedgerChange;`, context);
  return { note: context.note, emitted };
}

describe("yalnız hesaplayan / ön izleyen istekler defter değişikliği sayılmaz (2.4.3 H2)", () => {
  it("fatura toplamı, görünüm ön izlemesi ve Excel ön izlemeleri olay yayımlamaz", () => {
    const { note, emitted } = loadNote();
    for (const path of ["/api/workspace/invoices/calc", "/api/workspace/invoices/calc?x=1", "/api/workspace/invoices/view-preview", "/api/workspace/stock/import/preview", "/api/workspace/accounts/import/preview", "/api/workspace/cheques/import/preview", "/api/workspace/plans/import/preview"]) note(path);
    assert.deepEqual(emitted, []);
  });
  it("gerçek yazımlar eskisi gibi hemen bildirilir (tür listesiyle)", () => {
    const { note, emitted } = loadNote();
    note("/api/workspace/invoices");
    note("/api/workspace/invoices/abc/cancel");
    note("/api/workspace/invoices/abc/calculate-later");
    note("/api/workspace/stock/import");
    note("/api/workspace/accounts/x/entries");
    note("/api/workspace/cash");
    assert.deepEqual(emitted.map(item => [item.name, item.detail.path, item.detail.local]), [
      ["ledger:changed", "/api/workspace/invoices", true],
      ["ledger:changed", "/api/workspace/invoices/abc/cancel", true],
      ["ledger:changed", "/api/workspace/invoices/abc/calculate-later", true],
      ["ledger:changed", "/api/workspace/stock/import", true],
      ["ledger:changed", "/api/workspace/accounts/x/entries", true],
      ["ledger:changed", "/api/workspace/cash", true],
    ]);
    assert.deepEqual(Array.from(emitted[0].detail.kinds), ["invoices", "stock", "cash", "accounts", "cheques", "plans"]);
  });
});
