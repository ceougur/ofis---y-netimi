// 2.0.22 madde 4 (Excel denetimi bulgusu, 04.10.2026): tanımsız ödeme yolu ("bitcoin") sessizce "Nakit" kaydediliyordu.
// Kural: yol HİÇ gönderilmezse eskisi gibi varsayılan (geriye uyum); gönderilip tanımsızsa 400 — hiçbir uçta kayıt olmaz.
import assert from "node:assert/strict";
import test from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = new Date().toISOString().slice(0, 10);
const LATER = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

test("tanımsız ödeme yolu her uçta 400; boş yol varsayılan, geçerli yol kabul", async () => {
  const server = await startTestServer();
  try {
    const admin = await loginAdmin(server);
    const data = r => (r.data && "ok" in r.data ? r.data.data : r.data);
    const acc = data(await admin.post("/api/workspace/accounts", { name: "Yol Denemesi", type: "customer" }));
    const supp = data(await admin.post("/api/workspace/accounts", { name: "Yol Tedarikçi", type: "supplier" }));
    const item = data(await admin.post("/api/workspace/stock", { name: "Yol Ürünü", code: "YOL-1", unit: "Adet", unitPrice: 10, salePrice: 20 }));
    const sale = data(await admin.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: TODAY, lines: [{ itemId: item.id, qty: 1, unitPrice: 3000, vatRate: 20 }], payment: { rest: "installments", installments: { count: 3, firstDue: LATER, everyMonths: 1 } }, force: true }));
    const planId = data(await admin.get(`/api/workspace/invoices/${sale.id}`)).plan.id;
    const cheque = data(await admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: acc.id, amount: 100, issueDate: TODAY, dueDate: LATER, serialNo: "YOL-C1", bank: "Ziraat" }));
    const counts = async () => {
      const a = data(await admin.get(`/api/workspace/accounts/${acc.id}`));
      const p = data(await admin.get(`/api/workspace/plans/${planId}`));
      const s = data(await admin.get(`/api/workspace/stock/${item.id}`));
      const inv = data(await admin.get("/api/workspace/invoices?tab=sale")).tabCounts;
      const c = data(await admin.get(`/api/workspace/cheques/${cheque.id}`));
      return JSON.stringify({ entries: a.entries.length, planPaid: p.totals.paid, qty: s.qty, sales: inv.sale, chq: c.status });
    };
    const before = await counts();
    const bad = { method: "bitcoin" };
    const attempts = {
      "cari tahsilatı": () => admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 10, date: TODAY, ...bad }),
      "cari ödemesi": () => admin.post(`/api/workspace/accounts/${supp.id}/entries`, { kind: "out", amount: 10, date: TODAY, cashForce: true, ...bad }),
      "taksit tahsilatı": () => admin.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: 10, date: TODAY, ...bad }),
      "faturada peşin": () => admin.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: TODAY, lines: [{ itemId: item.id, qty: 1, unitPrice: 10, vatRate: 20 }], payment: { cash: [{ amount: 12, ...bad }] }, force: true }),
      "stok peşin satış": () => admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: 1, unitPrice: 20, date: TODAY, pay: "cash", force: true, ...bad }),
      "çek tahsili": () => admin.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: TODAY, ...bad }),
      "Kasa": () => admin.post("/api/workspace/cash", { kind: "in", amount: 10, date: TODAY, description: "x", ...bad }),
    };
    for (const [label, send] of Object.entries(attempts)) {
      const r = await send();
      assert.equal(r.status, 400, `${label}: tanımsız yol 400 olmalı (gelen ${r.status} ${JSON.stringify(r.data).slice(0, 160)})`);
      assert.equal(r.data.code, "pay-method-invalid", `${label}: hata kodu`);
    }
    assert.equal(await counts(), before, "reddedilen hiçbir istek kayıt bırakmadı");

    // Geriye uyum: yol gönderilmezse varsayılan; geçerli yol kabul.
    let r = await admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 10, date: TODAY });
    assert.equal(r.status, 200);
    assert.equal(data(r).entries.find(e => e.id === data(r).entryId).method, "cash", "yol yoksa nakit");
    r = await admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 10, date: TODAY, method: "bank" });
    assert.equal(r.status, 200);
    assert.equal(data(r).entries.find(e => e.id === data(r).entryId).method, "bank", "havale kabul");
    r = await admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 10, date: TODAY, method: "" });
    assert.equal(r.status, 200, "boş metin varsayılan sayılır");
    r = await admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 10, date: TODAY, method: "Nakit" });
    assert.equal(r.status, 400, "etiket değil kayıt değeri beklenir (cash/bank/card)");
  } finally {
    await server.close();
  }
});
