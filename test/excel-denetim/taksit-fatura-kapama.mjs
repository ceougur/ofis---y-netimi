// Bulgu denemesi (kod değiştirmez): aynı müşteride açık satış faturası + Taksit penceresinden AYRI borçla açılan taksit
// kartı. Kartın kendi tahsilatı faturayı da kapatıyor mu (çift sayım), cari kartından alınan genel tahsilat kaybolur mu?
// Değişmez kural: açık faturaların kalanı + taksit kartlarının kalanı = carinin bakiyesi (aynı para iki kez sayılmaz,
// hiçbir tahsilat kaybolmaz). Kullanım: node taksit-fatura-kapama.mjs
import fs from "node:fs";
import path from "node:path";
import { HERE, PASS, staff, startServer } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const app = startServer(path.join(SP, "taksit-fatura-kapama"), { fresh: true });
const { port } = await app.listen(0, "127.0.0.1");
const c = staff(`http://127.0.0.1:${port}`);
if ((await c.login("admin", PASS)).status !== 200) throw new Error("giriş");
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  return res.data;
};
const item = await must("ürün", c.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
const out = [];
async function scenario(label, steps) {
  const acc = await must("cari", c.post("/api/workspace/accounts", { name: `Deneme ${label}`, type: "customer", registeredOn: "2025-01-01", phone: `0500 000 00 ${String(out.length + 10)}` }));
  let planId = "";
  let invoiceId = "";
  for (const step of steps) {
    if (step.invoice) invoiceId = (await must("fatura", c.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: step.date, lines: [{ itemId: item.id, qty: 1, unitPrice: step.invoice, vatRate: 0 }], payment: { rest: "open", dueDate: step.date } }))).id;
    if (step.plan) planId = (await must("kart", c.post("/api/workspace/plans", { name: acc.name, registeredOn: step.date, total: String(step.plan), accountId: acc.id, mode: "auto", count: "3", firstDue: "2025-03-01", ...(step.covers ? { coversBalance: true } : {}) }))).id;
    if (step.collect) await must("tahsilat", c.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: step.collect, date: step.date, method: "cash", note: "cari kartından tahsilat" }));
    if (step.planCollect) await must("kart tahsilatı", c.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: step.planCollect, date: step.date, method: "bank", note: "taksit kartından tahsilat" }));
  }
  const inv = await must("fatura oku", c.get(`/api/workspace/invoices/${invoiceId}`));
  const plan = await must("kart oku", c.get(`/api/workspace/plans/${planId}`));
  const account = (await must("cari oku", c.get(`/api/workspace/accounts?status=all&limit=50&q=${encodeURIComponent(acc.name)}`))).accounts.find(a => a.id === acc.id);
  const invOpen = Number(inv.open ?? inv.settle?.open ?? 0);
  const planLeft = Number(plan.totals.remaining);
  const row = { senaryo: label, adimlar: steps, fatura: { odenecek: inv.tryPayable, odenen: inv.paid, acik: invOpen, durum: inv.payStateLabel }, taksitKarti: { toplam: plan.totals.total, odenen: plan.totals.paid, kalan: planLeft }, cariBakiye: account.balance, acikToplam: Math.round((invOpen + planLeft) * 100) / 100 };
  row.tutarli = Math.abs(row.acikToplam - account.balance) < 0.005;
  out.push(row);
  console.log(`\n■ ${label}`);
  console.log(`  fatura ${inv.tryPayable}: ödenen ${inv.paid} · açık ${invOpen} · ${inv.payStateLabel}`);
  console.log(`  taksit kartı ${plan.totals.total}: ödenen ${plan.totals.paid} · kalan ${planLeft}`);
  console.log(`  cari bakiye ${account.balance} · fatura açığı + kart kalanı ${row.acikToplam} → ${row.tutarli ? "TUTARLI" : `TUTARSIZ (fark ${Math.round((account.balance - row.acikToplam) * 100) / 100})`}`);
}
try {
  await scenario("A · önce fatura, sonra ayrı kart", [{ date: "2025-01-23", invoice: 12720 }, { date: "2025-01-24", plan: 9000 }, { date: "2025-01-25", collect: 5000 }, { date: "2025-01-26", planCollect: 3000 }]);
  await scenario("B · önce kart, sonra fatura", [{ date: "2025-01-10", plan: 9000 }, { date: "2025-01-23", invoice: 12720 }, { date: "2025-01-25", collect: 5000 }, { date: "2025-01-26", planCollect: 3000 }]);
  await scenario("C · fatura hiç ödenmedi, kart tamamen ödendi", [{ date: "2025-02-01", invoice: 6000 }, { date: "2025-02-02", plan: 9000 }, { date: "2025-02-03", planCollect: 3000 }, { date: "2025-02-04", planCollect: 3000 }, { date: "2025-02-05", planCollect: 3000 }]);
  // D: kart AYRI borç değil, faturanın borcunu taksitlendiriyor ("Carinin Mevcut Borcu"); burada tek borç vardır:
  // fatura açığı ile kart kalanı AYNI borcun iki görünüşüdür (toplanmaz), ikisi de cari bakiyesine eşit olmalı.
  await scenario("D · faturanın borcu karta bölündü (Carinin Mevcut Borcu)", [{ date: "2025-02-10", invoice: 12000 }, { date: "2025-02-11", plan: 12000, covers: true }, { date: "2025-02-12", planCollect: 3000 }]);
  const d = out.at(-1);
  d.tutarli = Math.abs(d.fatura.acik - d.cariBakiye) < 0.005 && Math.abs(d.taksitKarti.kalan - d.cariBakiye) < 0.005;
  console.log(`  D için doğru ölçü: fatura açığı ${d.fatura.acik} = kart kalanı ${d.taksitKarti.kalan} = cari bakiye ${d.cariBakiye} → ${d.tutarli ? "TUTARLI" : "TUTARSIZ"}`);
  const aging = await must("yaşlandırma", c.get("/api/workspace/report-center/alacak-yaslandirma"));
  console.log(`\nAlacak Yaşlandırma özeti: ${JSON.stringify(aging.summary)}`);
  const accounts = (await must("cariler", c.get("/api/workspace/accounts?status=all&limit=50"))).accounts;
  console.log(`Cari bakiyeleri toplamı: ${accounts.reduce((sum, a) => sum + a.balance, 0)}`);
  fs.writeFileSync(path.join(HERE, "cikti", "taksit-fatura-kapama.json"), JSON.stringify({ senaryolar: out, yaslandirma: aging.summary }, null, 1));
} finally {
  await app.close();
}
