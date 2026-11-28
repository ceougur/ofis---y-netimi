// M2T2 P9: kararın söylemediği yollar (ÖLÇ) — Değersiz 3.000 @17.09 (taban T) sonrası: (a) fatura tutarının Düzenle ile düşürülmesi, (b) bağlı ÇEKİN karşılıksız çıkması,
// (c) Değersiz olmadan da eksi kalacak iptal (avans), (d) aynı cariye alış faturası. ROOT=<kod> node p9-kararsiz-yollar.mjs
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
const show = (label, r) => console.log(label, "→", r.status, r.code || "", String(r.error || "").slice(0, 300));
const bal = async p => (await api.get(`${ACC}/${p}`)).data.totals.balance;
const probs = p => lib.doubtfulProblems(server.app.store, { parties: [p] }).map(x => x.sample);
let n = 0;
const base = async (name, { cheque = false, advance = 0 } = {}) => {
  n += 1;
  const a = (await api.post(ACC, { name, type: "customer", registeredOn: "2026-09-01", phone: `0500 254 0${n} 0${n}` })).data;
  const inv = (await api.post(INV, { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "2900", vatRate: 0 }], payment: { rest: "open" } })).data;
  await api.post(`${ACC}/${a.id}/entries`, { kind: "debt", amount: "3400", date: "2026-09-12", note: "Borç" });
  let ch = null;
  if (cheque) ch = (await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: `M2T2P9${n}`, amount: "2876.45", accountId: a.id, issueDate: "2026-09-17", dueDate: "2026-10-10", invoiceId: inv.id })).data;
  else await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: "2876,45", date: "2026-09-17", method: "cash", cashForce: true, similarOk: true, note: "Bağlı", invoiceId: inv.id });
  const s = (await api.post(`${ACC}/${a.id}/doubtful`, { amount: "3000", date: "2026-09-17", reason: "lawsuit" })).data.record.id;
  show(`${name} Değersiz 3000 @17.09`, await api.post(`${ACC}/${a.id}/doubtful/${s}/write-off`, { amount: "3000", date: "2026-09-17" }));
  if (advance) show(`${name} avans (bağsız) ${advance}`, await api.post(`${ACC}/${a.id}/entries`, { kind: "in", amount: String(advance), date: "2026-10-05", method: "cash", cashForce: true, similarOk: true, note: "Avans" }));
  return { a, inv, s, ch };
};
{
  const { a, inv } = await base("P9a Tutar Düşür");
  const body = { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-10", lines: [{ name: "Hizmet", qty: 1, unitPrice: "100", vatRate: 0 }], payment: { rest: "open" } };
  show("P9a fatura 2.900 → 100 (Düzenle)", await api.post(`${INV}/${inv.id}/edit`, body));
  console.log("P9a bakiye", await bal(a.id), "değişmez", JSON.stringify(probs(a.id)));
}
{
  const { a, ch } = await base("P9b Çek Karşılıksız", { cheque: true });
  console.log("P9b çek", ch?.id ? "var" : "yok", "bakiye", await bal(a.id));
  if (ch?.id) {
    show("P9b çek karşılıksız", await api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "bounce", date: "2026-10-12" }));
    console.log("P9b bakiye", await bal(a.id), "değişmez", JSON.stringify(probs(a.id)));
  }
}
{
  const { a, inv } = await base("P9c Avanslı İptal", { advance: 3000 });
  console.log("P9c iptal öncesi bakiye", await bal(a.id));
  show("P9c fatura iptali (Değersiz olmadan da eksi kalır)", await api.post(`${INV}/${inv.id}/cancel`, { reason: "Hatalı" }));
  console.log("P9c bakiye", await bal(a.id), "değişmez", JSON.stringify(probs(a.id)));
}
{
  const { a } = await base("P9d Alış Faturası");
  show("P9d aynı cariye alış faturası 2.900", await api.post(INV, { scenario: "expense_purchase", kind: "purchase", accountId: a.id, issueDate: "2026-10-05", lines: [{ name: "Hizmet Alımı", qty: 1, unitPrice: "2900", vatRate: 0, expenseCode: "office" }], payment: { rest: "open" } }));
  console.log("P9d bakiye", await bal(a.id), "değişmez", JSON.stringify(probs(a.id)));
}
const integ = (await api.get("/api/workspace/ledger/integrity")).data;
console.log("Mutabakat", integ.ok, JSON.stringify((integ.failures || []).map(f => [f.code, f.sample])).slice(0, 600));
server.close();
