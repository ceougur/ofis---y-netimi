// 2.4.8 KARAR S-L1a (30.10.2026 20:38 UTC, 5 dk yetkisiyle): lisans servisinin AÇIKÇA tanımadığı (LICENSE_NOT_FOUND) ofisin kapıcı kaydı, kapıcının o ofisi
// son gördüğü andan (meta.sonKayit) 60 gün sonra silinir. Servis ulaşılamazken (ağ hatası) silinmez; arada program kaydolursa sayaç sıfırlanır; başka ofise
// dokunulmaz; silme yolu L1 ile aynı (iz dosyası silinen/<ofis>.json). Gerçek createKapi (bulut/kapi/kapi.mjs) + sahte R2 + sahte saat + sahte lisans servisi
// (işlev; ders 30: gerçek lisans servisine ve Cloudflare'e istek YOK). Eski kodda (009674a1) bu kural yok → 60. günde "silinmedi" ile kırmızı (ders 7, 38).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKapi } from "../bulut/kapi/kapi.mjs";
import { TEMIZLIK } from "../bulut/kapi/temizlik.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { sahteOnbellek, sahteR2 } from "./kapi-yerel.mjs";
import { cihaz, lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";

const GUN = 86_400_000;
const T0 = Date.parse("2026-11-02T10:00:00+03:00");
const makine = i => `${String(i).padStart(4, "0")}${"cd".repeat(14)}`;
const LISANS = { kind: "license", status: "active", expiresAt: new Date(T0 + 400 * GUN).toISOString() };

function ortam() {
  let t = T0;
  const lisans = lisansAnahtari();
  const r2 = sahteR2();
  const servis = new Map(); // makine → "gecerli" | "tanimiyor" | "erisilemez"
  const kapi = createKapi({
    now: () => t,
    onbellek: sahteOnbellek(),
    lisansFetch: async (url, init) => {
      const body = JSON.parse(init.body);
      const durum = servis.get(body.machine) || "gecerli";
      if (durum === "erisilemez") throw new TypeError("fetch failed (test: lisans servisi ulaşılamıyor)");
      // Site kapi_durum_impl'in tanımadığı lisans/makine yanıtı (lisans.reject 'LICENSE_NOT_FOUND', 409).
      if (durum === "tanimiyor") return { status: 409, json: async () => ({ ok: false, code: "LICENSE_NOT_FOUND", error: "Lisans bulunamadı.", status: 409 }) };
      return { status: 200, json: async () => ({ ok: true, token: lisans.belirtec({ at: t, machine: body.machine, licenseId: body.licenseId, ...LISANS }) }) };
    },
    fetchOrigin: async () => new Response("{}", { status: 200 }),
  });
  const env = { OZET: r2, LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: "destekofis.test", LISANS_URL: "https://lisans.kapi.test/api/lisans", KAPI_LISANS_ANAHTARI: "gizli-test" };
  const istemci = kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl: async (url, init = {}) => kapi.fetch(new Request(url, init), env), simdi: () => t, kayitSimdi: () => t });
  const ctx = {
    servis,
    saat: ms => {
      t = ms;
    },
    async kayit(o, m, tels) {
      t += 1;
      return istemci.kayit(o, { lisans: lisans.belirtec({ at: t, machine: m, licenseId: `LIS-${m.slice(0, 6)}`, ...LISANS }), cihazlar: tels.map(x => ({ id: x.id, anahtar: x.anahtar })) });
    },
    // Program yeniden kaydolur, elinde son (bayat) belirteci var — servise ulaşamadığı için yenileyemedi.
    async eskiBelirtecleKayit(o, m, tels, belirtecAni) {
      t += 1;
      return istemci.kayit(o, { lisans: lisans.belirtec({ at: belirtecAni, machine: m, licenseId: `LIS-${m.slice(0, 6)}`, ...LISANS }), cihazlar: tels.map(x => ({ id: x.id, anahtar: x.anahtar })) });
    },
    async ofisKur(i) {
      const o = await ofisAnahtari();
      const tels = [await cihaz()];
      const r = await ctx.kayit(o, makine(i), tels);
      assert.equal(r.ok, true, `ön koşul: kayıt kabul: ${JSON.stringify(r)}`);
      return { o, m: makine(i), tels };
    },
    var: o => r2.nesneler.has(`ofis/${o.id}/meta.json`),
    mezar: o => {
      const k = r2.nesneler.get(`silinen/${o.id}.json`);
      return k ? JSON.parse(new TextDecoder().decode(k.veri)) : null;
    },
    temizlik: async ms => {
      t = ms;
      return kapi.temizlik(env);
    },
  };
  return ctx;
}

describe("2.4.8 S-L1a — lisans servisinin tanımadığı ofisin kapıcı kaydı son görülmeden 60 gün sonra silinir", () => {
  it("59. gün silinmez, 60. gün silinir (iz dosyasıyla); servis ulaşılamazken 90. gün silinmez; geçerli lisanslı ofise dokunulmaz", async () => {
    const c = ortam();
    const a = await c.ofisKur(1); // servis tanımıyor
    const b = await c.ofisKur(2); // geçerli lisans
    const k = await c.ofisKur(3); // servis ulaşılamıyor
    const gorulme = T0 + 3; // üç kaydın sonuncusu (her kayıt +1 ms); A'nınki T0 + 1
    c.servis.set(a.m, "tanimiyor");
    c.servis.set(k.m, "erisilemez");

    await c.temizlik(T0 + 1 + 59 * GUN);
    assert.equal(c.var(a.o), true, "59. gün: tanımayan ofis silinmez");
    await c.temizlik(T0 + 1 + 60 * GUN - 60_000);
    assert.equal(c.var(a.o), true, "60 günden 1 dk önce silinmez");

    const tur = await c.temizlik(T0 + 1 + 60 * GUN);
    assert.equal(c.var(a.o), false, `60. gün: servisin tanımadığı ofisin kapıcı kaydı silinmedi (rapor: ${JSON.stringify(tur)})`);
    assert.deepEqual(tur.silinen, [a.o.id], "yalnız tanımayan ofis silinir");
    assert.equal(c.mezar(a.o)?.neden, "tanimiyor", "iz dosyası (L1 silme yolu) neden 'tanimiyor'");
    assert.equal(c.var(b.o), true, "geçerli lisanslı ofise dokunulmaz");
    assert.equal(c.var(k.o), true, "servis ulaşılamazken silinmez");

    await c.temizlik(gorulme + 90 * GUN);
    assert.equal(c.var(k.o), true, "servis ulaşılamazken 90. gün de silinmez (geçici erişim hatası 'tanımıyor' sayılmaz)");
    assert.equal(c.var(b.o), true, "geçerli lisanslı ofis 90. günde de durur");
    assert.equal(c.mezar(k.o), null);
    assert.equal(TEMIZLIK.tanimayanMs, 60 * GUN, "TEMIZLIK.tanimayanMs (adlı sabit, 60 gün)");
  });

  it("arada program kaydolursa sayaç sıfırlanır: son kayıttan 60 gün dolmadan silinmez, dolunca silinir", async () => {
    const c = ortam();
    const d = await c.ofisKur(4);
    c.servis.set(d.m, "tanimiyor");
    await c.temizlik(T0 + 30 * GUN);
    assert.equal(c.var(d.o), true, "30. gün durur");
    // 40. gün: program açıldı, elindeki (bayat) belirteçle kaydoldu — kapıcı ofisi gördü.
    c.saat(T0 + 40 * GUN);
    const r = await c.eskiBelirtecleKayit(d.o, d.m, d.tels, T0 + 1);
    assert.equal(r.code, "kapi-lisans-dogrulanamadi", `ön koşul: kayıt yazıldı ama lisans doğrulanamadı: ${JSON.stringify(r)}`);
    const son = T0 + 40 * GUN + 1;
    await c.temizlik(T0 + 1 + 60 * GUN);
    assert.equal(c.var(d.o), true, "ilk kayıttan 60 gün geçti ama son kayıttan geçmedi → silinmez (sayaç sıfırlandı)");
    await c.temizlik(son + 60 * GUN - 60_000);
    assert.equal(c.var(d.o), true, "son kayıttan 60 günden 1 dk önce silinmez");
    await c.temizlik(son + 60 * GUN);
    assert.equal(c.var(d.o), false, "son kayıttan 60 gün sonra silinir");
  });
});
