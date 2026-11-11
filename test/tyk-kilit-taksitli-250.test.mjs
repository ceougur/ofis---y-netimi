// 2.5.0 Ç5-B birleşim düzeltmesi — GERÇEK program (API): kilitten önce bağsız avansı olan caride kilitten SONRA alınan kart tahsilatı taksitli faturayı kapatır.
// Olay: Ç5-B ana dalla birleşince mutabakat yıl dönümü tohum 39 kırmızı (30e12c20: "Taksitli fatura FIS2026000000011: açık 169.03 ≠ imzalı açık hedefi 0,00 · kapatanlar " —
// kart tam ödenmiş, fatura açık, kapatan yok). Kök neden lib/obligation-queue.mjs runQueue: fatura durumu (G2) geçişinde karar (3)'ün kilit ölçümü taksitli faturanın kendi
// kartının taksitlerini "kilitli dönemde bağsız kapanmış" sayıyordu (G2 kuyruğunda avans taksite düşüyor), oysa G2 o kalemlerin bağsız kapanışını hiç saymaz (v2.0.23 Bulgu 2,
// v2.0.24 "taksitli faturanın açığı = kartın kalanı") → kart tahsilatı bağı kesilip bağsız dağılıyordu. Beklenen ELLE (değişmezden; programın çıktısından değil — ders 5):
// açık = kartın kalanı. Sahte AKAN saat sabit günden (ders 13); tarihler bugüne göreli.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const addDays = (iso, n) => {
  const at = new Date(`${iso}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
};
const dataOf = response => response.data?.data ?? response.data;

describe("2.5.0 Ç5-B — kilit × taksitli fatura: kart tahsilatı faturayı kapatır (v2.0.24 değişmezi, karar (3))", () => {
  let server;
  let admin;
  let today;
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return dataOf(res);
  };
  before(async () => {
    server = await startTestServer({ now: new Date(2027, 0, 22, 6, 0, 0).getTime() });
    admin = await loginAdmin(server);
    today = dataOf(await admin.get("/api/workspace/ledger/lock")).today;
  });
  after(async () => server?.close());

  it("avans 1.000 → taksitli fatura 169,03 → kilit faturadan sonraya → kart tahsilatı 169,03: fatura Ödendi (açık 0 = kartın kalanı), kapatan kart tahsilatı (Bağlı)", async () => {
    const account = await must("cari", admin.post("/api/workspace/accounts", { name: "Kilit Müşterisi", type: "customer", registeredOn: addDays(today, -40) }));
    await must("avans", admin.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "1000", method: "cash", note: "Avans", date: addDays(today, -20), cashForce: true }));
    const invoice = await must("taksitli fatura", admin.post("/api/workspace/invoices", {
      kind: "sale", accountId: account.id, issueDate: addDays(today, -15), issueTime: "10:00", currency: "TRY", rate: 1, pricesIncludeVat: false, discountRate: 0, stoppageRate: 0,
      lines: [{ itemId: "", name: "Hizmet", qty: 1, unitPrice: 169.03, discountRate: 0, vatRate: 0, withholdingCode: "", expenseCode: "" }],
      payment: { cash: [], cheques: [], endorse: [], rest: "installments", installments: { count: 3, firstDue: addDays(today, 20) } }, cashForce: true,
    }));
    const planId = invoice.planId || invoice.plan?.id;
    assert.ok(planId, "faturanın kendi kartı açıldı");
    await must("dönem kilidi", admin.put("/api/admin/period-lock", { lockedUntil: addDays(today, -10) }));
    // G3 (tur 2b-2, S99 = A — KULLANICI KARARI 10.11 13:27): bağsız avans taksitli faturanın taksitlerini vade sırasıyla kapatır → kart tahsilatından ÖNCE fatura Ödendi,
    // kapatan avans (Otomatik). Önceki beklenti (açık 169,03, kapatan yok) v2.0.23 Bulgu 2'nin 'bağsız avans taksitli faturayı kapatmaz' kuralıydı — S99 bu kuralı değiştirdi.
    const before = await must("fatura (önce)", admin.get(`/api/workspace/invoices/${invoice.id}`));
    assert.deepEqual([before.open, before.paid], [0, 169.03], "S99: kart tahsilatından önce avans taksitleri kapattı — fatura Ödendi");
    assert.ok(before.closers.length > 0 && before.closers.every(c => c.mode === "auto" && c.date === addDays(today, -20)), `kapatan avans (Otomatik; kapatanın tarihi avansın günü): ${JSON.stringify(before.closers)}`);
    const entry = await must("kart tahsilatı", admin.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: "169,03", method: "cash", date: addDays(today, -5) }));
    assert.ok(entry, "tahsilat kaydedildi");
    const plan = await must("kart", admin.get(`/api/workspace/plans/${planId}`));
    const totals = plan.totals || plan.plan?.totals;
    assert.deepEqual([totals.total, totals.paid, totals.remaining], [169.03, 169.03, 0], "kart tam ödendi");
    const after = await must("fatura (sonra)", admin.get(`/api/workspace/invoices/${invoice.id}`));
    assert.deepEqual([after.open, after.paid], [0, 169.03], `taksitli faturanın açığı = kartın kalanı 0 (kapatanlar: ${JSON.stringify(after.closers)})`);
    // G3 (tur 2b-2, S99 = A + karar (3)): taksitler kilitli dönemde (kilit −10) avansla kapandı; kilitten sonraki kart tahsilatının bağı onları yeniden açmaz (karar (3)) →
    // kapatanlar avans (Otomatik, avansın günü −20); kart tahsilatı carinin avansına eklenir (bakiye −1.000 aynen). Önceki beklenti: kapatan kart tahsilatı (Bağlı, −5).
    assert.ok(after.closers.length > 0 && after.closers.every(c => c.mode === "auto" && c.date === addDays(today, -20)), `kapatanlar avans (Otomatik; karar (3)): ${JSON.stringify(after.closers)}`);
    assert.equal(Math.round(after.closers.reduce((sum, c) => sum + c.amount, 0) * 100), 16903, "kapatanların toplamı 169,03");
    // Fatura listesi de aynı durum (G2 toplu yolu — allSettled).
    const list = await must("fatura listesi", admin.get("/api/workspace/invoices?tab=all&limit=50"));
    const row = (list.invoices || []).find(x => x.id === invoice.id);
    assert.deepEqual([row?.open, row?.paid], [0, 169.03], "listede de Ödendi");
    // Cari: bakiye = 169,03 − 1.000 − 169,03 = −1.000 (avans aynen alacak).
    const detail = await must("cari kartı", admin.get(`/api/workspace/accounts/${account.id}`));
    assert.equal((detail.totals || detail.account?.totals).balance, -1000, "cari bakiyesi −1.000");
    await must("kilit aç", admin.put("/api/admin/period-lock", { lockedUntil: "" }));
  });
});
