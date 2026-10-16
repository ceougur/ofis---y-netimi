// EDM TEST ORTAMI (16.10.2026, İz 6): görünüm şablonlu (logo + banka + alt not) e-Arşiv (şahıs firması, ticari unvanlı) ve e-Fatura programın
// kendi API'siyle gönderilir; durum son hâline gelince programın "Resmî Görüntü" ucundan EDM'nin çizdiği PDF alınır. Program dışarı kendi vekil
// modülüyle çıkar (bu ortamda HTTPS_PROXY). Kimlik bilgisi yalnız yüklenen dosyadan; çıktıda maskelenir. Canlı ortam kilitli (edocLive yok).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const R = "/home/user/ofis---y-netimi";
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const { validateInvoice, embeddedXslt } = await import(`${R}/tools/ebelge/dogrula.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const mask = value => JSON.stringify(value ?? "").split(password).join("***").split(username).join("<kullanıcı>");
const log = (label, value) => console.log(`${new Date().toISOString().slice(11, 19)} ${label}: ${mask(value).slice(0, 600)}`);
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer({ edocEnabled: true });
const c = server.client();
const post = async (u, b) => unwrap(await c.post(u, b));
const put = async (u, b) => unwrap(await c.put(u, b));
await c.login("admin", ADMIN_PASSWORD);
const seq = 100_000_000 + Math.floor(Math.random() * 800_000_000);
const logo = `data:image/jpeg;base64,${readFileSync(new URL("./logo.jpg", import.meta.url)).toString("base64")}`;
const s = await put("/api/workspace/invoices/settings", {
  seller: { name: "ETA BILGISAYAR TEST 3", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr", logo, banks: [{ name: "Örnek Bankası A.Ş.", iban: "TR330006100519786457841326" }] },
  efatura: true, earsiv: true, series: { earsiv: "DOA", efatura: "DOF" }, start: { DOA2026: seq, DOF2026: seq },
  defaults: { footer: "DestekOfis görünüm şablonu denemesi — ödemelerinizde fatura numarasını açıklamaya yazınız." },
  integrator: { env: "test", username, password, senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", mailboxAlias: "urn:mail:defaultpk@edmbilisim.com.tr" },
});
log("AYAR", { status: s.status, eView: s.data?.eView, network: s.data?.integrator?.network, err: s.data?.error });
const acc = async body => { const r = await post("/api/workspace/accounts", body); if (r.status !== 200) throw new Error(mask(r.data)); return r.data.id || r.data.account?.id; };
const trader = await acc({ name: "Ahmet Yılmaz İnşaat", type: "customer", partyKind: "person", firstName: "Ahmet", familyName: "Yılmaz", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Deneme Sk. 2", district: "Kadıköy", email: "alici@example.com" });
const firm = await acc({ name: "ETA BILGISAYAR TEST 3", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul" });
log("MÜKELLEF", (await post("/api/workspace/invoices/check-user", { taxNo: "3230512384", accountId: firm })).data?.registered);
const docs = [];
for (const [name, accountId, type] of [["earsiv", trader, "earsiv"], ["efatura", firm, "efatura"]]) {
  const doc = await post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: [{ name: "DestekOfis Görünüm Denemesi", qty: 2, unitPrice: 150, vatRate: 20 }, { name: "Kurulum", qty: 1, unitPrice: 100, vatRate: 10, description: "Yerinde kurulum" }], payment: { rest: "open" } });
  log(`${name} KAYIT`, { status: doc.status, number: doc.data?.number, profile: doc.data?.profile, err: doc.data?.error });
  if (doc.status !== 200) continue;
  const xml = (await c.get(`/api/workspace/invoices/${doc.data.id}/ubl.xml`)).data;
  writeFileSync(`${OUT}/${doc.data.number}.xml`, xml);
  const v = await validateInvoice(xml, { type });
  log(`${name} XML`, { xsd: v.xsd.length, gib: v.schematron.map(e => e.text), xsltBayt: embeddedXslt(xml).length, xmlBayt: xml.length });
  const sent = await post(`/api/workspace/invoices/${doc.data.id}/send`, {});
  log(`${name} GÖNDER`, { status: sent.status, eStatus: sent.data?.eStatus, msg: sent.data?.eMessage || sent.data?.error });
  if (sent.status === 200) docs.push({ name, id: doc.data.id, number: doc.data.number });
}
const pending = new Set(docs.map(d => d.id));
for (let round = 1; round <= 20 && pending.size; round += 1) {
  for (const d of docs.filter(item => pending.has(item.id))) {
    const st = await post(`/api/workspace/invoices/${d.id}/e-refresh`, {});
    log(`${d.name} DURUM ${round}`, { status: st.status, eStatus: st.data?.eStatus, msg: (st.data?.eMessage || st.data?.error || "").slice(0, 120) });
    if (st.status === 200 && st.data.eStatus !== "processing") pending.delete(d.id);
  }
  if (pending.size) await new Promise(r => setTimeout(r, 45_000));
}
for (const d of docs) {
  const r = await c.raw("GET", `/api/workspace/invoices/${d.id}/resmi.pdf`);
  if (r.status === 200) writeFileSync(`${OUT}/${d.number}-resmi.pdf`, r.buffer);
  log(`${d.name} RESMÎ GÖRÜNTÜ`, { status: r.status, bayt: r.buffer.length, pdf: r.buffer.subarray(0, 5).toString("latin1"), err: r.data?.error });
}
await server.close();
