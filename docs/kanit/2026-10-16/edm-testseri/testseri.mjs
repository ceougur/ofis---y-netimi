// EDM TEST ORTAMI (16.10.2026, İz 8): e-Belge yalnız test ortamıyla açık kurulum gibi (edocEnabled, canlı kilitli): e-Fatura TEF, e-Arşiv TEA
// serisinden numara alıp EDM'ye gider mi; resmî görüntüde "TEST ORTAMI" şeridi var mı. Kimlik yalnız yüklenen dosyadan; çıktıda maskelenir.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const R = "/home/user/ofis---y-netimi";
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3]; mkdirSync(OUT, { recursive: true });
const mask = v => JSON.stringify(v ?? "").split(password).join("***").split(username).join("<kullanıcı>");
const log = (l, v) => console.log(`${new Date().toISOString().slice(11, 19)} ${l}: ${mask(v).slice(0, 500)}`);
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer({ edocEnabled: true });
const c = server.client(); await c.login("admin", ADMIN_PASSWORD);
const post = async (u, b) => unwrap(await c.post(u, b)); const put = async (u, b) => unwrap(await c.put(u, b));
const seq = 100_000_000 + Math.floor(Math.random() * 800_000_000);
const y = new Date().getFullYear();
const s = await put("/api/workspace/invoices/settings", {
  seller: { name: "ETA BILGISAYAR TEST 3", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr" },
  efatura: true, earsiv: true, start: { [`TEF${y}`]: seq, [`TEA${y}`]: seq },
  integrator: { env: "test", username, password, senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", mailboxAlias: "urn:mail:defaultpk@edmbilisim.com.tr" },
});
log("AYAR", { status: s.status, testNumbers: s.data?.testNumbers?.efatura?.number, own: s.data?.nextNumbers?.efatura?.number, err: s.data?.error });
const acc = async b => { const r = await post("/api/workspace/accounts", b); return r.data.id || r.data.account?.id; };
const firm = await acc({ name: "ETA BILGISAYAR TEST 3", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", eInvoice: true, eAlias: "urn:mail:defaultpk@edmbilisim.com.tr" });
const person = await acc({ name: "Test Seri Alıcı", type: "customer", partyKind: "person", firstName: "Test", familyName: "Alıcı", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Sk. 2", district: "Kadıköy" });
const docs = [];
for (const [name, accountId] of [["efatura", firm], ["earsiv", person]]) {
  const d = await post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: [{ name: "Test Serisi Denemesi", qty: 1, unitPrice: 250, vatRate: 20 }], payment: { rest: "open" } });
  log(`${name} KAYIT`, { status: d.status, number: d.data?.number, eTest: d.data?.eTest, profile: d.data?.profile });
  const sent = await post(`/api/workspace/invoices/${d.data.id}/send`, {});
  log(`${name} GÖNDER`, { status: sent.status, eStatus: sent.data?.eStatus, msg: sent.data?.eMessage || sent.data?.error });
  docs.push({ name, id: d.data.id, number: d.data.number });
}
const pending = new Set(docs.map(d => d.id));
for (let round = 1; round <= 14 && pending.size; round += 1) {
  for (const d of docs.filter(item => pending.has(item.id))) {
    const st = await post(`/api/workspace/invoices/${d.id}/e-refresh`, {});
    log(`${d.name} DURUM ${round}`, { eStatus: st.data?.eStatus, msg: (st.data?.eMessage || st.data?.error || "").slice(0, 100) });
    if (st.status === 200 && st.data.eStatus !== "processing") pending.delete(d.id);
  }
  if (pending.size) await new Promise(r => setTimeout(r, 45_000));
}
for (const d of docs) {
  const r = await c.raw("GET", `/api/workspace/invoices/${d.id}/resmi.pdf`);
  if (r.status === 200) writeFileSync(`${OUT}/${d.number}-resmi.pdf`, r.buffer);
  log(`${d.name} RESMÎ`, { status: r.status, bayt: r.buffer?.length });
}
await server.close();
