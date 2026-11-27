// 2.5.1 D3 TUR 3 — tur 2'nin açık bıraktıkları (d3t2-rapor.md §13 DENENMEYEN), bu dosya sınırında: K = 31.12.2026, veri programın API'siyle, beklenen sayılar ELLE.
//   t2-1: K'den SONRA (10.01.2027) Düzenle ile ≤K faturaya (15.12.2026, 1.000,00 TL) eklenen peşin ödeme (400,00 TL) — program satırı FATURANIN tarihine yazar (ölçüldü: date 15.12.2026,
//         created_at 10.01.2027) → K sonrası bağ DEĞİL, ≤K satırı: planın K durumu peşini içerir (açık kalem 600,00), bağ listesinde yok.
//   t2-2: K'den ÖNCE (20.12.2026) alınmış çekin (300,00) "Kapatılacak Fatura" bağı K'den SONRA (10.01.2027) evrak Düzenle'siyle kuruluyor — bağ çekin İLK (≤K) olayına yazılır →
//         ≤K bağ: K durumu bağı içerir (açık kalem 1.000 − 400 − 300 = 300,00), bağ listesinde yok. Devirsiz eşi: programın bugünkü fatura kalanı (300,00) — K'den sonra bu caride
//         başka hareket yok, iki yol aynı sayıyı vermeli.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const K = "2026-12-31";
async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 3 — tur 2'nin açıkları: K'den sonra Düzenle ile eklenen peşin ve K'den sonra kurulan çek bağı (ikisi de ≤K satırda)", () => {
  let ctx;
  const ids = {};
  let job;
  before(async () => {
    ctx = await boot({ now: { time: "2026-12-15T10:00:00+03:00", fixed: true } });
    ids.c = (await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Düzenle Müşterisi", type: "customer" }))).id;
    ids.doc = { kind: "sale", accountId: ids.c, issueDate: "2026-12-15", lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true };
    ids.inv = (await must("satış", ctx.api.post("/api/workspace/invoices", ids.doc))).id;
    ctx.server.clock.set("2026-12-20T10:00:00+03:00");
    ids.chq = (await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "T22-1", bank: "Akbank", accountId: ids.c, amount: "300", issueDate: "2026-12-20", dueDate: "2027-02-20" }))).id;
    ctx.server.clock.set("2027-01-10T10:00:00+03:00");
    await must("Düzenle (peşin 400)", ctx.api.post(`/api/workspace/invoices/${ids.inv}/edit`, { ...ids.doc, payment: { cash: [{ amount: 400, method: "cash" }], cheques: [], endorse: [], rest: "open" } }));
    const cheque = await must("çek ayrıntısı", ctx.api.get(`/api/workspace/cheques/${ids.chq}`));
    const c = cheque.cheque || cheque;
    await must("çek Düzenle (Kapatılacak Fatura)", ctx.api.put(`/api/workspace/cheques/${ids.chq}`, { direction: "in", instrument: "cheque", serialNo: c.serialNo, bank: c.bank, accountId: ids.c, amount: "300", issueDate: "2026-12-20", dueDate: "2027-02-20", invoiceId: ids.inv }));
    ctx.server.clock.set("2027-02-10T10:00:00+03:00");
    job = await waitPreview(ctx.api, { company: "sirket-001", cutoff: K });
  });
  after(() => ctx?.server.close());

  it("veri tabanı (ders 3): peşin satırı 15.12.2026 tarihli (10.01.2027'de yazıldı); çekin ilk olayı 20.12.2026 tarihli ve faturaya bağlı", () => {
    const pay = ctx.store.all("SELECT amount, date, substr(created_at, 1, 10) AS written FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", ids.inv).map(row => ({ ...row }));
    assert.deepEqual(pay, [{ amount: 400, date: "2026-12-15", written: "2027-01-10" }]);
    const events = ctx.store.all("SELECT date, invoice_id AS inv FROM cheque_events WHERE cheque_id = ? ORDER BY rowid", ids.chq).map(row => ({ ...row }));
    assert.deepEqual(events, [{ date: "2026-12-20", inv: ids.inv }]);
  });

  it("plan: faturanın K açık kalemi 300,00 (1.000 − 400 peşin − 300 çek; elle); bağ listesinde bu fatura YOK; DURDURUR yok", () => {
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const plan = job.result.plan;
    const cari = plan.newYear.cariler.find(row => row.cari === ids.c);
    const open = cari.satirlar.filter(row => row.tur === "acik-kalem" && row.belge?.faturaId === ids.inv);
    assert.deepEqual(open.map(row => row.tutarMinor), [30000]);
    assert.equal(cari.kBakiyeMinor, 30000, "K bakiyesi = 1.000 − 400 − 300 (çek portföyde: 101'de)");
    assert.deepEqual(plan.newYear.baglar.filter(row => row.eskiHedef === ids.inv), []);
    assert.deepEqual(job.result.onDenetim.durdurur, []);
  });

  it("devirsiz eşi: programın bugünkü fatura kalanı = planın K açık kalemi (300,00; K'den sonra başka hareket yok)", async () => {
    const list = await must("faturalar", ctx.api.get("/api/workspace/invoices?kind=sale"));
    const row = (list.invoices || []).find(item => item.id === ids.inv);
    assert.ok(row, "fatura listede");
    assert.equal(Math.round(Number(row.open) * 100), 30000, `Faturalar listesinin kalanı (open): ${row.open} · ${row.payStateLabel}`);
  });
});
