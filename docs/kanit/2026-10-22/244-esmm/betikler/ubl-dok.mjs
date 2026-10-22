// Örnek e-SMM XML'ini dosyaya yazar (yapı karşılaştırması için). Kullanım: node docs/kanit/2026-10-22/244-esmm/betikler/ubl-dok.mjs <çıktı.xml>
import { writeFileSync } from "node:fs";
import { ADMIN_PASSWORD, startTestServer } from "../../../../../test/helpers.mjs";
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer({ edocEnabled: true, esmmEnabled: true });
const c = server.client(); await c.login("admin", ADMIN_PASSWORD);
const api = { get: async u => unwrap(await c.get(u)), post: async (u, b) => unwrap(await c.post(u, b)), put: async (u, b) => unwrap(await c.put(u, b)) };
await api.put("/api/workspace/invoices/settings", { seller: { name: "Av. Deneme Ali", partyKind: "person", firstName: "Ali", familyName: "Deneme", taxNo: "10000000146", taxOffice: "Kadıköy", address: "Moda Cd. 1", district: "Kadıköy", city: "İstanbul" }, efatura: true, earsiv: true, esmm: true });
const acc = await api.post("/api/workspace/accounts", { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "muhasebe@muvekkil.com" });
const doc = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: acc.data.id, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } });
const x = await api.get(`/api/workspace/invoices/${doc.data.id}/ubl.xml`);
writeFileSync(process.argv[2], typeof x.data === "string" ? x.data : x.text);
await server.close();
