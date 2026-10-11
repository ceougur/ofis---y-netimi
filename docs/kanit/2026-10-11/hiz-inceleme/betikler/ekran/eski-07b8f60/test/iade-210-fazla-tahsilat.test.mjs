// 2.1.0 eksik test turu — `test:mutabakat -- --islem 5000` (kullanıcı kararı 10.10: plan alt sınırı) tohum 2, işlem 3414'te bulundu:
// "Taksitli fatura FIS2026000000095: açık 1211.43 ≠ kartın kalanı 793,81". Önce kırmızı test, sonra en küçük düzeltme.
//
// Hata (R5): faturanın kendi taksit kartı, iade kartı tümüyle küçülttükten (toplam 0) SONRA tahsilat alırsa kart fazla tahsilatlı olur (ödenen >
// toplam; fazlası avans). İade iptal edilince kart faturanın açığına göre yeniden büyütülür; büyüme "hedef − kalan" ile hesaplanıyordu ve kalan
// 0'da kırpılı okunuyordu (leftOf): avansa dönen tahsilat hesaba katılmadığı için kart bu tutar kadar KISA büyüyordu. Sonuç: fatura açığı ve
// cari bakiye 1.500 iken kartın kalanı 1.000 — Geciken Taksitler, Vade Takip, Alacak Yaşlandırma (kart payı), hatırlatma borcu eksik gösterir.
// Değişmez (v2.0.24, Canlı Hata 2): taksitli faturanın açığı = kendi kartının kalanı.
// NASIL BOZARIM: satış 3.000 (peşin 1.000, 1 taksit 2.000) → iade 2.400 (kart 2.000 → 0; 400 avans) → karta 500 tahsilat (kart toplam 0, ödenen 500)
// → iadeyi İptal Et.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data });
const must = async (label, promise) => {
  const res = unwrap(await promise);
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};

describe("R5 — fazla tahsilatlı kartta iade iptali kartı faturanın açığına kadar büyütür", () => {
  let server;
  let client;
  before(async () => {
    server = await startTestServer({ now: "2026-10-09T09:00:00Z" });
    client = await loginAdmin(server);
  });
  after(() => server?.close());

  it("satış 3.000 (peşin 1.000, taksit 2.000) → iade 2.400 → karta 500 tahsilat → iade İptal Et: açık 1.500 = kartın kalanı 1.500 = cari bakiye", async () => {
    const acc = await must("cari", client.post("/api/workspace/accounts", { name: "Fazla Tahsilat Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    const doc = await must("satış", client.post("/api/workspace/invoices", { kind: "sale", accountId: acc.id, issueDate: "2026-08-03", issueTime: "10:00", currency: "TRY", rate: 1, pricesIncludeVat: false, discountRate: 0, stoppageRate: 0, lines: [{ name: "Hizmet", qty: 10, unitPrice: 300, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: 1000, method: "cash" }], cheques: [], endorse: [], rest: "installments", installments: { count: 1, firstDue: "2026-09-03", everyMonths: 1 } }, force: true, cashForce: true }));
    const planId = doc.plan?.id || doc.planId;
    assert.ok(planId, "faturanın kartı");
    const ret = await must("iade 2.400", client.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: doc.id, issueDate: "2026-08-20", issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: doc.lines[0].id, qty: 8 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
    let plan = await must("kart", client.get(`/api/workspace/plans/${planId}`));
    assert.equal(plan.totals.total, 0, "iade kartı tümüyle küçülttü");
    await must("karta 500 tahsilat", client.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: "500", method: "cash", date: "2026-08-25" }));
    await must("iadeyi iptal et", client.post(`/api/workspace/invoices/${ret.id}/cancel`, { reason: "Yanlış iade", force: true, cashForce: true }));
    const invoice = await must("fatura", client.get(`/api/workspace/invoices/${doc.id}`));
    plan = await must("kart", client.get(`/api/workspace/plans/${planId}`));
    const account = await must("cari kartı", client.get(`/api/workspace/accounts/${acc.id}`));
    assert.equal(Number(invoice.open), 1500, "fatura açığı 3.000 − 1.000 peşin − 500 kart tahsilatı");
    assert.equal(account.totals.balance, 1500, "cari bakiye 1.500");
    assert.equal(plan.totals.paid, 500, "kart tahsilatı 500");
    assert.equal(plan.totals.remaining, 1500, `kartın kalanı = fatura açığı (toplam ${plan.totals.total}, ödenen ${plan.totals.paid})`);
    assert.equal(plan.totals.total, 2000, "kart toplamı iadeden önceki taksit tutarına döner");
    const integrity = await must("Mutabakat Testi", client.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures || integrity.checks?.filter(item => !item.ok)).slice(0, 400));
  });
});
