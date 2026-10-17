// 2.4.1 (kullanıcı kararı 16.10.2026: "bilgi eklentisini 2.4.1'e bırakalım"): EDM girişi reddedilince (gerçek canlı adreste test hesabıyla
// "Kullanıcı Bulunamadı! (EDM hata kodu 11010)" — docs/kanit/2026-10-16/canli-kart) ileti seçili ortamın hesabına yönlendirir.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SETTINGS = "/api/workspace/invoices/settings";
const TEST = "/api/workspace/invoices/integrator/test";

describe("EDM girişi reddedilince ileti seçili ortamın hesabına yönlendirir (2.4.1)", () => {
  let edm;
  let server;
  let client;
  const put = async body => unwrap(await client.put(SETTINGS, body));
  const tested = async () => unwrap(await client.post(TEST, {}));
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, edocLive: true });
    client = server.client();
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await put({
      seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
      efatura: true,
      earsiv: true,
      integrator: { env: "test", baseUrl: edm.url, username: "testhesabi", password: "Yanlis-Parola", senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
  });
  after(async () => {
    await server.close();
    await edm.close();
  });

  test("Canlı Ortam: ileti EDM'nin canlı hesabını ister; Durum satırına da aynı ileti yazılır", async () => {
    assert.equal((await put({ integrator: { env: "live", baseUrl: edm.url, password: "Yanlis-Parola" } })).status, 200);
    const failed = await tested();
    assert.notEqual(failed.status, 200);
    const message = JSON.stringify(failed.data);
    assert.match(message, /EDM isteği reddetti/, "EDM'nin kendi iletisi kalır");
    assert.match(message, /Canlı Ortam'da EDM'nin canlı hesabının kullanıcı adı ve parolası girilir/);
    assert.doesNotMatch(message, /test hesabının kullanıcı adı/);
    const last = (await put({ integrator: { autoSend: false } })).data.integrator.lastTest;
    assert.equal(last.ok, false);
    assert.match(last.message, /canlı hesabının kullanıcı adı ve parolası/);
  });

  test("Test Ortamı: ileti EDM'nin test hesabını ister", async () => {
    assert.equal((await put({ integrator: { env: "test", baseUrl: edm.url, password: "Yanlis-Parola" } })).status, 200);
    const message = JSON.stringify((await tested()).data);
    assert.match(message, /Test Ortamı'nda EDM'nin test hesabının kullanıcı adı ve parolası girilir/);
    assert.doesNotMatch(message, /canlı hesabının/);
  });

  test("Giriş doğruysa ileti eklenmez; başka bir EDM reddi (giriş dışı) yönlendirme almaz", async () => {
    assert.equal((await put({ integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1" } })).status, 200);
    const ok = await tested();
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.doesNotMatch(JSON.stringify(ok.data), /hesabının kullanıcı adı/);
    const checked = unwrap(await client.post("/api/workspace/invoices/check-user", { taxNo: "1" }));
    assert.doesNotMatch(JSON.stringify(checked.data), /hesabının kullanıcı adı/);
  });
});
