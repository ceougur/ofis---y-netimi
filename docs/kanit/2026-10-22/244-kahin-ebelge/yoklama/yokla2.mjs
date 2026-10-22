// Kara kutu yoklaması 2 (kâhin; kod okunmaz): belirsiz gönderim, belirsizde iptal / yalnız programda iptal, iletimden 8 gün, K33 ayrıntıları, alıcı alanları.
import path from "node:path";
import { pathToFileURL } from "node:url";
const KOK = process.argv[2];
const imp = p => import(pathToFileURL(path.join(KOK, p)).href);
const { BUYER_VKN, OUR_VKN, startMockEdm } = await imp("test/einvoice-mock.mjs");
const { ADMIN_PASSWORD, startTestServer } = await imp("test/helpers.mjs");
const BUGUN = "2026-06-17";
const edm = await startMockEdm();
const ariza = []; // { op, tur: "once" | "sonra" }
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz: ${url}`);
  const body = String(init?.body || "");
  const i = ariza.findIndex(a => body.includes(`${a.op}Request`));
  if (i >= 0) {
    const a = ariza.splice(i, 1)[0];
    if (a.tur === "once") throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
    await globalThis.fetch(input, init);
    throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }) });
  }
  return globalThis.fetch(input, init);
};
const server = await startTestServer({ edocEnabled: true, esmmEnabled: true, fetchImpl, now: { time: `${BUGUN}T10:00:00`, fixed: true }, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const c = server.client();
await c.login("admin", ADMIN_PASSWORD);
const api = { get: async u => unwrap(await c.get(u)), post: async (u, b = {}) => unwrap(await c.post(u, b)), put: async (u, b = {}) => unwrap(await c.put(u, b)) };
const yaz = (ad, x) => console.log(`== ${ad}: ${JSON.stringify(x).slice(0, 900)}`);
const kisa = r => ({ status: r.status, code: r.data?.code, error: r.data?.error, number: r.data?.number, eStatus: r.data?.eStatus, status2: r.data?.status, extra: r.data && r.status !== 200 ? Object.fromEntries(Object.entries(r.data).filter(([k]) => !["ok", "error", "code"].includes(k))) : undefined });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const kartE = async id => {
  const k = await api.get(`/api/workspace/invoices/${id}`);
  return Object.fromEntries(Object.entries(k.data).filter(([key]) => /^e[A-Z]|number|status$|ettn/.test(key)));
};
try {
  await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
  const person = (name, taxNo, extra = {}) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ")[1], taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir", similarOk: true, ...extra });
  const k1 = (await api.post("/api/workspace/accounts", person("Ayşe Kaya", "10000000146"))).data.id;
  const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
  const kes = (accountId, issueDate, eSend, scenario = "service_sale", lines = LINES) => api.post("/api/workspace/invoices", { scenario, accountId, lines, payment: { rest: "open" }, issueDate, eSend });
  // 1) e-Arşiv: yanıt koptu (EDM aldı) → belirsiz
  ariza.push({ op: "SendInvoice", tur: "sonra" });
  const a1 = await kes(k1, "2026-06-12", "now");
  yaz("earsiv kopma sonra kayit", kisa(a1));
  yaz("earsiv kopma sonra kart", await kartE(a1.data.id));
  const lst = await api.get("/api/workspace/invoices?tab=pending&limit=50");
  yaz("pending", lst.data.invoices.map(x => ({ number: x.number, eStatus: x.eStatus, eBlocked: x.eBlocked })));
  // 2) e-Arşiv: bağlantı kurulamadı (EDM almadı)
  ariza.push({ op: "SendInvoice", tur: "once" });
  const a2 = await kes(k1, "2026-06-17", "now");
  yaz("earsiv kopma once kayit", kisa(a2));
  yaz("earsiv kopma once kart", await kartE(a2.data.id));
  // 3) e-SMM: yanıt koptu
  edm.state.smm.cutAfter.add("SendSMM");
  const s1 = await kes(k1, "2026-06-17", "now", "smm");
  yaz("esmm kopma sonra kayit", kisa(s1));
  yaz("esmm kart", await kartE(s1.data.id));
  // 4) Belirsizde iptal (gün 0): normal ve yalnız programda
  yaz("earsiv belirsiz iptal normal g0", kisa(await api.post(`/api/workspace/invoices/${a1.data.id}/cancel`, { reason: "x" })));
  // 5) gün +9: belirsizde yalnız programda iptal → EDM'de var (a1)
  server.clock.advance({ days: 9 });
  yaz("earsiv belirsiz(EDM var) localOnly g9", kisa(await api.post(`/api/workspace/invoices/${a1.data.id}/cancel`, { reason: "x", localOnly: true, confirmLocal: true })));
  yaz("esmm belirsiz(EDM var) localOnly g9", kisa(await api.post(`/api/workspace/invoices/${s1.data.id}/cancel`, { reason: "x", localOnly: true, confirmLocal: true })));
  yaz("a2 kart g9", await kartE(a2.data.id));
  yaz("earsiv a2 iptal normal g9", kisa(await api.post(`/api/workspace/invoices/${a2.data.id}/cancel`, { reason: "x" })));
  yaz("edm iptal", edm.state.cancelled);
  // 6) geriye tarihli kesilip bugün gönderilen e-Arşiv: kesimden 13 gün, iletimden 8 gün
  const a3 = await kes(k1, "2026-06-21", "now");
  yaz("a3", kisa(a3));
  server.clock.advance({ days: 8 });
  yaz("a3 iptal iletim+8 (kesim+13)", kisa(await api.post(`/api/workspace/invoices/${a3.data.id}/cancel`, { reason: "x" })));
  // 7) K33 ayrıntıları: seçimde Gönderilecekler'de olmayan (iptal) belge
  const b1 = await kes(k1, "2026-07-04", "later");
  const b2 = await kes(k1, "2026-07-04", "later");
  await api.post(`/api/workspace/invoices/${b2.data.id}/cancel`, { reason: "x" });
  yaz("only [b1, iptal b2]", kisa(await api.post("/api/workspace/invoices/send-pending", { only: [b1.data.id, b2.data.id] })));
  yaz("only [] ", kisa(await api.post("/api/workspace/invoices/send-pending", { only: [] })));
  // 8) Alıcı alanları
  const ilsiz = await api.post("/api/workspace/accounts", { name: "İlsiz Kişi", type: "customer", partyKind: "person", firstName: "İlsiz", familyName: "Kişi", taxNo: "12345678950", address: "Bir Sk. 1", similarOk: true });
  yaz("ilsiz cari", kisa(ilsiz));
  if (ilsiz.data?.id) {
    yaz("ilsiz kes sonra", kisa(await kes(ilsiz.data.id, "2026-07-04", "later")));
    yaz("ilsiz kes simdi", kisa(await kes(ilsiz.data.id, "2026-07-04", "now")));
    yaz("ilsiz calc", (await api.post("/api/workspace/invoices/calc", { kind: "sale", scenario: "service_sale", accountId: ilsiz.data.id, issueDate: "2026-07-04", issueTime: "10:00", lines: LINES })).data?.partyProblems);
  }
  const vdsiz = await api.post("/api/workspace/accounts", { name: "Vdsiz Ticaret A.Ş.", type: "customer", partyKind: "company", taxNo: BUYER_VKN, address: "Cinnah Cd. 10", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr", similarOk: true });
  yaz("vdsiz cari", kisa(vdsiz));
  if (vdsiz.data?.id) yaz("vdsiz kes simdi", kisa(await kes(vdsiz.data.id, "2026-07-04", "now")));
  const nihai = await api.post("/api/workspace/accounts", { name: "Nihai Tüketici", type: "customer", partyKind: "person", firstName: "Nihai", familyName: "Tüketici", taxNo: "11111111111", similarOk: true });
  yaz("nihai cari", kisa(nihai));
  if (nihai.data?.id) {
    yaz("nihai kes 600", kisa(await kes(nihai.data.id, "2026-07-04", "later")));
    yaz("nihai kes 36000", kisa(await kes(nihai.data.id, "2026-07-04", "later", "service_sale", [{ name: "Danışmanlık", qty: 1, unitPrice: 30000, vatRate: 20 }])));
  }
} catch (e) {
  console.log("HATA", e.stack);
} finally {
  await server.close().catch(() => {});
  await edm.close().catch(() => {});
}
