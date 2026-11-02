// 2.4.8 son dar kontrol D4b (DÜŞÜK): kapıcı temizliğinde ofis kaydını okuyan `oku` hata yalıtımı dışındaydı — R2 hatası ya da bozuk JSON bütün turu düşürüyor,
// imleç sayfa sonuna önceden yazıldığı için aynı sayfadaki sonraki ofisler hep atlanıyordu. Düzeltme: kayıt başına yalıtım; bozuk kayıt atlanır, sayılır
// (rapor.bozuk), günlüğe adıyla yazılır, SİLİNMEZ; tur sürer. Gerçek createKapi + sahte R2 / saat / servis (ders 30). Eski kodda (3f40b165) "tur düştü" ile kırmızı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKapi } from "../bulut/kapi/kapi.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { sahteOnbellek, sahteR2 } from "./kapi-yerel.mjs";
import { cihaz, lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";

const GUN = 86_400_000;
const T0 = Date.parse("2026-11-02T10:00:00+03:00");
const makine = i => `${String(i).padStart(4, "0")}${"d4".repeat(14)}`;
const LISANS = { kind: "license", status: "active", expiresAt: new Date(T0 + 400 * GUN).toISOString() };
const DENEME = { kind: "trial", status: "active", expiresAt: new Date(T0 + 5 * GUN).toISOString() };
const BOZUK_ID = `oa${"a".repeat(15)}`;
const BITEN_ID = `ob${"a".repeat(15)}`;

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
      if (durum === "deneme") return { status: 200, json: async () => ({ ok: true, token: lisans.belirtec({ at: t, machine: body.machine, licenseId: body.licenseId, ...DENEME }) }) };
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
    k: LISANS,
    async kayit(o, m, tels, k = LISANS) {
      t += 1;
      return istemci.kayit(o, { lisans: lisans.belirtec({ at: t, machine: m, licenseId: `LIS-${m.slice(0, 6)}`, ...k }), cihazlar: tels.map(x => ({ id: x.id, anahtar: x.anahtar })) });
    },
    // Program yeniden kaydolur, elinde son (bayat) belirteci var — servise ulaşamadığı için yenileyemedi.
    async eskiBelirtecleKayit(o, m, tels, belirtecAni) {
      t += 1;
      return istemci.kayit(o, { lisans: lisans.belirtec({ at: belirtecAni, machine: m, licenseId: `LIS-${m.slice(0, 6)}`, ...LISANS }), cihazlar: tels.map(x => ({ id: x.id, anahtar: x.anahtar })) });
    },
    r2,
    async ofisKur(i, id) {
      const o = await ofisAnahtari(id);
      const tels = [await cihaz()];
      const r = await ctx.kayit(o, makine(i), tels, ctx.k);
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

describe("2.4.8 son dar kontrol D4b — temizlikte bozuk ofis kaydı turu düşürmez", () => {
  for (const tur of ["bozuk JSON", "R2 okuma hatası"]) {
    it(`${tur}lu kayıt + arkasında süresi geçmiş ofis: ofis silinir, bozuk kayıt durur ve raporda adıyla sayılır`, async () => {
      const c = ortam();
      const bozuk = await c.ofisKur(1, BOZUK_ID);
      c.k = DENEME;
      const biten = await c.ofisKur(2, BITEN_ID);
      c.servis.set(biten.m, "deneme");
      const anahtar = `ofis/${bozuk.o.id}/meta.json`;
      if (tur === "bozuk JSON") c.r2.nesneler.get(anahtar).veri = new TextEncoder().encode("{bozuk");
      else {
        const asil = c.r2.get.bind(c.r2);
        c.r2.get = async key => {
          if (key === anahtar) throw new Error("R2 geçici hata (test)");
          return asil(key);
        };
      }
      let rapor;
      try {
        rapor = await c.temizlik(T0 + 5 * GUN + 30 * GUN + 60_000);
      } catch (error) {
        rapor = { dustu: String(error?.message || error) };
      }
      assert.equal(c.var(biten.o), false, `bozuk kaydın arkasındaki süresi geçmiş ofis silinmedi (tur düştü: ${JSON.stringify(rapor)})`);
      assert.equal(c.r2.nesneler.has(anahtar), true, "bozuk kayıt silinmez");
      assert.deepEqual(rapor.bozuk, [bozuk.o.id], `bozuk kayıt raporda adıyla: ${JSON.stringify(rapor)}`);
      assert.deepEqual(rapor.silinen, [biten.o.id]);
    });
  }
});
