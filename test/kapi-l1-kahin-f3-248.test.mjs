// 2.4.8 L1 kâhin farkı F3 (D01; KARAR P17 = A, 30.10.2026 21:30 UTC): kayıt silindikten sonra telefon "Bu cihaz eşli değil ya da eşlemesi kaldırıldı…" alıyordu;
// KARAR L1 uyarısı "sonra 'Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin'". P17 A: kapıcı iletiyi silinen kaydın izinden (silinen/<ofis>.json; yalnız
// neden + an) verir. KÖK NEDEN: kapıcının telefon yolları kaydı silinmiş ofiste izi okumuyordu (kayıt yok = "eşli değil"). Gerçek createKapi + sahte R2 + sahte
// saat + sahte lisans servisi (ders 30). Eski kodda (fd33d747) "eşli değil" iletisiyle kırmızı (ders 7, 38).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKapi } from "../bulut/kapi/kapi.mjs";
import { kapiIstemcisi } from "../server/lib/mobile-ozet.mjs";
import { CIHAZ_CEREZI } from "../server/lib/mobil-cerez.mjs";
import { sahteOnbellek, sahteR2 } from "./kapi-yerel.mjs";
import { cihaz, lisansAnahtari, ofisAnahtari } from "./kapi-ortak.mjs";

const GUN = 86_400_000;
const SAAT = 3_600_000;
const BITIS = Date.parse("2026-12-01T00:00:00+03:00");
const SILME = BITIS + 30 * GUN;
const SONA_ERDI = "Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin.";
const makine = i => `${String(i).padStart(4, "0")}${"f3".repeat(14)}`;
const LISANS = (ek = {}) => ({ kind: "license", status: "active", expiresAt: new Date(BITIS).toISOString(), ...ek });
const DENEME = { kind: "trial", status: "active", expiresAt: new Date(BITIS).toISOString() };

function ortam() {
  let t = BITIS - 20 * GUN;
  const lisans = lisansAnahtari();
  const r2 = sahteR2();
  const servis = new Map();
  const ctx = { erisim: true };
  const kapi = createKapi({
    now: () => t,
    onbellek: sahteOnbellek(),
    lisansFetch: async (_url, init) => {
      if (!ctx.erisim) throw new TypeError("fetch failed (test: lisans servisi yok)");
      const b = JSON.parse(init.body);
      return { json: async () => ({ ok: true, token: lisans.belirtec({ at: t, machine: b.machine, licenseId: b.licenseId, ...servis.get(b.machine) }) }) };
    },
    fetchOrigin: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const env = { OZET: r2, LISANS_ANAHTARLARI: JSON.stringify(lisans.trusted), OFIS_ALANI: "destekofis.test", LISANS_URL: "https://lisans.kapi.test/api/lisans", KAPI_LISANS_ANAHTARI: "x" };
  const istemci = kapiIstemcisi({ url: "https://kapi.destekofis.test", fetchImpl: async (u, i = {}) => kapi.fetch(new Request(u, i), env), simdi: () => t, kayitSimdi: () => t });
  Object.assign(ctx, {
    servis,
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
    async canli(o, tel) {
      const r = await kapi.fetch(new Request(`https://${o.id}.destekofis.test/api/mobil/session`, { headers: { cookie: `${CIHAZ_CEREZI}=${tel.id}.sir` } }), env);
      const veri = await r.json().catch(() => ({}));
      return { status: r.status, code: veri.code || "", error: veri.error || "" };
    },
    async esle(o) {
      const r = await kapi.fetch(new Request(`https://${o.id}.destekofis.test/api/mobil/eslesme`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kod: "K", ad: "Tel" }) }), env);
      const veri = await r.json().catch(() => ({}));
      return { status: r.status, code: veri.code || "", error: veri.error || "" };
    },
    temizlik: () => kapi.temizlik(env),
    meta: o => r2.nesneler.has(`ofis/${o.id}/meta.json`),
    mezar: o => {
      const k = r2.nesneler.get(`silinen/${o.id}.json`);
      return k ? JSON.parse(new TextDecoder().decode(k.veri)) : null;
    },
  });
  return ctx;
}

describe("2.4.8 L1 kâhin F3 — silinmiş kayıtta telefon 'Mobil kullanım hakkınız sona erdi; lisansınızı yenileyin' iletisini kapıcıdan alır (P17 A)", () => {
  it("ücretli: silme anındaki ilk istek ve sonraki özet / canlı istekleri bu iletiyi alır; yeni eşleme aynı iletiyle reddedilir", async () => {
    const c = ortam();
    const a = await c.ofisKur(1, LISANS());
    c.saat(SILME);
    const ilk = await c.ozet(a.o, a.tels[0]);
    assert.equal(c.meta(a.o), false, "ön koşul: kayıt silindi");
    assert.deepEqual([ilk.status, ilk.code, ilk.error], [401, "kapi-cihaz", SONA_ERDI], `silme anındaki istek: ${JSON.stringify(ilk)}`);
    c.saat(SILME + GUN);
    const sonra = await c.ozet(a.o, a.tels[0]);
    assert.deepEqual([sonra.code, sonra.error], ["kapi-cihaz", SONA_ERDI], `silinmiş kayıtta telefon 'eşli değil' değil 'sona erdi' almalı: ${JSON.stringify(sonra)}`);
    const canli = await c.canli(a.o, a.tels[0]);
    assert.deepEqual([canli.code, canli.error], ["kapi-cihaz", SONA_ERDI], `canlı istek: ${JSON.stringify(canli)}`);
    const esle = await c.esle(a.o);
    assert.deepEqual([esle.code, esle.error], ["kapi-lisans", SONA_ERDI], `silinmiş kayıtta yeni eşleme: ${JSON.stringify(esle)}`);
  });

  it("deneme: 30 gün + temizlikle silinen kayıtta da aynı ileti; kayıt yeniden açılınca (lisans alındı) eski telefon yine 'eşli değil' alır", async () => {
    const c = ortam();
    const d = await c.ofisKur(2, DENEME);
    c.saat(SILME + SAAT);
    assert.deepEqual((await c.temizlik()).silinen, [d.o.id], "ön koşul: temizlik sildi");
    const r = await c.ozet(d.o, d.tels[0]);
    assert.deepEqual([r.code, r.error], ["kapi-cihaz", SONA_ERDI], `temizlikle silinen kayıtta: ${JSON.stringify(r)}`);
    c.servis.set(d.m, LISANS({ expiresAt: new Date(BITIS + 400 * GUN).toISOString() }));
    const y = await c.kayit(d.o, d.m, LISANS({ expiresAt: new Date(BITIS + 400 * GUN).toISOString() }), d.tels);
    assert.equal(y.ok, true, `ön koşul: kayıt yeniden açıldı: ${JSON.stringify(y)}`);
    const eski = await c.ozet(d.o, d.tels[0]);
    assert.equal(eski.code, "kapi-cihaz");
    assert.notEqual(eski.error, SONA_ERDI, "kayıt açıkken (iz kalktı) ileti 'eşli değil'");
  });
});
