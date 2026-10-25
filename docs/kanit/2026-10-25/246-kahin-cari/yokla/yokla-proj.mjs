// Kara kutu yoklaması (yalnız ORTAM: Nakit Akış Projeksiyonu satır biçimi / alan adları). Kural TÜRETİLMEZ.
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
const KOK = process.argv[2];
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(KOK, "test", "helpers.mjs")).href);
const veri = mkdtempSync(path.join(tmpdir(), "yokla-proj-246-"));
const server = await startTestServer({ dataDir: path.join(veri, "data"), now: "2026-06-15T09:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, legacyCasePayments: false, legacyTableTransfer: false, legacyTableDues: false });
const c = server.client();
const un = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
try {
  await c.login("admin", ADMIN_PASSWORD);
  const urun = un(await c.post("/api/workspace/stock", { kind: "service", code: "YK-H", name: "Yoklama Hizmeti", unit: "Adet", salePrice: "100" }))?.id;
  const cari = un(await c.post("/api/workspace/accounts", { name: "Yoklama Müşteri", type: "musteri", openingSide: "auto", registeredOn: "2026-05-01" }))?.id;
  await c.post("/api/workspace/invoices", { kind: "sale", scenario: "service_sale", lines: [{ itemId: urun, qty: 1, unitPrice: "500,00", vatRate: 0 }], accountId: cari, issueDate: "2026-06-10", payment: { rest: "open" } });
  await c.post(`/api/workspace/accounts/${cari}/entries`, { kind: "debt", amount: "300,00", date: "2026-06-01", dueDate: "2026-06-20", note: "b1" });
  const r = await c.get("/api/workspace/overview/nakit-akisi?from=2026-06-15&to=2026-07-15&overdue=1");
  const d = un(r);
  console.log("status", r.status, "üst anahtarlar", Object.keys(d || {}));
  for (const k of ["rows", "overdue"]) {
    const a = Array.isArray(d?.[k]) ? d[k] : [];
    console.log(k, "satır sayısı", a.length);
    for (const x of a.slice(0, 4)) console.log(" ", JSON.stringify(Object.fromEntries(Object.entries(x).map(([kk, v]) => [kk, v === null || typeof v !== "object" ? typeof v : Array.isArray(v) ? "dizi" : Object.keys(v)]))));
    for (const x of a.slice(0, 4)) console.log("  örnek", JSON.stringify(x).slice(0, 400));
  }
} finally {
  await server.app.close();
  rmSync(veri, { recursive: true, force: true });
}
