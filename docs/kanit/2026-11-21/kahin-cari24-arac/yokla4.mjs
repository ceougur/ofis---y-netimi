// Kara kutu yoklaması 4 (bakım 24, yalnız EŞLEME — kural kaynağı değil): taksitli faturanın ("Bu Satışı Taksitlendir") KENDİ kartı plan listesinde hangi alanla faturaya bağlı, Kartı Kapat
// o karta uygulanıyor mu. Programın kodu OKUNMAZ.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.argv[2];
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const veri = mkdtempSync(path.join(tmpdir(), "kc24-yokla4-"));
const server = await startTestServer({ dataDir: path.join(veri, "data"), now: "2026-10-08T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, legacyCasePayments: false, legacyTableTransfer: false, legacyTableDues: false });
const c = server.client();
if ((await c.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giris");
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = async (m, u, b) => { const r = m === "GET" ? await c.get(u) : m === "DELETE" ? await c.del(u) : await c[m.toLowerCase()](u, b); return { status: r.status, data: unwrap(r) }; };
const kisa = (x, n = 1500) => JSON.stringify(x).slice(0, n);
const aid = (await api("POST", "/api/workspace/accounts", { name: "Deneme Kişi", type: "customer", phone: "", registeredOn: "2026-09-01" })).data?.id;
const urun = (await api("POST", "/api/workspace/stock", { kind: "service", code: "KAHIN-HZM", name: "Kâhin Hizmeti", unit: "Adet", salePrice: "100" })).data?.id;
const inv = await api("POST", "/api/workspace/invoices", { kind: "sale", scenario: "service_sale", lines: [{ itemId: urun, qty: 3, unitPrice: "300,00", vatRate: 0 }], accountId: aid, issueDate: "2026-09-01",
  payment: { rest: "installments", installments: { count: 3, firstDue: "2026-10-05", everyMonths: 1 } } });
const fid = inv.data?.id;
console.log("fatura", inv.status, fid, "anahtarlar", Object.keys(inv.data || {}).filter(k => /plan|install|taksit/i.test(k)).join(","));
for (const u of ["/api/workspace/plans?status=all", "/api/workspace/plans"]) {
  const l = await api("GET", u);
  const pl = l.data?.plans || [];
  console.log(u, l.status, "kart sayısı", pl.length, pl.map(p => kisa({ id: p.id, invoiceId: p.invoiceId, invoiceNumber: p.invoiceNumber, accountId: p.accountId === aid, status: p.status, total: p.total }, 300)).join(" | "));
}
const f = (await api("GET", `/api/workspace/invoices/${fid}`)).data || {};
console.log("fatura kartı plan alanları", kisa(Object.fromEntries(Object.entries(f).filter(([k]) => /plan|install|taksit/i.test(k))), 800));
await server.close?.();
process.exit(0);
