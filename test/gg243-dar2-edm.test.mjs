// Dar kontrol 2 (2.4.3) — EDM istemcisi (server/lib/einvoice/edm.mjs) birim testleri. Sahte EDM (test/einvoice-mock.mjs); ağa çıkmaz.
//   B2  bağlantı hatasının sınıfı: istek EDM'ye KESİN ulaşmadı (bağlantı kurulamadı / ad çözülemedi / bağlanma zaman aşımı / TLS) → integrator-unreachable;
//       yan etkili işlemde (gönderim) istek gittikten sonra kopma ya da yanıt zaman aşımı → integrator-uncertain. Yan etkisiz işlem (giriş, sorgu) bir kez
//       yinelenir; yine düşerse ulaşılamadı.
//   B3  oturum önbelleği erişim kanıtıdır: geçerli oturum + son 5 dk içinde EDM yanıtı → ensureSession girişsiz; bağlantı hatası kanıtı siler; parola
//       değişince kanıt sayılmaz; 5 dk sonra yeniden giriş.
//   B6  ağ yokken WSDL okunamazsa varsayılan sözleşme önbelleğe yazılmaz (önceden 12 saat; ağ gelince çağrılar sözleşmesiz biçimle gidiyordu).
import assert from "node:assert/strict";
import { after, before, describe, mock, test } from "node:test";
import { createEdmClient, resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { startMockEdm } from "./einvoice-mock.mjs";

const opOf = raw => (/<(?:\w+:)?(\w+)Request[\s>]/.exec(String(raw || "").replace(/<(?:\w+:)?(Envelope|Header|Body)[\s>]/g, "")) || [])[1] || "GET";
const failure = code => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code), { code }) });

describe("gg243 dar kontrol 2: EDM istemcisi bağlantı sınıfı, oturum kanıtı, sözleşme önbelleği", () => {
  let edm;
  before(async () => {
    edm = await startMockEdm();
  });
  after(async () => {
    await edm.close();
  });
  // plan: işlem → hata kodu (bir kez) ya da "abort"; ops: işlem sayacı.
  const clientWith = ({ plan = {}, password = "Gizli-Parola-1" } = {}) => {
    const ops = {};
    const fetchImpl = async (input, init) => {
      const op = opOf(init?.body);
      ops[op] = (ops[op] || 0) + 1;
      const step = plan[op];
      if (step) {
        const code = Array.isArray(step) ? step.shift() : step;
        if (code === "abort") throw Object.assign(new Error("aborted"), { name: "AbortError" });
        if (code) throw failure(code);
      }
      return globalThis.fetch(input, init);
    };
    return { ops, client: createEdmClient({ baseUrl: edm.url, username: "edmkullanici", password, fetchImpl }) };
  };
  const errorOf = async promise => {
    try {
      await promise;
    } catch (error) {
      return error;
    }
    assert.fail("hata bekleniyordu");
  };
  const XML = '<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ProfileID>EARSIVFATURA</cbc:ProfileID></Invoice>';
  const sendDoc = client => client.send({ xml: XML, number: "TEA2026000000001", uuid: "11111111-2222-3333-4444-555555555555", earchive: true, senderVkn: "1234567890" });

  test("B2: bağlantı kurulamadı sınıfı (ECONNREFUSED, ENOTFOUND, EAI_AGAIN, EHOSTUNREACH, bağlanma zaman aşımı, TLS) → ulaşılamadı; gönderim yapılmaz", async () => {
    for (const code of ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_CONNECT_TIMEOUT", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"]) {
      resetEdmCaches();
      const { client } = clientWith({ plan: { SendInvoice: code } });
      await client.ensureSession();
      const error = await errorOf(sendDoc(client));
      assert.equal(error.code, "integrator-unreachable", `${code}: ${error.code} ${error.message}`);
      assert.match(error.message, new RegExp(`EDM'ye bağlanılamadı: ${code}`));
    }
  });

  test("B2: gönderim isteği gittikten sonra kopma (UND_ERR_SOCKET, ECONNRESET, EPIPE) ya da yanıt zaman aşımı → belirsiz; gönderim YİNELENMEZ", async () => {
    for (const code of ["UND_ERR_SOCKET", "ECONNRESET", "EPIPE", "abort"]) {
      resetEdmCaches();
      const { client, ops } = clientWith({ plan: { SendInvoice: [code] } });
      await client.ensureSession();
      const error = await errorOf(sendDoc(client));
      assert.equal(error.code, "integrator-uncertain", `${code}: ${error.code} ${error.message}`);
      assert.match(error.message, code === "abort" ? /^EDM yanıt vermedi \(zaman aşımı\); istek EDM'ye ulaşmış olabilir\.$/ : new RegExp(`^EDM ile bağlantı istek gönderildikten sonra koptu \\(${code}\\); istek EDM'ye ulaşmış olabilir\\.$`));
      assert.equal(ops.SendInvoice, 1, `${code}: gönderim bir kez`);
    }
  });

  test("B2: yan etkisiz işlem (mükellef sorgusu) kopmada bir kez yinelenir; yine düşerse ulaşılamadı (tur durur)", async () => {
    resetEdmCaches();
    const once = clientWith({ plan: { CheckUser: ["ECONNRESET"] } });
    await once.client.ensureSession();
    await once.client.checkUser("10000000146");
    assert.equal(once.ops.CheckUser, 2, "yinelendi, başarılı");
    resetEdmCaches();
    const twice = clientWith({ plan: { CheckUser: ["ECONNRESET", "ECONNRESET"] } });
    await twice.client.ensureSession();
    const error = await errorOf(twice.client.checkUser("10000000146"));
    assert.equal(error.code, "integrator-unreachable");
  });

  test("B3: geçerli oturum + 5 dk içinde yanıt = erişim kanıtı; bağlantı hatası kanıtı siler; parola değişince ya da 5 dk sonra giriş", async () => {
    resetEdmCaches();
    const { client, ops } = clientWith({ plan: { CheckUser: [null, "ECONNREFUSED", "ECONNREFUSED"] } });
    await client.ensureSession();
    assert.equal(ops.Login, 1);
    await client.ensureSession();
    await client.checkUser("10000000146");
    await client.ensureSession();
    assert.equal(ops.Login, 1, "kanıt taze: giriş yok");
    // Bağlantı hatası (yineleme dahil) kanıtı siler → sonraki denetim EDM'ye gerçekten ulaşır.
    await errorOf(client.checkUser("10000000146"));
    await client.ensureSession();
    assert.equal(ops.Login, 2, "bağlantı hatasından sonra giriş");
    // Aynı adres ve kullanıcı, farklı parola: önbellekteki oturum kanıt değil.
    const other = clientWith({ password: "Yanlis-Parola-9" });
    const error = await errorOf(other.client.ensureSession());
    assert.equal(other.ops.Login, 1, "yeni parolayla giriş denendi");
    assert.equal(error.stage, "login");
    // 5 dk sonra (saat ileri) yeniden giriş.
    mock.timers.enable({ apis: ["Date"], now: Date.now() });
    try {
      mock.timers.tick(4 * 60_000);
      await client.ensureSession();
      assert.equal(ops.Login, 2, "4 dk: kanıt geçerli");
      mock.timers.tick(2 * 60_000);
      await client.ensureSession();
      assert.equal(ops.Login, 3, "6 dk: yeniden giriş");
    } finally {
      mock.timers.reset();
    }
  });

  test("B6: ağ yokken WSDL okunamazsa varsayılan sözleşme önbelleğe yazılmaz; ağ gelince sözleşme okunur, istekler sözleşmeye uygun gider", async () => {
    resetEdmCaches();
    const hitsBefore = edm.state.wsdlHits;
    const violationsBefore = edm.state.violations.length;
    const down = { on: true };
    const fetchImpl = async (input, init) => {
      if (down.on) throw failure("ECONNREFUSED");
      return globalThis.fetch(input, init);
    };
    const client = createEdmClient({ baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", fetchImpl });
    const first = await errorOf(client.ensureSession());
    assert.equal(first.code, "integrator-unreachable");
    down.on = false;
    await client.ensureSession();
    await client.checkUser("10000000146");
    assert.equal(edm.state.wsdlHits - hitsBefore, 1, "ağ gelince sözleşme okundu");
    assert.deepEqual(edm.state.violations.slice(violationsBefore), [], "istekler sözleşmeye uygun (varsayılan biçim değil)");
    // WSDL adresi yanıt verip okunamadıysa (HTTP hatası) kısa süre tutulur: her çağrıda yeniden istenmez.
    resetEdmCaches();
    let wsdlGets = 0;
    const broken = createEdmClient({ baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", fetchImpl: async (input, init) => {
      if (!init?.method || init.method === "GET") {
        wsdlGets += 1;
        return new Response("hata", { status: 500 });
      }
      return globalThis.fetch(input, init);
    } });
    const report = await broken.contractReport();
    assert.equal(report.source, "default");
    await broken.contractReport();
    assert.equal(wsdlGets, 2, "?singleWsdl + ?wsdl bir kez; ikinci çağrı önbellekten (1 dk)");
  });
});
