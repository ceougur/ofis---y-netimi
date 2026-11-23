// Veri kopyasını verilen kodla açar; faturayı numarasıyla bulup açık / kapatanlar ve carinin kuyruk Σ'sını yazar.
// ROOT=<kod> DATA=<veri> NO=<fatura no> node fatura.mjs
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { startTestServer, loginAdmin } = await imp("test/helpers.mjs");
const { motorNow } = await imp("test/mutabakat/motor.mjs");
const copy = mkdtempSync(path.join(tmpdir(), "udfix-fatura-"));
cpSync(process.env.DATA, copy, { recursive: true });
const server = await startTestServer({ dataDir: copy, bankPickLegacy: true, now: motorNow() });
try {
  const admin = await loginAdmin(server);
  const row = server.app.context.store ? null : null;
  const list = (await admin.get(`/api/workspace/invoices?q=${encodeURIComponent(process.env.NO)}&status=all&limit=50`)).data;
  const items = (list.data ?? list).invoices || (list.data ?? list).items || [];
  const hit = items.find(x => x.number === process.env.NO) || items[0];
  if (!hit) throw new Error(`fatura yok: ${JSON.stringify(list).slice(0, 300)}`);
  const inv = (await admin.get(`/api/workspace/invoices/${hit.id}`)).data;
  const d = inv.data ?? inv;
  console.log(`fatura ${d.number} cari ${d.accountId} ödenecek ${d.tryPayable ?? d.payable} açık ${d.open} durum ${d.paymentState ?? d.state} kapatanlar ${(d.closers || []).map(c => `${c.date}:${c.amount}:${c.label}`).join(" | ")}`);
  const all = server.app.context.invoices.allObligations();
  const q = all?.get(d.accountId);
  const sig = (q?.items || []).reduce((s, i) => s + (i.side === "receivable" ? 1 : -1) * Math.round(i.remaining * 100), 0);
  const acc = (await admin.get(`/api/workspace/accounts/${d.accountId}`)).data;
  const a = acc.data ?? acc;
  console.log(`cari ${a.account?.name ?? a.name} bakiye ${a.account?.balance ?? a.balance} Σ kalem ${sig / 100} geçiş ${JSON.stringify(q?.prepaidPasses)}`);
} finally {
  await server.close();
}
