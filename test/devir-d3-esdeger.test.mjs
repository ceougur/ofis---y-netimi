// 2.5.1 D3 — DEVİRSİZ EŞDEĞER (docs/devir/D3-D4-TASARIM.md §3.12 (b); EK-1 §4 değişmez (4): "her t ≥ K+1 için gecikmiş(t) ve açık kalem (vade, kalan) listesi devirli = devirsiz";
// BAŞ MİMAR KARARI 27.11 (2): "DEVİRLİ = DEVİRSİZ (devir şirketin durumunu değiştirmez — bakiye, gecikmiş, kalan)"). Veri programın KENDİ API'sinden; devirsiz kuyruk programın bugünkü
// tek borç sırası; devirli kuyruk planın satırlarından (test/fixtures/devir-d3-esdeger.mjs). İki seçenek × K'de gecikmiş kalem; vadesiz kalem; Ödeme Sözü; avans; tedarikçi.
//
// Veri (bugün 10.02.2027; K = 31.12.2026):
//   C1: 01.10.2026 satış 1.000,00 vade 30.11.2026 (K'de GECİKMİŞ) · 15.11 tahsilat 300,00 (bağsız) · 10.12 Borç Yaz 200,00 VADESİZ · 12.12 Borç Yaz 500,00 vade 15.02.2027, Ödeme Sözü 20.01.2027
//       · 10.01.2027 tahsilat 400,00 (bağsız) · 15.01.2027 satış 600,00 vade 31.01.2027.
//     ELLE: K'de açık kalemler fatura 700,00 (vade 30.11), Borç Yaz 200,00 (vade = belge günü 10.12), Borç Yaz 500,00 (vade 15.02, söz 20.01); K bakiyesi 1.400,00; net 0.
//     Devirsiz: 10.01 tahsilatı S2 ile fatura kalanını (vade 30.11) kapatır → 300 kalır. gecikmiş(t) bugünkü kalanların t'deki vadesiyle (TYK: tahsilat kendi gününde dağılır, gecikmiş
//     bugünkü kalanlardan) → gecikmiş(01.01) = 300 + 200 = 500,00; gecikmiş(11.01) = 500,00; gecikmiş(01.02) = 300 + 200 + 600 = 1.100,00.
//   C2: 01.09.2026 satış 500,00 vade 01.10 · 20.12 tahsilat 800,00 (avans 300,00) · 05.01.2027 satış 400,00 → avans kapatır; gecikmiş hep 0, K'de açık kalem yok, net −300 (avans).
//   S1 (tedarikçi): 01.12.2026 alış 1.200,00 vade 20.01.2027 · 10.12 ödeme 500,00 · 10.01.2027 ödeme 300,00 — alacak tarafı açık kalem 700,00.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const fixture = await import("./fixtures/devir-d3-esdeger.mjs");
const K = "2026-12-31";
const NOW = "2027-02-10T12:00:00+03:00";
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

describe("D3 devirsiz eşdeğer — API'den girilen veri, iki seçenek, gecikmiş / kalan / bakiye", () => {
  let ctx;
  let api;
  const ids = {};
  before(async () => {
    ctx = await boot({ now: { time: NOW, fixed: true } });
    api = ctx.api;
    ids.c1 = (await must("C1", api.post("/api/workspace/accounts", { name: "Müşteri Bir", type: "customer" }))).id;
    ids.c2 = (await must("C2", api.post("/api/workspace/accounts", { name: "Müşteri İki", type: "customer" }))).id;
    ids.s1 = (await must("S1", api.post("/api/workspace/accounts", { name: "Tedarikçi Bir", type: "supplier" }))).id;
    const line = price => [{ name: "Hizmet", qty: 1, unitPrice: price, discountRate: 0, vatRate: 0 }];
    // Satış belgeleri tarih sırasıyla (numara ↔ tarih kronolojisi).
    await must("C2 satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c2, issueDate: "2026-09-01", lines: line(500), payment: { ...pay, dueDate: "2026-10-01" }, force: true }));
    ids.inv1 = (await must("C1 satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c1, issueDate: "2026-10-01", lines: line(1000), payment: { ...pay, dueDate: "2026-11-30" }, force: true }))).id;
    await must("C1 tahsilat", api.post(`/api/workspace/accounts/${ids.c1}/entries`, { kind: "in", amount: "300", date: "2026-11-15", note: "Kısmi" }));
    await must("C1 vadesiz borç", api.post(`/api/workspace/accounts/${ids.c1}/entries`, { kind: "debt", amount: "200", date: "2026-12-10", note: "Vadesiz" }));
    await must("C1 vadeli borç", api.post(`/api/workspace/accounts/${ids.c1}/entries`, { kind: "debt", amount: "500", date: "2026-12-12", dueDate: "2027-02-15", expectedDate: "2027-01-20", note: "Vadeli" }));
    await must("C1 ocak tahsilat", api.post(`/api/workspace/accounts/${ids.c1}/entries`, { kind: "in", amount: "400", date: "2027-01-10", note: "Ocak" }));
    await must("C2 fazla tahsilat", api.post(`/api/workspace/accounts/${ids.c2}/entries`, { kind: "in", amount: "800", date: "2026-12-20", note: "Fazla" }));
    await must("C2 ocak satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c2, issueDate: "2027-01-05", lines: line(400), payment: pay, force: true }));
    await must("C1 ocak satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.c1, issueDate: "2027-01-15", lines: line(600), payment: { ...pay, dueDate: "2027-01-31" }, force: true }));
    await must("S1 alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.s1, number: "AL-1", issueDate: "2026-12-01", lines: line(1200), payment: { ...pay, dueDate: "2027-01-20" }, force: true }));
    await must("S1 ödeme", api.post(`/api/workspace/accounts/${ids.s1}/entries`, { kind: "out", amount: "500", date: "2026-12-10", note: "Kısmi", cashForce: true }));
    await must("S1 ocak ödeme", api.post(`/api/workspace/accounts/${ids.s1}/entries`, { kind: "out", amount: "300", date: "2027-01-10", note: "Ocak", cashForce: true }));
  });
  after(() => ctx?.server.close());

  it("plan elle hesaplanan sayılarla: C1 açık kalemler (vade, söz), net 0; C2 avans net −300 ve açık kalem yok; S1 alacak kalemi 700", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const job = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" });
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const rows = id => job.result.plan.newYear.cariler.find(r => r.cari === id);
    const c1 = rows(ids.c1);
    assert.equal(c1.kBakiyeMinor, 140000);
    assert.deepEqual(c1.satirlar.filter(r => r.tur === "acik-kalem").map(r => [r.tutarMinor, r.vade, r.beklenenTarih, r.kalemSinifi]), [[70000, "2026-11-30", "", "fatura"], [20000, "2026-12-10", "", "elle"], [50000, "2027-02-15", "2027-01-20", "elle"]]);
    assert.equal(c1.netMinor, 0);
    const c2 = rows(ids.c2);
    assert.deepEqual([c2.kBakiyeMinor, c2.netMinor, c2.acikKalemSayisi], [-30000, -30000, 0]);
    const s1 = rows(ids.s1);
    assert.deepEqual(s1.satirlar.filter(r => r.tur === "acik-kalem").map(r => [r.yon, r.tutarMinor, r.vade]), [["credit", 70000, "2027-01-20"]]);
    assert.deepEqual(job.result.plan.sorunlar, []);
    assert.deepEqual(job.result.plan.degismezler.filter(r => !r.ok), []);
  });

  for (const option of ["borc-alacak", "sadece-bakiye"]) {
    it(`${option}: her t ≥ K+1 için gecikmiş(t) ve borç tarafı açık kalemleri (vade, kalan) devirli = devirsiz; elle: C1 01.01 = 500, 11.01 = 500, 01.02 = 1.100`, async () => {
      assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
      const job = await waitPreview(api, { company: "sirket-001", cutoff: K, option });
      assert.equal(job.state, "done", JSON.stringify(job.error));
      const eq = fixture.createEquivalence(ctx.store);
      const days = ["2027-01-01", "2027-01-02", "2027-01-11", "2027-01-21", "2027-02-01", "2027-02-10", "2027-02-16", "2027-03-01"];
      for (const id of [ids.c1, ids.c2, ids.s1]) {
        const row = job.result.plan.newYear.cariler.find(r => r.cari === id);
        for (const out of eq.compare(id, row, K, days)) {
          assert.equal(out.devirli, out.devirsiz, `${option} ${id} ${out.day} gecikmiş`);
          assert.deepEqual(out.kalemDevirli, out.kalemDevirsiz, `${option} ${id} ${out.day} açık kalemler`);
          assert.equal(out.sinceDevirli, out.sinceDevirsiz, `${option} ${id} ${out.day} en eski gecikmiş vade (gün sayısı)`);
        }
      }
      const c1 = job.result.plan.newYear.cariler.find(r => r.cari === ids.c1);
      const byDay = Object.fromEntries(eq.compare(ids.c1, c1, K, ["2027-01-01", "2027-01-11", "2027-02-01"]).map(out => [out.day, out.devirsiz]));
      assert.deepEqual(byDay, { "2027-01-01": 50000, "2027-01-11": 50000, "2027-02-01": 110000 }, "elle hesaplanan gecikmiş");
    });
  }

  it("TEHLİKE (tasarım §3.5 madde 4): Borç / Alacak Toplamı kuyruğa AYRI ve bağsız alacak gibi girerse gecikmiş değişir — netleşme kuralı gerekli (bu testin dişi)", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const job = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" });
    const eq = fixture.createEquivalence(ctx.store);
    const c1 = job.result.plan.newYear.cariler.find(r => r.cari === ids.c1);
    assert.ok(c1.satirlar.some(r => r.tur === "alacak-toplami"), "senaryoda Alacak Toplamı satırı var");
    const [split] = eq.compare(ids.c1, c1, K, ["2027-01-01"], { split: true });
    assert.notEqual(split.devirli, split.devirsiz, "ayrı satırlarla gecikmiş devirsizden farklı (Alacak Toplamı gecikmiş faturayı kapatır)");
  });

  it("bakiye: devirli kuyruğun satırları (net + açık kalemler + K sonrası) = devirsiz carinin bugünkü bakiyesi", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const job = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" });
    const eq = fixture.createEquivalence(ctx.store);
    for (const id of [ids.c1, ids.c2, ids.s1]) {
      const row = job.result.plan.newYear.cariler.find(r => r.cari === id);
      const lines = eq.ledgers.get(id);
      const all = Math.round(lines.reduce((sum, line) => sum + (line.debit - line.credit) * 100, 0));
      const after = Math.round(lines.filter(line => line.date > K).reduce((sum, line) => sum + (line.debit - line.credit) * 100, 0));
      const rows = row.satirlar.reduce((sum, line) => sum + (line.yon === "debt" ? line.tutarMinor : -line.tutarMinor), 0);
      assert.equal(rows + after, all, id);
    }
  });
});
