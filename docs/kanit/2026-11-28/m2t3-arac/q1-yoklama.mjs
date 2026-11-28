// M2T3 yoklama: S-M2T2-1 / S-M2T2-2 yolları — ROOT=<kod> node q1-yoklama.mjs
import { pathToFileURL } from "node:url";
import path from "node:path";
const ROOT = process.env.ROOT;
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { startTestServer, loginAdmin } = await imp("test/helpers.mjs");
const { apiOf } = await imp("test/banka-210-ortak.mjs");
const lib = await imp("server/lib/bank/doubtful.mjs");
const TODAY = "2026-10-15", ACC = "/api/workspace/accounts", INV = "/api/workspace/invoices";
const server = await startTestServer({ now: `${TODAY}T12:00:00+03:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = apiOf(await loginAdmin(server));
await api.post("/api/workspace/bank/setup/dismiss", {});
const show = (label, r) => console.log(label, "→", r.status, r.code || "", String(r.error || "").slice(0, 900));
const bal = async p => (await api.get(`${ACC}/${p}`)).data.totals.balance;
const probs = p => lib.doubtfulProblems(server.app.store, { parties: [p] }).map(x => x.sample);
let n = 0;
const body = (a, price, extra = {}) => ({ scenario: "service_sale", accountId: a, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: String(price), vatRate: 0 }], payment: { rest: "open" }, ...extra });
const base = async (name, { advance = 0, extra = 0, wo = true } = {}) => {
  n += 1;
  const a = (await api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: `0500 255 0${n} 0${n}` })).data;
  const inv = (await api.post(INV, body(a.id, 2900))).data;
  await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" });
  if (extra) await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: String(extra), date: "2026-09-12", note: "Ek" });
  await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id });
  const s = (await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  if (wo) show(`${name} Değersiz 3000 @17.09`, await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  if (advance) show(`${name} avans ${advance}`, await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: String(advance), date: "2026-10-05", method: "cash", cashForce: true, similarOk: true, note: "Avans" }));
  return { a, inv, s };
};
for (const [label, opts, act] of [
  ["Q1 avanslı iptal", { advance: 3000 }, b => api.post(`${INV}/${b.inv.id}/cancel`, { reason: "Hatalı" })],
  ["Q2 Düzenle 2900→100", {}, b => api.post(`${INV}/${b.inv.id}/edit`, body(b.a.id, 100))],
  ["Q3 Düzenle 2900→3000", {}, b => api.post(`${INV}/${b.inv.id}/edit`, body(b.a.id, 3000))],
  ["Q4 Düzenle 2900→2000 ek borç 2000", { extra: 2000 }, b => api.post(`${INV}/${b.inv.id}/edit`, body(b.a.id, 2000))],
  ["Q5 Düzenle avanslı 2900→2800", { advance: 3000 }, b => api.post(`${INV}/${b.inv.id}/edit`, body(b.a.id, 2800))],
  ["Q6 Düzenle 2900→100 Değersizsiz", { wo: false }, b => api.post(`${INV}/${b.inv.id}/edit`, body(b.a.id, 100))],
  ["Q7 avanslı iptal Değersizsiz", { wo: false, advance: 3000 }, b => api.post(`${INV}/${b.inv.id}/cancel`, { reason: "Hatalı" })],
]) {
  const b = await base(label, opts);
  console.log(label, "öncesi bakiye", await bal(b.a.id));
  show(label, await act(b));
  console.log(label, "sonra bakiye", await bal(b.a.id), "fatura", JSON.stringify(server.app.store.get("SELECT status, payable_total AS p FROM invoices WHERE id = ?", b.inv.id)), "değişmez", JSON.stringify(probs(b.a.id)));
}
{
  const b = await base("Q8 cari değiştir");
  const o = (await api.post(ACC, { name: "Q8 öbür", type: "customer", registeredOn: "2026-09-01", phone: "0500 255 99 99" })).data;
  show("Q8 Düzenle cari değişir", await api.post(`${INV}/${b.inv.id}/edit`, body(o.id, 2900)));
  console.log("Q8 sonra bakiye", await bal(b.a.id), await bal(o.id));
}
{
  const b = await base("Q9 avanslı iade", { advance: 3000 });
  const d = (await api.get(`${INV}/${b.inv.id}`)).data;
  const line = (d.lines || d.invoice?.lines || [])[0];
  show("Q9 tam iade", await api.post(INV, { kind: "sale_return", accountId: b.a.id, originalId: b.inv.id, issueDate: "2026-10-01", lines: [{ originLineId: line?.id, qty: 1 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
  console.log("Q9 sonra bakiye", await bal(b.a.id));
}
const integ = (await api.get("/api/workspace/ledger/integrity")).data;
console.log("Mutabakat", integ.ok, JSON.stringify((integ.failures || []).map(f => [f.code, f.sample])).slice(0, 600));
server.close();
