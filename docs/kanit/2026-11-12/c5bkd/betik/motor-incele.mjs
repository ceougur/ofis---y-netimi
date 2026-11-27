// DÜŞÜK-3 alt sınır uyarılarının incelemesi: motoru <işlem> işleme kadar koşar (denetimsiz), sonra verilen taksitli faturanın carisini döker —
// fatura durumu (G2: açık, kapatanlar) ↔ kartın kuyruk kalanı (G1: taksitler) ↔ carinin defteri ve kuyruk kalemleri.
// Kullanım: ROOT=<kod kökü> node motor-incele.mjs <tohum> <işlem> <fatura no>
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const [seedText, opsText, numberArg] = process.argv.slice(2);
let number = numberArg;
const helpers = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const { runReconciliation, motorNow } = await import(pathToFileURL(path.join(process.env.MOTOR || ROOT, "test/mutabakat/motor.mjs")).href);
const server = await helpers.startTestServer({ bankPickLegacy: true, now: motorNow() });
const r2 = v => Math.round(v * 100) / 100;
try {
  const admin = await helpers.loginAdmin(server);
  const report = await runReconciliation({ client: admin, seed: Number(seedText), operations: Number(opsText), verifyEvery: 1, burst: 60, pos: true, log: () => {} });
  console.log(`motor: ${report.operations} işlem, uyuşmazlık ${report.mismatches.length}${report.mismatches.length ? " · " + report.mismatches[0].problems.join(" | ").slice(0, 400) : ""}`);
  if (!number) number = /Taksitli fatura (\S+):/.exec(report.mismatches[0]?.problems.join(" ") || "")?.[1];
  const store = server.app.store;
  const ctx = server.app.context;
  const u = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
  const get = async url => u(await admin.get(url));
  const inv = store.get("SELECT id, account_id AS accountId, plan_id AS planId, number, issue_date AS date, try_payable AS payable FROM invoices WHERE number = ?", number);
  if (!inv?.planId) throw new Error(`fatura yok ya da taksitli değil: ${JSON.stringify(inv)}`);
  const doc = await get(`/api/workspace/invoices/${inv.id}`);
  const plan = await get(`/api/workspace/plans/${inv.planId}`);
  const card = await get(`/api/workspace/accounts/${inv.accountId}`);
  console.log(`FATURA ${number} ${inv.date} ödenecek ${doc.tryPayable} · açık ${doc.open} · durum ${doc.payState} · kapatanlar ${(doc.closers || []).map(c => `${c.date}:${c.amount}:${c.label}:${c.mode}`).join(" | ")}`);
  console.log(`KART ${plan.id.slice(0, 12)} toplam ${plan.totals.total} · kendi ödenen ${plan.totals.ownPaid ?? plan.totals.paid} kendi kalan ${plan.totals.ownRemaining ?? plan.totals.remaining} · kuyruk kalanı ${plan.totals.queueRemaining} · taksitler ${plan.items.map(i => `${i.dueDate}:${i.amount}→${i.remaining}`).join(" ")} · tahsilatlar ${(plan.entries || []).map(e => `${e.date}:${e.kind}:${e.amount}`).join(" ")}`);
  console.log(`CARİ bakiye ${card.totals.balance} · gecikmiş ${card.totals.overdueDebt} · kartları ${(card.plans || []).map(p => `${p.id.slice(0, 10)}:${p.totals.total}${p.coversBalance ? "(MB)" : ""}${p.invoiceId ? "(F)" : ""}:${p.status}`).join(" ")}`);
  console.log("DEFTER (tarih sırası):");
  for (const e of [...(card.ledger || [])]) console.log(`  ${e.date} ${String(e.origin || "").padEnd(8)} ${String(e.kind || "").padEnd(8)} borç ${e.debit || 0} alacak ${e.credit || 0} ${e.planId ? "kart " + String(e.planId).slice(0, 10) : ""} ${e.sourceId ? "kaynak " + String(e.sourceId).slice(0, 14) : ""} ${String(e.label || "").slice(0, 40)}`);
  const q = ctx.invoices.allObligations().get(inv.accountId);
  console.log("KUYRUK kalemleri (açık):");
  for (const it of q.items) if (it.remaining) console.log(`  ${it.side} ${it.kind} ${it.remaining}/${it.amount} vade ${it.dueDate || it.date} ${it.planId ? "kart " + String(it.planId).slice(0, 10) : ""} ${String(it.label || "").slice(0, 40)}`);
  console.log(`Σ kalem ${r2(q.items.reduce((s, i) => s + (i.side === "receivable" ? i.remaining : -i.remaining), 0))} · kapsama ${[...q.coverage].map(([k, v]) => `${k.slice(0, 10)}:${v.rule}:tük ${v.consumed}/${v.capacity}:avans ${v.advance}:kırp ${v.trimmed}`).join(" ")} · ön ödeme ${JSON.stringify(q.prepaidPasses || null)}`);
  const invs = store.all("SELECT id, number, kind, try_payable AS payable, plan_id AS planId FROM invoices WHERE account_id = ? AND status = 'issued'", inv.accountId);
  for (const row of invs) { const d = await get(`/api/workspace/invoices/${row.id}`); console.log(`  fatura ${row.number} ${row.kind} ödenecek ${row.payable} açık ${d.open} ${row.planId ? "taksitli" : ""}`); }
} finally {
  await server.close();
}
