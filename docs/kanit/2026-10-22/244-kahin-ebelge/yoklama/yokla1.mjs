// Kara kutu yoklaması (kâhin; kod okunmaz): istek gönder, yanıtı yaz. Kullanım: node yokla1.mjs <depo kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";
const KOK = process.argv[2];
const imp = p => import(pathToFileURL(path.join(KOK, p)).href);
const { BUYER_VKN, OUR_VKN, startMockEdm } = await imp("test/einvoice-mock.mjs");
const { ADMIN_PASSWORD, startTestServer } = await imp("test/helpers.mjs");
const BUGUN = "2026-06-17";
const edm = await startMockEdm();
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz: ${url}`);
  return globalThis.fetch(input, init);
};
const server = await startTestServer({ edocEnabled: true, esmmEnabled: true, fetchImpl, now: { time: `${BUGUN}T10:00:00`, fixed: true }, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const c = server.client();
await c.login("admin", ADMIN_PASSWORD);
const api = { get: async u => unwrap(await c.get(u)), post: async (u, b = {}) => unwrap(await c.post(u, b)), put: async (u, b = {}) => unwrap(await c.put(u, b)) };
const yaz = (ad, x) => console.log(`== ${ad}: ${JSON.stringify(x).slice(0, 1500)}`);
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
try {
  yaz("ayar", await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
  const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ")[1], taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", similarOk: true });
  const k1 = await api.post("/api/workspace/accounts", person("Ayşe Kaya", "10000000146"));
  const firm = await api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr", similarOk: true });
  const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
  // 1) e-SMM makbuzu: Kes, Sonra Gönder ve Kes ve Gönder
  const s1 = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: k1.data.id, lines: LINES, payment: { rest: "open" }, issueDate: "2026-06-15", eSend: "later" });
  yaz("smm sonra", s1);
  const s2 = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: k1.data.id, lines: LINES, payment: { rest: "open" }, issueDate: "2026-06-17", eSend: "now" });
  yaz("smm simdi (eski bekleyen var)", s2);
  const s3 = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: firm.data.id, lines: LINES, payment: { rest: "open" }, issueDate: "2026-06-16", eSend: "later" });
  yaz("smm firma sonra", s3);
  const pend = await api.get("/api/workspace/invoices?tab=pending&limit=50");
  yaz("pending", pend.data.invoices.map(x => ({ id: x.id, number: x.number, profile: x.profile, eStatus: x.eStatus, status: x.status, issueDate: x.issueDate, kind: x.kind, scenario: x.scenario, keys: Object.keys(x).join(",") })));
  // 2) K33: Seçilenleri Gönder — yalnız en yeniyi seç
  const only1 = await api.post("/api/workspace/invoices/send-pending", { only: [s2.data.id] });
  yaz("only s2", only1);
  const chk = await api.post("/api/workspace/invoices/send-pending", { only: [s2.data.id], check: true });
  yaz("only s2 check", chk);
  const only2 = await api.post("/api/workspace/invoices/send-pending", { only: [s1.data.id, s2.data.id, s3.data.id] });
  yaz("only hepsi", only2);
  yaz("smm mock sent", edm.state.smm.sent.map(x => ({ id: x.id, uuid: x.uuid })));
  yaz("smm mock calls", edm.state.smm.calls.map(x => x.op));
  yaz("efatura mock calls", edm.state.calls.map(x => x.op));
  const kart = await api.get(`/api/workspace/invoices/${s1.data.id}`);
  yaz("kart smm", Object.fromEntries(Object.entries(kart.data).filter(([k]) => /^e|number|profile|status|issue|history|ettn|sent/i.test(k))));
  // 3) Listeden Sil (Müşteri Fişi) e-SMM
  const s4 = await api.post("/api/workspace/invoices", { scenario: "smm", accountId: k1.data.id, lines: LINES, payment: { rest: "open" }, issueDate: "2026-06-17", eSend: "later" });
  yaz("smm s4 withdraw", await api.post(`/api/workspace/invoices/${s4.data.id}/withdraw`, {}));
  const all = await api.get("/api/workspace/invoices?tab=all&limit=50");
  yaz("all", all.data.invoices.map(x => ({ number: x.number, profile: x.profile, eStatus: x.eStatus, status: x.status, issueDate: x.issueDate })));
  // 4) İptal: gönderilmiş e-SMM, gün 9
  server.clock.advance({ days: 9 });
  yaz("smm iptal gün 9", await api.post(`/api/workspace/invoices/${s1.data.id}/cancel`, { reason: "x" }));
  yaz("smm iptal gün 9 localOnly", await api.post(`/api/workspace/invoices/${s1.data.id}/cancel`, { reason: "x", localOnly: true, confirmLocal: true }));
  server.clock.advance({ days: -1 });
  yaz("smm iptal gün 8", await api.post(`/api/workspace/invoices/${s1.data.id}/cancel`, { reason: "x" }));
  yaz("smm mock cancelled", edm.state.smm.cancelled);
  // 5) calc (ön hesap) yanıt biçimi
  yaz("calc", await api.post("/api/workspace/invoices/calc", { kind: "sale", scenario: "service_sale", accountId: k1.data.id, issueDate: "2026-06-10", issueTime: "10:00", lines: LINES }));
} catch (e) {
  console.log("HATA", e.stack);
} finally {
  await server.close().catch(() => {});
  await edm.close().catch(() => {});
}
