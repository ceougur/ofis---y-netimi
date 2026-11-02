// 2.4.8 K1 — kapıcı temizlik yarışı (2.4.7 dar kontrol 2, docs/2.4.7-IS-LISTESI.md "SONRAKİ SÜRÜME" KAPICI (a)–(b); (c) test/kapi-gg247-b3.test.mjs):
//   (a) bekleyenleriIsle temizliği her Cloudflare silmesinden HEMEN önce makine eşlemesini yeniden okur: temizlik sürerken eski ofis geri dönüp (son kaydolan
//       kazanır) aynı tüneli aldıysa etkin ofisin tüneline / DNS kaydına dokunulmaz. Zorla yarış (ders 20): Cloudflare'in belirli silme isteği bekletilir.
//   (b) makineyi geri alan (devralan) ofisin özeti kapatılırken silinmişti; devralma kaydından sonra program özeti HEMEN yükler (telefon sunucu kapalıyken
//       boş kalmaz). GERÇEK program + yerel kapıcı (test/kapi-gg247-ortak.mjs).
// Gerçek Cloudflare / internet / lisans servisi YOK (genel fetch sahte Cloudflare'e bağlı, dış adres reddedilir; ders 30). Eski kodda (8ef48138) beklenen nedenle
// kırmızı: (a) "etkin ofisin tüneli/DNS kaydı silindi", (b) "kapi-ozet-yok".
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createKapi } from "../bulut/kapi/kapi.mjs";
import { ecdsaImzala, mesaj, sha256Hex } from "../server/lib/kapi-protokol.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { ADMIN_PASSWORD, kurulum } from "./kapi-gg247-ortak.mjs";
import { cihaz, lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";
import { sahteOnbellek, sahteR2 } from "./kapi-yerel.mjs";

const T0 = Date.parse("2026-11-18T10:00:00+03:00");
const ALAN = "destekofis.test";

function sahteCloudflare() {
  const s = { tunnels: [], dns: [], calls: [], disari: [], seq: 0, engel: null };
  const yanit = (result, ok = true, status = 200) => new Response(JSON.stringify({ success: ok, errors: ok ? [] : [{ code: 1000, message: "sahte hata" }], result }), { status, headers: { "content-type": "application/json" } });
  const bekle = async anahtar => {
    if (s.engel && s.engel.anahtar === anahtar) {
      const e = s.engel;
      s.engel = null;
      e.ulasti();
      await e.kapi;
    }
  };
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
      await bekle(`baglanti:${m[1]}`);
      return yanit(null);
    }
    if ((m = u.pathname.match(/^\/client\/v4\/accounts\/acc\/cfd_tunnel\/([^/]+)$/)) && yontem === "DELETE") {
      s.tunnels = s.tunnels.filter(t => t.id !== m[1]);
      return yanit({ id: m[1] });
    }
    if (u.pathname === "/client/v4/zones/zon/dns_records") {
      if (yontem === "GET") {
        const sonuc = s.dns.filter(r => r.name === u.searchParams.get("name") && r.type === u.searchParams.get("type"));
        await bekle(`dns-liste:${u.searchParams.get("name")}`);
        return yanit(sonuc);
      }
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
function ortam() {
  let t = T0;
  const lisans = lisansAnahtari();
  const env = { OZET: sahteR2(), LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: ALAN, CF_API_TOKEN: "test-cf-belirteci", CF_ACCOUNT_ID: "acc", CF_ZONE_ID: "zon" };
  const kapi = createKapi({
    now: () => t,
    onbellek: sahteOnbellek(),
    lisansFetch: async () => {
      throw new TypeError("lisans servisi yok (test)");
    },
    fetchOrigin: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const istek = (url, init) => kapi.fetch(new Request(url, init), env);
  const istemci = kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl: istek, simdi: () => t, kayitSimdi: () => (t += 1) });
  const c = {
    ilerle: ms => {
      t += ms;
    },
    kayit: (ofis, makine, tels = []) => istemci.kayit(ofis, { lisans: lisans.belirtec({ at: t, machine: makine, licenseId: `LIS-${makine.slice(0, 6)}` }), cihazlar: tels.map(x => ({ id: x.id, anahtar: x.anahtar })) }),
    async yeniOfis(makine, n = 0) {
      const ofis = await ofisAnahtari();
      const tels = [];
      for (let i = 0; i < n; i += 1) tels.push(await cihaz());
      return { ofis, tels, kayit: await c.kayit(ofis, makine, tels) };
    },
    async okuma(ofis, tel) {
      const r = await istek(`https://${ofis.id}.${ALAN}/kapi/ozet`, { headers: await tel.basliklar("GET", t) });
      return (await r.json().catch(() => ({}))).code || "";
    },
    async tunel(ofis) {
      const yol = `/v1/ofis/${ofis.id}/tunel`;
      const govde = JSON.stringify({ v: 1, ofis: ofis.id });
      const imza = await ecdsaImzala(ofis.imzaAnahtari, mesaj.ofis("POST", yol, t, await sha256Hex(govde)));
      const r = await istek(`https://kapi.destekofis.test${yol}`, { method: "POST", headers: { "content-type": "application/json", "x-do-zaman": String(t), "x-do-imza": imza }, body: govde });
      return { status: r.status, ...(await r.json().catch(() => ({}))) };
    },
    tunelVar: ofis => cf.tunnels.some(x => x.name === `destekofis-${ofis.id}`),
    dnsVar: ofis => cf.dns.some(r => r.name === `${ofis.id}.${ALAN}`),
  };
  return c;
}
const makine = i => `${String(i).padStart(4, "0")}${"ef".repeat(14)}`;
function engelle(anahtar) {
  let ulasti;
  let serbest;
  const ulastiSoz = new Promise(r => (ulasti = r));
  cf.engel = { anahtar, ulasti: () => ulasti(), kapi: new Promise(r => (serbest = r)) };
  return { ulasti: ulastiSoz, serbest: () => serbest() };
}

describe("2.4.8 K1 (a) — temizlik sürerken dönen ofisin tüneli / DNS kaydı silinmez (her Cloudflare silmesinden önce eşleme yeniden okunur)", () => {
  before(() => {
    cf = sahteCloudflare();
    globalThis.fetch = (...a) => cf.fetch(...a);
  });
  after(() => {
    globalThis.fetch = gercekFetch;
    assert.deepEqual(cf.disari, [], "dış istek yapılmamalı");
  });

  it("ZORLA: tünel bağlantı silmesi beklerken eski ofis geri dönüp tüneli alır → temizlik bitince ETKİN ofisin tüneli ve DNS kaydı durur", async () => {
    const c = ortam();
    const M = makine(1);
    const asil = await c.yeniOfis(M, 1);
    assert.equal(asil.kayit.ok, true);
    const t1 = await c.tunel(asil.ofis);
    assert.equal(t1.status, 200, "ön koşul: asıl ofis tünel aldı");
    const yaris = engelle(`baglanti:${t1.data.tunnelId}`);
    const gecici = { ofis: await ofisAnahtari() };
    const geciciKayit = c.kayit(gecici.ofis, M); // kayıt sonrası asıl ofisin tünel silmesi başlar, Cloudflare'de bekler
    await yaris.ulasti;
    c.ilerle(1_000);
    assert.equal((await c.kayit(asil.ofis, M, asil.tels)).ok, true, "ön koşul: asıl ofis o sırada döner");
    const t2 = await c.tunel(asil.ofis);
    assert.equal(t2.status, 200, "ön koşul: dönen ofis tünel aldı (eski tünel yeniden kullanıldı)");
    yaris.serbest();
    await geciciKayit;
    assert.equal(await c.okuma(asil.ofis, asil.tels[0]), "kapi-ozet-yok", "asıl ofis etkin");
    assert.equal(c.tunelVar(asil.ofis), true, "etkin ofisin tüneli temizlikte silinmemeli");
    assert.equal(c.dnsVar(asil.ofis), true, "etkin ofisin DNS kaydı temizlikte silinmemeli");
  });

  it("ZORLA: tünel silindikten sonra DNS silmesi beklerken ofis geri dönüp yeni tünel alır → DNS kaydı silinmez (DNS silmesinden önce de yeniden okunur)", async () => {
    const c = ortam();
    const M = makine(2);
    const asil = await c.yeniOfis(M, 1);
    assert.equal((await c.tunel(asil.ofis)).status, 200);
    const yaris = engelle(`dns-liste:${asil.ofis.id}.${ALAN}`);
    const geciciKayit = c.kayit(await ofisAnahtari(), M);
    await yaris.ulasti; // eski tünel silindi; DNS kaydı listeleniyor
    c.ilerle(1_000);
    assert.equal((await c.kayit(asil.ofis, M, asil.tels)).ok, true, "ön koşul: asıl ofis döner");
    assert.equal((await c.tunel(asil.ofis)).status, 200, "ön koşul: dönen ofis yeni tünel aldı");
    yaris.serbest();
    await geciciKayit;
    assert.equal(c.tunelVar(asil.ofis), true, "dönen ofisin yeni tüneli durur");
    assert.equal(c.dnsVar(asil.ofis), true, "dönen ofisin DNS kaydı silinmemeli");
  });

  it("dönmeyen eski ofisin tüneli ve DNS kaydı yine silinir (temizlik çalışıyor)", async () => {
    const c = ortam();
    const M = makine(3);
    const eski = await c.yeniOfis(M);
    assert.equal((await c.tunel(eski.ofis)).status, 200);
    const yeni = await c.yeniOfis(M);
    assert.equal(yeni.kayit.ok, true);
    assert.deepEqual([c.tunelVar(eski.ofis), c.dnsVar(eski.ofis)], [false, false], "devre dışı ofisin tüneli + DNS silindi");
  });
});

describe("2.4.8 K1 (b) — devralma kaydından sonra program özeti HEMEN yükler (gerçek program + yerel kapıcı)", () => {
  it("başka kurulum makineyi devraldıktan sonra asıl kurulum geri dönünce telefon son özeti hemen alır (bir sonraki veri değişikliğini beklemez)", async () => {
    const ctx = await kurulum();
    try {
      const tel = await ctx.paired("admin", ADMIN_PASSWORD);
      await ctx.sync.idle();
      assert.equal((await tel.readSummary({ now: ctx.clock.ms() })).status, 200, "ön koşul: eşlemeden sonra özet var");
      // Aynı lisans (makine) yeni bir kurulumla kaydolur (yeniden kurulum): asıl ofis devre dışı, özeti silinir.
      const baska = await ofisAnahtari();
      const istemci = kapiIstemcisi({ url: ctx.kapi.base, fetchImpl: (u, i) => gercekFetch(u, i), simdi: () => ctx.clock.ms() });
      assert.equal((await istemci.kayit(baska, { lisans: ctx.belirtec(), cihazlar: [] })).ok, true, "ön koşul: başka kurulum makineyi devraldı");
      assert.equal((await tel.readSummary({ now: ctx.clock.ms() })).code, "kapi-cihaz", "ön koşul: asıl ofis kapandı");
      ctx.clock.set(ctx.clock.ms() + 5_000);
      // Asıl kurulum açılır (eski veri geri yüklendi): kaydolur → son kaydolan kazanır.
      const geri = await ctx.sync.kayitGonder({ zorla: true });
      assert.equal(geri.ok, true, `asıl kurulum makineyi geri aldı: ${JSON.stringify(geri)}`);
      await ctx.sync.idle();
      const ozet = await tel.readSummary({ now: ctx.clock.ms() });
      assert.equal(ozet.status, 200, `devralmadan sonra telefon son özeti hemen almalı; gelen ${ozet.status} ${ozet.code}`);
      assert.equal(ctx.sync.status().son?.neden, "devralma", "yükleme nedeni devralma");
    } finally {
      await ctx.close();
    }
  });
});
