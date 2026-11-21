// S229 / S230 — iki en küçük örnek (muhasebe sürücüsü bakımı 5'in R-S200 örnekleri; tarihler sahte saate 08.10.2026'ya taşındı). Test değildir; bu dosyanın
// bulunduğu kodda (../server) koşar, ekranların okuduğu sayıları yazar. Eski sürümde (v2.4.9 git worktree kopyası) ve güncel kodda aynı istekler.
//   Örnek 1 (S200 = A): F1 50.000 (02.09, vade 20.09) + Borç Yaz 30.000 (05.09); 25.09 kart 60.000 (2 × 30.000) → durum 08.10.
//   Örnek 2: F1 50.000 (vade 20.09); 25.09 "Carinin Mevcut Borcu" kartı 50.000 (faturanın tamamı).
// Kullanım: TZ=… HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/s229-en-kucuk.mjs
import { bootBank } from "./banka-210-hesap-ortak.mjs";
import { must } from "./banka-210-ortak.mjs";

const W = "/api/workspace";
const ctx = await bootBank();
const api = ctx.api;
const money = cell => Number(String(cell || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
async function example(name, withDebt, total, count) {
  const A = (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id;
  const f1 = (await must("satış", api.post(`${W}/invoices`, { scenario: "service_sale", accountId: A, issueDate: "2026-09-02", lines: [{ name: "Hizmet", qty: 1, unitPrice: 50000 / 1.2, vatRate: 20 }], payment: { rest: "open", dueDate: "2026-09-20" } }))).id;
  if (withDebt) await must("Borç Yaz", api.post(`${W}/accounts/${A}/entries`, { kind: "debt", amount: "30000", date: "2026-09-05", note: "Fark" }));
  await must("kart", api.post(`${W}/plans`, { accountId: A, name: `${name} Kartı`, total: String(total), registeredOn: "2026-09-25", mode: "auto", count, firstDue: "2026-11-01", coversBalance: true }));
  const report = await must("Açık Faturalar", api.get(`${W}/report-center/acik-faturalar?account=${A}`));
  const at = header => report.headers.indexOf(header);
  const doc = await must("fatura kartı", api.get(`${W}/invoices/${f1}`));
  const list = await must("liste", api.get(`${W}/invoices?tab=all&account=${A}`));
  const totals = (await must("cari", api.get(`${W}/accounts/${A}`))).totals;
  return {
    acikFaturalar: report.rows.map(row => ({ no: row[at("Fatura No")], kalan: money(row[at("Kalan")]), gecikme: row[at("Gecikme")] })),
    faturaKarti: { acik: doc.open, durum: doc.payStateLabel, kendiAcigi: doc.ownOpen ?? doc.open, taksitKartinda: (doc.inPlans || []).map(item => `${item.name} · ${item.amount}`) },
    listeKalan: list.invoices.find(item => item.id === f1)?.open,
    bakiye: totals.balance,
    gecikmis: totals.overdueDebt ?? totals.overdue,
  };
}
const out = { ornek1: await example("Örnek 1", true, 60000, 2), ornek2: await example("Örnek 2", false, 50000, 2) };
console.log(JSON.stringify(out, null, 1));
await ctx.server.close();
