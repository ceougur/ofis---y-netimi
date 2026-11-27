// 2.5.1 D3 TUR 4 — STOKTA ÜRÜN ÜRÜN DEĞİŞMEZ (uzman görüşü (4) → BAŞ MİMAR KARARI 27.11, kullanıcıya gösterildi): her ürün için arşiv K miktarı = yeni yıl açılış miktarı ve değer
// (yalnız toplam değil) — planın değişmezleri arasında (plan.mjs "stok-urun"; arşiv K miktarı okuyucunun değerlemeden BAĞIMSIZ SQL'inden). Silinmiş ürün açılışsız (S207 = A), eksi
// miktar aynen ve değer 0 (KG-9 A + M5), sıfır stokta satır yok. Veri programın KENDİ API'sinden; beklenen sayılar ELLE. K = 31.12.2026, bugün 10.02.2027.
//   P1 açılış 10 Adet × 50,00 (01.12.2025) · 10.12.2026 satış 3 → K'de 7 Adet, değer 350,00
//   P2 açılış 2 Adet × 40,00 · 11.12.2026 satış 5 (eksi stok izniyle) → −3 Adet, değer 0 (eksi stok uyarısı)
//   P3 açılış 4 Adet × 30,00 · 12.12.2026 kart silindi → açılış YOK
//   P4 açılış 2 Adet × 20,00 · 13.12.2026 satış 2 → 0 Adet → satır YOK
//   P5 açılış 5 Adet × 10,00 · 05.01.2027 satış 1 (K'den SONRA) → K'de 5 Adet, değer 50,00
// Bozulma (olgu düzeyinde — tutarlı veride program üretmez): iki ürünün K miktarı yer değiştirir (P1 bir eksik, P5 bir fazla — TOPLAM aynı) → değişmez KIRILIR, ön denetim ürün adlarıyla DURDURUR.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";
import { katalogaYaz } from "./fixtures/devir-d3-ileti-katalog.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const readerModule = await import("../server/lib/devir/plan-reader.mjs").catch(() => null);
const preflightModule = await import("../server/lib/devir/preflight.mjs").catch(() => null);
const iletiModule = await import("../server/lib/devir/iletiler.mjs").catch(() => null);
const K = "2026-12-31";
const pay = { cash: [], cheques: [], endorse: [], rest: "open" };

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 4 — stok ürün ürün değişmezi (eksi, silinmiş, sıfır, K sonrası hareket)", () => {
  let ctx;
  let api;
  let job;
  const ids = {};
  let deleted = null;
  before(async () => {
    ctx = await boot({ now: { time: "2026-12-10T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    ids.c = (await must("cari", api.post("/api/workspace/accounts", { name: "Stok Müşterisi", type: "customer" }))).id;
    for (const [key, qty, price] of [["p1", 10, 50], ["p2", 2, 40], ["p3", 4, 30], ["p4", 2, 20], ["p5", 5, 10]]) {
      ids[key] = (await must(key, api.post("/api/workspace/stock", { name: `Ürün ${key.toUpperCase()}`, unit: "Adet", unitPrice: String(price), openingQty: String(qty), openingDate: "2025-12-01" }))).id;
    }
    const sell = (label, item, qty, date) => must(label, api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c, issueDate: date, lines: [{ itemId: ids[item], name: "", qty, unitPrice: 100, discountRate: 0, vatRate: 0 }], payment: pay, force: true, stockForce: true }));
    await sell("P1 satış", "p1", 3, "2026-12-10");
    ctx.server.clock.set("2026-12-11T10:00:00+03:00");
    await sell("P2 eksi satış", "p2", 5, "2026-12-11");
    ctx.server.clock.set("2026-12-12T10:00:00+03:00");
    deleted = await api.del(`/api/workspace/stock/${ids.p3}`);
    ctx.server.clock.set("2026-12-13T10:00:00+03:00");
    await sell("P4 satış", "p4", 2, "2026-12-13");
    ctx.server.clock.set("2027-01-05T10:00:00+03:00");
    await sell("P5 K sonrası satış", "p5", 1, "2027-01-05");
    ctx.server.clock.set("2027-02-10T12:00:00+03:00");
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  const nameOf = id => Object.entries(ids).find(([, value]) => value === id)?.[0] || id;

  it("veri tabanı (ders 3): P3 kartı silindi (200), stok hareketleri K'ye kadar P1 7, P2 −3, P3 4, P4 0, P5 5", () => {
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data));
    assert.ok(ctx.store.get("SELECT deleted_at AS d FROM stock_items WHERE id = ?", ids.p3).d, "P3 silinmiş");
    const qty = key => Number(ctx.store.get("SELECT COALESCE(SUM(CASE WHEN kind = 'out' THEN -qty ELSE qty END), 0) AS q FROM stock_moves WHERE item_id = ? AND date <= ?", ids[key], K).q);
    assert.deepEqual(["p1", "p2", "p3", "p4", "p5"].map(qty), [7, -3, 4, 0, 5]);
  });

  it("plan (elle): P1 7 / 350,00 · P2 −3 / 0 (eksi) · P5 5 / 50,00; silinmiş P3 ve sıfır P4 satırsız; ürün değişmezi TUTAR", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const got = job.result.plan.newYear.stok.map(row => [nameOf(row.urun), row.miktar, row.degerMinor, row.eksi]).sort();
    assert.deepEqual(got, [["p1", 7, 35000, false], ["p2", -3, 0, true], ["p5", 5, 5000, false]]);
    const invariant = job.result.plan.degismezler.find(row => row.kod === "stok-urun");
    assert.ok(invariant, "ürün ürün değişmezi planda yok");
    assert.deepEqual([invariant.ok, invariant.bulunanMinor, invariant.urunler], [true, 0, []]);
    assert.deepEqual(job.result.onDenetim.durdurur.map(row => row.kod), []);
    assert.ok(job.result.onDenetim.uyarir.some(row => row.kod === "eksi-stok" && row.adet === 1));
  });

  it("bozulma (olgu): P1 ile P5'in K miktarı yer değiştirir (toplam aynı) → 'stok-urun' kırılır; toplam değişmezleri tutar; ön denetim ürün adlarıyla DURDURUR (dört alan, Stok)", () => {
    assert.ok(readerModule && preflightModule && planModule, "D3 devir planı modülü yok (eski kod)");
    const facts = readerModule.readDevirFacts({ store: ctx.store, ledger: ctx.app.context.ledger, K, today: "2027-02-10" });
    assert.ok(facts.stockQtyK, "okuyucunun bağımsız stok miktarı yok");
    facts.stockQtyK.set(ids.p1, facts.stockQtyK.get(ids.p1) - 1000);
    facts.stockQtyK.set(ids.p5, facts.stockQtyK.get(ids.p5) + 1000);
    const plan = planModule.buildDevirPlan(facts, { option: "borc-alacak" });
    const invariant = plan.degismezler.find(row => row.kod === "stok-urun");
    assert.equal(invariant.ok, false);
    assert.deepEqual(invariant.urunler.map(row => [nameOf(row.urun), row.arsivMiktar, row.acilisMiktar]).sort(), [["p1", 6, 7], ["p5", 6, 5]]);
    for (const kod of ["stok-dss", "stok-acilis"]) assert.equal(plan.degismezler.find(row => row.kod === kod).ok, true, `${kod} toplamdan tutar`);
    const check = preflightModule.devirPreflight(facts.preflight, plan, { today: "2027-02-10", names: new Map() });
    const stop = check.durdurur.find(row => row.kod === "degismez-stok-urun");
    assert.ok(stop, check.durdurur.map(row => row.kod).join(", "));
    assert.match(stop.neOldu, /^2 üründe kesim günü miktarı ya da değeri yeni yılın açılışıyla tutmuyor \(Ürün P1: arşivde 6 Adet \/ .*, açılışta 7 Adet \/ 350,00 TL ve Ürün P5: arşivde 6 Adet \/ .*, açılışta 5 Adet \/ 50,00 TL\)\.$/);
    assert.equal(stop.nereye.ekran, "Stok");
    assert.deepEqual(iletiModule.iletiDenetimi(stop), []);
    katalogaYaz("devir-d3-stok", "API verisi + olgu bozulması: iki ürünün K miktarı yer değiştirdi (toplam aynı)", stop, "olgu (program tutarlı veride üretmez)");
  });
});
