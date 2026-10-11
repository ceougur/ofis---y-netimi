import path from "node:path"; import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const un = r => (r.data && typeof r.data === "object" && "data" in r.data ? r.data.data : r.data);
const s = await startTestServer(); const a = await loginAdmin(s);
try {
  await a.put("/api/admin/negative-policy", { cash: "off" });
  const day = "2026-10-05";
  const u = un(await a.post("/api/workspace/stock", { name: "Ü", unit: "Adet", kind: "product" })).id;
  await a.post(`/api/workspace/stock/${u}/moves`, { kind: "in", qty: 10, pay: "none", date: day, note: "g" });
  const m = un(await a.post("/api/workspace/accounts", { name: "M", type: "customer" })).id;
  const inv = await a.post("/api/workspace/invoices", { kind: "sale", accountId: m, issueDate: day, pricesIncludeVat: false, lines: [{ itemId: u, qty: 5, unitPrice: 100, vatRate: 20 }], payment: { cash: [], rest: "installments", installments: { count: 3, firstDue: "2026-11-05", everyMonths: 1 } } });
  const f = un(inv);
  const orig = un(await a.get(`/api/workspace/invoices/${f.id}`));
  const r = await a.post("/api/workspace/invoices", { kind: "sale_return", originalId: f.id, issueDate: day, lines: [{ originLineId: orig.lines[0].id, qty: 2 }], payment: { cash: [{ amount: 240, method: "cash", lineKey: "g1" }] }, negativeOk: true, cashForce: true });
  if (r.status !== 200) console.log("iade", r.status, JSON.stringify(r.data).slice(0, 300));
  const card = un(await a.get(`/api/workspace/invoices/${f.id}`));
  const plan = un(await a.get(`/api/workspace/plans/${f.planId || card.planId}`));
  const acc = un(await a.get(`/api/workspace/accounts/${m}`));
  const t = plan.totals || plan.plan?.totals || {};
  console.log(JSON.stringify({ root: path.basename(root), faturaAcik: card.open, faturaDurum: card.payLabel || card.payState, kartToplam: t.total, kartOdenen: t.paid, kartKalan: t.remaining, cariBakiye: (acc.account || acc).balance ?? acc.balance }));
} finally { await s.close(); }
