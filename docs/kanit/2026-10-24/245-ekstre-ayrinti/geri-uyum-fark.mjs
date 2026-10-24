// Geri uyum fark testi (6d): aynı veri, ESKİ (d2cef7c) ve YENİ kod; seçenek kapalı Cari Ekstre (ekran JSON + PDF + Excel) ve cari kartı ekstre.pdf aynı mı.
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = path.resolve(process.argv[2]);
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const dir = mkdtempSync(path.join(tmpdir(), "fark-6d-"));
const server = await startTestServer({ dataDir: path.join(dir, "data"), now: "2026-11-27T12:00:00+03:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, startLicenseTimers: false });
const api = server.client();
await api.login("admin", ADMIN_PASSWORD);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (l, p) => { const r = await p; if (r.status !== 200) throw new Error(`${l} ${r.status} ${JSON.stringify(r.data)}`); return unwrap(r); };
await api.post("/api/workspace/bank/setup/dismiss", {});
const a = await must("cari", api.post("/api/workspace/accounts", { name: "Fark Cari", type: "customer", registeredOn: "2026-01-01" }));
await must("açılış", api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "debt", amount: "750", date: "2026-02-01", note: "Açılış" }));
await must("f1", api.post("/api/workspace/invoices", { kind: "sale", scenario: "service_sale", accountId: a.id, issueDate: "2026-11-10", discountRate: 10, lines: [{ name: "A", qty: 3, unitPrice: 1250.5, discountRate: 5, vatRate: 20 }, { name: "B", qty: 1, unitPrice: 999.99, vatRate: 10, withholdingCode: "624" }], payment: { cash: [{ amount: 100, method: "cash" }], rest: "open" } }));
await must("f2", api.post("/api/workspace/invoices", { kind: "sale", scenario: "service_sale", accountId: a.id, issueDate: "2026-11-12", pricesIncludeVat: true, lines: [{ name: "C", qty: 2, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }));
await must("tah", api.post(`/api/workspace/accounts/${a.id}/entries`, { kind: "in", amount: "1000", method: "cash", date: "2026-11-20", note: "Elden" }));
await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 300, issueDate: "2026-11-21", dueDate: "2026-12-20", serialNo: "F-1", accountId: a.id }));
const out = {};
const sha = buf => createHash("sha256").update(buf).digest("hex");
for (const q of ["from=2026-01-01&to=2026-12-31", "from=2026-11-01&to=2026-11-30", "preset=all&from=1976-01-01&to=2026-11-27"]) {
  const data = await must("ekstre", api.get(`/api/workspace/report-center/cari-ekstre?account=${a.id}&${q}`));
  delete data.query.account;
  out[q] = { json: data, pdf: sha((await api.raw("GET", `/api/workspace/report-center/cari-ekstre/pdf?account=${a.id}&${q}`)).buffer), xlsx: sha((await api.raw("GET", `/api/workspace/report-center/cari-ekstre/xlsx?account=${a.id}&${q}`)).buffer) };
}
out.kart = sha((await api.raw("GET", `/api/workspace/accounts/${a.id}/ekstre.pdf`)).buffer);
await server.app.close();
rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify(out, null, 1));
