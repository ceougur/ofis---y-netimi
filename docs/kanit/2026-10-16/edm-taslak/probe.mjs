// EDM TEST ORTAMI (16.10.2026, İz 7.3): LoadInvoice (taslak) davranışı — aynı UUID ile ikinci yükleme, taslağı gönderme (CONTENT boş),
// e-Arşiv taslağının iptali. Kimlik yalnız yüklenen dosyadan; çıktıda maskelenir. Canlı ortam yok.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const R = "/home/user/ofis---y-netimi";
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const { createEdmClient } = await import(`${R}/server/lib/einvoice/edm.mjs`);
const { createProxyFetch, cachedResolver } = await import(`${R}/server/lib/net-proxy.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3]; mkdirSync(OUT, { recursive: true });
const mask = v => JSON.stringify(v ?? "").split(password).join("***").split(username).join("<kullanıcı>");
const log = (l, v) => console.log(`${new Date().toISOString().slice(11, 19)} ${l}: ${mask(v).slice(0, 700)}`);
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer({ edocEnabled: true });
const c = server.client(); await c.login("admin", ADMIN_PASSWORD);
const post = async (u, b) => unwrap(await c.post(u, b)); const put = async (u, b) => unwrap(await c.put(u, b));
const seq = 100_000_000 + Math.floor(Math.random() * 800_000_000);
await put("/api/workspace/invoices/settings", { seller: { name: "ETA BILGISAYAR TEST 3", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000" }, efatura: true, earsiv: true, series: { earsiv: "DOA", efatura: "DOF" }, start: { DOA2026: seq, DOF2026: seq } });
const acc = async b => { const r = await post("/api/workspace/accounts", b); return r.data.id || r.data.account?.id; };
const person = await acc({ name: "Taslak Deneme Alıcı", type: "customer", partyKind: "person", firstName: "Taslak", familyName: "Alıcı", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Sk. 2", district: "Kadıköy" });
const firm = await acc({ name: "ETA BILGISAYAR TEST 3", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul" });
const make = async (accountId, price) => { const d = await post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: [{ name: "Taslak Denemesi", qty: 1, unitPrice: price, vatRate: 20 }], payment: { rest: "open" } }); const xml = (await c.get(`/api/workspace/invoices/${d.data.id}/ubl.xml`)).data; return { ...d.data, xml }; };
const client = createEdmClient({ baseUrl: "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc", username, password, fetchImpl: createProxyFetch({ resolve: cachedResolver({ file: "/nonexistent-ag.json", env: process.env }) }) });
const step = async (label, fn) => { try { const r = await fn(); log(label, r); return r; } catch (e) { log(`${label} HATA`, { code: e.code, msg: e.message, ic: e.integratorCode, detail: e.detail }); return null; } };
const common = { senderVkn: "3230512384", senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr" };
// 1) e-Arşiv: yükle, durum, aynı UUID yeniden (tutar değişik), durum, taslağı gönder, durum.
const a = await make(person, 111);
log("eArşiv belge", { number: a.number, ettn: a.ettn, profile: a.profile });
await step("A1 loadDraft", () => client.loadDraft({ xml: a.xml, number: a.number, uuid: a.ettn, earchive: true, ...common, receiverVkn: "10000000146" }));
await step("A1 status", () => client.status({ uuid: a.ettn, number: a.number, earchive: true }));
const a2xml = a.xml.replace(/>111\.00</g, ">112.00<");
await step("A2 loadDraft aynı UUID", () => client.loadDraft({ xml: a2xml, number: a.number, uuid: a.ettn, earchive: true, ...common, receiverVkn: "10000000146" }));
await step("A3 sendDraft", () => client.sendDraft({ number: a.number, uuid: a.ettn, earchive: true, ...common, receiverVkn: "10000000146" }));
// 2) e-Arşiv: yükle, iptal (taslak iptali), durum.
const b = await make(person, 222);
log("eArşiv-2 belge", { number: b.number });
await step("B1 loadDraft", () => client.loadDraft({ xml: b.xml, number: b.number, uuid: b.ettn, earchive: true, ...common, receiverVkn: "10000000146" }));
await step("B2 cancel taslak", () => client.cancelEArchive({ uuid: b.ettn, number: b.number }));
await step("B2 status", () => client.status({ uuid: b.ettn, number: b.number, earchive: true }));
// 3) e-Fatura: yükle, durum, gönder.
const f = await make(firm, 333);
log("eFatura belge", { number: f.number, profile: f.profile });
const rcv = { receiverVkn: "3230512384", receiverAlias: "urn:mail:defaultpk@edmbilisim.com.tr" };
await step("F1 loadDraft", () => client.loadDraft({ xml: f.xml, number: f.number, uuid: f.ettn, ...common, ...rcv }));
await step("F1 status", () => client.status({ uuid: f.ettn, number: f.number }));
await step("F2 sendDraft", () => client.sendDraft({ number: f.number, uuid: f.ettn, ...common, ...rcv }));
for (let i = 1; i <= 6; i += 1) {
  await new Promise(r => setTimeout(r, 30_000));
  const sa = await step(`A durum ${i}`, () => client.status({ uuid: a.ettn, number: a.number, earchive: true }));
  const sf = await step(`F durum ${i}`, () => client.status({ uuid: f.ettn, number: f.number }));
  if (sa?.status !== "processing" && sf?.status !== "processing") break;
}
writeFileSync(`${OUT}/belgeler.json`, JSON.stringify({ a: [a.number, a.ettn], b: [b.number, b.ettn], f: [f.number, f.ettn] }, null, 1));
await server.close();
