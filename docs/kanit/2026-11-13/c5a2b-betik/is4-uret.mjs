// Ç5-A tur 2b İş 4 — BUGÜNKÜ kodda şüpheli ↔ bağlı alacak defter ayrımının yeniden üretimi (ders 6). ROOT=<kod>.
// Cari: F1 (eski, 1.000) + şüpheliye al 1.000 (F1 kuyrukta) + F2 (kayıttan SONRA, 500).
// (a) F1'e bağlı (Kapatılacak Fatura) nakit tahsilat 400 → S25 (c): 128'den beklenir.
// (b) F2'ye bağlı alınan çek 300 → S14: F2 sonradan kesildi → 120 beklenir.
// (c) bağsız nakit 100 → K3: önce 128 (değişmez).
import { boot, day, print } from "./k.mjs";
const h = await boot();
const { api } = h;
const app = h.server.app;
const out = {};
const st = r => `${r.status}${r.status >= 400 ? " " + String(r.data?.error?.message || r.data?.error || "").slice(0, 200) : ""}`;
const linesOf = (accountId, after) => {
  const rows = [];
  for (const e of app.ledger.build()) {
    if (String(e.date) < after) continue;
    const ls = (e.lines || []).filter(l => ["120", "128"].includes(l.account) && l.credit > 0 && (!l.party || l.party === accountId));
    if (ls.length) rows.push(`${e.date} ${e.source || e.id} | ${ls.map(l => `A ${l.account} ${(l.credit / 100).toFixed(2)}`).join(" + ")}`);
  }
  return rows;
};
const inv = async (a, date, amount) => {
  const r = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open" } });
  return { r: st(r), id: r.data?.id };
};
try {
  const a = await h.account("Is4 Supheli");
  const f1 = await inv(a, day(-60), 1000);
  out.F1 = f1.r;
  out.supheli = st(await api.post(`/api/workspace/accounts/${a.id}/doubtful`, { amount: 1000, date: day(-40), reason: "lawsuit", note: "is4" }));
  const f2 = await inv(a, day(-30), 500);
  out.F2 = f2.r;
  out.a_bagliNakit = st(await api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "400", date: day(-20), method: "cash", cashForce: true, similarOk: true, invoiceId: f1.id }));
  out.c_bagsizNakit = st(await api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "100", date: day(-15), method: "cash", cashForce: true, similarOk: true }));
  out.b_F2yeBagliCek = st(await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: "IS4-1", amount: "300", accountId: a.id, issueDate: day(-10), dueDate: day(40), invoiceId: f2.id }));
  out.defter = linesOf(a.id, day(-41));
  const card = await h.card(a);
  out.kart = { bakiye: card.totals?.balance, supheli: card.totals?.doubtful ?? card.doubtful?.openMinor ?? "(alan?)" };
  const q = h.queue(a);
  out.kuyrukSupheli = { tutar: q.doubtful.amount, kalemler: q.doubtful.items.map(i => `${i.kind}:${i.invoiceId === f1.id ? "F1" : i.invoiceId === f2.id ? "F2" : i.lineId} ${i.amount}`) };
  out.mutabakat = (app.integrity.scan().findings || []).map(f => f.code);
} catch (e) { out.HATA = String(e.stack || e).slice(0, 800); }
print(out);
await h.server.close();
