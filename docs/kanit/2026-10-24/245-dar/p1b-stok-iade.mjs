// Dar kontrol 2.4.5 — D1 (aynı sınıf): Stok → Müşteri İadesi (stok girişi, reason "return", açık hesap; caride "Satış iadesi" alacağı, source stock) carinin
// VADELİ elle borcunu kapatmıyor: bakiye 0 iken takvim "Tahsil Edilecek Borç". Stok satışının (veresiye) ve faturanın durumu da yazılır.
import { start, must, day } from "./h.mjs";

const { server, api } = await start();
let code = 0;
try {
  const goods = await must("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "URN-1", name: "Ürün", unit: "Adet", salePrice: "100", openingQty: "50" }));
  const acc = await must("cari", api.post("/api/workspace/accounts", { name: "İade Deneme", type: "customer", registeredOn: day(-400), phone: "05001112244" }));
  await must("borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "1000", date: day(-60), dueDate: day(-30), method: "cash" }));
  const ret = await api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "10", unitPrice: "100", pay: "account", accountId: acc.id, date: day(-5) });
  console.log(`stok iade: ${ret.status} ${ret.status !== 200 ? JSON.stringify(ret.data).slice(0, 200) : ""}`);
  const card = await must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
  const debt = card.entries.find(e => e.kind === "debt" && !e.source);
  const dues = await must("dues", api.get("/api/workspace/dues"));
  console.log(`cari bakiye: ${card.totals.balance} · hareketler: ${card.entries.map(e => `${e.kind}/${e.source || "elle"}/${e.amount}`).join(" | ")}`);
  console.log(`elle borç Kalan: ${debt.remaining ?? "(alan yok)"}`);
  console.log(`takvim kalemleri: ${dues.items.map(i => `${i.source}:${i.label}:${i.amount}:${i.state}`).join(" | ") || "(yok)"}`);
  const item = dues.items.find(i => i.source === "account");
  if (item && Math.abs(card.totals.balance) < 0.005) {
    console.log(`BULGU: bakiye 0 (müşteri iadesi) ama takvimde "${item.label}" ${item.amount} TL (${item.state})`);
    code = 1;
  }
} finally {
  await server.close();
}
process.exitCode = code;
