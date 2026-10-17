// 2.4.2 GERÇEK EDM TEST ORTAMI (17.10.2026; kullanıcının yaşadığı akış): kimlik bilgisi yalnız yüklenen dosyadan, çıktıda maskelenir.
//   A) 2.4.1 gibi 1'den başlayan test serisi: TEA…000000001 → EDM 11048 (numara ortak hesapta kullanılmış) → ileti yol gösterir → İptal Et → EDM'de yok
//      (11017) → yalnız programda iptal.  e-Fatura için de TEF…000000001.
//   B) Üretim ayarı (testSeriesStart verilmez → rastgele büyük): e-Arşiv + e-Fatura gönderilir, EDM'den durum "Alıcıya ulaştı"/"Gönderildi".
import { readFileSync } from "node:fs";
const R = "/home/user/ofis---y-netimi";
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const text = readFileSync(process.argv[2], "utf8");
const username = (text.match(/kullan[ıi]c[ıi] ad[ıi]\s*:\s*(\S+)/i) || [])[1];
const password = (text.match(/şifre\s*:\s*(\S+)/i) || [])[1];
const mask = value => JSON.stringify(value ?? "").split(password).join("***").split(username).join("<kullanıcı>");
const log = (label, value) => console.log(`${new Date().toISOString().slice(11, 19)} ${label}: ${mask(value).slice(0, 700)}`);
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
let failed = 0;
const check = (cond, what) => { if (!cond) failed += 1; console.log(`  ${cond ? "✓" : "✗"} ${what}`); };

async function session(label, options) {
  const server = await startTestServer({ edocEnabled: true, edocLive: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, ...options });
  const c = server.client();
  await c.login("admin", ADMIN_PASSWORD);
  const api = { get: async u => unwrap(await c.get(u)), post: async (u, b) => unwrap(await c.post(u, b)), put: async (u, b) => unwrap(await c.put(u, b)) };
  const s = await api.put("/api/workspace/invoices/settings", {
    seller: { name: "DENEME TICARET LTD. STI.", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul", postalCode: "34000", email: "test@destekofis.com.tr" },
    efatura: true, earsiv: true,
    integrator: { env: "test", baseUrl: "", username, password, senderAlias: "urn:mail:defaultgb@edmbilisim.com.tr", mailboxAlias: "urn:mail:defaultpk@edmbilisim.com.tr" },
  });
  log(`${label} AYAR`, { status: s.status, testNumbers: s.data?.testNumbers, err: s.data?.error });
  const acc = async body => { const r = await api.post("/api/workspace/accounts", body); return r.data.id || r.data.account?.id; };
  const person = await acc({ name: "Ahmet Yılmaz", type: "customer", partyKind: "person", firstName: "Ahmet", familyName: "Yılmaz", taxNo: "10000000146", taxOffice: "Kadıköy", city: "İstanbul", address: "Deneme Sk. 2", district: "Kadıköy" });
  const firm = await acc({ name: "DENEME TICARET LTD. STI.", type: "customer", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Test Cd. 1", district: "Kadıköy", city: "İstanbul" });
  await api.post("/api/workspace/invoices/check-user", { taxNo: "3230512384", accountId: firm });
  return { server, api, person, firm };
}
const sale = (api, accountId) => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: [{ name: "Hizmet Satışı", qty: 1, unitPrice: 935, vatRate: 20 }], payment: { rest: "open" } });

console.log("■ A) 1'den başlayan test numarası (2.4.1 davranışı)");
{
  const a = await session("A", {});
  for (const [label, accountId] of [["e-Arşiv", a.person], ["e-Fatura", a.firm]]) {
    const doc = (await sale(a.api, accountId)).data;
    const sent = await a.api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    log(`A ${label} GÖNDER ${doc.number}`, { status: sent.status, err: sent.data?.error });
    const card = (await a.api.get(`/api/workspace/invoices/${doc.id}`)).data;
    if (card.eStatus === "error" && /11048/.test(card.eMessage || "")) {
      check(/ortak/.test(card.eMessage), `${label} ${doc.number}: gerçek EDM 11048 + yol gösteren ileti`);
      const cancelled = await a.api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Numara çakıştı" });
      log(`A ${label} İPTAL`, { status: cancelled.status, docStatus: cancelled.data?.status, eMessage: cancelled.data?.eMessage, err: cancelled.data?.error });
      check(cancelled.status === 200 && cancelled.data.status === "cancelled", `${label}: İptal Et gerçek EDM'de (11017) belgeyi programda iptal etti`);
    } else {
      log(`A ${label} NOT`, { eStatus: card.eStatus, eMessage: card.eMessage, note: "numara ortak hesapta kullanılmamış; 11048 üretilemedi" });
      check(false, `${label}: ${doc.number} gerçek EDM'de 11048 üretmedi (eStatus ${card.eStatus})`);
    }
  }
  await a.server.close();
}

console.log("\n■ B) Üretim ayarı: rastgele büyük başlangıç");
{
  const b = await session("B", { testSeriesStart: null });
  const sent = [];
  for (const [label, accountId] of [["e-Arşiv", b.person], ["e-Fatura", b.firm]]) {
    const doc = (await sale(b.api, accountId)).data;
    const r = await b.api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    log(`B ${label} GÖNDER ${doc.number}`, { status: r.status, eStatus: r.data?.eStatus, err: r.data?.error });
    check(Number(doc.number.slice(7)) > 100_000_000 && r.status === 200, `${label} ${doc.number}: 1'den başlamadı, EDM kabul etti`);
    if (r.status === 200) sent.push({ label, id: doc.id, number: doc.number });
  }
  for (let round = 0; round < 24 && sent.some(d => !d.final); round += 1) {
    await new Promise(r => setTimeout(r, 10_000));
    for (const d of sent.filter(d => !d.final)) {
      const st = await b.api.post(`/api/workspace/invoices/${d.id}/e-refresh`, {});
      d.eStatus = st.data?.eStatus;
      if (["sent", "accepted", "rejected", "error"].includes(d.eStatus)) d.final = true;
    }
  }
  for (const d of sent) { log(`B ${d.label} SON DURUM ${d.number}`, { eStatus: d.eStatus }); check(["sent", "accepted"].includes(d.eStatus), `${d.label} ${d.number}: son durum ${d.eStatus}`); }
  await b.server.close();
}
console.log(`\nSONUÇ: ${failed ? `${failed} kaldı` : "hepsi geçti"}`);
process.exitCode = failed ? 1 : 0;
