// 2.4.4 E7 (eleştirmen 31d, 22.10.2026; karar kullanıcı adına 5 dk yetkisiyle — K4 16.10.2026 "belirsiz / portalda taslak belge yalnız programda iptal edilir"):
// "Yalnız Programda İptal" (cancel { localOnly, confirmLocal }) sunucuda EKRANLA ve K4 ile AYNI koşulda: yalnız sonucu belirsiz gönderim ya da EDM portalına
// taslak olarak yüklenmiş belge. EDM'nin işlediği / kabul ettiği / reddettiği belgede 409 "einvoice-local-not-allowed" ve ne yapılacağı ("İptal Et'i
// kullanın"). Kural TEK yerde (routes/invoices.mjs localCancelKind): kart (canLocalCancel) ve sunucu aynı işlevi okur. 8 günü geçmiş belirsiz gönderimde
// önce EDM durum sorgusu (madde 23 eki) aynen kalır (test/ebelge-244-iptal-suresi.test.mjs).
// Kök neden (ad865f0, 2.4.3'te e-Arşiv'de de): bypass = localOnly && (stuck || remoteEligible) — EDM'de iptal edilecek e-Arşiv / e-SMM de yalnız programda
// iptal ediliyordu (yetki + onayla); belge GİB'de geçerli kalırken programda "İptal Edildi".
//
// "Nasıl bozulur?" (önce yazıldı — not defteri e67/NASIL-BOZULUR.md):
//   P1 EDM'nin kabul ettiği e-Arşiv → localOnly 200 (kök)          P2 e-SMM gönderildi            P3 işleniyor / kabul / Hata
//   P4 belirsiz → 200 (değişmez)     P5 portal taslağı → 200 (değişmez)     P6 e-Fatura gönderildi, Müşteri Fişi, numarasız bekleyen → 409
//   P7 yetkisiz: uygun belgede 403, uygun olmayanda 409              P9 her durumda kart (canLocalCancel) ⇔ sunucu kabulü
//   P10 toplu iptal (bulk-cancel localOnly) belge belge aynı kural   (P8 süre dolmuş → cancel-late önce: ebelge-244-iptal-suresi)
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, createUser, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const BUYER = { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" };
const CLIENT = { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: vkn(111222333), taxOffice: "Konak", address: "Kordon 5", district: "Konak", city: "İzmir", email: "muhasebe@muvekkil.com.tr" };
const PERSON = { name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka", email: "ayse@example.com" };
const LOCAL = { reason: "EDM'ye ulaşılamıyor", localOnly: true, confirmLocal: true };

describe("E7: Yalnız Programda İptal sunucuda ekranla ve K4 ile aynı koşulda (sahte EDM; ağa çıkmaz)", () => {
  let edm;
  let server;
  let client;
  let api;
  const ids = {};
  const sale = (accountId, extra = {}) => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, eSend: "later", ...extra });
  const makbuz = (extra = {}) => api.post("/api/workspace/invoices", { scenario: "smm", accountId: ids.client, lines: [{ name: "Avukatlık Ücreti", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" }, eSend: "later", ...extra });
  const card = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  const audits = id => server.app.store.all("SELECT type FROM audit_events WHERE entity_id = ? ORDER BY rowid", id).map(row => row.type);
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  // Gönder → sahte EDM ilk sorguda "işleniyor" der; Durum Sorgula ile "Gönderildi"ye getirilir.
  const sent = async (create, label) => {
    const doc = await must(`${label} kayıt`, create());
    await must(`${label} gönder`, api.post(`/api/workspace/invoices/${doc.id}/send`, {}));
    let last = "";
    for (let i = 0; i < 4 && last !== "sent"; i += 1) last = (await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {})).data?.eStatus;
    assert.equal(last, "sent", `${label}: ön koşul EDM'de gönderildi`);
    return doc.id;
  };
  // Belge durumları (P9 tablosu): her biri yeni belge; beklenen = ekranın düğmesi (K4).
  const states = {
    "e-Arşiv gönderildi (EDM kabul etti)": { local: false, make: () => sent(() => sale(ids.person), "e-Arşiv") },
    "e-SMM gönderildi": { local: false, make: () => sent(() => makbuz(), "e-SMM") },
    "e-Fatura gönderildi": { local: false, make: () => sent(() => sale(ids.buyer), "e-Fatura") },
    "e-Arşiv işleniyor": { local: false, make: async () => setState(await sent(() => sale(ids.person), "işleniyor"), "processing") },
    "e-Arşiv Hata (EDM reddetti)": { local: false, make: async () => setState(await sent(() => sale(ids.person), "hata"), "error") },
    "Müşteri Fişi (Gönderilmeyecek)": { local: false, make: async () => slip() },
    "numarasız bekleyen (Gönderilecek)": { local: false, make: async () => (await must("bekleyen", sale(ids.person))).id },
    "sonucu belirsiz gönderim": { local: true, make: async () => setState(await sent(() => sale(ids.person), "belirsiz"), "none") },
    "portalda taslak": { local: true, make: async () => draft() },
  };
  const setState = (id, eStatus) => {
    server.app.store.run("UPDATE invoices SET e_status = ? WHERE id = ?", eStatus, id);
    return id;
  };
  // Sonucu belirsiz (kart "Sonucu Belirsiz"): gönderim isteği EDM'ye gitti, yanıt gelmedi — durum "none", e_adapter yazılı (uncertainSend; iptal-suresi
  // testindeki kurulum). Müşteri Fişi: "Kes, Sonra Gönder" → Müşteri Fişi Olarak Bırak.
  const slip = async () => {
    const doc = await must("fiş kayıt", sale(ids.person));
    await must("fiş bırak", api.post(`/api/workspace/invoices/${doc.id}/withdraw`, {}));
    return doc.id;
  };
  const draft = async () => {
    await must("taslak açık", api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: true } }));
    try {
      const doc = await must("taslak belge", sale(ids.person));
      assert.equal((await must("portala taslak", api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {}))).eStatus, "draft");
      return doc.id;
    } finally {
      await must("taslak kapalı", api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: false } }));
    }
  };
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, esmmEnabled: true, edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    await must("ayar", api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, esmm: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
    for (const [key, body] of [["buyer", BUYER], ["client", CLIENT], ["person", PERSON]]) ids[key] = (await must(key, api.post("/api/workspace/accounts", body))).id;
  });
  after(async () => {
    await server?.close();
    await edm?.close();
  });

  test("P1: EDM'nin kabul ettiği e-Arşiv yalnız programda iptal edilmez (409, ne yapılacağını söyler); İptal Et ile EDM'de de iptal edilir", async () => {
    const id = await sent(() => sale(ids.person), "e-Arşiv");
    const before = edm.state.cancelled.length;
    assert.equal((await card(id)).canLocalCancel, false, "ekranda düğme yok");
    const refused = await api.post(`/api/workspace/invoices/${id}/cancel`, LOCAL);
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "einvoice-local-not-allowed");
    assert.equal(refused.data.error, "Bu belge EDM'ye iletildi (durum: Gönderildi); yalnız programda iptal edilmez. İptal için İptal Et'i kullanın: belge EDM'de de iptal edilir.");
    const after = await card(id);
    assert.equal(after.status, "issued", "belge iptal edilmedi (veri tabanı)");
    assert.equal(after.eStatus, "sent");
    assert.equal(edm.state.cancelled.length, before);
    assert.ok(!audits(id).includes("invoice.e.local-cancel"), "işlem kaydına yerel iptal düşmedi");
    // İletinin söylediği yol çalışır.
    const done = await must("İptal Et", api.post(`/api/workspace/invoices/${id}/cancel`, { reason: "test: İptal Et" }));
    assert.equal(done.status, "cancelled");
    assert.equal(edm.state.cancelled.length, before + 1, "EDM'de de iptal edildi");
  });

  test("P2/P3: e-SMM gönderildi, e-Arşiv işleniyor ve Hata: 409; iletiler durumu söyler", async () => {
    const smmId = await states["e-SMM gönderildi"].make();
    const smm = await api.post(`/api/workspace/invoices/${smmId}/cancel`, LOCAL);
    assert.equal(smm.status, 409, JSON.stringify(smm.data));
    assert.equal(smm.data.code, "einvoice-local-not-allowed");
    assert.match(smm.data.error, /^Bu belge EDM'ye iletildi \(durum: Gönderildi\); yalnız programda iptal edilmez\. İptal için İptal Et'i kullanın: belge EDM'de de iptal edilir\.$/);
    assert.equal((await card(smmId)).status, "issued");
    const busyId = await states["e-Arşiv işleniyor"].make();
    const busy = await api.post(`/api/workspace/invoices/${busyId}/cancel`, LOCAL);
    assert.equal(busy.status, 409);
    assert.match(busy.data.error, /durum: İşleniyor/);
    const errorId = await states["e-Arşiv Hata (EDM reddetti)"].make();
    const error = await api.post(`/api/workspace/invoices/${errorId}/cancel`, LOCAL);
    assert.equal(error.status, 409);
    assert.equal(error.data.code, "einvoice-local-not-allowed");
    assert.match(error.data.error, /EDM'de “Hata” durumunda; yalnız programda iptal edilmez\. İptal için İptal Et'i kullanın: belge EDM'de yoksa program onu yalnız programda iptal eder\./);
    for (const id of [busyId, errorId]) assert.equal((await card(id)).status, "issued");
  });

  test("P9 tek kural: her belge durumunda kartın 'Yalnız Programda İptal Et' düğmesi ile sunucunun kabulü aynı", async () => {
    const rows = [];
    for (const [name, state] of Object.entries(states)) {
      const id = await state.make();
      const shown = (await card(id)).canLocalCancel;
      const res = await api.post(`/api/workspace/invoices/${id}/cancel`, LOCAL);
      const status = (await card(id)).status;
      rows.push({ name, shown, accepted: res.status === 200, status, code: res.data?.code || "" });
      assert.equal(shown, state.local, `${name}: ekran ${shown}`);
      assert.equal(res.status === 200, shown, `${name}: ekran ${shown}, sunucu ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      assert.equal(status, shown ? "cancelled" : "issued", `${name}: veri tabanı`);
      if (!shown) assert.equal(res.data.code, "einvoice-local-not-allowed", `${name}: ${JSON.stringify(res.data)}`);
    }
    assert.equal(rows.length, Object.keys(states).length, JSON.stringify(rows));
  });

  test("P7 yetkisiz: Fatura Ayarları yetkisi olmayan uygun belgede 403, uygun olmayan belgede 409; belge değişmez", async () => {
    const lawyer = await createUser(server, { post: async (url, body) => client.post(url, body) }, { username: "avukat-e7", role: "avukat" });
    const stuckId = await states["sonucu belirsiz gönderim"].make();
    const sentId = await states["e-Arşiv gönderildi (EDM kabul etti)"].make();
    const forbidden = unwrap(await lawyer.post(`/api/workspace/invoices/${stuckId}/cancel`, LOCAL));
    assert.equal(forbidden.status, 403, JSON.stringify(forbidden.data));
    const refused = unwrap(await lawyer.post(`/api/workspace/invoices/${sentId}/cancel`, LOCAL));
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.equal(refused.data.code, "einvoice-local-not-allowed");
    for (const id of [stuckId, sentId]) assert.equal((await card(id)).status, "issued");
  });

  test("P10 toplu iptal: localOnly belge belge aynı kurala uyar (gönderilmiş red, belirsiz iptal)", async () => {
    const sentId = await states["e-Arşiv gönderildi (EDM kabul etti)"].make();
    const stuckId = await states["sonucu belirsiz gönderim"].make();
    const bulk = await must("toplu iptal", api.post("/api/workspace/invoices/bulk-cancel", { ids: [sentId, stuckId], ...LOCAL }));
    const byId = Object.fromEntries(bulk.results.map(item => [item.id, item]));
    assert.equal(byId[sentId].ok, false, JSON.stringify(bulk.results));
    assert.equal(byId[sentId].code, "einvoice-local-not-allowed");
    assert.equal(byId[stuckId].ok, true, JSON.stringify(bulk.results));
    assert.equal((await card(sentId)).status, "issued");
    assert.equal((await card(stuckId)).status, "cancelled");
  });
});
