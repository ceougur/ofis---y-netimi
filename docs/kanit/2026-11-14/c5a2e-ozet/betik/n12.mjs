// N12 sondası: silinmiş evrakın Kapatılacak Fatura bağı programın kendi yolunda kalıyor mu; iptal ne dönüyor
import path from "node:path";
const ROOT = process.env.KOD;
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const { loginAdmin, startTestServer } = await import(path.join(ROOT, "test/helpers.mjs"));
const server = await startTestServer({ now: { time: "2026-10-20T12:00:00+03:00", fixed: true } });
try {
  const api = await loginAdmin(server);
  const un = r => (r.data && typeof r.data === "object" && "ok" in r.data ? r.data.data : r.data);
  const acc = un(await api.post("/api/workspace/accounts", { name: "N12 Evrak", type: "customer" }));
  await api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "1000", date: "2026-08-20", note: "Hizmet" });
  const inv = un(await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: "2026-10-15", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 300, vatRate: 0 }], payment: { rest: "open" } }));
  const ch = await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: "N12-1", amount: "100", accountId: acc.id, issueDate: "2026-10-08", dueDate: "2026-12-01", invoiceId: inv.id });
  console.log("evrak", ch.status);
  const c = server.app.store.get("SELECT id FROM cheques WHERE serial_no = 'N12-1'");
  const del = await api.del(`/api/workspace/cheques/${c.id}`);
  console.log("sil", del.status, JSON.stringify(del.data).slice(0, 200));
  console.log("sonra", JSON.stringify(server.app.store.all("SELECT c.deleted_at, ev.kind, ev.invoice_id, ev.date FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id WHERE c.serial_no = 'N12-1'")));
  console.log("kilit", (await api.put("/api/admin/period-lock", { lockedUntil: "2026-10-10" })).status);
  const can = await api.post(`/api/workspace/invoices/${inv.id}/cancel`, {});
  console.log("iptal", can.status, JSON.stringify(can.data).slice(0, 200));
} finally {
  await server.close();
}
