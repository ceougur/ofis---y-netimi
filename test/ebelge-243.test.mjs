// 2.4.3 (kullanıcının EDM test denemesi, 17.10.2026; TESTER — şahıs TCKN 12345678950, cari kartında elle "e-Fatura mükellefi"):
//   1. "Kaydet ve Gönder" belgeyi TEF numarasıyla kaydetti, gönderim "posta kutusu bilinmiyor" diye düştü (numara harcandı).
//   2. Mükellef Sorgula işareti kaldırınca Düzenle'de "e-Arşiv" seçilebildi; belge TEF numarasıyla e-Arşiv oldu (seri türe bağlıdır).
//   3. Nakit ödenen belgenin görünümü "Ödeme Şekli: Havale / EFT" dedi ("Ödeme şeklini yaz" kapalıyken IBAN varsa 42).
// Nasıl bozulur listesi: Kaydet ve Gönder / düz Kaydet / Kes, Sonra Gönder; taslaktan kesme; Temel ↔ Ticari (aynı seri, serbest kalmalı);
// numarasız (Kes, Sonra Gönder) belgede tür değişimi (serbest kalmalı); 2.4.0–2.4.2'de dokunulmadan "false" yazılmış ayar; kullanıcının
// bilerek kapattığı ayar. Sahte EDM; ağa çıkmaz.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const IBAN = "TR330006100519786457841326";
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr", banks: [{ name: "Örnek Bankası", iban: IBAN }] };
const TESTER = { name: "TESTER", type: "customer", partyKind: "person", firstName: "Testler", familyName: "Testlerle", taxNo: "12345678950", taxOffice: "TESTER", address: "test sok. no:36", district: "Kemalpaşa", city: "Samsun", eInvoice: true, eAlias: "" };
const FIRM = { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" };
const LINES = [{ name: "HİZMET SATIŞI", qty: 1, unitPrice: 869, vatRate: 20 }];

describe("2.4.3: belge türü kilidi, posta kutusu numaradan önce, ödeme şekli varsayılan açık", () => {
  let edm;
  let server;
  let api;
  let testerId;
  let firmId;
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    return globalThis.fetch(input, init);
  };
  const sale = (accountId, extra = {}) => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: LINES, payment: { rest: "open" }, ...extra });
  const card = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
  const nextTef = async () => (await api.post("/api/workspace/invoices/calc", { scenario: "service_sale", accountId: firmId, lines: LINES, payment: { rest: "open" } })).data.nextNumber;
  const xmlOf = async id => {
    const response = await api.get(`/api/workspace/invoices/${id}/ubl.xml`);
    assert.equal(response.status, 200);
    return typeof response.data === "string" ? response.data : response.text;
  };
  const means = xml => [...xml.matchAll(/<cbc:PaymentMeansCode>([^<]*)</g)].map(match => match[1]);
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, fetchImpl, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    testerId = (await api.post("/api/workspace/accounts", TESTER)).data.id;
    firmId = (await api.post("/api/workspace/accounts", FIRM)).data.id;
    assert.ok(testerId && firmId);
  });
  after(async () => {
    await server?.close();
    await edm?.close();
  });

  test("1a: posta kutusu yokken Kaydet ve Gönder numara harcamadan durur; ileti doğru yolu söyler", async () => {
    const before = count();
    const next = await nextTef();
    const response = await sale(testerId, { eSend: "now" });
    assert.equal(response.status, 409, JSON.stringify(response.data));
    assert.equal(response.data.code, "buyer-alias");
    assert.match(response.data.error, /numara harcanmadı/);
    assert.match(response.data.error, /Mükellef Sorgula/);
    assert.match(response.data.error, /e-Arşiv/);
    assert.equal(count(), before, "belge yazılmadı");
    assert.equal(await nextTef(), next, "TEF sırası ilerlemedi");
  });

  test("1b: düz Kaydet de (numara hemen verilir) durur; Kes, Sonra Gönder kaydeder (numara gönderimde)", async () => {
    const plain = await sale(testerId);
    assert.equal(plain.status, 409, JSON.stringify(plain.data));
    assert.equal(plain.data.code, "buyer-alias");
    const later = await sale(testerId, { eSend: "later" });
    assert.equal(later.status, 200, JSON.stringify(later.data));
    assert.equal(later.data.number, "", "numarasız bekler");
  });

  test("1c: formun ön hesabı posta kutusu uyarısını kaydetmeden gösterir; posta kutusu varken uyarı yok", async () => {
    const calc = async accountId => (await api.post("/api/workspace/invoices/calc", { scenario: "service_sale", accountId, lines: LINES, payment: { rest: "open" } })).data.warnings || [];
    assert.ok((await calc(testerId)).some(item => /posta kutusu \(PK\) seçilmemiş/.test(item)), JSON.stringify(await calc(testerId)));
    assert.ok(!(await calc(firmId)).some(item => /posta kutusu/.test(item)));
  });

  test("1d: taslaktan Kaydet ve Gönder de numara harcamadan durur", async () => {
    const draft = await sale(testerId, { status: "draft" });
    assert.equal(draft.status, 200, JSON.stringify(draft.data));
    const next = await nextTef();
    const issued = await api.post(`/api/workspace/invoices/${draft.data.id}/issue`, { eSend: "now" });
    assert.equal(issued.status, 409, JSON.stringify(issued.data));
    assert.equal(issued.data.code, "buyer-alias");
    assert.equal((await card(draft.data.id)).status, "draft");
    assert.equal(await nextTef(), next);
  });

  test("2a: numara almış e-Fatura Düzenle ile e-Arşive çevrilemez (önceden 200: TEF numaralı e-Arşiv)", async () => {
    const account = (await api.post("/api/workspace/accounts", { ...FIRM, name: "Sonradan Mükellef Olmayan A.Ş.", taxNo: "1234567890" })).data;
    const doc = (await sale(account.id)).data;
    assert.match(doc.number, /^TEF/);
    assert.equal(doc.profile, "TEMELFATURA");
    // Mükellef Sorgula "mükellef değil" der: işaret kalkar.
    assert.equal((await api.put(`/api/workspace/accounts/${account.id}`, { ...FIRM, name: "Sonradan Mükellef Olmayan A.Ş.", taxNo: "1234567890", eInvoice: false, eAlias: "" })).status, 200);
    const full = await card(doc.id);
    const toArchive = await api.post(`/api/workspace/invoices/${doc.id}/edit`, { kind: full.kind, scenario: full.scenario, accountId: account.id, issueDate: full.issueDate, profile: "EARSIVFATURA", lines: LINES, payment: { rest: "open" } });
    assert.equal(toArchive.status, 409, JSON.stringify(toArchive.data));
    assert.equal(toArchive.data.code, "profile-locked");
    assert.match(toArchive.data.error, /İptal Et/);
    const plain = await api.post(`/api/workspace/invoices/${doc.id}/edit`, { kind: full.kind, scenario: full.scenario, accountId: account.id, issueDate: full.issueDate, lines: LINES, payment: { rest: "open" } });
    assert.equal(plain.status, 409, JSON.stringify(plain.data));
    assert.equal(plain.data.code, "profile-locked");
    const after = await card(doc.id);
    assert.equal(after.profile, "TEMELFATURA");
    assert.equal(after.number, doc.number);
    // İletinin dediği yol: iptal + yeniden kes → e-Arşiv (TEA).
    assert.equal((await api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "yanlış belge türü" })).status, 200);
    const again = await sale(account.id);
    assert.equal(again.status, 200, JSON.stringify(again.data));
    assert.match(again.data.number, /^TEA/);
    assert.equal(again.data.profile, "EARSIVFATURA");
  });

  test("2b: komşu — Temel ↔ Ticari (aynı seri) ve aynı türde satır düzeltmesi serbest", async () => {
    const doc = (await sale(firmId)).data;
    const full = await card(doc.id);
    const body = { kind: full.kind, scenario: full.scenario, accountId: firmId, issueDate: full.issueDate, payment: { rest: "open" } };
    const ticari = await api.post(`/api/workspace/invoices/${doc.id}/edit`, { ...body, profile: "TICARIFATURA", lines: LINES });
    assert.equal(ticari.status, 200, JSON.stringify(ticari.data));
    assert.equal((await card(doc.id)).profile, "TICARIFATURA");
    const lines = await api.post(`/api/workspace/invoices/${doc.id}/edit`, { ...body, lines: [{ name: "HİZMET SATIŞI", qty: 2, unitPrice: 869, vatRate: 20 }] });
    assert.equal(lines.status, 200, JSON.stringify(lines.data));
    const after = await card(doc.id);
    assert.equal(after.number, doc.number);
    assert.equal(after.profile, "TICARIFATURA");
  });

  test("2c: komşu — numarasız (Kes, Sonra Gönder) belgede tür değişimi serbest; gönderimde doğru seriden numara", async () => {
    const account = (await api.post("/api/workspace/accounts", { ...FIRM, name: "Numarasız Bekleyen A.Ş.", taxNo: "9876543217" })).data;
    const doc = (await sale(account.id, { eSend: "later" })).data;
    assert.equal(doc.number, "");
    assert.equal((await api.put(`/api/workspace/accounts/${account.id}`, { ...FIRM, name: "Numarasız Bekleyen A.Ş.", taxNo: "9876543217", eInvoice: false, eAlias: "" })).status, 200);
    const full = await card(doc.id);
    const edited = await api.post(`/api/workspace/invoices/${doc.id}/edit`, { kind: full.kind, scenario: full.scenario, accountId: account.id, issueDate: full.issueDate, profile: "EARSIVFATURA", lines: LINES, payment: { rest: "open" }, eSend: "later" });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.equal((await card(doc.id)).profile, "EARSIVFATURA");
  });

  test("3a: ödeme şekli varsayılan AÇIK — nakit peşin belge 10 (Nakit), Havale / EFT (42) değil", async () => {
    const settings = (await api.get("/api/workspace/invoices/settings")).data;
    assert.equal(settings.eOptions.paymentMeans, true);
    const doc = await sale(firmId, { payment: { cash: [{ amount: 1042.8, method: "cash" }], rest: "open" } });
    assert.equal(doc.status, 200, JSON.stringify(doc.data));
    assert.deepEqual(means(await xmlOf(doc.data.id)), ["10"]);
  });

  test("3b: 2.4.0–2.4.2'den dokunulmadan kalan false varsayılana döner; kullanıcının bilerek kapattığı korunur", async () => {
    const key = "invoice.settings";
    const raw = JSON.parse(server.app.store.setting(key, "{}"));
    server.app.store.setSetting(key, JSON.stringify({ ...raw, eOptions: { balanceNote: false, paymentMeans: false, draftUpload: false }, eOptionsSet: undefined }));
    assert.equal((await api.get("/api/workspace/invoices/settings")).data.eOptions.paymentMeans, true, "eski kayıttaki dokunulmamış false");
    const off = await api.put("/api/workspace/invoices/settings", { eOptions: { paymentMeans: false } });
    assert.equal(off.status, 200, JSON.stringify(off.data));
    assert.equal((await api.get("/api/workspace/invoices/settings")).data.eOptions.paymentMeans, false, "bilerek kapatılan");
    assert.equal((await api.put("/api/workspace/invoices/settings", { defaults: { dueDays: 0 } })).status, 200);
    assert.equal((await api.get("/api/workspace/invoices/settings")).data.eOptions.paymentMeans, false, "başka ayar kaydı seçimi bozmaz");
    assert.equal((await api.put("/api/workspace/invoices/settings", { eOptions: { paymentMeans: true } })).status, 200);
  });
});
