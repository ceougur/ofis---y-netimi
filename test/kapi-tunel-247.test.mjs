// 2.4.7 M4 — kapıcının tünel bölümü (bulut/kapi/tunel.mjs) + programın kapıcı istemcisi (server/lib/tunnel/gate-client.mjs) UÇTAN UCA, sahte Cloudflare API ile.
// Gerçek Cloudflare'e HİÇBİR çağrı yok (sahte fetch, adres denetlenir). Lisans zarfları test anahtarıyla imzalanır (server/lib/license-token.mjs signToken);
// kapıcı WebCrypto ile doğrular — iki ayrı gerçekleme aynı zarfta anlaşmalı.
// "Nasıl bozulur": ikinci açılış yeni tünel açar (tünel/DNS birikir); lisanssız/süresi dolmuş/engelli/eski lisans tünel alır; başka ofis adına başvuru;
// sızmış etkinleştirme kodu (lisans zarfı) başka anahtarla tüneli ele geçirir; imza/zaman oyunu; DNS kaydı yanlış hedefte kalır; eşzamanlı iki ilk başvuru;
// yanıtta Cloudflare HESAP belirteci sızar.
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, test } from "node:test";
import { createCloudflareTunnels, createTunnelGate, officeLabel, verifyLicenseEnvelope } from "../bulut/kapi/tunel.mjs";
import { signToken } from "../server/lib/license-token.mjs";
import { createGateClient } from "../server/lib/tunnel/gate-client.mjs";

const pair = generateKeyPairSync("ed25519");
const PRIV = pair.privateKey.export({ type: "pkcs8", format: "pem" });
const TRUSTED = { "test-lisans": pair.publicKey.export({ type: "spki", format: "der" }).toString("base64") };
const other = generateKeyPairSync("ed25519");
const OTHER_PRIV = other.privateKey.export({ type: "pkcs8", format: "pem" });
const NOW = Date.parse("2026-10-29T10:00:00Z");
const MACHINE_A = "a".repeat(32);
const MACHINE_B = "b".repeat(32);
const CF_TOKEN = "CF-HESAP-BELIRTECI-GIZLI-0123456789";

const claims = (over = {}) => ({ schema: 1, product: "DestekOfis", type: "license-token", kind: "license", status: "active", licenseId: "LIS-TEST-1", machine: MACHINE_A, issuedAt: new Date(NOW - 3_600_000).toISOString(), startsAt: "2026-01-01T00:00:00Z", expiresAt: null, ...over });
const envelope = (over = {}, key = PRIV, keyId = "test-lisans") => signToken(claims(over), key, keyId);

// Sahte Cloudflare API: tüneller, DNS, çağrı günlüğü. Yalnız api.cloudflare.com kabul eder (başka adres → hata).
function fakeCloudflare({ failCreateOnce = false } = {}) {
  const state = { tunnels: [], dns: [], calls: [], creates: 0 };
  let failNext = failCreateOnce;
  const reply = (result, ok = true, status = 200) => new Response(JSON.stringify({ success: ok, errors: ok ? [] : [{ code: 1013, message: "exists" }], result }), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    assert.equal(u.hostname, "api.cloudflare.com", "yalnız Cloudflare API");
    assert.equal(init.headers.authorization, `Bearer ${CF_TOKEN}`);
    const method = init.method || "GET";
    state.calls.push(`${method} ${u.pathname}`);
    const body = init.body ? JSON.parse(init.body) : null;
    let m;
    if ((m = u.pathname.match(/^\/client\/v4\/accounts\/acc1\/cfd_tunnel$/))) {
      if (method === "GET") return reply(state.tunnels.filter(t => t.name === u.searchParams.get("name")));
      if (method === "POST") {
        state.creates += 1;
        if (failNext) {
          failNext = false;
          // eşzamanlı başka başvuru aynı adı az önce açmış gibi
          state.tunnels.push({ id: "22222222-2222-4222-8222-222222222222", name: body.name, config_src: body.config_src });
          return reply(null, false, 409);
        }
        assert.equal(body.config_src, "local", "yerel yönetimli tünel");
        assert.equal(Buffer.from(body.tunnel_secret, "base64").length, 32);
        const id = `${String(state.tunnels.length + 1).padStart(8, "0")}-1111-4111-8111-111111111111`;
        const tunnel = { id, name: body.name, config_src: body.config_src };
        state.tunnels.push(tunnel);
        return reply(tunnel);
      }
    }
    if ((m = u.pathname.match(/^\/client\/v4\/accounts\/acc1\/cfd_tunnel\/([^/]+)\/token$/))) return reply(`calistirma-belirteci-${m[1]}`);
    if (u.pathname === "/client/v4/zones/zon1/dns_records") {
      if (method === "GET") return reply(state.dns.filter(r => r.name === u.searchParams.get("name") && r.type === u.searchParams.get("type")));
      if (method === "POST") {
        const rec = { id: `dns${state.dns.length + 1}`, ...body };
        state.dns.push(rec);
        return reply(rec);
      }
    }
    if ((m = u.pathname.match(/^\/client\/v4\/zones\/zon1\/dns_records\/([^/]+)$/)) && method === "PATCH") {
      const rec = state.dns.find(r => r.id === m[1]);
      Object.assign(rec, body);
      return reply(rec);
    }
    return reply(null, false, 404);
  };
  return { state, fetchImpl };
}
const memoryKv = () => {
  const map = new Map();
  return { map, get: async key => map.get(key) ?? null, put: async (key, value) => void map.set(key, value) };
};
// Programın ortak katman deposunun yalnız ayar kısmı.
const memoryStore = (licenseEnvelope) => {
  const settings = new Map();
  if (licenseEnvelope) settings.set("license.token", JSON.stringify(licenseEnvelope));
  return { settings, setting: (key, fallback = null) => (settings.has(key) ? settings.get(key) : fallback), setSetting: (key, value) => void settings.set(key, value) };
};

function harness({ cfOptions, now = () => NOW } = {}) {
  const cf = fakeCloudflare(cfOptions);
  const kv = memoryKv();
  const gate = createTunnelGate({ cloudflare: createCloudflareTunnels({ accountId: "acc1", zoneId: "zon1", apiToken: CF_TOKEN, fetchImpl: cf.fetchImpl }), kv, trustedKeys: TRUSTED, domain: "destekofis.net", now });
  // Programın istemcisi kapıcıya "ağ" üzerinden değil, Worker'ın işleyicisine Request nesnesiyle gelir (Worker'daki gibi).
  const gateFetch = async (url, init) => {
    assert.equal(new URL(url).pathname, "/v1/tunel");
    return gate.handleTunnelRequest(new Request(url, init));
  };
  const client = (store, clock = now) => createGateClient({ gateUrl: "https://kapi.example.test", fetchImpl: gateFetch, store, now: clock });
  return { cf, kv, gate, client, gateFetch };
}

describe("M4 kapıcı tünel bölümü — sahte Cloudflare API", () => {
  test("ilk açılış tüneli + DNS'i OLUŞTURUR, ikinci açılış YENİDEN KULLANIR (yeni tünel/DNS yok); ad tek düzeyli ve bilgisayar kimliğini göstermez", async () => {
    const h = harness();
    const store = memoryStore(envelope());
    const first = await h.client(store).provision();
    const label = await officeLabel(MACHINE_A);
    assert.equal(first.hostname, `ofis-${label}.destekofis.net`);
    assert.ok(!first.hostname.includes(MACHINE_A.slice(0, 8)), "bilgisayar kimliği adda yok");
    assert.equal(first.hostname.split(".").length, 3, "tek düzeyli alt ad (ücretsiz sertifika *.destekofis.net)");
    assert.equal(first.publicUrl, `https://${first.hostname}`);
    assert.equal(h.cf.state.tunnels.length, 1);
    assert.equal(h.cf.state.tunnels[0].name, `destekofis-${label}`);
    assert.equal(h.cf.state.dns.length, 1);
    assert.deepEqual({ name: h.cf.state.dns[0].name, content: h.cf.state.dns[0].content, proxied: h.cf.state.dns[0].proxied }, { name: first.hostname, content: `${first.tunnelId}.cfargotunnel.com`, proxied: true });
    assert.equal(first.token, `calistirma-belirteci-${first.tunnelId}`);
    const second = await h.client(store).provision();
    assert.equal(second.tunnelId, first.tunnelId, "aynı tünel");
    assert.equal(h.cf.state.creates, 1, "ikinci açılışta tünel oluşturulmadı");
    assert.equal(h.cf.state.dns.length, 1, "DNS çoğalmadı");
    assert.equal(h.cf.state.calls.filter(call => call === "POST /client/v4/zones/zon1/dns_records").length, 1, "DNS yalnız ilk açılışta eklendi");
    assert.equal(h.cf.state.calls.filter(call => call === "POST /client/v4/accounts/acc1/cfd_tunnel").length, 1, "tünel yalnız ilk açılışta oluşturuldu");
  });

  test("lisans geçersiz → ret ve Cloudflare'e HİÇ çağrı yok: imzasız/yabancı anahtar, süresi dolmuş, engelli, başlamamış, 8 günden eski, deneme bitmiş", async () => {
    const cases = {
      "yabancı anahtar": envelope({}, OTHER_PRIV),
      "süresi dolmuş": envelope({ expiresAt: new Date(NOW - 1000).toISOString() }),
      engelli: envelope({ status: "blocked" }),
      "başlamamış": envelope({ startsAt: new Date(NOW + 86_400_000).toISOString(), issuedAt: new Date(NOW).toISOString() }),
      "8 günden eski": envelope({ issuedAt: new Date(NOW - 9 * 86_400_000).toISOString() }),
      "deneme bitmiş": envelope({ kind: "trial", expiresAt: new Date(NOW - 1).toISOString() }),
    };
    for (const [name, env] of Object.entries(cases)) {
      const h = harness();
      await assert.rejects(h.client(memoryStore(env)).provision(), error => {
        assert.equal(error.gateCode, "tunnel-license", `${name}: ${error.gateCode} ${error.message}`);
        assert.equal(error.status, 403);
        return true;
      });
      assert.deepEqual(h.cf.state.calls, [], `${name}: Cloudflare'e çağrı yok`);
    }
    // bozulmuş yük (imza tutmaz)
    const h = harness();
    const env = envelope();
    const payload = JSON.parse(Buffer.from(env.payload, "base64").toString("utf8"));
    payload.expiresAt = "2099-01-01T00:00:00.000Z";
    env.payload = Buffer.from(JSON.stringify(payload)).toString("base64");
    await assert.rejects(h.client(memoryStore(env)).provision(), { gateCode: "tunnel-license" });
    assert.deepEqual(h.cf.state.calls, []);
  });

  test("başka ofisin tüneli → ret: istekteki bilgisayar kimliği lisansınkiyle aynı değil (403 tunnel-machine)", async () => {
    const h = harness();
    const store = memoryStore(envelope());
    // Kötü niyetli istemci: A'nın lisansıyla B adına başvurur (gövde elle).
    const real = h.client(store);
    const spy = [];
    const tamper = createGateClient({
      gateUrl: "https://kapi.example.test",
      store,
      now: () => NOW,
      fetchImpl: async (url, init) => {
        const body = JSON.parse(init.body);
        body.machine = MACHINE_B;
        spy.push(body.machine);
        return h.gateFetch(url, { ...init, body: JSON.stringify(body) });
      },
    });
    await assert.rejects(tamper.provision(), { gateCode: "tunnel-machine", status: 403 });
    assert.deepEqual(h.cf.state.calls, []);
    // A ve B kendi lisanslarıyla AYRI tünel ve ad alır.
    const a = await real.provision();
    const b = await h.client(memoryStore(envelope({ machine: MACHINE_B, licenseId: "LIS-TEST-2" }))).provision();
    assert.notEqual(a.tunnelId, b.tunnelId);
    assert.notEqual(a.hostname, b.hostname);
  });

  test("sızmış lisans zarfı (internetsiz etkinleştirme kodu) BAŞKA program anahtarıyla tüneli alamaz: 409 tunnel-key; operatör bağı kaldırınca yeni kurulum alır", async () => {
    const h = harness();
    const env = envelope();
    const office = memoryStore(env);
    const ok = await h.client(office).provision();
    const thief = memoryStore(env); // aynı zarf, kendi anahtarı
    await assert.rejects(h.client(thief).provision(), { gateCode: "tunnel-key", status: 409 });
    assert.equal(h.cf.state.tunnels.length, 1);
    assert.equal(await h.gate.resetBinding(MACHINE_A), true);
    const rebound = await h.client(thief).provision();
    assert.equal(rebound.tunnelId, ok.tunnelId, "tünel ve ad aynı kalır");
    await assert.rejects(h.client(office).provision(), { gateCode: "tunnel-key" }, "artık eski anahtar reddedilir");
  });

  test("imza ve zaman: imza bozuk → 401 tunnel-signature; saat 5 dk'dan çok kaymış → 401; biçim → 400", async () => {
    const h = harness();
    const store = memoryStore(envelope());
    const corrupt = createGateClient({
      gateUrl: "https://kapi.example.test",
      store,
      now: () => NOW,
      fetchImpl: async (url, init) => {
        const body = JSON.parse(init.body);
        body.nonce = `${body.nonce}x`;
        return h.gateFetch(url, { ...init, body: JSON.stringify(body) });
      },
    });
    await assert.rejects(corrupt.provision(), { gateCode: "tunnel-signature", status: 401 });
    await assert.rejects(h.client(store, () => NOW - 6 * 60_000).provision(), { gateCode: "tunnel-signature" });
    const res = await h.gate.handleTunnelRequest(new Request("https://kapi.example.test/v1/tunel", { method: "POST", body: "{bozuk" }));
    assert.equal(res.status, 400);
    const get = await h.gate.handleTunnelRequest(new Request("https://kapi.example.test/v1/tunel"));
    assert.equal(get.status, 405);
    assert.deepEqual(h.cf.state.calls, []);
  });

  test("DNS kaydı yanlış hedefte (ör. elle değiştirilmiş) → tünelin adresine düzeltilir (PATCH), yeni kayıt açılmaz", async () => {
    const h = harness();
    const label = await officeLabel(MACHINE_A);
    h.cf.state.dns.push({ id: "dnsx", type: "CNAME", name: `ofis-${label}.destekofis.net`, content: "baska.example.com", proxied: false });
    const got = await h.client(memoryStore(envelope())).provision();
    assert.equal(h.cf.state.dns.length, 1);
    assert.equal(h.cf.state.dns[0].content, `${got.tunnelId}.cfargotunnel.com`);
    assert.equal(h.cf.state.dns[0].proxied, true);
    assert.ok(h.cf.state.calls.includes("PATCH /client/v4/zones/zon1/dns_records/dnsx"));
  });

  test("eşzamanlı ilk başvuru (oluşturma 'ad var' ile düşer) → var olan tünel bulunup kullanılır", async () => {
    const h = harness({ cfOptions: { failCreateOnce: true } });
    const got = await h.client(memoryStore(envelope())).provision();
    assert.equal(got.tunnelId, "22222222-2222-4222-8222-222222222222");
    assert.equal(h.cf.state.tunnels.length, 1);
  });

  test("yanıt ve KV kaydı Cloudflare HESAP belirtecini içermez; programın anahtarı ayarda mühürlü değilse bile ÖZEL anahtar kapıcıya gitmez", async () => {
    const h = harness();
    const store = memoryStore(envelope());
    let sent = "";
    const watch = createGateClient({ gateUrl: "https://kapi.example.test", store, now: () => NOW, fetchImpl: async (url, init) => {
      sent = init.body;
      const res = await h.gateFetch(url, init);
      const text = await res.clone().text();
      assert.ok(!text.includes(CF_TOKEN), "yanıtta hesap belirteci yok");
      return res;
    } });
    await watch.provision();
    assert.ok(!sent.includes("PRIVATE KEY"), "özel anahtar istekte yok");
    for (const value of h.kv.map.values()) assert.ok(!value.includes(CF_TOKEN));
    assert.ok(String(store.setting("mobile.tunnel.key")).includes("PRIVATE KEY"), "kasa verilmeyen testte anahtar ayarda (üretimde secret-box ile mühürlü)");
  });

  test("lisans doğrulayıcı (WebCrypto) program doğrulayıcısıyla aynı zarfı kabul eder; iddia alanları korunur", async () => {
    const got = await verifyLicenseEnvelope(envelope({ mobileDevices: 3 }), TRUSTED, { now: NOW });
    assert.equal(got.machine, MACHINE_A);
    assert.equal(got.licenseId, "LIS-TEST-1");
  });
});
