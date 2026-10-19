// Dar kontrol 3 (2.4.3; bağımsız denetçi betikleri dar3-243 t8-vekil, t9-imlec) — e-Belge gönderim. Sahte EDM; ağa çıkmaz; sahte saat (ders 13).
//   B-1 ORTA (B3 gerilemesi)  Vekil sunucu kapalı / reddetti / kimlik istedi (lib/net-proxy.mjs ProxyError: proxy-unreachable, proxy-refused,
//              proxy-auth) — tünel kurulmadı, istek EDM'ye ULAŞMADI. edm.mjs bu kodları tanımıyor, "belirsiz" sayıyordu: önbellekte taze oturum (son 5 dk)
//              varken Kaydet ve Gönder numara verip bırakmıyordu (kâhin K12) ve "istek EDM'ye ulaşmış olabilir" diyordu. Karar: bu üç kod "kesin
//              ulaşmadı" (integrator-unreachable); numara geri bırakılır, Tümünü Gönder numara vermez. proxy-request (tünel kurulduktan sonra) belirsiz kalır.
//   B-2 DÜŞÜK  Tümünü Gönder imleci sürerken imleçten ÖNCE sıralanan yeni belge (aynı gün daha erken saat) kaydedilince tur onu denemiyor, sonraki
//              belgeleri "daha eski tarihli belge gönderilemedi; önce onu düzeltip yeniden gönderin" diye bekletiyordu (yanlış neden). Karar: bu turda
//              denenmez (B1: turda her belge en çok bir kez), sonrakiler GİB kronolojisi için bekler; ileti "bu gönderim sürerken kaydedildi … Tümünü
//              Gönder'e yeniden basın" der, yanıt rerun: true taşır; yeni basış en eski belgeden başlar ve sıra (numara ↔ tarih) bozulmaz.
// Nasıl bozulur: oturum önbellekte taze / bayat, vekil hatası cause zincirinde, ileti sonunda nokta, tur ortasında eski belge, yeni basışta sıra.
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { createEdmClient, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { ProxyError } from "../server/lib/net-proxy.mjs";
import { BUYER_VKN, OUR_VKN, startMockEdm } from "./einvoice-mock.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const SELLER = { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" };
const person = (name, taxNo) => ({ name, type: "customer", partyKind: "person", firstName: name.split(" ")[0], familyName: name.split(" ").slice(1).join(" ") || "Kişi", taxNo, taxOffice: "Konak", address: "Kordon 1", district: "Konak", city: "İzmir" });
const LINES = [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }];
const opOf = raw => (/<(?:\w+:)?(\w+)Request[\s>]/.exec(String(raw || "").replace(/<(?:\w+:)?(Envelope|Header|Body)[\s>]/g, "")) || [])[1] || "GET";
// Vekil sunucunun gerçek hata biçimleri (net-proxy.mjs tunnel()/viaProxy() ile aynı ileti ve kod).
const PROXY_ERRORS = {
  "proxy-unreachable": () => new ProxyError("Vekil sunucuya bağlanılamadı (10.0.0.1:8080): ECONNREFUSED", { code: "proxy-unreachable", status: 502 }),
  "proxy-refused": () => new ProxyError("Vekil sunucu bağlantıyı reddetti (403).", { code: "proxy-refused", status: 502 }),
  "proxy-auth": () => new ProxyError("Vekil sunucu kimlik doğrulaması istiyor (407). Vekil Sunucu adresine kullanıcı adı ve parolayı yazın (http://kullanici:parola@sunucu:port).", { code: "proxy-auth", status: 502 }),
};

async function setup() {
  resetEdmCaches();
  const edm = await startMockEdm();
  // net.proxy: o anda vekil sunucunun verdiği hata kodu (yalnız ops'taki işlemlerde; boş = bütün işlemler).
  const net = { proxy: "", only: null, ops: {} };
  const fetchImpl = async (input, init) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
    const op = opOf(init?.body);
    net.ops[op] = (net.ops[op] || 0) + 1;
    if (net.proxy && (!net.only || net.only.includes(op))) throw PROXY_ERRORS[net.proxy]();
    return globalThis.fetch(input, init);
  };
  const server = await startTestServer({ edocEnabled: true, fetchImpl, now: "2026-06-17T09:00:00", edocStatusPollMs: [5, 5], env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  const client = server.client();
  const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)) };
  assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
  assert.equal((await api.put("/api/workspace/invoices/settings", { seller: SELLER, efatura: true, earsiv: true })).status, 200);
  assert.equal((await api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } })).status, 200);
  const today = (await api.get("/api/workspace/ledger/lock")).data.today;
  assert.equal(today, "2026-06-17");
  const people = [];
  for (const [name, taxNo] of [["Ayşe Kaya", "10000000146"], ["Mehmet Demir", "12345678950"], ["Zeynep Şahin", "11223344550"]]) {
    const created = await api.post("/api/workspace/accounts", person(name, taxNo));
    assert.equal(created.status, 200, JSON.stringify(created.data));
    people.push(created.data.id);
  }
  const firm = (await api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", partyKind: "company", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" })).data.id;
  const day = offset => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
  };
  const sale = async (accountId, extra = {}) => {
    const saved = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId, lines: LINES, payment: { rest: "open" }, ...extra });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    return saved.data;
  };
  const card = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  const numbers = () => server.app.store.all("SELECT number, issue_date AS issueDate, issue_time AS issueTime, e_status AS eStatus FROM invoices WHERE seq > 0 ORDER BY series, seq");
  const close = async () => {
    await server.close();
    await edm.close();
  };
  return { edm, net, server, api, people, firm, day, sale, card, numbers, close };
}

describe("gg243 dar kontrol 3: vekil sunucu hatası kesin ulaşmadı (B-1), imleçten önce kaydedilen belge (B-2)", () => {
  const open = [];
  after(async () => {
    for (const ctx of open) await ctx.close();
  });

  test("B-1 birim: proxy-unreachable / proxy-refused / proxy-auth → integrator-unreachable (vekil iletisi, çift nokta yok); proxy-request belirsiz kalır", async () => {
    const edm = await startMockEdm();
    try {
      const XML = '<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ProfileID>EARSIVFATURA</cbc:ProfileID></Invoice>';
      const errorOf = async promise => {
        try {
          await promise;
        } catch (error) {
          return error;
        }
        assert.fail("hata bekleniyordu");
      };
      const cases = [
        ["proxy-unreachable", PROXY_ERRORS["proxy-unreachable"], "EDM'ye bağlanılamadı: Vekil sunucuya bağlanılamadı (10.0.0.1:8080). Ağ ayarındaki vekil sunucu adresini kontrol edin."],
        ["proxy-refused", PROXY_ERRORS["proxy-refused"], "EDM'ye bağlanılamadı: Vekil sunucu bağlantıyı reddetti (403). Ağ ayarındaki vekil sunucu adresini kontrol edin."],
        ["proxy-auth", PROXY_ERRORS["proxy-auth"], "EDM'ye bağlanılamadı: Vekil sunucu kimlik doğrulaması istiyor (407). Vekil Sunucu adresine kullanıcı adı ve parolayı yazın (http://kullanici:parola@sunucu:port). Ağ ayarındaki vekil sunucu adresini kontrol edin."],
        // cause zinciri: üst katman sarmalasa da (fetch failed → cause ProxyError) tanınır.
        ["cause:proxy-unreachable", () => Object.assign(new TypeError("fetch failed"), { cause: PROXY_ERRORS["proxy-unreachable"]() }), "EDM'ye bağlanılamadı: Vekil sunucuya bağlanılamadı (10.0.0.1:8080). Ağ ayarındaki vekil sunucu adresini kontrol edin."],
      ];
      for (const [label, make, message] of cases) {
        resetEdmCaches();
        let down = false;
        const fetchImpl = async (input, init) => {
          if (down && opOf(init?.body) === "SendInvoice") throw make();
          return globalThis.fetch(input, init);
        };
        const client = createEdmClient({ baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", fetchImpl });
        await client.ensureSession();
        down = true;
        const error = await errorOf(client.send({ xml: XML, number: "TEA2026000000001", uuid: "11111111-2222-3333-4444-555555555555", earchive: true, senderVkn: "1234567890" }));
        assert.equal(error.code, "integrator-unreachable", `${label}: ${error.code} ${error.message}`);
        assert.equal(error.message, message, label);
      }
      resetEdmCaches();
      let down = false;
      const client = createEdmClient({ baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", fetchImpl: async (input, init) => {
        if (down && opOf(init?.body) === "SendInvoice") throw new ProxyError("Vekil sunucu üzerinden istek kurulamadı: ECONNRESET", { code: "proxy-request" });
        return globalThis.fetch(input, init);
      } });
      await client.ensureSession();
      down = true;
      const error = await errorOf(client.send({ xml: XML, number: "TEA2026000000001", uuid: "11111111-2222-3333-4444-555555555556", earchive: true, senderVkn: "1234567890" }));
      assert.equal(error.code, "integrator-uncertain", "tünel kurulduktan sonraki hata: istek EDM'ye ulaşmış olabilir");
    } finally {
      await edm.close();
    }
  });

  test("B-1: taze oturum varken vekil kapalı → Kaydet ve Gönder numara VERMEZ (bırakır), ileti vekili söyler; üç vekil kodu için de", async () => {
    const ctx = await setup();
    open.push(ctx);
    const warm = await ctx.sale(ctx.firm, { eSend: "now" });
    assert.equal(warm.number, "TEF2026000000001");
    assert.equal(warm.eStatus, "sent");
    for (const code of ["proxy-unreachable", "proxy-refused", "proxy-auth"]) {
      // Oturum taze: son EDM yanıtı az önce (5 dk içinde) — numara öncesi denetim EDM'ye gitmez; hata ancak gönderimde çıkar.
      const warmAgain = await ctx.sale(ctx.firm, { eSend: "now" });
      assert.equal(warmAgain.eStatus, "sent", `${code}: ısınma gönderildi`);
      const loginsBefore = ctx.net.ops.Login || 0;
      ctx.net.proxy = code;
      ctx.net.only = ["SendInvoice"];
      const saved = await ctx.sale(ctx.firm, { eSend: "now" });
      ctx.net.proxy = "";
      assert.equal(ctx.net.ops.Login || 0, loginsBefore, `${code}: taze oturum — numara öncesi yeniden giriş yok (koşul kuruldu)`);
      assert.equal(saved.number, "", `${code}: numara geri bırakıldı`);
      assert.equal(saved.eStatus, "waiting", `${code}: numarasız bekliyor`);
      assert.match(saved.eMessage || "", /EDM'ye bağlanılamadı: Vekil sunucu/, `${code}: ${saved.eMessage}`);
      assert.doesNotMatch(saved.eMessage || "", /ulaşmış olabilir/, code);
    }
    const series = ctx.numbers().filter(row => row.number.startsWith("TEF"));
    assert.deepEqual(series.map(row => row.number), ["TEF2026000000001", "TEF2026000000002", "TEF2026000000003", "TEF2026000000004"], "seride boşluk ve askıda numara yok");
    assert.ok(series.every(row => row.eStatus === "sent"));
  });

  test("B-1: taze oturum varken vekil kapalı → Tümünü Gönder numara vermez, tur durur; vekil gelince sırayla gider", async () => {
    const ctx = await setup();
    open.push(ctx);
    for (let i = 0; i < 3; i += 1) await ctx.sale(ctx.firm, { issueDate: ctx.day(-1), eSend: "later" });
    const warm = await ctx.sale(ctx.firm, { issueDate: ctx.day(-2), eSend: "now" });
    assert.equal(warm.eStatus, "sent");
    ctx.net.proxy = "proxy-unreachable";
    ctx.net.only = ["SendInvoice"];
    const turn = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(turn.status, 200, JSON.stringify(turn.data));
    assert.equal(turn.data.sent, 0);
    assert.equal(turn.data.stopped?.code, "integrator-unreachable", JSON.stringify(turn.data));
    assert.deepEqual(ctx.numbers().map(row => row.number), ["TEF2026000000001"], "vekil kapalıyken numara verilmedi");
    ctx.net.proxy = "";
    const again = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(again.data.sent, 3, JSON.stringify(again.data));
    assert.deepEqual(ctx.numbers().map(row => row.number), ["TEF2026000000001", "TEF2026000000002", "TEF2026000000003", "TEF2026000000004"]);
  });

  test("B-2: tur sürerken imleçten önce kaydedilen belge sonrakileri doğru iletiyle bekletir (rerun); yeni basışta hepsi tarih sırasıyla gider", async () => {
    const ctx = await setup();
    open.push(ctx);
    for (let i = 0; i < 20; i += 1) await ctx.sale(ctx.people[i % 2], { issueDate: ctx.day(-2), issueTime: "10:00", eSend: "later" });
    for (let i = 0; i < 3; i += 1) await ctx.sale(ctx.people[i % 2], { issueDate: ctx.day(-1), issueTime: "10:00", eSend: "later" });
    const first = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(first.data.sent, 20);
    assert.equal(first.data.remaining, 3);
    assert.ok(first.data.cursor, "imleç");
    assert.equal(first.data.rerun, undefined);
    // İmleçten önce sıralanan yeni belge: aynı gün, daha erken saat.
    const late = await ctx.sale(ctx.people[0], { issueDate: ctx.day(-2), issueTime: "09:00", eSend: "later" });
    assert.equal(late.eStatus, "waiting");
    const second = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true, after: first.data.cursor });
    assert.equal(second.status, 200, JSON.stringify(second.data));
    assert.equal(second.data.sent, 0, "GİB kronolojisi: eski numarasız varken yeni numara yok");
    assert.equal(second.data.skipped, 3);
    assert.equal(second.data.rerun, true, "tur yarım kaldı: istemciye bildirilir");
    for (const item of second.data.results) {
      assert.equal(item.code, "einvoice-held");
      assert.equal(item.reason, "queued");
      assert.match(item.message, /bu gönderim sürerken kaydedildi ya da tarihi değişti; bu turda denenmedi\. Tümünü Gönder'e yeniden basın/);
      assert.doesNotMatch(item.message, /gönderilemedi|düzeltip/, "yanlış neden yazılmaz");
    }
    assert.equal((await ctx.card(late.id)).eMessage || "", "", "denenmeyen belgeye hata yazılmadı");
    // Yeni basış en eski belgeden başlar: 09:00 belgesi 20 belgeden sonra numara alır ama tarihi (gün) aynı; ertesi günün belgeleri ondan sonra.
    const third = await ctx.api.post("/api/workspace/invoices/send-pending", { all: true });
    assert.equal(third.data.sent, 4, JSON.stringify(third.data).slice(0, 400));
    assert.equal(third.data.rerun, undefined);
    const rows = ctx.numbers().filter(row => row.number.startsWith("TEA"));
    assert.equal(rows.length, 24);
    for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i - 1].issueDate <= rows[i].issueDate, `numara sırası tarih sırasıyla: ${rows[i - 1].number} ${rows[i - 1].issueDate} → ${rows[i].number} ${rows[i].issueDate}`);
    assert.equal(rows[20].issueTime, "09:00", "geç kaydedilen eski belge ertesi günün belgelerinden önce");
  });
  // Bu turda gönderilemeyen (hatası yazılmış) eski belgenin "failed" iletisi: test/gg243-dar2-gonderim.test.mjs B1 (değişmeden yeşil kalmalı).
});
