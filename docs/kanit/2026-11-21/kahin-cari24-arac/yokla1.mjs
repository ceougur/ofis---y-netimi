// Kara kutu yoklaması (bakım 24, yalnız eşleme): Kartı Kapat uç adı / gövdesi. Programın kodu OKUNMAZ; yanıt kodları ve iletileri okunur.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.argv[2];
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const veri = mkdtempSync(path.join(tmpdir(), "kc24-yokla-"));
const server = await startTestServer({ dataDir: path.join(veri, "data"), now: "2026-10-08T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, legacyCasePayments: false, legacyTableTransfer: false, legacyTableDues: false });
const c = server.client();
const u0 = server.client();
const ek = ["close","kapat","finish","end","complete","archive","reopen","open","settle","done","state","status","cancel","stop","terminate","writeoff","write-off","lifecycle","items","entries","reschedule","restructure","edit","update"];
for (const e of ek) for (const m of ["POST","PUT","PATCH"]) { const r = await u0[m.toLowerCase()](`/api/workspace/plans/x1/${e}`, {}); if (r.status !== 404) console.log("VAR", m, e, r.status); }
if ((await c.login("admin", ADMIN_PASSWORD)).status !== 200) throw new Error("giris");
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
export const api = async (m, u, b) => { const r = m === "GET" ? await c.get(u) : m === "DELETE" ? await c.del(u) : await c[m.toLowerCase()](u, b); return { status: r.status, data: unwrap(r) }; };
const kisa = (x, n = 1500) => JSON.stringify(x).slice(0, n);
const acc = await api("POST", "/api/workspace/accounts", { name: "Deneme Kişi", type: "customer", phone: "", registeredOn: "2026-09-01" });
const aid = acc.data?.id; console.log("cari", acc.status, aid);
const st = await api("POST", "/api/workspace/stock", { name: "Hizmet", code: "H1", kind: "service", unit: "Adet", salePrice: "1" });
console.log("urun", st.status, kisa(st.data, 300));
const urun = st.data?.id ?? st.data?.item?.id;
const inv = await api("POST", "/api/workspace/invoices", { kind: "sale", scenario: "service_sale", lines: [{ itemId: urun, qty: 1, unitPrice: "900,00", vatRate: 0 }], accountId: aid, issueDate: "2026-09-01", payment: { rest: "open" } });
console.log("fatura", inv.status, inv.data?.id, kisa(inv.data, 300));
const pl = await api("POST", "/api/workspace/plans", { name: "Deneme Kişi", registeredOn: "2026-09-02", total: "900,00", accountId: aid, mode: "auto", count: "3", firstDue: "2026-10-05", coversBalance: true });
const pid = pl.data?.id ?? pl.data?.plan?.id;
console.log("kart", pl.status, pid);
console.log("GET kart", kisa((await api("GET", `/api/workspace/plans/${pid}`)).data, 3000));
const denemeler = (process.argv[3] ? JSON.parse(process.argv[3]) : [
  ["POST", "/close", {}], ["POST", "/close", { mode: "keep" }], ["POST", "/actions", { action: "close" }], ["PATCH", "", { status: "closed" }], ["PUT", "", { status: "closed" }], ["POST", "/status", { status: "closed" }],
]);
for (const [m, u, b] of denemeler) {
  const r = await api(m, `/api/workspace/plans/${pid}${u}`, b);
  console.log(m, `:id${u}`, JSON.stringify(b), "->", r.status, kisa(r.data, 700));
}
console.log("GET kart sonra", kisa((await api("GET", `/api/workspace/plans/${pid}`)).data, 3000));
await server.close?.();
process.exit(0);
