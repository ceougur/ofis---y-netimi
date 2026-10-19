// 2.4.3 — Uzman mali müşavir MM4 (kullanıcı kararı 18.10.2026): stok açılışı (ürün kartındaki açılış miktarı ve Excel'den ürün yüklemedeki miktar)
// Ana Defter'e B 153 / A 500 (miktar × birim fiyat) olarak girer; karşı hesap Kasa / banka / cari / taksit açılışlarıyla aynı (500). Mutabakat Testi
// "Açılış Stoku ↔ Ana Defter" denetimi (stock:opening) bu kaydı da denetler. Eski kodda (78fdd05) kırmızı: 153 açılış kadar eksik.
//
// KÂHİN (programdan bağımsız, elle): denetçinin Eylül senaryosundaki ürün P1 — açılış 100 Adet × 50 TL = 5.000 (B 153 / A 500); "İlk Alım" (Kasa'dan
// peşin 10 × 20 = 200) açılış değildir (B 153 / A 100). Excel: Çay 10 × 85 = 850, Şeker 2,5 × 40 = 100; miktarsız satır açılış yazmaz.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { bootBank, lockPeriod, trialBalances } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const balance = (rows, code) => rows[code] ?? 0;

describe("2.4.3 MM4 — stok açılışı Ana Defter'de (B 153 / A 500)", () => {
  let ctx;
  let api;
  before(async () => {
    ctx = await bootBank({ now: "2026-10-20T12:00:00+03:00" });
    api = ctx.api;
    await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
  });
  after(() => ctx?.server.close());

  it("ürün kartında açılış: 100 × 50 = 5.000 → mizan 153 = 5.000, 500 = −5.000; yevmiyede tek madde; Mutabakat Testi stock:opening tamam", async () => {
    const p1 = await must("P1", api.post("/api/workspace/stock", { name: "P1 Ürün", unit: "Adet", unitPrice: "50", openingQty: "100", openingDate: "2026-09-01" }));
    const rows = await trialBalances(api);
    assert.equal(balance(rows, "153"), 5000);
    assert.equal(balance(rows, "500"), -5000);
    const journal = await must("yevmiye", api.get(`${RC}/yevmiye?from=2026-09-01&to=2026-09-30`));
    const lines = journal.rows.filter(row => row[1] === "Stok açılışı");
    assert.deepEqual(lines.map(row => [row[0], row[3], row[4], row[5]]), [["01.09.2026", "153", "5.000,00 TL", ""], ["01.09.2026", "500", "", "5.000,00 TL"]]);
    assert.match(lines[0][2], /Açılış stoku: P1 Ürün/);
    const result = await integrityOk(api, "açılış sonrası");
    const check = result.checks.find(item => item.code === "stock:opening");
    assert.equal(check?.ok, true, JSON.stringify(check));
    assert.equal(p1.moves[0].note, "Açılış stoku");
  });

  it("İlk Alım (Kasa'dan peşin) açılış değildir: 153 yalnız alım kadar artar, 500 değişmez", async () => {
    await must("P2 peşin ilk alım", api.post("/api/workspace/stock", { name: "P2 Ürün", unit: "Adet", unitPrice: "20", openingQty: "10", openingPay: "cash", openingDate: "2026-09-02", cashForce: true }));
    const rows = await trialBalances(api);
    assert.equal(balance(rows, "153"), 5200);
    assert.equal(balance(rows, "500"), -5000);
    assert.equal(balance(rows, "100"), -200);
    await integrityOk(api, "ilk alım");
  });

  it("Excel'den ürün: miktar açılıştır (Çay 850 + Şeker 100); miktarsız satır ve hizmet açılış yazmaz", async () => {
    const matrix = [["Ürün Kodu", "Ürün Adı", "Birim", "Kategori", "Miktar", "Birim Fiyat"], ["C1", "Çay", "Adet", "Mutfak", "10", "85"], ["S1", "Şeker", "Kg", "Mutfak", "2,5", "40"], ["Y1", "Motor Yağı", "Lt", "Araç", "", "320"]];
    const preview = await must("önizleme", api.post("/api/workspace/stock/import/preview", { matrix }));
    const done = await must("yükle", api.post("/api/workspace/stock/import", { matrix, headerAt: preview.headerAt, roles: preview.roles }));
    assert.equal(done.opening, 2);
    const rows = await trialBalances(api);
    assert.equal(balance(rows, "153"), 6150);
    assert.equal(balance(rows, "500"), -5950);
    await must("hizmet", api.post("/api/workspace/stock", { name: "Danışmanlık", kind: "service", unit: "Adet", unitPrice: "500", openingQty: "3" }));
    assert.equal(balance(await trialBalances(api), "153"), 6150, "hizmet kalemi açılış yazmaz");
    await integrityOk(api, "Excel");
  });

  it("açılış hareketi düzeltilir (100 → 80) ve silinir: 153 / 500 izler; Çöp Kutusu'ndan geri yükleme açılışı geri getirir", async () => {
    const list = await must("liste", api.get("/api/workspace/stock"));
    const p1 = list.items.find(item => item.name === "P1 Ürün");
    const detail = await must("P1", api.get(`/api/workspace/stock/${p1.id}`));
    const move = detail.moves[0];
    await must("düzelt", api.put(`/api/workspace/stock/${p1.id}/moves/${move.id}`, { qty: "80", unitPrice: "50" }));
    let rows = await trialBalances(api);
    assert.equal(balance(rows, "153"), 5150);
    assert.equal(balance(rows, "500"), -4950);
    await integrityOk(api, "düzeltme");
    const removed = await api.del(`/api/workspace/stock/${p1.id}/moves/${move.id}`);
    assert.equal(removed.status, 200, JSON.stringify(removed.data));
    rows = await trialBalances(api);
    assert.equal(balance(rows, "153"), 1150);
    assert.equal(balance(rows, "500"), -950);
    await integrityOk(api, "silme");
    const trash = await must("çöp", api.get("/api/admin/trash"));
    const entry = trash.find(item => item.kind === "stock-move" && item.ref === move.id);
    assert.ok(entry, "silinen hareket çöp kutusunda");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: entry.id }));
    rows = await trialBalances(api);
    assert.equal(balance(rows, "153"), 5150, "geri yüklenen açılış yine 153 / 500");
    assert.equal(balance(rows, "500"), -4950);
    await integrityOk(api, "geri yükleme");
  });

  // Dar kontrol 3 (B-3, bilerek güncellendi): yeniden "yalnız miktar"a çevrilen açılış hareketi göç v30'daki tanımla (açıklama "Açılış stoku (Excel)")
  // yine açılıştır — önceden işaret geri gelmiyor, açılış 153/500'den sessizce düşüyordu.
  it("açılış hareketi peşine çevrilirse açılış olmaktan çıkar (Kasa alımı olur, 500 düşer); yeniden yalnız miktara çevrilince yine açılıştır; ürün silinse de açılış defterde kalır", async () => {
    const list = await must("liste", api.get("/api/workspace/stock"));
    const sugar = list.items.find(item => item.name === "Şeker");
    const move = (await must("Şeker", api.get(`/api/workspace/stock/${sugar.id}`))).moves[0];
    await must("peşine çevir", api.put(`/api/workspace/stock/${sugar.id}/moves/${move.id}`, { pay: "cash", method: "cash", qty: "2,5", unitPrice: "40", cashForce: true }));
    let rows = await trialBalances(api);
    assert.equal(balance(rows, "153"), 5150, "153 aynı (açılış yerine peşin alım)");
    assert.equal(balance(rows, "500"), -4850, "500 açılış kadar azaldı");
    assert.equal(balance(rows, "100"), -300);
    await must("geri yalnız miktara", api.put(`/api/workspace/stock/${sugar.id}/moves/${move.id}`, { pay: "none", qty: "2,5", unitPrice: "40" }));
    rows = await trialBalances(api);
    assert.equal(balance(rows, "500"), -4950, "yeniden yalnız miktar: açılış geri geldi (göç v30 tanımı)");
    assert.equal(balance(rows, "153"), 5150);
    assert.equal(balance(rows, "100"), -200, "Şeker peşin alımı geri alındı (yalnız P2 ilk alımı kalır)");
    const tea = list.items.find(item => item.name === "Çay");
    await must("ürünü sil", api.del(`/api/workspace/stock/${tea.id}`));
    rows = await trialBalances(api);
    assert.equal(balance(rows, "153"), 5150, "silinen ürünün açılışı defterde kalır (dönem başı stok)");
    await integrityOk(api, "ürün silme");
  });

  it("kapanmış dönemdeki açılış hareketi düzeltilemez; kilit sonrası mizan ve Mutabakat Testi aynı", async () => {
    const before = await trialBalances(api);
    await lockPeriod(api, "2026-09-30");
    const list = await must("liste", api.get("/api/workspace/stock"));
    const p1 = list.items.find(item => item.name === "P1 Ürün");
    const move = (await must("P1", api.get(`/api/workspace/stock/${p1.id}`))).moves[0];
    const res = await api.put(`/api/workspace/stock/${p1.id}/moves/${move.id}`, { qty: "1", unitPrice: "50" });
    assert.equal(res.status, 409, JSON.stringify(res.data));
    assert.deepEqual(await trialBalances(api), before);
    await integrityOk(api, "kilit");
    await lockPeriod(api, "");
  });

  it("Stok Hareketleri raporu açılışı 'Açılış Stoku' ve değeriyle gösterir: raporun açılış toplamı = yevmiyedeki 153 açılışı", async () => {
    const report = await must("stok hareketleri", api.get(`${RC}/stok-hareketleri?preset=all`));
    const openings = report.rows.filter(row => row[3] === "Açılış Stoku");
    const total = openings.reduce((sum, row) => sum + Number(row[7].replace(/[^\d,]/g, "").replace(",", ".")), 0);
    const journal = await must("yevmiye", api.get(`${RC}/yevmiye?preset=all`));
    const ledger = journal.rows.filter(row => row[1] === "Stok açılışı" && row[3] === "153").reduce((sum, row) => sum + Number(row[4].replace(/[^\d,]/g, "").replace(",", ".")), 0);
    assert.equal(Math.round(total * 100), Math.round(ledger * 100));
    assert.equal(Math.round(total * 100), 400000 + 85000 + 10000, "P1 80 × 50 + Çay 10 × 85 + Şeker 2,5 × 40 (yeniden açılış)");
    assert.ok(report.summary.some(([label, value]) => label === "Açılış Stoku Değeri" && value === "4.950,00 TL"), JSON.stringify(report.summary));
  });
});
