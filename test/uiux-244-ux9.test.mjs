// 2.4.4 madde 11, uzman UX9 — SUNUCU tarafı. e-Belge taraf denetiminin her sorunu hangi cari alanından doğduğunu söyler (partyIssues) ve ön hesap
// (/invoices/calc) bunları partyFields olarak döner; fatura formu "Cariyi Düzenle"de bu alanları zorunlu işaretler. Denetimin METİNLERİ ve kuralı
// değişmez (partyProblems = partyIssues'un metinleri; gönderim/kayıt denetimi aynı fonksiyondan).
// Nasıl bozulur: alan adı cari formundaki adla uyuşmaz (form alanı işaretlenmez), kâğıt belgede alan istenir, aynı alan iki kez gelir, nihai tüketicide
// tutar sınırı, satıcı (firma) denetimi bozulur, metin değişir (kullanıcı/kılavuz/öbür testler eski metni arar).
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import * as taxId from "../server/lib/tax-id.mjs";
import { OUR_VKN, startMockEdm, vkn } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
// Cari formundaki alan adları (client/assets/hof-accounts.js editAccount + taxFields) — partyIssues yalnız bunlardan birini söyleyebilir.
const FORM_FIELDS = new Set(["name", "address", "partyKind", "taxNo", "taxOffice", "firstName", "familyName", "district", "city", "postalCode", "country", "mersisNo"]);

describe("uiux-244 UX9 sunucu", () => {
  test("partyIssues: her sorun cari formundaki bir alanı söyler; metinler partyProblems ile aynı", () => {
    assert.equal(typeof taxId.partyIssues, "function", "partyIssues dışa açık");
    const cases = [
      [{ name: "İlsiz Ltd.", partyKind: "company", taxNo: vkn(111222333) }, { profile: "EARSIV" }, ["city"]],
      [{ name: "Alıcı A.Ş.", partyKind: "company", taxNo: vkn(987654321), city: "Ankara" }, { profile: "EFATURA" }, ["taxOffice"]],
      [{ name: "Alıcı A.Ş.", partyKind: "company", taxNo: vkn(987654321), city: "Ankara" }, { profile: "EARSIV" }, []],
      [{ name: "", partyKind: "person", taxNo: "", city: "" }, { profile: "EARSIV" }, ["taxNo", "name", "city"]],
      [{ name: "Nihai Tüketici", taxNo: "11111111111", city: "Ankara" }, { profile: "EARSIV", payable: 40_000 }, ["taxNo", "address"]],
      [{ name: "Nihai Tüketici", taxNo: "11111111111", city: "Ankara" }, { profile: "EARSIV", payable: 29_000 }, []],
      [{ name: "Bozuk", partyKind: "company", taxNo: "1234567891", mersisNo: "12" }, { profile: "KAGIT" }, ["taxNo", "mersisNo"]],
      [{ name: "Kâğıt", partyKind: "company", taxNo: "" }, { profile: "KAGIT" }, []],
      [{ name: "Firma", taxNo: OUR_VKN, city: "Ankara" }, { profile: "EFATURA", role: "seller" }, ["taxOffice"]],
    ];
    for (const [party, options, fields] of cases) {
      const issues = taxId.partyIssues(party, options);
      assert.deepEqual([...new Set(issues.map(issue => issue.field))], fields, `${party.name || "(adsız)"} ${options.profile}: alanlar`);
      assert.deepEqual(issues.map(issue => issue.text), taxId.partyProblems(party, options), `${party.name || "(adsız)"}: metinler aynı`);
      for (const issue of issues) assert.ok(FORM_FIELDS.has(issue.field), `"${issue.field}" cari formunda bir alan`);
    }
    // Metin değişmez (öbür testler, kılavuz ve kullanıcı bu iletileri bilir).
    assert.deepEqual(taxId.partyProblems({ name: "İlsiz Ltd.", partyKind: "company", taxNo: vkn(111222333) }, { profile: "EARSIV" }), ["Cari (alıcı): il zorunludur (adres)."]);
  });

  const open = [];
  after(async () => {
    for (const close of open) await close();
  });

  test("ön hesap partyFields döner: e-Arşiv ilsiz alıcıda ['city'], sorunsuz alıcıda [] (kâğıt belgede [] — e-Arşiv kullanıcısı kâğıt kesemez; partyIssues KAGIT durumu birinci testte)", async () => {
    resetEdmCaches();
    const edm = await startMockEdm();
    const fetchImpl = async (input, init) => {
      const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
      if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
      return globalThis.fetch(input, init);
    };
    const server = await startTestServer({ edocEnabled: true, fetchImpl, now: "2026-11-16T10:00:00", env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    open.push(async () => {
      await server.close();
      await edm.close();
    });
    const client = server.client();
    const api = { post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    assert.equal((await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } })).status, 200);
    const ilsiz = await api.post("/api/workspace/accounts", { name: "İlsiz Ticaret Ltd.", type: "customer", partyKind: "company", taxNo: vkn(111222333), address: "Gazi Cd. 5" });
    assert.equal(ilsiz.status, 200);
    const tam = await api.post("/api/workspace/accounts", { name: "Tam Bilgili Ltd.", type: "customer", partyKind: "company", taxNo: vkn(222111333), address: "Gazi Cd. 6", city: "Ankara", taxOffice: "Çankaya" });
    assert.equal(tam.status, 200);
    const calc = async accountId => {
      const r = await api.post("/api/workspace/invoices/calc", { kind: "sale", scenario: "service_sale", accountId, issueDate: "2026-11-16", issueTime: "10:00", lines: [{ name: "Danışmanlık", qty: "1", unitPrice: "1000", vatRate: 20 }] });
      assert.equal(r.status, 200, JSON.stringify(r.data).slice(0, 300));
      return r.data;
    };
    const earsiv = await calc(ilsiz.data.id);
    assert.equal(earsiv.profile, "EARSIVFATURA");
    assert.deepEqual(earsiv.partyFields, ["city"], `ilsiz e-Arşiv: ${JSON.stringify(earsiv.partyProblems)}`);
    assert.deepEqual(earsiv.partyProblems, ["Cari (alıcı): il zorunludur (adres)."]);
    assert.deepEqual((await calc(tam.data.id)).partyFields, []);
  });
});
