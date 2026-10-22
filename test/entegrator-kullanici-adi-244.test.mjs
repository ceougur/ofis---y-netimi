// 2.4.4 madde 3 (E5; kullanıcı sorunu 19.10.2026): Entegratör Ayarları'nda Web Servis Kullanıcı Adı alanına servis ADRESİ yazılmıştı; Mükellef Sorgula
// EDM'den "Kullanıcı Bulunamadı (11010)" aldı. Kural: ad http://, https:// ya da ".svc" içeriyorsa kaydedilmez (400 integrator-username-url).
//
// NASIL BOZULUR (testler buradan):
//   - Ad olarak adres yazılır → 400, veri tabanındaki ad DEĞİŞMEZ (ders 3: yanıt + gövde + veri tabanı).
//   - Varyantlar: http://, büyük harf HTTPS://, yalnız ".svc" → hepsi reddedilir; düz ad ve baş/son boşluk (kırpılır) kabul edilir.
//   - Eski sürümde (163dd5d bu adı kabul ediyordu) adres olarak KAYDEDİLMİŞ ad: kullanıcı ada dokunmadan başka ayar (Fatura Ayarları alt notu,
//     entegratör tercihi, kartın bütün yükü aynı adla) kaydedince kilitlenmez (200); bağlantı denemesi ağa çıkmadan 409 integrator-username-url ile
//     ne yapılacağını söyler; ad düzeltilince bağlantı çalışır.
// Eski kodda kırmızı: docs/kanit/2026-10-22/244-kucuk-m3-eski-kirmizi.*
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SETTINGS = "/api/workspace/invoices/settings";
const URL_NAME = "https://test.edmbilisim.com.tr/EFaturaEDM21ea/EFaturaEDM.svc";

describe("Entegratör Ayarları: Web Servis Kullanıcı Adı alanına adres yazılamaz", () => {
  let server;
  let edm;
  let api;
  const storedName = () => JSON.parse(server.app.store.setting("invoice.settings", "{}") || "{}").integrator?.username;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true });
    const client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const saved = await api.put(SETTINGS, {
      seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
      efatura: true,
      earsiv: true,
      integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1" },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
  });
  after(async () => {
    await server.close();
    await edm.close();
  });

  test("adres yazılınca kayıt reddedilir, ne yapılacağı söylenir, kayıtlı ad değişmez", async () => {
    for (const value of [URL_NAME, "http://test.edmbilisim.com.tr/EFaturaEDM21ea/", "HTTPS://PORTAL2.EDMBILISIM.COM.TR/EFaturaEDM/EFaturaEDM.svc", "EFaturaEDM.svc", `  ${URL_NAME}  `]) {
      const bad = await api.put(SETTINGS, { integrator: { username: value } });
      assert.equal(bad.status, 400, `${value}: ${JSON.stringify(bad.data)}`);
      assert.equal(bad.data.code, "integrator-username-url", value);
      assert.equal(bad.data.field, "integrator.username", value);
      assert.match(bad.data.error, /servis adresi yazılmış/);
      assert.match(bad.data.error, /kullanıcı adını yazın \(adres değil\)/);
      assert.equal(storedName(), "edmkullanici", `${value}: veri tabanındaki ad değişmedi`);
    }
  });

  test("düz ad kabul edilir; baş/son boşluk kırpılır (mevcut davranışın kilidi)", async () => {
    const saved = await api.put(SETTINGS, { integrator: { username: "  edmkullanici  " } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.integrator.username, "edmkullanici");
    assert.equal(storedName(), "edmkullanici");
    assert.equal(saved.data.integrator.hasPassword, true, "parola korunur");
  });

  test("eski sürümde adres olarak kaydedilmiş ad: ilgisiz ayarlar kilitlenmez; bağlantı ağa çıkmadan açıklamayla durur; düzeltilince çalışır", async () => {
    // Eski sürüm (163dd5d) bu adı API'den kabul ediyordu; aynı kaydı veri tabanında kurarız (yalnız username alanı değişir).
    const raw = JSON.parse(server.app.store.setting("invoice.settings", "{}"));
    raw.integrator.username = URL_NAME;
    server.app.store.setSetting("invoice.settings", JSON.stringify(raw), null);
    assert.equal(storedName(), URL_NAME);

    const footer = await api.put(SETTINGS, { defaults: { footer: "Teşekkür ederiz." } });
    assert.equal(footer.status, 200, `Fatura Ayarları alt notu: ${JSON.stringify(footer.data)}`);
    const pref = await api.put(SETTINGS, { integrator: { earchiveEmail: false } });
    assert.equal(pref.status, 200, `entegratör tercihi: ${JSON.stringify(pref.data)}`);
    const card = await api.put(SETTINGS, { integrator: { id: "edm", env: "test", username: URL_NAME, baseUrl: edm.url, senderAlias: "", mailboxAlias: "", autoSend: false, earchiveEmail: true, autoCheckUser: false } });
    assert.equal(card.status, 200, `kart, ad değişmeden: ${JSON.stringify(card.data)}`);
    assert.equal(storedName(), URL_NAME, "değişmeyen eski ad olduğu gibi kalır");
    assert.equal(JSON.parse(server.app.store.setting("invoice.settings", "{}")).defaults.footer, "Teşekkür ederiz.");

    const calls = edm.state.calls.length;
    const tested = await api.post("/api/workspace/invoices/integrator/test", {});
    assert.equal(tested.status, 409, JSON.stringify(tested.data));
    assert.equal(tested.data.code, "integrator-username-url");
    assert.match(tested.data.error, /Entegratör Ayarları'nda Web Servis Kullanıcı Adı alanına servis adresi yazılmış/);
    assert.equal(edm.state.calls.length, calls, "EDM'ye istek gitmedi (11010 beklenmez)");
    const checked = await api.post("/api/workspace/invoices/check-user", { taxNo: OUR_VKN });
    assert.equal(checked.status, 409, JSON.stringify(checked.data));
    assert.equal(checked.data.code, "integrator-username-url");

    const fixed = await api.put(SETTINGS, { integrator: { username: "edmkullanici" } });
    assert.equal(fixed.status, 200, JSON.stringify(fixed.data));
    assert.equal(storedName(), "edmkullanici");
    const ok = await api.post("/api/workspace/invoices/integrator/test", {});
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
  });
});
