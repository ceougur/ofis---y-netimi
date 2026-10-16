// EDM TEST ORTAMI — SON HÂL 2 (16.10.2026 akşam, kullanıcı: "test portalına karekodlu son halini dener misin"): canlı AÇIK üretim ayarıyla
// (edocLive: true, server.mjs ile aynı) ortam "test" seçili → belge yine TEF/TEA test serisi + TEST şeridi almalı; yeni SAYIN düzeni + karekod.
// Önceki koşu (edm-son-hal) notu:
// bitiş turu düzeltmeleri dahil SON kodla (çalışma ağacı) programın kendi API'sinden 4 belge: e-Fatura TEMEL (iki KDV oranı), e-Fatura TİCARİ,
// e-Arşiv (kişiye; logo + kaşe), e-Fatura İSTİSNA (karışık: 301 + %20). Test serisi TEF/TEA (program verir). Kimlik bilgisi yalnız yüklenen
// dosyadan; çıktıda maskelenir. Kaşe yerine örnek görsel (DestekOfis kare logosu) — gerçek kaşe değil.
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
const server = await startTestServer({ edocEnabled: true, edocLive: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const c = server.client();
const post = async (u, b) => unwrap(await c.post(u, b));
const put = async (u, b) => unwrap(await c.put(u, b));
await c.login("admin", ADMIN_PASSWORD);
const jpeg = file => `data:image/jpeg;base64,${readFileSync(`${R}/docs/pazarlama/${file}`).toString("base64")}`;
// Paylaşılan EDM test hesabında başka denemelerin numaralarıyla çakışmasın: test serisi rastgele bir sıradan başlar.
const seq = 100_000_000 + Math.floor(Math.random() * 800_000_000);
const year = new Date().getFullYear();
const s = await put("/api/workspace/invoices/settings", {
  seller: { name: "ETA BILGISAYAR TEST 3", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr", logo: jpeg("DestekOfis-Logo-Fatura-Yatay.jpg"), stamp: jpeg("DestekOfis-Logo-Fatura-Kare.jpg"), banks: [{ name: "Örnek Bankası A.Ş.", iban: "TR330006100519786457841326" }] },
  efatura: true, earsiv: true, start: { [`TEF${year}`]: seq, [`TEA${year}`]: seq },
  defaults: { footer: "DestekOfis 2.4.0 son hâl 2 (karekod + yeni alıcı düzeni) — ödemelerinizde fatura numarasını açıklamaya yazınız." },
  eView: { enabled: true, logo: true, banks: true, footer: true, stamp: true, stampEfatura: false },
  integrator: { env: "test", baseUrl: "", username, password, senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", mailboxAlias: "urn:mail:defaultpk@edmbilisim.com.tr" },
});
log("AYAR", { status: s.status, url: s.data?.integrator?.url, liveAllowed: s.data?.integrator?.liveAllowed, testNumbers: s.data?.testNumbers, err: s.data?.error });
if (s.status !== 200) process.exit(1);
const acc = async body => { const r = await post("/api/workspace/accounts", body); if (r.status !== 200) throw new Error(mask(r.data)); return r.data.id || r.data.account?.id; };
const person = await acc({ name: "Ahmet Yılmaz", type: "customer", partyKind: "person", firstName: "Ahmet", familyName: "Yılmaz", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Deneme Sk. 2", district: "Kadıköy", email: "alici@example.com" });
const firm = await acc({ name: "ETA BILGISAYAR TEST 3", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul" });
log("MÜKELLEF SORGUSU", (await post("/api/workspace/invoices/check-user", { taxNo: "3230512384", accountId: firm })).data?.registered);
const plans = [
  ["1-e-Fatura TEMEL (iki KDV oranı)", firm, "efatura", {}, [{ name: "DestekOfis Lisans", qty: 2, unitPrice: 150, vatRate: 20 }, { name: "Kurulum", qty: 1, unitPrice: 100, vatRate: 10, description: "Yerinde kurulum" }]],
  ["2-e-Fatura TİCARİ", firm, "efatura", { profile: "TICARIFATURA" }, [{ name: "Yıllık Destek Paketi", qty: 1, unitPrice: 1000, vatRate: 20 }]],
  ["3-e-Arşiv (kişiye, logo + kaşe)", person, "earsiv", {}, [{ name: "Danışmanlık", qty: 3, unitPrice: 250, vatRate: 20 }]],
  ["4-e-Fatura İSTİSNA (301 + %20 karışık)", firm, "efatura", {}, [{ name: "İhraç Kayıtlı Ürün", qty: 1, unitPrice: 500, vatRate: 0, exemptionCode: "301" }, { name: "Nakliye Hizmeti", qty: 1, unitPrice: 200, vatRate: 20 }]],
];
const docs = [];
for (const [name, accountId, type, extra, lines] of plans) {
  const doc = await post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines, payment: { rest: "open" }, ...extra });
  log(`${name} KAYIT`, { status: doc.status, number: doc.data?.number, profile: doc.data?.profile, typeCode: doc.data?.typeCode, eTest: doc.data?.eTest, payable: doc.data?.tryPayable, err: doc.data?.error });
  if (doc.status !== 200) continue;
  const xml = String((await c.get(`/api/workspace/invoices/${doc.data.id}/ubl.xml`)).data);
  writeFileSync(`${OUT}/${doc.data.number}.xml`, xml);
  const v = await validateInvoice(xml, { type });
  log(`${name} GİB/XSD KÂHİN`, { xsd: v.xsd.length, gib: v.schematron.map(e => e.text) });
  const sent = await post(`/api/workspace/invoices/${doc.data.id}/send`, {});
  log(`${name} GÖNDER`, { status: sent.status, eStatus: sent.data?.eStatus, msg: sent.data?.eMessage || sent.data?.error });
  if (sent.status === 200) docs.push({ name, id: doc.data.id, number: doc.data.number, ettn: doc.data.ettn });
}
const pending = new Set(docs.map(d => d.id));
for (let round = 1; round <= 20 && pending.size; round += 1) {
  for (const d of docs.filter(item => pending.has(item.id))) {
    const st = await post(`/api/workspace/invoices/${d.id}/e-refresh`, {});
    log(`${d.name} DURUM ${round}`, { status: st.status, eStatus: st.data?.eStatus, msg: (st.data?.eMessage || st.data?.error || "").slice(0, 160) });
    if (st.status === 200 && st.data.eStatus !== "processing") pending.delete(d.id);
  }
  if (pending.size) await new Promise(r => setTimeout(r, 45_000));
}
for (const d of docs) {
  const r = await c.raw("GET", `/api/workspace/invoices/${d.id}/resmi.pdf`);
  if (r.status === 200) writeFileSync(`${OUT}/${d.number}-resmi.pdf`, r.buffer);
  log(`${d.name} RESMÎ GÖRÜNTÜ`, { status: r.status, bayt: r.buffer.length, pdf: r.buffer.subarray(0, 5).toString("latin1") });
}
console.log("ÖZET", JSON.stringify(docs.map(d => ({ belge: d.name, no: d.number, ettn: d.ettn }))));
await server.close();
