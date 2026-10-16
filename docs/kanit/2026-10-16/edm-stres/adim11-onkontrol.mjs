// ÖN DENEME (16.10.2026): satıcı adı "DESTEK OFİS" (VKN 3230512384 EDM test hesabı) GİB/EDM tarafından kabul ediliyor mu? Bir e-Arşiv + bir e-Fatura, API.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const R = "/home/user/ofis---y-netimi";
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const { validateInvoice } = await import(`${R}/tools/ebelge/dogrula.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const mask = value => JSON.stringify(value ?? "").split(password).join("***").split(username).join("<kullanıcı>");
const log = (label, value) => console.log(`${new Date().toISOString().slice(11, 19)} ${label}: ${mask(value).slice(0, 600)}`);
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer({ edocEnabled: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = server.client();
const post = async (u, b) => unwrap(await c.post(u, b));
const put = async (u, b) => unwrap(await c.put(u, b));
await c.login("admin", ADMIN_PASSWORD);
const jpeg = file => `data:image/jpeg;base64,${readFileSync(`${R}/docs/pazarlama/${file}`).toString("base64")}`;
// Paylaşılan EDM test hesabında başka denemelerin numaralarıyla çakışmasın: test serisi rastgele bir sıradan başlar.
const seq = 100_000_000 + Math.floor(Math.random() * 800_000_000);
const year = new Date().getFullYear();
const s = await put("/api/workspace/invoices/settings", {
  seller: { name: "DESTEK OFİS", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr" },
  efatura: true, earsiv: true, start: { [`TEF${year}`]: seq, [`TEA${year}`]: seq },
  integrator: { env: "test", baseUrl: "", username, password, senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", mailboxAlias: "urn:mail:defaultpk@edmbilisim.com.tr" },
});
log("AYAR", { status: s.status, err: s.data?.error });
const acc = async body => { const r = await post("/api/workspace/accounts", body); if (r.status !== 200) throw new Error(mask(r.data)); return r.data.id || r.data.account?.id; };
const person = await acc({ name: "DESTEK OFİS Bireysel", type: "customer", partyKind: "person", firstName: "Destek", familyName: "Ofis", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Deneme Sk. 2", district: "Kadıköy", email: "alici@example.com" });
const firm = await acc({ name: "DESTEK OFİS", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul" });
log("MÜKELLEF", (await post("/api/workspace/invoices/check-user", { taxNo: "3230512384", accountId: firm })).data?.registered);
const docs = [];
for (const [name, accountId] of [["e-Arşiv", person], ["e-Fatura", firm]]) {
  const doc = await post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: [{ name: "Ön Deneme Hizmeti", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } });
  const sent = await post(`/api/workspace/invoices/${doc.data.id}/send`, {});
  log(`${name} GÖNDER`, { no: doc.data?.number, status: sent.status, eStatus: sent.data?.eStatus, msg: sent.data?.eMessage || sent.data?.error });
  docs.push({ name, id: doc.data.id, number: doc.data.number, ettn: doc.data.ettn });
}
const pending = new Set(docs.map(d => d.id));
for (let round = 1; round <= 20 && pending.size; round += 1) {
  for (const d of docs.filter(item => pending.has(item.id))) {
    const st = await post(`/api/workspace/invoices/${d.id}/e-refresh`, {});
    log(`${d.name} DURUM ${round}`, { eStatus: st.data?.eStatus, msg: (st.data?.eMessage || st.data?.error || "").slice(0, 160) });
    if (st.status === 200 && st.data.eStatus !== "processing") pending.delete(d.id);
  }
  if (pending.size) await new Promise(r => setTimeout(r, 45_000));
}
console.log("ÖZET", JSON.stringify(docs));
await server.close();
