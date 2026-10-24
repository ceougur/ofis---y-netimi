// Dar kontrol 2.4.5 — D1: Değersiz Alacak (şüpheli alacağın kesin kaybı; cari satırı kind credit, source doubtful) carinin VADELİ elle borcunu kapatmıyor:
// bakiye 0 iken zil / Tahsilat Takvimi / Vade Takip "Tahsil Edilecek Borç 1.000 (gecikmiş)" gösterir. Aynı veride faturanın durumu da yazılır
// (eski kodla karşılaştırma: ROOT=<eski kopya> → fatura tarafı 2.4.4'te de açık; "account|" kalemi 2.4.5'te yeni).
// Kullanım: node p1-degersiz.mjs   (ROOT ortam değişkeni denenen kod kökü; varsayılan bu dosyanın deposu)
import { start, must, day } from "./h.mjs";

const { server, api } = await start();
let code = 0;
try {
  const item = await must("stok", api.post("/api/workspace/stock", { kind: "service", code: "HZM-1", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
  const acc = await must("cari", api.post("/api/workspace/accounts", { name: "Değersiz Deneme", type: "customer", registeredOn: day(-400), phone: "05001112233" }));
  await must("borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "1000", date: day(-60), dueDate: day(-30), method: "cash" }));
  const inv = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: day(-50), lines: [{ itemId: item.id, qty: 1, unitPrice: "500", vatRate: 0 }], payment: { rest: "open", dueDate: day(-40) } }));
  const take = await must("şüpheliye al", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "1500", date: day(-20), reason: "lawsuit", note: "dava" }));
  const did = take.id || take.record?.id;
  await must("değersiz yaz", api.post(`/api/workspace/accounts/${acc.id}/doubtful/${did}/write-off`, { amount: "1500", date: day(-10), note: "değersiz" }));
  const card = await must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
  const debt = card.entries.find(e => e.kind === "debt" && !e.source);
  const doc = await must("fatura oku", api.get(`/api/workspace/invoices/${inv.id}`));
  const dues = await must("dues", api.get("/api/workspace/dues"));
  const vade = await must("vade", api.get(`/api/workspace/overview/vade-takip?from=${day(-400)}&to=${day(30)}`));
  console.log(`cari bakiye: ${card.totals.balance} (borç ${card.totals.debit}, alacak ${card.totals.credit})`);
  console.log(`elle borç Kalan: ${debt.remaining ?? "(alan yok)"} · Vade ${debt.dueDate ?? "(alan yok)"}`);
  console.log(`fatura açık: ${doc.open} (${doc.payState || doc.payStateLabel})`);
  console.log(`takvim/zil kalemleri: ${dues.items.map(i => `${i.source}:${i.label}:${i.amount}:${i.state}`).join(" | ") || "(yok)"}`);
  console.log(`Vade Takip satırları: ${vade.rows.map(r => `${r.source}:${r.label}:${r.amount}:${r.state}`).join(" | ") || "(yok)"} · şüpheli ayrı: ${JSON.stringify(vade.doubtful)}`);
  const accountItem = dues.items.find(i => i.source === "account");
  if (accountItem && Math.abs(card.totals.balance) < 0.005) {
    console.log(`BULGU: bakiye 0 (değersiz yazıldı) ama takvimde "${accountItem.label}" ${accountItem.amount} TL (${accountItem.state})`);
    code = 1;
  }
} finally {
  await server.close();
}
process.exitCode = code;
