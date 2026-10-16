// e-Belge yalnız TEST ortamıyla açılır (kullanıcı kararı 16.10.2026: "entegre et ama müşteriler şimdilik sadece test linki girip deneme
// yapabilsin; sorunsuzca 'canlıyı da aç' dersem o kısmı da aktif edersin") + üç güvence (kullanıcı: "önerilerin mantıklı, yapalım"):
//   1. Test ortamına giden belge "Test" olarak işaretlenir (listede rozet, PDF başlığı + notu, e-Belge görünüm şablonunda kırmızı şerit).
//   2. Test belgeleri ayrı seriden (TEF / TEA / TES) numara alır: canlıya geçince firmanın serisi 1'den başlar; test numarası değişmez;
//      test serisinden numara almış belge canlıda gönderilmez; firma bu seri adlarını kendi serisi olarak seçemez.
//   3. Entegratör kartında test hesabı notu (arayüz: e2e senaryo-entegrator-240).
// "Nasıl bozulur?": üretim girişi e-Belgeyi kapalı bırakır ya da canlıyı açar; test belgesi firmanın serisini tüketir; test ortamında kesilip
// gönderilmeden canlıya geçilen belge gerçek belge gibi gider; Gönderilecekler'deki (numarasız) belge canlıda test serisi alır; kullanıcı kendi
// serisini TEF yapar ve test/canlı belgeleri karışır.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { embeddedXslt, renderView } from "../tools/ebelge/dogrula.mjs";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { pdfText } from "./banka-210-ortak.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const strip = source => source.replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/).map(line => line.replace(/^\s*\/\/.*$/, "")).join("\n");
const year = () => new Date().getFullYear();

describe("Üretim girişi: e-Belge açık, canlı ortam kilitli", () => {
  test("server/server.mjs e-Belgeyi açar, canlıyı açmaz; config canlıyı ortam değişkeniyle açmaz", () => {
    const entry = strip(readFileSync(new URL("../server/server.mjs", import.meta.url), "utf8"));
    assert.match(entry, /createApp\(\{\s*edocEnabled:\s*true\s*\}\)/, "üretim girişi edocEnabled: true verir");
    assert.doesNotMatch(entry, /edocLive/, "üretim girişi canlıyı açmaz");
    const config = strip(readFileSync(new URL("../server/lib/config.mjs", import.meta.url), "utf8"));
    assert.match(config, /edocLive:\s*overrides\.edocLive === true,/, "canlı yalnız program içinden (ortam değişkeni yok)");
  });
});

describe("Test ortamı belgeleri (sahte EDM)", () => {
  let edm;
  let server;
  let api;
  let client;
  let buyerId;
  let personId;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    // Üretimdeki gibi: e-Belge açık, canlı kilitli.
    server = await startTestServer({ edocEnabled: true });
    client = server.client();
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

  test("canlı ortam seçilemez (400); ayarlar test serisinin sıradaki numarasını gösterir, firmanın serisi 1'de kalır", async () => {
    const live = await api.put("/api/workspace/invoices/settings", { integrator: { env: "live" } });
    assert.equal(live.status, 400);
    assert.equal(live.data.code, "integrator-live-locked");
    const s = (await api.get("/api/workspace/invoices/settings")).data;
    assert.deepEqual(s.testSeries, { efatura: "TEF", earsiv: "TEA", esmm: "TES" });
    assert.equal(s.testNumbers.efatura.number, `TEF${year()}000000001`);
    assert.equal(s.nextNumbers.efatura.number, `EFT${year()}000000001`);
  });

  test("test ortamında e-Fatura TEF, e-Arşiv TEA serisinden; belge 'Test' işaretli; firmanın serisi tüketilmez", async () => {
    const efatura = (await sale(buyerId, 100)).data;
    const earsiv = (await sale(personId, 100)).data;
    assert.equal(efatura.number, `TEF${year()}000000001`);
    assert.equal(earsiv.number, `TEA${year()}000000001`);
    assert.equal(efatura.eTest, true);
    assert.equal(earsiv.eTest, true);
    const list = (await api.get("/api/workspace/invoices?tab=all")).data;
    const row = (list.items || list.invoices || list.rows || []).find(item => item.id === efatura.id);
    assert.equal(row?.eTest, true, "listede de Test işareti");
    const s = (await api.get("/api/workspace/invoices/settings")).data;
    assert.equal(s.nextNumbers.efatura.number, `EFT${year()}000000001`, "firmanın serisi hâlâ 1'den başlar");
    assert.equal(s.testNumbers.efatura.number, `TEF${year()}000000002`);
    const sent = await api.post(`/api/workspace/invoices/${efatura.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.equal(edm.state.sent.at(-1).id, `TEF${year()}000000001`, "EDM'ye test numarasıyla gitti");
  });

  test("Gönderilecekler'deki belge numarasını gönderimde test serisinden alır", async () => {
    const later = (await sale(buyerId, 50, { eSend: "later" })).data;
    const sent = await api.post(`/api/workspace/invoices/${later.id}/send`, {});
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    assert.equal(sent.data.number, `TEF${year()}000000002`);
    assert.equal(sent.data.eTest, true);
  });

  test("test belgesinin PDF'i ve e-Belge görünümü TEST yazar; kâğıt belge yazmaz", async () => {
    const doc = (await sale(buyerId, 70)).data;
    const pdf = await client.raw("GET", `/api/workspace/invoices/${doc.id}/fatura.pdf`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.match(text, /e-FATURA · TEST/, text.slice(0, 300));
    assert.match(text, /TEST ORTAMI: Bu belge entegratörün test ortamında denenmiştir; yasal geçerliliği yoktur\./);
    const xml = (await client.get(`/api/workspace/invoices/${doc.id}/ubl.xml`)).data;
    const view = renderView(xml, embeddedXslt(xml)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    assert.match(view, /TEST ORTAMI — Bu belge deneme amaçlıdır; yasal geçerliliği yoktur\./);
  });

  test("firma kendi serisini TEF / TEA / TES yapamaz (400 series-reserved)", async () => {
    for (const series of [{ efatura: "TEF" }, { earsiv: "TEA" }, { paper: "TES" }]) {
      const response = await api.put("/api/workspace/invoices/settings", { series });
      assert.equal(response.status, 400, JSON.stringify(series));
      assert.equal(response.data.code, "series-reserved");
    }
  });
});

describe("Canlıya geçiş (canlı kilidi açılmış kurulum)", () => {
  let edm;
  let server;
  let api;
  let buyerId;
  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    server = await startTestServer({ edocEnabled: true, edocLive: true });
    const client = server.client();
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    await api.put("/api/workspace/invoices/settings", {
      seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
      efatura: true,
      earsiv: true,
      integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
    });
    const account = await api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" });
    buyerId = account.data.id || account.data.account?.id;
  });
  after(async () => {
    await server?.close();
    await edm?.close();
  });
  const sale = (price, extra = {}) => api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyerId, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: price, vatRate: 20 }], payment: { rest: "open" }, ...extra });

  test("testte 2 belge (TEF 1–2) → canlıya geçince ilk belge EFT …001; test belgesi Test kalır, numarası değişmez", async () => {
    const first = (await sale(100)).data;
    const second = (await sale(110)).data;
    assert.deepEqual([first.number, second.number], [`TEF${year()}000000001`, `TEF${year()}000000002`]);
    const live = await api.put("/api/workspace/invoices/settings", { integrator: { env: "live" } });
    assert.equal(live.status, 200, JSON.stringify(live.data));
    assert.equal(live.data.testNumbers, null, "canlıda test numarası gösterilmez");
    const real = (await sale(120)).data;
    assert.equal(real.number, `EFT${year()}000000001`, "firmanın serisi 1'den");
    assert.equal(real.eTest, false);
    const again = (await api.get(`/api/workspace/invoices/${first.id}`)).data;
    assert.equal(again.number, `TEF${year()}000000001`);
    assert.equal(again.eTest, true);
    // Testte numara alıp gönderilmemiş belge canlıda gönderilmez.
    const refused = await api.post(`/api/workspace/invoices/${second.id}/send`, {});
    assert.equal(refused.status, 409);
    assert.equal(refused.data.code, "einvoice-test-series");
    assert.ok(!edm.state.sent.some(item => item.id === second.number), "EDM'ye gitmedi");
  });
});
