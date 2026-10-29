// Dar kontrol (ders 32) — 32e89643 "son kaydolan kazanır": devre dışı / yerini bırakmış ofisin makineyi geri alması.
// Yalnız beklenen davranışı iddia eden doğrulama testleri; gerçek Cloudflare / internet YOK (genel fetch sahte Cloudflare'e bağlı, dış adres reddedilir).
// Ortam düzeni test/kapi-gg247-b3.test.mjs ortam() ile aynı (oradan kopyalandı; o dosya dışa aktarmıyor).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
const KOK = process.env.KAPI_KOK || "/home/user/ofis---y-netimi/.claude/worktrees/agent-ae8a5a6ba86f22e83";
const kapiModulu = await import(`${KOK}/bulut/kapi/kapi.mjs`);
const { ecdsaImzala, mesaj, sha256Hex } = await import(`${KOK}/server/lib/kapi-protokol.mjs`);
const { kapiIstemcisi } = await import(`${KOK}/server/lib/mobile-ozet.mjs`);
const { cihaz, lisansAnahtari, ofisAnahtari } = await import(`${KOK}/test/kapi-ortak.mjs`);
const { sahteOnbellek, sahteR2 } = await import(`${KOK}/test/kapi-yerel.mjs`);

const { createKapi, KAPI_HIZ } = kapiModulu;
const T0 = Date.parse("2026-11-18T10:00:00+03:00");
const ALAN = "destekofis.test";
const gecmeyen = new Set(["kapi-cihaz", "kapi-ofis-degisti"]);

function sahteCloudflare() {
  const s = { tunnels: [], dns: [], calls: [], disari: [], seq: 0, engel: null };
  const yanit = (result, ok = true, status = 200) => new Response(JSON.stringify({ success: ok, errors: ok ? [] : [{ code: 1000, message: "sahte hata" }], result }), { status, headers: { "content-type": "application/json" } });
  s.fetch = async (input, init = {}) => {
    const u = new URL(typeof input === "string" ? input : input.url);
    if (u.hostname !== "api.cloudflare.com") {
      s.disari.push(String(u));
      throw new TypeError("test: dış istek yasak");
    }
    const yontem = init.method || "GET";
    s.calls.push(`${yontem} ${u.pathname}`);
    const govde = init.body ? JSON.parse(init.body) : null;
    let m;
    if (u.pathname === "/client/v4/accounts/acc/cfd_tunnel") {
      if (yontem === "GET") return yanit(s.tunnels.filter(t => t.name === u.searchParams.get("name")));
      if (yontem === "POST") {
        s.seq += 1;
        const t = { id: `${String(s.seq).padStart(8, "0")}-1111-4111-8111-111111111111`, name: govde.name };
        s.tunnels.push(t);
        return yanit(t);
      }
    }
    if ((m = u.pathname.match(/^\/client\/v4\/accounts\/acc\/cfd_tunnel\/([^/]+)\/token$/))) return yanit(`calistirma-${m[1]}`);
    if ((m = u.pathname.match(/^\/client\/v4\/accounts\/acc\/cfd_tunnel\/([^/]+)\/connections$/)) && yontem === "DELETE") {
      // Zorla yarış: belirli tünelin bağlantı silmesi bekletilir (Cloudflare API'si yavaş yanıt verdi).
      if (s.engel && s.engel.id === m[1]) {
        s.engel.ulasti();
        await s.engel.kapi;
      }
      return yanit(null);
    }
    if ((m = u.pathname.match(/^\/client\/v4\/accounts\/acc\/cfd_tunnel\/([^/]+)$/)) && yontem === "DELETE") {
      s.tunnels = s.tunnels.filter(t => t.id !== m[1]);
      return yanit({ id: m[1] });
    }
    if (u.pathname === "/client/v4/zones/zon/dns_records") {
      if (yontem === "GET") return yanit(s.dns.filter(r => r.name === u.searchParams.get("name") && r.type === u.searchParams.get("type")));
      if (yontem === "POST") {
        const r = { id: `dns${s.calls.length}`, ...govde };
        s.dns.push(r);
        return yanit(r);
      }
    }
    if ((m = u.pathname.match(/^\/client\/v4\/zones\/zon\/dns_records\/([^/]+)$/))) {
      if (yontem === "PATCH") return yanit(Object.assign(s.dns.find(r => r.id === m[1]), govde));
      if (yontem === "DELETE") {
        s.dns = s.dns.filter(r => r.id !== m[1]);
        return yanit({ id: m[1] });
      }
    }
    return yanit(null, false, 404);
  };
  return s;
}

let cf;
const gercekFetch = globalThis.fetch;
before(() => {
  cf = sahteCloudflare();
  globalThis.fetch = (...a) => cf.fetch(...a);
});
after(() => {
  globalThis.fetch = gercekFetch;
  assert.deepEqual(cf.disari, [], "dış istek yapılmamalı");
});

function ortam() {
  let t = T0;
  const lisans = lisansAnahtari();
  const env = { OZET: sahteR2(), LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: ALAN, CF_API_TOKEN: "test-cf-belirteci", CF_ACCOUNT_ID: "acc", CF_ZONE_ID: "zon" };
  const iletilen = [];
  const kapi = createKapi({
    now: () => t,
    onbellek: sahteOnbellek(),
    lisansFetch: async () => {
      throw new TypeError("lisans servisi yok (test)");
    },
    fetchOrigin: async request => {
      iletilen.push(request.headers.get("x-do-kapi") || "");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const istek = (url, init) => kapi.fetch(new Request(url, init), env);
  const istemci = kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl: istek, simdi: () => t, kayitSimdi: () => (t += 1) });
  const c = {
    env,
    iletilen,
    istek,
    ilerle: ms => {
      t += ms;
    },
    now: () => t,
    belirtec: (makine, ek = {}) => lisans.belirtec({ at: t, machine: makine, licenseId: `LIS-${makine.slice(0, 6)}`, ...ek }),
    kayit: (ofis, makine, cihazlar = [], ek = {}) => istemci.kayit(ofis, { lisans: c.belirtec(makine, ek), cihazlar: cihazlar.map(x => ({ id: x.id, anahtar: x.anahtar })) }),
    async yeniOfis(makine, n = 0, ek = {}) {
      const ofis = await ofisAnahtari();
      const tels = [];
      for (let i = 0; i < n; i += 1) tels.push(await cihaz());
      return { ofis, tels, kayit: await c.kayit(ofis, makine, tels, ek) };
    },
    async okuma(ofis, tel) {
      const r = await istek(`https://${ofis.id}.${ALAN}/kapi/ozet`, { headers: await tel.basliklar("GET", t) });
      const g = await r.json().catch(() => ({}));
      return { status: r.status, code: g.code || "" };
    },
    async gecenCihaz(ofisler) {
      let n = 0;
      for (const { ofis, tels } of ofisler) for (const tel of tels) if (!gecmeyen.has((await c.okuma(ofis, tel)).code)) n += 1;
      return n;
    },
    async tunel(ofis) {
      const yol = `/v1/ofis/${ofis.id}/tunel`;
      const govde = JSON.stringify({ v: 1, ofis: ofis.id });
      const imza = await ecdsaImzala(ofis.imzaAnahtari, mesaj.ofis("POST", yol, t, await sha256Hex(govde)));
      const r = await istek(`https://kapi.destekofis.test${yol}`, { method: "POST", headers: { "content-type": "application/json", "x-do-zaman": String(t), "x-do-imza": imza }, body: govde });
      return { status: r.status, ...(await r.json().catch(() => ({}))) };
    },
    // Tarayıcı benzeri canlı istek: çerez kavanozu (Set-Cookie uygulanır).
    async canli(ofis, yol, kavanoz) {
      const headers = {};
      const cerez = Object.entries(kavanoz).map(([a, d]) => `${a}=${d}`).join("; ");
      if (cerez) headers.cookie = cerez;
      const r = await istek(`https://${ofis.id}.${ALAN}${yol}`, { headers });
      for (const satir of r.headers.getSetCookie?.() || []) {
        const [ad, ...kalan] = satir.split(";")[0].split("=");
        const deger = kalan.join("=");
        if (!deger || /Max-Age=0/i.test(satir)) delete kavanoz[ad.trim()];
        else kavanoz[ad.trim()] = deger;
      }
      return { status: r.status, code: (await r.clone().json().catch(() => ({}))).code || "" };
    },
  };
  return c;
}
const makine = i => `${String(i).padStart(4, "0")}${"cd".repeat(14)}`;
const CIHAZ_CEREZI = "__Host-hof_device";

describe("dar kontrol K1 — dönen ofis", () => {
  it("(c) dönen ofisin telefonu, devre dışı dönemde ofisin adresini açtıysa da canlı bağlantıya yeniden eşlemesiz döner (kapıcı cihaz çerezini silmemeli)", async () => {
    const c = ortam();
    const M = makine(1);
    const asil = await c.yeniOfis(M, 2);
    assert.equal(asil.kayit.ok, true);
    const [telAcan, telAcmayan] = asil.tels;
    const kavanozAcan = { [CIHAZ_CEREZI]: `${telAcan.id}.sir-acan` };
    const kavanozAcmayan = { [CIHAZ_CEREZI]: `${telAcmayan.id}.sir-acmayan` };
    // Ön koşul: devreden önce iki telefon da canlı geçer.
    assert.equal((await c.canli(asil.ofis, "/api/mobil/oturum", { ...kavanozAcan })).status, 200, "ön koşul: canlı geçer");
    const gecici = await c.yeniOfis(M, 0); // yeniden kurulum: yeni ofis kimliği makineyi devraldı
    assert.equal(gecici.kayit.ok, true);
    // Devre dışı dönemde telefon uygulamayı açar (sayfa + API isteği).
    const sayfa = await c.canli(asil.ofis, "/mobil/", kavanozAcan);
    const api = await c.canli(asil.ofis, "/api/mobil/oturum", kavanozAcan);
    console.log("devre dışı dönemde: sayfa", sayfa, "api", api, "çerez kaldı mı:", CIHAZ_CEREZI in kavanozAcan);
    c.ilerle(1_000);
    const geri = await c.kayit(asil.ofis, M, asil.tels); // eski veri geri yüklendi
    assert.equal(geri.ok, true, `ön koşul: asıl kurulum makineyi geri aldı: ${JSON.stringify(geri)}`);
    // Kontrol: devre dışı dönemde açılmayan telefon döner.
    assert.equal((await c.canli(asil.ofis, "/api/mobil/oturum", kavanozAcmayan)).status, 200, "kontrol: açmayan telefon canlı geçer");
    // Asıl iddia: açan telefon da dönmeli (cihaz listede, programda kayıtlı; yeniden eşleme gerekmemeli).
    const sonra = await c.canli(asil.ofis, "/api/mobil/oturum", kavanozAcan);
    assert.equal(sonra.status, 200, `devre dışı dönemde adresi açan telefon dönüşte canlı geçmeli; gelen ${JSON.stringify(sonra)}, çerez kavanozu ${JSON.stringify(kavanozAcan)} (kapıcı devre dışı dönemde __Host-hof_device'ı sildi → cihaz listede ama sırrını yitirdi)`);
  });

  it("(a/P5) cihaz sınırı düştükten sonra (P5: mevcutlar sürer) devre dışı kalıp dönen ofisin mevcut cihazları sürer; makine el değiştirince toplam 0 cihaz kalmaz", async () => {
    const c = ortam();
    const M = makine(2);
    const asil = await c.yeniOfis(M, 3, { mobileDevices: 3 });
    assert.equal(asil.kayit.ok, true);
    c.ilerle(1_000);
    const p5 = await c.kayit(asil.ofis, M, asil.tels, { mobileDevices: 2 });
    assert.equal(p5.ok, true, `ön koşul P5: sınır 2'ye düşünce mevcut 3 cihaz sürer: ${JSON.stringify(p5)}`);
    assert.equal(await c.gecenCihaz([asil]), 3, "ön koşul P5: 3 cihaz geçiyor");
    const gecici = await c.yeniOfis(M, 1, { mobileDevices: 2 });
    assert.equal(gecici.kayit.ok, true);
    c.ilerle(1_000);
    const geri = await c.kayit(asil.ofis, M, asil.tels, { mobileDevices: 2 });
    const gecen = await c.gecenCihaz([asil, gecici]);
    console.log("dönüş kaydı:", JSON.stringify(geri), "geçen cihaz:", gecen, "geçici ofis:", (await c.okuma(gecici.ofis, gecici.tels[0])).code);
    assert.equal(geri.ok, true, `dönen ofis (P5'le 3 cihazlı) kabul edilmeli: ${JSON.stringify(geri)}`);
    assert.equal(gecen, 3, "dönen ofisin P5 cihazları geçmeli");
  });

  it("(d) ZORLA: eski ofisin tünel temizliği sürerken o ofis geri dönüp tünel alırsa, temizlik bitince ETKİN ofisin tüneli/DNS kaydı silinmemeli", async () => {
    const c = ortam();
    const M = makine(3);
    const asil = await c.yeniOfis(M, 1);
    assert.equal(asil.kayit.ok, true);
    const t1 = await c.tunel(asil.ofis);
    assert.equal(t1.status, 200, "ön koşul: asıl ofis tünel aldı");
    const tunelId = t1.data.tunnelId;
    let ulasti;
    let serbest;
    const ulastiSoz = new Promise(r => (ulasti = r));
    cf.engel = { id: tunelId, ulasti: () => ulasti(), kapi: new Promise(r => (serbest = r)) };
    const gecici = { ofis: await ofisAnahtari(), tels: [await cihaz()] };
    const geciciKayit = c.kayit(gecici.ofis, M, gecici.tels); // kayıt sonrası asıl ofisin tünel silmesi başlar, Cloudflare'de bekler
    await ulastiSoz;
    c.ilerle(1_000);
    const geri = await c.kayit(asil.ofis, M, asil.tels); // asıl ofis o sırada döner
    assert.equal(geri.ok, true, `ön koşul: dönüş kabul: ${JSON.stringify(geri)}`);
    const t2 = await c.tunel(asil.ofis);
    assert.equal(t2.status, 200, "ön koşul: dönen ofis tünel aldı (eski tünel yeniden kullanıldı)");
    serbest();
    cf.engel = null;
    await geciciKayit;
    assert.equal((await c.okuma(asil.ofis, asil.tels[0])).code, "kapi-ozet-yok", "asıl ofis etkin");
    const tunelVar = cf.tunnels.some(t => t.name === `destekofis-${asil.ofis.id}`);
    const dnsVar = cf.dns.some(r => r.name === `${asil.ofis.id}.${ALAN}`);
    console.log("etkin ofisin tüneli:", tunelVar, "DNS:", dnsVar, "verilen tünel kimliği:", t2.data?.tunnelId);
    assert.equal(tunelVar && dnsVar, true, `etkin ofisin tüneli (${tunelVar}) ve DNS kaydı (${dnsVar}) temizlikte silinmemeli`);
  });

  it("(a/e) aynı makinede iki canlı kurulum sırayla yeniden kaydolur: her an en çok 3 cihaz; günde en çok ofisDegisimGunluk el değişimi, sonra 429; etkin olmayanın tüneli kalmaz", async () => {
    const c = ortam();
    const M = makine(4);
    const a = await c.yeniOfis(M, 3);
    const b = await c.yeniOfis(M, 3);
    const t0 = await c.tunel(b.ofis);
    assert.equal(t0.status, 200);
    let kabul = 2; // iki ilk kayıt: ikisi de değişim
    let hiz = 0;
    let sahip = b;
    for (let i = 0; i < 30; i += 1) {
      c.ilerle(60_000);
      const kim = i % 2 === 0 ? a : b;
      const r = await c.kayit(kim.ofis, M, kim.tels);
      if (r.ok) {
        if (kim !== sahip) kabul += 1;
        sahip = kim;
        assert.equal((await c.tunel(kim.ofis)).status, 200);
      } else {
        assert.deepEqual([r.status, r.code], [429, "kapi-hiz"], JSON.stringify(r));
        hiz += 1;
      }
      const gecen = await c.gecenCihaz([a, b]);
      assert.ok(gecen <= 3, `tur ${i}: aynı anda ${gecen} cihaz geçiyor`);
    }
    console.log("kabul edilen el değişimi:", kabul, "429:", hiz, "tünel:", cf.tunnels.filter(t => [a, b].some(o => t.name === `destekofis-${o.ofis.id}`)).length);
    assert.equal(kabul, KAPI_HIZ.ofisDegisimGunluk, "günlük değişim sınırı");
    assert.equal(hiz, 15 - (KAPI_HIZ.ofisDegisimGunluk - 2) / 2, "sınırdan sonra yalnız sahip olmayan 429 alır");
    assert.ok(cf.tunnels.filter(t => [a, b].some(o => t.name === `destekofis-${o.ofis.id}`)).length <= 1, "en çok bir tünel");
  });

  it("(b) yeniden oynatma: devre dışı ofisin ESKİ kaydının aynı baytları (yakalanmış) dönüşte de sonradan da reddedilir; B'nin eski kaydı makineyi geri alamaz", async () => {
    const c = ortam();
    const M = makine(5);
    // Kayıt isteklerini yakalayan istemci.
    const yakalanan = [];
    const yakalayici = async (url, init) => {
      const kopya = { url, init: { ...init, body: init.body } };
      yakalanan.push(kopya);
      return c.istek(url, init);
    };
    const istemci = kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl: yakalayici, simdi: () => c.now(), kayitSimdi: () => (c.ilerle(1), c.now()) });
    const kayit = (ofis, tels) => istemci.kayit(ofis, { lisans: c.belirtec(M), cihazlar: tels.map(x => ({ id: x.id, anahtar: x.anahtar })) });
    const a = { ofis: await ofisAnahtari(), tels: [await cihaz(), await cihaz(), await cihaz()] };
    assert.equal((await kayit(a.ofis, a.tels)).ok, true);
    const aEskiKayit = yakalanan.at(-1);
    c.ilerle(1_000);
    assert.equal((await kayit(a.ofis, a.tels.slice(0, 2))).ok, true, "A üçüncü cihazı sildi");
    const b = { ofis: await ofisAnahtari(), tels: [await cihaz()] };
    assert.equal((await kayit(b.ofis, b.tels)).ok, true, "B devraldı");
    const bKayit = yakalanan.at(-1);
    const oynat = async k => {
      const r = await c.istek(k.url, k.init);
      return { status: r.status, ...(await r.json().catch(() => ({}))) };
    };
    const r1 = await oynat(aEskiKayit);
    assert.equal(r1.ok, false, `A'nın eski (3 cihazlı) kaydı yeniden oynatılınca makineyi geri almamalı: ${JSON.stringify(r1)}`);
    assert.equal((await c.okuma(b.ofis, b.tels[0])).code, "kapi-ozet-yok", "B sürer");
    c.ilerle(1_000);
    assert.equal((await kayit(a.ofis, a.tels.slice(0, 2))).ok, true, "A döner (2 cihaz)");
    assert.equal((await c.okuma(a.ofis, a.tels[2])).code, "kapi-cihaz", "silinen üçüncü cihaz dönen ofisle geri gelmez");
    const r2 = await oynat(bKayit);
    assert.equal(r2.ok, false, `B'nin yakalanmış kaydı yeniden oynatılınca makineyi geri almamalı: ${JSON.stringify(r2)}`);
    const r3 = await oynat(aEskiKayit);
    assert.equal(r3.ok, false, `A'nın eski kaydı dönüşten sonra da reddedilmeli: ${JSON.stringify(r3)}`);
    assert.equal(await c.gecenCihaz([a, b]), 2, "yalnız A'nın 2 cihazı");
    console.log("oynatma yanıtları:", r1.code, r2.code, r3.code);
  });

  it("(c) devre dışıyken programda silinen cihaz dönüşte gelmez; silinen cihazın çerezi silinir (B1)", async () => {
    const c = ortam();
    const M = makine(6);
    const a = await c.yeniOfis(M, 3);
    const b = await c.yeniOfis(M, 0);
    assert.equal(b.kayit.ok, true);
    c.ilerle(1_000);
    const geri = await c.kayit(a.ofis, M, a.tels.slice(0, 2)); // devre dışıyken üçüncü cihaz silindi, güvenlik kaydı
    assert.equal(geri.ok, true);
    assert.equal((await c.okuma(a.ofis, a.tels[2])).code, "kapi-cihaz");
    const kavanoz = { [CIHAZ_CEREZI]: `${a.tels[2].id}.x` };
    const r = await c.canli(a.ofis, "/api/mobil/oturum", kavanoz);
    assert.equal(r.code, "kapi-cihaz");
    assert.equal(CIHAZ_CEREZI in kavanoz, false, "silinen cihazın çerezi silinir");
    assert.equal(await c.gecenCihaz([a, b]), 2);
  });
});
