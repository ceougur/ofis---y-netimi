// Gözden geçirme 2.4.3 (gg243, 5c): Stok Excel'inde tanınmayan KDV oranı (ör. "18") olan satır AKTARILIYOR ama bildirim onu "satır atlandı" sayıyordu
// (ve skippedTotal hiç yazılmıyordu); Stok Kodu başka üründe olan satır da aynı kalıpla "atlandı" görünüyordu. Artık: atlanan satır (skipped) ile alanı
// boş bırakılan satır (notes: vatUnknown, codeCleared) ayrı sayılır; bildirim metni sunucudan (message) — ekran bunu gösterir.
// Nasıl bozulur: aynı dosyada adı boş satır (gerçek atlama) + "18" KDV + başka üründe olan Stok Kodu + geçerli satır; ikinci yüklemede "atla" kipi.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

describe("gg243: Stok Excel bildirimi — atlanan satır ile boş bırakılan alan ayrı sayılır", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ now: "2026-06-17T09:00:00" });
    const raw = server.client();
    assert.equal((await raw.login("admin", ADMIN_PASSWORD)).status, 200);
    api = { get: async url => unwrap(await raw.get(url)), post: async (url, body) => unwrap(await raw.post(url, body)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    assert.equal((await api.post("/api/workspace/stock", { name: "Var Olan Ürün", code: "K9", unit: "Adet", unitPrice: "5" })).status, 200);
  });
  after(async () => {
    await server?.close();
  });

  test("tanınmayan KDV (18) ve başka üründeki Stok Kodu: satır aktarılır, 'atlandı' sayılmaz; gerçek atlama ayrı", async () => {
    const matrix = [
      ["Stok Kodu", "Ürün Adı", "Birim", "Birim Fiyat", "KDV Oranı"],
      ["K1", "Eski Oranlı Ürün", "Adet", "30", "18"],
      ["K9", "Kodu Çakışan Ürün", "Adet", "40", "20"],
      ["K3", "", "Adet", "50", "20"],
      ["K4", "Düzgün Ürün", "Adet", "60", "10"],
    ];
    const preview = (await api.post("/api/workspace/stock/import/preview", { matrix })).data;
    const done = await api.post("/api/workspace/stock/import", { matrix, headerAt: preview.headerAt, roles: preview.roles });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    const report = done.data;
    assert.equal(report.created, 3, "adı boş satır dışındaki üç satır aktarıldı");
    assert.equal(report.skippedTotal, 1, `yalnız adı boş satır atlandı: ${JSON.stringify(report.skipped)}`);
    assert.equal(report.vatUnknown, 1);
    assert.equal(report.codeCleared, 1);
    assert.equal(typeof report.message, "string", "bildirim metni sunucudan");
    assert.match(report.message, /^3 ürün açıldı\./);
    assert.match(report.message, /1 satır atlandı \(Ürün adı boş\)/);
    assert.match(report.message, /1 satırda KDV Oranı tanınmadı, boş bırakıldı/);
    assert.match(report.message, /1 satırda Stok Kodu başka üründe kullanıldığı için kod boş bırakıldı/);
    assert.doesNotMatch(report.message, /[23] satır atlandı/);
    const items = (await api.get("/api/workspace/stock?q=")).data;
    const list = items.items || items;
    const named = name => list.find(item => item.name === name);
    assert.equal(named("Eski Oranlı Ürün").vatRate, null, "oran boş kaldı");
    assert.equal(named("Kodu Çakışan Ürün").code, "", "kod boş kaldı");
  });

  test("'atla' kipinde zaten var olan satır gerçekten atlanır ve öyle sayılır", async () => {
    const matrix = [["Ürün Adı", "Birim", "KDV Oranı"], ["Düzgün Ürün", "Adet", "abc"]];
    const preview = (await api.post("/api/workspace/stock/import/preview", { matrix })).data;
    const report = (await api.post("/api/workspace/stock/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, mode: "skip" })).data;
    assert.equal(report.skippedTotal, 1);
    assert.match(report.message, /1 satır atlandı \(Bu ürün zaten var\)/);
  });
});
