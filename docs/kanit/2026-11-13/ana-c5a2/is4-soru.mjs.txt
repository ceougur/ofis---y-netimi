// Ana oturum: Ç5-A tur 2b İş 4 sorusunun BUGÜNKÜ programda koşusu (ders 6; soru sormadan önce ayırt edici örnek).
// Her cari: F1 1.000 (−60) → şüpheliye alma 1.000 (−40) → F2 500 (−30; kayıttan SONRA) → bağsız nakit 400 'Normal Cari Hesaba İşle' (−20) → son adım (−10).
// Çağrı: SON=<0..4> ROOT=<kod> node is4-soru.mjs  (her son adım AYRI açılışta — fatura kronolojisi yüzünden tek açılışta ikinci cari kurulamıyor)
import { boot, day, print } from "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2b-q4/betik/k.mjs";
const h = await boot();
const { api } = h;
const app = h.server.app;
const out = {};
const st = r => `${r.status}${r.status >= 400 ? " " + String(r.data?.code || "") + " " + String(r.data?.error?.message || r.data?.error || "").slice(0, 160) : ""}`;
const hesap = accountId => {
  const b = { 120: 0, 128: 0 }; const rows = [];
  for (const e of app.ledger.build()) for (const l of e.lines || []) {
    if (!["120", "128"].includes(l.account) || (l.party && l.party !== accountId)) continue;
    b[l.account] += (l.debit || 0) - (l.credit || 0);
    if (l.credit > 0) rows.push(`${e.date} A ${l.account} ${(l.credit / 100).toFixed(0)}`);
  }
  return { b120: b[120] / 100, b128: b[128] / 100, alacakSatirlari: rows };
};
const inv = async (a, date, amount) => { const r = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open" } }); if (r.status !== 200) throw new Error("fatura " + st(r)); return r.data?.id; };
const kuyruk = (a, f1, f2) => { const q = h.queue(a); return `${q.doubtful.amount} = ` + q.doubtful.items.map(i => `${i.invoiceId === f1 ? "F1" : i.invoiceId === f2 ? "F2" : i.kind} ${i.amount}`).join(" + "); };
const son = {
  "F2'ye bağlı çek 300": (a, f1, f2) => api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: "S" + a.id.slice(-6), amount: "300", accountId: a.id, issueDate: day(-10), dueDate: day(40), invoiceId: f2 }),
  "F2'ye bağlı nakit 300": (a, f1, f2) => api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "300", date: day(-10), method: "cash", cashForce: true, similarOk: true, invoiceId: f2 }),
  "F2'ye bağlı nakit 100": (a, f1, f2) => api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "100", date: day(-10), method: "cash", cashForce: true, similarOk: true, invoiceId: f2 }),
  "F1'e bağlı nakit 300": (a, f1, f2) => api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "300", date: day(-10), method: "cash", cashForce: true, similarOk: true, invoiceId: f1 }),
  "bağsız nakit 300 (işaretsiz)": (a) => api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "300", date: day(-10), method: "cash", cashForce: true, similarOk: true }),
};
try {
  let n = 0;
  for (const [ad, adim] of Object.entries(son).filter((_, i) => i === Number(process.env.SON || 0))) {
    const a = await h.account("Is4 Soru " + (++n));
    const f1 = await inv(a, day(-60), 1000);
    const sup = st(await api.post(`/api/workspace/accounts/${a.id}/doubtful`, { amount: 1000, date: day(-40), reason: "lawsuit", note: "is4" }));
    const f2 = await inv(a, day(-30), 500);
    const normal = st(await api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "400", date: day(-20), method: "cash", cashForce: true, similarOk: true, doubtfulSkip: true }));
    const once = { ...hesap(a.id), kuyrukSupheli: kuyruk(a, f1, f2) };
    const r = st(await adim(a, f1, f2));
    const sonra = { ...hesap(a.id), kuyrukSupheli: kuyruk(a, f1, f2) };
    out[ad] = { supheli: sup, normalIsle400: normal, once: `120 ${once.b120} · 128 ${once.b128} · kuyruk ${once.kuyrukSupheli}`, yanit: r, sonra: `120 ${sonra.b120} · 128 ${sonra.b128} · kuyruk ${sonra.kuyrukSupheli}`, sonSatir: sonra.alacakSatirlari.slice(once.alacakSatirlari.length) };
  }
  out.mutabakat = (app.integrity.scan().findings || []).map(f => f.code);
} catch (e) { out.HATA = String(e.stack || e).slice(0, 700); }
print(out);
await h.server.close();
