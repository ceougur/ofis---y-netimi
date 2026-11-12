// EX1 kök neden yeniden üretimi: taksitli satış faturasının kartı (ad = cari adı) varken aynı adla Excel kartı.
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.argv[2];
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({ now: { time: "2026-11-23T12:00:00+03:00", fixed: true } });
try {
  const admin = await loginAdmin(server);
  await admin.post("/api/workspace/bank/setup/dismiss", {});
  const acc = (await admin.post("/api/workspace/accounts", { name: "Ahmet Yılmaz", registeredOn: "2026-01-01" })).data;
  const id = (acc.data ?? acc).id;
  const inv = await admin.post("/api/workspace/invoices", { kind: "sale", accountId: id, issueDate: "2026-09-23", lines: [{ name: "Hizmet", qty: 1, unitPrice: 3000, vatRate: 20 }], payment: { rest: "installments", installments: { count: 3, firstDue: "2026-09-30", everyMonths: 1 } } });
  console.log("fatura", inv.status, "kartlar", JSON.stringify(server.app.store.all("SELECT name, invoice_id <> '' AS fromInvoice FROM plans")));
  const r = await admin.post("/api/workspace/plans/import", { matrix: [["Ad Soyad", "Toplam", "Taksit Sayısı", "İlk Vade", "Ödenen", "Kayıt Tarihi"], ["Ahmet Yılmaz", "6000", "6", "15.12.2026", "1500", "23.11.2026"]], headerAt: 0, roles: { 0: "name", 1: "total", 2: "count", 3: "firstDue", 4: "paid", 5: "registered" }, fileName: "EX1.xlsx", linkRecords: false });
  const d = r.data.data ?? r.data;
  console.log("Excel", r.status, "created", d.created, "skipped", JSON.stringify(d.skipped));
} finally {
  await server.app.close();
}
