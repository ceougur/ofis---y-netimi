import { readFileSync } from "node:fs";
const R = "/home/user/ofis---y-netimi";
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const t = readFileSync(process.argv[2], "utf8");
const username = (t.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (t.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const mask = v => String(v).split(password).join("***").split(username).join("<kullanıcı>");
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer({ edocEnabled: true, edocLive: true, testSeriesStart: null, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = server.client(); await c.login("admin", ADMIN_PASSWORD);
const api = { get: async u => unwrap(await c.get(u)), post: async (u, b) => unwrap(await c.post(u, b)), put: async (u, b) => unwrap(await c.put(u, b)) };
const log = (...a) => console.log(mask(a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ")));
const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
log("ayar", (await api.put("/api/workspace/invoices/settings", { seller: { name: "DESTEK OFİS DENEME", taxNo: "3230512384", taxOffice: "Meram", address: "Akbalı Mah.", district: "Karatay", city: "Konya" }, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: "", username, password, senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr" } })).status);
const L = [{ name: "HİZMET SATIŞI", qty: 1, unitPrice: 100, vatRate: 20 }];
// A: gerçek mükellef (4840847211 TEST BILISIM), cari işaretsiz → e-Arşiv Kaydet ve Gönder numara harcamadan durmalı
const a = (await api.post("/api/workspace/accounts", { name: "TEST BILISIM (sorgusuz)", type: "customer", taxNo: "4840847211", taxOffice: "TEST", address: "Test", district: "TEST", city: "TEST", eInvoice: false })).data;
let n0 = count(); let r = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, lines: L, payment: { rest: "open" }, eSend: "now" });
log("A mükellefe e-Arşiv:", r.status, r.data?.code, "belge sayısı", n0, "→", count(), "| cari işareti", server.app.store.get("SELECT e_invoice AS f, e_alias AS al FROM accounts WHERE id=?", a.id));
// B: TESTER şahıs, elle işaretli + PK yok → buyer-alias, numara yok
const tdat = { name: "TESTER", type: "customer", partyKind: "person", firstName: "Testler", familyName: "Testlerle", taxNo: "12345678950", taxOffice: "TESTER", address: "test sok. 36", district: "Kemalpaşa", city: "Samsun", email: "tester@test.com" };
const b = (await api.post("/api/workspace/accounts", { ...tdat, eInvoice: true, eAlias: "" })).data;
n0 = count(); r = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: b.id, lines: L, payment: { rest: "open" }, eSend: "now" });
log("B TESTER işaretli PK'sız:", r.status, r.data?.code, "belge sayısı", n0, "→", count());
// C: Mükellef Sorgula (gerçek) → mükellef değil → işaret kalkar → e-Arşiv gönder
const q = await api.post("/api/workspace/invoices/check-user", { taxNo: "12345678950" }); log("C sorgu", q.status, { registered: q.data?.registered });
await api.put(`/api/workspace/accounts/${b.id}`, { ...tdat, eInvoice: false, eAlias: "" });
r = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: b.id, lines: L, payment: { cash: [{ amount: 120, method: "cash" }], rest: "open" }, eSend: "now" });
log("C e-Arşiv:", r.status, r.data?.number, r.data?.profile, "autoSend", r.data?.autoSend?.ok, String(r.data?.autoSend?.message || "").slice(0, 120));
const xml = await api.get(`/api/workspace/invoices/${r.data.id}/ubl.xml`); const x = typeof xml.data === "string" ? xml.data : xml.text;
log("C ödeme şekli kodları:", [...String(x).matchAll(/<cbc:PaymentMeansCode>([^<]*)</g)].map(m => m[1]));
log("SONUÇ_ID", r.data.id, r.data.number, r.data.uuid);
await server.close();
