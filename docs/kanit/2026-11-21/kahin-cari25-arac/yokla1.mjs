// Kara kutu yoklaması 1 (bakım 25, yalnız EŞLEME — kural kaynağı değil): kesilmiş faturanın Düzenle ucu (girdi §4: POST /invoices/:id/edit) — fatura ayrıntısının alanları,
// gövde biçimi, yanıt kodu + gövde (ders 3). Programın kodu OKUNMAZ.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.argv[2];
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const veri = mkdtempSync(path.join(tmpdir(), "kc25-yokla1-"));
const server = await startTestServer({ dataDir: path.join(veri, "data"), now: "2026-10-08T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, legacyCasePayments: false, legacyTableTransfer: false, legacyTableDues: false });
const c = server.client();
if ((await c.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giris");
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = async (m, u, b) => { const r = m === "GET" ? await c.get(u) : m === "DELETE" ? await c.del(u) : await c[m.toLowerCase()](u, b); return { status: r.status, data: unwrap(r) }; };
const kisa = (x, n = 2500) => JSON.stringify(x).slice(0, n);
const aid = (await api("POST", "/api/workspace/accounts", { name: "Deneme Kişi", type: "customer", phone: "", registeredOn: "2026-09-01" })).data?.id;
const urun = (await api("POST", "/api/workspace/stock", { kind: "service", code: "KAHIN-HZM", name: "Kâhin Hizmeti", unit: "Adet", salePrice: "100" })).data?.id;
const inv = await api("POST", "/api/workspace/invoices", { kind: "sale", scenario: "service_sale", lines: [{ itemId: urun, qty: 3, unitPrice: "300,00", vatRate: 0 }], accountId: aid, issueDate: "2026-09-01", payment: { rest: "open" } });
const fid = inv.data?.id;
const f = (await api("GET", `/api/workspace/invoices/${fid}`)).data || {};
console.log("ayrıntı anahtarları", Object.keys(f).join(","));
console.log("ayrıntı (kısa)", kisa({ scenario: f.scenario, accountId: f.accountId, issueDate: f.issueDate, dueDate: f.dueDate, status: f.status, total: f.total, payment: f.payment, lines: f.lines }, 3000));
// taslak ucu (eski eşleme) — girdi §4: kesilmiş belgede 409 invoice-not-draft
const put = await api("PUT", `/api/workspace/invoices/${fid}`, { ...f, lines: (f.lines || []).map(l => ({ ...l, qty: 2 })) });
console.log("PUT", put.status, kisa(put.data, 400));
const e0 = await api("POST", `/api/workspace/invoices/${fid}/edit`, {});
console.log("edit {}", e0.status, kisa(e0.data, 600));
const lines = (f.lines || []).map(l => ({ ...l, qty: 2 }));
const e1 = await api("POST", `/api/workspace/invoices/${fid}/edit`, { scenario: f.scenario, accountId: f.accountId, issueDate: f.issueDate, lines, payment: { cash: [], cheques: [], endorse: [], rest: "open", dueDate: f.dueDate || "", installments: null }, force: false });
console.log("edit qty 2", e1.status, kisa(e1.data, 1500));
const f2 = (await api("GET", `/api/workspace/invoices/${fid}`)).data || {};
console.log("sonra", kisa({ id: f2.id, status: f2.status, total: f2.total, open: f2.open, ownOpen: f2.ownOpen, lines: f2.lines?.map(l => ({ qty: l.qty, unitPrice: l.unitPrice, total: l.total })) }, 800));
const ac = (await api("GET", `/api/workspace/accounts/${aid}`)).data || {};
console.log("cari", kisa({ totals: ac.totals, entries: (ac.entries || []).map(e => ({ kind: e.kind, amount: e.amount, date: e.date, invoiceId: e.invoiceId, note: e.note })) }, 1500));
const lst = (await api("GET", `/api/workspace/invoices?limit=50`)).data;
console.log("liste", kisa((lst?.invoices || lst || []).map?.(x => ({ id: x.id, status: x.status, total: x.total, kind: x.kind })), 800));
// taslak fatura: yeni uç 409 invoice-not-issued beklenir (girdi §4)
const tas = await api("POST", "/api/workspace/invoices", { kind: "sale", scenario: "service_sale", lines: [{ itemId: urun, qty: 1, unitPrice: "100,00", vatRate: 0 }], accountId: aid, issueDate: "2026-09-01", payment: { rest: "open" }, status: "draft" });
const e2 = await api("POST", `/api/workspace/invoices/${tas.data?.id}/edit`, { scenario: "service_sale", accountId: aid, issueDate: "2026-09-01", lines: [{ itemId: urun, qty: 2, unitPrice: "100,00", vatRate: 0 }], payment: { rest: "open" } });
console.log("taslak edit", e2.status, kisa(e2.data, 400));
await server.close?.();
process.exit(0);
