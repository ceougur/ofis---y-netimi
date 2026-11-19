// §18.6 (1) / (2) ayırt edici örnek: avanslı (120 < 0) caride fatura peşini. F1 1.000 (−60) → şüpheliye al 1.000 (−40) → F2 500 (−30) → F2'ye bağlı ÇEK 900 (−25; fazlası avans)
// → F3 300 (−10) PEŞİN 300 nakit. Kuyruğun peşin anındaki F3 şüpheli payı + defter + kuyruk şüphelisi. ROOT=<kod> node pesin.mjs
import { boot, day, print } from "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2b-q4/betik/k.mjs";
const h = await boot();
const { api } = h;
const app = h.server.app;
const st = r => `${r.status}${r.status >= 400 ? " " + String(r.data?.error?.message || r.data?.error || "").slice(0, 200) : ""}`;
const hesap = id => { const b = { 120: 0, 128: 0 }; for (const e of app.ledger.build()) for (const l of e.lines || []) if (["120", "128"].includes(l.account) && l.party === id) b[l.account] += l.debit - l.credit; return `120 ${b[120] / 100} · 128 ${b[128] / 100}`; };
const inv = async (a, date, amount, payment = { rest: "open" }) => { const r = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: amount, vatRate: 0 }], payment }); return r.status === 200 ? r.data.id : `HATA ${st(r)}`; };
const kuyruk = (a, ids) => { const q = h.queue(a); return `${q.doubtful.amount} = ` + q.doubtful.items.map(i => `${ids[i.invoiceId] || i.kind} ${i.amount}`).join(" + "); };
const out = {};
const a = await h.account("Peşin Avans");
const f1 = await inv(a, day(-60), 1000);
out.al = st(await api.post(`/api/workspace/accounts/${a.id}/doubtful`, { amount: 1000, date: day(-40), reason: "lawsuit" }));
const f2 = await inv(a, day(-30), 500);
out.cek900 = st(await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: "PSN1", amount: "900", accountId: a.id, issueDate: day(-25), dueDate: day(40), invoiceId: f2 }));
out.once = hesap(a.id);
out.kuyrukOnce = kuyruk(a, { [f1]: "F1", [f2]: "F2" });
const f3 = await inv(a, day(-10), 300, { cash: [{ amount: 300, method: "cash" }], rest: "open" });
out.f3 = String(f3).slice(0, 200);
out.sonra = hesap(a.id);
out.kuyrukSonra = kuyruk(a, { [f1]: "F1", [f2]: "F2", [f3]: "F3" });
out.pesinSatiri = app.ledger.build().filter(e => e.id.startsWith("account:") && (e.lines || []).some(l => l.party === a.id && l.credit > 0 && ["120", "128"].includes(l.account)) && e.date === day(-10)).map(e => e.lines.filter(l => l.credit > 0).map(l => `A ${l.account} ${l.credit / 100}`).join(", "));
out.mutabakat = (app.integrity.scan().findings || []).map(f => f.code);
print(out);
await h.server.close();
