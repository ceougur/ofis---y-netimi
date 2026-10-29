// 2.4.7 bağımsız gözden geçirme B3 (YÜKSEK) — kalıcı test (yeniden üretme betiği gg247-ana-tekrar/b3-tek-lisans-cok-ofis.test.mjs'ten).
// Bulgu: kapıcının 3 cihaz sınırı (K13; M3-TASARIM §5 "program atlatılıp kapıcıya doğrudan kayıt yapılsa da sınır aşılamaz") OFİS KİMLİĞİ başınaydı: aynı lisans
// belirteciyle (aynı makine) istenen sayıda yeni ofis kimliği (kendi ürettiği anahtarla) kaydedilip her birine 3 cihaz ve AYRI tünel + DNS kaydı alınabiliyordu;
// hız sınırı yoktu. Ücretsiz Cloudflare alanında 200 DNS kaydı sınırı → kota tüketilebilir.
// BAŞ MİMAR KARARI: kapıcıda makine (belirteçteki machine) → ofis TEK eşleme; aynı makine yeni ofis kimliğiyle gelirse eskisi devre dışı (cihazları düşer, tüneli +
// DNS kaydı silinir), yeni ofis kabul; tünel yalnız güncel ofise; kayıt/tünel uçlarına makine başına hız sınırı + günlük yeni ofis tavanı; DENEME belirteci aynı
// kurallarla. Uygulama: bulut/kapi/makine.mjs (+ kapi.mjs, tunel.mjs).
// Gerçek Cloudflare'e istek YOK (ders 30): genel fetch yalnız sahte Cloudflare API'sini (api.cloudflare.com adı) yanıtlar, başka her adresi reddedip kaydeder;
// son denetim o listenin boş olduğunu iddia eder. Saat sahte (ders 13): İstanbul gün dönümü ve saat dönümü elle geçilir.
// Eski kodda (e73e9860) kırmızı: aynı anda 12 cihaz geçer, 5 tünel + 5 DNS kaydı kalır, hiçbir hız sınırı 429 vermez (ders 7/38: iletiler bu nedeni söyler).
import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import * as kapiModulu from "../bulut/kapi/kapi.mjs";
import { ecdsaImzala, mesaj, sha256Hex } from "../server/lib/kapi-protokol.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { cihaz, lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";
import { sahteOnbellek, sahteR2 } from "./kapi-yerel.mjs";

const { createKapi } = kapiModulu;
// Sınırlar kapıcının adlı sabitinden (eski kodda yok → kararın örnek sayıları; kırmızı kanıt "429 gelmedi" iletisiyle).
const HIZ = kapiModulu.KAPI_HIZ ?? { kayitSaatlik: 240, tunelSaatlik: 30, ofisDegisimGunluk: 10, yeniOfisGunluk: 50 };
const T0 = Date.parse("2026-11-18T10:00:00+03:00");
const ALAN = "destekofis.test";
const SAAT = 3_600_000;
const gecmeyen = new Set(["kapi-cihaz", "kapi-ofis-degisti"]);

// Sahte Cloudflare API (tünel + DNS; silme dahil). Genel fetch'in yerine geçer; başka adres reddedilir ve kaydedilir.
function sahteCloudflare() {
  const s = { tunnels: [], dns: [], calls: [], disari: [], silmeBozuk: false, seq: 0 };
  const yanit = (result, ok = true, status = 200) => new Response(JSON.stringify({ success: ok, errors: ok ? [] : [{ code: 1000, message: "sahte hata" }], result }), { status, headers: { "content-type": "application/json" } });
  s.fetch = async (input, init = {}) => {
    const u = new URL(typeof input === "string" ? input : input.url);
    if (u.hostname !== "api.cloudflare.com") {
      s.disari.push(String(u));
      throw new TypeError("test: dış istek yasak");
    }
    assert.equal(init.headers?.authorization, "Bearer test-cf-belirteci");
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
    if ((m = u.pathname.match(/^\/client\/v4\/accounts\/acc\/cfd_tunnel\/([^/]+)\/connections$/)) && yontem === "DELETE") return s.silmeBozuk ? yanit(null, false, 503) : yanit(null);
    if ((m = u.pathname.match(/^\/client\/v4\/accounts\/acc\/cfd_tunnel\/([^/]+)$/)) && yontem === "DELETE") {
      if (s.silmeBozuk) return yanit(null, false, 503);
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
        if (s.silmeBozuk) return yanit(null, false, 503);
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
});

// Zorla yarış (ders 20): verilen anahtarın İLK `adet` okuması birbirini bekler — hepsi aynı (önceki) durumu okur, sonra yazar.
function bariyerliR2(r2, anahtar, adet = 2) {
  const bekleyen = [];
  let acik = false;
  return {
    ...r2,
    async get(key) {
      const sonuc = await r2.get(key);
      if (acik || key !== anahtar) return sonuc;
      await new Promise(resolve => {
        bekleyen.push(resolve);
        if (bekleyen.length >= adet) {
          acik = true;
          for (const r of bekleyen) r();
        }
      });
      return sonuc;
    },
  };
}

function ortam({ r2Sar = r2 => r2 } = {}) {
  let t = T0;
  const lisans = lisansAnahtari();
  const env = { OZET: r2Sar(sahteR2()), LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: ALAN, CF_API_TOKEN: "test-cf-belirteci", CF_ACCOUNT_ID: "acc", CF_ZONE_ID: "zon" };
  const kapi = createKapi({
    now: () => t,
    onbellek: sahteOnbellek(),
    lisansFetch: async () => {
      throw new TypeError("lisans servisi yok (test)");
    },
    fetchOrigin: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const istek = (url, init) => kapi.fetch(new Request(url, init), env);
  // Kayıt zamanı her kayıtta 1 ms ilerler (kapıcı aynı ofisin eski kaydını yeniden oynatma sayar).
  const istemci = kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl: istek, simdi: () => t, kayitSimdi: () => (t += 1) });
  const c = {
    env,
    lisans,
    now: () => t,
    ilerle: ms => {
      t += ms;
    },
    belirtec: (makine, ek = {}) => lisans.belirtec({ at: t, machine: makine, licenseId: `LIS-${makine.slice(0, 6)}`, ...ek }),
    kayit: (ofis, makine, cihazlar = [], ek = {}) => istemci.kayit(ofis, { lisans: c.belirtec(makine, ek), cihazlar: cihazlar.map(x => ({ id: x.id, anahtar: x.anahtar })) }),
    async yeniOfis(makine, n = 0, ek = {}) {
      const ofis = await ofisAnahtari();
      const tels = [];
      for (let i = 0; i < n; i += 1) tels.push(await cihaz());
      return { ofis, tels, kayit: await c.kayit(ofis, makine, tels, ek) };
    },
    // Cihazın kapıdan geçip geçmediği: özet okuması (özet yüklenmediğinden geçen cihaz kapi-ozet-yok alır; geçmeyen kapi-cihaz).
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
    async canli(ofis, yol = "/mobil/") {
      const r = await istek(`https://${ofis.id}.${ALAN}${yol}`, {});
      return { status: r.status, code: (await r.clone().json().catch(() => ({}))).code || "" };
    },
  };
  return c;
}
const makine = i => `${String(i).padStart(4, "0")}${"ab".repeat(14)}`;

describe("B3 tek lisans (tek makine) → kapıcıda TEK etkin ofis", () => {
  afterEach(() => {
    cf.silmeBozuk = false;
  });

  it("aynı makine 4 ofis × 3 cihaz: her yeni ofis kabul, eskisi devre dışı → aynı anda kapıdan geçen cihaz 3 (sınır); eski ofisin kaydı/yüklemesi/canlı isteği 410", async () => {
    const c = ortam();
    const M = makine(1);
    const ofisler = [];
    for (let i = 0; i < 4; i += 1) {
      const o = await c.yeniOfis(M, 3);
      assert.equal(o.kayit.ok, true, `${i + 1}. ofis kaydı (yeni ofis kimliği makineyi devralır): ${JSON.stringify(o.kayit)}`);
      ofisler.push(o);
    }
    const gecen = await c.gecenCihaz(ofisler);
    assert.equal(gecen, 3, `tek lisans/makineyle kapıcıdan aynı anda ${gecen} cihaz geçiyor (sınır 3)`);
    for (const tel of ofisler[3].tels) assert.equal((await c.okuma(ofisler[3].ofis, tel)).code, "kapi-ozet-yok", "son ofisin cihazları kapıdan geçer (özet henüz yok)");
    const eski = ofisler[0];
    const yeniden = await c.kayit(eski.ofis, M, eski.tels);
    assert.equal(yeniden.code, "kapi-ofis-degisti", `yerini bırakmış ofisin kaydı reddedilmeli (gidip gelme yok): ${JSON.stringify(yeniden)}`);
    assert.equal(yeniden.status, 410);
    assert.equal((await c.canli(eski.ofis)).code, "kapi-ofis-degisti", "eski ofisin adresi (cihazsız sayfa yolu) kapalı");
    assert.equal(await c.gecenCihaz(ofisler), 3, "eski ofisin kayıt denemesi güncel ofisi bozmaz");
  });

  it("her yeni ofis eskisinin tünelini + DNS kaydını siler: 5 kurulumdan sonra etkin tünel 1, DNS kaydı 1; eski ofisin tünel başvurusu 410", async () => {
    const c = ortam();
    const M = makine(2);
    const once = { tunnels: cf.tunnels.length, dns: cf.dns.length };
    const ofisler = [];
    for (let i = 0; i < 5; i += 1) {
      const o = await c.yeniOfis(M);
      assert.equal(o.kayit.ok, true, JSON.stringify(o.kayit));
      const t = await c.tunel(o.ofis);
      assert.equal(t.status, 200, `${i + 1}. ofisin tüneli: ${JSON.stringify(t)}`);
      ofisler.push(o);
    }
    const tunel = cf.tunnels.length - once.tunnels;
    const dns = cf.dns.length - once.dns;
    assert.deepEqual([tunel, dns], [1, 1], `tek lisans/makine ${tunel} tünel + ${dns} DNS kaydı tutuyor (beklenen 1 + 1)`);
    assert.ok(cf.tunnels.some(t => t.name === `destekofis-${ofisler[4].ofis.id}`), "kalan tünel güncel ofisin");
    const eski = await c.tunel(ofisler[0].ofis);
    assert.deepEqual([eski.status, eski.code], [410, "kapi-ofis-degisti"], `eski ofis tünel alamaz: ${JSON.stringify(eski)}`);
    assert.deepEqual(cf.disari, [], "Cloudflare dışına istek gitmedi (ders 30)");
  });

  it("Cloudflare silmesi başarısızsa eski ofis yine kapanır, temizlik bekler; sonraki kayıtta tünel + DNS silinir", async () => {
    const c = ortam();
    const M = makine(3);
    const a = await c.yeniOfis(M, 1);
    assert.equal((await c.tunel(a.ofis)).status, 200);
    cf.silmeBozuk = true;
    const b = await c.yeniOfis(M, 1);
    assert.equal(b.kayit.ok, true, `Cloudflare yanıt vermese de yeni ofis kaydı kabul: ${JSON.stringify(b.kayit)}`);
    assert.equal((await c.okuma(a.ofis, a.tels[0])).code, "kapi-cihaz", "eski ofisin cihazı hemen düşer");
    assert.ok(cf.tunnels.some(t => t.name === `destekofis-${a.ofis.id}`), "ön koşul: silme başarısız oldu, eski tünel duruyor");
    cf.silmeBozuk = false;
    assert.equal((await c.kayit(b.ofis, M, b.tels)).ok, true);
    assert.ok(!cf.tunnels.some(t => t.name === `destekofis-${a.ofis.id}`), "sonraki kayıtta eski tünel silindi");
    assert.ok(!cf.dns.some(r => r.name === `${a.ofis.id}.${ALAN}`), "sonraki kayıtta eski DNS kaydı silindi");
  });

  it("ofis başka makineye taşınırsa (lisans yeni makineye aktarıldı) çalışmayı sürdürür; eski makinede açılan yeni ofis onun tüneline/DNS'ine dokunmaz", async () => {
    const c = ortam();
    const M1 = makine(8);
    const M2 = makine(9);
    const a = await c.yeniOfis(M1, 1);
    assert.equal((await c.tunel(a.ofis)).status, 200);
    assert.equal((await c.kayit(a.ofis, M2, a.tels)).ok, true, "aynı ofis yeni makinenin belirteciyle kaydolur");
    const b = await c.yeniOfis(M1, 1);
    assert.equal(b.kayit.ok, true, JSON.stringify(b.kayit));
    assert.equal((await c.okuma(a.ofis, a.tels[0])).code, "kapi-ozet-yok", "taşınan ofisin cihazı geçmeye devam eder");
    assert.ok(cf.tunnels.some(t => t.name === `destekofis-${a.ofis.id}`), "taşınan ofisin tüneli silinmedi");
    assert.equal((await c.tunel(a.ofis)).status, 200, "taşınan ofis tünel almaya devam eder");
    assert.equal(await c.gecenCihaz([a, b]), 2, "iki makine, iki ofis");
  });

  it(`DENEME belirteci aynı kurallarla: aynı makinenin ikinci deneme ofisi birincisini kapatır`, async () => {
    const c = ortam();
    const M = makine(4);
    const a = await c.yeniOfis(M, 3, { kind: "trial" });
    const b = await c.yeniOfis(M, 3, { kind: "trial" });
    assert.equal(a.kayit.ok && b.kayit.ok, true, JSON.stringify([a.kayit, b.kayit]));
    assert.equal(await c.gecenCihaz([a, b]), 3, "deneme belirteciyle de aynı anda en çok 3 cihaz");
  });

  it("eşzamanlı iki yeni ofis kaydı (aynı makine, 6 tur): her turda kapıdan geçen cihaz en çok 3", async () => {
    const c = ortam();
    for (let tur = 0; tur < 6; tur += 1) {
      const M = makine(100 + tur);
      const hazir = [];
      for (let i = 0; i < 2; i += 1) hazir.push({ ofis: await ofisAnahtari(), tels: [await cihaz(), await cihaz(), await cihaz()] });
      const sonuc = await Promise.all(hazir.map(o => c.kayit(o.ofis, M, o.tels)));
      const gecen = await c.gecenCihaz(hazir);
      assert.ok(gecen <= 3, `tur ${tur}: aynı makinede ${gecen} cihaz geçiyor (sınır 3); kayıtlar ${JSON.stringify(sonuc.map(r => r.code || "ok"))}`);
    }
  });

  it("ZORLA yarış: makine nesnesinin ilk yazımını iki yeni ofis aynı anda yapar (ikisi de 'yok' okur, sonuncu üstüne yazar) → yine YALNIZ bir ofisin 3 cihazı geçer", async () => {
    const M = makine(200);
    let bariyer = 0;
    const c = ortam({
      r2Sar: r2 => {
        const sarili = bariyerliR2(r2, `makine/${M}.json`);
        return { ...sarili, get: async key => (key === `makine/${M}.json` && (bariyer += 1), sarili.get(key)) };
      },
    });
    const hazir = [];
    for (let i = 0; i < 2; i += 1) hazir.push({ ofis: await ofisAnahtari(), tels: [await cihaz(), await cihaz(), await cihaz()] });
    const sonuc = await Promise.all(hazir.map(o => c.kayit(o.ofis, M, o.tels)));
    assert.ok(bariyer >= 2, "ön koşul: iki kayıt da makine nesnesini yazmadan önce okudu");
    const gecen = await c.gecenCihaz(hazir);
    assert.equal(gecen, 3, `ilk yazım yarışında ${gecen} cihaz geçiyor (beklenen tek ofis = 3); kayıtlar ${JSON.stringify(sonuc.map(r => r.code || "ok"))}`);
  });

  it(`makine başına günde ${HIZ.ofisDegisimGunluk} ofis değişimi; sonraki yeni ofis 429 kapi-hiz ve güncel ofis bozulmaz; İstanbul gün dönümünde açılır`, async () => {
    const c = ortam();
    const M = makine(5);
    let son = null;
    for (let i = 0; i < HIZ.ofisDegisimGunluk; i += 1) {
      son = await c.yeniOfis(M, 1);
      assert.equal(son.kayit.ok, true, `${i + 1}. değişim: ${JSON.stringify(son.kayit)}`);
    }
    const fazla = await c.yeniOfis(M, 1);
    assert.deepEqual([fazla.kayit.status, fazla.kayit.code], [429, "kapi-hiz"], `${HIZ.ofisDegisimGunluk + 1}. ofis değişimi reddedilmeli: ${JSON.stringify(fazla.kayit)}`);
    assert.equal((await c.okuma(son.ofis, son.tels[0])).code, "kapi-ozet-yok", "reddedilen değişim güncel ofisi kapatmaz");
    assert.equal((await c.kayit(son.ofis, M, son.tels)).ok, true, "güncel ofisin yeniden kaydı değişim sayılmaz");
    c.ilerle(14 * SAAT); // 2026-11-19 00:00 TR'yi geçer
    assert.equal((await c.kayit(fazla.ofis, M, fazla.tels)).ok, true, "ertesi gün yeni ofis kabul");
  });

  it(`kapıcı genelinde günde ${HIZ.yeniOfisGunluk} yeni ofis; ${HIZ.yeniOfisGunluk + 1}. (başka makine) 429 kapi-hiz; kayıtlı ofisin yeniden kaydı etkilenmez; ertesi gün açılır`, async () => {
    const c = ortam();
    let ilk = null;
    for (let i = 0; i < HIZ.yeniOfisGunluk; i += 1) {
      const o = await c.yeniOfis(makine(1000 + i));
      assert.equal(o.kayit.ok, true, `${i + 1}. yeni ofis: ${JSON.stringify(o.kayit)}`);
      ilk ||= o;
    }
    const fazla = await c.yeniOfis(makine(1999));
    assert.deepEqual([fazla.kayit.status, fazla.kayit.code], [429, "kapi-hiz"], `günün ${HIZ.yeniOfisGunluk + 1}. yeni ofisi reddedilmeli: ${JSON.stringify(fazla.kayit)}`);
    assert.equal((await c.kayit(ilk.ofis, makine(1000))).ok, true, "kayıtlı ofisin yeniden kaydı tavana takılmaz");
    c.ilerle(14 * SAAT);
    assert.equal((await c.kayit(fazla.ofis, makine(1999))).ok, true, "ertesi gün kabul");
  });

  it(`makine başına saatte ${HIZ.kayitSaatlik} kayıt; sonraki 429 kapi-hiz; saat dönümünde açılır`, async () => {
    const c = ortam();
    const M = makine(6);
    const o = await c.yeniOfis(M, 1);
    assert.equal(o.kayit.ok, true);
    let kabul = 1;
    let ret = null;
    for (let i = 1; i <= HIZ.kayitSaatlik && !ret; i += 1) {
      const r = await c.kayit(o.ofis, M, o.tels);
      if (r.ok) kabul += 1;
      else ret = r;
    }
    assert.equal(kabul, HIZ.kayitSaatlik, `saatte ${HIZ.kayitSaatlik} kayıt kabul; gelen ${kabul}`);
    assert.deepEqual([ret?.status, ret?.code], [429, "kapi-hiz"], `${HIZ.kayitSaatlik + 1}. kayıt reddedilmeli: ${JSON.stringify(ret)}`);
    assert.equal((await c.okuma(o.ofis, o.tels[0])).code, "kapi-ozet-yok", "hız sınırı ofisi kapatmaz");
    c.ilerle(SAAT);
    assert.equal((await c.kayit(o.ofis, M, o.tels)).ok, true, "sonraki saat kabul");
  });

  it(`makine başına saatte ${HIZ.tunelSaatlik} tünel başvurusu; sonraki 429 kapi-hiz; saat dönümünde açılır`, async () => {
    const c = ortam();
    const M = makine(7);
    const o = await c.yeniOfis(M);
    let kabul = 0;
    let ret = null;
    for (let i = 0; i <= HIZ.tunelSaatlik && !ret; i += 1) {
      const r = await c.tunel(o.ofis);
      if (r.status === 200) kabul += 1;
      else ret = r;
    }
    assert.equal(kabul, HIZ.tunelSaatlik, `saatte ${HIZ.tunelSaatlik} tünel başvurusu kabul; gelen ${kabul}`);
    assert.deepEqual([ret?.status, ret?.code], [429, "kapi-hiz"], `${HIZ.tunelSaatlik + 1}. başvuru reddedilmeli: ${JSON.stringify(ret)}`);
    c.ilerle(SAAT);
    // Program saatlik belirteç yenilemesini kayıtla bildirir (P9: kapıcı en çok 1 saat eski lisansı kabul eder).
    assert.equal((await c.kayit(o.ofis, M)).ok, true);
    assert.equal((await c.tunel(o.ofis)).status, 200, "sonraki saat kabul");
    assert.deepEqual(cf.disari, [], "Cloudflare dışına istek gitmedi (ders 30)");
  });
});
