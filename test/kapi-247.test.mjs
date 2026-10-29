// 2.4.7 M3: kapıcı (bulut/kapi/kapi.mjs — Cloudflare Worker) Node'da, SAHTE R2 (test/kapi-yerel.mjs sahteR2), SAHTE SAAT, sahte lisans servisi ve sahte tünelle
// (docs/mobil/M3-TASARIM.md §5). Gerçek Cloudflare'e ve gerçek lisans servisine istek yok (ders 30). Her denetim yeni davranışın varlığını iddia eder; eski
// kodda (kapıcı yok) bu dosya yüklenemez → kırmızı (ders 7; kırmızının nedeni iletide: modül bulunamadı / beklenen ret kodu gelmedi — ders 38).
// Saat: sabit başlangıç + elle ilerletme (ders 13, 22): ay sonu, gece yarısı, P9 1 saat sınırının iki yanı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKapi } from "../bulut/kapi/kapi.mjs";
import { KAPI_KURALLARI, mesaj, sha256Hex, ecdsaImzala } from "../server/lib/kapi-protokol.mjs";
import { isaretDogrula, kapiIstemcisi, ozetPaketle } from "../server/lib/mobile-ozet.mjs";
import { sahteOnbellek, sahteR2 } from "./kapi-yerel.mjs";
import { cihaz, lisansAnahtari, ofisAnahtari, rastgeleOfis } from "./kapi-ortak.mjs";

const T0 = Date.parse("2026-11-30T23:40:00+03:00"); // ay sonu, gece yarısına 20 dk
const MIN = 60_000;
const ALAN = "destekofis.test";

async function ortam({ servis = true } = {}) {
  let t = T0;
  const lisans = lisansAnahtari();
  const r2 = sahteR2();
  const servisCagrilari = [];
  const kayitlar = new Map(); // makine → lisans kaydı (servisin gerçeği)
  const iletilen = [];
  let tunelAcik = true;
  const kapi = createKapi({
    now: () => t,
    onbellek: sahteOnbellek(),
    lisansFetch: async (url, init) => {
      servisCagrilari.push({ url, body: JSON.parse(init.body), auth: init.headers.authorization });
      if (!servis || !ctx.servisErisim) throw new TypeError("fetch failed");
      const body = JSON.parse(init.body);
      const k = kayitlar.get(body.machine) || {};
      return { json: async () => ({ ok: true, token: lisans.belirtec({ at: t, machine: body.machine, licenseId: body.licenseId, ...k }) }) };
    },
    fetchOrigin: async request => {
      iletilen.push({ method: request.method, url: request.url, kapi: request.headers.get("x-do-kapi"), cookie: request.headers.get("cookie") });
      if (!tunelAcik) throw new TypeError("fetch failed");
      return new Response(JSON.stringify({ ok: true, data: { yol: new URL(request.url).pathname } }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const env = { OZET: r2, LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: ALAN, ...(servis ? { LISANS_URL: "https://lisans.kapi.test/api/lisans", KAPI_LISANS_ANAHTARI: "gizli-test" } : {}) };
  const fetchImpl = async (url, init = {}) => kapi.fetch(new Request(url, init), env);
  const ctx = {
    lisans,
    r2,
    env,
    kapi,
    iletilen,
    servisCagrilari,
    kayitlar,
    servisErisim: true,
    now: () => t,
    ilerle: ms => {
      t += ms;
    },
    tunel: acik => {
      tunelAcik = acik;
    },
    istemci: kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl, simdi: () => t }),
    async cihazIstegi(ofis, yontem, yol, basliklar = {}) {
      const response = await kapi.fetch(new Request(`https://${ofis}.${ALAN}${yol}`, { method: yontem, headers: basliklar }), env);
      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      return { status: response.status, code: data?.code || "", data, text, headers: response.headers };
    },
    async ofisKur({ makine = "ab".repeat(16), cihazlar = [], belirtec = {} } = {}) {
      const ofis = await ofisAnahtari(rastgeleOfis());
      const lis = lisans.belirtec({ at: t, machine: makine, ...belirtec });
      const r = await ctx.istemci.kayit(ofis, { lisans: lis, cihazlar: cihazlar.map(c => ({ id: c.id, anahtar: c.anahtar })) });
      return { ofis, kayit: r, makine };
    },
  };
  return ctx;
}

async function sifreAnahtari() {
  const cift = await globalThis.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const jwk = await globalThis.crypto.subtle.exportKey("jwk", cift.publicKey);
  return { gizli: cift.privateKey, acik: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } };
}
async function ozet(ofis, sira, cihazlar, t) {
  const sifre = await sifreAnahtari();
  return ozetPaketle({ ofis: ofis.id, sira, uretim: new Date(t).toISOString(), imzaAnahtari: ofis.imzaAnahtari, kullanicilar: [{ anahtar: "u1", veri: { v: 1, deneme: true }, cihazlar: cihazlar.map(c => ({ id: c.id, sifre: sifre.acik })) }] });
}

describe("M3 kapıcı — program uçları: ofis anahtarı, yeniden oynatma, lisans imzası", () => {
  it("ilk kayıt ofis anahtarını bağlar; aynı kimlik BAŞKA anahtarla reddedilir (kapi-ofis-anahtari)", async () => {
    const c = await ortam();
    const { ofis, kayit } = await c.ofisKur();
    assert.equal(kayit.ok, true, `ilk kayıt kabul edilmeli: ${JSON.stringify(kayit)}`);
    const sahte = await ofisAnahtari(ofis.id);
    const r = await c.istemci.kayit(sahte, { lisans: c.lisans.belirtec({ at: c.now() }), cihazlar: [] });
    assert.equal(r.code, "kapi-ofis-anahtari", `başka anahtarla aynı ofis kimliği reddedilmeli (gelen ${JSON.stringify(r)})`);
  });

  it("imza bozuk → kapi-imza; zaman ±5 dk dışında → kapi-zaman ve kapıcının saati döner", async () => {
    const c = await ortam();
    const { ofis } = await c.ofisKur();
    const govde = JSON.stringify({ v: 1, ofis: ofis.id, anahtar: ofis.acik, lisans: c.lisans.belirtec({ at: c.now() }), cihazlar: [], sir: ofis.sir, zaman: c.now() + 1 });
    const yol = `/v1/ofis/${ofis.id}/kayit`;
    const baska = await ofisAnahtari();
    const imzaBaska = await ecdsaImzala(baska.imzaAnahtari, mesaj.ofis("POST", yol, c.now() + 1, await sha256Hex(govde)));
    const bozuk = await c.kapi.fetch(new Request(`https://kapi.${ALAN}${yol}`, { method: "POST", headers: { "x-do-zaman": String(c.now() + 1), "x-do-imza": imzaBaska }, body: govde }), c.env);
    assert.equal((await bozuk.json()).code, "kapi-imza", "ofisin anahtarıyla imzalanmamış kayıt reddedilmeli");
    const gec = c.now() - KAPI_KURALLARI.zamanPayiMs - 1;
    const govde2 = JSON.stringify({ v: 1, ofis: ofis.id, anahtar: ofis.acik, lisans: c.lisans.belirtec({ at: c.now() }), cihazlar: [], sir: ofis.sir, zaman: gec });
    const imza2 = await ecdsaImzala(ofis.imzaAnahtari, mesaj.ofis("POST", yol, gec, await sha256Hex(govde2)));
    const eski = await (await c.kapi.fetch(new Request(`https://kapi.${ALAN}${yol}`, { method: "POST", headers: { "x-do-zaman": String(gec), "x-do-imza": imza2 }, body: govde2 }), c.env)).json();
    assert.equal(eski.code, "kapi-zaman", "5 dakikadan eski imzalı istek reddedilmeli");
    assert.equal(eski.zaman, c.now(), "kapıcı kendi saatini dönmeli");
  });

  it("eski kaydın yeniden oynatılması silinmiş cihazı GERİ GETİREMEZ (kapi-sira)", async () => {
    const c = await ortam();
    const tel = await cihaz();
    const ofis = await ofisAnahtari();
    const yol = `/v1/ofis/${ofis.id}/kayit`;
    const ms = c.now();
    const govde = JSON.stringify({ v: 1, ofis: ofis.id, anahtar: ofis.acik, lisans: c.lisans.belirtec({ at: ms }), cihazlar: [{ id: tel.id, anahtar: tel.anahtar }], sir: ofis.sir, zaman: ms });
    const basliklar = { "x-do-zaman": String(ms), "x-do-imza": await ecdsaImzala(ofis.imzaAnahtari, mesaj.ofis("POST", yol, ms, await sha256Hex(govde))) };
    const gonder = () => c.kapi.fetch(new Request(`https://kapi.${ALAN}${yol}`, { method: "POST", headers: basliklar, body: govde }), c.env).then(r => r.json());
    assert.equal((await gonder()).ok, true);
    c.ilerle(1000);
    const sil = await c.istemci.kayit(ofis, { lisans: c.lisans.belirtec({ at: c.now() }), cihazlar: [] });
    assert.equal(sil.ok, true, "cihazı silen kayıt kabul edilmeli");
    const tekrar = await gonder();
    assert.equal(tekrar.code, "kapi-sira", `eski imzalı kayıt yeniden oynatılınca reddedilmeli (gelen ${JSON.stringify(tekrar)})`);
    const okuma = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()));
    assert.equal(okuma.code, "kapi-cihaz", "silinmiş cihaz kapıcıda kalmamalı");
  });

  it("başka anahtarla imzalanmış lisans belirteci kabul edilmez (kapi-lisans)", async () => {
    const c = await ortam();
    const ofis = await ofisAnahtari();
    const yabanci = lisansAnahtari("yabanci-anahtar");
    const r = await c.istemci.kayit(ofis, { lisans: yabanci.belirtec({ at: c.now() }), cihazlar: [] });
    assert.equal(r.code, "kapi-lisans", `lisans servisinin imzalamadığı belirteç reddedilmeli (gelen ${JSON.stringify(r)})`);
    assert.equal(c.r2.nesneler.size, 0, "reddedilen kayıt hiçbir şey yazmamalı");
  });
});

describe("M3 kapıcı — eşli cihaz sınırı kapıcıda da (K13), P5 ve silme", () => {
  it("3 cihaz varken 4. ekleme kapıcıda reddedilir; lisans 2'ye düşünce mevcut 3 sürer (P5), yeni ekleme reddedilir, silme her durumda geçer", async () => {
    const c = await ortam();
    const [a, b, d, e] = await Promise.all([cihaz(), cihaz(), cihaz(), cihaz()]);
    const ofis = await ofisAnahtari();
    const kayit = (liste, belirtec = {}) => c.istemci.kayit(ofis, { lisans: c.lisans.belirtec({ at: c.now(), ...belirtec }), cihazlar: liste.map(x => ({ id: x.id, anahtar: x.anahtar })) });
    assert.equal((await kayit([a, b, d])).ok, true, "3 cihaz kabul");
    c.ilerle(10);
    const dort = await kayit([a, b, d, e]);
    assert.equal(dort.code, "kapi-sinir", `programı atlatan 4. cihaz kapıcıda reddedilmeli (gelen ${JSON.stringify(dort)})`);
    assert.deepEqual(new Set((await c.r2.get(`ofis/${ofis.id}/meta.json`).then(o => o.json())).cihazlar.map(x => x.id)), new Set([a.id, b.id, d.id]), "liste 3 kalmalı");
    c.ilerle(10);
    assert.equal((await kayit([a, b, d], { mobileDevices: 2 })).ok, true, "P5: lisans sayısı düşünce ekleme yoksa kayıt kabul, mevcutlar sürer");
    c.ilerle(10);
    assert.equal((await kayit([a, b, e], { mobileDevices: 2 })).code, "kapi-sinir", "sınır 2 iken (biri silinip yerine yeni) 3'e çıkan ekleme reddedilmeli");
    const meta = await c.r2.get(`ofis/${ofis.id}/meta.json`).then(o => o.json());
    assert.deepEqual(new Set(meta.cihazlar.map(x => x.id)), new Set([a.id, b.id]), "reddedilen kayıtta da SİLME (d) uygulanmalı, ekleme (e) uygulanmamalı");
    c.ilerle(10);
    assert.equal((await kayit([a, e], { mobileDevices: 2 })).ok, true, "silinince yer açılır: 2 içinde ekleme kabul");
  });

  it("engelli lisansla kayıt: belirteç saklanır (okumalar hemen kapanır), kapi-lisans döner, cihaz EKLENMEZ", async () => {
    const c = await ortam();
    const tel = await cihaz();
    const yeni = await cihaz();
    const { ofis } = await c.ofisKur({ cihazlar: [tel] });
    await c.istemci.ozetYukle(ofis, await ozet(ofis, 1, [tel], c.now()));
    c.ilerle(1000);
    const r = await c.istemci.kayit(ofis, { lisans: c.lisans.belirtec({ at: c.now(), status: "blocked" }), cihazlar: [tel, yeni].map(x => ({ id: x.id, anahtar: x.anahtar })) });
    assert.equal(r.code, "kapi-lisans", `engelli lisansla kayıt kapi-lisans dönmeli (gelen ${JSON.stringify(r)})`);
    const okuma = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()));
    assert.equal(okuma.code, "kapi-lisans", "engelli belirteç kapıcıya ulaşınca okuma hemen kapanmalı (K14)");
    const yeniOkuma = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await yeni.basliklar("GET", c.now()));
    assert.equal(yeniOkuma.code, "kapi-cihaz", "engelli lisansla eklenmeye çalışılan cihaz listede olmamalı");
  });
});

describe("M3 kapıcı — özet yükleme: sıra, boyut, sınırlar", () => {
  it("sıra kesin artar; aynı ya da eski sıra (yeniden oynatma) reddedilir; silindikten sonra eski yükleme geri getirilemez", async () => {
    const c = await ortam();
    const tel = await cihaz();
    const { ofis } = await c.ofisKur({ cihazlar: [tel] });
    const z1 = await ozet(ofis, 1, [tel], c.now());
    assert.equal((await c.istemci.ozetYukle(ofis, z1)).ok, true, "ilk yükleme");
    assert.equal((await c.istemci.ozetYukle(ofis, z1)).code, "kapi-sira", "aynı sıra yeniden reddedilmeli");
    assert.equal((await c.istemci.ozetYukle(ofis, await ozet(ofis, 2, [tel], c.now()))).ok, true, "daha yeni sıra kabul");
    assert.equal((await c.istemci.ozetSil(ofis, 3)).ok, true, "silme");
    assert.equal((await c.istemci.ozetYukle(ofis, await ozet(ofis, 2, [tel], c.now()))).code, "kapi-sira", "silinmiş özetin eski sıralı yüklemesi reddedilmeli");
    const okuma = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()));
    assert.equal(okuma.code, "kapi-ozet-yok", "silinen özet okunamamalı");
  });

  it("başka ofisin gövdesi, iç imzası bozuk özet ve 8 MB üstü reddedilir", async () => {
    const c = await ortam();
    const tel = await cihaz();
    const { ofis } = await c.ofisKur({ cihazlar: [tel] });
    const baska = await ofisAnahtari();
    const yabanci = await ozetPaketle({ ofis: baska.id, sira: 5, uretim: "x", imzaAnahtari: ofis.imzaAnahtari, kullanicilar: [] });
    assert.equal((await c.istemci.ozetYukle(ofis, yabanci)).code, "kapi-istek", "gövdedeki ofis yolun ofisiyle aynı olmalı");
    const z = JSON.parse(await ozet(ofis, 6, [tel], c.now()));
    z.govde = z.govde.replace('"sira":6', '"sira":7');
    assert.equal((await c.istemci.ozetYukle(ofis, JSON.stringify(z))).code, "kapi-imza", "iç imzası tutmayan (değiştirilmiş) özet reddedilmeli");
    const buyuk = JSON.stringify({ v: 1, govde: "x".repeat(KAPI_KURALLARI.ozetAzamiBayt + 10), imza: "" });
    assert.equal((await c.istemci.ozetYukle(ofis, buyuk)).code, "kapi-buyuk", "8 MB üstü reddedilmeli");
  });

  it("günlük yükleme sınırı (ofis başına 200) ve İstanbul gün dönümünde sıfırlanır; dakikada 30'dan fazlası reddedilir", async () => {
    const c = await ortam();
    const tel = await cihaz();
    const { ofis } = await c.ofisKur({ cihazlar: [tel] });
    c.ilerle(21 * MIN); // 2026-12-01 00:01 TR
    let sira = 0;
    let dakikada = null;
    for (let i = 0; i < 31; i += 1) {
      const r = await c.istemci.ozetYukle(ofis, await ozet(ofis, (sira += 1), [tel], c.now()));
      if (!r.ok) dakikada = { i, code: r.code };
    }
    assert.deepEqual(dakikada, { i: 30, code: "kapi-hiz" }, "aynı dakikada 31. yükleme reddedilmeli");
    let kabul = 30;
    let ret = null;
    for (let i = 0; i < 200 && !ret; i += 1) {
      if (i % 25 === 0) c.ilerle(MIN);
      const r = await c.istemci.ozetYukle(ofis, await ozet(ofis, (sira += 1), [tel], c.now()));
      if (r.ok) kabul += 1;
      else ret = r.code;
    }
    assert.equal(kabul, KAPI_KURALLARI.gunlukYukleme, "günde 200 yükleme kabul");
    assert.equal(ret, "kapi-gunluk", "201. yükleme günlük sınırla reddedilmeli");
    c.ilerle(24 * 3_600_000);
    assert.equal((await c.istemci.ozetYukle(ofis, await ozet(ofis, (sira += 1), [tel], c.now()))).ok, true, "ertesi gün sayaç sıfırlanmalı");
  });
});

describe("M3 kapıcı — cihazın özet okuması (imza, cihaz listesi, P9, K14)", () => {
  it("eşli cihaz imzalı istekle özeti alır (gövde değişmeden); etag ile 304; cihaz listede yoksa / başka ofisinse kapi-cihaz", async () => {
    const c = await ortam();
    const tel = await cihaz();
    const yabanci = await cihaz();
    const { ofis } = await c.ofisKur({ cihazlar: [tel] });
    const { ofis: ofisB } = await c.ofisKur({ makine: "cd".repeat(16), cihazlar: [yabanci] });
    const z = await ozet(ofis, 1, [tel], c.now());
    await c.istemci.ozetYukle(ofis, z);
    const r = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()));
    assert.equal(r.status, 200, r.text.slice(0, 200));
    assert.equal(r.text, z, "kapıcı özeti değiştirmeden vermeli (içini okuyamaz)");
    assert.equal(r.headers.get("cache-control"), "no-store");
    const etag = r.headers.get("etag");
    const tekrar = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", { ...(await tel.basliklar("GET", c.now())), "if-none-match": etag });
    assert.equal(tekrar.status, 304, "değişmeyen özet yeniden indirilmemeli");
    assert.equal((await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await yabanci.basliklar("GET", c.now()))).code, "kapi-cihaz", "başka ofisin cihazı bu ofisin özetini alamamalı");
    assert.equal((await c.cihazIstegi(ofisB.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()))).code, "kapi-cihaz", "A'nın cihazı B'nin adresinde reddedilmeli");
  });

  it("imza başka cihazın anahtarıyla → kapi-imza; saat kayması → kapi-zaman (kapıcı saatini döner)", async () => {
    const c = await ortam();
    const tel = await cihaz();
    const sahte = await cihaz();
    const { ofis } = await c.ofisKur({ cihazlar: [tel] });
    await c.istemci.ozetYukle(ofis, await ozet(ofis, 1, [tel], c.now()));
    const taklit = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await sahte.basliklar("GET", c.now(), "/kapi/ozet", { kimlik: tel.id }));
    assert.equal(taklit.code, "kapi-imza", "cihaz kimliğini bilen ama anahtarı olmayan reddedilmeli");
    const kayik = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now() + KAPI_KURALLARI.zamanPayiMs + 1));
    assert.equal(kayik.code, "kapi-zaman");
    assert.equal(kayik.data.zaman, c.now());
    const baskaYol = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now(), "/kapi/baska"));
    assert.equal(baskaYol.code, "kapi-imza", "başka yol için atılmış imza özet okumada geçmemeli");
  });

  it("P9: lisans servisine ulaşılamazken belirteç 59:59 dk → okunur; 60:00 dk → kapi-lisans-dogrulanamadi (fail-closed); servis dönünce açılır", async () => {
    const c = await ortam();
    const tel = await cihaz();
    const { ofis } = await c.ofisKur({ cihazlar: [tel] });
    await c.istemci.ozetYukle(ofis, await ozet(ofis, 1, [tel], c.now()));
    c.servisErisim = false;
    c.ilerle(KAPI_KURALLARI.lisansTazeMs - 1000);
    assert.equal((await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()))).status, 200, "1 saat dolmadan okunmalı");
    c.ilerle(1000);
    const kapali = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()));
    assert.equal(kapali.code, "kapi-lisans-dogrulanamadi", `1 saat dolunca erişim kapanmalı (gelen ${kapali.code})`);
    c.servisErisim = true;
    c.ilerle(61_000); // başarısız denemeden sonra 1 dk beklenir
    const acik = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()));
    assert.equal(acik.status, 200, `servis dönünce kapıcı yenileyip açmalı (gelen ${acik.code})`);
    const son = c.servisCagrilari.at(-1);
    assert.equal(son.url, "https://lisans.kapi.test/api/lisans/v1/kapi/durum", "yenileme lisans servisinin kapıcı ucuna");
    assert.equal(son.auth, "Bearer gizli-test", "kapıcı gizli anahtarı başlıkta (değer env'den, depoda yok)");
    assert.equal(son.body.machine, "ab".repeat(16));
  });

  it("belirteç 30 dk'dan eskiyse ve servis erişilebilirse kapıcı yeniler; engellenen lisans 1 saat dolmadan yansır", async () => {
    const c = await ortam();
    const tel = await cihaz();
    const { ofis, makine } = await c.ofisKur({ cihazlar: [tel] });
    await c.istemci.ozetYukle(ofis, await ozet(ofis, 1, [tel], c.now()));
    c.kayitlar.set(makine, { status: "blocked" });
    c.ilerle(KAPI_KURALLARI.lisansYenileMs - 1000);
    assert.equal((await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()))).status, 200, "taze belirteçle servis sorulmaz (P9 penceresi içinde kabul)");
    const once = c.servisCagrilari.length;
    c.ilerle(1000);
    const r = await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()));
    assert.equal(c.servisCagrilari.length, once + 1, "30 dk dolunca servise sorulmalı");
    assert.equal(r.code, "kapi-lisans", "engellenen lisans okumayı kapatmalı");
  });

  it("süresi biten lisans bitiş ANINDA kapanır; özet yoksa kapi-ozet-yok", async () => {
    const c = await ortam({ servis: false });
    const tel = await cihaz();
    const bitis = c.now() + 10 * MIN;
    const { ofis } = await c.ofisKur({ cihazlar: [tel], belirtec: { expiresAt: new Date(bitis).toISOString() } });
    assert.equal((await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()))).code, "kapi-ozet-yok");
    await c.istemci.ozetYukle(ofis, await ozet(ofis, 1, [tel], c.now()));
    c.ilerle(10 * MIN - 1);
    assert.equal((await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()))).status, 200);
    c.ilerle(1);
    assert.equal((await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()))).code, "kapi-lisans", "bitiş anı geçersiz");
  });

  it("cihaz özete YAZAMAZ: cihaz + lisans geçince kapi-yazma (K22); cihaz yoksa önce kapi-cihaz", async () => {
    const c = await ortam();
    const tel = await cihaz();
    const yabanci = await cihaz();
    const { ofis } = await c.ofisKur({ cihazlar: [tel] });
    await c.istemci.ozetYukle(ofis, await ozet(ofis, 1, [tel], c.now()));
    for (const yontem of ["PUT", "POST", "DELETE"]) {
      assert.equal((await c.cihazIstegi(ofis.id, yontem, "/kapi/ozet", await tel.basliklar(yontem, c.now()))).code, "kapi-yazma", `${yontem} reddedilmeli`);
      assert.equal((await c.cihazIstegi(ofis.id, yontem, "/kapi/ozet", await yabanci.basliklar(yontem, c.now()))).code, "kapi-cihaz", `${yontem}: önce cihaz`);
    }
    assert.ok(c.r2.nesneler.has(`ofis/${ofis.id}/ozet.json`), "özet yerinde kalmalı");
  });
});

describe("M3 kapıcı — canlı bağlantı kapısı (ofisin telefon adresi → tünel)", () => {
  async function hazir() {
    const c = await ortam();
    const tel = await cihaz();
    const { ofis } = await c.ofisKur({ cihazlar: [tel] });
    return { c, tel, ofis, cerez: `hof_device=${tel.id}.${"s".repeat(43)}` };
  }
  it("cihazsız yalnız sayfa dosyası ve eşleme geçer; mobil uç cihazsız kapi-cihaz", async () => {
    const { c, ofis } = await hazir();
    assert.equal((await c.cihazIstegi(ofis.id, "GET", "/mobil/index.html")).status, 200, "eşleme ekranı (karekod) açılmalı");
    assert.equal((await c.cihazIstegi(ofis.id, "POST", "/api/mobil/eslesme", { "content-type": "application/json" })).status, 200, "eşleme iletilmeli");
    assert.equal((await c.cihazIstegi(ofis.id, "GET", "/api/mobil/cash")).code, "kapi-cihaz", "cihazsız veri ucu reddedilmeli");
    assert.equal(c.iletilen.length, 2, "yalnız iki istek tünele gitmeli");
  });

  it("listede olmayan cihaz çerezi → kapi-cihaz (iletilmez); eşli cihaz → iletilir, işaret programın doğrulayacağı biçimde, istemcinin işaret taklidi ezilir", async () => {
    const { c, tel, ofis, cerez } = await hazir();
    const yok = await c.cihazIstegi(ofis.id, "GET", "/api/mobil/cash", { cookie: `hof_device=dev-${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}.${"s".repeat(43)}` });
    assert.equal(yok.code, "kapi-cihaz");
    assert.equal(c.iletilen.length, 0, "bilinmeyen cihaz tünele ulaşmamalı");
    const r = await c.cihazIstegi(ofis.id, "GET", "/api/mobil/cash?company=x", { cookie: cerez, "x-do-kapi": "1.dev-x.taklit" });
    assert.equal(r.status, 200);
    const [iletim] = c.iletilen;
    assert.notEqual(iletim.kapi, "1.dev-x.taklit", "istemcinin gönderdiği işaret iletilmemeli");
    const dogru = isaretDogrula(iletim.kapi, { yontem: "GET", yolSorgu: "/api/mobil/cash?company=x", sir: ofis.sir, simdi: c.now() });
    assert.deepEqual(dogru, { ok: true, cihaz: tel.id }, "program işareti ofis sırrıyla doğrulayabilmeli ve cihaz kimliği çerezinkiyle aynı olmalı");
    assert.equal(isaretDogrula(iletim.kapi, { yontem: "GET", yolSorgu: "/api/mobil/cash?company=y", sir: ofis.sir, simdi: c.now() }).ok, false, "işaret yola bağlı olmalı");
    assert.equal(isaretDogrula(iletim.kapi, { yontem: "GET", yolSorgu: "/api/mobil/cash?company=x", sir: ofis.sir, simdi: c.now() + KAPI_KURALLARI.vekilPayiMs + 1 }).neden, "zaman", "işaret kısa ömürlü");
  });

  it("yasak yollar tünele GİTMEZ (kapi-yol): program API'si, kodlanmış/çift kodlanmış .., ters bölü, çift bölü, büyük harf, önek hilesi", async () => {
    const { c, ofis, cerez } = await hazir();
    for (const yol of ["/api/companies", "/api/mobil/%252e%252e/companies", "/api/mobil/..%2fcompanies", "//api/companies", "/API/MOBIL/ozet", "/api/mobilx/ozet", "/admin.html", "/api/auth/recovery/local-code"]) {
      const r = await c.cihazIstegi(ofis.id, "GET", yol, { cookie: cerez });
      assert.equal(r.code, "kapi-yol", `${yol} reddedilmeli (gelen ${r.status} ${r.code})`);
    }
    assert.equal(c.iletilen.length, 0, "hiçbiri tünele ulaşmamalı");
  });

  it("tünel kapalıyken kapi-ofis-kapali (503); lisans 1 saattir doğrulanamıyorsa iletilmez", async () => {
    const { c, ofis, cerez } = await hazir();
    c.tunel(false);
    const r = await c.cihazIstegi(ofis.id, "GET", "/api/mobil/session", { cookie: cerez });
    assert.deepEqual([r.status, r.code], [503, "kapi-ofis-kapali"]);
    c.tunel(true);
    c.servisErisim = false;
    c.ilerle(KAPI_KURALLARI.lisansTazeMs);
    const eski = await c.cihazIstegi(ofis.id, "GET", "/api/mobil/session", { cookie: cerez });
    assert.equal(eski.code, "kapi-lisans-dogrulanamadi", "P9 canlı bağlantıda da");
    const sayfa = await c.cihazIstegi(ofis.id, "GET", "/mobil/index.html");
    assert.equal(sayfa.code, "kapi-lisans-dogrulanamadi", "sayfa dosyası da lisanstan sonra");
  });

  it("m. ve tanınmayan alt ad karşılama sayfası verir; programın yükleme ucu ofis adresinde de imzasız geçmez", async () => {
    const c = await ortam();
    const m = await c.kapi.fetch(new Request(`https://m.${ALAN}/`), c.env);
    assert.equal(m.status, 200);
    assert.match(await m.text(), /karekodu okutun/);
    const { ofis } = await c.ofisKur();
    const r = await c.cihazIstegi(ofis.id, "PUT", `/v1/ofis/${ofis.id}/ozet`, {});
    assert.notEqual(r.status, 200, "imzasız yükleme kabul edilmemeli");
  });
});

describe("M3 kapıcı — lisans servisi izolasyonu (ders 30)", () => {
  it("LISANS_URL yoksa kapıcı hiçbir lisans isteği yapmaz; varsa yalnız verilen işleve (gerçek servise değil)", async () => {
    const c = await ortam({ servis: false });
    const tel = await cihaz();
    const { ofis } = await c.ofisKur({ cihazlar: [tel] });
    c.ilerle(KAPI_KURALLARI.lisansYenileMs + 1);
    await c.cihazIstegi(ofis.id, "GET", "/kapi/ozet", await tel.basliklar("GET", c.now()));
    assert.equal(c.servisCagrilari.length, 0, "LISANS_URL tanımsızken servis çağrılmamalı");
  });
});

describe("M3 kapıcı — yol kuralı programla aynı (M2 lib/mobile-remote.mjs remotePathProblem ↔ kapi-protokol yolSorunu)", () => {
  it("iki uygulama aynı sonucu verir (kâhinin bütün istek yolları + ek kalıplar)", async () => {
    const { remotePathProblem } = await import("../server/lib/mobile-remote.mjs");
    const { yolSorunu } = await import("../server/lib/kapi-protokol.mjs");
    const { readFileSync } = await import("node:fs");
    const kabul = JSON.parse(readFileSync(new URL("./bagimsiz/mobil-erisim/kabul.json", import.meta.url), "utf8"));
    const yollar = new Set(["/mobil/", "/api/mobil/x?y=1", "/api/mobil/%E0%A4%A", "/api/mobil/a%00b", "/api/mobil/./x", "mobil/", "/api/mobil//x", "/api/mobil/%2fx", "/api/mobil/%25", "/mobil#x"]);
    for (const s of kabul.senaryolar) for (const e of s.olaylar) if (e.yol) yollar.add(e.yol);
    for (const yol of yollar) assert.equal(yolSorunu(yol), remotePathProblem(yol), yol);
    assert.ok(yollar.size >= 30);
  });
});

describe("M3 kapıcı — dağıtım yapılandırması (bulut/kapi/wrangler.toml)", () => {
  it("lisans açık anahtarları programınkiyle aynı; gizli değer dosyada yok; R2 bağlaması OZET; ofis alanı destekofis.net", async () => {
    const { readFileSync } = await import("node:fs");
    const { TRUSTED_LICENSE_KEYS } = await import("../server/lib/license-keys.mjs");
    const toml = readFileSync(new URL("../bulut/kapi/wrangler.toml", import.meta.url), "utf8");
    const keys = JSON.parse(/^LISANS_ANAHTARLARI = '(.+)'$/m.exec(toml)[1]);
    assert.deepEqual(keys, { ...TRUSTED_LICENSE_KEYS }, "Worker'ın güvendiği lisans anahtarları programınkiyle aynı olmalı");
    assert.match(toml, /binding = "OZET"/);
    assert.match(toml, /^OFIS_ALANI = "destekofis\.net"$/m);
    assert.doesNotMatch(toml, /^KAPI_LISANS_ANAHTARI\s*=/m, "gizli değer dosyaya yazılmaz (wrangler secret put)");
    assert.doesNotMatch(toml, /account_id\s*=/, "hesap numarası dosyada değil");
  });
});

void rastgeleOfis;
