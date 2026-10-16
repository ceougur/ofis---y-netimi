// 2.4.0 dar kontrol turu 3 (16.10.2026; kapsam 90aecfb..9cefa41: çıkış yolu, mükellef koruması, RECEIVE eşlemesi). Bulgular ana oturumda yeniden
// üretildi (docs/2.4.0-IS-LISTESI.md "Dar kontrol turu 3"). "Nasıl bozulur?" — her test bir bulgunun yolu:
//   B1 YÜKSEK  kimliksiz (perakende) cari + belgeye yazılan mükellef VKN'si → koruma perakende cariyi başka firmanın posta kutusuyla e-Fatura
//              mükellefi işaretler; sonraki kişi satışı e-Fatura olarak o kutuya gider.
//   B2 YÜKSEK  belirsiz gönderim → Yalnız Programda İptal Et → Sil → numara yeni belgeye verilir (Y3 geri gelir). Aynı sınıf: EDM'de iptal
//              edilmiş e-Arşiv, onaylı iptal edilmiş e-Fatura, portalda taslak — numarası entegratörde kullanılmış iptal belgesi silinir.
//   B3 ORTA    Fatura Ayarları yetkisi olmayan kullanıcı gönderilmiş e-Arşivi "localOnly" ile EDM'ye sormadan yalnız programda iptal eder.
//   B4 ORTA    "buyer-alias" iletisinin söylediği yapılınca (cari kartında posta kutusu) gönderim yine aynı hatayla düşer.
//   B5 ORTA    mükellef sorgusu bağlantı hatası verince numara yine harcanır; belge önce belirsiz, sonra hiç gönderilemez.
//   B6 ORTA    (iki şirket / on kullanıcı yük denemesinde bulundu) iki kullanıcı aynı e-Arşivi aynı anda iptal eder → program bir kez iptal
//              eder ama EDM'ye iki iptal isteği gider, işlem kaydında iki "EDM'de iptal" satırı olur.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, createUser, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const BUYER = { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" };
const PERSON = { name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka", email: "ayse@example.com" };

describe("Dar kontrol turu 3 bulguları (sahte EDM; ağa çıkmaz)", () => {
  let edm;
  let server;
  let client;
  let api;
  let buyerId;
  let personId;
  let loseSendResponse = false;
  let down = false;
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    if (down) throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
    const response = await globalThis.fetch(input, init);
    if (loseSendResponse && /SendInvoiceRequest/.test(String(init?.body || ""))) {
      loseSendResponse = false;
      await response.text();
      throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) });
    }
    return response;
  };
  const sale = (accountId, extra = {}, lines = [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }]) => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines, payment: { rest: "open" }, ...extra });
  const card = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  const audits = id => server.app.store.all("SELECT type FROM audit_events WHERE entity_id = ? ORDER BY rowid", id).map(row => row.type);
  // e-Arşiv'i EDM'de "SUCCEED"e getirir (sahte EDM ilk sorguda işleniyor der).
  const settle = async id => {
    let last = "";
    for (let i = 0; i < 4 && last !== "sent"; i += 1) last = (await api.post(`/api/workspace/invoices/${id}/e-refresh`, {})).data?.eStatus;
    assert.equal(last, "sent");
  };
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, fetchImpl });
    client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), del: async url => unwrap(await client.raw("DELETE", url)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    buyerId = (await api.post("/api/workspace/accounts", BUYER)).data.id;
    personId = (await api.post("/api/workspace/accounts", PERSON)).data.id;
    assert.ok(buyerId && personId);
  });
  after(async () => {
    await server?.close();
    await edm?.close();
  });

  test("B1: belgeye yazılan mükellef VKN'si perakende cariyi e-Fatura mükellefi yapmaz; sonraki kişi satışı e-Arşiv kalır", async () => {
    const retail = await api.post("/api/workspace/accounts", { name: "Perakende Müşteri", type: "customer", partyKind: "person" });
    assert.equal(retail.status, 200, JSON.stringify(retail.data));
    const retailId = retail.data.id;
    const doc = await sale(retailId, { eSend: "later", buyer: { name: "Alıcı Ticaret A.Ş.", taxNo: BUYER_VKN, address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara" } });
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    assert.equal(doc.data.profile, "EARSIVFATURA");
    const sent = await api.post(`/api/workspace/invoices/${doc.data.id}/send`, {});
    assert.equal(sent.status, 409, JSON.stringify(sent.data));
    assert.equal(sent.data.code, "buyer-is-efatura");
    assert.equal((await card(doc.data.id)).number, "", "numara verilmedi");
    const account = server.app.store.get("SELECT e_invoice AS e, e_alias AS a FROM accounts WHERE id = ?", retailId);
    assert.deepEqual({ ...account }, { e: 0, a: "" }, "kimliksiz perakende cari işaretlenmedi");
    assert.match(sent.data.error, /carisini|cari kartı/i);
    const next = await sale(retailId, { eSend: "later", buyer: { name: "Mehmet Kaya", taxNo: "10000000078", address: "Konak 1", district: "Konak", city: "İzmir" } });
    assert.equal(next.status, 200, JSON.stringify(next.data));
    assert.equal(next.data.profile, "EARSIVFATURA", "sonraki kişi satışı e-Arşiv");
  });

  test("B1 (komşu): carinin KENDİ numarası mükellefse cari işaretlenir (önceki davranış korunur)", async () => {
    const own = await api.post("/api/workspace/accounts", { ...BUYER, name: "Sorgulanmamış Mükellef A.Ş.", eInvoice: false, eAlias: "" });
    const doc = await sale(own.data.id, { eSend: "later" });
    assert.equal(doc.data.profile, "EARSIVFATURA");
    const sent = await api.post(`/api/workspace/invoices/${doc.data.id}/send`, {});
    assert.equal(sent.data.code, "buyer-is-efatura");
    const account = server.app.store.get("SELECT e_invoice AS e FROM accounts WHERE id = ?", own.data.id);
    assert.equal(account.e, 1);
  });

  test("B2: belirsiz gönderim → Yalnız Programda İptal Et → Sil reddedilir; numara yeni belgeye verilmez", async () => {
    const doc = (await sale(buyerId, { eSend: "later" })).data;
    loseSendResponse = true;
    await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    const first = await card(doc.id);
    assert.match(first.number, /^TEF/);
    assert.ok(edm.state.sent.some(item => item.uuid === first.ettn), "belge EDM'ye ulaştı");
    const local = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "EDM'ye ulaşılamıyor", localOnly: true, confirmLocal: true });
    assert.equal(local.status, 200, JSON.stringify(local.data));
    const cancelled = await card(doc.id);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.canDelete, false, "silinemez");
    assert.match(cancelled.deleteBlock, /numara|entegratör/i);
    const del = await api.del(`/api/workspace/invoices/${doc.id}?reason=x`);
    assert.equal(del.status, 409, JSON.stringify(del.data));
    const next = (await sale(buyerId)).data;
    assert.equal((await api.post(`/api/workspace/invoices/${next.id}/send`, {})).status, 200);
    assert.notEqual((await card(next.id)).number, first.number, "numara yeniden verilmedi");
  });

  test("B2 (aynı sınıf): EDM'de iptal edilmiş e-Arşiv ve onaylı iptal edilmiş e-Fatura silinmez; hiç gönderilmemiş fiş silinir", async () => {
    const arsiv = (await sale(personId)).data;
    const arsivSent = await api.post(`/api/workspace/invoices/${arsiv.id}/send`, {});
    assert.equal(arsivSent.status, 200, JSON.stringify(arsivSent.data));
    await settle(arsiv.id);
    const arsivCancel = await api.post(`/api/workspace/invoices/${arsiv.id}/cancel`, { reason: "x" });
    assert.equal(arsivCancel.status, 200, JSON.stringify(arsivCancel.data));
    const arsivCard = await card(arsiv.id);
    assert.equal(arsivCard.eStatus, "cancelled");
    assert.equal(arsivCard.canDelete, false);
    assert.equal((await api.del(`/api/workspace/invoices/${arsiv.id}?reason=x`)).status, 409);

    const fatura = (await sale(buyerId)).data;
    assert.equal((await api.post(`/api/workspace/invoices/${fatura.id}/send`, {})).status, 200);
    await settle(fatura.id);
    assert.equal((await api.post(`/api/workspace/invoices/${fatura.id}/cancel`, { reason: "x", confirmExternal: true })).status, 200);
    assert.equal((await card(fatura.id)).canDelete, false);
    assert.equal((await api.del(`/api/workspace/invoices/${fatura.id}?reason=x`)).status, 409);

    const slip = (await sale(personId, { eSend: "later" })).data;
    assert.equal((await api.post(`/api/workspace/invoices/${slip.id}/withdraw`, {})).status, 200);
    assert.equal((await api.post(`/api/workspace/invoices/${slip.id}/cancel`, { reason: "x" })).status, 200);
    assert.equal((await card(slip.id)).canDelete, true, "entegratöre hiç gitmemiş fiş silinir");
  });

  test("B3: gönderilmiş e-Arşivi yalnız programda iptal Fatura Ayarları yetkisi + onay ister ve işlem kaydına düşer", async () => {
    const doc = (await sale(personId)).data;
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/send`, {})).status, 200);
    await settle(doc.id);
    const lawyer = await createUser(server, { post: async (url, body) => client.post(url, body) }, { username: "avukat-k3", role: "avukat" });
    const before = edm.state.cancelled.length;
    const forbidden = unwrap(await lawyer.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "x", localOnly: true, confirmExternal: true }));
    assert.equal(forbidden.status, 403, JSON.stringify(forbidden.data));
    assert.equal((await card(doc.id)).status, "issued");
    const unconfirmed = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "x", localOnly: true });
    assert.equal(unconfirmed.status, 409);
    assert.equal(unconfirmed.data.code, "einvoice-local-confirm");
    const done = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "EDM portalından iptal edildi", localOnly: true, confirmLocal: true });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(edm.state.cancelled.length, before, "EDM'ye iptal gönderilmedi (yalnız program)");
    assert.ok(audits(doc.id).includes("invoice.e.local-cancel"));
  });

  test("B4: buyer-alias iletisinin söylediği yapılınca gönderim geçer", async () => {
    const account = await api.post("/api/workspace/accounts", { ...BUYER, name: "Kutusu Bilinmeyen A.Ş.", eInvoice: true, eAlias: "" });
    const doc = (await sale(account.data.id, { eSend: "later" })).data;
    assert.equal(doc.profile, "TEMELFATURA");
    const first = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(first.data.code, "buyer-alias");
    // İletinin dediği: cari kartında posta kutusu seçilir.
    const put = await api.put(`/api/workspace/accounts/${account.data.id}`, { ...BUYER, name: "Kutusu Bilinmeyen A.Ş.", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
    assert.equal(put.status, 200, JSON.stringify(put.data));
    const again = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    if (again.status !== 200) {
      // İleti "Düzenle ile yeniden kaydedin" diyorsa onu yapmak yeter.
      assert.match(first.data.error, /Düzenle/);
      const full = await card(doc.id);
      const edited = await api.post(`/api/workspace/invoices/${doc.id}/edit`, { kind: full.kind, scenario: full.scenario, accountId: account.data.id, issueDate: full.issueDate, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } });
      assert.equal(edited.status, 200, JSON.stringify(edited.data));
      assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/send`, {})).status, 200);
    }
    assert.match((await card(doc.id)).number, /^TEF/);
  });

  test("B5: mükellef sorgusu bağlantı hatasıyla düşerse numara verilmez; belge belirsiz kalmaz", async () => {
    const unknown = await api.post("/api/workspace/accounts", { ...BUYER, name: "Sorgulanmamış İkinci A.Ş.", eInvoice: false, eAlias: "" });
    const doc = (await sale(unknown.data.id, { eSend: "later" })).data;
    assert.equal(doc.profile, "EARSIVFATURA");
    down = true;
    let sent;
    try {
      sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    } finally {
      down = false;
    }
    assert.notEqual(sent.status, 200);
    const row = await card(doc.id);
    assert.equal(row.number, "", `numara verilmedi (${row.number})`);
    assert.equal(row.eStatus, "waiting", "Gönderilecekler'de kaldı");
    const retry = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(retry.data.code, "buyer-is-efatura");
    assert.equal((await card(doc.id)).number, "");
  });

  test("B6: aynı e-Arşivi iki kullanıcı aynı anda iptal eder → EDM'ye tek iptal isteği, tek işlem kaydı", async () => {
    const doc = (await sale(personId)).data;
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/send`, {})).status, 200);
    await settle(doc.id);
    const other = server.client();
    assert.equal((await other.login("admin", ADMIN_PASSWORD)).status, 200);
    const before = edm.state.cancelled.length;
    const [a, b] = await Promise.all([api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "A" }), other.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "B" }).then(unwrap)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], JSON.stringify([a.data, b.data]));
    assert.equal(edm.state.cancelled.length - before, 1, "EDM'ye tek iptal isteği");
    assert.equal(audits(doc.id).filter(type => type === "invoice.e.cancelled").length, 1);
    assert.equal(audits(doc.id).filter(type => type === "invoice.cancelled").length, 1);
  });
});
