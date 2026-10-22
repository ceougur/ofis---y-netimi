// 2.4.4 madde 18 (E7, müşteri isteği 2; karar kullanıcı 21.10.2026 (3)): Fatura üst satırında "e-Fatura Portalı" düğmesi — EDM portalı ekran
// boyunda ayrı pencerede. Bu dosya SUNUCU tarafını sınar (adres kaynağı, yetki, ayar yok); pencere/ekran e2e'de (test/e2e/senaryo-portal-244.mjs).
//
// NASIL BOZULUR (testler buradan):
//   - Adres istemciden ya da Servis Adresi'nden gelir → başka adres açılır. Kural: adres YALNIZ sunucunun sabit listesinden (EDM_PORTAL_URLS),
//     Çalışma Ortamı'na göre (test → test portalı, live → canlı portal); Servis Adresi (baseUrl) portalı değiştirmez; bilinmeyen ortam/entegratör → "".
//   - Ortam değişince eski adres kalır (Test → Canlı geçişi): meta her istekte ayardan okunur.
//   - Yetkisiz kullanıcı adresi alır: Faturaları Görme yetkili ama Fatura Kesme ve İptal yetkisiz kullanıcıda adres GİTMEZ, neden gider.
//   - Bağlantı (kullanıcı adı + parola) kaydedilmemişken düğme açık kalır: adres gitmez, neden "Entegratör Ayarları" der.
//   - Parola ya da kullanıcı adı meta ile istemciye sızar (değişmez: parola istemciye çıkmaz).
// Eski kodda kırmızı: docs/kanit/2026-10-22/244-portal/ (eski-kirmizi-birim).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, createUser, startTestServer } from "./helpers.mjs";

const TEST_PORTAL = "https://test.edmbilisim.com.tr/EFaturaUI21ea/";
const LIVE_PORTAL = "https://portal4.edmbilisim.com.tr/EFaturaUI/";
const SETTINGS = "/api/workspace/invoices/settings";
const META = "/api/workspace/invoices/meta";
const PASSWORD = "Gizli-Portal-Parola-9";
const USERNAME = "edmportalkullanici";
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const adapters = await import("../server/lib/einvoice/adapters.mjs");
const edmLib = await import("../server/lib/einvoice/edm.mjs");

describe("e-Fatura Portalı: adres yalnız sunucunun sabit listesinden", () => {
  test("sabit liste iki EDM portalı; donmuş (değiştirilemez)", () => {
    assert.deepEqual({ ...(edmLib.EDM_PORTAL_URLS || {}) }, { test: TEST_PORTAL, live: LIVE_PORTAL });
    assert.ok(Object.isFrozen(edmLib.EDM_PORTAL_URLS), "liste donmuş");
  });
  test("ortama göre adres; Servis Adresi portalı değiştirmez; bilinmeyen ortam/entegratör → boş", () => {
    const portal = adapters.integratorPortalUrl;
    assert.equal(typeof portal, "function", "integratorPortalUrl var");
    assert.equal(portal({ id: "edm", env: "test" }), TEST_PORTAL);
    assert.equal(portal({ id: "edm", env: "live" }), LIVE_PORTAL);
    assert.equal(portal({ id: "edm", env: "test", baseUrl: "https://kotu.example.com/EFaturaUI/" }), TEST_PORTAL, "Servis Adresi portalı değiştirmez");
    assert.equal(portal({ id: "edm", env: "live", baseUrl: "http://127.0.0.1:9/EFaturaEDM.svc" }), LIVE_PORTAL);
    for (const env of ["", "prod", "LIVE", "canli", "__proto__", "constructor", undefined]) assert.equal(portal({ id: "edm", env }), "", `ortam ${String(env)}`);
    for (const id of ["", "baska", "__proto__", undefined]) assert.equal(portal({ id, env: "test" }), "", `entegratör ${String(id)}`);
    assert.equal(portal(null), "");
  });
  test("sabit liste dışındaki adres portal sayılmaz (yazım varyantları dahil)", () => {
    const isPortal = adapters.isPortalUrl;
    assert.equal(typeof isPortal, "function", "isPortalUrl var");
    assert.equal(isPortal(TEST_PORTAL), true);
    assert.equal(isPortal(LIVE_PORTAL), true);
    for (const url of ["https://kotu.example.com/", "http://test.edmbilisim.com.tr/EFaturaUI21ea/", "https://test.edmbilisim.com.tr/EFaturaUI21ea", "HTTPS://PORTAL4.EDMBILISIM.COM.TR/EFaturaUI/", "https://portal4.edmbilisim.com.tr.kotu.example/EFaturaUI/", "javascript:alert(1)", "", null]) {
      assert.equal(isPortal(url), false, String(url));
    }
  });
});

describe("e-Fatura Portalı: Fatura meta'sı (yetki, ayar yok, ortam)", () => {
  let server;
  let edm;
  let admin;
  const settingsOf = () => JSON.parse(server.app.store.setting("invoice.settings", "{}") || "{}");
  const portalOf = async client => {
    const meta = unwrap(await client.get(META));
    assert.equal(meta.status, 200, JSON.stringify(meta.data).slice(0, 300));
    return { portal: meta.data.settings?.integrator?.portal, raw: JSON.stringify(meta.data) };
  };
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, edocLive: true });
    admin = server.client();
    assert.equal((await admin.login("admin", ADMIN_PASSWORD)).status, 200);
    const seller = unwrap(await admin.put(SETTINGS, { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true }));
    assert.equal(seller.status, 200, JSON.stringify(seller.data));
  });
  after(async () => {
    await server.close();
    await edm.close();
  });

  test("bağlantı kaydedilmemiş: adres yok, neden Entegratör Ayarları'nı söyler", async () => {
    assert.equal(settingsOf().integrator?.passwordSealed || "", "", "ön koşul: parola kayıtlı değil");
    const { portal } = await portalOf(admin);
    assert.ok(portal && typeof portal === "object", `portal alanı var: ${JSON.stringify(portal)}`);
    assert.equal(portal.url, "");
    assert.match(portal.block, /Entegratör Ayarları'nda web servis kullanıcı adını ve parolasını kaydedin/);
  });

  test("Test Ortamı: test portalı; Servis Adresi (sahte EDM) portalı değiştirmez; kullanıcı adı/parola meta'ya girmez", async () => {
    const saved = unwrap(await admin.put(SETTINGS, { integrator: { env: "test", baseUrl: edm.url, username: USERNAME, password: PASSWORD } }));
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(settingsOf().integrator.env, "test");
    assert.equal(settingsOf().integrator.baseUrl, edm.url);
    const { portal, raw } = await portalOf(admin);
    assert.deepEqual(portal, { url: TEST_PORTAL, env: "test", block: "" });
    assert.ok(!raw.includes(PASSWORD), "parola meta'da yok");
    assert.ok(!raw.includes(USERNAME), "kullanıcı adı meta'da yok");
    assert.ok(!raw.includes(edm.url), "Servis Adresi meta'da yok");
  });

  test("Canlı Ortam'a geçince canlı portal; Test'e dönünce test portalı (ayar her istekte okunur)", async () => {
    const live = unwrap(await admin.put(SETTINGS, { integrator: { env: "live", baseUrl: edm.url, username: "canlikullanici", password: PASSWORD } }));
    assert.equal(live.status, 200, JSON.stringify(live.data));
    assert.equal(settingsOf().integrator.env, "live");
    assert.deepEqual((await portalOf(admin)).portal, { url: LIVE_PORTAL, env: "live", block: "" });
    const back = unwrap(await admin.put(SETTINGS, { integrator: { env: "test", baseUrl: edm.url, username: USERNAME, password: PASSWORD } }));
    assert.equal(back.status, 200, JSON.stringify(back.data));
    assert.deepEqual((await portalOf(admin)).portal, { url: TEST_PORTAL, env: "test", block: "" });
  });

  test("Faturaları Görme yetkili, Fatura Kesme ve İptal yetkisiz: adres gitmez, neden yetkiyi söyler; avukat (fatura keser) adresi alır", async () => {
    const viewer = await createUser(server, admin, { username: "portal-goren", role: "personel" });
    const created = (await admin.get("/api/admin/users")).data;
    const list = created?.data?.users || created?.users || created?.data || [];
    const id = (Array.isArray(list) ? list : []).find(user => user.username === "portal-goren")?.id;
    assert.ok(id, "kullanıcı kimliği");
    assert.equal((await admin.patch(`/api/admin/users/${id}`, { grants: { add: ["invoices.view"], remove: [] } })).status, 200);
    const { portal, raw } = await portalOf(viewer);
    assert.equal(portal.url, "");
    assert.match(portal.block, /Fatura Kesme ve İptal yetkisi ister/);
    assert.ok(!raw.includes(TEST_PORTAL) && !raw.includes(LIVE_PORTAL), "yetkisize hiçbir portal adresi gitmez");
    const lawyer = await createUser(server, admin, { username: "portal-avukat", role: "avukat" });
    assert.deepEqual((await portalOf(lawyer)).portal, { url: TEST_PORTAL, env: "test", block: "" });
  });

  test("veri tabanına elle yazılmış bilinmeyen ortam: adres açılmaz", async () => {
    const raw = settingsOf();
    raw.integrator.env = "prod";
    server.app.store.setSetting("invoice.settings", JSON.stringify(raw), null);
    const { portal } = await portalOf(admin);
    assert.equal(portal.url, "");
    assert.match(portal.block, /portal adresi programda tanımlı değil/);
    raw.integrator.env = "test";
    server.app.store.setSetting("invoice.settings", JSON.stringify(raw), null);
  });
});

describe("e-Fatura Portalı: e-Belge kapalı kurulum", () => {
  test("edocEnabled kapalı: entegratör özeti (ve portal) yok", async () => {
    const server = await startTestServer({});
    try {
      const client = server.client();
      assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
      const meta = unwrap(await client.get(META));
      assert.equal(meta.status, 200);
      assert.equal(meta.data.edocEnabled, false);
      assert.equal(meta.data.settings.integrator, null);
      assert.ok(!JSON.stringify(meta.data).includes("EFaturaUI"), "portal adresi yok");
    } finally {
      await server.close();
    }
  });
});
