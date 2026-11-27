// Tanı: Taksit İadesi (kart tahsilatı 1.000, toplam 800'e iner, iade 300) sonrası kartın gösterilen / kendi / kuyruk sayıları. Kullanım: ROOT=<kod> node n7-bak.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const h = await import(pathToFileURL(path.join(ROOT, "test/helpers.mjs")).href);
const server = await h.startTestServer({ now: { time: "2026-10-20T12:00:00+03:00", fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const client = await h.loginAdmin(server);
const u = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const post = async (url, body) => { const r = await client.post(url, body); if (r.status !== 200) throw new Error(`${url} ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return u(r); };
const get = async url => u(await client.get(url));
try {
  await client.post("/api/workspace/bank/setup/dismiss", {});
  const acc = await post("/api/workspace/accounts", { name: "N7 Müşteri", type: "customer", registeredOn: "2025-09-01", phone: "0500 111 22 33" });
  const plan = await post("/api/workspace/plans", { name: acc.name, registeredOn: "2026-10-01", total: "1000", accountId: acc.id, mode: "auto", count: "1", firstDue: "2026-10-15", everyMonths: "1" });
  const show = async label => {
    const c = await get(`/api/workspace/plans/${plan.id}`);
    const card = await get(`/api/workspace/accounts/${acc.id}`);
    const q = server.app.context.invoices.allObligations().get(acc.id);
    console.log(label, JSON.stringify({ total: c.totals.total, paid: c.totals.paid, remaining: c.totals.remaining, ownPaid: c.totals.ownPaid, ownRemaining: c.totals.ownRemaining, extra: c.totals.extra, queueRemaining: c.totals.queueRemaining, state: c.state, items: c.items.map(i => [i.amount, i.paid, i.remaining, i.ownPaid, i.ownRemaining]), bakiye: card.totals.balance, planRemaining: card.totals.planRemaining, harita: [...(q?.installments.get(plan.id) || [])].map(([k, v]) => [k.slice(0, 6), v.remaining, v.collected, v.amount]) }));
  };
  await post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1000", date: "2026-10-20", method: "cash", cashForce: true, similarOk: true });
  await show("1.000 tahsil");
  await post(`/api/workspace/plans/${plan.id}/distribute`, { total: "800", count: 1, firstDue: "2026-10-15" });
  await show("toplam 800");
  await post(`/api/workspace/plans/${plan.id}/entries`, { kind: "out", amount: "300", date: "2026-10-20", method: "cash", cashForce: true, similarOk: true });
  await show("iade 300");
  if (process.argv[2] === "bagsiz") {
    await post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "100", date: "2026-10-20", method: "cash", cashForce: true, similarOk: true });
    await show("bağsız tahsilat 100");
  }
} finally {
  await server.close();
}
