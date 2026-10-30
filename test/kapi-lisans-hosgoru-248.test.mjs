// 2.4.8 L1 — lisans kapısı (ürün sahibi kararı "KARAR L1", 30.10.2026; docs/2.4.8-IS-LISTESI.md): kapıcı tarafı + zamanlanmış temizlik.
//   * DENEME biter → mobil HEMEN kapanır; bitişten 30 gün içinde lisans alınmazsa kapıcıdaki mobil kaydı (ofis kaydı, cihazlar, R2 özeti, tünel, DNS) silinir.
//   * ÜCRETLİ lisans biter → mobil 30 GÜN salt okunur sürer (canlı + son özet; yeni cihaz eklenmez), 30. günün sonunda kapanır ve kayıt HEMEN silinir.
//   * ENGELLENEN lisans → mobil hemen kapanır, kayıt 30 günde (engelin kapıcıca ilk görüldüğü andan) silinir.
//   * Uyarılar: bitişe 7 gün kala "Lisansınız N gün sonra bitiyor."; hoşgörüde "Lisansınız bitti; mobil kullanım hakkınız N gün sonra sona erecek."; sonunda
//     "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin.".
//   * Sonradan lisans alınırsa silinmiş kayıt GERİ GELMEZ: program aynı kimlikle kaydolunca kayıt cihazsız açılır, "silindi" bildirilir.
// Sahte saat (ders 13, 22): bitiş günü, 7 gün kala, 29/30/31. gün, İstanbul gece yarısı. Sahte R2, sahte lisans servisi, sahte Cloudflare — gerçek Cloudflare'e
// ve lisans servisine istek YOK (ders 30). Eski kodda (8ef48138) mobilHakki/temizlik yok → bu dosyanın denetimleri beklenen nedenle kırmızı (ders 7, 38).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKapi } from "../bulut/kapi/kapi.mjs";
import * as protokol from "../server/lib/kapi-protokol.mjs";
import { kapiIstemcisi, ozetPaketle } from "../server/lib/mobile-ozet.mjs";
import { CIHAZ_CEREZI } from "../server/lib/mobil-cerez.mjs";
import { sahteOnbellek, sahteR2 } from "./kapi-yerel.mjs";
import { cihaz, lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";

const GUN = 86_400_000;
const MIN = 60_000;
const ALAN = "destekofis.test";
// Bitiş İstanbul gece yarısı (01.12.2026 00:00 TR); hoşgörü 31.12.2026 00:00 TR'de biter (yıl dönümüne bir gün).
const BITIS = Date.parse("2026-12-01T00:00:00+03:00");
const T0 = BITIS - 20 * GUN;

/** Sahte Cloudflare tünel/DNS istemcisi (createCloudflareTunnels ile aynı yüz): durum, çağrı günlüğü, arıza ve bekletme düğmeleri. */
function sahteCloudflare() {
  const s = { tunnels: [], dns: [], calls: [], bozuk: false, engel: null, seq: 0 };
  const hata = () => {
    const e = new Error("kapi-tunel");
    e.kod = "kapi-tunel";
    return e;
  };
  s.istemci = {
    async findTunnel(name) {
      s.calls.push(`find ${name}`);
      if (s.engel?.ad === name) {
        s.engel.ulasti();
        await s.engel.kapi;
      }
      if (s.bozuk) throw hata();
      return s.tunnels.find(t => t.name === name) || null;
    },
    async createTunnel(name) {
      s.calls.push(`create ${name}`);
      s.seq += 1;
      const t = { id: `${String(s.seq).padStart(8, "0")}-1111-4111-8111-111111111111`, name };
      s.tunnels.push(t);
      return t;
    },
    tunnelToken: async id => `calistirma-${id}`,
    async ensureCname(hostname, target) {
      s.calls.push(`cname ${hostname}`);
      const var_ = s.dns.find(r => r.name === hostname);
      if (var_) return Object.assign(var_, { content: target });
      const r = { id: `dns${s.dns.length + 1}`, name: hostname, content: target };
      s.dns.push(r);
      return r;
    },
    async deleteTunnel(id) {
      s.calls.push(`delete-tunnel ${id}`);
      if (s.bozuk) throw hata();
      s.tunnels = s.tunnels.filter(t => t.id !== id);
      return { id };
    },
    async deleteCname(hostname) {
      s.calls.push(`delete-dns ${hostname}`);
      if (s.bozuk) throw hata();
      s.dns = s.dns.filter(r => r.name !== hostname);
      return true;
    },
  };
  return s;
}

function ortam({ servis = true } = {}) {
  let t = T0;
  const lisans = lisansAnahtari();
  const r2 = sahteR2();
  const cf = sahteCloudflare();
  const servisKaydi = new Map(); // makine → { kind, status, expiresAt } (lisans servisinin gerçeği)
  const servisCagrisi = [];
  const iletilen = [];
  const ctx = { servisErisim: true };
  const kapi = createKapi({
    now: () => t,
    onbellek: sahteOnbellek(),
    cloudflare: cf.istemci,
    lisansFetch: async (url, init) => {
      const body = JSON.parse(init.body);
      servisCagrisi.push(body);
      if (!servis || !ctx.servisErisim) throw new TypeError("fetch failed");
      const k = servisKaydi.get(body.machine);
      if (!k) return { json: async () => ({ ok: false, code: "bilinmiyor" }) };
      return { json: async () => ({ ok: true, token: lisans.belirtec({ at: t, machine: body.machine, licenseId: body.licenseId, ...k }) }) };
    },
    fetchOrigin: async request => {
      iletilen.push(request.url);
      return new Response(JSON.stringify({ ok: true, data: { yol: new URL(request.url).pathname } }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const env = { OZET: r2, LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: ALAN, ...(servis ? { LISANS_URL: "https://lisans.kapi.test/api/lisans", KAPI_LISANS_ANAHTARI: "gizli-test" } : {}) };
  const fetchImpl = async (url, init = {}) => kapi.fetch(new Request(url, init), env);
  const istemci = kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl, simdi: () => t, kayitSimdi: () => t });
  Object.assign(ctx, {
    lisans,
    r2,
    cf,
    env,
    kapi,
    servisKaydi,
    servisCagrisi,
    iletilen,
    istemci,
    now: () => t,
    saat: ms => {
      t = ms;
    },
    ilerle: ms => {
      t += ms;
    },
    belirtec: (makine, k) => lisans.belirtec({ at: t, machine: makine, licenseId: `LIS-${makine.slice(0, 6)}`, ...k }),
    async kayit(o, { makine, cihazlar, k = ctx.servisKaydi.get(makine) }) {
      t += 1;
      return istemci.kayit(o, { lisans: ctx.belirtec(makine, k), cihazlar: cihazlar.map(x => ({ id: x.id, anahtar: x.anahtar })) });
    },
    /** Ofis kur: kayıt (geçerli lisansla), özet yükle, tünel al. */
    async ofisKur({ makine, k, n = 1 }) {
      ctx.servisKaydi.set(makine, k);
      const o = await ofisAnahtari();
      const tels = [];
      for (let i = 0; i < n; i += 1) tels.push(await cihaz());
      const r = await ctx.kayit(o, { makine, cihazlar: tels, k });
      assert.equal(r.ok, true, `ön koşul: kayıt kabul: ${JSON.stringify(r)}`);
      const sifre = await globalThis.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
      const jwk = await globalThis.crypto.subtle.exportKey("jwk", sifre.publicKey);
      const zarf = await ozetPaketle({ ofis: o.id, sira: 1, uretim: new Date(t).toISOString(), imzaAnahtari: o.imzaAnahtari, kullanicilar: [{ anahtar: "u1", veri: { v: 1 }, cihazlar: tels.map(c => ({ id: c.id, sifre: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } })) }] });
      assert.equal((await istemci.ozetYukle(o, zarf)).ok, true, "ön koşul: özet yüklendi");
      assert.equal((await ctx.tunel(o)).status, 200, "ön koşul: tünel + DNS açıldı");
      return { ofis: o, tels, makine };
    },
    async tunel(o) {
      const yol = `/v1/ofis/${o.id}/tunel`;
      const govde = JSON.stringify({ v: 1, ofis: o.id });
      const imza = await protokol.ecdsaImzala(o.imzaAnahtari, protokol.mesaj.ofis("POST", yol, t, await protokol.sha256Hex(govde)));
      const r = await kapi.fetch(new Request(`https://kapi.destekofis.test${yol}`, { method: "POST", headers: { "content-type": "application/json", "x-do-zaman": String(t), "x-do-imza": imza }, body: govde }), env);
      return { status: r.status, ...(await r.json().catch(() => ({}))) };
    },
    async ozet(o, tel) {
      const r = await kapi.fetch(new Request(`https://${o.id}.${ALAN}/kapi/ozet`, { headers: await tel.basliklar("GET", t) }), env);
      const metin = await r.text();
      let veri = null;
      try {
        veri = JSON.parse(metin);
      } catch {
        veri = null;
      }
      const ileti = r.headers.get("x-do-mobil-ileti");
      return { status: r.status, code: veri?.code || "", error: veri?.error || "", uyari: ileti ? decodeURIComponent(ileti) : "" };
    },
    async canli(o, tel) {
      const r = await kapi.fetch(new Request(`https://${o.id}.${ALAN}/api/mobil/session`, { headers: { cookie: `${CIHAZ_CEREZI}=${tel.id}.sir` } }), env);
      const veri = await r.json().catch(() => ({}));
      return { status: r.status, code: veri.code || "", error: veri.error || "" };
    },
    var: anahtar => r2.nesneler.has(anahtar),
    meta: ofisId => {
      const k = r2.nesneler.get(`ofis/${ofisId}/meta.json`);
      return k ? JSON.parse(new TextDecoder().decode(k.veri)) : null;
    },
    kayitVar: o => ({
      meta: r2.nesneler.has(`ofis/${o.id}/meta.json`),
      ozet: r2.nesneler.has(`ofis/${o.id}/ozet.json`),
      tunel: cf.tunnels.some(x => x.name === `destekofis-${o.id}`),
      dns: cf.dns.some(x => x.name === `${o.id}.${ALAN}`),
    }),
    temizlik: () => kapi.temizlik(env),
  });
  return ctx;
}
const makine = i => `${String(i).padStart(4, "0")}${"ab".repeat(14)}`;
const LISANS = (ek = {}) => ({ kind: "license", status: "active", expiresAt: new Date(BITIS).toISOString(), ...ek });
const DENEME = (ek = {}) => ({ kind: "trial", status: "active", expiresAt: new Date(BITIS).toISOString(), ...ek });
const HEPSI = { meta: true, ozet: true, tunel: true, dns: true };
const HIC = { meta: false, ozet: false, tunel: false, dns: false };

describe("2.4.8 L1 — mobil kullanım hakkı kuralı (kapi-protokol; program ve kapıcı aynı işlev)", () => {
  it("ücretli lisans: 7 gün kala uyarı, bitişte 30 gün hoşgörü (29. günün sonunda 1 gün), 30. günün sonunda kapanır; gece yarısı sınırları", () => {
    const { mobilHakki, mobilHakIletisi } = protokol;
    assert.equal(typeof mobilHakki, "function", "kapi-protokol mobilHakki yok (2.4.8 L1)");
    const iddia = { kind: "license", status: "active", expiresAt: BITIS };
    const hak = t => mobilHakki(iddia, t);
    assert.deepEqual([hak(BITIS - 8 * GUN).durum, hak(BITIS - 8 * GUN).uyari, mobilHakIletisi(hak(BITIS - 8 * GUN))], ["gecerli", false, ""], "8 gün kala uyarı yok");
    assert.equal(mobilHakIletisi(hak(BITIS - 7 * GUN)), "Lisansınız 7 gün sonra bitiyor.", "7 gün kala");
    assert.equal(mobilHakIletisi(hak(BITIS - 1)), "Lisansınız 1 gün sonra bitiyor.", "bitiş gecesi 23:59:59,999");
    assert.deepEqual([hak(BITIS).durum, hak(BITIS).acik, hak(BITIS).kalanGun], ["hosgoru", true, 30], "bitiş anı (gece yarısı): hoşgörü başlar");
    assert.equal(mobilHakIletisi(hak(BITIS)), "Lisansınız bitti; mobil kullanım hakkınız 30 gün sonra sona erecek.");
    assert.equal(hak(BITIS + 29 * GUN).kalanGun, 1, "29. günün sonu (30. gün başı): 1 gün");
    assert.equal(mobilHakIletisi(hak(BITIS + 30 * GUN - 1)), "Lisansınız bitti; mobil kullanım hakkınız 1 gün sonra sona erecek.", "30. günün son anı hâlâ açık");
    assert.deepEqual([hak(BITIS + 30 * GUN).durum, hak(BITIS + 30 * GUN).acik], ["bitti", false], "30. günün sonunda (gece yarısı) kapanır");
    assert.equal(mobilHakIletisi(hak(BITIS + 31 * GUN)), "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin.", "31. gün");
    assert.equal(mobilHakki({ kind: "license", status: "active", expiresAt: null }, BITIS).durum, "gecerli", "süresiz lisans");
  });

  it("deneme bitişte HEMEN kapanır (hoşgörü yok); engelli hemen kapanır; silme anı: bitiş + 30 gün, engel + 30 gün (erken olanı)", () => {
    const { mobilHakki, mobilHakIletisi, mobilSilmeAni } = protokol;
    const deneme = { kind: "trial", status: "active", expiresAt: BITIS };
    assert.equal(mobilHakIletisi(mobilHakki(deneme, BITIS - 3 * GUN)), "Deneme süreniz 3 gün sonra bitiyor.");
    assert.deepEqual([mobilHakki(deneme, BITIS - 1).acik, mobilHakki(deneme, BITIS).acik, mobilHakki(deneme, BITIS).durum], [true, false, "deneme-bitti"], "deneme bitiş anında kapanır");
    assert.equal(mobilHakIletisi(mobilHakki(deneme, BITIS)), "Deneme süreniz bitti; mobil kullanım kapalı. Lisans alınca yeniden açılır.");
    const engelli = { kind: "license", status: "blocked", expiresAt: null };
    assert.deepEqual([mobilHakki(engelli, T0).durum, mobilHakki(engelli, T0).acik], ["engelli", false], "engel hemen kapatır");
    assert.equal(mobilHakIletisi(mobilHakki(engelli, T0)), "Lisansınız engellendi; mobil kullanım kapalı.");
    assert.equal(mobilSilmeAni(deneme), BITIS + 30 * GUN, "deneme: bitiş + 30 gün");
    assert.equal(mobilSilmeAni({ kind: "license", status: "active", expiresAt: BITIS }), BITIS + 30 * GUN, "lisans: hoşgörü sonu = silme");
    assert.equal(mobilSilmeAni(engelli, { engelMs: null }), null, "engelin ilk görülmesi bilinmeden silme anı yok");
    assert.equal(mobilSilmeAni(engelli, { engelMs: T0 }), T0 + 30 * GUN, "engel + 30 gün");
    assert.equal(mobilSilmeAni({ kind: "license", status: "blocked", expiresAt: BITIS }, { engelMs: BITIS + 10 * GUN }), BITIS + 30 * GUN, "ikisi varsa erken olanı");
    assert.equal(mobilSilmeAni({ kind: "license", status: "active", expiresAt: null }), null, "süresiz geçerli lisans silinmez");
  });
});

describe("2.4.8 L1 — kapıcı: hoşgörüde son özet, canlı kapı ve tünel açık; yeni cihaz eklenmez; sonunda kapanır", () => {
  it("ücretli lisans: 7 gün kala özette uyarı; bitişten 30 gün salt okunur (özet + canlı + tünel), 30. günün sonunda kapanır ve ileti 'sona erdi'", async () => {
    const c = ortam();
    const { ofis, tels } = await c.ofisKur({ makine: makine(1), k: LISANS() });
    c.saat(BITIS - 8 * GUN);
    assert.deepEqual([(await c.ozet(ofis, tels[0])).status, (await c.ozet(ofis, tels[0])).uyari], [200, ""], "8 gün kala uyarı yok");
    c.saat(BITIS - 7 * GUN);
    assert.equal((await c.ozet(ofis, tels[0])).uyari, "Lisansınız 7 gün sonra bitiyor.", "7 gün kala telefon uyarısı (son özet yanıtında)");
    c.saat(BITIS);
    const ilk = await c.ozet(ofis, tels[0]);
    assert.deepEqual([ilk.status, ilk.uyari], [200, "Lisansınız bitti; mobil kullanım hakkınız 30 gün sonra sona erecek."], `bitiş anında son özet açık + hoşgörü uyarısı: ${JSON.stringify(ilk)}`);
    assert.equal((await c.canli(ofis, tels[0])).status, 200, "hoşgörüde canlı kapı geçer");
    assert.equal((await c.tunel(ofis)).status, 200, "hoşgörüde tünel verilir");
    c.saat(BITIS + 29 * GUN);
    assert.equal((await c.ozet(ofis, tels[0])).uyari, "Lisansınız bitti; mobil kullanım hakkınız 1 gün sonra sona erecek.", "29. gün");
    c.saat(BITIS + 30 * GUN - 1);
    assert.equal((await c.ozet(ofis, tels[0])).status, 200, "30. günün son anı açık");
    c.saat(BITIS + 30 * GUN);
    const son = await c.ozet(ofis, tels[0]);
    assert.deepEqual([son.status, son.code, son.error], [403, "kapi-lisans", "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin."], `30. günün sonunda kapanır: ${JSON.stringify(son)}`);
    assert.deepEqual([(await c.canli(ofis, tels[0])).status, (await c.tunel(ofis)).status], [403, 403], "canlı kapı ve tünel de kapanır");
  });

  it("deneme bitişte hemen kapanır (özet, canlı, tünel); engelli lisans hemen kapanır — iletiler hakkın durumuna göre", async () => {
    const c = ortam();
    const d = await c.ofisKur({ makine: makine(2), k: DENEME() });
    c.saat(BITIS - 1);
    assert.equal((await c.ozet(d.ofis, d.tels[0])).status, 200, "deneme son anında açık");
    c.saat(BITIS);
    const r = await c.ozet(d.ofis, d.tels[0]);
    assert.deepEqual([r.status, r.error], [403, "Deneme süreniz bitti; mobil kullanım kapalı. Lisans alınca yeniden açılır."], "deneme bitiş anında kapanır");
    assert.deepEqual([(await c.canli(d.ofis, d.tels[0])).status, (await c.tunel(d.ofis)).status], [403, 403]);
    const e = await c.ofisKur({ makine: makine(3), k: LISANS({ expiresAt: null }) });
    c.servisKaydi.set(makine(3), LISANS({ status: "blocked", expiresAt: null }));
    c.ilerle(31 * MIN); // kapıcı belirteci 30 dk'dan eskiyse servisten yeniler (P9)
    const b = await c.ozet(e.ofis, e.tels[0]);
    assert.deepEqual([b.status, b.error], [403, "Lisansınız engellendi; mobil kullanım kapalı."], "engel hemen kapatır (hoşgörü yok)");
  });

  it("hoşgörüde mevcut cihazlar sürer, YENİ cihaz eklenmez; lisansı geçersiz YENİ ofis kapıcıya yazılmaz", async () => {
    const c = ortam();
    const { ofis, tels, makine: m } = await c.ofisKur({ makine: makine(4), k: LISANS() });
    c.saat(BITIS + 2 * GUN);
    assert.equal((await c.kayit(ofis, { makine: m, cihazlar: tels })).ok, true, "hoşgörüde aynı cihaz listesiyle kayıt kabul");
    const yeni = await cihaz();
    const r = await c.kayit(ofis, { makine: m, cihazlar: [...tels, yeni] });
    assert.equal(r.code, "kapi-lisans", `hoşgörüde cihaz ekleme reddedilmeli: ${JSON.stringify(r)}`);
    assert.deepEqual(c.meta(ofis.id).cihazlar.map(x => x.id), tels.map(x => x.id), "yeni cihaz listeye girmedi");
    const biten = await ofisAnahtari();
    c.servisKaydi.set(makine(5), DENEME({ expiresAt: new Date(BITIS - GUN).toISOString() }));
    const yeniOfis = await c.kayit(biten, { makine: makine(5), cihazlar: [] });
    assert.equal(yeniOfis.code, "kapi-lisans", "süresi dolmuş denemenin YENİ ofisi reddedilir");
    assert.equal(c.meta(biten.id), null, "geçersiz lisanslı yeni ofis kapıcıya yazılmadı");
  });
});

describe("2.4.8 L1 — kapıcının zamanlanmış temizliği (Worker Cron): silme zamanı, güvenli sıra, başka ofise dokunmama", () => {
  it("deneme: bitişten 30 gün geçmeden SİLİNMEZ; 30. günde ofis kaydı, özet, tünel, DNS silinir; geçerli lisanslı komşu ofise dokunulmaz", async () => {
    const c = ortam();
    assert.equal(typeof c.kapi.temizlik, "function", "kapıcıda zamanlanmış temizlik yok (2.4.8 L1)");
    const d = await c.ofisKur({ makine: makine(10), k: DENEME() });
    const komsu = await c.ofisKur({ makine: makine(11), k: LISANS({ expiresAt: null }) });
    c.saat(BITIS + 30 * GUN - 1);
    await c.temizlik();
    assert.deepEqual(c.kayitVar(d.ofis), HEPSI, "30 gün dolmadan hiçbir şey silinmez");
    c.saat(BITIS + 30 * GUN);
    const rapor = await c.temizlik();
    assert.deepEqual(rapor.silinen, [d.ofis.id], `yalnız süresi geçen ofis silindi: ${JSON.stringify(rapor)}`);
    assert.deepEqual(c.kayitVar(d.ofis), HIC, "ofis kaydı + R2 özeti + tünel + DNS silindi");
    assert.equal(c.var(`silinen/${d.ofis.id}.json`), true, "silinen kaydın izi");
    const m = JSON.parse(new TextDecoder().decode(c.r2.nesneler.get(`makine/${makine(10)}.json`).veri));
    assert.equal(m.ofis, null, "makine eşlemesi boşaldı");
    assert.deepEqual(c.kayitVar(komsu.ofis), HEPSI, "başka ofisin kaydına, özetine, tüneline, DNS'ine dokunulmadı");
    assert.equal((await c.ozet(komsu.ofis, komsu.tels[0])).status, 200, "komşu ofis çalışıyor");
    assert.ok(!c.cf.calls.some(x => x.includes(komsu.ofis.id) && x.startsWith("delete")), "komşu ofis için Cloudflare silmesi çağrılmadı");
  });

  it("ücretli lisans: hoşgörünün son anında kayıt durur, 30. günün sonundaki ilk turda HEMEN silinir; telefon 'eşli değil' değil kayıt yok görür", async () => {
    const c = ortam();
    const l = await c.ofisKur({ makine: makine(12), k: LISANS() });
    c.saat(BITIS + 30 * GUN - 1);
    assert.deepEqual((await c.temizlik()).silinen, [], "hoşgörü sürerken silinmez");
    assert.equal((await c.ozet(l.ofis, l.tels[0])).status, 200);
    c.saat(BITIS + 30 * GUN);
    assert.deepEqual((await c.temizlik()).silinen, [l.ofis.id], "hoşgörü bitince ilk turda silinir");
    assert.deepEqual(c.kayitVar(l.ofis), HIC);
    assert.equal((await c.ozet(l.ofis, l.tels[0])).code, "kapi-cihaz", "silinen ofiste cihaz geçmez");
  });

  it("engel: ilk tur engeli kaydeder; engelden 29 gün sonra durur, 30 gün sonra silinir; engel kalkarsa (lisans açıldı) kayıt silinmez", async () => {
    const c = ortam();
    const e = await c.ofisKur({ makine: makine(13), k: LISANS({ expiresAt: null }) });
    const a = await c.ofisKur({ makine: makine(14), k: LISANS({ expiresAt: null }) });
    c.servisKaydi.set(makine(13), LISANS({ status: "blocked", expiresAt: null }));
    c.servisKaydi.set(makine(14), LISANS({ status: "blocked", expiresAt: null }));
    c.ilerle(25 * 3_600_000);
    const engelAni = c.now();
    await c.temizlik();
    assert.equal(c.meta(e.ofis.id).engel?.ms, engelAni, "engelin ilk görüldüğü an kayda yazıldı");
    c.servisKaydi.set(makine(14), LISANS({ expiresAt: null })); // a'nın engeli kalktı
    c.saat(engelAni + 29 * GUN);
    await c.temizlik();
    assert.deepEqual(c.kayitVar(e.ofis), HEPSI, "engelden 29 gün sonra silinmez");
    assert.equal(c.meta(a.ofis.id).engel, undefined, "engel kalkınca iz düşer");
    c.saat(engelAni + 30 * GUN);
    const r = await c.temizlik();
    assert.deepEqual(r.silinen, [e.ofis.id], `engelden 30 gün sonra yalnız engelli ofis silinir: ${JSON.stringify(r)}`);
    assert.deepEqual(c.kayitVar(a.ofis), HEPSI, "engeli kalkan ofis durur");
  });

  it("lisans yenilendiyse (servis yeni bitiş verdi) saklı belirteç 30 günden eski olsa da SİLİNMEZ; servise ulaşılamıyorsa hiçbir şey silinmez", async () => {
    const c = ortam();
    const y = await c.ofisKur({ makine: makine(15), k: LISANS() });
    const s = await c.ofisKur({ makine: makine(16), k: DENEME() });
    c.servisKaydi.set(makine(15), LISANS({ expiresAt: new Date(BITIS + 365 * GUN).toISOString() }));
    c.saat(BITIS + 40 * GUN);
    c.servisErisim = false;
    assert.deepEqual((await c.temizlik()).silinen, [], "servis yokken (taze bilgi yok) silinmez");
    assert.deepEqual([c.kayitVar(y.ofis), c.kayitVar(s.ofis)], [HEPSI, HEPSI]);
    c.servisErisim = true;
    c.ilerle(2 * MIN);
    const r = await c.temizlik();
    assert.deepEqual(r.silinen, [s.ofis.id], `yenilenen lisanslı ofis kalır, deneme silinir: ${JSON.stringify(r)}`);
    assert.deepEqual(c.kayitVar(y.ofis), HEPSI);
    assert.equal((await c.ozet(y.ofis, y.tels[0])).status, 200, "yenilenen ofisin telefonu çalışıyor");
  });

  it("Cloudflare yanıt vermezse silme yarıda kalır (işaret kalır), sonraki turda tamamlanır", async () => {
    const c = ortam();
    const d = await c.ofisKur({ makine: makine(17), k: DENEME() });
    c.saat(BITIS + 30 * GUN);
    c.cf.bozuk = true;
    const r1 = await c.temizlik();
    assert.deepEqual([r1.silinen, r1.hata.length], [[], 1], `Cloudflare hatası: ${JSON.stringify(r1)}`);
    assert.equal(c.meta(d.ofis.id).silme?.neden, "deneme-bitti", "silme işareti kaldı");
    assert.equal(c.var(`ofis/${d.ofis.id}/ozet.json`), true, "Cloudflare'den önce R2 silinmedi (sıra)");
    c.cf.bozuk = false;
    c.ilerle(3_600_000);
    assert.deepEqual((await c.temizlik()).silinen, [d.ofis.id], "sonraki tur tamamladı");
    assert.deepEqual(c.kayitVar(d.ofis), HIC);
  });

  it("ZORLA: silme sürerken program yenilenen lisansla kaydolursa ofis kaydı SİLİNMEZ (iz yazılmaz), telefon çalışmayı sürdürür", async () => {
    const c = ortam();
    const d = await c.ofisKur({ makine: makine(18), k: DENEME() });
    c.saat(BITIS + 30 * GUN);
    let ulasti;
    let birak;
    const ulastiSoz = new Promise(r => (ulasti = r));
    c.cf.engel = { ad: `destekofis-${d.ofis.id}`, ulasti: () => ulasti(), kapi: new Promise(r => (birak = r)) };
    const tur = c.temizlik();
    await ulastiSoz; // silme işareti yazıldı, Cloudflare'de bekliyor
    c.servisKaydi.set(makine(18), LISANS({ expiresAt: new Date(BITIS + 365 * GUN).toISOString() }));
    const geri = await c.kayit(d.ofis, { makine: makine(18), cihazlar: d.tels });
    assert.equal(geri.ok, true, `ön koşul: yenilenen lisansla kayıt kabul: ${JSON.stringify(geri)}`);
    c.cf.engel = null;
    birak();
    const r = await tur;
    assert.deepEqual(r.silinen, [], `yarışta silme bırakılmalı: ${JSON.stringify(r)}`);
    assert.equal(c.var(`ofis/${d.ofis.id}/meta.json`), true, "ofis kaydı durdu");
    assert.equal(c.var(`silinen/${d.ofis.id}.json`), false, "silinen kaydın izi yazılmadı");
    assert.equal(c.meta(d.ofis.id).silme, undefined, "yeniden kayıt işareti kaldırdı");
    assert.equal((await c.ozet(d.ofis, d.tels[0])).status, 200, "telefon son özeti almayı sürdürür (Cloudflare yanıtından sonra kayıt yeniden okundu, özet silinmedi)");
  });

  it("ZORLA (2): program özet silinirken yeniden kaydolursa da ofis kaydı silinmez; silinen kaydın izi geri alınır, telefon geçer", async () => {
    const c = ortam();
    const d = await c.ofisKur({ makine: makine(20), k: DENEME() });
    c.saat(BITIS + 30 * GUN);
    let ulasti;
    let birak;
    const ulastiSoz = new Promise(r => (ulasti = r));
    const kapi = new Promise(r => (birak = r));
    const asilSil = c.r2.delete.bind(c.r2);
    c.r2.delete = async key => {
      if (key === `ofis/${d.ofis.id}/ozet.json`) {
        ulasti();
        await kapi;
      }
      return asilSil(key);
    };
    const tur = c.temizlik();
    await ulastiSoz; // Cloudflare silindi, R2 özeti silinmek üzere
    c.servisKaydi.set(makine(20), LISANS({ expiresAt: new Date(BITIS + 365 * GUN).toISOString() }));
    const geri = await c.kayit(d.ofis, { makine: makine(20), cihazlar: d.tels });
    assert.equal(geri.ok, true, `ön koşul: yenilenen lisansla kayıt kabul: ${JSON.stringify(geri)}`);
    birak();
    const r = await tur;
    c.r2.delete = asilSil;
    assert.deepEqual(r.silinen, [], `yarışta silme bırakılmalı: ${JSON.stringify(r)}`);
    assert.equal(c.var(`ofis/${d.ofis.id}/meta.json`), true, "ofis kaydı durdu");
    assert.equal(c.var(`silinen/${d.ofis.id}.json`), false, "silinen kaydın izi geri alındı");
    assert.equal(c.meta(d.ofis.id).cihazlar.length, 1, "cihaz listesi korundu");
    assert.equal((await c.ozet(d.ofis, d.tels[0])).code, "kapi-ozet-yok", "telefon geçiyor (özet program tarafından yeniden yüklenir — K1 (b))");
  });

  it("silinmiş kayıt GERİ GELMEZ: lisans alınınca aynı kimlik cihazsız açılır ve 'silindi' bildirilir; geçersiz lisansla kayıt açılmaz; başka anahtar alamaz", async () => {
    const c = ortam();
    const d = await c.ofisKur({ makine: makine(19), k: DENEME(), n: 2 });
    c.saat(BITIS + 30 * GUN);
    assert.deepEqual((await c.temizlik()).silinen, [d.ofis.id]);
    c.ilerle(GUN);
    const hala = await c.kayit(d.ofis, { makine: makine(19), cihazlar: d.tels });
    assert.deepEqual([hala.code, Boolean(hala.silindi)], ["kapi-lisans", true], `lisans hâlâ yok: kayıt açılmaz, silindi bildirilir: ${JSON.stringify(hala)}`);
    assert.equal(c.meta(d.ofis.id), null, "geçersiz lisansla kayıt yeniden yazılmadı");
    const sahte = await ofisAnahtari(d.ofis.id);
    c.servisKaydi.set(makine(19), LISANS({ expiresAt: new Date(BITIS + 400 * GUN).toISOString() }));
    assert.equal((await c.kayit(sahte, { makine: makine(19), cihazlar: [] })).code, "kapi-ofis-anahtari", "silinen ofisin kimliğini başka anahtar alamaz");
    const alindi = await c.kayit(d.ofis, { makine: makine(19), cihazlar: d.tels });
    assert.equal(alindi.ok, true, JSON.stringify(alindi));
    assert.deepEqual([alindi.data.cihaz, Boolean(alindi.data.silindi), alindi.data.silindi?.neden], [0, true, "deneme-bitti"], "cihazsız açıldı + silindi bildirildi");
    assert.deepEqual(c.meta(d.ofis.id).cihazlar, [], "eski cihazlar geri gelmedi");
    assert.equal(c.var(`silinen/${d.ofis.id}.json`), false, "iz yeniden açılışta kalktı");
    assert.equal((await c.ozet(d.ofis, d.tels[0])).code, "kapi-cihaz", "eski telefon karekodla yeniden eşlenmeli");
  });

  it("tur sınırı: dış istek bütçesi aşılınca kalanlar sonraki tura kalır; birkaç turda hepsi silinir, geçerli ofisler kalır", async () => {
    const c = ortam();
    const biten = [];
    for (let i = 0; i < 9; i += 1) biten.push(await c.ofisKur({ makine: makine(30 + i), k: DENEME() }));
    const kalan = await c.ofisKur({ makine: makine(50), k: LISANS({ expiresAt: null }) });
    c.saat(BITIS + 31 * GUN);
    const r1 = await c.temizlik();
    assert.ok(r1.silinen.length > 0 && r1.silinen.length < 9, `ilk turda bütçe kadar: ${r1.silinen.length}, ertelenen ${r1.ertelenen}`);
    for (let i = 0; i < 4; i += 1) {
      c.ilerle(3_600_000);
      await c.temizlik();
    }
    assert.deepEqual(biten.map(b => c.kayitVar(b.ofis).meta), Array(9).fill(false), "birkaç turda hepsi silindi");
    assert.deepEqual(c.kayitVar(kalan.ofis), HEPSI, "geçerli ofis kaldı");
  });
});

describe("2.4.8 L1 — dağıtım yapılandırması", () => {
  it("wrangler.toml saatte bir zamanlanmış tur tanımlar; Worker scheduled işleyicisi var", async () => {
    const { readFileSync } = await import("node:fs");
    const toml = readFileSync(new URL("../bulut/kapi/wrangler.toml", import.meta.url), "utf8");
    assert.match(toml, /\[triggers\]\s*\r?\ncrons\s*=\s*\["\d{1,2} \* \* \* \*"\]/, "saatlik cron");
    const modul = await import("../bulut/kapi/kapi.mjs");
    assert.equal(typeof modul.default.scheduled, "function", "Worker scheduled işleyicisi");
  });
});
