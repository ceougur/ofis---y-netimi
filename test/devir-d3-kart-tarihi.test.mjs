// 2.5.1 D3 TUR 3 — S-KD-3 = B (KULLANICI KARARI 27.11.2026 11:39 UTC; soru AYNEN: "Excel'den yüklenen taksit kartının Kayıt Tarihi kesim gününden ÖNCE, yükleme anı kesim gününden
// SONRA ise (örnek: Kayıt Tarihi 20.12.2026, yükleme 03.01.2027, kart 9.000; sonra 31.12.2026 kesimli devir)? B (SEÇİLEN): kart ve defter maddesi Kayıt Tarihi'ne göre ESKİ yıla sayılır;
// yeni yıla devir açılışıyla 9.000 gelir (programdaki öbür kayıtlar gibi tarih esas alınır, yükleme anı değil)").
// ÖLÇÜM (koddan önce; docs/kanit/2026-11-27/d3t3-kd3-olcum-*.txt): t251-d3-tur2 ve v2.5.0 GERÇEK kodu — kartın defter maddesi yükleme gününde (03.01.2027; KG-5, B5 BİLİNEN SINIR) →
// planda carinin K bakiyesi 0, kart K'de açık 9.000 (iki yıla bölünmüş). Düzeltme defter türetmesinde (EK İZİN; ayrı commit 'S-KD-3').
// Beklenen sayılar ELLE (karar metni): Excel kartı 9.000 (Kayıt 20.12.2026) → eski yıl, carinin K bakiyesi 9.000, kart açılışı 9.000; Kayıt 31.12.2026 (K günü) 5.000 → eski yıl;
// Kayıt 01.01.2027 (K+1) 4.000 → yeni yıl (planda yok); elle girilmiş kart (aynı Kayıt Tarihi, 9.000) → Excel kartıyla aynı plan sayıları. Yükleme 03.01.2027 (sahte saat).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const K = "2026-12-31";
const HEAD = ["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade", "Ödenen", "Kayıt Tarihi"];
const ROLES = { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "paid", 5: "registered" };

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 3 — S-KD-3 = B: Excel'den / elle yüklenen taksit kartı Kayıt Tarihi'ne göre (yükleme anı değil)", () => {
  let ctx;
  const ids = {};
  let job;
  before(async () => {
    ctx = await boot({ now: { time: "2027-01-03T10:00:00+03:00", fixed: true } });
    const imported = await must("Excel kartları", ctx.api.post("/api/workspace/plans/import", { matrix: [HEAD, ["Kart Müşterisi", "9000", "3", "20.01.2027", "0", "20.12.2026"], ["Kart K Günü", "5000", "1", "20.01.2027", "0", "31.12.2026"], ["Kart Yeni Yıl", "4000", "1", "20.01.2027", "0", "01.01.2027"]], headerAt: 0, roles: ROLES, fileName: "kartlar.xlsx", linkRecords: false }));
    assert.equal(imported.created, 3, JSON.stringify(imported));
    const plan = name => ctx.store.get("SELECT p.id, p.account_id AS accountId FROM plans p JOIN accounts a ON a.id = p.account_id WHERE a.name = ?", name);
    Object.assign(ids, { excel: plan("Kart Müşterisi"), k: plan("Kart K Günü"), k1: plan("Kart Yeni Yıl") });
    const manual = (await must("elle cari", ctx.api.post("/api/workspace/accounts", { name: "Elle Kart Müşterisi", type: "customer" }))).id;
    ids.manual = { id: (await must("elle kart", ctx.api.post("/api/workspace/plans", { name: "Elle Kart Müşterisi", registeredOn: "2026-12-20", total: "9000", accountId: manual, mode: "auto", count: "3", firstDue: "2027-01-20" }))).id, accountId: manual };
    ctx.server.clock.set("2027-02-10T10:00:00+03:00");
    job = await waitPreview(ctx.api, { company: "sirket-001", cutoff: K });
  });
  after(() => ctx?.server.close());

  it("veri tabanı (ders 3): Kayıt Tarihleri 20.12.2026 / 31.12.2026 / 01.01.2027, yükleme 03.01.2027", () => {
    const row = id => ctx.store.get("SELECT p.registered_on AS registered, (SELECT x.created_at FROM plan_imports x WHERE x.id = p.import_id) AS uploaded FROM plans p WHERE p.id = ?", id);
    assert.deepEqual([row(ids.excel.id).registered, row(ids.k.id).registered, row(ids.k1.id).registered], ["2026-12-20", "2026-12-31", "2027-01-01"]);
    assert.equal(String(row(ids.excel.id).uploaded).slice(0, 10), "2027-01-03");
  });

  it("defter maddesi Kayıt Tarihi'nde (yükleme günü değil): Excel 20.12.2026 B 120 / A 519 9.000; K günü 31.12.2026; K+1 01.01.2027", () => {
    const entries = ctx.app.ledger.build();
    const of = id => entries.filter(entry => entry.id === `plan:${id}`).map(entry => [entry.date, ...entry.lines.map(line => `${line.debit ? "B" : "A"} ${line.account} ${(line.debit || line.credit) / 100}`).sort()]);
    assert.deepEqual(of(ids.excel.id), [["2026-12-20", "A 519 9000", "B 120 9000"]]);
    assert.deepEqual(of(ids.k.id), [["2026-12-31", "A 519 5000", "B 120 5000"]]);
    assert.deepEqual(of(ids.k1.id), [["2027-01-01", "A 519 4000", "B 120 4000"]]);
  });

  it("plan (K = 31.12.2026): Excel kartı ESKİ yılda — carinin K bakiyesi 9.000, açılış satırları 9.000, kart 9.000 açık; K günü kartı 5.000; K+1 kartı yeni yılda (planda yok)", () => {
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const plan = job.result.plan;
    const cari = id => plan.newYear.cariler.find(row => row.cari === id);
    const rowsSum = row => row.satirlar.reduce((sum, line) => sum + (line.yon === "debt" ? line.tutarMinor : -line.tutarMinor), 0);
    assert.deepEqual([cari(ids.excel.accountId)?.kBakiyeMinor, rowsSum(cari(ids.excel.accountId))], [900000, 900000]);
    assert.deepEqual([cari(ids.k.accountId)?.kBakiyeMinor, rowsSum(cari(ids.k.accountId))], [500000, 500000]);
    assert.deepEqual([cari(ids.k1.accountId)?.kBakiyeMinor, cari(ids.k1.accountId)?.satirlar.length], [0, 0], "K+1 kartının carisi (kartı yeni yıla geçer) K'de bakiyesiz, açılış satırı yok");
    const card = id => plan.newYear.kartlar.find(row => row.kart === id);
    assert.deepEqual([card(ids.excel.id)?.kalanMinor, card(ids.excel.id)?.durum], [900000, "acik"]);
    assert.deepEqual([card(ids.k.id)?.kalanMinor, card(ids.k.id)?.durum], [500000, "acik"]);
    assert.equal(card(ids.k1.id), undefined, "K+1 kartı yeni yılda kalır (açılışa girmez)");
    const closing = (hesap, cari) => plan.archive.kapanisBakiyeleri.find(row => row.hesap === hesap && row.cari === cari)?.minor || 0;
    assert.deepEqual([closing("120", ids.excel.accountId), closing("120", ids.k.accountId), closing("120", ids.k1.accountId)], [900000, 500000, 0]);
    assert.deepEqual(plan.sorunlar, [], JSON.stringify(plan.sorunlar));
    assert.deepEqual(job.result.onDenetim.durdurur.map(row => row.kod), []);
  });

  it("elle girilmiş kart (aynı Kayıt Tarihi, 9.000) Excel kartıyla AYNI plan sayıları; taksit vadeleri programın kart ekranıyla aynı (devirsiz eşdeğer)", async () => {
    const plan = job.result.plan;
    const cari = id => plan.newYear.cariler.find(row => row.cari === id);
    const card = id => plan.newYear.kartlar.find(row => row.kart === id);
    const shape = (accountId, planId) => ({ k: cari(accountId)?.kBakiyeMinor, kalan: card(planId)?.kalanMinor, durum: card(planId)?.durum, taksit: card(planId)?.taksitler.map(row => [row.vade, row.kalanMinor]) });
    assert.deepEqual(shape(ids.manual.accountId, ids.manual.id), shape(ids.excel.accountId, ids.excel.id));
    for (const item of [ids.excel, ids.manual]) {
      const view = await must("kart", ctx.api.get(`/api/workspace/plans/${item.id}`));
      const items = (view.plan?.items || view.items || []).map(row => [row.dueDate || row.due_date, Math.round(Number(row.remaining ?? row.amount) * 100)]);
      assert.deepEqual(card(item.id).taksitler.map(row => [row.vade, row.kalanMinor]), items, "planın taksitleri = kart ekranının taksitleri");
    }
  });
});
