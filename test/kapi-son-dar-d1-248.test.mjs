// 2.4.8 son dar kontrol D1 (DÜŞÜK): kapıcının canlı vekilinde F2 silmesi (vadesiGecenSil) hız sınırından ÖNCE ve cihazsız isteklerde de çalışıyordu; Cloudflare
// silmesi sürekli hata verirse her kimliksiz istek 1 servis + 2 Cloudflare çağrısı + R2 yazımı ve 500 doğuruyordu (20 istek → 20 servis, 40 Cloudflare). Düzeltme:
// hız sınırı önce; F2 silmesi yalnız cihazı doğrulanmış istekte; başarısız silme ofis başına VADE_SILME_BEKLEME_MS hatırlanır, o sürede yeniden denenmez (istek
// "hak sona erdi" ile reddedilir, 500 yok). Gerçek createKapi + sahte R2 / saat / servis / Cloudflare (ders 30). Eski kodda (3f40b165) çağrı sayısıyla kırmızı.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as kapiModulu from "../bulut/kapi/kapi.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { sahteOnbellek, sahteR2 } from "./kapi-yerel.mjs";
import { cihaz, lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";

const createKapi = kapiModulu.createKapi;
const GUN = 86_400_000;
const BITIS = Date.parse("2026-12-01T00:00:00+03:00");
const SILME = BITIS + 30 * GUN;
const makine = i => `${String(i).padStart(4, "0")}${"d1".repeat(14)}`;
const LISANS = (ek = {}) => ({ kind: "license", status: "active", expiresAt: new Date(BITIS).toISOString(), ...ek });

function ortam() {
  let t = BITIS - 20 * GUN;
  const lisans = lisansAnahtari();
  const r2 = sahteR2();
  const servis = new Map();
  const ctx = { erisim: true, servisCagrisi: 0 };
  const cf = { n: 0 };
  const kapi = createKapi({
    now: () => t,
    // Sürekli hata veren Cloudflare (her çağrı sayılır).
    cloudflare: Object.fromEntries(["findTunnel", "deleteTunnel", "deleteCname"].map(ad => [ad, async () => {
      cf.n += 1;
      const e = new Error("kapi-tunel");
      e.kod = "kapi-tunel";
      throw e;
    }])),
    onbellek: sahteOnbellek(),
    lisansFetch: async (_url, init) => {
      ctx.servisCagrisi += 1;
      if (!ctx.erisim) throw new TypeError("fetch failed (test: lisans servisi yok)");
      const b = JSON.parse(init.body);
      return { json: async () => ({ ok: true, token: lisans.belirtec({ at: t, machine: b.machine, licenseId: b.licenseId, ...servis.get(b.machine) }) }) };
    },
    fetchOrigin: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const env = { OZET: r2, LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: "destekofis.test", LISANS_URL: "https://lisans.kapi.test/api/lisans", KAPI_LISANS_ANAHTARI: "x" };
  const istemci = kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl: async (u, i = {}) => kapi.fetch(new Request(u, i), env), simdi: () => t, kayitSimdi: () => t });
  Object.assign(ctx, {
    cf,
    servis,
    async kimliksiz(o, i) {
      const istek = i % 2 ? new Request(`https://${o.id}.destekofis.test/mobil/`, { headers: { "cf-connecting-ip": `198.51.100.${i}` } })
        : new Request(`https://${o.id}.destekofis.test/api/mobil/eslesme`, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `198.51.100.${i}` }, body: "{}" });
      const r = await kapi.fetch(istek, env);
      return r.status;
    },
    saat: ms => {
      t = ms;
    },
    async kayit(o, m, k, tels) {
      t += 1;
      return istemci.kayit(o, { lisans: lisans.belirtec({ at: t, machine: m, licenseId: `LIS-${m.slice(0, 6)}`, ...k }), cihazlar: tels.map(x => ({ id: x.id, anahtar: x.anahtar })) });
    },
    async ofisKur(i, k) {
      servis.set(makine(i), k);
      const o = await ofisAnahtari();
      const tels = [await cihaz()];
      const r = await ctx.kayit(o, makine(i), k, tels);
      assert.equal(r.ok, true, `ön koşul: kayıt kabul: ${JSON.stringify(r)}`);
      return { o, m: makine(i), tels };
    },
    async ozet(o, tel) {
      const r = await kapi.fetch(new Request(`https://${o.id}.destekofis.test/kapi/ozet`, { headers: await tel.basliklar("GET", t) }), env);
      const veri = await r.json().catch(() => ({}));
      // Özet yüklenmedi: cihaz ve lisans denetimini geçen istek "kapi-ozet-yok" (404) alır = erişim açık.
      return { status: r.status, code: veri.code || "", error: veri.error || "", acik: r.status === 200 || veri.code === "kapi-ozet-yok" };
    },
    meta: o => r2.nesneler.has(`ofis/${o.id}/meta.json`),
    mezar: o => {
      const k = r2.nesneler.get(`silinen/${o.id}.json`);
      return k ? JSON.parse(new TextDecoder().decode(k.veri)) : null;
    },
  });
  return ctx;
}

describe("2.4.8 son dar kontrol D1 — istek yolundaki F2 silmesi kimliksiz istek seli ve sürekli Cloudflare hatasında çağrı üretmez", () => {
  it("silme anı geçmiş ofise 20 kimliksiz istek (eşleme / sayfa): silme denenmez (Cloudflare 0 ≤ 2), servis ≤ 1; 500 yok", async () => {
    const c = ortam();
    const a = await c.ofisKur(1, LISANS());
    c.saat(SILME + 60 * 60_000);
    const servisOnce = c.servisCagrisi;
    const durumlar = [];
    for (let i = 0; i < 20; i += 1) durumlar.push(await c.kimliksiz(a.o, i));
    assert.ok(c.cf.n <= 2, `20 kimliksiz istekte Cloudflare çağrısı ${c.cf.n} (beklenen ≤ 2; her istek silme deniyorsa ~40)`);
    assert.ok(c.servisCagrisi - servisOnce <= 1, `20 kimliksiz istekte lisans servisi çağrısı ${c.servisCagrisi - servisOnce} (beklenen ≤ 1)`);
    assert.equal(durumlar.filter(d => d >= 500).length, 0, `5xx yanıt yok: ${JSON.stringify(durumlar)}`);
  });

  it("cihazı doğrulanmış 20 istek, Cloudflare sürekli hatalı: tek silme denemesi (Cloudflare ≤ 2), sonrakiler 'hak sona erdi' ile reddedilir; bekleme bitince yeniden denenir", async () => {
    const c = ortam();
    const a = await c.ofisKur(2, LISANS());
    c.saat(SILME + 60 * 60_000);
    const yanitlar = [];
    for (let i = 0; i < 20; i += 1) yanitlar.push(await c.ozet(a.o, a.tels[0]));
    assert.ok(c.cf.n <= 2, `20 istekte Cloudflare çağrısı ${c.cf.n} (beklenen ≤ 2: başarısız silme hatırlanmalı)`);
    assert.equal(yanitlar.filter(r => r.status >= 500).length, 0, `5xx yanıt yok: ${JSON.stringify(yanitlar.map(r => r.status))}`);
    assert.deepEqual([yanitlar.at(-1).status, yanitlar.at(-1).error], [403, "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin."], `bekleme içinde ret: ${JSON.stringify(yanitlar.at(-1))}`);
    const once = c.cf.n;
    c.saat(SILME + 60 * 60_000 + kapiModulu.VADE_SILME_BEKLEME_MS + 1000);
    await c.ozet(a.o, a.tels[0]);
    assert.ok(c.cf.n > once, "bekleme bitince silme yeniden denenir");
    assert.equal(kapiModulu.VADE_SILME_BEKLEME_MS, 5 * 60_000, "VADE_SILME_BEKLEME_MS (adlı sabit, 5 dk)");
  });
});
