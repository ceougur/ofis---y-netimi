// Portala taslak yükleme (İz 7.3; kullanıcı kararı 16.10.2026: "isteğe bağlı olarak olsun"). Sahte EDM (test/einvoice-mock.mjs) GERÇEK EDM test
// ortamında görülen davranışı taşır (docs/kanit/2026-10-16/edm-taslak): LoadInvoice → LOAD - SUCCEED; aynı ETTN ile yeniden yükleme içeriği
// değiştirir; taslağı gönderme SendInvoice (CONTENT boş + UUID); gönderilmiş belgeyi yükleme 11056, ikinci taslak gönderimi 11028; e-Arşiv taslağı
// CancelInvoice ile iptal edilir. "Nasıl bozulur?": ayar kapalıyken taslak; taslaktan sonra belgeyi düzenleyip eski taslağı gönderme; portaldan
// gönderilmiş taslağı programdan yeniden yükleme; taslaktaki e-Fatura'yı programda iptal edip portalda bırakma; taslağı silme; Kaydet ve Gönder.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const payable = xml => xml.match(/<cbc:PayableAmount currencyID="TRY">([^<]*)</)?.[1];

describe("Portala taslak (sahte EDM)", () => {
  let edm;
  let server;
  let api;
  let buyerId;
  let personId;
  const calls = op => edm.state.calls.filter(call => call.op === op).length;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true });
    const client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", {
      seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
      efatura: true,
      earsiv: true,
      integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const account = async body => {
      const response = await api.post("/api/workspace/accounts", body);
      assert.equal(response.status, 200, JSON.stringify(response.data));
      return response.data.id || response.data.account?.id;
    };
    buyerId = await account({ name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
    personId = await account({ name: "Ayşe Demir", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Demir", taxNo: "10000000078", city: "İzmir", address: "Karşıyaka 9", district: "Karşıyaka" });
  });
  after(async () => {
    await server?.close();
    await edm?.close();
  });
  const sale = (accountId, price, extra = {}) => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: price, vatRate: 20 }], payment: { rest: "open" }, ...extra });

  test("ayar kapalıyken taslak düğmesi yok ve uç 409; belge her zamanki gibi gönderilebilir", async () => {
    const doc = await sale(buyerId, 100);
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    assert.equal(doc.data.canDraft, false);
    assert.equal(doc.data.canSend, true);
    const refused = await api.post(`/api/workspace/invoices/${doc.data.id}/e-draft`, {});
    assert.equal(refused.status, 409);
    assert.equal(refused.data.code, "einvoice-draft-off");
    assert.equal(calls("LoadInvoice"), 0);
  });

  test("8 günden eski e-Arşiv taslağı da iptal edilir (GİB'e gitmedi; 8 gün kuralı gönderilmiş belge için)", async () => {
    await api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: true } });
    const old = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const doc = (await sale(personId, 40, { issueDate: old })).data;
    assert.equal(doc.profile, "EARSIVFATURA", JSON.stringify(doc).slice(0, 300));
    const loaded = await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
    assert.equal(loaded.data.eStatus, "draft", JSON.stringify(loaded.data).slice(0, 300));
    const done = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Eski taslak" });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.eStatus, "cancelled");
    assert.ok(edm.state.cancelled.includes(doc.ettn));
  });

  test("taslak yükle → düzenle (taslak eskidi) → yenile (EDM'deki içerik değişti) → gönder: giden belge son hâl", async () => {
    const on = await api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: true } });
    assert.equal(on.data.eOptions.draftUpload, true);
    const doc = (await sale(buyerId, 1000)).data;
    assert.equal(doc.canDraft, true);
    const loaded = await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
    assert.equal(loaded.status, 200, JSON.stringify(loaded.data));
    assert.equal(loaded.data.eStatus, "draft");
    assert.equal(loaded.data.eStatusLabel, "Portalda Taslak");
    assert.equal(loaded.data.draftStale, false);
    assert.equal(edm.state.drafts.get(doc.ettn).loads, 1);
    assert.equal(payable(edm.state.drafts.get(doc.ettn).xml), "1200.00");
    assert.equal(edm.state.sent.length, 0, "taslak gönderilmedi");
    // Durum Sorgula taslağı tanır.
    const refreshed = await api.post(`/api/workspace/invoices/${doc.id}/e-refresh`, {});
    assert.equal(refreshed.data.eStatus, "draft");
    // Taslak düzenlenebilir; düzenlemeden sonra EDM'deki kopya eski.
    assert.equal(refreshed.data.canModify, true, refreshed.data.modifyBlock);
    const edited = await api.post(`/api/workspace/invoices/${doc.id}/edit`, { accountId: buyerId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1500, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.equal(edited.data.eStatus, "draft");
    assert.equal(edited.data.draftStale, true, "düzenleme sonrası taslak eski");
    // Yenileme başarısız olursa (EDM geçici hata) taslak hâlâ eski: uyarı kalkmaz.
    edm.state.failNextLoad = true;
    const failedReload = await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
    assert.notEqual(failedReload.status, 200);
    const afterFail = (await api.get(`/api/workspace/invoices/${doc.id}`)).data;
    assert.equal(afterFail.eStatus, "draft");
    assert.equal(afterFail.draftStale, true, "başarısız yenilemeden sonra taslak hâlâ eski");
    assert.equal(edm.state.drafts.get(doc.ettn).loads, 1);
    const reloaded = await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
    assert.equal(reloaded.data.draftStale, false);
    assert.equal(edm.state.drafts.get(doc.ettn).loads, 2);
    assert.equal(payable(edm.state.drafts.get(doc.ettn).xml), "1800.00", "EDM'deki taslak yeni tutarda");
    // Düzenle → doğrudan Gönder: önce son hâl yüklenir.
    await api.post(`/api/workspace/invoices/${doc.id}/edit`, { accountId: buyerId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 2000, vatRate: 20 }], payment: { rest: "open" } });
    const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.equal(sent.data.eStatus, "sent");
    const out = edm.state.sent.find(item => item.uuid === doc.ettn);
    assert.equal(out.fromDraft, true, "taslak gönderildi (CONTENT boş)");
    assert.equal(payable(out.xml), "2400.00", "giden belge programdaki son hâl (2.000 + %20)");
    assert.equal(sent.data.payableTotal, 2400);
    // Gönderilen belge artık düzenlenmez, yeniden yüklenmez.
    assert.equal(sent.data.canModify, false);
    assert.equal(sent.data.canDraft, false);
    const again = await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
    assert.equal(again.status, 409);
    assert.deepEqual(edm.state.violations, []);
  });

  test("taslak EDM portalından gönderildiyse program yeniden yüklemez (11056 yok); durumu EDM'den alır", async () => {
    const doc = (await sale(buyerId, 300)).data;
    await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
    edm.sendFromPortal(doc.ettn);
    const loadsBefore = calls("LoadInvoice");
    const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.equal(sent.data.eStatus, "sent");
    assert.match(sent.data.sendResult.message, /artık taslak değil/);
    assert.equal(calls("LoadInvoice"), loadsBefore, "yükleme yapılmadı");
    assert.equal(edm.state.sent.filter(item => item.uuid === doc.ettn).length, 1, "ikinci gönderim yok");
  });

  test("Kaydet ve Gönder (eSend now) ayar açıkken taslak yükler; Gönderilecekler'den toplu gönderim de", async () => {
    const now = await sale(buyerId, 50, { eSend: "now" });
    assert.equal(now.status, 200, JSON.stringify(now.data));
    const fresh = (await api.get(`/api/workspace/invoices/${now.data.id}`)).data;
    assert.equal(fresh.eStatus, "draft");
    assert.ok(edm.state.drafts.has(fresh.ettn));
    assert.ok(!edm.state.sent.some(item => item.uuid === fresh.ettn));
    const later = await sale(buyerId, 60, { eSend: "later" });
    const bulk = await api.post("/api/workspace/invoices/send-pending", { ids: [later.data.id] });
    assert.equal(bulk.data.sent, 1, JSON.stringify(bulk.data));
    const pending = (await api.get(`/api/workspace/invoices/${later.data.id}`)).data;
    assert.equal(pending.eStatus, "draft");
    assert.ok(/^TEF\d{13}$/.test(pending.number), `numara taslak yüklenirken verildi: ${pending.number}`);
  });

  test("taslaktaki belge silinmez; e-Fatura taslağı onaysız iptal edilmez, onayla iptal edilir (EDM'ye iptal gönderilmez)", async () => {
    const doc = (await sale(buyerId, 70)).data;
    await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
    const detail = (await api.get(`/api/workspace/invoices/${doc.id}`)).data;
    assert.equal(detail.canDelete, false);
    assert.match(detail.deleteBlock, /taslak/);
    const refused = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Vazgeçildi" });
    assert.equal(refused.status, 409);
    assert.equal(refused.data.code, "einvoice-draft");
    const cancelsBefore = calls("CancelInvoice");
    const done = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Vazgeçildi", confirmExternal: true });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.status, "cancelled");
    assert.equal(calls("CancelInvoice"), cancelsBefore);
  });

  test("e-Arşiv taslağı iptal edilince EDM'de de iptal edilir", async () => {
    const doc = (await sale(personId, 80)).data;
    assert.equal(doc.profile, "EARSIVFATURA");
    const loaded = await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
    assert.equal(loaded.data.eStatus, "draft");
    assert.equal(edm.state.drafts.get(doc.ettn).earchive, "true");
    const done = await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Vazgeçildi" });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(done.data.eStatus, "cancelled");
    assert.ok(edm.state.cancelled.includes(doc.ettn));
    assert.deepEqual(edm.state.violations, []);
  });

  test("ayar sonradan kapatılsa da taslaktaki belge yenilenip gönderilebilir; yeni belge yine doğrudan gönderilir", async () => {
    const doc = (await sale(buyerId, 90)).data;
    await api.post(`/api/workspace/invoices/${doc.id}/e-draft`, {});
    await api.put("/api/workspace/invoices/settings", { eOptions: { draftUpload: false } });
    const detail = (await api.get(`/api/workspace/invoices/${doc.id}`)).data;
    assert.equal(detail.canDraft, true, "taslaktaki belge yenilenebilir");
    const sent = await api.post(`/api/workspace/invoices/${doc.id}/send`, {});
    assert.equal(sent.data.eStatus, "sent");
    const direct = (await sale(buyerId, 95, { eSend: "now" })).data;
    const fresh = (await api.get(`/api/workspace/invoices/${direct.id}`)).data;
    assert.ok(["sent", "processing"].includes(fresh.eStatus), fresh.eStatus);
    assert.ok(!edm.state.drafts.has(fresh.ettn), "taslak yüklenmedi");
  });
});
