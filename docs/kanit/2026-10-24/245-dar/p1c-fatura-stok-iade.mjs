// D1 (fatura tarafı, eski/yeni aynı mı): satış faturası 1.000 açık + Stok → Müşteri İadesi 1.000 (faturasız) → fatura açık mı?
import { start, must, day } from "./h.mjs";
const { server, api } = await start();
try {
  const svc = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-2", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
  const goods = await must("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "URN-2", name: "Ürün", unit: "Adet", salePrice: "100", openingQty: "50" }));
  const acc = await must("cari", api.post("/api/workspace/accounts", { name: "Fatura İade Deneme", type: "customer", registeredOn: day(-400) }));
  const inv = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: day(-50), lines: [{ itemId: svc.id, qty: 1, unitPrice: "1000", vatRate: 0 }], payment: { rest: "open", dueDate: day(-40) } }));
  const ret = await api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "10", unitPrice: "100", pay: "account", accountId: acc.id, date: day(-5) });
  const card = await must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
  const doc = await must("fatura oku", api.get(`/api/workspace/invoices/${inv.id}`));
  console.log(`stok iade ${ret.status}; bakiye ${card.totals.balance}; fatura açık ${doc.open} (${doc.payState})`);
} finally { await server.close(); }
