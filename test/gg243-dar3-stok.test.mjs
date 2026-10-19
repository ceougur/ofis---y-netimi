// Dar kontrol 3 (2.4.3; bağımsız denetçi betiği dar3-243 t5-stok) — B-3 DÜŞÜK: stok açılış hareketi Düzenle ile peşine çevrilip (işaret düşer, alım olur)
// sonra yeniden "yalnız miktar"a çevrilince is_opening geri gelmiyordu; açılış 153/500'den sessizce düşüyor, Mutabakat Testi görmüyordu. Karar: açılış
// tanımı göç v30 ile AYNI (işaretli açılmış YA DA açıklaması programın açılış metni olan yalnız miktar girişi, faturasız, iadesiz).
// KÂHİN (elle, programdan bağımsız): Vida açılışı 5 Adet × 12,345 TL = 61,725 → 61,73 TL (B 153 / A 500); peşine çevrilince B 153 / A 100 61,73;
// yeniden yalnız miktar → yine B 153 / A 500 61,73, Kasa 0.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import * as accountsLib from "../server/lib/accounts.mjs";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { bootBank, trialBalances } from "./banka-210-hesap-ortak.mjs";

const balance = (rows, code) => rows[code] ?? 0;

describe("gg243 dar kontrol 3: stok açılışı Düzenle gidiş-dönüş (B-3)", () => {
  let ctx;
  let api;
  before(async () => {
    ctx = await bootBank({ now: "2026-10-20T12:00:00+03:00" });
    api = ctx.api;
    await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(() => ctx?.server.close());

  it("açılış → peşin → yeniden yalnız miktar: açılış geri gelir (153 = 61,73, 500 = −61,73, Kasa 0); Mutabakat Testi tamam", async () => {
    const item = await must("Vida", api.post("/api/workspace/stock", { name: "Vida", unit: "Adet", unitPrice: "12,345", openingQty: "5", openingDate: "2026-10-01" }));
    const move = item.moves[0];
    assert.equal(move.note, "Açılış stoku");
    let rows = await trialBalances(api);
    assert.deepEqual([balance(rows, "153"), balance(rows, "500"), balance(rows, "100")], [61.73, -61.73, 0]);
    await must("peşine çevir", api.put(`/api/workspace/stock/${item.id}/moves/${move.id}`, { kind: "in", qty: "5", unitPrice: "12,345", date: "2026-10-01", note: "Açılış stoku", pay: "cash", method: "cash", cashForce: true }));
    rows = await trialBalances(api);
    assert.deepEqual([balance(rows, "153"), balance(rows, "500"), balance(rows, "100")], [61.73, 0, -61.73], "peşin: alım (B 153 / A 100)");
    await must("yeniden yalnız miktar", api.put(`/api/workspace/stock/${item.id}/moves/${move.id}`, { kind: "in", qty: "5", unitPrice: "12,345", date: "2026-10-01", note: "Açılış stoku", pay: "none", cashForce: true }));
    rows = await trialBalances(api);
    assert.deepEqual([balance(rows, "153"), balance(rows, "500"), balance(rows, "100")], [61.73, -61.73, 0], "yalnız miktar: yine açılış (göç v30 tanımı)");
    assert.equal(ctx.server.app.store.get("SELECT is_opening AS o FROM stock_moves WHERE id = ?", move.id).o, 1);
    const result = await integrityOk(api, "gidiş-dönüş");
    assert.equal(result.checks.find(check => check.code === "stock:opening")?.ok, true);
  });

  it("Excel açılışı (\"Açılış stoku (Excel)\") da aynı: peşin → yalnız miktar dönüşünde açılış geri gelir", async () => {
    const matrix = [["Ürün Adı", "Birim", "Miktar", "Birim Fiyat"], ["Pul", "Adet", "7", "1,5"]];
    const preview = await must("önizleme", api.post("/api/workspace/stock/import/preview", { matrix }));
    await must("yükle", api.post("/api/workspace/stock/import", { matrix, headerAt: preview.headerAt, roles: preview.roles }));
    const pul = (await must("liste", api.get("/api/workspace/stock"))).items.find(row => row.name === "Pul");
    const move = (await must("Pul", api.get(`/api/workspace/stock/${pul.id}`))).moves[0];
    assert.equal(move.note, "Açılış stoku (Excel)");
    await must("peşine çevir", api.put(`/api/workspace/stock/${pul.id}/moves/${move.id}`, { pay: "cash", method: "cash", qty: "7", unitPrice: "1,5", cashForce: true }));
    await must("yeniden yalnız miktar", api.put(`/api/workspace/stock/${pul.id}/moves/${move.id}`, { pay: "none", qty: "7", unitPrice: "1,5" }));
    const rows = await trialBalances(api);
    assert.deepEqual([balance(rows, "153"), balance(rows, "500"), balance(rows, "100")], [72.23, -72.23, 0]);
    await integrityOk(api, "Excel gidiş-dönüş");
  });

  it("elle açılan sıradan stok girişi (açıklama başka) açılış değildir; açıklaması değişen açılış hareketi işaretini korur", async () => {
    const item = await must("Somun", api.post("/api/workspace/stock", { name: "Somun", unit: "Adet", unitPrice: "2" }));
    await must("giriş", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "10", unitPrice: "2", date: "2026-10-02", note: "Depo sayımı", pay: "none" }));
    let rows = await trialBalances(api);
    assert.deepEqual([balance(rows, "153"), balance(rows, "500")], [72.23, -72.23], "yalnız miktar sıradan giriş deftere yazmaz");
    const vida = (await must("liste", api.get("/api/workspace/stock"))).items.find(row => row.name === "Vida");
    const move = (await must("Vida", api.get(`/api/workspace/stock/${vida.id}`))).moves[0];
    await must("açıklama değiş", api.put(`/api/workspace/stock/${vida.id}/moves/${move.id}`, { pay: "none", qty: "5", unitPrice: "12,345", note: "Dönem başı sayım" }));
    rows = await trialBalances(api);
    assert.deepEqual([balance(rows, "153"), balance(rows, "500")], [72.23, -72.23], "işaretli açılış açıklaması değişse de açılış");
    await integrityOk(api, "açıklama");
  });

  // Mutabakat Testi'ne "tanıma uyup işaretsiz" denetimi EKLENMEDİ (değerlendirme): program içinde bu durumu üreten yol (Düzenle) kapandı; kalan tek kaynak
  // eski sürüme (2.4.2) geri dönüşte açılan açılış — göç v30'un BİLİNEN SINIRI, kararı "Mutabakat Testi temiz" (test/goc-243-stok-acilis.test.mjs). Denetim
  // eklenince o veride Mutabakat Testi kalıcı kırmızı olurdu. Bunun yerine değişmez kural: programın yazım yolları tanıma uyan işaretsiz hareket bırakmaz.
  it("değişmez kural: bu dosyadaki bütün yazımlardan sonra açılış tanımına (göç v30) uyup işaretsiz kalan hareket yok", () => {
    const notes = accountsLib.STOCK_OPENING_NOTES || ["Açılış stoku", "Açılış stoku (Excel)"];
    const rows = ctx.server.app.store.all(`SELECT id, note FROM stock_moves WHERE is_opening = 0 AND kind = 'in' AND pay = 'none' AND invoice_id = '' AND reason = '' AND note IN (${notes.map(() => "?").join(", ")})`, ...notes);
    assert.deepEqual(rows, []);
  });

  it("açılış açıklamaları göç v30'daki listeyle aynı (kaynak)", () => {
    const source = readFileSync(new URL("../server/lib/migrations.mjs", import.meta.url), "utf8");
    const listed = /note IN \((.+?)\)`/.exec(source.slice(source.indexOf("version: 30,")))?.[1] || "";
    assert.deepEqual([...listed.matchAll(/'([^']+)'/g)].map(match => match[1]), [...(accountsLib.STOCK_OPENING_NOTES || [])]);
  });
});
