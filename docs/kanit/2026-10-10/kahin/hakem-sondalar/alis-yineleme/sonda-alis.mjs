// Hakem sondası: alış faturası aynı istek kimliğiyle (1) aynı gövde, (2) yalnız "number" farklı gövde.
// Kullanım: node sonda-alis.mjs <depo kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2]);
const { startTestServer, ADMIN_PASSWORD } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer();
const out = {};
const D = r => r.data?.data ?? r.data;
const E = r => r.data?.error?.message || r.data?.error || r.data?.message;
const C = r => r.data?.error?.code || r.data?.code;
try {
  const c = server.client();
  out.login = (await c.login("admin", ADMIN_PASSWORD)).status;
  const acc = await c.post("/api/workspace/accounts", { name: "Tedarikçi 1", type: "supplier" });
  const item = await c.post("/api/workspace/stock", { name: "Ürün 1", unit: "Adet", kind: "product" });
  out.cari = acc.status; out.urun = item.status;
  const body = number => ({ kind: "purchase", accountId: D(acc).id, issueDate: new Date().toISOString().slice(0, 10), pricesIncludeVat: false,
    lines: [{ itemId: D(item).id, qty: 10, unitPrice: "100", vatRate: 20 }], number, payment: { cash: [], rest: "open" } });
  const H = { "x-hof-request": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" };
  const r1 = await c.post("/api/workspace/invoices", body("F1"), H);
  out.ilk = { durum: r1.status, id: D(r1)?.id, number: D(r1)?.number, replayed: D(r1)?.replayed, hata: E(r1) };
  const r2 = await c.post("/api/workspace/invoices", body("F1"), H);
  out.ayniGovde = { durum: r2.status, ayniBelge: D(r2)?.id === D(r1)?.id, replayed: D(r2)?.replayed, hata: E(r2) };
  const r3 = await c.post("/api/workspace/invoices", body("F2"), H);
  out.yalnizNumaraFarkli = { durum: r3.status, kod: C(r3), ileti: E(r3) };
  const list = await c.get("/api/workspace/invoices?kind=purchase");
  out.kayitliAlisFaturasi = (D(list).invoices || []).filter(r => r.status === "issued").map(r => [r.number, r.payable ?? r.total]);
  const st = await c.get("/api/workspace/stock");
  out.stok = (D(st).items || []).map(r => [r.name, r.qty]);
  const ac = await c.get(`/api/workspace/accounts`);
  out.cariBakiye = JSON.stringify((D(ac).accounts || D(ac).rows || D(ac).items || []).map(r => [r.name, r.balance])).slice(0, 200);
} finally {
  await server.close();
}
console.log(JSON.stringify(out, null, 1));
