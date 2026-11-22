// Kara kutu yoklaması 2 (bakım 25, yalnız EŞLEME — kural kaynağı değil): taksitli ("Bu Satışı Taksitlendir") faturanın ayrıntısındaki ödeme bölümü ve Düzenle gövdesi; yanıt kodu + gövde (ders 3).
// Bulgu (yoklama 1): ayrıntının `payment` alanında biçim `mode` ("open"), `rest` ise TUTAR (900) — Düzenle gövdesinde `rest` biçimdir ("open" / "installments"). Programın kodu OKUNMAZ.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.argv[2];
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const veri = mkdtempSync(path.join(tmpdir(), "kc25-yokla2-"));
const server = await startTestServer({ dataDir: path.join(veri, "data"), now: "2026-11-20T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, legacyCasePayments: false, legacyTableTransfer: false, legacyTableDues: false });
const c = server.client();
if ((await c.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giris");
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = async (m, u, b) => { const r = m === "GET" ? await c.get(u) : m === "DELETE" ? await c.del(u) : await c[m.toLowerCase()](u, b); return { status: r.status, data: unwrap(r) }; };
const kisa = (x, n = 1500) => JSON.stringify(x).slice(0, n);
const aid = (await api("POST", "/api/workspace/accounts", { name: "Deneme Kişi", type: "customer", phone: "", registeredOn: "2026-09-01" })).data?.id;
const urun = (await api("POST", "/api/workspace/stock", { kind: "service", code: "KAHIN-HZM", name: "Kâhin Hizmeti", unit: "Adet", salePrice: "100" })).data?.id;
const inv = await api("POST", "/api/workspace/invoices", { kind: "sale", scenario: "service_sale", lines: [{ itemId: urun, qty: 1, unitPrice: "300,00", vatRate: 0 }], accountId: aid, issueDate: "2026-09-01",
  payment: { rest: "installments", installments: { count: 3, firstDue: "2026-10-05", everyMonths: 1 } } });
const fid = inv.data?.id;
const f = (await api("GET", `/api/workspace/invoices/${fid}`)).data || {};
console.log("taksitli ayrıntı payment", kisa(f.payment), "planId", f.planId, "dueDate", f.dueDate);
const p0 = f.payment || {};
const govde = { scenario: f.scenario, accountId: f.accountId, issueDate: f.issueDate, lines: (f.lines || []).map(l => ({ ...l, qty: 3 })),
  payment: { cash: p0.cash || [], cheques: p0.cheques || [], endorse: p0.endorse || [], rest: p0.mode, dueDate: f.dueDate || "", installments: p0.installments ?? null }, force: false };
const e1 = await api("POST", `/api/workspace/invoices/${fid}/edit`, govde);
console.log("edit (mode, installments ayrıntıdan)", e1.status, kisa(e1.status === 200 ? { open: e1.data?.open, payableTotal: e1.data?.payableTotal, planId: e1.data?.planId } : e1.data, 600));
const f2 = (await api("GET", `/api/workspace/invoices/${fid}`)).data || {};
const pl = (await api("GET", "/api/workspace/plans?status=all")).data?.plans || [];
console.log("sonra", kisa({ open: f2.open, ownOpen: f2.ownOpen, inPlan: f2.inPlan, status: f2.status, payment: f2.payment }), "kartlar", kisa(pl.map(p => ({ total: p.total, remaining: p.remaining, totals: p.totals, status: p.status }))));
await server.close?.();
process.exit(0);
