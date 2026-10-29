// 2.4.7 M4 — kapıcının tünel bölümü (bulut/kapi/tunel.mjs) + programın kapıcı istemcisi (server/lib/tunnel/gate-client.mjs) UÇTAN UCA, sahte Cloudflare API ve
// sahte R2 ile. Kimlik doğrulama M3'ün düzeni (lib/kapi-protokol.mjs, lib/mobile-ozet.mjs ofisKaydi): ofis kaydı M3 kayit ucunun yazdığı biçimde (meta.json)
// sahte R2'ye konur; lisans görünümü M3 kapıcısının P9 kuralıyla (en çok 1 saat eski, engelli/bitmiş ret) test içinde kurulur — gerçek kapi.mjs ile uçtan uca
// deneme M3 + M4 birleşiminde (DENENMEYEN; tasarım §9). Gerçek Cloudflare'e HİÇBİR çağrı yok (sahte fetch, adres denetlenir).
// "Nasıl bozulur": ikinci açılış yeni tünel açar (tünel/DNS birikir); kayıtsız ofis tünel alır; başka ofisin anahtarıyla başvuru; gövde/yol oyunu; saat;
// lisans engelli/bitmiş/1 saatten eski; DNS kaydı yanlış hedefte; eşzamanlı iki ilk başvuru; yanıtta Cloudflare HESAP belirteci sızar; Worker ayarı eksik.
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, test } from "node:test";
import { TUNEL_YOLU, createCloudflareTunnels, tunelIstegi } from "../bulut/kapi/tunel.mjs";
import { KAPI_KURALLARI, ecdsaImzala, lisansDogrula, lisansGecerli, mesaj, sha256Hex } from "../server/lib/kapi-protokol.mjs";
import { signToken } from "../server/lib/license-token.mjs";
import { ofisKaydi } from "../server/lib/mobile-ozet.mjs";
import { createGateClient } from "../server/lib/tunnel/gate-client.mjs";

const pair = generateKeyPairSync("ed25519");
const PRIV = pair.privateKey.export({ type: "pkcs8", format: "pem" });
const TRUSTED = { "test-lisans": pair.publicKey.export({ type: "spki", format: "der" }).toString("base64") };
const NOW = Date.parse("2026-10-29T10:00:00Z");
const MACHINE = "a".repeat(32);
const CF_TOKEN = "CF-HESAP-BELIRTECI-GIZLI-0123456789";
const ENV_BASE = { OFIS_ALANI: "destekofis.net" };

const envelope = (over = {}) => signToken({ schema: 1, product: "DestekOfis", type: "license-token", kind: "license", status: "active", licenseId: "LIS-TEST-1", machine: MACHINE, issuedAt: new Date(NOW - 10 * 60_000).toISOString(), startsAt: "2026-01-01T00:00:00Z", expiresAt: null, ...over }, PRIV, "test-lisans");

// M3 kapıcısının lisans görünümü (P9) — test içi karşılığı: kayıttaki belirteç; 1 saatten eski → doğrulanamadı; engelli/bitmiş → geçersiz.
const lisansGorunumu = async (env, meta) => {
  const iddia = await lisansDogrula(meta.lisans, TRUSTED);
  if (!iddia || iddia.machine !== meta.makine || NOW - iddia.issuedAt >= KAPI_KURALLARI.lisansTazeMs) return { durum: "dogrulanamadi", iddia };
  return { durum: lisansGecerli(iddia, NOW) ? "gecerli" : "gecersiz", iddia };
};

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
    if (u.pathname === "/client/v4/accounts/acc1/cfd_tunnel") {
      if (method === "GET") return reply(state.tunnels.filter(t => t.name === u.searchParams.get("name")));
      if (method === "POST") {
        state.creates += 1;
        if (failNext) {
          failNext = false;
          state.tunnels.push({ id: "22222222-2222-4222-8222-222222222222", name: body.name });
          return reply(null, false, 409);
        }
        assert.equal(body.config_src, "local", "yerel yönetimli tünel (giriş kuralı programda)");
        assert.equal(Buffer.from(body.tunnel_secret, "base64").length, 32);
        const tunnel = { id: `${String(state.tunnels.length + 1).padStart(8, "0")}-1111-4111-8111-111111111111`, name: body.name };
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
      Object.assign(state.dns.find(r => r.id === m[1]), body);
      return reply(state.dns.find(r => r.id === m[1]));
    }
    return reply(null, false, 404);
  };
  return { state, fetchImpl };
}
// Sahte R2 (yalnız get; M3 meta.json biçimi).
const fakeR2 = () => {
  const map = new Map();
  return { map, get: async key => (map.has(key) ? { json: async () => JSON.parse(map.get(key)), etag: "e1" } : null) };
};
const memoryStore = () => {
  const settings = new Map();
  return { setting: (key, fallback = null) => (settings.has(key) ? settings.get(key) : fallback), setSetting: (key, value) => void settings.set(key, value) };
};
// M3 kayit ucunun yazdığı ofis kaydı (bulut/kapi/kapi.mjs kayit → meta).
async function register(r2, store, lisans = envelope()) {
  const ofis = await ofisKaydi(store);
  r2.map.set(`ofis/${ofis.id}/meta.json`, JSON.stringify({ v: 1, ofis: ofis.id, anahtar: ofis.acik, makine: MACHINE, lisansKimligi: "LIS-TEST-1", lisans, cihazlar: [], sir: ofis.sir, sonKayit: NOW - 1000, sira: 0 }));
  return ofis;
}
function harness({ cfOptions } = {}) {
  const cf = fakeCloudflare(cfOptions);
  const r2 = fakeR2();
  const env = { ...ENV_BASE, OZET: r2 };
  const cloudflare = createCloudflareTunnels({ accountId: "acc1", zoneId: "zon1", apiToken: CF_TOKEN, fetchImpl: cf.fetchImpl });
  const gateFetch = async (url, init) => {
    assert.ok(TUNEL_YOLU.test(new URL(url).pathname), url);
    return tunelIstegi(new Request(url, init), env, { now: () => NOW, lisansGorunumu, cloudflare });
  };
  const client = (store, clock = () => NOW) => createGateClient({ gateUrl: "https://kapi.example.test", fetchImpl: gateFetch, store, now: clock });
  return { cf, r2, env, client, gateFetch, cloudflare };
}

describe("M4 kapıcı tünel bölümü — M3 ofis kaydıyla, sahte Cloudflare API", () => {
  test("ilk başvuru tüneli + DNS'i OLUŞTURUR (<ofis>.destekofis.net, proxied), ikinci YENİDEN KULLANIR (yeni tünel/DNS yok)", async () => {
    const h = harness();
    const store = memoryStore();
    const ofis = await register(h.r2, store);
    const first = await h.client(store).provision();
    assert.equal(first.hostname, `${ofis.id}.destekofis.net`, "M3 adres düzeni");
    assert.equal(first.publicUrl, `https://${ofis.id}.destekofis.net`);
    assert.deepEqual(h.cf.state.tunnels.map(t => t.name), [`destekofis-${ofis.id}`]);
    assert.deepEqual(h.cf.state.dns.map(r => [r.name, r.content, r.proxied]), [[first.hostname, `${first.tunnelId}.cfargotunnel.com`, true]]);
    assert.equal(first.token, `calistirma-belirteci-${first.tunnelId}`);
    const second = await h.client(store).provision();
    assert.equal(second.tunnelId, first.tunnelId);
    assert.equal(h.cf.state.calls.filter(c => c === "POST /client/v4/accounts/acc1/cfd_tunnel").length, 1, "tünel yalnız ilk başvuruda oluşturuldu");
    assert.equal(h.cf.state.calls.filter(c => c === "POST /client/v4/zones/zon1/dns_records").length, 1, "DNS yalnız ilk başvuruda eklendi");
  });

  test("kapıcıda kayıtlı olmayan ofis → 404 kapi-ofis-yok; Cloudflare'e çağrı yok", async () => {
    const h = harness();
    await assert.rejects(h.client(memoryStore()).provision(), error => error.gateCode === "kapi-ofis-yok" && error.status === 404);
    assert.deepEqual(h.cf.state.calls, []);
  });

  test("başka ofisin tüneli → ret: A'nın yoluna B'nin anahtarıyla imza (401 kapi-imza); A'nın imzasıyla gövdede B (400); Cloudflare'e çağrı yok", async () => {
    const h = harness();
    const storeA = memoryStore();
    const a = await register(h.r2, storeA);
    const storeB = memoryStore();
    const b = await register(h.r2, storeB);
    // B, A'nın yolunu B'nin anahtarıyla imzalar.
    const yol = `/v1/ofis/${a.id}/tunel`;
    const govde = JSON.stringify({ v: 1, ofis: a.id });
    const imzaB = await ecdsaImzala(b.imzaAnahtari, mesaj.ofis("POST", yol, NOW, await sha256Hex(govde)));
    const r1 = await h.gateFetch(`https://kapi.example.test${yol}`, { method: "POST", headers: { "x-do-zaman": String(NOW), "x-do-imza": imzaB }, body: govde });
    assert.equal(r1.status, 401);
    assert.equal((await r1.json()).code, "kapi-imza");
    // A kendi anahtarıyla imzalar ama gövdede B'yi ister.
    const govde2 = JSON.stringify({ v: 1, ofis: b.id });
    const imzaA = await ecdsaImzala(a.imzaAnahtari, mesaj.ofis("POST", yol, NOW, await sha256Hex(govde2)));
    const r2 = await h.gateFetch(`https://kapi.example.test${yol}`, { method: "POST", headers: { "x-do-zaman": String(NOW), "x-do-imza": imzaA }, body: govde2 });
    assert.equal(r2.status, 400);
    assert.equal((await r2.json()).code, "kapi-istek");
    // İmzası doğru ama başka yol (B'nin yolu A'nın imzasıyla) → imza tutmaz.
    const yolB = `/v1/ofis/${b.id}/tunel`;
    const r3 = await h.gateFetch(`https://kapi.example.test${yolB}`, { method: "POST", headers: { "x-do-zaman": String(NOW), "x-do-imza": imzaA }, body: govde2 });
    assert.equal(r3.status, 401);
    assert.deepEqual(h.cf.state.calls, []);
    // A ve B kendi kayıtlarıyla AYRI tünel ve ad alır.
    const ta = await h.client(storeA).provision();
    const tb = await h.client(storeB).provision();
    assert.notEqual(ta.tunnelId, tb.tunnelId);
    assert.notEqual(ta.hostname, tb.hostname);
  });

  test("saat 5 dk'dan çok kaymış → 401 kapi-zaman (kapıcı kendi saatini döner); biçim/yöntem → 400", async () => {
    const h = harness();
    const store = memoryStore();
    await register(h.r2, store);
    await assert.rejects(h.client(store, () => NOW - 6 * 60_000).provision(), error => error.gateCode === "kapi-zaman");
    const get = await h.gateFetch("https://kapi.example.test/v1/ofis/oaaaaaaaaaaaaaaaa/tunel", { method: "GET" });
    assert.equal(get.status, 400);
    const bad = await h.gateFetch("https://kapi.example.test/v1/ofis/KOTU/tunel", { method: "POST", body: "{}" });
    assert.equal(bad.status, 400);
    assert.deepEqual(h.cf.state.calls, []);
  });

  test("lisans: engelli / süresi dolmuş → 403 kapi-lisans; 1 saatten eski (P9) → 503 kapi-lisans-dogrulanamadi; Cloudflare'e çağrı yok", async () => {
    const cases = [
      ["engelli", envelope({ status: "blocked" }), "kapi-lisans", 403],
      ["süresi dolmuş", envelope({ expiresAt: new Date(NOW - 1000).toISOString() }), "kapi-lisans", 403],
      ["1 saatten eski", envelope({ issuedAt: new Date(NOW - 61 * 60_000).toISOString() }), "kapi-lisans-dogrulanamadi", 503],
    ];
    for (const [name, lisans, code, status] of cases) {
      const h = harness();
      const store = memoryStore();
      await register(h.r2, store, lisans);
      await assert.rejects(h.client(store).provision(), error => {
        assert.equal(error.gateCode, code, `${name}: ${error.gateCode}`);
        assert.equal(error.status, status, name);
        return true;
      });
      assert.deepEqual(h.cf.state.calls, [], `${name}: Cloudflare'e çağrı yok`);
    }
  });

  test("DNS kaydı yanlış hedefte → tünelin adresine düzeltilir (PATCH, proxied), yeni kayıt açılmaz", async () => {
    const h = harness();
    const store = memoryStore();
    const ofis = await register(h.r2, store);
    h.cf.state.dns.push({ id: "dnsx", type: "CNAME", name: `${ofis.id}.destekofis.net`, content: "baska.example.com", proxied: false });
    const got = await h.client(store).provision();
    assert.equal(h.cf.state.dns.length, 1);
    assert.equal(h.cf.state.dns[0].content, `${got.tunnelId}.cfargotunnel.com`);
    assert.equal(h.cf.state.dns[0].proxied, true);
  });

  test("eşzamanlı ilk başvuru (oluşturma 'ad var' ile düşer) → var olan tünel bulunup kullanılır", async () => {
    const h = harness({ cfOptions: { failCreateOnce: true } });
    const store = memoryStore();
    await register(h.r2, store);
    const got = await h.client(store).provision();
    assert.equal(got.tunnelId, "22222222-2222-4222-8222-222222222222");
    assert.equal(h.cf.state.tunnels.length, 1);
  });

  test("yanıtta Cloudflare HESAP belirteci yok; Worker ayarı eksikse (CF_API_TOKEN yok) 500 kapi-tunel-ayar, belirteç sızmaz", async () => {
    const h = harness();
    const store = memoryStore();
    const ofis = await register(h.r2, store);
    const yol = `/v1/ofis/${ofis.id}/tunel`;
    const govde = JSON.stringify({ v: 1, ofis: ofis.id });
    const imza = await ecdsaImzala(ofis.imzaAnahtari, mesaj.ofis("POST", yol, NOW, await sha256Hex(govde)));
    const ok = await h.gateFetch(`https://kapi.example.test${yol}`, { method: "POST", headers: { "x-do-zaman": String(NOW), "x-do-imza": imza }, body: govde });
    assert.ok(!(await ok.text()).includes(CF_TOKEN));
    const missing = await tunelIstegi(new Request(`https://kapi.example.test${yol}`, { method: "POST", headers: { "x-do-zaman": String(NOW), "x-do-imza": imza }, body: govde }), { ...ENV_BASE, OZET: h.r2 }, { now: () => NOW, lisansGorunumu });
    assert.equal(missing.status, 500);
    assert.equal((await missing.json()).code, "kapi-tunel-ayar");
  });
});
