// 2.4.5 ikinci dar kontrol — S3: "Carinin Mevcut Borcu" kapsayan kartı olan caride KS7 satırı (stok iadesi trimCovers ile kartı kırpar; değersiz kırpmaz).
// Takvim (fatura net + kart taksitleri + cari vade) toplamı = bakiye mi? Eski (201ffef) ile aynı akış.
import { start, must, day } from "./h.mjs";

async function run(name, { ret = 0, writeOff = 0 }) {
  const { server, api } = await start();
  try {
    const svc = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-1", name: "Hizmet", unit: "Adet", salePrice: "100" }));
    const goods = await must("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "URN-1", name: "Ürün", unit: "Adet", salePrice: "100", openingQty: "100" }));
    const acc = await must("cari", api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: day(-400), phone: "05001234567" }));
    const inv = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: day(-60), lines: [{ itemId: svc.id, qty: 1, unitPrice: "500", vatRate: 0 }], payment: { rest: "open", dueDate: day(-50) } }));
    await must("taksitli stok satışı", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "10", unitPrice: "100", pay: "account", accountId: acc.id, date: day(-20), installments: { count: 2, firstDue: day(-10), everyMonths: 1 } }));
    if (ret) await must("stok iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: String(ret / 100), unitPrice: "100", pay: "account", accountId: acc.id, date: day(-5) }));
    if (writeOff) {
      const take = await must("şüpheliye al", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "1500", date: day(-8), reason: "lawsuit", note: "dava" }));
      await must("değersiz", api.post(`/api/workspace/accounts/${acc.id}/doubtful/${take.id || take.record?.id}/write-off`, { amount: String(writeOff), date: day(-4), note: "değersiz" }));
    }
    const card = await must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
    const doc = await must("fatura oku", api.get(`/api/workspace/invoices/${inv.id}`));
    const dues = await must("dues", api.get("/api/workspace/dues"));
    const mine = dues.items.filter(i => i.person === name);
    // Gösterilen açık = faturanın açığı + kartların kalanı (takvim penceresi 7 gün; kartın sonraki taksiti pencere dışında kalabilir)
    const sum = Math.round((Number(doc.open) + card.plans.reduce((t, p) => t + Number(p.totals?.remaining || 0), 0)) * 100) / 100;
    const plan = card.plans.map(p => `${p.total}/${p.totals?.remaining ?? ""}`).join(",");
    return { name, bakiye: card.totals.balance, fatura: `${doc.open} ${doc.payState}`, kart: plan, acikToplam: sum, takvim: mine.map(i => `${i.source}:${i.amount}`).join(" "), esit: Math.abs(sum - card.totals.balance) < 0.005 };
  } finally {
    await server.close();
  }
}
const rows = [];
rows.push(await run("İade 300", { ret: 300 }));
rows.push(await run("İade 800", { ret: 800 }));
rows.push(await run("Değersiz 300", { writeOff: 300 }));
rows.push(await run("Değersiz 800", { writeOff: 800 }));
for (const r of rows) console.log(JSON.stringify(r));
