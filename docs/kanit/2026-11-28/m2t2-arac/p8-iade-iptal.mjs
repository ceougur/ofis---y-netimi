// DK-M2 P8: aynı ekonomik sonuç, iki yol — Değersiz 3.000 @17.09 (S264) sonrası (a) fatura İPTALİ, (b) aynı faturanın tam İADESİ; (c) S155 reddinin iletisi.
import { pathToFileURL } from "node:url";
import path from "node:path";
const ROOT = process.env.ROOT;
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { startTestServer, loginAdmin } = await imp("test/helpers.mjs");
const { apiOf } = await imp("test/banka-210-ortak.mjs");
const lib = await imp("server/lib/bank/doubtful.mjs");
const TODAY = "2026-10-15", ACC = "/api/workspace/accounts";
const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = apiOf(await loginAdmin(server));
await api.post("/api/workspace/bank/setup/dismiss", {});
const show = (label, r) => console.log(label, "→", r.status, r.code || "", String(r.error || "").slice(0, 400));
const bal = async p => (await api.get(`${ACC}/${p}`)).data.totals.balance;
let n = 0;
const base = async name => {
  n += 1;
  const a = (await api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: `0500 888 0${n} ${String(n).padStart(2, "0")}` })).data;
  const inv = (await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } })).data;
  await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" });
  await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id });
  const s = (await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  return { a, inv, s };
};
{
  const { a, inv, s } = await base("DK P8a Müşteri");
  show("a Değersiz 3000 @17.09", await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  show("a fatura iptali", await api.post(`/api/workspace/invoices/${inv.id}/cancel`, { reason: "Hatalı" }));
  console.log("a bakiye", await bal(a.id));
}
{
  const { a, inv, s } = await base("DK P8b Müşteri");
  show("b Değersiz 3000 @17.09", await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  const detail = (await api.get(`/api/workspace/invoices/${inv.id}`)).data;
  const line = (detail.lines || detail.invoice?.lines || [])[0];
  show("b tam iade 01.10", await api.post("/api/workspace/invoices", { kind: "sale_return", accountId: a.id, originalId: inv.id, issueDate: "2026-10-01", lines: [{ originLineId: line?.id, qty: 1 }], payment: { rest: "open" }, cashForce: true }));
  console.log("b bakiye", await bal(a.id), "değişmez", JSON.stringify(lib.doubtfulProblems(server.app.store, { parties: [a.id] }).map(x => x.sample)));
}
{
  // c: S155 — öbür açık kayıt 500 (A26'nın sınıfı): sınır 3.000, öneri 2.923,55; sınırı yazınca ileti.
  const { a, s } = await base("DK P8c Müşteri");
  await api.post(`${ACC}/${a.id}/doubtful`, { amount: "500", date: "2026-09-25", reason: "lawsuit" });
  const q = (await api.get(`${ACC}/${a.id}/doubtful/${s}/write-off?date=2026-09-17`)).data;
  console.log("c sınır", q.limitMinor, "öneri", q.offerMinor, "s155", q.s155, q.s155Text);
  show("c sınır 3000 yazılınca", await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
}
const integ = (await api.get("/api/workspace/ledger/integrity")).data;
console.log("Mutabakat", integ.ok, JSON.stringify((integ.failures || []).map(f => [f.code, f.sample])).slice(0, 600));
server.close();
