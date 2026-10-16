// EDM TEST ORTAMI (16.10.2026, İz 7): dört seçenek AÇIK — programın kendi API'siyle e-Fatura: Seri No / Lot No'lu kalem, peşin nakit + kart +
// vadeli kalan (ödeme şekli kodları), cari bakiyesi notu; Portala Taslak Yükle → Düzenle → Taslağı Yenile → Taslağı Gönder → durum → resmî PDF.
// Ayrıca e-Arşiv taslağı yüklenip programda iptal edilir (EDM'de de iptal). Kimlik yalnız yüklenen dosyadan; çıktıda maskelenir. Canlı yok.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const R = "/home/user/ofis---y-netimi";
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const { validateInvoice } = await import(`${R}/tools/ebelge/dogrula.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const OUT = process.argv[3]; mkdirSync(OUT, { recursive: true });
const mask = v => JSON.stringify(v ?? "").split(password).join("***").split(username).join("<kullanıcı>");
const log = (l, v) => console.log(`${new Date().toISOString().slice(11, 19)} ${l}: ${mask(v).slice(0, 700)}`);
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer({ edocEnabled: true });
const c = server.client(); await c.login("admin", ADMIN_PASSWORD);
const post = async (u, b) => unwrap(await c.post(u, b)); const put = async (u, b) => unwrap(await c.put(u, b)); const get = async u => unwrap(await c.get(u));
const seq = 100_000_000 + Math.floor(Math.random() * 800_000_000);
const s = await put("/api/workspace/invoices/settings", {
  seller: { name: "ETA BILGISAYAR TEST 3", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr", banks: [{ name: "Örnek Bankası A.Ş.", iban: "TR330006100519786457841326" }] },
  efatura: true, earsiv: true, series: { earsiv: "DOA", efatura: "DOF" }, start: { DOA2026: seq, DOF2026: seq },
  defaults: { itemTracking: true },
  eOptions: { balanceNote: true, paymentMeans: true, draftUpload: true },
  integrator: { env: "test", username, password, senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", mailboxAlias: "urn:mail:defaultpk@edmbilisim.com.tr" },
});
log("AYAR", { status: s.status, eOptions: s.data?.eOptions, itemTracking: s.data?.defaults?.itemTracking, network: s.data?.integrator?.network });
const acc = async b => { const r = await post("/api/workspace/accounts", b); if (r.status !== 200) throw new Error(mask(r.data)); return r.data.id || r.data.account?.id; };
const firm = await acc({ name: "ETA BILGISAYAR TEST 3", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", eInvoice: true, eAlias: "urn:mail:defaultpk@edmbilisim.com.tr" });
const person = await acc({ name: "Taslak İptal Alıcı", type: "customer", partyKind: "person", firstName: "Taslak", familyName: "Alıcı", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Sk. 2", district: "Kadıköy" });
// e-Fatura: 1 × 10.000 (Seri/Lot) + 1 × 500 hizmet, %20 → 12.600; peşin 2.000 nakit + 3.000 kart, kalan 7.600 vadeli.
const lines = price => [{ name: "Kombi", qty: 1, unitPrice: price, vatRate: 20, serialNo: "SN-EDM-001", lotNo: "LOT-2026-10" }, { name: "Montaj", qty: 1, unitPrice: 500, vatRate: 20 }];
const doc = await post("/api/workspace/invoices", { scenario: "goods_sale", accountId: firm, dueDate: "2026-11-16", lines: lines(10000), payment: { cash: [{ amount: 2000, method: "cash" }, { amount: 3000, method: "card" }], rest: "open" }, force: true });
log("KAYIT", { status: doc.status, number: doc.data?.number, profile: doc.data?.profile, payable: doc.data?.payableTotal, canDraft: doc.data?.canDraft, err: doc.data?.error });
const xml1 = (await c.get(`/api/workspace/invoices/${doc.data.id}/ubl.xml`)).data;
writeFileSync(`${OUT}/${doc.data.number}-ilk.xml`, xml1);
const v1 = await validateInvoice(xml1);
log("XML", { xsd: v1.xsd.length, gib: v1.schematron.map(e => e.text), notlar: [...xml1.matchAll(/<cbc:Note>([^<]*)</g)].map(m => m[1]).filter(n => /bakiye/i.test(n)), odeme: [...xml1.matchAll(/<cbc:PaymentMeansCode>([^<]*)</g)].map(m => m[1]), seri: /<cbc:SerialID>SN-EDM-001</.test(xml1) });
const d1 = await post(`/api/workspace/invoices/${doc.data.id}/e-draft`, {});
log("TASLAK YÜKLE", { status: d1.status, eStatus: d1.data?.eStatus, msg: d1.data?.eMessage || d1.data?.error });
const r1 = await post(`/api/workspace/invoices/${doc.data.id}/e-refresh`, {});
log("DURUM", { eStatus: r1.data?.eStatus, msg: r1.data?.eMessage });
const ed = await post(`/api/workspace/invoices/${doc.data.id}/edit`, { accountId: firm, dueDate: "2026-11-16", lines: lines(11000), payment: { cash: [{ amount: 2000, method: "cash" }, { amount: 3000, method: "card" }], rest: "open" }, force: true });
log("DÜZENLE", { status: ed.status, payable: ed.data?.payableTotal, eStatus: ed.data?.eStatus, draftStale: ed.data?.draftStale, err: ed.data?.error });
const d2 = await post(`/api/workspace/invoices/${doc.data.id}/e-draft`, {});
log("TASLAĞI YENİLE", { status: d2.status, eStatus: d2.data?.eStatus, draftStale: d2.data?.draftStale, msg: d2.data?.eMessage || d2.data?.error });
const sent = await post(`/api/workspace/invoices/${doc.data.id}/send`, {});
log("TASLAĞI GÖNDER", { status: sent.status, eStatus: sent.data?.eStatus, msg: sent.data?.eMessage || sent.data?.error });
const xml2 = (await c.get(`/api/workspace/invoices/${doc.data.id}/ubl.xml`)).data;
writeFileSync(`${OUT}/${doc.data.number}-son.xml`, xml2);
const v2 = await validateInvoice(xml2);
log("SON XML", { xsd: v2.xsd.length, gib: v2.schematron.map(e => e.text), odenecek: xml2.match(/<cbc:PayableAmount currencyID="TRY">([^<]*)</)?.[1], notlar: [...xml2.matchAll(/<cbc:Note>([^<]*)</g)].map(m => m[1]).filter(n => /bakiye/i.test(n)) });
// e-Arşiv taslağı: yükle → programda iptal → EDM'de iptal.
const ea = await post("/api/workspace/invoices", { scenario: "service_sale", accountId: person, lines: [{ name: "Taslak İptal Denemesi", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" } });
const ead = await post(`/api/workspace/invoices/${ea.data.id}/e-draft`, {});
log("eARŞİV TASLAK", { number: ea.data?.number, profile: ea.data?.profile, eStatus: ead.data?.eStatus, msg: ead.data?.eMessage || ead.data?.error });
const eac = await post(`/api/workspace/invoices/${ea.data.id}/cancel`, { reason: "Taslak denemesi" });
log("eARŞİV TASLAK İPTAL", { status: eac.status, status2: eac.data?.status, eStatus: eac.data?.eStatus, msg: eac.data?.eMessage || eac.data?.error });
for (let i = 1; i <= 12; i += 1) {
  const st = await post(`/api/workspace/invoices/${doc.data.id}/e-refresh`, {});
  log(`DURUM ${i}`, { eStatus: st.data?.eStatus, msg: (st.data?.eMessage || st.data?.error || "").slice(0, 140) });
  if (st.data?.eStatus && st.data.eStatus !== "processing") break;
  await new Promise(r => setTimeout(r, 45_000));
}
const pdf = await c.raw("GET", `/api/workspace/invoices/${doc.data.id}/resmi.pdf`);
if (pdf.status === 200) writeFileSync(`${OUT}/${doc.data.number}-resmi.pdf`, pdf.buffer);
log("RESMÎ GÖRÜNTÜ", { status: pdf.status, bayt: pdf.buffer?.length, err: pdf.data?.error });
writeFileSync(`${OUT}/program-belgeler.json`, JSON.stringify({ efatura: [doc.data.number, doc.data.ettn], earsiv: [ea.data.number, ea.data.ettn] }, null, 1));
await server.close();
